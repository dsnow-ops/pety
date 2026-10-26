import { scopedStorage } from './scoped-storage.js';
export const AI_CONSENT_STORAGE_KEY = 'pety_ai_data_consent_v1';
export const AI_CONSENT_VERSION = 1;
export const AI_PROVIDER_SCOPES = ['pet_avatar', 'deepseek_chat'];

function emptyConsent() {
  return {
    version: AI_CONSENT_VERSION,
    accepted: false,
    acceptedAt: 0,
    locale: 'zh-Hans',
    providerScopes: {}
  };
}

export function getAiConsent() {
  const stored = scopedStorage.getStorageSync(AI_CONSENT_STORAGE_KEY);
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return emptyConsent();
  return {
    ...emptyConsent(),
    ...stored,
    providerScopes: stored.providerScopes && typeof stored.providerScopes === 'object'
      ? { ...stored.providerScopes }
      : {}
  };
}

export function hasAiConsent(scope) {
  const consent = getAiConsent();
  return consent.version === AI_CONSENT_VERSION &&
    consent.accepted === true &&
    AI_PROVIDER_SCOPES.includes(scope) &&
    consent.providerScopes[scope] === true;
}

export function acceptAiConsent(locale = 'zh-Hans') {
  const consent = {
    version: AI_CONSENT_VERSION,
    accepted: true,
    acceptedAt: Date.now(),
    locale: locale === 'en' ? 'en' : 'zh-Hans',
    providerScopes: AI_PROVIDER_SCOPES.reduce((result, scope) => {
      result[scope] = true;
      return result;
    }, {})
  };
  scopedStorage.setStorageSync(AI_CONSENT_STORAGE_KEY, consent);
  return consent;
}

export function revokeAiConsent() {
  const consent = emptyConsent();
  scopedStorage.setStorageSync(AI_CONSENT_STORAGE_KEY, consent);
  return consent;
}

export function buildAiConsentPayload(scope) {
  const consent = getAiConsent();
  return {
    aiConsentAccepted: hasAiConsent(scope),
    aiConsentVersion: consent.version,
    aiConsentScopes: Object.keys(consent.providerScopes).filter(key => consent.providerScopes[key] === true)
  };
}
