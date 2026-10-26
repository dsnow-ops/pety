'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createRequire}=require('node:module');
test('development allowance requires verified identity, explicit scope and short server expiry',async()=>{
 const file=path.resolve('uniCloud-alipay/cloudfunctions/api_pet_avatar/index.js'),load=createRequire(file),module={exports:{}};
 vm.runInNewContext(fs.readFileSync(file,'utf8'),{module,exports:module.exports,__dirname:path.dirname(file),process:{env:{}},Buffer,console:{info(){},warn(){},error(){}},uniCloud:{database:()=>({collection:()=>({})})},require:n=>n==='pety-auth'?{verifyRequest:async e=>{if(e.uniIdToken!=='synthetic-token')throw{errCode:'unauthorized'};return{uid:'synthetic-A'};}}:load(n)});
 const api=module.exports.__test,context=await api.authorizeAvatarContext({uniIdToken:'synthetic-token'},{}),event={devEntitlementBypassRequested:true};
 const base={devMemberBypass:true,isDevelopment:true,devMemberBypassUids:['synthetic-A']};
 assert.equal(api.getDevMemberBypassDecision(event,base,context).applied,false,'missing expiry or scope must be closed');
 const valid={...base,devMemberBypassExpiresAt:Date.now()+60000,devMemberBypassScopes:['avatar-generation']};
 assert.equal(api.getDevMemberBypassDecision(event,valid,context).applied,true);
 for(const patch of [{devMemberBypassExpiresAt:Date.now()-1},{devMemberBypassExpiresAt:Date.now()+8*86400000},{devMemberBypassScopes:['payment']},{isDevelopment:false},{devMemberBypassUids:['synthetic-B']},{devMemberBypass:false}])assert.equal(api.getDevMemberBypassDecision(event,{...valid,...patch},context).applied,false);
 assert.equal(api.getDevMemberBypassDecision(event,valid,{UID:'synthetic-A'}).applied,false);
 assert.equal(api.getDevMemberBypassDecision({...event,dev:true,env:'development'},base,context).applied,false);
 assert.equal(api.getDevMemberBypassDecision({},valid,context).applied,false);
});
