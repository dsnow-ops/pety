import {normalizeSealTransform} from './seal-transform.js';
import {resolveRecordRecipe} from './record-work-recipes.js';
import {DAILY_HEALTH} from './daily-record-fields.js';
export const CARD_FIELDS={
 'text.life':'生活片段','text.observation':'手写观察','text.notes':'其他备注','text.letter':'写给它的话','text.quote':'这一句话','text.habit':'它的小习惯','health.overall':'当日所选状态','state.petObserved':'宠物当时的表现','state.ownerMood':'我当时的心情','health.items':'健康项目摘要','health.eventTags':'记录过的事件','media.photos':'照片','media.photoCaptions':'照片说明','media.petPortrait':'已有宠物形象','identity.petName':'宠物名字','identity.title':'标题','date.display':'日期','identity.salutation':'称呼','identity.signature':'署名','identity.topicTags':'小标签'
};
export const SENSITIVE=new Set(['text.observation','text.notes','health.overall','state.petObserved','state.ownerMood','health.items','health.eventTags']);
const common=['identity.petName','identity.title','date.display','media.photos','media.petPortrait'];
const t=(id,name,modules,maxPhotos,healthLimit,pages,required)=>({id,name,version:4,modules:[...common.filter(k=>id!=='collage'||k!=='media.petPortrait'),...modules],maxPhotos,healthLimit,pages,required,sealPositions:['right','left'],sealSizes:['small','standard']});
export const CARD_MATRIX=[
 t('day','照片明信片',['text.life','text.observation','text.notes','health.overall','state.petObserved','state.ownerMood','health.items','health.eventTags','identity.topicTags','media.photoCaptions'],1,3,false,'photo'),
 t('daily_record','今日记录卡',['text.life','text.observation','text.notes','health.overall','state.petObserved','state.ownerMood','health.items','health.eventTags','identity.topicTags','media.photoCaptions'],1,12,true,'body'),
 t('quote','一句话',['text.quote'],1,0,false,'quote'),
 t('letter','写给你的信',['text.letter','identity.salutation','identity.signature','state.ownerMood'],1,0,true,'letter'),
 t('habit','它的小习惯',['text.habit','state.petObserved','state.ownerMood','identity.topicTags','media.photoCaptions'],1,0,false,'habit'),
 t('date','那一天',['text.life','text.observation','text.notes','health.overall','state.petObserved','state.ownerMood','health.items','health.eventTags','identity.topicTags','media.photoCaptions'],1,3,false,'date'),
 t('collage','几个片段',['text.life','text.notes','health.overall','state.petObserved','state.ownerMood','identity.topicTags','media.photoCaptions'],4,0,false,'collage')
];
const clone=v=>JSON.parse(JSON.stringify(v));
export function adaptCardSource(record,{kind='health',petId,namespace,id,date}={}){
 const fields={},revision=Number(record.revision||record.updatedAt||0),recordId=id||record.id||('health:'+date),eventDateLabel=date||record.localDate||record.dateText||'';
 const add=(key,path,value,extra={})=>{if(value===undefined||value===null||value==='')return;(fields[key]||=[]).push({value,ref:{recordId,revision,fieldPath:path,eventDateLabel},...extra});};
 if(kind==='health'){
  add('text.life','lifeText',record.lifeText,{candidate:record.lifeEditedText||null});add('text.observation','note',record.note,{health:true});add('text.letter','memoryText',record.memoryText);
  const moods={good:'轻松',calm:'平稳',tired:'疲惫',uneasy:'不安',sick:'不适'};add('health.overall','mood',record.mood?(moods[record.mood]||record.mood):'',{label:'当日所选状态',health:true});
  for(const h of DAILY_HEALTH){const v=record.healthValues?.[h.key];if(v?.text?.trim())add('health.items','healthValues.'+h.key,v.text,{key:h.key,label:h.label,date:v.date||date,health:true});}
  const tags=[...new Set([record.type,...(record.events||[])].filter(Boolean))];tags.forEach(key=>add('health.eventTags','events.'+key,DAILY_HEALTH.find(h=>h.legacy===key)?.label||({appetite_good:'食欲正常',appetite_low:'食欲下降',water_more:'饮水增多',stool_normal:'排便正常',stool_soft:'软便',diarrhea:'腹泻',vomit:'呕吐',cough:'咳嗽',itch:'抓挠',lethargy:'精神差',vaccine:'疫苗 / 驱虫'})[key]||key,{key,label:'记录类别',health:true}));
 }else{const body=record.kind==='letter'||record.kind==='memory'?'text.letter':'text.life';add(body,'original',record.original,{candidate:record.adoptedCandidate&&record.text?record.text:null});}
 add('identity.title','title',record.title);add('identity.salutation','salutation',record.salutation);add('identity.signature','signature',record.signature);
 add('state.ownerMood','ownerMood',record.ownerMood);add('state.petObserved','petObserved',record.petObserved);
 (record.tags||[]).forEach((value,i)=>add('identity.topicTags','tags.'+i,value));
 for(const m of record.media||[])if(m.namespace===namespace&&m.petId===petId&&m.durable){add(m.sourceKind==='portrait'?'media.petPortrait':'media.photos','media.'+m.id,m);if(m.caption)add('media.photoCaptions','media.'+m.id+'.caption',m.caption);}
 return {petId,namespace,fields,ref:{recordId,revision,eventDateLabel}};
}
export function combineCardSources(sources,pet,scope,mode='current'){
 if(sources.some(s=>s.petId!==pet.id||s.namespace!==scope.namespace))throw Error('CARD_SOURCE_OWNER');
 const fields={};sources.forEach(s=>Object.entries(s.fields).forEach(([k,v])=>fields[k]=[...(fields[k]||[]),...v]));
 fields['identity.petName']=[{value:pet.name,ref:{recordId:pet.id,revision:Number(pet.updatedAt||0),fieldPath:'name'}}];
 const date=sources.find(s=>s.ref.eventDateLabel)?.ref.eventDateLabel;if(date)fields['date.display']=[{value:date,ref:{recordId:'event-date',revision:0,fieldPath:'eventDate'},label:'事件日期'}];
 return {petId:pet.id,namespace:scope.namespace,mode,fields,refs:sources.map(s=>s.ref),seal:pet.petSeal||null};
}
export function createComposition(source,id='day'){
 return {configVersion:1,petId:source.petId,namespace:source.namespace,mode:source.mode,template:{id,version:4},requested:{},selections:{fields:{},healthKeys:[],photoIds:[],textVersions:{}},custom:{},sourceRefs:clone(source.refs),presentation:{ruleLines:['day','daily_record','letter','habit'].includes(id),illustrationId:null,paperTextureId:null,photoFrameId:'none',footerBrand:false,seal:{enabled:false,style:'vermilion',placement:'right',size:'standard'}},revision:0};
}
export function resolveComposition(source,c){
 if(source.petId!==c.petId||source.namespace!==c.namespace)throw Error('CARD_SOURCE_OWNER');
 if(c.recipe)return resolveRecordRecipe(source,c);
 const template=CARD_MATRIX.find(t=>t.id===c.template.id);if(!template)throw Error('CARD_TEMPLATE_INVALID');
 const conflicts=[],states={},blocks=[],media=[],seen=new Set(),payload={templateId:template.id,templateVersion:[5,6].includes(c.template.version)?c.template.version:4,mode:c.mode,blocks,media,presentation:clone(c.presentation)};
 const rowsFor=key=>{if(['text.letter','text.quote','text.habit','identity.salutation','identity.signature'].includes(key)&&c.custom[key]?.text)return [{value:c.custom[key].text,ref:c.custom[key].ref||{recordId:'work-text',revision:c.revision,fieldPath:key}}];return source.fields[key]||[];};
 for(const key of Object.keys(CARD_FIELDS)){
  let rows=rowsFor(key);const selected=c.selections.fields[key];if(selected)rows=rows.filter(r=>selected.includes(JSON.stringify(r.ref)));if(key==='health.items')rows=rows.filter(r=>c.selections.healthKeys.includes(r.key));
  if(key==='media.photos'||key==='media.petPortrait')rows=rows.filter(r=>c.selections.photoIds.includes(r.value.id)).sort((a,b)=>c.selections.photoIds.indexOf(a.value.id)-c.selections.photoIds.indexOf(b.value.id));if(key==='media.photoCaptions')rows=rows.filter(r=>c.selections.photoIds.some(id=>r.ref.fieldPath==='media.'+id+'.caption'));
  const choice=c.requested[key]||'auto';const ordinary=['text.life','text.letter','text.quote','text.habit','identity.petName','identity.title','identity.salutation','media.photos'].includes(key)||key==='date.display'&&c.mode!=='deceased'&& !['quote'].includes(template.id);
  const show=choice==='show'||choice==='auto'&&ordinary&&template.modules.includes(key);
  if(!show){states[key]='hidden';continue;}
  if(!template.modules.includes(key)){states[key]='unsupported';conflicts.push({key,message:CARD_FIELDS[key]+'不适合这个版式'});continue;}
  if(!rows.length){states[key]=key==='health.items'&&choice==='show'?'needsReview':'empty';if(states[key]==='needsReview')conflicts.push({key,message:'请选择要展示的具体健康项目'});continue;}
  states[key]='visible';if(key==='health.items'&&rows.length>template.healthLimit)conflicts.push({key,message:'该版式最多放 '+template.healthLimit+' 个健康项目，请换今日记录卡或自行减少选择'});
  if(key==='identity.topicTags'&&template.id!=='daily_record'&&rows.length>2)conflicts.push({key,message:'该版式最多放 2 个生活标签，请明确选择或换今日记录卡'});if(template.id==='collage'&&['health.overall','state.petObserved'].includes(key)&&rows.length>1)conflicts.push({key,message:'拼贴中这一状态只放 1 项，请明确选择来源'});
  if(key==='health.eventTags'&&template.id!=='daily_record'&&rows.length>2)conflicts.push({key,message:'该版式最多放 2 个事件类别，请换今日记录卡'});
  for(const row of rows){const unique=JSON.stringify(row.ref);if(seen.has(unique)){states[key]='included';continue;}seen.add(unique);
   if(key==='media.photos'||key==='media.petPortrait'){if(!media.some(m=>m.id===row.value.id))media.push(Object.fromEntries(Object.entries(clone(row.value)).filter(([k])=>['id','namespace','petId','durable','key','path','width','height','fit','cropX','cropY'].includes(k))));continue;}
   if(key==='identity.petName'){payload.petName=row.value;continue;}if(key==='identity.title'){payload.title=row.value;continue;}
   if(key==='date.display'){payload.dateText=(c.dateKind==='written'?'书写日期 · ':'事件日期 · ')+(c.dateKind==='written'?c.writtenDate:row.value);continue;}
   if(key==='identity.salutation'){payload.salutation=row.value;continue;}if(key==='identity.signature'){payload.signature=row.value;continue;}
   const value=c.selections.textVersions[key]==='acceptedCandidate'&&row.candidate?row.candidate:row.value;
   blocks.push({key,text:String(value),label:row.label||CARD_FIELDS[key],health:row.health===true,date:row.date||row.ref.eventDateLabel||'',source:clone(row.ref)});
  }
 }
 if(media.length>template.maxPhotos)conflicts.push({key:'media.photos',message:'这个版式只容纳 '+template.maxPhotos+' 张照片；请明确选图或换拼贴'});
 if(template.required==='photo'&&media.length!==1)conflicts.push({key:'media.photos',message:'明信片需要明确选择一张照片；也可以换文字模板'});
 if(template.required==='collage'&&(media.length<2||media.length>4))conflicts.push({key:'media.photos',message:'拼贴需要 2–4 张不同照片，不会复制补满'});
 if(['quote','letter','habit'].includes(template.required)&&!blocks.some(b=>b.key==='text.'+template.required))conflicts.push({key:'text.'+template.required,message:'请明确选择'+CARD_FIELDS['text.'+template.required]+'作为正文'});
 if(template.required==='date'&&(c.dateKind==='written'||!payload.dateText||(!payload.title&&!blocks.length&&!media.length)))conflicts.push({key:'date.display',message:'那一天需要事件日期，以及标题、文字或照片'});
 if(template.required==='body'&&!blocks.length)conflicts.push({key:'body',message:'今日记录卡需要至少一项正文或健康观察；照片可换明信片'});
 if(!blocks.length&&!media.length&&!(template.id==='date'&&payload.title&&payload.dateText))conflicts.push({key:'body',message:'请选择有内容的正文、健康项目或照片；名字与印记本身不构成作品'});
 if(payload.presentation.seal.enabled){if(!source.seal)conflicts.push({key:'seal',message:'请先在宠物档案制作并确认专属印记'});else if(!payload.petName&&source.seal.containsName!==false)conflicts.push({key:'seal',message:'旧印记尚未确认不含名字，请关闭印记或在档案重制无名字版'});else payload.seal={asset:{version:source.seal.version,width:source.seal.width,height:source.seal.height,pixels:[...source.seal.pixels]},enabled:true,style:c.presentation.seal.style,...(c.presentation.seal.placement==='free'?normalizeSealTransform(c.presentation.seal):{}),position:c.presentation.seal.placement,size:c.presentation.seal.size==='small'?'small':'medium'};}
 // Health source dates and non-diagnosis text belong to the content, not decorative footer settings.
 const health=blocks.filter(b=>b.health);if(health.length)payload.healthNotice=(c.mode==='deceased'?'历史主人记录节选':'主人记录节选')+' · '+[...new Set(health.map(b=>b.date||'时间未记录'))].join(' / ')+' · 非诊断';
 return {payload,states,conflicts,template};
}
