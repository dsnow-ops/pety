const MOOD_LABELS = {
  good: '轻松',
  calm: '平稳',
  tired: '疲惫',
  uneasy: '不安',
  sick: '不适'
};

const MOOD_COLORS = {
  good: '#6E8E68',
  calm: '#8C7557',
  tired: '#B8A46E',
  uneasy: '#B9795F',
  sick: '#B95757'
};

const EVENT_LABELS = {
  appetite_good: '食欲正常',
  appetite_low: '食欲下降',
  water_more: '饮水增多',
  stool_normal: '排便正常',
  stool_soft: '软便',
  diarrhea: '腹泻',
  vomit: '呕吐',
  cough: '咳嗽',
  itch: '抓挠',
  lethargy: '精神差',
  medicine: '用药',
  vaccine: '疫苗/驱虫'
};

function getDiaryKey(petId) {
  return `pet_diaries_${petId}`;
}

function pad(value) {
  return `${value}`.padStart(2, '0');
}

export function formatDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function getDiaryMap(petId) {
  if (!petId) return {};
  const value = uni.getStorageSync(getDiaryKey(petId));
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export function getDiaryRecord(petId, dateKey) {
  const diaryMap = getDiaryMap(petId);
  return normalizeDiaryRecord(diaryMap[dateKey]);
}

export function saveDiaryRecord(petId, dateKey, record) {
  if (!petId || !dateKey) return null;

  const diaryMap = getDiaryMap(petId);
  const normalizedRecord = normalizeDiaryRecord({
    ...record,
    date: dateKey,
    updatedAt: Date.now()
  });

  diaryMap[dateKey] = normalizedRecord;
  uni.setStorageSync(getDiaryKey(petId), diaryMap);

  return normalizedRecord;
}

export function normalizeDiaryRecord(rawRecord = {}) {
  const events = Array.isArray(rawRecord.events) ? rawRecord.events.filter(Boolean) : [];

  return {
    date: rawRecord.date || '',
    type: typeof rawRecord.type === 'string' ? rawRecord.type : '',
    mood: MOOD_LABELS[rawRecord.mood] ? rawRecord.mood : 'calm',
    events,
    note: typeof rawRecord.note === 'string' ? rawRecord.note : '',
    updatedAt: rawRecord.updatedAt || 0
  };
}

export function hasDiaryRecord(record) {
  if (!record) return false;
  return Boolean(record.updatedAt) || Boolean(record.note && record.note.trim()) || Boolean(record.events && record.events.length);
}

export function getMoodLabel(mood) {
  return MOOD_LABELS[mood] || mood || '平稳';
}

export function getMoodColor(mood) {
  return MOOD_COLORS[mood] || MOOD_COLORS.calm;
}

export function getEventLabel(eventKey) {
  return EVENT_LABELS[eventKey] || eventKey;
}

function compactText(value, maxLength) {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(maxLength - 1, 0))}…`;
}

export function buildDiaryContext(petId, options = {}) {
  const maxDays = options.maxDays || 14;
  const maxChars = Number.isFinite(options.maxChars) ? options.maxChars : 420;
  if (!petId || maxChars <= 0) return '';

  const diaryMap = getDiaryMap(petId);
  const todayKey = options.todayKey || formatDateKey();
  const dates = Object.keys(diaryMap)
    .filter(dateKey => dateKey <= todayKey)
    .sort()
    .reverse()
    .slice(0, maxDays);

  const lines = dates
    .map(dateKey => {
      const record = normalizeDiaryRecord(diaryMap[dateKey]);
      if (!hasDiaryRecord(record)) return '';

      const parts = [`状态:${getMoodLabel(record.mood)}`];
      if (record.events.length) {
        parts.push(`事件:${record.events.map(getEventLabel).join('、')}`);
      }
      if (record.note && record.note.trim()) {
        parts.push(`备注:${compactText(record.note, 70)}`);
      }

      return `${dateKey} ${parts.join('；')}`;
    })
    .filter(Boolean);

  if (!lines.length) return '';

  const prefix = '以下是用户在归爪日历里的近期记录，仅作为背景参考；如果当前问题紧急，请优先建议线下就医。\n';
  if (prefix.length >= maxChars) return '';
  let output = prefix;

  for (const line of lines) {
    const next = `${output}${line}\n`;
    if (next.length > maxChars) break;
    output = next;
  }

  return output.trim();
}
