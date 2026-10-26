'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const authFile='uniCloud-alipay/cloudfunctions/common/pety-auth/index.js';

test('all shipped Huawei binding operations require verified authentication before body or provider access',async()=>{
 const permissions=require('../uni_modules/uni-id-pages/uniCloud/cloudfunctions/uni-id-co/config/permission');
 const gate={exports:{}};vm.runInNewContext(fs.readFileSync('uni_modules/uni-id-pages/uniCloud/cloudfunctions/uni-id-co/middleware/access-control.js','utf8'),{module:gate,require:n=>n==='../config/permission'?permissions:{ERROR:{PERMISSION_ERROR:'denied'}}});
 for(const method of ['bindHuawei','unbindHuawei','bindMobileByHuawei']){
  let checked=0;await assert.rejects(gate.exports.call({getMethodName:()=>method,middleware:{auth:async()=>{checked++;throw{errCode:'login-required'};}}}),e=>e.errCode==='login-required');assert.equal(checked,1);
 }
});
function harness(){
 let user={status:0,role:[],token:['synthetic-token']},permissions=[];
 const cloud={database:()=>({command:{in:v=>v},collection(name){
  if(name==='uni-id-users')return{doc:()=>({field(){return this;},get:async()=>({data:[user]})})};
  return{where:()=>({field(){return this;},get:async()=>({data:[{permission:permissions}]})})};
 }})};
 const m={exports:{}};vm.runInNewContext(fs.readFileSync(authFile,'utf8'),{module:m,uniCloud:cloud,require:n=>n==='uni-id-common'?{createInstance:()=>({checkToken:async()=>({uid:'synthetic-A',iat:Math.floor(Date.now()/1000),role:['admin'],permission:['WRITE_ALL']})})}:n==='./sessions'?{assertCurrent:async()=>{}}:require(n)});
 return{auth:m.exports,role:v=>{user.role=v;},permission:v=>{permissions=v;}};
}
test('revoked token roles do not authorize management, and newly granted live roles still work',async()=>{
 const h=harness(),middleware={exports:{}};vm.runInNewContext(fs.readFileSync('uni_modules/uni-id-pages/uniCloud/cloudfunctions/uni-id-co/middleware/auth.js','utf8'),{module:middleware,require:n=>n==='pety-auth'?h.auth:require(n)});
 const gate={exports:{}};vm.runInNewContext(fs.readFileSync('uni_modules/uni-id-pages/uniCloud/cloudfunctions/uni-id-co/middleware/access-control.js','utf8'),{module:gate,require:n=>n==='../config/permission'?{updateUser:{auth:true,role:['admin']}}:{ERROR:{PERMISSION_ERROR:'denied'}}});
 const context=()=>{const c={getUniversalUniIdToken:()=> 'synthetic-token',getUniversalClientInfo:()=>({appId:'app',platform:'app'}),getMethodName:()=> 'updateUser',uniIdCommon:{checkToken:async()=>({uid:'synthetic-A',role:['admin'],permission:['WRITE_ALL']})},response:{}};c.middleware={auth:()=>middleware.exports.call(c)};return c;};
 await assert.rejects(gate.exports.call(context()),e=>e.errCode==='denied');h.role(['admin']);await gate.exports.call(context());h.role([]);await assert.rejects(gate.exports.call(context()),e=>e.errCode==='denied');
});
test('revoked role permissions are read live rather than from token',async()=>{
 const h=harness();h.role(['support']);h.permission(['view-feedback']);let a=await h.auth.verifyRequest({uniIdToken:'synthetic-token'},{});assert.deepEqual(Array.from(a.permissions),['view-feedback']);h.permission([]);a=await h.auth.verifyRequest({uniIdToken:'synthetic-token'},{});assert.deepEqual(Array.from(a.permissions),[]);
});
test('official multi-app config accepts cloud-object clientInfo as well as function context',async()=>{
 let user={_id:'A',role:[],status:0,token:[]};const cloud={database:()=>({command:{},collection:()=>({doc:()=>({field(){return this;},get:async()=>({data:[user]}),update:async p=>Object.assign(user,p)})})}),initI18n:()=>({locale:'zh-Hans',t:x=>x,setLocale(){}})};
 const official={exports:{}},config=[{dcloudAppid:'isolated-app',tokenSecret:'isolated-key-never-deployed',tokenExpiresIn:3600,tokenExpiresThreshold:300}];
 vm.runInNewContext(fs.readFileSync('uni_modules/uni-id-common/uniCloud/cloudfunctions/common/uni-id-common/index.js','utf8'),{module:official,require:n=>n==='uni-config-center'?()=>({hasFile:n=>n==='config.json',config:()=>config}):require(n),uniCloud:cloud,Buffer,console});
 const signed=await official.exports.createInstance({clientInfo:{appId:'isolated-app',platform:'app'}}).createToken({uid:'A'});assert.equal(signed.errCode,0);
 const adapter={exports:{}};vm.runInNewContext(fs.readFileSync(authFile,'utf8'),{module:adapter,uniCloud:cloud,require:n=>n==='uni-id-common'?official.exports:{assertCurrent:async()=>{}}});
 for(const context of [{appId:'isolated-app',platform:'app'},{APPID:'isolated-app',PLATFORM:'app'}])assert.equal((await adapter.exports.verifyRequest({uniIdToken:signed.token},context)).uid,'A');
});
