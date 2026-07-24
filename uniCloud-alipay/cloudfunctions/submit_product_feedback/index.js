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

  const userId = firstString([
    currentUserInfo.uid,
    currentUserInfo.userId,
    context.UID,
    context.uid,
    context.USERID,
    context.userId
  ]);
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
  const identitySource = rawDeviceIdentity
    ? `device:${rawDeviceIdentity}`
    : (openid
      ? `openid:${openid}`
      : (userId
        ? `user:${userId}`
        : `guest:${clientIp || 'unknown'}:${clientPlatform || 'unknown'}`));

  return {
    userId,
    openid,
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

function getAffectedCount(result = {}) {
  return Number(
    result.updated ||
    result.affectedDocs ||
    result.modifiedCount ||
    0
  );
}

function isDuplicateKeyError(error) {
  const message = String(error && (error.errCode || error.code || error.message) || '').toLowerCase();
  return message.includes('duplicate') || message.includes('e11000') || message.includes('_id');
}

async function getDocument(collection, documentId) {
  try {
    const result = await collection.doc(documentId).get();
    return result && Array.isArray(result.data) ? (result.data[0] || null) : null;
  } catch (error) {
    const message = String(error && (error.errCode || error.code || error.message) || '').toLowerCase();
    if (message.includes('not found') || message.includes('not_found')) return null;
    throw error;
  }
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
  if (existing) return false;

  try {
    await collection.add({
      _id: documentId,
      identityHash,
      scope,
      period,
      count: 1,
      limit,
      createdAt: now,
      updatedAt: now
    });
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
  if (error instanceof FeedbackError) {
    return {
      code: error.code,
      errorCode: error.errorCode,
      message: error.message
    };
  }
  return {
    code: 500,
    errorCode: 'FEEDBACK_SUBMIT_FAILED',
    message: '留言暂时没有送达，请稍后再试'
  };
}

exports.main = async (event, context) => {
  try {
    const payload = validatePayload(event);
    const identity = getCloudIdentity(context);
    const now = Date.now();
    const periods = getChinaPeriodKeys(now);
    const requestFingerprint = sha256(JSON.stringify({
      category: payload.category,
      title: payload.title,
      content: payload.content,
      imageFileIds: payload.imageFileIds.slice().sort()
    }));
    const documentId = sha256(`${identity.deviceHash}:${periods.day}:${requestFingerprint}`);
    const db = uniCloud.database();
    const feedbackCollection = db.collection(FEEDBACK_COLLECTION);

    const duplicate = await getDocument(feedbackCollection, documentId);
    if (duplicate) {
      throw new FeedbackError(
        'FEEDBACK_DUPLICATE',
        '这条留言已经收到，不需要重复提交',
        409
      );
    }

    await enforceRateLimit(db, identity.deviceHash, now);

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
      await feedbackCollection.add(record);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new FeedbackError(
          'FEEDBACK_DUPLICATE',
          '这条留言已经收到，不需要重复提交',
          409
        );
      }
      throw error;
    }

    return {
      code: 0,
      message: 'received',
      submittedAt: now
    };
  } catch (error) {
    const result = createFailureResult(error);
    console.error('product_feedback_submit_failed', {
      errorCode: result.errorCode,
      code: result.code
    });
    return result;
  }
};
