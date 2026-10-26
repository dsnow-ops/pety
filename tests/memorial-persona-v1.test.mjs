import assert from 'node:assert/strict';

const storage = new Map();
const storageReads = [];
globalThis.uni = {
  getStorageSync(key) {
    storageReads.push(key);
    return storage.get(key);
  },
  setStorageSync(key, value) {
    storage.set(key, value);
  },
  removeStorageSync(key) {
    storage.delete(key);
  }
};

const {
  buildMemorialPersonaChatContext,
  buildMemorialPersonaRequestInput,
  claimMemorialPersonaIntro,
  createEmptyMemorialPersona,
  getMemorialPersona,
  getMemorialPersonaDetailStats,
  getMemorialPersonaEditorState,
  getMemorialPersonaEntry,
  getMemorialPersonaKey,
  getMemorialPersonaPortrait,
  getMemorialPersonaState,
  MEMORIAL_PERSONA_STATES,
  saveMemorialPersona,
  shouldShowMemorialPersonaIntro
} = await import('../common/memorial-persona.js');
const { buildConfirmedMemorialPersonaContext } = await import('../common/chat-context-builder.js');
const { removePet } = await import('../common/pet-store.js');

saveMemorialPersona('pet-a', {
  completed: true,
  introShown: true,
  traits: ['安静'],
  habits: ['喜欢睡在窗边'],
  memories: ['第一次回家的晚上'],
  speechStyle: '短句，慢一点'
});
saveMemorialPersona('pet-b', {
  completed: false,
  introShown: false,
  traits: ['活泼'],
  commonPhrases: ['我来啦']
});

assert.equal(getMemorialPersonaState({}), MEMORIAL_PERSONA_STATES.EMPTY);
assert.equal(getMemorialPersonaState({ traits: ['活泼'] }), MEMORIAL_PERSONA_STATES.DRAFT);
assert.equal(
  getMemorialPersonaState({ completed: true, traits: ['安静'], contentRevision: 1, aiSummaryRevision: 1 }),
  MEMORIAL_PERSONA_STATES.COMPLETED
);

const emptyV3 = createEmptyMemorialPersona();
assert.equal(emptyV3.version, 3);
assert.deepEqual(emptyV3.petNicknames, []);
assert.deepEqual(emptyV3.personalityNotes, []);
assert.deepEqual(emptyV3.emotionalBehaviors, { happy: [], upset: [], seekingComfort: [] });
assert.equal(emptyV3.coreTruth, '');
assert.equal(emptyV3.privatePhrase, '');
assert.equal(emptyV3.allowPrivatePhraseInChat, false);

const legacyCompleted = getMemorialPersona('pet-a');
assert.equal(legacyCompleted.completed, true);
assert.equal(getMemorialPersonaState(legacyCompleted), MEMORIAL_PERSONA_STATES.COMPLETED);
assert.deepEqual(legacyCompleted.signatureActions, []);
assert.equal(
  getMemorialPersonaState({ completed: true, traits: ['安静'], contentRevision: 2, aiSummaryRevision: 1 }),
  MEMORIAL_PERSONA_STATES.DIRTY_COMPLETED
);
assert.equal(
  getMemorialPersonaState({ completed: true, traits: ['安静'], contentRevision: 2, aiSummaryRevision: 0 }),
  MEMORIAL_PERSONA_STATES.DIRTY_COMPLETED
);

assert.notEqual(getMemorialPersonaKey('pet-a'), getMemorialPersonaKey('pet-b'));
assert.deepEqual(getMemorialPersona('pet-a').traits, ['安静']);
assert.deepEqual(getMemorialPersona('pet-b').traits, ['活泼']);
assert.equal(shouldShowMemorialPersonaIntro('pet-a', 'deceased'), false);
assert.equal(shouldShowMemorialPersonaIntro('pet-b', 'current'), false);
assert.equal(shouldShowMemorialPersonaIntro('pet-b', 'deceased'), true);
assert.equal(claimMemorialPersonaIntro('pet-b', 'deceased'), true);
assert.equal(claimMemorialPersonaIntro('pet-b', 'deceased'), false);
assert.equal(getMemorialPersonaEntry('pet-a').view, 'overview');
assert.equal(getMemorialPersonaEntry('pet-b').view, 'edit');
assert.equal(getMemorialPersonaEntry('pet-a', { view: 'edit', step: 4 }).step, 4);

const petAContext = buildMemorialPersonaChatContext(getMemorialPersona('pet-a'));
assert.ok(petAContext);
assert.deepEqual(petAContext.traits, ['安静']);
storageReads.length = 0;
assert.equal(buildConfirmedMemorialPersonaContext('pet-a', 'current'), null);
assert.equal(storageReads.includes(getMemorialPersonaKey('pet-a')), false);
assert.deepEqual(buildConfirmedMemorialPersonaContext('pet-a', 'deceased').traits, ['安静']);
assert.equal(buildConfirmedMemorialPersonaContext('pet-b', 'deceased'), null);

const richPersona = saveMemorialPersona('pet-rich', {
  completed: true,
  contentRevision: 2,
  aiSummaryRevision: 1,
  traits: ['独立', '安静'],
  personalityNotes: ['嘴上不理人，但洗澡时总守在门口'],
  responseHabits: ['叫他时会先抬头看一眼'],
  habits: ['每天睡在床尾'],
  favoritePlaces: ['窗台'],
  signatureActions: ['想喝水时先看我，再看水碗'],
  memories: ['下雨天一起坐在窗边'],
  coreTruth: '他不喜欢被抱太久。',
  privatePhrase: '回家啦，小朋友。',
  allowPrivatePhraseInChat: false,
  forbiddenClaims: ['不要说他仍然真实存在']
});
assert.equal(getMemorialPersonaState(richPersona), MEMORIAL_PERSONA_STATES.DIRTY_COMPLETED);
assert.equal(getMemorialPersonaPortrait(richPersona).source, 'grounded_fallback');
assert.match(getMemorialPersonaPortrait(richPersona).text, /洗澡时总守在门口/);
assert.deepEqual(getMemorialPersonaDetailStats(richPersona), {
  detailCount: 9,
  memoryCount: 1,
  habitCount: 3
});
const privateOffContext = buildMemorialPersonaChatContext(richPersona);
assert.equal(privateOffContext.privatePhrase, '');
assert.equal(privateOffContext.coreTruth, '他不喜欢被抱太久。');
assert.deepEqual(privateOffContext.signatureActions, ['想喝水时先看我，再看水碗']);
const privateOnContext = buildMemorialPersonaChatContext({
  ...richPersona,
  allowPrivatePhraseInChat: true
});
assert.equal(privateOnContext.privatePhrase, '回家啦，小朋友。');
assert.match(privateOnContext.privatePhraseUsage, /低优先级/);
assert.equal(Object.prototype.hasOwnProperty.call(privateOnContext, 'portrait'), false);
assert.equal(Object.prototype.hasOwnProperty.call(privateOnContext, 'aiPortrait'), false);
assert.equal(buildMemorialPersonaRequestInput(richPersona).coreTruth, '他不喜欢被抱太久。');

storageReads.length = 0;
assert.equal(buildConfirmedMemorialPersonaContext('pet-rich', 'current'), null);
assert.equal(storageReads.includes(getMemorialPersonaKey('pet-rich')), false);

const petAEditor = getMemorialPersonaEditorState('pet-a');
const petBEditor = getMemorialPersonaEditorState('pet-b');
assert.equal(petAEditor.habitsText, '喜欢睡在窗边');
assert.equal(petBEditor.habitsText, '');
assert.equal(petBEditor.commonPhrasesText, '我来啦');

storage.set('my_pets_list', [
  { id: 'pet-a', name: '花花', relationshipStage: 'deceased' },
  { id: 'pet-b', name: '酱酱', relationshipStage: 'deceased' }
]);
storage.set('current_active_pet_id', 'pet-a');
removePet('pet-a');
assert.equal(storage.has(getMemorialPersonaKey('pet-a')), false);
assert.equal(storage.has(getMemorialPersonaKey('pet-b')), true);
assert.deepEqual(getMemorialPersona('pet-b').traits, ['活泼']);

console.log('memorial-persona-v1 tests passed');
