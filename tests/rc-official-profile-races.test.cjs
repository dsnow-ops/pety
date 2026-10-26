const fs=require('node:fs'),test=require('node:test'),assert=require('node:assert/strict');
const deferred=()=>{let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j});return{promise,resolve,reject}};
function setup(){
 const disk=new Map([['uni_id_token','A']]),queries=[],logs=[],logout=deferred();let realNameFails=false;
 const uni={getStorageSync:k=>disk.get(k),setStorageSync:(k,v)=>disk.set(k,v),removeStorageSync:k=>disk.delete(k),$emit(){},redirectTo(){},showToast(){}};
 const api={getPetyProfile:()=>{const d=deferred();queries.push(d);return d.promise.then(r=>({profile:r.result.data[0]}))},getRealNameInfo:async()=>{if(realNameFails)throw Error('transport');return{}},logout:()=>logout.promise};
 const table={where:()=>table,field:()=>table,get:()=>{const d=deferred();queries.push(d);return d.promise}};
 const uniCloud={importObject:()=>api,database:()=>({collection:()=>table}),getCurrentUserInfo:()=>({uid:disk.get('uni_id_token'),tokenExpired:Date.now()+60000})};
 const src=fs.readFileSync(process.env.RC_PROFILE_SOURCE||'uni_modules/uni-id-pages/common/store.js','utf8').replace(/\/\/ #ifdef VUE2[\s\S]*?\/\/ #endif/g,'').replace(/^import[\s\S]*?from\s+['"][^'"]+['"];?/gm,'').replace(/export /g,'');
 const load=Function('uni','uniCloud','pagesJson','config','reactive','console',src+';return{mutations,store};');
 return{...load(uni,uniCloud,{}, {},x=>x,{error:(...a)=>logs.push(a)}),disk,queries,logout,failRealName:()=>realNameFails=true};
}
test('official profile refresh cannot apply account A contact data after switching to B',async()=>{
 const s=setup(),a=s.mutations.updateUserInfo();s.disk.set('uni_id_token','B');const b=s.mutations.updateUserInfo();
 s.queries[1].resolve({result:{data:[{_id:'B',nickname:'Beta'}]}});await b;s.queries[0].resolve({result:{data:[{_id:'A',nickname:'Alpha'}]}});await a;assert.equal(s.store.userInfo._id,'B');assert.equal(s.store.userInfo.nickname,'Beta');
});
test('old profile failure cannot erase the next account official user store',async()=>{
 const s=setup(),a=s.mutations.updateUserInfo();s.disk.set('uni_id_token','B');const b=s.mutations.updateUserInfo();s.queries[1].resolve({result:{data:[{_id:'B'}]}});await b;s.queries[0].reject(Error('offline'));await a;assert.equal(s.store.userInfo._id,'B');
});
test('optional real-name service outage does not erase successful basic identity',async()=>{
 const s=setup();s.failRealName();const p=s.mutations.updateUserInfo();s.queries[0].resolve({result:{data:[{_id:'A',nickname:'Alpha'}]}});await p;assert.equal(s.store.userInfo._id,'A');assert.equal(s.store.userInfo.nickname,'Alpha');assert.equal(s.store.hasLogin,true);
});
test('official module logout cannot remove a later login session',async()=>{
 const s=setup(),p=s.mutations.logout();s.disk.set('uni_id_token','B');s.mutations.setUserInfo({_id:'B'},{cover:true});s.logout.resolve({errCode:0});await p;assert.equal(s.disk.get('uni_id_token'),'B');assert.equal(s.store.userInfo._id,'B');
});
