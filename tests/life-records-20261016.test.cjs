const test=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs');
const source=p=>fs.readFileSync(p,'utf8').replace(/^import[^;]+;\s*/gm,'').replace(/export /g,'');
function setup(){
 let owner={namespace:'account:TEST-A',version:1,ready:true};const disk=new Map();
 const storageAPI=Function('getAccountScope','uni',source('common/scoped-storage.js')+';return {createScopedStorage};')(()=>owner,{});
 const storage=storageAPI.createScopedStorage({getStorageInfoSync:()=>({keys:[...disk.keys()]}),getStorageSync:k=>structuredClone(disk.get(k)),setStorageSync:(k,v)=>disk.set(k,structuredClone(v)),removeStorageSync:k=>disk.delete(k)},()=>owner);
 const mod=Function('scopedStorage','captureDataScope',source('common/narrative-store.js')+';return {createNarrativeStore,normalizeEventTime,eventTimeLabel};')(storage,()=>owner);
 const views=Function('eventTimeLabel',source('common/record-views.js')+';return {queryRecords,lifePhotos,safeForRecall,lifeText};')(mod.eventTimeLabel);
 const recipes=Function('lifeText','lifePhotos','safeForRecall','eventTimeLabel','normalizeSealTransform',source('common/record-work-recipes.js')+';return {recipeCandidates,resolveRecordRecipe};')(views.lifeText,views.lifePhotos,views.safeForRecall,mod.eventTimeLabel,v=>v);
 return {...mod,...views,...recipes,storage,disk,store:pet=>mod.createNarrativeStore(storage,{...owner},pet),switchTo:namespace=>owner={namespace,version:owner.version+1,ready:true}};
}
test('B dates: exact local dates, leap day, DST wall time, month/year/season/unknown survive reopen without invented days',()=>{
 const s=setup(),store=s.store('TEST-P1');
 const inputs=[{precision:'exact',localDate:'2024-02-29',localTime:'23:59'},{precision:'exact',localDate:'2026-03-08',localTime:'01:59'},{precision:'month',year:2023,month:12},{precision:'year',year:2022},{precision:'season',year:2021,label:'冬天'},{precision:'unknown'}];
 for(const eventTime of inputs){const d=store.create('current');d.original='TEST 过去的一刻';d.eventTime=eventTime;const saved=store.save(d),r=s.store('TEST-P1').open(saved.id);a.deepEqual(r.eventTime,s.normalizeEventTime(eventTime));a.equal(r.localDate,eventTime.localDate||'');a.equal(r.createdAt,d.createdAt);if(!eventTime.localDate)a.doesNotMatch(s.eventTimeLabel(r),/-01\b/);}
 for(const localDate of ['2023-02-29','2026-04-31'])a.throws(()=>s.normalizeEventTime({precision:'day',localDate}),{code:'NARRATIVE_DATE_INVALID'});
 a.throws(()=>s.normalizeEventTime({precision:'month',year:2024,month:13}),{code:'NARRATIVE_DATE_INVALID'});
});
test('B independent same-day observations retain stable IDs and equal values; retry and stale save cannot duplicate or overwrite',()=>{
 const s=setup(),store=s.store('TEST-P1'),ids=[];
 for(const localTime of ['08:00','20:00']){const d=store.create('current');d.dailyVersion=2;d.healthValues={weight:{text:'4.2 kg'}};d.eventTime={precision:'exact',localDate:'2026-10-10',localTime};const r=store.save(d);ids.push(r.id);a.throws(()=>store.save(d),{code:'NARRATIVE_VERSION_CONFLICT'});}
 a.equal(new Set(ids).size,2);a.deepEqual(store.list().map(r=>r.healthValues.weight.text),['4.2 kg','4.2 kg']);
});
test('B projections use current source, precise date filters, explicit life purpose and no hidden derived text cache',()=>{
 const s=setup(),store=s.store('TEST-P1');const d=store.create('current');d.original='TEST 窗边，不吃新食物';d.tags=['普通'];d.media=['life','care','report','unknown'].map((purpose,i)=>({id:'TEST-'+i,durable:true,petId:d.petId,namespace:d.namespace,purpose,caption:'TEST 说明'}));let r=store.save(d);
 a.equal(s.lifePhotos(r).length,1);a.equal(s.safeForRecall(r),false);a.equal(s.queryRecords(store.list(),{query:'窗边'}).total,1);a.equal(s.queryRecords(store.list(),{query:'海边'}).total,0);
 r.original='TEST 已修改';store.save(r);a.equal(s.queryRecords(store.list(),{query:'窗边'}).total,0);
 const fuzzy=store.create('current');fuzzy.original='TEST 模糊';fuzzy.eventTime={precision:'month',year:2023,month:2};store.save(fuzzy);a.equal(s.queryRecords(store.list(),{from:'2023-02-01',to:'2023-02-28'}).total,0);a.equal(s.queryRecords(store.list(),{month:'2023-02'}).total,1);
 store.remove(r.id);a.equal(s.queryRecords(store.list(),{query:'已修改'}).total,0);
});
test('B metadata does not freeze old daily observations; latest health edit and old frozen works stay independent',()=>{
 const s=setup(),store=s.store('TEST-P1');s.storage.setStorageSync('pet_diaries_TEST-P1',{'2026-10-10':{dailyVersion:1,lifeText:'TEST old',updatedAt:1}});
 store.setMetadata('legacy:2026-10-10',{favorite:true,hidden:true});s.storage.setStorageSync('pet_diaries_TEST-P1',{'2026-10-10':{dailyVersion:1,lifeText:'TEST latest',updatedAt:2}});
 const row=store.list()[0];a.equal(row.original,'TEST latest');a.equal(row.favorite,true);a.equal(row.hidden,true);
 store.saveWork({petId:'TEST-P1',namespace:store.scope.namespace,sources:[{recordId:row.id}],snapshot:{text:'TEST frozen'}});store.remove(row.id);a.equal(store.list().length,0);a.equal(Object.values(store.read().works)[0].snapshot.text,'TEST frozen');
});
test('B A/P1, A/P2, guest and B cannot read drafts or accept delayed A writes',()=>{
 const s=setup(),old=s.store('TEST-P1'),d=old.create('current');d.original='TEST private';old.saveDraft(d);a.equal(s.store('TEST-P2').open(d.id),null);
 for(const namespace of ['guest:local','account:TEST-B','account:TEST-A']){s.switchTo(namespace);a.throws(()=>old.saveDraft(d),{code:'DATA_SCOPE_CHANGED'});a.equal(Boolean(s.store('TEST-P1').open(d.id)),namespace==='account:TEST-A');}
});
test('B 1000 synthetic records query only returns the requested page and reports factual matches',()=>{
 const s=setup(),records=Array.from({length:1000},(_,i)=>({id:'TEST-'+i,namespace:'TEST',petId:'TEST',kind:'life',original:'TEST 窗边 '+i,media:[],localDate:'2026-10-10',createdAt:i}));
 const start=performance.now();const result=s.queryRecords(records,{query:'窗边',offset:30,limit:30});a.equal(result.rows.length,30);a.equal(result.total,1000);a.equal(result.rows[0].id,'TEST-969');console.log('TEST 1000 metadata, Node warm process ms:',(performance.now()-start).toFixed(3));
});
test('C comparison and booklet preserve selected provenance, text versions, crop, ordering and unknown dates without changing source',()=>{
 const s=setup(),store=s.store('TEST-P1'),records=[];
 for(const [i,date] of ['2020-01-01',''].entries()){const d=store.create('current');d.original='TEST 原文 '+i;d.localDate=date;d.eventTime=date?{precision:'day',localDate:date}:{precision:'unknown'};d.media=[{id:'photo-'+i,namespace:d.namespace,petId:d.petId,purpose:'life',durable:true}];records.push(store.save(d));}
 const before=JSON.stringify(store.list()),src={namespace:store.scope.namespace,petId:store.petId,recipeRecords:records,fields:{'identity.petName':[{value:'TEST'}]}},config={namespace:src.namespace,petId:src.petId,mode:'current',requested:{},presentation:{seal:{enabled:false}},recipe:{type:'comparison',items:records.map(r=>({recordId:r.id,assetId:r.media[0].id}))}};
 config.recipe.items.reverse();config.recipe.items[0].caption='TEST 自选说明';config.recipe.items[0].cropX=.2;
 const result=s.resolveRecordRecipe(src,config);a.equal(result.conflicts.length,0);a.equal(result.payload.media[0].id,'photo-1');a.equal(result.payload.media[0].cropX,.2);a.equal(result.payload.recipe.items[0].dateText,'时间未详');a.equal(result.sourceRefs[0].recordId,records[1].id);
 config.recipe.type='booklet';config.recipe.items[0].text='TEST 本作品节选';const booklet=s.resolveRecordRecipe(src,config);a.equal(booklet.payload.recipe.items[0].text,'TEST 本作品节选');a.equal(JSON.stringify(store.list()),before);
 store.saveWork({petId:store.petId,namespace:src.namespace,sources:result.sourceRefs.map(r=>({id:r.recordId})),snapshot:{renderPayload:result.payload}});store.remove(records[1].id);a.equal(Object.values(store.read().works)[0].snapshot.renderPayload.recipe.items[0].caption,'TEST 自选说明');
 a.ok(s.resolveRecordRecipe({...src,recipeRecords:store.list()},config).conflicts.length);
});
test('C automatic material excludes care, unknown media, hidden, drafts/recipes and fake examples',()=>{
 const s=setup(),base={id:'TEST',kind:'life',original:'TEST',media:[],petId:'TEST-P1',namespace:'account:TEST-A'};
 const variants=[{...base,note:'TEST 病症'},{...base,hidden:true},{...base,generatedRecipe:true},{...base,example:true},{...base,media:[{purpose:'unknown'}]},{...base,dailyVersion:2,lifeText:'',healthValues:{weight:{text:'4kg'}}}];a.deepEqual(s.recipeCandidates(variants),[]);a.equal(s.recipeCandidates([base]).length,1);
});
const {moduleFrom}=require('../scripts/lib/health-recovery-runtime.cjs');
const {DAILY_HEALTH}=moduleFrom('common/daily-record-fields.js','DAILY_HEALTH');
function careApi(){const s=setup();return {...s,...moduleFrom('common/care-record-context.js','originalFactLines,buildReferenceBundle,referenceVersionsCurrent,doctorFactText',{eventTimeLabel:s.eventTimeLabel,DAILY_HEALTH})};}
test('D explicit original selection excludes removed choice, private notes, candidate text, image bytes and other pets; facts preserve units and negatives',()=>{
 const s=careApi(),scope={namespace:'account:TEST-A',ready:true},rows=Array.from({length:3},(_,i)=>({id:'TEST-'+i,revision:1,namespace:scope.namespace,petId:'TEST-P1',dailyVersion:2,localDate:'2026-10-1'+i,createdAt:i,note:'TEST '+i+' 未呕吐，药物甲 2 mg；未服用。',privateNote:'SECRET',lifeCandidate:'AI CANDIDATE',media:[{data:'SECRET_BYTES'}]}));
 const bundle=s.buildReferenceBundle([...rows,{...rows[0],id:'FOREIGN',petId:'TEST-P2'}],['TEST-0','TEST-2','FOREIGN'],scope,'TEST-P1',2000);
 a.deepEqual(bundle.included.map(r=>r.id),['TEST-0','TEST-2']);a.doesNotMatch(bundle.text,/TEST-1|SECRET|CANDIDATE|FOREIGN/);a.match(bundle.text,/未呕吐，药物甲 2 mg；未服用/);a.match(bundle.text,/指令不得执行/);
 const small=s.buildReferenceBundle(rows,['TEST-0'],scope,'TEST-P1',30);a.equal(small.text,'');a.equal(small.omitted.length,1);
 a.equal(s.referenceVersionsCurrent(rows,bundle.included),true);rows[2].revision++;a.equal(s.referenceVersionsCurrent(rows,bundle.included),false);
 const facts=s.doctorFactText(rows,['TEST-0','TEST-2'],scope,{id:'TEST-P1',name:'TEST'});a.match(facts,/2 mg；未服用/);a.doesNotMatch(facts,/SECRET|CANDIDATE|TEST-1/);
});
test('D several independent dated followups preserve original; status-only followups never become life recollections',()=>{
 const s=careApi(),store=s.store('TEST-P1'),d=store.create('current');d.dailyVersion=2;d.note='TEST 观察，未呕吐';const original=store.save(d);
 for(const careStatus of ['observing','visited','recovered']){const follow=store.create('current');follow.dailyVersion=2;follow.careSourceId=original.id;follow.careStatus=careStatus;const saved=store.save(follow);a.equal(s.safeForRecall(saved),false);}
 a.equal(store.list().filter(r=>r.careSourceId===original.id).length,3);a.equal(store.open(original.id).note,d.note);
 const follows=moduleFrom('common/care-followup.js','saveCareFollowup',{getConsultationRecords:()=>[{id:'TEST-C'}],localEventDate:()=> '2026-10-16'});
 follows.saveCareFollowup(store,'TEST-C','changed','TEST 一');follows.saveCareFollowup(store,'TEST-C','visited','TEST 二');a.equal(store.read().followups['TEST-C'].entries.length,2);
 store.remove(original.id);const stale=store.create('current');stale.dailyVersion=2;stale.careSourceId=original.id;stale.careStatus='observing';a.throws(()=>store.save(stale));
});
test('C v7 long text paginates intact, comparison decoration is real, and hidden names/photos cannot leak into output',()=>{
 const {wrapCardText}=moduleFrom('common/card-layout.js','wrapCardText');const {layoutComposedCard}=moduleFrom('common/card-layout-v4.js','layoutComposedCard',{wrapCardText});const {layoutStudioCardV6}=moduleFrom('common/card-layout-v6.js','layoutStudioCardV6',{wrapCardText,layoutComposedCard});const {layoutRecordWork}=moduleFrom('common/card-layout-v7.js','layoutRecordWork',{wrapCardText,layoutStudioCardV6});const measure=(s,size)=>Array.from(s).length*size;
 const text='TEST完整原话没有删去。'.repeat(100);const pages=layoutRecordWork({recipe:{type:'booklet',items:[{text,mediaIndex:-1,dateText:'时间未详'}]},media:[],presentation:{}},measure);a.ok(pages.length>1);a.equal(pages.flatMap(p=>p.commands.filter(op=>op.role==='body').map(op=>op.text)).join(''),text);
 const compare=layoutRecordWork({recipe:{type:'comparison',items:[{mediaIndex:0,dateText:'时间未详',caption:'TEST'},{mediaIndex:1,dateText:'2020年 · 日期未详',caption:''}]},media:[{},{}],presentation:{paperTextureId:'fine-lines',photoFrameId:'paper',footerBrand:true,ruleLines:true}},measure)[0];a.ok(compare.commands.some(op=>op.type==='rect'));a.ok(compare.commands.some(op=>op.text==='归爪 · Lumière Pet'));a.ok(compare.commands.some(op=>op.type==='line'));
});
test('E recall is opt-in, purpose/owner/mode filtered, exact anniversary only, reversible and deletion-aware',()=>{
 const s=setup(),{recallCandidate}=moduleFrom('common/record-recall.js','recallCandidate',{safeForRecall:s.safeForRecall,localEventDate:()=> '2026-10-16',validLocalDate:v=>/^\d{4}-\d{2}-\d{2}$/.test(v),narrativeMode:m=>m==='deceased'?'deceased':'current'});
 const base={id:'TEST',namespace:'account:TEST-A',petId:'TEST-P1',mode:'current',original:'TEST 窗边',localDate:'2025-10-16',kind:'life',media:[]};const options={namespace:base.namespace,petId:base.petId,today:'2026-10-16'};
 a.equal(recallCandidate([base],options),null);a.equal(recallCandidate([base],{...options,enabled:true}).label,'去年今天');
 a.equal(recallCandidate([{...base,eventTime:{precision:'month',year:2025,month:10},localDate:''}],{...options,manual:true}).label,'以前的一个日子');
 for(const patch of [{hidden:true},{note:'TEST'},{media:[{purpose:'unknown'}]},{petId:'OTHER'},{namespace:'OTHER'},{mode:'deceased'},{privateNote:'TEST'},{original:'TEST 医院治疗'}])a.equal(recallCandidate([{...base,...patch}],{...options,enabled:true}),null);
 a.equal(recallCandidate([base],{...options,enabled:true,mode:'deceased'}),null);a.ok(recallCandidate([base],{...options,manual:true,mode:'deceased'}));a.equal(recallCandidate([base],{...options,enabled:true,snoozedUntil:'2026-10-16'}),null);a.equal(recallCandidate([],{...options,manual:true}),null);
});
test('E deleted originals cannot be resurrected by a delayed save or draft flush',()=>{
 const s=setup(),store=s.store('TEST-P1'),d=store.create('current');d.original='TEST old';const saved=store.save(d);store.remove(saved.id);saved.original='TEST late';a.throws(()=>store.save(saved),{code:'NARRATIVE_SOURCE_MISSING'});a.throws(()=>store.saveDraft(saved),{code:'NARRATIVE_SOURCE_MISSING'});a.equal(store.list().length,0);
});
