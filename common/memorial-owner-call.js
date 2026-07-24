import { getActivePet, updateActivePet } from './pet-store.js';

const OWNER_CALL_PROMPT_KEY_PREFIX = 'memorial_owner_call_prompt_seen_';

export const MEMORIAL_OWNER_CALL_OPTIONS = Object.freeze([
  { key: 'mother', label: '妈妈', value: '妈妈' },
  { key: 'father', label: '爸爸', value: '爸爸' },
  { key: 'sister', label: '姐姐', value: '姐姐' },
  { key: 'brother', label: '哥哥', value: '哥哥' },
  { key: 'owner', label: '主人', value: '主人' },
  { key: 'name', label: '名字', value: '' },
  { key: 'custom', label: '自定义', value: '' },
  { key: 'unset', label: '暂不设置', value: '' }
]);

export function getMemorialOwnerCallPromptKey(petId) {
  return `${OWNER_CALL_PROMPT_KEY_PREFIX}${petId || 'unknown'}`;
}

export function hasSeenMemorialOwnerCallPrompt(petId) {
  return Boolean(uni.getStorageSync(getMemorialOwnerCallPromptKey(petId)));
}

export function markMemorialOwnerCallPromptSeen(petId) {
  uni.setStorageSync(getMemorialOwnerCallPromptKey(petId), true);
}

export function getMemorialOwnerCallDraft(pet = {}) {
  const ownerCallType = String(pet.ownerCallType || '');
  const ownerPreferredCall = String(pet.ownerPreferredCall || '');
  const knownOption = MEMORIAL_OWNER_CALL_OPTIONS.find(option => option.key === ownerCallType);

  if (knownOption) {
    return {
      selectedType: knownOption.key,
      customValue: ['name', 'custom'].includes(knownOption.key) ? ownerPreferredCall : ''
    };
  }

  return {
    selectedType: ownerPreferredCall ? 'custom' : '',
    customValue: ownerPreferredCall
  };
}

export function resolveMemorialOwnerCall(selectedType, customValue = '') {
  const option = MEMORIAL_OWNER_CALL_OPTIONS.find(item => item.key === selectedType);
  if (!option) {
    return { ok: false, error: '请先选择一个称呼' };
  }

  if (option.key === 'unset') {
    return {
      ok: true,
      value: '',
      patch: {
        ownerPreferredCall: '',
        ownerCallType: ''
      }
    };
  }

  const value = option.value || String(customValue || '').replace(/\s+/g, ' ').trim();
  if (!value) {
    return {
      ok: false,
      error: option.key === 'name' ? '请输入名字或昵称' : '请输入自定义称呼'
    };
  }

  return {
    ok: true,
    value: value.slice(0, 20),
    patch: {
      ownerPreferredCall: value.slice(0, 20),
      ownerCallType: option.key
    }
  };
}

export function saveMemorialOwnerCall(petId, selectedType, customValue = '') {
  const resolved = resolveMemorialOwnerCall(selectedType, customValue);
  if (!resolved.ok) return resolved;

  const activePet = getActivePet();
  if (!activePet || String(activePet.id || '') !== String(petId || '')) {
    return { ok: false, error: '当前宠物已切换，请重新打开设置' };
  }

  const pet = updateActivePet(resolved.patch);
  if (!pet || String(pet.id || '') !== String(petId || '')) {
    return { ok: false, error: '称呼保存失败，请稍后再试' };
  }

  markMemorialOwnerCallPromptSeen(petId);
  return {
    ...resolved,
    pet
  };
}
