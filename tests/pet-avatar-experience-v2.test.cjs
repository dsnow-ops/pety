'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const page = read('pages/avatar-generate/avatar-generate.vue');
const particles = read('components/PetGenerationParticles.vue');
const scanGrid = read('components/PetGenerationScanGrid.vue');
const legacyParticles = read('components/PetGenerationParticlesLegacy.vue');
const hero = read('components/PetAvatarHero.vue');
const home = read('pages/home/home.vue');
const display = read('common/avatar-display-asset.js');
const derivatives = read('uniCloud-alipay/cloudfunctions/api_pet_avatar/avatar-display-derivatives.js');
const zh = read('locale/zh-Hans.js');
const resultCopySource = read('common/avatar-result-copy.js')
  .replace("import { t } from './i18n.js';", '')
  .replace(/export function /g, 'function ')
  .replace(/export \{ RESULT_COPY_KEYS \};/, '');
const resultCopy = Function('t', `${resultCopySource}; return { getAvatarResultContext, getAvatarResultCopy };`)((key, params, locale) => `${locale}:${key}`);

assert.doesNotMatch(zh, /这次更像了吗/);
for (let index = 1; index <= 8; index += 1) assert.match(zh, new RegExp(`resultFirst${index}:`));
for (let index = 1; index <= 4; index += 1) {
  assert.match(zh, new RegExp(`resultRegenerate${index}:`));
  assert.match(zh, new RegExp(`resultRevision${index}:`));
}
assert.match(page, /getAvatarResultCopy/);
assert.match(page, /jobKind: candidate\.jobKind \|\| this\.pendingJobKind/);
assert.match(page, /jobId: candidate\.jobId \|\| this\.previewJobId \|\| this\.selectedJobId/);
assert.equal(resultCopy.getAvatarResultContext('initial'), 'initial_first');
assert.equal(resultCopy.getAvatarResultContext('regenerate'), 'regenerate');
assert.equal(resultCopy.getAvatarResultContext('revision'), 'revision');
assert.deepEqual(
  resultCopy.getAvatarResultCopy({ jobKind: 'initial', jobId: 'job-stable', locale: 'zh-Hans' }),
  resultCopy.getAvatarResultCopy({ jobKind: 'initial', jobId: 'job-stable', locale: 'zh-Hans' })
);

assert.equal((page.match(/<PetGenerationParticles\b/g) || []).length, 1);
assert.match(page, /\['avatar-preview-shell', 'ai-stage', isProcessing \? 'is-processing' : 'is-result'\]/);
assert.match(page, /\.avatar-preview-shell \{[^}]*aspect-ratio: 1 \/ 1/);
assert.match(page, /\.ai-stage\.is-processing \{ background: radial-gradient/);
assert.match(page, /\.particles \{ z-index: 3; opacity: \.98; \}/);
assert.doesNotMatch(page, /stageAspectRatio|stageLayoutStyle/);
assert.doesNotMatch(particles, /createLayers\(280\)/);
assert.match(particles, /DEFAULT_GENERATION_EFFECT = 'scan-grid'/);
assert.match(particles, /resolvedVariant === 'legacy-orbit'/);
assert.match(scanGrid, /waveY/);
assert.match(scanGrid, /progress/);
assert.match(scanGrid, /FRAME_INTERVAL_MS = 48/);
assert.match(scanGrid, /this\.animationTime \+= FRAME_INTERVAL_MS \/ 1000/);
assert.match(scanGrid, /this\.renderedFrameCount \+= 1/);
assert.doesNotMatch(scanGrid, /requestAnimationFrame/, 'scan grid uses the APP-safe timer scheduler');
assert.match(legacyParticles, /createParticle\('front'\)/);
assert.match(page, /progressPercentText/);
assert.match(page, /class="progress-percent"/);

assert.match(display, /viapi-cutout[\s\S]*local-cutout[\s\S]*kind: 'final'/);
assert.match(hero, /\.master-surface/);
assert.match(hero, /@keyframes portraitIdle/);
assert.match(hero, /portrait-vignette/);
assert.match(home, /interactive-portrait/);
assert.doesNotMatch(hero, /mask-image|filter:\s*(blur|drop-shadow)/);
assert.match(home, /LOCAL CUTOUT:/);
assert.match(home, /FEATHER FALLBACK:/);
assert.match(derivatives, /\* 0\.18/);

console.log('PETY avatar generation experience V2 tests passed');
