'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const hash = value => crypto.createHash('sha256').update(String(value)).digest('hex');

test('failed v2 pets submit v3 Hero before nullable legacy derivative metrics can abort the job', async () => {
  const petId = 'hero-provider-v2-pet';
  const jobId = 'confirmed-job';
  const petHash = hash(petId).slice(0, 24);
  const finalFileId = `cloud://space/pet-avatar/final/${petHash}/${jobId}/final.png`;
  const files = new Map([[finalFileId, fs.readFileSync(path.join(__dirname, 'fixtures', 'user-cat-hero-generated-v1.png'))]]);
  const record = {
    _id: 'candidate-v2', recordType: 'candidate', petHash, jobId,
    quotaOwnerHash: hash('uid:test-user'), confirmed: true, finalFileId,
    cutoutStatus: 'PENDING', cutoutInvocationCount: 0,
    cutoutEngine: 'hero-character-magenta-v3', cutoutPipelineVersion: 6,
    displayDerivativeStatus: 'PENDING', localCutoutMetrics: null,
    heroProviderSourceMetadata: null
  };
  const updates = [];
  let receiptWriteFailures = 0;
  const replace = value => ({ __databaseReplace: value });
  const applyPatch = patch => {
    if (patch.cutoutProviderJobId === 'hero-task-v3' && receiptWriteFailures++ === 0) {
      throw Object.assign(new Error('transient receipt write failure'), { code: 'ECONNRESET' });
    }
    const normalized = {};
    Object.entries(patch).forEach(([key, value]) => {
      if (value && value.__databaseReplace) normalized[key] = value.__databaseReplace;
      else {
        if (record[key] === null && value && typeof value === 'object' && !Array.isArray(value)) {
          const error = new Error(`CODE_100104_ERROR_WRITE_EXCEPTION_WRITE_ERRORS_CANNOT_CREATE_FIELDS_${Object.keys(value)[0] || key}`);
          error.code = 'CODE_100104_ERROR_WRITE_EXCEPTION';
          throw error;
        }
        normalized[key] = value;
      }
    });
    updates.push(normalized); Object.assign(record, normalized);
  };
  const matches = query => Object.entries(query).every(([key, value]) => record[key] === value);
  const collection = {
    where(query) {
      return {
        limit() { return { get: async () => ({ data: matches(query) ? [record] : [] }) }; },
        async update(patch) {
          if (!matches(query)) return { updated: 0 };
          applyPatch(patch); return { updated: 1 };
        }
      };
    },
    doc() {
      return {
        async update(patch) { applyPatch(patch); return { updated: 1 }; },
        async get() { return { data: [record] }; }
      };
    }
  };
  global.uniCloud = {
    database: () => ({ collection: () => collection, command: { set: replace } }),
    downloadFile: async ({ fileID }) => ({ fileContent: files.get(fileID) }),
    uploadFile: async ({ cloudPath, fileContent }) => {
      const fileId = `cloud://space/${cloudPath}`;
      files.set(fileId, fileContent);
      return { fileID: fileId };
    },
    getTempFileURL: async ({ fileList }) => ({ fileList: fileList.map(fileId => ({ fileID:fileId, tempFileURL: `https://fixture.invalid/${encodeURIComponent(fileId)}` })) })
  };

  let submitted = null;
  const wanPath = require.resolve('../uniCloud-alipay/cloudfunctions/api_pet_avatar/wan-client.js');
  const apiPath = require.resolve('../uniCloud-alipay/cloudfunctions/api_pet_avatar/index.js');
  const wan = require(wanPath);
  const costBudget = require('../uniCloud-alipay/cloudfunctions/common/pety-auth/cost-budget');
  const originalReserve = costBudget.reserve;
  costBudget.reserve = async input => { assert.equal(input.uid, 'test-user'); assert.equal(input.feature, 'avatar'); return { reserved: true }; };
  const originalCreate = wan.createWanTask;
  wan.createWanTask = async (config, prompt, imageUrls, options) => {
    submitted = { prompt, imageUrls, options };
    return { taskId: 'hero-task-v3', taskStatus: 'PENDING', requestId: 'request-v3' };
  };
  delete require.cache[apiPath];
  try {
    const api = require(apiPath).__test;
    const { startAvatarCutout } = api;
    const context = await require('./fixtures/authorize-avatar-context.cjs')(api, 'test-user');
    const response = await startAvatarCutout({
      petId, selectedJobId: jobId, aiConsentAccepted: true, aiConsentVersion: 1, aiConsentScopes: ['pet_avatar']
    }, {
      apiKey: 'fixture-key', workspaceId: 'fixture-workspace', region: 'cn-beijing', model: 'wan2.7-image-pro',
      size: '2K', n: 1, watermark: false, requestTimeoutMs: 25000, heroChromaEnabled: true, isDevelopment: false, viapiEnabled: false
    }, context);

    assert.equal(response.code, 0);
    assert.equal(record.cutoutInvocationCount, 1);
    assert.equal(record.cutoutProviderJobId, 'hero-task-v3');
    assert.equal(record.heroGenerationVersion, 'hero-character-magenta-v3');
    assert.equal(record.heroGenerationPhase, 'PROVIDER_ACCEPTED');
    assert.equal(record.heroProviderSourceMetadata.mime, 'image/jpeg');
    assert.equal(record.heroProviderSourceMetadata.alphaChannel, false);
    assert.ok(record.heroProviderSourceFileId.endsWith('/hero-provider-source.jpg'));
    const providerBytes = files.get(record.heroProviderSourceFileId);
    assert.equal(providerBytes[0], 0xff); assert.equal(providerBytes[1], 0xd8);
    assert.deepEqual(submitted.options, { seed: record.seed || submitted.options.seed, size: '2048*2048', n: 1, watermark: false, enableSequential: false });
    assert.equal(receiptWriteFailures, 2, 'accepted receipt is retried without generating again');
    assert.equal(submitted.imageUrls.length, 1);
    assert.ok(updates.some(update => update.heroGenerationStatus === 'SUBMITTING' && update.heroGenerationPhase === 'PREPARING_OPAQUE_SOURCE'));
    assert.ok(updates.some(update => update.heroGenerationPhase === 'SUBMITTING_PROVIDER'));
    assert.equal(record.displayDerivativeStatus, 'PENDING');
    assert.equal(record.localCutoutMetrics, null);
    assert.equal(updates.some(update => Object.prototype.hasOwnProperty.call(update, 'localCutoutMetrics')), false);
  } finally {
    costBudget.reserve = originalReserve;
    wan.createWanTask = originalCreate;
    delete require.cache[apiPath];
  }
});
