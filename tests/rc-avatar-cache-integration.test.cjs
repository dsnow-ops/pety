const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
const core=Function(read('common/avatar-file-cache.js').replace(/export /g,'')+';return{createAvatarFileCache};')();
const exported=['configureAvatarFileCache','reuseConfirmedAvatarAsset','isAvatarFileCacheEnabled','resolvePetHeroAsset','hydratePetHeroAsset','invalidateAvatarUrl','subscribeAvatarAssets','peekAvatarCandidateUrl','hydrateAvatarCandidateAsset','pinAvatarCandidateAsset','clearAvatarDisplayAssetCache'];
function setup(){
 let owner={namespace:'guest:local',version:0,ready:true},index,downloads=0,urlCalls=0,sdkCalls=0,id=0,time=1000;
 const files=new Map(),info={bytes:8000000,width:2048,height:2048,format:'png',readable:true};
 const adapter={namespace:()=>owner.namespace,ownerVersion:()=>owner.version,readIndex:()=>structuredClone(index),writeIndex:x=>index=structuredClone(x),isCachePath:p=>p?.startsWith('_doc/pety-avatar-cache-v1/'),
  inspect:async p=>{if(!files.has(p))throw Object.assign(Error('missing'),{code:'ASSET_FILE_MISSING'});return files.get(p)},
  download:async()=>{downloads++;const path='tmp/'+(++id);files.set(path,{...info});return{path,statusCode:200}},
  persist:async p=>{const path='_doc/pety-avatar-cache-v1/'+(++id)+'.png';files.set(path,files.get(p));files.delete(p);return path},
  remove:async p=>files.delete(p),removeTemporary:async p=>files.delete(p)};
 const cloud={callFunction:async()=>{urlCalls++;return{result:{code:0,runtimeEnvironment:'cloud',fileList:[{tempFileURL:'https://cdn.test/full.png?Expires=9999999999&signature=secret'}]}}},getTempFileURL:async()=>{sdkCalls++;throw Error('must not bypass owner checked endpoint')}};
 let cache;
 const make=()=>{cache=core.createAvatarFileCache(adapter,{now:()=>time});const api=Function('uniCloud',read('common/avatar-display-asset.js').replace(/export /g,'')+';return{'+exported.join(',')+'};')(cloud);api.configureAvatarFileCache({getCache:()=>cache,readOwner:()=>owner});return api};
 const api=make();
 const pet={id:'cat',generatedAvatarJobId:'job-cat',generatedAvatarFileId:'cloud://space/pet-avatar/final/cat/job-cat/final.png',generatedAvatarMainAssetMetadata:{width:2048,height:2048,providerOriginal:true}};
 const candidate={jobId:'job-cat',fileId:pet.generatedAvatarFileId,mainAssetMetadata:pet.generatedAvatarMainAssetMetadata,generatedTempUrl:'https://cdn.test/not-a-display-source'};
 return{api,pet,candidate,adapter,files,cloud,make,advance:()=>time+=70000,cache:()=>cache,owner:()=>owner,change:namespace=>owner={namespace,version:owner.version+1,ready:true},counts:()=>({downloads,urlCalls,sdkCalls})};
}

function authorizeImport(s, pet) {
 const {canImportGuestAvatarAsset}=Function(read('common/avatar-cache-retention.js').replace(/export /g,'')+';return{canImportGuestAvatarAsset};')();
 const disk=new Map([
  ['pety_owner_v1:account%3AA:pety_guest_import_v1',{status:'imported',ids:[pet.id],pets:[structuredClone(pet)]}],
  ['pety_owner_v1:account%3AA:my_pets_list',[structuredClone(pet)]]
 ]);
 s.adapter.canImportGuestAsset=asset=>canImportGuestAvatarAsset(asset,key=>disk.get(key));
 return disk;
}

test('imported pet keeps generated image instead of source photo after login and offline restart',async()=>{
 const s=setup();const before=await s.api.hydratePetHeroAsset(s.pet,{preferFinal:true});
 const pet={...s.pet,localImportPending:true,generatedAvatarUrl:'https://expired.invalid/master',originalPhotoUrl:'_doc/source.jpg'};
 authorizeImport(s,pet);s.change('account:A');const counts=s.counts();
 const api=s.make();const after=await api.hydratePetHeroAsset(pet,{preferFinal:true});
 assert.equal(after.imageUrl,before.imageUrl);assert.equal(after.assetKind,'final');
 assert.equal(api.resolvePetHeroAsset(pet).imageUrl,before.imageUrl);
 assert.equal((await s.make().hydratePetHeroAsset(pet)).imageUrl,before.imageUrl);
 assert.deepEqual(s.counts(),counts);
 s.change('account:B');assert.notEqual((await s.make().hydratePetHeroAsset(pet)).imageUrl,before.imageUrl);
 assert.deepEqual(s.counts(),counts);
});

test('import receipt does not authorize a different generation or withdrawn import',async()=>{
 const s=setup();const before=await s.api.hydratePetHeroAsset(s.pet);
 const pet={...s.pet,localImportPending:true};const disk=authorizeImport(s,pet);s.change('account:A');
 const api=s.make();
 assert.notEqual((await api.hydratePetHeroAsset({...pet,generatedAvatarFileId:'cloud://other'})).imageUrl,before.imageUrl);
 disk.delete('pety_owner_v1:account%3AA:pety_guest_import_v1');
 assert.equal((await api.hydratePetHeroAsset(pet)).imageUrl,'');
 assert.equal(s.cache().diagnostics().entries,0);
});

test('account switch during imported image validation cannot publish guest bytes to another account',async()=>{
 const s=setup();await s.api.hydratePetHeroAsset(s.pet);
 const pet={...s.pet,localImportPending:true};authorizeImport(s,pet);s.change('account:A');const api=s.make();
 const inspect=s.adapter.inspect;s.adapter.inspect=async path=>{const info=await inspect(path);s.change('account:B');return info};
 assert.equal((await api.hydratePetHeroAsset(pet)).imageUrl,'');
 assert.equal(s.cache().diagnostics().entries,0);
 s.change('account:A');assert.equal(s.cache().diagnostics().entries,0);
});

test('missing guest cache never renews guest URLs or spends generation quota',async()=>{
 const s=setup();await s.api.hydratePetHeroAsset(s.pet);s.files.clear();
 const pet={...s.pet,localImportPending:true,originalPhotoUrl:'_doc/source.jpg'};
 authorizeImport(s,pet);s.change('account:A');const counts=s.counts();
 assert.equal((await s.make().hydratePetHeroAsset(pet)).imageUrl,pet.originalPhotoUrl);
 assert.deepEqual(s.counts(),counts);
});

test('confirmed server copy reaches the home selector without a second body, including restart offline',async()=>{
 const s=setup(),{masterCopyReceipt}=require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/avatar-master-copy.js');
 const original=await s.api.hydrateAvatarCandidateAsset(s.candidate,s.pet,{loadUrl:async()=> 'https://cdn.test/candidate'});
 const metadata={width:2048,height:2048,bytes:8000000,contentSha256:'a'.repeat(64)};
 const finalId='cloud://space/final/new.png';
 const receipt=masterCopyReceipt({generatedFileId:s.candidate.fileId,generatedCandidateSha256:metadata.contentSha256},finalId,metadata);
 const confirmed={selectedJobId:s.candidate.jobId,generatedFileId:finalId,mainAssetMetadata:metadata,masterCopy:receipt};
 const scope={version:0};
 const deps={uni:{getStorageSync:()=> 'official-test-token'},scopedStorage:{getStorageSync:key=>key==='pet_avatar_session_cat'?{petId:'cat',sessionId:'session',candidates:[s.candidate]}:undefined},
  captureDataScope:()=>scope,assertDataScope:value=>assert.equal(value,scope),hasAiConsent:()=>true,buildAiConsentPayload:()=>({}),
  uniCloud:{callFunction:async({data})=>{assert.equal(data.action,'confirmAvatar');assert.equal(data.selectedJobId,s.candidate.jobId);return {result:{code:0,...confirmed}}}},
  reuseConfirmedAvatarAsset:s.api.reuseConfirmedAvatarAsset};
 const source=read('common/pet-avatar-generator.js').replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g,'').replace(/export /g,'');
 const confirm=Function(...Object.keys(deps),source+';return confirmGeneratedAvatar;')(...Object.values(deps));
 await confirm(s.pet,s.candidate.jobId);
 const finalPet={...s.pet,generatedAvatarFileId:finalId,generatedAvatarMainAssetMetadata:metadata};
 assert.equal(s.api.resolvePetHeroAsset(finalPet,{preferFinal:true}).imageUrl,original.url);
 s.cloud.callFunction=async()=>{throw Error('offline')};
 assert.equal((await s.make().hydratePetHeroAsset(finalPet,{preferFinal:true})).imageUrl,original.url);
 assert.equal(s.counts().downloads,1);assert.equal(s.cache().diagnostics().cachedBytes,8000000);
});

test('missing, changed or wrong-job copy receipts cannot lend a candidate image to final',async()=>{
 const s=setup();await s.api.hydrateAvatarCandidateAsset(s.candidate,s.pet,{loadUrl:async()=> 'https://cdn.test/candidate'});
 const metadata={width:2048,height:2048,bytes:8000000,contentSha256:'a'.repeat(64)};
 const confirmed={selectedJobId:'another-job',generatedFileId:'final',mainAssetMetadata:metadata,masterCopy:{version:1,sourceFileId:s.candidate.fileId,targetFileId:'final',sha256:metadata.contentSha256,...metadata}};
 assert.equal(await s.api.reuseConfirmedAvatarAsset(s.candidate,s.pet,confirmed),false);
 confirmed.selectedJobId=s.candidate.jobId;confirmed.masterCopy.sha256='b'.repeat(64);
 assert.equal(await s.api.reuseConfirmedAvatarAsset(s.candidate,s.pet,confirmed),false);
 delete confirmed.masterCopy;assert.equal(await s.api.reuseConfirmedAvatarAsset(s.candidate,s.pet,confirmed),false);
 assert.equal(s.cache().diagnostics().entries,1);
 const {masterCopyReceipt}=require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/avatar-master-copy.js');
 assert.equal(masterCopyReceipt({generatedFileId:'source',generatedCandidateSha256:'b'.repeat(64)},'final',metadata),null);
});

test('three automatic failures stay paused; explicit candidate retry can recover without restarting',async()=>{
 const s=setup(),download=s.adapter.download;let attempts=0;
 s.adapter.download=async()=>{attempts++;throw Error('offline')};
 const loadUrl=async()=> 'https://cdn.test/full.png';
 for(let n=0;n<3;n++){await assert.rejects(s.api.hydrateAvatarCandidateAsset(s.candidate,s.pet,{loadUrl}),/offline/);s.advance()}
 s.adapter.download=download;
 await assert.rejects(s.api.hydrateAvatarCandidateAsset(s.candidate,s.pet,{loadUrl}),{code:'ASSET_RETRY_PAUSED'});
 const result=await s.api.hydrateAvatarCandidateAsset(s.candidate,s.pet,{loadUrl,userRetry:true});
 assert.ok(result.url.startsWith('_doc/'));assert.equal(attempts,3);assert.equal(s.counts().downloads,1);
});

test('native preloader invalidates only an actual current image error; timeout and stale URL keep valid bytes',()=>{
 const source=read('pages/avatar-generate/avatar-generate.vue').match(/<script>([\s\S]*?)<\/script>/)[1].replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g,'').replace('export default','return');
 const invalid=[];
 const deps={AiDataConsentSheet:{},PetPortraitStage:{},PetGenerationParticles:{},isAvatarFileCacheEnabled:()=>true,invalidateAvatarUrl:(...args)=>invalid.push(args),clearTimeout(){}};
 const c=Function(...Object.keys(deps),source)(...Object.values(deps));
 const vm={...c.methods,pet:{id:'cat'},ownsDataScope:()=>true,resultStage:'RESULT_LOADING',preloadRequestId:7,preloadCandidateUrl:'file:///current',preloadCandidateJobId:'job',candidates:[{jobId:'job',fileId:'file'}],candidateUrlCache:new Map(),candidateUrlInvalid:new Set(),candidateCacheVersion:0};
 vm.onResultPreloadFailed();assert.equal(invalid.length,0);
 vm.preloadFailed=false;vm.onResultPreloadFailed({currentTarget:{dataset:{requestId:6,url:'file:///current'}}});assert.equal(invalid.length,0);assert.equal(vm.preloadFailed,false);
 vm.onResultPreloadFailed({currentTarget:{dataset:{requestId:7,url:'file:///old'}}});assert.equal(invalid.length,0);assert.equal(vm.preloadFailed,false);
 vm.onResultPreloadFailed({currentTarget:{dataset:{requestId:7,url:'file:///current'}}});assert.deepEqual(invalid,[['cat','file','file:///current']]);
});

test('thumbnail decoder recovery rejects stale events and stops after one replacement',async()=>{
 const source=read('pages/avatar-generate/avatar-generate.vue').match(/<script>([\s\S]*?)<\/script>/)[1].replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g,'').replace('export default','return');
 let thumb='file:///thumb-new',downloads=0;const invalid=[];
 const deps={AiDataConsentSheet:{},PetPortraitStage:{},PetGenerationParticles:{},isAvatarFileCacheEnabled:()=>true,invalidateAvatarUrl:(...args)=>invalid.push(args),peekAvatarCandidateUrl:(_c,_p,thumbnail)=>thumbnail?thumb:'file:///master'};
 const c=Function(...Object.keys(deps),source)(...Object.values(deps));
 const candidate={jobId:'job',fileId:'master',generatedThumbnailFileId:'thumb'};
 const vm={...c.methods,pet:{id:'cat'},ownsDataScope:()=>true,candidateThumbnailRecovery:new Map(),candidateThumbnailUrlCache:new Map([['thumb',thumb]]),candidateThumbnailUrlInvalid:new Set(),candidateCacheVersion:0,
  hydrateCandidateFile:async()=>{downloads++;thumb='file:///thumb-repaired';vm.candidateThumbnailUrlCache.set('thumb',thumb)}};
 const key=JSON.stringify(['cat','master','thumb']);
 const event=url=>({currentTarget:{dataset:{assetKey:key,url}}});
 await vm.onCandidateThumbnailError(candidate,event('file:///thumb-old'));assert.equal(invalid.length,0);assert.equal(downloads,0);
 await vm.onCandidateThumbnailError(candidate,event(thumb));assert.equal(invalid.length,1);assert.equal(downloads,1);
 await vm.onCandidateThumbnailError(candidate,event('file:///thumb-new'));assert.equal(invalid.length,1);
 await vm.onCandidateThumbnailError(candidate,event(thumb));assert.equal(vm.getCandidateThumbnailUrl(candidate),'file:///master');
 await vm.onCandidateThumbnailError(candidate,event('file:///master'));assert.equal(downloads,1);assert.equal(invalid.length,1);
});

test('workbench manual retry revalidates cached bytes and forwards only the explicit user action',async()=>{
 const source=read('pages/avatar-generate/avatar-generate.vue').match(/<script>([\s\S]*?)<\/script>/)[1].replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g,'').replace('export default','return');
 const deps={AiDataConsentSheet:{},PetPortraitStage:{},PetGenerationParticles:{},isAvatarFileCacheEnabled:()=>true,peekAvatarCandidateUrl:()=> 'file:///cached',resolveWorkbenchMasterAsset:()=>({qualified:true,fileId:'master'}),setTimeout:()=>1,clearTimeout(){}};
 const c=Function(...Object.keys(deps),source)(...Object.values(deps));
 const candidate={jobId:'job',fileId:'master'},calls=[];
 const vm={...c.methods,pet:{id:'cat'},ownsDataScope:()=>true,candidates:[candidate],selectedCandidate:candidate,preloadCandidateJobId:'job',preloadRequestId:0,
  hydrateCandidateFile:async(_c,thumbnail,options)=>{calls.push({thumbnail,options});return 'file:///validated'}};
 await vm.beginCandidatePreload(candidate);assert.equal(vm.preloadCandidateUrl,'file:///cached');assert.equal(calls.length,0);
 await vm.retryResultPreview();assert.equal(vm.preloadCandidateUrl,'file:///validated');assert.deepEqual(calls,[{thumbnail:false,options:{userRetry:true}}]);assert.equal(vm.actionLocked,false);
});
test('native resolver publishes only validated persistent files; home/workbench/avatar share a single download',async()=>{
 const s=setup(),seen=[];s.api.subscribeAvatarAssets(()=>seen.push(s.api.resolvePetHeroAsset(s.pet,{preferFinal:true}).imageUrl));
 assert.equal(s.api.resolvePetHeroAsset(s.pet).imageUrl,'');
 const [home,candidate,avatar]=await Promise.all([
  s.api.hydratePetHeroAsset(s.pet,{preferFinal:true}),
  s.api.hydrateAvatarCandidateAsset(s.candidate,s.pet,{loadUrl:async()=>{throw Error('already single flight')}}),
  s.api.hydratePetHeroAsset(s.pet,{preferFinal:true})]);
 assert.ok(home.imageUrl.startsWith('_doc/'));assert.equal(home.imageUrl,candidate.url);assert.equal(avatar.imageUrl,home.imageUrl);
 assert.ok(seen.length);assert.ok(seen.every(url=>url.startsWith('_doc/')));assert.equal(home.urlRuntime,'app-private-cache');
 assert.equal(s.counts().downloads,1);assert.equal(s.counts().urlCalls,1);assert.equal(s.counts().sdkCalls,0);
});
test('20 native returns, force URL refresh, restart and offline validation do not fetch a second body or URL',async()=>{
 const s=setup(),first=await s.api.hydratePetHeroAsset(s.pet,{preferFinal:true});
 for(let n=0;n<20;n++)assert.equal((await s.api.hydratePetHeroAsset(s.pet,{preferFinal:true,forceRefresh:true})).imageUrl,first.imageUrl);
 const next=s.make();s.cloud.callFunction=async()=>{throw Error('offline')};
 assert.equal(next.resolvePetHeroAsset(s.pet).imageUrl,'','cold index must first be validated');
 assert.equal((await next.hydratePetHeroAsset(s.pet,{preferFinal:true})).imageUrl,first.imageUrl);
 assert.deepEqual(s.counts(),{downloads:1,urlCalls:1,sdkCalls:0});
});
test('remote renewal and transient decode failures preserve bytes; missing local file recovers once',async()=>{
 const s=setup(),first=await s.api.hydratePetHeroAsset(s.pet,{preferFinal:true});
 s.api.invalidateAvatarUrl('cat',s.pet.generatedAvatarFileId,'https://cdn.test/expired');
 assert.equal(s.api.resolvePetHeroAsset(s.pet).imageUrl,first.imageUrl);
 s.api.invalidateAvatarUrl('cat',s.pet.generatedAvatarFileId,first.imageUrl);
 assert.equal(s.api.resolvePetHeroAsset(s.pet).imageUrl,'');
 const [a,b]=await Promise.all([s.api.hydratePetHeroAsset(s.pet,{preferFinal:true}),s.api.hydratePetHeroAsset(s.pet,{preferFinal:true})]);
 assert.equal(a.imageUrl,first.imageUrl);assert.equal(b.imageUrl,a.imageUrl);assert.equal(s.counts().downloads,1);
 s.files.delete(a.imageUrl);s.api.invalidateAvatarUrl('cat',s.pet.generatedAvatarFileId,a.imageUrl);
 const recovered=await Promise.all([s.api.hydratePetHeroAsset(s.pet,{preferFinal:true}),s.api.hydratePetHeroAsset(s.pet,{preferFinal:true})]);
 assert.ok(recovered[0].imageUrl);assert.equal(recovered[0].imageUrl,recovered[1].imageUrl);assert.notEqual(recovered[0].imageUrl,a.imageUrl);assert.equal(s.counts().downloads,2);
});
test('account A-B-A rejects an old signature response without poisoning the newly selected owner',async()=>{
 const s=setup();let release,entered;const started=new Promise(r=>entered=r);
 const call=s.cloud.callFunction;s.cloud.callFunction=async()=>{entered();await new Promise(r=>release=r);return call()};
 const pending=s.api.hydratePetHeroAsset(s.pet,{preferFinal:true});await started;
 s.change('account:B');s.change('guest:local');release();const result=await pending;assert.equal(result.imageUrl,'');assert.equal(s.counts().downloads,0);
 s.cloud.callFunction=call;assert.ok((await s.api.hydratePetHeroAsset(s.pet,{preferFinal:true})).imageUrl);
 s.change('account:B');assert.equal(s.api.resolvePetHeroAsset(s.pet).imageUrl,'');
 const b=await s.api.hydratePetHeroAsset(s.pet,{preferFinal:true});assert.ok(b.imageUrl);assert.equal(s.counts().downloads,2);
});
test('owner endpoint failure is not bypassed through direct storage and never publishes a URL',async()=>{
 const s=setup();s.cloud.callFunction=async()=>({result:{code:403,errorCode:'FORBIDDEN'}});
 const result=await s.api.hydratePetHeroAsset(s.pet,{preferFinal:true});assert.equal(result.imageUrl,'');assert.equal(s.counts().downloads,0);assert.equal(s.counts().sdkCalls,0);
});
test('native missing files rehydrate once, but lower resolution bytes never replace the 2K master',async()=>{
 const s=setup(),first=await s.api.hydratePetHeroAsset(s.pet,{preferFinal:true});s.files.delete(first.imageUrl);
 const repaired=await s.api.hydratePetHeroAsset(s.pet,{preferFinal:true});assert.ok(repaired.imageUrl);assert.equal(s.counts().downloads,2);
 s.files.delete(repaired.imageUrl);s.api.invalidateAvatarUrl('cat',s.pet.generatedAvatarFileId,repaired.imageUrl);
 const download=s.adapter.download;s.adapter.download=async(...args)=>{const result=await download(...args);s.files.get(result.path).width=1024;return result};
 const bad=await s.api.hydratePetHeroAsset(s.pet,{preferFinal:true});assert.equal(bad.imageUrl,'');assert.equal(s.files.size,0);
});
test('actual workbench cannot shortcut a signed candidate URL when native cache is enabled',async()=>{
 const s=setup(),source=read('pages/avatar-generate/avatar-generate.vue').match(/<script>([\s\S]*?)<\/script>/)[1].replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g,'').replace('export default','return');
 const bindings={...s.api,AiDataConsentSheet:{},PetPortraitStage:{},PetGenerationParticles:{},setTimeout:()=>1,clearTimeout(){},
  resolveWorkbenchMasterAsset:()=>({qualified:true,fileId:s.candidate.fileId}),readAvatarCandidateTransport:async()=>({jobId:s.candidate.jobId,generatedFileId:s.candidate.fileId,generatedTempUrl:'https://cdn.test/owner-checked'})};
 const c=Function(...Object.keys(bindings),source)(...Object.values(bindings));
 const vm={...c.methods,pet:s.pet,ownsDataScope:()=>true,candidates:[s.candidate],preloadRequestId:0,candidateCacheVersion:0,candidateUrlCache:new Map([[s.candidate.fileId,s.candidate.generatedTempUrl]]),candidateUrlInvalid:new Set(),candidateThumbnailUrlCache:new Map()};
 await vm.beginCandidatePreload(s.candidate);
 assert.ok(vm.preloadCandidateUrl.startsWith('_doc/'));assert.equal(vm.preloadFailed,false);assert.equal(s.counts().downloads,1);
});
