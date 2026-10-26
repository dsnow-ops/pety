import { createPetRemovalPlan } from './pet-removal.js';
import { scopedStorage, captureDataScope } from './scoped-storage.js';
import { subscribeAccountScope } from './auth-store.js';
import { getOwnerRelationLabel, getPetRelationshipStage, normalizeOwnerRelation } from './relationship-config.js';
import { getDefaultAvatarStyle, normalizeAvatarSource, normalizeAvatarStatus, normalizeAvatarStyle } from './pet-avatar-generator.js';
import { clearAvatarDisplayAssetCache } from './avatar-display-asset.js';

const PET_LIST_KEY = 'my_pets_list';
const ACTIVE_PET_ID_KEY = 'current_active_pet_id';
const MEMBERSHIP_PLAN_KEY = 'pety_membership_plan';
const DEFAULT_PET_PHOTO = '/static/pet.png';
const selectionListeners = new Set();
let unsubscribeAccount=null;
function ensureAccountSubscription() {
  if(unsubscribeAccount)return;
  unsubscribeAccount=subscribeAccountScope(scope=>{
    clearAvatarDisplayAssetCache();
    let pet=null;try{pet=getActivePet();}catch(_){/* Still invalidate the previous account's visible state. */}
    for(const listener of [...selectionListeners]){
      try{listener(pet?.id||'',{scopeChanged:true,scope});}catch(_){}
    }
  });
}
export function subscribePetSelection(listener) {
  ensureAccountSubscription();
  selectionListeners.add(listener);
  return () => selectionListeners.delete(listener);
}

export function notifyPetDataChanged() {
  const pet = getActivePet();
  for (const listener of [...selectionListeners]) {
    try { listener(pet?.id || '', { localImport: true }); } catch (_) { /* Committed data must survive a disposed page. */ }
  }
}

function createPetId() {
  return `pet_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeMode(mode) {
  return mode === 'simple' ? 'simple' : '2.5d';
}

function normalizeStatus(status) {
  return status === 'deceased' ? 'deceased' : 'current';
}

function normalizeOwnerGender(gender) {
  return ['female', 'male', 'unspecified'].includes(gender) ? gender : 'unspecified';
}

function resolveAvatarSource(rawPet, originalPhotoUrl, generatedAvatarUrl) {
  if (['original', 'generated', 'placeholder'].includes(rawPet.avatarSource)) {
    return normalizeAvatarSource(rawPet.avatarSource);
  }
  if (generatedAvatarUrl) return 'generated';
  if (originalPhotoUrl) return 'original';
  return 'placeholder';
}

const petStorageError = code => Object.assign(new Error(code), { code });
function assertStoredPet(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) throw petStorageError('PET_STORAGE_INVALID');
  if (row.id !== undefined && (typeof row.id !== 'string' || !row.id)) throw petStorageError('PET_STORAGE_INVALID');
  for (const key of ['name','petName','photo','avatar','avatarUrl','imageUrl','image','petImage','profileImage','petPhoto','originalPhotoUrl','generatedAvatarUrl','generatedAvatarFileId']) {
    if (row[key] != null && typeof row[key] !== 'string') throw petStorageError('PET_STORAGE_INVALID');
  }
  if (!row.id && ![row.name,row.petName,row.photo,row.avatar,row.imageUrl].some(value=>typeof value==='string'&&value)) throw petStorageError('PET_STORAGE_INVALID');
}
function selectionWrites(pet) {
  return [{key:ACTIVE_PET_ID_KEY,value:pet.id},{key:'pet_name',value:pet.name},{key:'pet_photo',value:pet.photo},{key:'pet_mode',value:pet.mode}];
}
function commitPetWrites(scope, writes) {
  const storage=scopedStorage.forScope(scope);
  const changed=writes.filter(write=>JSON.stringify(storage.getStorageSync(write.key))!==JSON.stringify(write.value));
  if(changed.length)scopedStorage.atomicBatch(scope,changed);
}
function readPetSnapshot() {
  ensureAccountSubscription();
  const scope=captureDataScope(),storage=scopedStorage.forScope(scope);
  const value=storage.getStorageSync(PET_LIST_KEY);
  const missing=value===undefined||value==='';
  if(!missing&&!Array.isArray(value))throw petStorageError('PET_STORAGE_INVALID');
  let raw=missing?[]:value;
  raw.forEach(assertStoredPet);
  const ids=raw.filter(row=>row.id).map(row=>row.id);
  if(new Set(ids).size!==ids.length)throw petStorageError('PET_STORAGE_INVALID');
  let migrate=raw.some(row=>!row.id||!row.createdAt||!row.updatedAt);
  if(missing){const legacy=readLegacyPet(storage);if(legacy){raw=[legacy];migrate=true;}}
  const pets=raw.map(row=>({...row,...normalizePet(row)}));
  if(new Set(pets.map(pet=>pet.id)).size!==pets.length)throw petStorageError('PET_STORAGE_INVALID');
  const selected=storage.getStorageSync(ACTIVE_PET_ID_KEY);
  if(selected!==undefined&&selected!==null&&selected!==''&&typeof selected!=='string')throw petStorageError('PET_STORAGE_INVALID');
  const active=pets.find(pet=>pet.id===selected)||pets[0]||null;
  // Only old records lacking stable identity/timestamps require migration.
  // Ordinary reads must work even while the device cannot accept writes.
  if(migrate)commitPetWrites(scope,[{key:PET_LIST_KEY,value:pets},...selectionWrites(active)]);
  return{scope,pets,active};
}

export function normalizePet(rawPet = {}) {
  const now = Date.now();
  const legacyPhoto = rawPet.photo ||
    rawPet.avatar ||
    rawPet.avatarUrl ||
    rawPet.imageUrl ||
    rawPet.image ||
    rawPet.petImage ||
    rawPet.profileImage ||
    rawPet.petPhoto ||
    '';
  const photo = legacyPhoto || DEFAULT_PET_PHOTO;
  const createdAt = rawPet.createdAt || now;
  const relationshipStage = getPetRelationshipStage(rawPet);
  const ownerRelation = normalizeOwnerRelation(rawPet);
  const ownerRelationLabel = getOwnerRelationLabel({
    ...rawPet,
    ...ownerRelation
  });
  const legacyOwnerPreferredCall = String(rawPet.ownerPreferredCall || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 20);
  const hasCanonicalOwnerRelation = Boolean(rawPet.ownerRelationKey);
  const ownerPreferredCall = hasCanonicalOwnerRelation
    ? ownerRelationLabel
    : (legacyOwnerPreferredCall || ownerRelationLabel);
  const originalPhotoUrl = rawPet.originalPhotoUrl ||
    (legacyPhoto && legacyPhoto !== DEFAULT_PET_PHOTO ? legacyPhoto : '');
  const generatedAvatarUrl = rawPet.generatedAvatarUrl || '';
  const generatedAvatarFileId = rawPet.generatedAvatarFileId || rawPet.generatedFileId || '';
  const generatedAvatarCutoutFileId = rawPet.generatedAvatarCutoutFileId || '';
  const generatedAvatarCutoutUrl = rawPet.generatedAvatarCutoutUrl || '';
  const generatedAvatarCutoutStatus = rawPet.generatedAvatarCutoutStatus || (generatedAvatarCutoutFileId ? 'READY' : 'NOT_CONFIGURED');
  const generatedAvatarCutoutAlphaValid = rawPet.generatedAvatarCutoutAlphaValid === true;
  const finalJobMatch = generatedAvatarFileId.match(/\/pet-avatar\/final\/[^/]+\/([^/]+)\/final\.png$/);
  const generatedAvatarCutoutJobId = rawPet.generatedAvatarCutoutJobId || (finalJobMatch && finalJobMatch[1]) || '';
  const generatedAvatarDisplayFileId = rawPet.generatedAvatarDisplayFileId || '';
  const generatedAvatarDisplayUrl = rawPet.generatedAvatarDisplayUrl || '';
  const generatedAvatarThumbnailFileId = rawPet.generatedAvatarThumbnailFileId || '';
  const generatedAvatarThumbnailUrl = rawPet.generatedAvatarThumbnailUrl || '';
  const generatedAvatarFeatheredDisplayFileId = rawPet.generatedAvatarFeatheredDisplayFileId || '';
  const generatedAvatarFeatheredDisplayUrl = rawPet.generatedAvatarFeatheredDisplayUrl || '';
  const generatedAvatarLocalCutoutFileId = rawPet.generatedAvatarLocalCutoutFileId || '';
  const generatedAvatarLocalCutoutUrl = rawPet.generatedAvatarLocalCutoutUrl || '';
  const generatedAvatarLocalCutoutAlphaValid = rawPet.generatedAvatarLocalCutoutAlphaValid === true;
  const generatedAvatarLocalCutoutMetrics = rawPet.generatedAvatarLocalCutoutMetrics && typeof rawPet.generatedAvatarLocalCutoutMetrics === 'object'
    ? rawPet.generatedAvatarLocalCutoutMetrics
    : null;
  const generatedAvatarCutoutMetrics = rawPet.generatedAvatarCutoutMetrics && typeof rawPet.generatedAvatarCutoutMetrics === 'object'
    ? rawPet.generatedAvatarCutoutMetrics
    : null;
  const generatedAvatarDisplayDimensions = rawPet.generatedAvatarDisplayDimensions && typeof rawPet.generatedAvatarDisplayDimensions === 'object'
    ? rawPet.generatedAvatarDisplayDimensions
    : null;
  const generatedAvatarMainAssetMetadata = rawPet.generatedAvatarMainAssetMetadata && typeof rawPet.generatedAvatarMainAssetMetadata === 'object'
    ? rawPet.generatedAvatarMainAssetMetadata
    : null;

  return {
    id: rawPet.id || createPetId(),
    localImportPending: rawPet.localImportPending === true,
    name: rawPet.name || rawPet.petName || '毛孩子',
    petType: ['cat', 'dog', 'other'].includes(rawPet.petType) ? rawPet.petType : 'cat',
    petTypeCustom: String(rawPet.petTypeCustom || '').trim().slice(0, 20),
    petGender: ['male', 'female', 'unknown'].includes(rawPet.petGender) ? rawPet.petGender : 'unknown',
    avatar: photo,
    photo,
    avatarUrl: rawPet.avatarUrl || '',
    imageUrl: rawPet.imageUrl || '',
    image: rawPet.image || '',
    petImage: rawPet.petImage || '',
    profileImage: rawPet.profileImage || '',
    avatarSource: resolveAvatarSource(rawPet, originalPhotoUrl, generatedAvatarUrl),
    originalPhotoUrl,
    heroDisplayMode: ["auto","ai","original"].includes(rawPet.heroDisplayMode) ? rawPet.heroDisplayMode : "auto",
    petSeal: rawPet.petSeal && typeof rawPet.petSeal === "object" ? rawPet.petSeal : null,
    generatedAvatarUrl,
    generatedAvatarFileId,
    generatedAvatarDerivedFromFileId: rawPet.generatedAvatarDerivedFromFileId || '',
    generatedAvatarHeroFileId: rawPet.generatedAvatarHeroFileId || '',
    generatedAvatarHeroMetrics: rawPet.generatedAvatarHeroMetrics || null,
    generatedAvatarHeroAssetVersion: Number(rawPet.generatedAvatarHeroAssetVersion) || 0,
    generatedAvatarHeroDisplayPreparedFor: rawPet.generatedAvatarHeroDisplayPreparedFor || '',
    generatedAvatarHeroGenerationStatus: rawPet.generatedAvatarHeroGenerationStatus || 'NOT_STARTED',
    generatedAvatarHeroGenerationVersion: rawPet.generatedAvatarHeroGenerationVersion || '',
    generatedAvatarHeroGenerationErrorCode: rawPet.generatedAvatarHeroGenerationErrorCode || '',
    generatedAvatarHeroGenerationPhase: rawPet.generatedAvatarHeroGenerationPhase || 'NOT_STARTED',
    generatedAvatarHeroGenerationRequestId: rawPet.generatedAvatarHeroGenerationRequestId || '',
    generatedAvatarHeroPromptRevision: rawPet.generatedAvatarHeroPromptRevision || '',
    generatedAvatarHeroProviderSourceMetadata: rawPet.generatedAvatarHeroProviderSourceMetadata && typeof rawPet.generatedAvatarHeroProviderSourceMetadata === 'object'
      ? rawPet.generatedAvatarHeroProviderSourceMetadata
      : null,
    generatedAvatarCutoutTightFileId: rawPet.generatedAvatarCutoutTightFileId || '',
    generatedAvatarCutoutTightMetrics: rawPet.generatedAvatarCutoutTightMetrics || null,
    generatedAvatarLocalCutoutTightFileId: rawPet.generatedAvatarLocalCutoutTightFileId || '',
    generatedAvatarLocalCutoutTightMetrics: rawPet.generatedAvatarLocalCutoutTightMetrics || null,
    generatedAvatarCutoutFileId,
    generatedAvatarCutoutUrl,
    generatedAvatarCutoutStatus,
    generatedAvatarCutoutErrorCode: rawPet.generatedAvatarCutoutErrorCode || '',
    generatedAvatarCutoutPipelineVersion: Number(rawPet.generatedAvatarCutoutPipelineVersion) || 0,
    generatedAvatarCutoutEngine: rawPet.generatedAvatarCutoutEngine || 'unknown',
    generatedAvatarSemanticCutoutAvailable: rawPet.generatedAvatarSemanticCutoutAvailable === true,
    generatedAvatarCutoutAlphaValid,
    generatedAvatarCutoutJobId,
    generatedAvatarDisplayFileId,
    generatedAvatarDisplayUrl,
    generatedAvatarThumbnailFileId,
    generatedAvatarThumbnailUrl,
    generatedAvatarFeatheredDisplayFileId,
    generatedAvatarFeatheredDisplayUrl,
    generatedAvatarLocalCutoutFileId,
    generatedAvatarLocalCutoutUrl,
    generatedAvatarLocalCutoutAlphaValid,
    generatedAvatarLocalCutoutMetrics,
    generatedAvatarCutoutMetrics,
    generatedAvatarDisplayDimensions,
    generatedAvatarMainAssetMetadata,
    generatedAvatarCleanupPending: rawPet.generatedAvatarCleanupPending === true,
    generatedAvatar: rawPet.generatedAvatar || '',
    avatarStyle: normalizeAvatarStyle(rawPet.avatarStyle || getDefaultAvatarStyle(relationshipStage), relationshipStage),
    avatarStatus: normalizeAvatarStatus(rawPet.avatarStatus || (generatedAvatarUrl ? 'ready' : 'none')),
    avatarUpdatedAt: rawPet.avatarUpdatedAt || (generatedAvatarUrl ? (rawPet.updatedAt || createdAt) : 0),
    ownerRelationKey: ownerRelation.ownerRelationKey,
    ownerRelationCustom: ownerRelation.ownerRelationCustom,
    ownerPreferredCall,
    ownerCallType: hasCanonicalOwnerRelation
      ? ownerRelation.ownerRelationKey
      : (rawPet.ownerCallType || ownerRelation.ownerRelationKey),
    ownerGender: normalizeOwnerGender(rawPet.ownerGender),
    mode: normalizeMode(rawPet.mode || rawPet.petMode),
    relationshipStage,
    status: normalizeStatus(relationshipStage),
    createdAt,
    updatedAt: rawPet.updatedAt || createdAt
  };
}

function readLegacyPet(storage=scopedStorage) {
  const name = storage.getStorageSync('pet_name');
  const photo = storage.getStorageSync('pet_photo');
  const mode = storage.getStorageSync('pet_mode');

  if([name,photo,mode].some(value=>value!=null&&typeof value!=='string'))throw petStorageError('PET_STORAGE_INVALID');

  if (!name && !photo && !mode) return null;

  return normalizePet({
    name,
    photo,
    mode,
    status: 'current'
  });
}

export function isPlusMember() {
  return scopedStorage.getStorageSync(MEMBERSHIP_PLAN_KEY) === 'plus';
}

export function setMembershipPlan(plan) {
  const normalizedPlan = plan === 'plus' ? 'plus' : 'free';
  scopedStorage.setStorageSync(MEMBERSHIP_PLAN_KEY, normalizedPlan);
  return normalizedPlan;
}

export function getPetLimit() {
  return isPlusMember() ? Number.POSITIVE_INFINITY : 1;
}

export function canCreatePet() {
  return getPetList().length < getPetLimit();
}

export function getPetList() {
  ensureAccountSubscription();
  if (!captureDataScope().ready) return [];
  return readPetSnapshot().pets;
}

export function getActivePet() {
  ensureAccountSubscription();
  if(!captureDataScope().ready)return null;
  return readPetSnapshot().active;
}

export function setActivePet(petId) {
  const {scope,pets}=readPetSnapshot();
  const activePet = pets.find(pet => pet.id === petId);

  if (!activePet) return null;

  commitPetWrites(scope,selectionWrites(activePet));
  selectionListeners.forEach(listener=>{try{listener(activePet.id);}catch(_){/* Persisted selection is authoritative. */}});

  return activePet;
}

export function addPet(petData) {
  const {scope,pets}=readPetSnapshot();
  const now = Date.now();
  const pet = normalizePet({
    ...petData,
    id: petData.id || createPetId(),
    createdAt: now,
    updatedAt: now
  });
  if(pets.some(existing=>existing.id===pet.id))throw petStorageError('PET_ID_EXISTS');
  assertStoredPet(pet);

  const nextPets = pets.concat(pet);
  commitPetWrites(scope,[{key:PET_LIST_KEY,value:nextPets},...selectionWrites(pet)]);

  return pet;
}

export function removePet(petId,{expectedPet}={}) {
  const {scope,pets,active}=readPetSnapshot();
  const removedPet=pets.find(pet=>pet.id===petId);
  if(!removedPet)return null;
  if(expectedPet&&(expectedPet.id!==petId||['name','createdAt','updatedAt'].some(key=>expectedPet[key]!==removedPet[key])))throw petStorageError('PET_DELETE_CHANGED');
  const nextPets=pets.filter(pet=>pet.id!==petId);
  const nextActivePet=nextPets.find(pet=>pet.id===active?.id)||nextPets[0]||null;
  const mediaOptions={nativeSandbox:false};
  // #ifdef APP-PLUS
  mediaOptions.nativeSandbox=true;
  // #endif
  const plan=createPetRemovalPlan(scopedStorage.forScope(scope),scope,petId,nextPets,mediaOptions);
  const selection=nextActivePet?selectionWrites(nextActivePet):[ACTIVE_PET_ID_KEY,'pet_name','pet_photo','pet_mode'].map(key=>({key,remove:true}));
  scopedStorage.atomicBatch(scope,[{key:PET_LIST_KEY,value:nextPets},...plan.writes,...selection]);
  clearAvatarDisplayAssetCache();
  selectionListeners.forEach(listener=>{try{listener(nextActivePet?.id||'',{removedPetId:petId});}catch(_){/* The committed removal must remain successful. */}});
  return{removedPet,activePet:nextActivePet};
}

export function updatePet(petId, patch) {
  const {scope,pets,active}=readPetSnapshot();
  let updatedPet = null;

  const nextPets = pets.map(pet => {
    if (pet.id !== petId) return pet;

    if (patch.generatedAvatarDerivedFromFileId && !patch.generatedAvatarFileId &&
      patch.generatedAvatarDerivedFromFileId !== pet.generatedAvatarFileId) return pet;
    let assetReset = {};
    if (Object.prototype.hasOwnProperty.call(patch, 'generatedAvatarFileId') && patch.generatedAvatarFileId !== pet.generatedAvatarFileId) {
      clearAvatarDisplayAssetCache(pet.id);
      Object.keys(pet).filter(key => /^generatedAvatar/.test(key)).forEach(key => {
        assetReset[key] = /Metrics|Metadata|Dimensions/.test(key) ? null : /Valid|Pending/.test(key) ? false : '';
      });
    }

    updatedPet = {...pet,...normalizePet({
      ...pet,
      ...assetReset,
      ...patch,
      id: pet.id,
      createdAt: pet.createdAt,
      updatedAt: Date.now()
    })};
    assertStoredPet(updatedPet);
    return updatedPet;
  });

  if (!updatedPet) return null;

  commitPetWrites(scope,[{key:PET_LIST_KEY,value:nextPets},...(active?.id===petId?selectionWrites(updatedPet):[])]);

  return updatedPet;
}

export function updateActivePet(patch) {
  const activePet = getActivePet();
  if (!activePet) return null;
  return updatePet(activePet.id, patch);
}
