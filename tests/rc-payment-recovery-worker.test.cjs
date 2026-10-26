const test = require('node:test'), assert = require('node:assert/strict');
const { createPaymentRecoveryWorker } = require('../uniCloud-alipay/cloudfunctions/common/pety-membership-orders/payment-recovery-worker');
function setup() {
  let row, stamp = 1000, serial = 0;
  const clone = v => structuredClone(v);
  const checkpoints = {
    doc: () => ({ get: async () => ({ data: row ? [clone(row)] : [] }) }),
    add: async value => { if (row) throw Error('duplicate'); row = clone(value); },
    where: query => ({ update: async patch => {
      if (!row || !Object.entries(query).every(([k,v]) => v && typeof v === 'object' ? row[k] > v.gt : row[k] === v)) return { updated: 0 };
      Object.assign(row, clone(patch)); return { updated: 1 };
    } })
  };
  return { get row() { return row; }, advance: ms => stamp += ms,
    worker: reconcilePage => createPaymentRecoveryWorker({ checkpoints, adapter: { reconcilePage }, now: () => stamp,
      ownerId: () => 'owner-' + ++serial, dbCmd: { gt: v => ({ gt: v }) } }) };
}
const page = (nextCursor = null) => ({ nextCursor, results: [{ recovered: true }, { recovered: false }] });

test('fresh worker resumes durable cursor and resets only at sweep end', async () => {
  const s = setup();
  await s.worker(async input => { assert.equal(input.afterId, null); return page('id10'); }).run();
  assert.equal(s.row.cursor, 'id10');
  const result = await s.worker(async input => { assert.equal(input.afterId, 'id10'); return page(); }).run();
  assert.deepEqual(result, { skipped: false, processed: 2, recovered: 1, needsReview: 1, sweepComplete: true });
  assert.equal(s.row.cursor, ''); assert.equal(s.row.leaseOwner, '');
});

test('concurrent trigger skips live lease; failures keep cursor and release lease', async () => {
  const s = setup(); let release;
  const running = s.worker(async () => new Promise(resolve => { release = resolve; })).run();
  while (!release) await new Promise(resolve => setImmediate(resolve));
  const other = await s.worker(async () => { throw Error('must not run'); }).run();
  assert.equal(other.reason, 'RECOVERY_BUSY');
  release(page('id10')); await running;
  await assert.rejects(s.worker(async () => { throw Error('database unavailable'); }).run(), /database unavailable/);
  assert.equal(s.row.cursor, 'id10'); assert.equal(s.row.leaseUntil, 0);
});

test('expired owner cannot overwrite progress saved by replacement worker', async () => {
  const s = setup(); let release;
  const old = s.worker(async () => new Promise(resolve => { release = resolve; })).run();
  while (!release) await new Promise(resolve => setImmediate(resolve));
  s.advance(90001);
  await s.worker(async () => page('new-cursor')).run();
  release(page('old-cursor'));
  await assert.rejects(old, { code: 'PAYMENT_RECOVERY_LEASE_LOST' });
  assert.equal(s.row.cursor, 'new-cursor');
});

test('timer adapter is independently disabled before accessing database or payment SDK', async () => {
  const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
  const source = fs.readFileSync(path.join(__dirname, '../uni_modules/uni-pay/uniCloud/cloudfunctions/uni-pay-co/pety-recovery.js'), 'utf8');
  for (const config of [{}, { enabled: true }, { recoveryEnabled: true }]) {
    const sandbox = { exports: {}, require: id => {
      assert.equal(id, 'uni-config-center'); return () => ({ hasFile: () => true, config: () => config });
    } };
    vm.runInNewContext(source, sandbox);
    assert.equal((await sandbox.exports.run()).reason, 'PAYMENT_NOT_CONFIGURED');
  }
});
