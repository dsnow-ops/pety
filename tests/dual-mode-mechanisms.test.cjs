const fs=require('node:fs'),test=require('node:test'),assert=require('node:assert/strict');
function load(file,names,deps={}){return Function(...Object.keys(deps),fs.readFileSync(file,'utf8').replace(/^import[^;]+;\s*/gm,'').replace(/export /g,'')+';return {'+names+'};')(...Object.values(deps));}
const dates=load('common/narrative-store.js','localEventDate,validLocalDate,narrativeMode',{scopedStorage:{},captureDataScope:()=>({})});
const c=load('common/companion-collection.js','eligibleLifeDays,syncCollections,collectionRecipes,lifeAtlas',dates);
const p=load('common/companion-proposals.js','COMPANION_PROPOSALS,currentProposal,changeProposal',dates);
const care=load('common/care-followup.js','saveCareFollowup',{...dates,getConsultationRecords:()=>[]});
function setup(){const state={receipts:{},proposals:{},followups:{}};let records=[];const store={petId:'p',read:()=>structuredClone(state),updateSection:(s,v)=>state[s]=structuredClone(v),list:()=>structuredClone(records)};return{state,store,records};}
const record=(id,date,patch={})=>({id,localDate:date,createdAt:1,revision:1,kind:'life',mode:'current',original:'真实片段',media:[],tags:[],...patch});
test('first, three nonconsecutive days, seven days and monthly recipes are idempotent',()=>{
 const s=setup();for(let i=0;i<5;i++)s.records.push(record('same'+i,'2026-09-01'));c.syncCollections(s.store,'current',{today:'2026-09-28'});assert.equal(Object.keys(s.state.receipts).length,1);
 for(const d of ['04','10'])s.records.push(record(d,'2026-09-'+d));c.syncCollections(s.store,'current',{today:'2026-09-28'});assert.ok(s.state.receipts['v1:three']);
 for(const d of ['11','12','13','14'])s.records.push(record(d,'2026-09-'+d));c.syncCollections(s.store,'current',{today:'2026-09-28',month:true});assert.ok(s.state.receipts['v1:seven']);assert.ok(s.state.receipts['v1:month:2026-09']);assert.equal(c.syncCollections(s.store,'current',{today:'2026-09-28',month:true}).length,0);
 s.records.length=0;assert.ok(c.collectionRecipes(s.store).every(r=>!r.available));s.records.push(record('rebuilt','2026-09-01'));assert.equal(c.syncCollections(s.store,'current',{today:'2026-09-28'}).length,0);
});
test('future, care, memorial, recipes and empty records never count; memorial never triggers receipts',()=>{
 const s=setup();s.records.push(record('future','2099-01-01'),record('care','2026-01-01',{kind:'care'}),record('memory','2026-01-02',{mode:'deceased'}),record('recipe','2026-01-03',{generatedRecipe:true}),record('empty','2026-01-04',{original:''}));assert.equal(c.eligibleLifeDays(s.records,'2026-09-28').length,0);
 s.records.push(record('good','2026-09-27'));c.syncCollections(s.store,'deceased');assert.deepEqual(s.state.receipts,{});
});
test('atlas derives from source versions, hiding and deletion without cached private text',()=>{
 const s=setup();s.records.push(record('a','2026-09-01',{tags:['habit']}));assert.equal(c.lifeAtlas(s.records)[0].sources[0].id,'a');s.records[0].original='修改后的原文';s.records[0].revision++;assert.equal(c.lifeAtlas(s.records)[0].sources[0].revision,2);s.records[0].hidden=true;assert.deepEqual(c.lifeAtlas(s.records),[]);s.records.length=0;assert.deepEqual(c.lifeAtlas(s.records),[]);
});
test('24 safe configurable proposals: stable return, change, favorite, unsuitable, close; no records manufactured',()=>{
 const s=setup();assert.equal(p.COMPANION_PROPOSALS.length,24);const a=p.currentProposal(s.store,'cat','2026-09-28');assert.equal(p.currentProposal(s.store,'cat','2026-09-28').id,a.id);p.changeProposal(s.store,'cat','save','2026-09-28');assert.ok(s.state.proposals.saved.includes(a.id));const b=p.changeProposal(s.store,'cat','unsuitable','2026-09-28');assert.notEqual(a.id,b.id);assert.ok(s.state.proposals.unsuitable.includes(a.id));p.changeProposal(s.store,'cat','close');assert.equal(p.currentProposal(s.store,'cat'),null);assert.equal(s.records.length,0);
});
test('care followup stays on original event and cannot manufacture a diagnosis or life record',()=>{
 const s=setup();assert.throws(()=>care.saveCareFollowup(s.store,'missing','recovered','',()=>[]));care.saveCareFollowup(s.store,'original','none','未更新',()=>[{id:'original'}]);assert.equal(s.state.followups.original.status,'none');assert.equal(s.state.followups.original.sourceId,'original');assert.equal(s.records.length,0);
});
