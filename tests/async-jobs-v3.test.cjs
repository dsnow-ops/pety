'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

global.uniCloud = { database() { return { collection() { return {}; } }; } };

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const functionSlice = (source, name, nextName) => {
  const start = source.indexOf(`async function ${name}`);
  const end = source.indexOf(`async function ${nextName}`, start + 1);
  assert.ok(start >= 0 && end > start, `${name} function boundaries`);
  return source.slice(start, end);
};

const deepseekSource = read('uniCloud-alipay/cloudfunctions/api_deepseek/index.js');
const deepseekTest = require('../uniCloud-alipay/cloudfunctions/api_deepseek/index.js').__test;
const createSearch = functionSlice(deepseekSource, 'createSimilarCaseSearch', 'processSimilarCaseSearch');
const processSearch = functionSlice(deepseekSource, 'processSimilarCaseSearch', 'getSimilarCaseSearchStatus');
const statusSearch = functionSlice(deepseekSource, 'getSimilarCaseSearchStatus', 'requestMemorialDailyReflection');
assert.doesNotMatch(createSearch, /requestSimilarCases\(/, 'create returns without waiting for DeepSeek');
assert.doesNotMatch(statusSearch, /requestSimilarCases\(/, 'status polling never invokes DeepSeek');
assert.equal((processSearch.match(/requestSimilarCases\(/g) || []).length, 1, 'processor has one provider call site');
assert.match(processSearch, /status: 'PENDING'[\s\S]*providerInvocationCount: 0[\s\S]*providerInvocationCount: 1/, 'provider call uses an atomic one-shot claim');
assert.match(deepseekSource, /result\.modifiedCount/, 'Alipay update result is recognized by the processor claim');
assert.equal(deepseekTest.getUpdatedDocumentCount({ modifiedCount: 1 }), 1);
assert.equal(deepseekTest.getUpdatedDocumentCount({ affectedRows: 1 }), 1);
for (const logName of ['similar_case_job_created', 'similar_case_processor_invoked', 'similar_case_claimed', 'similar_case_request_started', 'similar_case_request_finished', 'similar_case_request_failed', 'similar_case_provider_normalized', 'similar_case_final_decision', 'similar_case_job_failed']) {
  assert.match(deepseekSource, new RegExp(logName), `${logName} log exists`);
}
assert.match(deepseekSource, /processRequired: status === 'PENDING'/, 'pending jobs can be resumed');
assert.match(createSearch, /\['FAILED', 'TIMEOUT'\]\.includes\(existing\.status\)/, 'failed jobs are replaced with a fresh retry job');
assert.match(createSearch, /:retry:\$\{Date\.now\(\)\}/, 'retry job id differs from the failed job');
assert.match(deepseekSource, /SIMILAR_CASE_RUNNING_TIMEOUT_MS = 120000/);

const chatSource = read('pages/chat/chat.vue');
assert.match(chatSource, /requestType: 'createSimilarCaseSearch'/);
assert.match(chatSource, /requestType: 'processSimilarCaseSearch'/);
assert.match(chatSource, /requestType: 'getSimilarCaseSearchStatus'/);
assert.match(chatSource, /resumeSimilarCaseSearches\(\)/, 'chat restores persisted pending jobs');
assert.match(chatSource, /SIMILAR_CASE_POLL_INTERVAL_MS = 2500/);
assert.match(chatSource, /clientRequestId: `similar_\$\{Date\.now\(\)\}_\$\{Math\.random\(\)/, 'every repeated click creates a fresh job id');
assert.doesNotMatch(chatSource, /class="case-debug-code"/, 'raw similar-case error code is never rendered');
assert.match(chatSource, /console\.info\('\[similar-case\]\[failed\]'/, 'development diagnostics stay in console');
assert.match(read('common/chat-session-store.js'), /hasSimilarCaseJob/, 'job cards survive App restart');

const avatarSource = read('uniCloud-alipay/cloudfunctions/api_pet_avatar/index.js');
const cleanupConfirmed = functionSlice(avatarSource, 'cleanupConfirmedSession', 'confirmAvatar');
const confirmAvatar = functionSlice(avatarSource, 'confirmAvatar', 'startAvatarCutout');
const startCutout = functionSlice(avatarSource, 'startAvatarCutout', 'getAvatarCutoutStatus');
const statusCutout = functionSlice(avatarSource, 'getAvatarCutoutStatus', 'retryAvatarCleanup');
assert.doesNotMatch(confirmAvatar, /submitTransparentCutout|getTransparentCutoutStatus/, 'confirm does not wait for VIAPI');
assert.match(confirmAvatar, /persistFinalImage/);
assert.match(confirmAvatar, /cutoutStatus = 'PENDING'/);
assert.match(confirmAvatar, /displayDerivativeStatus: 'PENDING'/);
assert.equal((startCutout.match(/submitTransparentCutout\(/g) || []).length, 1, 'cutout submit has one call site');
assert.match(startCutout, /cutoutInvocationCount: 0[\s\S]*cutoutInvocationCount: 1/, 'cutout submit is one-shot');
assert.ok(startCutout.indexOf("heroGenerationStatus: 'SUBMITTING'") < startCutout.indexOf('createWanTask('), 'Hero submission state is durable before the provider call');
assert.ok(startCutout.indexOf('persistHeroProviderSource(') < startCutout.indexOf('createWanTask('), 'Hero provider receives the dedicated opaque source');
assert.match(startCutout, /size: '2048\*2048'/, 'Hero uses the square size verified on the real provider');
assert.match(startCutout, /useHeroGeneration[\s\S]*heroGenerationStatus: 'FAILED'[\s\S]*heroGenerationErrorCode: errorCode/, 'pre-job failures persist the real Hero error without relying on stale candidate state');
assert.match(statusCutout, /getTransparentCutoutStatus/);
assert.match(statusCutout, /persistCutoutImage/);
assert.match(startCutout, /cutoutStatus: 'FAILED'/, 'cutout failure is isolated from final');

assert.match(confirmAvatar, /verifyCloudFileExists\(finalized\.finalFileId\)/, 'confirm verifies final');
assert.doesNotMatch(confirmAvatar, /cleanupConfirmedSession/, 'confirm returns before candidate cleanup');
const verifyIndex = cleanupConfirmed.indexOf('verifyCloudFileExists(selected.finalFileId)');
const deleteIndex = cleanupConfirmed.indexOf('deleteCloudFiles');
assert.ok(verifyIndex >= 0 && deleteIndex > verifyIndex, 'cleanup re-verifies final before deleting candidates');

const avatar = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/index.js').__test;
const cleanup = avatar.buildCleanupPlan([
  {
    _id: 'selected',
    generatedFileId: 'candidate-selected',
    finalFileId: 'final-safe',
    cutoutFileId: 'cutout-safe',
    styleReferenceFileId: 'style-safe',
    originalPhotoFileId: 'archive-photo-safe',
    sourceFileIds: ['cloud://space/pet-avatar/input/pet/session/source-1.jpg']
  },
  { _id: 'other', generatedFileId: 'candidate-other', sourceFileIds: [] }
], { _id: 'selected' });
assert.deepEqual(cleanup.discardedFileIds, ['candidate-selected', 'candidate-other']);
assert.deepEqual(cleanup.temporarySourceFileIds, ['cloud://space/pet-avatar/input/pet/session/source-1.jpg']);
for (const protectedFile of ['final-safe', 'cutout-safe', 'style-safe', 'archive-photo-safe']) {
  assert.equal(cleanup.discardedFileIds.includes(protectedFile), false, `${protectedFile} is protected`);
  assert.equal(cleanup.temporarySourceFileIds.includes(protectedFile), false, `${protectedFile} is not a temporary input`);
}

const displaySource = read('common/avatar-display-asset.js');
assert.match(displaySource, /kind: 'viapi-cutout'/);
assert.match(displaySource, /kind: 'local-cutout'/);
const clientSource = read('common/pet-avatar-generator.js');
const avatarPage = read('pages/avatar-generate/avatar-generate.vue');
assert.ok(avatarPage.indexOf('updateActivePet(patch)') < avatarPage.indexOf("uni.switchTab({ url: '/pages/home/home' })"), 'pet-store final pointer is written before Home starts post-confirm work');
const homeSource = read('pages/home/home.vue');
assert.ok(homeSource.indexOf('this.loadHomeData()') < homeSource.indexOf('this.refreshPendingAvatarAsset()'), 'Home loads the official pet pointer before cleanup or cutout');
assert.match(homeSource, /retryAvatarCleanup\(pet\.id, pet\.generatedAvatarCutoutJobId\)/);
assert.match(homeSource, /startAvatarCutout\(pet\.id, pet\.generatedAvatarCutoutJobId\)/);
assert.match(homeSource, /needsHeroUpgrade[\s\S]*HOME_HERO_PIPELINE_VERSION[\s\S]*HOME_HERO_GENERATION_VERSION/, 'cold-started failed v1 Hero records migrate to the corrected provider-input pipeline');
assert.match(clientSource, /export async function startAvatarCutout/, 'cutout startup is a checked client action');
assert.match(clientSource, /action: 'prepareHeroDisplay'[\s\S]*buildAiConsentPayload\('pet_avatar'\)/, 'prepared Hero carries the original AI consent proof');
assert.match(avatarSource, /candidate\.cutoutStatus === 'PENDING'[\s\S]*event\.aiConsentAccepted === true[\s\S]*return startAvatarCutout\(event, config, context\)/, 'consented preparation cannot leave the Hero task in PENDING limbo');

const { buildAvatarPrompt } = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/avatar-prompt.js');
const basePrompt = buildAvatarPrompt(3);
assert.equal(basePrompt.length, 1705);
assert.equal(crypto.createHash('sha256').update(basePrompt).digest('hex'), 'd4bc2b10df557435b9386d9b015cde348b9a4ff9da90d80f06dc08b40fa3a378');
assert.deepEqual(avatar.buildOrderedFileIds('revision', '', 'current-result', ['source-1']), ['current-result']);

const searchSchema = JSON.parse(read('uniCloud-alipay/database/similar_case_search_jobs.schema.json'));
assert.deepEqual(searchSchema.properties.status.enum, ['PENDING', 'RUNNING', 'SUCCEEDED', 'SUCCEEDED_PARTIAL', 'FAILED', 'TIMEOUT']);
assert.equal(searchSchema.properties.providerInvocationCount.maximum, 1);
const avatarJobSchema = JSON.parse(read('uniCloud-alipay/database/pet_avatar_jobs.schema.json'));
assert.ok(avatarJobSchema.properties.heroGenerationStatus.enum.includes('SUBMITTING'));
assert.equal(avatarJobSchema.properties.heroProviderSourceMetadata.properties.alphaChannel.bsonType, 'bool');

console.log('Async jobs and cleanup V3 tests passed');
