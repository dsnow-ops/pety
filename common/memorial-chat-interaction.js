const READ_DELAY_RANGES = [
  { maxLength: 20, min: 700, max: 1600 },
  { maxLength: 80, min: 1200, max: 2500 },
  { maxLength: Infinity, min: 1800, max: 3500 }
];

const TYPING_DELAY_RANGES = [
  { maxLength: 60, min: 900, max: 1600 },
  { maxLength: 180, min: 1500, max: 2800 },
  { maxLength: Infinity, min: 2200, max: 3500 }
];

function getTextLength(message) {
  if (message && typeof message === 'object') {
    return String(message.content || '').trim().length;
  }
  return String(message || '').trim().length;
}

function createSeed(value) {
  const text = String(value || '');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function getDelayFromRanges(message, ranges, seedSuffix) {
  const length = getTextLength(message);
  const range = ranges.find(item => length <= item.maxLength) || ranges[ranges.length - 1];
  const seed = createSeed(`${String(message && message.content ? message.content : message)}:${seedSuffix}:${Date.now()}`);
  return range.min + (seed % (range.max - range.min + 1));
}

export function getReadDelay(message) {
  return Math.min(getDelayFromRanges(message, READ_DELAY_RANGES, 'read'), 4000);
}

export function getMinimumTypingDelay(message) {
  return Math.min(getDelayFromRanges(message, TYPING_DELAY_RANGES, 'typing'), 4500);
}

export function getPawType(pet = {}, profile = {}) {
  const source = [
    profile.species,
    pet.species,
    pet.petType,
    pet.animalType,
    pet.type,
    pet.breed
  ].filter(Boolean).join(' ').toLowerCase();

  if (/cat|猫/.test(source)) return 'cat';
  if (/dog|犬|狗/.test(source)) return 'dog';
  return 'default';
}

export function getTypingLabel(pet = {}) {
  return `${pet.name || pet.petName || '宝贝'} 正在输入…`;
}

export function createInteractionTiming(message, reply = '') {
  return {
    readDelay: getReadDelay(message),
    minimumTypingDelay: getMinimumTypingDelay(reply || message)
  };
}
