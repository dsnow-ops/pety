'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

global.uniCloud = { database() { return { collection() { return {}; } }; } };

const root = path.resolve(__dirname, '..');
const { buildAvatarPrompt } = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/avatar-prompt.js');
const { buildAvatarRevisionPrompt, parseAvatarRevisionIntent } = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/avatar-revision-prompt.js');
const { PNG } = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/node_modules/pngjs');
const { evaluateRevisionQuality } = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/image-quality-gate.js');
const { buildWanPayload, extractResultImageUrl } = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/wan-client.js');
const avatar = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/index.js').__test;
const storage = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/storage.js');

const base = buildAvatarPrompt(3);
assert.equal(base.length, 1705);
assert.equal(crypto.createHash('sha256').update(base).digest('hex'), 'd4bc2b10df557435b9386d9b015cde348b9a4ff9da90d80f06dc08b40fa3a378');

assert.deepEqual(avatar.buildOrderedFileIds('initial', 'style-A', '', ['source-B1', 'source-B2']), ['style-A', 'source-B1', 'source-B2']);
const revisionOrder = avatar.buildOrderedFileIds('revision', '', 'current-C', ['source-B1', 'source-B2']);
assert.deepEqual(revisionOrder, ['current-C']);
assert.equal(revisionOrder.includes('style-A'), false);
assert.doesNotMatch(buildAvatarRevisionPrompt(2, '脸再瘦一点'), /官方风格参考图/);

const candidateFileId = 'cloud://space/pet-avatar/output/pet-hash/job-a/candidate.png';
const finalFileId = 'cloud://space/pet-avatar/final/pet-hash/job-a/final.png';
assert.deepEqual(avatar.resolveRevisionSource({ status: 'SUCCEEDED', generatedFileId: candidateFileId, finalFileId }), {
  role: 'candidate_original', fileId: candidateFileId, cloudPath: 'pet-avatar/output/pet-hash/job-a/candidate.png'
});
assert.deepEqual(avatar.resolveRevisionSource({ status: 'SUCCEEDED', generatedFileId: '', finalFileId }), {
  role: 'final_original', fileId: finalFileId, cloudPath: 'pet-avatar/final/pet-hash/job-a/final.png'
});
assert.throws(() => avatar.resolveRevisionSource({ status: 'SUCCEEDED', generatedFileId: 'cloud://space/pet-avatar/final/pet-hash/job-a/cutout.png' }), error => error.code === 'REVISION_SOURCE_INVALID');

assert.equal(avatar.normalizeSeed(0), 0);
assert.equal(avatar.normalizeSeed(2147483647), 2147483647);
assert.equal(avatar.normalizeSeed(-1), null);
assert.equal(avatar.normalizeSeed(2147483648), null);
const generatedSeed = avatar.createSeed();
assert.ok(generatedSeed >= 0 && generatedSeed <= 2147483647);
const payload = buildWanPayload(avatar.DEFAULT_CONFIG, 'revision', ['current-C', 'source-B1'], { seed: 123 });
assert.equal(payload.parameters.seed, 123);
assert.equal(Object.hasOwn(payload.parameters, 'bbox_list'), false);

const providerFixture = {
  output: { choices: [{ message: { content: [{ type: 'image', image: 'https://wan.example/result-C.png' }] } }] },
  input: { images: ['https://style.example/A.png', 'https://source.example/B.png'] }
};
assert.equal(extractResultImageUrl(providerFixture), 'https://wan.example/result-C.png');
assert.notEqual(extractResultImageUrl(providerFixture), providerFixture.input.images[0]);
assert.equal(extractResultImageUrl({ output: { choices: [] }, input: providerFixture.input }), '');

assert.throws(() => storage.assertDistinctHashes('same', 'same'), error => error.code === 'OUTPUT_EQUALS_STYLE_REFERENCE');
assert.doesNotThrow(() => storage.assertDistinctHashes('candidate', 'style'));

const cleanup = avatar.buildCleanupPlan([
  { _id: 'one', generatedFileId: 'candidate-1', sourceFileIds: ['cloud://space/pet-avatar/input/p/source-1.jpg'] },
  { _id: 'two', generatedFileId: 'candidate-2', sourceFileIds: ['cloud://space/pet-avatar/input/p/source-1.jpg'] },
  { _id: 'three', generatedFileId: 'candidate-3', sourceFileIds: [] }
], { _id: 'two', generatedFileId: 'candidate-2' });
assert.deepEqual(cleanup.discardedFileIds, ['candidate-1', 'candidate-2', 'candidate-3']);
assert.equal(cleanup.discardedFileIds.includes('candidate-2'), true);
assert.deepEqual(cleanup.temporarySourceFileIds, ['cloud://space/pet-avatar/input/p/source-1.jpg']);

const clientSource = fs.readFileSync(path.join(root, 'common/pet-avatar-generator.js'), 'utf8');
assert.doesNotMatch(clientSource, /currentResultFileId: options\.currentResultFileId/, 'client does not choose the revision image source');
assert.match(clientSource, /jobKind === 'revision' \? \{\} : \{ sourceFileIds \}/, 'revision does not send identity file ids from the client');
const fillSource = clientSource.match(/export function fillAvatarPhotoSlots[\s\S]*?\n}/)[0].replace('export ', '');
const fillAvatarPhotoSlots = Function(`${fillSource}; return fillAvatarPhotoSlots;`)();
assert.deepEqual(fillAvatarPhotoSlots([], 0, ['a', 'b', 'c']).map(item => item.path), ['a', 'b', 'c']);
assert.deepEqual(fillAvatarPhotoSlots([{ path: 'a' }], 1, ['b', 'c']).map(item => item.path), ['a', 'b', 'c']);
assert.deepEqual(fillAvatarPhotoSlots([{ path: 'a' }, { path: 'b' }], 2, ['c', 'd']).map(item => item.path), ['a', 'b', 'c']);

const page = fs.readFileSync(path.join(root, 'pages/avatar-generate/avatar-generate.vue'), 'utf8');
assert.doesNotMatch(page, /currentResultFileId:/, 'workbench sends only the selected job id for revisions');
assert.match(page, /jobKind !== 'revision' && !sourceFileIds\.length/, 'revision never re-uploads client photo sources');
assert.match(page, /jobKind === 'revision' \? \{\} : \{ sourceFileIds, sourcePhotoPaths:/, 'revision page call omits all source file ids');
assert.match(page, /submitAvatarFeedback/);
assert.match(page, /feedbackCategories/);
assert.doesNotMatch(page, /stageImage[^\n]*selectedPhotos/);
for (const state of ['GENERATING', 'RESULT_LOADING', 'RESULT_REVEALING', 'RESULT_READY']) assert.match(page, new RegExp(state));
assert.match(page, /@load="onResultPreloaded"/);
assert.match(page, /:density="320"/);
assert.doesNotMatch(page, /class="stage-placeholder"/, 'waiting stage has no cartoon pet silhouette');
const preloadIndex = page.indexOf("this.resultStage = 'RESULT_LOADING'");
const revealingIndex = page.indexOf("this.resultStage = 'RESULT_REVEALING'", preloadIndex);
const readyIndex = page.indexOf("this.resultStage = 'RESULT_READY'", revealingIndex);
assert.ok(preloadIndex >= 0 && revealingIndex > preloadIndex && readyIndex > revealingIndex, 'result reveal states are ordered');
assert.ok(page.indexOf('this.visibleResultUrl = this.preloadCandidateUrl') > page.indexOf('onResultPreloaded()'), 'result is hidden until preload succeeds');
assert.match(page, /lightHaptic\(\)/, 'start and reveal use safe light haptics');

assert.match(clientSource, /preservePreviousSelection = candidate\.jobKind === 'revision'/);
assert.match(clientSource, /selectedJobId: preservePreviousSelection \? session\.selectedJobId : result\.jobId/);
assert.match(page, /pendingJobKind === 'revision'[\s\S]*beginCandidatePreload\(baseline\)/, 'failed revision restores the prior candidate');

const storageSource = fs.readFileSync(path.join(root, 'uniCloud-alipay/cloudfunctions/api_pet_avatar/storage.js'), 'utf8');
assert.match(storageSource, /candidate\.png/);
assert.match(storageSource, /final\.png/);
assert.match(storageSource, /cutout\.png/);

const heroSource = fs.readFileSync(path.join(root, 'components/PetAvatarHero.vue'), 'utf8');
assert.doesNotMatch(heroSource, /edge-feather/);
const displaySource = fs.readFileSync(path.join(root, 'common/avatar-display-asset.js'), 'utf8');
assert.match(displaySource, /kind: 'local-cutout'/);
assert.doesNotMatch(displaySource, /kind: 'feathered-final'/);

const revisionPrompt = buildAvatarRevisionPrompt(0, '脸再瘦一点');
for (const guard of ['小范围局部编辑', '不要增加噪点', '修改目标：脸部外轮廓', '修改动作：轻微收窄', '保持身份，仅修改指定局部', '不要扩大修改范围']) {
  assert.match(revisionPrompt, new RegExp(guard));
}
const slimFaceIntent = parseAvatarRevisionIntent('脸再瘦一点');
assert.equal(slimFaceIntent.type, 'bounded');
assert.equal(slimFaceIntent.targetKey, 'face');
assert.equal(slimFaceIntent.actionKey, 'slimmer');
assert.equal(slimFaceIntent.revisionTarget, 'FACE');
assert.equal(slimFaceIntent.identityCorrection, false);
assert.equal(slimFaceIntent.bboxConfidence, 0);
assert.equal(slimFaceIntent.bboxList, null);
for (const [input, target, adjustment] of [
  ['脸更圆一点', '脸部外轮廓', '轻微变圆'], ['眼睛更大一点', '眼睛', '轻微放大'],
  ['耳朵更尖一点', '耳朵', '轻微变尖'], ['尾巴更细一点', '尾巴', '轻微变细'],
  ['毛色更浅一点', '整体毛色', '轻微变浅']
]) {
  const intent = parseAvatarRevisionIntent(input);
  assert.equal(intent.target, target);
  assert.equal(intent.adjustment, adjustment);
}
assert.equal(parseAvatarRevisionIntent('尾巴没有花纹').targetKey, 'tail_pattern');
assert.equal(parseAvatarRevisionIntent('尾巴没有花纹').actionKey, 'remove_pattern');
assert.equal(parseAvatarRevisionIntent('左脚是白色').targetKey, 'left_paw');
assert.equal(parseAvatarRevisionIntent('左脚是白色').actionKey, 'color_correction');
assert.equal(parseAvatarRevisionIntent('把神态柔和一些').type, 'custom');

function createPng(pixel) {
  const image = new PNG({ width: 512, height: 512 });
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const index = (y * image.width + x) * 4;
      const [red, green, blue] = pixel(x, y);
      image.data[index] = red;
      image.data[index + 1] = green;
      image.data[index + 2] = blue;
      image.data[index + 3] = 255;
    }
  }
  return PNG.sync.write(image);
}
const baseImage = createPng((x, y) => {
  const insideSubject = ((x - 256) ** 2) / (132 ** 2) + ((y - 270) ** 2) / (178 ** 2) < 1;
  return insideSubject ? [116 + Math.round(32 * x / 512), 102 + Math.round(24 * y / 512), 88] : [220, 214, 202];
});
const slightRevision = createPng((x, y) => {
  const insideSubject = ((x - 256) ** 2) / (126 ** 2) + ((y - 270) ** 2) / (178 ** 2) < 1;
  return insideSubject ? [118 + Math.round(32 * x / 512), 104 + Math.round(24 * y / 512), 90] : [220, 214, 202];
});
assert.doesNotThrow(() => evaluateRevisionQuality(baseImage, slightRevision));
const noisyRevision = createPng((x, y) => ((x + y) % 2 ? [0, 0, 0] : [255, 255, 255]));
assert.throws(() => evaluateRevisionQuality(baseImage, noisyRevision), error => (
  error.code === 'REVISION_RESULT_UNSTABLE' &&
  ['EXTREME_NOISE', 'EXTREME_EDGE_DENSITY', 'EXTREME_BRIGHTNESS'].includes(error.qualityGateResult.reasonCode)
));

assert.equal(avatar.isQuotaConsumingJob({ status: 'FAILED', resultSaved: false, userQuotaConsumed: false }), false);
assert.equal(avatar.isQuotaConsumingJob({ status: 'SUCCEEDED', resultSaved: true, userQuotaConsumed: true, entitlementPool: 'free' }), true);
assert.equal(avatar.isQuotaConsumingJob({ status: 'SUCCEEDED', resultSaved: true, userQuotaConsumed: true, entitlementPool: 'member' }), true);
assert.equal(avatar.isQuotaConsumingJob({ status: 'SUCCEEDED', resultSaved: true }), true, 'historical saved candidates remain quota-consuming');

const avatarIndexSource = fs.readFileSync(path.join(root, 'uniCloud-alipay/cloudfunctions/api_pet_avatar/index.js'), 'utf8');
assert.match(avatarIndexSource, /revisionSource = resolveRevisionSource\(parentJob\)/);
assert.match(avatarIndexSource, /inspectRevisionSource\(currentResultFileId\)/);
assert.match(avatarIndexSource, /db\.collection\('pet_avatar_feedback'\)/);
assert.match(avatarIndexSource, /VALID_FEEDBACK_CATEGORIES\.includes\(category\)/);
assert.match(avatarIndexSource, /sourceRole: revisionSource\.role[\s\S]*bytes: revisionSource\.bytes[\s\S]*width: revisionSource\.width[\s\S]*height: revisionSource\.height[\s\S]*sha256Prefix:/);
const feedbackSchema = JSON.parse(fs.readFileSync(path.join(root, 'uniCloud-alipay/database/pet_avatar_feedback.schema.json'), 'utf8'));
assert.deepEqual(feedbackSchema.properties.category.enum, ['poor_quality', 'revision_ineffective', 'identity_mismatch', 'distorted', 'other']);
assert.equal(feedbackSchema.permission.create, false, 'feedback can only be created through the cloud function');
assert.match(avatarIndexSource, /resultSaved: false,[\s\S]*userQuotaConsumed: false,[\s\S]*qualityGateResult:/);
assert.match(avatarIndexSource, /update\.resultSaved = true;[\s\S]*update\.userQuotaConsumed = true;/);
assert.equal((avatarIndexSource.match(/createWanTask\(/g) || []).length, 2, 'one workbench task and one separately confirmed Hero task are the only Wan submissions');
assert.match(avatarIndexSource, /persistHeroProviderSource\(petHash, selectedJobId, candidate\.finalFileId\)/);
assert.match(avatarIndexSource, /createWanTask\(config, buildHeroCharacterPrompt\(\), \[heroProviderSourceUrl\]/);
const revisionParserSource = fs.readFileSync(path.join(root, 'uniCloud-alipay/cloudfunctions/api_pet_avatar/avatar-revision-prompt.js'), 'utf8');
assert.doesNotMatch(revisionParserSource, /DeepSeek|uniCloud|httpclient|fetch\(|request\(/, 'revision structure parser is local-only');

console.log('pet avatar V3 tests passed');
