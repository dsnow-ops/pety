'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { buildAvatarPrompt } = require('./avatar-prompt');
const { COMPOSITION_VERSION, MASTER_SIZE, applyCompositionContract } = require('./avatar-composition-contract');
const { buildAvatarRevisionPrompt, normalizeRevisionText, parseAvatarRevisionIntent } = require('./avatar-revision-prompt');
const { HERO_CHARACTER_VERSION, buildHeroCharacterPrompt } = require('./hero-character-prompt');
const { HERO_PROMPT_REVISION, planHeroRecovery } = require('./hero-recovery-policy');
const { getTransparentCutoutStatus, submitTransparentCutout } = require('./avatar-cutout-provider');
const { createWanTask, extractResultImageUrl, getWanTask } = require('./wan-client');
const { createQuotaLedger, legacyKey } = require('./avatar-quota-ledger');
const { createSourceReceipts } = require('./avatar-source-receipts');
const {
	assertPrivateFileId,
	deleteCloudFiles,
	downloadCloudFile,
	getCloudPath,
	getTempUrls,
	getProviderImageInputs,
	inspectCloudImage,
	inspectUploadedSource,
	inspectRevisionSource,
	inspectTransparentPng,
	persistCutoutImage,
	persistChromaHeroImage,
	persistDisplayDerivatives,
	persistHeroProviderSource,
	persistFinalImage,
	persistGeneratedImage,
	persistTightCutout,
	verifyCloudFileExists
} = require('./storage');

let database;

function getDatabase() {
	if (!database) database = uniCloud.database();
	return database;
}

// uniCloud's plain update syntax recursively merges objects. Replacing a field
// that was previously null can therefore become a dotted write such as
// localCutoutMetrics.backgroundConfidence and fail with Mongo error 100104.
// db.command.set explicitly replaces the field value and also keeps old metric
// keys from leaking into a newly generated asset. Tests use the plain value.
function replaceDatabaseObject(value) {
	const command = getDatabase() && getDatabase().command;
	return command && typeof command.set === 'function' ? command.set(value) : value;
}

function replaceDatabaseFields(update, fieldNames) {
	const patch = { ...update };
	fieldNames.forEach(fieldName => {
		if (Object.prototype.hasOwnProperty.call(patch, fieldName)) patch[fieldName] = replaceDatabaseObject(patch[fieldName]);
	});
	return patch;
}

function createLazyCollection(name) {
	let collection;
	const getCollection = () => {
		if (!collection) collection = getDatabase().collection(name);
		return collection;
	};
	return {
		add(...args) {
			return getCollection().add(...args);
		},
		doc(...args) {
			return getCollection().doc(...args);
		},
		where(...args) {
			return getCollection().where(...args);
		}
	};
}

const jobs = createLazyCollection('pet_avatar_jobs');

function getFeedbackCollection() {
	const db = getDatabase();
	return db.collection('pet_avatar_feedback');
}

const feedbackCollection = {
	doc(...args) {
		return getFeedbackCollection().doc(...args);
	}
};
const CONSENT_VERSION = 1;
const ACTIVE_JOB_TTL_MS = 10 * 60 * 1000;
const VALID_STATUSES = ['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED', 'UNKNOWN'];
const VALID_JOB_KINDS = ['initial', 'regenerate', 'revision'];
const FREE_SUCCESS_LIMIT = 3;
const MEMBER_SUCCESS_LIMIT = 10;
const VALID_FEEDBACK_CATEGORIES = ['poor_quality', 'revision_ineffective', 'identity_mismatch', 'distorted', 'other'];
const CUTOUT_PIPELINE_VERSION = 6;

const DEFAULT_CONFIG = {
	provider: 'aliyun-bailian',
	region: 'cn-beijing',
	apiKey: '',
	workspaceId: '',
	model: 'wan2.7-image-pro',
	styleReferenceFileId: '',
	size: '2K',
	n: 1,
	watermark: false,
	promptVersion: 'pety-avatar-v2-strict',
	requestTimeoutMs: 25000,
	maxSourceImages: 3,
	devMemberBypass: false,
	cutoutProvider: 'aliyun-viapi',
	viapiAccessKeyId: '',
	viapiAccessKeySecret: '',
	viapiEnabled: false,
	heroChromaEnabled: false,
	cutoutTimeoutMs: 45000
};

function getEnv(name) {
	return typeof process !== 'undefined' && process.env ? process.env[name] || '' : '';
}

function resolveDevMemberBypassConfig(envValue, fileValue) {
	const explicitEnv = String(envValue || '').trim().toLowerCase();
	if (explicitEnv) return explicitEnv === 'true';
	return fileValue === true;
}

function loadConfig() {
	let fileConfig = {};
	const configPath = path.join(__dirname, 'config.json');
	if (fs.existsSync(configPath)) {
		fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8').replace(/^\uFEFF/, ''));
	}
	const config = {
		...DEFAULT_CONFIG,
		...fileConfig,
		apiKey: getEnv('DASHSCOPE_API_KEY') || getEnv('WAN_API_KEY') || fileConfig.apiKey || '',
		workspaceId: getEnv('DASHSCOPE_WORKSPACE_ID') || getEnv('WAN_WORKSPACE_ID') || fileConfig.workspaceId || '',
		styleReferenceFileId: getEnv('PET_AVATAR_STYLE_REFERENCE_FILE_ID') || fileConfig.styleReferenceFileId || '',
		size: '2K',
		n: 1,
		watermark: false,
		cutoutProvider: getEnv('PET_AVATAR_CUTOUT_PROVIDER') || fileConfig.cutoutProvider || DEFAULT_CONFIG.cutoutProvider,
		viapiAccessKeyId: getEnv('ALIBABA_CLOUD_ACCESS_KEY_ID') || fileConfig.viapiAccessKeyId || '',
		viapiAccessKeySecret: getEnv('ALIBABA_CLOUD_ACCESS_KEY_SECRET') || fileConfig.viapiAccessKeySecret || '',
		viapiEnabled: String(getEnv('PET_AVATAR_VIAPI_ENABLED') || fileConfig.viapiEnabled || '').toLowerCase() === 'true'
	};
	const heroChromaSetting = String(getEnv('PET_AVATAR_HERO_CHROMA_ENABLED') || (fileConfig.heroChromaEnabled === true ? 'true' : 'false')).toLowerCase();
	config.heroChromaEnabled = heroChromaSetting === 'true';
	config.isDevelopment = getEnv('PETY_CLOUD_ENV') === 'development';
	config.devMemberBypass = resolveDevMemberBypassConfig(getEnv('PETY_DEV_MEMBER_BYPASS'), fileConfig.devMemberBypass);
	config.devMemberBypassUids = (getEnv('PETY_DEV_MEMBER_UIDS') || '').split(',').map(value => value.trim()).filter(Boolean);
	config.devMemberBypassExpiresAt = Number(getEnv('PETY_DEV_MEMBER_EXPIRES_AT') || 0);
	config.devMemberBypassScopes = (getEnv('PETY_DEV_MEMBER_SCOPES') || '').split(',').map(value => value.trim()).filter(Boolean);
	config.requestTimeoutMs = Math.max(Number(config.requestTimeoutMs) || DEFAULT_CONFIG.requestTimeoutMs, 1000);
	config.maxSourceImages = Math.min(Math.max(Number(config.maxSourceImages) || 3, 1), 3);
	config.cutoutTimeoutMs = Math.min(Math.max(Number(config.cutoutTimeoutMs) || DEFAULT_CONFIG.cutoutTimeoutMs, 5000), 60000);
	return config;
}

function getHealthCheck() {
	return { ok: true };
}

function hash(value) {
	return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

const verifiedRequestIdentities = new WeakMap();

async function authorizeAvatarContext(event, context = {}) {
	let verified;
	try { verified = await require('pety-auth').verifyRequest(event, context); }
	catch (error) {
		if(String(error?.errCode||'').startsWith('pety-session-'))throw Object.assign(codedError(error.errCode),{errCode:error.errCode,sessionVersion:event.petySession?.version});
		const invalid = /^(uni-id-(token-expired|check-token-failed|account-(banned|auditing|audit-failed|closed|not-exists))|30202|30203|30204)$/.test(String(error?.errCode || error?.code || ''));
		throw codedError(invalid ? 'AVATAR_AUTH_EXPIRED' : 'AVATAR_AUTH_UNAVAILABLE');
	}
	if (!verified?.uid) throw codedError('AVATAR_LOGIN_REQUIRED');
	const requestContext = Object.freeze({ ...context });
	// Preserve the existing official uid hash. Never claim legacy device/IP files.
	verifiedRequestIdentities.set(requestContext, Object.freeze({ uid: verified.uid, session:verified.session, quotaOwnerHash: hash(`uid:${verified.uid}`) }));
	return requestContext;
}

function getQuotaIdentity(context = {}) {
	const identity = verifiedRequestIdentities.get(context);
	if (!identity) throw codedError('AVATAR_LOGIN_REQUIRED');
	return identity;
}

async function getActiveMembership(uid, membershipDb=getDatabase()) {
	if (!uid) return null;
	try {
		const result = await membershipDb.collection('pety_memberships').where({ userId: uid, status: 'active' }).limit(1).get();
		let record = result && result.data && result.data[0];
		if (process.env.PETY_PAID_MEMBERSHIP_ENABLED === 'true') {
			record = await require('pety-membership-orders/effective-membership').readEffectiveMembership(membershipDb, uid, record, Date.now(), { transactional: membershipDb !== getDatabase() });
		}
		const now = Date.now();
		return record && ['plus', 'pro'].includes(record.plan) && (!record.endedAt || record.endedAt > now) && (!record.expiresAt || record.expiresAt > now) ? record : null;
	} catch (error) {
		console.warn('avatar_membership_lookup_failed', { ownerHash: hash(uid).slice(0, 10) });
		throw codedError('AVATAR_QUOTA_STATE_INVALID');
	}
}

async function countSuccessfulJobs(quotaOwnerHash, pool, entitlementCycleKey) {
	const query = pool === 'member'
		? { recordType: 'candidate', quotaOwnerHash, status: 'SUCCEEDED', resultSaved: true, entitlementPool: 'member', entitlementCycleKey }
		: { recordType: 'candidate', quotaOwnerHash, status: 'SUCCEEDED', resultSaved: true, entitlementPool: 'free' };
	const result = await jobs.where(query).count();
	return Number(result && result.total) || 0;
}

function quotaScope(record) {
	return { owner: record.quotaOwnerHash, pet: record.petHash, pool: record.entitlementPool,
		cycle: record.entitlementCycleKey || 'free-lifetime' };
}

function avatarSourceReceipts() {
	return createSourceReceipts(getDatabase().collection('pety_avatar_source_receipts'), inspectUploadedSource);
}
function sourceScope(event, context) {
	const pet = hash(normalizePetId(event.petId)).slice(0,24);
	return { owner: getQuotaIdentity(context).quotaOwnerHash, pet, session: normalizeSessionId(event.generationSessionId,pet) };
}
async function issueSourceUpload(event,config,context) {
	assertConsent(event);
	const prefix = String(config.styleReferenceFileId || '').match(/^(cloud:\/\/[^/?#]+\/)/)?.[1];
	if (!prefix) throw codedError('AVATAR_PROVIDER_NOT_CONFIGURED');
	return {code:0,...await avatarSourceReceipts().issue(sourceScope(event,context),{batchId:String(event.batchId||''),slot:event.slot,prefix})};
}
async function completeSourceUpload(event,context) {
	assertConsent(event);
	return {code:0,...await avatarSourceReceipts().complete(sourceScope(event,context),event.ticketId,event.fileId)};
}

function avatarQuotaLedger(databaseForAdmission=getDatabase()) {
	return createQuotaLedger(databaseForAdmission.collection('pety_avatar_quota_ledgers'), async scope => {
		const query = { quotaOwnerHash: scope.owner, entitlementPool: scope.pool };
		if (scope.pool === 'free') query.petHash = scope.pet;
		else query.entitlementCycleKey = scope.cycle;
		const records = [];
		for (let offset = 0; offset < 10000; offset += 100) {
			const response = await jobs.where(query).field({ jobId: true, generationSessionId: true, status: true,
				resultSaved: true, userQuotaConsumed: true, quotaReservationId: true }).skip(offset).limit(100).get();
			const rows = readAvatarRows(response, 100);
			records.push(...rows);
			if (rows.length < 100) return records;
		}
		throw codedError('AVATAR_QUOTA_HISTORY_REVIEW_REQUIRED');
	}, replaceDatabaseObject, { transactional: databaseForAdmission !== getDatabase() });
}

async function settleAvatarQuota(record, outcome) {
	if (record.entitlementPool === 'development') return;
	const ledger = avatarQuotaLedger();
	const key = record.quotaReservationId || legacyKey(record);
	if (outcome === 'consumed') await ledger.consume(quotaScope(record), key);
	else if (outcome === 'released') await ledger.release(quotaScope(record), key);
}

function isQuotaConsumingJob(job = {}) {
	return job.status === 'SUCCEEDED' && job.resultSaved === true && job.userQuotaConsumed !== false;
}

function evaluateEntitlement(pool, used, bypass = false) {
	if (bypass) return { allowed: true, pool: 'development', used: 0, limit: null, remaining: null, bypass: true };
	const normalizedPool = pool === 'member' ? 'member' : 'free';
	const limit = normalizedPool === 'member' ? MEMBER_SUCCESS_LIMIT : FREE_SUCCESS_LIMIT;
	const normalizedUsed = Math.max(Number(used) || 0, 0);
	return {
		allowed: normalizedUsed < limit,
		pool: normalizedPool,
		used: normalizedUsed,
		limit,
		remaining: Math.max(limit - normalizedUsed, 0),
		bypass: false
	};
}

function getDevMemberBypassDecision(event, config, context) {
	const requested = event && event.devEntitlementBypassRequested === true;
	const serverEnabled = config && config.devMemberBypass === true;
	const identity = context && verifiedRequestIdentities.get(context);
	const allowedIdentity = identity && Array.isArray(config?.devMemberBypassUids) && config.devMemberBypassUids.includes(identity.uid);
	const expiry = config && config.devMemberBypassExpiresAt;
	const now = Date.now();
	const validWindow = Number.isSafeInteger(expiry) && expiry > now && expiry <= now + 7 * 86400000;
	const allowedScope = Array.isArray(config?.devMemberBypassScopes) && config.devMemberBypassScopes.includes('avatar-generation');
	return { requested, serverEnabled, applied: Boolean(requested && serverEnabled && config.isDevelopment === true && allowedIdentity && validWindow && allowedScope) };
}

async function resolveEntitlement(context, config, event = {}) {
	const identity = getQuotaIdentity(context);
	const bypassDecision = getDevMemberBypassDecision(event, config, context);
	console.info('dev_member_bypass', bypassDecision);
	if (bypassDecision.applied) {
		return { identity, entitlement: evaluateEntitlement('development', 0, true) };
	}
	const member = await getActiveMembership(identity.uid);
	const pool = member ? 'member' : 'free';
	const cycleStartedAt = member ? (Number(member.startedAt) || Number(member.createdAt) || 0) : 0;
	const entitlementCycleKey = member ? (member.entitlementCycleKey || hash(`${identity.uid}:${cycleStartedAt}`).slice(0, 24)) : 'free-lifetime';
	const petHash = hash(normalizePetId(event.petId)).slice(0, 24);
	const totals = await avatarQuotaLedger().read({ owner: identity.quotaOwnerHash, pet: petHash, pool, cycle: entitlementCycleKey });
	return { identity, entitlement: { ...evaluateEntitlement(pool, totals.used + totals.reserved), used: totals.used,
		reserved: totals.reserved }, entitlementCycleKey };
}

function normalizePetId(value) {
	const petId = String(value || '').trim();
	if (!petId || petId.length > 128) throw codedError('INVALID_PET_ID');
	return petId;
}

function codedError(code, message) {
	const error = new Error(message || code);
	error.code = code;
	return error;
}

function normalizePipelineError(error, fallback) {
	const raw = error && (error.code || error.providerCode || (error.statusCode ? `HTTP_${error.statusCode}` : '') || error.message);
	const normalized = String(raw || fallback || 'PIPELINE_FAILED').toUpperCase().replace(/[^A-Z0-9_-]+/g, '_').slice(0, 80);
	return normalized || fallback || 'PIPELINE_FAILED';
}

function isHeroGenerationCandidate(candidate) {
	return String(candidate && (candidate.cutoutEngine || candidate.heroGenerationVersion) || '').startsWith('hero-character-');
}

function getWanFailureCode(providerResult) {
	const output = providerResult && providerResult.output || {};
	return normalizePipelineError({
		code: output.code || providerResult && providerResult.code || '',
		message: output.message || providerResult && providerResult.message || ''
	}, 'HERO_PROVIDER_FAILED');
}

function sanitizeProviderDiagnostic(value, maxLength = 240) {
	return String(value || '')
		.replace(/https?:\/\/[^\s<>"']+/gi, '[链接已隐藏]')
		.replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [已隐藏]')
		.replace(/\b(?:sk-[a-z0-9_-]{12,}|LTAI[a-z0-9]{12,})\b/gi, '[凭据已隐藏]')
		.replace(/\b(token|password|secret|api[_-]?key|signature|authorization)\s*[:=]\s*[^\s,;]+/gi, '$1=[已隐藏]')
		.replace(/[\u0000-\u001f\u007f]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, maxLength);
}

function getWanFailureDetails(providerResult = {}) {
	const output = providerResult && providerResult.output || {};
	const providerErrorCode = sanitizeProviderDiagnostic(output.code || providerResult.code || '', 80);
	const providerErrorMessage = sanitizeProviderDiagnostic(output.message || providerResult.message || '');
	return {
		errorCode: normalizePipelineError({
			providerCode: providerErrorCode,
			message: providerErrorMessage
		}, 'WAN_PROVIDER_FAILED'),
		providerErrorCode,
		providerErrorMessage,
		providerRequestId: sanitizeProviderDiagnostic(providerResult.request_id || providerResult.requestId || '', 128)
	};
}

function getWanRequestFailureDetails(error = {}) {
	const providerErrorCode = sanitizeProviderDiagnostic(error.providerCode || '', 80);
	const providerErrorMessage = sanitizeProviderDiagnostic(error.providerMessage || error.message || '');
	return {
		errorCode: normalizePipelineError({
			providerCode: providerErrorCode,
			code: providerErrorCode ? '' : error.code,
			statusCode: error.statusCode,
			message: providerErrorMessage
		}, 'CREATE_FAILED'),
		providerErrorCode,
		providerErrorMessage,
		providerRequestId: sanitizeProviderDiagnostic(error.providerRequestId || '', 128)
	};
}

function assertConsent(event) {
	const accepted = event && event.aiConsentAccepted === true;
	const version = Number(event && event.aiConsentVersion);
	const scopes = Array.isArray(event && event.aiConsentScopes) ? event.aiConsentScopes : [];
	if (!accepted || version !== CONSENT_VERSION || !scopes.includes('pet_avatar')) {
		throw codedError('AI_CONSENT_REQUIRED');
	}
}

function getAvatarActionConfigCheck(action, config = {}) {
	return {
		action: String(action || ''),
		wanConfigured: Boolean(config.apiKey && config.region === 'cn-beijing' && config.model === 'wan2.7-image-pro'),
		workspaceConfigured: Boolean(config.workspaceId),
		styleReferenceConfigured: Boolean(config.styleReferenceFileId),
		viapiEnabled: config.viapiEnabled === true,
		viapiConfigured: Boolean(config.viapiEnabled === true && config.cutoutProvider === 'aliyun-viapi' && config.viapiAccessKeyId && config.viapiAccessKeySecret),
		devBypassEnabled: config.devMemberBypass === true
	};
}

function validateWanConfig(config, options = {}) {
	if (!config.apiKey || !config.workspaceId) throw codedError('AVATAR_PROVIDER_NOT_CONFIGURED');
	if (options.requireStyleReference !== false && !config.styleReferenceFileId) throw codedError('STYLE_REFERENCE_UNAVAILABLE');
	if (config.region !== 'cn-beijing' || config.model !== 'wan2.7-image-pro') throw codedError('AVATAR_CONFIG_INVALID');
	if (config.size !== '2K' || Number(config.n) !== 1 || config.watermark !== false) throw codedError('AVATAR_CONFIG_INVALID');
	return true;
}

function validateViapiConfig(config = {}) {
	return Boolean(
		config.viapiEnabled === true &&
		config.cutoutProvider === 'aliyun-viapi' &&
		config.viapiAccessKeyId &&
		config.viapiAccessKeySecret
	);
}

function validateConfig(config) {
	return validateWanConfig(config, { requireStyleReference: true });
}

function normalizeStatus(status) {
	const normalized = String(status || '').toUpperCase();
	return VALID_STATUSES.includes(normalized) ? normalized : 'UNKNOWN';
}

function normalizeJobKind(value) {
	const jobKind = String(value || 'initial').trim().toLowerCase();
	if (!VALID_JOB_KINDS.includes(jobKind)) throw codedError('INVALID_JOB_KIND');
	return jobKind;
}

function normalizeSessionId(value, petHash) {
	const sessionId = String(value || '').trim();
	if (sessionId && /^[a-zA-Z0-9_-]{8,96}$/.test(sessionId)) return sessionId;
	return `${petHash}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
}

function createSeed() {
	return crypto.randomInt(0, 2147483648);
}

function normalizeSeed(value) {
	if (value === null || value === undefined || value === '') return null;
	const seed = Number(value);
	return Number.isInteger(seed) && seed >= 0 && seed <= 2147483647 ? seed : null;
}

function historyDocumentId(jobId) {
	return `job_${hash(jobId).slice(0, 40)}`;
}

function isTemporarySourceFile(fileId) {
	return /^cloud:\/\/[^/]+\/(?:pety-private-v3\/)?pet-avatar\/input(?:-v2)?\//i.test(String(fileId || ''));
}

function buildOrderedFileIds(jobKind, styleFileId, currentResultFileId, sourceFileIds) {
	return jobKind === 'revision'
		? [currentResultFileId]
		: [styleFileId].concat(sourceFileIds);
}

function normalizeRevisionBBox(revisionIntent, inputCount) {
	if (!revisionIntent || revisionIntent.bboxConfidence < 0.9 || !Array.isArray(revisionIntent.bboxList)) return null;
	if (revisionIntent.bboxList.length !== inputCount) return null;
	return revisionIntent.bboxList;
}

function resolveRevisionSource(parentJob) {
	if (!parentJob || parentJob.status !== 'SUCCEEDED') throw codedError('REVISION_SOURCE_NOT_FOUND');
	const candidates = [
		{ role: 'candidate_original', fileId: parentJob.generatedFileId },
		{ role: 'final_original', fileId: parentJob.finalFileId }
	];
	for (const source of candidates) {
		const cloudPath = getCloudPath(source.fileId);
		const validPath = source.role === 'candidate_original'
			? /^(?:pety-private-v3\/)?pet-avatar\/output\/[^/]+\/[^/]+\/candidate\.png$/i.test(cloudPath)
			: /^(?:pety-private-v3\/)?pet-avatar\/final\/[^/]+\/[^/]+\/final\.png$/i.test(cloudPath);
		if (source.fileId && validPath) return { ...source, cloudPath };
	}
	throw codedError('REVISION_SOURCE_INVALID');
}

function buildCleanupPlan(sessionJobs, selected) {
	const discardedFileIds = [];
	const temporarySourceFileIds = [];
	for (const candidate of sessionJobs) {
		if (Array.isArray(candidate.sourceFileIds)) temporarySourceFileIds.push(...candidate.sourceFileIds.filter(isTemporarySourceFile));
		if (candidate.generatedFileId) discardedFileIds.push(candidate.generatedFileId);
		if (candidate.generatedThumbnailFileId) discardedFileIds.push(candidate.generatedThumbnailFileId);
	}
	return {
		discardedFileIds: Array.from(new Set(discardedFileIds)),
		temporarySourceFileIds: Array.from(new Set(temporarySourceFileIds))
	};
}

function safeResponseError(error, includeProviderDiagnostics = false) {
	const code = error && error.code ? error.code : 'AVATAR_REQUEST_FAILED';
	const messages = {
		AVATAR_LOGIN_REQUIRED: '请先登录后使用云端形象服务，本机资料会保留',
		AVATAR_AUTH_EXPIRED: '登录状态已失效，请重新登录，本机资料会保留',
		AVATAR_AUTH_UNAVAILABLE: '账号验证暂时不可用，请稍后重试',
		AI_CONSENT_REQUIRED: '请先阅读并同意 AI 数据使用说明',
		INVALID_PET_ID: '宠物档案无效，请返回后重试',
		INVALID_SOURCE_IMAGES: '请选择 1 至 3 张宠物照片',
		INVALID_CLOUD_FILE_ID: '照片尚未安全上传，请重新选择',
		AVATAR_SOURCE_NOT_OWNED: '照片需要重新安全上传，请重新选择照片',
		AVATAR_SOURCE_CHANGED: '照片内容已变化，请重新上传',
		AVATAR_SOURCE_TICKET_EXPIRED: '照片上传已超时，请重新选择照片',
		STYLE_REFERENCE_UNAVAILABLE: '官方风格参考暂不可用，请稍后再试',
		AVATAR_PROVIDER_NOT_CONFIGURED: '形象生成服务尚未配置',
		ACTIVE_JOB_EXISTS: '这个宠物已有形象正在生成',
		AVATAR_QUOTA_EXCEEDED: '本期形象生成次数已用完，可以在会员权益中查看更多机会',
		AVATAR_QUOTA_BUSY: '生成次数正在同步，请稍后再试',
		AVATAR_QUOTA_STATE_INVALID: '生成次数暂时无法核实，请稍后再试',
		AVATAR_QUOTA_HISTORY_REVIEW_REQUIRED: '生成记录需要核对，请联系支持',
		WAN_SUBMISSION_UNCERTAIN: '这次生成是否受理仍在核对，请勿重复提交；已有形象会保留',
		AVATAR_JOB_STATE_CHANGED: '任务状态已更新，请重新查看生成进度',
		AVATAR_DATABASE_UNAVAILABLE: '暂时无法确认生成记录，请稍后查看，已有形象会保留',
		INVALID_JOB_KIND: '生成类型无效',
		INVALID_REVISION_TEXT: '请填写 1 至 300 个字的局部调整说明',
		INVALID_CURRENT_RESULT: '请先选择一张已生成的形象',
		REVISION_SOURCE_INVALID: '当前形象不是可编辑的原始结果，请重新选择后再试',
		REVISION_SOURCE_TOO_SMALL: '当前形象清晰度不足，无法安全微调，请重新生成后再试',
		REVISION_SOURCE_NOT_FOUND: '没有找到可用于微调的原始形象，请重新选择后再试',
		INVALID_AVATAR_FEEDBACK: '请选择问题类型后再提交',
		INVALID_GENERATION_SESSION: '本次形象工作台已失效，请重新进入',
		AVATAR_RESULT_NOT_READY: '这张形象还没有生成完成',
		JOB_NOT_FOUND: '没有找到这次生成任务',
		JOB_OWNER_MISMATCH: '无法读取这次生成任务',
		PROMPT_TOO_LONG: '生成指令超出安全长度',
		AVATAR_CONFIG_INVALID: '形象生成服务配置有误',
		WAN_RESULT_IMAGE_MISSING: '生成服务没有返回可用图片，请稍后再试',
		OUTPUT_EQUALS_STYLE_REFERENCE: '生成结果异常，请重新生成',
		REVISION_QUALITY_REJECTED: '这次微调没有稳定完成，已为你保留上一版形象，本次不计次数。',
		REVISION_RESULT_UNSTABLE: '这次微调没有稳定完成，已为你保留上一版形象，本次不计次数。'
	};
	const response = { code: 1, errorCode: code, message: messages[code] || '形象生成暂时没有完成，请稍后再试' };
	if (includeProviderDiagnostics) {
		response.providerErrorCode = sanitizeProviderDiagnostic(error && error.providerCode || '', 80);
		response.providerErrorMessage = sanitizeProviderDiagnostic(error && (error.providerMessage || error.message) || '');
		response.providerRequestId = sanitizeProviderDiagnostic(error && error.providerRequestId || '', 128);
		response.httpStatus = Number(error && error.statusCode) || 0;
	}
	return response;
}

function getAvatarJobLockId(petHash, quotaOwnerHash) {
	if (!quotaOwnerHash) throw codedError('AVATAR_LOGIN_REQUIRED');
	return `active_${hash(`${quotaOwnerHash}:${petHash}`).slice(0, 40)}`;
}

async function getJobDocument(petHash, quotaOwnerHash) {
	const scopedId = getAvatarJobLockId(petHash, quotaOwnerHash);
	for (const id of [scopedId, `active_${petHash}`]) {
		const result = await jobs.doc(id).get();
		const record = readAvatarRows(result, 1)[0];
		// Preserve only this verified account's legacy job. Never claim a
		// device-owned or another account's record during migration.
		if (record && record.quotaOwnerHash === quotaOwnerHash) return { ...record, _id: id };
	}
	return null;
}

async function updateActiveAvatarJob(record, update) {
	if (!record?._id || !record.quotaOwnerHash || !record.jobId) throw codedError('JOB_OWNER_MISMATCH');
	const result = await jobs.where({ _id: record._id, quotaOwnerHash: record.quotaOwnerHash,
		jobId: record.jobId, status: record.status, updatedAt: record.updatedAt }).update(
			replaceDatabaseFields(update, ['mainAssetMetadata', 'qualityGateResult']));
	return getAffectedCount(result) === 1;
}

async function getCandidateDocument(petHash, jobId, quotaOwnerHash) {
	const result = await jobs.where({ recordType: 'candidate', petHash, jobId, quotaOwnerHash }).limit(1).get();
	return readAvatarRows(result, 1)[0] || null;
}

function buildActiveAvatarJobResponse(record, resumed = true) {
	if (!record || !record.jobId) return null;
	return {
		code: 0,
		jobId: record.jobId,
		requestId: record.requestId || '',
		taskStatus: normalizeStatus(record.status),
		jobKind: normalizeJobKind(record.jobKind),
		seed: normalizeSeed(record.seed),
		generationSessionId: record.generationSessionId || '',
		resumed
	};
}

async function findLatestActiveSessionCandidate(petHash, generationSessionId, quotaOwnerHash, jobKind) {
	const result = await jobs.where({
		recordType: 'candidate',
		petHash,
		generationSessionId,
		quotaOwnerHash,
		jobKind
	}).get();
	const records = readAvatarRows(result);
	return records
		.filter(item => item.jobId && ['CREATING', 'PENDING', 'RUNNING'].includes(normalizeStatus(item.status)))
		.sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0))[0] || null;
}

async function recoverActiveAvatarJob(existing, lockId, petHash, generationSessionId, quotaOwnerHash, jobKind) {
	if (!existing || existing.generationSessionId !== generationSessionId || existing.quotaOwnerHash !== quotaOwnerHash || existing.jobKind !== jobKind) return null;
	const direct = buildActiveAvatarJobResponse(existing);
	if (direct) return direct;

	const candidate = await findLatestActiveSessionCandidate(petHash, generationSessionId, quotaOwnerHash, jobKind);
	if (!candidate) return null;
	const repaired = await jobs.where({
		_id: lockId,
		status: existing.status,
		updatedAt: existing.updatedAt,
		generationSessionId,
		quotaOwnerHash
	}).update({
		jobId: candidate.jobId,
		jobDocId: candidate._id,
		requestId: candidate.requestId || '',
		status: normalizeStatus(candidate.status),
		updatedAt: Date.now()
	});
	if (getAffectedCount(repaired) === 1) return buildActiveAvatarJobResponse(candidate);
	const current = await getJobDocument(petHash, quotaOwnerHash);
	return current && current.generationSessionId === generationSessionId && current.quotaOwnerHash === quotaOwnerHash
		? buildActiveAvatarJobResponse(current)
		: null;
}

function isDuplicateDocumentError(error) {
	return /duplicate|already exists|DUPLICATE_KEY|E11000/i.test(String(error && (error.code || error.message) || ''));
}

function confirmedAvatarResult(result) {
	if (!result || typeof result !== 'object' || Array.isArray(result)) throw codedError('AVATAR_DATABASE_UNAVAILABLE');
	for (const key of ['errCode', 'code']) {
		if (result[key] !== undefined && result[key] !== null && result[key] !== 0 && result[key] !== '0' && result[key] !== '') throw codedError('AVATAR_DATABASE_UNAVAILABLE');
	}
	if (result.error || result.success === false || result.ok === false) throw codedError('AVATAR_DATABASE_UNAVAILABLE');
	return result;
}

function readAvatarRows(result, max = Infinity) {
	confirmedAvatarResult(result);
	if (!Array.isArray(result.data) || result.data.length > max || result.data.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw codedError('AVATAR_DATABASE_UNAVAILABLE');
	return result.data;
}

function getAffectedCount(result) {
	confirmedAvatarResult(result);
	const counts = ['updated', 'updatedCount', 'affectedDocs', 'modifiedCount', 'affectedRows']
		.filter(key => Object.prototype.hasOwnProperty.call(result, key)).map(key => result[key]);
	if (!counts.length || counts.some(value => !Number.isSafeInteger(value) || value < 0 || value > 1 || value !== counts[0])) throw codedError('AVATAR_DATABASE_UNAVAILABLE');
	return counts[0];
}

async function acquireAvatarJobLock(lockId, existing, lock) {
	if (!existing) {
		let created;
		try {
			created = await jobs.add({ _id: lockId, ...lock });
		} catch (error) {
			if (isDuplicateDocumentError(error)) return false;
			throw error;
		}
		// An unconfirmed lock may already exist. Never authorize provider work,
		// retry creation, or remove that uncertain lock from a missing receipt.
		if (confirmedAvatarResult(created).id !== lockId) throw codedError('AVATAR_DATABASE_UNAVAILABLE');
		return true;
	}
	const claim = await jobs.where({
		_id: lockId,
		...(existing.quotaOwnerHash ? { quotaOwnerHash: existing.quotaOwnerHash } : {}),
		status: existing.status,
		updatedAt: existing.updatedAt
	}).update(lock);
	return getAffectedCount(claim) === 1;
}

async function createJob(event, config, context) {
	assertConsent(event);
	const petId = normalizePetId(event.petId);
	const petHash = hash(petId).slice(0, 24);
	const jobKind = normalizeJobKind(event.jobKind);
	validateWanConfig(config, { requireStyleReference: jobKind !== 'revision' });
	const generationSessionId = normalizeSessionId(event.generationSessionId, petHash);
	const operationId = String(event.operationId || '');
	if (!/^[a-zA-Z0-9_-]{8,100}$/.test(operationId)) throw codedError('INVALID_GENERATION_SESSION');
	let sourceFileIds = Array.isArray(event.sourceFileIds) ? event.sourceFileIds.map(assertPrivateFileId) : [];
	const parentJobId = jobKind === 'revision' ? String(event.parentJobId || '').trim() : '';
	let currentResultFileId = '';
	let revisionSource = null;
	const revisionText = jobKind === 'revision' ? normalizeRevisionText(event.revisionText) : '';
	const operationFingerprint = hash(JSON.stringify([generationSessionId, jobKind, parentJobId, revisionText,
		jobKind === 'revision' ? [] : sourceFileIds, normalizeSeed(event.seed)]));
	const revisionIntent = jobKind === 'revision' ? parseAvatarRevisionIntent(revisionText) : null;
	let providerReferenceFileIds = sourceFileIds;
	if (jobKind === 'revision' && !parentJobId) throw codedError('INVALID_CURRENT_RESULT');
	const quotaIdentity = getQuotaIdentity(context);
	const priorOperations = readAvatarRows(await jobs.where({ recordType: 'candidate', petHash,
		quotaOwnerHash: quotaIdentity.quotaOwnerHash, operationId }).limit(2).get(), 2);
	if (priorOperations.length > 1) throw codedError('AVATAR_REQUEST_CONFLICT');
	if (priorOperations.length === 1) {
		const prior = priorOperations[0];
		if (!prior.operationFingerprint || prior.operationFingerprint !== operationFingerprint) throw codedError('AVATAR_REQUEST_CONFLICT');
		if (prior.jobId) return buildActiveAvatarJobResponse(prior);
	}
	const existing = await getJobDocument(petHash, quotaIdentity.quotaOwnerHash);
	const lockId = existing?._id || getAvatarJobLockId(petHash, quotaIdentity.quotaOwnerHash);
	if (existing?.operationId === operationId && existing.operationFingerprint && existing.operationFingerprint !== operationFingerprint) throw codedError('AVATAR_REQUEST_CONFLICT');
	if (existing?.operationId === operationId && existing.jobId && existing.generationSessionId === generationSessionId) {
		return buildActiveAvatarJobResponse(existing);
	}
	if (existing?.status === 'SUBMISSION_UNKNOWN') throw codedError('WAN_SUBMISSION_UNCERTAIN');
	if (existing && ['CREATING', 'PENDING', 'RUNNING', 'UNKNOWN'].includes(existing.status)) {
		const resumed = await recoverActiveAvatarJob(existing, lockId, petHash, generationSessionId, quotaIdentity.quotaOwnerHash, jobKind);
		if (resumed) return resumed;
		throw codedError('ACTIVE_JOB_EXISTS');
	}

	const { identity, entitlement, entitlementCycleKey = 'development' } = await resolveEntitlement(context, config, event);
	if (!entitlement.allowed) throw codedError('AVATAR_QUOTA_EXCEEDED');
	let parentJob = null;
	let expectedSourceHashes = {};
	let seed = normalizeSeed(event.seed);
	if (jobKind === 'revision') {
		parentJob = await getCandidateDocument(petHash, parentJobId, identity.quotaOwnerHash);
		sourceFileIds = Array.isArray(parentJob && parentJob.sourceFileIds) ? parentJob.sourceFileIds.map(assertPrivateFileId) : [];
		revisionSource = resolveRevisionSource(parentJob);
		currentResultFileId = revisionSource.fileId;
		const sourceInspection = await inspectRevisionSource(currentResultFileId);
		revisionSource = { ...revisionSource, ...sourceInspection };
		providerReferenceFileIds = [];
		if (config.isDevelopment) console.info('revision_source_resolved', {
			petHash,
			parentJobIdHash: hash(parentJobId).slice(0, 12),
			revisionJobIdHash: hash(generationSessionId).slice(0, 12),
			sourceRole: revisionSource.role,
			sourceFileIdHash: hash(revisionSource.fileId).slice(0, 12),
			storagePathTail: revisionSource.cloudPath.split('/').slice(-3).join('/'),
			mimeType: revisionSource.mime,
			bytes: revisionSource.bytes,
			width: revisionSource.width,
			height: revisionSource.height,
			sha256Prefix: revisionSource.sha256.slice(0, 16),
			base64ShaMatches: revisionSource.encodedSha256 === revisionSource.sha256
		});
		seed = normalizeSeed(parentJob.seed);
		if (seed === null) throw codedError('INVALID_CURRENT_RESULT');
	} else {
		if (sourceFileIds.length < 1 || sourceFileIds.length > config.maxSourceImages) throw codedError('INVALID_SOURCE_IMAGES');
		expectedSourceHashes = await avatarSourceReceipts().hashes(sourceScope(event,context),sourceFileIds);
		if (seed === null || jobKind === 'regenerate') seed = createSeed();
	}
	const providerInputCount = jobKind === 'revision' ? 1 : 1 + sourceFileIds.length;
	const revisionBBox = null;
	const createdAt = Date.now();
	const quotaReservationId = `request_${hash(JSON.stringify([identity.quotaOwnerHash,petHash,generationSessionId,operationId,jobKind,parentJobId,revisionText,sourceFileIds])).slice(0, 48)}`;
	const lock = {
		petHash,
		operationId,
		operationFingerprint,
		status: 'CREATING',
		jobKind,
		generationSessionId,
		seed,
		revisionBBox,
		quotaOwnerHash: identity.quotaOwnerHash,
		entitlementPool: entitlement.pool,
		entitlementCycleKey,
		quotaReservationId,
		jobId: '', jobDocId: '', requestId: '', generatedFileId: '', generatedThumbnailFileId: '',
		resultSaved: false, userQuotaConsumed: false, mainAssetMetadata: null,
		providerSucceeded: false, providerResultUrl: '', providerResultRequestId: '',
		resultStoragePending: false, refreshProviderResult: false,
		sourceFileIds, parentJobId, currentResultFileId, revisionText,
		providerSize: '2K', compositionVersion: COMPOSITION_VERSION, requestedSize: MASTER_SIZE,
		sourceCount: sourceFileIds.length,
		createdAt,
		updatedAt: createdAt
	};
	if (!(await acquireAvatarJobLock(lockId, existing, lock))) throw codedError('ACTIVE_JOB_EXISTS');
	let quotaReserved = false;
	let providerSubmissionStarted = false;
	let acceptedTask = null;
	try {
		if (entitlement.pool !== 'development') {
			const reservation = !require('pety-auth/sessions').enabled()?await avatarQuotaLedger().reserve(quotaScope(lock),quotaReservationId):await require('pety-auth/sessions').admit(identity.uid,identity.session,async tx=>{if(require('pety-auth/sessions').enabled()){const member=await getActiveMembership(identity.uid,tx);const cycle=member?(member.entitlementCycleKey||hash(identity.uid+':'+(Number(member.startedAt)||Number(member.createdAt)||0)).slice(0,24)):'free-lifetime';if((member?'member':'free')!==lock.entitlementPool||cycle!==lock.entitlementCycleKey)throw codedError('AVATAR_ENTITLEMENT_CHANGED');}return avatarQuotaLedger(tx).reserve(quotaScope(lock), quotaReservationId);});
			if (!reservation.fresh) throw codedError('WAN_SUBMISSION_UNCERTAIN');
			quotaReserved = true;
		}
		const styleFileId = jobKind === 'revision' ? '' : assertPrivateFileId(config.styleReferenceFileId);
		const orderedFileIds = buildOrderedFileIds(jobKind, styleFileId, currentResultFileId, providerReferenceFileIds);
		const imageUrls = jobKind === 'revision'
			? [revisionSource.dataUrl]
			: await getProviderImageInputs(orderedFileIds, expectedSourceHashes);
		if (!imageUrls[0]) throw codedError(jobKind === 'revision' ? 'INVALID_CURRENT_RESULT' : 'STYLE_REFERENCE_UNAVAILABLE');
		const basePrompt = jobKind === 'revision'
			? buildAvatarRevisionPrompt(0, revisionText)
			: buildAvatarPrompt(sourceFileIds.length);
		const prompt = applyCompositionContract(basePrompt, jobKind);
		await require('pety-auth/cost-budget').reserve({ uid: identity.uid, feature: 'avatar' });
		providerSubmissionStarted = true;
		const task = await createWanTask(config, prompt, imageUrls, {
			seed,
			size: MASTER_SIZE,
			bboxList: revisionBBox,
			...(jobKind === 'revision' ? { n: 1, watermark: false, enableSequential: false } : {})
		});
		if (!task.taskId) throw codedError('WAN_INVALID_RESPONSE');
		acceptedTask = task;
		const status = normalizeStatus(task.taskStatus);
		const jobDocId = historyDocumentId(task.taskId);
		const now = Date.now();
		await jobs.doc(jobDocId).set({
			recordType: 'candidate',
			operationId,
			operationFingerprint,
			petHash,
			jobId: task.taskId,
			requestId: task.requestId || '',
			status,
			jobKind,
			parentJobId,
			revisionText,
			revisionTarget: revisionIntent && revisionIntent.revisionTarget || '',
			revisionAction: revisionIntent && revisionIntent.actionKey || '',
			identityCorrection: Boolean(revisionIntent && revisionIntent.identityCorrection),
			identityReferenceFileId: '',
			revisionBBox,
			bboxConfidence: revisionIntent && revisionIntent.bboxConfidence || 0,
			seed,
			generationSessionId,
			candidateStatus: 'temporary',
			confirmed: false,
			resultSaved: false,
			userQuotaConsumed: false,
			quotaOwnerHash: identity.quotaOwnerHash,
			entitlementPool: entitlement.pool,
			entitlementCycleKey,
			quotaReservationId,
			sourceFileIds,
			currentResultFileId,
			revisionSourceRole: revisionSource && revisionSource.role || '',
			revisionSourceCloudPath: revisionSource && revisionSource.cloudPath || '',
			revisionSourceMime: revisionSource && revisionSource.mime || '',
			revisionSourceBytes: revisionSource && revisionSource.bytes || 0,
			revisionSourceWidth: revisionSource && revisionSource.width || 0,
			revisionSourceHeight: revisionSource && revisionSource.height || 0,
			revisionSourceSha256: revisionSource && revisionSource.sha256 || '',
			sourceCount: sourceFileIds.length,
			providerInputCount: imageUrls.length,
			compositionVersion: COMPOSITION_VERSION,
			requestedSize: MASTER_SIZE,
			poseVerification: 'NOT_VISUALLY_VERIFIED',
			promptVersion: config.promptVersion,
			provider: config.provider,
			model: config.model,
			providerSize: '2K',
			providerN: 1,
			providerWatermark: false,
			createdAt: now,
			updatedAt: now
		});
		await jobs.doc(lockId).update({
			jobId: task.taskId,
			compositionVersion: COMPOSITION_VERSION,
			requestedSize: MASTER_SIZE,
			jobDocId,
			requestId: task.requestId || '',
			status,
			parentJobId,
			currentResultFileId,
			seed,
			revisionBBox,
			promptVersion: config.promptVersion,
			provider: config.provider,
			model: config.model,
			providerSize: '2K',
			updatedAt: now
		});
		console.info('pet_avatar_job_created', {
			requestId: task.requestId,
			jobId: task.taskId,
			taskStatus: status,
			petIdHash: petHash,
			sourceCount: sourceFileIds.length,
			jobKind,
			seed,
			generationSessionId: hash(generationSessionId).slice(0, 12),
			entitlementPool: entitlement.pool,
			provider: config.provider,
			model: config.model,
			providerSize: '2K',
			promptVersion: config.promptVersion
		});
		return {
			code: 0,
			jobId: task.taskId,
			requestId: task.requestId,
			taskStatus: status,
			jobKind,
			seed,
			generationSessionId,
			entitlement
		};
	} catch (error) {
		const failure = getWanRequestFailureDetails(error);
		const rejected = error?.code === 'WAN_REQUEST_FAILED' && Number(error.statusCode) >= 400 && Number(error.statusCode) < 500 && Number(error.statusCode) !== 408;
		const uncertain = error?.code === 'WAN_SUBMISSION_UNCERTAIN' || (providerSubmissionStarted && !rejected);
		if (quotaReserved && !uncertain) await settleAvatarQuota(lock, 'released');
		await jobs.where({ _id: lockId, quotaOwnerHash: identity.quotaOwnerHash, quotaReservationId }).update({
			status: uncertain ? (acceptedTask ? 'PENDING' : 'SUBMISSION_UNKNOWN') : 'FAILED', ...failure,
			...(acceptedTask ? { jobId: acceptedTask.taskId, jobDocId: historyDocumentId(acceptedTask.taskId), requestId: acceptedTask.requestId || '' } : {}), updatedAt: Date.now()
		}).catch(() => {});
		console.error('pet_avatar_provider_submit_failed', {
			errorCode: failure.errorCode,
			providerErrorCode: failure.providerErrorCode,
			providerRequestId: failure.providerRequestId,
			statusCode: Number(error && error.statusCode) || 0,
			provider: config.provider,
			model: config.model
		});
		throw uncertain ? codedError('WAN_SUBMISSION_UNCERTAIN') : error;
	}
}

async function getJobStatus(event, config, context) {
	assertConsent(event);
	validateWanConfig(config, { requireStyleReference: false });
	const petId = normalizePetId(event.petId);
	const petHash = hash(petId).slice(0, 24);
	const requestedJobId = String(event.jobId || '').trim();
	const identity = getQuotaIdentity(context);
	let record = await getJobDocument(petHash, identity.quotaOwnerHash);
	if (requestedJobId && record?.jobId !== requestedJobId) {
		const historical = await getCandidateDocument(petHash, requestedJobId, identity.quotaOwnerHash);
		if (historical) record = historical;
	}
	if (!record) throw codedError('JOB_NOT_FOUND');
	if (!requestedJobId || record.jobId !== requestedJobId) throw codedError('JOB_OWNER_MISMATCH');
	if (!record.quotaOwnerHash || record.quotaOwnerHash !== identity.quotaOwnerHash) throw codedError('JOB_OWNER_MISMATCH');
	if (record.candidateStatus === 'discarded') throw codedError('AVATAR_RESULT_NOT_READY');
	if (record.status === 'FAILED' || record.status === 'CANCELED') {
		await settleAvatarQuota(record, 'released');
		return { code:0, jobId:record.jobId, status:record.status, errorCode:record.errorCode || '' };
	}
	// A successful provider submission can outlive a failed history write.
	// Recreate only the exact owned receipt; never overwrite an existing one.
	if (record.jobDocId) {
		const receipt = readAvatarRows(await jobs.doc(record.jobDocId).get(), 1)[0];
		if (!receipt) {
			const { _id, ...snapshot } = record;
			try { await jobs.add({ ...snapshot, _id: record.jobDocId, recordType: 'candidate', confirmed: false, candidateStatus: 'temporary' }); }
			catch (error) { if (!isDuplicateDocumentError(error)) throw error; }
		} else if (receipt.jobId !== record.jobId || receipt.quotaOwnerHash !== identity.quotaOwnerHash) throw codedError('JOB_OWNER_MISMATCH');
	}
	const savedResultFileId = record.confirmed && record.finalFileId ? record.finalFileId : record.generatedFileId;
	if (record.status === 'SUCCEEDED' && savedResultFileId) {
		if (record.jobDocId) await jobs.doc(record.jobDocId).update({ status: 'SUCCEEDED', generatedFileId: record.generatedFileId,
			generatedThumbnailFileId: record.generatedThumbnailFileId || '', resultSaved: true, userQuotaConsumed: true,
			mainAssetMetadata: replaceDatabaseObject(record.mainAssetMetadata || null), updatedAt: Date.now() });
		await settleAvatarQuota(record, 'consumed');
		const fileIds = [savedResultFileId].concat(record.generatedThumbnailFileId ? [record.generatedThumbnailFileId] : []);
		const tempUrls = await getTempUrls(fileIds);
		return {
			code: 0,
			jobId: record.jobId,
			status: 'SUCCEEDED',
			generatedFileId: savedResultFileId,
			generatedTempUrl: tempUrls[0] || '',
			generatedThumbnailFileId: record.generatedThumbnailFileId || '',
			generatedThumbnailUrl: tempUrls[1] || '',
			mainAssetMetadata: record.mainAssetMetadata || null,
			jobKind: record.jobKind,
			seed: record.seed,
			generationSessionId: record.generationSessionId
		};
	}

	const startedAt = Date.now();
	// Once accepted output is known, storage retries must reuse it. Polling can
	// renew an expired result link, but must never create a second paid task.
	const providerResponse = record.providerResultUrl && !record.refreshProviderResult
		? { request_id: record.providerResultRequestId || '', output: { task_status: 'SUCCEEDED', choices: [{ message: { content: [{ type: 'image', image: record.providerResultUrl }] } }] } }
		: await getWanTask(config, requestedJobId);
	const status = normalizeStatus(providerResponse && providerResponse.output && providerResponse.output.task_status);
	// A renewed link may be unavailable or a provider replica may report a stale
	// status. The durable success receipt is authoritative until storage settles.
	if (record.providerSucceeded && (status !== 'SUCCEEDED' || !extractResultImageUrl(providerResponse))) {
		const pending = { status: 'PENDING', resultStoragePending: true, refreshProviderResult: true,
			errorCode: 'RESULT_SAVE_PENDING', updatedAt: Date.now() };
		if (!(await updateActiveAvatarJob(record, pending))) throw codedError('AVATAR_JOB_STATE_CHANGED');
		if (record.jobDocId) await jobs.doc(record.jobDocId).update(pending);
		return { code: 0, jobId: requestedJobId, status: 'PENDING', resultStoragePending: true, errorCode: 'RESULT_SAVE_PENDING' };
	}
	const update = { status, updatedAt: Date.now() };
	let result = { code: 0, jobId: requestedJobId, status };
	if (status === 'FAILED' || status === 'CANCELED') {
		const failure = getWanFailureDetails(providerResponse);
		Object.assign(update, failure);
		result = { ...result, errorCode: failure.errorCode };
		if (config.isDevelopment && (config.devMemberBypassUids || []).includes(identity.uid)) Object.assign(result, failure);
	}

	if (status === 'SUCCEEDED') {
		const providerUrl = extractResultImageUrl(providerResponse);
		if (!providerUrl) {
			const pending = { status: 'PENDING', providerSucceeded: true, resultStoragePending: true,
				refreshProviderResult: true, errorCode: 'RESULT_SAVE_PENDING', updatedAt: Date.now() };
			if (!(await updateActiveAvatarJob(record, pending))) throw codedError('AVATAR_JOB_STATE_CHANGED');
			if (record.jobDocId) await jobs.doc(record.jobDocId).update(pending);
			return { code: 0, jobId: requestedJobId, status: 'PENDING', resultStoragePending: true, errorCode: 'RESULT_SAVE_PENDING' };
		}
		// Commit the private provider receipt before downloading or uploading bytes.
		const receipt = { status: 'PENDING', providerSucceeded: true, providerResultUrl: providerUrl,
			providerResultRequestId: providerResponse.request_id || providerResponse.requestId || '',
			resultStoragePending: true, refreshProviderResult: false, updatedAt: Date.now() };
		if (!(await updateActiveAvatarJob(record, receipt))) throw codedError('AVATAR_JOB_STATE_CHANGED');
		Object.assign(record, receipt);
		if (record.jobDocId) await jobs.doc(record.jobDocId).update(receipt);
		let persisted;
		try {
			persisted = await persistGeneratedImage(petHash, requestedJobId, providerUrl, {
				styleReferenceFileId: record.jobKind === 'revision' ? '' : config.styleReferenceFileId,
				revisionReferenceFileId: record.jobKind === 'revision' ? record.currentResultFileId : '',
				providerSize: record.providerSize || '2K',
				compositionVersion: record.compositionVersion || '',
				requestedSize: record.requestedSize || ''
			});
		} catch (error) {
			const rejected = error && ['OUTPUT_EQUALS_STYLE_REFERENCE', 'REVISION_QUALITY_REJECTED', 'REVISION_RESULT_UNSTABLE', 'MASTER_COMPOSITION_SIZE_REJECTED', 'REVISION_SOURCE_INVALID'].includes(error.code);
			if (!rejected) {
				const pending = { status: 'PENDING', resultStoragePending: true, errorCode: 'RESULT_SAVE_PENDING',
					refreshProviderResult: /DOWNLOAD|URL/.test(String(error?.code || error?.message || '')), updatedAt: Date.now() };
				if (!(await updateActiveAvatarJob(record, pending))) throw codedError('AVATAR_JOB_STATE_CHANGED');
				if (record.jobDocId) await jobs.doc(record.jobDocId).update(pending);
				return { code: 0, jobId: requestedJobId, status: 'PENDING', resultStoragePending: true, errorCode: 'RESULT_SAVE_PENDING' };
			}
			if (rejected) {
				console.error('pet_avatar_result_rejected', {
					requestId: providerResponse.request_id || providerResponse.requestId || '',
					jobId: requestedJobId,
					errorCode: error.code,
					jobKind: record.jobKind,
					qualityGateReasonCode: error.qualityGateResult && error.qualityGateResult.reasonCode || ''
				});
			}
			const failed = {
				status: 'FAILED',
				errorCode: error && error.code || 'RESULT_SAVE_FAILED',
				resultSaved: false,
				userQuotaConsumed: false,
				qualityGateResult: error && error.qualityGateResult || null,
				updatedAt: Date.now()
			};
			if (!(await updateActiveAvatarJob(record, failed))) throw codedError('AVATAR_JOB_STATE_CHANGED');
			if (record.jobDocId) await jobs.doc(record.jobDocId).update(failed);
			await settleAvatarQuota(record, 'released');
			throw error;
		}
		update.generatedFileId = persisted.generatedFileId;
		update.generatedThumbnailFileId = persisted.generatedThumbnailFileId;
		update.generatedCandidateSha256 = persisted.generatedCandidateSha256;
		update.styleReferenceSha256 = persisted.styleReferenceSha256;
		update.mainAssetMetadata = persisted.mainAssetMetadata;
		if (persisted.revisionQuality) update.qualityGateResult = persisted.revisionQuality;
		update.resultSaved = true;
		update.resultStoragePending = false;
		update.userQuotaConsumed = true;
		result = { ...result, generatedFileId: persisted.generatedFileId, generatedTempUrl: persisted.generatedTempUrl, generatedThumbnailFileId: persisted.generatedThumbnailFileId, generatedThumbnailUrl: persisted.generatedThumbnailUrl, mainAssetMetadata: persisted.mainAssetMetadata };
		if (config.isDevelopment) {
			console.info('pet_avatar_main_asset_persisted', {
				petHash,
				jobIdHash: hash(requestedJobId).slice(0, 12),
				displaySurface: 'workbench',
				sourceRole: 'candidate_original',
				fileIdHash: hash(persisted.generatedFileId).slice(0, 12),
				storagePathTail: persisted.cloudPath.split('/').slice(-3).join('/'),
				width: persisted.mainAssetMetadata.width,
				height: persisted.mainAssetMetadata.height,
				bytes: persisted.mainAssetMetadata.bytes,
				mime: persisted.mainAssetMetadata.mime,
				wasReencoded: persisted.mainAssetMetadata.wasReencoded,
				wasDownscaled: persisted.mainAssetMetadata.wasDownscaled,
				providerOriginal: persisted.mainAssetMetadata.providerOriginal,
				providerSize: persisted.mainAssetMetadata.providerSize
			});
		}
		if (config.isDevelopment && record.jobKind === 'revision' && persisted.outputInspection) {
			console.info('revision_output_persisted', {
				petHash,
				parentJobIdHash: hash(record.parentJobId || '').slice(0, 12),
				revisionJobIdHash: hash(requestedJobId).slice(0, 12),
				width: persisted.outputInspection.width,
				height: persisted.outputInspection.height,
				bytes: persisted.outputInspection.bytes,
				mimeType: persisted.outputInspection.mime,
				sha256Prefix: persisted.outputInspection.sha256.slice(0, 16),
				providerRequestId: providerResponse.request_id || providerResponse.requestId || ''
			});
		}
	}
	if (!(await updateActiveAvatarJob(record, update))) throw codedError('AVATAR_JOB_STATE_CHANGED');
	if (record.jobDocId) await jobs.doc(record.jobDocId).update(replaceDatabaseFields(update, ['mainAssetMetadata', 'qualityGateResult']));
	if (status === 'SUCCEEDED') await settleAvatarQuota(record, 'consumed');
	else if (status === 'FAILED' || status === 'CANCELED') await settleAvatarQuota(record, 'released');
	console.info('pet_avatar_job_polled', {
		requestId: providerResponse.request_id || providerResponse.requestId || '',
		jobId: requestedJobId,
		...(config.isDevelopment ? { wanTaskId: requestedJobId } : {}),
		taskStatus: status,
		petIdHash: petHash,
		duration: Date.now() - startedAt,
		provider: config.provider,
		model: config.model,
		wanResultFound: Boolean(status === 'SUCCEEDED' && extractResultImageUrl(providerResponse)),
		candidateSaved: Boolean(update.resultSaved),
		candidateFileIdHash: update.generatedFileId ? hash(update.generatedFileId).slice(0, 12) : '',
		resultSaved: Boolean(update.resultSaved),
		userQuotaConsumed: update.userQuotaConsumed === true
	});
	if (status === 'FAILED' || status === 'CANCELED') {
		console.error('pet_avatar_provider_task_failed', {
			requestId: update.providerRequestId || '',
			jobIdHash: hash(requestedJobId).slice(0, 12),
			errorCode: update.errorCode || 'WAN_PROVIDER_FAILED',
			providerErrorCode: update.providerErrorCode || '',
			providerErrorMessage: update.providerErrorMessage || '',
			provider: config.provider,
			model: config.model
		});
	}
	return { ...result, jobKind: record.jobKind, seed: record.seed, generationSessionId: record.generationSessionId };
}

async function getEntitlement(event, context, config) {
	const { entitlement } = await resolveEntitlement(context, config, event);
	return { code: 0, entitlement };
}

async function getOwnedCandidate(petHash, selectedJobId, context) {
	const identity = getQuotaIdentity(context);
	const result = await jobs.where({
		recordType: 'candidate',
		petHash,
		jobId: selectedJobId,
		quotaOwnerHash: identity.quotaOwnerHash
	}).limit(1).get();
	const candidate = readAvatarRows(result, 1)[0] || null;
	if (candidate && (candidate.recordType !== 'candidate' || candidate.petHash !== petHash ||
		candidate.jobId !== selectedJobId || candidate.quotaOwnerHash !== identity.quotaOwnerHash)) throw codedError('JOB_OWNER_MISMATCH');
	return { identity, candidate };
}

async function getOwnedMediaUrls(event,context){
 const identity=getQuotaIdentity(context),petHash=hash(normalizePetId(event.petId)).slice(0,24),ids=Array.isArray(event.fileIds)?[...new Set(event.fileIds)]:[];
 if(!ids.length||ids.length>8||ids.some(id=>typeof id!=='string'||!id.startsWith('cloud://')))throw codedError('AVATAR_ASSET_OWNER_MISMATCH');
 for(const fileId of ids){let owned=false;for(const key of ['finalFileId','heroFileId','cutoutFileId','cutoutTightFileId','localCutoutFileId','localCutoutTightFileId','thumbnailFileId','displayFileId','generatedFileId','generatedThumbnailFileId']){
  const r=await jobs.where({quotaOwnerHash:identity.quotaOwnerHash,petHash,[key]:fileId,status:'SUCCEEDED'}).limit(1).get();
  const row=readAvatarRows(r,1)[0];
  if(row){if(row.quotaOwnerHash!==identity.quotaOwnerHash||row.petHash!==petHash||row[key]!==fileId||row.status!=='SUCCEEDED')throw codedError('AVATAR_ASSET_OWNER_MISMATCH');owned=true;break;}
 }
 if(!owned){
  const r=await getDatabase().collection('pety_avatar_source_receipts').where({owner:identity.quotaOwnerHash,pet:petHash,fileId,state:'ready'}).limit(1).get();
  const row=readAvatarRows(r,1)[0];
  if(row){if(row.owner!==identity.quotaOwnerHash||row.pet!==petHash||row.fileId!==fileId||row.state!=='ready')throw codedError('AVATAR_ASSET_OWNER_MISMATCH');owned=true;}
 }
 if(!owned)throw codedError('AVATAR_ASSET_OWNER_MISMATCH');}
 const urls=await getTempUrls(ids);return{code:0,fileList:ids.map((fileID,i)=>({fileID,tempFileURL:urls[i]||''}))};
}
async function getAvatarDisplayUrls(event, context) {
	const petHash = hash(normalizePetId(event.petId)).slice(0, 24);
	const { candidate } = await getOwnedCandidate(petHash, String(event.selectedJobId || ''), context);
	if (!candidate || candidate.confirmed !== true || candidate.finalFileId !== event.expectedFinalFileId) throw codedError('JOB_OWNER_MISMATCH');
	const allowed = new Set(['finalFileId', 'heroFileId', 'cutoutFileId', 'cutoutTightFileId', 'localCutoutFileId', 'localCutoutTightFileId', 'thumbnailFileId', 'displayFileId'].map(key => candidate[key]).filter(Boolean));
	const fileIds = Array.isArray(event.fileIds) ? [...new Set(event.fileIds)] : [];
	if (!fileIds.length || fileIds.length > 8 || fileIds.some(id => !allowed.has(id))) throw codedError('AVATAR_ASSET_OWNER_MISMATCH');
	const urls = await getTempUrls(fileIds);
	return { code: 0, runtimeEnvironment: context?.RUNTIME_ENV || 'unknown',
		fileList: fileIds.map((fileID, index) => ({ fileID, tempFileURL: urls[index] || '' })) };
}

// Reading a saved candidate never polls the currently active Provider task.
// The job can be older than the active job; only its owned immutable IDs apply.
async function getCandidateDisplayUrls(event, context) {
	const petHash = hash(normalizePetId(event.petId)).slice(0, 24);
	const jobId = String(event.jobId || '').trim();
	const { candidate } = await getOwnedCandidate(petHash, jobId, context);
	if (!candidate || candidate.status !== 'SUCCEEDED' || candidate.candidateStatus === 'discarded' ||
		!candidate.generatedFileId || candidate.generatedFileId !== event.expectedFileId ||
		(event.expectedThumbnailFileId && candidate.generatedThumbnailFileId !== event.expectedThumbnailFileId)) {
		throw codedError('CANDIDATE_ASSET_CHANGED');
	}
	const fileIds = [candidate.generatedFileId];
	if (candidate.generatedThumbnailFileId) fileIds.push(candidate.generatedThumbnailFileId);
	const urls = await getTempUrls(fileIds);
	return { code: 0, jobId, status: 'SUCCEEDED', generatedFileId: candidate.generatedFileId,
		generatedTempUrl: urls[0] || '', generatedThumbnailFileId: candidate.generatedThumbnailFileId || '',
		generatedThumbnailUrl: urls[1] || '' };
}

function normalizeFeedbackNote(value) {
	return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 600);
}

async function submitAvatarFeedback(event, context) {
	const petId = normalizePetId(event.petId);
	const petHash = hash(petId).slice(0, 24);
	const selectedJobId = String(event.selectedJobId || '').trim();
	const category = String(event.category || '').trim();
	if (!selectedJobId || !VALID_FEEDBACK_CATEGORIES.includes(category)) throw codedError('INVALID_AVATAR_FEEDBACK');
	const { identity, candidate } = await getOwnedCandidate(petHash, selectedJobId, context);
	if (!candidate || candidate.status !== 'SUCCEEDED' || !candidate.generatedFileId) throw codedError('AVATAR_RESULT_NOT_READY');
	const now = Date.now();
	const feedbackId = `feedback_${hash(`${identity.quotaOwnerHash}:${selectedJobId}:${now}:${crypto.randomBytes(4).toString('hex')}`).slice(0, 40)}`;
	await feedbackCollection.doc(feedbackId).set({
		petId,
		petHash,
		jobId: selectedJobId,
		selectedCandidateFileId: candidate.generatedFileId,
		generationStage: candidate.jobKind || 'initial',
		revisionText: candidate.jobKind === 'revision' ? String(candidate.revisionText || '').slice(0, 300) : '',
		qualityGateResult: candidate.qualityGateResult || null,
		model: String(candidate.model || ''),
		category,
		note: normalizeFeedbackNote(event.note),
		locale: String(event.locale || '').slice(0, 20),
		quotaOwnerHash: identity.quotaOwnerHash,
		status: 'submitted',
		createdAt: now,
		updatedAt: now
	});
	console.info('pet_avatar_feedback_submitted', {
		feedbackHash: hash(feedbackId).slice(0, 12),
		petHash,
		jobHash: hash(selectedJobId).slice(0, 12),
		category,
		generationStage: candidate.jobKind || 'initial'
	});
	return { code: 0, submittedAt: now };
}

async function cleanupConfirmedSession(selected, identity) {
	if (!selected || !selected.finalFileId) throw codedError('AVATAR_RESULT_NOT_READY');
	if (!(await verifyCloudFileExists(selected.finalFileId))) throw codedError('AVATAR_RESULT_NOT_READY');
	const sessionResult = await jobs.where({
		recordType: 'candidate',
		petHash: selected.petHash,
		generationSessionId: selected.generationSessionId,
		quotaOwnerHash: identity.quotaOwnerHash
	}).get();
	const sessionJobs = readAvatarRows(sessionResult);
	const cleanupPlan = buildCleanupPlan(sessionJobs, selected);
	await deleteCloudFiles(cleanupPlan.discardedFileIds.concat(cleanupPlan.temporarySourceFileIds));
	for (const candidate of sessionJobs) {
		const isSelected = candidate._id === selected._id;
		await jobs.doc(candidate._id).update({
			candidateStatus: isSelected ? 'finalized' : 'discarded',
			confirmed: isSelected,
			generatedFileId: '',
			generatedThumbnailFileId: '',
			cleanupPending: false,
			candidateCleanedAt: Date.now(),
			updatedAt: Date.now()
		});
	}
	return { cleanupCandidateCount: cleanupPlan.discardedFileIds.length };
}

async function confirmAvatar(event, config, context) {
	const { masterCopyReceipt } = require('./avatar-master-copy');
	const confirmStartedAt = Date.now();
	assertConsent(event);
	const petId = normalizePetId(event.petId);
	const petHash = hash(petId).slice(0, 24);
	const selectedJobId = String(event.selectedJobId || '').trim();
	const generationSessionId = String(event.generationSessionId || '').trim();
	if (!selectedJobId || !generationSessionId) throw codedError('INVALID_GENERATION_SESSION');
	const { identity, candidate: selected } = await getOwnedCandidate(petHash, selectedJobId, context);
	if (!selected) throw codedError('JOB_OWNER_MISMATCH');
	if (selected.generationSessionId !== generationSessionId) throw codedError('JOB_OWNER_MISMATCH');
	if (selected.confirmed === true && selected.finalFileId && await verifyCloudFileExists(selected.finalFileId)) {
		const assets = await buildAvatarAssetResponse(selected, selectedJobId);
		return {
			...assets,
			code: 0,
			selectedJobId,
			generatedFileId: selected.finalFileId,
			masterCopy: masterCopyReceipt(selected, selected.finalFileId, selected.mainAssetMetadata || {}),
			generatedTempUrl: assets.finalUrl || '',
			mainAssetMetadata: selected.mainAssetMetadata || null,
			cutoutJobId: selectedJobId,
			cutoutStatus: selected.cutoutStatus || 'PENDING',
			cutoutAlphaValid: selected.cutoutAlphaValid === true,
			localCutoutAlphaValid: selected.localCutoutAlphaValid === true,
			cleanupPending: selected.cleanupPending !== false,
			timings: { candidateFinalCopyMs: 0, finalVerifyMs: 0, responseMs: Date.now() - confirmStartedAt },
			idempotentReplay: true
		};
	}
	if (selected.status !== 'SUCCEEDED' || !selected.generatedFileId) throw codedError('AVATAR_RESULT_NOT_READY');

	const confirmedAt = Date.now();
	const finalCopyStartedAt = Date.now();
	const finalized = await persistFinalImage(petHash, selectedJobId, selected.generatedFileId, selected.mainAssetMetadata || {});
	const candidateFinalCopyMs = Date.now() - finalCopyStartedAt;
	const finalVerifyStartedAt = Date.now();
	if (!(await verifyCloudFileExists(finalized.finalFileId))) throw codedError('AVATAR_RESULT_NOT_READY');
	const finalVerifyMs = Date.now() - finalVerifyStartedAt;
	const cutoutStatus = 'PENDING';
	const cutoutEngine = validateViapiConfig(config) ? 'aliyun-viapi' : (config.heroChromaEnabled ? HERO_CHARACTER_VERSION : 'local-color-only');
	await jobs.doc(selected._id).update({
		candidateStatus: 'finalized',
		confirmed: true,
		confirmedAt,
		finalFileId: finalized.finalFileId,
		mainAssetMetadata: finalized.mainAssetMetadata,
		cutoutFileId: '',
		cutoutStatus,
		cutoutErrorCode: '',
		cutoutAlphaValid: false,
		cutoutAlphaMetrics: {},
		cutoutProviderJobId: '',
		cutoutInvocationCount: 0,
		cutoutPipelineVersion: CUTOUT_PIPELINE_VERSION,
		cutoutEngine,
		heroGenerationStatus: cutoutEngine === HERO_CHARACTER_VERSION ? 'PENDING' : 'NOT_STARTED',
		heroGenerationVersion: cutoutEngine === HERO_CHARACTER_VERSION ? HERO_CHARACTER_VERSION : '',
		heroGenerationPhase: cutoutEngine === HERO_CHARACTER_VERSION ? 'QUEUED' : 'NOT_STARTED',
		heroGenerationErrorCode: '',
		heroProviderSourceFileId: '',
		heroProviderSourceMetadata: {},
		displayDerivativeStatus: 'PENDING',
		displayFileId: '',
		thumbnailFileId: '',
		featheredDisplayFileId: '',
		localCutoutFileId: '',
		localCutoutAlphaValid: false,
		localCutoutMetrics: {},
		cleanupPending: true,
		updatedAt: confirmedAt
	});
	if (config.isDevelopment) {
		console.info('pet_avatar_confirmed', {
			jobIdHash: hash(selectedJobId).slice(0, 12),
			selectedFinalFileIdHash: hash(finalized.finalFileId).slice(0, 12),
			cleanupPending: true,
			cutoutStatus,
			candidate_final_copy_ms: candidateFinalCopyMs,
			final_verify_ms: finalVerifyMs,
			response_ms: Date.now() - confirmStartedAt
		});
	}
	return {
		code: 0,
		selectedJobId,
		generatedFileId: finalized.finalFileId,
		masterCopy: masterCopyReceipt(selected, finalized.finalFileId, finalized.mainAssetMetadata),
		generatedTempUrl: finalized.finalTempUrl,
		mainAssetMetadata: finalized.mainAssetMetadata,
		cutoutJobId: selectedJobId,
		cutoutFileId: '',
		cutoutUrl: '',
		cutoutStatus,
		cutoutPipelineVersion: CUTOUT_PIPELINE_VERSION,
		cutoutEngine,
		cutoutAlphaValid: false,
		cutoutErrorCode: '',
		heroGenerationStatus: cutoutEngine === HERO_CHARACTER_VERSION ? 'PENDING' : 'NOT_STARTED',
		heroGenerationVersion: cutoutEngine === HERO_CHARACTER_VERSION ? HERO_CHARACTER_VERSION : '',
		heroGenerationPhase: cutoutEngine === HERO_CHARACTER_VERSION ? 'QUEUED' : 'NOT_STARTED',
		heroGenerationErrorCode: '',
		localCutoutAlphaValid: false,
		cleanupPending: true,
		timings: {
			candidateFinalCopyMs,
			finalVerifyMs,
			responseMs: Date.now() - confirmStartedAt
		}
	};
}

async function buildAvatarAssetResponse(candidate, selectedJobId) {
	candidate = await backfillTightCutouts(candidate, selectedJobId);
	const fields = [
		['heroFileId', 'heroUrl'],
		['cutoutTightFileId', 'cutoutTightUrl'],
		['localCutoutTightFileId', 'localCutoutTightUrl'],
		['cutoutFileId', 'cutoutUrl'],
		['localCutoutFileId', 'localCutoutUrl'],
		['featheredDisplayFileId', 'featheredDisplayUrl'],
		['displayFileId', 'displayUrl'],
		['thumbnailFileId', 'thumbnailUrl'],
		['finalFileId', 'finalUrl']
	].filter(([fileKey]) => candidate && candidate[fileKey]);
	const urls = fields.length ? await getTempUrls(fields.map(([fileKey]) => candidate[fileKey])) : [];
	const response = {
		code: 0,
		selectedJobId,
		heroDisplayPreparedFor: candidate && candidate.heroDisplayPreparedFor || '',
		heroAssetVersion: candidate && candidate.heroAssetVersion || 0,
		heroMetrics: candidate && candidate.heroMetrics || null,
		heroGenerationStatus: candidate && candidate.heroGenerationStatus || 'NOT_STARTED',
		heroGenerationVersion: candidate && candidate.heroGenerationVersion || '',
		heroGenerationErrorCode: candidate && candidate.heroGenerationErrorCode || '',
		heroGenerationPhase: candidate && candidate.heroGenerationPhase || 'NOT_STARTED',
		heroGenerationRequestId: candidate && candidate.heroGenerationRequestId || '',
		heroPromptRevision: candidate && candidate.heroPromptRevision || '',
		heroProviderSourceMetadata: candidate && candidate.heroProviderSourceMetadata || null,
		cutoutTightMetrics: candidate && candidate.cutoutTightMetrics || null,
		localCutoutTightMetrics: candidate && candidate.localCutoutTightMetrics || null,
		cutoutStatus: candidate && candidate.cutoutStatus || 'NOT_CONFIGURED',
		cutoutPipelineVersion: Number(candidate && candidate.cutoutPipelineVersion) || 0,
		cutoutEngine: candidate && candidate.cutoutEngine || 'unknown',
		cutoutErrorCode: candidate && candidate.cutoutErrorCode || '',
		semanticCutoutAvailable: candidate && candidate.cutoutEngine === 'aliyun-viapi',
		displayDerivativeStatus: candidate && candidate.displayDerivativeStatus || 'NOT_STARTED',
		cutoutAlphaValid: candidate && candidate.cutoutAlphaValid === true,
		localCutoutAlphaValid: candidate && candidate.localCutoutAlphaValid === true,
		localCutoutMetrics: candidate && candidate.localCutoutMetrics || null,
		cutoutAlphaMetrics: candidate && candidate.cutoutAlphaMetrics || null,
		displayDimensions: candidate && candidate.displayDimensions || null,
		mainAssetMetadata: candidate && candidate.mainAssetMetadata || null
	};
	fields.forEach(([fileKey, urlKey], index) => {
		response[fileKey] = candidate[fileKey];
		response[urlKey] = urls[index] || '';
	});
	return response;
}

async function backfillTightCutouts(candidate, selectedJobId) {
	if (!candidate || !candidate._id || !candidate.petHash || !candidate.finalFileId) return candidate;
	const update = {};
	for (const [sourceKey, targetKey, metricsKey, local] of [
		['cutoutFileId', 'cutoutTightFileId', 'cutoutTightMetrics', false],
		['localCutoutFileId', 'localCutoutTightFileId', 'localCutoutTightMetrics', true]
	]) {
		const source = candidate[sourceKey], previous = candidate[metricsKey];
		if (!source || (previous && previous.tightVersion === 1 && previous.sourceFileId === source)) continue;
		try {
			const tight = await persistTightCutout(candidate.petHash, selectedJobId, source, local);
			update[targetKey] = tight.fileId;
			update[metricsKey] = tight.metrics;
		} catch (error) {
			// A temporary storage outage must not certify a file as invalid forever.
			if (!error || error.code !== 'CUTOUT_ALPHA_INVALID') continue;
			update[targetKey] = '';
			update[metricsKey] = { tightVersion: 1, qualityVersion: 2, sourceFileId: source, qualified: false, fallbackReason: 'CUTOUT_ALPHA_INVALID' };
		}
	}
	if (Object.keys(update).length) await jobs.doc(candidate._id).update(replaceDatabaseFields({ ...update, updatedAt: Date.now() }, ['cutoutTightMetrics', 'localCutoutTightMetrics']));
	return { ...candidate, ...update };
}

// Reconcile a confirmed asset. With consent this may submit a never-started Hero;
// an existing provider receipt must always be resumed, never replaced on upgrade.
async function prepareHeroDisplay(event, config, context) {
	const petHash = hash(normalizePetId(event.petId)).slice(0, 24);
	const selectedJobId = String(event.selectedJobId || '').trim();
	let { candidate } = await getOwnedCandidate(petHash, selectedJobId, context);
	if (!candidate || !candidate.confirmed || !candidate.finalFileId) throw codedError('JOB_OWNER_MISMATCH');
	const semanticCutoutAvailable = validateViapiConfig(config);
	const configuredEngine = semanticCutoutAvailable ? 'aliyun-viapi' : (config.heroChromaEnabled ? HERO_CHARACTER_VERSION : 'local-color-only');
	const cutoutEngine = candidate.cutoutProviderJobId ? (candidate.cutoutEngine || configuredEngine) : configuredEngine;
	const canRearmSemanticCutout = semanticCutoutAvailable &&
		candidate.cutoutEngine !== cutoutEngine &&
		!candidate.cutoutFileId && Number(candidate.cutoutInvocationCount || 0) === 0 &&
		['FAILED', 'NOT_CONFIGURED'].includes(candidate.cutoutStatus);
	const canRearmHeroGeneration = !semanticCutoutAvailable && config.heroChromaEnabled &&
		!candidate.cutoutProviderJobId &&
		!['SUBMISSION_UNKNOWN', 'SUBMITTING_PROVIDER'].includes(candidate.heroGenerationPhase) &&
		!candidate.heroFileId &&
		candidate.heroGenerationVersion !== HERO_CHARACTER_VERSION &&
		['FAILED', 'NOT_CONFIGURED'].includes(candidate.cutoutStatus);
	const recoveryPatch = planHeroRecovery(candidate, !semanticCutoutAvailable && config.heroChromaEnabled);
	const pipelineUpdate = {
		...(Number(candidate.cutoutPipelineVersion) !== CUTOUT_PIPELINE_VERSION ? { cutoutPipelineVersion: CUTOUT_PIPELINE_VERSION } : {}),
		...(candidate.cutoutEngine !== cutoutEngine ? { cutoutEngine } : {}),
		...(canRearmSemanticCutout || canRearmHeroGeneration ? {
			cutoutStatus: 'PENDING',
			cutoutErrorCode: '',
			cutoutProviderJobId: '',
			cutoutInvocationCount: 0,
			heroGenerationStatus: 'PENDING',
			heroGenerationVersion: canRearmHeroGeneration ? HERO_CHARACTER_VERSION : candidate.heroGenerationVersion || '',
			heroGenerationErrorCode: ''
		} : {}),
		...recoveryPatch
	};
	if (Object.keys(pipelineUpdate).length) {
		pipelineUpdate.updatedAt = Date.now();
		if (recoveryPatch.cutoutStatus) {
			// Two page entries may discover the same old failure. Only one can
			// replace its terminal receipt; the loser must not reset the new claim.
			await jobs.where({ _id: candidate._id, cutoutStatus: 'FAILED',
				cutoutProviderJobId: candidate.cutoutProviderJobId,
				heroGenerationErrorCode: candidate.heroGenerationErrorCode }).update(pipelineUpdate);
			candidate = (await jobs.doc(candidate._id).get()).data[0];
		} else {
			await jobs.doc(candidate._id).update(pipelineUpdate);
			candidate = { ...candidate, ...pipelineUpdate };
		}
	}
	if (!candidate.mainAssetMetadata || !candidate.mainAssetMetadata.alphaBoundingBox) {
		const inspection = await inspectCloudImage(candidate.finalFileId);
		candidate.mainAssetMetadata = { ...candidate.mainAssetMetadata, ...inspection, sourceRole: 'final_original' };
		await jobs.doc(candidate._id).update({ mainAssetMetadata: replaceDatabaseObject(candidate.mainAssetMetadata) });
	}
	// A PNG extension (or one translucent pixel) is not a transparent character.
	// Promote a genuinely transparent provider master to a separate, tight Hero file.
	if (candidate.heroMetrics?.sourceFileId !== candidate.finalFileId) {
		try {
			const native = await persistTightCutout(petHash, selectedJobId, candidate.finalFileId, false, true);
			candidate.heroFileId = native.fileId;
			candidate.heroMetrics = { ...native.metrics, assetRole: 'home_hero', derivedFromFileId: candidate.finalFileId };
		} catch (error) {
			if (error?.code !== 'CUTOUT_ALPHA_INVALID') throw error;
			candidate.heroFileId = '';
			candidate.heroMetrics = { sourceFileId: candidate.finalFileId, qualified: false, fallbackReason: 'MASTER_NOT_TRANSPARENT_CHARACTER' };
		}
		await jobs.doc(candidate._id).update({ heroFileId: candidate.heroFileId, heroMetrics: replaceDatabaseObject(candidate.heroMetrics) });
	}
	if (!candidate.heroFileId && !candidate.localCutoutFileId && candidate.heroDisplayPreparedFor !== candidate.finalFileId) {
		candidate = await backfillDisplayDerivatives(candidate, petHash, selectedJobId, config);
	}
	candidate = await validateStoredCutoutAssets(candidate);
	if (candidate.heroFileId || candidate.localCutoutFileId || candidate.displayDerivativeStatus === 'SUCCEEDED') {
		candidate.heroDisplayPreparedFor = candidate.finalFileId;
		await jobs.doc(candidate._id).update({ heroDisplayPreparedFor: candidate.finalFileId });
	}
	if (candidate.heroAssetVersion !== 3) {
		candidate.heroAssetVersion = 3;
		await jobs.doc(candidate._id).update({ heroAssetVersion: 3 });
	}
	// The client previously prepared PENDING and only attempted startup later.
	// A swallowed consent/provider error could leave that state forever. When the
	// same request carries valid generation consent, start the one-shot Hero task
	// here so PENDING is an observable transition rather than a terminal limbo.
	if (candidate.cutoutStatus === 'PENDING' && candidate.cutoutEngine === HERO_CHARACTER_VERSION &&
		!candidate.cutoutProviderJobId && Number(candidate.cutoutInvocationCount || 0) === 0 &&
		event.aiConsentAccepted === true) {
		return startAvatarCutout(event, config, context);
	}
	return buildAvatarAssetResponse(candidate, selectedJobId);
}

async function validateStoredCutoutAssets(candidate) {
	if (!candidate || !candidate._id) return candidate;
	const update = {};
	if (candidate.cutoutFileId && (!candidate.cutoutAlphaMetrics || candidate.cutoutAlphaMetrics.qualityVersion !== 2)) {
		try {
			const inspection = inspectTransparentPng(await downloadCloudFile(candidate.cutoutFileId));
			if (!inspection.qualified) throw codedError('CUTOUT_ALPHA_INVALID');
			update.cutoutAlphaValid = true;
			update.cutoutAlphaMetrics = inspection;
		} catch (error) {
			if (!error || error.code !== 'CUTOUT_ALPHA_INVALID') throw error;
			update.cutoutAlphaValid = false;
			update.cutoutAlphaMetrics = { qualityVersion: 2, qualified: false, hasAlpha: false, fallbackReason: 'CUTOUT_ALPHA_INVALID' };
			update.cutoutErrorCode = 'CUTOUT_ALPHA_INVALID';
			if (['SUCCEEDED', 'READY'].includes(candidate.cutoutStatus)) update.cutoutStatus = 'FAILED';
		}
	}
	if (candidate.localCutoutFileId && (!candidate.localCutoutMetrics || candidate.localCutoutMetrics.qualityVersion !== 2)) {
		try {
			const inspection = inspectTransparentPng(await downloadCloudFile(candidate.localCutoutFileId));
			if (!inspection.qualified) throw codedError('CUTOUT_ALPHA_INVALID');
			update.localCutoutAlphaValid = true;
			update.localCutoutMetrics = {
				...(candidate.localCutoutMetrics || {}),
				...inspection,
				transparentPixelRatio: inspection.transparentPixelRatio,
				outputBytes: inspection.bytes,
				cutoutShaPrefix: inspection.sha256.slice(0, 12),
				reason: ''
			};
		} catch (error) {
			if (!error || error.code !== 'CUTOUT_ALPHA_INVALID') throw error;
			update.localCutoutAlphaValid = false;
			update.localCutoutMetrics = { ...(candidate.localCutoutMetrics || {}), qualityVersion: 2, qualified: false, hasAlpha: false, fallbackReason: 'LOCAL_CUTOUT_UNSUITABLE', reason: 'LOCAL_CUTOUT_UNSUITABLE' };
		}
	}
	if (!Object.keys(update).length) return candidate;
	await jobs.doc(candidate._id).update(replaceDatabaseFields({ ...update, updatedAt: Date.now() }, ['cutoutAlphaMetrics', 'localCutoutMetrics']));
	return { ...candidate, ...update };
}

function hasDisplayDerivative(candidate) {
	return Boolean(candidate && (
		candidate.localCutoutFileId ||
		candidate.featheredDisplayFileId ||
		candidate.displayFileId
	));
}

async function backfillDisplayDerivatives(candidate, petHash, selectedJobId, config) {
	try {
		const derived = await persistDisplayDerivatives(petHash, selectedJobId, candidate.finalFileId);
		const update = {
			displayDerivativeStatus: 'SUCCEEDED',
			displayFileId: derived.displayFileId,
			thumbnailFileId: derived.thumbnailFileId,
			featheredDisplayFileId: derived.featheredDisplayFileId,
			localCutoutFileId: derived.localCutoutFileId || '',
			localCutoutAlphaValid: derived.localCutoutAlphaValid === true,
			localCutoutMetrics: derived.localCutoutMetrics,
			displayDimensions: derived.dimensions || {},
			updatedAt: Date.now()
		};
		await jobs.doc(candidate._id).update(replaceDatabaseFields(update, ['localCutoutMetrics', 'displayDimensions']));
		if (config.isDevelopment) console.info('pet_avatar_display_derivatives', {
			petHash,
			jobIdHash: hash(selectedJobId).slice(0, 12),
			backfilled: true,
			localCutoutReady: Boolean(derived.localCutoutFileId),
			backgroundConfidence: derived.localCutoutMetrics && derived.localCutoutMetrics.backgroundConfidence || 0,
			transparentPixelRatio: derived.localCutoutMetrics && derived.localCutoutMetrics.transparentPixelRatio || 0,
			localCutoutReason: derived.localCutoutMetrics && derived.localCutoutMetrics.reason || ''
		});
		return { ...candidate, ...update };
	} catch (error) {
		console.warn('pet_avatar_display_derivative_failed', {
			petHash,
			jobIdHash: hash(selectedJobId).slice(0, 12),
			backfilled: true,
			errorCode: error && error.code || 'DISPLAY_DERIVATIVE_FAILED'
		});
		return candidate;
	}
}

async function startAvatarCutout(event, config, context) {
	assertConsent(event);
	const identity = getQuotaIdentity(context);
	const petId = normalizePetId(event.petId);
	const petHash = hash(petId).slice(0, 24);
	const selectedJobId = String(event.selectedJobId || '').trim();
	let { candidate } = await getOwnedCandidate(petHash, selectedJobId, context);
	if (!candidate || !candidate.confirmed || !candidate.finalFileId) throw codedError('JOB_OWNER_MISMATCH');
	candidate = await validateStoredCutoutAssets(candidate);
	const finalCloudPath = getCloudPath(candidate.finalFileId);
	if (!/^(?:pety-private-v3\/)?pet-avatar\/final\/[^/]+\/[^/]+\/final\.png$/i.test(finalCloudPath) || !(await verifyCloudFileExists(candidate.finalFileId))) {
		throw codedError('AVATAR_RESULT_NOT_READY');
	}
	if (['SUCCEEDED', 'FAILED', 'NOT_CONFIGURED'].includes(candidate.cutoutStatus)) {
		// Older confirmed avatars can predate the local display assets. Backfill
		// them from final.png only; terminal cutout states never invoke VIAPI again.
		if (!hasDisplayDerivative(candidate)) candidate = await backfillDisplayDerivatives(candidate, petHash, selectedJobId, config);
		return buildAvatarAssetResponse(candidate, selectedJobId);
	}
	const semanticCutoutAvailable = validateViapiConfig(config);
	const useHeroGeneration = !semanticCutoutAvailable && config.heroChromaEnabled === true;
	const needsDisplayDerivative = !hasDisplayDerivative(candidate);
	const claimedAt = Date.now();
	const claim = await jobs.where({
		_id: candidate._id,
		cutoutStatus: 'PENDING',
		cutoutInvocationCount: 0
	}).update({
		cutoutStatus: 'PROCESSING',
		cutoutEngine: useHeroGeneration ? HERO_CHARACTER_VERSION : (semanticCutoutAvailable ? 'aliyun-viapi' : 'local-color-only'),
		cutoutInvocationCount: 1,
		cutoutErrorCode: '',
		// The dedicated Hero task must never depend on legacy display derivatives.
		// In production, a nested write into null localCutoutMetrics used
		// to abort the request before Wan was even submitted.
		...(needsDisplayDerivative && !useHeroGeneration ? { displayDerivativeStatus: 'RUNNING' } : {}),
		cutoutStartedAt: claimedAt,
		...(useHeroGeneration ? {
			heroGenerationStatus: 'SUBMITTING',
			heroPromptRevision: HERO_PROMPT_REVISION,
			heroGenerationPhase: 'PREPARING_OPAQUE_SOURCE',
			heroGenerationVersion: HERO_CHARACTER_VERSION,
			heroGenerationErrorCode: ''
		} : {}),
		updatedAt: claimedAt
	});
	if (!Number(claim && (claim.updated || claim.updatedCount || claim.affectedDocs))) {
		const latest = (await jobs.doc(candidate._id).get()).data[0];
		return buildAvatarAssetResponse(latest, selectedJobId);
	}
	let acceptedHeroTask = null;
	try {
		// Submit the independent Hero character task first. Thumbnail/display/local
		// derivative generation is unrelated to this asset and may fail without
		// preventing a true transparent character from reaching Home.
		if (useHeroGeneration) {
			validateWanConfig(config, { requireStyleReference: false });
			let heroProviderSourceFileId = candidate.heroProviderSourceFileId || '';
			let heroProviderSourceMetadata = candidate.heroProviderSourceMetadata || null;
			if (!heroProviderSourceFileId || !(await verifyCloudFileExists(heroProviderSourceFileId))) {
				const prepared = await persistHeroProviderSource(petHash, selectedJobId, candidate.finalFileId);
				heroProviderSourceFileId = prepared.fileId;
				heroProviderSourceMetadata = { width: prepared.width, height: prepared.height, bytes: prepared.bytes, mime: prepared.mime, alphaChannel: false };
				await jobs.doc(candidate._id).update({ heroProviderSourceFileId, heroProviderSourceMetadata: replaceDatabaseObject(heroProviderSourceMetadata), heroGenerationPhase: 'SOURCE_READY', updatedAt: Date.now() });
			}
			const [heroProviderSourceUrl] = await getTempUrls([heroProviderSourceFileId]);
			await require('pety-auth/cost-budget').reserve({ uid: identity.uid, feature: 'avatar' });
			await jobs.doc(candidate._id).update({ heroGenerationPhase: 'SUBMITTING_PROVIDER', updatedAt: Date.now() });
			const heroTask = await createWanTask(config, buildHeroCharacterPrompt(), [heroProviderSourceUrl], {
				seed: normalizeSeed(candidate.seed) === null ? createSeed() : normalizeSeed(candidate.seed),
				size: '2048*2048',
				n: 1,
				watermark: false,
				enableSequential: false
			});
			if (!heroTask.taskId) throw codedError('WAN_INVALID_RESPONSE');
			acceptedHeroTask = heroTask;
			await jobs.doc(candidate._id).update({
				cutoutStatus: 'PROCESSING',
				cutoutEngine: HERO_CHARACTER_VERSION,
				cutoutProviderJobId: heroTask.taskId,
				heroGenerationStatus: normalizeStatus(heroTask.taskStatus),
				heroGenerationVersion: HERO_CHARACTER_VERSION,
				heroGenerationPhase: 'PROVIDER_ACCEPTED',
				heroGenerationRequestId: heroTask.requestId || '',
				updatedAt: Date.now()
			});
			const latest = (await jobs.doc(candidate._id).get()).data[0];
			return buildAvatarAssetResponse(latest, selectedJobId);
		}
		let derivativeUpdate = {};
		if (needsDisplayDerivative) {
			derivativeUpdate = { displayDerivativeStatus: 'FAILED' };
			try {
				const derived = await persistDisplayDerivatives(petHash, selectedJobId, candidate.finalFileId);
				derivativeUpdate = {
				displayDerivativeStatus: 'SUCCEEDED',
				displayFileId: derived.displayFileId,
				thumbnailFileId: derived.thumbnailFileId,
				featheredDisplayFileId: derived.featheredDisplayFileId,
				localCutoutFileId: derived.localCutoutFileId || '',
				localCutoutAlphaValid: derived.localCutoutAlphaValid === true,
				localCutoutMetrics: replaceDatabaseObject(derived.localCutoutMetrics),
				displayDimensions: replaceDatabaseObject(derived.dimensions)
				};
				if (config.isDevelopment) console.info('pet_avatar_display_derivatives', {
				petHash,
				jobIdHash: hash(selectedJobId).slice(0, 12),
				localCutoutReady: Boolean(derived.localCutoutFileId),
				backgroundConfidence: derived.localCutoutMetrics && derived.localCutoutMetrics.backgroundConfidence || 0,
				transparentPixelRatio: derived.localCutoutMetrics && derived.localCutoutMetrics.transparentPixelRatio || 0,
				outputBytes: derived.localCutoutMetrics && derived.localCutoutMetrics.outputBytes || 0,
				cutoutShaPrefix: derived.localCutoutMetrics && derived.localCutoutMetrics.cutoutShaPrefix || '',
				localCutoutReason: derived.localCutoutMetrics && derived.localCutoutMetrics.reason || '',
				displayWidth: derived.dimensions.displayWidth,
				thumbnailWidth: derived.dimensions.thumbnailWidth
				});
			} catch (derivativeError) {
				console.warn('pet_avatar_display_derivative_failed', { petHash, jobIdHash: hash(selectedJobId).slice(0, 12), errorCode: derivativeError && derivativeError.code || 'DISPLAY_DERIVATIVE_FAILED' });
			}
		}
		if (Object.keys(derivativeUpdate).length) await jobs.doc(candidate._id).update({ ...derivativeUpdate, updatedAt: Date.now() });
		if (!semanticCutoutAvailable) {
			if (!config.heroChromaEnabled) {
				// No semantic or chroma provider is enabled. Preserve the master and
				// stop cleanly without attempting any paid generation.
				await jobs.doc(candidate._id).update({ cutoutStatus: 'NOT_CONFIGURED', heroGenerationStatus: 'NOT_CONFIGURED', updatedAt: Date.now() });
				const latest = (await jobs.doc(candidate._id).get()).data[0];
				return buildAvatarAssetResponse(latest, selectedJobId);
			}
			// Hero-enabled requests must have returned from the guarded branch above.
			throw codedError('HERO_PIPELINE_STATE_INVALID');
		}
		await jobs.doc(candidate._id).update({ cutoutEngine: 'aliyun-viapi', updatedAt: Date.now() });
		const [finalTempUrl] = await getTempUrls([candidate.finalFileId]);
		await require('pety-auth/cost-budget').reserve({ uid: identity.uid, feature: 'cutout' });
		const submitted = await submitTransparentCutout(config, finalTempUrl);
		if (submitted.status === 'NOT_CONFIGURED') {
			await jobs.doc(candidate._id).update({ cutoutStatus: 'NOT_CONFIGURED', updatedAt: Date.now() });
			const latest = (await jobs.doc(candidate._id).get()).data[0];
			return buildAvatarAssetResponse(latest, selectedJobId);
		}
		if (submitted.status === 'SUCCEEDED' && submitted.resultUrl) {
			const persisted = await persistCutoutImage(petHash, selectedJobId, submitted.resultUrl);
			if (config.isDevelopment) console.info('pet_avatar_cutout_alpha', {
				petHash,
				jobIdHash: hash(selectedJobId).slice(0, 12),
				cutoutAlphaValid: true,
				width: persisted.alphaInspection.width,
				height: persisted.alphaInspection.height,
				transparentPixelRatio: persisted.alphaInspection.transparentPixelRatio
			});
			await jobs.doc(candidate._id).update({
				cutoutStatus: 'SUCCEEDED',
				cutoutFileId: persisted.cutoutFileId,
				cutoutAlphaValid: true,
				cutoutAlphaMetrics: replaceDatabaseObject(persisted.alphaInspection),
				cutoutProviderJobId: submitted.providerJobId || '',
				cutoutCompletedAt: Date.now(),
				updatedAt: Date.now()
			});
			const latest = (await jobs.doc(candidate._id).get()).data[0];
			return buildAvatarAssetResponse(latest, selectedJobId);
		}
		await jobs.doc(candidate._id).update({
			cutoutStatus: 'PROCESSING',
			cutoutProviderJobId: submitted.providerJobId,
			updatedAt: Date.now()
		});
		const latest = (await jobs.doc(candidate._id).get()).data[0];
		return buildAvatarAssetResponse(latest, selectedJobId);
	} catch (error) {
		if (acceptedHeroTask) {
			// Wan has already accepted (and may bill) this request. Retain its receipt
			// after a database hiccup rather than reporting an unsubmitted failure.
			const receipt = { cutoutProviderJobId: acceptedHeroTask.taskId, cutoutStatus: 'PROCESSING',
				cutoutEngine: HERO_CHARACTER_VERSION, heroGenerationStatus: 'RUNNING',
				heroGenerationRequestId: acceptedHeroTask.requestId || '', heroGenerationPhase: 'PROVIDER_ACCEPTED', updatedAt: Date.now() };
			try { await jobs.doc(candidate._id).update(receipt); }
			catch (receiptError) {
				console.error('pet_avatar_accepted_receipt_write_failed', { jobId: selectedJobId, taskId: acceptedHeroTask.taskId, requestId: acceptedHeroTask.requestId });
				throw codedError('HERO_RECEIPT_WRITE_FAILED');
			}
			return buildAvatarAssetResponse({ ...candidate, ...receipt }, selectedJobId);
		}
		const errorCode = normalizePipelineError(error, useHeroGeneration ? 'HERO_GENERATION_FAILED' : 'CUTOUT_FAILED');
		await jobs.doc(candidate._id).update({
			cutoutStatus: 'FAILED',
			cutoutAlphaValid: false,
			cutoutErrorCode: errorCode,
			...(useHeroGeneration ? { heroGenerationStatus: 'FAILED', heroGenerationPhase: 'SUBMISSION_FAILED', heroGenerationVersion: HERO_CHARACTER_VERSION, heroGenerationErrorCode: errorCode } : {}),
			updatedAt: Date.now()
		}).catch(() => {});
		if (config.isDevelopment) console.info('pet_avatar_cutout_alpha', {
			petHash,
			jobIdHash: hash(selectedJobId).slice(0, 12),
			cutoutAlphaValid: false,
			errorCode
		});
		console.warn('pet_avatar_cutout_failed', { jobIdHash: hash(selectedJobId).slice(0, 12), phase: useHeroGeneration ? 'SUBMISSION_FAILED' : 'CUTOUT_FAILED', errorCode, statusCode: Number(error && error.statusCode) || 0, providerCode: String(error && error.providerCode || '').slice(0, 80) });
		const latest = (await jobs.doc(candidate._id).get()).data[0];
		return buildAvatarAssetResponse(latest, selectedJobId);
	}
}

async function processHeroGeneration(candidate, config) {
	const petHash = candidate.petHash;
	const selectedJobId = candidate.jobId;
	const providerResult = await getWanTask(config, candidate.cutoutProviderJobId);
	const providerStatus = normalizeStatus(providerResult && providerResult.output && providerResult.output.task_status);
	if (['PENDING', 'RUNNING', 'UNKNOWN'].includes(providerStatus)) {
		if (candidate.heroGenerationStatus !== providerStatus) await jobs.doc(candidate._id).update({ heroGenerationStatus: providerStatus, heroGenerationPhase: 'POLLING_PROVIDER', updatedAt: Date.now() });
		return buildAvatarAssetResponse({ ...candidate, heroGenerationStatus: providerStatus, heroGenerationPhase: 'POLLING_PROVIDER' }, selectedJobId);
	}
	if (providerStatus !== 'SUCCEEDED') {
		const errorCode = getWanFailureCode(providerResult);
		await jobs.doc(candidate._id).update({ cutoutStatus: 'FAILED', heroGenerationStatus: 'FAILED', heroGenerationPhase: 'PROVIDER_FAILED', heroGenerationErrorCode: errorCode, cutoutErrorCode: errorCode, updatedAt: Date.now() });
		const latest = (await jobs.doc(candidate._id).get()).data[0];
		return buildAvatarAssetResponse(latest, selectedJobId);
	}
	const resultUrl = extractResultImageUrl(providerResult);
	if (!resultUrl) throw codedError('WAN_RESULT_MISSING');
	await jobs.doc(candidate._id).update({ heroGenerationPhase: 'BUILDING_ALPHA', updatedAt: Date.now() });
	const persisted = await persistChromaHeroImage(petHash, selectedJobId, resultUrl);
	await jobs.doc(candidate._id).update({
		cutoutStatus: 'SUCCEEDED',
		heroGenerationStatus: 'SUCCEEDED',
		heroGenerationPhase: 'COMPLETE',
		heroPollFailureCount: 0,
		heroGenerationErrorCode: '',
		cutoutErrorCode: '',
		heroFileId: persisted.heroFileId,
		heroMetrics: replaceDatabaseObject({ ...persisted.heroMetrics, sourceFileId: candidate.finalFileId, derivedFromFileId: candidate.finalFileId }),
		heroDisplayPreparedFor: candidate.finalFileId,
		heroAssetVersion: 3,
		cutoutCompletedAt: Date.now(),
		updatedAt: Date.now()
	});
	const latest = (await jobs.doc(candidate._id).get()).data[0];
	return buildAvatarAssetResponse(latest, selectedJobId);
}

async function getAvatarCutoutStatus(event, config, context) {
	const petId = normalizePetId(event.petId);
	const petHash = hash(petId).slice(0, 24);
	const selectedJobId = String(event.selectedJobId || '').trim();
	let { candidate } = await getOwnedCandidate(petHash, selectedJobId, context);
	if (!candidate || !candidate.confirmed || !candidate.finalFileId) throw codedError('JOB_OWNER_MISMATCH');
	candidate = await validateStoredCutoutAssets(candidate);
	if (candidate.cutoutStatus === 'PENDING') return { ...(await buildAvatarAssetResponse(candidate, selectedJobId)), processRequired: true };
	if (candidate.cutoutStatus === 'SUCCEEDED' && (candidate.cutoutFileId || candidate.heroFileId)) {
		return buildAvatarAssetResponse(candidate, selectedJobId);
	}
	if (['PROCESSING', 'RUNNING'].includes(candidate.cutoutStatus) && !candidate.cutoutProviderJobId &&
		Date.now() - Number(candidate.cutoutStartedAt || candidate.updatedAt) > 180000) {
		// Submission outcome may be unknown. Do not incur a second bill by retrying.
		const patch = { cutoutStatus: 'FAILED', cutoutErrorCode: 'HERO_SUBMISSION_RECEIPT_MISSING',
			heroGenerationStatus: 'FAILED', heroGenerationPhase: 'SUBMISSION_UNKNOWN',
			heroGenerationErrorCode: 'HERO_SUBMISSION_RECEIPT_MISSING', updatedAt: Date.now() };
		await jobs.doc(candidate._id).update(patch);
		return buildAvatarAssetResponse({ ...candidate, ...patch }, selectedJobId);
	}
	if (!['PROCESSING', 'RUNNING'].includes(candidate.cutoutStatus) || !candidate.cutoutProviderJobId) {
		return buildAvatarAssetResponse(candidate, selectedJobId);
	}
	try {
		if (isHeroGenerationCandidate(candidate)) {
			return await processHeroGeneration(candidate, config);
		}
		const providerResult = await getTransparentCutoutStatus(config, candidate.cutoutProviderJobId);
		if (providerResult.status === 'NOT_CONFIGURED') {
			await jobs.doc(candidate._id).update({ cutoutStatus: 'NOT_CONFIGURED', updatedAt: Date.now() });
			const latest = (await jobs.doc(candidate._id).get()).data[0];
			return buildAvatarAssetResponse(latest, selectedJobId);
		}
		if (providerResult.status === 'RUNNING') return buildAvatarAssetResponse(candidate, selectedJobId);
		if (providerResult.status === 'FAILED') {
			await jobs.doc(candidate._id).update({ cutoutStatus: 'FAILED', cutoutAlphaValid: false, cutoutErrorCode: 'CUTOUT_PROVIDER_FAILED', updatedAt: Date.now() });
			const latest = (await jobs.doc(candidate._id).get()).data[0];
			return buildAvatarAssetResponse(latest, selectedJobId);
		}
		if (providerResult.status === 'SUCCEEDED' && providerResult.resultUrl) {
			const persisted = await persistCutoutImage(petHash, selectedJobId, providerResult.resultUrl);
			if (config.isDevelopment) console.info('pet_avatar_cutout_alpha', {
				petHash,
				jobIdHash: hash(selectedJobId).slice(0, 12),
				cutoutAlphaValid: true,
				width: persisted.alphaInspection.width,
				height: persisted.alphaInspection.height,
				transparentPixelRatio: persisted.alphaInspection.transparentPixelRatio
			});
			await jobs.doc(candidate._id).update({
				cutoutStatus: 'SUCCEEDED',
				cutoutFileId: persisted.cutoutFileId,
				cutoutAlphaValid: true,
				cutoutAlphaMetrics: replaceDatabaseObject(persisted.alphaInspection),
				cutoutCompletedAt: Date.now(),
				updatedAt: Date.now()
			});
			const latest = (await jobs.doc(candidate._id).get()).data[0];
			return buildAvatarAssetResponse(latest, selectedJobId);
		}
		return buildAvatarAssetResponse(candidate, selectedJobId);
	} catch (error) {
		const heroGeneration = isHeroGenerationCandidate(candidate);
		const errorCode = normalizePipelineError(error, heroGeneration ? 'HERO_GENERATION_FAILED' : 'CUTOUT_FAILED');
		const pollFailureCount = Number(candidate.heroPollFailureCount || 0) + 1;
		const retrySameTask = Boolean(candidate.cutoutProviderJobId && pollFailureCount < 4 && isRetryableHeroError(error));
		await jobs.doc(candidate._id).update({
			cutoutStatus: retrySameTask ? 'PROCESSING' : 'FAILED',
			heroPollFailureCount: pollFailureCount,
			cutoutAlphaValid: false,
			cutoutErrorCode: errorCode,
			...(heroGeneration ? { heroGenerationStatus: retrySameTask ? 'RUNNING' : 'FAILED', heroGenerationPhase: retrySameTask ? 'RETRYING_EXISTING_TASK' : 'ALPHA_BUILD_FAILED', heroGenerationErrorCode: errorCode } : {}),
			updatedAt: Date.now()
		}).catch(() => {});
		if (config.isDevelopment) console.info('pet_avatar_cutout_alpha', {
			petHash,
			jobIdHash: hash(selectedJobId).slice(0, 12),
			cutoutAlphaValid: false,
			errorCode
		});
		const latest = (await jobs.doc(candidate._id).get()).data[0];
		return buildAvatarAssetResponse(latest, selectedJobId);
	}
}

function isRetryableHeroError(error) {
	const status = Number(error && error.statusCode);
	const code = String(error && (error.code || error.message) || '');
	return status === 429 || status >= 500 || /TIMEOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|ETIMEDOUT|SOCKET|DOWNLOAD_FAILED|UPLOAD_FAILED/i.test(code);
}

async function retryAvatarCleanup(event, context) {
	const petId = normalizePetId(event.petId);
	const petHash = hash(petId).slice(0, 24);
	const selectedJobId = String(event.selectedJobId || '').trim();
	const { identity, candidate } = await getOwnedCandidate(petHash, selectedJobId, context);
	if (!candidate || !candidate.confirmed || !candidate.finalFileId) throw codedError('JOB_OWNER_MISMATCH');
	try {
		const result = await cleanupConfirmedSession(candidate, identity);
		return { code: 0, selectedJobId, cleanupPending: false, ...result };
	} catch (error) {
		await jobs.doc(candidate._id).update({ cleanupPending: true, updatedAt: Date.now() }).catch(() => {});
		return { code: 0, selectedJobId, cleanupPending: true };
	}
}

async function getGenerationSession(event, context) {
	assertConsent(event);
	const petId = normalizePetId(event.petId);
	const petHash = hash(petId).slice(0, 24);
	const generationSessionId = String(event.generationSessionId || '').trim();
	if (!generationSessionId) throw codedError('INVALID_GENERATION_SESSION');
	const identity = getQuotaIdentity(context);
	const sessionResult = await jobs.where({
		recordType: 'candidate',
		petHash,
		generationSessionId,
		quotaOwnerHash: identity.quotaOwnerHash
	}).get();
	const records = readAvatarRows(sessionResult);
	const active = await getJobDocument(petHash, identity.quotaOwnerHash);
	const activeJob = active && active.quotaOwnerHash === identity.quotaOwnerHash && active.generationSessionId === generationSessionId &&
		['CREATING', 'PENDING', 'RUNNING'].includes(active.status)
		? buildActiveAvatarJobResponse(active)
		: null;
	const succeeded = records.filter(item => item.status === 'SUCCEEDED' && item.generatedFileId && item.candidateStatus !== 'discarded');
	const sessionFileIds = [];
	succeeded.forEach(item => {
		sessionFileIds.push(item.generatedFileId);
		if (item.generatedThumbnailFileId) sessionFileIds.push(item.generatedThumbnailFileId);
	});
	const tempUrls = sessionFileIds.length ? await getTempUrls(sessionFileIds) : [];
	const tempUrlByFileId = {};
	sessionFileIds.forEach((fileId, index) => { tempUrlByFileId[fileId] = tempUrls[index] || ''; });
	return {
		code: 0,
		activeJob,
		candidates: succeeded.map(item => ({
			jobId: item.jobId,
			jobKind: item.jobKind,
			parentJobId: item.parentJobId || '',
			generatedFileId: item.generatedFileId,
			generatedTempUrl: tempUrlByFileId[item.generatedFileId] || '',
			generatedThumbnailFileId: item.generatedThumbnailFileId || '',
			generatedThumbnailUrl: tempUrlByFileId[item.generatedThumbnailFileId] || '',
			mainAssetMetadata: item.mainAssetMetadata || null,
			seed: item.seed,
			createdAt: item.createdAt,
			confirmed: item.confirmed === true
		}))
	};
}

exports.__test = {
	issueSourceUpload,
	completeSourceUpload,
	createJob,
	getJobStatus,
	getJobDocument,
	getAvatarJobLockId,
	updateActiveAvatarJob,
	authorizeAvatarContext,
	getCandidateDisplayUrls,
	getAvatarDisplayUrls,
	getAvatarCutoutStatus,
	isRetryableHeroError,
	processHeroGeneration,
	prepareHeroDisplay,
	startAvatarCutout,
	backfillTightCutouts,
	CONSENT_VERSION,
	DEFAULT_CONFIG,
	acquireAvatarJobLock,
	buildActiveAvatarJobResponse,
	recoverActiveAvatarJob,
	assertConsent,
	buildCleanupPlan,
	buildOrderedFileIds,
	cleanupConfirmedSession,
	evaluateEntitlement,
	isQuotaConsumingJob,
	getDevMemberBypassDecision,
	createSeed,
	isTemporarySourceFile,
	normalizeJobKind,
	normalizeRevisionBBox,
	normalizeSeed,
	normalizeSessionId,
	normalizeStatus,
	resolveRevisionSource,
	resolveDevMemberBypassConfig,
	getAvatarActionConfigCheck,
	getWanFailureDetails,
	getWanRequestFailureDetails,
	safeResponseError,
	validateWanConfig,
	validateViapiConfig,
	validateConfig,
	getHealthCheck
};

exports.main = async (event, context) => {
	let config = null;
	let diagnosticsAllowed = false;
	try {
		const action = String(event && event.action || '');
		if (action === 'healthCheck') return getHealthCheck();
		const actions = ['createJob', 'getJobStatus', 'getEntitlement', 'confirmAvatar', 'startAvatarCutout',
			'getAvatarCutoutStatus', 'getOwnedMediaUrls', 'getAvatarDisplayUrls', 'getCandidateDisplayUrls', 'prepareHeroDisplay',
			'retryAvatarCleanup', 'getGenerationSession', 'submitAvatarFeedback', 'issueSourceUpload', 'completeSourceUpload'];
		if (!actions.includes(action)) return { code: 1, errorCode: 'UNSUPPORTED_ACTION', message: '不支持的形象生成操作' };
		context = await authorizeAvatarContext(event, context);
		const admittedIdentity=getQuotaIdentity(context);await require('pety-auth/sessions').admit(admittedIdentity.uid,admittedIdentity.session);
		config = loadConfig();
		diagnosticsAllowed = Boolean(config.isDevelopment && config.devMemberBypassUids.includes(admittedIdentity.uid));
		if (config.isDevelopment) console.info('avatar_action_config_check', getAvatarActionConfigCheck(action, config));
		if (action === 'issueSourceUpload') return await issueSourceUpload(event,config,context);
		if (action === 'completeSourceUpload') return await completeSourceUpload(event,context);
		if (action === 'createJob') return await createJob(event, config, context);
		if (action === 'getJobStatus') return await getJobStatus(event, config, context);
		if (action === 'getEntitlement') return await getEntitlement(event, context, config);
		if (action === 'confirmAvatar') return await confirmAvatar(event, config, context);
		if (action === 'startAvatarCutout') return await startAvatarCutout(event, config, context);
		if (action === 'getAvatarCutoutStatus') return await getAvatarCutoutStatus(event, config, context);
		if (action === 'getOwnedMediaUrls') return await getOwnedMediaUrls(event, context);
		if (action === 'getAvatarDisplayUrls') return await getAvatarDisplayUrls(event, context);
		if (action === 'getCandidateDisplayUrls') return await getCandidateDisplayUrls(event, context);
		if (action === 'prepareHeroDisplay') return await prepareHeroDisplay(event, config, context);
		if (action === 'retryAvatarCleanup') return await retryAvatarCleanup(event, context);
		if (action === 'getGenerationSession') return await getGenerationSession(event, context);
		if (action === 'submitAvatarFeedback') return await submitAvatarFeedback(event, context);
		return { code: 1, errorCode: 'UNSUPPORTED_ACTION', message: '不支持的形象生成操作' };
	} catch (error) {
		console.error('pet_avatar_request_failed', {
			errorCode: error && error.code ? error.code : 'AVATAR_REQUEST_FAILED',
			statusCode: error && error.statusCode ? error.statusCode : 0
		});
		if(String(error?.errCode||'').startsWith('pety-session-'))return{code:403,...require('pety-auth').authErrorResult(error),errorCode:error.errCode};
		return safeResponseError(error, diagnosticsAllowed);
	}
};
