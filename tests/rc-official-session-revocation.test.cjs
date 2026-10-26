const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const officialSource = fs.readFileSync('uni_modules/uni-id-common/uniCloud/cloudfunctions/common/uni-id-common/index.js', 'utf8');
const adapterSource = fs.readFileSync('uniCloud-alipay/cloudfunctions/common/pety-auth/index.js', 'utf8');

// Exercise installed official signing/verification. All config and records are
// isolated here; no real config, accounts, network or token output is involved.
async function harness() {
  let user = { _id: 'isolated-user', status: 0, role: [], token: [] };
  let outage = false, reads = 0;
  const cloud = {
    database: () => ({ command: {}, collection(name) {
      assert.ok(['uni-id-users', 'uni-id-roles'].includes(name));
      return { doc(uid) {
        assert.equal(uid, 'isolated-user');
        return { field(fields) {
          assert.deepEqual(Object.keys(fields).sort(), ['role', 'status', 'token', 'valid_token_date']);
          return this;
        }, async get() { reads++; if (outage) throw Error('isolated outage'); return { data: user ? [user] : [] }; },
        async update(value) { Object.assign(user, value); } };
      } };
    } }),
    initI18n: () => ({ locale: 'zh-Hans', t: code => code, setLocale() {} })
  };
  const config = { tokenSecret: 'isolated-local-test-secret-not-for-deployment', tokenExpiresIn: 3600, tokenExpiresThreshold: 300 };
  const officialModule = { exports: {} };
  const dependency = name => {
    if (name === 'crypto') return require('node:crypto');
    if (name === 'uni-config-center') return () => ({ hasFile: name => name === 'config.json', config: () => config });
    throw Error('unexpected dependency');
  };
  vm.runInNewContext(officialSource, { module: officialModule, require: dependency, uniCloud: cloud, Buffer, console });
  const context = { APPID: 'isolated-app', PLATFORM: 'app', LOCALE: 'zh-Hans' };
  const official = officialModule.exports;
  const signed = await official.createInstance({ context }).createToken({ uid: user._id });
  assert.equal(signed.errCode, 0);
  const adapterModule = { exports: {} };
  vm.runInNewContext(adapterSource, { module: adapterModule, require: name => {
    if(name==='./sessions')return require('../uniCloud-alipay/cloudfunctions/common/pety-auth/sessions');assert.equal(name, 'uni-id-common'); return official;
  }, uniCloud: cloud });
  reads = 0;
  return {
    auth: adapterModule.exports,
    verify: () => adapterModule.exports.verifyRequest({ uniIdToken: signed.token }, context),
    raw: () => official.createInstance({ context }).checkToken(signed.token, { autoRefresh: false }),
    change: value => { user = value === null ? null : { ...user, ...value }; },
    outage: () => { outage = true; }, reads: () => reads
  };
}

test('official token with embedded permissions still checks live session membership', async () => {
  const h = await harness();
  assert.equal((await h.raw()).uid, 'isolated-user');
  assert.equal(h.reads(), 0, 'installed official fast path skips user lookup');
  assert.equal((await h.verify()).uid, 'isolated-user');
  assert.equal(h.reads(), 1);
  h.change({ token: [] });
  await assert.rejects(h.verify(), e => e.errCode === 'uni-id-check-token-failed');
});

test('banned, auditing, closed, deleted and password-reset accounts are rejected', async () => {
  for (const [status, suffix] of [[1, 'banned'], [2, 'auditing'], [3, 'audit-failed'], [4, 'closed']]) {
    const h = await harness(); h.change({ status });
    await assert.rejects(h.verify(), e => e.errCode === `uni-id-account-${suffix}`);
    assert.equal(h.auth.authErrorResult({ errCode: `uni-id-account-${suffix}` }).errCode, `uni-id-account-${suffix}`);
  }
  const deleted = await harness(); deleted.change(null);
  await assert.rejects(deleted.verify(), e => e.errCode === 'uni-id-account-not-exists');
  const reset = await harness(); reset.change({ valid_token_date: Date.now() + 1000 });
  await assert.rejects(reset.verify(), e => e.errCode === 'uni-id-token-expired');
});

test('account lookup outage fails closed without classifying session as revoked', async () => {
  const h = await harness(); h.outage();
  await assert.rejects(h.verify(), e => h.auth.authErrorResult(e).errCode === 'pety-auth-service-unavailable');
});
