import assert from 'node:assert/strict';

const storage = new Map();
let cloudCalls = 0;
globalThis.uni = {
  getStorageSync(key) { return storage.get(key); },
  setStorageSync(key, value) { storage.set(key, value); },
  removeStorageSync(key) { storage.delete(key); },
  setLocale() {},
  setTabBarItem() {}
};
globalThis.uniCloud = {
  async callFunction() {
    cloudCalls += 1;
    return { result: { code: 0, jobId: 'provider-job', taskStatus: 'PENDING' } };
  },
  async uploadFile() { throw new Error('upload should not run without consent'); }
};

const consent = await import('../common/ai-consent.js');
const avatar = await import('../common/pet-avatar-generator.js');
const i18n = await import('../common/i18n.js');

assert.equal(i18n.getAppLocale(), 'zh-Hans');
await assert.rejects(() => avatar.uploadAvatarSourceImages({ id: 'pet-a' }, ['local.jpg']), /AI_CONSENT_REQUIRED/);
consent.acceptAiConsent('zh-Hans');

avatar.saveAvatarJob({ petId: 'pet-a', jobId: 'job-a', status: 'RUNNING' });
avatar.saveAvatarJob({ petId: 'pet-b', jobId: 'job-b', status: 'PENDING' });
assert.equal(avatar.getStoredAvatarJob('pet-a').jobId, 'job-a');
assert.equal(avatar.getStoredAvatarJob('pet-b').jobId, 'job-b');

await avatar.createAvatarJob({ id: 'pet-a' }, { sourceFileIds: ['cloud://source-a'] });
assert.equal(cloudCalls, 0, 'resuming an active job must not create another provider task');

const currentPatch = avatar.saveGeneratedAvatar(
  { id: 'pet-a', relationshipStage: 'current', avatarStyle: 'soft3d' },
  { generatedFileId: 'cloud://result-a', generatedTempUrl: 'https://temp.example/a' }
);
const deceasedPatch = avatar.saveGeneratedAvatar(
  { id: 'pet-b', relationshipStage: 'deceased', avatarStyle: 'memorial' },
  { generatedFileId: 'cloud://result-b', generatedTempUrl: 'https://temp.example/b' }
);
assert.equal(currentPatch.avatarStatus, 'ready');
assert.equal(deceasedPatch.avatarStyle, 'memorial');
assert.equal(currentPatch.generatedAvatarFileId, 'cloud://result-a');
const offlineHydrationPatch = avatar.saveGeneratedAvatar(
  { id: 'pet-c', relationshipStage: 'current' },
  { generatedFileId: 'cloud://result-c', generatedTempUrl: '' }
);
assert.equal(offlineHydrationPatch.generatedAvatarFileId, 'cloud://result-c');
assert.equal(offlineHydrationPatch.generatedAvatarUrl, '');
assert.equal(offlineHydrationPatch.avatarStatus, 'ready');
console.log('pet avatar client V1 tests passed');
