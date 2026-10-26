'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

global.uniCloud = { database() { return { collection() { return {}; } }; } };
const root = path.resolve(__dirname, '..');
const deepseek = require('../uniCloud-alipay/cloudfunctions/api_deepseek/index.js').__test;

const fixture = {
  output: [
    { type: 'reasoning', summary: [] },
    { type: 'web_search_call', action: { sources: [{ url: 'https://vet.example/case-a' }, { url: 'javascript:alert(1)' }] } },
    { type: 'message', content: [{ type: 'output_text', text: '{"summary":"公开案例摘要。","cases":[{"title":"案例","source":"兽医网页","summary":"相似表现。","sourceUrl":"https://vet.example/case-a"}]}', annotations: [{ type: 'url_citation', url: 'https://vet.example/case-a' }] }] }
  ]
};
const extracted = deepseek.extractResponseOutput(fixture);
assert.deepEqual(extracted.outputItemTypes, ['reasoning', 'web_search_call', 'message']);
assert.equal(extracted.webSearchExecuted, true);
assert.match(extracted.text, /公开案例摘要/);
const urls = deepseek.collectTrustedCitationUrls(extracted.annotations, extracted.webSearchItems);
assert.deepEqual(urls, ['https://vet.example/case-a']);
assert.deepEqual(deepseek.collectTrustedCitationUrls([], [{ type: 'web_search_call', action: {
  query: { url: 'https://unverified.example/not-a-citation' },
  sources: [{ url: 'https://vet.example/verified' }]
} }]), ['https://vet.example/verified']);
assert.deepEqual(deepseek.collectTrustedCitationUrls([{ type: 'metadata', url: 'https://unverified.example/annotation' }], []), []);
assert.equal(deepseek.normalizeHttpsUrl('http://unsafe.example'), '');
assert.equal(deepseek.normalizeHttpsUrl('file:///tmp/a'), '');
assert.equal(deepseek.normalizeHttpsUrl('data:text/plain,x'), '');
assert.equal(deepseek.normalizeHttpsUrl('https:///missing-host'), '');

const safe = deepseek.normalizeSimilarCaseResponse(fixture, 'zh-Hans').result;
assert.equal(safe.state, 'NO_RESULTS', 'model-written case text and unverified domains are excluded');
assert.equal(safe.cases.length, 0);
const unlinkedNormalized = deepseek.normalizeSimilarCaseResponse({ output: [{
  type: 'message', content: [{ type: 'output_text', text: '{"summary":"Found context","cases":[{"summary":"An unlinked public account"}]}' }]
}] }, 'en');
assert.equal(unlinkedNormalized.result.state, 'NO_RESULTS', 'unverified model stories must never be presented as cases');
const untrustedHints = deepseek.normalizeSimilarCaseResponse({ output: [
  { type: 'web_search_call', action: { query: { url: 'https://unverified.example/query' }, sources: [] } },
  { type: 'message', content: [{ type: 'output_text', text: '', annotations: [{ type: 'metadata', url: 'https://unverified.example/annotation' }] }] }
] }, 'en');
assert.equal(untrustedHints.result.state, 'NO_RESULTS');
assert.equal(untrustedHints.result.cases.length, 0);

const linksOnlyFixture = {
  output: [
    { type: 'web_search_call', action: { sources: [
      { title: '兽医科普 A', url: 'https://www.vet.cornell.edu/case-a', snippet: '相似症状的公开资料。' },
      { title: '兽医科普 B', url: 'https://vcahospitals.com/case-b' }
    ] } },
    { type: 'message', content: [{ type: 'output_text', text: '' }] }
  ]
};
const linksOnly = deepseek.normalizeSimilarCaseResponse(linksOnlyFixture, 'zh-Hans');
assert.equal(linksOnly.diagnostics.webSearchExecuted, true);
assert.equal(linksOnly.webSearchExecuted, true);
assert.equal(linksOnly.diagnostics.linkCount, 2);
assert.equal(linksOnly.diagnostics.parseFallbackUsed, true);
assert.equal(linksOnly.result.state, 'FOUND_WITH_LINKS');
assert.equal(linksOnly.result.cases.length, 2);
assert.equal(linksOnly.result.cases[0].sourceUrl, 'https://www.vet.cornell.edu/case-a');

const source = fs.readFileSync(path.join(root, 'uniCloud-alipay/cloudfunctions/api_deepseek/index.js'), 'utf8');
assert.match(source, /buildSearchRequest\(config, query, responseLanguage\)/);
assert.match(source, /model: 'deepseek-v4-flash'/);
const searchRequest=require('../uniCloud-alipay/cloudfunctions/api_deepseek/care-search').buildSearchRequest({deepseek:{baseUrl:'https://api.deepseek.com'}},'猫皮肤发红');
assert.equal(searchRequest.endpoint,'https://api.deepseek.com/anthropic/v1/messages');
assert.equal(searchRequest.payload.tools[0].type,'web_search_20250305');
assert.equal(searchRequest.payload.tools[0].max_uses,1);
assert.equal(searchRequest.payload.tool_choice.name,'web_search');
assert.match(source, /similarCaseSearchTimeoutMs: 90000/);
assert.match(source, /timeout: config\.deepseek\.similarCaseSearchTimeoutMs/);
assert.match(source, /DEEPSEEK_WEB_SEARCH_TIMEOUT/);
assert.match(source, /WEB_SEARCH_NOT_EXECUTED/);
assert.match(source, /relationshipStage \|\| ''\) !== 'current'/);
assert.match(source, /\['current', 'deceased'\]\.includes\(stage\)/);
assert.doesNotMatch(source, /return 'future'/);
assert.match(source, /SIMILAR_CASE_RATE_LIMIT_AUTHORIZATION_FAILED/);
assert.match(source, /statusBeforeSave: 'RUNNING'/);
assert.match(source, /finalStatus: persistedJob && persistedJob\.status \|\| finalStatus/);
assert.match(source, /status: job\.status[\s\S]*status: 'TIMEOUT'/, 'timeout writes are guarded by the previously read status');

console.log('DeepSeek web search V2 tests passed');
