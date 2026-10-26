'use strict';

const fail = () => { throw Object.assign(new Error('MEMBERSHIP_STATE_INVALID'), { code: 'MEMBERSHIP_STATE_INVALID' }); };
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const defaults = {
  free: { maxPets: 1, dailyAiLimit: 3, monthlyAiLimit: 0, cloudSyncEnabled: false, consultationRetentionDays: 30 },
  plus: { maxPets: 20, dailyAiLimit: 30, monthlyAiLimit: 300, cloudSyncEnabled: true, consultationRetentionDays: 3650 },
  pro: { maxPets: 50, dailyAiLimit: 80, monthlyAiLimit: 1000, cloudSyncEnabled: true, consultationRetentionDays: 3650 }
};

function confirmedResponse(response) {
  if (!isObject(response) || response.ok === false || response.success === false || ['errCode', 'code'].some(key => ![undefined, null, '', 0, '0'].includes(response[key]))) fail();
  return response;
}

function validateMembership(record, uid) {
  if (record === undefined || record === null) return record;
  if (!isObject(record) || uid !== undefined && record.userId !== uid || !Object.hasOwn(defaults, record.plan) || !['active', 'inactive', 'expired', 'refunded'].includes(record.status)) fail();
  for (const key of ['startedAt', 'endedAt', 'expiresAt']) {
    const value = record[key];
    if (value !== undefined && value !== null && (!Number.isSafeInteger(value) || value < 0)) fail();
  }
  if (record.entitlements !== undefined && record.entitlements !== null) {
    if (!isObject(record.entitlements)) fail();
    for (const key of ['maxPets', 'dailyAiLimit', 'monthlyAiLimit', 'consultationRetentionDays']) {
      const value = record.entitlements[key];
      if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) fail();
    }
    if (record.entitlements.cloudSyncEnabled !== undefined && typeof record.entitlements.cloudSyncEnabled !== 'boolean') fail();
  }
  return record;
}

function readMembershipRecord(response, uid) {
  const data = confirmedResponse(response).data;
  if (!Array.isArray(data) || data.length > 1 || data.some(row => !isObject(row))) fail();
  return validateMembership(data[0], uid);
}

function normalizeMembership(record, now = Date.now()) {
  validateMembership(record);
  const active = record && record.status === 'active' && (!record.endedAt || record.endedAt > now) && (!record.expiresAt || record.expiresAt > now);
  if (!active) return { plan: 'free', status: record?.status === 'expired' ? 'expired' : 'inactive', entitlements: { ...defaults.free } };
  return { plan: record.plan, status: 'active', entitlements: { ...defaults[record.plan], ...(record.entitlements || {}) } };
}

module.exports = { confirmedResponse, validateMembership, readMembershipRecord, normalizeMembership };
