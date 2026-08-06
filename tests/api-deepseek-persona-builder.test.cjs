'use strict';

const assert = require('node:assert/strict');
const { __test } = require('../uniCloud-alipay/cloudfunctions/api_deepseek/index');

const source = __test.sanitizeMemorialPersonaInput({
  traits: ['安静', '黏人'],
  speechStyle: '短句，慢一点',
  commonPhrases: ['我来啦'],
  habits: ['喜欢睡在窗边'],
  allowedActions: ['轻轻靠近'],
  memories: ['第一次回家的晚上'],
  forbiddenPhrases: ['不要说我真的回来了'],
  forbiddenClaims: ['不能声称看见主人']
}, true);

const parsed = __test.extractJsonObject(JSON.stringify({
  traitIndexes: [1, 0],
  habitIndexes: [0],
  actionIndexes: [0],
  memoryIndexes: [0],
  boundaryIndexes: [1, 0]
}));
const summary = __test.sanitizePersonaSummary(parsed, source);
assert.deepEqual(summary.traits, ['黏人', '安静']);
assert.deepEqual(summary.habits, ['喜欢睡在窗边']);
assert.deepEqual(summary.memories, ['第一次回家的晚上']);
assert.deepEqual(summary.boundaries, ['不能声称看见主人', '不要说我真的回来了']);
assert.equal(summary.expression, '短句，慢一点；熟悉表达：我来啦');

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

assert.equal(__test.sanitizeMemorialPersonaChatContext({ speechStyle: 'a'.repeat(4000) }) !== null, true);
assert.equal(__test.sanitizeMemorialPersonaChatContext(null), null);

console.log('api-deepseek persona builder tests passed');
