'use strict';
const reject = () => { throw Object.assign(new Error('PAYMENT_EVIDENCE_MISMATCH'), { code: 'PAYMENT_EVIDENCE_MISMATCH' }); };

// Private server adapter only. `verified` must be the official SDK's successful
// signature verification result, never event/body data from a public function.
// Channel-specific adapters must preserve verified merchant/currency facts;
// missing facts are rejected rather than inferred from the client's parameters.
function validatePaidEvidence(order, paymentRecord, verified, facts) {
  const attempt = order?.paymentAttempt;
  if (!attempt || !paymentRecord || !verified || !facts) reject();
  if (order.currency !== 'CNY' || facts.currency !== order.currency ||
      facts.merchantId !== attempt.merchantId || facts.provider !== attempt.provider ||
      facts.payType !== attempt.payType) reject();
  if (paymentRecord.order_no !== order._id || paymentRecord.user_id !== order.userId ||
      paymentRecord.out_trade_no !== attempt.outTradeNo || paymentRecord.type !== 'pety_membership' ||
      paymentRecord.provider !== attempt.provider || paymentRecord.provider_pay_type !== attempt.payType ||
      paymentRecord.provider_appid !== attempt.appId || paymentRecord.status !== 1 ||
      paymentRecord.total_fee !== order.amountFen || Number(paymentRecord.refund_fee || 0) !== 0) reject();
  if (verified.outTradeNo !== attempt.outTradeNo || verified.appId !== attempt.appId ||
      verified.totalFee !== order.amountFen || typeof verified.transactionId !== 'string' || !verified.transactionId ||
      paymentRecord.transaction_id !== verified.transactionId ||
      ![verified.resultCode, verified.tradeState].includes('SUCCESS')) reject();
  // A transport acknowledgement (returnCode) alone does not mean paid.
  if (!Number.isSafeInteger(paymentRecord.pay_date) || paymentRecord.pay_date <= 0) reject();
  return Object.freeze({ orderId: order._id, userId: order.userId, outTradeNo: attempt.outTradeNo,
    transactionId: verified.transactionId, provider: attempt.provider, amountFen: order.amountFen,
    currency: order.currency, paidAt: paymentRecord.pay_date });
}
module.exports = { validatePaidEvidence };
