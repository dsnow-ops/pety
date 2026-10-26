'use strict';

module.exports = async function (notification) {
  try {
    const center = require('uni-config-center')({ pluginId: 'pety-pay' });
    const config = center.hasFile('config.json') ? center.config() : {};
    if (config.enabled !== true) return false;
    const { createPaymentRuntime } = require('pety-membership-orders/payment-runtime');
    const runtime = createPaymentRuntime({ db: uniCloud.database(), payService: require('../service/pay'), config });
    // Ignore supplied verified fields; the adapter reloads and re-verifies the
    // official durable receipt, then awaits the idempotent membership schedule.
    await runtime.settle(notification?.data?.out_trade_no);
    return true;
  } catch (_) {
    console.error('pety_payment_settlement_pending');
    return false;
  }
};
