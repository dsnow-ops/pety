'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

global.uniCloud = { database() { return { collection() { return {}; } }; } };
const avatarModule = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/index.js');
const avatar = avatarModule.__test;
const validWanConfig = {
  ...avatar.DEFAULT_CONFIG,
  apiKey: 'configured',
  workspaceId: 'configured',
  styleReferenceFileId: 'cloud://space/pet-avatar/style/reference.png',
  viapiEnabled: false,
  viapiAccessKeyId: '',
  viapiAccessKeySecret: '',
  devMemberBypass: false
};
assert.equal(avatar.validateWanConfig(validWanConfig, { requireStyleReference: true }), true);
assert.equal(avatar.validateViapiConfig(validWanConfig), false);
assert.deepEqual(avatar.getAvatarActionConfigCheck('createJob', validWanConfig), {
  action: 'createJob', wanConfigured: true, workspaceConfigured: true,
  styleReferenceConfigured: true, viapiEnabled: false, viapiConfigured: false, devBypassEnabled: false
});

const startupProbe = `
const Module=require('module');const original=Module._load;
Module._load=function(request){if(request==='pngjs'||request==='jpeg-js'){const error=new Error('missing optional revision decoder');error.code='MODULE_NOT_FOUND';throw error;}return original.apply(this,arguments)};
global.uniCloud={database(){return{collection(){return{}}}}};
require(${JSON.stringify(path.join(root, 'uniCloud-alipay/cloudfunctions/api_pet_avatar/index.js'))});
`;
const startupResult = spawnSync(process.execPath, ['-e', startupProbe], { encoding: 'utf8' });
assert.equal(startupResult.status, 0, startupResult.stderr || startupResult.stdout);

const { buildAvatarPrompt } = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/avatar-prompt.js');
const basePrompt = buildAvatarPrompt(1);
assert.equal(basePrompt.length, 1705);
assert.equal(crypto.createHash('sha256').update(basePrompt).digest('hex'), 'd4bc2b10df557435b9386d9b015cde348b9a4ff9da90d80f06dc08b40fa3a378');

const cutout = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/avatar-cutout-provider.js');
const deepseek = require('../uniCloud-alipay/cloudfunctions/api_deepseek/index.js').__test;
const linksOnly = deepseek.normalizeSimilarCaseResponse({
  output: [{ type: 'web_search_call', action: { sources: [{ url: 'https://example.com/pet-case' }] } }]
}, 'zh-Hans');
assert.equal(linksOnly.webSearchExecuted, true);
assert.equal(linksOnly.links.length, 0, 'a tool request source hint cannot manufacture a grounded case');
assert.equal(linksOnly.result.cases.length, 0);
assert.equal(linksOnly.result.state, 'NO_RESULTS');
const unexecuted = deepseek.normalizeSimilarCaseResponse(require('../uniCloud-alipay/cloudfunctions/api_deepseek/care-search').nativeSearchResponse({
  output: [{ type: 'web_search_call', action: { sources: [{ url: 'https://example.com/pet-case' }] } }]
}), 'zh-Hans');
assert.equal(unexecuted.webSearchExecuted, false, 'the production native adapter needs a matching tool result, not a request hint');
assert.equal(unexecuted.result.cases.length, 0);
assert.equal(unexecuted.result.state, 'NO_RESULTS');

const deepseekSource = read('uniCloud-alipay/cloudfunctions/api_deepseek/index.js');
assert.match(deepseekSource, /const finalStatus = 'SUCCEEDED';/);
assert.doesNotMatch(deepseekSource, /const finalStatus =[\s\S]{0,240}'SUCCEEDED_PARTIAL'/);

const avatarSource = read('uniCloud-alipay/cloudfunctions/api_pet_avatar/index.js');
assert.match(avatarSource, /if \(!semanticCutoutAvailable\)[\s\S]*!config\.heroChromaEnabled[\s\S]*cutoutStatus: 'NOT_CONFIGURED'/);
assert.match(avatarSource, /jobs\.doc\(candidate\._id\)\.update\(\{ cutoutStatus: 'NOT_CONFIGURED'/);
const confirmSource = avatarSource.slice(avatarSource.indexOf('async function confirmAvatar'), avatarSource.indexOf('async function buildAvatarAssetResponse'));
assert.ok(confirmSource.indexOf('selected.confirmed === true') < confirmSource.indexOf("selected.status !== 'SUCCEEDED' || !selected.generatedFileId"), 'idempotent replay must work after cleanup clears the temporary candidate file');
assert.match(confirmSource, /buildAvatarAssetResponse\(selected, selectedJobId\)/, 'idempotent replay restores derivative asset fields');

const chatSource = read('pages/chat/chat.vue');
assert.match(chatSource, /v-else-if="hasSimilarCaseResult\(msg\)"/);
assert.match(chatSource, /v-else-if="msg\.similarCaseState === 'FAILED'"/);
assert.ok(chatSource.indexOf('hasSimilarCaseResult(msg)') < chatSource.indexOf("msg.similarCaseState === 'FAILED'"));
assert.match(chatSource, /openExternalUrl\(url,/);
assert.doesNotMatch(chatSource, /uni\.openURL\(/);

function loadExternalLink(context) {
  let source = read('common/external-link.js')
    .replace(/export function /g, 'function ')
    .replace(/export \{ normalizeExternalHttpsUrl \};?/, '')
    .concat('\nmodule.exports={openExternalUrl,normalizeExternalHttpsUrl};');
  const sandbox = { module: { exports: {} }, exports: {}, URL, ...context };
  vm.runInNewContext(source, sandbox);
  return sandbox.module.exports;
}

let openedUrl = '';
let openedWeb = '';
let copiedUrl = '';
const link = loadExternalLink({
  plus: { runtime: {
    openURL(url) { openedUrl = url; },
    openWeb(url) { openedWeb = url; }
  } },
  uni: { setClipboardData({ data }) { copiedUrl = data; }, showToast() {} }
});
assert.equal(link.normalizeExternalHttpsUrl('https://example.com/a'), 'https://example.com/a');
assert.equal(link.normalizeExternalHttpsUrl('https://example.com/a?token=secret'), '');
assert.equal(link.normalizeExternalHttpsUrl('https://example.com/a?signature=secret'), '');
for (const unsafe of ['http://example.com', 'javascript:alert(1)', 'file:///tmp/a', 'data:text/plain,a', 'intent://open', 'https://user:pass@example.com/a', 'https:///missing-host']) {
  assert.equal(link.normalizeExternalHttpsUrl(unsafe), '');
}
assert.equal(link.openExternalUrl('https://example.com/a'), true);
assert.equal(openedUrl, 'https://example.com/a');
assert.equal(copiedUrl, '');

const fallbackLink = loadExternalLink({
  plus: { runtime: {
    openURL(url, onError) { onError(new Error('open failed')); },
    openWeb(url) { openedWeb = url; }
  } },
  uni: { setClipboardData({ data }) { copiedUrl = data; }, showToast() {} }
});
openedWeb = '';
assert.equal(fallbackLink.openExternalUrl('https://example.com/fallback'), true);
assert.equal(openedWeb, 'https://example.com/fallback');

Promise.resolve(cutout.submitTransparentCutout(validWanConfig, 'https://example.com/final.png')).then(result => {
  assert.equal(result.status, 'NOT_CONFIGURED');
  console.log('P0 recovery V1 tests passed');
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
