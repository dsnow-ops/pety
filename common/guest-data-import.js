import { scopedStorage, captureDataScope, assertDataScope } from './scoped-storage.js';
import { normalizePet, notifyPetDataChanged } from './pet-store.js';

const RECEIPT = 'pety_guest_import_v1';
const PETS = 'my_pets_list';
const ACTIVE = 'current_active_pet_id';
const fail = code => { throw Object.assign(new Error(code), { code }); };
const copy = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const exists = value => value !== undefined && value !== '' && value !== null;
const stable = value => JSON.stringify(value, function (_key, item) {
  if (item && typeof item === 'object' && !Array.isArray(item)) return Object.keys(item).sort().reduce((out, key) => { out[key] = item[key]; return out; }, {});
  return item;
});
const same = (a, b) => !exists(a) && !exists(b) || stable(a) === stable(b);
const petIdValid = id => typeof id === 'string' && /^[A-Za-z0-9_-]{1,160}$/.test(id);
function dataKeys(id) {
  return ['pet_diaries_', 'pet_profile_', 'consultation_records_', 'memorial_persona_', 'memorial_owner_call_prompt_seen_'].map(p => p + id);
}
function chatKeys(id) {
  return [`chat_history_${id}`, ...['current', 'deceased', 'future'].map(stage => `chat_history_${id}_${stage}`), `chat_history_legacy_${id}`, `chat_history_stage_migrated_${id}`];
}

// Reads only the legacy guest whitelist. No upload, cloud claim, quota mutation,
// file deletion, storage-wide value scan or implicit synchronization.
export function createGuestDataImport({ guest, accounts, capture, assertCurrent, normalize, notify = () => {} }) {
  function account(scope) {
    assertCurrent(scope);
    if (!scope.namespace.startsWith('account:')) fail('IMPORT_ACCOUNT_REQUIRED');
    return accounts.forScope(scope);
  }
  function petsAt(storage) {
    const value = storage.getStorageSync(PETS);
    if (!exists(value)) {
      if (storage.getStorageSync('pet_name') || storage.getStorageSync('pet_photo')) fail('IMPORT_LEGACY_PENDING');
      return [];
    }
    if (!Array.isArray(value) || value.some(p => !p || !petIdValid(p.id)) || new Set(value.map(p => p.id)).size !== value.length) fail('IMPORT_INVALID_DATA');
    return copy(value);
  }
  function reflectionKeys(id, source = guest) {
    const prefix = `memorial_reflection_suggestion_${id}_`;
    return (source.getStorageInfoSync?.().keys || []).filter(k => k.startsWith(prefix) && /^\d{4}-\d{2}-\d{2}$/.test(k.slice(prefix.length)));
  }
  function allKeys(id, target) { return [...new Set([...dataKeys(id), ...chatKeys(id), ...reflectionKeys(id), ...(target ? reflectionKeys(id, target) : [])])]; }
  function state(scope = capture()) {
    if (!scope.ready || !scope.namespace.startsWith('account:')) return { status: 'none', count: 0 };
    const store = account(scope), receipt = store.getStorageSync(RECEIPT);
    if (receipt?.status === 'imported') return { status: 'imported', count: receipt.ids.length, localOnly: true };
    const pets = petsAt(guest);
    return { status: receipt?.status === 'retained' ? 'retained' : 'pending', count: pets.length };
  }
  function retain(scope = capture()) {
    const store = account(scope);
    if (store.getStorageSync(RECEIPT)?.status === 'imported') fail('IMPORT_ALREADY_DONE');
    store.setStorageSync(RECEIPT, { version: 1, status: 'retained' });
    return state(scope);
  }
  function prepare({ includeChats = false } = {}, scope = capture()) {
    const store = account(scope);
    if (store.getStorageSync(RECEIPT)?.status === 'imported') fail('IMPORT_ALREADY_DONE');
    const source = petsAt(guest), target = petsAt(store);
    if (!source.length) fail('IMPORT_EMPTY');
    if (source.some(p => target.some(t => t.id === p.id))) fail('IMPORT_CONFLICT');
    const guestSnapshot = [{ key: PETS, value: copy(guest.getStorageSync(PETS)) }];
    const targetSnapshot = [{ key: PETS, value: copy(store.getStorageSync(PETS)) }, { key: ACTIVE, value: copy(store.getStorageSync(ACTIVE)) }, { key: RECEIPT, value: copy(store.getStorageSync(RECEIPT)) }];
    const entries = [], watched = [];
    for (const pet of source) {
      const selected = new Set([...dataKeys(pet.id), ...reflectionKeys(pet.id), ...(includeChats ? chatKeys(pet.id) : [])]);
      for (const key of allKeys(pet.id, store)) {
        const previous = copy(store.getStorageSync(key));
        if (exists(previous)) fail('IMPORT_CONFLICT');
        targetSnapshot.push({ key, value: previous });
        const value = copy(guest.getStorageSync(key));
        if (selected.has(key)) guestSnapshot.push({ key, value });
        const imported = selected.has(key) && exists(value) ? value : undefined;
        watched.push({ key, value: imported });
        if (exists(imported)) entries.push({ key, value: imported });
      }
    }
    const importedPets = source.map(p => normalize({ ...p, localImportPending: true, generatedAvatarCleanupPending: false }));
    const receipt = { version: 1, status: 'imported', ids: source.map(p => p.id), pets: importedPets, watched, includeChats: includeChats === true, previousActive: store.getStorageSync(ACTIVE) || '' };
    entries.push({ key: PETS, value: [...target, ...importedPets] });
    if (!target.some(p => p.id === receipt.previousActive)) entries.push({ key: ACTIVE, value: target[0]?.id || source[0].id });
    entries.push({ key: RECEIPT, value: receipt });
    // Stay below platform storage pressure; never partially import oversized data.
    if (JSON.stringify({ entries, targetSnapshot }).length > 1000000) fail('IMPORT_TOO_LARGE');
    return { scope: { ...scope }, count: source.length, includeChats: includeChats === true, entries, guestSnapshot, targetSnapshot };
  }
  function commit(plan) {
    const store = account(plan.scope);
    if (store.getStorageSync(RECEIPT)?.status === 'imported') return state(plan.scope);
    for (const entry of plan.guestSnapshot) if (!same(guest.getStorageSync(entry.key), entry.value)) fail('IMPORT_SOURCE_CHANGED');
    for (const entry of plan.targetSnapshot) if (!same(store.getStorageSync(entry.key), entry.value)) fail('IMPORT_TARGET_CHANGED');
    accounts.atomicBatch(plan.scope, plan.entries);
    assertCurrent(plan.scope);
    notify();
    return state(plan.scope);
  }
  function undo(scope = capture()) {
    const store = account(scope), receipt = store.getStorageSync(RECEIPT);
    if (receipt?.status !== 'imported') return state(scope);
    const pets = petsAt(store);
    for (const original of receipt.pets) {
      const current = pets.find(p => p.id === original.id);
      if (!current || !same(normalize(current), original)) fail('IMPORT_HAS_EDITS');
    }
    for (const item of receipt.watched) {
      const current = store.getStorageSync(item.key);
      // Merely reading a chat with no imported history writes this official
      // compatibility marker. It is not a new private conversation.
      const emptyReadMarker = !receipt.includeChats && !exists(item.value) &&
        item.key.startsWith('chat_history_stage_migrated_') && current?.strategy === 'no_legacy_history' &&
        Object.keys(current).every(key => ['strategy', 'migratedAt'].includes(key));
      if (!emptyReadMarker && !same(current, item.value)) fail('IMPORT_HAS_EDITS');
    }
    // New suggestions created after import must not be silently removed/hidden.
    const known = new Set(receipt.watched.map(e => e.key));
    for (const id of receipt.ids) for (const key of allKeys(id, store)) if (!known.has(key) && exists(store.getStorageSync(key))) fail('IMPORT_HAS_EDITS');
    const remaining = pets.filter(p => !receipt.ids.includes(p.id));
    const active = store.getStorageSync(ACTIVE);
    const next = remaining.find(p => p.id === active) || remaining.find(p => p.id === receipt.previousActive) || remaining[0];
    const writes = receipt.watched.map(e => ({ key: e.key, remove: true }));
    writes.push({ key: PETS, value: remaining }, { key: RECEIPT, value: { version: 1, status: 'retained' } });
    for (const [key, value] of [[ACTIVE, next?.id], ['pet_name', next?.name], ['pet_photo', next?.photo], ['pet_mode', next?.mode]]) writes.push(value ? { key, value } : { key, remove: true });
    accounts.atomicBatch(scope, writes);
    assertCurrent(scope);notify();return state(scope);
  }
  return { state, retain, prepare, commit, undo };
}

const service = createGuestDataImport({
  guest: { getStorageSync: key => uni.getStorageSync(key), getStorageInfoSync: () => uni.getStorageInfoSync() },
  accounts: scopedStorage, capture: captureDataScope, assertCurrent: assertDataScope,
  normalize: normalizePet, notify: notifyPetDataChanged
});
export const getGuestImportState = (...args) => service.state(...args);
export const retainGuestData = (...args) => service.retain(...args);
export const prepareGuestImport = (...args) => service.prepare(...args);
export const commitGuestImport = (...args) => service.commit(...args);
export const undoGuestImport = (...args) => service.undo(...args);
