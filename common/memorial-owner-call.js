import { getActivePet, updateActivePet } from './pet-store.js';
import {
  getOwnerRelationPatch,
  normalizeOwnerRelation,
  OWNER_RELATION_OPTIONS
} from './relationship-config.js';

const OWNER_CALL_PROMPT_KEY_PREFIX = 'memorial_owner_call_prompt_seen_';

// Compatibility export for existing memorial UI imports.
export const MEMORIAL_OWNER_CALL_OPTIONS = OWNER_RELATION_OPTIONS;

export function getMemorialOwnerCallPromptKey(petId) {
  return `${OWNER_CALL_PROMPT_KEY_PREFIX}${petId || 'unknown'}`;
}

export function hasSeenMemorialOwnerCallPrompt(petId) {
  return Boolean(uni.getStorageSync(getMemorialOwnerCallPromptKey(petId)));
}

export function markMemorialOwnerCallPromptSeen(petId) {
  uni.setStorageSync(getMemorialOwnerCallPromptKey(petId), true);
}

export function getOwnerRelationDraft(pet = {}) {
  const relation = normalizeOwnerRelation(pet);
  return {
    selectedType: relation.ownerRelationKey,
    customValue: relation.ownerRelationKey === 'custom' ? relation.ownerRelationCustom : ''
  };
}

export function getMemorialOwnerCallDraft(pet = {}) {
  return getOwnerRelationDraft(pet);
}

export function resolveOwnerRelation(selectedType, customValue = '') {
  const option = OWNER_RELATION_OPTIONS.find(item => item.key === selectedType);
  if (!option) {
    return { ok: false, error: '请先选择你和宝贝的关系' };
  }

  const patch = getOwnerRelationPatch(selectedType, customValue);
  if (!patch) {
    return {
      ok: false,
      error: selectedType === 'custom' ? '请输入自定义关系' : '请选择有效关系'
    };
  }

  return {
    ok: true,
    value: patch.ownerPreferredCall,
    patch
  };
}

export function resolveMemorialOwnerCall(selectedType, customValue = '') {
  return resolveOwnerRelation(selectedType, customValue);
}

export function saveOwnerRelation(petId, selectedType, customValue = '') {
  const resolved = resolveOwnerRelation(selectedType, customValue);
  if (!resolved.ok) return resolved;

  const activePet = getActivePet();
  if (!activePet || String(activePet.id || '') !== String(petId || '')) {
    return { ok: false, error: '当前宠物已切换，请重新打开设置' };
  }

  const pet = updateActivePet(resolved.patch);
  if (!pet || String(pet.id || '') !== String(petId || '')) {
    return { ok: false, error: '关系保存失败，请稍后再试' };
  }

  markMemorialOwnerCallPromptSeen(petId);
  return {
    ...resolved,
    pet
  };
}

export function saveMemorialOwnerCall(petId, selectedType, customValue = '') {
  return saveOwnerRelation(petId, selectedType, customValue);
}
