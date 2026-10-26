const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs');
const { dataRuntime, moduleFrom } = require('../scripts/lib/health-recovery-runtime.cjs');
function setup() {
  const io = dataRuntime(), pending = [], released = [], navigation = [];
  let active = { id: 'TEST-P1', relationshipStage: 'current' };
  const { eventTimeLabel, narrativeMode } = moduleFrom('common/narrative-store.js', 'eventTimeLabel,narrativeMode', { scopedStorage: io.storage, captureDataScope: io.scope });
  const views = moduleFrom('common/record-views.js', 'queryRecords,lifeText,lifePhotos,safeForRecall', { eventTimeLabel });
  const deps = { ...views, narrativeMode, getNarrativeStore: id => io.creative(id), captureDataScope: io.scope,
    isDataScopeCurrent: scope => scope?.ready && scope.namespace === io.scope().namespace && scope.version === io.scope().version,
    getActivePet: () => active, resolveNarrativePhoto: asset => new Promise(resolve => pending.push({ asset, resolve })),
    releaseNarrativePhoto: url => released.push(url), uni: { navigateTo: args => navigation.push(args.url) } };
  const source = fs.readFileSync('components/HomeLifePreview.vue', 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1]
    .replace(/^import[^;]+;\s*/gm, '').replace('export default', 'return');
  const component = Function(...Object.keys(deps), source)(...Object.values(deps));
  const vm = { ...component.data(), pet: active, $emit() {} };
  for (const [key, method] of Object.entries(component.methods)) vm[key] = method.bind(vm);
  for (const [key, get] of Object.entries(component.computed)) Object.defineProperty(vm, key, { get: get.bind(vm) });
  const save = (text, extra = {}, pet = 'TEST-P1') => {
    const store = io.creative(pet), draft = store.create('current');
    return store.save({ ...draft, original: text, localDate: '2026-10-22', ...extra });
  };
  const photo = { id: 'TEST-photo', purpose: 'life', durable: true, namespace: 'guest:local', petId: 'TEST-P1' };
  return { io, vm, component, save, photo, pending, released, navigation, select(pet) { active = pet; vm.pet = pet; } };
}
test('Home reads saved originals and legacy daily life without copying data or presenting candidates, hidden/care records or drafts', () => {
  const s = setup();
  s.save('TEST 原始生活', { candidate: 'AI candidate never shown', text: 'accepted text not original' });
  s.save('TEST 隐藏', { hidden: true }); s.save('TEST 用药与就医');
  s.save('TEST other pet', {}, 'TEST-P2');
  const d = s.io.creative('TEST-P1').create('current'); d.original = 'TEST 未保存草稿'; s.io.creative('TEST-P1').saveDraft(d);
  s.io.storage.setStorageSync('pet_diaries_TEST-P1', { '2026-10-21': { dailyVersion: 1, relationshipStage: 'current', lifeText: 'TEST 旧日常', updatedAt: 1 } });
  const before = JSON.stringify([...s.io.disk]); s.vm.load();
  assert.equal(s.vm.total, 2); assert.equal(s.vm.excerpt, 'TEST 原始生活');
  assert.equal(JSON.stringify([...s.io.disk]), before); assert.equal(s.pending.length, 0);
  assert.doesNotMatch(JSON.stringify(s.vm.records), /TEST 隐藏|TEST 用药|未保存草稿|other pet/);
  s.vm.openRecord(); assert.match(s.navigation[0], /narrative\/narrative\?id=/);
  s.io.creative('TEST-P1').remove(s.vm.record.id); s.vm.openRecord();
  assert.equal(s.navigation.length, 1); assert.equal(s.vm.excerpt, 'TEST 旧日常');
});
test('Memorial requires an explicit open and releases a late photo when the user closes the memory', async () => {
  const s = setup(); s.save('TEST 自己的回忆', { media: [s.photo] }); s.select({ id: 'TEST-P1', relationshipStage: 'deceased' });
  s.vm.load(); assert.equal(s.vm.opened, false); assert.equal(s.pending.length, 0);
  s.vm.openMemory(); assert.equal(s.vm.opened, true); assert.equal(s.pending.length, 1);
  s.vm.closeMemory(); s.pending[0].resolve({ path: 'blob:TEST-late' }); await new Promise(setImmediate);
  assert.equal(s.vm.photo, ''); assert.deepEqual(s.released, ['blob:TEST-late']);
  assert.equal(s.vm.opened, false); assert.equal(s.navigation.length, 0);
});
test('Late image resolutions cannot reappear after switching pet, account or unmounting the Home preview', async () => {
  for (const change of ['pet', 'account', 'unmount']) {
    const s = setup(); s.save('TEST private original', { media: [s.photo] }); s.vm.load();
    assert.equal(s.pending.length, 1);
    if (change === 'pet') { s.select({ id: 'TEST-P2', relationshipStage: 'current' }); s.vm.load(); }
    if (change === 'account') { s.io.login('TEST-B'); s.vm.load(); }
    if (change === 'unmount') s.component.beforeUnmount.call(s.vm);
    s.pending[0].resolve({ path: 'blob:TEST-previous-owner' }); await new Promise(setImmediate);
    assert.equal(s.vm.photo, ''); assert.equal(s.vm.records.length, 0);
    assert.deepEqual(s.released, ['blob:TEST-previous-owner']); s.vm.openRecord(); assert.equal(s.navigation.length, 0);
  }
});
