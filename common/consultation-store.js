import { scopedStorage, captureDataScope } from './scoped-storage.js';
let sequence = 0;
const fail = code => { throw Object.assign(new Error(code), { code }); };

function getConsultationKey(petId) {
  return `consultation_records_${petId}`;
}

function compactText(value, maxLength) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(maxLength - 1, 0))}…`;
}

export function getConsultationRecords(petId) {
  if (!petId) return [];
  const records = scopedStorage.getStorageSync(getConsultationKey(petId));
  if (records === undefined || records === null || records === '') return [];
  if (!Array.isArray(records) || records.some(r => !r || typeof r !== 'object' || !r.id)) fail('CONSULTATION_STORAGE_INVALID');
  return records;
}

export function saveConsultationRecord(petId, record) {
  if (!petId) return null;
  const bound = scopedStorage.forScope(captureDataScope());
  const existing = getConsultationRecords(petId);
  const now = Date.now();
  const normalizedRecord = {
    id: record.id || `consult_${now}_${++sequence}_${Math.random().toString(36).slice(2,8)}`,
    createdAt: record.createdAt || now,
    question: compactText(record.question || '图片提问', 160),
    answerExcerpt: compactText(record.answerExcerpt || record.answer || '', 180),
    contextLabels: Array.isArray(record.contextLabels) ? record.contextLabels : [],
    riskLevel: record.riskLevel || 'normal',
    riskTerms: Array.isArray(record.riskTerms) ? record.riskTerms : []
  };

  const previous = existing.find(r => r.id === normalizedRecord.id);
  if (previous) {
    const comparable = row => JSON.stringify([row.question,row.answerExcerpt,row.contextLabels||[],row.riskLevel||'normal',row.riskTerms||[]]);
    if (comparable(previous) !== comparable(normalizedRecord)) fail('CONSULTATION_ID_CONFLICT');
    return previous;
  }
  // Rendering is paginated by each view. Never delete old source summaries to
  // limit the visible list: saved followups may still refer to their IDs.
  bound.setStorageSync(getConsultationKey(petId), [normalizedRecord, ...existing]);

  return normalizedRecord;
}
