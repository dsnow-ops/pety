'use strict';
const fail = code => { throw Object.assign(new Error(code), { code }); };

function uniqueFact(values) {
  const present = values.filter(v => v !== undefined && v !== null && v !== '');
  if (!present.length || present.some(v => typeof v !== 'string' || v !== present[0])) {
    fail('PAYMENT_VERIFIED_FACT_MISSING');
  }
  return present[0];
}

// Private adapter, never a public cloud function. The only verification input
// comes from the official SDK, called here on stored original notification data.
// Merchant/currency are signed facts, never supplied by the caller or copied
// from the business order to manufacture a match.
function createUniPayAdapter({ businessOrders, payOrders, inbox, getVerifier, dbCmd }) {
  async function record(outTradeNo) {
    if (typeof outTradeNo !== 'string' || !/^pp[0-9a-f]{26}$/.test(outTradeNo)) fail('PAYMENT_RECORD_INVALID');
    const response = await payOrders.where({ out_trade_no: outTradeNo }).limit(2).get();
    if (!Array.isArray(response?.data) || response.data.length !== 1) fail('PAYMENT_RECORD_INVALID');
    const payment = response.data[0];
    if (payment.type !== 'pety_membership' || payment.status !== 1 || !payment.original_data) fail('PAYMENT_NOT_CONFIRMED');
    const business = await businessOrders.doc(payment.order_no).get();
    const order = business?.data?.[0];
    const attempt = order?.paymentAttempt;
    if (!attempt || !['wxpay', 'alipay'].includes(attempt.provider) || attempt.payType !== 'app') fail('PAYMENT_CHANNEL_UNSUPPORTED');
    // Factory resolves server-owned credentials by the persisted channel ID.
    const sdk = await getVerifier(attempt.channelId);
    if (!sdk || typeof sdk.verifyPaymentNotify !== 'function') fail('PAYMENT_VERIFIER_UNAVAILABLE');
    const verified = await sdk.verifyPaymentNotify(payment.original_data);
    if (!verified || typeof verified !== 'object') fail('PAYMENT_SIGNATURE_INVALID');
    const merchantId = attempt.provider === 'alipay'
      ? uniqueFact([verified.sellerId])
      : uniqueFact([verified.mchId, verified.mchid]);
    const currency = uniqueFact([verified.feeType, verified.amount?.currency]);
    await inbox.accept(order, payment, verified, { merchantId, currency, provider: attempt.provider, payType: attempt.payType });
    return { orderId: order._id, receiptRecorded: true };
  }

  async function settle(outTradeNo) {
    const accepted = await record(outTradeNo);
    const activated = await inbox.activate(accepted.orderId);
    return { ...accepted, ...activated };
  }

  async function reconcilePage({ limit = 10, afterId = null } = {}) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 20) fail('PAYMENT_BATCH_INVALID');
    if (afterId !== null && (typeof afterId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(afterId))) fail('PAYMENT_CURSOR_INVALID');
    // uni-pay marks status=1 before calling its business hook. A crash can leave
    // user_order_success unset; include both false and absent via neq(true).
    // Keyset pagination remains stable when successful rows leave the pending
    // set. Advance over failures as well, so bad rows cannot starve later ones.
    const response = await payOrders.where({ type: 'pety_membership', status: 1,
      user_order_success: dbCmd.neq(true), ...(afterId === null ? {} : { _id: dbCmd.gt(afterId) }) })
      .orderBy('_id', 'asc').limit(limit).get();
    if (!Array.isArray(response?.data)) fail('PAYMENT_RECOVERY_UNAVAILABLE');
    const results = [];
    for (const row of response.data) {
      try {
        // Await every durable step. No work continues after this function returns.
        const accepted = await settle(row.out_trade_no);
        const changed = await payOrders.where({ _id: row._id, status: 1, transaction_id: row.transaction_id })
          .update({ user_order_success: true });
        if (changed?.updated !== 1) fail('PAYMENT_RECORD_CHANGED');
        results.push({ orderId: accepted.orderId, recovered: true });
      } catch (_) {
        // No raw notification, signature, buyer ID or merchant secret in logs.
        results.push({ recovered: false, reason: 'PAYMENT_REQUIRES_REVIEW' });
      }
    }
    const nextCursor = response.data.length === limit ? response.data[response.data.length - 1]._id : null;
    return { results, nextCursor };
  }
  async function reconcile(options) { return (await reconcilePage(options)).results; }
  return { record, settle, reconcile, reconcilePage };
}
module.exports = { createUniPayAdapter };
