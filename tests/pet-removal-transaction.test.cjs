const test=require('node:test'),assert=require('node:assert/strict');
const {harness,pet}=require('./fixtures/pet-store-runtime.cjs');
function seed(){const h=harness();h.seed([pet(),pet('TEST-B')]);h.setActivePet('TEST-A');
 const media={id:'photo-A',namespace:'guest:local',petId:'TEST-A',durable:true,backend:'indexeddb',key:'guest:local:TEST-A:photo-A',path:''};
 const values={pet_diaries_TEST_A:{},['pet_diaries_TEST-A']:{day:{note:'A',media:[media]}},['pet_diaries_TEST-A_creative_v1']:{version:1,records:{r:{media:[media]}},works:{w:{snapshot:{renderPayload:{media:[media]}}}},dailyDrafts:{day:{form:{media:[media]}}},followups:{keepUntilDelete:{text:'A'}}},['pet_profile_TEST-A']:{note:'A'},['consultation_records_TEST-A']:[{id:'A'}],['memorial_persona_TEST-A']:{summary:'A'},['chat_history_TEST-A']:[{content:'old'}],['chat_history_TEST-A_current']:[{content:'current'}],['chat_history_TEST-A_deceased']:[{content:'deceased'}],['chat_history_TEST-A_future']:[{content:'future'}],['chat_history_legacy_TEST-A']:[{content:'backup'}],['chat_history_stage_migrated_TEST-A']:{strategy:'split'},['memorial_owner_call_prompt_seen_TEST-A']:true,['care_photo_draft_TEST-A']:{petId:'TEST-A'},['care_photo_session_TEST-A']:'s',['pet_avatar_job_TEST-A']:{petId:'TEST-A'},['pet_avatar_session_TEST-A']:{petId:'TEST-A'},['pety_avatar_handoff_TEST-A']:{petId:'TEST-A'},['memorial_reflection_suggestion_TEST-A_2026-10-23']:{memoryText:'A'},['memorial_reflection_requested_TEST-A_2026-10-23']:true,['pet_diaries_TEST-B']:{day:{note:'B'}},['chat_history_TEST-B_current']:[{content:'B'}]};
 delete values.pet_diaries_TEST_A;for(const [k,v]of Object.entries(values))h.disk.set(k,v);h.disk.set('uni_id_token','TEST-not-real');h.disk.set('pety_membership_plan','plus');return{h,media,values};}
test('pet deletion removes owned local histories together and preserves another pet and account keys',()=>{
 const {h,media,values}=seed();const result=h.removePet('TEST-A');assert.equal(result.removedPet.id,'TEST-A');assert.equal(result.activePet.id,'TEST-B');
 for(const k of Object.keys(values).filter(k=>k.includes('TEST-A')))assert.equal(h.disk.has(k),false,k);
 assert.deepEqual(h.disk.get('pety_creative_media_gc_v1'),[media]);assert.deepEqual(h.disk.get('pet_diaries_TEST-B'),values['pet_diaries_TEST-B']);assert.deepEqual(h.disk.get('chat_history_TEST-B_current'),values['chat_history_TEST-B_current']);assert.equal(h.disk.get('uni_id_token'),'TEST-not-real');assert.equal(h.disk.get('pety_membership_plan'),'plus');assert.equal(h.getActivePet().id,'TEST-B');assert.equal(h.removePet('TEST-A'),null);
});
test('a failure at each deletion stage restores list, all records, queue and active selection',()=>{
 for(const key of ['my_pets_list','pety_creative_media_gc_v1','pet_diaries_TEST-A_creative_v1','pet_diaries_TEST-A','chat_history_TEST-A_current','pet_profile_TEST-A','current_active_pet_id','pet_name']){
  const {h}=seed(),before=structuredClone([...h.disk].sort());h.fail(key,true);assert.throws(()=>h.removePet('TEST-A'),key);assert.deepEqual([...h.disk].sort(),before,key);assert.equal(h.getActivePet().id,'TEST-A');
 }
});
test('corrupt media metadata or foreign-owned durable media blocks deletion without changing any records',()=>{
 for(const value of [[],{version:7},{records:[]},{records:{r:null}},{records:{r:{media:'broken'}}},{records:{r:{media:[{id:'x',durable:true,namespace:'account:other',petId:'TEST-A'}]}}}]){
  const {h}=seed();h.disk.set('pet_diaries_TEST-A_creative_v1',value);const before=structuredClone([...h.disk]);assert.throws(()=>h.removePet('TEST-A'));assert.deepEqual([...h.disk],before);
 }
});
test('ambiguous legacy key shared by two pet identifiers blocks deletion instead of removing the other pet history',()=>{
 const {h}=seed();h.seed([pet(),pet('TEST-A_current')]);const before=structuredClone([...h.disk]);assert.throws(()=>h.removePet('TEST-A'),{code:'PET_DELETE_KEY_CONFLICT'});assert.deepEqual([...h.disk],before);
});
test('deleting the last pet clears active and compatibility fields without resurrecting stale cache',()=>{
 const {h}=seed();h.removePet('TEST-A');h.removePet('TEST-B');assert.deepEqual(h.getPetList(),[]);assert.equal(h.getActivePet(),null);for(const key of ['current_active_pet_id','pet_name','pet_photo','pet_mode'])assert.equal(h.disk.has(key),false);
});
test('unmanaged legacy image references are not queued for filesystem or cloud removal',()=>{
 const {h}=seed();h.disk.set('pet_diaries_TEST-A',{day:{media:[{id:'old',url:'https://test.invalid/photo'}]}});h.disk.set('pet_diaries_TEST-A_creative_v1',{});h.removePet('TEST-A');assert.equal(h.disk.has('pety_creative_media_gc_v1'),false);
});
test('changed pet identity invalidates an already displayed deletion confirmation',()=>{const {h}=seed(),expectedPet=h.getActivePet();h.updatePet('TEST-A',{name:'changed'});const before=structuredClone([...h.disk]);assert.throws(()=>h.removePet('TEST-A',{expectedPet}),{code:'PET_DELETE_CHANGED'});assert.deepEqual([...h.disk],before);});
test('rollback preserves explicitly stored null and empty old fields rather than treating them as absent',()=>{for(const value of [null,'']){const {h}=seed();h.disk.set('pet_profile_TEST-A',value);const before=structuredClone([...h.disk].sort());h.fail('chat_history_TEST-A_current',true);assert.throws(()=>h.removePet('TEST-A'));assert.deepEqual([...h.disk].sort(),before);}});
test('forged binary keys and sandbox traversal cannot enter the committed cleanup queue',()=>{for(const patch of [{key:'guest:local:TEST-B:photo-A'},{backend:'sandbox',path:'_doc/pety-narrative-media/../../outside.jpg'},{backend:'sandbox',path:'_doc/pety-narrative-media/%2e%2e%2foutside.jpg'}]){const {h,media}=seed();h.disk.set('pet_diaries_TEST-A',{day:{media:[{...media,...patch}]}});const before=structuredClone([...h.disk]);assert.throws(()=>h.removePet('TEST-A'));assert.deepEqual([...h.disk],before);}});
test('hidden page or changed account invalidates the actual profile confirmation callback',()=>{
 const fs=require('node:fs');for(const change of ['hidden','account']){
  const {h}=seed();let modal;const scope=h.scope(),deps={PetAvatarImage:{},creativeTranslate:()=> 'TEST confirm',isDataScopeCurrent:s=>s.namespace===h.scope().namespace&&s.version===h.scope().version,removePet:h.removePet,uni:{showModal:r=>modal=r.success,showToast(){}}};
  const src=fs.readFileSync('pages/profile/profile.vue','utf8').split('<script>')[1].split('</script>')[0].replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g,'').replace('export default','return');const page=Function(...Object.keys(deps),src)(...Object.values(deps));
  const vm={...page.methods,profileVisible:true,profileVersion:1,loadedDataScope:scope,petReadError:false,loadProfile(){}};vm.confirmDeletePet(h.getActivePet());assert.equal(typeof modal,'function');const before=structuredClone([...h.disk]);if(change==='hidden')page.onHide.call(vm);else h.changeAccount();modal({confirm:true});assert.deepEqual([...h.disk],before);
 }
});
test('App sandbox path validation does not impose App document paths on platform saveFile references',()=>{const fs=require('node:fs'),check=Function(fs.readFileSync('common/pet-removal.js','utf8').replace(/export /g,'')+';return assertManagedPetMedia;')();const scope={namespace:'guest:local'},asset={id:'TESTphoto',namespace:'guest:local',petId:'TEST-p',durable:true,backend:'sandbox',key:'guest:local:TEST-p:TESTphoto',path:'wxfile://usr/TEST-saved-file'};assert.doesNotThrow(()=>check(asset,scope,'TEST-p',{nativeSandbox:false}));assert.throws(()=>check(asset,scope,'TEST-p',{nativeSandbox:true}),{code:'MEDIA_PATH_INVALID'});assert.doesNotThrow(()=>check({...asset,path:'_doc/pety-narrative-media/TESTphoto.png'},scope,'TEST-p',{nativeSandbox:true}));});
