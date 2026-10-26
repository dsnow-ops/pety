'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
global.uniCloud = {
  database() {
    return { collection() { return {}; } };
  }
};

const avatar = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/index.js').__test;

test('provider diagnostics hide credentials and signed links even in approved development output', () => {
 const response=avatar.safeResponseError({code:'WAN_REQUEST_FAILED',providerMessage:'https://asset.invalid/a?token=private Bearer synthetic-private api_key=secret-value sk-abcdefghijklmnopqrstuv'},true);
 assert.doesNotMatch(response.providerErrorMessage,/asset\.invalid|synthetic-private|secret-value|sk-abcdefghijkl/);
 const source=fs.readFileSync(path.join(root,'uniCloud-alipay/cloudfunctions/api_pet_avatar/index.js'),'utf8');
 assert.match(source,/diagnosticsAllowed = Boolean\(config\.isDevelopment && config\.devMemberBypassUids\.includes\(admittedIdentity\.uid\)\)/);
});

test('provider task failure keeps the exact safe billing/quota diagnostic', () => {
  const failure = avatar.getWanFailureDetails({
    request_id: 'req-safe-123',
    output: {
      task_status: 'FAILED',
      code: 'AllocationQuota.FreeTierOnly',
      message: 'Free tier quota has been exhausted.'
    }
  });
  assert.deepEqual(failure, {
    errorCode: 'ALLOCATIONQUOTA_FREETIERONLY',
    providerErrorCode: 'AllocationQuota.FreeTierOnly',
    providerErrorMessage: 'Free tier quota has been exhausted.',
    providerRequestId: 'req-safe-123'
  });
});

test('provider submission failure preserves provider code without exposing it in production copy', () => {
  const providerError = Object.assign(new Error('account is in arrears'), {
    code: 'WAN_REQUEST_FAILED',
    statusCode: 403,
    providerCode: 'Arrearage',
    providerMessage: 'account is in arrears',
    providerRequestId: 'req-arrearage'
  });
  const failure = avatar.getWanRequestFailureDetails(providerError);
  assert.equal(failure.errorCode, 'ARREARAGE');
  assert.equal(failure.providerErrorCode, 'Arrearage');
  const production = avatar.safeResponseError(providerError, false);
  assert.equal(production.message, '形象生成暂时没有完成，请稍后再试');
  assert.equal(production.providerErrorCode, undefined);
  const development = avatar.safeResponseError(providerError, true);
  assert.equal(development.providerErrorCode, 'Arrearage');
  assert.equal(development.providerRequestId, 'req-arrearage');
  assert.equal(development.httpStatus, 403);
});

test('workbench stores provider diagnostics and exposes a development five-tap failure panel', () => {
  const client = fs.readFileSync(path.join(root, 'common/pet-avatar-generator.js'), 'utf8');
  const page = fs.readFileSync(path.join(root, 'pages/avatar-generate/avatar-generate.vue'), 'utf8');
  assert.match(client, /providerErrorCode: String\(raw\.providerErrorCode/);
  assert.match(client, /providerRequestId: result\.providerRequestId/);
  assert.match(page, /@click="handleGenerationFailureDebugTap"/);
  assert.match(page, /PROVIDER CODE:/);
  assert.match(page, /PROVIDER MESSAGE:/);
  assert.match(page, /REQUEST ID:/);
  assert.match(client, /AVATAR_SOURCE_UPLOAD_MAX_ATTEMPTS = 3/);
  assert.match(client, /persistAvatarSourceImages/);
  assert.match(page, /@error="onSourcePhotoError\(index - 1\)"/);
  assert.match(page, /this\.requestGeneration\(this\.pendingJobKind \|\| 'initial'\)/);
});

test('every new initial-generation composition receipt field is declared in the strict job schema', () => {
  const schema = JSON.parse(fs.readFileSync(path.join(root, 'uniCloud-alipay/database/pet_avatar_jobs.schema.json'), 'utf8'));
  for (const field of ['compositionVersion', 'requestedSize', 'poseVerification']) {
    assert.ok(schema.properties[field], `${field} must be deployable before createJob writes it`);
  }
  const cloud = fs.readFileSync(path.join(root, 'uniCloud-alipay/cloudfunctions/api_pet_avatar/index.js'), 'utf8');
  assert.match(cloud, /compositionVersion: COMPOSITION_VERSION/);
  assert.match(cloud, /requestedSize: MASTER_SIZE/);
  assert.match(cloud, /poseVerification: 'NOT_VISUALLY_VERIFIED'/);
});
