'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve('uniCloud-alipay/cloudfunctions'),cycle='a'.repeat(24),uid='TEST-A';
function endpoint(name,options={}){
 const module={exports:{}},membership={userId:uid,plan:'plus',status:'active',endedAt:Date.now()+60000},profile={_id:uid,nickname:'TEST原名字'};
 const cloud={database:()=>({collection:collection=>({where:()=>({limit:()=>({get:async()=>options.membershipReply||{data:[options.membership||membership]}})}),doc:()=>({get:async()=>collection==='uni-id-users'?options.profileReply||{data:[profile]}:options.scheduleReply||{data:[]}})})})};
 vm.runInNewContext(fs.readFileSync(root+'/'+name+'/index.js','utf8'),{module,exports:module.exports,process:{env:{PETY_PAID_MEMBERSHIP_ENABLED:options.paid?'true':'false'}},console:{error(){}},uniCloud:cloud,require:name=>name==='pety-auth'?{verifyRequest:async()=>({uid}),authErrorResult:e=>e}:require(root+'/common/'+name)});
 return module.exports.main({},{});
}
test('membership error-bearing, duplicate and wrong-owner reads cannot return free or paid authority',async()=>{
 for(const name of ['membership_get','user_get_profile'])for(const membershipReply of [{data:[],errCode:'TEST_PRIVATE'},{data:[{userId:uid,plan:'plus',status:'active'}],code:5000},{data:[{userId:uid},{userId:uid}]},{data:[{userId:'OTHER',plan:'pro',status:'active'}]}]){const r=await endpoint(name,{membershipReply});assert.equal(r.errCode,'pety-membership-unavailable');assert.equal(r.plan,undefined);assert.doesNotMatch(JSON.stringify(r),/TEST_PRIVATE/);}
});
test('malformed plan, status, invalidation dates and entitlement overrides remain unavailable',async()=>{
 for(const name of ['membership_get','user_get_profile'])for(const patch of [{plan:'unknown'},{status:'unknown'},{endedAt:NaN},{expiresAt:Infinity},{endedAt:'9999999999999'},{expiresAt:-1},{entitlements:[]},{entitlements:{dailyAiLimit:'30'}},{entitlements:{monthlyAiLimit:NaN}},{entitlements:{cloudSyncEnabled:'true'}}]){const r=await endpoint(name,{membership:{userId:uid,plan:'plus',status:'active',...patch}});assert.equal(r.errCode,'pety-membership-unavailable',name+':'+JSON.stringify(patch));assert.equal(r.entitlements,undefined);}
});
test('valid membership overrides, explicit expiration and absence retain existing product rules',async()=>{
 for(const name of ['membership_get','user_get_profile']){
  const active=await endpoint(name,{membership:{userId:uid,plan:'pro',status:'active',endedAt:0,expiresAt:null,entitlements:{maxPets:7,dailyAiLimit:19,cloudSyncEnabled:false}}});assert.equal(active.plan,'pro');assert.equal(active.entitlements.maxPets,7);assert.equal(active.entitlements.dailyAiLimit,19);assert.equal(active.entitlements.cloudSyncEnabled,false);assert.equal(active.entitlements.monthlyAiLimit,1000);
  for(const options of [{membershipReply:{data:[]}},{membership:{userId:uid,plan:'plus',status:'active',endedAt:1}},{membership:{userId:uid,plan:'plus',status:'refunded'}}]){const r=await endpoint(name,options);assert.equal(r.plan,'free');assert.equal(r.entitlements.dailyAiLimit,3);assert.equal(r.errCode,undefined);}
 }
});
test('profile read errors and corrupt user rows cannot overwrite a valid display snapshot',async()=>{
 for(const profileReply of [{data:[{nickname:'TEST corrupt'}],errCode:'TEST_PRIVATE'},{data:[{},{}]},{data:[[]]},{data:[{_id:'OTHER',nickname:'TEST wrong'}]},{data:[{nickname:42}]},{data:[{avatar:{}}]},{data:[{avatar_file:{url:42}}]}]){const r=await endpoint('user_get_profile',{profileReply});assert.equal(r.errCode,'pety-profile-unavailable');assert.equal(r.nickname,undefined);}
});
const schedule=()=>({userId:uid,periods:{[cycle]:{cycleKey:cycle,orderId:'TEST-order',plan:'plus',limit:10,startsAt:1000,endsAt:6000,state:'scheduled'}}});
function db(response){return{collection:()=>({doc:()=>({get:async()=>response})})};}
test('paid schedule malformed reads never silently fall back to a legacy plan',async()=>{
 const {readEffectiveMembership}=require(root+'/common/pety-membership-orders/effective-membership');
 for(const reply of [{data:[],errCode:'TEST_PRIVATE'},{data:[null]},{data:[schedule(),schedule()]},{data:[{...schedule(),_id:'OTHER'}]}])await assert.rejects(readEffectiveMembership(db(reply),uid,null,5000),{code:'MEMBERSHIP_STATE_INVALID'});
});
test('paid periods require finite forward times and a usable order identity',async()=>{
 const {readEffectiveMembership}=require(root+'/common/pety-membership-orders/effective-membership');
 for(const patch of [{startsAt:-100},{orderId:{}},{orderId:42}]){const row=schedule();Object.assign(row.periods[cycle],patch);await assert.rejects(readEffectiveMembership(db({data:[row]}),uid,null,5000),{code:'MEMBERSHIP_STATE_INVALID'});}
});
test('transactional paid schedule shape and error flags are verified without changing valid cycles',async()=>{
 const {readEffectiveMembership}=require(root+'/common/pety-membership-orders/effective-membership');
 const good=await readEffectiveMembership(db({data:schedule()}),uid,null,5000,{transactional:true});assert.equal(good.entitlementCycleKey,cycle);
 for(const reply of [{data:null,errCode:'TEST_PRIVATE'},{data:schedule(),code:5000},{data:[]}])await assert.rejects(readEffectiveMembership(db(reply),uid,null,5000,{transactional:true}),{code:'MEMBERSHIP_STATE_INVALID'});
 assert.equal(await readEffectiveMembership(db({data:null}),uid,null,5000,{transactional:true}),null);
});
test('actual profile endpoint plus client preserves cached plan on malformed membership and refreshes after recovery',async()=>{
 let corrupt=true;const profile={loggedIn:true,userId:uid,plan:'plus',status:'active',nickname:'TEST保留昵称'},disk=new Map([['uni_id_token','TEST-token'],['uni_id_token_expired',Date.now()+60000],['pety_user_profile_cache',profile]]),uni={getStorageSync:k=>disk.get(k),setStorageSync:(k,v)=>disk.set(k,v),removeStorageSync:k=>disk.delete(k)};
 const client=Function('uni','uniCloud',fs.readFileSync('common/auth-store.js','utf8').replace(/export /g,'')+';return{refreshUserProfile};')(uni,{callFunction:async()=>({result:await endpoint('user_get_profile',corrupt?{membershipReply:{data:[],errCode:'TEST_PRIVATE'}}:{})})});
 const first=await client.refreshUserProfile();assert.equal(first.plan,'plus');assert.equal(first.nickname,'TEST保留昵称');assert.equal(disk.get('uni_id_token'),'TEST-token');corrupt=false;const next=await client.refreshUserProfile();assert.equal(next.plan,'plus');assert.equal(next.nickname,'TEST原名字');assert.equal(next.message,'ok');
});
