const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function endpoint(name, failure, profileFailure = false, logs = []) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(`uniCloud-alipay/cloudfunctions/${name}/index.js`, 'utf8'), {
    module, exports: module.exports, process: {env:{}}, console: { error(...args) { logs.push(args); } },
    require: name => name==='pety-auth'?({ verifyRequest: async () => ({ uid: 'account-A' }), authErrorResult: e => e }):require('../uniCloud-alipay/cloudfunctions/common/'+name),
    uniCloud: { database: () => ({ collection: name => ({
      where: () => ({ limit: () => ({ get: async () => {
        if (failure === 'malformed') return {data:null};
        if (failure === 'record-malformed') return {data:[null]};
        if (failure === 'error-object') return {errCode:'TEST_DATABASE_FAILURE'};
        if (failure) throw Error('private database diagnostic');
        return { data: [] };
      } }) }),
      doc: () => ({ get: async () => {
        if(profileFailure === 'throw') throw Error('private database diagnostic: email secret');
        return { data: profileFailure === 'missing' ? [] : [{ nickname: 'A' }] };
      } })
    }) }) }
  });
  return module.exports.main({}, {});
}

test('membership outage never becomes a successful free entitlement response', async () => {
  for (const name of ['membership_get', 'user_get_profile']) {
    const result = await endpoint(name, true);
    assert.equal(result.errCode, 'pety-membership-unavailable', name);
    assert.equal(result.plan, undefined);
    assert.equal(result.entitlements, undefined);
    assert.equal(JSON.stringify(result).includes('private database diagnostic'), false);
  }
});

test('a successful empty membership lookup still means free, not service outage', async () => {
  for (const name of ['membership_get', 'user_get_profile']) {
    const result = await endpoint(name, false);
    assert.equal(result.plan, 'free');
    assert.equal(result.errCode, undefined);
  }
});

test('malformed membership lookup is unavailable rather than an invented free account',async()=>{
 for(const name of ['membership_get','user_get_profile'])for(const failure of ['malformed','record-malformed','error-object']){
  const result=await endpoint(name,failure);assert.equal(result.errCode,'pety-membership-unavailable',name+':'+failure);assert.equal(result.plan,undefined);assert.equal(result.entitlements,undefined);
 }
});

test('membership refresh outage preserves correct account display and token', async () => {
  const profile = { loggedIn: true, userId: 'A', plan: 'plus', status: 'active' };
  const disk = new Map([['uni_id_token', 'official-A'], ['uni_id_token_expired', Date.now() + 60000], ['pety_user_profile_cache', profile]]);
  const uni = { getStorageSync: k => disk.get(k), setStorageSync: (k, v) => disk.set(k, v), removeStorageSync: k => disk.delete(k) };
  const src = fs.readFileSync('common/auth-store.js', 'utf8').replace(/export /g, '');
  const store = Function('uni', 'uniCloud', src + ';return {refreshUserProfile};')(uni, {
    callFunction: async () => ({ result: await endpoint('user_get_profile', true) })
  });
  const result = await store.refreshUserProfile();
  assert.equal(result.plan, 'plus');
  assert.equal(result.message, 'profile_refresh_failed');
  assert.equal(disk.get('uni_id_token'), 'official-A');
  assert.equal(disk.get('pety_user_profile_cache'), profile);
});

test('profile outage or missing user never publishes an empty successful profile or private diagnostics', async()=>{
 for(const failure of ['throw','missing']){
  const logs=[],result=await endpoint('user_get_profile',false,failure,logs);
  assert.equal(result.errCode,'pety-profile-unavailable');assert.equal(result.nickname,undefined);assert.equal(result.plan,undefined);
  assert.doesNotMatch(JSON.stringify({result,logs}),/private database diagnostic|email secret/);
  const profile={loggedIn:true,userId:'A',nickname:'TEST 保留名字',avatar:'local-test-avatar',plan:'plus',status:'active'};
  const disk=new Map([['uni_id_token','official-A'],['uni_id_token_expired',Date.now()+60000],['pety_user_profile_cache',profile]]);
  const uni={getStorageSync:k=>disk.get(k),setStorageSync:(k,v)=>disk.set(k,v),removeStorageSync:k=>disk.delete(k)};
  const src=fs.readFileSync('common/auth-store.js','utf8').replace(/export /g,'');
  const store=Function('uni','uniCloud',src+';return {refreshUserProfile};')(uni,{callFunction:async()=>({result})});
  const refreshed=await store.refreshUserProfile();assert.equal(refreshed.nickname,profile.nickname);assert.equal(refreshed.avatar,profile.avatar);assert.equal(refreshed.message,'profile_refresh_failed');assert.equal(disk.get('uni_id_token'),'official-A');assert.equal(disk.get('pety_user_profile_cache'),profile);
 }
});
