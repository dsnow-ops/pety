const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
function setup(normalizeOverride){
 const disk=new Map();let scope={namespace:'account:A',version:1,ready:true},mutations=0,fault=0,locked=false,notices=0;
 const uni={getStorageSync:k=>structuredClone(disk.get(k)),getStorageInfoSync:()=>({keys:[...disk.keys()]}),
  setStorageSync(k,v){mutations++;if(locked || mutations===fault)throw Error('disk full');disk.set(k,structuredClone(v));},
  removeStorageSync(k){mutations++;if(locked || mutations===fault)throw Error('disk full');disk.delete(k);}};
 const read=()=>scope;
 const st=Function('getAccountScope','uni',fs.readFileSync('common/scoped-storage.js','utf8').replace(/^import[^;]+;\s*/gm,'').replace(/export /g,'')+';return {createScopedStorage};')(read,uni);
 const accounts=st.createScopedStorage(uni,read);
 const normalize=normalizeOverride || (p=>({...p,localImportPending:p.localImportPending===true,generatedAvatarCleanupPending:p.generatedAvatarCleanupPending===true}));
 const assertCurrent=s=>{if(!s?.ready || s.namespace!==scope.namespace || s.version!==scope.version)throw Object.assign(Error('scope'),{code:'DATA_SCOPE_CHANGED'});};
 const src=fs.readFileSync('common/guest-data-import.js','utf8').replace(/^import[^;]+;\s*/gm,'').replace(/export /g,'');
 const {createGuestDataImport}=Function('scopedStorage','captureDataScope','assertDataScope','normalizePet','notifyPetDataChanged','uni',src+';return {createGuestDataImport};')(accounts,read,assertCurrent,normalize,()=>{},uni);
 const service=createGuestDataImport({guest:uni,accounts,capture:read,assertCurrent,normalize,notify:()=>notices++});
 const pet={id:'pet_x',name:'Guest',relationshipStage:'deceased',generatedAvatarFileId:'cloud://original-owner/final',generatedAvatarUrl:'https://original-owner.invalid/image?signature=old'};
 disk.set('my_pets_list',[pet]);disk.set('pet_diaries_pet_x',{day:{content:'guest diary'}});disk.set('chat_history_pet_x_deceased',[{id:'m',content:'guest private'}]);disk.set('chat_history_legacy_pet_x',[{id:'old',content:'older'}]);
 disk.set('memorial_reflection_suggestion_pet_x_2026-09-21',{content:'suggestion'});
 disk.set('pety_membership_plan','plus');disk.set('pet_avatar_session_pet_x',{quotaRemaining:8});disk.set('uni_id_token','secret');
 return {disk,uni,accounts,service,normalize,read,notices:()=>notices,mutations:()=>mutations,
  switch(uid){scope={namespace:uid==='guest'?'guest:local':`account:${uid}`,version:scope.version+1,ready:true}},
  faultAfter(n){fault=mutations+n},lock(v){locked=v},restart(){return st.createScopedStorage(uni,read)}};
}
test('no choice or retain never copies guest private data; later explicit import leaves originals intact',()=>{
 const s=setup(),original=structuredClone([...s.disk]);assert.deepEqual(s.service.state(),{status:'pending',count:1});assert.equal(s.accounts.getStorageSync('my_pets_list'),undefined);
 s.service.retain();assert.equal(s.service.state().status,'retained');assert.equal(s.accounts.getStorageSync('pet_diaries_pet_x'),undefined);
 const plan=s.service.prepare();s.service.commit(plan);assert.equal(s.accounts.getStorageSync('my_pets_list')[0].id,'pet_x');
 assert.equal(s.accounts.getStorageSync('my_pets_list')[0].localImportPending,true);assert.deepEqual(s.accounts.getStorageSync('pet_diaries_pet_x'),{day:{content:'guest diary'}});
 assert.equal(s.accounts.getStorageSync('chat_history_pet_x_deceased'),undefined);assert.equal(s.accounts.getStorageSync('pety_membership_plan'),undefined);assert.equal(s.accounts.getStorageSync('pet_avatar_session_pet_x'),undefined);
 for(const [key,value] of original)assert.deepEqual(s.disk.get(key),value,'guest original unchanged: '+key);
 s.service.commit(plan);assert.equal(s.accounts.getStorageSync('my_pets_list').length,1);assert.equal(s.notices(),1);
});
test('explicit chat consent imports both stages, legacy backup and marker without touching other pet IDs',()=>{
 const s=setup();for(const k of ['chat_history_pet_x','chat_history_pet_x_current','chat_history_pet_x_future','chat_history_stage_migrated_pet_x'])s.disk.set(k,[k]);
 s.disk.set('chat_history_pet_x_other',['never']);s.service.commit(s.service.prepare({includeChats:true}));
 assert.equal(s.accounts.getStorageSync('chat_history_pet_x_deceased')[0].content,'guest private');assert.equal(s.accounts.getStorageSync('chat_history_legacy_pet_x')[0].id,'old');
 assert.deepEqual(s.accounts.getStorageSync('chat_history_stage_migrated_pet_x'),['chat_history_stage_migrated_pet_x']);assert.equal(s.accounts.getStorageSync('chat_history_pet_x_other'),undefined);
 assert.equal(s.accounts.getStorageSync('memorial_reflection_suggestion_pet_x_2026-09-21').content,'suggestion');
});
test('confirmation rejects changed source, changed destination, A-B-A and target ID/orphan key collisions',()=>{
 for(const scenario of ['source','target','switch','petCollision','orphan']){
  const s=setup();
  if(scenario==='petCollision')s.accounts.setStorageSync('my_pets_list',[{id:'pet_x',name:'account'}]);
  if(scenario==='orphan')s.accounts.setStorageSync('chat_history_pet_x_current',[{content:'account private'}]);
  if(['petCollision','orphan'].includes(scenario)){assert.throws(()=>s.service.prepare(),{code:'IMPORT_CONFLICT'});continue;}
  const plan=s.service.prepare();
  if(scenario==='source')s.disk.set('pet_diaries_pet_x',{day:'updated'});
  if(scenario==='target')s.accounts.setStorageSync('my_pets_list',[{id:'other'}]);
  if(scenario==='switch'){s.switch('B');s.switch('A');}
  assert.throws(()=>s.service.commit(plan),{code:{source:'IMPORT_SOURCE_CHANGED',target:'IMPORT_TARGET_CHANGED',switch:'DATA_SCOPE_CHANGED'}[scenario]});
  assert.equal(s.accounts.getStorageSync('pet_diaries_pet_x'),undefined);
 }
});
test('each storage failure leaves either the whole committed import or the original account, never a visible half import',()=>{
 const probe=setup();probe.service.commit(probe.service.prepare({includeChats:true}));const count=probe.mutations();
 for(let n=1;n<=count;n++){
  const s=setup(),plan=s.service.prepare({includeChats:true});s.faultAfter(n);
  try{s.service.commit(plan)}catch(_){}
  const restarted=s.restart(),pets=restarted.getStorageSync('my_pets_list');
  if(pets?.length){assert.equal(restarted.getStorageSync('pety_guest_import_v1').status,'imported');assert.equal(restarted.getStorageSync('chat_history_pet_x_deceased')[0].content,'guest private');}
  else{assert.equal(restarted.getStorageSync('pet_diaries_pet_x'),undefined);assert.notEqual(restarted.getStorageSync('pety_guest_import_v1')?.status,'imported');}
  assert.equal(s.disk.get('pet_diaries_pet_x').day.content,'guest diary');
 }
});
test('crash recovery is idempotent and account-specific; corrupt journal cannot restore arbitrary keys',()=>{
 const s=setup(),prefix='pety_owner_v1:account%3AA:';
 s.disk.set(prefix+'__local_transaction_v1',{version:1,namespace:'account:A',state:'prepared',entries:[{key:'pet_diaries_pet_x',present:false},{key:'my_pets_list',present:false}]});
 s.disk.set(prefix+'pet_diaries_pet_x',{partial:true});s.disk.set(prefix+'my_pets_list',[{id:'pet_x'}]);
 s.switch('B');s.accounts.setStorageSync('my_pets_list',[{id:'b'}]);assert.equal(s.accounts.getStorageSync('my_pets_list')[0].id,'b');
 s.switch('A');s.lock(true);assert.throws(()=>s.accounts.getStorageSync('my_pets_list'));s.lock(false);
 assert.equal(s.restart().getStorageSync('my_pets_list'),undefined);assert.equal(s.accounts.getStorageSync('pet_diaries_pet_x'),undefined);
 s.disk.set(prefix+'__local_transaction_v1',{version:1,namespace:'account:A',state:'prepared',entries:[{key:'uni_id_token',present:true,value:'attack'}]});
 assert.throws(()=>s.accounts.getStorageSync('my_pets_list'),{code:'DATA_RECOVERY_REQUIRED'});assert.equal(s.disk.get('uni_id_token'),'secret');
});
test('undo restores an empty account without resurrecting legacy fields; later user edits prevent destructive undo',()=>{
 const s=setup();s.service.commit(s.service.prepare());s.accounts.setStorageSync('pet_name','Guest');s.accounts.setStorageSync('pet_photo','local-photo');s.accounts.setStorageSync('pet_mode','2.5d');
 s.service.undo();assert.deepEqual(s.accounts.getStorageSync('my_pets_list'),[]);assert.equal(s.accounts.getStorageSync('pet_name'),undefined);assert.equal(s.accounts.getStorageSync('pet_diaries_pet_x'),undefined);
 s.service.commit(s.service.prepare());s.accounts.setStorageSync('pet_diaries_pet_x',{day:'new account memory'});
 assert.throws(()=>s.service.undo(),{code:'IMPORT_HAS_EDITS'});assert.equal(s.accounts.getStorageSync('pet_diaries_pet_x').day,'new account memory');assert.equal(s.disk.get('pet_diaries_pet_x').day.content,'guest diary');
});
test('guest, A and B retain independent imports and membership remains untouched',()=>{
 const s=setup();s.accounts.setStorageSync('pety_membership_plan','free');s.service.commit(s.service.prepare());s.switch('B');assert.equal(s.service.state().status,'pending');assert.equal(s.accounts.getStorageSync('my_pets_list'),undefined);
 s.service.retain();s.switch('A');assert.equal(s.service.state().status,'imported');assert.equal(s.accounts.getStorageSync('pety_membership_plan'),'free');s.switch('guest');assert.equal(s.accounts.getStorageSync('my_pets_list')[0].localImportPending,undefined);assert.throws(()=>s.service.prepare(),{code:'IMPORT_ACCOUNT_REQUIRED'});
});
test('invalid and duplicate guest IDs fail closed without manufacturing new identities',()=>{
 for(const pets of [[{id:'../x'}],[{name:'legacy missing ID'}],[{id:'x'},{id:'x'}],'corrupt']){
  const s=setup();s.disk.set('my_pets_list',pets);assert.throws(()=>s.service.prepare(),{code:'IMPORT_INVALID_DATA'});assert.equal(s.accounts.getStorageSync('my_pets_list'),undefined);
 }
});

test('imported-unlinked pets cannot invoke any cloud avatar operation or spend quota',async()=>{
 const s=setup();s.service.commit(s.service.prepare());let calls=0;
 const deps={scopedStorage:s.accounts,captureDataScope:s.read,isDataScopeCurrent:()=>true,assertDataScope(){},
  hasAiConsent:()=>true,buildAiConsentPayload:()=>({}),isAvatarDevEntitlementBypass:()=>false,
  uniCloud:{callFunction:async()=>{calls++;return{}},uploadFile:async()=>{calls++;return{}}}};
 const source=fs.readFileSync('common/pet-avatar-generator.js','utf8').replace(/^import[^;]+;\s*/gm,'').replace(/export /g,'');
 const names='uploadAvatarSourceImages,createAvatarJob,getAvatarJobStatus,confirmGeneratedAvatar,submitAvatarFeedback,startAvatarCutout,prepareAvatarHeroDisplay,getAvatarCutoutStatus,refreshAvatarGenerationSession,retryAvatarCleanup';
 const g=Function(...Object.keys(deps),source+';return {'+names+'};')(...Object.values(deps));
 for(const call of [()=>g.uploadAvatarSourceImages({id:'pet_x'},['local']),()=>g.createAvatarJob({id:'pet_x'}),()=>g.getAvatarJobStatus('pet_x','j'),()=>g.confirmGeneratedAvatar({id:'pet_x'},'j'),()=>g.submitAvatarFeedback('pet_x','j'),()=>g.startAvatarCutout('pet_x','j'),()=>g.prepareAvatarHeroDisplay('pet_x','j'),()=>g.getAvatarCutoutStatus('pet_x','j'),()=>g.refreshAvatarGenerationSession('pet_x')])await assert.rejects(call,{code:'LOCAL_IMPORT_CLOUD_LINK_REQUIRED'});
 assert.equal(await g.retryAvatarCleanup('pet_x','j'),null);assert.equal(calls,0);
});
test('unlinked image resolves only explicit local master bytes, never the guest signed URL or fresh cloud URL',async()=>{
 let calls=0;const source=fs.readFileSync('common/avatar-display-asset.js','utf8').replace(/export /g,'');
 const a=Function('uniCloud',source+';return {resolvePetHeroAsset,hydratePetHeroAsset};')({getTempFileURL:async()=>{calls++;return{}},callFunction:async()=>{calls++;return{}}});
 const pet={id:'pet_x',localImportPending:true,generatedAvatarFileId:'cloud://old-owner/final',generatedAvatarUrl:'https://old-owner.invalid/image?secret'};
 assert.equal(a.resolvePetHeroAsset(pet).imageUrl,'');assert.equal((await a.hydratePetHeroAsset(pet)).fallbackReason,'LOCAL_IMPORT_CLOUD_LINK_REQUIRED');assert.equal(calls,0);
 pet.generatedAvatarUrl='_doc/pety-avatar-cache-v1/existing.png';assert.equal((await a.hydratePetHeroAsset(pet)).imageUrl,pet.generatedAvatarUrl);assert.equal(calls,0);
 pet.generatedAvatarUrl='';pet.originalPhotoUrl='_doc/owned-original.jpg';assert.equal((await a.hydratePetHeroAsset(pet)).imageUrl,pet.originalPhotoUrl);assert.equal(calls,0);
});
test('a new account-only memorial suggestion prevents undo from orphaning user content',()=>{
 const s=setup();s.service.commit(s.service.prepare());s.accounts.setStorageSync('memorial_reflection_suggestion_pet_x_2026-09-22',{memoryText:'new account content'});
 assert.throws(()=>s.service.undo(),{code:'IMPORT_HAS_EDITS'});assert.equal(s.accounts.getStorageSync('my_pets_list').length,1);assert.equal(s.accounts.getStorageSync('memorial_reflection_suggestion_pet_x_2026-09-22').memoryText,'new account content');
});
test('real pet normalization and ordinary reads preserve import provenance and reversible state',()=>{
 const deps={scopedStorage:null,captureDataScope:()=>({ready:true}),subscribeAccountScope:()=>()=>{},clearAvatarDisplayAssetCache(){},
  getPetRelationshipStage:p=>p.relationshipStage||p.status||'current',normalizeOwnerRelation:()=>({ownerRelationKey:'owner',ownerRelationCustom:''}),getOwnerRelationLabel:()=> '家人',
  getDefaultAvatarStyle:()=> 'soft3d',normalizeAvatarSource:s=>s,normalizeAvatarStatus:s=>s,normalizeAvatarStyle:s=>s};
 const src=fs.readFileSync('common/pet-store.js','utf8').replace(/^import[^;]+;\s*/gm,'').replace(/export /g,'');
 const load=()=>Function(...Object.keys(deps),src+';return {normalizePet,getPetList,getActivePet};')(...Object.values(deps));
 const normalize=load().normalizePet,s=setup(normalize);deps.scopedStorage=s.accounts;deps.captureDataScope=s.read;
 s.service.commit(s.service.prepare());const pets=load();assert.equal(pets.getPetList()[0].localImportPending,true);assert.equal(pets.getActivePet().generatedAvatarFileId,'cloud://original-owner/final');
 s.service.undo();assert.deepEqual(pets.getPetList(),[]);assert.equal(s.disk.get('my_pets_list')[0].name,'Guest');
});
test('reading an empty non-imported chat does not make withdrawal destructive or impossible',()=>{
 const s=setup();s.service.commit(s.service.prepare());
 const src=fs.readFileSync('common/chat-session-store.js','utf8').replace(/^import[^;]+;\s*/gm,'').replace(/export /g,'');
 const chat=Function('scopedStorage',src+';return {loadChatSession};')(s.accounts);assert.deepEqual(chat.loadChatSession('pet_x','deceased'),[]);
 s.service.undo();assert.deepEqual(s.accounts.getStorageSync('my_pets_list'),[]);assert.equal(s.disk.get('chat_history_pet_x_deceased')[0].content,'guest private');
});
