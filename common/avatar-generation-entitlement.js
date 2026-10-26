import { getCurrentUser } from './auth-store.js';

const isDevelopment = typeof PETY_AVATAR_IS_DEVELOPMENT !== 'undefined' && PETY_AVATAR_IS_DEVELOPMENT === true;
const devBypassFlag = typeof PETY_AVATAR_DEV_MEMBER_BYPASS !== 'undefined' && PETY_AVATAR_DEV_MEMBER_BYPASS === true;
let devDiagnosticLogged = false;

export const AVATAR_FREE_SUCCESS_LIMIT = 3;
export const AVATAR_MEMBER_SUCCESS_LIMIT = 10;

export function resolveAvatarDevEntitlementBypass({ isDevBuild = false, envFlag = false } = {}) {
  return isDevBuild === true && envFlag === true;
}

export function isAvatarDevEntitlementBypass() {
  const bypass = resolveAvatarDevEntitlementBypass({ isDevBuild: isDevelopment, envFlag: devBypassFlag });
  if (isDevelopment && !devDiagnosticLogged) {
    devDiagnosticLogged = true;
    console.info('[pet-avatar][dev-entitlement]', {
      isDevBuild: isDevelopment,
      envFlag: devBypassFlag,
      bypass
    });
  }
  return bypass;
}

export function isActiveAvatarMember(user = getCurrentUser()) {
  return Boolean(user && ['plus', 'pro'].includes(user.plan) && user.status === 'active');
}

export async function getAvatarGenerationEntitlement(petId) {
  if (typeof petId !== 'string' || !petId.trim() || petId.length > 128) {
    throw Object.assign(new Error('INVALID_PET_ID'), { code: 'INVALID_PET_ID', stage: 'ENTITLEMENT' });
  }
  // The build flag only requests developer treatment. The server must still
  // verify identity, environment and its allowlist before reporting privileges.
  let response;
  try { response = await uniCloud.callFunction({
    name: 'api_pet_avatar',
    data: { action: 'getEntitlement', petId, uniIdToken: uni.getStorageSync('uni_id_token') || '',
      devEntitlementBypassRequested: isAvatarDevEntitlementBypass() }
  }); } catch (cause) {
    const error = new Error('AVATAR_ENTITLEMENT_UNAVAILABLE');
    error.code = String(cause?.code || cause?.errCode || 'AVATAR_ENTITLEMENT_UNAVAILABLE');
    error.stage = 'ENTITLEMENT';
    throw error;
  }
  const result = response && response.result;
  if (!result || result.code !== 0 || !result.entitlement) {
    const error = new Error(result && result.message || 'AVATAR_ENTITLEMENT_UNAVAILABLE');
    error.code = result && result.errorCode || 'AVATAR_ENTITLEMENT_UNAVAILABLE';
    error.stage = 'ENTITLEMENT';
    throw error;
  }
  return result.entitlement;
}
