const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs');
function setup(local = {}) {
  let profile = { loggedIn: true, userId: 'A', nickname: 'A' }, resolve;
  const disk = new Map([['uni_id_token', 'token-A'], ['uni-id-pages-userInfo', local]]);
  const source = fs.readFileSync('common/auth-session.js', 'utf8').replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g, '').replace(/export /g, '');
  const deps = { uni: { getStorageSync: k => disk.get(k) }, getCurrentUser: () => profile,
    uniCloud: { importObject: () => ({ getAccountInfo: () => new Promise(r => { resolve = r; }) }) } };
  const api = Function(...Object.keys(deps), source + ';return {getAccountSecurityInfo};')(...Object.values(deps));
  return { api, disk, finish: value => resolve(value), switch: () => { profile = { loggedIn: true, userId: 'B' }; disk.set('uni_id_token', 'token-B'); } };
}
test('security summary ignores cached contact data belonging to another uid', async () => {
  const s = setup({ _id: 'B', mobile: '19900001111', email: 'other@example.test', wx_openid: { app: 'stale' } });
  const pending = s.api.getAccountSecurityInfo();
  s.finish({ errCode: 0, isPasswordSet: true, isMobileBound: false, isEmailBound: false, isWeixinBound: false, isAppleBound: true });
  const result = await pending;
  assert.equal(result.maskedMobile, ''); assert.equal(result.maskedEmail, '');
  assert.equal(result.wechatBound, false); assert.equal(result.appleBound, true);
});
test('binding facts come from official response even if cached profile is stale', async () => {
  const s = setup({ _id: 'A', mobile: '19900001111', mobile_confirmed: true, wx_openid: { app: 'old' } });
  const pending = s.api.getAccountSecurityInfo();
  s.finish({ errCode: 0, isPasswordSet: false, isMobileBound: false, isEmailBound: false, isWeixinBound: false });
  const result = await pending;
  assert.equal(result.maskedMobile, ''); assert.equal(result.wechatBound, false);
  assert.equal(result.loginMethod, '已验证账号');
});
test('account switch while summary loads rejects stale response at service boundary', async () => {
  const s = setup({ _id: 'A' }); const pending = s.api.getAccountSecurityInfo();
  s.switch(); s.finish({ errCode: 0, isPasswordSet: true });
  await assert.rejects(pending, { errCode: 'pety-auth-session-changed' });
});
