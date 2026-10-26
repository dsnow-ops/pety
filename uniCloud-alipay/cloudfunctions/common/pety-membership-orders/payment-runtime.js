'use strict';
const { createPaymentInbox } = require('./payment-inbox');
const { createMembershipSchedule } = require('./membership-schedule');
const { createUniPayAdapter } = require('./uni-pay-adapter');
const fail = code => { throw Object.assign(new Error(code), { code }); };

// Called only inside official uni-pay's verified notification hook or a trusted
// recovery worker. This factory is not an exported client-callable cloud method.
function createPaymentRuntime({ db, payService, config = {}, now = Date.now }) {
  if (config.enabled !== true) fail('PAYMENT_NOT_CONFIGURED');
  const grants = db.collection('pety_membership_grants');
  const schedule = createMembershipSchedule(db.collection('pety_membership_schedules'), {
    now, replaceObject: value => db.command.set(value),
    readGrant: async id => {
      const result = await grants.doc(id).get();
      if (!Array.isArray(result?.data)) fail('MEMBERSHIP_SERVICE_UNAVAILABLE');
      return result.data[0];
    },
    readLegacy: async uid => {
      const result = await db.collection('pety_memberships').where({ userId: uid }).limit(2).get();
      if (!Array.isArray(result?.data) || result.data.length > 1) fail('MEMBERSHIP_SERVICE_UNAVAILABLE');
      return result.data[0] || null;
    }
  });
  const inbox = createPaymentInbox(db.collection('pety_payment_inbox'), grants, { schedule, now });
  return createUniPayAdapter({
    businessOrders: db.collection('pety_membership_orders'),
    payOrders: db.collection('uni-pay-orders'), inbox, dbCmd: db.command,
    getVerifier: async channelId => {
      const channels = config.channels || {};
      const channel = Object.prototype.hasOwnProperty.call(channels, channelId) ? channels[channelId] : null;
      if (!channel || channel.approved !== true || !['wxpay', 'alipay'].includes(channel.provider) ||
          channel.payType !== 'app' || !/^[A-Za-z0-9_-]{1,64}$/.test(channel.configDirectory || '')) fail('PAYMENT_NOT_CONFIGURED');
      return payService.initUniPayInstance({ provider: channel.provider, provider_pay_type: channel.payType,
        config_directory: channel.configDirectory });
    }
  });
}
module.exports = { createPaymentRuntime };
