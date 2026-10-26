const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
function setup(){
 const disk=new Map(),events=[];const uni={getStorageSync:k=>disk.get(k),setStorageSync:(k,v)=>disk.set(k,structuredClone(v)),removeStorageSync:k=>disk.delete(k)};
 const source=fs.readFileSync('common/auth-store.js','utf8').replace(/export /g,'');
 const auth=Function('uni','uniCloud',source+';return {getAccountScope,subscribeAccountScope,establishAuthenticatedProfile,clearUserCache,getCurrentUser};')(uni,{});
 const login=uid=>{disk.set('uni_id_token','official-'+uid);disk.set('uni_id_token_expired',Date.now()+60000);auth.establishAuthenticatedProfile({uid});};
 const logout=()=>{disk.delete('uni_id_token');auth.clearUserCache();};
 auth.subscribeAccountScope(scope=>events.push(scope));return{auth,disk,uni,login,logout,events};
}
test('official account identity publishes synchronously; token renewal does not replace data ownership',()=>{
 const s=setup(),guest=s.auth.getAccountScope();s.login('A');const a=s.auth.getAccountScope();
 assert.equal(guest.namespace,'guest:local');assert.equal(a.namespace,'account:A');assert.equal(a.ready,true);assert.ok(a.version>guest.version);assert.deepEqual(s.events.at(-1),a);
 s.disk.set('uni_id_token','renewed-A');s.auth.establishAuthenticatedProfile({uid:'A'});assert.deepEqual(s.auth.getAccountScope(),a);
 s.logout();s.login('A');assert.ok(s.auth.getAccountScope().version>a.version,'logout and login cannot revive A old requests');
});
test('a valid token without established uid blocks business data instead of exposing legacy guest keys',()=>{
 const s=setup();s.disk.set('uni_id_token','pending');s.disk.set('uni_id_token_expired',Date.now()+60000);
 const scope=s.auth.getAccountScope();assert.equal(scope.ready,false);assert.notEqual(scope.namespace,'guest:local');
 s.login('B');assert.equal(s.auth.getAccountScope().namespace,'account:B');
 s.disk.set('uni_id_token_expired',Date.now()-1);assert.equal(s.auth.getAccountScope().namespace,'guest:local');
});
test('scope listeners cannot prevent remaining owners from invalidating their old snapshots',()=>{
 const s=setup();let notified=0;s.auth.subscribeAccountScope(()=>{throw Error('stale page');});s.auth.subscribeAccountScope(()=>notified++);
 assert.doesNotThrow(()=>s.login('A'));assert.equal(notified,1);assert.equal(s.auth.getAccountScope().namespace,'account:A');
});
function storage(s){
 const source=fs.readFileSync('common/scoped-storage.js','utf8').replace(/^import[^;]+;\s*/gm,'').replace(/export /g,'');
 return Function('getAccountScope','uni',source+';return {createScopedStorage,captureDataScope,isDataScopeCurrent,assertDataScope};')(s.auth.getAccountScope,s.uni);
}
test('legacy guest data remains untouched; A, guest and B have separate data even for identical pet IDs',()=>{
 const s=setup(),api=storage(s),store=api.createScopedStorage(s.uni,s.auth.getAccountScope);
 s.disk.set('my_pets_list',[{id:'same',name:'guest'}]);s.disk.set('chat_history_same_current',['guest-private']);
 assert.equal(store.getStorageSync('my_pets_list')[0].name,'guest');s.login('A');assert.equal(store.getStorageSync('my_pets_list'),undefined);
 store.setStorageSync('my_pets_list',[{id:'same',name:'A'}]);store.setStorageSync('chat_history_same_current',['A-private']);
 s.logout();assert.deepEqual(store.getStorageSync('chat_history_same_current'),['guest-private']);s.login('B');assert.equal(store.getStorageSync('chat_history_same_current'),undefined);
 store.setStorageSync('chat_history_same_current',['B-private']);s.login('A');assert.deepEqual(store.getStorageSync('chat_history_same_current'),['A-private']);
 store.removeStorageSync('chat_history_same_current');s.logout();assert.deepEqual(s.disk.get('chat_history_same_current'),['guest-private']);
});
test('captured data lease rejects late reads and writes after A to B to A; auth keys never enter business storage',()=>{
 const s=setup(),api=storage(s),store=api.createScopedStorage(s.uni,s.auth.getAccountScope);s.login('A');const lease=api.captureDataScope(),bound=store.forScope(lease);
 bound.setStorageSync('pet_diaries_same',{today:'A'});s.login('B');s.login('A');
 assert.equal(api.isDataScopeCurrent(lease),false);assert.throws(()=>bound.setStorageSync('pet_diaries_same',{today:'late'}),{code:'DATA_SCOPE_CHANGED'});
 assert.throws(()=>bound.getStorageSync('pet_diaries_same'),{code:'DATA_SCOPE_CHANGED'});assert.equal(store.getStorageSync('pet_diaries_same').today,'A');
 for(const key of ['uni_id_token','pety_user_profile_cache','uni-id-pages-userInfo','../my_pets_list'])assert.throws(()=>store.setStorageSync(key,'no'),{code:'DATA_KEY_NOT_ALLOWED'});
});
test('unresolved authenticated scope cannot read, overwrite or remove guest business data',()=>{
 const s=setup(),api=storage(s),store=api.createScopedStorage(s.uni,s.auth.getAccountScope);s.disk.set('my_pets_list',['guest']);s.disk.set('uni_id_token','pending');s.disk.set('uni_id_token_expired',Date.now()+60000);
 for(const op of [()=>store.getStorageSync('my_pets_list'),()=>store.setStorageSync('my_pets_list',[]),()=>store.removeStorageSync('my_pets_list')])assert.throws(op,{code:'DATA_SCOPE_UNRESOLVED'});
 assert.deepEqual(s.disk.get('my_pets_list'),['guest']);
});
test('the real chat store must not import legacy guest messages into a signed-in account',()=>{
 const s=setup(),api=storage(s),scopedStorage=api.createScopedStorage(s.uni,s.auth.getAccountScope);
 const source=fs.readFileSync('common/chat-session-store.js','utf8').replace(/^import[^;]+;\s*/gm,'').replace(/export /g,'');
 const chat=Function('uni','scopedStorage',source+';return {loadChatSession,saveChatSession};')(s.uni,scopedStorage);
 chat.saveChatSession('same','current',[{id:'guest-message',type:'user',content:'guest private'}]);
 s.login('A');assert.deepEqual(chat.loadChatSession('same','current'),[],'A must not see or migrate guest history');
 chat.saveChatSession('same','current',[{id:'A-message',type:'user',content:'A private'}]);s.login('B');assert.deepEqual(chat.loadChatSession('same','current'),[]);
 s.logout();assert.equal(chat.loadChatSession('same','current')[0].content,'guest private');
});
function generator(s){
 const api=storage(s),pending=[];
 const deps={uni:s.uni,scopedStorage:api.createScopedStorage(s.uni,s.auth.getAccountScope),captureDataScope:api.captureDataScope,isDataScopeCurrent:api.isDataScopeCurrent,assertDataScope:api.assertDataScope,
  hasAiConsent:()=>true,buildAiConsentPayload:()=>({}),isAvatarDevEntitlementBypass:()=>false,uniCloud:{callFunction:()=>new Promise((resolve,reject)=>pending.push({resolve,reject}))}};
 const source=fs.readFileSync('common/pet-avatar-generator.js','utf8').replace(/^import[^;]+;\s*/gm,'').replace(/export /g,'');
 return {pending,...Function(...Object.keys(deps),source+';return {createAvatarJob,getAvatarJobStatus,refreshAvatarGenerationSession,ensureAvatarGenerationSession,getStoredAvatarJob,getAvatarGenerationSession};')(...Object.values(deps))};
}
test('different account create calls for the same pet ID do not share a flight or publish late A results',async()=>{
 const s=setup(),g=generator(s);s.login('A');const old=g.createAvatarJob({id:'same'},{sourceFileIds:['cloud://source/A']});const rejected=assert.rejects(old,{code:'DATA_SCOPE_CHANGED'});
 s.login('B');const fresh=g.createAvatarJob({id:'same'},{sourceFileIds:['cloud://source/B']});assert.equal(g.pending.length,2);
 g.pending[0].resolve({result:{code:0,jobId:'old-A'}});await rejected;assert.equal(g.getStoredAvatarJob('same'),null);
 g.pending[1].resolve({result:{code:0,jobId:'new-B',taskStatus:'PENDING'}});await fresh;assert.equal(g.getStoredAvatarJob('same').jobId,'new-B');
});
test('late status and generation session refresh cannot write into another account',async()=>{
 for(const kind of ['status','session']){
  const s=setup(),g=generator(s);s.login('A');g.ensureAvatarGenerationSession('same');
  const old=kind==='status'?g.getAvatarJobStatus('same','old-A'):g.refreshAvatarGenerationSession('same');const rejected=assert.rejects(old,{code:'DATA_SCOPE_CHANGED'});
  s.login('B');g.pending[0].resolve({result:{code:0,status:'SUCCEEDED',generatedFileId:'cloud://A',generatedTempUrl:'https://example.invalid/A',candidates:[],activeJob:{jobId:'old-A',taskStatus:'RUNNING'}}});await rejected;
  assert.equal(g.getStoredAvatarJob('same'),null);assert.equal(g.getAvatarGenerationSession('same'),null);
 }
});
function chatPage(s,extra={}){
 const api=storage(s),deps={carePhotoMixin:{},CarePhotoComposer:{},CarePhotoResult:{},PetAvatarImage:{},AiDataConsentSheet:{},MEMORIAL_OWNER_CALL_OPTIONS:[],isReduceMotionEnabled:()=>false,
  uni:s.uni,scopedStorage:api.createScopedStorage(s.uni,s.auth.getAccountScope),captureDataScope:api.captureDataScope,isDataScopeCurrent:api.isDataScopeCurrent,
  getChatContextId:(id,stage)=>`${id}:${stage}`,hasAiConsent:()=>true,getResponseLanguage:()=> 'zh',...extra};
 const source=fs.readFileSync('pages/chat/chat.vue','utf8').match(/<script>([\s\S]*?)<\/script>/)[1].replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g,'').replace('export default','return');
 const page=Function(...Object.keys(deps),source)(...Object.values(deps));
 return Object.assign({},page.methods,{loadedDataScope:api.captureDataScope(),activePetId:'same',activeStatus:'current',loadedChatContextId:'same:current',messageList:[],pageVisible:true,isMemorialMode:false,inputText:'hello',similarCopy:{searching:'searching'},isSearchingCases:false,scrollToBottom(){}});
}
test('late similar-case success and failure never write into a new account, including hidden-page fallback',async()=>{
 for(const fails of [false,true]){
  const s=setup();s.login('A');let resolve,reject,writes=0;
  const vm=chatPage(s,{uniCloud:{callFunction:()=>new Promise((a,b)=>{resolve=a;reject=b;})},saveChatSession:()=>writes++,loadChatSession:()=>[]});
  const request=vm.searchSimilarCases('test case');assert.equal(writes,1);s.login('B');
  if(fails)reject(Error('network'));else resolve({result:{code:0,searchJobId:'old-A'}});
  await request;assert.equal(writes,1,'only initial A draft may be saved');
  vm.persistSimilarCaseMessage({id:'late',petId:'same'},vm.loadedDataScope);assert.equal(writes,1);
 }
});
test('late memorial reflection cannot save another account diary or requested marker',async()=>{
 const s=setup();s.login('A');let resolve,saved=0;
 const vm=chatPage(s,{formatDateKey:()=> '2026-09-21',saveMemorialReflectionSuggestion:()=>saved++,uniCloud:{callFunction:()=>new Promise(r=>resolve=r)}});
 vm.activeStatus='deceased';vm.messageList=[{type:'user',relationshipStage:'deceased',id:'A',content:'private memory '.repeat(9)}];
 const request=vm.maybePrepareMemorialReflection('same');s.login('B');resolve({result:{code:0,reflectionSuggestion:{memoryText:'old private'}}});await request;
 assert.equal(saved,0);assert.equal([...s.disk.keys()].some(k=>k.includes('memorial_reflection_requested_')),false);
});
test('old loaded chat cannot save or open a photo picker as the new account',()=>{
 const s=setup();s.login('A');let saved=0,picked=0,sent=0;
 const vm=chatPage(s,{saveChatSession:()=>saved++});vm.sendMessage=()=>sent++;
 vm.$refs={carePhotoComposer:{choose:()=>picked++}};
 vm.saveChatHistory();assert.equal(saved,1);vm.chooseImageWithIntent();assert.equal(picked,1);s.login('B');
 vm.saveChatHistory();vm.chooseImageWithIntent();assert.equal(picked,1);assert.equal(saved,1);assert.equal(sent,0);
});
test('same pet and stage reload on account change, but normal same-account return reuses chat',()=>{
 const s=setup();s.login('A');let loads=0;
 const vm=chatPage(s,{getActivePet:()=>({id:'same',name:'test'}),getPetRelationshipStage:()=> 'current'});
 vm.resetChatContextState=()=>{};vm.updateTabBarText=()=>{};vm.loadChatHistory=()=>loads++;
 vm.syncActiveChatContext();assert.equal(loads,0);s.login('B');vm.syncActiveChatContext();assert.equal(loads,1);
 vm.syncActiveChatContext();assert.equal(loads,1);assert.equal(vm.loadedDataScope.namespace,'account:B');
});

function displayModules(s) {
 const api=storage(s),deps={uni:s.uni,scopedStorage:api.createScopedStorage(s.uni,s.auth.getAccountScope),captureDataScope:api.captureDataScope,isDataScopeCurrent:api.isDataScopeCurrent,subscribeAccountScope:s.auth.subscribeAccountScope};
 const load=(file,names)=>Function(...Object.keys(deps),fs.readFileSync(file,'utf8').replace(/^import[^;]+;\s*/gm,'').replace(/export /g,'')+';return {'+names+'};')(...Object.values(deps));
 return {...load('common/pet-app-theme.js','setThemePet,rememberPetTheme,getPetTheme,setPetThemeMode'),...load('common/pet-stage-palette.js','rememberStagePalette,readStagePalette')};
}
test('account changes discard in-memory theme and palette snapshots even with identical pet/master IDs',()=>{
 const s=setup(),d=displayModules(s),pet={id:'same',generatedAvatarFileId:'master'};
 const palette={surface:'#aaa',ink:'#34372f',blend:true,backgroundRgb:[180,170,160]};
 d.setThemePet(pet);d.setPetThemeMode('studio');d.rememberPetTheme(pet,palette);d.rememberStagePalette('same::master',palette);
 s.login('A');d.setThemePet(pet);assert.equal(d.getPetTheme().ready,false,'A must not reuse guest colors');assert.equal(d.getPetTheme().mode,'space');assert.equal(d.readStagePalette('same::master'),undefined);
 d.rememberPetTheme(pet,{...palette,backgroundRgb:[170,175,180]});d.rememberStagePalette('same::master',{...palette,surface:'#bbb'});
 s.logout();d.setThemePet(pet);assert.equal(d.getPetTheme().mode,'studio');assert.equal(d.readStagePalette('same::master').surface,'#aaa');
});
test('late palette callbacks cannot write colors into the next account',()=>{
 const s=setup(),d=displayModules(s),pet={id:'same',generatedAvatarFileId:'master'},old=s.auth.getAccountScope();
 d.setThemePet(pet);s.login('B');d.setThemePet(pet);
 const palette={surface:'#aaa',ink:'#34372f',blend:true,backgroundRgb:[180,170,160]};
 assert.equal(d.rememberPetTheme(pet,palette,old),false);d.rememberStagePalette('same::master',palette,old);
 assert.equal(d.getPetTheme().ready,false);assert.equal(d.readStagePalette('same::master'),undefined);
});

function avatarPage(s,extra={}) {
 const api=storage(s),deps={PetPortraitStage:{},AiDataConsentSheet:{},PetGenerationParticles:{},getAppLocale:()=> 'en',isReduceMotionEnabled:()=>false,captureDataScope:api.captureDataScope,isDataScopeCurrent:api.isDataScopeCurrent,subscribeAccountScope:s.auth.subscribeAccountScope,lightHaptic(){},uni:s.uni,...extra};
 const source=fs.readFileSync('pages/avatar-generate/avatar-generate.vue','utf8').match(/<script>([\s\S]*?)<\/script>/)[1].replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g,'').replace('export default','return');
 const page=Function(...Object.keys(deps),source)(...Object.values(deps));
 return Object.assign(page.data(),page.methods,{loadedDataScope:api.captureDataScope(),pet:{id:'same'},copy:{jobFailed:'failed'},stopUiTimers(){},selectedPhotoPaths:['A-photo']});
}
test('generation page cannot translate an expired account response into a failure written to B',async()=>{
 const s=setup();s.login('A');let reject,writes=0;
 const vm=avatarPage(s,{persistAvatarSourceImages:()=>new Promise((_,r)=>reject=r),getStoredAvatarJob:()=>null,updatePet:()=>{writes++;return{id:'same'}}});
 const work=vm.startGeneration('initial');s.login('B');reject(Object.assign(Error('scope'),{code:'DATA_SCOPE_CHANGED'}));await work;
 assert.equal(writes,0);vm.failGeneration({code:'late-error'});assert.equal(writes,0);
});
test('old photo picker and confirm modal cannot start work using the new account',async()=>{
 const s=setup();s.login('A');let picker,modal,saves=0,confirms=0;
 s.uni.chooseImage=o=>picker=o.success;s.uni.showModal=o=>modal=o.success;s.uni.showToast=()=>{};s.uni.switchTab=()=>{};
 const vm=avatarPage(s,{persistAvatarSourceImages:async()=>{saves++;return[]},confirmGeneratedAvatar:async()=>{confirms++;return{}},fillAvatarPhotoSlots:()=>[],saveGeneratedAvatar:()=>({}),updatePet:()=>null,saveAvatarHandoff:()=>{},isDevelopmentEnvironment:()=>false,t:()=>'',getActivePet:()=>({id:'same'})});
 vm.invalidateUploadedSources=()=>{};vm.choosePhoto(0,'album');vm.resultStage='RESULT_READY';vm.selectedCandidate={jobId:'A-job'};vm.useGeneratedAvatar();
 s.login('B');await picker({tempFilePaths:['A-private']});await modal({confirm:true});
 assert.equal(saves,0);assert.equal(confirms,0);
});

function feedbackPage(s,extra={}){
 const api=storage(s),deps={uni:s.uni,scopedStorage:api.createScopedStorage(s.uni,s.auth.getAccountScope),captureDataScope:api.captureDataScope,isDataScopeCurrent:api.isDataScopeCurrent,subscribeAccountScope:s.auth.subscribeAccountScope,
 PRODUCT_FEEDBACK_CATEGORIES:[],PRODUCT_FEEDBACK_MAX_IMAGES:3,PRODUCT_FEEDBACK_MAX_TITLE_LENGTH:100,PRODUCT_FEEDBACK_MAX_CONTENT_LENGTH:2000,PRODUCT_FEEDBACK_DRAFT_KEY:'product_feedback_draft_v1',...extra};
 const source=fs.readFileSync('pages/feedback/feedback.vue','utf8').match(/<script>([\s\S]*?)<\/script>/)[1].replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g,'').replace('export default','return');
 const page=Function(...Object.keys(deps),source)(...Object.values(deps));
 return Object.assign(page.data(),page.methods,{loadedDataScope:api.captureDataScope(),content:'A private feedback',title:'test',isBusy:false,validateForm:()=>true,buildDiagnostics:()=>({})});
}
test('feedback awaiting upload cannot submit old content as the next account or overwrite its draft',async()=>{
 const s=setup();s.login('A');let finish,calls=0;s.uni.showModal=()=>{};s.uni.showToast=()=>{};
 const vm=feedbackPage(s,{uniCloud:{callFunction:async()=>{calls++;return{result:{code:0}}}}});
 vm.saveDraft();vm.uploadPendingImages=()=>new Promise(r=>finish=r);const work=vm.submitFeedback();s.login('B');
 const api=storage(s),store=api.createScopedStorage(s.uni,s.auth.getAccountScope);store.setStorageSync('product_feedback_draft_v1',{content:'B draft'});
 finish();await work;vm.saveDraft();assert.equal(calls,0);assert.equal(store.getStorageSync('product_feedback_draft_v1').content,'B draft');
});
test('late feedback success cannot delete the next account draft or local attachments',async()=>{
 const s=setup();s.login('A');let finish,removed=0;s.uni.showModal=()=>{};s.uni.showToast=()=>{};
 const vm=feedbackPage(s,{uniCloud:{callFunction:()=>new Promise(r=>finish=r)}});vm.uploadPendingImages=async()=>{};vm.removeSavedFile=()=>removed++;
 vm.images=[{status:'uploaded',fileId:'A-file',localPath:'A-private-local'}];
 const work=vm.submitFeedback();await Promise.resolve();s.login('B');const store=storage(s).createScopedStorage(s.uni,s.auth.getAccountScope);store.setStorageSync('product_feedback_draft_v1',{content:'B'});
 finish({result:{code:0}});await work;assert.equal(removed,0);assert.equal(store.getStorageSync('product_feedback_draft_v1').content,'B');
});

test('clearing an account URL cache cancels late error publication into the next owner',async()=>{
 const {ownedMediaCloud,clientUni}=require('./fixtures/owned-media-cloud.cjs');
 const pending=[];const cloud=ownedMediaCloud(()=>new Promise((resolve,reject)=>pending.push({resolve,reject})));
 const source=fs.readFileSync('common/avatar-display-asset.js','utf8').replace(/export /g,'');
 const api=Function('uniCloud','uni',source+';return {hydratePetHeroAsset,resolvePetHeroAsset,clearAvatarDisplayAssetCache};')(cloud,clientUni);
 const pet={id:'same',generatedAvatarFileId:'master'};
 const old=api.hydratePetHeroAsset(pet);api.clearAvatarDisplayAssetCache();
 const fresh=api.hydratePetHeroAsset(pet);pending[0].reject(Object.assign(Error('old private error'),{code:'OLD_OWNER'}));await old;
 const during=api.resolvePetHeroAsset(pet);assert.equal(during.displayFileId,'master','old failure must not blacklist the new owner master');
 pending[1].resolve({fileList:[{tempFileURL:'https://example.invalid/B'}]});await fresh;
 assert.equal(api.resolvePetHeroAsset(pet).imageUrl,'https://example.invalid/B');
});

function recordPage(s,file,extra={}){
 const api=storage(s),deps={uni:s.uni,PetSealMaker:{},PetAvatarImage:{},hasDailyContent:require('../scripts/lib/health-recovery-runtime.cjs').moduleFrom('common/daily-record-fields.js','hasDailyContent').hasDailyContent,captureDataScope:api.captureDataScope,isDataScopeCurrent:api.isDataScopeCurrent,...extra};
 const source=fs.readFileSync(file,'utf8').match(/<script>([\s\S]*?)<\/script>/)[1].replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g,'').replace('export default','return');
 const page=Function(...Object.keys(deps),source)(...Object.values(deps));
 return Object.assign({},page.methods,{loadedDataScope:api.captureDataScope(),activePet:{id:'same'},activePetId:'same'});
}
test('an old archive confirmation cannot change B relationship mode after its page reloads',()=>{
 const s=setup();s.login('A');let modal,writes=0;s.uni.showModal=o=>modal=o.success;s.uni.showToast=()=>{};
 const vm=recordPage(s,'pages/archive/archive.vue',{getActivePet:()=>({id:'same'}),isMemorialMode:()=>true,withRelationshipStage:()=>({}),updateActivePet:()=>{writes++},updatePet:()=>{writes++},mediumHaptic(){}});
 vm.archiveVisible=true;vm.archiveVersion=1;vm.archiveReadError=false;vm.toggleMemorialMode();assert.equal(typeof modal,'function');s.login('B');vm.loadedDataScope=s.auth.getAccountScope();modal({confirm:true});assert.equal(writes,0);
});
test('stale calendar editor cannot save or delete a different account record or suggestion',()=>{
 const s=setup();s.login('A');let writes=0,reads=0;s.uni.showToast=()=>{};
 const vm=recordPage(s,'pages/calendar/calendar.vue',{getNarrativeStore:()=>({list:()=>{reads++;return[]},assertDailyDraft(){},read:()=>({dailyDrafts:{}}),updateSection(){}}),getActivePet:()=>({id:'same'}),getPetRelationshipStage:()=> 'current',saveDiaryRecord:()=>{writes++;return {updatedAt:1}},removeMemorialReflectionSuggestion:()=>writes++,getDiaryMap:()=>({}),successHaptic(){}});
 vm.loadedPetStage='current';vm.recordStage='current';vm.form={events:['food'],note:'',memoryText:''};vm.diaryMap={};vm.selectedDateKey='2026-09-21';s.login('B');vm.saveRecord();vm.deleteReflectionSuggestion();assert.equal(writes,0);
 assert.equal(reads,0,'stale form never reads the next owner');vm.loadedDataScope=s.auth.getAccountScope();assert.equal(vm.saveRecord(),true);assert.equal(reads,1);assert.equal(writes,1,'a freshly loaded B form still saves normally');
});

test('Home defers onboarding while official identity is unresolved, then permits the resolved owner',()=>{
 const s=setup(),api=storage(s);let modals=0;s.uni.showModal=()=>modals++;
 s.disk.set('uni_id_token','pending');s.disk.set('uni_id_token_expired',Date.now()+60000);
 const vm=recordPage(s,'pages/home/home.vue',{PetPortraitStage:{},HomeAlbumCover:{},HomeLifePreview:{},PetAvatarHero:{},scopedStorage:api.createScopedStorage(s.uni,s.auth.getAccountScope),getAppLocale:()=> 'zh-Hans',t:()=>''});
 vm.activePet=null;assert.doesNotThrow(()=>vm.maybeShowOnboardingGuide());assert.equal(modals,0);
 s.login('A');vm.loadedDataScope=api.captureDataScope();vm.maybeShowOnboardingGuide();assert.equal(modals,1);
});
