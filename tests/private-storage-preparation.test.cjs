'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const { checkPrivateStorageConfig, createPrivateObjectDescriptor, createPrivateStoragePreparation } = require('../uniCloud-alipay/cloudfunctions/common/pety-auth/private-storage');
const client = Function(fs.readFileSync('common/private-storage-upload.js', 'utf8').replace(/export /g, '') + ';return uploadPrivateStorageFile')();
const expiry = Function(fs.readFileSync('common/private-storage-upload.js', 'utf8').replace(/export /g, '') + ';return privateStorageUrlExpiresAt')();
const cacheFactory = Function(fs.readFileSync('common/avatar-file-cache.js', 'utf8').replace(/export /g, '') + ';return createAvatarFileCache')();
const { PNG } = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/node_modules/pngjs');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const config = { enabled: true, provider: 'aliyun-oss', bucket: 'pety-local-fixture', region: 'cn-hangzhou',
  endpoint: 'https://pety-local-fixture.oss-cn-hangzhou.aliyuncs.com', accessKeyId: 'fixture-key', accessKeySecret: 'fixture-secret',
  bucketAcl: 'private', blockPublicAccess: true, versioning: 'Disabled', prefix: 'pety-private-v4',
  uploadTtlSeconds: 300, readTtlSeconds: 300, modelReadTtlSeconds: 900 };
function setup(options = {}) {
  let now = Date.parse('2026-10-14T00:00:00Z'), uid = 'synthetic-A', version = 1, readCalls = 0, inspections = 0;
  const owner = sha(uid), pet = 'a'.repeat(24);
  const descriptor = createPrivateObjectDescriptor(config, { owner, pet }, options.purpose || 'avatar-source', 'image/png', () => Buffer.alloc(24, 1));
  const row = { _id: 'ticket', owner, pet, ...descriptor, state: 'issued', expiresAt: now + 600000 };
  const image = new PNG({ width: 16, height: 16 }); image.data.fill(255);
  const bytes = PNG.sync.write(image);
  const inspected = { mime: 'image/png', bytes: bytes.length, width: 16, height: 16, sha256: sha(bytes) };
  const hooks = {
    clock: () => now, verifyRequest: async () => ({ uid, session: { version } }),
    checkTarget: async () => ({ bucket: config.bucket, region: config.region, bucketAcl: 'private', blockPublicAccess: true, versioning: 'Disabled' }),
    loadOwnedReceipt: async event => event.ticketId === row._id || event.fileId === row.fileId ? row : null,
    inspectObject: async (_storage, max) => { inspections++; assert.ok(bytes.length < max); const p = PNG.sync.read(bytes); return { ...inspected, width: p.width, height: p.height }; },
    signGet: async (storage, seconds) => {
      readCalls++;
      const date = new Date(now).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
      return `${config.endpoint}/${storage.key}?x-oss-date=${date}&x-oss-expires=${seconds}&x-oss-signature-version=OSS4-HMAC-SHA256&x-oss-signature=${'a'.repeat(64)}`;
    }
  };
  return { row, hooks, bytes, inspected, adapter: createPrivateStoragePreparation(config, hooks),
    changeOwner: () => { uid = 'synthetic-B'; version++; }, anonymous: () => { uid = null; },
    advance: ms => { now += ms; }, now: () => now, readCalls: () => readCalls, inspections: () => inspections };
}
test('local config cannot report READY; disabled, incomplete and unverified targets fail closed', async () => {
  assert.equal(checkPrivateStorageConfig(config).ready, false);
  assert.equal(checkPrivateStorageConfig(config).state, 'REMOTE_UNVERIFIED');
  const h = setup().hooks;
  await assert.rejects(createPrivateStoragePreparation({ ...config, enabled: false }, h).issueUpload({}), { code: 'PRIVATE_STORAGE_DISABLED' });
  await assert.rejects(createPrivateStoragePreparation({ ...config, accessKeySecret: '' }, h).issueUpload({}), { code: 'PRIVATE_STORAGE_CONFIG_INCOMPLETE' });
  await assert.rejects(createPrivateStoragePreparation(config, { ...h, checkTarget: undefined }).issueUpload({}), { code: 'PRIVATE_STORAGE_REMOTE_UNVERIFIED' });
  for (const versioning of ['Enabled', 'Suspended']) assert.equal(checkPrivateStorageConfig({ ...config, versioning }).configurationComplete, false);
});
test('private POST binds exact object, ACL, overwrite denial, MIME, size and expiration without leaking secret', async () => {
  const s = setup(), grant = await s.adapter.issueUpload({ ticketId: 'ticket', cloudPath: '../other', owner: 'B' });
  const policy = JSON.parse(Buffer.from(grant.formData.policy, 'base64').toString());
  const has = expected => policy.conditions.some(c => JSON.stringify(c) === JSON.stringify(expected));
  assert.ok(has(['eq', '$key', s.row.storage.key]));
  assert.ok(has(['eq', '$x-oss-object-acl', 'private']));
  assert.ok(has(['eq', '$x-oss-forbid-overwrite', 'true']));
  assert.ok(has(['eq', '$x-oss-content-type', 'image/png']));
  assert.ok(has(['content-length-range', 1, 20 * 1024 * 1024]));
  assert.equal(Date.parse(policy.expiration), grant.expiresAt);
  assert.equal(grant.expiresAt, s.now() + 300000);
  assert.ok(!JSON.stringify(grant).includes(config.accessKeySecret));
  assert.match(grant.formData['x-oss-signature'], /^[a-f0-9]{64}$/);
  // Verify using WebCrypto's independent HMAC implementation.
  async function hmac(key, value) { const k = await crypto.webcrypto.subtle.importKey('raw', Buffer.from(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return Buffer.from(await crypto.webcrypto.subtle.sign('HMAC', k, Buffer.from(value))); }
  let key = await hmac('aliyun_v4' + config.accessKeySecret, '20261014');
  for (const part of [config.region, 'oss', 'aliyun_v4_request']) key = await hmac(key, part);
  assert.equal((await hmac(key, grant.formData.policy)).toString('hex'), grant.formData['x-oss-signature']);
});
test('anonymous, other owner, stale receipt, wrong file and late revocation fail before publishing authorization', async () => {
  const a = setup(); a.anonymous(); await assert.rejects(a.adapter.issueUpload({ ticketId: 'ticket' }), { code: 'PRIVATE_STORAGE_LOGIN_REQUIRED' });
  const b = setup(); b.changeOwner(); await assert.rejects(b.adapter.issueUpload({ ticketId: 'ticket' }), { code: 'PRIVATE_STORAGE_NOT_OWNED' });
  const e = setup(); e.advance(700000); await assert.rejects(e.adapter.issueUpload({ ticketId: 'ticket' }), { code: 'PRIVATE_UPLOAD_EXPIRED' });
  const f = setup(); await assert.rejects(f.adapter.inspectUploaded({ ticketId: 'ticket', fileId: 'other' }), { code: 'PRIVATE_STORAGE_NOT_OWNED' }); assert.equal(f.inspections(), 0);
  const late = setup(); const inspect = late.hooks.inspectObject; late.hooks.inspectObject = async (...args) => { const r = await inspect(...args); late.changeOwner(); return r; };
  await assert.rejects(late.adapter.inspectUploaded({ ticketId: 'ticket', fileId: late.row.fileId }), { code: 'PRIVATE_STORAGE_SCOPE_CHANGED' });
  const unsafe = setup(); unsafe.hooks.checkTarget = async () => ({ ...await a.hooks.checkTarget(), bucketAcl: 'public-read' });
  await assert.rejects(unsafe.adapter.issueUpload({ ticketId: 'ticket' }), { code: 'PRIVATE_STORAGE_TARGET_UNSAFE' });
  const path = setup(); path.row.storage.key += '/../another.png';
  await assert.rejects(path.adapter.issueUpload({ ticketId: 'ticket' }), { code: 'PRIVATE_STORAGE_NOT_OWNED' });
  assert.throws(() => createPrivateObjectDescriptor(config, { owner: sha('synthetic'), pet: 'a'.repeat(24) }, 'toString', 'image/png'), { code: 'PRIVATE_OBJECT_INVALID' });
});
test('synthetic bytes are inspected, completion uses existing receipt and reads never silently return a public URL', async () => {
  const s = setup(); const r = await s.adapter.inspectUploaded({ ticketId: 'ticket', fileId: s.row.fileId });
  assert.equal(r.sha256, sha(s.bytes)); assert.equal(r.bytes, s.bytes.length); assert.equal(r.fileId, s.row.fileId);
  Object.assign(s.row, r, { state: 'ready' });
  await assert.rejects(s.adapter.issueUpload({ ticketId: 'ticket' }), { code: 'PRIVATE_UPLOAD_ALREADY_COMPLETE' });
  const read = await s.adapter.issueRead({ fileId: s.row.fileId }); assert.equal(read.fileId, r.fileId);
  s.hooks.signGet = async () => config.endpoint + '/' + s.row.storage.key;
  await assert.rejects(s.adapter.issueRead({ fileId: s.row.fileId }), { code: 'PRIVATE_STORAGE_SIGNING_FAILED' });
  assert.equal(s.row.state, 'ready');
});
test('model reads require existing job authorization and generated images cannot use client upload', async () => {
  const s = setup({ purpose: 'avatar-generated' });
  await assert.rejects(s.adapter.issueUpload({ ticketId: 'ticket' }), { code: 'PRIVATE_UPLOAD_SERVER_ONLY' });
  Object.assign(s.row, s.inspected, { state: 'ready' });
  await assert.rejects(s.adapter.issueRead({ fileId: s.row.fileId }, {}, 'job'), { code: 'PRIVATE_MODEL_READ_DENIED' });
  assert.equal(s.readCalls(), 0);
  s.hooks.authorizeModelJob = async (_auth, row, job) => row.fileId === s.row.fileId && job === 'synthetic-job';
  const read = await s.adapter.issueRead({ fileId: s.row.fileId }, {}, 'synthetic-job');
  assert.equal(read.expiresAt, s.now() + config.modelReadTtlSeconds * 1000);
  assert.equal(expiry(read.tempFileURL), read.expiresAt);
  assert.equal(expiry('https://synthetic.invalid/?Expires=1791936000'), 1791936000000);
  assert.equal(expiry('https://synthetic.invalid/?x-oss-expires=900'), null);
});
test('provider failures expose a stable error and preserve the completed receipt', async () => {
  const s = setup(); Object.assign(s.row, s.inspected, { state: 'ready' });
  s.hooks.signGet = async () => { throw Error('sensitive provider response'); };
  await assert.rejects(s.adapter.issueRead({ fileId: s.row.fileId }), error => error.code === 'PRIVATE_STORAGE_PROVIDER_UNAVAILABLE' && error.message === error.code);
  assert.equal(s.row.state, 'ready');
});
test('phone transport returns stable ID, ignores public Location and checks owner after transfer', async () => {
  const s = setup(), grant = await s.adapter.issueUpload({ ticketId: 'ticket' });
  const uploadFile = opts => { assert.equal(opts.url, config.endpoint); assert.equal(opts.name, 'file'); opts.success({ statusCode: 204, url: 'https://public.invalid/ignored' }); };
  assert.deepEqual(await client(grant, '/synthetic.png', { uploadFile, assertCurrent() {}, now: s.now }), { ticketId: 'ticket', fileId: s.row.fileId, requiresCompletion: true });
  let switched = false;
  await assert.rejects(client(grant, '/synthetic.png', { now: s.now, assertCurrent() { if (switched) throw Object.assign(Error('changed'), { code: 'ASSET_OWNER_CHANGED' }); }, uploadFile(opts) { switched = true; opts.success({ statusCode: 204 }); } }), { code: 'ASSET_OWNER_CHANGED' });
  await assert.rejects(client(grant, '/synthetic.png', { now: s.now, assertCurrent() {}, uploadFile(opts) { opts.success({ statusCode: 403, url: 'https://public.invalid' }); } }), { code: 'PRIVATE_UPLOAD_TRANSPORT_FAILED' });
  await assert.rejects(client({ ...grant, expiresAt: s.now() - 1 }, '/synthetic.png', { now: s.now, assertCurrent() {}, uploadFile() { throw Error('must not transmit'); } }), { code: 'PRIVATE_UPLOAD_GRANT_INVALID' });
});
test('existing persistent cache retains synthetic master across restart and URL expiry without a new cache system', async () => {
  const s = setup(); const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pety-private-storage-test-'));
  const indexPath = path.join(root, 'index.json'); let downloads = 0, owner = 'account:synthetic-A';
  const isCache = p => typeof p === 'string' && path.dirname(p) === root && path.basename(p).startsWith('saved-');
  const adapter = { namespace: () => owner, ownerVersion: () => owner === 'account:synthetic-A' ? 1 : 2,
    readIndex: () => fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath)) : null,
    writeIndex: data => fs.writeFileSync(indexPath, JSON.stringify(data)), isCachePath: isCache,
    async inspect(p) { const bytes = fs.readFileSync(p), png = PNG.sync.read(bytes); return { bytes: bytes.length, width: png.width, height: png.height, format: 'png', readable: true }; },
    async download(_url, progress) { downloads++; const p = path.join(root, 'temporary.png'); fs.writeFileSync(p, s.bytes); progress(s.bytes.length); return { path: p, statusCode: 200 }; },
    async persist(p) { const saved = path.join(root, 'saved-master.png'); fs.renameSync(p, saved); return saved; },
    async remove(p) { assert.ok(isCache(p)); fs.unlinkSync(p); }, async removeTemporary(p) { assert.equal(path.dirname(p), root); fs.unlinkSync(p); } };
  try {
    const fileId = s.row.fileId, asset = { namespace: owner, petId: 'synthetic-pet', masterId: fileId, fileId, revision: fileId, purpose: 'master' };
    const cached = await cacheFactory(adapter).acquire(asset, async () => 'https://synthetic.invalid/temporary-authorization');
    s.advance(900000);
    const restored = await cacheFactory(adapter).acquire(asset, async () => { throw Error('offline'); });
    assert.equal(restored.localPath, cached.localPath); assert.equal(downloads, 1); assert.equal(sha(fs.readFileSync(restored.localPath)), sha(s.bytes));
    assert.ok(!fs.readFileSync(indexPath, 'utf8').includes('https://'));
    owner = 'account:synthetic-B'; await assert.rejects(cacheFactory(adapter).acquire(asset, async () => 'https://synthetic.invalid'), { code: 'ASSET_OWNER_CHANGED' });
  } finally {
    assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep));
    assert.ok(path.basename(root).startsWith('pety-private-storage-test-'));
    fs.rmSync(root, { recursive: true, force: true });
  }
});
