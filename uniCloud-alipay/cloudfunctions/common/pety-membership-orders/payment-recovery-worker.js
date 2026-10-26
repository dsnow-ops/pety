'use strict';
const { randomUUID } = require('crypto');
const fail = code => { throw Object.assign(new Error(code), { code }); };

// One bounded page per invocation. Progress lives in a private collection,
// never a process variable. Expired owners cannot advance a new owner's cursor.
function createPaymentRecoveryWorker({ checkpoints, adapter, dbCmd, now = Date.now, ownerId = randomUUID }) {
  const key = 'membership-payment-v1';
  async function run() {
    let response = await checkpoints.doc(key).get();
    if (!Array.isArray(response?.data)) fail('PAYMENT_RECOVERY_UNAVAILABLE');
    let state = response.data[0];
    if (!state) {
      try { await checkpoints.add({ _id: key, cursor: '', version: 0, leaseOwner: '', leaseUntil: 0, updatedAt: now() }); }
      catch (_) { /* A concurrent initializer is checked below. */ }
      response = await checkpoints.doc(key).get(); state = response?.data?.[0];
    }
    if (!state || !Number.isSafeInteger(state.version) || !Number.isSafeInteger(state.leaseUntil) ||
        typeof state.cursor !== 'string') fail('PAYMENT_RECOVERY_UNAVAILABLE');
    const stamp = now();
    if (state.leaseUntil > stamp) return { skipped: true, reason: 'RECOVERY_BUSY' };
    const owner = ownerId();
    const claimed = await checkpoints.where({ _id: key, version: state.version, leaseUntil: state.leaseUntil })
      .update({ leaseOwner: owner, leaseUntil: stamp + 90000, version: state.version + 1, updatedAt: stamp });
    if (claimed?.updated !== 1) return { skipped: true, reason: 'RECOVERY_BUSY' };
    try {
      const page = await adapter.reconcilePage({ limit: 10, afterId: state.cursor || null });
      const saved = await checkpoints.where({ _id: key, leaseOwner: owner, version: state.version + 1, leaseUntil: dbCmd.gt(now()) })
        .update({ cursor: page.nextCursor || '', leaseOwner: '', leaseUntil: 0, version: state.version + 2, updatedAt: now() });
      if (saved?.updated !== 1) fail('PAYMENT_RECOVERY_LEASE_LOST');
      return { skipped: false, processed: page.results.length, recovered: page.results.filter(r => r.recovered).length,
        needsReview: page.results.filter(r => !r.recovered).length, sweepComplete: page.nextCursor === null };
    } finally {
      // A crash skips this release; a later run takes over after lease expiry.
      // A normal error keeps the original cursor for idempotent replay.
      await checkpoints.where({ _id: key, leaseOwner: owner }).update({ leaseOwner: '', leaseUntil: 0 });
    }
  }
  return { run };
}
module.exports = { createPaymentRecoveryWorker };
