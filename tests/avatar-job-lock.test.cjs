'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const documents = new Map();
const collection = {
  async add(document) {
    if (documents.has(document._id)) {
      const error = new Error('E11000 duplicate key');
      error.code = 'E11000';
      throw error;
    }
    documents.set(document._id, { ...document });
    return { id: document._id };
  },
  where(query) {
    return {
      async update(patch) {
        const document = documents.get(query._id);
        const matches = document && Object.entries(query).every(([key, value]) => document[key] === value);
        if (!matches) return { updated: 0 };
        documents.set(query._id, { ...document, ...patch });
        return { updated: 1 };
      }
    };
  }
};

global.uniCloud = {
  database() {
    return { collection() { return collection; } };
  }
};

const { acquireAvatarJobLock, recoverActiveAvatarJob } = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/index.js').__test;

test('simultaneous first creates produce one avatar lock owner', async () => {
  const lock = { status: 'CREATING', updatedAt: 1 };
  const results = await Promise.all([
    acquireAvatarJobLock('active_pet', null, lock),
    acquireAvatarJobLock('active_pet', null, lock)
  ]);
  assert.deepEqual(results.sort(), [false, true]);
  assert.equal(documents.get('active_pet').status, 'CREATING');
});

test('simultaneous stale replacements use compare-and-swap ownership', async () => {
  const stale = { _id: 'active_stale', status: 'FAILED', updatedAt: 2 };
  documents.set(stale._id, { ...stale });
  const nextLock = { status: 'CREATING', updatedAt: 3 };
  const results = await Promise.all([
    acquireAvatarJobLock(stale._id, stale, nextLock),
    acquireAvatarJobLock(stale._id, stale, nextLock)
  ]);
  assert.deepEqual(results.sort(), [false, true]);
  assert.equal(documents.get(stale._id).updatedAt, 3);
});

test('the same generation session resumes the paid provider job after client state loss', async () => {
  const active = {
    _id: 'active_pet', petHash: 'pet', quotaOwnerHash: 'owner', generationSessionId: 'session',
    jobKind: 'initial', jobId: 'wan-task', requestId: 'request', status: 'PENDING', seed: 7
  };
  const resumed = await recoverActiveAvatarJob(active, active._id, 'pet', 'session', 'owner', 'initial');
  assert.deepEqual(resumed, {
    code: 0, jobId: 'wan-task', requestId: 'request', taskStatus: 'PENDING',
    jobKind: 'initial', seed: 7, generationSessionId: 'session', resumed: true
  });
  assert.equal(await recoverActiveAvatarJob(active, active._id, 'pet', 'other-session', 'owner', 'initial'), null);
});
