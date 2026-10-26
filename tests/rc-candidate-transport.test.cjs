const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function setup() {
  const state = new Map([
    ['pet_avatar_job_cat', { petId: 'cat', jobId: 'new', status: 'RUNNING' }],
    ['pet_avatar_session_cat', { petId: 'cat', activeJobId: 'new', selectedJobId: 'current' }]
  ]);
  const before = JSON.stringify([...state]);
  let release;
  let scope = { version: 0 };
  const result = { code: 0, status: 'SUCCEEDED', generatedFileId: 'old-file', generatedTempUrl: 'https://test.invalid/old', generatedThumbnailFileId: 'old-thumb', generatedThumbnailUrl: 'https://test.invalid/thumb' };
  const bindings = {
    uni: { getStorageSync: key => key === 'uni_id_token' ? 'official-test-token' : undefined },
    scopedStorage: { getStorageSync: k => state.get(k), setStorageSync: (k, v) => state.set(k, v), removeStorageSync: k => state.delete(k) },
    captureDataScope: () => scope,
    assertDataScope: s => { if (s !== scope) throw new Error('DATA_SCOPE_CHANGED'); },
    hasAiConsent: () => true, buildAiConsentPayload: () => ({}),
    uniCloud: { callFunction: ({data}) => new Promise((r, reject) => { release = () => {
      try { assert.equal(data.uniIdToken, 'official-test-token'); assert.equal(data.action, 'getCandidateDisplayUrls'); assert.equal(data.expectedFileId, 'old-file'); r({ result }); }
      catch (error) { reject(error); }
    }; }) }
  };
  const source = fs.readFileSync('common/pet-avatar-generator.js', 'utf8').replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g, '').replace(/export /g, '');
  const api = Function(...Object.keys(bindings), source + ';return { readAvatarCandidateTransport: typeof readAvatarCandidateTransport === "function" ? readAvatarCandidateTransport : (petId, candidate) => getAvatarJobStatus(petId, candidate.jobId) };')(...Object.values(bindings));
  return { api, result, release: () => release(), changeOwner: () => scope = { version: 1 }, unchanged: () => assert.equal(JSON.stringify([...state]), before) };
}
const candidate = { jobId: 'old', fileId: 'old-file', generatedThumbnailFileId: 'old-thumb' };

test('historical candidate transport lookup never overwrites the running job or generation session', async () => {
  const s = setup();
  const request = s.api.readAvatarCandidateTransport('cat', candidate);
  s.release();
  const value = await request;
  s.unchanged();
  assert.equal(value.generatedFileId, candidate.fileId);
  assert.equal(value.jobId, candidate.jobId);
});

test('candidate transport rejects another master and rejects an owner change without local writes', async () => {
  const mismatch = setup(); mismatch.result.generatedFileId = 'other-file';
  const request = mismatch.api.readAvatarCandidateTransport('cat', candidate);
  mismatch.release(); await assert.rejects(request, /CANDIDATE_ASSET_CHANGED/); mismatch.unchanged();
  const changed = setup(); const late = changed.api.readAvatarCandidateTransport('cat', candidate);
  changed.changeOwner(); changed.release(); await assert.rejects(late, /DATA_SCOPE_CHANGED/); changed.unchanged();
});
