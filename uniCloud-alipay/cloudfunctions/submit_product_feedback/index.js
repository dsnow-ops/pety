'use strict';

const crypto = require('crypto');

const FEEDBACK_COLLECTION = 'product_feedback';
const RATE_LIMIT_COLLECTION = 'product_feedback_rate_limits';
const MAX_IMAGES = 3;
const MAX_TITLE_LENGTH = 60;
const MIN_CONTENT_LENGTH = 10;
const MAX_CONTENT_LENGTH = 1000;
const HOUR_LIMIT = 5;
const DAY_LIMIT = 15;
const CHINA_TIME_OFFSET_MS = 8 * 60 * 60 * 1000;
const CATEGORIES = new Set([
  'product_suggestion',
  'feature_request',
  'ui_experience',
  'ai_conversation',
  'bug',
  'emotional_experience',
  'privacy_security',
  'other'
]);

class FeedbackError extends Error {
  constructor(errorCode, message, code = 400) {
    super(message);
    this.name = 'FeedbackError';
    this.errorCode = errorCode;
    this.code = code;
  }
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function firstString(values) {
  return values.find(value => typeof value === 'string' && value.trim()) || '';
}

function normalizeText(value, maxLength) {
  return String(value || '').replace(/\r\n/g, '\n').trim().slice(0, maxLength);
}

function getCloudIdentity(context = {}) {
  let currentUserInfo = {};
  try {
    currentUserInfo = typeof uniCloud.getCurrentUserInfo === 'function'
      ? (uniCloud.getCurrentUserInfo() || {})
      : {};
  } catch (error) {
    currentUserInfo = {};
  }

  const userId = firstString([context.UID]);
  const openid = firstString([
    currentUserInfo.openid,
    context.OPENID,
    context.openid,
    context.ALIPAY_OPENID,
    context.alipayOpenid
  ]);
  const rawDeviceIdentity = firstString([
    context.DEVICEID,
    context.deviceId,
    context.device_id,
    currentUserInfo.deviceId
  ]);
  const clientIp = firstString([
    context.CLIENTIP,
    context.clientIP,
    context.clientIp
  ]);
  const clientPlatform = firstString([
    context.PLATFORM,
    context.platform,
    context.OS,
    context.os
  ]);
  // This helper receives UID only after official token verification. Device
  // identifiers and ambient claims are not credentials or a rate-limit key.
  if (!clientIp) throw new FeedbackError('FEEDBACK_NETWORK_UNAVAILABLE', '暂时无法核实请求来源，请稍后重试', 503);
  const identitySource = userId ? `user:${userId}` : `guest:${clientIp}`;

  return {
    userId,
    openid: '',
    networkHash: sha256(`network:${clientIp}`),
    deviceHash: sha256(identitySource)
  };
}

function validateImageFileIds(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > MAX_IMAGES) {
    throw new FeedbackError('FEEDBACK_INVALID_IMAGES', '最多提交 3 张图片');
  }

  const fileIds = Array.from(new Set(value.map(item => String(item || '').trim()).filter(Boolean)));
  if (fileIds.length > MAX_IMAGES) {
    throw new FeedbackError('FEEDBACK_INVALID_IMAGES', '最多提交 3 张图片');
  }

  fileIds.forEach(fileId => {
    const hasAllowedProtocol = /^(cloud|unicloud):\/\//.test(fileId) || /^https:\/\//.test(fileId);
    if (
      !hasAllowedProtocol ||
      !fileId.includes('product-feedback/') ||
      fileId.length > 1024 ||
      /[\r\n\0]/.test(fileId)
    ) {
      throw new FeedbackError('FEEDBACK_INVALID_IMAGES', '图片引用无效');
    }
  });
  return fileIds;
}

function validatePayload(event = {}) {
  const category = normalizeText(event.category, 40);
  const title = normalizeText(event.title, MAX_TITLE_LENGTH + 1);
  const content = normalizeText(event.content, MAX_CONTENT_LENGTH + 1);
  const imageFileIds = validateImageFileIds(event.imageFileIds);

  if (!CATEGORIES.has(category)) {
    throw new FeedbackError('FEEDBACK_INVALID_CATEGORY', '请选择有效的留言分类');
  }
  if (title.length > MAX_TITLE_LENGTH) {
    throw new FeedbackError('FEEDBACK_INVALID_TITLE', '标题不能超过 60 字');
  }
  if (content.length < MIN_CONTENT_LENGTH || content.length > MAX_CONTENT_LENGTH) {
    throw new FeedbackError('FEEDBACK_INVALID_CONTENT', '留言内容需要在 10 到 1000 字之间');
  }

  return {
    category,
    title,
    content,
    imageFileIds,
    includeDiagnostics: event.includeDiagnostics === true,
    diagnostics: event.includeDiagnostics === true && event.diagnostics && typeof event.diagnostics === 'object'
      ? event.diagnostics
      : {}
  };
}

function sanitizeDiagnostics(diagnostics = {}) {
  return {
    appVersion: normalizeText(diagnostics.appVersion, 40),
    platform: normalizeText(diagnostics.platform, 40),
    systemVersion: normalizeText(diagnostics.systemVersion, 120),
    uniPlatform: normalizeText(diagnostics.uniPlatform, 40),
    currentPage: normalizeText(diagnostics.currentPage, 160),
    isLoggedIn: diagnostics.isLoggedIn === true,
    isGuest: diagnostics.isGuest === true
  };
}

function getChinaPeriodKeys(now) {
  const date = new Date(now + CHINA_TIME_OFFSET_MS);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hour = String(date.getUTCHours()).padStart(2, '0');
  return {
    day: `${year}-${month}-${day}`,
    hour: `${year}-${month}-${day}-${hour}`
  };
}

function hasDatabaseError(result) {
  return !result || typeof result !== 'object' || Array.isArray(result) || Boolean(result.errCode || result.code);
}

function getAffectedCount(result) {
  if (hasDatabaseError(result)) throw new Error('FEEDBACK_RATE_RESPONSE_INVALID');
  const key = ['updated', 'affectedDocs', 'modifiedCount'].find(key => result[key] !== undefined);
  const count = key ? result[key] : undefined;
  if (!Number.isSafeInteger(count) || count < 0 || count > 1) throw new Error('FEEDBACK_RATE_RESPONSE_INVALID');
  return count;
}

function isDuplicateKeyError(error) {
  const message = String(error && (error.errCode || error.code || error.message) || '').toLowerCase();
  return message.includes('duplicate') || message.includes('e11000');
}

async function getDocument(collection, documentId) {
  const result = await collection.doc(documentId).get();
  if (hasDatabaseError(result) || !Array.isArray(result.data) || result.data.length > 1 ||
    result.data.some(row => !row || typeof row !== 'object' || Array.isArray(row))) {
    throw new Error('FEEDBACK_READ_RESPONSE_INVALID');
  }
  return result.data[0] || null;
}

function receivedResult(record, documentId, identityHash, fingerprint, replayed) {
  if (!record || record._id !== documentId || record.deviceHash !== identityHash ||
    record.requestFingerprint !== fingerprint || record.status !== 'submitted' ||
    !Number.isFinite(record.createdAt) || record.createdAt <= 0) {
    throw new Error('FEEDBACK_RECEIPT_UNCONFIRMED');
  }
  return { code: 0, message: 'received', submittedAt: record.createdAt, replayed };
}

async function consumeRateWindow(db, {
  identityHash,
  scope,
  period,
  limit,
  now
}) {
  const collection = db.collection(RATE_LIMIT_COLLECTION);
  const documentId = sha256(`${scope}:${period}:${identityHash}`);
  const command = db.command;

  const updateResult = await collection.where({
    _id: documentId,
    count: command.lt(limit)
  }).update({
    count: command.inc(1),
    updatedAt: now
  });
  if (getAffectedCount(updateResult) > 0) return true;

  const existing = await getDocument(collection, documentId);
  if (existing) {
    if (!Number.isSafeInteger(existing.count) || existing.count < 0) throw new Error('FEEDBACK_RATE_RECORD_INVALID');
    if (existing.count >= limit) return false;
    // Another request may have created the window after our first update.
    // Still use the conditional increment so parallel callers cannot overrun it.
    const retryResult = await collection.where({ _id: documentId, count: command.lt(limit) })
      .update({ count: command.inc(1), updatedAt: now });
    return getAffectedCount(retryResult) > 0;
  }

  try {
    const receipt = await collection.add({
      _id: documentId,
      identityHash,
      scope,
      period,
      count: 1,
      limit,
      createdAt: now,
      updatedAt: now
    });
    if (hasDatabaseError(receipt) || receipt.id !== documentId) throw new Error('FEEDBACK_RATE_WRITE_UNCONFIRMED');
    return true;
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;

    const retryResult = await collection.where({
      _id: documentId,
      count: command.lt(limit)
    }).update({
      count: command.inc(1),
      updatedAt: now
    });
    return getAffectedCount(retryResult) > 0;
  }
}

async function enforceRateLimit(db, deviceHash, now) {
  const periods = getChinaPeriodKeys(now);
  const hourAllowed = await consumeRateWindow(db, {
    identityHash: deviceHash,
    scope: 'hour',
    period: periods.hour,
    limit: HOUR_LIMIT,
    now
  });
  if (!hourAllowed) {
    throw new FeedbackError(
      'FEEDBACK_RATE_LIMIT_HOUR',
      '这一小时留言有点多，请稍后再试',
      429
    );
  }

  const dayAllowed = await consumeRateWindow(db, {
    identityHash: deviceHash,
    scope: 'day',
    period: periods.day,
    limit: DAY_LIMIT,
    now
  });
  if (!dayAllowed) {
    throw new FeedbackError(
      'FEEDBACK_RATE_LIMIT_DAY',
      '今天的留言已达到上限，请明天再来',
      429
    );
  }
  return periods;
}

function createFailureResult(error) {
  if (String(error?.errCode || '').startsWith('uni-id-') || String(error?.errCode || '').startsWith('pety-session-')) return { code: 403, ...require('pety-auth').authErrorResult(error) };
  if (String(error?.code || '').startsWith('FEEDBACK_')) return { code: 400, errorCode: error.code, message: error.code === 'FEEDBACK_IMAGE_LOGIN_REQUIRED' ? '请先登录后附带图片，文字留言仍可提交' : '图片需要重新安全上传，请重试' };
  if (error instanceof FeedbackError) {
    return {
      code: error.code,
      errorCode: error.errorCode,
      message: error.message
    };
  }
  return {
    code: 503,
    errorCode: 'FEEDBACK_SUBMIT_UNCONFIRMED',
    message: '暂时无法确认留言是否送达，请保留内容并重试'
  };
}

exports.main = async (event, context) => {
  try {
    const action = event?.action || 'submit';
    if (!['submit', 'issueImageUpload', 'completeImageUpload'].includes(action)) throw new FeedbackError('FEEDBACK_UNSUPPORTED_ACTION', '不支持的操作');
    const authService = require('pety-auth');
    let auth;
    try { auth = await authService.verifyRequest(event || {}, context || {}); }
    catch (error) {
      const result = authService.authErrorResult(error);
      const unavailable = ['pety-auth-service-unavailable', 'pety-session-service-unavailable'].includes(result.errCode);
      return { code: unavailable ? 503 : 403, ...result };
    }
    if (event?.uniIdToken && !auth.uid) throw new FeedbackError('FEEDBACK_AUTH_REQUIRED', '请重新登录后提交', 403);
    const identity = getCloudIdentity({ CLIENTIP: context?.CLIENTIP || context?.clientIP, UID: auth.uid });
    const db = uniCloud.database();
    if (action !== 'submit') {
      if (!auth.uid) throw new FeedbackError('FEEDBACK_IMAGE_LOGIN_REQUIRED', '请先登录后附带图片，文字留言仍可提交', 403);
      const now = Date.now(), periods = getChinaPeriodKeys(now);
      for (const [identityHash, scope, period, limit] of [[identity.deviceHash,'media-hour',periods.hour,20],[identity.networkHash,'media-network-hour',periods.hour,60],['global','media-global-day',periods.day,300]]) {
        if (!(await consumeRateWindow(db,{identityHash,scope,period,limit,now}))) throw new FeedbackError('FEEDBACK_RATE_LIMIT_HOUR', '图片提交较多，请稍后再试', 429);
      }
      const media = require('pety-auth/feedback-media').service(db, context);
      const result = action === 'issueImageUpload' ? await media.issue(auth.uid,event.extension) : await media.complete(auth.uid,event.ticketId,event.fileId);
      return { code: 0, ...result };
    }
    const payload = validatePayload(event);
    const now = Date.now();
    const periods = getChinaPeriodKeys(now);
    const requestFingerprint = sha256(JSON.stringify({
      category: payload.category,
      title: payload.title,
      content: payload.content,
      imageFileIds: payload.imageFileIds.slice().sort()
    }));
    const documentId = sha256(`${identity.deviceHash}:${periods.day}:${requestFingerprint}`);
    const feedbackCollection = db.collection(FEEDBACK_COLLECTION);
    const duplicate = await getDocument(feedbackCollection, documentId);
    if (duplicate) return receivedResult(duplicate, documentId, identity.deviceHash, requestFingerprint, true);
    if (payload.imageFileIds.length) await require('pety-auth/feedback-media').service(db, context).validate(auth.uid,payload.imageFileIds);

    await enforceRateLimit(db, identity.deviceHash, now);
    if (identity.userId) await enforceRateLimit(db, identity.networkHash, now);
    for (const [scope, period, limit] of [['global-hour', periods.hour, 100], ['global-day', periods.day, 1000]]) {
      if (!(await consumeRateWindow(db, { identityHash: 'global', scope, period, limit, now }))) throw new FeedbackError('FEEDBACK_RATE_LIMIT_GLOBAL', '留言较多，请稍后重试', 429);
    }

    const record = {
      _id: documentId,
      id: documentId,
      category: payload.category,
      title: payload.title,
      content: payload.content,
      imageFileIds: payload.imageFileIds,
      userId: identity.userId,
      openid: identity.openid,
      deviceHash: identity.deviceHash,
      includeDiagnostics: payload.includeDiagnostics,
      status: 'submitted',
      requestFingerprint,
      createdAt: now,
      updatedAt: now
    };

    if (payload.includeDiagnostics) {
      Object.assign(record, sanitizeDiagnostics(payload.diagnostics));
    }

    try {
      const receipt = await feedbackCollection.add(record);
      if (hasDatabaseError(receipt) || receipt.id !== documentId) throw new Error('FEEDBACK_WRITE_UNCONFIRMED');
    } catch (error) {
      // A write can commit before its acknowledgement is lost. Read once to
      // confirm this exact receipt; never repeat the write or infer success
      // from an error string (including a duplicate-key message).
      const persisted = await getDocument(feedbackCollection, documentId);
      if (persisted) return receivedResult(persisted, documentId, identity.deviceHash, requestFingerprint, true);
      throw error;
    }

    return receivedResult(record, documentId, identity.deviceHash, requestFingerprint, false);
  } catch (error) {
    const result = createFailureResult(error);
    console.error('product_feedback_submit_failed', {
      errorCode: result.errorCode,
      code: result.code
    });
    return result;
  }
};
