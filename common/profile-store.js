import { scopedStorage } from './scoped-storage.js';
const SPECIES_LABELS = {
  cat: '猫',
  dog: '狗',
  rabbit: '兔',
  bird: '鸟',
  other: '其他'
};

const GENDER_LABELS = {
  male: '男孩',
  female: '女孩',
  unknown: '未知'
};

const NEUTERED_LABELS = {
  yes: '已绝育',
  no: '未绝育',
  unknown: '未知'
};

function getProfileKey(petId) {
  return `pet_profile_${petId}`;
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeProfile(rawProfile = {}) {
  const species = SPECIES_LABELS[rawProfile.species] ? rawProfile.species : 'cat';
  const gender = GENDER_LABELS[rawProfile.gender] ? rawProfile.gender : 'unknown';
  const neutered = NEUTERED_LABELS[rawProfile.neutered] ? rawProfile.neutered : 'unknown';

  return {
    species,
    breed: normalizeText(rawProfile.breed),
    gender,
    birthday: normalizeText(rawProfile.birthday),
    weight: normalizeText(rawProfile.weight),
    neutered,
    vaccineDate: normalizeText(rawProfile.vaccineDate),
    dewormDate: normalizeText(rawProfile.dewormDate),
    allergies: normalizeText(rawProfile.allergies),
    chronicDiseases: normalizeText(rawProfile.chronicDiseases),
    diet: normalizeText(rawProfile.diet),
    medicines: normalizeText(rawProfile.medicines),
    temperament: normalizeText(rawProfile.temperament),
    note: normalizeText(rawProfile.note),
    updatedAt: rawProfile.updatedAt || 0
  };
}

function assertProfileShape(value) {
  const invalid = () => { throw Object.assign(new Error('PET_PROFILE_INVALID'), { code: 'PET_PROFILE_INVALID' }); };
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  for (const key of ['breed','birthday','weight','vaccineDate','dewormDate','allergies','chronicDiseases','diet','medicines','temperament','note']) {
    if (value[key] != null && typeof value[key] !== 'string') invalid();
  }
  for (const [key, choices] of [['species',SPECIES_LABELS],['gender',GENDER_LABELS],['neutered',NEUTERED_LABELS]]) {
    if (value[key] != null && value[key] !== '' && !Object.prototype.hasOwnProperty.call(choices,value[key])) invalid();
  }
  if (value.updatedAt != null && (!Number.isSafeInteger(value.updatedAt) || value.updatedAt < 0)) invalid();
}

function readProfileRaw(petId, strict) {
  const value = scopedStorage.getStorageSync(getProfileKey(petId));
  if (value === '' || value === undefined || value === null) return {};
  if (strict) assertProfileShape(value);
  return value && typeof value === 'object' ? value : {};
}

export function getPetProfile(petId, { strict = false } = {}) {
  if (!petId) return normalizeProfile();
  return normalizeProfile(readProfileRaw(petId, strict));
}

export function savePetProfile(petId, profile, { expected } = {}) {
  if (!petId) return null;
  const current = readProfileRaw(petId, true);
  assertProfileShape(profile);
  if (expected && JSON.stringify(normalizeProfile(current)) !== JSON.stringify(normalizeProfile(expected))) {
    throw Object.assign(new Error('PET_PROFILE_CHANGED'), { code: 'PET_PROFILE_CHANGED' });
  }
  const normalizedProfile = normalizeProfile({
    ...profile,
    updatedAt: Date.now()
  });
  scopedStorage.setStorageSync(getProfileKey(petId), { ...current, ...normalizedProfile });
  return normalizedProfile;
}

export function getSpeciesLabel(species) {
  return SPECIES_LABELS[species] || species || '待补充';
}

export function getGenderLabel(gender) {
  return GENDER_LABELS[gender] || gender || '待补充';
}

export function getNeuteredLabel(neutered) {
  return NEUTERED_LABELS[neutered] || neutered || '待补充';
}

export function getProfileCompletion(profile) {
  const normalizedProfile = normalizeProfile(profile);
  const fields = [
    normalizedProfile.species,
    normalizedProfile.breed,
    normalizedProfile.gender !== 'unknown' ? normalizedProfile.gender : '',
    normalizedProfile.birthday,
    normalizedProfile.weight,
    normalizedProfile.neutered !== 'unknown' ? normalizedProfile.neutered : '',
    normalizedProfile.vaccineDate,
    normalizedProfile.dewormDate,
    normalizedProfile.diet,
    normalizedProfile.temperament
  ];
  const filledCount = fields.filter(Boolean).length;
  return Math.round((filledCount / fields.length) * 100);
}

export function formatPetAge(birthday) {
  if (!birthday) return '待补充';
  const birthDate = new Date(`${birthday}T00:00:00`);
  if (Number.isNaN(birthDate.getTime())) return '待补充';

  const now = new Date();
  let months = (now.getFullYear() - birthDate.getFullYear()) * 12 + now.getMonth() - birthDate.getMonth();
  if (now.getDate() < birthDate.getDate()) months -= 1;
  if (months < 0) return '待补充';
  if (months < 12) return `${months || 1}个月`;

  const years = Math.floor(months / 12);
  const restMonths = months % 12;
  return restMonths ? `${years}岁${restMonths}个月` : `${years}岁`;
}

function compactText(value, maxLength) {
  const text = normalizeText(value).replace(/\s+/g, ' ');
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(maxLength - 1, 0))}…`;
}

export function buildProfileContext(pet, profile, options = {}) {
  const maxChars = Number.isFinite(options.maxChars) ? options.maxChars : 260;
  if (!pet) return '';
  if (maxChars <= 0) return '';

  const normalizedProfile = normalizeProfile(profile);
  const lines = [
    `姓名:${pet.name || '未命名'}`,
    `物种:${getSpeciesLabel(normalizedProfile.species)}`,
    normalizedProfile.breed ? `品种:${normalizedProfile.breed}` : '',
    normalizedProfile.gender !== 'unknown' ? `性别:${getGenderLabel(normalizedProfile.gender)}` : '',
    normalizedProfile.birthday ? `生日:${normalizedProfile.birthday}，年龄:${formatPetAge(normalizedProfile.birthday)}` : '',
    normalizedProfile.weight ? `体重:${normalizedProfile.weight}` : '',
    normalizedProfile.neutered !== 'unknown' ? `绝育:${getNeuteredLabel(normalizedProfile.neutered)}` : '',
    normalizedProfile.vaccineDate ? `最近疫苗:${normalizedProfile.vaccineDate}` : '',
    normalizedProfile.dewormDate ? `最近驱虫:${normalizedProfile.dewormDate}` : '',
    normalizedProfile.allergies ? `过敏史:${compactText(normalizedProfile.allergies, 36)}` : '',
    normalizedProfile.chronicDiseases ? `慢性病:${compactText(normalizedProfile.chronicDiseases, 36)}` : '',
    normalizedProfile.diet ? `饮食:${compactText(normalizedProfile.diet, 38)}` : '',
    normalizedProfile.medicines ? `常用药:${compactText(normalizedProfile.medicines, 36)}` : '',
    normalizedProfile.temperament ? `性格习惯:${compactText(normalizedProfile.temperament, 38)}` : ''
  ].filter(Boolean);

  if (!lines.length) return '';

  let output = '以下是当前宠物基础档案，作为问诊背景参考。\n';
  if (output.length >= maxChars) return '';
  for (const line of lines) {
    const next = `${output}${line}\n`;
    if (next.length > maxChars) break;
    output = next;
  }

  return output.trim();
}
