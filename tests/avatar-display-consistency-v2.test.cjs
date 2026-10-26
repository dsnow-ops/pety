'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { PNG } = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/node_modules/pngjs');
const { inspectTransparentPng } = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/storage');
const root = path.resolve(__dirname, '..');
const { ownedMediaCloud, clientUni } = require('./fixtures/owned-media-cloud.cjs');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const defer = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function resolver(getTempFileURL) {
  const source = read('common/avatar-display-asset.js').replace(/export /g, '');
  return Function('uniCloud', 'uni', `${source}; return {resolvePetHeroAsset, hydratePetHeroAsset, invalidateAvatarUrl, clearAvatarDisplayAssetCache};`)(ownedMediaCloud(getTempFileURL), clientUni);
}
const metadata = { width: 1024, height: 1024, bytes: 12000, mime: 'image/png', hasAlpha: true, qualityVersion: 2, qualified: true };
const pet = id => ({ id, generatedAvatarFileId: `cloud://space/${id}/job/final.png`, generatedAvatarMainAssetMetadata: metadata });
const withCutout = id => ({ ...pet(id), generatedAvatarCutoutFileId: `cloud://space/${id}/job/cutout.png`, generatedAvatarCutoutAlphaValid: true, generatedAvatarCutoutStatus: 'SUCCEEDED', generatedAvatarCutoutMetrics: metadata });
const result = url => ({ fileList: [{ tempFileURL: url }] });

test('cold start ignores persisted URLs and old generation cutouts', async () => {
  const d = resolver(async ({ fileList }) => result(`https://fresh.test/${fileList[0]}`));
  const p = { ...withCutout('88'), generatedAvatarCutoutFileId: 'cloud://space/88/old/cutout.png', generatedAvatarCutoutUrl: 'https://old.test/pet', generatedAvatarUrl: 'https://old.test/final' };
  assert.equal(d.resolvePetHeroAsset(p).imageUrl, '');
  assert.equal(d.resolvePetHeroAsset(p).assetKind, 'final');
  assert.match(d.resolvePetHeroAsset(p).fallbackReason, /MASTER_MISMATCH/);
  await d.hydratePetHeroAsset(p);
  assert.match(d.resolvePetHeroAsset(p).imageUrl, /fresh/);
  assert.equal(d.resolvePetHeroAsset(pet('99')).imageUrl, '');
  assert.equal(d.resolvePetHeroAsset({ id: 'legacy', generatedAvatarUrl: 'https://old.test/pet' }).imageUrl, '');
  assert.equal(d.resolvePetHeroAsset({ ...p, generatedAvatarDerivedFromFileId: p.generatedAvatarFileId }).assetKind, 'final', 'binding cannot bless a cutout from a different storage generation');
});

test('late hydration cannot contaminate switched pet or replaced master cache', async () => {
  const pending = defer(); const d = resolver(() => pending.promise);
  const a = pet('A'), b = pet('B');
  const task = d.hydratePetHeroAsset(a);
  d.clearAvatarDisplayAssetCache('A');
  pending.resolve(result('https://late.test/A')); await task;
  assert.equal(d.resolvePetHeroAsset(b).imageUrl, '');
  assert.equal(d.resolvePetHeroAsset(a).imageUrl, '', 'invalidated in-flight cache cannot resurrect');
  assert.equal(d.resolvePetHeroAsset({ ...a, generatedAvatarFileId: 'new-final' }).imageUrl, '');
});

test('all consumers share URL recovery, fallback and restored remote priority', async () => {
  let remoteBroken = false, version = 1;
  const d = resolver(async ({ fileList }) => {
    if (remoteBroken && fileList[0].endsWith('cutout.png')) throw Error('expired');
    return result(`https://fresh.test/${version}/${fileList[0]}`);
  });
  const p = withCutout('88');
  const initial = await d.hydratePetHeroAsset(p);
  assert.equal(initial.assetKind, 'viapi-cutout');
  remoteBroken = true;
  d.invalidateAvatarUrl(p.id, initial.displayFileId, initial.imageUrl);
  const recovered = await d.hydratePetHeroAsset(p);
  assert.equal(recovered.assetKind, 'final');
  for (let consumer = 0; consumer < 5; consumer++) {
    assert.equal(d.resolvePetHeroAsset(p).imageUrl, recovered.imageUrl);
    assert.match(d.resolvePetHeroAsset(p).fallbackReason, /URL_UNAVAILABLE/);
  }
  remoteBroken = false; version++;
  d.clearAvatarDisplayAssetCache(p.id, p.generatedAvatarCutoutFileId);
  await d.hydratePetHeroAsset(p);
  assert.equal(d.resolvePetHeroAsset(p).assetKind, 'viapi-cutout');
});

test('expired signed URL and repeated broken image URL cannot be reused', async () => {
  let calls = 0;
  const d = resolver(async () => result(++calls === 1 ? 'https://asset.test/img?Expires=1' : 'https://asset.test/good'));
  const p = pet('A');
  assert.equal((await d.hydratePetHeroAsset(p)).assetKind, 'placeholder');
  d.clearAvatarDisplayAssetCache(p.id);
  const loaded = await d.hydratePetHeroAsset(p);
  d.invalidateAvatarUrl(p.id, loaded.displayFileId, loaded.imageUrl);
  assert.equal((await d.hydratePetHeroAsset(p)).assetKind, 'placeholder');
  assert.equal(d.resolvePetHeroAsset(p).imageUrl, '');
});

test('qualified local beats final; alpha flag alone, low resolution and feather never do', () => {
  const d = resolver(async () => result(''));
  const p = { ...pet('A'), generatedAvatarLocalCutoutFileId: 'cloud://space/A/job/local.png', generatedAvatarLocalCutoutAlphaValid: true, generatedAvatarLocalCutoutMetrics: metadata };
  assert.equal(d.resolvePetHeroAsset(p).assetKind, 'local-cutout');
  for (const metrics of [{ ...metadata, qualityVersion: 0 }, { ...metadata, hasAlpha: false }, { ...metadata, width: 512 }, { ...metadata, qualified: false }]) {
    assert.equal(d.resolvePetHeroAsset({ ...p, generatedAvatarLocalCutoutMetrics: metrics, generatedAvatarFeatheredDisplayFileId: 'feather' }).assetKind, 'final');
  }
});

function alphaFixture(kind, edge = 1024) {
  const png = new PNG({ width: edge, height: edge });
  for (let y = 0; y < edge; y++) for (let x = 0; x < edge; x++) {
    const offset = (y * edge + x) * 4;
    const radius = Math.hypot(x - edge * .5, y - edge * .5);
    let alpha = Math.round(Math.max(0, Math.min(1, (edge * .32 - radius) / 3)) * 255);
    if (kind === 'hard') alpha = radius < edge * .32 ? 255 : 0;
    if (kind === 'clipped') alpha = x < edge * .5 ? 255 : 0;
    if (kind === 'fragmented') alpha = Math.min(Math.hypot(x - edge * .25, y - edge * .5), Math.hypot(x - edge * .75, y - edge * .5)) < edge * .19 ? 255 : 0;
    png.data[offset] = 150; png.data[offset + 1] = 100; png.data[offset + 2] = 75; png.data[offset + 3] = alpha;
  }
  return PNG.sync.write(png);
}

test('real PNG mask gate accepts compressed soft alpha and rejects hard/clipped/fragmented/small masks', () => {
  const good = alphaFixture('soft');
  assert.ok(good.length < 65536, 'compression bytes are not a sharpness threshold');
  const inspection = inspectTransparentPng(good);
  assert.equal(inspection.qualified, true);
  assert.equal(inspection.hasAlpha, true);
  for (const [kind, reason] of [['hard', 'HARD_ALPHA_EDGE'], ['clipped', 'SUBJECT_TOUCHES_BORDER'], ['fragmented', 'FRAGMENTED_SUBJECT']]) {
    const bad = inspectTransparentPng(alphaFixture(kind));
    assert.equal(bad.qualified, false); assert.equal(bad.fallbackReason, reason);
  }
  assert.equal(inspectTransparentPng(alphaFixture('soft', 256)).fallbackReason, 'DERIVATIVE_TOO_SMALL');
});

test('store rejects stale derived patches, clears old master assets and preserves active legacy cache', async () => {
  const data = new Map();
  global.uni = { getStorageSync: key => data.get(key), setStorageSync: (key, val) => data.set(key, val), removeStorageSync: key => data.delete(key) };
  const store = await import('../common/pet-store.js');
  store.addPet({ ...withCutout('A'), name: 'A', photo: 'A.jpg' });
  store.addPet({ ...pet('B'), name: 'B', photo: 'B.jpg' });
  store.updatePet('A', { name: 'A edited' });
  assert.equal(data.get('pet_name'), 'B'); assert.equal(data.get('pet_photo'), 'B.jpg');
  const old = pet('A').generatedAvatarFileId;
  const next = store.updatePet('A', { generatedAvatarFileId: 'new-final' });
  assert.equal(next.generatedAvatarCutoutFileId, ''); assert.equal(next.generatedAvatarUrl, '');
  assert.equal(next.generatedAvatarCutoutMetrics, null);
  assert.equal(store.updatePet('A', { generatedAvatarDerivedFromFileId: old, generatedAvatarCutoutFileId: 'stale' }), null);
  assert.equal(store.getPetList().find(p => p.id === 'A').generatedAvatarFileId, 'new-final');
  store.updatePet('B', {
    generatedAvatarHeroGenerationStatus: 'FAILED',
    generatedAvatarHeroGenerationVersion: 'hero-character-magenta-v2',
    generatedAvatarHeroGenerationPhase: 'SUBMISSION_FAILED',
    generatedAvatarHeroGenerationErrorCode: 'HTTP_400',
    generatedAvatarCutoutErrorCode: 'HTTP_400',
    generatedAvatarHeroProviderSourceMetadata: { mime: 'image/jpeg', width: 1280, height: 1280, alphaChannel: false }
  });
  const restored = store.getActivePet();
  assert.equal(restored.generatedAvatarHeroGenerationStatus, 'FAILED');
  assert.equal(restored.generatedAvatarHeroGenerationVersion, 'hero-character-magenta-v2');
  assert.equal(restored.generatedAvatarHeroGenerationPhase, 'SUBMISSION_FAILED');
  assert.equal(restored.generatedAvatarHeroGenerationErrorCode, 'HTTP_400');
  assert.equal(restored.generatedAvatarCutoutErrorCode, 'HTTP_400');
  assert.deepEqual(restored.generatedAvatarHeroProviderSourceMetadata, { mime: 'image/jpeg', width: 1280, height: 1280, alphaChannel: false });
});

function component(file, bindings = {}) {
  const script = read(file).match(/<script[^>]*>([\s\S]*?)<\/script>/)[1].replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g, '').replace('export default', 'return');
  return Function(...Object.keys(bindings), script)(...Object.values(bindings));
}
test('Hero crossfade lasts through opacity transition and stale image events cannot reveal old pet', () => {
  let timerDelay, finish;
  const hero = component('components/PetAvatarHero.vue', { lightHaptic() {}, clearTimeout() {}, setTimeout(fn, ms) { finish = fn; timerDelay = ms; return 1; } });
  const vm = Object.assign({ petId: 'A', imageUrl: 'cutout', hasCutout: true, reduceMotion: false, $emit() {} }, hero.methods);
  Object.assign(vm, hero.data.call(vm), { previousImageUrl: 'final', assetIdentity: 'A::cutout' });
  vm.onCurrentLoaded({ currentTarget: { dataset: { identity: 'B::old', url: 'old' } } });
  assert.equal(vm.currentReady, false);
  vm.onCurrentLoaded({ currentTarget: { dataset: { identity: 'A::cutout', url: 'cutout', generation: 0 } } });
  assert.equal(vm.currentReady, true); assert.equal(vm.previousImageUrl, 'final'); assert.equal(timerDelay, 640);
  finish(); assert.equal(vm.previousImageUrl, '');
  hero.watch.petId.call(vm, 'B', 'A'); assert.equal(vm.currentReady, false); assert.equal(vm.previousImageUrl, '');
  vm.reduceMotion = true; vm.motionReduced = true; vm.offsetX = 0; vm.offsetY = 0;
  vm.onTouchMove({ touches: [{ clientX: 100, clientY: 100 }] });
  assert.equal(vm.offsetX, 0); assert.equal(vm.offsetY, 0);
  assert.deepEqual(hero.computed.assetTransformStyle.call(vm), {});
});

test('shared surfaces and stable square workbench retain master resolution and diagnostics', () => {
  for (const page of ['profile', 'archive', 'chat']) assert.match(read(`pages/${page}/${page}.vue`), /<PetAvatarImage/);
  assert.equal((read('pages/profile/profile.vue').match(/<PetAvatarImage/g) || []).length, 2);
  const home = read('pages/home/home.vue');
  assert.match(home, /return resolveHeroVisualAsset\(pet\)/);
  assert.doesNotMatch(home, /CONFIRMED_MASTER_HANDOFF/);
  for (const field of ['HERO SOURCE', 'PET', 'FILE', 'WIDTH', 'HEIGHT', 'BYTES', 'MIME', 'ALPHA', 'qualified', 'fallbackReason']) assert.ok(home.includes(field));
  const workbench = read('pages/avatar-generate/avatar-generate.vue');
  assert.match(workbench, /aspect-ratio: 1 \/ 1/);
  assert.match(workbench, /PetPortraitStage/);
  assert.doesNotMatch(workbench, /mode="scaleToFill"/);
  assert.match(workbench, /this\.visibleResultUrl = this\.preloadCandidateUrl/);
});

test('five Hero taps expose source diagnostics even for placeholder', () => {
  let shown;
  const home = component('pages/home/home.vue', { HomeLifePreview:{},HomeAlbumCover:{},PetAvatarHero:{}, PetPortraitStage: {}, isDevelopmentEnvironment: () => true, getAvatarAssetHashPrefix: () => 'hash', uni: { showModal(value) { shown = value; } }, setTimeout() { return 1; }, clearTimeout() {} });
  const vm = Object.assign({}, home.methods, { activePet: { id: '88' }, avatarDebugTapCount: 0, homeHeroAsset: { assetKind: 'placeholder', assetMetadata: {} } });
  for (let index = 0; index < 4; index++) vm.handleHeroTap();
  assert.equal(shown, undefined);
  vm.handleHeroTap();
  assert.match(shown.content, /CURRENT PET: 88/);
  assert.match(shown.content, /sourceType: placeholder/);
  for (const field of ['FILE', 'WIDTH', 'HEIGHT', 'BYTES', 'MIME', 'hasAlpha', 'qualified', 'fallbackReason']) assert.ok(shown.content.includes(field));
});

test('force refresh clears transient unavailability and retries the newly issued same URL once',async()=>{
 let outage=true;const d=resolver(async()=>{if(outage)throw Object.assign(Error('offline'),{code:'NETWORK_DOWN'});return result('https://asset.test/signed')});const p=pet('recover');
 assert.equal((await d.hydratePetHeroAsset(p)).assetKind,'placeholder');outage=false;
 const asset=await d.hydratePetHeroAsset(p,{forceRefresh:true});assert.equal(asset.imageUrl,'https://asset.test/signed');assert.equal(asset.fallbackReason.includes('URL_UNAVAILABLE'),false);
 d.invalidateAvatarUrl(p.id,asset.displayFileId,asset.imageUrl);
 assert.equal((await d.hydratePetHeroAsset(p,{forceRefresh:true})).imageUrl,'https://asset.test/signed');
 assert.equal((await d.hydratePetHeroAsset(p,{forceRefresh:true,excludedFileIds:[asset.displayFileId]})).assetKind,'placeholder');
});

test('private confirmed assets resolve URLs through the owned cloud action, not client storage permissions',async()=>{
 const source=read('common/avatar-display-asset.js').replace(/export /g,'');let called=0;
 const p={...pet('private'),generatedAvatarCutoutJobId:'job',generatedAvatarFileId:'cloud://space/pet-avatar/final/private/job/final.png'};
 const d=Function('uniCloud',source+';return {hydratePetHeroAsset};')({getTempFileURL:async()=>{throw Error('client private-storage access must not be used')},callFunction:async request=>{called++;assert.equal(request.data.action,'getAvatarDisplayUrls');assert.equal(request.data.petId,p.id);assert.equal(request.data.expectedFinalFileId,p.generatedAvatarFileId);return {result:{code:0,fileList:[{tempFileURL:'https://owned.test/final'}]}}}});
 assert.equal((await d.hydratePetHeroAsset(p)).imageUrl,'https://owned.test/final');assert.equal(called,1);
});
