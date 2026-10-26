const assert = require('node:assert/strict');

global.uniCloud = { database() { return { collection() { return {}; } }; } };
const { __test } = require('../uniCloud-alipay/cloudfunctions/api_deepseek/index.js');

assert.equal(__test.normalizeResponseLanguage('en'), 'en');
assert.equal(__test.normalizeResponseLanguage('fr'), 'zh-Hans');

const sources = __test.sanitizeReflectionSources([
  { id: 'm1', content: '今天翻到你的照片，我很想你。' },
  { id: 'm2', content: '我记得以前一起散步的小事。' }
]);
const grounded = __test.sanitizeReflectionModelResult({
  tags: ['photo', 'longing', 'dream'],
  sourceIndexes: [0, 1]
}, sources);
assert.deepEqual(grounded.tags, ['photo', 'longing']);
assert.equal(grounded.sourceChatIds.length, 2);
assert.ok(!grounded.tags.includes('dream'));

const cases = __test.normalizeSimilarCaseResponse({output:[{
  type:'message',content:[{type:'output_text',text:JSON.stringify({summary:'summary',cases:[{title:'title',source:'source',summary:'text',sourceUrl:'https://invented.example'}]})}]
}]}, 'en').result;
assert.equal(cases.cases.length, 0, 'invented unlinked stories must be removed entirely');
console.log('AI i18n and reflection V1 tests passed');
