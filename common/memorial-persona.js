const STORAGE_PREFIX = 'memorial_persona_';
const PERSONA_VERSION = 1;
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
    relation: {
      ownerRelationKey: '',
      ownerRelationCustom: '',
      ownerCall: ''
    },
    traits: [],
    temperament: '',
    speechStyle: '',
    commonPhrases: [],
    forbiddenPhrases: [],
    habits: [],
    allowedActions: [],
    memories: [],
    forbiddenClaims: [],
    responsePreferences: '',
    aiSummary: null,
    aiSummaryVersion: 0
  };
}

export function normalizeMemorialPersona(raw = {}) {
  const empty = createEmptyMemorialPersona();
  const relation = raw.relation && typeof raw.relation === 'object' ? raw.relation : {};
  const summary = raw.aiSummary && typeof raw.aiSummary === 'object'
    ? {
        traits: compactList(raw.aiSummary.traits, 10, 30),
        expression: compactText(raw.aiSummary.expression, MAX_TEXT),
        habits: compactList(raw.aiSummary.habits, 10, 80),
        allowedActions: compactList(raw.aiSummary.allowedActions, 10, 50),
        memories: compactList(raw.aiSummary.memories, 5, 160),
        boundaries: compactList(raw.aiSummary.boundaries, 12, 100)
      }
    : null;

  return {
    ...empty,
    version: PERSONA_VERSION,
    completed: Boolean(raw.completed),
    introShown: Boolean(raw.introShown),
    updatedAt: Number(raw.updatedAt) || 0,
    relation: {
      ownerRelationKey: compactText(relation.ownerRelationKey, 24),
      ownerRelationCustom: compactText(relation.ownerRelationCustom, 20),
      ownerCall: compactText(relation.ownerCall, 20)
    },
    traits: compactList(raw.traits, 12, 30),
    temperament: compactText(raw.temperament, MAX_TEXT),
    speechStyle: compactText(raw.speechStyle, MAX_LONG_TEXT),
    commonPhrases: compactList(raw.commonPhrases, 10, 60),
    forbiddenPhrases: compactList(raw.forbiddenPhrases, 12, 60),
    habits: compactList(raw.habits, 12, 100),
    allowedActions: compactList(raw.allowedActions, 10, 50),
    memories: compactList(raw.memories, 5, 180),
    forbiddenClaims: compactList(raw.forbiddenClaims, 12, 100),
    responsePreferences: compactText(raw.responsePreferences, MAX_TEXT),
    aiSummary: summary,
    aiSummaryVersion: summary ? (Number(raw.aiSummaryVersion) || 1) : 0
  };
}

export function getMemorialPersonaKey(petId) {
  return petId ? `${STORAGE_PREFIX}${petId}` : '';
}

export function getMemorialPersona(petId) {
  if (!petId) return createEmptyMemorialPersona();
  const value = uni.getStorageSync(getMemorialPersonaKey(petId));
  return normalizeMemorialPersona(value && typeof value === 'object' ? value : {});
}

export function saveMemorialPersona(petId, persona) {
  if (!petId) return null;
  const normalized = normalizeMemorialPersona({
    ...persona,
    updatedAt: Date.now()
  });
  uni.setStorageSync(getMemorialPersonaKey(petId), normalized);
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

export function buildMemorialPersonaRequestInput(persona) {
  const normalized = normalizeMemorialPersona(persona);
  return {
    relation: normalized.relation,
    traits: normalized.traits,
    temperament: normalized.temperament,
    speechStyle: normalized.speechStyle,
    commonPhrases: normalized.commonPhrases,
    forbiddenPhrases: normalized.forbiddenPhrases,
    habits: normalized.habits,
    allowedActions: normalized.allowedActions,
    memories: normalized.memories,
    forbiddenClaims: normalized.forbiddenClaims,
    responsePreferences: normalized.responsePreferences
  };
}

export function buildMemorialPersonaChatContext(persona) {
  const normalized = normalizeMemorialPersona(persona);
  if (!normalized.completed) return null;
  const summary = normalized.aiSummary || {};
  const context = {
    relation: {
      ownerRelationKey: normalized.relation.ownerRelationKey,
      ownerCall: compactText(normalized.relation.ownerCall || normalized.relation.ownerRelationCustom, 20)
    },
    traits: compactList(summary.traits && summary.traits.length ? summary.traits : normalized.traits, 5, 20),
    speechStyle: compactText(summary.expression || normalized.speechStyle, 140),
    commonPhrases: compactList(normalized.commonPhrases, 3, 36),
    habits: compactList(summary.habits && summary.habits.length ? summary.habits : normalized.habits, 4, 60),
    allowedActions: compactList(summary.allowedActions && summary.allowedActions.length ? summary.allowedActions : normalized.allowedActions, 4, 40),
    memories: compactList(summary.memories && summary.memories.length ? summary.memories : normalized.memories, 3, 100),
    forbiddenPhrases: compactList(normalized.forbiddenPhrases, 5, 40),
    forbiddenClaims: compactList(normalized.forbiddenClaims, 5, 60),
    responsePreferences: compactText(normalized.responsePreferences, 100)
  };

  const shrinkOrder = [
    'memories', 'forbiddenClaims', 'habits', 'forbiddenPhrases',
    'commonPhrases', 'allowedActions', 'traits'
  ];
  let shrinkIndex = 0;
  while (JSON.stringify(context).length > MAX_CHAT_CONTEXT_CHARS && shrinkIndex < 80) {
    const field = shrinkOrder[shrinkIndex % shrinkOrder.length];
    if (context[field].length > 1) context[field].pop();
    else if (context.speechStyle.length > 80) context.speechStyle = context.speechStyle.slice(0, -20);
    else if (context.responsePreferences.length > 60) context.responsePreferences = context.responsePreferences.slice(0, -20);
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
    commonPhrasesText: persona.commonPhrases.join('\n'),
    forbiddenPhrasesText: persona.forbiddenPhrases.join('\n'),
    habitsText: persona.habits.join('\n'),
    memoriesText: persona.memories.join('\n'),
    forbiddenClaimsText: persona.forbiddenClaims.join('\n')
  };
}

export { MAX_CHAT_CONTEXT_CHARS };
