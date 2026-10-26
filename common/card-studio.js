import {CARD_MATRIX,resolveComposition} from './card-composition.js';
export const copyComposition = value => JSON.parse(JSON.stringify(value));
export const studioVersion = id => ['day','daily_record','letter'].includes(id) ? 6 : 4;
export function proposeTemplate(source, active, id) {
  const config=copyComposition(active);config.template={id,version:studioVersion(id)};
  const result=resolveComposition(source,config);
  return {config,result,requiresConfirmation:result.conflicts.length>0 || active.presentation.seal.placement==='free' && id!==active.template.id};
}
// Called only after the user confirms the listed omissions and exact text.
export function textVariant(source, active, id, text) {
  if (!['quote','letter','habit'].includes(id)||!text.trim()) throw Error('CARD_SELECT_TEXT');
  const config=copyComposition(active), template=CARD_MATRIX.find(t=>t.id===id);
  config.template={id,version:studioVersion(id)};
  for(const key of Object.keys(source.fields)) if(!template.modules.includes(key))config.requested[key]='hide';
  const key='text.'+id;
  config.custom[key]={text,ref:{recordId:'work-text',revision:active.revision+1,fieldPath:key}};
  config.requested[key]='show';
  return config;
}
// Compare selected output, not unrelated revisions/fields in the original record.
export function selectedContentKey(payload) {
  return JSON.stringify(payload,(key,value)=>['source','revision','sourceRefs'].includes(key)?undefined:value);
}
export function sourceWasRemoved(before, after) {
  return before.refs.some(ref=>!after.refs.some(row=>row.recordId===ref.recordId));
}
export function examplePayload(id) {
  const key=id==='letter'?'text.letter':id==='quote'?'text.quote':id==='habit'?'text.habit':'text.life';
  return {templateId:id,templateVersion:studioVersion(id),mode:'current',title:id==='letter'?'': '平常的一天',dateText:id==='letter'?'':'事件日期 · 某个午后',salutation:id==='letter'?'给你：':'',blocks:[{key,text:'一起走过的小路，今天又开了花。',label:'生活片段',health:false}],media:['day','collage'].includes(id)?Array.from({length:id==='collage'?2:1},()=>({width:600,height:850})):[],presentation:{ruleLines:true},example:true};
}
