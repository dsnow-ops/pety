'use strict';
const uniID = require('uni-id-common');

const objectRow = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const hasError = value => ['errCode', 'code'].some(key => ![undefined, null, '', 0, '0'].includes(value[key]));
function readRows(response, name) {
  if (!objectRow(response) || hasError(response) || !Array.isArray(response.data) || !response.data.every(objectRow)) {
    throw new Error(`AUTH_${name}_LOOKUP_UNAVAILABLE`);
  }
  return response.data;
}
function stringList(value, name) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every(item => typeof item === 'string' && item.length > 0)) throw new Error(`AUTH_${name}_INVALID`);
  return value;
}

// Official verification is the only source of account identity. Missing tokens
// mean guest; claimed uid/dev/plan/context.uid never establish an account.
async function verifyRequest(event = {}, context = {}) {
  if (!event.uniIdToken) return { uid: null };
  // Functions provide uppercase context; cloud objects provide official clientInfo.
  const instance = uniID.createInstance(context.APPID || context.PLATFORM ? { context } : { clientInfo: context });
  const result = await instance.checkToken(event.uniIdToken, { autoRefresh: false });
  if (!objectRow(result)) throw new Error('AUTH_TOKEN_RESPONSE_UNAVAILABLE');
  if (hasError(result)) throw { errCode: result.errCode || result.code, errMsg: '登录状态检查失败。' };
  if (typeof result.uid !== 'string' || !result.uid || !Number.isSafeInteger(result.iat) || result.iat < 0) throw new Error('AUTH_TOKEN_RESPONSE_UNAVAILABLE');
  // uni-id-common 1.0.19 may return a signed payload with embedded roles
  // without reading the account. Recheck the official session ledger so
  // logout, account closure and password reset take effect on this request.
  // This adapter accepts persisted sessions issued by the installed module;
  // it never creates tokens or refreshes a revoked token as a side effect.
  const response = await uniCloud.database().collection('uni-id-users').doc(result.uid)
    .field({ status: true, token: true, valid_token_date: true, role: true }).get();
  const users = readRows(response, 'ACCOUNT');
  if (users.length > 1 || (users.length && users[0]._id !== undefined && users[0]._id !== result.uid)) throw new Error('AUTH_ACCOUNT_LOOKUP_UNAVAILABLE');
  const user = users[0];
  const reject = errCode => { throw { errCode, errMsg: '登录状态已失效，请重新登录。' }; };
  if (!user) reject('uni-id-account-not-exists');
  const statusErrors = { 1: 'banned', 2: 'auditing', 3: 'audit-failed', 4: 'closed' };
  if (user.status !== undefined && user.status !== 0) {
    if (!Number.isInteger(user.status) || !statusErrors[user.status]) throw new Error('AUTH_ACCOUNT_STATUS_INVALID');
    reject(`uni-id-account-${statusErrors[user.status]}`);
  }
  const tokens = stringList(user.token, 'TOKENS');
  const roles = stringList(user.role, 'ROLES');
  const invalidBefore = user.valid_token_date == null ? 0 : user.valid_token_date;
  if (!Number.isSafeInteger(invalidBefore) || invalidBefore < 0) throw new Error('AUTH_TOKEN_DATE_INVALID');
  if (!tokens.includes(event.uniIdToken)) reject('uni-id-check-token-failed');
  if (invalidBefore > result.iat * 1000) {
    reject('uni-id-token-expired');
  }
  try{await require('./sessions').assertCurrent(result.uid,event.petySession);}catch(e){e.sessionVersion=event.petySession?.version;throw e;}
  // Roles and permissions can be revoked while a correctly signed JWT lives.
  // Use the same role_id mapping as installed uni-id-common, with live records.
  let permissions = [];
  if (roles.length && !roles.includes('admin')) {
    const db = uniCloud.database();
    const response = await db.collection('uni-id-roles').where({ role_id: db.command.in(roles) }).field({ permission: true }).get();
    permissions = [...new Set(readRows(response, 'ROLES').flatMap(r => stringList(r.permission, 'PERMISSIONS')))];
  }
  return { uid: result.uid, session:event.petySession, roles, permissions };
}

function authErrorResult(error) {
  const code = String(error?.errCode || '');
  if(code.startsWith('pety-session-'))return{errCode:code,errMsg:code==='pety-session-revoked'?'账号已在其他设备登录。':code==='pety-session-required'?'请重新登录以启用安全会话。':'会话服务暂时不可用，请稍后重试。',sessionVersion:error.sessionVersion};
  // Dependency/network failures are not proof of token revocation.
  const invalid = /^(uni-id-(token-expired|check-token-failed|account-(banned|auditing|audit-failed|closed|not-exists)))$/.test(code);
  return { errCode: invalid ? code : 'pety-auth-service-unavailable', errMsg: invalid ? '登录状态已失效，请重新登录。' : '账号服务暂时不可用，请稍后再试。' };
}
module.exports = { verifyRequest, authErrorResult };
