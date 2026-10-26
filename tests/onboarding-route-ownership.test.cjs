'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
function loadPage(file, bindings = {}) {
  bindings={scopedStorage:bindings.uni,...bindings};
  const script = fs.readFileSync(path.join(root, file), 'utf8')
    .match(/<script[^>]*>([\s\S]*?)<\/script>/)[1]
    .replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g, '')
    .replace('export default', 'return');
  return Function(...Object.keys(bindings), script)(...Object.values(bindings));
}

function welcomeHarness(activePet = null, options = {}) {
  const navigation = [];
  const stored = new Map();
  let selectedPetId = '';
  let loggedIn = options.loggedIn !== false, created = 0;
  const intent = Function(fs.readFileSync(path.join(root, 'common/pet-creation-intent.js'), 'utf8').replace(/export /g, '') + ';return {beginPetCreationIntent,takePetCreationIntent}')();
  const newPet = { id: 'pet/new id', name: '新宝贝', avatarStatus: 'ready', generatedAvatarFileId: 'must-not-skip-upload' };
  const uni = {
    switchTab(options) { navigation.push({ kind: 'tab', url: options.url }); },
    redirectTo(options) { navigation.push({ kind: 'redirect', url: options.url }); },
    navigateTo(options) { navigation.push({ kind: 'push', url: options.url }); },
    reLaunch(options) { navigation.push({ kind: 'relaunch', url: options.url }); },
    setStorageSync(key, value) { stored.set(key, value); },
    showToast() {}
  };
  const page = loadPage('pages/welcome/welcome.vue', {
    addPet: patch => { created++; Object.assign(newPet, patch); return newPet; },
    isLoggedIn: () => loggedIn,
    ...intent,
    getActivePet: () => activePet,
    setActivePet: id => { selectedPetId = id; return id === newPet.id ? newPet : activePet; },
    updateActivePet: () => activePet,
    canCreateAnotherPet: () => options.access || ({ allowed: true }),
    savePetProfile() {},
    getPetProfile: () => ({}),
    getPetRelationshipStage: () => 'current',
    withRelationshipStage: value => value,
    getDefaultAvatarStyle: () => 'pety',
    getAppLocale: () => 'zh-Hans',
    t: key => key,
    uni
  });
  const state = page.data();
  const vm = Object.assign(state, page.methods, {
    copy: { namePlaceholder: '请输入名字', otherPlaceholder: '请输入类型', saveFailed: '保存失败' }
  });
  return { page, vm, navigation, stored, intent, login: () => { loggedIn = true; }, created: () => created, getSelectedPetId: () => selectedPetId };
}

test('normal app entry bypasses the creation form when an active pet already exists', () => {
  const oldPet = { id: 'old', name: '旧宠', avatarStatus: 'ready', generatedAvatarFileId: 'old-final' };
  const { page, vm, navigation } = welcomeHarness(oldPet);
  page.onLoad.call(vm, {});
  page.onShow.call(vm);
  assert.equal(vm.entryMode, 'auto');
  assert.deepEqual(navigation, [{ kind: 'tab', url: '/pages/home/home' }]);
});

test('explicit creation owns the new pet and always opens its photo-upload workbench', () => {
  const oldPet = { id: 'old', name: '旧宠', avatarStatus: 'ready', generatedAvatarFileId: 'old-final' };
  const { page, vm, navigation, getSelectedPetId } = welcomeHarness(oldPet);
  page.onLoad.call(vm, { mode: 'create' });
  page.onShow.call(vm);
  vm.petName = '新宝贝';
  vm.continueToAvatar();
  assert.equal(getSelectedPetId(), 'pet/new id');
  assert.deepEqual(navigation, [{ kind: 'redirect', url: '/pages/avatar-generate/avatar-generate?petId=pet%2Fnew%20id' }]);
});

test('avatar workbench writes upload status by its routed pet id', () => {
  const source = fs.readFileSync(path.join(root, 'pages/avatar-generate/avatar-generate.vue'), 'utf8');
  assert.match(source, /const routedPet = setActivePet\(requestedPetId\)/);
  assert.match(source, /updatePet\(this\.pet\.id, \{ originalPhotoUrl:/);
  assert.match(source, /updatePet\(this\.pet\.id, \{ avatarStatus: 'failed'/);
  assert.doesNotMatch(source, /updateActivePet\(/);
});

test('first creation waits for login, then creates exactly once from the unfinished form and opens generation', () => {
  const h = welcomeHarness(null, { loggedIn: false });
  h.page.onLoad.call(h.vm, {mode:'create'}); h.page.onShow.call(h.vm);
  Object.assign(h.vm, {petName:'TEST 团子',petType:'other',petTypeCustom:'兔子',petGender:'female'});
  h.vm.continueToAvatar(); h.vm.continueToAvatar();
  assert.equal(h.created(), 0); assert.equal(h.navigation.length,1);
  const destination = decodeURIComponent(h.navigation[0].url.split('uniIdRedirectUrl=')[1]);
  const params = Object.fromEntries(new URLSearchParams(destination.split('?')[1]));
  h.login(); Object.assign(h.vm, h.page.data()); h.page.onLoad.call(h.vm, params); h.page.onShow.call(h.vm);
  assert.equal(h.created(),1); assert.equal(h.vm.petName,'TEST 团子');assert.equal(h.vm.petTypeCustom,'兔子');assert.equal(h.vm.petGender,'female');
  assert.deepEqual(h.navigation.at(-1), {kind:'relaunch',url:'/pages/avatar-generate/avatar-generate?petId=pet%2Fnew%20id'});
  h.page.onShow.call(h.vm); assert.equal(h.created(),1);
  assert.equal(h.intent.takePetCreationIntent(params.resume),null);
});

test('cancel login preserves the form without creating a guest pet or auto-resuming', () => {
  const h=welcomeHarness(null,{loggedIn:false});h.page.onLoad.call(h.vm,{mode:'create'});h.page.onShow.call(h.vm);
  h.vm.petName='TEST 未完成';h.vm.continueToAvatar();h.page.onShow.call(h.vm);
  assert.equal(h.vm.petName,'TEST 未完成');assert.equal(h.created(),0);assert.equal(h.vm.isSaving,false);
  h.vm.continueToAvatar();assert.equal(h.navigation.length,2);
});

test('resumed creation rechecks account pet limits; no duplicate or overwritten pet', () => {
  const h=welcomeHarness({id:'old',name:'旧宠'}, {access:{allowed:false,reason:'membership_required'}});
  const target=h.intent.beginPetCreationIntent({petName:'TEST 第二只'});
  h.page.onLoad.call(h.vm,Object.fromEntries(new URLSearchParams(target.split('?')[1])));h.page.onShow.call(h.vm);
  assert.equal(h.created(),0);assert.equal(h.vm.petName,'TEST 第二只');assert.equal(h.navigation.length,0);
});

test('lost or invalid creation intent falls back to the form without side effects', () => {
  const h=welcomeHarness();h.page.onLoad.call(h.vm,{mode:'create',resume:'missing'});h.page.onShow.call(h.vm);
  assert.equal(h.created(),0);assert.equal(h.navigation.length,0);assert.equal(h.vm.petName,'');
});
