const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
function setup(){const disk=new Map([['uni_id_token','session-A'],['uni_id_token_expired',Date.now()+60000]]),pending=[];const uni={getStorageSync:k=>disk.get(k),setStorageSync:(k,v)=>disk.set(k,v),removeStorageSync:k=>disk.delete(k)};
 const src=fs.readFileSync('common/auth-store.js','utf8').replace(/export /g,'');
 const store=Function('uni','uniCloud',src+';return {refreshUserProfile,getCurrentUser,clearUserCache'+(src.includes('function establishAuthenticatedProfile')?',establishAuthenticatedProfile':'')+'};')(uni,{callFunction:()=>new Promise((resolve,reject)=>pending.push({resolve,reject}))});return{disk,uni,store,pending};}
test('late profile from A cannot overwrite B or clear B token',async()=>{
 const s=setup(),a=s.store.refreshUserProfile();s.disk.set('uni_id_token','session-B');const b=s.store.refreshUserProfile();
 s.pending[1].resolve({result:{loggedIn:true,userId:'B'}});await b;
 s.pending[0].resolve({result:{loggedIn:true,userId:'A'}});await a;assert.equal(s.store.getCurrentUser().userId,'B');
});
test('service error result preserves session; explicit revocation clears it',async()=>{
 const s=setup();let p=s.store.refreshUserProfile();s.pending[0].resolve({result:{errCode:'pety-auth-service-unavailable'}});await p;assert.equal(s.disk.get('uni_id_token'),'session-A');
 p=s.store.refreshUserProfile();s.pending[1].resolve({result:{errCode:'uni-id-token-expired'}});await p;assert.equal(s.disk.has('uni_id_token'),false);
});
test('official non-active account states remove only the rejected local session',async()=>{
 for(const state of ['banned','auditing','audit-failed','closed','not-exists']){
  const s=setup();s.disk.set('pet_list',[{id:'retained-local-pet'}]);
  const p=s.store.refreshUserProfile();s.pending[0].resolve({result:{errCode:`uni-id-account-${state}`}});await p;
  assert.equal(s.disk.has('uni_id_token'),false);assert.deepEqual(s.disk.get('pet_list'),[{id:'retained-local-pet'}]);
 }
});
test('successful official login survives nonessential profile outage without granting membership',async()=>{
 const s=setup();let notified=0;
 const src=fs.readFileSync('common/auth-session.js','utf8').replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g,'').replace(/export /g,'');
 const deps={acceptSession(){},clearSession(){},...s.store,uni:s.uni,uniCloud:{importObject:()=>({})},mutations:{loginSuccess:()=>notified++,setUserInfo(){}},getAuthCapabilityReason:()=>'',isAuthCapabilityCallable:()=>true,isAuthCapabilityReady:()=>true};
 const session=Function(...Object.keys(deps),src+';return {completeUniIdLogin}')( ...Object.values(deps));
 const p=session.completeUniIdLogin({uid:'A',newToken:{token:'official-A',tokenExpired:Date.now()+60000}});s.pending[0].reject(Error('network unavailable'));const profile=await p;
 assert.equal(s.disk.get('uni_id_token'),'official-A');assert.equal(profile.userId,'A');assert.equal(profile.loggedIn,true);assert.equal(profile.plan,'free');assert.equal(notified,1);
});
