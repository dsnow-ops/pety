const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('source validation failure preserves the pet and returns to photo selection without a paid retry',()=>{
 for(const code of ['INVALID_SOURCE_IMAGES','AVATAR_SOURCE_IMAGE_UNREADABLE']) {
  const s=setup();s.vm.failGeneration({code,stage:'SOURCE_VALIDATION'});
  assert.equal(s.vm.errorMessage,'avatar.sourceImageInvalid');assert.equal(s.writes.length,0);
  assert.equal(s.vm.generationRecoveryAction(),'photos');s.vm.resumeOrRetry();
  assert.equal(s.vm.phase,'select');assert.equal(s.counts().requests,0);assert.equal(s.counts().polls,0);
 }
});
function setup(code,overrides={}){
 const navigation=[],writes=[],toasts=[],diagnostics=[],checkedPets=[];let checks=0,polls=0,requests=0;
 const deps={AiDataConsentSheet:{},PetPortraitStage:{},PetGenerationParticles:{},
  uni:{navigateTo:x=>navigation.push(x.url),showToast:x=>toasts.push(x)},
  getAvatarGenerationEntitlement:async petId=>{checks++;checkedPets.push(petId);if(code)throw Object.assign(Error('service'),{code});return {allowed:true}},
  getStoredAvatarJob:()=>({status:'RUNNING',jobId:'existing-job'}),updatePet:(...args)=>writes.push(args),
  ensureAvatarGenerationSession:(id,patch)=>diagnostics.push({id,...patch}),
  t:key=>key,...overrides};
 const script=fs.readFileSync('pages/avatar-generate/avatar-generate.vue','utf8').match(/<script>([\s\S]*?)<\/script>/)[1]
  .replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g,'').replace('export default','return');
 const component=Function(...Object.keys(deps),script)(...Object.values(deps));
 const vm={...component.methods,ownsDataScope:()=>true,pet:{id:'cat',avatarStatus:'ready'},copy:{jobFailed:'generic',uploadFailed:'upload'},
  locale:'zh-Hans',lastGenerationFailure:null,phase:'select',pendingJobKind:'initial',candidates:[],selectedPhotoPaths:['local/photo'],stopUiTimers(){},
  beginExperienceProgress(){},schedulePoll(){polls++},requestGeneration(){requests++}};
 return {vm,component,navigation,writes,toasts,diagnostics,checkedPets,counts:()=>({checks,polls,requests})};
}

test('result save retries are bounded, preserve the accepted task and retry only that task',async()=>{
 const ids=[],delays=[];
 const s=setup(null,{getAvatarJobStatus:async(pet,job)=>{ids.push(job);return{status:'PENDING',errorCode:'RESULT_SAVE_PENDING'};}});
 s.vm.pageVisible=true;s.vm.phase='generating';s.vm.schedulePoll=d=>delays.push(d);
 for(let i=0;i<4;i++)await s.vm.pollJob();
 assert.equal(s.vm.phase,'failed');assert.equal(s.vm.errorMessage,'avatar.resultSavePending');
 assert.equal(s.vm.lastGenerationFailure.stage,'RESULT_STORAGE');assert.equal(s.writes.length,0);
 assert.deepEqual(delays,[5000,10000,15000]);assert.ok(ids.every(id=>id==='existing-job'));
 s.vm.resumeOrRetry();assert.equal(s.vm.resultSaveRetries,0);assert.equal(delays.at(-1),100);assert.equal(s.counts().requests,0);
});

test('returning from background restarts progress and polling for an existing generation',()=>{
 const s=setup(null,{getAppLocale:()=> 'zh-Hans'});let starts=0;
 s.vm.$refs={};s.vm.phase='generating';s.vm.beginExperienceProgress=()=>starts++;
 s.component.onShow.call(s.vm);assert.equal(starts,1);assert.equal(s.counts().polls,1);assert.equal(s.vm.pageVisible,true);
});

test('successful saved result wins over a historical storage error receipt',async()=>{
 const s=setup(null,{getAvatarJobStatus:async()=>({jobId:'existing-job',status:'SUCCEEDED',errorCode:'RESULT_SAVE_PENDING'}),getAvatarGenerationSession:()=>null});
 let preloaded; s.vm.pageVisible=true;s.vm.candidates=[];s.vm.setCandidates=()=>{};s.vm.stopGenerationTimers=()=>{};s.vm.beginCandidatePreload=job=>preloaded=job;
 await s.vm.pollJob();assert.equal(s.vm.resultStoragePending,false);assert.equal(preloaded.jobId,'existing-job');assert.equal(s.counts().polls,0);
});

test('recovery link reads the existing owned job, never creates, and stops on account change or denial',async()=>{
 for (const mode of ['success','scope-changed','denied']) {
  let valid=true,restored=0;const reads=[];
  const s=setup(null,{getAvatarJobStatus:async(pet,job)=>{reads.push([pet,job]);if(mode==='denied')throw Object.assign(Error('denied'),{code:'JOB_OWNER_MISMATCH'});if(mode==='scope-changed')valid=false;},getAvatarGenerationSession:()=>{restored++;return null;},getStoredAvatarJob:()=>null});
  s.vm.ownsDataScope=()=>valid;s.vm.failGeneration=()=>{};
  await s.vm.restoreSession('existing-job');assert.deepEqual(reads,[['cat','existing-job']]);assert.equal(restored,mode==='success'?1:0);assert.equal(s.counts().requests,0);
 }
});

test('both entitlement entry points use the actual page pet ID, without an invented petId property',async()=>{
 const s=setup();assert.equal(s.vm.petId,undefined);
 await s.vm.refreshEntitlement();const entitlement=await s.vm.ensureEntitlement();
 assert.deepEqual(s.checkedPets,['cat','cat']);assert.equal(entitlement.allowed,true);
});

test('poll outages retry the same task with a bound and preserve the pet after exhaustion',async()=>{
 const ids=[],delays=[];
 const s=setup(null,{getAvatarJobStatus:async(id,job)=>{ids.push([id,job]);throw Object.assign(Error('service'),{code:'AVATAR_REQUEST_FAILED'})}});
 s.vm.pageVisible=true;s.vm.phase='generating';s.vm.schedulePoll=d=>delays.push(d);
 for(let i=0;i<5;i++)await s.vm.pollJob();
 assert.deepEqual(delays,[3000,6000,12000,15000]);assert.equal(ids.length,5);
 assert.ok(ids.every(([id,job])=>id==='cat'&&job==='existing-job'));
 assert.equal(s.vm.phase,'failed');assert.equal(s.vm.errorMessage,'avatar.statusQueryUnavailable');
 assert.equal(s.vm.lastGenerationFailure.stage,'STATUS_QUERY');assert.equal(s.writes.length,0);
 s.vm.resumeOrRetry();assert.equal(s.vm.statusQueryFailures,0);assert.equal(delays.at(-1),100);
 assert.equal(s.counts().requests,0);
});

test('successful polls reset retries; obsolete pet responses and authorization errors are not retried',async()=>{
 let reject;const s=setup(null,{getAvatarJobStatus:async()=>({status:'RUNNING'})});
 s.vm.pageVisible=true;s.vm.statusQueryFailures=3;await s.vm.pollJob();assert.equal(s.vm.statusQueryFailures,0);
 const stale=setup(null,{getAvatarJobStatus:()=>new Promise((_,r)=>{reject=r})});stale.vm.pageVisible=true;
 const pending=stale.vm.pollJob();stale.vm.pet={id:'other'};reject(Object.assign(Error(),{code:'NETWORK_ERROR'}));await pending;
 assert.equal(stale.counts().polls,0);assert.equal(stale.writes.length,0);
 const auth=setup(null,{getAvatarJobStatus:async()=>{throw Object.assign(Error(),{code:'AVATAR_AUTH_EXPIRED'})}});auth.vm.pageVisible=true;
 await auth.vm.pollJob();assert.equal(auth.counts().polls,0);assert.equal(auth.vm.generationRecoveryAction(),'login');
});

test('allowance check failure stays visible, records the stage and does not fail an existing pet or job',async()=>{
 const s=setup('AVATAR_QUOTA_STATE_INVALID');await s.vm.ensureEntitlement();
 assert.equal(s.vm.phase,'failed');assert.equal(s.vm.errorMessage,'avatar.entitlementUnavailable');
 assert.equal(s.vm.lastGenerationFailure.stage,'ENTITLEMENT');
 assert.equal(s.diagnostics[0].lastFailure.errorCode,'AVATAR_QUOTA_STATE_INVALID');
 assert.deepEqual(s.diagnostics[0].sourcePhotoPaths,['local/photo']);
 assert.equal(s.writes.length,0);assert.equal(s.toasts.length,0);
 assert.equal(s.counts().requests,0);
});

test('background allowance checks retain a diagnostic without changing the current page or another account',async()=>{
 const s=setup('NETWORK_ERROR');await s.vm.refreshEntitlement();
 assert.equal(s.vm.phase,'select');assert.equal(s.diagnostics[0].lastFailure.stage,'ENTITLEMENT');
 s.vm.ownsDataScope=()=>false;await s.vm.refreshEntitlement();assert.equal(s.diagnostics.length,1);
});

test('entitlement transport errors retain their code and stage without leaking transport details',async()=>{
 const src=fs.readFileSync('common/avatar-generation-entitlement.js','utf8').replace(/^import[^;]+;\s*/gm,'').replace(/export /g,'');
 const deps={getCurrentUser:()=>null,uni:{getStorageSync:()=> 'token'},uniCloud:{callFunction:async()=>{throw {errCode:'NETWORK_ERROR',errMsg:'https://private.invalid/?token=secret'}}}};
 const read=Function(...Object.keys(deps),src+';return getAvatarGenerationEntitlement;')(...Object.values(deps));
 await assert.rejects(read('cat'),e=>e.code==='NETWORK_ERROR'&&e.stage==='ENTITLEMENT'&&!e.message.includes('secret'));
});

test('invalid pet IDs are rejected before any cloud request',async()=>{
 const src=fs.readFileSync('common/avatar-generation-entitlement.js','utf8').replace(/^import[^;]+;\s*/gm,'').replace(/export /g,'');
 let calls=0;
 const deps={getCurrentUser:()=>null,uni:{getStorageSync:()=>''},uniCloud:{callFunction:async()=>{calls++;return {result:{code:0,entitlement:{allowed:true}}}}}};
 const read=Function(...Object.keys(deps),src+';return getAvatarGenerationEntitlement;')(...Object.values(deps));
 for(const id of [undefined,null,'','   ',123,'x'.repeat(129)])await assert.rejects(read(id),e=>e.code==='INVALID_PET_ID'&&e.stage==='ENTITLEMENT');
 assert.equal(calls,0);assert.equal((await read('cat')).allowed,true);assert.equal(calls,1);
});

test('failure survives session normalization with no transport secrets or changes to selected photos',()=>{
 const disk=new Map();
 const src=fs.readFileSync('common/pet-avatar-generator.js','utf8').replace(/^import[^;]+;\s*/gm,'').replace(/export /g,'');
 const api=Function('scopedStorage',src+';return {ensureAvatarGenerationSession,getAvatarGenerationSession};')({getStorageSync:k=>disk.get(k),setStorageSync:(k,v)=>disk.set(k,v)});
 api.ensureAvatarGenerationSession('cat',{sourcePhotoPaths:['_doc/photo.jpg'],lastFailure:{stage:'ENTITLEMENT',errorCode:'NETWORK_ERROR',at:123,token:'secret',message:'https://private.invalid/?key=secret'}});
 const saved=api.getAvatarGenerationSession('cat');
 assert.deepEqual(saved.lastFailure,{stage:'ENTITLEMENT',errorCode:'NETWORK_ERROR',at:123});
 assert.deepEqual(saved.sourcePhotoPaths,['_doc/photo.jpg']);assert.ok(!JSON.stringify(saved).includes('secret'));
 api.ensureAvatarGenerationSession('cat',{lastFailure:null});assert.equal(api.getAvatarGenerationSession('cat').lastFailure,null);
});

test('missing pet routes and unresolved identity never start cloud checks or silently select another pet',()=>{
 const script=fs.readFileSync('pages/avatar-generate/avatar-generate.vue','utf8').match(/<script>([\s\S]*?)<\/script>/)[1]
  .replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g,'').replace('export default','return');
 for(const mode of ['missing-route','empty','unresolved','valid']){
  let lookups=0,restores=0,checks=0;const navigation=[];
  const deps={AiDataConsentSheet:{},PetPortraitStage:{},PetGenerationParticles:{},t:k=>k,
   captureDataScope:()=>({ready:mode!=='unresolved'}),subscribeAccountScope:()=>()=>{},
   setActivePet:()=>{lookups++;return mode==='valid'?{id:'requested'}:null},
   getActivePet:()=>{lookups++;return null},uni:{switchTab:o=>navigation.push(o.url)}};
  const page=Function(...Object.keys(deps),script)(...Object.values(deps));
  const vm={...page.methods,locale:'zh-Hans',ownsDataScope:()=>true,restoreSession:()=>restores++,refreshEntitlement:()=>checks++};
  page.onLoad.call(vm,mode==='empty'?{}:{petId:'requested'});
  if(mode==='valid'){assert.equal(vm.pet.id,'requested');assert.equal(checks,1);assert.equal(restores,1);continue;}
  assert.equal(checks,0);assert.equal(restores,0);assert.equal(vm.pet,null);
  assert.equal(vm.lastGenerationFailure.stage,'PAGE_ENTRY');assert.equal(vm.lastGenerationFailure.status,'NOT_STARTED');
  assert.equal(vm.errorMessage,'avatar.petUnavailable');assert.equal(vm.generationRecoveryAction(),'home');
  vm.resumeOrRetry();assert.deepEqual(navigation,['/pages/home/home']);
  if(mode==='unresolved')assert.equal(lookups,0);
 }
});
test('login-required entitlement gives an explicit login action without polling or overwriting the saved pet',async()=>{
 const s=setup('AVATAR_LOGIN_REQUIRED');await s.vm.ensureEntitlement();
 assert.equal(s.vm.phase,'failed');assert.equal(s.vm.errorMessage,'avatar.loginRequired');
 s.vm.resumeOrRetry();assert.equal(s.navigation[0],'/pages/auth/login?redirect='+encodeURIComponent('/pages/account/account-security'));
 assert.equal(s.writes.length,0);assert.deepEqual(s.counts(),{checks:1,polls:0,requests:0});
});
test('unclaimed local imports lead to account/data controls; an expired token asks for login; service failure never clears identity',()=>{
 for(const [code,route] of [['LOCAL_IMPORT_CLOUD_LINK_REQUIRED','/pages/account/account-security'],['AVATAR_AUTH_EXPIRED','/pages/auth/login?redirect='+encodeURIComponent('/pages/account/account-security')]]){
  const s=setup(code);s.vm.failGeneration({code});s.vm.resumeOrRetry();assert.equal(s.navigation[0],route);assert.equal(s.writes.length,0);assert.equal(s.counts().requests,0);
 }
 const s=setup('AVATAR_AUTH_UNAVAILABLE');s.vm.failGeneration({code:'AVATAR_AUTH_UNAVAILABLE'});
 assert.equal(s.vm.errorMessage,'avatar.authUnavailable');assert.equal(s.writes.length,0);assert.equal(s.navigation.length,0);
 s.vm.ownsDataScope=()=>false;s.vm.resumeOrRetry();assert.equal(s.counts().polls,0);
});
