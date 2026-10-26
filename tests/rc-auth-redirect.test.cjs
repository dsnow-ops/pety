const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const api=Function(fs.readFileSync('common/auth-redirect.js','utf8').replace(/export /g,'')+';return{normalizeAuthRedirect,navigateAuthDestination};')();
test('post-login targets reject auth loops, arbitrary modules, external URLs and nested redirects',()=>{
 for(const value of ['/pages/auth/login','/pages/auth/register','https://example.invalid','//example.invalid',
 '/uni_modules/uni-id-pages/pages/common/webview/webview?url=https://example.invalid','/pages/home/../auth/login',
 '/pages/profile/profile?uniIdRedirectUrl=/pages/auth/login','/pages/profile/profile#login','/pages/profile/profile?url=https://example.invalid',
 '%252Fpages%252Fprofile%252Fprofile','/pages/archive/archive?petId=A&petId=B','/pages/archive/archive?petId=%2fB','/pages/profile/profile?__proto__=bad']){
  assert.equal(api.normalizeAuthRedirect(value),'',value);
 }
});
test('safe product routes preserve supported parameters and do not invent unregistered paths',()=>{
 const paths=new Set(JSON.parse(fs.readFileSync('pages.json','utf8').replace(/^\uFEFF/, '')).pages.map(p=>'/'+p.path));
 for(const value of ['/pages/profile/profile','/pages/archive/archive?petId=pet_test-42','/pages/calendar/calendar?selectedDate=2026-09-21',
 '/pages/memorial-persona/memorial-persona?petId=A&view=edit&step=2']){
  assert.equal(api.normalizeAuthRedirect(encodeURIComponent(value)),value);assert.ok(paths.has(value.split('?')[0]));
 }
});
test('tab destinations use switchTab; an existing plain product page is restored instead of stacked twice',()=>{
 const calls=[],uni={switchTab:o=>calls.push(['tab',o]),navigateBack:o=>calls.push(['back',o]),redirectTo:o=>calls.push(['redirect',o])};
 api.navigateAuthDestination('/pages/chat/chat',uni);assert.deepEqual(calls.pop(),['tab',{url:'/pages/chat/chat'}]);
 api.navigateAuthDestination('/pages/settings/settings',uni,[{route:'pages/home/home'},{route:'pages/settings/settings'},{route:'pages/auth/login'}]);
 const [kind,options]=calls.pop();assert.equal(kind,'back');assert.equal(options.delta,1);
 api.navigateAuthDestination('/pages/archive/archive?petId=B',uni,[{route:'pages/archive/archive',options:{petId:'A'}},{route:'pages/auth/login'}]);
 assert.equal(calls.at(-1)[0],'redirect');assert.equal(calls.at(-1)[1].url,'/pages/archive/archive?petId=B');
});
