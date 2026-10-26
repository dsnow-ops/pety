'use strict';

const assert = require('node:assert/strict');
const { __test } = require('../uniCloud-alipay/cloudfunctions/api_deepseek/index');

const source = __test.sanitizeMemorialPersonaInput({
  traits: ['安静', '黏人'],
  personalityNotes: ['嘴上不理人，但我洗澡时总会守在门口'],
  speechStyle: '短句，慢一点',
  commonPhrases: ['我来啦'],
  responseHabits: ['叫他时会先抬头看我一下，但不过来'],
  habits: ['喜欢睡在窗边'],
  allowedActions: ['轻轻靠近'],
  favoritePlaces: ['最喜欢待在沙发靠背上'],
  homecomingBehavior: '我回家时会走到门口等着',
  sleepHabits: ['睡觉时习惯蜷成一团'],
  foodRituals: ['听见零食袋的声音就会跑过来'],
  signatureActions: ['想喝水时会先看我，再看水碗'],
  memories: ['第一次回家的晚上'],
  coreTruth: '不喜欢被抱太久。',
  privatePhrase: '回家啦，小朋友。',
  allowPrivatePhraseInChat: false,
  forbiddenPhrases: ['不要说我真的回来了'],
  forbiddenClaims: ['不能声称看见主人']
}, true);

const parsed = __test.extractJsonObject(JSON.stringify({
  traitIndexes: [1, 0],
  habitIndexes: [0],
  actionIndexes: [0],
  memoryIndexes: [0],
  boundaryIndexes: [1, 0],
  portraitIndexes: [0, 1, 2, 3, 4, 5, 6]
}));
const summary = __test.sanitizePersonaSummary(parsed, source);
assert.deepEqual(summary.traits, ['黏人', '安静']);
assert.deepEqual(summary.habits, ['喜欢睡在窗边']);
assert.deepEqual(summary.memories, ['第一次回家的晚上']);
assert.deepEqual(summary.boundaries, ['不能声称看见主人', '不要说我真的回来了']);
assert.equal(summary.expression, '短句，慢一点；熟悉表达：我来啦');
assert.ok(summary.portrait.length >= 80 && summary.portrait.length <= 180);
assert.match(summary.portrait, /嘴上不理人/);
assert.doesNotMatch(summary.portrait, /天堂|守护|灵魂|仍然存在/);
assert.equal(
  summary.portrait.split('。').filter(Boolean).every(item => source.portraitSources.includes(item)),
  true,
  'every portrait fact must be an exact grounded source item'
);

assert.throws(
  () => __test.extractJsonObject('```json\n{"traitIndexes":[]}\n```'),
  /PERSONA_JSON_INVALID/
);
assert.throws(
  () => __test.sanitizePersonaSummary({ ...parsed, invented: [] }, source),
  /PERSONA_SCHEMA_INVALID/
);
assert.throws(
  () => __test.sanitizePersonaSummary({ ...parsed, memoryIndexes: [9] }, source),
  /PERSONA_SCHEMA_INVALID/
);
assert.throws(
  () => __test.sanitizePersonaSummary({ ...parsed, portraitIndexes: [99] }, source),
  /PERSONA_SCHEMA_INVALID/
);

assert.equal(source.privatePhrase, '回家啦，小朋友。');
assert.equal(source.allowPrivatePhraseInChat, false);
assert.equal(source.portraitSources.includes(source.coreTruth), true);
assert.equal(source.portraitSources.includes(source.privatePhrase), false);
assert.equal(__test.buildGroundedPersonaPortrait([], source.portraitSources), '');

assert.equal(__test.sanitizeMemorialPersonaChatContext({ speechStyle: 'a'.repeat(4000) }) !== null, true);
assert.equal(__test.sanitizeMemorialPersonaChatContext(null), null);
assert.equal(__test.sanitizeMemorialPersonaChatContext({ privatePhrase: '只属于我们', allowPrivatePhraseInChat: false }).privatePhrase, '');
assert.equal(__test.sanitizeMemorialPersonaChatContext({ privatePhrase: '只属于我们', allowPrivatePhraseInChat: true }).privatePhrase, '只属于我们');

console.log('api-deepseek persona builder tests passed');
