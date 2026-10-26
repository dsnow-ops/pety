const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
function setup(){
 let scope={namespace:'account:A',version:1,ready:true},resolve,modal,logouts=0;
 const deps={getAuthCapabilities:()=>({}),getCurrentUser:()=>({loggedIn:true,userId:scope.namespace,nickname:scope.namespace}),
  refreshUserProfile:async()=>{},getAccountSecurityInfo:()=>new Promise(r=>resolve=r),
  captureDataScope:()=>scope,isDataScopeCurrent:s=>s===scope,subscribeAccountScope:()=>()=>{},
  getGuestImportState:()=>({status:'none',count:0}),friendlyAuthError:()=> 'error',successHaptic(){},
  logoutUniIdAccount:async()=>{logouts++},uni:{showModal:o=>modal=o,showToast(){}}};
 const source=fs.readFileSync('pages/account/account-security.vue','utf8').match(/<script>([\s\S]*?)<\/script>/)[1].replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g,'').replace('export default','return');
 const page=Function(...Object.keys(deps),source)(...Object.values(deps));const vm={...page.data(),...page.methods};
 return {vm,switch(){scope={namespace:'account:B',version:2,ready:true};vm.securityInfo={loggedIn:true,nickname:'B'}},finish:v=>resolve(v),modal:()=>modal,logouts:()=>logouts};
}
test('late account-security response cannot replace the newly signed-in account',async()=>{
 const s=setup(),request=s.vm.loadAccount();await Promise.resolve();s.switch();s.finish({loggedIn:true,nickname:'A-private'});await request;
 assert.equal(s.vm.securityInfo.nickname,'B');
});
test('logout confirmation opened by A cannot log out B',async()=>{
 const s=setup();s.vm.confirmLogout();s.switch();await s.modal().success({confirm:true});assert.equal(s.logouts(),0);assert.equal(s.vm.securityInfo.nickname,'B');
});
