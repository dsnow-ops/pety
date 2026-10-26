import { scopedStorage } from './scoped-storage.js';
const STORAGE_PREFIX = 'memorial_persona_';
const PERSONA_VERSION = 3;
const MAX_TEXT = 240;
const MAX_LONG_TEXT = 600;
const MAX_CHAT_CONTEXT_CHARS = 1800;

export const MEMORIAL_TRAIT_OPTIONS = [
  '粘人', '独立', '活泼', '安静', '胆小', '大胆', '温顺',
  '有脾气', '爱撒娇', '不太表达', '好奇', '谨慎', '直接', '傲娇'
];

export const MEMORIAL_ACTION_OPTIONS = [
  '贴近我', '轻轻蹭我', '踩奶', '摇尾巴', '趴在熟悉的位置', '在门口迎接我'
];

export const MEMORIAL_PERSONA_STATES = Object.freeze({
  EMPTY: 'EMPTY',
  DRAFT: 'DRAFT',
  COMPLETED: 'COMPLETED',
  DIRTY_COMPLETED: 'DIRTY_COMPLETED'
});

function compactText(value, maxLength = MAX_TEXT) {
  return String(value || '')
    .replace(/[\u0000-\u001f<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function compactList(value, maxItems = 12, maxItemLength = 80) {
  const source = Array.isArray(value) ? value : [];
  return source
    .map(item => compactText(item, maxItemLength))
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, maxItems);
}

export function createEmptyMemorialPersona() {
  return {
    version: PERSONA_VERSION,
    completed: false,
    introShown: false,
    updatedAt: 0,
    lastStep: 1,
    contentRevision: 0,
    aiSummaryRevision: 0,
    relation: {
      ownerRelationKey: '',
      ownerRelationCustom: '',
      ownerCall: ''
    },
    traits: [],
    temperament: '',
    petNicknames: [],
    personalityNotes: [],
    speechStyle: '',
    commonPhrases: [],
    responseHabits: [],
    emotionalBehaviors: {
      happy: [],
      upset: [],
      seekingComfort: []
    },
    signatureSoundsOrWords: [],
    forbiddenPhrases: [],
    habits: [],
    allowedActions: [],
    favoritePlaces: [],
    homecomingBehavior: '',
    sleepHabits: [],
    foodRituals: [],
    signatureActions: [],
    memories: [],
    coreTruth: '',
    privatePhrase: '',
    allowPrivatePhraseInChat: false,
    forbiddenClaims: [],
    responsePreferences: '',
    aiSummary: null,
    aiSummaryVersion: 0
  };
}

export function normalizeMemorialPersona(raw = {}) {
  const empty = createEmptyMemorialPersona();
  const relation = raw.relation && typeof raw.relation === 'object' ? raw.relation : {};
  const emotionalBehaviors = raw.emotionalBehaviors && typeof raw.emotionalBehaviors === 'object'
    ? raw.emotionalBehaviors
    : {};
  const summary = raw.aiSummary && typeof raw.aiSummary === 'object'
    ? {
        portrait: compactText(raw.aiSummary.portrait || raw.aiPortrait, 180),
        traits: compactList(raw.aiSummary.traits, 10, 30),
        expression: compactText(raw.aiSummary.expression, MAX_TEXT),
        habits: compactList(raw.aiSummary.habits, 10, 80),
        allowedActions: compactList(raw.aiSummary.allowedActions, 10, 50),
        memories: compactList(raw.aiSummary.memories, 5, 160),
        boundaries: compactList(raw.aiSummary.boundaries, 12, 100)
      }
    : null;

  const normalized = {
    ...empty,
    version: PERSONA_VERSION,
    completed: Boolean(raw.completed),
    introShown: Boolean(raw.introShown),
    updatedAt: Number(raw.updatedAt) || 0,
    lastStep: Math.max(1, Math.min(5, Number(raw.lastStep) || 1)),
    relation: {
      ownerRelationKey: relation.ownerRelationKey === 'unset' ? '' : compactText(relation.ownerRelationKey, 24),
      ownerRelationCustom: compactText(relation.ownerRelationCustom, 20),
      ownerCall: relation.ownerRelationKey === 'unset' ? '' : compactText(relation.ownerCall, 20)
    },
    traits: compactList(raw.traits, 12, 30),
    temperament: compactText(raw.temperament, MAX_TEXT),
    petNicknames: compactList(raw.petNicknames, 3, 30),
    personalityNotes: compactList(raw.personalityNotes, 3, 160),
    speechStyle: compactText(raw.speechStyle, MAX_LONG_TEXT),
    commonPhrases: compactList(raw.commonPhrases, 10, 60),
    responseHabits: compactList(raw.responseHabits, 5, 120),
    emotionalBehaviors: {
      happy: compactList(emotionalBehaviors.happy, 3, 100),
      upset: compactList(emotionalBehaviors.upset, 3, 100),
      seekingComfort: compactList(emotionalBehaviors.seekingComfort, 3, 100)
    },
    signatureSoundsOrWords: compactList(raw.signatureSoundsOrWords, 5, 60),
    forbiddenPhrases: compactList(raw.forbiddenPhrases, 12, 60),
    habits: compactList(raw.habits, 12, 100),
    allowedActions: compactList(raw.allowedActions, 10, 50),
    favoritePlaces: compactList(raw.favoritePlaces, 5, 100),
    homecomingBehavior: compactText(raw.homecomingBehavior, 180),
    sleepHabits: compactList(raw.sleepHabits, 5, 100),
    foodRituals: compactList(raw.foodRituals, 5, 100),
    signatureActions: compactList(raw.signatureActions, 5, 140),
    memories: compactList(raw.memories, 5, 180),
    coreTruth: compactText(raw.coreTruth, MAX_TEXT),
    privatePhrase: compactText(raw.privatePhrase, 100),
    allowPrivatePhraseInChat: Boolean(raw.allowPrivatePhraseInChat),
    forbiddenClaims: compactList(raw.forbiddenClaims, 12, 100),
    responsePreferences: compactText(raw.responsePreferences, MAX_TEXT),
    aiSummary: summary,
    aiSummaryVersion: summary ? (Number(raw.aiSummaryVersion) || 1) : 0
  };
  const hasContent = hasMemorialPersonaContent(normalized);
  const hasContentRevision = Object.prototype.hasOwnProperty.call(raw, 'contentRevision');
  const hasAiSummaryRevision = Object.prototype.hasOwnProperty.call(raw, 'aiSummaryRevision');
  normalized.contentRevision = Math.max(
    0,
    hasContentRevision ? (Number(raw.contentRevision) || 0) : (hasContent ? 1 : 0)
  );
  normalized.aiSummaryRevision = Math.max(
    0,
    hasAiSummaryRevision ? (Number(raw.aiSummaryRevision) || 0) : (normalized.completed ? normalized.contentRevision : 0)
  );
  return normalized;
}

export function hasMemorialPersonaContent(persona) {
  const source = persona || {};
  const relation = source.relation || {};
  return Boolean(
    relation.ownerRelationKey || relation.ownerRelationCustom || relation.ownerCall ||
    (source.traits || []).length || source.temperament || source.speechStyle ||
    (source.petNicknames || []).length || (source.personalityNotes || []).length ||
    (source.commonPhrases || []).length || (source.forbiddenPhrases || []).length ||
    (source.responseHabits || []).length || (source.signatureSoundsOrWords || []).length ||
    Object.values(source.emotionalBehaviors || {}).some(list => Array.isArray(list) && list.length) ||
    (source.habits || []).length || (source.allowedActions || []).length ||
    (source.favoritePlaces || []).length || source.homecomingBehavior ||
    (source.sleepHabits || []).length || (source.foodRituals || []).length ||
    (source.signatureActions || []).length ||
    (source.memories || []).length || (source.forbiddenClaims || []).length ||
    source.coreTruth || source.privatePhrase || source.responsePreferences
  );
}

export function getMemorialPersonaState(persona) {
  const normalized = normalizeMemorialPersona(persona);
  if (!normalized.completed) {
    return hasMemorialPersonaContent(normalized)
      ? MEMORIAL_PERSONA_STATES.DRAFT
      : MEMORIAL_PERSONA_STATES.EMPTY;
  }
  return normalized.contentRevision > normalized.aiSummaryRevision
    ? MEMORIAL_PERSONA_STATES.DIRTY_COMPLETED
    : MEMORIAL_PERSONA_STATES.COMPLETED;
}

export function getMemorialPersonaSourceSignature(persona) {
  return JSON.stringify(buildMemorialPersonaRequestInput(persona));
}

export function getMemorialPersonaKey(petId) {
  return petId ? `${STORAGE_PREFIX}${petId}` : '';
}

export function getMemorialPersona(petId) {
  if (!petId) return createEmptyMemorialPersona();
  const value = scopedStorage.getStorageSync(getMemorialPersonaKey(petId));
  return normalizeMemorialPersona(value && typeof value === 'object' ? value : {});
}

export function saveMemorialPersona(petId, persona) {
  if (!petId) return null;
  const normalized = normalizeMemorialPersona({
    ...persona,
    updatedAt: Date.now()
  });
  scopedStorage.setStorageSync(getMemorialPersonaKey(petId), normalized);
  return normalized;
}

export function markMemorialPersonaIntroSeen(petId) {
  const persona = getMemorialPersona(petId);
  return saveMemorialPersona(petId, {
    ...persona,
    introShown: true
  });
}

export function shouldShowMemorialPersonaIntro(petId, relationshipStage) {
  if (!petId || relationshipStage !== 'deceased') return false;
  const persona = getMemorialPersona(petId);
  return !persona.completed && !persona.introShown;
}

export function claimMemorialPersonaIntro(petId, relationshipStage) {
  if (!shouldShowMemorialPersonaIntro(petId, relationshipStage)) return false;
  markMemorialPersonaIntroSeen(petId);
  return true;
}

export function scheduleMemorialPersonaIntro(options = {}) {
  const petId = String(options.petId || '');
  const relationshipStage = String(options.relationshipStage || '');
  if (!petId || relationshipStage !== 'deceased') return null;
  const delay = Math.max(300, Math.min(Number(options.delay) || 400, 500));
  return setTimeout(() => {
    if (typeof options.isStillCurrent === 'function' && !options.isStillCurrent()) return;
    const pages=typeof getCurrentPages==='function'?getCurrentPages():[];
    const route=pages[pages.length-1]?.route||'';
    if(!['pages/home/home','pages/archive/archive'].includes(route))return;
    if (!claimMemorialPersonaIntro(petId, relationshipStage)) return;
    uni.showModal({
      title: '让归爪更像他/她',
      content: '告诉归爪一些真实的小习惯和说话方式。这些内容只用于让怀念对话更贴近你记得的他/她。',
      cancelText: '以后再说',
      confirmText: '开始完善',
      confirmColor: '#62677A',
      success: (result) => {
        if (result.confirm && typeof options.onStart === 'function') options.onStart(petId);
      }
    });
  }, delay);
}

export function getMemorialPersonaEntry(petId, options = {}) {
  const normalizedPetId = String(petId || '');
  if (!normalizedPetId) return null;
  const persona = getMemorialPersona(normalizedPetId);
  const state = getMemorialPersonaState(persona);
  const requestedStep = Math.max(1, Math.min(5, Number(options.step) || persona.lastStep || 1));
  const forceEdit = options.view === 'edit' || Number(options.step) > 0;
  const view = forceEdit || [MEMORIAL_PERSONA_STATES.EMPTY, MEMORIAL_PERSONA_STATES.DRAFT].includes(state)
    ? 'edit'
    : 'overview';
  return {
    petId: normalizedPetId,
    state,
    view,
    step: requestedStep,
    url: `/pages/memorial-persona/memorial-persona?petId=${encodeURIComponent(normalizedPetId)}&view=${view}&step=${requestedStep}`
  };
}

export function openMemorialPersona(petId, options = {}) {
  const entry = getMemorialPersonaEntry(petId, options);
  if (!entry) return false;
  uni.navigateTo({ url: entry.url });
  return true;
}

export function buildMemorialPersonaRequestInput(persona) {
  const normalized = normalizeMemorialPersona(persona);
  return {
    relation: normalized.relation,
    traits: normalized.traits,
    temperament: normalized.temperament,
    petNicknames: normalized.petNicknames,
    personalityNotes: normalized.personalityNotes,
    speechStyle: normalized.speechStyle,
    commonPhrases: normalized.commonPhrases,
    responseHabits: normalized.responseHabits,
    emotionalBehaviors: normalized.emotionalBehaviors,
    signatureSoundsOrWords: normalized.signatureSoundsOrWords,
    forbiddenPhrases: normalized.forbiddenPhrases,
    habits: normalized.habits,
    allowedActions: normalized.allowedActions,
    favoritePlaces: normalized.favoritePlaces,
    homecomingBehavior: normalized.homecomingBehavior,
    sleepHabits: normalized.sleepHabits,
    foodRituals: normalized.foodRituals,
    signatureActions: normalized.signatureActions,
    memories: normalized.memories,
    coreTruth: normalized.coreTruth,
    privatePhrase: normalized.privatePhrase,
    allowPrivatePhraseInChat: normalized.allowPrivatePhraseInChat,
    forbiddenClaims: normalized.forbiddenClaims,
    responsePreferences: normalized.responsePreferences
  };
}

function countList(value) {
  return Array.isArray(value) ? value.filter(Boolean).length : 0;
}

export function getMemorialPersonaDetailStats(persona) {
  const normalized = normalizeMemorialPersona(persona);
  const habitCount = [
    normalized.habits,
    normalized.favoritePlaces,
    normalized.sleepHabits,
    normalized.foodRituals,
    normalized.signatureActions
  ].reduce((total, list) => total + countList(list), 0) + (normalized.homecomingBehavior ? 1 : 0);
  const detailCount = [
    normalized.traits,
    normalized.personalityNotes,
    normalized.commonPhrases,
    normalized.responseHabits,
    normalized.habits,
    normalized.favoritePlaces,
    normalized.sleepHabits,
    normalized.foodRituals,
    normalized.signatureActions,
    normalized.memories
  ].reduce((total, list) => total + countList(list), 0) +
    Object.values(normalized.emotionalBehaviors).reduce((total, list) => total + countList(list), 0) +
    (normalized.temperament ? 1 : 0) +
    (normalized.homecomingBehavior ? 1 : 0) +
    (normalized.coreTruth ? 1 : 0);
  return {
    detailCount,
    memoryCount: normalized.memories.length,
    habitCount
  };
}

export function getMemorialPersonaPortrait(persona) {
  const normalized = normalizeMemorialPersona(persona);
  const aiPortrait = compactText(normalized.aiSummary && normalized.aiSummary.portrait, 180);
  if (aiPortrait) return { text: aiPortrait, source: 'ai' };
  const sourceItems = []
    .concat(normalized.personalityNotes)
    .concat(normalized.responseHabits)
    .concat(normalized.signatureActions)
    .concat(normalized.habits)
    .concat(normalized.coreTruth ? [normalized.coreTruth] : [])
    .concat(normalized.traits.length ? [normalized.traits.join('、')] : []);
  const text = compactText(sourceItems.slice(0, 4).join('。'), 180);
  return { text, source: text ? 'grounded_fallback' : 'empty' };
}

export function buildMemorialPersonaChatContext(persona) {
  const normalized = normalizeMemorialPersona(persona);
  if (!normalized.completed) return null;
  const summary = normalized.aiSummary || {};
  const context = {
    coreTruth: compactText(normalized.coreTruth, 180),
    relation: {
      ownerRelationKey: normalized.relation.ownerRelationKey,
      ownerCall: compactText(normalized.relation.ownerCall || normalized.relation.ownerRelationCustom, 20)
    },
    traits: compactList(summary.traits && summary.traits.length ? summary.traits : normalized.traits, 5, 20),
    speechStyle: compactText(summary.expression || normalized.speechStyle, 140),
    habits: compactList(summary.habits && summary.habits.length ? summary.habits : normalized.habits, 4, 60),
    signatureActions: compactList(normalized.signatureActions, 3, 80),
    memories: compactList(summary.memories && summary.memories.length ? summary.memories : normalized.memories, 3, 100),
    forbiddenPhrases: compactList(normalized.forbiddenPhrases, 5, 40),
    forbiddenClaims: compactList(normalized.forbiddenClaims, 5, 60),
    responsePreferences: compactText(normalized.responsePreferences, 100),
    privatePhrase: normalized.allowPrivatePhraseInChat
      ? compactText(normalized.privatePhrase, 80)
      : '',
    allowPrivatePhraseInChat: Boolean(normalized.allowPrivatePhraseInChat && normalized.privatePhrase),
    privatePhraseUsage: normalized.allowPrivatePhraseInChat && normalized.privatePhrase
      ? '仅作低优先级表达提示，极低频使用，不得主动重复。'
      : ''
  };

  const shrinkOrder = [
    'memories', 'habits', 'signatureActions', 'traits', 'forbiddenClaims', 'forbiddenPhrases'
  ];
  let shrinkIndex = 0;
  while (JSON.stringify(context).length > MAX_CHAT_CONTEXT_CHARS && shrinkIndex < 80) {
    const field = shrinkOrder[shrinkIndex % shrinkOrder.length];
    if (context[field].length > 1) context[field].pop();
    else if (context.speechStyle.length > 80) context.speechStyle = context.speechStyle.slice(0, -20);
    else if (context.responsePreferences.length > 60) context.responsePreferences = context.responsePreferences.slice(0, -20);
    else if (context.privatePhrase) {
      context.privatePhrase = '';
      context.allowPrivatePhraseInChat = false;
      context.privatePhraseUsage = '';
    }
    else break;
    shrinkIndex += 1;
  }
  return context;
}

export function getMemorialPersonaEditorState(petId) {
  const persona = getMemorialPersona(petId);
  return {
    petId: String(petId || ''),
    draft: persona,
    petNicknamesText: persona.petNicknames.join('\n'),
    personalityNotesText: persona.personalityNotes.join('\n'),
    commonPhrasesText: persona.commonPhrases.join('\n'),
    responseHabitsText: persona.responseHabits.join('\n'),
    happyBehaviorsText: persona.emotionalBehaviors.happy.join('\n'),
    upsetBehaviorsText: persona.emotionalBehaviors.upset.join('\n'),
    seekingComfortBehaviorsText: persona.emotionalBehaviors.seekingComfort.join('\n'),
    signatureSoundsOrWordsText: persona.signatureSoundsOrWords.join('\n'),
    forbiddenPhrasesText: persona.forbiddenPhrases.join('\n'),
    habitsText: persona.habits.join('\n'),
    favoritePlacesText: persona.favoritePlaces.join('\n'),
    sleepHabitsText: persona.sleepHabits.join('\n'),
    foodRitualsText: persona.foodRituals.join('\n'),
    signatureActionsText: persona.signatureActions.join('\n'),
    memoriesText: persona.memories.join('\n'),
    forbiddenClaimsText: persona.forbiddenClaims.join('\n')
  };
}

export { MAX_CHAT_CONTEXT_CHARS };
