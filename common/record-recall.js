import {safeForRecall} from './record-views.js';
import {localEventDate,validLocalDate,narrativeMode} from './narrative-store.js';

// Recomputed from current originals. No text, image or generated answer cache.
export function recallCandidate(records,{namespace,petId,mode='current',enabled=false,manual=false,snoozedUntil='',today=localEventDate()}={}){
 if(!manual&&(!enabled||narrativeMode(mode)==='deceased'||snoozedUntil>=today))return null;
 const rows=records.filter(r=>r.namespace===namespace&&r.petId===petId&&safeForRecall(r)&&(mode==='deceased'||r.mode==='current')&&(!r.localDate||r.localDate<today));
 const anniversary=r=>validLocalDate(r.localDate)&&(!r.eventTime||['day','exact'].includes(r.eventTime.precision))&&Number(today.slice(0,4))-Number(r.localDate.slice(0,4))===1&&r.localDate.slice(5)===today.slice(5);
 rows.sort((a,b)=>Number(anniversary(b))-Number(anniversary(a))||Number(!!b.favorite)-Number(!!a.favorite)||(b.localDate||'').localeCompare(a.localDate||'')||a.id.localeCompare(b.id));
 const row=rows[0];return row?{recordId:row.id,revision:row.revision,label:anniversary(row)?'去年今天':'以前的一个日子'}:null;
}
