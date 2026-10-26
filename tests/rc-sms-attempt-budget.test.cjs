const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup() {
  const rows = [];
  const cmd = { gt: n => ({ gt: n }), exists: n => ({ exists: n }) };
  const match = (row, query) => Object.entries(query).every(([key, value]) => {
    if (value && typeof value === 'object') {
      if ('gt' in value) return row[key] > value.gt;
      if ('exists' in value) return (row[key] !== undefined) === value.exists;
    }
    return row[key] === value;
  });
  const collection = {
    async add(row) { rows.push({ ...row, _id: String(rows.length) }); },
    where(query) {
      let limit = Infinity;
      return {
        orderBy() { return this; },
        limit(n) { limit = n; return this; },
        async get() { return { data: rows.filter(r => match(r, query)).sort((a, b) => b.created_date - a.created_date).slice(0, limit).map(r => ({ ...r })) }; },
        async update(patch) { const selected = rows.filter(r => match(r, query)); selected.forEach(r => Object.assign(r, patch)); return { updated: selected.length }; }
      };
    }
  };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync('uni_modules/uni-id-pages/uniCloud/cloudfunctions/uni-id-co/lib/utils/verify-code.js', 'utf8'), {
    module, Date, require(name) {
      if (name.endsWith('/constants')) return { dbCmd: cmd, verifyCollection: collection };
      if (name.endsWith('/error')) return { ERROR: new Proxy({}, { get: (_, k) => k }) };
      if (name.endsWith('/utils')) return { getVerifyCode: () => 'synthetic-secret' };
      throw Error(name);
    }
  });
  const input = { mobile: 'synthetic-mobile', scene: 'login', code: 'synthetic-secret' };
  rows.push({ ...input, _id: 'original', state: 0, created_date: 1, expired_date: Date.now() + 60000 });
  return { rows, input, verify: p => module.exports.verifyMobileCode(p) };
}

test('five wrong attempts exhaust a SMS challenge even from different client contexts', async () => {
  const s = setup();
  for (let n = 0; n < 5; n++) await assert.rejects(s.verify({ ...s.input, code: 'wrong-' + n }));
  await assert.rejects(s.verify(s.input), 'a correct code must not bypass the exhausted challenge');
  assert.equal(s.rows[0].attempts, 5);
});

test('parallel guesses cannot overspend the challenge budget; later correct input remains rejected', async () => {
  const s = setup();
  for (let round = 0; round < 5; round++) await Promise.allSettled(Array.from({ length: 12 }, () => s.verify({ ...s.input, code: 'wrong' })));
  assert.equal(s.rows[0].attempts, 5);
  await assert.rejects(s.verify(s.input));
});

test('a fresh challenge has its own budget and supersedes an older unconsumed code', async () => {
  const s = setup();
  s.rows.push({ ...s.rows[0], _id: 'new', created_date: 2, code: 'new-secret', attempts: 0 });
  await assert.rejects(s.verify(s.input));
  assert.equal((await s.verify({ ...s.input, code: 'new-secret' })).errCode, 0);
  await assert.rejects(s.verify({ ...s.input, code: 'new-secret' }));
  await assert.rejects(s.verify(s.input), 'consuming the new challenge must not revive the older code');
});

test('correct fifth attempt succeeds, concurrent correct replays consume once, and expiry remains enforced', async () => {
  const s = setup();
  for (let n = 0; n < 4; n++) await assert.rejects(s.verify({ ...s.input, code: 'wrong' }));
  const results = await Promise.allSettled([s.verify(s.input), s.verify(s.input)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(s.rows[0].attempts, 5);
  const expired = setup(); expired.rows[0].expired_date = Date.now() - 1;
  await assert.rejects(expired.verify(expired.input));
  assert.equal(expired.rows[0].attempts, undefined);
});
