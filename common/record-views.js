import { eventTimeLabel } from './narrative-store.js';

// These are projections of the existing store; no copied text index is persisted.
export function hasCareContent(r = {}) {
  return Boolean(/(医院|就医|病灶|用药|药物|剂量|呕吐|腹泻|肿瘤|化验|血检|治疗|诊断|去世|离世|安乐|最后一天)/.test([r.original,r.lifeText,r.title,...(r.media||[]).map(m=>m.caption)].filter(Boolean).join(' ')) || r.privateNote?.trim() || r.kind === 'care' && !r.dailyVersion || r.careSourceId || r.careStatus || r.mood || r.type || r.note?.trim() || r.events?.length || Object.values(r.healthValues || {}).some(v => v?.text?.trim()));
}
export function lifeText(r = {}) { return r.dailyVersion ? r.lifeText || '' : r.kind === 'care' ? '' : r.original || ''; }
export function lifePhotos(r = {}) {
  return (r.media || []).filter(m => m.purpose === 'life' && m.durable && m.namespace === r.namespace && m.petId === r.petId);
}
export function safeForRecall(r = {}) {
  return !r.hidden && !r.generatedRecipe && !r.example && !hasCareContent(r) && !(r.media || []).some(m => m.purpose !== 'life') && Boolean(lifeText(r).trim() || lifePhotos(r).length);
}
export function recordMonth(r) {
  if (r.eventTime && !['day','exact'].includes(r.eventTime.precision)) {
    return r.eventTime.precision === 'month' ? `${r.eventTime.year}-${String(r.eventTime.month).padStart(2,'0')} · 日期未详` : r.eventTime.year ? `${r.eventTime.year} · 日期未详` : '时间未详';
  }
  return r.localDate ? r.localDate.slice(0,7) : '时间未详';
}
// Keep imprecise dates honest: a year-only memory never becomes January 1st.
export function recordPeriod(record) {
  const label = recordMonth(record);
  const month = /^(\d{4}-\d{2})/.exec(label);
  if (month) return month[1];
  const year = /^(\d{4})/.exec(label);
  return year ? `year:${year[1]}` : 'unknown';
}
export function recordPeriodLabel(key) {
  if (key === 'unknown') return '时间未详';
  if (key.startsWith('year:')) return `${key.slice(5)}年 · 月份未详`;
  const [year, month] = key.split('-');
  return `${year}年${Number(month)}月`;
}
export function buildRecordDirectory(records, options = {}) {
  // A projection, not another persisted copy of private text or signed URLs.
  const groups = new Map();
  for (const record of records) {
    if (!options.namespace || !options.petId || record.namespace !== options.namespace || record.petId !== options.petId) continue;
    if (['drafts', 'works'].includes(record._group) || record.example || record.generatedRecipe) continue;
    if (!lifeText(record).trim() && !lifePhotos(record).length) continue;
    if (options.photosOnly && (hasCareContent(record) || !lifePhotos(record).length)) continue;
    const key = recordPeriod(record);
    const group = groups.get(key) || { key, label: recordPeriodLabel(key), count: 0, photos: 0 };
    group.count++;
    if (!hasCareContent(record)) group.photos += lifePhotos(record).length;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => {
    const order = key => key === 'unknown' ? '' : key.replace('year:', '') + (key.startsWith('year:') ? '-00' : '');
    return order(b.key).localeCompare(order(a.key));
  });
}
export function queryRecords(records, options = {}) {
  const query = String(options.query || '').trim().toLocaleLowerCase();
  const rows = records.filter(r => {
    if (options.namespace && r.namespace !== options.namespace || options.petId && r.petId !== options.petId) return false;
    if (options.favorite && !r.favorite || options.tag && !(r.tags || []).includes(options.tag)) return false;
    const care = hasCareContent(r);
    if (options.photosOnly && (care || !lifePhotos(r).length)) return false;
    if (options.type === 'care' && !care || options.type === 'life' && !lifeText(r).trim() && !lifePhotos(r).length) return false;
    if (options.month && !recordMonth(r).startsWith(options.month)) return false;
    if (options.period && recordPeriod(r) !== options.period) return false;
    if (options.from || options.to) {
      if (!r.localDate || r.eventTime && !['day','exact'].includes(r.eventTime.precision)) return false;
      if (options.from && r.localDate < options.from || options.to && r.localDate > options.to) return false;
    }
    const text = [lifeText(r), r.title, ...(r.tags || []), r.milestone, ...lifePhotos(r).map(m => m.caption), ...(options.type === 'care' ? [r.note, ...Object.values(r.healthValues || {}).map(v => v.text)] : [])].filter(Boolean).join('\n').toLocaleLowerCase();
    return !query || text.includes(query);
  }).sort((a,b) => {
    const key = r => r.localDate || (r.eventTime?.year ? `${r.eventTime.year}-${String(r.eventTime.month || 0).padStart(2,'0')}` : '');
    return key(b).localeCompare(key(a)) || (b.eventTime?.localTime || '').localeCompare(a.eventTime?.localTime || '') || b.createdAt-a.createdAt || a.id.localeCompare(b.id);
  });
  const offset = Math.max(0, options.offset || 0), limit = Math.min(1000, Math.max(1, options.limit || 30));
  return { total: rows.length, rows: rows.slice(offset, offset+limit).map(r => ({ ...r, eventLabel: eventTimeLabel(r), monthLabel: recordMonth(r) })) };
}

// A bounded window into every original, including histories beyond 1000 rows.
// Re-read after deletion clamps a now-missing last page to the remaining page.
export function queryRecordPage(records, options = {}) {
  const limit = Number.isSafeInteger(options.limit) && options.limit > 0 ? Math.min(options.limit, 1000) : 30;
  const requested = Number.isSafeInteger(options.offset) && options.offset >= 0 ? options.offset : 0;
  let offset = Math.floor(requested / limit) * limit;
  let result = queryRecords(records, { ...options, offset, limit });
  const last = result.total ? Math.floor((result.total - 1) / limit) * limit : 0;
  if (offset > last) { offset = last; result = queryRecords(records, { ...options, offset, limit }); }
  return { ...result, offset, limit };
}

export function queryWorkPage(records, options = {}) {
  const query = String(options.query || '').trim().toLocaleLowerCase();
  const rows = records.filter(row => row._group === 'works' && (!query ||
    [row.title, row.original, row.text, ...(row.media || []).map(asset => asset.caption)].filter(Boolean).join('\n').toLocaleLowerCase().includes(query)))
    .sort((a, b) => (Number(b._savedAt) || 0) - (Number(a._savedAt) || 0) || String(a.id).localeCompare(String(b.id)));
  const limit = 4, last = rows.length ? Math.floor((rows.length - 1) / limit) * limit : 0;
  const requested = Number.isSafeInteger(options.offset) && options.offset >= 0 ? options.offset : 0;
  const offset = Math.min(Math.floor(requested / limit) * limit, last);
  return { total: rows.length, offset, limit, rows: rows.slice(offset, offset + limit) };
}
