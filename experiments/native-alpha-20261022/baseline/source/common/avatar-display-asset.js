export async function privateMediaUrls(fileIds,petId){
 const proof=typeof uni!=='undefined'&&typeof uni.getStorageSync==='function'&&uni.getStorageSync('pety_current_session_v1');
 const token=typeof uni!=='undefined'&&typeof uni.getStorageSync==='function'?uni.getStorageSync('uni_id_token')||'':'';
 const response=await uniCloud.callFunction({name:'api_pet_avatar',data:{action:'getOwnedMediaUrls',petId,fileIds,uniIdToken:token,...(proof?{petySession:{secret:proof.secret,version:proof.version}}:{})}});
 if(response?.result?.code!==0)throw Object.assign(new Error('媒体授权未完成，请重新登录或重试。'),{code:response?.result?.errorCode||'MEDIA_AUTH_UNAVAILABLE'});
 return response.result;
}
const hydratedUrlCache = new Map();
const hydrationInFlight = new Map();
const failedUrls = new Map();
const unavailableUntil = new Map();
const unavailableReason = new Map();
const listeners = new Set();
const URL_TTL_MS = 5 * 60 * 1000;
// Account replacement clears the URL cache synchronously; old failures must not
// blacklist an identically named master in the next account.
let cacheGeneration = 0;
let fileRuntime = null;
const localBindings = new Map();
// Installed once by App, not a second page-specific cache. H5 keeps its URL path.
export function configureAvatarFileCache(runtime) {
  clearAvatarDisplayAssetCache();
  fileRuntime = runtime;
}
export function isAvatarFileCacheEnabled() { return Boolean(fileRuntime); }
function nativeCache() { return fileRuntime.getCache(); }
function fileDescriptor(pet, fileId, metadata = {}, purpose) {
  const owner = fileRuntime.readOwner();
  if (!owner.ready) throw Object.assign(new Error('ASSET_OWNER_UNRESOLVED'), { code: 'ASSET_OWNER_UNRESOLVED' });
  const masterId = normalizeText(pet.generatedAvatarFileId || pet.generatedFileId);
  return { namespace: owner.namespace, petId: normalizeText(pet.id), masterId, fileId,
    revision: fileId, purpose: purpose || (fileId === masterId ? 'master' : 'avatar'),
    expectedWidth: Number(metadata.width || metadata.outputWidth) || undefined,
    expectedHeight: Number(metadata.height || metadata.outputHeight) || undefined };
}
function readAssetUrl(pet, fileId, metadata = {}, freshOnly = false) {
  if (!fileRuntime) return readCachedUrl(pet.id, fileId, freshOnly);
  if (!fileId) return null;
  try {
    const asset = fileDescriptor(pet, fileId, metadata), hit = nativeCache().peek(asset);
    if (hit) localBindings.set(getCacheKey(pet.id, fileId), { asset, path: hit.localPath, ownerVersion: fileRuntime.readOwner().version });
    return hit ? { url: hit.localPath, urlRuntime: 'app-private-cache', cacheHit: true } : null;
  } catch (_) { return null; }
}
async function acquireLocalFile(pet, fileId, metadata, loadUrl, userRetry = false) {
  const runtime = fileRuntime, owner = runtime.readOwner(), generation = cacheGeneration;
  const asset = fileDescriptor(pet, fileId, metadata), cache = nativeCache();
  const current = () => {
    const next = runtime.readOwner();
    return fileRuntime === runtime && generation === cacheGeneration && next.ready &&
      next.namespace === owner.namespace && next.version === owner.version;
  };
  const assertCurrent = () => { if (!current()) throw Object.assign(new Error('ASSET_OWNER_CHANGED'), { code: 'ASSET_OWNER_CHANGED' }); };
  const startedAt = Date.now();
  const result = await cache.acquire(asset, async () => { assertCurrent(); const url = await loadUrl(); assertCurrent(); return url; }, { forceRetry: userRetry === true });
  assertCurrent();
  const key = getCacheKey(pet.id, fileId);
  localBindings.set(key, { asset, path: result.localPath, ownerVersion: owner.version });
  unavailableUntil.delete(key); unavailableReason.delete(key);
  notifyAsset(pet.id);
  return { url: result.localPath, cacheHit: result.cacheHit, hydrationMs: Date.now() - startedAt,
    urlRuntime: 'app-private-cache', bytes: result.bytes };
}

// Candidate files use their immutable master identity, independent of the view.
// loadUrl must come from the existing owner-checked job response, not the storage SDK.
function candidatePet(candidate, pet) {
  if (pet.localImportPending) throw Object.assign(new Error('LOCAL_IMPORT_CLOUD_LINK_REQUIRED'), { code: 'LOCAL_IMPORT_CLOUD_LINK_REQUIRED' });
  return { id: pet.id, generatedAvatarFileId: candidate.fileId || candidate.generatedFileId,
    generatedAvatarJobId: candidate.jobId, generatedAvatarMainAssetMetadata: candidate.mainAssetMetadata || {} };
}
export function peekAvatarCandidateUrl(candidate, pet, thumbnail = false) {
  if (!fileRuntime) return '';
  try {
    const owner = candidatePet(candidate, pet), fileId = thumbnail ? candidate.generatedThumbnailFileId : owner.generatedAvatarFileId;
    return readAssetUrl(owner, fileId, thumbnail ? {} : owner.generatedAvatarMainAssetMetadata)?.url || '';
  } catch (_) { return ''; }
}
export function hydrateAvatarCandidateAsset(candidate, pet, { thumbnail = false, loadUrl, userRetry = false } = {}) {
  const owner = candidatePet(candidate, pet), fileId = thumbnail ? candidate.generatedThumbnailFileId : owner.generatedAvatarFileId;
  if (!fileRuntime || !fileId || typeof loadUrl !== 'function') return Promise.reject(new Error('NATIVE_CANDIDATE_INPUT_REQUIRED'));
  return acquireLocalFile(owner, fileId, thumbnail ? {} : owner.generatedAvatarMainAssetMetadata, loadUrl, userRetry);
}
export function pinAvatarCandidateAsset(candidate, pet) {
  if (!fileRuntime) return () => {};
  try { const owner = candidatePet(candidate, pet); return nativeCache().pin(fileDescriptor(owner, owner.generatedAvatarFileId, owner.generatedAvatarMainAssetMetadata)); }
  catch (_) { return () => {}; }
}
export async function reuseConfirmedAvatarAsset(candidate, pet, confirmed) {
  const receipt = confirmed?.masterCopy;
  if (!fileRuntime || !receipt || receipt.version !== 1 || pet.localImportPending ||
      confirmed.selectedJobId !== candidate?.jobId || receipt.sourceFileId !== (candidate.fileId || candidate.generatedFileId) ||
      receipt.targetFileId !== confirmed.generatedFileId || !/^[a-f0-9]{64}$/.test(receipt.sha256 || '') ||
      confirmed.mainAssetMetadata?.contentSha256 !== receipt.sha256 ||
      !['bytes', 'width', 'height'].every(key => Number.isSafeInteger(receipt[key]) && receipt[key] > 0 && receipt[key] === confirmed.mainAssetMetadata[key])) return false;
  const runtime = fileRuntime, owner = runtime.readOwner(), generation = cacheGeneration;
  const sourcePet = candidatePet(candidate, pet);
  const source = fileDescriptor(sourcePet, receipt.sourceFileId, candidate.mainAssetMetadata);
  const finalPet = { id: pet.id, generatedAvatarFileId: receipt.targetFileId };
  const target = { ...fileDescriptor(finalPet, receipt.targetFileId, confirmed.mainAssetMetadata), expectedBytes: receipt.bytes };
  const reused = await nativeCache().reuse(source, target);
  const next = runtime.readOwner();
  if (fileRuntime !== runtime || generation !== cacheGeneration || !next.ready || next.namespace !== owner.namespace || next.version !== owner.version) {
    throw Object.assign(new Error('ASSET_OWNER_CHANGED'), { code: 'ASSET_OWNER_CHANGED' });
  }
  return reused;
}
export function subscribeAvatarAssets(listener) { listeners.add(listener); return () => listeners.delete(listener); }
function notifyAsset(petId) { listeners.forEach(listener => listener(petId)); }
export function invalidateAvatarUrl(petId, fileId, url) {
  if (fileRuntime) {
    const binding = localBindings.get(getCacheKey(petId, fileId)), owner = fileRuntime.readOwner();
    // A remote URL refresh or a stale image event cannot erase a valid local copy.
    if (!binding || binding.path !== url || binding.asset.namespace !== owner.namespace || binding.ownerVersion !== owner.version) return;
    localBindings.delete(getCacheKey(petId, fileId));
    const cache = nativeCache();
    if (typeof cache.suspect === 'function') cache.suspect(binding.asset);
    else cache.invalidate(binding.asset).catch(() => {});
    notifyAsset(petId);
    return;
  }
  failedUrls.set(url, Date.now() + 30000);
  if (failedUrls.size > 200) failedUrls.delete(failedUrls.keys().next().value);
  hydratedUrlCache.delete(getCacheKey(petId, fileId));
  notifyAsset(petId);
}
function usableUrl(url, fresh = false) {
  if (!url || (!fresh && (failedUrls.get(url) || 0) > Date.now())) return '';
  try {
    const parsed = new URL(url);
    const expires = Number(parsed.searchParams.get('Expires') || parsed.searchParams.get('expires'));
    if (expires && expires * 1000 <= Date.now() + 30000) return '';
  } catch (error) {}
  return url;
}
function belongsToMaster(pet, fileId) {
  const master = normalizeText(pet.generatedAvatarFileId || pet.generatedFileId);
  if (!master || !fileId) return false;
  if (pet.generatedAvatarDerivedFromFileId && pet.generatedAvatarDerivedFromFileId !== master) return false;
  if (!master.startsWith('cloud://')) return pet.generatedAvatarDerivedFromFileId === master;
  // Legacy assets are accepted only when their immutable storage directory matches final.
  return master.startsWith('cloud://') && master.slice(0, master.lastIndexOf('/') + 1) === fileId.slice(0, fileId.lastIndexOf('/') + 1);
}

function normalizeText(value) {
  return String(value || '');
}

function getCacheKey(petId, fileId) {
  return `${normalizeText(petId)}::${normalizeText(fileId)}`;
}

function getAvatarJobId(pet = {}) {
  return normalizeText(pet.generatedAvatarCutoutJobId || pet.generatedAvatarJobId || '');
}

function normalizeAssetMetadata(raw = null, fallback = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    ...source,
    width: Math.max(Number(source.width || source.outputWidth || fallback.width) || 0, 0),
    height: Math.max(Number(source.height || source.outputHeight || fallback.height) || 0, 0),
    bytes: Math.max(Number(source.bytes || source.outputBytes || fallback.bytes) || 0, 0),
    mime: normalizeText(source.mime || fallback.mime),
    extension: normalizeText(source.extension || fallback.extension),
    wasReencoded: source.wasReencoded === true || fallback.wasReencoded === true,
    wasDownscaled: source.wasDownscaled === true || fallback.wasDownscaled === true,
    providerOriginal: source.providerOriginal === true || fallback.providerOriginal === true,
    sourceRole: normalizeText(source.sourceRole || fallback.sourceRole)
  };
}

function evaluateHeroQuality(kind, metadata, masterMetadata) {
  if (kind === 'final') return { accepted: true, reason: 'MASTER_ORIGINAL' };
  const isTight = kind.endsWith('-tight');
  const width = Number(isTight ? metadata.originalWidth : metadata.width) || 0;
  const height = Number(isTight ? metadata.originalHeight : metadata.height) || 0;
  const bytes = Number(metadata.bytes) || 0;
  if (!width || !height || !bytes) return { accepted: false, reason: 'QUALITY_METADATA_MISSING' };
  const masterEdge = Math.min(Number(masterMetadata.width) || 0, Number(masterMetadata.height) || 0);
  const requiredEdge = masterEdge ? Math.max(768, Math.round(masterEdge * 0.8)) : 1024;
  if (Math.min(width, height) < requiredEdge) return { accepted: false, reason: 'DERIVATIVE_TOO_SMALL' };
  // PNG compression size does not measure sharpness; uniform backgrounds compress extremely well.
  if (metadata.mime !== 'image/png' || metadata.hasAlpha !== true) return { accepted: false, reason: 'ALPHA_NOT_VERIFIED' };
  if (metadata.qualityVersion !== 2 || metadata.qualified !== true) return { accepted: false, reason: metadata.fallbackReason || 'CUTOUT_QUALITY_NOT_VERIFIED' };
  if (metadata.edgeQuality && metadata.edgeQuality.qualified !== true) return { accepted: false, reason: 'HERO_EDGE_QUALITY_REJECTED' };
  if (isTight && (metadata.tightVersion !== 1 || metadata.contentAreaRatio < 0.7 || metadata.cornersTransparent !== true)) return { accepted: false, reason: 'TIGHT_BOUNDS_NOT_VERIFIED' };
  return { accepted: true, reason: 'QUALITY_ACCEPTED' };
}

function buildAssetCandidates(pet = {}, includeRejected = false) {
  const petId = normalizeText(pet.id);
  const jobId = getAvatarJobId(pet);
  const cutoutStatus = normalizeText(pet.generatedAvatarCutoutStatus || 'NONE').toUpperCase();
  const mainMetadata = normalizeAssetMetadata(pet.generatedAvatarMainAssetMetadata, { sourceRole: 'final_original' });
  const displayDimensions = pet.generatedAvatarDisplayDimensions && typeof pet.generatedAvatarDisplayDimensions === 'object'
    ? pet.generatedAvatarDisplayDimensions
    : {};
  const common = { petId, jobId };
  const candidates = [
    {
      ...common, kind: 'hero-native-tight', fileId: normalizeText(pet.generatedAvatarHeroFileId),
      enabled: pet.generatedAvatarHeroMetrics?.sourceFileId === pet.generatedAvatarFileId && pet.generatedAvatarHeroMetrics?.assetRole === 'home_hero',
      transparent: true, alphaValid: pet.generatedAvatarHeroMetrics?.hasAlpha === true,
      metadata: normalizeAssetMetadata(pet.generatedAvatarHeroMetrics)
    },
    {
      ...common, kind: 'cutout-tight', fileId: normalizeText(pet.generatedAvatarCutoutTightFileId),
      enabled: ['SUCCEEDED', 'READY'].includes(cutoutStatus) && Boolean(pet.generatedAvatarCutoutFileId) && pet.generatedAvatarCutoutTightMetrics?.sourceFileId === pet.generatedAvatarCutoutFileId,
      transparent: true, alphaValid: pet.generatedAvatarCutoutTightMetrics?.hasAlpha === true,
      metadata: normalizeAssetMetadata(pet.generatedAvatarCutoutTightMetrics)
    },
    {
      ...common, kind: 'local-cutout-tight', fileId: normalizeText(pet.generatedAvatarLocalCutoutTightFileId),
      enabled: Boolean(pet.generatedAvatarLocalCutoutFileId) && pet.generatedAvatarLocalCutoutTightMetrics?.sourceFileId === pet.generatedAvatarLocalCutoutFileId,
      transparent: true, alphaValid: pet.generatedAvatarLocalCutoutTightMetrics?.hasAlpha === true,
      metadata: normalizeAssetMetadata(pet.generatedAvatarLocalCutoutTightMetrics)
    },
    {
      ...common,
      kind: 'viapi-cutout',
      fileId: normalizeText(pet.generatedAvatarCutoutFileId),
      url: normalizeText(pet.generatedAvatarCutoutUrl),
      enabled: ['SUCCEEDED', 'READY'].includes(cutoutStatus) && pet.generatedAvatarCutoutAlphaValid === true,
      transparent: true,
      alphaValid: pet.generatedAvatarCutoutAlphaValid === true,
      metadata: normalizeAssetMetadata(pet.generatedAvatarCutoutMetrics, { mime: 'image/png', extension: 'png', wasReencoded: true, sourceRole: 'viapi_cutout' })
    },
    {
      ...common,
      kind: 'local-cutout',
      fileId: normalizeText(pet.generatedAvatarLocalCutoutFileId),
      url: normalizeText(pet.generatedAvatarLocalCutoutUrl),
      enabled: pet.generatedAvatarLocalCutoutAlphaValid === true,
      transparent: true,
      alphaValid: pet.generatedAvatarLocalCutoutAlphaValid === true,
      metadata: normalizeAssetMetadata(pet.generatedAvatarLocalCutoutMetrics, {
        width: displayDimensions.masterWidth,
        height: displayDimensions.masterHeight,
        mime: 'image/png',
        extension: 'png',
        wasReencoded: true,
        sourceRole: 'local_cutout'
      })
    },
    {
      ...common,
      kind: 'final',
      fileId: normalizeText(pet.generatedAvatarFileId || pet.generatedFileId),
      url: normalizeText(pet.generatedAvatarUrl || pet.generatedAvatar),
      enabled: true,
      transparent: false,
      alphaValid: mainMetadata.hasAlpha === true,
      metadata: mainMetadata
    }
  ].map(item => {
    const quality = evaluateHeroQuality(item.kind, item.metadata, mainMetadata);
    const masterFileId = pet.generatedAvatarFileId || pet.generatedFileId;
    const sourceOwned = item.kind === 'hero-native-tight' ? item.metadata.sourceFileId === masterFileId : !item.kind.endsWith('-tight') || (item.metadata.sourceFileId !== masterFileId && belongsToMaster(pet, item.metadata.sourceFileId));
    const owned = item.kind === 'final' || (sourceOwned && item.fileId !== masterFileId && belongsToMaster(pet, item.fileId));
    const cached = readAssetUrl(pet, item.fileId, item.metadata);
    // Persisted URLs are not proof that a cloud asset still exists or belongs to this generation.
    const url = cached ? cached.url : '';
    const unavailable = (unavailableUntil.get(getCacheKey(petId, item.fileId)) || 0) > Date.now();
    return { ...item, url, unavailable, qualityAccepted: quality.accepted && owned, qualityReason: owned ? quality.reason : 'MASTER_MISMATCH' };
  });
  return includeRejected ? candidates : candidates.filter(item => item.enabled && !item.unavailable && item.petId && (item.fileId || item.url) && item.qualityAccepted);
}

function readCachedUrl(petId, fileId, freshOnly = false) {
  if (!petId || !fileId) return null;
  const cached = hydratedUrlCache.get(getCacheKey(petId, fileId));
  // Signed URLs have their own expiry. Renew only at that boundary (or after
  // an image error); arbitrary five-minute renewals defeat the browser's cache.
  // Unknown URL lifetimes keep the conservative legacy refresh window.
  let hasExpiry = false;
  try { const url = new URL(cached?.url); hasExpiry = Number(url.searchParams.get('Expires') || url.searchParams.get('expires')) > 0; } catch (_) {}
  return cached && (!freshOnly || hasExpiry || Date.now() - cached.hydratedAt < URL_TTL_MS) && usableUrl(cached.url) ? cached : null;
}

function createResolvedAsset(pet, selected, metadata = {}) {
  const petId = normalizeText(pet && pet.id);
  const fallback = selected || {
    petId,
    jobId: getAvatarJobId(pet),
    kind: 'placeholder',
    fileId: '',
    url: '',
    transparent: false,
    alphaValid: false,
    metadata: normalizeAssetMetadata(null, { sourceRole: 'placeholder' }),
    qualityAccepted: false,
    qualityReason: 'PLACEHOLDER'
  };
  const cached = readAssetUrl(pet, fallback.fileId, fallback.metadata);
  return {
    petId,
    jobId: fallback.jobId,
    masterFileId: normalizeText(pet && (pet.generatedAvatarFileId || pet.generatedFileId)),
    displayFileId: fallback.fileId,
    imageUrl: fallback.url || (cached && cached.url) || '',
    assetKind: fallback.kind,
    hasCutout: fallback.transparent,
    alphaValid: fallback.alphaValid === true,
    cutoutStatus: normalizeText(pet && pet.generatedAvatarCutoutStatus || 'NONE').toUpperCase(),
    cacheHit: metadata.cacheHit === true || Boolean(!fallback.url && cached && cached.url),
    hydrationMs: Number(metadata.hydrationMs) || 0,
    urlRuntime: metadata.urlRuntime || cached?.urlRuntime || 'unknown',
    assetMetadata: fallback.metadata || normalizeAssetMetadata(),
    providerOriginal: fallback.metadata && fallback.metadata.providerOriginal === true,
    wasReencoded: fallback.metadata && fallback.metadata.wasReencoded === true,
    wasDownscaled: fallback.metadata && fallback.metadata.wasDownscaled === true,
    qualityAccepted: fallback.qualityAccepted !== false,
    qualityReason: fallback.qualityReason || '',
    fallbackReason: buildAssetCandidates(pet, true).filter((item, index) => index <= ({ 'hero-native-tight': 0, 'cutout-tight': 1, 'local-cutout-tight': 2, 'viapi-cutout': 3, 'local-cutout': 4, final: 5 }[fallback.kind] ?? 5))
      .filter(item => !item.enabled || !item.qualityAccepted || !item.fileId || item.unavailable || !item.url)
      .map(item => `${item.kind}: ${item.unavailable ? 'URL_UNAVAILABLE:' + (unavailableReason.get(getCacheKey(petId, item.fileId)) || 'TEMP_URL_EMPTY') : !item.fileId ? 'NOT_GENERATED' : !item.enabled ? (item.metadata.fallbackReason || item.metadata.reason || cutoutReason(pet, item)) : !item.qualityAccepted ? item.qualityReason : 'URL_PENDING'}`).join('; '),
    displaySurface: 'home hero',
    candidates: buildAssetCandidates(pet)
  };
}

function cutoutReason(pet, item) { return item.kind === 'viapi-cutout' ? (pet.generatedAvatarCutoutStatus || 'ALPHA_INVALID') : 'ALPHA_INVALID'; }

export function resolvePetHeroAsset(pet = {}, policy = {}) {
  if (pet.localImportPending === true) return resolveLocalImport(pet, policy);
  const candidates = buildAssetCandidates(pet).filter(policy.accept || (() => true));
  if (policy.preferFinal) candidates.sort((a,b) => Number(b.kind === 'final') - Number(a.kind === 'final'));
  // Keep a ready resource from this master while a higher-priority cutout URL is loading.
  return createResolvedAsset(pet, policy.preferFinal ? candidates[0] : candidates.find(item => item.url) || candidates[0]);
}

function localImportCandidates(pet, policy = {}) {
  const candidates = buildAssetCandidates(pet).filter(policy.accept || (() => true))
    .filter(item => !(policy.excludedFileIds || []).includes(item.fileId));
  if (policy.preferFinal) candidates.sort((a, b) => Number(b.kind === 'final') - Number(a.kind === 'final'));
  return candidates;
}

function resolveLocalImport(pet, policy = {}) {
  // Explicit local import is not authorization to renew the former guest's URLs.
  // Imported bytes retain the same master and quality-checked Hero selection.
  const cached = fileRuntime && localImportCandidates(pet, policy).find(item => item.url);
  if (cached) return { ...createResolvedAsset(pet, cached), localOnly: true, fallbackReason: 'NONE' };
  const isLocal = value => typeof value === 'string' && /^(?:_doc\/|_downloads\/|file:\/\/\/)/.test(value) && !value.includes('..');
  const master = isLocal(pet.generatedAvatarUrl);
  const local = [pet.generatedAvatarUrl, pet.originalPhotoUrl, pet.photo].find(isLocal) || '';
  const safeLocal = Boolean(local);
  const asset = createResolvedAsset(pet, safeLocal ? {
    petId: pet.id, kind: master ? 'final' : 'original', fileId: master ? pet.generatedAvatarFileId || '' : '', url: local,
    transparent: false, alphaValid: false, metadata: master ? pet.generatedAvatarMainAssetMetadata || {} : { sourceRole: 'original_photo' }
  } : null);
  return { ...asset, localOnly: true, fallbackReason: safeLocal ? 'NONE' : 'LOCAL_IMPORT_CLOUD_LINK_REQUIRED' };
}

async function hydrateFileId(petId, fileId, pet, forceRefresh = false, metadata = {}, userRetry = false) {
  if (!petId || !fileId) return { url: '', cacheHit: false, hydrationMs: 0 };
  if (fileRuntime) return acquireLocalFile(pet, fileId, metadata, async () => (await fetchAvatarTransport(petId, fileId, pet, forceRefresh)).url, userRetry);
  const cached = readCachedUrl(petId, fileId, true);
  if (cached && cached.url) return { url: cached.url, cacheHit: true, hydrationMs: 0, urlRuntime: cached.urlRuntime };
  const key = getCacheKey(petId, fileId);
  if (hydrationInFlight.has(key)) return hydrationInFlight.get(key);
  const request = (async () => {
    const startedAt = Date.now();
    const transport = await fetchAvatarTransport(petId, fileId, pet, forceRefresh);
    const { url, urlRuntime } = transport;
    const hydrationMs = Date.now() - startedAt;
    if (url && hydrationInFlight.get(key) === request) {
      hydratedUrlCache.set(key, { petId, fileId, url, urlRuntime, hydratedAt: Date.now() });
      failedUrls.delete(url);
      unavailableUntil.delete(key);
      unavailableReason.delete(key);
      notifyAsset(petId);
    }
    return { url, cacheHit: false, hydrationMs, urlRuntime };
  })();
  hydrationInFlight.set(key, request);
  try {
    return await request;
  } finally {
    if (hydrationInFlight.get(key) === request) hydrationInFlight.delete(key);
  }
}

async function fetchAvatarTransport(petId, fileId, pet, forceRefresh) {
    let response;
    if (getAvatarJobId(pet) && /^cloud:\/\/[^/]+\/(?:pety-private-v3\/)?pet-avatar\/final\//.test(fileId) && typeof uniCloud.callFunction === 'function') {
      // Private storage URLs are issued by the owner-checked cloud function.
      // Client SDK/local-debug access must not determine whether Hero exists.
      const resolved = await uniCloud.callFunction({ name: 'api_pet_avatar', data: {
        uniIdToken: typeof uni !== 'undefined' && typeof uni.getStorageSync === 'function' ? uni.getStorageSync('uni_id_token') || '' : '',
        action: 'getAvatarDisplayUrls', petId, selectedJobId: getAvatarJobId(pet),
        expectedFinalFileId: pet.generatedAvatarFileId, fileIds: [fileId]
      } });
      response = resolved && resolved.result;
      if (!response || response.code !== 0) throw Object.assign(new Error('AVATAR_URL_RESOLVE_FAILED'), { code: response?.errorCode || 'AVATAR_URL_RESOLVE_FAILED' });
    } else response = await privateMediaUrls([fileId],petId);
    const item = response && response.fileList && response.fileList[0];
    const url = usableUrl(item && (item.tempFileURL || item.tempFileUrl) || '', forceRefresh);
    const urlRuntime = response?.runtimeEnvironment || 'client-storage';
    return { url, urlRuntime };
}

export async function hydratePetHeroAsset(pet = {}, options = {}) {
  const generation = cacheGeneration;
  const runtime = fileRuntime, owner = runtime?.readOwner();
  const current = () => {
    const next = runtime?.readOwner();
    return generation === cacheGeneration && runtime === fileRuntime && (!runtime ||
      (next.ready && next.namespace === owner.namespace && next.version === owner.version));
  };
  if (pet.localImportPending === true) {
    if (runtime) for (const candidate of localImportCandidates(pet, options)) {
      try {
        const hit = await nativeCache().importGuest(fileDescriptor(pet, candidate.fileId, candidate.metadata));
        if (!current()) return createResolvedAsset(pet, null);
        if (hit) return { ...createResolvedAsset(pet, { ...candidate, url: hit.localPath },
          { cacheHit: true, urlRuntime: 'app-private-cache' }), localOnly: true, fallbackReason: 'NONE' };
      } catch (_) {
        if (!current()) return createResolvedAsset(pet, null);
      }
    }
    return resolveLocalImport(pet, options);
  }
  const petId = normalizeText(pet.id);
  if (!petId) return createResolvedAsset(pet, null);
  if (options.forceRefresh || options.userRetry) buildAssetCandidates(pet, true).forEach(candidate => unavailableUntil.delete(getCacheKey(petId, candidate.fileId)));
  const candidates = buildAssetCandidates(pet).filter(options.accept || (() => true)).filter(item => !(options.excludedFileIds || []).includes(item.fileId || item.url));
  if (options.preferFinal) candidates.sort((a,b) => Number(b.kind === 'final') - Number(a.kind === 'final'));
  for (const candidate of candidates) {
    try {
      if (candidate.petId !== petId) continue;
      if (options.forceRefresh && candidate.fileId) hydratedUrlCache.delete(getCacheKey(petId, candidate.fileId));
      if (!fileRuntime && candidate.url && ((!options.forceRefresh && readCachedUrl(petId, candidate.fileId, true)) || !candidate.fileId)) {
        return createResolvedAsset(pet, candidate, { cacheHit: false, hydrationMs: 0 });
      }
      const hydrated = await hydrateFileId(petId, candidate.fileId, pet, options.forceRefresh === true, candidate.metadata, options.userRetry === true);
      if(!current())return createResolvedAsset(pet,null);
      if (hydrated.url) return createResolvedAsset(pet, { ...candidate, url: hydrated.url }, hydrated);
    } catch (error) {
      if(!current())return createResolvedAsset(pet,null);
      unavailableReason.set(getCacheKey(petId, candidate.fileId), String(error?.code || error?.errCode || 'TEMP_URL_REQUEST_FAILED').replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 100));
      const retained = readAssetUrl(pet, candidate.fileId, candidate.metadata);
      if (retained) return createResolvedAsset(pet, {...candidate, url:retained.url}, {cacheHit:true});
      // Preserve quality: validated cutouts first, master final before downscaled display fallbacks.
    }
    unavailableUntil.set(getCacheKey(petId, candidate.fileId), Date.now() + 30000);
    notifyAsset(petId);
  }
  return createResolvedAsset(pet, null);
}

export function getAvatarAssetHashPrefix(fileId = '') {
  let hash = 2166136261;
  const value = normalizeText(fileId);
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return value ? (hash >>> 0).toString(16).padStart(8, '0').slice(0, 8) : 'none';
}

export function clearAvatarDisplayAssetCache(petId = '', fileId = '') {
  if(!petId){cacheGeneration++;failedUrls.clear();}
  for (const key of localBindings.keys()) if (!petId || (fileId ? key === getCacheKey(petId, fileId) : key.startsWith(`${petId}::`))) localBindings.delete(key);
  Array.from(unavailableReason.keys()).forEach(key => {
    if (!petId || (fileId ? key === getCacheKey(petId, fileId) : key.startsWith(`${petId}::`))) unavailableReason.delete(key);
  });
  Array.from(unavailableUntil.keys()).forEach(key => {
    if (!petId || (fileId ? key === getCacheKey(petId, fileId) : key.startsWith(`${petId}::`))) unavailableUntil.delete(key);
  });
  if (petId && fileId) {
    hydratedUrlCache.delete(getCacheKey(petId, fileId));
    hydrationInFlight.delete(getCacheKey(petId, fileId));
    return;
  }
  if (petId) {
    Array.from(hydratedUrlCache.keys()).forEach(key => {
      if (key.startsWith(`${petId}::`)) hydratedUrlCache.delete(key);
    });
    Array.from(hydrationInFlight.keys()).forEach(key => {
      if (key.startsWith(`${petId}::`)) hydrationInFlight.delete(key);
    });
    return;
  }
  hydratedUrlCache.clear();
  hydrationInFlight.clear();
}

export const getAvatarDisplayAsset = resolvePetHeroAsset;
export const hydrateAvatarDisplayAsset = hydratePetHeroAsset;
export const resolveHeroVisualAsset = resolvePetHeroAsset;
export const hydrateHeroVisualAsset = hydratePetHeroAsset;
