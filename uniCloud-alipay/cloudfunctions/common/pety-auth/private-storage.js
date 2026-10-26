'use strict';

// Detached preparation only. No handler imports this module and no credentials
// are loaded at startup. Receipt persistence stays in the existing services.
const crypto = require('crypto');
const fail = code => { throw Object.assign(new Error(code), { code }); };
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const LIMITS = { 'avatar-source': 20 * 1024 * 1024, feedback: 2 * 1024 * 1024, 'avatar-generated': 25 * 1024 * 1024 };
const validPurpose = value => Object.prototype.hasOwnProperty.call(LIMITS, value);
const hmac = (key, value) => crypto.createHmac('sha256', key).update(value).digest();
const present = value => typeof value === 'string' && value.trim() && !/YOUR_|PLACEHOLDER|^<|^example/i.test(value);
async function providerCall(fn) {
  try { return await fn(); }
  catch (_) { fail('PRIVATE_STORAGE_PROVIDER_UNAVAILABLE'); }
}

function checkPrivateStorageConfig(config = {}) {
  const missing = ['bucket', 'region', 'endpoint', 'accessKeyId', 'accessKeySecret'].filter(key => !present(config[key]));
  const invalid = [];
  if (config.provider !== 'aliyun-oss') invalid.push('provider');
  if (present(config.bucket) && !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(config.bucket)) invalid.push('bucket');
  if (present(config.region) && !/^[a-z]{2}-[a-z0-9-]+$/.test(config.region)) invalid.push('region');
  if (present(config.endpoint) && config.endpoint !== `https://${config.bucket}.oss-${config.region}.aliyuncs.com`) invalid.push('endpoint');
  if (config.bucketAcl !== 'private') invalid.push('bucketAcl');
  if (config.blockPublicAccess !== true) invalid.push('blockPublicAccess');
  // OSS ignores forbid-overwrite when versioning is enabled OR suspended.
  if (config.versioning !== 'Disabled') invalid.push('versioning');
  if (!/^[a-z0-9-]+$/.test(config.prefix || '')) invalid.push('prefix');
  for (const key of ['uploadTtlSeconds', 'readTtlSeconds']) {
    if (!Number.isInteger(config[key]) || config[key] < 30 || config[key] > 300) invalid.push(key);
  }
  if (!Number.isInteger(config.modelReadTtlSeconds) || config.modelReadTtlSeconds < 300 || config.modelReadTtlSeconds > 1800) invalid.push('modelReadTtlSeconds');
  return { enabled: config.enabled === true, configurationComplete: !missing.length && !invalid.length,
    state: config.enabled !== true ? 'DISABLED' : missing.length || invalid.length ? 'CONFIG_INCOMPLETE' : 'REMOTE_UNVERIFIED',
    ready: false, missing, invalid }; // Presence alone never proves a live private target.
}

// Call only with the authenticated server scope; persist the descriptor in an
// existing source/feedback receipt before returning a capability to the phone.
function createPrivateObjectDescriptor(config, scope, purpose, mime, randomBytes = crypto.randomBytes) {
  if (!/^[a-f0-9]{64}$/.test(scope?.owner || '') || !/^[a-f0-9]{24}$/.test(scope?.pet || '') ||
      !validPurpose(purpose) || !['image/png', 'image/jpeg'].includes(mime) || !/^[a-z0-9-]+$/.test(config.prefix || '')) fail('PRIVATE_OBJECT_INVALID');
  const id = randomBytes(24).toString('hex');
  if (!/^[a-f0-9]{48}$/.test(id)) fail('PRIVATE_OBJECT_INVALID');
  return { fileId: `pety-private://oss/${id}`, purpose, mime,
    storage: { provider: 'aliyun-oss', bucket: config.bucket,
      key: `${config.prefix}/${purpose}/${scope.owner}/${scope.pet}/${id}.${mime === 'image/png' ? 'png' : 'jpg'}` } };
}

function signPostV4(config, row, expiresAt, now) {
  const timestamp = new Date(now).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const day = timestamp.slice(0, 8);
  const fields = { key: row.storage.key, 'x-oss-object-acl': 'private', 'x-oss-forbid-overwrite': 'true',
    'x-oss-content-type': row.mime, 'Cache-Control': 'private, no-store', success_action_status: '204',
    'x-oss-signature-version': 'OSS4-HMAC-SHA256',
    'x-oss-credential': `${config.accessKeyId}/${day}/${config.region}/oss/aliyun_v4_request`, 'x-oss-date': timestamp };
  if (config.securityToken) fields['x-oss-security-token'] = config.securityToken;
  const policy = { expiration: new Date(expiresAt).toISOString(), conditions: [
    { bucket: config.bucket }, ...Object.entries(fields).map(([key, value]) => ['eq', `$${key}`, value]),
    ['content-length-range', 1, LIMITS[row.purpose]]
  ] };
  fields.policy = Buffer.from(JSON.stringify(policy)).toString('base64');
  const dateKey = hmac(`aliyun_v4${config.accessKeySecret}`, day);
  const signingKey = hmac(hmac(hmac(dateKey, config.region), 'oss'), 'aliyun_v4_request');
  fields['x-oss-signature'] = hmac(signingKey, fields.policy).toString('hex');
  return { version: 1, transport: 'oss-post-v4', ticketId: row._id, fileId: row.fileId,
    url: config.endpoint, method: 'POST', name: 'file', formData: fields, expiresAt,
    maxBytes: LIMITS[row.purpose] };
}

function createPrivateStoragePreparation(config = {}, hooks = {}) {
  // Snapshot scalar server configuration; event data can never select endpoints.
  config = { ...config };
  const clock = hooks.clock || Date.now;
  const verify = hooks.verifyRequest || ((event, context) => require('./index').verifyRequest(event, context));
  async function identity(event, context) {
    const auth = await verify(event, context);
    if (!auth?.uid) fail('PRIVATE_STORAGE_LOGIN_REQUIRED');
    return { ...auth, session: auth.session && { ...auth.session } };
  }
  async function target() {
    const status = checkPrivateStorageConfig(config);
    if (!status.enabled) fail('PRIVATE_STORAGE_DISABLED');
    if (!status.configurationComplete) fail('PRIVATE_STORAGE_CONFIG_INCOMPLETE');
    if (typeof hooks.checkTarget !== 'function') fail('PRIVATE_STORAGE_REMOTE_UNVERIFIED');
    // Future bridge must use current provider ACL/policy/versioning evidence,
    // not echo the local config. It is deliberately absent in production.
    const actual = await providerCall(() => hooks.checkTarget());
    if (actual?.bucket !== config.bucket || actual?.region !== config.region || actual?.bucketAcl !== 'private' ||
        actual?.blockPublicAccess !== true || actual?.versioning !== 'Disabled') fail('PRIVATE_STORAGE_TARGET_UNSAFE');
  }
  async function owned(event, context, mode) {
    const status = checkPrivateStorageConfig(config);
    if (!status.enabled) fail('PRIVATE_STORAGE_DISABLED');
    if (!status.configurationComplete) fail('PRIVATE_STORAGE_CONFIG_INCOMPLETE');
    const auth = await identity(event, context);
    await target();
    if (typeof hooks.loadOwnedReceipt !== 'function') fail('PRIVATE_STORAGE_RECEIPT_UNAVAILABLE');
    // This hook resolves exact rows from existing ledgers/jobs; it must check
    // pet/generation-session too. No owner, key or bucket comes from event.
    const found = await hooks.loadOwnedReceipt(event, auth, mode);
    const row = found && { ...found, storage: { ...found.storage } };
    if (!row || row.owner !== hash(auth.uid) || !row._id || !row.fileId ||
        row.storage?.provider !== 'aliyun-oss' || row.storage.bucket !== config.bucket ||
        !/^[a-f0-9]{24}$/.test(row.pet || '') || !validPurpose(row.purpose) || !['image/png', 'image/jpeg'].includes(row.mime)) fail('PRIVATE_STORAGE_NOT_OWNED');
    if (mode === 'read' ? event.fileId !== row.fileId : event.ticketId !== row._id) fail('PRIVATE_STORAGE_NOT_OWNED');
    const expected = `${config.prefix}/${row.purpose}/${row.owner}/${row.pet}/`;
    if (typeof row.storage.key !== 'string' || !row.storage.key.startsWith(expected) || !/^[a-f0-9]{48}\.(?:png|jpg)$/.test(row.storage.key.slice(expected.length))) fail('PRIVATE_STORAGE_NOT_OWNED');
    return { auth, row };
  }
  async function stillCurrent(event, context, auth) {
    const current = await identity(event, context);
    if (current.uid !== auth.uid || current.session?.version !== auth.session?.version) fail('PRIVATE_STORAGE_SCOPE_CHANGED');
  }
  return {
    status: () => checkPrivateStorageConfig(config),
    async issueUpload(event, context) {
      const { auth, row } = await owned(event, context, 'upload');
      if (row.purpose === 'avatar-generated') fail('PRIVATE_UPLOAD_SERVER_ONLY');
      if (row.state !== 'issued') fail('PRIVATE_UPLOAD_ALREADY_COMPLETE');
      const now = clock();
      if (!Number.isSafeInteger(row.expiresAt) || row.expiresAt <= now) fail('PRIVATE_UPLOAD_EXPIRED');
      const grant = signPostV4(config, row, Math.min(row.expiresAt, now + config.uploadTtlSeconds * 1000), now);
      await stillCurrent(event, context, auth);
      if (grant.expiresAt <= clock()) fail('PRIVATE_UPLOAD_EXPIRED');
      return grant;
    },
    async inspectUploaded(event, context) {
      const { auth, row } = await owned(event, context, 'complete');
      if (row.purpose === 'avatar-generated') fail('PRIVATE_UPLOAD_SERVER_ONLY');
      if (event.fileId !== row.fileId) fail('PRIVATE_STORAGE_NOT_OWNED');
      if (row.state !== 'issued' || !Number.isSafeInteger(row.expiresAt) || row.expiresAt <= clock()) fail('PRIVATE_UPLOAD_EXPIRED');
      if (typeof hooks.inspectObject !== 'function') fail('PRIVATE_STORAGE_INSPECTION_UNAVAILABLE');
      // Bridge must bound bytes before buffering, then use existing PNG/JPEG
      // decoders and size/quality gates. Never trust client MIME or a HEAD alone.
      const inspected = await providerCall(() => hooks.inspectObject({ ...row.storage }, LIMITS[row.purpose]));
      if (!inspected || !Number.isSafeInteger(inspected.bytes) || inspected.bytes < 1 || inspected.bytes > LIMITS[row.purpose] ||
          inspected.mime !== row.mime || !Number.isInteger(inspected.width) || inspected.width < 1 ||
          !Number.isInteger(inspected.height) || inspected.height < 1 || inspected.width > 8192 ||
          inspected.height > 8192 || inspected.width * inspected.height > 16000000 ||
          !/^[a-f0-9]{64}$/.test(inspected.sha256 || '')) fail('PRIVATE_UPLOAD_INVALID_IMAGE');
      await stillCurrent(event, context, auth);
      if (row.expiresAt <= clock()) fail('PRIVATE_UPLOAD_EXPIRED');
      // Existing receipt.complete does the CAS to ready and records these hashes.
      return { fileId: row.fileId, bytes: inspected.bytes, mime: inspected.mime,
        width: inspected.width, height: inspected.height, sha256: inspected.sha256 };
    },
    async issueRead(event, context, modelJob = null) {
      const { auth, row } = await owned(event, context, 'read');
      if (row.state !== 'ready' || !/^[a-f0-9]{64}$/.test(row.sha256 || '')) fail('PRIVATE_STORAGE_NOT_READY');
      let ttlSeconds = config.readTtlSeconds;
      if (modelJob !== null) {
        if (typeof hooks.authorizeModelJob !== 'function' || await hooks.authorizeModelJob(auth, row, modelJob) !== true) fail('PRIVATE_MODEL_READ_DENIED');
        ttlSeconds = config.modelReadTtlSeconds;
      }
      if (typeof hooks.signGet !== 'function') fail('PRIVATE_STORAGE_SDK_UNAVAILABLE');
      const now = clock();
      const url = await providerCall(() => hooks.signGet({ ...row.storage }, ttlSeconds));
      let parsed;
      try { parsed = new URL(url); } catch (_) { fail('PRIVATE_STORAGE_SIGNING_FAILED'); }
      const seconds = Number(parsed.searchParams.get('x-oss-expires'));
      const date = parsed.searchParams.get('x-oss-date') || '';
      const match = date.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
      const signedAt = match ? Date.parse(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`) : NaN;
      const expiresAt = signedAt + seconds * 1000;
      const allowedQuery = new Set(['x-oss-date', 'x-oss-expires', 'x-oss-signature-version', 'x-oss-signature',
        'x-oss-credential', 'x-oss-security-token', 'x-oss-additional-headers']);
      if (parsed.origin !== config.endpoint || parsed.username || parsed.password || parsed.hash ||
          parsed.pathname !== `/${row.storage.key}` ||
          [...parsed.searchParams.keys()].some(key => !allowedQuery.has(key)) ||
          parsed.searchParams.get('x-oss-signature-version') !== 'OSS4-HMAC-SHA256' ||
          !/^[a-f0-9]{64}$/.test(parsed.searchParams.get('x-oss-signature') || '') ||
          !Number.isInteger(seconds) || seconds < 1 || seconds > ttlSeconds ||
          !Number.isFinite(expiresAt) || expiresAt <= clock() || signedAt > now + 5000) fail('PRIVATE_STORAGE_SIGNING_FAILED');
      await stillCurrent(event, context, auth);
      if (expiresAt <= clock()) fail('PRIVATE_STORAGE_SIGNING_FAILED');
      return { fileId: row.fileId, tempFileURL: url, expiresAt };
    }
  };
}

module.exports = { checkPrivateStorageConfig, createPrivateObjectDescriptor, createPrivateStoragePreparation };
