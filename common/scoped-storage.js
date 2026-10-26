import { getAccountScope } from './auth-store.js';

// Keep existing guest keys in place: login does not import, move or delete them.
// Explicitly exclude auth credentials, device preferences and the shared file index.
const EXACT_KEYS = new Set(['my_pets_list', 'current_active_pet_id', 'pety_membership_plan',
  'pet_name', 'pet_photo', 'pet_mode', 'pety_app_palette_v1', 'pety_stage_palettes_v3',
  'pety_ai_data_consent_v1', 'pending_chat_prompt', 'guizhua_onboarding_seen',
  'guizhua_onboarding_pending', 'product_feedback_draft_v1', 'pety_hero_render_receipt', 'pety_guest_import_v1', 'pety_creative_media_gc_v1']);
const PREFIXES = ['pet_diaries_', 'chat_history_', 'pet_profile_', 'consultation_records_',
  'care_photo_', 'pending_care_photo_',
  'memorial_persona_', 'memorial_owner_call_prompt_seen_', 'pety_avatar_handoff_',
  'pet_avatar_job_', 'pet_avatar_session_', 'memorial_reflection_'];
const scopeError = code => Object.assign(new Error(code), { code });

export function captureDataScope() { return getAccountScope(); }
export function isDataScopeCurrent(scope) {
  const current = getAccountScope();
  return Boolean(scope?.ready && current.ready && scope.namespace === current.namespace && scope.version === current.version);
}
export function assertDataScope(scope) {
  if (!isDataScopeCurrent(scope)) throw scopeError('DATA_SCOPE_CHANGED');
}

export function createScopedStorage(storage, readScope = getAccountScope) {
  const validKey = key => typeof key === 'string' && !key.includes('..') && (EXACT_KEYS.has(key) || PREFIXES.some(prefix => key.startsWith(prefix)));
  const prefixFor = scope => scope.namespace === 'guest:local' ? '' : `pety_owner_v1:${encodeURIComponent(scope.namespace)}:`;
  const journalKey = scope => prefixFor(scope) + '__local_transaction_v1';
  const copy = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const present = value => value !== undefined && value !== '' && value !== null;
  function physicalKeys() {
    const info = storage.getStorageInfoSync?.();
    if (!info || !Array.isArray(info.keys) || info.keys.some(key => typeof key !== 'string')) throw scopeError('DATA_STORAGE_INFO_INVALID');
    return info.keys;
  }
  function keyFor(key, lease) {
    if (!validKey(key)) throw scopeError('DATA_KEY_NOT_ALLOWED');
    const current = readScope();
    if (!current.ready) throw scopeError('DATA_SCOPE_UNRESOLVED');
    if (lease && (current.namespace !== lease.namespace || current.version !== lease.version || !lease.ready)) throw scopeError('DATA_SCOPE_CHANGED');
    return current.namespace === 'guest:local' ? key : `pety_owner_v1:${encodeURIComponent(current.namespace)}:${key}`;
  }
  // A crashed local batch is rolled back before ANY business key is exposed.
  // The journal belongs to one account, contains no transport/auth credentials,
  // and restores only an explicit allowlist. No cloud or filesystem operations.
  function recover(scope) {
    const journal = storage.getStorageSync(journalKey(scope));
    if (!present(journal)) return;
    if (journal.version !== 1 || journal.namespace !== scope.namespace ||
        !['prepared', 'committed'].includes(journal.state) || !Array.isArray(journal.entries) ||
        !journal.entries.every(entry => validKey(entry.key) && typeof entry.present === 'boolean')) {
      throw scopeError('DATA_RECOVERY_REQUIRED');
    }
    if (journal.state === 'prepared') {
      for (const entry of journal.entries) {
        const key = prefixFor(scope) + entry.key;
        if (entry.present) storage.setStorageSync(key, copy(entry.value));
        else storage.removeStorageSync(key);
      }
    }
    storage.removeStorageSync(journalKey(scope));
  }
  function readyKey(key, lease) {
    const resolved = keyFor(key, lease);
    recover(readScope());
    // Recovery can invoke platform callbacks; do not use a stale resolved key.
    if (resolved !== keyFor(key, lease)) throw scopeError('DATA_SCOPE_CHANGED');
    return resolved;
  }
  function atomicBatch(scope, writes) {
    keyFor('my_pets_list', scope);
    if (!(scope.namespace === 'guest:local' || scope.namespace.startsWith('account:')) || !Array.isArray(writes) || !writes.length ||
        new Set(writes.map(w => w.key)).size !== writes.length || !writes.every(w => validKey(w.key))) throw scopeError('DATA_BATCH_INVALID');
    recover(scope);
    const existingKeys = new Set(physicalKeys());
    const entries = writes.map(write => {
      const physicalKey = keyFor(write.key, scope);
      const exists = existingKeys.has(physicalKey);
      const value = exists ? copy(storage.getStorageSync(physicalKey)) : undefined;
      if (exists && value === undefined) throw scopeError('DATA_STORAGE_VALUE_INVALID');
      return { key: write.key, present: exists, ...(exists ? { value } : {}) };
    });
    const journal = { version: 1, namespace: scope.namespace, state: 'prepared', entries };
    // Snapshot the entire plan before the first write; caller object mutations
    // cannot change the transaction halfway through.
    const plan = copy(writes);
    storage.setStorageSync(journalKey(scope), journal);
    try {
      for (const write of plan) {
        const key = keyFor(write.key, scope);
        if (write.remove) storage.removeStorageSync(key);
        else storage.setStorageSync(key, write.value);
      }
      keyFor('my_pets_list', scope);
      storage.setStorageSync(journalKey(scope), { ...journal, state: 'committed' });
    } catch (error) {
      // A platform write may finish and then throw. Persisted commit is truth.
      const saved = storage.getStorageSync(journalKey(scope));
      if (saved?.state !== 'committed') {
        try { recover(scope); } catch (_) { throw scopeError('DATA_RECOVERY_REQUIRED'); }
        throw error;
      }
    }
    // Cleanup failure after commit is safe: next read removes the committed log.
    try { recover(scope); } catch (_) { /* Persisted commit remains authoritative. */ }
  }
  const bind = lease => Object.freeze({
    getStorageInfoSync: () => {
      readyKey('my_pets_list', lease);
      const prefix = prefixFor(readScope());
      return { keys: physicalKeys().filter(key => key.startsWith(prefix) && validKey(key.slice(prefix.length))).map(key => key.slice(prefix.length)) };
    },
    getStorageSync: key => storage.getStorageSync(readyKey(key, lease)),
    setStorageSync: (key, value) => storage.setStorageSync(readyKey(key, lease), value),
    removeStorageSync: key => storage.removeStorageSync(readyKey(key, lease))
  });
  return Object.freeze({ ...bind(null), atomicBatch, forScope: scope => bind(Object.freeze({ ...scope })) });
}

// Lazy platform access keeps module import side-effect free in App/bootstrap/tests.
export const scopedStorage = createScopedStorage({
  getStorageInfoSync: () => uni.getStorageInfoSync(),
  getStorageSync: key => uni.getStorageSync(key),
  setStorageSync: (key, value) => uni.setStorageSync(key, value),
  removeStorageSync: key => uni.removeStorageSync(key)
});
