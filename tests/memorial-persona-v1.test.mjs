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
  claimMemorialPersonaIntro,
  getMemorialPersona,
  getMemorialPersonaEditorState,
  getMemorialPersonaKey,
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

assert.notEqual(getMemorialPersonaKey('pet-a'), getMemorialPersonaKey('pet-b'));
assert.deepEqual(getMemorialPersona('pet-a').traits, ['安静']);
assert.deepEqual(getMemorialPersona('pet-b').traits, ['活泼']);
assert.equal(shouldShowMemorialPersonaIntro('pet-a', 'deceased'), false);
assert.equal(shouldShowMemorialPersonaIntro('pet-b', 'current'), false);
assert.equal(shouldShowMemorialPersonaIntro('pet-b', 'deceased'), true);
assert.equal(claimMemorialPersonaIntro('pet-b', 'deceased'), true);
assert.equal(claimMemorialPersonaIntro('pet-b', 'deceased'), false);

const petAContext = buildMemorialPersonaChatContext(getMemorialPersona('pet-a'));
assert.ok(petAContext);
assert.deepEqual(petAContext.traits, ['安静']);
storageReads.length = 0;
assert.equal(buildConfirmedMemorialPersonaContext('pet-a', 'current'), null);
assert.equal(storageReads.includes(getMemorialPersonaKey('pet-a')), false);
assert.deepEqual(buildConfirmedMemorialPersonaContext('pet-a', 'deceased').traits, ['安静']);
assert.equal(buildConfirmedMemorialPersonaContext('pet-b', 'deceased'), null);

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
