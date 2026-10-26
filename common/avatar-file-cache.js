// Persistent byte storage for the existing avatar asset resolver. Transport URLs
// never enter the index. Namespace is supplied by the authenticated data owner.
const INDEX_VERSION = 1;
const DEFAULT_LIMIT = 150 * 1024 * 1024;
const PURPOSES = new Set(['master', 'avatar', 'candidate']);
const cacheError = code => Object.assign(new Error(code), { code });

export function avatarFileIdentity(asset) {
  if (!asset || !['namespace', 'petId', 'masterId', 'fileId'].every(k => typeof asset[k] === 'string' && asset[k]) ||
      !PURPOSES.has(asset.purpose) || [asset.fileId, asset.masterId, asset.revision].some(v => /^https?:/i.test(v || ''))) throw cacheError('ASSET_IDENTITY_REQUIRED');
  return JSON.stringify([asset.namespace, asset.petId, asset.masterId, asset.revision || asset.fileId, asset.fileId, asset.purpose]);
}

export function createAvatarFileCache(adapter, options = {}) {
  if (typeof adapter.ownerVersion !== 'function') throw cacheError('ASSET_OWNER_VERSION_REQUIRED');
  const limit = options.limitBytes || DEFAULT_LIMIT;
  const maxFileBytes = options.maxFileBytes || 32 * 1024 * 1024;
  const now = options.now || Date.now;
  let rows = new Map(), serial = Promise.resolve(), running = 0;
  const inflight = new Map(), activeKeys = new Map(), verified = new Set(), pins = new Map(), failures = new Map(), queue = [];
  const generations = new Map(), invalidations = new Map();
  const orphanFiles = new Map();
  let preparation;
  const stats = { requests: 0, completedBodyBytes: 0, observedTransferBytes: 0, hits: 0, joined: 0, failures: 0 };
  try {
    const saved = adapter.readIndex();
    if (saved?.version === INDEX_VERSION && Array.isArray(saved.entries)) {
      for (const item of saved.entries.slice(-1000)) {
        try {
        if (!item || !adapter.isCachePath(item.path) || !Number.isFinite(item.bytes) || item.bytes <= 0 || item.bytes > maxFileBytes) continue;
        if (avatarFileIdentity(item.asset) !== item.key) continue;
        // Copy only known fields; a corrupt/old index cannot introduce a signed URL.
        rows.set(item.key, { key: item.key, asset: { namespace: item.asset.namespace, petId: item.asset.petId, masterId: item.asset.masterId,
          revision: item.asset.revision || item.asset.fileId, fileId: item.asset.fileId, purpose: item.asset.purpose }, path: item.path,
          bytes: item.bytes, width: item.width, height: item.height, format: item.format, used: Number(item.used) || 0 });
        } catch (_) { /* A malformed entry cannot invalidate unrelated cached files. */ }
      }
    }
  } catch (_) { rows = new Map(); }
  function owns(asset) { return Boolean(asset.namespace) && adapter.namespace() === asset.namespace; }
  function requireOwner(asset, version = adapter.ownerVersion()) {
    if (!owns(asset) || version !== adapter.ownerVersion()) throw cacheError('ASSET_OWNER_CHANGED');
  }
  function exclusive(fn) { const p = serial.then(fn); serial = p.catch(() => {}); return p; }
  function commit(next) {
    // One synchronous value is the commit point; publish memory only after it succeeds.
    adapter.writeIndex({ version: INDEX_VERSION, entries: [...next.values()] });
    rows = next;
  }
  const pathKey = path => adapter.cachePathKey ? adapter.cachePathKey(path) : path;
  function physicalBytes(entries) {
    const sizes = new Map();
    for (const row of entries) sizes.set(pathKey(row.path), Math.max(sizes.get(pathKey(row.path)) || 0, row.bytes));
    return [...sizes.values()].reduce((total, bytes) => total + bytes, 0);
  }
  const referenced = path => [...rows.values()].some(row => pathKey(row.path) === pathKey(path));
  async function removeOwned(path, bytes = maxFileBytes) {
    if (!adapter.isCachePath(path)) return;
    try { await adapter.remove(path); orphanFiles.delete(pathKey(path)); }
    catch (_) { orphanFiles.set(pathKey(path), { path, bytes }); }
  }
  function prepare() {
    if (!preparation) preparation = exclusive(async () => {
      if (!adapter.listOwnedFiles) return;
      // Only inventory our dedicated copy directory, never photos or app data.
      const files = await adapter.listOwnedFiles();
      const indexed = new Set([...rows.values()].map(row => pathKey(row.path)));
      for (const file of files) {
        if (!adapter.isCachePath(file.path) || indexed.has(pathKey(file.path))) continue;
        await removeOwned(file.path, Number.isFinite(file.bytes) && file.bytes >= 0 ? file.bytes : maxFileBytes);
      }
    }).catch(error => { preparation = null; throw error; });
    return preparation;
  }
  function protectedKeys() {
    const protectedSet = new Set([...pins].filter(([, n]) => n > 0).map(([k]) => k));
    // Persisted generation sessions remain authoritative before pages mount and
    // after restart/account switches. A read error aborts cleanup, not protection.
    for (const row of rows.values()) if (adapter.isAssetRetained?.(row.asset)) protectedSet.add(row.key);
    // Preserve the two recently used master files per owner, including after restart.
    const byOwner = new Map();
    for (const row of [...rows.values()].sort((a, b) => b.used - a.used)) {
      if (row.asset.purpose !== 'master') continue;
      const n = byOwner.get(row.asset.namespace) || 0;
      if (n < 2) { protectedSet.add(row.key); byOwner.set(row.asset.namespace, n + 1); }
    }
    return protectedSet;
  }
  async function drop(key, guard = () => {}) {
    return exclusive(async () => {
      guard();
      const row = rows.get(key); if (!row) return;
      const next = new Map(rows); next.delete(key); commit(next); verified.delete(key);
      if (!referenced(row.path)) await removeOwned(row.path, row.bytes);
    });
  }
  async function validate(path, asset = {}) {
    const info = await adapter.inspect(path);
    if (!info || !Number.isFinite(info.bytes) || info.bytes <= 0 || info.bytes > maxFileBytes ||
        !['png', 'jpeg', 'webp'].includes(info.format) || !(info.width > 0 && info.height > 0) || info.readable !== true) {
      throw cacheError('ASSET_BYTES_INVALID');
    }
    if ((asset.expectedWidth && info.width !== asset.expectedWidth) || (asset.expectedHeight && info.height !== asset.expectedHeight)) {
      throw cacheError('ASSET_DIMENSIONS_MISMATCH');
    }
    return info;
  }
  async function slot(fn) {
    if (running >= 2) await new Promise(r => queue.push(r));
    else running += 1;
    try { return await fn(); } finally { const next = queue.shift(); if (next) next(); else running -= 1; }
  }
  function result(row, hit) { return { localPath: adapter.toDisplayPath ? adapter.toDisplayPath(row.path) : row.path,
    bytes: row.bytes, width: row.width, height: row.height, format: row.format, cacheHit: hit }; }
  async function obtain(asset, loadUrl, forceRetry, ownerVersion, generation, pendingInvalidation) {
    const key = avatarFileIdentity(asset);
    const current = () => {
      requireOwner(asset, ownerVersion);
      if ((generations.get(key) || 0) !== generation) throw cacheError('ASSET_INVALIDATED');
    };
    if (pendingInvalidation) await pendingInvalidation;
    await prepare();
    current();
    const row = rows.get(key);
    if (row) {
      let valid = false;
      try {
        const info = await validate(row.path, asset); current();
        if (info.bytes !== row.bytes || info.width !== row.width || info.height !== row.height) throw cacheError('ASSET_BYTES_CHANGED');
        valid = true;
      } catch (error) {
        // An unavailable filesystem is not proof that the retained file is corrupt.
        if (!['ASSET_FILE_MISSING', 'ASSET_BYTES_INVALID', 'ASSET_DIMENSIONS_MISMATCH', 'ASSET_BYTES_CHANGED'].includes(error.code)) throw error;
        await drop(key, current);
      }
      if (valid) {
        await exclusive(() => {
          current();
          const next = new Map(rows); next.set(key, { ...row, used: now() });
          try { commit(next); } catch (_) { /* LRU bookkeeping must not delete usable bytes. */ }
        });
        current(); verified.add(key); stats.hits += 1; return result(row, true);
      }
    }
    const failed = failures.get(key);
    if (!forceRetry && failed && (failed.until > now() || failed.count >= 3)) throw cacheError('ASSET_RETRY_PAUSED');
    return slot(async () => {
      let temporary = '', persisted = '';
      try {
        current();
        const url = await loadUrl(); current();
        if (typeof url !== 'string' || !/^https:\/\//i.test(url)) throw cacheError('ASSET_TRANSPORT_REQUIRED');
        let observed = 0;
        stats.requests += 1;
        const downloaded = await adapter.download(url, bytes => {
          if (Number.isFinite(bytes) && bytes > observed) { stats.observedTransferBytes += bytes - observed; observed = bytes; }
        });
        temporary = downloaded.path;
        if (Number(downloaded.statusCode) !== 200) throw cacheError('ASSET_HTTP_FAILED');
        current();
        const info = await validate(temporary, asset); stats.completedBodyBytes += info.bytes;
        current();
        // The adapter returns the final path; saveFile is allowed to move its input.
        persisted = await adapter.persist(temporary, info.format); temporary = '';
        if (!adapter.isCachePath(persisted)) throw cacheError('ASSET_PRIVATE_PATH_REQUIRED');
        const saved = await validate(persisted, asset); current();
        if (saved.bytes !== info.bytes || saved.width !== info.width || saved.height !== info.height) throw cacheError('ASSET_PERSIST_MISMATCH');
        const added = { key, asset: { namespace: asset.namespace, petId: asset.petId, masterId: asset.masterId,
          revision: asset.revision || asset.fileId, fileId: asset.fileId, purpose: asset.purpose }, path: persisted,
          bytes: saved.bytes, width: saved.width, height: saved.height, format: saved.format, used: now() };
        await exclusive(async () => {
          current();
          const next = new Map(rows), victims = [], protectedSet = protectedKeys();
          const extra = added.bytes + [...orphanFiles.values()].reduce((n, r) => n + r.bytes, 0);
          let total = physicalBytes(next.values()) + extra;
          for (const old of [...next.values()].sort((a, b) => a.used - b.used)) {
            if (total <= limit) break;
            if (protectedSet.has(old.key) || activeKeys.has(old.key)) continue;
            next.delete(old.key); total = physicalBytes(next.values()) + extra; victims.push(old);
          }
          if (total > limit) throw cacheError('ASSET_CACHE_FULL');
          next.set(key, added); commit(next); verified.add(key);
          const removedPaths = new Set();
          for (const old of victims) {
            verified.delete(old.key);
            if (!referenced(old.path) && !removedPaths.has(pathKey(old.path))) {
              removedPaths.add(pathKey(old.path)); await removeOwned(old.path, old.bytes);
            }
          }
        });
        persisted = ''; failures.delete(key); return result(added, false);
      } catch (error) {
        stats.failures += 1;
        if (!['ASSET_OWNER_CHANGED', 'ASSET_INVALIDATED'].includes(error.code)) {
          const count = (failures.get(key)?.count || 0) + 1;
          failures.set(key, { count, until: now() + Math.min(60000, 5000 * 2 ** (count - 1)) });
        }
        throw error;
      } finally {
        if (persisted) await removeOwned(persisted);
        // Only download-created temporary files are eligible, never a caller photo.
        if (temporary) await adapter.removeTemporary(temporary).catch(() => {});
      }
    });
  }
  return {
    // Explicit local import grants access only to assets recorded in its receipt.
    // Alias verified bytes into the account; never renew guest transport URLs.
    async importGuest(target) {
      target = { ...target };
      const source = { ...target, namespace: 'guest:local' };
      const targetKey = avatarFileIdentity(target), sourceKey = avatarFileIdentity(source);
      const version = adapter.ownerVersion();
      const generation = generations.get(targetKey) || 0;
      const sourceGeneration = generations.get(sourceKey) || 0;
      const current = () => {
        requireOwner(target, version);
        if ((generations.get(targetKey) || 0) !== generation || (generations.get(sourceKey) || 0) !== sourceGeneration) throw cacheError('ASSET_INVALIDATED');
        if (!target.namespace.startsWith('account:') || adapter.canImportGuestAsset?.(target) !== true) throw cacheError('ASSET_IMPORT_NOT_AUTHORIZED');
      };
      current();
      await prepare();
      return exclusive(async () => {
        current();
        const row = rows.get(targetKey) || rows.get(sourceKey);
        if (!row) return null;
        const info = await validate(row.path, target); current();
        if (info.bytes !== row.bytes || info.width !== row.width || info.height !== row.height) throw cacheError('ASSET_BYTES_CHANGED');
        const next = new Map(rows);
        const imported = { ...row, key: targetKey, asset: target, used: now() };
        next.set(targetKey, imported); commit(next); verified.add(targetKey);
        return result(imported, true);
      });
    },
    // Caller must supply an owner-checked server copy receipt before using this.
    // This operation never fetches bytes and never aliases across pets/accounts.
    async reuse(source, target) {
      source = { ...source }; target = { ...target };
      const sourceKey = avatarFileIdentity(source), targetKey = avatarFileIdentity(target);
      if (source.namespace !== target.namespace || source.petId !== target.petId ||
          source.purpose !== 'master' || target.purpose !== 'master') throw cacheError('ASSET_REUSE_SCOPE_MISMATCH');
      const version = adapter.ownerVersion(), generation = generations.get(sourceKey) || 0;
      const targetGeneration = generations.get(targetKey) || 0;
      requireOwner(source, version);
      await prepare();
      return exclusive(async () => {
        const current = () => {
          requireOwner(source, version);
          if ((generations.get(sourceKey) || 0) !== generation || (generations.get(targetKey) || 0) !== targetGeneration) throw cacheError('ASSET_INVALIDATED');
        };
        current();
        if (rows.has(targetKey) || activeKeys.has(targetKey)) return false;
        const row = rows.get(sourceKey); if (!row) return false;
        const info = await validate(row.path, target); current();
        if (info.bytes !== row.bytes || info.width !== row.width || info.height !== row.height ||
            (target.expectedBytes && info.bytes !== target.expectedBytes)) throw cacheError('ASSET_BYTES_CHANGED');
        const next = new Map(rows);
        next.set(targetKey, { ...row, key: targetKey, asset: { namespace: target.namespace, petId: target.petId,
          masterId: target.masterId, fileId: target.fileId, revision: target.revision || target.fileId, purpose: target.purpose }, used: now() });
        commit(next); verified.add(targetKey); failures.delete(targetKey);
        return true;
      });
    },
    acquire(asset, loadUrl, { signal, forceRetry = false } = {}) {
      // A page may replace/mutate its reactive pet while an asynchronous read runs.
      asset = { ...asset };
      const ownerVersion = adapter.ownerVersion();
      let key;
      try { key = avatarFileIdentity(asset); requireOwner(asset); } catch (e) { return Promise.reject(e); }
      if (signal?.aborted) return Promise.reject(cacheError('ASSET_CONSUMER_CANCELLED'));
      const generation = generations.get(key) || 0;
      const current = () => { requireOwner(asset, ownerVersion); if ((generations.get(key) || 0) !== generation) throw cacheError('ASSET_INVALIDATED'); };
      const flightKey = JSON.stringify([ownerVersion, generation, key]);
      let shared = inflight.get(flightKey);
      if (shared) stats.joined += 1;
      else {
        activeKeys.set(key, (activeKeys.get(key) || 0) + 1);
        shared = obtain(asset, loadUrl, forceRetry, ownerVersion, generation, invalidations.get(key)); inflight.set(flightKey, shared);
        shared.finally(() => {
          if (inflight.get(flightKey) === shared) inflight.delete(flightKey);
          const count = (activeKeys.get(key) || 1) - 1;
          if (count) activeKeys.set(key, count); else activeKeys.delete(key);
        }).catch(() => {});
      }
      if (!signal) return shared.then(value => { current(); return value; });
      return new Promise((resolve, reject) => {
        const cancel = () => { signal.removeEventListener('abort', cancel); reject(cacheError('ASSET_CONSUMER_CANCELLED')); };
        signal.addEventListener('abort', cancel, { once: true });
        shared.then(value => { current(); resolve(value); }, reject).catch(reject).finally(() => signal.removeEventListener('abort', cancel));
      });
    },
    peek(asset) { const key = avatarFileIdentity(asset); return owns(asset) && verified.has(key) && rows.has(key) ? result(rows.get(key), true) : null; },
    suspect(asset) {
      // A WebView decode failure is not proof of corrupt bytes. Withdraw the
      // display binding; acquire() re-inspects the retained file before deciding
      // whether a download is needed. Stale consumers cannot re-publish it.
      requireOwner(asset); const key = avatarFileIdentity(asset);
      generations.set(key, (generations.get(key) || 0) + 1); verified.delete(key);
    },
    pin(asset) { const key = avatarFileIdentity(asset); requireOwner(asset); pins.set(key, (pins.get(key) || 0) + 1); let released = false;
      return () => { if (!released) { released = true; pins.set(key, Math.max(0, (pins.get(key) || 1) - 1)); } }; },
    invalidate(asset) {
      requireOwner(asset); const key = avatarFileIdentity(asset);
      generations.set(key, (generations.get(key) || 0) + 1); verified.delete(key);
      const pending = drop(key); invalidations.set(key, pending);
      pending.finally(() => { if (invalidations.get(key) === pending) invalidations.delete(key); }).catch(() => {});
      return pending;
    },
    async clearDisposable() {
      await prepare();
      const namespace = adapter.namespace(), version = adapter.ownerVersion(), protectedSet = protectedKeys();
      for (const [key, row] of rows) if (row.asset.namespace === namespace && !protectedSet.has(key) && !activeKeys.has(key)) {
        await drop(key, () => {
          requireOwner({ namespace }, version);
          if (activeKeys.has(key) || protectedKeys().has(key)) throw cacheError('ASSET_CACHE_IN_USE');
        });
      }
    },
    diagnostics() { const own = [...rows.values()].filter(r => r.asset.namespace === adapter.namespace());
      return { ...stats, cachedBytes: physicalBytes(own), entries: own.length, limitBytes: limit,
        unreclaimedBytes: [...orphanFiles.values()].reduce((n, r) => n + r.bytes, 0),
        measurement: 'completed-body-file-bytes-and-platform-progress; excludes-api-and-headers' }; }
  };
}
