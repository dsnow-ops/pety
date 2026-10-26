const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createSmsBudget, COLLECTION } = require('../uniCloud-alipay/cloudfunctions/common/pety-auth/sms-budget');
const baseline = process.env.PETY_RELEASE_BASELINE === '1' ? 'unpackage/release-sprint-20261010/baseline/source/' : '';
const root = 'uni_modules/uni-id-pages/uniCloud/cloudfunctions/uni-id-co/';

// Local transaction double with durable tables and commit conflicts. It runs
// production handlers, but cannot certify the remote uniCloud transaction API.
function fixture(config = {}, faults = {}) {
  const tables = new Map(); let revision = 0, down = false;
  let time = Date.UTC(2026, 9, 10, 0, 0, 0), serial = 0;
  const clone = structuredClone;
  function adapter(data, changed, transaction = false) {
    return { collection(name) {
      if (!data.has(name)) data.set(name, new Map());
      const rows = data.get(name);
      function query(filter = {}) {
        const matches = row => Object.entries(filter).every(([key, value]) => row[key] === value);
        return { doc: id => query({ _id: id }), where: q => { if (transaction) throw Error('transaction where not supported'); return query(q); }, field() { return this; },
          async get() { if (down) throw Error('isolated DB outage'); const found = [...rows.values()].filter(matches).map(value => clone(value)); const result = { data: transaction ? found[0] || null : found }; return faults.read ? faults.read(result, { name, transaction }) : result; },
          async add(value) { if (down) throw Error('isolated DB outage'); const row = { ...clone(value), _id: value._id || 'isolated-' + (++serial) };
            if (rows.has(row._id)) throw Error('duplicate'); rows.set(row._id, row); changed(); return faults.add ? faults.add({ id: row._id }, { name, transaction }) : { id: row._id }; },
          async update(patch) { if (down) throw Error('isolated DB outage'); let updated = 0;
            for (const [id, row] of rows) if (matches(row)) { rows.set(id, { ...row, ...clone(patch) }); updated++; }
            if (updated) changed(); return faults.update ? faults.update({ updated }, { name, transaction }) : { updated }; }
        };
      }
      return query();
    } };
  }
  const db = { ...adapter(tables, () => revision++), async startTransaction() {
    if (down) throw Error('isolated DB outage'); const snapshot = clone(tables), base = revision;
    return { ...adapter(snapshot, () => {}, true), async commit() {
      if (down || base !== revision) throw Error('isolated transaction conflict');
      for (const [key, values] of snapshot) {
        const rows = tables.get(key) || new Map(); rows.clear();
        for (const [id, row] of values) rows.set(id, row); tables.set(key, rows);
      }
      revision++;
    }, async rollback() {} };
  } };
  return { db, budget: createSmsBudget(db, config, () => time), now: () => time, advance: ms => time += ms,
    outage: () => down = true, rows: name => [...(tables.get(name)?.values() || [])] };
}
function load(file, dependencies, cloud) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), { module, exports: module.exports,
    require: name => { if (name in dependencies) return dependencies[name]; throw Error('Unexpected dependency ' + name); },
    uniCloud: cloud, Date, Buffer, console }, { filename: file });
  return module.exports;
}
function sendingFixture({ failure = false, faults = {}, providerResult = { errCode: 0 } } = {}) {
  const f = fixture({}, faults); let sends = 0;
  const cloud = { database: () => f.db, sendSms: async () => { sends++; if (failure) throw Error('isolated provider timeout: acceptance unknown'); return providerResult; } };
  const utils = { getVerifyCode: () => 'isolated-otp-never-delivered' };
  const ERROR = new Proxy({}, { get: (_, key) => key });
  const verify = load(baseline + root + 'lib/utils/verify-code.js', {
    '../../common/constants': { verifyCollection: f.db.collection('uni-verify'), dbCmd: {} }, '../../common/error': { ERROR }, '../../common/utils': utils
  }, cloud);
  const budget = load('uniCloud-alipay/cloudfunctions/common/pety-auth/sms-budget.js', { crypto: require('node:crypto'), './transaction-document': require('../uniCloud-alipay/cloudfunctions/common/pety-auth/transaction-document') }, cloud);
  const sms = load(baseline + root + 'lib/utils/sms.js', { './verify-code': verify, '../../common/utils': utils, 'pety-auth/sms-budget': budget }, cloud);
  const handler = load(baseline + root + 'module/verify/send-sms-code.js', {
    '../../lib/utils/sms': sms, '../../lib/utils/captcha': { verifyCaptcha: async () => {} },
    '../../common/constants': { SMS_SCENE: { LOGIN: 'login-by-sms', RESET: 'reset-pwd-by-sms' } }, '../../common/error': { ERROR }
  }, cloud);
  const ctx = { middleware: { validate() {} }, config: { service: { sms: { name: 'isolated-app', codeExpiresIn: 300,
    scene: { 'login-by-sms': { templateId: 'isolated-template' }, 'reset-pwd-by-sms': { templateId: 'isolated-template' } } } } },
    t: value => value, getUniversalClientInfo: () => ({ clientIP: '192.0.2.10' }) };
  return { ...f, ctx, sends: () => sends, send: (scene = 'login-by-sms', extra = {}) => handler.call(ctx,
    { mobile: 'synthetic-phone-A', captcha: 'separately-verified-isolated-captcha', scene, ...extra }) };
}
const request = (mobile = 'synthetic-phone-A', clientIP = '192.0.2.10') => ({ mobile, clientIP });
const rateLimited = e => e.errCode === 'pety-sms-rate-limit';

test('SMS durable admission permits one same-phone concurrent request and does not store contact/IP plaintext', async () => {
  const f = fixture(); const results = await Promise.allSettled(Array.from({ length: 6 }, () => f.budget.reserve(request())));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  const stored = JSON.stringify(f.rows(COLLECTION)); assert.ok(!stored.includes('synthetic-phone-A')); assert.ok(!stored.includes('192.0.2.10'));
});
for (const [name, config, first, second, advance] of [
  ['phone hourly', { cooldownMs: 1, phoneHour: 1 }, request(), request(), 2],
  ['phone daily across hour rollover', { cooldownMs: 1, phoneDay: 1 }, request(), request(), 3600000],
  ['trusted IP hourly across phone changes', { cooldownMs: 1, ipHour: 1 }, request(), request('synthetic-phone-B'), 2],
  ['global daily across phone and IP changes', { cooldownMs: 1, globalDay: 1 }, request(), request('synthetic-phone-B', '192.0.2.11'), 2]
]) test('SMS blocks ' + name + ' budget before another reservation', async () => {
  const f = fixture(config); await f.budget.reserve(first); f.advance(advance);
  await assert.rejects(f.budget.reserve(second), rateLimited);
});
test('SMS cooldown survives a fresh service instance; missing trusted IP and DB outage fail closed', async () => {
  const f = fixture(); await f.budget.reserve(request());
  await assert.rejects(createSmsBudget(f.db, {}, f.now).reserve(request()), rateLimited);
  await assert.rejects(f.budget.reserve({ ...request(), clientIP: '' }), e => e.errCode === 'pety-sms-budget-unavailable');
  f.outage(); await assert.rejects(f.budget.reserve(request('synthetic-phone-B')), e => e.errCode === 'pety-sms-budget-unavailable');
});
test('normal SMS reservations resume after cooldown and daily budget rolls over on server time', async () => {
  const f = fixture({ phoneDay: 2, globalDay: 2 }); await f.budget.reserve(request());
  f.advance(60000); assert.equal((await f.budget.reserve(request())).reserved, true);
  f.advance(60000); await assert.rejects(f.budget.reserve(request()), rateLimited);
  f.advance(86400000); assert.equal((await f.budget.reserve(request())).reserved, true);
});
test('actual SMS handler/helper admits one concurrent send; CAPTCHA and forged device/IP cannot remove budget', async () => {
  const f = sendingFixture(); const results = await Promise.allSettled(Array.from({ length: 6 }, () => f.send('login-by-sms', { deviceId: Math.random().toString(), clientIP: '192.0.2.99' })));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(f.sends(), 1); assert.equal(f.rows('uni-verify').length, 1);
});
test('actual SMS helper shares cooldown across OTP purposes', async () => {
  const f = sendingFixture(); await f.send(); await assert.rejects(f.send('reset-pwd-by-sms'), rateLimited);
  assert.equal(f.sends(), 1); assert.equal(f.rows('uni-verify').length, 1);
});
test('actual SMS helper makes zero provider calls/challenges on persistent budget outage', async () => {
  const f = sendingFixture(); f.outage(); await assert.rejects(f.send());
  assert.equal(f.sends(), 0); assert.equal(f.rows('uni-verify').length, 0);
});
test('unknown SMS provider outcome retains reservation and rejects immediate resend', async () => {
  const f = sendingFixture({ failure: true }); await assert.rejects(f.send(), /acceptance unknown/);
  await assert.rejects(f.send(), rateLimited); assert.equal(f.sends(), 1); assert.equal(f.rows('uni-verify').length, 1);
  assert.ok(f.rows(COLLECTION).filter(r => r._id.startsWith('global_day_')).every(r => r.count === 1));
});

test('SMS malformed normal reads cannot initialize counters, challenges or sends', async () => {
  for (const result of [{ data: [], errCode: 'TEST_PRIVATE_DB_ERROR' }, { data: [null] }, { data: [{}, {}] }]) {
    const f = sendingFixture({ faults: { read: (normal, ctx) => ctx.name === COLLECTION && !ctx.transaction ? result : normal } });
    await assert.rejects(f.send(), e => e.errCode === 'pety-sms-budget-unavailable');
    assert.equal(f.rows(COLLECTION).length, 0); assert.equal(f.rows('uni-verify').length, 0); assert.equal(f.sends(), 0);
  }
});
test('SMS unconfirmed create receipt stops before the transaction and leaves only a zero counter', async () => {
  for (const result of [undefined, {}, { id: 'wrong' }]) {
    const f = sendingFixture({ faults: { add: (normal, ctx) => ctx.name === COLLECTION ? result : normal } });
    await assert.rejects(f.send(), e => e.errCode === 'pety-sms-budget-unavailable');
    assert.equal(f.rows(COLLECTION).length, 1); assert.equal(f.rows(COLLECTION)[0].count, 0); assert.equal(f.sends(), 0); assert.equal(f.rows('uni-verify').length, 0);
  }
});
test('SMS transaction error responses and corrupt counter state roll back without issuing a code', async () => {
  for (const corrupt of [r => ({ ...r, errCode: 'TEST_PRIVATE_DB_ERROR' }), r => ({ data: { ...r.data, _id: 'wrong' } }), r => ({ data: { ...r.data, count: -1 } }), r => ({ data: { ...r.data, version: -1 } }), r => ({ data: { ...r.data, nextAt: NaN } }), r => ({ data: { ...r.data, count: Number.MAX_SAFE_INTEGER } })]) {
    const f = sendingFixture({ faults: { read: (normal, ctx) => ctx.name === COLLECTION && ctx.transaction ? corrupt(normal) : normal } });
    await assert.rejects(f.send(), e => e.errCode === 'pety-sms-budget-unavailable');
    assert.ok(f.rows(COLLECTION).every(row => row.count === 0 && row.version === 0)); assert.equal(f.rows('uni-verify').length, 0); assert.equal(f.sends(), 0);
  }
});
test('SMS ambiguous update receipts roll back all counters rather than accepting a send', async () => {
  for (const result of [{ updated: '1' }, { updated: 0, affectedDocs: 1 }, { updated: 1, errCode: 'TEST_PRIVATE_DB_ERROR' }, {}, { updated: 0 }]) {
    const f = sendingFixture({ faults: { update: (normal, ctx) => ctx.name === COLLECTION && ctx.transaction ? result : normal } });
    await assert.rejects(f.send(), e => e.errCode === 'pety-sms-budget-unavailable');
    assert.ok(f.rows(COLLECTION).every(row => row.count === 0)); assert.equal(f.rows('uni-verify').length, 0); assert.equal(f.sends(), 0);
  }
});
test('SMS malformed provider acknowledgement is not reported as success and is never automatically resent', async () => {
  for (const result of [null, {}, { errCode: 5000, errMsg: 'TEST_PRIVATE_PROVIDER_ERROR' }, { errCode: '0' }, { errCode: 0, code: 5000 }]) {
    const f = sendingFixture({ providerResult: result });
    await assert.rejects(f.send(), e => e.errCode === 'pety-sms-response-unconfirmed' && !JSON.stringify(e).includes('TEST_PRIVATE'));
    assert.equal(f.sends(), 1); assert.equal(f.rows('uni-verify').length, 1); assert.ok(f.rows(COLLECTION).every(row => row.count === 1));
    await assert.rejects(f.send(), rateLimited); assert.equal(f.sends(), 1);
  }
});
test('SMS transaction fault recovery permits one explicit request after safe rollback', async () => {
  let broken = true; const f = sendingFixture({ faults: { update: (normal, ctx) => broken && ctx.transaction ? { updated: 1, errCode: 'TEST_PRIVATE_DB_ERROR' } : normal } });
  await assert.rejects(f.send(), e => e.errCode === 'pety-sms-budget-unavailable'); assert.equal(f.sends(), 0);
  broken = false; assert.equal((await f.send()).errCode, 0); assert.equal(f.sends(), 1); assert.ok(f.rows(COLLECTION).every(row => row.count === 1));
});
