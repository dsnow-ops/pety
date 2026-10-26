'use strict';
exports.run = async function () {
  const center = require('uni-config-center')({ pluginId: 'pety-pay' });
  const config = center.hasFile('config.json') ? center.config() : {};
  // _timing bypasses _before in uniCloud, so it requires its own default-off gate.
  if (config.enabled !== true || config.recoveryEnabled !== true) return { skipped: true, reason: 'PAYMENT_NOT_CONFIGURED' };
  const db = uniCloud.database();
  const { createPaymentRuntime } = require('pety-membership-orders/payment-runtime');
  const { createPaymentRecoveryWorker } = require('pety-membership-orders/payment-recovery-worker');
  const adapter = createPaymentRuntime({ db, payService: require('./service/pay'), config });
  return createPaymentRecoveryWorker({ checkpoints: db.collection('pety_payment_recovery'), adapter, dbCmd: db.command }).run();
};
