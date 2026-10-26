const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs');
function page(file, deps = {}) {
  deps = {PetAvatarImage:{}, ...deps};
  const before = process.env.PETY_REFRESH_BEFORE;
  if(before)file = `${before}/${file.endsWith('profile.vue') ? 'profile.vue' : 'account-security.vue'}`;
  const source = fs.readFileSync(file, 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1]
    .replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g, '').replace('export default', 'return');
  return Function(...Object.keys(deps), source)(...Object.values(deps));
}
test('profile transport failure retains identity but cannot claim cloud verification', () => {
  const p = page('pages/profile/profile.vue');
  const state = {authLoading:false, userProfile:{loggedIn:true,message:'profile_refresh_failed'}, isPlusUser:false};
  assert.equal(p.computed.authStatusText.call(state), '账号状态待确认');
  assert.doesNotMatch(p.computed.remotePlanText.call(state), /已验证/);
  state.userProfile.message='ok';
  assert.equal(p.computed.authStatusText.call(state), '已登录');
  assert.match(p.computed.remotePlanText.call(state), /已验证/);
});
test('failed security refresh shows unknown facts, blocks wrong password route, and retry restores facts', async () => {
  let fail=true, navigations=0;
  const scope={}, profile={loggedIn:true,userId:'synthetic-A',nickname:'A'};
  const p=page('pages/account/account-security.vue', {
    getAuthCapabilities:()=>({}),getCurrentUser:()=>profile,refreshUserProfile:async()=>profile,
    getAccountSecurityInfo:async()=>{if(fail)throw Error('offline');return{...profile,isPasswordSet:true,maskedMobile:'已绑定',maskedEmail:''};},
    captureDataScope:()=>scope,isDataScopeCurrent:s=>s===scope,getGuestImportState:()=>({count:0}),
    reportAuthFailure(){},uni:{showToast(){},navigateTo(){navigations++;}}
  });
  const state={...p.data(),...p.methods};
  for(const [name,get] of Object.entries(p.computed))Object.defineProperty(state,name,{get:()=>get.call(state)});
  await state.loadAccount();
  assert.equal(state.securityInfo.loggedIn,true);
  assert.equal(state.accountRefreshFailed,true);
  assert.equal(state.mobileStatus,'暂未确认');assert.equal(state.emailStatus,'暂未确认');assert.equal(state.passwordStatus,'暂未确认');
  state.openPasswordSettings();assert.equal(navigations,0);
  fail=false;await state.loadAccount();
  assert.equal(state.accountRefreshFailed,false);assert.equal(state.mobileStatus,'已绑定');assert.equal(state.emailStatus,'未绑定');assert.equal(state.passwordStatus,'已设置');
  state.openPasswordSettings();assert.equal(navigations,1);
});

test('development diagnostics omit arbitrary codes, messages and identity; production emits nothing', () => {
 const output=[], runtime={env:{NODE_ENV:'development'}};
 const source=fs.readFileSync('common/auth-store.js','utf8').replace(/export /g,'');
 const report=Function('console','process',source+';return reportAuthFailure;')({info:(...args)=>output.push(args)},runtime);
 const privateValue='synthetic-private-token-contact';
 report('profile',{errCode:privateValue,message:`network ${privateValue}`,token:privateValue,detail:{uid:privateValue}});
 assert.equal(output.length,1);assert.doesNotMatch(JSON.stringify(output),/synthetic-private/);assert.match(JSON.stringify(output),/network/);
 runtime.env.NODE_ENV='production';report('profile',{errCode:500});assert.equal(output.length,1);
});
