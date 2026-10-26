import assert from 'node:assert/strict';

const storage = new Map();
globalThis.uni = {
  getStorageSync(key) { return storage.get(key); },
  setStorageSync(key, value) { storage.set(key, value); },
  removeStorageSync(key) { storage.delete(key); },
  setLocale() {},
  setTabBarItem() {}
};
globalThis.uniCloud = {
  async callFunction({ data }) {
    assert.equal(data.action, 'getGenerationSession');
    assert.equal(data.aiConsentAccepted, true);
    assert.equal(data.aiConsentVersion, 1);
    assert.ok(data.aiConsentScopes.includes('pet_avatar'));
    return {
      result: {
        code: 0,
        activeJob: {
          jobId: 'wan-recovered', requestId: 'request-recovered', taskStatus: 'RUNNING',
          jobKind: 'regenerate', generationSessionId: data.generationSessionId, seed: 42
        },
        candidates: []
      }
    };
  }
};

const consent = await import('../common/ai-consent.js');
const avatar = await import('../common/pet-avatar-generator.js');
consent.acceptAiConsent('zh-Hans');
const session = avatar.ensureAvatarGenerationSession('pet-restart', { sourceFileIds: ['cloud://source'] });
assert.equal(avatar.getStoredAvatarJob('pet-restart'), null);

const recoveredSession = await avatar.refreshAvatarGenerationSession('pet-restart');
const recoveredJob = avatar.getStoredAvatarJob('pet-restart');
assert.equal(recoveredJob.jobId, 'wan-recovered');
assert.equal(recoveredJob.status, 'RUNNING');
assert.equal(recoveredJob.generationSessionId, session.sessionId);
assert.equal(recoveredSession.activeJobId, 'wan-recovered');

console.log('avatar restart recovery tests passed');
