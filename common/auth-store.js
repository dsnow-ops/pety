const USER_PROFILE_CACHE_KEY = 'pety_user_profile_cache';

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

function writeUserCache(profile) {
  const normalizedProfile = normalizeUserProfile(profile);
  uni.setStorageSync(USER_PROFILE_CACHE_KEY, {
    ...normalizedProfile,
    cachedAt: Date.now()
  });
  return normalizedProfile;
}

export function getCurrentUser() {
  return readUserCache();
}

export function isLoggedIn() {
  return getCurrentUser().loggedIn === true;
}

export async function refreshUserProfile() {
  try {
    const res = await uniCloud.callFunction({
      name: 'user_get_profile'
    });
    const result = res && res.result ? res.result : {};
    return writeUserCache(result);
  } catch (error) {
    const cached = readUserCache();
    return {
      ...cached,
      message: 'profile_refresh_failed'
    };
  }
}

export function getEntitlements() {
  return normalizeEntitlements(getCurrentUser().entitlements);
}

export function clearUserCache() {
  uni.removeStorageSync(USER_PROFILE_CACHE_KEY);
  return GUEST_USER;
}
