import { localEventDate, validLocalDate, narrativeMode } from './narrative-store.js';
export const COLLECTION_RULES=Object.freeze({version:1,milestones:[{key:'first',days:1},{key:'three',days:3},{key:'seven',days:7}],monthDays:3});
function safeLife(r){
 const text=r.dailyVersion?r.lifeText:r.kind!=='care'?r.original:'';
 const care=/(医院|就医|病灶|用药|药物|剂量|呕吐|腹泻|肿瘤|化验|血检|治疗|诊断|去世|离世|安乐|最后一天)/.test([r.original,r.lifeText,r.title,...(r.media||[]).map(m=>m.caption)].filter(Boolean).join(' ')) || r.privateNote?.trim() || r.kind==='care'&&!r.dailyVersion||r.careSourceId||r.careStatus||r.mood||r.type||r.note?.trim()||r.events?.length||Object.values(r.healthValues||{}).some(v=>v?.text?.trim());
 return !care&&!r.hidden&&!r.generatedRecipe&&!r.example&&!(r.media||[]).some(m=>m.purpose!=='life')&&Boolean(text?.trim()||(r.media||[]).some(m=>m.durable&&m.purpose==='life'));
}
export function eligibleLifeDays(records,today=localEventDate()) {
 const sorted=records.filter(r=>safeLife(r)&&r.mode==='current'&&validLocalDate(r.localDate)&&r.localDate<=today).sort((a,b)=>a.localDate.localeCompare(b.localDate)||Number(Boolean(b.favorite||b.milestone))-Number(Boolean(a.favorite||a.milestone))||a.createdAt-b.createdAt||a.id.localeCompare(b.id));
 const days=new Map();for(const record of sorted)if(!days.has(record.localDate))days.set(record.localDate,record);return [...days.values()];
}
export function syncCollections(store,mode,{month=false,today=localEventDate()}={}) {
 if(narrativeMode(mode)!=='current')return [];
 const records=eligibleLifeDays(store.list(),today),receipts=store.read().receipts,newKeys=[];
 for(const rule of COLLECTION_RULES.milestones)if(records.length>=rule.days){const key=`v1:${rule.key}`;if(!receipts[key]){receipts[key]={key,rule:rule.key,createdAt:Date.now()};newKeys.push(key);}}
 const thisMonth=today.slice(0,7),monthRows=records.filter(r=>r.localDate.startsWith(thisMonth));
 if(month&&receipts['v1:seven']&&monthRows.length>=COLLECTION_RULES.monthDays){const key=`v1:month:${thisMonth}`;if(!receipts[key]){receipts[key]={key,rule:'month',month:thisMonth,createdAt:Date.now()};newKeys.push(key);}}
 if(newKeys.length)store.updateSection('receipts',receipts);
 return newKeys;
}
export function collectionRecipes(store,today=localEventDate()) {
 const records=eligibleLifeDays(store.list(),today).filter(r=>!r.hidden);
 return Object.values(store.read().receipts).map(receipt=>{
  const count=COLLECTION_RULES.milestones.find(m=>m.key===receipt.rule)?.days;
  const sources=receipt.rule==='month'?records.filter(r=>r.localDate.startsWith(receipt.month)):records.slice(0,count);
  return {...receipt,sources:sources.map(r=>({id:r.id,revision:r.revision})),available:sources.length>=(receipt.rule==='month'?COLLECTION_RULES.monthDays:count||1)};
 });
}
export function lifeAtlas(records) {
 return ['habit','favoriteThing','first','ordinary'].map(key=>({key,sources:records.filter(r=>safeLife(r)&&(r.tags||[]).includes(key)).map(r=>({id:r.id,revision:r.revision,title:r.title||r.lifeText||r.original,localDate:r.localDate,legacy:r.legacy,dailyVersion:r.dailyVersion}))})).filter(c=>c.sources.length);
}
