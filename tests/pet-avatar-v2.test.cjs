'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

global.uniCloud = { database() { return { collection() { return {}; } }; } };

const root = path.resolve(__dirname, '..');
const { buildAvatarPrompt } = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/avatar-prompt.js');
const revision = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/avatar-revision-prompt.js');
const avatarCloud = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/index.js').__test;

const base = buildAvatarPrompt(3);
assert.equal(base.length, 1705, 'locked Base Prompt length');
assert.equal(crypto.createHash('sha256').update(base).digest('hex'), 'd4bc2b10df557435b9386d9b015cde348b9a4ff9da90d80f06dc08b40fa3a378');
const revised = revision.buildAvatarRevisionPrompt(1, '尾巴应该是纯白色，没有花纹');
assert.ok(!revised.startsWith(base), 'revision uses an independent prompt');
assert.ok(revised.length < 5000);
assert.match(revised, /图1是已经确认身份与整体视觉正确的宠物形象/);
assert.doesNotMatch(revised, /第2张/);
assert.doesNotMatch(revised, /官方风格参考图/);
assert.equal(revision.normalizeRevisionText('  尾巴   纯白  '), '尾巴 纯白');
assert.throws(() => revision.normalizeRevisionText(''), /INVALID_REVISION_TEXT/);
assert.throws(() => revision.normalizeRevisionText('x'.repeat(301)), /INVALID_REVISION_TEXT/);
assert.equal(avatarCloud.normalizeJobKind(), 'initial');
assert.equal(avatarCloud.normalizeJobKind('regenerate'), 'regenerate');
assert.equal(avatarCloud.normalizeJobKind('revision'), 'revision');
assert.throws(() => avatarCloud.normalizeJobKind('other'), /INVALID_JOB_KIND/);
assert.equal(avatarCloud.isTemporarySourceFile('cloud://space/pet-avatar/input/pet/job/source-1.jpg'), true);
assert.equal(avatarCloud.isTemporarySourceFile('cloud://space/pet-avatar/output/pet/job/candidate.png'), false);
assert.deepEqual(avatarCloud.evaluateEntitlement('free', 0), { allowed: true, pool: 'free', used: 0, limit: 3, remaining: 3, bypass: false });
assert.equal(avatarCloud.evaluateEntitlement('free', 2).allowed, true);
assert.equal(avatarCloud.evaluateEntitlement('free', 3).allowed, false);
assert.deepEqual(avatarCloud.evaluateEntitlement('member', 0), { allowed: true, pool: 'member', used: 0, limit: 10, remaining: 10, bypass: false });
assert.equal(avatarCloud.evaluateEntitlement('member', 9).allowed, true);
assert.equal(avatarCloud.evaluateEntitlement('member', 10).allowed, false);
assert.equal(avatarCloud.evaluateEntitlement('free', 99, true).allowed, true);

const cloudSource = fs.readFileSync(path.join(root, 'uniCloud-alipay/cloudfunctions/api_pet_avatar/index.js'), 'utf8');
assert.match(cloudSource, /buildOrderedFileIds\(jobKind, styleFileId, currentResultFileId, providerReferenceFileIds\)/, 'centralized image order');
assert.match(cloudSource, /recordType: 'candidate'/, 'candidate history is persisted');
assert.match(cloudSource, /status: 'SUCCEEDED', resultSaved: true/, 'only saved success consumes quota');
assert.match(cloudSource, /FREE_SUCCESS_LIMIT = 3/);
assert.match(cloudSource, /MEMBER_SUCCESS_LIMIT = 10/);
assert.match(cloudSource, /candidateStatus: 'finalized'/, 'selected candidate becomes a finalized record before cleanup');
assert.match(cloudSource, /recordType: 'candidate',[\s\S]{0,80}petHash,[\s\S]{0,80}jobId: selectedJobId/, 'confirm query excludes the active lock');
assert.match(cloudSource, /cleanupPending: true/, 'cleanup failure is recoverable');
assert.match(cloudSource, /cleanupConfirmedSession/, 'confirmed candidate cleanup is centralized');

const schema = JSON.parse(fs.readFileSync(path.join(root, 'uniCloud-alipay/database/pet_avatar_jobs.schema.json'), 'utf8'));
for (const field of ['jobKind', 'parentJobId', 'revisionText', 'revisionBBox', 'seed', 'quotaOwnerHash', 'entitlementCycleKey', 'generationSessionId', 'candidateStatus', 'confirmed', 'confirmedAt', 'finalFileId', 'cutoutFileId', 'cutoutStatus']) {
  assert.ok(schema.properties[field], `schema field ${field}`);
}
assert.equal(schema.properties.revisionText.maxLength, 300);

const avatarPage = fs.readFileSync(path.join(root, 'pages/avatar-generate/avatar-generate.vue'), 'utf8');
assert.match(avatarPage, /v-for="index in 3"/);
assert.doesNotMatch(avatarPage, />拍照<|>再选一张</, 'no legacy large source buttons');
assert.match(avatarPage, /revisionText/);
assert.match(avatarPage, /candidates/);
assert.match(avatarPage, /clearAvatarGenerationSession/);

const welcomePage = fs.readFileSync(path.join(root, 'pages/welcome/welcome.vue'), 'utf8');
assert.doesNotMatch(welcomePage, /chooseImage|uploadPhoto|photo-panel/, 'Step 1 does not select photos');
assert.match(welcomePage, /petType/);
assert.match(welcomePage, /petGender/);

const particlePage = fs.readFileSync(path.join(root, 'components/PetGenerationParticlesLegacy.vue'), 'utf8');
for (const marker of ["createParticle('far')", "createParticle('mid')", "createParticle('front')", 'setGlobalCompositeOperation', 'monitorPerformance', 'reduceMotion']) {
  assert.match(particlePage, new RegExp(marker.replace(/[()'.]/g, '\\$&')));
}
const particleSelector = fs.readFileSync(path.join(root, 'components/PetGenerationParticles.vue'), 'utf8');
const scanGrid = fs.readFileSync(path.join(root, 'components/PetGenerationScanGrid.vue'), 'utf8');
assert.match(particleSelector, /DEFAULT_GENERATION_EFFECT = 'scan-grid'/);
assert.match(particleSelector, /resolvedVariant === 'legacy-orbit'/);
for (const marker of ['gaussian(distance, spread)', 'scanX', 'waveY', 'completionMix', 'motionReduced']) assert.match(scanGrid, new RegExp(marker.replace(/[()'.]/g, '\\$&')));

const home = fs.readFileSync(path.join(root, 'pages/home/home.vue'), 'utf8');
assert.match(home, /PetAvatarHero/);
assert.doesNotMatch(home, /<image[^>]+class="hero-pet-image"/, 'home no longer renders a square raw Hero image directly');

const zh = fs.readFileSync(path.join(root, 'locale/zh-Hans.js'), 'utf8');
const en = fs.readFileSync(path.join(root, 'locale/en.js'), 'utf8');
for (const key of ['revisionTitle', 'memberTitle', 'resultFirst1']) {
  assert.match(zh, new RegExp(`${key}:`));
  assert.match(en, new RegExp(`${key}:`));
}

console.log('pet avatar V2 tests passed');
