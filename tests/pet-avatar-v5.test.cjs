'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

global.uniCloud = { database() { return { collection() { return {}; } }; } };

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const avatar = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/index.js').__test;
const { buildAvatarPrompt } = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/avatar-prompt.js');
const { buildAvatarRevisionPrompt, parseAvatarRevisionIntent } = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/avatar-revision-prompt.js');
const { buildWanPayload } = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/wan-client.js');

const basePrompt = buildAvatarPrompt(3);
assert.equal(basePrompt.length, 1705);
assert.equal(crypto.createHash('sha256').update(basePrompt).digest('hex'), 'd4bc2b10df557435b9386d9b015cde348b9a4ff9da90d80f06dc08b40fa3a378');

assert.deepEqual(avatar.buildOrderedFileIds('revision', '', 'candidate-original', []), ['candidate-original']);
assert.deepEqual(avatar.resolveRevisionSource({ status: 'SUCCEEDED', generatedFileId: 'cloud://space/pet-avatar/output/p/job/candidate.png' }), {
  role: 'candidate_original', fileId: 'cloud://space/pet-avatar/output/p/job/candidate.png', cloudPath: 'pet-avatar/output/p/job/candidate.png'
});
assert.deepEqual(avatar.resolveRevisionSource({ status: 'SUCCEEDED', generatedFileId: '', finalFileId: 'cloud://space/pet-avatar/final/p/job/final.png' }), {
  role: 'final_original', fileId: 'cloud://space/pet-avatar/final/p/job/final.png', cloudPath: 'pet-avatar/final/p/job/final.png'
});
for (const forbidden of [
  'cloud://space/pet-avatar/final/p/job/cutout.png',
  'cloud://space/pet-avatar/preview/p/job/thumbnail.png',
  'cloud://space/pet-avatar/input/p/session/source-1.jpg'
]) {
  assert.throws(() => avatar.resolveRevisionSource({ status: 'SUCCEEDED', generatedFileId: forbidden }), error => error.code === 'REVISION_SOURCE_INVALID');
}
assert.equal(avatar.resolveRevisionSource({status:'SUCCEEDED',generatedFileId:'cloud://space/pety-private-v3/pet-avatar/output/p/job/candidate.png'}).role,'candidate_original');
assert.equal(avatar.resolveRevisionSource({status:'SUCCEEDED',finalFileId:'cloud://space/pety-private-v3/pet-avatar/final/p/job/final.png'}).role,'final_original');
for(const forbidden of ['cloud://space/arbitrary/pet-avatar/output/p/job/candidate.png','cloud://space/pety-private-v3/pet-avatar/final/p/job/cutout.png']){
 assert.throws(()=>avatar.resolveRevisionSource({status:'SUCCEEDED',generatedFileId:forbidden}),e=>e.code==='REVISION_SOURCE_INVALID');
}

const cloudSource = read('uniCloud-alipay/cloudfunctions/api_pet_avatar/index.js');
const storageSource = read('uniCloud-alipay/cloudfunctions/api_pet_avatar/storage.js');
const clientSource = read('common/pet-avatar-generator.js');
const revisionPromptSource = read('uniCloud-alipay/cloudfunctions/api_pet_avatar/avatar-revision-prompt.js');
assert.match(clientSource, /\.\.\.\(jobKind === 'revision' \? \{\} : \{ sourceFileIds \}\)/, 'client never supplies a trusted revision image');
assert.match(cloudSource, /inspectRevisionSource\(currentResultFileId\)/);
assert.match(storageSource, /MIN_REVISION_SOURCE_BYTES = 64 \* 1024/);
assert.match(storageSource, /MIN_REVISION_SOURCE_EDGE = 768/);
assert.match(storageSource, /REVISION_SOURCE_NOT_FOUND/);
assert.match(storageSource, /REVISION_SOURCE_INVALID/);
assert.match(storageSource, /reasonCode = 'REVISION_SOURCE_TOO_SMALL'/);

const regularIntent = parseAvatarRevisionIntent('脸再瘦一点');
assert.equal(regularIntent.revisionTarget, 'FACE');
assert.equal(regularIntent.identityCorrection, false);
assert.equal(avatar.normalizeRevisionBBox(regularIntent, 1), null, 'no reliable localization means no bbox_list');
const identityIntent = parseAvatarRevisionIntent('按原图修正左脚花纹');
assert.equal(identityIntent.identityCorrection, true);
assert.equal(identityIntent.revisionTarget, 'PAW');
assert.doesNotMatch(cloudSource, /providerReferenceFileIds = \[identityReference\.fileId\]/);
assert.match(buildAvatarRevisionPrompt(0, '脸再瘦一点'), /图1作为唯一主体和唯一视觉基础/);
assert.doesNotMatch(buildAvatarRevisionPrompt(1, '按原图修正左脚花纹'), /第2张/);
assert.equal(parseAvatarRevisionIntent('尾巴是白色的，没有其他颜色和花纹').actionKey, 'white');

const revisionPayload = buildWanPayload(avatar.DEFAULT_CONFIG, 'revision', ['current-result'], { seed: 7, size: '2K' });
assert.equal(revisionPayload.parameters.size, '2K');
assert.equal(revisionPayload.parameters.n, 1);
assert.equal(revisionPayload.parameters.watermark, false);
assert.equal(Object.hasOwn(revisionPayload.parameters, 'bbox_list'), false);
const bbox = [[100, 120, 620, 680]];
const bboxPayload = buildWanPayload(avatar.DEFAULT_CONFIG, 'revision', ['current-result'], { seed: 7, size: '2K', bboxList: bbox });
assert.deepEqual(bboxPayload.parameters.bbox_list, bbox);

const avatarPage = read('pages/avatar-generate/avatar-generate.vue');
const particles = read('components/PetGenerationParticles.vue');
const legacyParticles = read('components/PetGenerationParticlesLegacy.vue');
const scanGrid = read('components/PetGenerationScanGrid.vue');
const hero = read('components/PetAvatarHero.vue');
const display = read('common/avatar-display-asset.js');
assert.match(avatarPage, /v-if="confirmingAvatar" class="confirm-saving-mask"/);
assert.ok(avatarPage.indexOf('this.actionLocked = true; this.confirmingAvatar = true; lightHaptic();') < avatarPage.indexOf('await confirmGeneratedAvatar'), 'confirm feedback is immediate');
assert.doesNotMatch(avatarPage.match(/useGeneratedAvatar\(\)[\s\S]*?\n    openFeedback\(\)/)[0], /startAvatarCutout|getAvatarCutoutStatus|retryAvatarCleanup/, 'confirm does not await post-processing');
assert.equal((avatarPage.match(/<PetGenerationParticles\b/g) || []).length, 1);
assert.doesNotMatch(avatarPage, /:run-token=/);
assert.doesNotMatch(avatarPage, /<PetGenerationParticles[^>]*:key=/);
assert.doesNotMatch(particles, /runToken\(next, previous\)[\s\S]*resetRun\(\)/);
assert.match(legacyParticles, /attractionMix \+= \(this\.targetAttractionMix - this\.attractionMix\)/);
assert.match(scanGrid, /completionMix/);
assert.match(particles, /DEFAULT_GENERATION_EFFECT = 'scan-grid'/);
assert.match(display, /kind: 'local-cutout'/);
assert.match(hero, /hero-image-previous/);
assert.match(hero, /hero-image-current/);
assert.match(hero, /transition: opacity 620ms ease/);
assert.match(hero, /0\.72 \/ Math\.max\(contentFraction/);
assert.doesNotMatch(hero, /background-image|mask-image|drop-shadow/, 'transparent Hero uses real alpha without a feathered rectangle');

const deepseek = require('../uniCloud-alipay/cloudfunctions/api_deepseek/index.js').__test;
const rawLinksOnly = {
  id: 'resp_test',
  output: [
    { type: 'web_search_call', action: { sources: [{ title: 'Public case', url: 'https://example.com/case' }] } },
    { type: 'message', content: [{ type: 'output_text', text: '' }] }
  ]
};
const normalized = deepseek.normalizeSimilarCaseResponse(rawLinksOnly, 'en');
assert.equal(normalized.webSearchExecuted, true);
assert.equal(normalized.links.length, 0, 'links in a web_search_call request are not a completed search result');
assert.equal(normalized.cases.length, 0);
assert.equal(normalized.result.state, 'NO_RESULTS');
const unexecuted = deepseek.normalizeSimilarCaseResponse(require('../uniCloud-alipay/cloudfunctions/api_deepseek/care-search').nativeSearchResponse(rawLinksOnly), 'en');
assert.equal(unexecuted.webSearchExecuted, false, 'production search requires completed matching native tool-result evidence');
assert.equal(unexecuted.cases.length, 0);
assert.equal(unexecuted.result.state, 'NO_RESULTS');
assert.equal(normalized.diagnostics.parseFallbackUsed, true);
const deepseekSource = read('uniCloud-alipay/cloudfunctions/api_deepseek/index.js');
assert.equal((deepseekSource.match(/normalizeSimilarCaseResponse\(require\('\.\/care-search'\)\.nativeSearchResponse\(response\.data\)/g) || []).length, 1, 'provider native response has one authoritative normalization boundary');
assert.match(deepseekSource, /status: 'RUNNING', providerInvocationCount: 1/);
assert.match(deepseekSource, /status: job\.status[\s\S]*status: 'TIMEOUT'/, 'timeout cannot overwrite a changed terminal status');
assert.match(deepseekSource, /\['SUCCEEDED', 'SUCCEEDED_PARTIAL'\]/);

console.log('PETY avatar and similar-case P0 V5 tests passed');
