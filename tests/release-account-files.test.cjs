const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const baseline = process.env.PETY_RELEASE_BASELINE === '1' ? 'unpackage/release-sprint-20261010/baseline/source/' : '';
const root = baseline + 'uni_modules/uni-id-pages/uniCloud/cloudfunctions/uni-id-co/module/account/';
function fixture({ avatar = 'cloud://isolated-space/user/isolated-A/avatar.png', ext = true, uid = 'isolated-A', outage = false } = {}) {
  const signed = [], uploaded = [], reads = [];
  const cloud = { database: () => ({ collection(name) { assert.equal(name, 'uni-id-users'); return { doc(id) {
    reads.push(id); assert.equal(id, uid); return { field() { return this; }, async get() { if (outage) throw Error('isolated DB outage'); return { data: [{ avatar_file: { url: avatar } }] }; } };
  } }; } }), getTempFileURL: async ({ fileList }) => { signed.push(...fileList); return { fileList: [{ tempFileURL: 'https://isolated.invalid/temporary' }] }; } };
  const storage = { isExtStorageEnabled: () => ext, getExtStorageManager: () => ({
    getTempFileURL: async ({ fileList }) => { signed.push(...fileList); return { fileList: [{ tempFileURL: 'https://isolated.invalid/temporary' }] }; },
    getUploadFileOptions: async ({ cloudPath }) => { uploaded.push(cloudPath); return { cloudPath, fileID: 'qiniu://isolated/' + cloudPath, uploadFileOptions: { isolated: true } }; }
  }) };
  function load(file) { const module = { exports: {} }; vm.runInNewContext(fs.readFileSync(root + file, 'utf8'), {
    module, uniCloud: cloud, require: name => name === '../../common/error' ? { ERROR: { INVALID_PARAM: 'INVALID_PARAM' } } : name === 'crypto' ? require('node:crypto') : storage
  }, { filename: root + file }); return module.exports; }
  const ctx = { authInfo: uid ? { uid } : {}, config: { service: { storage: { mode: ext ? 'ext' : 'builtin' } } } };
  return { signed, uploaded, reads, url: fileID => load('get-temp-file-url.js').call(ctx, { fileID }), upload: cloudPath => load('get-upload-file-options.js').call(ctx, { cloudPath }) };
}
test('legacy account URL handler rejects foreign and unknown cloud/ext/http files before signing', async () => {
  const f = fixture();
  for (const id of ['cloud://isolated-space/user/isolated-B/private.png', 'qiniu://isolated/user/isolated-B/private.png',
    'cloud://isolated-space/user/isolated-A/unknown.png', 'https://isolated.invalid/foreign.png', 'http://isolated.invalid/foreign.png']) {
    await assert.rejects(f.url(id), e => e.errCode === 'pety-file-access-denied');
  }
  assert.equal(f.signed.length, 0);
});
test('legacy account URL handler preserves the exact own stored cloud/ext avatar', async () => {
  for (const avatar of ['cloud://isolated-space/user/isolated-A/avatar.png', 'qiniu://isolated/user/isolated-A/avatar.png']) {
    const f = fixture({ avatar }); const result = await f.url(avatar);
    assert.equal(result.errCode, 0); assert.equal(result.tempFileURL, 'https://isolated.invalid/temporary');
    assert.deepEqual(f.signed, [avatar]); assert.deepEqual(f.reads, ['isolated-A']);
  }
});
test('saved foreign avatar pointer cannot bless another account cloud/ext storage object', async () => {
  for (const avatar of ['cloud://isolated-space/user/avatar/isolated-B/foreign.png', 'qiniu://isolated/user/avatar/isolated-B/foreign.png']) {
    const f = fixture({ avatar }); await assert.rejects(f.url(avatar), e => e.errCode === 'pety-file-access-denied');
    assert.equal(f.signed.length, 0);
  }
});
test('legacy account HTTP avatar is returned only when saved as the current account avatar', async () => {
  for (const avatar of ['https://isolated.invalid/own.png', 'http://isolated.invalid/own.png']) {
    const f = fixture({ avatar }); assert.equal((await f.url(avatar)).tempFileURL, avatar);
    await assert.rejects(f.url(avatar + '?foreign=1')); assert.equal(f.signed.length, 0);
  }
});
test('legacy account signing denies missing identity and database outage without provider calls', async () => {
  for (const config of [{ uid: '' }, { outage: true }]) {
    const f = fixture(config); await assert.rejects(f.url('cloud://isolated-space/user/isolated-A/avatar.png'));
    assert.equal(f.signed.length, 0);
  }
});
test('legacy avatar upload rewrites client foreign/overwrite/traversal paths into fresh own immutable names', async () => {
  const f = fixture();
  for (const candidate of ['user/isolated-B/avatar.png', '../../user/isolated-B/private.JPG', 'user/avatar/isolated-A/existing.jpeg']) {
    const result = await f.upload(candidate);
    assert.match(result.cloudPath, /^user\/avatar\/isolated-A\/[a-f0-9]{32}\.(png|jpg|jpeg)$/);
    assert.notEqual(result.cloudPath, candidate); assert.equal(f.uploaded.at(-1), result.cloudPath);
  }
  assert.equal(new Set(f.uploaded).size, 3);
});
test('builtin avatar uploads also receive server-owned paths without requesting ext signatures', async () => {
  const f = fixture({ ext: false }); const result = await f.upload('user/isolated-B/avatar.png');
  assert.equal(result.mode, 'builtin'); assert.match(result.cloudPath, /^user\/avatar\/isolated-A\/[a-f0-9]{32}\.png$/);
  assert.equal(f.uploaded.length, 0);
});
test('legacy avatar upload rejects unsafe identity, formats and huge input before signing', async () => {
  for (const uid of ['', '../isolated-B', { claimed: 'isolated-A' }]) {
    const f = fixture({ uid }); await assert.rejects(f.upload('avatar.png')); assert.equal(f.uploaded.length, 0);
  }
  const f = fixture(); for (const candidate of ['avatar.svg', 'avatar.png.exe', 'avatar', 'x'.repeat(251) + '.png', { path: 'avatar.png' }]) {
    await assert.rejects(f.upload(candidate));
  }
  assert.equal(f.uploaded.length, 0);
});
