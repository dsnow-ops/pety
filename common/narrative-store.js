import { scopedStorage, captureDataScope } from './scoped-storage.js';

export const narrativeKey = petId => `pet_diaries_${petId}_creative_v1`;
export const narrativeMode = stage => ['memorial', 'deceased'].includes(stage) ? 'deceased' : 'current';
export const narrativeId = () => `page_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
export function localEventDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function validLocalDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const [y, m, d] = value.split('-').map(Number), date = new Date(y, m - 1, d, 12);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}
// Event precision is independent of entry time. Unknown dates never acquire a day.
export function normalizeEventTime(input = {}, fallback = '') {
  const precision = input.precision || (fallback ? 'day' : 'unknown');
  const source = ['user','trusted_metadata','legacy','unknown'].includes(input.source) ? input.source : 'user';
  const result = { precision, source };
  if (['day','exact'].includes(precision)) {
    if (!validLocalDate(input.localDate || fallback)) fail('NARRATIVE_DATE_INVALID');
    result.localDate = input.localDate || fallback;
    if (precision === 'exact') {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.localTime || '')) fail('NARRATIVE_DATE_INVALID');
      result.localTime = input.localTime;
    }
  } else if (['month','year','season'].includes(precision)) {
    const year = Number(input.year);
    if (!Number.isInteger(year) || year < 100 || year > 9999) fail('NARRATIVE_DATE_INVALID');
    result.year = year;
    if (precision === 'month') {
      const month = Number(input.month);
      if (!Number.isInteger(month) || month < 1 || month > 12) fail('NARRATIVE_DATE_INVALID');
      result.month = month;
    }
    if (precision === 'season') {
      if (!String(input.label || '').trim()) fail('NARRATIVE_DATE_INVALID');
      result.label = String(input.label).trim();
    }
  } else if (precision !== 'unknown') fail('NARRATIVE_DATE_INVALID');
  if (input.timezoneAtEntry) result.timezoneAtEntry = String(input.timezoneAtEntry);
  return result;
}
export function eventTimeLabel(record = {}) {
  const e = record.eventTime;
  if (!e) return record.dateText || record.localDate || '时间未详';
  if (e.precision === 'exact') return `${e.localDate} ${e.localTime}`;
  if (e.precision === 'day') return e.localDate;
  if (e.precision === 'month') return `${e.year}年${e.month}月 · 日期未详`;
  if (e.precision === 'year') return `${e.year}年 · 日期未详`;
  if (e.precision === 'season') return `${e.year}年 ${e.label} · 日期未详`;
  return '时间未详';
}
const clone = value => JSON.parse(JSON.stringify(value));
const fail = code => { throw Object.assign(new Error(code), { code }); };
const empty = () => ({ version: 1, drafts: {}, records: {}, works: {}, receipts: {}, proposals: {}, followups: {}, mediaGarbage: [], dailyDrafts:{}, compositions:{}, recordMeta:{} });
const objectMap = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const absent = value => value === undefined || value === null || value === '';
const draftVersion = value => {
  const version = value?.draftVersion ?? 0;
  if (!Number.isSafeInteger(version) || version < 0 || version >= Number.MAX_SAFE_INTEGER) fail('NARRATIVE_VERSION_CONFLICT');
  return version;
};
const sameDraft = (left, right) => {
  if (!left || !right) return false;
  const {draftVersion: a, ...l} = left, {draftVersion: b, ...r} = right;
  return JSON.stringify(l) === JSON.stringify(r);
};

// One document per pet: a formal save and removal of its draft commit together.
// A bound scoped-storage lease rejects A -> B -> A stale continuations.
export function createNarrativeStore(storage, scope, petId) {
  if (!petId || !scope?.ready) fail('DATA_SCOPE_UNRESOLVED');
  const bound = storage.forScope(scope), key = narrativeKey(petId);
  const read = () => {
    const value = bound.getStorageSync(key);
    if (absent(value)) return empty();
    if (!objectMap(value)) fail('NARRATIVE_STORAGE_INVALID');
    if (value.version !== undefined && value.version !== 1) fail('NARRATIVE_STORAGE_VERSION');
    for (const field of Object.keys(empty()).filter(k => !['version','mediaGarbage'].includes(k))) {
      if (field in value && !objectMap(value[field])) fail('NARRATIVE_STORAGE_INVALID');
    }
    if ('mediaGarbage' in value && !Array.isArray(value.mediaGarbage)) fail('NARRATIVE_STORAGE_INVALID');
    for (const field of ['records','drafts','works']) {
      if (Object.values(value[field] || {}).some(row => !objectMap(row))) fail('NARRATIVE_STORAGE_INVALID');
    }
    return { ...empty(), ...value };
  };
  const write = value => bound.setStorageSync(key, clone(value));
  const assertOwned = value => {
    if (value.petId !== petId || value.namespace !== scope.namespace) fail('NARRATIVE_OWNER_CHANGED');
  };
  const legacyMap = () => {
    const value = bound.getStorageSync(`pet_diaries_${petId}`);
    if (absent(value)) return {};
    if (!objectMap(value) || Object.values(value).some(row => !objectMap(row))) fail('NARRATIVE_STORAGE_INVALID');
    return value;
  };
  const legacy = () => Object.entries(legacyMap()).map(([date, r]) => ({
    ...r, id: `legacy:${date}`, petId, namespace: scope.namespace, revision: Number(r.updatedAt || 0),
    kind: r.relationshipStage === 'deceased' ? (r.type === 'letter' ? 'letter' : 'memory') : 'care',
    mode: narrativeMode(r.relationshipStage), original: r.lifeText || r.note || r.memoryText || '', text: r.lifeText || r.note || r.memoryText || '',
    localDate: date, dateText: date, media: r.media||[], tags: r.tags || [], legacy: true, dailyVersion:r.dailyVersion, activeRecord: Boolean(r.mood||r.type||r.events?.length||r.note?.trim()||r.lifeText?.trim()||r.media?.length||Object.values(r.healthValues||{}).some(v=>v?.text?.trim())),
    createdAt: r.createdAt || r.updatedAt || 0, updatedAt: r.updatedAt || 0
  })); // Ambiguous legacy care fields never earn life-record rewards.
  const list = () => {
    const state = read(), overrides = state.records;
    const oldRows=legacy();
    return [...oldRows.map(r=>overrides[r.id] && overrides[r.id].updatedAt > r.updatedAt ? overrides[r.id] : r), ...Object.values(overrides).filter(r=>!r.legacy)].map(r=>({...r,...(state.recordMeta[r.id]||{})})).sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id));
  };
  const dailyEnvelope = (state,date,stage) => {
    if(!validLocalDate(date)||!['current','deceased'].includes(stage))fail('NARRATIVE_DATE_INVALID');
    const slot=`${stage}:${date}`,current=state.dailyDrafts[slot],legacy=state.dailyDrafts[date];
    for(const row of [current,legacy])if(row!==undefined&&(!objectMap(row)||!objectMap(row.form)))fail('NARRATIVE_STORAGE_INVALID');
    if(current&&current.stage!==stage)fail('NARRATIVE_STORAGE_INVALID');
    const old=legacy?.stage===stage?legacy:null;
    return {slot,record:current||old||null,snapshot:JSON.stringify([current??null,old])};
  };
  const assertDaily = (state,date,stage,snapshot,base) => {
    const envelope=dailyEnvelope(state,date,stage);
    if(typeof snapshot!=='string'||snapshot!==envelope.snapshot)fail('DIARY_VERSION_CONFLICT');
    if(base!==undefined){const latest=list().find(row=>row.id===`legacy:${date}`);if(!Number.isSafeInteger(base)||base<0||Number(latest?.updatedAt||0)!==base)fail('DIARY_VERSION_CONFLICT');}
    return envelope;
  };
  const sourceMatches = id => ref => ref && (ref.id===id || ref.recordId===id || id.startsWith('legacy:') && (ref.id==='health:'+id.slice(7)||ref.recordId==='health:'+id.slice(7)));
  const dailyRemovalKeys = (state,id,mode) => id.startsWith('legacy:') ? Object.keys(state.dailyDrafts).filter(k=>(k===`${mode}:${id.slice(7)}`||k===id.slice(7))&&state.dailyDrafts[k]?.stage===mode) : [];
  const removalPlan = (id,kind='record',expected) => {
    if(typeof id!=='string'||!id||!['record','drafts','works'].includes(kind))fail('NARRATIVE_STORAGE_INVALID');
    const state=read(),record=kind==='works'?null:list().find(r=>r.id===id),target=kind==='works'?state.works[id]:kind==='drafts'?state.drafts[id]:record;
    if(!target)fail('NARRATIVE_SOURCE_MISSING');
    if(expected!==undefined&&JSON.stringify(expected)!==JSON.stringify(target))fail('NARRATIVE_VERSION_CONFLICT');
    if(kind==='works')return{id,kind,snapshot:JSON.stringify(target),linkedCount:0};
    const matches=sourceMatches(id),linked=Object.entries(state.works).filter(([,w])=>(w.sources||[]).some(matches));
    const affected={record:record||null,draft:state.drafts[id]||null,metadata:state.recordMeta[id]||null,
      compositions:Object.entries(state.compositions).filter(([,c])=>c?.config?.sourceRefs?.some(matches)),
      generatedDrafts:Object.entries(state.drafts).filter(([,d])=>d.generatedRecipe&&d.sourceRefs?.some(matches)),
      dailyDrafts:dailyRemovalKeys(state,id,record?.mode||state.drafts[id]?.mode||'current').map(k=>[k,state.dailyDrafts[k]]),works:linked};
    return{id,kind,snapshot:JSON.stringify(affected),linkedCount:linked.length};
  };
  const assertRemoval = (id,plan,work=false) => {
    if(!plan||plan.id!==id||(work?plan.kind!=='works':!['record','drafts'].includes(plan.kind)))fail('NARRATIVE_VERSION_CONFLICT');
    if(removalPlan(id,plan.kind).snapshot!==plan.snapshot)fail('NARRATIVE_VERSION_CONFLICT');
  };
  return {
    scope: { ...scope }, petId, read, list,
    prepareRemoval:removalPlan,
    readDailyDraft(date,stage){return clone(dailyEnvelope(read(),date,stage));},
    assertDailyDraft(date,stage,snapshot,base){assertDaily(read(),date,stage,snapshot,base);},
    saveDailyDraft(date,stage,draft,snapshot){const state=read(),envelope=assertDaily(state,date,stage,snapshot,draft.base);if(!objectMap(draft.form)||draft.stage!==stage)fail('NARRATIVE_STORAGE_INVALID');state.dailyDrafts[envelope.slot]=clone(draft);write(state);return dailyEnvelope(state,date,stage).snapshot;},
    prepareDailyDraftRemoval(date,stage,snapshot){const state=read(),envelope=assertDaily(state,date,stage,snapshot);delete state.dailyDrafts[envelope.slot];if(state.dailyDrafts[date]?.stage===stage)delete state.dailyDrafts[date];return{key,value:clone(state)};},
    create(mode, kind) {
      const now = Date.now();
      return { id: narrativeId(), petId, namespace: scope.namespace, revision: 0, baseRevision: 0,
        mode: narrativeMode(mode), kind: kind || (narrativeMode(mode) === 'current' ? 'life' : 'letter'),
        original: '', text: '', candidate: null, media: [], title: '', tags: [], favorite: false, hidden: false,
        localDate: narrativeMode(mode) === 'current' ? localEventDate() : '', dateText: '',
        timezoneOffset: new Date().getTimezoneOffset(), createdAt: now, updatedAt: now };
    },
    saveDraft(draft) {
      assertOwned(draft); const state = read(), old = state.drafts[draft.id];
      const record = list().find(r=>r.id===draft.id);
      if(draft.baseRevision>0&&!record)fail('NARRATIVE_SOURCE_MISSING');
      if(record && record.revision !== draft.baseRevision)fail('NARRATIVE_VERSION_CONFLICT');
      if (sameDraft(old,draft)) { draft.draftVersion=draftVersion(old);return clone(draft); }
      if (draftVersion(draft) !== draftVersion(old)) fail('NARRATIVE_VERSION_CONFLICT');
      if (old && old.revision > draft.revision) fail('NARRATIVE_VERSION_CONFLICT');
      if (sameDraft(state.records[draft.id],draft)) return clone(draft);
      const saved = clone({...draft,draftVersion:draftVersion(old)+1});
      state.drafts[draft.id] = saved;write(state);
      // Advance the caller only after persistence; a failed write remains retryable.
      draft.draftVersion=saved.draftVersion;return clone(saved);
    },
    open(id) { const state = read(); const r = state.drafts[id] || list().find(r => r.id === id); return r ? clone({ ...r, baseRevision: r.baseRevision ?? r.revision }) : null; },
    save(draft) {
      assertOwned(draft);
      if(draft.careSourceId && !list().some(r=>r.id===draft.careSourceId && r.id!==draft.id)) fail('CARE_SOURCE_MISSING');
      const health = draft.dailyVersion && (draft.careSourceId && ['observing','changed','visited','recovered','none'].includes(draft.careStatus) || draft.mood || draft.type || draft.events?.length || draft.note?.trim() || Object.values(draft.healthValues || {}).some(v => v?.text?.trim()));
      if (!draft.original.trim() && !draft.media.length && !health) fail('NARRATIVE_EMPTY');
      if (draft.media.length > 4) fail('NARRATIVE_MEDIA_LIMIT');
      if (draft.localDate && !validLocalDate(draft.localDate)) fail('NARRATIVE_DATE_INVALID');
      const eventTime = draft.eventTime ? normalizeEventTime(draft.eventTime, draft.localDate) : null;
      if (draft.media.some(m => !m.id || !m.durable || m.namespace !== scope.namespace || m.petId !== petId)) fail('NARRATIVE_MEDIA_NOT_PERSISTED');
      const state = read(), old = list().find(r => r.id === draft.id);
      if(!old&&draft.baseRevision>0)fail('NARRATIVE_SOURCE_MISSING');
      if (old && old.revision !== draft.baseRevision) fail('NARRATIVE_VERSION_CONFLICT');
      if (draftVersion(draft) !== draftVersion(state.drafts[draft.id])) fail('NARRATIVE_VERSION_CONFLICT');
      const saved = clone({ ...draft, draftVersion:0, text: draft.text || draft.original, revision: Math.max(draft.revision, old?.revision || 0) + 1, updatedAt: Date.now() });
      if (eventTime) { saved.eventTime = eventTime; saved.localDate = eventTime.localDate || ''; saved.dateText = eventTimeLabel(saved); }
      saved.baseRevision = saved.revision;
      state.records[draft.id] = saved; delete state.drafts[draft.id]; write(state); return clone(saved);
    },
    remove(id, removeSnapshots = false, plan) {
      if(plan!==undefined)assertRemoval(id,plan);
      const state = read(),mode=id.startsWith('legacy:')?(list().find(r=>r.id===id)?.mode||state.drafts[id]?.mode||'current'):null;
      for(const draftKey of dailyRemovalKeys(state,id,mode))delete state.dailyDrafts[draftKey];
      delete state.records[id]; delete state.drafts[id]; delete state.recordMeta[id];
      const matches = sourceMatches(id);
      for (const [key,c] of Object.entries(state.compositions)) if (c.config?.sourceRefs?.some(matches)) delete state.compositions[key];
      for (const [draftId,draft] of Object.entries(state.drafts)) if(draft.generatedRecipe && draft.sourceRefs?.some(matches))delete state.drafts[draftId];
      if (removeSnapshots) for (const [workId, w] of Object.entries(state.works)) if ((w.sources||[]).some(matches)) delete state.works[workId];
      // Auto recipes retain IDs only; deleted private text is never cached in rewards.
      if (id.startsWith('legacy:')) {
        const map = legacyMap();
        delete map[id.slice(7)];
        // The old record and its creative references live in separate keys.
        // Journal both writes so disk failure cannot leave half a deletion.
        storage.atomicBatch(scope, [
          { key: `pet_diaries_${petId}`, value: map },
          { key, value: clone(state) }
        ]);
        return;
      }
      write(state);
    },
    readCompositionDraft(draftKey) {
      if(typeof draftKey!=='string'||!draftKey)fail('NARRATIVE_STORAGE_INVALID');
      const draft=read().compositions[draftKey]??null;
      if(draft!==null&&(!objectMap(draft)||!objectMap(draft.config)||draft.payload!=null&&!objectMap(draft.payload)))fail('NARRATIVE_STORAGE_INVALID');
      return {draft:clone(draft),snapshot:JSON.stringify(draft)};
    },
    saveCompositionDraft(draftKey,draft,snapshot) {
      if(typeof draftKey!=='string'||!draftKey||typeof snapshot!=='string'||!objectMap(draft)||!objectMap(draft.config)||draft.payload!=null&&!objectMap(draft.payload))fail('NARRATIVE_STORAGE_INVALID');
      const state=read(),current=state.compositions[draftKey]??null,currentSnapshot=JSON.stringify(current),next=JSON.stringify(draft);
      if(currentSnapshot===next)return next;
      if(currentSnapshot!==snapshot)fail('NARRATIVE_VERSION_CONFLICT');
      state.compositions[draftKey]=clone(draft);write(state);return next;
    },
    saveCompositionWork(work, draftKey, expectedDraft) {
      assertOwned(work);
      if(!work.id || typeof draftKey!=='string' || !draftKey || !objectMap(expectedDraft))fail('NARRATIVE_STORAGE_INVALID');
      const state=read(),old=state.works[work.id];
      const body=value=>{const {savedAt,...rest}=value;return JSON.stringify(rest);};
      const matches=JSON.stringify(state.compositions[draftKey])===JSON.stringify(expectedDraft);
      const draftRetained=!!state.compositions[draftKey]&&!matches;
      if(old){if(body(old)!==body(work))fail('NARRATIVE_VERSION_CONFLICT');return {work:clone(old),draftRetained};}
      const saved=clone({...work,savedAt:Date.now()});
      state.works[saved.id]=saved;
      if(matches)delete state.compositions[draftKey];
      write(state);return {work:clone(saved),draftRetained};
    },
    saveWork(work) {
      assertOwned(work); const state = read();
      const saved = clone({ ...work, id: work.id || narrativeId(), savedAt: Date.now() });
      state.works[saved.id] = saved; write(state); return saved;
    },
    removeWork(id,plan) { if(plan!==undefined)assertRemoval(id,plan,true);const state = read(); delete state.works[id]; write(state); },
    setMetadata(id, patch) {
      if (!list().some(r=>r.id===id)) fail('NARRATIVE_SOURCE_MISSING');
      const state=read(),allowed=['tags','favorite','hidden','milestone'];
      state.recordMeta[id]={...(state.recordMeta[id]||{}),...Object.fromEntries(Object.entries(patch).filter(([k])=>allowed.includes(k)))};
      write(state);
    },
    updateSection(section, value) {
      if (!['receipts', 'proposals', 'followups','mediaGarbage','dailyDrafts','compositions'].includes(section)) fail('NARRATIVE_SECTION_INVALID');
      const state = read(); state[section] = clone(value); write(state);
    }
  };
}
export function getNarrativeStore(petId, scope = captureDataScope()) { return createNarrativeStore(scopedStorage, scope, petId); }
