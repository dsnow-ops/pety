import { clearUserCache, refreshUserProfile } from './auth-store.js';
import { mutations } from '@/uni_modules/uni-id-pages/common/store.js';

const TOKEN_KEY = 'uni_id_token';
const TOKEN_EXPIRED_KEY = 'uni_id_token_expired';
const UNI_ID_USER_INFO_KEY = 'uni-id-pages-userInfo';

function extractTokenPayload(result = {}) {
  const newToken = result.newToken || {};
  return {
    token: newToken.token || result.token || '',
    tokenExpired: newToken.tokenExpired || result.tokenExpired || 0
  };
}

export function saveUniIdToken(result = {}) {
  const { token, tokenExpired } = extractTokenPayload(result);
  if (!token || !tokenExpired) return false;

  uni.setStorageSync(TOKEN_KEY, token);
  uni.setStorageSync(TOKEN_EXPIRED_KEY, tokenExpired);
  return true;
}

export async function completeUniIdLogin(result = {}) {
  saveUniIdToken(result);
  mutations.loginSuccess({
    ...result,
    showToast: false,
    autoBack: false
  });
  return refreshUserProfile();
}

export async function logoutUniIdAccount() {
  try {
    const currentUser = uniCloud.getCurrentUserInfo();
    if (currentUser && currentUser.tokenExpired > Date.now()) {
      const uniIdCo = uniCloud.importObject('uni-id-co', { customUI: true });
      await uniIdCo.logout();
    }
  } catch (error) {
    console.warn('uni-id logout skipped', error && (error.errCode || error.message));
  }

  uni.removeStorageSync(TOKEN_KEY);
  uni.setStorageSync(TOKEN_EXPIRED_KEY, 0);
  uni.removeStorageSync(UNI_ID_USER_INFO_KEY);
  const guestProfile = clearUserCache();
  uni.$emit('uni-id-pages-logout');
  return guestProfile;
}

export function friendlyAuthError(error = {}) {
  const errCode = error.errCode || '';
  const message = error.message || '';

  if (errCode.includes('captcha')) {
    return '验证码不太对，已经为你换了一张。';
  }
  if (errCode.includes('password') || message.toLowerCase().includes('password')) {
    return '账号或密码不正确，请再检查一下。';
  }
  if (errCode.includes('username') || errCode.includes('user-not-exists')) {
    return '这个账号还没有注册，或者输入有误。';
  }
  if (errCode.includes('account-exists') || errCode.includes('username-exists')) {
    return '这个用户名已经被使用了，换一个试试。';
  }
  if (errCode.includes('param') || errCode.includes('invalid')) {
    return '填写内容有点问题，请检查后再试。';
  }
  return '账号服务暂时没有响应，请稍后再试。';
}
