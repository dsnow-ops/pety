const test=require('node:test'),assert=require('node:assert/strict');
const {inspectSmsReadiness}=require('../scripts/lib/sms-readiness.cjs');
test('SMS object presence is not readiness; installed helper requires name and global expiry',()=>{
 const result=inspectSmsReadiness({service:{sms:{scene:{'login-by-sms':{templateId:'uni_sms_test',codeExpiresIn:300}}}}});
 assert.equal(result.scenes['login-by-sms'].status,'NOT_CONFIGURED');
 assert.deepEqual(result.missing,['service.sms.name','service.sms.codeExpiresIn']);
});
test('test template never claims production or real delivery; unavailable scenes stay unavailable',()=>{
 const config={tokenSecret:'do-not-print',service:{sms:{name:'do-not-print',smsKey:'do-not-print',smsSecret:'do-not-print',codeExpiresIn:300,scene:{'login-by-sms':{templateId:'uni_sms_test'}}}}};
 const value=inspectSmsReadiness(config);
 assert.equal(value.scenes['login-by-sms'].status,'DEV_REAL_TEST_ONLY');
 assert.equal(value.scenes['reset-pwd-by-sms'].status,'NOT_CONFIGURED');
 assert.equal(value.localOnly,true);assert.ok(value.externalChecks.includes('actual-delivery-and-login'));
 assert.ok(!JSON.stringify(value).includes('do-not-print'));
 config.service.sms.scene['login-by-sms'].codeExpiresIn=900;
 assert.equal(inspectSmsReadiness(config).scenes['login-by-sms'].expiryValid,false);
});
