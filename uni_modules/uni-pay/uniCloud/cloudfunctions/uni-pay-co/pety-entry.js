'use strict';
const { createMembershipOrders } = require('pety-membership-orders');
const { createPaymentEntry } = require('pety-membership-orders/payment-entry');
const { readPaymentStatus } = require('pety-membership-orders/payment-status');

function runtime() {
  const center = require('uni-config-center')({ pluginId: 'pety-pay' });
  const config = center.hasFile('config.json') ? center.config() : {};
  const db = uniCloud.database();
  const orders = createMembershipOrders(db.collection('pety_membership_orders'), {
    enabled: config.enabled === true, catalog: config.catalog || {}, channels: config.channels || {}
  });
  return createPaymentEntry({ orders, channels: config.channels || {}, enabled: config.enabled === true,
    readStatus: order => readPaymentStatus(db, order),
    payService: { createOrder: input => require('./service/pay').createOrder(input) } });
}

exports.createOrder = function (input) {
  return runtime().create(this.getUserId(), input, this.getClientInfo(), this.getCloudInfo());
};
exports.getOrder = function (input) { return runtime().read(this.getUserId(), input); };
