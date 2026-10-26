import { getConsultationRecords } from './consultation-store.js';
import { localEventDate } from './narrative-store.js';
const statuses=['none','recovered','changed','visited'];
const fail=code=>{throw Object.assign(new Error(code),{code});};
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const observation=entry=>object(entry)&&(typeof entry.note==='string'||typeof entry.status==='string'||Number(entry.at)>0);
function followupRecord(follows,id){
  const value=follows?.[id];if(value===undefined)return {};
  if(!object(value)||'entries'in value&&(!Array.isArray(value.entries)||value.entries.some(entry=>!object(entry))))fail('CARE_STORAGE_INVALID');
  return value;
}
export function getCareFollowupDraft(follows,id){
  const draft=followupRecord(follows,id).draft;if(draft===undefined)return null;
  if(!object(draft)||draft.version!==1||draft.sourceId!==id||typeof draft.token!=='string'||!draft.token||!statuses.includes(draft.status)||typeof draft.note!=='string'||draft.note.length>2000)fail('CARE_STORAGE_INVALID');
  return {...draft};
}
function validateSource(store,id,status,note,readRecords){
  if(!statuses.includes(status)||!readRecords(store.petId).some(r=>r.id===id))fail('CARE_SOURCE_MISSING');
  if(typeof note!=='string'||note.length>2000)fail('CARE_FOLLOWUP_TOO_LONG');
}
function checkDraft(follows,id,expectedToken){
  const draft=getCareFollowupDraft(follows,id);if((draft?.token||'')!==expectedToken)fail('CARE_DRAFT_CHANGED');return draft;
}
export function careFollowupHistory(follows,id) {
  const value=followupRecord(follows,id);
  return (Array.isArray(value.entries)?value.entries:[value])
    .filter(entry=>observation(entry) && (!entry.sourceId || entry.sourceId===id))
    .map(({draft,...entry},index)=>({...entry,key:entry.id||`${id}:legacy:${index}`}))
    .reverse()
    .sort((a,b)=>(Number(b.at)||0)-(Number(a.at)||0));
}
export function saveCareFollowup(store,id,status,note,readRecords=getConsultationRecords,options={}) {
  note=String(note||'');validateSource(store,id,status,note,readRecords);
  if(status==='none'&&!String(note||'').trim())throw new Error('CARE_FOLLOWUP_EMPTY');
  const follows=store.read().followups;
  const expected=options.expectedDraftToken||'',prior=careFollowupHistory(follows,id);
  // If storage committed but the caller lost confirmation, the same draft cannot
  // manufacture a second observation on retry.
  if(expected&&prior.some(row=>row.id==='follow_'+expected&&row.status===status&&row.note===note))return follows[id];
  checkDraft(follows,id,expected);
  const entry={id:expected?'follow_'+expected:`follow_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,sourceId:id,status,note,at:Date.now(),localDate:localEventDate(),timezoneOffset:new Date().getTimezoneOffset()};
  const entries=prior.reverse().map(({key,...row})=>row);
  // The formal observation and removal of its draft share a single bound write.
  follows[id]={...entry,entries:[...entries,entry]};
  store.updateSection('followups',follows);return follows[id];
}
export function saveCareFollowupDraft(store,id,status,note,expectedToken,readRecords=getConsultationRecords){
  validateSource(store,id,status,note,readRecords);const follows=store.read().followups;checkDraft(follows,id,expectedToken);
  if(status==='none'&&!note.trim()){discardCareFollowupDraft(store,id,expectedToken);return null;}
  const draft={version:1,sourceId:id,token:Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,12),status,note,updatedAt:Date.now()};
  follows[id]={...followupRecord(follows,id),draft};store.updateSection('followups',follows);return {...draft};
}
export function discardCareFollowupDraft(store,id,expectedToken){
  const follows=store.read().followups,draft=checkDraft(follows,id,expectedToken);if(!draft)return;
  const {draft:ignored,...record}=followupRecord(follows,id);if(Object.keys(record).length)follows[id]=record;else delete follows[id];store.updateSection('followups',follows);
}
