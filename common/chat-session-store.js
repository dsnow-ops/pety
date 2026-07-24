const CHAT_HISTORY_PREFIX = 'chat_history_';
const LEGACY_BACKUP_PREFIX = 'chat_history_legacy_';
const MIGRATION_MARKER_PREFIX = 'chat_history_stage_migrated_';
const SESSION_STAGES = ['current', 'deceased', 'future'];

function normalizePetId(petId) {
  return String(petId || '').trim();
}

export function normalizeChatSessionStage(stage) {
  return SESSION_STAGES.includes(stage) ? stage : 'current';
}

export function getChatSessionKey(petId, stage) {
  const normalizedPetId = normalizePetId(petId);
  return normalizedPetId
    ? `${CHAT_HISTORY_PREFIX}${normalizedPetId}_${normalizeChatSessionStage(stage)}`
    : '';
}

export function getChatContextId(petId, stage) {
  const normalizedPetId = normalizePetId(petId);
  return normalizedPetId
    ? `${normalizedPetId}:${normalizeChatSessionStage(stage)}`
    : '';
}

function getLegacyChatSessionKey(petId) {
  const normalizedPetId = normalizePetId(petId);
  return normalizedPetId ? `${CHAT_HISTORY_PREFIX}${normalizedPetId}` : '';
}

function getLegacyBackupKey(petId) {
  const normalizedPetId = normalizePetId(petId);
  return normalizedPetId ? `${LEGACY_BACKUP_PREFIX}${normalizedPetId}` : '';
}

function getMigrationMarkerKey(petId) {
  const normalizedPetId = normalizePetId(petId);
  return normalizedPetId ? `${MIGRATION_MARKER_PREFIX}${normalizedPetId}` : '';
}

function getExplicitMessageStage(message) {
  if (!message || typeof message !== 'object') return '';
  const stage = message.relationshipStage || message.stage;
  return SESSION_STAGES.includes(stage) ? stage : '';
}

function inferReplySource(message, type) {
  if (type === 'user') return 'user';
  if (message.replySource) return message.replySource;
  if (`${message.id}` === '0') return 'greeting';
  if (message.isError) return 'error';
  if (message.isFallback || message.guardRejected) return 'fallback';
  return 'model';
}

export function normalizeChatMessage(message, context = {}) {
  if (!message || typeof message !== 'object') return null;

  const type = message.type === 'assistant' ? 'ai' : message.type;
  if (!['user', 'ai'].includes(type)) return null;

  const petId = normalizePetId(context.petId || message.petId);
  if (!petId) return null;
  if (message.petId && normalizePetId(message.petId) !== petId) return null;

  const contextStage = normalizeChatSessionStage(context.relationshipStage);
  const explicitStage = getExplicitMessageStage(message);
  if (explicitStage && explicitStage !== contextStage) return null;

  const content = String(message.content || '').trim();
  const imageUrl = String(message.imageUrl || '').trim();
  if (!content && !imageUrl) return null;

  const createdAt = Number(message.createdAt) || Date.now();
  return {
    ...message,
    id: String(message.id || `${createdAt}_${type}`),
    petId,
    relationshipStage: contextStage,
    type,
    content,
    imageUrl,
    createdAt,
    deliveryState: message.deliveryState || (type === 'user' && contextStage === 'deceased' ? 'read' : ''),
    replySource: inferReplySource(message, type)
  };
}

function mergeMessages(existing, incoming) {
  const merged = [];
  const seen = new Set();

  existing.concat(incoming).forEach(message => {
    const identity = `${message.id}:${message.createdAt}:${message.type}:${message.content}`;
    if (seen.has(identity)) return;
    seen.add(identity);
    merged.push(message);
  });

  return merged.sort((left, right) => left.createdAt - right.createdAt);
}

function migrateLegacyChatHistory(petId) {
  const markerKey = getMigrationMarkerKey(petId);
  if (!markerKey || uni.getStorageSync(markerKey)) return;

  const legacyKey = getLegacyChatSessionKey(petId);
  const legacyHistory = legacyKey ? uni.getStorageSync(legacyKey) : null;
  if (!Array.isArray(legacyHistory) || !legacyHistory.length) {
    uni.setStorageSync(markerKey, {
      migratedAt: Date.now(),
      strategy: 'no_legacy_history'
    });
    return;
  }

  const backupKey = getLegacyBackupKey(petId);
  if (backupKey && !uni.getStorageSync(backupKey)) {
    uni.setStorageSync(backupKey, legacyHistory);
  }

  const migratedCounts = {
    current: 0,
    deceased: 0,
    future: 0,
    unassigned: 0
  };

  SESSION_STAGES.forEach(stage => {
    const context = { petId, relationshipStage: stage };
    const stagedMessages = legacyHistory
      .filter(message => getExplicitMessageStage(message) === stage)
      .map(message => normalizeChatMessage(message, context))
      .filter(Boolean);

    if (!stagedMessages.length) return;

    const sessionKey = getChatSessionKey(petId, stage);
    const existing = uni.getStorageSync(sessionKey);
    const existingMessages = Array.isArray(existing)
      ? existing.map(message => normalizeChatMessage(message, context)).filter(Boolean)
      : [];
    const merged = mergeMessages(existingMessages, stagedMessages);
    uni.setStorageSync(sessionKey, merged);
    migratedCounts[stage] = stagedMessages.length;
  });

  migratedCounts.unassigned = legacyHistory.filter(message => !getExplicitMessageStage(message)).length;
  uni.setStorageSync(markerKey, {
    migratedAt: Date.now(),
    strategy: 'explicit_stage_only',
    counts: migratedCounts
  });
}

export function loadChatSession(petId, stage) {
  const normalizedPetId = normalizePetId(petId);
  if (!normalizedPetId) return [];

  migrateLegacyChatHistory(normalizedPetId);

  const relationshipStage = normalizeChatSessionStage(stage);
  const sessionKey = getChatSessionKey(normalizedPetId, relationshipStage);
  const stored = uni.getStorageSync(sessionKey);
  if (!Array.isArray(stored)) return [];

  return stored
    .map(message => normalizeChatMessage(message, {
      petId: normalizedPetId,
      relationshipStage
    }))
    .filter(Boolean);
}

export function saveChatSession(petId, stage, messages) {
  const normalizedPetId = normalizePetId(petId);
  if (!normalizedPetId) return [];

  const relationshipStage = normalizeChatSessionStage(stage);
  const normalizedMessages = Array.isArray(messages)
    ? messages
      .map(message => normalizeChatMessage(message, {
        petId: normalizedPetId,
        relationshipStage
      }))
      .filter(Boolean)
    : [];

  uni.setStorageSync(
    getChatSessionKey(normalizedPetId, relationshipStage),
    normalizedMessages
  );
  return normalizedMessages;
}

export function clearChatSession(petId, stage) {
  const key = getChatSessionKey(petId, stage);
  if (key) uni.removeStorageSync(key);
}
