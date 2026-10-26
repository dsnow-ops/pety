const test=require('node:test'),assert=require('node:assert/strict');
const {dataRuntime}=require('../scripts/lib/health-recovery-runtime.cjs');
const fs=require('node:fs');
function pageMethods(file,deps){let code=fs.readFileSync(file,'utf8');if(file.endsWith('.vue'))code=code.match(/<script>([\s\S]*?)<\/script>/)[1];code=code.replace(/^import[^;]+;\s*/gm,'').replace('export default','return');return Function(...Object.keys(deps),code)(...Object.values(deps)).methods;}
test('malformed creative containers and unsupported versions cannot be overwritten',()=>{
 for(const bad of ['damaged',[],false,17,{version:2,records:{}},{records:[]},{drafts:null},{works:{broken:null}},{mediaGarbage:{}},{dailyDrafts:'damaged'}]){
  const h=dataRuntime(),store=h.creative('TEST-p'),draft=store.create('current');draft.original='TEST new';
  h.storage.setStorageSync('pet_diaries_TEST-p_creative_v1',bad);const before=structuredClone([...h.disk]);
  for(const action of [()=>store.read(),()=>store.list(),()=>store.saveDraft(draft),()=>store.save(draft),()=>store.updateSection('proposals',{}),()=>store.saveWork({id:'TEST-work',petId:'TEST-p',namespace:h.scope().namespace}),()=>store.remove('TEST-missing')]){
   assert.throws(action,e=>['NARRATIVE_STORAGE_INVALID','NARRATIVE_STORAGE_VERSION'].includes(e.code),JSON.stringify(bad));assert.deepEqual([...h.disk],before);
  }
 }
});
test('malformed legacy containers and rows cannot be mistaken for empty days or overwritten',()=>{
 for(const bad of ['damaged',[],false,17,{'2026-10-23':null},{'2026-10-23':[]},{'2026-10-23':'damaged'}]){
  const h=dataRuntime();h.storage.setStorageSync('pet_diaries_TEST-p',bad);const before=structuredClone([...h.disk]);
  assert.deepEqual(h.diary.getDiaryMap('TEST-p'),{});assert.deepEqual([...h.disk],before);
  for(const action of [()=>h.creative('TEST-p').list(),()=>h.diary.getDiaryMap('TEST-p',undefined,{strict:true}),()=>h.diary.saveDiaryRecord('TEST-p','2026-10-23',{note:'TEST replacement'},{scope:h.scope()})]){
   assert.throws(action,e=>['NARRATIVE_STORAGE_INVALID','DIARY_STORAGE_INVALID'].includes(e.code));assert.deepEqual([...h.disk],before);
  }
 }
});
test('missing optional sections and unknown metadata remain compatible without read-time writes',()=>{
 const h=dataRuntime(),old={version:1,records:{},customMetadata:{preserve:'TEST original'}};
 h.storage.setStorageSync('pet_diaries_TEST-p_creative_v1',old);const before=structuredClone([...h.disk]),store=h.creative('TEST-p');
 assert.deepEqual(store.read().dailyDrafts,{});assert.deepEqual(store.list(),[]);assert.deepEqual([...h.disk],before);
 store.updateSection('proposals',{closed:true});assert.deepEqual(store.read().customMetadata,old.customMetadata);
 h.storage.setStorageSync('pet_diaries_TEST-p',{'2026-10-22':{note:'TEST original'}});assert.equal(store.list()[0].original,'TEST original');
});
test('calendar preflight blocks primary diary writes if creative storage becomes invalid after opening',()=>{
 const h=dataRuntime(),pet={id:'TEST-p',relationshipStage:'current'};let writes=0;
 const m=pageMethods('pages/calendar/calendar.vue',{isDataScopeCurrent:()=>true,getActivePet:()=>pet,getPetRelationshipStage:()=>pet.relationshipStage,getNarrativeStore:()=>h.creative(pet.id),saveDiaryRecord:()=>writes++});
 const v={...m,loadedDataScope:h.scope(),activePetId:pet.id,loadedPetStage:'current',recordStage:'current',selectedHasRecord:true,form:{lifeText:'TEST unsaved current text'},selectedDateKey:'2026-10-23'};
 h.storage.setStorageSync('pet_diaries_TEST-p_creative_v1','TEST damage after open');const before=structuredClone([...h.disk]);
 assert.equal(v.saveRecord(),false);assert.equal(writes,0);assert.equal(v.form.lifeText,'TEST unsaved current text');assert.equal(v.saving,false);assert.deepEqual([...h.disk],before);assert.match(v.saveError,/当前输入/);
});
test('calendar read-error reset cannot autosave an empty replacement form',()=>{
 let writes=0;const m=pageMethods('pages/calendar/calendar.vue',{isDataScopeCurrent:()=>true,getNarrativeStore:()=>{writes++;throw Error('unexpected access')}}),v={...m,activePetId:'TEST-p',dailyEditorEpoch:1};
 v.recordReadFailed();v.saveDailyDraft();assert.equal(writes,0);assert.equal(v.recordReadError,true);assert.equal(v.dailyLoading,true);
});
test('studio transient read errors keep the current unsaved composition and suppress writes',()=>{
 const m=pageMethods('common/card-studio-page.js',{NarrativeCanvas:{},PetSealMaker:{},FreeSealEditor:{},isDataScopeCurrent:()=>true,getActivePet:()=>({id:'TEST-p',status:'current'})});
 let broken=true,updates=0;const draft={custom:{text:'TEST unsaved composition'}},v={...m,scope:{ready:true},pet:{id:'TEST-p'},loadedMode:'current',config:draft,readSource:()=>{if(broken)throw Error('TEST read failure');},checkSourceData(){if(broken)throw Error('TEST read failure');},update:()=>updates++};
 v.checkSource();assert.equal(v.recordReadError,true);assert.equal(v.current(),false);assert.equal(v.config,draft);broken=false;v.retryRead();assert.equal(v.current(),true);assert.equal(v.config,draft);assert.equal(updates,1);
});
