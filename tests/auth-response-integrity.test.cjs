'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){
 let user={_id:'TEST-A',status:0,token:['TEST-official-token'],valid_token_date:0,role:[],nickname:'TEST原昵称'},tokenResult={errCode:0,uid:'TEST-A',iat:1000},userReply,roleReply;
 let overrideUser=false,overrideRole=false,sessionChecks=0;
 const cloud={database:()=>({command:{in:v=>v},collection(name){const query={doc(){return this},field(){return this},where(){return this},limit(){return this},async get(){if(name==='uni-id-users')return overrideUser?userReply:{data:[user]};if(name==='uni-id-roles')return overrideRole?roleReply:{data:[{permission:['TEST-read']}]};return{data:[]}}};return query}})};
 const m={exports:{}};vm.runInNewContext(fs.readFileSync('uniCloud-alipay/cloudfunctions/common/pety-auth/index.js','utf8'),{module:m,uniCloud:cloud,require:name=>name==='uni-id-common'?{createInstance:()=>({checkToken:async()=>tokenResult})}:{assertCurrent:async()=>{sessionChecks++}}});
 return{auth:m.exports,cloud,user,verify:()=>m.exports.verifyRequest({uniIdToken:'TEST-official-token'},{}),token:value=>tokenResult=value,reply:value=>{overrideUser=true;userReply=value},rolesReply:value=>{overrideRole=true;roleReply=value},sessionChecks:()=>sessionChecks};
}
const unavailable=h=>error=>h.auth.authErrorResult(error).errCode==='pety-auth-service-unavailable';
test('malformed account reads are unavailable, never an absent account or successful authority',async()=>{
 for(const kind of ['error-empty','error-user','null-row','two-rows','missing-data','wrong-owner']){
  const h=fixture();h.reply(kind==='error-empty'?{data:[],errCode:'TEST_PRIVATE_DB_ERROR'}:kind==='error-user'?{data:[h.user],code:5000}:kind==='null-row'?{data:[null]}:kind==='two-rows'?{data:[h.user,h.user]}:kind==='wrong-owner'?{data:[{...h.user,_id:'TEST-B'}]}:{});
  await assert.rejects(h.verify(),unavailable(h));assert.equal(h.sessionChecks(),0);
 }
});
test('invalid official SDK envelopes are dependency failures; explicit invalid tokens remain rejected',async()=>{
 for(const reply of [null,{}, {errCode:0,iat:1000},{uid:'TEST-A',iat:NaN},{uid:'TEST-A',iat:'1000'},{uid:'TEST-A',iat:-1},{uid:'TEST-A',iat:1000,code:5000}]){
  const h=fixture();h.token(reply);await assert.rejects(h.verify(),unavailable(h));assert.equal(h.sessionChecks(),0);
 }
 const h=fixture();h.token({errCode:'uni-id-token-expired'});await assert.rejects(h.verify(),e=>e.errCode==='uni-id-token-expired');
});
test('malformed invalidation dates cannot bypass token revocation or force a false logout',async()=>{
 for(const value of [NaN,Infinity,-1,'1000001',{},false]){const h=fixture();h.user.valid_token_date=value;await assert.rejects(h.verify(),unavailable(h));}
 for(const value of [undefined,null,0,999999]){const h=fixture();h.user.valid_token_date=value;assert.equal((await h.verify()).uid,'TEST-A');}
 const revoked=fixture();revoked.user.valid_token_date=1000001;await assert.rejects(revoked.verify(),e=>e.errCode==='uni-id-token-expired');
});
test('corrupt live status, token arrays and roles cannot become valid authority',async()=>{
 for(const patch of [{status:'0'},{status:99},{token:{}},{token:['TEST-official-token',null]},{role:['admin',42]},{role:'admin'}]){
  const h=fixture();Object.assign(h.user,patch);await assert.rejects(h.verify(),unavailable(h));
 }
});
test('role lookup errors and malformed permission rows are unavailable rather than accepted or silently emptied',async()=>{
 for(const response of [{data:[{permission:['TEST-write']}],errCode:'TEST_PRIVATE_ROLE_ERROR'},{data:[null]},{data:[{permission:'TEST-write'}]},{data:[{permission:['TEST-write',42]}]}]){
  const h=fixture();h.user.role=['support'];h.rolesReply(response);await assert.rejects(h.verify(),unavailable(h));
 }
 const normal=fixture();normal.user.role=['support'];assert.deepEqual(Array.from((await normal.verify()).permissions),['TEST-read']);normal.rolesReply({data:[]});assert.deepEqual(Array.from((await normal.verify()).permissions),[]);
});
test('confirmed missing account, revoked ledger and official account states retain their explicit rejection',async()=>{
 const missing=fixture();missing.reply({data:[]});await assert.rejects(missing.verify(),e=>e.errCode==='uni-id-account-not-exists');
 const logout=fixture();logout.user.token=[];await assert.rejects(logout.verify(),e=>e.errCode==='uni-id-check-token-failed');
 for(const[status,name]of [[1,'banned'],[2,'auditing'],[3,'audit-failed'],[4,'closed']]){const h=fixture();h.user.status=status;await assert.rejects(h.verify(),e=>e.errCode==='uni-id-account-'+name);}
});
test('actual shared auth and profile entry preserve the client session on a corrupt lookup, then clear it for confirmed absence',async()=>{
 const h=fixture(),profile={exports:{}};
 vm.runInNewContext(fs.readFileSync('uniCloud-alipay/cloudfunctions/user_get_profile/index.js','utf8'),{exports:profile.exports,module:profile,uniCloud:h.cloud,process:{env:{}},console:{error(){}},require:name=>{if(name==='pety-auth')return h.auth;assert.equal(name,'pety-membership-orders/membership-state');return require('../uniCloud-alipay/cloudfunctions/common/'+name)}});
 const disk=new Map([['uni_id_token','TEST-official-token'],['uni_id_token_expired',Date.now()+60000],['pety_user_profile_cache',{loggedIn:true,userId:'TEST-A',nickname:'TEST原昵称',plan:'free'}],['pet_list',[{id:'TEST-kept'}]]]);
 const uni={getStorageSync:k=>disk.get(k),setStorageSync:(k,v)=>disk.set(k,v),removeStorageSync:k=>disk.delete(k)};
 const client=Function('uni','uniCloud',fs.readFileSync('common/auth-store.js','utf8').replace(/export /g,'')+';return{refreshUserProfile,getCurrentUser};')(uni,{callFunction:async()=>({result:await profile.exports.main({uniIdToken:'TEST-official-token'},{})})});
 h.reply({data:[null]});await client.refreshUserProfile();assert.equal(disk.get('uni_id_token'),'TEST-official-token');assert.equal(client.getCurrentUser().nickname,'TEST原昵称');
 h.reply({data:[]});await client.refreshUserProfile();assert.equal(disk.has('uni_id_token'),false);assert.deepEqual(disk.get('pet_list'),[{id:'TEST-kept'}]);
});
