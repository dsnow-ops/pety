const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}};
function setup(overrides={}){
 const disk=new Map([['uni_id_token','A'],['uni_id_token_expired',Date.now()+60000]]),requests=[],notices=[];
 let profile={loggedIn:true,userId:'A'};
 const uni={getStorageSync:k=>disk.get(k),setStorageSync:(k,v)=>disk.set(k,v),removeStorageSync:k=>disk.delete(k),$emit(){}};
 const api={login(){const d=deferred();requests.push(d);return d.promise},logout(){const d=deferred();requests.push(d);return d.promise}};
 const deps={acceptSession(){},clearSession(){},uni,uniCloud:{importObject:()=>api},clearUserCache:()=>profile={loggedIn:false},getCurrentUser:()=>profile,
  establishAuthenticatedProfile:r=>profile={loggedIn:true,userId:r.uid,plan:'free'},refreshUserProfile:async()=>profile,
  mutations:{setUserInfo(){},loginSuccess:r=>notices.push(r.uid)},getAuthCapabilityReason:()=>'',isAuthCapabilityCallable:()=>true,isAuthCapabilityReady:()=>true,...overrides};
 const src=fs.readFileSync('common/auth-session.js','utf8').replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g,'').replace(/export /g,'');
 const session=Function(...Object.keys(deps),src+';return {loginWithPassword,logoutUniIdAccount,completeUniIdLogin,cancelPendingAuth:typeof cancelPendingAuth==="function"?cancelPendingAuth:null};')(...Object.values(deps));
 return{...session,disk,requests,notices,profile:()=>profile};
}
const loginResult=uid=>({uid,newToken:{token:uid,tokenExpired:Date.now()+60000}});
test('older successful login response cannot replace the newer chosen account',async()=>{
 const s=setup(),old=s.loginWithPassword('old','test'),rejected=assert.rejects(old,{errCode:'pety-auth-session-changed'});
 const latest=s.loginWithPassword('new','test');s.requests[1].resolve(loginResult('B'));await latest;
 s.requests[0].resolve(loginResult('A'));await rejected;assert.equal(s.disk.get('uni_id_token'),'B');assert.equal(s.profile().userId,'B');assert.deepEqual(s.notices,['B']);
});
test('an old logout response cannot clear a newly established account',async()=>{
 const s=setup(),exit=s.logoutUniIdAccount();await s.completeUniIdLogin(loginResult('B'));s.requests[0].resolve({errCode:0});await exit;
 assert.equal(s.disk.get('uni_id_token'),'B');assert.equal(s.profile().userId,'B');
});
test('logout invalidates a pending login before its response can write a token',async()=>{
 const s=setup(),pending=s.loginWithPassword('new','test'),rejected=assert.rejects(pending,{errCode:'pety-auth-session-changed'});
 const exit=s.logoutUniIdAccount();s.requests[1].resolve({errCode:0});await exit;s.requests[0].resolve(loginResult('B'));await rejected;assert.equal(s.disk.has('uni_id_token'),false);
});
test('cancelled login does not establish a session after the page leaves',async()=>{
 const s=setup();assert.equal(typeof s.cancelPendingAuth,'function');const pending=s.loginWithPassword('new','test'),rejected=assert.rejects(pending,{errCode:'pety-auth-session-changed'});
 s.cancelPendingAuth();s.requests[0].resolve(loginResult('B'));await rejected;assert.equal(s.disk.get('uni_id_token'),'A');
});
test('a malformed new login response preserves an existing valid session',async()=>{
 const s=setup();await assert.rejects(s.completeUniIdLogin({}),{errCode:'pety-auth-invalid-login-session'});assert.equal(s.disk.get('uni_id_token'),'A');assert.equal(s.profile().userId,'A');
});

test('official login completion is not held in a cancellable UI state while optional profile refresh waits',async()=>{
 const profile=deferred(),s=setup({refreshUserProfile:()=>profile.promise});let settled=false;
 const work=s.completeUniIdLogin(loginResult('B')).then(result=>{settled=true;return result});
 await Promise.resolve();await Promise.resolve();await Promise.resolve();
 try{assert.equal(settled,true,'official token accepted must complete before optional profile');}
 finally{profile.resolve({loggedIn:true,userId:'B'});await work;}
 assert.equal(s.disk.get('uni_id_token'),'B');assert.deepEqual(s.notices,['B']);
});
