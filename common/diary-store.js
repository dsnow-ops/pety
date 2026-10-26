import {healthValueLines,hasExplicitHealth} from './daily-record-fields.js';
import { scopedStorage } from './scoped-storage.js';
import { getNarrativeStore } from './narrative-store.js';
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
  food: '饮食',
  water: '饮水',
  spirit: '精神',
  stool: '便便',
  weight: '体重',
  sleep: '睡眠',
  exercise: '外出 / 运动',
  clean: '洗澡 / 清洁',
  preventive: '疫苗 / 驱虫',
  abnormal: '异常情况',
  memo: '小事 / 备忘',
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

function getReflectionSuggestionKey(petId, dateKey) {
  return `memorial_reflection_suggestion_${petId}_${dateKey}`;
}

function pad(value) {
  return `${value}`.padStart(2, '0');
}

export function formatDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function getDiaryMap(petId, scope, options = {}) {
  if (!petId) return {};
  const storage = scope ? scopedStorage.forScope(scope) : scopedStorage;
  const value = storage.getStorageSync(getDiaryKey(petId));
  const isMap = row => row !== null && typeof row === 'object' && !Array.isArray(row);
  if (value !== undefined && value !== null && value !== '' && (!isMap(value) || Object.values(value).some(row => !isMap(row)))) {
    // Older overview readers keep their existing non-throwing contract. Editors
    // and every diary write explicitly require a complete, readable source.
    if (options.strict) throw Object.assign(new Error('DIARY_STORAGE_INVALID'), { code: 'DIARY_STORAGE_INVALID' });
    return {};
  }
  const map = value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {};
  const creative = storage.getStorageSync(`pet_diaries_${petId}_creative_v1`);
  for (const record of Object.values(creative?.records || {})) {
    if (!record.legacy || !String(record.id || '').startsWith('legacy:')) continue;
    const date = record.id.slice(7);
    // Preserve actual legacy edits, but never replace newer health edits with an
    // older creative overlay or consume a polished candidate as a health fact.
    if (map[date] && Number(record.updatedAt) > Number(map[date].updatedAt || 0)) {
      const field = map[date].relationshipStage === 'deceased' ? 'memoryText' : 'note';
      const original = typeof record.original === 'string' ? record.original : map[date][field];
      map[date] = { ...map[date], [field]: original, updatedAt: record.updatedAt };
    }
  }
  return map;
}

export function getDiaryRecord(petId, dateKey) {
  const diaryMap = getDiaryMap(petId);
  return normalizeDiaryRecord(diaryMap[dateKey]);
}

export function saveDiaryRecord(petId, dateKey, record, options = {}) {
  if (!petId || !dateKey) return null;
  const storage = options.scope ? scopedStorage.forScope(options.scope) : scopedStorage;
  const existing = getDiaryMap(petId, options.scope, {strict:true})[dateKey] || {};
  if (options.expectedUpdatedAt !== undefined && Number(existing.updatedAt || 0) !== Number(options.expectedUpdatedAt)) {
    throw Object.assign(new Error('DIARY_VERSION_CONFLICT'), { code: 'DIARY_VERSION_CONFLICT' });
  }
  // Only the selected day is committed. Reading an overlay never migrates other days.
  const diaryMap = { ...(storage.getStorageSync(getDiaryKey(petId)) || {}) };
  const patch = Object.fromEntries(Object.entries(record || {}).filter(([, value]) => value !== undefined));
  if (patch.media?.some(m => !m.id || !m.durable || m.petId !== petId || options.scope && m.namespace !== options.scope.namespace)) {
    throw Object.assign(new Error('NARRATIVE_MEDIA_NOT_PERSISTED'), {code:'NARRATIVE_MEDIA_NOT_PERSISTED'});
  }
  const normalizedRecord = normalizeDiaryRecord({
    ...existing,
    ...patch,
    date: dateKey,
    createdAt: existing.createdAt ?? patch.createdAt ?? Date.now(),
    updatedAt: Math.max(Date.now(), Number(existing.updatedAt || 0) + 1)
  });

  diaryMap[dateKey] = normalizedRecord;
  if(options.dailyDraft){
    if(!options.scope)throw Object.assign(new Error('DATA_SCOPE_UNRESOLVED'),{code:'DATA_SCOPE_UNRESOLVED'});
    const removal=getNarrativeStore(petId,options.scope).prepareDailyDraftRemoval(dateKey,options.dailyDraft.stage,options.dailyDraft.snapshot);
    scopedStorage.atomicBatch(options.scope,[{key:getDiaryKey(petId),value:diaryMap},removal]);
  }else storage.setStorageSync(getDiaryKey(petId), diaryMap);

  return normalizedRecord;
}

export function normalizeDiaryRecord(rawRecord = {}) {
  rawRecord = rawRecord && typeof rawRecord === 'object' ? rawRecord : {};
  const events = Array.isArray(rawRecord.events) ? rawRecord.events.filter(Boolean) : [];
  const relationshipStage = rawRecord.relationshipStage === 'deceased' ? 'deceased' : 'current';

  return {
    ...rawRecord,
    date: rawRecord.date || '',
    type: typeof rawRecord.type === 'string' ? rawRecord.type : '',
    mood: typeof rawRecord.mood === 'string' ? rawRecord.mood : '',
    events,
    note: typeof rawRecord.note === 'string' ? rawRecord.note : '',
    relationshipStage,
    reflectionTags: Array.isArray(rawRecord.reflectionTags) ? rawRecord.reflectionTags.filter(Boolean).slice(0, 10) : [],
    memoryText: typeof rawRecord.memoryText === 'string' ? rawRecord.memoryText : '',
    privateNote: typeof rawRecord.privateNote === 'string' ? rawRecord.privateNote : '',
    source: rawRecord.source ?? 'manual',
    sourceChatIds: Array.isArray(rawRecord.sourceChatIds) ? rawRecord.sourceChatIds.filter(Boolean).slice(0, 20) : [],
    createdAt: rawRecord.createdAt ?? rawRecord.updatedAt ?? 0,
    updatedAt: rawRecord.updatedAt ?? 0
  };
}

export function hasDiaryRecord(record) {
  if (!record) return false;
  return Boolean(record.updatedAt) || Boolean(record.mood) || Boolean(record.type) || Boolean(record.note && record.note.trim()) ||
    Boolean(record.memoryText && record.memoryText.trim()) ||
    Boolean(record.events && record.events.length) || Boolean(record.reflectionTags && record.reflectionTags.length);
}

export function isHealthDiaryRecord(record) {
  return hasDiaryRecord(record) && record.relationshipStage !== 'deceased' && (record.dailyVersion!==1 || hasExplicitHealth(record));
}

export function saveMemorialReflectionSuggestion(petId, dateKey, suggestion = {}) {
  if (!petId || !dateKey) return null;
  const normalized = {
    relationshipStage: 'deceased',
    reflectionTags: Array.isArray(suggestion.tags) ? suggestion.tags.filter(Boolean).slice(0, 3) : [],
    memoryText: typeof suggestion.shortSummary === 'string' ? suggestion.shortSummary.trim().slice(0, 500) : '',
    source: 'chat_suggested',
    sourceChatIds: Array.isArray(suggestion.sourceChatIds) ? suggestion.sourceChatIds.filter(Boolean).slice(0, 20) : [],
    createdAt: Date.now()
  };
  if (!normalized.reflectionTags.length && !normalized.memoryText) return null;
  scopedStorage.setStorageSync(getReflectionSuggestionKey(petId, dateKey), normalized);
  return normalized;
}

export function getMemorialReflectionSuggestion(petId, dateKey) {
  if (!petId || !dateKey) return null;
  const value = scopedStorage.getStorageSync(getReflectionSuggestionKey(petId, dateKey));
  return value && value.relationshipStage === 'deceased' ? value : null;
}

export function removeMemorialReflectionSuggestion(petId, dateKey) {
  if (!petId || !dateKey) return;
  scopedStorage.removeStorageSync(getReflectionSuggestionKey(petId, dateKey));
}

export function getMoodLabel(mood) {
  return MOOD_LABELS[mood] || mood || '未填写';
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
  const moments=Object.values(scopedStorage.getStorageSync(`pet_diaries_${petId}_creative_v1`)?.records||{}).filter(r=>!r.legacy&&!r.hidden&&r.mode==='current'&&r.kind==='life'&&r.original?.trim());
  const dates = [...new Set([...Object.keys(diaryMap),...moments.map(r=>r.localDate).filter(Boolean)])]
    .filter(dateKey => dateKey <= todayKey && diaryMap[dateKey]?.relationshipStage!=='deceased' && (hasDiaryRecord(diaryMap[dateKey])||moments.some(r=>r.localDate===dateKey)))
    .sort()
    .reverse()
    .slice(0, maxDays);

  const lines = dates
    .map(dateKey => {
      const record = normalizeDiaryRecord(diaryMap[dateKey]);
      const dayMoments=moments.filter(r=>r.localDate===dateKey);
      if (!hasDiaryRecord(record)&&!dayMoments.length) return '';
	  if (record.relationshipStage === 'deceased') return '';

      const parts = [`状态:${getMoodLabel(record.mood)}`];

      const events = [...new Set([record.type, ...record.events].filter(Boolean))];
      if (events.length) {
        parts.push(`事件:${events.map(getEventLabel).join('、')}`);
      }
      const measured=healthValueLines(record);
      if(measured.length)parts.push(measured.map(v=>v.label+':'+v.text+(v.date&&v.date!==dateKey?'（'+v.date+'）':'')).join('；'));
      dayMoments.forEach(r=>parts.push('主人日常原文（非健康结论）:'+compactText(r.original,70)));
      if(record.lifeText?.trim())parts.push('主人日常原文（非健康结论）:'+compactText(record.lifeText,70));
      if (record.note && record.note.trim()) {
        parts.push(`备注:${compactText(record.note, 70)}`);
      }

      return `${dateKey} ${parts.join('；')}`;
    })
    .filter(Boolean);

  if (!lines.length) return '';

  const prefix = '用户近期健康日历记录（未填写不代表正常；仅供背景参考）：\n';
  if (prefix.length >= maxChars) return '';
  let output = prefix;

  for (const line of lines) {
    const next = `${output}${line}\n`;
    if (next.length > maxChars) {if(output===prefix){const units=line.split('；');for(const unit of units){if((output+unit+'；').length>maxChars)break;output+=unit+'；';}}break;}
    output = next;
  }

  return output.trim();
}
