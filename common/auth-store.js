const USER_PROFILE_CACHE_KEY = 'pety_user_profile_cache';
const TOKEN_KEY = 'uni_id_token';
const TOKEN_EXPIRED_KEY = 'uni_id_token_expired';
const UNI_ID_USER_INFO_KEY = 'uni-id-pages-userInfo';
const accountScopeListeners = new Set();
let accountScope = Object.freeze({ namespace: 'guest:local', version: 0, ready: true });

// Local ownership only. Cloud authorization still requires official checkToken.
// A valid token without a resolved uid must never borrow the guest namespace.
function syncAccountScope(profile = readUserCache()) {
  const validToken = hasValidUniIdToken();
  const uid = validToken && profile.loggedIn === true && typeof profile.userId === 'string' ? profile.userId : '';
  const lock=uni.getStorageSync('pety_session_lock_v1');
  const namespace = lock?.uid ? `account:${lock.uid}` : uid ? `account:${uid}` : validToken ? 'auth:pending' : 'guest:local';
  const ready=!lock && namespace !== 'auth:pending';
  if (namespace !== accountScope.namespace || ready !== accountScope.ready) {
    accountScope = Object.freeze({ namespace, version: accountScope.version + 1, ready });
    for (const listener of [...accountScopeListeners]) {
      try { listener(accountScope); } catch (_) { /* One disposed page cannot prevent other owners invalidating. */ }
    }
  }
  return accountScope;
}

export function getAccountScope() { return syncAccountScope(); }
export function subscribeAccountScope(listener) {
  syncAccountScope();
  accountScopeListeners.add(listener);
  return () => accountScopeListeners.delete(listener);
}

const DEFAULT_ENTITLEMENTS = {
  maxPets: 1,
  dailyAiLimit: 3,
  monthlyAiLimit: 0,
  cloudSyncEnabled: false,
  consultationRetentionDays: 30
};

const GUEST_USER = {
  loggedIn: false,
  userId: null,
  nickname: null,
  avatar: null,
  plan: 'free',
  status: 'inactive',
  entitlements: DEFAULT_ENTITLEMENTS,
  message: 'guest'
};

function normalizeEntitlements(entitlements = {}) {
  return {
    ...DEFAULT_ENTITLEMENTS,
    ...entitlements
  };
}

function normalizeUserProfile(profile = {}) {
  return {
    ...GUEST_USER,
    ...profile,
    loggedIn: profile.loggedIn === true,
    userId: profile.loggedIn === true ? (profile.userId || null) : null,
    nickname: profile.nickname || null,
    avatar: profile.avatar || null,
    plan: profile.plan || (profile.membership && profile.membership.plan) || 'free',
    status: profile.status || (profile.membership && profile.membership.status) || 'inactive',
    entitlements: normalizeEntitlements(profile.entitlements)
  };
}

function readUserCache() {
  const cached = uni.getStorageSync(USER_PROFILE_CACHE_KEY);
  if (!cached || typeof cached !== 'object') return GUEST_USER;
  return normalizeUserProfile(cached);
}

function hasValidUniIdToken() {
  const token = uni.getStorageSync(TOKEN_KEY);
  const tokenExpired = Number(uni.getStorageSync(TOKEN_EXPIRED_KEY)) || 0;
  return Boolean(token && tokenExpired > Date.now());
}

function clearExpiredAuthState() {
  uni.removeStorageSync(TOKEN_KEY);
  uni.setStorageSync(TOKEN_EXPIRED_KEY, 0);
  uni.removeStorageSync(UNI_ID_USER_INFO_KEY);
  uni.removeStorageSync(USER_PROFILE_CACHE_KEY);
  syncAccountScope();
}

function isInvalidTokenError(error = {}) {
  const code = String(error.errCode || error.code || '');
  return /^(uni-id-(token-expired|check-token-failed|account-(closed|banned|auditing|audit-failed|not-exists))|30202|30203|30204)$/.test(code);
}

function writeUserCache(profile) {
  const normalizedProfile = normalizeUserProfile(profile);
  uni.setStorageSync(USER_PROFILE_CACHE_KEY, {
    ...normalizedProfile,
    cachedAt: Date.now()
  });
  syncAccountScope(normalizedProfile);
  return normalizedProfile;
}

export function getCurrentUser() {
  const cached = readUserCache();
  syncAccountScope(cached);
  if(uni.getStorageSync('pety_session_lock_v1'))return GUEST_USER;
  if (cached.loggedIn && !hasValidUniIdToken()) return GUEST_USER;
  return cached;
}

export function isLoggedIn() {
  return getCurrentUser().loggedIn === true;
}

// Called only with the successful official login response. Identity is usable
// immediately; paid privileges remain unconfirmed until fetched from the server.
export function establishAuthenticatedProfile(result = {}) {
  if (!hasValidUniIdToken() || typeof result.uid !== 'string' || !result.uid) {
    throw Object.assign(new Error('登录响应缺少有效身份。'), { errCode: 'pety-auth-invalid-login-session' });
  }
  return writeUserCache({ ...GUEST_USER, loggedIn: true, userId: result.uid, message: 'profile_pending' });
}

export async function refreshUserProfile() {
  if (!hasValidUniIdToken()) {
    clearExpiredAuthState();
    return GUEST_USER;
  }
  const requestToken = uni.getStorageSync(TOKEN_KEY);
  try {
    const res = await uniCloud.callFunction({
      name: 'user_get_profile',
      data: { uniIdToken: requestToken }
    });
    if (uni.getStorageSync(TOKEN_KEY) !== requestToken) return getCurrentUser();
    const result = res && res.result ? res.result : {};
    if (result.errCode) throw result;
    if (result.loggedIn !== true || typeof result.userId !== 'string' || !result.userId) {
      throw { errCode: 'pety-auth-profile-unavailable' };
    }
    const profile = writeUserCache(result);
    return profile;
  } catch (error) {
    if (uni.getStorageSync(TOKEN_KEY) !== requestToken) return getCurrentUser();
    reportAuthFailure('profile', error);
    if (isInvalidTokenError(error)) {
      clearExpiredAuthState();
      return GUEST_USER;
    }
    const cached = readUserCache();
    return {
      ...cached,
      message: 'profile_refresh_failed'
    };
  }
}

// Development diagnostics contain fixed classifications only, never messages,
// contact details, IDs, tokens, URLs, stacks or full cloud response objects.
export function reportAuthFailure(stage, error = {}) {
  if (process.env.NODE_ENV === 'production') return;
  const allowed = ['uni-id-token-expired', 'uni-id-check-token-failed', 'uni-id-account-not-exists',
    'pety-auth-service-unavailable', 'pety-membership-unavailable', 'pety-auth-session-changed',
    'pety-session-required', 'pety-session-revoked', 'pety-session-service-unavailable'];
  const code = error?.errCode ?? error?.code;
  const message = String(error?.errMsg || error?.message || '');
  const detail = {
    stage: stage === 'profile' ? 'profile' : 'account-security',
    code: allowed.includes(code) ? code : (Number.isSafeInteger(code) ? code : 'other'),
    kind: ['Error', 'TypeError', 'ReferenceError'].includes(error?.name) ? error.name : 'cloud-result',
    network: /network|timeout|timed out|网络|超时/i.test(message),
    missingModule: /Cannot find module|MODULE_NOT_FOUND/i.test(message),
    missingFunction: /function.*not.*(?:exist|found)|云函数不存在/i.test(message),
    database: /database|collection|数据库|集合/i.test(message)
  };
  console.info('[pety-auth-diagnostic]', JSON.stringify(detail));
}

export function restoreUserProfile() {
  return refreshUserProfile();
}

export function getEntitlements() {
  return normalizeEntitlements(getCurrentUser().entitlements);
}

export function clearUserCache() {
  uni.removeStorageSync(USER_PROFILE_CACHE_KEY);
  syncAccountScope();
  return GUEST_USER;
}
