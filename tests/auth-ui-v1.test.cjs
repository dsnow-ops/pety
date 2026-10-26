'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, '');
const login = read('pages/auth/login.vue');
const authSession = read('common/auth-session.js');
const authStore = read('common/auth-store.js');
const app = read('App.vue');
const account = read('pages/account/account-security.vue');
const profile = read('pages/profile/profile.vue');
const settings = read('pages/settings/settings.vue');
const pages = JSON.parse(read('pages.json'));

assert.match(login, /password:\s*''/);
assert.match(login, /smsCode:\s*''/);
assert.doesNotMatch(login, /setStorageSync\([^\n]*(password|smsCode|captcha)/);
assert.match(login, /agreed:\s*false/);
assert.match(login, /!this\.smsReady/);
assert.match(login, /this\.startCountdown\(\)/);
assert.match(login, /onUnload\(\)/);
assert.match(account, /本机宠物和记录仍会保留/);
assert.match(account, /accountCancellation\.reason/);
assert.doesNotMatch(account, /clearStorage/);
assert.doesNotMatch(`${profile}\n${settings}`, /@click="handleLogout"|@click="confirmLogout"/);
assert.ok(pages.pages.some(page => page.path === 'pages/account/account-security'));
assert.ok(pages.pages.some(page => page.path === 'pages/legal/legal'));
assert.equal(pages.uniIdRouter.loginPage, 'pages/auth/login');
assert.equal(pages.uniIdRouter.resToLogin, false);
assert.equal(pages.pages.find(page => page.path === 'pages/auth/login').needLogin, false);
assert.equal(pages.pages.find(page => page.path === 'pages/legal/legal').needLogin, false);
assert.match(login, /options\.uniIdRedirectUrl/);
assert.match(login, /navigateAfterLogin\(\)/);
assert.match(login, /其他登录方式/);
assert.match(login, /本机号码一键登录/);
assert.match(login, /wechatLogin/);
assert.match(login, /appleLogin\.status !== 'UNSUPPORTED_PLATFORM'/);
assert.match(login, /:disabled="!item\.available"/);
assert.match(login, /if \(!item \|\| !item\.available\) return/);
test('malformed or expired official login responses cannot replace a valid local session', async () => {
  let writes = 0;
  const disk = new Map([['uni_id_token', 'existing-valid-session']]);
  const uni = {getStorageSync:key=>disk.get(key),setStorageSync(){writes++},removeStorageSync(){writes++}};
  const moduleSource = authSession.replace(/^import[^;]+;/gm, '').replace(/export /g, '');
  const api = Function('uni','uniCloud',moduleSource+';return{completeUniIdLogin};')(uni,{importObject:()=>({})});
  for (const result of [{}, {uid:'A'}, {uid:'A',token:'new',tokenExpired:1}, {token:'new',tokenExpired:Date.now()+60000},
    {uid:'A',token:'new',tokenExpired:'invalid'}, {uid:'A',token:123,tokenExpired:Date.now()+60000}]) {
    await assert.rejects(api.completeUniIdLogin(result), {errCode:'pety-auth-invalid-login-session'});
  }
  assert.equal(writes,0);
  assert.equal(disk.get('uni_id_token'),'existing-valid-session');
});
assert.match(authSession, /clearUniIdSession\(\)/);
assert.match(authStore, /hasValidUniIdToken\(\)/);
assert.match(app, /restoreUserProfile\(\)/);

console.log('auth UI tests passed');
