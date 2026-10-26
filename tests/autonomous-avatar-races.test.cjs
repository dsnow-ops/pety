'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const root = path.resolve(__dirname, '..');
const testScope={namespace:'guest:local',version:0,ready:true};
function loadPage(file, bindings = {}) {
  bindings={captureDataScope:()=>testScope,isDataScopeCurrent:s=>s===testScope,...bindings};
  const script = fs.readFileSync(path.join(root, file), 'utf8').match(/<script[^>]*>([\s\S]*?)<\/script>/)[1]
    .replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g, '').replace('export default', 'return');
  return Function(...Object.keys(bindings), script)(...Object.values(bindings));
}
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function workbench() {
  const timers = new Map(); let timerId = 0;
  const page = loadPage('pages/avatar-generate/avatar-generate.vue', {
    resolveWorkbenchMasterAsset: Function(fs.readFileSync(path.join(root, 'common/workbench-master-asset.js'), 'utf8').replace(/export /g, '') + ';return resolveWorkbenchMasterAsset;')(),
    AiDataConsentSheet: {}, PetPortraitStage: {}, PetGenerationParticles: {}, getAppLocale: () => 'en', isReduceMotionEnabled: () => false, isAvatarFileCacheEnabled: () => false,
    setTimeout: callback => { timers.set(++timerId, callback); return timerId; }, clearTimeout: id => timers.delete(id), lightHaptic() {}
  });
  const vm = Object.assign(page.data(), page.methods, { pet: { id: 'test-pet' }, copy: { jobFailed: 'Please try again' }, refreshEntitlement() {} });
  return { vm, timers };
}
test('latest candidate owns hydration, image events and reveal timer without rebuilding history', async () => {
  const { vm, timers } = workbench();
  const a = deferred(), b = deferred();
  vm.candidates = [{ jobId: 'A', fileId: 'A' }, { jobId: 'B', fileId: 'B' }];
  const history = vm.candidates;
  vm.visibleResultUrl = 'old'; vm.phase = 'result';
  vm.hydrateCandidateFile = c => c.jobId === 'A' ? a.promise : b.promise;
  const first = vm.beginCandidatePreload(vm.candidates[0], { preserveWorkbench: true });
  const second = vm.beginCandidatePreload(vm.candidates[1], { preserveWorkbench: true });
  b.resolve('url-B'); await second; a.resolve('url-A'); await first;
  assert.equal(vm.previewJobId, 'B'); assert.equal(vm.preloadCandidateUrl, 'url-B');
  vm.onResultPreloaded({ currentTarget: { dataset: { requestId: 1 } } });
  vm.onResultPreloadFailed({ currentTarget: { dataset: { requestId: 1 } } });
  assert.equal(vm.resultStage, 'RESULT_LOADING'); assert.equal(vm.preloadFailed, false);
  vm.onResultPreloaded({ currentTarget: { dataset: { requestId: 2 } } });
  assert.equal(vm.visibleResultUrl, 'url-B');
  const staleReveal = [...timers.values()][0];
  vm.candidateUrlCache.set('A', 'url-A');
  await vm.beginCandidatePreload(vm.candidates[0], { preserveWorkbench: true });
  staleReveal();
  assert.equal(vm.resultStage, 'RESULT_LOADING'); assert.equal(vm.preloadCandidateUrl, 'url-A');
  assert.equal(vm.candidates, history);
});
test('preload failure has bounded waiting and unload cannot resurrect the result', async () => {
  const { vm, timers } = workbench();
  const pending = deferred(); vm.hydrateCandidateFile = () => pending.promise;
  const work = vm.beginCandidatePreload({ jobId: 'A', fileId: 'A' });
  assert.equal(vm.phase, 'loading');
  [...timers.values()][0](); assert.equal(vm.preloadFailed, true);
  vm.pageDisposed = true; pending.resolve('late'); await work;
  assert.equal(vm.visibleResultUrl, ''); assert.equal(vm.preloadCandidateUrl, '');
});
test('confirm is unavailable before selected master finishes loading', () => {
  const { vm } = workbench(); vm.pet = { id: 'A' }; vm.selectedCandidate = { jobId: 'B' };
  vm.resultStage = 'RESULT_LOADING';
  assert.doesNotThrow(() => vm.useGeneratedAvatar());
});
test('cutout and hydration responses cannot write into another pet or a newer final', async () => {
  let active = { id: 'A', generatedAvatarCutoutJobId: 'job-A', generatedAvatarFileId: 'final-A' };
  const start = deferred(), hydrate = deferred(); let writes = 0;
  const page = loadPage('pages/home/home.vue', {
    HomeAlbumCover:{},PetAvatarHero:{}, PetPortraitStage: {}, getActivePet: () => active, startAvatarCutout: () => start.promise,
    prepareAvatarHeroDisplay: async () => null,
    updateActivePet: patch => { writes++; active = { ...active, ...patch }; return active; },
    hydrateHeroVisualAsset: () => hydrate.promise
  });
  const vm = Object.assign({}, page.methods, { loadedDataScope:testScope,activePet: { ...active, generatedAvatarCutoutStatus: 'PENDING' }, pageVisible: true, heroRequestId: 0, logAvatarDisplay() {} });
  const pending = vm.refreshPendingAvatarAsset();
  active = { id: 'B', generatedAvatarCutoutJobId: 'job-B' }; vm.activePet = active;
  start.resolve({ cutoutFileId: 'cutout-A' }); await pending;
  assert.equal(writes, 0);
  const owner = active;
  const applying = vm.applyAvatarAssetResult({ cutoutStatus: 'SUCCEEDED' }, owner);
  active = { ...active, generatedAvatarCutoutJobId: 'new-B' }; vm.activePet = active;
  hydrate.resolve({ petId: 'B', imageUrl: 'old-B' }); await applying;
  assert.equal(vm.hydratedHeroAsset, undefined);
});
