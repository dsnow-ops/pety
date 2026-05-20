const MAX_RECORDS = 80;

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
  const records = uni.getStorageSync(getConsultationKey(petId));
  return Array.isArray(records) ? records : [];
}

export function saveConsultationRecord(petId, record) {
  if (!petId) return null;

  const now = Date.now();
  const normalizedRecord = {
    id: record.id || `consult_${now}`,
    createdAt: record.createdAt || now,
    question: compactText(record.question || '图片提问', 160),
    answerExcerpt: compactText(record.answerExcerpt || record.answer || '', 180),
    contextLabels: Array.isArray(record.contextLabels) ? record.contextLabels : [],
    riskLevel: record.riskLevel || 'normal',
    riskTerms: Array.isArray(record.riskTerms) ? record.riskTerms : []
  };

  const nextRecords = [normalizedRecord]
    .concat(getConsultationRecords(petId))
    .slice(0, MAX_RECORDS);

  uni.setStorageSync(getConsultationKey(petId), nextRecords);

  return normalizedRecord;
}
