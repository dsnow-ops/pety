const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('uniCloud-alipay/cloudfunctions/common/pety-auth/index.js','utf8');
function api(checkToken){const module={exports:{}};const query={field:()=>query,get:async()=>({data:[{status:0,token:['opaque-test-token']}]})};vm.runInNewContext(source,{module,uniCloud:{database:()=>({collection:()=>({doc:uid=>{assert.equal(uid,'verified-A');return query;}})})},require:name=>{if(name==='./sessions')return require('../uniCloud-alipay/cloudfunctions/common/pety-auth/sessions');assert.equal(name,'uni-id-common');return{createInstance:({context})=>{assert.equal(context.APPID,'test-app');return{checkToken}}}}});return module.exports;}
test('only official token verification establishes uid; guest cannot claim account or dev rights',async()=>{
 let calls=0;const auth=api(async token=>{calls++;assert.equal(token,'opaque-test-token');return{errCode:0,uid:'verified-A',iat:Math.floor(Date.now()/1000)}});
 assert.equal((await auth.verifyRequest({uid:'forged',isPlus:true,dev:true},{uid:'forged'})).uid,null);assert.equal(calls,0);
 assert.equal((await auth.verifyRequest({uniIdToken:'opaque-test-token',uid:'forged'},{APPID:'test-app',uid:'forged'})).uid,'verified-A');
});
test('invalid tokens fail closed and dependency failures are not classified as revocation',async()=>{
 const auth=api(async()=>({errCode:'uni-id-token-expired'}));
 await assert.rejects(auth.verifyRequest({uniIdToken:'expired'},{APPID:'test-app'}));
 assert.equal(auth.authErrorResult({errCode:'uni-id-token-expired'}).errCode,'uni-id-token-expired');
 assert.equal(auth.authErrorResult({message:'temporary dependency outage'}).errCode,'pety-auth-service-unavailable');
});
