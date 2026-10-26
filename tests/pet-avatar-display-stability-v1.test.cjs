'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { PNG } = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/node_modules/pngjs');
const { buildAvatarPrompt } = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/avatar-prompt');
const { buildDisplayDerivatives } = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/avatar-display-derivatives');
const { inspectTransparentPng } = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/storage');
const { ownedMediaCloud, clientUni } = require('./fixtures/owned-media-cloud.cjs');

const root = path.resolve(__dirname, '..');
const source = file => fs.readFileSync(path.join(root, file), 'utf8');

const page = source('pages/avatar-generate/avatar-generate.vue');
const particles = source('components/PetGenerationParticles.vue');
const scanGrid = source('components/PetGenerationScanGrid.vue');
const legacyParticles = source('components/PetGenerationParticlesLegacy.vue');
const hero = source('components/PetAvatarHero.vue');
const home = source('pages/home/home.vue');
const client = source('common/pet-avatar-generator.js');
const cloud = source('uniCloud-alipay/cloudfunctions/api_pet_avatar/index.js');

// 1-4: one continuously mounted canvas and load-gated reveal state machine.
assert.equal((page.match(/<PetGenerationParticles\b/g) || []).length, 1);
assert.doesNotMatch(page, /<PetGenerationParticles[\s\S]{0,300}:key=/);
assert.doesNotMatch(page, /:run-token=/);
assert.doesNotMatch(particles, /watch:[\s\S]*runToken/);
for (const state of ['GENERATING', 'RESULT_LOADING', 'RESULT_REVEALING', 'RESULT_READY']) assert.match(page, new RegExp(state));
assert.doesNotMatch(page, /RESULT_PRELOADING/);
assert.ok(page.indexOf("this.resultStage = 'RESULT_REVEALING'") > page.indexOf('onResultPreloaded()'));
assert.match(page, /resultStage === 'RESULT_REVEALING'/);
assert.match(scanGrid, /this\.completionMix \+= \(\(this\.completing \? 1 : 0\) - this\.completionMix\)/);
assert.match(legacyParticles, /attractionMix \+= \(this\.targetAttractionMix - this\.attractionMix\)/);
assert.match(particles, /DEFAULT_GENERATION_EFFECT = 'scan-grid'/);
assert.match(scanGrid, /scheduleNextFrame/);
assert.doesNotMatch(scanGrid, /requestAnimationFrame/);
assert.match(page, /avatar-preview-shell/);
assert.match(page, /\.avatar-preview-shell \{[^}]*width: min\(100%, 640rpx\);[^}]*aspect-ratio: 1 \/ 1/);
assert.doesNotMatch(page, /stageAspectRatio|stageLayoutStyle/);
assert.doesNotMatch(particles, /this\.createLayers\(280\)/);

// 5-7: candidate identity and URL hydration remain separate and selection does not rebuild the list.
const candidateBlock = client.slice(client.indexOf('function normalizeMainAssetMetadata'), client.indexOf('function normalizeSession')).replace('export function mergeAvatarCandidates', 'function mergeAvatarCandidates');
const mergeAvatarCandidates = Function(`${candidateBlock}; return mergeAvatarCandidates;`)();
const merged = mergeAvatarCandidates([
  { jobId: 'A', generatedFileId: 'file-A', generatedTempUrl: 'url-A', createdAt: 1 },
  { jobId: 'B', generatedFileId: 'file-B', generatedTempUrl: 'url-B', createdAt: 2 }
], [
  { jobId: 'A', generatedFileId: 'file-A', generatedTempUrl: '', createdAt: 1 },
  { jobId: 'B', generatedFileId: 'file-B', generatedTempUrl: '', createdAt: 2 }
]);
assert.deepEqual(merged.map(item => item.jobId), ['A', 'B']);
assert.deepEqual(merged.map(item => item.generatedTempUrl), ['url-A', 'url-B']);
const chooseBlock = page.slice(page.indexOf('\n    chooseCandidate(candidate)'), page.indexOf('async beginCandidatePreload'));
assert.doesNotMatch(chooseBlock, /this\.candidates\s*=/);
assert.match(page, /candidateUrlCache: new Map\(\)/);
assert.match(page, /hydrateCandidateFile\(candidate/);
assert.doesNotMatch(chooseBlock, /refreshAvatarGenerationSession/);

// Load the dependency-free display resolver with a controlled uniCloud implementation.
let hydrationCalls = 0;
const displayModuleSource = source('common/avatar-display-asset.js')
  .replace(/export function /g, 'function ')
  .replace(/export async function /g, 'async function ')
  .replace(/export const /g, 'const ');
const display = Function('uniCloud', 'uni', `${displayModuleSource}; return { resolvePetHeroAsset, hydratePetHeroAsset, clearAvatarDisplayAssetCache };`)(ownedMediaCloud(async ({ fileList }) => {
    hydrationCalls += 1;
    return { fileList: [{ tempFileURL: `temp://${hydrationCalls}/${fileList[0]}` }] };
}), clientUni);

// 8 and 12: cache isolation and validated local cutout priority.
(async () => {
  const sharedFile = 'cloud://space/final.png';
  await display.hydratePetHeroAsset({ id: 'pet-A', avatarStatus: 'ready', generatedAvatarFileId: sharedFile });
  await display.hydratePetHeroAsset({ id: 'pet-B', avatarStatus: 'ready', generatedAvatarFileId: sharedFile });
  assert.equal(hydrationCalls, 2, 'same file id is still isolated by pet id');
  display.clearAvatarDisplayAssetCache('pet-C');
  const beforeConcurrentHydration = hydrationCalls;
  await Promise.all([
    display.hydratePetHeroAsset({ id: 'pet-C', avatarStatus: 'ready', generatedAvatarFileId: sharedFile }),
    display.hydratePetHeroAsset({ id: 'pet-C', avatarStatus: 'ready', generatedAvatarFileId: sharedFile })
  ]);
  assert.equal(hydrationCalls, beforeConcurrentHydration + 1, 'same pet/file hydration is single-flight');

  assert.equal(display.resolvePetHeroAsset({
    id: 'pet-B', generatedAvatarCutoutStatus: 'SUCCEEDED', generatedAvatarCutoutFileId: 'external', generatedAvatarCutoutAlphaValid: false,
    generatedAvatarLocalCutoutFileId: 'local', generatedAvatarLocalCutoutAlphaValid: true,
    generatedAvatarLocalCutoutMetrics: { outputWidth: 2048, outputHeight: 2048, outputBytes: 600000, qualityVersion: 2, qualified: true, hasAlpha: true, mime: 'image/png' },
    generatedAvatarMainAssetMetadata: { width: 2048, height: 2048, bytes: 1200000, providerOriginal: true },
    generatedAvatarDerivedFromFileId: 'final', generatedAvatarFileId: 'final'
  }).assetKind, 'local-cutout');
  assert.equal(display.resolvePetHeroAsset({
    id: 'pet-B', generatedAvatarLocalCutoutFileId: 'local', generatedAvatarLocalCutoutAlphaValid: false,
    generatedAvatarFeatheredDisplayFileId: 'feather', generatedAvatarDerivedFromFileId: 'final', generatedAvatarFileId: 'final',
    generatedAvatarMainAssetMetadata: { width: 2048, height: 2048, bytes: 1200000, providerOriginal: true },
    generatedAvatarDisplayDimensions: { displayWidth: 768, displayHeight: 768 }
  }).assetKind, 'final');

  // 9-10: handoff only resolves for the matching pet and expires after five minutes.
  const storage = new Map();
  const uni = {
    setStorageSync(key, value) { storage.set(key, value); },
    getStorageSync(key) { return storage.get(key); },
    removeStorageSync(key) { storage.delete(key); }
  };
  const handoffSource = source('common/avatar-handoff.js')
    .replace(/^import[^;]+;\s*/gm, '')
    .replace(/export function /g, 'function ')
    .replace(/export \{ HANDOFF_TTL_MS \};/, '');
  const handoff = Function('uni', 'scopedStorage', `${handoffSource}; return { saveAvatarHandoff, getAvatarHandoff, HANDOFF_TTL_MS };`)(uni, uni);
  const saved = handoff.saveAvatarHandoff({ petId: 'pet-A', fileId: 'final-A', jobId: 'job-A', previewUrl: 'temp://A' });
  assert.equal(handoff.getAvatarHandoff('pet-B'), null);
  assert.equal(handoff.getAvatarHandoff('pet-A').previewUrl, 'temp://A');
  assert.equal(handoff.getAvatarHandoff('pet-A', saved.createdAt + handoff.HANDOFF_TTL_MS + 1), null);

  // 11: opaque PNG is rejected; local cutout has real alpha and diagnostics.
  const opaque = new PNG({ width: 32, height: 32 });
  opaque.data.fill(255);
  assert.throws(() => inspectTransparentPng(PNG.sync.write(opaque)), error => error.code === 'CUTOUT_ALPHA_INVALID');
  const fixture = new PNG({ width: 256, height: 256 });
  for (let y = 0; y < fixture.height; y += 1) {
    for (let x = 0; x < fixture.width; x += 1) {
      const offset = (y * fixture.width + x) * 4;
      const petPixel = ((x - 128) ** 2) / (58 ** 2) + ((y - 136) ** 2) / (82 ** 2) < 1;
      const color = petPixel ? [118, 94, 76] : [238, 232, 220];
      fixture.data[offset] = color[0]; fixture.data[offset + 1] = color[1]; fixture.data[offset + 2] = color[2]; fixture.data[offset + 3] = 255;
    }
  }
  const derivatives = buildDisplayDerivatives(PNG.sync.write(fixture));
  assert.ok(derivatives.localCutoutBuffer);
  const localInspection = inspectTransparentPng(derivatives.localCutoutBuffer);
  assert.ok(localInspection.transparentPixelRatio > 0.08);
  assert.equal(derivatives.localCutoutMetrics.confidence >= 0.72, true);

  assert.match(home, /common\/home-hero-asset\.js/);
  assert.doesNotMatch(home, /getAvatarHandoff\(expectedPetId\)/);
  assert.match(home, /asset\.assetKind \|\| 'placeholder'/);
  assert.match(home, /needsDisplayDerivative/);
  assert.match(hero, /previousPetId|suppressedPreviousUrl/);
  assert.match(cloud, /candidate_final_copy_ms/);
  assert.match(cloud, /final_verify_ms/);
  assert.match(cloud, /function hasDisplayDerivative/);
  assert.match(cloud, /backfillDisplayDerivatives/);
  assert.doesNotMatch(page.slice(page.indexOf('useGeneratedAvatar()'), page.indexOf('openFeedback()')), /await (startAvatarCutout|retryAvatarCleanup)/);

  const prompt = buildAvatarPrompt(3);
  assert.equal(prompt.length, 1705);
  assert.equal(crypto.createHash('sha256').update(prompt).digest('hex'), 'd4bc2b10df557435b9386d9b015cde348b9a4ff9da90d80f06dc08b40fa3a378');
  console.log('PETY avatar display stability V1 tests passed', {
    backgroundConfidence: derivatives.localCutoutMetrics.confidence,
    transparentPixelRatio: localInspection.transparentPixelRatio
  });
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
