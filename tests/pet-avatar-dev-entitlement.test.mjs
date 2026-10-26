import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const storage = new Map();
let cloudCalls = 0;
let lastCreatePayload = null;

globalThis.PETY_AVATAR_IS_DEVELOPMENT = true;
globalThis.PETY_AVATAR_DEV_MEMBER_BYPASS = true;
globalThis.uni = {
  getStorageSync(key) { return storage.get(key); },
  setStorageSync(key, value) { storage.set(key, value); },
  removeStorageSync(key) { storage.delete(key); }
};
globalThis.uniCloud = {
  database() { return { collection() { return {}; } }; },
  async callFunction(request) {
    cloudCalls += 1;
    lastCreatePayload = request && request.data;
    if (lastCreatePayload.action === 'getEntitlement') return { result: { code: 0,
      entitlement: { allowed: false, bypass: false, tier: 'free', remaining: 0 } } };
    return { result: { code: 0, jobId: `job-${cloudCalls}`, taskStatus: 'PENDING' } };
  }
};

const entitlementModule = await import('../common/avatar-generation-entitlement.js');
const {
  getAvatarGenerationEntitlement,
  resolveAvatarDevEntitlementBypass
} = entitlementModule;

assert.equal(resolveAvatarDevEntitlementBypass({ isDevBuild: true, envFlag: true }), true);
assert.equal(resolveAvatarDevEntitlementBypass({ isDevBuild: true, envFlag: false }), false);
assert.equal(resolveAvatarDevEntitlementBypass({ isDevBuild: false, envFlag: true }), false);

const viteSource = fs.readFileSync(path.join(root, 'vite.config.js'), 'utf8');
assert.match(viteSource, /const isAvatarDevelopment = mode === 'development'/);
assert.match(viteSource, /allowAvatarMemberBypass\s*=\s*\n\s*isAvatarDevelopment\s*&&/);

const devEntitlement = await getAvatarGenerationEntitlement('pet-quota');
assert.deepEqual(devEntitlement, { allowed: false, bypass: false, tier: 'free', remaining: 0 });
assert.equal(cloudCalls, 1, 'development builds must still obtain the server decision');
assert.equal(lastCreatePayload.petId, 'pet-quota');
assert.equal(lastCreatePayload.devEntitlementBypassRequested, true);

const consent = await import('../common/ai-consent.js');
const avatarClient = await import('../common/pet-avatar-generator.js');
consent.acceptAiConsent('zh-Hans');
for (const jobKind of ['initial', 'regenerate', 'revision']) {
  const petId = `pet-dev-${jobKind}`;
  await avatarClient.createAvatarJob({ id: petId }, {
    sourceFileIds: [`cloud://space/pet-avatar/input/${petId}/source-1.jpg`],
    jobKind,
    parentJobId: jobKind === 'revision' ? 'parent-job' : '',
    currentResultFileId: jobKind === 'revision' ? 'cloud://space/pet-avatar/output/current.png' : '',
    revisionText: jobKind === 'revision' ? '保留身份，只调整局部细节' : ''
  });
  assert.equal(lastCreatePayload.jobKind, jobKind);
  assert.equal(lastCreatePayload.devEntitlementBypassRequested, true);
}

const cloudIndexPath = path.join(root, 'uniCloud-alipay/cloudfunctions/api_pet_avatar/index.js');
const cloudSource = fs.readFileSync(cloudIndexPath, 'utf8');
const { __test: avatarCloud } = require(cloudIndexPath);

assert.equal(avatarCloud.resolveDevMemberBypassConfig('', false), false);
assert.equal(avatarCloud.resolveDevMemberBypassConfig('', true), true);
assert.equal(avatarCloud.resolveDevMemberBypassConfig('true', false), true);
assert.equal(avatarCloud.resolveDevMemberBypassConfig('false', true), false);
assert.deepEqual(
  avatarCloud.getDevMemberBypassDecision({ devEntitlementBypassRequested: true }, { devMemberBypass: false }),
  { requested: true, serverEnabled: false, applied: false }
);
assert.deepEqual(
  avatarCloud.getDevMemberBypassDecision({ devEntitlementBypassRequested: false }, { devMemberBypass: true }),
  { requested: false, serverEnabled: true, applied: false }
);
assert.deepEqual(
  avatarCloud.getDevMemberBypassDecision({ devEntitlementBypassRequested: true }, { devMemberBypass: true }),
  { requested: true, serverEnabled: true, applied: false }
);
const authorizeFixture = require('./fixtures/authorize-avatar-context.cjs');
const developerContext = await authorizeFixture(avatarCloud, 'allowlisted-developer');
const devConfig = {devMemberBypass:true,isDevelopment:true,devMemberBypassUids:['allowlisted-developer'],devMemberBypassExpiresAt:Date.now()+60000,devMemberBypassScopes:['avatar-generation']};
assert.equal(avatarCloud.getDevMemberBypassDecision({devEntitlementBypassRequested:true},devConfig,developerContext).applied,true);
assert.equal(avatarCloud.getDevMemberBypassDecision({devEntitlementBypassRequested:true},{...devConfig,isDevelopment:false},developerContext).applied,false);
assert.equal(avatarCloud.getDevMemberBypassDecision({devEntitlementBypassRequested:true},{...devConfig,devMemberBypassUids:[]},developerContext).applied,false);
assert.equal(avatarCloud.getDevMemberBypassDecision({devEntitlementBypassRequested:true},devConfig,{uid:'allowlisted-developer'}).applied,false);

assert.equal(avatarCloud.evaluateEntitlement('free', 3).allowed, false);
assert.equal(avatarCloud.evaluateEntitlement('free', 10).allowed, false);
assert.equal(avatarCloud.evaluateEntitlement('free', 3, true).allowed, true);
assert.equal(avatarCloud.evaluateEntitlement('free', 10, true).allowed, true);
assert.equal(avatarCloud.evaluateEntitlement('member', 9).allowed, true);
assert.equal(avatarCloud.evaluateEntitlement('member', 10).allowed, false);

const createJobSource = cloudSource.match(/async function createJob[\s\S]*?\n}\n\nasync function getJobStatus/)[0];
assert.ok(createJobSource.indexOf('assertConsent(event)') < createJobSource.indexOf('resolveEntitlement(context, config, event)'));
assert.match(createJobSource, /ACTIVE_JOB_EXISTS/);
assert.match(createJobSource, /getCandidateDocument\(petHash, parentJobId, identity\.quotaOwnerHash\)/);
assert.match(createJobSource, /buildOrderedFileIds\(jobKind, styleFileId, currentResultFileId, providerReferenceFileIds\)/);

const configExample = JSON.parse(fs.readFileSync(
  path.join(root, 'uniCloud-alipay/cloudfunctions/api_pet_avatar/config.example.json'),
  'utf8'
));
assert.equal(configExample.devMemberBypass, false);

const { buildAvatarPrompt } = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/avatar-prompt.js');
const basePrompt = buildAvatarPrompt(3);
assert.equal(
  crypto.createHash('sha256').update(basePrompt).digest('hex'),
  'd4bc2b10df557435b9386d9b015cde348b9a4ff9da90d80f06dc08b40fa3a378'
);
assert.deepEqual(
  avatarCloud.buildOrderedFileIds('revision', 'style-reference', 'current-result', ['source-1']),
  ['current-result']
);

console.log('pet avatar development entitlement tests passed');
