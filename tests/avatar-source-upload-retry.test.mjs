import assert from 'node:assert/strict';
import test from 'node:test';

const storage = new Map();
globalThis.uni = {
  getStorageSync(key) { return storage.get(key); },
  setStorageSync(key, value) { storage.set(key, value); },
  removeStorageSync(key) { storage.delete(key); },
  saveFile({ tempFilePath, success }) { success({ savedFilePath: `saved://${tempFilePath}` }); }
};

let attempts = 0;
globalThis.uniCloud = {
  async callFunction({data}) { return {result:data.action==='issueSourceUpload'
    ? {code:0,ticketId:'isolated-ticket',cloudPath:'pet-avatar/input/pet-a/source-1.jpg'}
    : {code:0,fileId:data.fileId}}; },
  async uploadFile() {
    attempts += 1;
    if (attempts < 3) throw new Error('oss upload return false');
    return { fileID: 'cloud://space/pet-avatar/input/pet-a/source-1.jpg' };
  }
};

const consent = await import('../common/ai-consent.js');
const avatar = await import('../common/pet-avatar-generator.js');
consent.acceptAiConsent('zh-Hans');

test('selected temporary photos are persisted before a generation can outlive the picker cache', async () => {
  assert.deepEqual(
    await avatar.persistAvatarSourceImages(['temp-a.jpg', 'temp-b.jpg']),
    ['saved://temp-a.jpg', 'saved://temp-b.jpg']
  );
});

test('source upload retries transient OSS false responses and returns the durable file id', async () => {
  attempts = 0;
  const progress = [];
  const fileIds = await avatar.uploadAvatarSourceImages({ id: 'pet-a' }, ['local.jpg'], (index, value) => progress.push([index, value]));
  assert.equal(attempts, 3);
  assert.deepEqual(fileIds, ['cloud://space/pet-avatar/input/pet-a/source-1.jpg']);
  assert.deepEqual(progress, [[0, 0], [0, 0]]);
});

test('source upload exposes a stable stage and exact safe cause after retries are exhausted', async () => {
  attempts = 0;
  globalThis.uniCloud.uploadFile = async () => {
    attempts += 1;
    throw new Error('oss upload return false');
  };
  await assert.rejects(
    () => avatar.uploadAvatarSourceImages({ id: 'pet-b' }, ['local.jpg']),
    error => error.code === 'AVATAR_SOURCE_UPLOAD_FAILED'
      && error.stage === 'SOURCE_UPLOAD'
      && error.attempts === 3
      && error.providerErrorCode === 'UNICLOUD_OSS_UPLOAD_FAILED'
      && /oss upload return false/.test(error.providerErrorMessage)
  );
  assert.equal(attempts, 3);
});
