import { getPetRelationshipStage } from './relationship-config.js';

const PET_LIST_KEY = 'my_pets_list';
const ACTIVE_PET_ID_KEY = 'current_active_pet_id';
const MEMBERSHIP_PLAN_KEY = 'pety_membership_plan';
const DEFAULT_PET_PHOTO = '/static/pet.png';

function createPetId() {
  return `pet_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeMode(mode) {
  return mode === 'simple' ? 'simple' : '2.5d';
}

function normalizeStatus(status) {
  return ['current', 'deceased', 'future'].includes(status) ? status : 'current';
}

function readArray(key) {
  const value = uni.getStorageSync(key);
  return Array.isArray(value) ? value : [];
}

function normalizePet(rawPet = {}) {
  const now = Date.now();
  const photo = rawPet.photo || rawPet.avatar || rawPet.petPhoto || DEFAULT_PET_PHOTO;
  const createdAt = rawPet.createdAt || now;
  const relationshipStage = getPetRelationshipStage(rawPet);

  return {
    id: rawPet.id || createPetId(),
    name: rawPet.name || rawPet.petName || '毛孩子',
    avatar: photo,
    photo,
    mode: normalizeMode(rawPet.mode || rawPet.petMode),
    relationshipStage,
    status: normalizeStatus(relationshipStage),
    createdAt,
    updatedAt: rawPet.updatedAt || createdAt
  };
}

function readLegacyPet() {
  const name = uni.getStorageSync('pet_name');
  const photo = uni.getStorageSync('pet_photo');
  const mode = uni.getStorageSync('pet_mode');

  if (!name && !photo && !mode) return null;

  return normalizePet({
    name,
    photo,
    mode,
    status: 'current'
  });
}

function writeLegacyCache(pet) {
  if (!pet) return;
  uni.setStorageSync('pet_name', pet.name);
  uni.setStorageSync('pet_photo', pet.photo);
  uni.setStorageSync('pet_mode', pet.mode);
}

function clearLegacyCache() {
  uni.removeStorageSync('pet_name');
  uni.removeStorageSync('pet_photo');
  uni.removeStorageSync('pet_mode');
}

function removePetData(petId) {
  uni.removeStorageSync(`pet_diaries_${petId}`);
  uni.removeStorageSync(`chat_history_${petId}`);
  uni.removeStorageSync(`pet_profile_${petId}`);
  uni.removeStorageSync(`consultation_records_${petId}`);
}

export function isPlusMember() {
  return uni.getStorageSync(MEMBERSHIP_PLAN_KEY) === 'plus';
}

export function setMembershipPlan(plan) {
  const normalizedPlan = plan === 'plus' ? 'plus' : 'free';
  uni.setStorageSync(MEMBERSHIP_PLAN_KEY, normalizedPlan);
  return normalizedPlan;
}

export function getPetLimit() {
  return isPlusMember() ? Number.POSITIVE_INFINITY : 1;
}

export function canCreatePet() {
  return getPetList().length < getPetLimit();
}

export function getPetList() {
  const storedPets = readArray(PET_LIST_KEY);
  let pets = storedPets.map(normalizePet);

  if (!pets.length) {
    const legacyPet = readLegacyPet();
    if (legacyPet) {
      pets = [legacyPet];
    }
  }

  uni.setStorageSync(PET_LIST_KEY, pets);

  const activePetId = uni.getStorageSync(ACTIVE_PET_ID_KEY);
  if (pets.length && !pets.some(pet => pet.id === activePetId)) {
    uni.setStorageSync(ACTIVE_PET_ID_KEY, pets[0].id);
    writeLegacyCache(pets[0]);
  }

  return pets;
}

export function getActivePet() {
  const pets = getPetList();
  if (!pets.length) return null;

  const activePetId = uni.getStorageSync(ACTIVE_PET_ID_KEY);
  const activePet = pets.find(pet => pet.id === activePetId) || pets[0];

  uni.setStorageSync(ACTIVE_PET_ID_KEY, activePet.id);
  writeLegacyCache(activePet);

  return activePet;
}

export function setActivePet(petId) {
  const pets = getPetList();
  const activePet = pets.find(pet => pet.id === petId);

  if (!activePet) return null;

  uni.setStorageSync(ACTIVE_PET_ID_KEY, activePet.id);
  writeLegacyCache(activePet);

  return activePet;
}

export function addPet(petData) {
  const pets = getPetList();
  const now = Date.now();
  const pet = normalizePet({
    ...petData,
    id: petData.id || createPetId(),
    createdAt: now,
    updatedAt: now
  });

  const nextPets = pets.concat(pet);
  uni.setStorageSync(PET_LIST_KEY, nextPets);
  uni.setStorageSync(ACTIVE_PET_ID_KEY, pet.id);
  writeLegacyCache(pet);

  return pet;
}

export function removePet(petId) {
  const pets = getPetList();
  const removedPet = pets.find(pet => pet.id === petId);
  if (!removedPet) return null;

  const activePetId = uni.getStorageSync(ACTIVE_PET_ID_KEY);
  const nextPets = pets.filter(pet => pet.id !== petId);
  uni.setStorageSync(PET_LIST_KEY, nextPets);
  removePetData(petId);

  if (!nextPets.length) {
    uni.removeStorageSync(ACTIVE_PET_ID_KEY);
    clearLegacyCache();
    return {
      removedPet,
      activePet: null
    };
  }

  const nextActivePet = activePetId === petId
    ? nextPets[0]
    : (nextPets.find(pet => pet.id === activePetId) || nextPets[0]);

  uni.setStorageSync(ACTIVE_PET_ID_KEY, nextActivePet.id);
  writeLegacyCache(nextActivePet);

  return {
    removedPet,
    activePet: nextActivePet
  };
}

export function updatePet(petId, patch) {
  const pets = getPetList();
  let updatedPet = null;

  const nextPets = pets.map(pet => {
    if (pet.id !== petId) return pet;

    updatedPet = normalizePet({
      ...pet,
      ...patch,
      id: pet.id,
      createdAt: pet.createdAt,
      updatedAt: Date.now()
    });
    return updatedPet;
  });

  if (!updatedPet) return null;

  uni.setStorageSync(PET_LIST_KEY, nextPets);
  writeLegacyCache(updatedPet);

  return updatedPet;
}

export function updateActivePet(patch) {
  const activePet = getActivePet();
  if (!activePet) return null;
  return updatePet(activePet.id, patch);
}
