'use strict';
const fail = code => { throw Object.assign(new Error(code), { code }); };

function createPaymentEntry({ orders, payService, readStatus, channels = {}, enabled = false }) {
  async function create(uid, input, clientInfo, cloudInfo) {
    if (!enabled) fail('PAYMENT_NOT_CONFIGURED');
    if (!uid) fail('ORDER_LOGIN_REQUIRED');
    if (!input || Object.keys(input).some(k => !['skuId', 'requestId', 'channelId'].includes(k))) fail('ORDER_INPUT_INVALID');
    // Platform facts must come from the cloud object's client context, not input.
    if (clientInfo?.platform !== 'app' || clientInfo?.osName !== 'android') fail('PAYMENT_PLATFORM_UNSUPPORTED');
    const channel = Object.prototype.hasOwnProperty.call(channels, input.channelId) ? channels[input.channelId] : null;
    if (!channel || channel.approved !== true || !/^[A-Za-z0-9_-]{1,64}$/.test(channel.configDirectory || '')) fail('PAYMENT_NOT_CONFIGURED');
    const order = await orders.create(uid, { skuId: input.skuId, requestId: input.requestId });
    const prepared = await orders.preparePayment(uid, order._id, input.channelId);
    const attempt = prepared.paymentAttempt;
    return payService.createOrder({
      provider: attempt.provider, total_fee: prepared.amountFen, user_id: uid,
      order_no: prepared._id, out_trade_no: attempt.outTradeNo,
      type: 'pety_membership', description: '归爪会员', config_directory: channel.configDirectory,
      clientInfo, cloudInfo
    });
  }
  async function read(uid, input) {
    if (!uid) fail('ORDER_LOGIN_REQUIRED');
    if (!input || Object.keys(input).some(k => k !== 'orderId')) fail('ORDER_INPUT_INVALID');
    const order = await orders.read(uid, input.orderId);
    if (typeof readStatus !== 'function') fail('PAYMENT_STATUS_UNAVAILABLE');
    const status = await readStatus(order);
    return { orderId: order._id, skuId: order.skuId, amountFen: order.amountFen, currency: order.currency,
      paymentStatus: status.paymentStatus, entitlementStatus: status.entitlementStatus,
      ...(status.startsAt !== undefined ? { startsAt: status.startsAt, endsAt: status.endsAt } : {}) };
  }
  return { create, read };
}
module.exports = { createPaymentEntry };
