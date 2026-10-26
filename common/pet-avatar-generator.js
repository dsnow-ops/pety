import { scopedStorage, captureDataScope, isDataScopeCurrent, assertDataScope } from './scoped-storage.js';
import { buildAiConsentPayload, hasAiConsent } from './ai-consent.js';
import { getAvatarDisplayAsset as resolveAvatarDisplayAsset, reuseConfirmedAvatarAsset } from './avatar-display-asset.js';
import { isAvatarDevEntitlementBypass } from './avatar-generation-entitlement.js';
import { getPetRelationshipStage, normalizeRelationshipStage } from './relationship-config.js';
import { prepareAvatarSourceImage } from './avatar-source-image.js';

const PLACEHOLDER_IMAGE = '/static/pet.png';
const AVATAR_JOB_PREFIX = 'pet_avatar_job_';
const AVATAR_SESSION_PREFIX = 'pet_avatar_session_';
const ACTIVE_JOB_STATUSES = ['CREATING', 'PENDING', 'RUNNING'];
const avatarCreateFlights = new Map();
const AVATAR_SOURCES = ['original', 'generated', 'placeholder'];
const AVATAR_STATUSES = ['none', 'pending', 'ready', 'failed'];
const AVATAR_STYLES = ['realistic', 'soft3d', 'memorial'];
const AVATAR_SOURCE_UPLOAD_MAX_ATTEMPTS = 3;
const AVATAR_SOURCE_UPLOAD_RETRY_DELAYS_MS = [650, 1500];

function callAvatarFunction(request) {
  const uniIdToken = typeof uni !== 'undefined' && typeof uni.getStorageSync === 'function' ? uni.getStorageSync('uni_id_token') || '' : '';
  return uniCloud.callFunction({ ...request, data: { ...request.data, uniIdToken } });
}

// A local import preserves pet IDs and history; it must not create a new quota
// identity or reuse the previous guest's cloud task before a verified claim.
function assertAvatarCloudOwner(petId, pet) {
  const saved = scopedStorage.getStorageSync('my_pets_list');
  if (pet?.localImportPending || (Array.isArray(saved) && saved.some(p => p.id === petId && p.localImportPending))) {
    throw Object.assign(new Error('本机资料已保留，云端形象与生成额度尚未完成关联。'), { code: 'LOCAL_IMPORT_CLOUD_LINK_REQUIRED' });
  }
}

const DEFAULT_STYLE_BY_STAGE = { current: 'soft3d', deceased: 'memorial' };
const STYLE_LABELS = { realistic: '真实照片风', soft3d: '柔和 3D 风', memorial: '纪念肖像风' };
const STATUS_LABELS = { none: '尚未生成', pending: '生成中', ready: '已就绪', failed: '生成失败' };

export function fillAvatarPhotoSlots(currentPhotos = [], startIndex = 0, selectedPaths = []) {
  const next = Array.isArray(currentPhotos) ? currentPhotos.slice(0, 3) : [];
  const safeStart = Math.min(Math.max(Number(startIndex) || 0, 0), 2);
  const emptyIndexes = [];
  for (let index = safeStart; index < 3; index += 1) if (!next[index]) emptyIndexes.push(index);
  for (let index = 0; index < safeStart; index += 1) if (!next[index]) emptyIndexes.push(index);
  (Array.isArray(selectedPaths) ? selectedPaths : []).filter(Boolean).slice(0, emptyIndexes.length).forEach((path, index) => {
    next[emptyIndexes[index]] = { path };
  });
  return next.slice(0, 3);
}

export function getDefaultAvatarStyle(stage) {
  return DEFAULT_STYLE_BY_STAGE[normalizeRelationshipStage(stage)] || DEFAULT_STYLE_BY_STAGE.current;
}

export function normalizeAvatarSource(source) {
  return AVATAR_SOURCES.includes(source) ? source : 'placeholder';
}

export function normalizeAvatarStatus(status) {
  return AVATAR_STATUSES.includes(status) ? status : 'none';
}

export function normalizeAvatarStyle(style, stage) {
  return AVATAR_STYLES.includes(style) ? style : getDefaultAvatarStyle(stage);
}

export function getAvatarStatusText(petOrStatus) {
  const status = petOrStatus && typeof petOrStatus === 'object' ? petOrStatus.avatarStatus : petOrStatus;
  return STATUS_LABELS[normalizeAvatarStatus(status)] || STATUS_LABELS.none;
}

export function getAvatarStyleText(styleOrPet, stage) {
  const style = styleOrPet && typeof styleOrPet === 'object' ? styleOrPet.avatarStyle : styleOrPet;
  return STYLE_LABELS[normalizeAvatarStyle(style, stage)] || STYLE_LABELS.realistic;
}

function getJobKey(petId) {
  return `${AVATAR_JOB_PREFIX}${petId}`;
}

function getSessionKey(petId) {
  return `${AVATAR_SESSION_PREFIX}${petId}`;
}

function createSessionId(petId) {
  const safePetId = String(petId || 'pet').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'pet';
  return `${safePetId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeMainAssetMetadata(raw = null) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    compositionVersion: String(raw.compositionVersion || ''),
    requestedSize: String(raw.requestedSize || ''),
    poseVerification: String(raw.poseVerification || 'NOT_VISUALLY_VERIFIED'),
    assetRole: String(raw.assetRole || 'workbench_master'),
    width: Math.max(Number(raw.width) || 0, 0),
    height: Math.max(Number(raw.height) || 0, 0),
    bytes: Math.max(Number(raw.bytes) || 0, 0),
    mime: String(raw.mime || ''),
    hasAlpha: typeof raw.hasAlpha === 'boolean' ? raw.hasAlpha : null,
    alphaBoundingBox: raw.alphaBoundingBox || null,
    alphaCoverage: raw.alphaCoverage ?? null,
    contentWidth: raw.contentWidth || 0,
    contentHeight: raw.contentHeight || 0,
    transparentPaddingRatio: raw.transparentPaddingRatio ?? null,
    extension: String(raw.extension || ''),
    wasReencoded: raw.wasReencoded === true,
    wasDownscaled: raw.wasDownscaled === true,
    providerOriginal: raw.providerOriginal === true,
    providerWidth: Math.max(Number(raw.providerWidth) || 0, 0),
    providerHeight: Math.max(Number(raw.providerHeight) || 0, 0),
    providerBytes: Math.max(Number(raw.providerBytes) || 0, 0),
    providerMime: String(raw.providerMime || ''),
    providerSize: String(raw.providerSize || ''),
    sourceRole: String(raw.sourceRole || '')
  };
}

function normalizeJob(raw = {}) {
  return {
    jobId: String(raw.jobId || ''),
    petId: String(raw.petId || ''),
    status: String(raw.status || 'UNKNOWN').toUpperCase(),
    startedAt: Number(raw.startedAt) || 0,
    sourceCount: Number(raw.sourceCount) || 0,
    progressStage: String(raw.progressStage || ''),
    generatedFileId: String(raw.generatedFileId || ''),
    generatedTempUrl: String(raw.generatedTempUrl || ''),
    generatedThumbnailFileId: String(raw.generatedThumbnailFileId || ''),
    generatedThumbnailUrl: String(raw.generatedThumbnailUrl || ''),
    mainAssetMetadata: normalizeMainAssetMetadata(raw.mainAssetMetadata),
    requestId: String(raw.requestId || ''),
    errorCode: String(raw.errorCode || raw.code || ''),
    providerErrorCode: String(raw.providerErrorCode || ''),
    providerErrorMessage: String(raw.providerErrorMessage || ''),
    providerRequestId: String(raw.providerRequestId || ''),
    httpStatus: Math.max(Number(raw.httpStatus) || 0, 0),
    jobKind: ['initial', 'regenerate', 'revision'].includes(raw.jobKind) ? raw.jobKind : 'initial',
    generationSessionId: String(raw.generationSessionId || ''),
    seed: raw.seed !== null && raw.seed !== undefined && raw.seed !== '' && Number.isInteger(Number(raw.seed)) ? Number(raw.seed) : null
  };
}

function normalizeCandidate(raw = {}) {
  const jobId = String(raw.jobId || raw.candidateId || '');
  return {
    candidateId: String(raw.candidateId || jobId),
    jobId,
    jobKind: ['initial', 'regenerate', 'revision'].includes(raw.jobKind) ? raw.jobKind : 'initial',
    parentJobId: String(raw.parentJobId || ''),
    fileId: String(raw.fileId || raw.generatedFileId || ''),
    generatedFileId: String(raw.generatedFileId || raw.fileId || ''),
    generatedTempUrl: String(raw.generatedTempUrl || ''),
    generatedThumbnailFileId: String(raw.generatedThumbnailFileId || ''),
    generatedThumbnailUrl: String(raw.generatedThumbnailUrl || ''),
    mainAssetMetadata: normalizeMainAssetMetadata(raw.mainAssetMetadata),
    seed: raw.seed !== null && raw.seed !== undefined && raw.seed !== '' && Number.isInteger(Number(raw.seed)) ? Number(raw.seed) : null,
    createdAt: Number(raw.createdAt) || Date.now()
  };
}

export function mergeAvatarCandidates(existing = [], incoming = []) {
  const existingByJobId = new Map((Array.isArray(existing) ? existing : []).map(item => [String(item.jobId || ''), normalizeCandidate(item)]));
  const merged = [];
  (Array.isArray(incoming) ? incoming : []).forEach(raw => {
    const next = normalizeCandidate(raw);
    if (!next.jobId) return;
    const previous = existingByJobId.get(next.jobId) || {};
    merged.push(normalizeCandidate({
      ...previous,
      ...next,
      generatedTempUrl: next.generatedTempUrl || previous.generatedTempUrl || '',
      generatedThumbnailUrl: next.generatedThumbnailUrl || previous.generatedThumbnailUrl || '',
      mainAssetMetadata: next.mainAssetMetadata || previous.mainAssetMetadata || null
    }));
    existingByJobId.delete(next.jobId);
  });
  existingByJobId.forEach(candidate => merged.push(candidate));
  return merged.sort((left, right) => left.createdAt - right.createdAt);
}

function normalizeSession(raw = {}, petId = '') {
  const candidates = Array.isArray(raw.candidates) ? raw.candidates.map(normalizeCandidate).filter(item => item.jobId) : [];
  return {
    lastFailure: raw.lastFailure && typeof raw.lastFailure === 'object' ? {
      stage: String(raw.lastFailure.stage || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60),
      errorCode: String(raw.lastFailure.errorCode || '').replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 80),
      at: Number(raw.lastFailure.at) || 0
    } : null,
    pendingOperation: raw.pendingOperation && typeof raw.pendingOperation.id === 'string' && typeof raw.pendingOperation.fingerprint === 'string'
      ? { id: raw.pendingOperation.id, fingerprint: raw.pendingOperation.fingerprint } : null,
    sessionId: String(raw.sessionId || createSessionId(petId)),
    petId: String(raw.petId || petId),
    sourceFileIds: Array.isArray(raw.sourceFileIds) ? raw.sourceFileIds.filter(Boolean).slice(0, 3) : [],
    sourcePhotoPaths: Array.isArray(raw.sourcePhotoPaths) ? raw.sourcePhotoPaths.filter(Boolean).slice(0, 3) : [],
    candidateJobIds: candidates.map(item => item.jobId),
    candidates,
    selectedJobId: String(raw.selectedJobId || (candidates[0] && candidates[0].jobId) || ''),
    activeJobId: String(raw.activeJobId || ''),
    createdAt: Number(raw.createdAt) || Date.now()
  };
}

export function getAvatarGenerationSession(petId) {
  if (!petId) return null;
  const stored = scopedStorage.getStorageSync(getSessionKey(petId));
  return stored && typeof stored === 'object' ? normalizeSession(stored, petId) : null;
}

export function saveAvatarGenerationSession(session) {
  if (!session || !session.petId) return null;
  const normalized = normalizeSession(session, session.petId);
  scopedStorage.setStorageSync(getSessionKey(normalized.petId), normalized);
  return normalized;
}

export function ensureAvatarGenerationSession(petId, patch = {}) {
  if (!petId) return null;
  const current = getAvatarGenerationSession(petId) || normalizeSession({}, petId);
  const definedPatch = Object.keys(patch).reduce((result, key) => {
    if (patch[key] !== undefined) result[key] = patch[key];
    return result;
  }, {});
  return saveAvatarGenerationSession({ ...current, ...definedPatch, petId });
}

export function selectAvatarCandidate(petId, jobId) {
  const session = getAvatarGenerationSession(petId);
  if (!session || !session.candidateJobIds.includes(jobId)) return session;
  return saveAvatarGenerationSession({ ...session, selectedJobId: jobId });
}

export function clearAvatarGenerationSession(petId) {
  if (petId) scopedStorage.removeStorageSync(getSessionKey(petId));
}

function addCandidateToSession(petId, result) {
  const session = ensureAvatarGenerationSession(petId, { sessionId: result.generationSessionId || undefined });
  if (!session || session.candidateJobIds.includes(result.jobId)) return session;
  const candidate = normalizeCandidate({ ...result, createdAt: Date.now() });
  const preservePreviousSelection = candidate.jobKind === 'revision' && session.candidateJobIds.includes(session.selectedJobId);
  return saveAvatarGenerationSession({
    ...session,
    candidates: session.candidates.concat(candidate),
    selectedJobId: preservePreviousSelection ? session.selectedJobId : result.jobId,
    activeJobId: ''
  });
}

export function getStoredAvatarJob(petId) {
  if (!petId) return null;
  const stored = scopedStorage.getStorageSync(getJobKey(petId));
  return stored && typeof stored === 'object' ? normalizeJob(stored) : null;
}

export function saveAvatarJob(job) {
  const normalized = normalizeJob(job);
  if (!normalized.petId) return null;
  scopedStorage.setStorageSync(getJobKey(normalized.petId), normalized);
  return normalized;
}

export function clearAvatarJob(petId) {
  if (petId) scopedStorage.removeStorageSync(getJobKey(petId));
}

export function hasActiveAvatarJob(petId) {
  const job = getStoredAvatarJob(petId);
  return Boolean(job && job.jobId && ACTIVE_JOB_STATUSES.includes(job.status));
}

function createUploadPath(petId, uploadBatchId, index) {
  const safePetId = String(petId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'pet';
  return `pet-avatar/input/${safePetId}/${uploadBatchId}/source-${index + 1}.jpg`;
}

function waitForUploadRetry(delay) {
  return new Promise(resolve => setTimeout(resolve, delay));
}

function getUploadFailureMessage(error) {
  return String(error && (error.errMsg || error.message || error.code) || 'SOURCE_UPLOAD_FAILED')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, 240);
}

function isRetryableSourceUploadError(error) {
  const message = getUploadFailureMessage(error);
  return !/permission|not\s+found|no\s+such\s+file|invalid[^ ]*\s*(file|path)|file[^ ]*\s+not\s+exist/i.test(message);
}

function createSourceUploadError(error, attempts) {
  const message = getUploadFailureMessage(error);
  const wrapped = new Error(message);
  wrapped.code = 'AVATAR_SOURCE_UPLOAD_FAILED';
  wrapped.stage = 'SOURCE_UPLOAD';
  wrapped.attempts = attempts;
  wrapped.providerErrorCode = 'UNICLOUD_OSS_UPLOAD_FAILED';
  wrapped.providerErrorMessage = `${message} (attempts=${attempts})`;
  return wrapped;
}

function persistAvatarSourceImage(filePath) {
  if (!filePath || typeof uni.saveFile !== 'function') return Promise.resolve(filePath);
  return new Promise(resolve => {
    uni.saveFile({
      tempFilePath: filePath,
      success: result => resolve(String(result && result.savedFilePath || filePath)),
      fail: () => resolve(filePath)
    });
  });
}

export async function persistAvatarSourceImages(filePaths = []) {
  const scope = captureDataScope();
  assertDataScope(scope);
  const paths = Array.isArray(filePaths) ? filePaths.filter(Boolean).slice(0, 3) : [];
  const saved = [];
  for (const path of paths) {
    const prepared = await prepareAvatarSourceImage(path);
    assertDataScope(scope);
    saved.push(await persistAvatarSourceImage(prepared));
    assertDataScope(scope);
  }
  return saved;
}

export async function uploadAvatarSourceImages(pet, filePaths = {}, onProgress) {
  assertAvatarCloudOwner(pet?.id, pet);
  const scope = captureDataScope();
  assertDataScope(scope);
  if (!pet || !pet.id) throw new Error('INVALID_PET_ID');
  if (!hasAiConsent('pet_avatar')) throw new Error('AI_CONSENT_REQUIRED');
  const paths = Array.isArray(filePaths) ? filePaths.filter(Boolean).slice(0, 3) : [];
  if (!paths.length || paths.length > 3) throw new Error('INVALID_SOURCE_IMAGES');
  const uploadBatchId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const session = ensureAvatarGenerationSession(pet.id);
  const fileIds = [];

  for (let index = 0; index < paths.length; index += 1) {
    const ticketResponse = await callAvatarFunction({ name:'api_pet_avatar',data:{action:'issueSourceUpload',petId:pet.id,
      generationSessionId:session.sessionId,batchId:uploadBatchId,slot:index,...buildAiConsentPayload('pet_avatar')} });
    assertDataScope(scope);
    const ticket = ticketResponse?.result;
    if (ticket?.code !== 0 || !ticket.ticketId || !ticket.cloudPath) throw Object.assign(new Error(ticket?.message || '照片上传授权暂不可用'),{code:ticket?.errorCode || 'AVATAR_SOURCE_UPLOAD_UNAVAILABLE'});
    const cloudPath = ticket.cloudPath;
    let lastError = null;
    let uploadedFileId = '';
    for (let attempt = 1; attempt <= AVATAR_SOURCE_UPLOAD_MAX_ATTEMPTS; attempt += 1) {
      try {
        assertDataScope(scope);
        const result = await uniCloud.uploadFile({
          filePath: paths[index],
          cloudPath,
          onUploadProgress: progressEvent => {
            if (!isDataScopeCurrent(scope) || typeof onProgress !== 'function') return;
            const loaded = Number(progressEvent && progressEvent.loaded) || 0;
            const total = Number(progressEvent && progressEvent.total) || 0;
            onProgress(index, total > 0 ? Math.round((loaded * 100) / total) : 0);
          }
        });
        assertDataScope(scope);
        uploadedFileId = String(result && (result.fileID || result.fileId) || '');
        if (!uploadedFileId) throw new Error('SOURCE_UPLOAD_EMPTY_RESPONSE');
        break;
      } catch (error) {
        assertDataScope(scope);
        lastError = error;
        if (attempt >= AVATAR_SOURCE_UPLOAD_MAX_ATTEMPTS || !isRetryableSourceUploadError(error)) {
          throw createSourceUploadError(error, attempt);
        }
        if (typeof onProgress === 'function') onProgress(index, 0);
        await waitForUploadRetry(AVATAR_SOURCE_UPLOAD_RETRY_DELAYS_MS[attempt - 1]);
        assertDataScope(scope);
      }
    }
    if (!uploadedFileId) throw createSourceUploadError(lastError, AVATAR_SOURCE_UPLOAD_MAX_ATTEMPTS);
    const receiptResponse = await callAvatarFunction({name:'api_pet_avatar',data:{action:'completeSourceUpload',petId:pet.id,
      generationSessionId:session.sessionId,ticketId:ticket.ticketId,fileId:uploadedFileId,...buildAiConsentPayload('pet_avatar')}});
    assertDataScope(scope);
    if(receiptResponse?.result?.code!==0 || receiptResponse.result.fileId!==uploadedFileId) {
      throw Object.assign(new Error(receiptResponse?.result?.message || '照片尚未完成安全校验'),{
        code:receiptResponse?.result?.errorCode || 'AVATAR_SOURCE_UPLOAD_UNAVAILABLE', stage:'SOURCE_VALIDATION'
      });
    }
    fileIds.push(uploadedFileId);
  }
  return fileIds;
}

async function createAvatarJobRequest(pet = {}, options = {}) {
  assertAvatarCloudOwner(pet.id, pet);
  const scope = captureDataScope();
  assertDataScope(scope);
  if (!pet.id) throw new Error('INVALID_PET_ID');
  if (!hasAiConsent('pet_avatar')) throw new Error('AI_CONSENT_REQUIRED');
  const existing = getStoredAvatarJob(pet.id);
  if (existing && existing.jobId && ACTIVE_JOB_STATUSES.includes(existing.status)) return existing;
  const jobKind = ['initial', 'regenerate', 'revision'].includes(options.jobKind) ? options.jobKind : 'initial';
  const sourceFileIds = Array.isArray(options.sourceFileIds) ? options.sourceFileIds : [];
  if (jobKind !== 'revision' && (sourceFileIds.length < 1 || sourceFileIds.length > 3)) throw new Error('INVALID_SOURCE_IMAGES');
  const session = ensureAvatarGenerationSession(pet.id, jobKind === 'revision' ? {} : {
    sourceFileIds, sourcePhotoPaths: options.sourcePhotoPaths || undefined
  });
  const fingerprint = JSON.stringify([jobKind,sourceFileIds,options.parentJobId||'',options.revisionText||'']);
  if (session.pendingOperation && session.pendingOperation.fingerprint !== fingerprint) {
    throw Object.assign(new Error('前一次生成是否受理仍待核对，请先恢复原任务'), { code: 'WAN_SUBMISSION_UNCERTAIN' });
  }
  const operation = session.pendingOperation || { id: createSessionId(pet.id), fingerprint };
  saveAvatarGenerationSession({ ...session, pendingOperation: operation });

  const response = await callAvatarFunction({
    name: 'api_pet_avatar',
    data: {
      action: 'createJob',
      petId: pet.id,
      ...(jobKind === 'revision' ? {} : { sourceFileIds }),
      jobKind,
      parentJobId: options.parentJobId || '',
      revisionText: options.revisionText || '',
      generationSessionId: session.sessionId,
      operationId: operation.id,
      devEntitlementBypassRequested: isAvatarDevEntitlementBypass(),
      ...buildAiConsentPayload('pet_avatar')
    }
  });
  assertDataScope(scope);
  const result = response && response.result;
  if (!result || result.code !== 0 || !result.jobId) {
    if (result?.code !== 0 && result?.errorCode && !['WAN_SUBMISSION_UNCERTAIN','AVATAR_REQUEST_FAILED'].includes(result.errorCode)) {
      saveAvatarGenerationSession({ ...session, pendingOperation: null });
    }
    const error = new Error(result && result.message || 'AVATAR_CREATE_FAILED');
    error.code = result && result.errorCode || 'AVATAR_CREATE_FAILED';
    error.providerErrorCode = result && result.providerErrorCode || '';
    error.providerErrorMessage = result && result.providerErrorMessage || '';
    error.providerRequestId = result && result.providerRequestId || '';
    error.httpStatus = Number(result && result.httpStatus) || 0;
    throw error;
  }
  const job = saveAvatarJob({
    jobId: result.jobId,
    requestId: result.requestId,
    petId: pet.id,
    status: result.taskStatus || 'PENDING',
    startedAt: Date.now(),
    sourceCount: jobKind === 'revision' ? session.sourceFileIds.length : sourceFileIds.length,
    progressStage: 'generating',
    jobKind,
    generationSessionId: result.generationSessionId || session.sessionId,
    seed: result.seed
  });
  saveAvatarGenerationSession({ ...session, pendingOperation: null, activeJobId: job.jobId, sessionId: job.generationSessionId });
  return job;
}

export function createAvatarJob(pet = {}, options = {}) {
  const petId = String(pet && pet.id || '');
  if (!petId) return Promise.reject(new Error('INVALID_PET_ID'));
  const scope = captureDataScope();
  if (!scope.ready) return Promise.reject(Object.assign(new Error('DATA_SCOPE_UNRESOLVED'), { code: 'DATA_SCOPE_UNRESOLVED' }));
  const flightKey = JSON.stringify([scope.namespace, scope.version, petId]);
  if (avatarCreateFlights.has(flightKey)) return avatarCreateFlights.get(flightKey);
  const request = createAvatarJobRequest(pet, options).finally(() => {
    if (avatarCreateFlights.get(flightKey) === request) avatarCreateFlights.delete(flightKey);
  });
  avatarCreateFlights.set(flightKey, request);
  return request;
}

// Transport lookup must not rewrite the active job or selected workbench draft.
async function readAvatarJobResponse(petId, resolvedJobId, candidateTransport = null) {
  assertAvatarCloudOwner(petId);
  const scope = captureDataScope();
  assertDataScope(scope);
  if (!petId || !resolvedJobId) throw new Error('JOB_NOT_FOUND');
  if (!candidateTransport && !hasAiConsent('pet_avatar')) throw new Error('AI_CONSENT_REQUIRED');
  const response = await callAvatarFunction({
    name: 'api_pet_avatar',
    data: {
      action: candidateTransport ? 'getCandidateDisplayUrls' : 'getJobStatus',
      petId,
      jobId: resolvedJobId,
      ...(candidateTransport || buildAiConsentPayload('pet_avatar'))
    }
  });
  assertDataScope(scope);
  const result = response && response.result;
  if (!result || result.code !== 0) {
    const error = new Error(result && result.message || 'AVATAR_STATUS_FAILED');
    error.code = result && result.errorCode || 'AVATAR_STATUS_FAILED';
    error.stage = 'STATUS_QUERY';
    error.providerErrorCode = result?.providerErrorCode || '';
    error.providerErrorMessage = result?.providerErrorMessage || '';
    error.providerRequestId = result?.providerRequestId || '';
    error.httpStatus = Number(result?.httpStatus) || 0;
    throw error;
  }
  return result;
}

export async function readAvatarCandidateTransport(petId, candidate = {}) {
  const fileId = candidate.fileId || candidate.generatedFileId;
  if (!candidate.jobId || !fileId) throw new Error('CANDIDATE_ASSET_REQUIRED');
  const result = await readAvatarJobResponse(petId, candidate.jobId, {
    expectedFileId: fileId, expectedThumbnailFileId: candidate.generatedThumbnailFileId || ''
  });
  if (result.status !== 'SUCCEEDED' || result.generatedFileId !== fileId ||
      (candidate.generatedThumbnailFileId && result.generatedThumbnailFileId !== candidate.generatedThumbnailFileId)) {
    throw new Error('CANDIDATE_ASSET_CHANGED');
  }
  return { jobId: candidate.jobId, generatedFileId: result.generatedFileId,
    generatedTempUrl: result.generatedTempUrl, generatedThumbnailFileId: result.generatedThumbnailFileId,
    generatedThumbnailUrl: result.generatedThumbnailUrl };
}

export async function getAvatarJobStatus(petId, jobId) {
  const scope = captureDataScope();
  assertDataScope(scope);
  const stored = getStoredAvatarJob(petId);
  const resolvedJobId = jobId || (stored && stored.jobId);
  const result = await readAvatarJobResponse(petId, resolvedJobId);
  assertDataScope(scope);
  const job = saveAvatarJob({
    ...(stored || {}),
    petId,
    jobId: resolvedJobId,
    status: result.status,
    generatedFileId: result.generatedFileId,
    generatedTempUrl: result.generatedTempUrl,
    generatedThumbnailFileId: result.generatedThumbnailFileId,
    generatedThumbnailUrl: result.generatedThumbnailUrl,
    mainAssetMetadata: result.mainAssetMetadata || (stored && stored.mainAssetMetadata),
    errorCode: result.errorCode || '',
    providerErrorCode: result.providerErrorCode || '',
    providerErrorMessage: result.providerErrorMessage || '',
    providerRequestId: result.providerRequestId || '',
    jobKind: result.jobKind || (stored && stored.jobKind),
    generationSessionId: result.generationSessionId || (stored && stored.generationSessionId),
	seed: result.seed !== undefined ? result.seed : (stored && stored.seed),
    progressStage: result.status === 'SUCCEEDED' ? 'complete' : (result.status === 'FAILED' ? 'failed' : 'generating')
  });
  if (job.status === 'SUCCEEDED' && job.generatedFileId && job.generatedTempUrl) addCandidateToSession(petId, job);
  else if (['FAILED', 'CANCELED'].includes(job.status)) {
    const session = getAvatarGenerationSession(petId);
    if (session) saveAvatarGenerationSession({ ...session, activeJobId: '' });
  }
  return job;
}

export async function confirmGeneratedAvatar(pet, selectedJobId) {
  assertAvatarCloudOwner(pet?.id, pet);
  const scope = captureDataScope();
  assertDataScope(scope);
  if (!pet || !pet.id) throw new Error('INVALID_PET_ID');
  if (!hasAiConsent('pet_avatar')) throw new Error('AI_CONSENT_REQUIRED');
  const session = getAvatarGenerationSession(pet.id);
  if (!session || !selectedJobId) throw new Error('INVALID_GENERATION_SESSION');
  const response = await callAvatarFunction({
    name: 'api_pet_avatar',
    data: {
      action: 'confirmAvatar',
      petId: pet.id,
      selectedJobId,
      generationSessionId: session.sessionId,
      ...buildAiConsentPayload('pet_avatar')
    }
  });
  assertDataScope(scope);
  const result = response && response.result;
  if (!result || result.code !== 0 || !result.generatedFileId) {
    const error = new Error(result && result.message || 'AVATAR_CONFIRM_FAILED');
    error.code = result && result.errorCode || 'AVATAR_CONFIRM_FAILED';
    throw error;
  }
  const selected = session.candidates?.find(candidate => candidate.jobId === selectedJobId);
  if (selected && result.masterCopy) {
    // Optional optimization: a cache failure cannot undo a confirmed cloud save.
    try { await reuseConfirmedAvatarAsset(selected, pet, result); } catch (_) { /* Normal final hydration remains available. */ }
    assertDataScope(scope);
  }
  return result;
}

export async function submitAvatarFeedback(petId, selectedJobId, category, note, locale) {
  assertAvatarCloudOwner(petId);
  const scope = captureDataScope();
  assertDataScope(scope);
  if (!petId || !selectedJobId) throw new Error('INVALID_AVATAR_FEEDBACK');
  const response = await callAvatarFunction({
    name: 'api_pet_avatar',
    data: { action: 'submitAvatarFeedback', petId, selectedJobId, category, note, locale }
  });
  assertDataScope(scope);
  const result = response && response.result;
  if (!result || result.code !== 0) {
    const error = new Error(result && result.message || 'AVATAR_FEEDBACK_FAILED');
    error.code = result && result.errorCode || 'AVATAR_FEEDBACK_FAILED';
    throw error;
  }
  return result;
}

export async function startAvatarCutout(petId, selectedJobId) {
  assertAvatarCloudOwner(petId);
  const scope = captureDataScope();
  assertDataScope(scope);
  if (!petId || !selectedJobId) return null;
  if (!hasAiConsent('pet_avatar')) {
    const error = new Error('AI_CONSENT_REQUIRED');
    error.code = 'AI_CONSENT_REQUIRED';
    throw error;
  }
  const response = await callAvatarFunction({
    name: 'api_pet_avatar',
    data: {
      action: 'startAvatarCutout',
      petId,
      selectedJobId,
      ...buildAiConsentPayload('pet_avatar')
    }
  });
  assertDataScope(scope);
  const result = response && response.result;
  if (!result || result.code !== 0) {
    const error = new Error(result && result.message || 'AVATAR_HERO_START_FAILED');
    error.code = result && result.errorCode || 'AVATAR_HERO_START_FAILED';
    throw error;
  }
  return result;
}

export async function prepareAvatarHeroDisplay(petId, selectedJobId) {
  assertAvatarCloudOwner(petId);
  const scope = captureDataScope();
  assertDataScope(scope);
  if (!petId || !selectedJobId) return null;
  const response = await callAvatarFunction({
    name: 'api_pet_avatar',
    data: { action: 'prepareHeroDisplay', petId, selectedJobId, ...buildAiConsentPayload('pet_avatar') }
  });
  assertDataScope(scope);
  const result = response && response.result;
  if (!result || result.code !== 0) {
    const error = new Error(result?.message || 'AVATAR_HERO_PREPARE_FAILED');
    error.code = result?.errorCode || 'AVATAR_HERO_PREPARE_FAILED';
    throw error;
  }
  return result;
}

export async function getAvatarCutoutStatus(petId, selectedJobId) {
  assertAvatarCloudOwner(petId);
  const scope = captureDataScope();
  assertDataScope(scope);
  if (!petId || !selectedJobId) return null;
  const response = await callAvatarFunction({
    name: 'api_pet_avatar',
    data: { action: 'getAvatarCutoutStatus', petId, selectedJobId }
  });
  assertDataScope(scope);
  const result = response && response.result;
  if (!result || result.code !== 0) {
    const error = new Error(result?.message || 'AVATAR_HERO_POLL_FAILED');
    error.code = result?.errorCode || 'AVATAR_HERO_POLL_FAILED';
    throw error;
  }
  return result;
}

export function retryAvatarCleanup(petId, selectedJobId) {
  const scope = captureDataScope();
  try { assertDataScope(scope);assertAvatarCloudOwner(petId); } catch (_) { return Promise.resolve(null); }
  if (!petId || !selectedJobId) return Promise.resolve(null);
  return callAvatarFunction({
    name: 'api_pet_avatar',
    data: { action: 'retryAvatarCleanup', petId, selectedJobId }
  }).then(response => isDataScopeCurrent(scope) ? response && response.result : null).catch(() => null);
}

export async function refreshAvatarGenerationSession(petId) {
  assertAvatarCloudOwner(petId);
  const scope = captureDataScope();
  assertDataScope(scope);
  const session = getAvatarGenerationSession(petId);
  if (!session) return null;
  const response = await callAvatarFunction({
    name: 'api_pet_avatar',
    data: {
      action: 'getGenerationSession',
      petId,
      generationSessionId: session.sessionId,
      ...buildAiConsentPayload('pet_avatar')
    }
  });
  assertDataScope(scope);
  const result = response && response.result;
  if (!result || result.code !== 0 || !Array.isArray(result.candidates)) return session;
  const activeJob = result.activeJob && ACTIVE_JOB_STATUSES.includes(String(result.activeJob.taskStatus || '').toUpperCase())
    ? saveAvatarJob({
        jobId: result.activeJob.jobId,
        requestId: result.activeJob.requestId,
        petId,
        status: result.activeJob.taskStatus,
        startedAt: Date.now(),
        progressStage: 'generating',
        jobKind: result.activeJob.jobKind,
        generationSessionId: result.activeJob.generationSessionId || session.sessionId,
        seed: result.activeJob.seed
      })
    : null;
  const candidates = mergeAvatarCandidates(session.candidates, result.candidates);
  return saveAvatarGenerationSession({
    ...session,
    candidates,
    activeJobId: activeJob ? activeJob.jobId : session.activeJobId,
    selectedJobId: candidates.some(item => item.jobId === session.selectedJobId)
      ? session.selectedJobId
      : ((candidates[candidates.length - 1] && candidates[candidates.length - 1].jobId) || '')
  });
}

export function saveGeneratedAvatar(pet = {}, result = {}) {
  const stage = getPetRelationshipStage(pet);
  const generatedFileId = result.generatedFileId || result.generatedAvatarFileId || pet.generatedAvatarFileId || '';
  const generatedAvatarUrl = result.generatedTempUrl || result.generatedAvatarUrl || result.avatarUrl || '';
  // The cloud file id is durable; a temporary URL can be rehydrated after an SDK/network outage.
  if (!generatedFileId) throw new Error('INVALID_GENERATED_AVATAR');
  return {
    generatedAvatarFileId: generatedFileId,
    generatedAvatarDerivedFromFileId: generatedFileId,
    generatedAvatarHeroFileId: result.heroFileId || '',
    generatedAvatarHeroMetrics: result.heroMetrics || null,
    generatedAvatarHeroAssetVersion: Number(result.heroAssetVersion) || 0,
    generatedAvatarHeroDisplayPreparedFor: result.heroDisplayPreparedFor || '',
    generatedAvatarHeroGenerationStatus: result.heroGenerationStatus || 'NOT_STARTED',
    generatedAvatarHeroGenerationVersion: result.heroGenerationVersion || '',
    generatedAvatarHeroGenerationErrorCode: result.heroGenerationErrorCode || '',
    generatedAvatarHeroGenerationPhase: result.heroGenerationPhase || 'NOT_STARTED',
    generatedAvatarHeroGenerationRequestId: result.heroGenerationRequestId || '',
    generatedAvatarHeroPromptRevision: result.heroPromptRevision || '',
    generatedAvatarHeroProviderSourceMetadata: result.heroProviderSourceMetadata || null,
    generatedAvatarCutoutTightFileId: result.cutoutTightFileId || '',
    generatedAvatarCutoutTightMetrics: result.cutoutTightMetrics || null,
    generatedAvatarLocalCutoutTightFileId: result.localCutoutTightFileId || '',
    generatedAvatarLocalCutoutTightMetrics: result.localCutoutTightMetrics || null,
    generatedAvatarUrl,
    generatedAvatarCutoutFileId: result.cutoutFileId || '',
    generatedAvatarCutoutUrl: result.cutoutUrl || '',
    generatedAvatarCutoutStatus: result.cutoutStatus || 'NOT_CONFIGURED',
    generatedAvatarCutoutErrorCode: result.cutoutErrorCode || '',
    generatedAvatarCutoutPipelineVersion: Number(result.cutoutPipelineVersion) || 0,
    generatedAvatarCutoutEngine: result.cutoutEngine || 'unknown',
    generatedAvatarSemanticCutoutAvailable: result.semanticCutoutAvailable === true,
    generatedAvatarCutoutAlphaValid: result.cutoutAlphaValid === true,
    generatedAvatarCutoutJobId: result.cutoutJobId || result.selectedJobId || '',
    generatedAvatarDisplayFileId: result.displayFileId || '',
    generatedAvatarDisplayUrl: result.displayUrl || '',
    generatedAvatarThumbnailFileId: result.thumbnailFileId || '',
    generatedAvatarThumbnailUrl: result.thumbnailUrl || '',
    generatedAvatarFeatheredDisplayFileId: result.featheredDisplayFileId || '',
    generatedAvatarFeatheredDisplayUrl: result.featheredDisplayUrl || '',
    generatedAvatarLocalCutoutFileId: result.localCutoutFileId || '',
    generatedAvatarLocalCutoutUrl: result.localCutoutUrl || '',
    generatedAvatarLocalCutoutAlphaValid: result.localCutoutAlphaValid === true,
    generatedAvatarLocalCutoutMetrics: result.localCutoutMetrics || null,
    generatedAvatarCutoutMetrics: result.cutoutAlphaMetrics || null,
    generatedAvatarDisplayDimensions: result.displayDimensions || null,
    generatedAvatarMainAssetMetadata: normalizeMainAssetMetadata(result.mainAssetMetadata || (pet.generatedAvatarFileId === generatedFileId ? pet.generatedAvatarMainAssetMetadata : null)),
    generatedAvatarCleanupPending: result.cleanupPending === true,
    avatarSource: 'generated',
    avatarStatus: 'ready',
    avatarStyle: normalizeAvatarStyle(result.avatarStyle || pet.avatarStyle, stage),
    avatarUpdatedAt: Date.now()
  };
}

export function getAvatarDisplayAsset(pet = {}) {
  return resolveAvatarDisplayAsset(pet);
}

export function getAvatarDisplayImage(pet = {}) {
  return resolveAvatarDisplayAsset(pet || {}).imageUrl || PLACEHOLDER_IMAGE;
}

export function getProfilePetAvatar(pet = {}) {
  return getAvatarDisplayImage(pet);
}
