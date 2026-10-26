import {acceptSession,clearSession} from './single-session-client.js';
import { clearUserCache, getCurrentUser, refreshUserProfile, establishAuthenticatedProfile } from './auth-store.js';
import { getAuthCapabilityReason, isAuthCapabilityCallable, isAuthCapabilityReady } from './auth-capabilities.js';
import { mutations } from '@/uni_modules/uni-id-pages/common/store.js';

const TOKEN_KEY = 'uni_id_token';
const TOKEN_EXPIRED_KEY = 'uni_id_token_expired';
const UNI_ID_USER_INFO_KEY = 'uni-id-pages-userInfo';
const uniIdCo = uniCloud.importObject('uni-id-co', { customUI: true });
let authOperation = 0;

export function beginAuthAttempt() { return ++authOperation; }
export function cancelPendingAuth(attempt) {
  if (attempt === undefined || attempt === authOperation) authOperation += 1;
}
function assertCurrentAttempt(attempt) {
  if (attempt !== authOperation) {
    throw Object.assign(new Error('登录操作已取消或被新的操作替代。'), { errCode: 'pety-auth-session-changed' });
  }
}

function createCapabilityError(name) {
  const error = new Error(getAuthCapabilityReason(name));
  error.errCode = `pety-auth-${name}-not-ready`;
  return error;
}

function clearUniIdSession() {
  clearSession();
  uni.removeStorageSync(TOKEN_KEY);
  uni.setStorageSync(TOKEN_EXPIRED_KEY, 0);
  try {
    mutations.setUserInfo({}, { cover: true });
  } catch (error) {
    // Storage cleanup below remains the source of truth if the reactive store is unavailable.
  }
  uni.removeStorageSync(UNI_ID_USER_INFO_KEY);
  const guestProfile = clearUserCache();
  uni.$emit('uni-id-pages-logout');
  return guestProfile;
}

function maskContact(value, type) {
  const text = String(value || '');
  if (!text) return '';
  if (type === 'mobile' && text.length >= 7) return `${text.slice(0, 3)}****${text.slice(-4)}`;
  const at = text.indexOf('@');
  if (type === 'email' && at > 1) return `${text.slice(0, 2)}***${text.slice(at)}`;
  return text.length > 8 ? `${text.slice(0, 4)}...${text.slice(-4)}` : text;
}

function extractTokenPayload(result = {}) {
  const newToken = result.petyIssuedToken || result.newToken || {};
  return {
    token: newToken.token || result.token || '',
    tokenExpired: newToken.tokenExpired || result.tokenExpired || 0
  };
}

export function saveUniIdToken(result = {}) {
  const { token, tokenExpired } = extractTokenPayload(result);
  if (!token || !tokenExpired) return false;

  try {
    uni.setStorageSync(TOKEN_KEY, token);
    uni.setStorageSync(TOKEN_EXPIRED_KEY, tokenExpired);
    return true;
  } catch (error) {
    uni.removeStorageSync(TOKEN_KEY);
    uni.setStorageSync(TOKEN_EXPIRED_KEY, 0);
    throw error;
  }
}

export async function completeUniIdLogin(result = {}, attempt = beginAuthAttempt()) {
  assertCurrentAttempt(attempt);
  if(result.petySessionChallenge){
    const challenge=result.petySessionChallenge;
    const accepted=!challenge.takeoverRequired||await new Promise(resolve=>uni.showModal({title:'在这台设备登录？',content:'继续登录将退出其他设备；未同步的资料仍保存在原设备。',confirmText:'继续登录',success:r=>resolve(r.confirm),fail:()=>resolve(false)}));
    assertCurrentAttempt(attempt);
    if(!accepted){await uniIdCo.cancelPetySession({ticket:challenge.ticket});throw Object.assign(new Error('已取消登录'),{errCode:'pety-auth-cancelled'});}
    result=await uniIdCo.confirmPetySession({ticket:challenge.ticket});assertCurrentAttempt(attempt);
  }
  const candidate = extractTokenPayload(result);
  if (result.errCode || typeof result.uid !== 'string' || !result.uid ||
      typeof candidate.token !== 'string' || !candidate.token || Number(candidate.tokenExpired) <= Date.now() || !Number.isFinite(Number(candidate.tokenExpired))) {
    const error = new Error('登录响应缺少有效会话，请稍后再试。');
    error.errCode = 'pety-auth-invalid-login-session';
    throw error;
  }
  acceptSession(result.petySession,result.uid);
  saveUniIdToken(result);

  try { establishAuthenticatedProfile(result); }
  catch (error) { clearUniIdSession(); throw error; }
  // This synchronous commit is the end of login. Optional profile retrieval must
  // not leave a cancel button visible while the official account is already active.
  // auth-store and the official module each guard their refresh by accepted token.
  try {
    mutations.loginSuccess({
      ...result,
      showToast: false,
      autoBack: false
    });
  } catch (_) { /* A nonessential reactive profile refresh cannot revoke login. */ }
  try { Promise.resolve(refreshUserProfile()).catch(() => {}); }
  catch (_) { /* Keep the confirmed official identity if profile transport fails. */ }
  return getCurrentUser();
}

export async function loginWithPassword(account, password, extra = {}) {
  if (!isAuthCapabilityCallable('passwordLogin')) throw createCapabilityError('passwordLogin');
  const attempt = extra.attempt ?? beginAuthAttempt();
  assertCurrentAttempt(attempt);
  const identity = String(account || '').trim();
  const payload = {
    password: String(password || '')
  };
  if (/^1\d{10}$/.test(identity)) payload.mobile = identity;
  else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity)) payload.email = identity;
  else payload.username = identity;
  if (extra.captcha) payload.captcha = String(extra.captcha);
  const result = await uniIdCo.login(payload);
  await completeUniIdLogin(result, attempt);
  return result;
}

export async function sendSmsLoginCode(mobile, extra = {}) {
  if (!isAuthCapabilityCallable('smsLogin')) throw createCapabilityError('smsLogin');
  return uniIdCo.sendSmsCode({
    mobile: String(mobile || ''),
    scene: 'login-by-sms',
    ...(extra.captcha ? { captcha: String(extra.captcha) } : {})
  });
}

export async function loginWithSms(mobile, code, extra = {}) {
  if (!isAuthCapabilityCallable('smsLogin')) throw createCapabilityError('smsLogin');
  const attempt = extra.attempt ?? beginAuthAttempt();
  assertCurrentAttempt(attempt);
  const result = await uniIdCo.loginBySms({
    mobile: String(mobile || ''),
    code: String(code || ''),
    ...(extra.captcha ? { captcha: String(extra.captcha) } : {})
  });
  await completeUniIdLogin(result, attempt);
  return result;
}

export async function getAccountSecurityInfo() {
  const profile = getCurrentUser();
  if (!profile.loggedIn) {
    return {
      loggedIn: false,
      nickname: '',
      userId: '',
      maskedUserId: '',
      maskedMobile: '',
      maskedEmail: '',
      isPasswordSet: false,
      wechatBound: false,
      appleBound: false,
      loginMethod: '游客'
    };
  }

  const token = uni.getStorageSync(TOKEN_KEY);
  const operation = authOperation;
  const cachedUserInfo = uni.getStorageSync(UNI_ID_USER_INFO_KEY) || {};
  const localUserInfo = cachedUserInfo._id === profile.userId ? cachedUserInfo : {};
  const accountInfo = await uniIdCo.getAccountInfo();
  let sessionState;try{sessionState=await uniIdCo.getPetySessionStatus();}catch(_){}
  const current = getCurrentUser();
  if (operation !== authOperation || uni.getStorageSync(TOKEN_KEY) !== token ||
      !current.loggedIn || current.userId !== profile.userId) {
    throw Object.assign(new Error('账号已变化，请重新读取。'), { errCode: 'pety-auth-session-changed' });
  }
  if (!accountInfo || (accountInfo.errCode !== undefined && accountInfo.errCode !== 0)) {
    throw Object.assign(new Error('账号信息暂时无法读取。'), { errCode: accountInfo?.errCode || 'pety-auth-service-unavailable' });
  }
  return {
    loggedIn: true,
    singleSessionStatus: sessionState?.enforced ? '服务端已启用：新设备确认后，旧会话失效' : '尚未验证服务端启用，当前不宣称防共享',
    nickname: profile.nickname || localUserInfo.nickname || localUserInfo.username || '',
    userId: profile.userId || localUserInfo._id || '',
    maskedUserId: maskContact(profile.userId || localUserInfo._id || '', 'id'),
    maskedMobile: accountInfo.isMobileBound ? (maskContact(localUserInfo.mobile || '', 'mobile') || '已绑定') : '',
    maskedEmail: accountInfo.isEmailBound ? (maskContact(localUserInfo.email || '', 'email') || '已绑定') : '',
    isPasswordSet: Boolean(accountInfo && accountInfo.isPasswordSet),
    wechatBound: accountInfo.isWeixinBound === true,
    appleBound: accountInfo.isAppleBound === true,
    loginMethod: accountInfo.isMobileBound ? '手机号' : (accountInfo.isEmailBound ? '邮箱' : (accountInfo.isPasswordSet ? '账号密码' : '已验证账号'))
  };
}

export async function logoutUniIdAccount() {
  const attempt = beginAuthAttempt();
  const token = uni.getStorageSync(TOKEN_KEY);
  const tokenExpired = Number(uni.getStorageSync(TOKEN_EXPIRED_KEY)) || 0;
  if (!token || tokenExpired <= Date.now()) return clearUniIdSession();
  if (!isAuthCapabilityCallable('logout')) throw createCapabilityError('logout');
  await uniIdCo.logout();
  if (attempt !== authOperation || uni.getStorageSync(TOKEN_KEY) !== token) return getCurrentUser();
  return clearUniIdSession();
}

export async function requestAccountCancellation() {
  throw createCapabilityError('accountCancellation');
}

export function friendlyAuthError(error = {}) {
  const errCode = error.errCode || '';
  const message = error.message || '';

  if (errCode.includes('captcha')) {
    return '图形验证码不正确或已过期，请加载新图片后重试。';
  }
  if (errCode.includes('not-ready')) return '当前登录方式尚未接入。';
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
