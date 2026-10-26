import assert from 'node:assert/strict';

const {
  AUTH_CAPABILITY_STATUS,
  getAuthCapabilities,
  isAuthCapabilityCallable,
  isAuthCapabilityReady
} = await import('../common/auth-capabilities.js');

const android = getAuthCapabilities('android');
assert.equal(android.passwordLogin.status, AUTH_CAPABILITY_STATUS.PARTIAL);
assert.equal(android.profileFetch.status, AUTH_CAPABILITY_STATUS.PARTIAL);
assert.equal(android.logout.status, AUTH_CAPABILITY_STATUS.PARTIAL);
assert.equal(android.smsLogin.status, AUTH_CAPABILITY_STATUS.PARTIAL);
assert.equal(android.oneClickLogin.status, AUTH_CAPABILITY_STATUS.NOT_CONFIGURED);
assert.equal(android.wechatLogin.status, AUTH_CAPABILITY_STATUS.NOT_CONFIGURED);
assert.equal(android.appleLogin.status, AUTH_CAPABILITY_STATUS.UNSUPPORTED_PLATFORM);
assert.equal(android.accountCancellation.status, AUTH_CAPABILITY_STATUS.PARTIAL);
assert.equal(isAuthCapabilityReady('smsLogin', 'android'), false);
assert.equal(isAuthCapabilityCallable('smsLogin', 'android'), true);
assert.equal(isAuthCapabilityReady('passwordLogin', 'android'), false);
assert.equal(isAuthCapabilityCallable('passwordLogin', 'android'), true);
assert.equal(isAuthCapabilityCallable('logout', 'android'), true);

const ios = getAuthCapabilities('ios');
assert.equal(ios.appleLogin.status, AUTH_CAPABILITY_STATUS.NOT_CONFIGURED);
assert.equal(ios.appleLogin.available, false);

const storage = new Map();
globalThis.uni = {
  getSystemInfoSync() {
    return { uniPlatform: 'app', platform: 'android' };
  },
  getStorageSync(key) {
    return storage.get(key);
  },
  setStorageSync(key, value) {
    storage.set(key, value);
  },
  removeStorageSync(key) {
    storage.delete(key);
  }
};
assert.equal(getAuthCapabilities().appleLogin.status, AUTH_CAPABILITY_STATUS.UNSUPPORTED_PLATFORM);

globalThis.uniCloud = {
  async callFunction({ name }) {
    assert.equal(name, 'user_get_profile');
    return {
      result: {
        loggedIn: true,
        userId: 'user-a',
        nickname: '测试用户'
      }
    };
  }
};

const { getCurrentUser, refreshUserProfile } = await import('../common/auth-store.js');
assert.equal(getCurrentUser().loggedIn, false);
storage.set('uni_id_token', 'runtime-test-token');
storage.set('uni_id_token_expired', Date.now() + 60000);
const refreshed = await refreshUserProfile();
assert.equal(refreshed.loggedIn, true);
assert.equal(getCurrentUser().userId, 'user-a');
storage.set('uni_id_token_expired', Date.now() - 1);
assert.equal(getCurrentUser().loggedIn, false);

console.log('auth capabilities tests passed');
