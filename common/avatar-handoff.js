import { scopedStorage } from './scoped-storage.js';
const HANDOFF_PREFIX = 'pety_avatar_handoff_';
const HANDOFF_TTL_MS = 5 * 60 * 1000;

function getHandoffKey(petId) {
  return `${HANDOFF_PREFIX}${String(petId || '')}`;
}

export function saveAvatarHandoff(payload = {}) {
  const petId = String(payload.petId || '');
  const fileId = String(payload.fileId || '');
  const previewUrl = String(payload.previewUrl || '');
  if (!petId || !fileId || !previewUrl) return null;
  const handoff = {
    petId,
    fileId,
    jobId: String(payload.jobId || ''),
    previewUrl,
    mainAssetMetadata: payload.mainAssetMetadata && typeof payload.mainAssetMetadata === 'object'
      ? payload.mainAssetMetadata
      : null,
    createdAt: Date.now()
  };
  scopedStorage.setStorageSync(getHandoffKey(petId), handoff);
  return handoff;
}

export function getAvatarHandoff(petId, now = Date.now()) {
  const expectedPetId = String(petId || '');
  if (!expectedPetId) return null;
  const stored = scopedStorage.getStorageSync(getHandoffKey(expectedPetId));
  if (!stored || typeof stored !== 'object') return null;
  const valid = String(stored.petId || '') === expectedPetId &&
    Boolean(stored.fileId && stored.previewUrl) &&
    now - Number(stored.createdAt || 0) >= 0 &&
    now - Number(stored.createdAt || 0) <= HANDOFF_TTL_MS;
  if (!valid) {
    scopedStorage.removeStorageSync(getHandoffKey(expectedPetId));
    return null;
  }
  return {
    petId: expectedPetId,
    fileId: String(stored.fileId),
    jobId: String(stored.jobId || ''),
    previewUrl: String(stored.previewUrl),
    mainAssetMetadata: stored.mainAssetMetadata && typeof stored.mainAssetMetadata === 'object'
      ? stored.mainAssetMetadata
      : null,
    createdAt: Number(stored.createdAt)
  };
}

export function clearAvatarHandoff(petId) {
  if (petId) scopedStorage.removeStorageSync(getHandoffKey(petId));
}

export { HANDOFF_TTL_MS };
