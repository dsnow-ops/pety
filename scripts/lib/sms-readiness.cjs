'use strict';
// Inspect the installed uni-id-co contract without disclosing any config value.
// This is local readiness only: it cannot establish balance, deployment or delivery.
const SCENES = ['login-by-sms', 'reset-pwd-by-sms', 'bind-mobile-by-sms'];
function inspectSmsReadiness(config = {}) {
  const sms = config.service?.sms;
  const missing = [];
  if (!sms || typeof sms !== 'object') missing.push('service.sms');
  if (typeof sms?.name !== 'string' || !sms.name.trim()) missing.push('service.sms.name');
  const validExpiry = value => Number.isInteger(value) && value > 0;
  if (!validExpiry(sms?.codeExpiresIn)) missing.push('service.sms.codeExpiresIn');
  const scenes = Object.fromEntries(SCENES.map(scene => {
    const value = sms?.scene?.[scene] || {};
    const templateConfigured = typeof value.templateId === 'string' && /^[A-Za-z0-9_-]+$/.test(value.templateId);
    const testTemplate = value.templateId === 'uni_sms_test';
    const expiresIn = value.codeExpiresIn === undefined ? sms?.codeExpiresIn : value.codeExpiresIn;
    const expiryValid = validExpiry(expiresIn) && (!testTemplate || expiresIn <= 300);
    return [scene, { templateConfigured, testTemplate, expiryValid,
      status: missing.length || !templateConfigured || !expiryValid ? 'NOT_CONFIGURED' : testTemplate ? 'DEV_REAL_TEST_ONLY' : 'LOCAL_CONFIG_ONLY' }];
  }));
  return { localOnly: true, missing, scenes,
    externalChecks: ['service-enabled', 'sms-balance', 'space-authorization', 'deployed-uni-id-co', 'authorized-test-mobile', 'actual-delivery-and-login'] };
}
module.exports = { inspectSmsReadiness };
