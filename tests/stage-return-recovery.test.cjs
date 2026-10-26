const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {ownedMediaCloud,clientUni}=require('./fixtures/owned-media-cloud.cjs');
test('return and same-master URL renewal reuse the qualified palette instead of resampling',()=>{
 const source=fs.readFileSync('components/PetPortraitStage.vue','utf8').match(/<script>([\s\S]*?)<\/script>/)[1].replace(/import[^;]+;/g,'').replace('export default','return');
 const scope={};let draws=0,published=0;const palette={edgeVersion:2};
 const uni={getImageInfo:o=>o.success({width:2048,height:2048}),createSelectorQuery:()=>({in(){return this},select(){return this},boundingClientRect(){return this},exec(){}}),createCanvasContext(){draws++;throw Error('unexpected resample')}};
 const c=Function('uni','readStagePalette','isDataScopeCurrent',source)(uni,()=>palette,s=>s===scope);
 const vm={dataScope:scope,identity:'A::master::master',imageUrl:'url1',epoch:0,disposed:false,publishPalette(){published++}};
 c.methods.sample.call(vm);vm.imageUrl='renewed';c.methods.sample.call(vm);
 assert.equal(draws,0);assert.equal(published,2);assert.equal(vm.paletteSettled,true);
});
test('palette sampling uses the displayed URL even when native image info reuses a temp path',()=>{
 const source=fs.readFileSync('components/PetPortraitStage.vue','utf8').match(/<script>([\s\S]*?)<\/script>/)[1].replace(/import[^;]+;/g,'').replace('export default','return');
 const scope={};let infoCallback,drawn='';
 const uni={getImageInfo:o=>infoCallback=o.success,createSelectorQuery:()=>({in(){return this},select(){return this},boundingClientRect(){return this},exec(){}}),createCanvasContext:()=>({clearRect(){},drawImage:src=>drawn=src,draw(){}})};
 const c=Function('uni','readStagePalette','isDataScopeCurrent',source)(uni,()=>null,s=>s===scope);
 const vm={dataScope:scope,identity:'dog::master::master',imageUrl:'https://assets/dog/final.png',epoch:0,disposed:false};
 c.methods.sample.call(vm);infoCallback({path:'_doc/shared/final.png',width:2048,height:2048});
 assert.equal(drawn,vm.imageUrl);
 drawn='';c.methods.sample.call(vm);vm.identity='cat::master::master';vm.imageUrl='https://assets/cat/final.png';infoCallback({path:'_doc/shared/final.png',width:2048,height:2048});
 assert.equal(drawn,'','late native info must not draw into the next pet');
});
test('Home publishes a renewed URL without a cache event and rejects late recovery after switching pets',async()=>{
 const script=fs.readFileSync('pages/home/home.vue','utf8').match(/<script>([\s\S]*?)<\/script>/)[1].replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g,'').replace('export default','const HomeLifePreview = {}; return');
 let finish;const refreshed={imageUrl:'renewed',displayFileId:'masterA'};
 const c=Function('HomeAlbumCover','PetAvatarHero','PetPortraitStage','invalidateAvatarUrl','hydrateHeroVisualAsset',script)({}, {}, {}, ()=>{}, ()=>new Promise(r=>finish=r));
 const pet={id:'A',generatedAvatarFileId:'masterA'},event={petId:'A',masterKey:'masterA',imageUrl:'expired'};
 const vm={activePet:pet,pageVisible:true,homeHeroAsset:{masterFileId:'masterA',displayFileId:'masterA',imageUrl:'expired'},heroRecoveryAttempts:{},heroRequestId:0,heroAssetRevision:0,isCurrentAvatarOwner:owner=>vm.activePet===owner};
 let pending=c.methods.onHeroAssetError.call(vm,event);finish(refreshed);await pending;
 assert.equal(vm.hydratedHeroAsset,refreshed);assert.equal(vm.heroAssetRevision,1);
 pending=c.methods.onHeroAssetError.call(vm,event);vm.activePet={id:'B'};vm.hydratedHeroAsset=null;finish(refreshed);await pending;
 assert.equal(vm.hydratedHeroAsset,null);assert.equal(vm.heroAssetRevision,1);
});
test('signed URL lifetime prevents five-minute renewal churn and explicit failure still renews',async()=>{
 let now=100000,calls=0,renew;const DateMock={now:()=>now};
 const api=Function('uniCloud','Date','uni',fs.readFileSync('common/avatar-display-asset.js','utf8').replace(/export /g,'')+';return {resolvePetHeroAsset,hydratePetHeroAsset};')(ownedMediaCloud(async()=>{calls++;if(calls===1)return{fileList:[{tempFileURL:'https://a/master?Expires=99999'}]};return new Promise(r=>renew=r);}),DateMock,clientUni);
 const pet={id:'A',generatedAvatarFileId:'master-A'};
 await api.hydratePetHeroAsset(pet,{preferFinal:true});now+=6*60000;
 assert.ok(api.resolvePetHeroAsset(pet,{preferFinal:true}).imageUrl);
 await api.hydratePetHeroAsset(pet,{preferFinal:true});assert.equal(calls,1,'a valid signed URL should keep its browser cache key');
 const pending=api.hydratePetHeroAsset(pet,{preferFinal:true,forceRefresh:true});assert.equal(calls,2);assert.ok(api.resolvePetHeroAsset(pet).masterFileId);
 assert.equal(api.resolvePetHeroAsset({...pet,id:'B'}).imageUrl,'');
 renew({fileList:[{tempFileURL:'https://a/fresh?Expires=99999'}]});await pending;assert.match(api.resolvePetHeroAsset(pet).imageUrl,/fresh/);
 now=100000000;assert.equal(api.resolvePetHeroAsset(pet).imageUrl,'','actual expiry remains enforced');
});
test('same-owner URL gaps retain loaded image but pet/master changes clear it',()=>{
 const src=fs.readFileSync('components/PetPortraitStage.vue','utf8').match(/<script>([\s\S]*?)<\/script>/)[1].replace(/import[^;]+;/g,'').replace('export default','return');
 const c=Function('readStagePalette','DEFAULT_STAGE_PALETTE',src)(()=>null,{});
 const vm={epoch:0,loadedUrl:'urlA',previous:'',ready:true,publishPalette(){}};
 c.watch.imageUrl.call(vm,'','urlA');assert.equal(vm.loadedUrl,'urlA');assert.equal(vm.ready,true);assert.equal(vm.previous,'','keep the existing node instead of creating another image request');
 c.watch.imageUrl.call(vm,'urlA2','');assert.equal(vm.previous,'urlA');
 c.watch.identity.call(vm);assert.equal(vm.previous,'');assert.equal(vm.loadedUrl,'');
});

test('a final URL failure is not a new stage identity, but a new master or pet is',()=>{
 const src=fs.readFileSync('components/PetPortraitStage.vue','utf8').match(/<script>([\s\S]*?)<\/script>/)[1].replace(/import[^;]+;/g,'').replace('export default','return');
 const c=Function(src)();const vm={petId:'dog',masterKey:'master-dog',assetKey:'master-dog'};
 const loaded=c.computed.identity.call(vm);vm.assetKey='';
 assert.equal(c.computed.identity.call(vm),loaded,'selector placeholder must not clear the already decoded same-master image');
 vm.petId='cat';assert.notEqual(c.computed.identity.call(vm),loaded);
 vm.petId='dog';vm.masterKey='new-master';assert.notEqual(c.computed.identity.call(vm),loaded);
 vm.masterKey='master-dog';vm.assetKey='different-derivative';assert.notEqual(c.computed.identity.call(vm),loaded);
 assert.equal(c.computed.displayUrl.call({imageUrl:'',loadedUrl:'decoded-url'}),'decoded-url');
 assert.equal(c.computed.displayUrl.call({imageUrl:'renewed-url',loadedUrl:'decoded-url'}),'renewed-url');
});

test('Home retains decoded image texture only for the same pet and master, including release builds',()=>{
 const script=fs.readFileSync('pages/home/home.vue','utf8').match(/<script>([\s\S]*?)<\/script>/)[1].replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g,'').replace('export default','const HomeLifePreview = {}; return');
 const c=Function('HomeAlbumCover','PetAvatarHero','PetPortraitStage','isDevelopmentEnvironment',script)({}, {}, {},()=>false);
 const vm={pageVisible:true,activePet:{id:'dog'},homeHeroAsset:{petId:'dog',masterFileId:'master',imageUrl:'decoded-url'}};
 c.methods.onHeroAssetLoaded.call(vm,{petId:'dog',masterKey:'master',imageUrl:'decoded-url'});
 vm.homeHeroAsset.imageUrl='';assert.match(c.computed.portraitTextureStyle.call(vm).backgroundImage,/decoded-url/);
 vm.homeHeroAsset.petId='cat';assert.equal(c.computed.portraitTextureStyle.call(vm).backgroundImage,'none');
 vm.homeHeroAsset.petId='dog';vm.homeHeroAsset.masterFileId='replacement';assert.equal(c.computed.portraitTextureStyle.call(vm).backgroundImage,'none');
});
test('background renewal failure does not blacklist a still-valid displayed master',async()=>{
 let now=100000,calls=0;
 const api=Function('uniCloud','Date','uni',fs.readFileSync('common/avatar-display-asset.js','utf8').replace(/export /g,'')+';return {resolvePetHeroAsset,hydratePetHeroAsset};')(ownedMediaCloud(async()=>{if(++calls>1)throw Error('offline');return{fileList:[{tempFileURL:'https://a/master?Expires=99999'}]};}),{now:()=>now},clientUni);
 const pet={id:'A',generatedAvatarFileId:'master-A'};
 await api.hydratePetHeroAsset(pet);now+=6*60000;
 const result=await api.hydratePetHeroAsset(pet);assert.ok(result.imageUrl);assert.equal(api.resolvePetHeroAsset(pet).assetKind,'final');assert.ok(api.resolvePetHeroAsset(pet).imageUrl);
});
test('a shared-cache URL disappearance triggers bounded Home recovery and stops after ownership changes',async()=>{
 const script=fs.readFileSync('pages/home/home.vue','utf8').match(/<script>([\s\S]*?)<\/script>/)[1].replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g,'').replace('export default','const HomeLifePreview = {}; return');
 const callbacks=[];let calls=0;
 const c=Function('HomeAlbumCover','PetAvatarHero','PetPortraitStage','setTimeout','clearTimeout','resolveHeroVisualAsset','hydrateHeroVisualAsset',script)({}, {}, {},fn=>{callbacks.push(fn);return callbacks.length},()=>{},()=>({imageUrl:''}),async()=>{calls++;return{imageUrl:''}});
 const owner={id:'A',generatedAvatarFileId:'masterA'};
 const vm={activePet:owner,pageVisible:true,heroRequestId:2,heroAssetRevision:0,stageUrlRecoveryAttempts:0,isCurrentAvatarOwner:p=>p===vm.activePet};
 vm.scheduleStageUrlRecovery=c.methods.scheduleStageUrlRecovery.bind(vm);
 c.watch['homeHeroAsset.imageUrl'].call(vm,'');
 while(callbacks.length)await callbacks.shift()();
 assert.equal(calls,3);assert.equal(vm.stageUrlRecoveryAttempts,3);
 c.watch['homeHeroAsset.imageUrl'].call(vm,'');assert.equal(callbacks.length,0);
 vm.stageUrlRecoveryAttempts=0;c.watch['homeHeroAsset.imageUrl'].call(vm,'');vm.activePet={id:'B'};await callbacks.shift()();assert.equal(calls,3);
});
test('hidden Home adopts the selected pet before becoming visible and only unsubscribes on unload',()=>{
 const script=fs.readFileSync('pages/home/home.vue','utf8').match(/<script>([\s\S]*?)<\/script>/)[1].replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g,'').replace('export default','const HomeLifePreview = {}; return');
 let selection,unsubscribed=false,stored={id:'A'},loads=0;
 const c=Function('HomeAlbumCover','PetAvatarHero','PetPortraitStage','subscribePetSelection','subscribeAvatarAssets',script)({}, {}, {},fn=>{selection=fn;return()=>{unsubscribed=true}},()=>()=>{});
 const vm={activePet:stored,avatarOwnerEpoch:0,heroRequestId:0,loadHomeData(){loads++;this.activePet=stored},refreshPendingAvatarAsset(){},schedulePersonaIntro(){},$nextTick(fn){fn()},maybeShowOnboardingGuide(){},clearPersonaIntroTimer(){},clearAvatarCutoutPoll(){},clearAvatarDebugTapTimer(){}};
 c.onShow.call(vm);assert.equal(loads,1);stored={id:'B'};selection('B');assert.equal(loads,2);assert.equal(vm.activePet.id,'B');
 selection('B');assert.equal(loads,2);c.onHide.call(vm);
 stored={id:'C'};selection('C');assert.equal(vm.activePet.id,'C','hidden Home must not carry pet B into its first visible frame');assert.equal(loads,3);
 assert.equal(unsubscribed,false);selection('C');assert.equal(loads,3,'same pet keeps its decoded resource');
 c.onUnload.call(vm);assert.equal(unsubscribed,true);
});
test('hidden owner replacement updates name, relationship and asset together; late old hydration cannot restore it',async()=>{
 const script=fs.readFileSync('pages/home/home.vue','utf8').match(/<script>([\s\S]*?)<\/script>/)[1].replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g,'').replace('export default','const HomeLifePreview = {}; return');
 let stored={id:'white',name:'Yyuy',status:'current',generatedAvatarFileId:'white-master'},tab;
 const pending=[];
 const asset=p=>({petId:p.id,masterFileId:p.generatedAvatarFileId,displayFileId:p.generatedAvatarFileId,imageUrl:p.id==='uncached'?'':'cached-'+p.id});
 const scope={};const deps={scopedStorage:{getStorageSync:key=>({records:key.includes('white')?{entry:{kind:'life',localDate:''}}:{}})},captureDataScope:()=>scope,isDataScopeCurrent:s=>s===scope,setThemePet:()=>{},HomeAlbumCover:{},PetAvatarHero:{},PetPortraitStage:{},getActivePet:()=>stored,setRelationshipTabBar:s=>tab=s,getPetRelationshipStage:p=>p.status,resolveHeroVisualAsset:asset,hydrateHeroVisualAsset:p=>new Promise(resolve=>pending.push({pet:p,resolve})),getPetProfile:id=>({petId:id}),getDiaryRecord:()=>null,formatDateKey:()=>'',getDiaryMap:()=>({}),isReduceMotionEnabled:()=>false};
 const c=Function(...Object.keys(deps),script)(...Object.values(deps));
 const vm={loadedDataScope:scope,clearPersonaIntroTimer(){},clearAvatarCutoutPoll(){},pageVisible:true,activePet:stored,heroRequestId:0,heroAssetRevision:0,hydratedHeroAsset:asset(stored),calculatePetStats:()=>({}),logAvatarDisplay(){},scheduleStageUrlRecovery(){}};
 vm.isCurrentAvatarOwner=c.methods.isCurrentAvatarOwner.bind(vm);
 c.methods.loadHomeData.call(vm);assert.equal(vm.todayCreative,true);vm.pageVisible=false;
 stored={id:'dog',name:'狗狗',status:'deceased',generatedAvatarFileId:'dog-master'};
 c.methods.loadHomeData.call(vm);
 assert.equal(vm.todayCreative,false,'creative daily state must follow the new pet');assert.equal(vm.activePet,stored);assert.equal(vm.petName,'狗狗');assert.equal(vm.profile.petId,'dog');assert.equal(tab,'deceased');assert.equal(vm.hydratedHeroAsset,null);assert.equal(c.computed.homeHeroAsset.call(vm).imageUrl,'cached-dog');
 pending[0].resolve(asset(pending[0].pet));await Promise.resolve();assert.equal(vm.hydratedHeroAsset,null);
 vm.pageVisible=true;c.methods.loadHomeData.call(vm);pending.at(-1).resolve(asset(stored));await Promise.resolve();
 const loaded=vm.hydratedHeroAsset;c.methods.loadHomeData.call(vm);assert.equal(vm.hydratedHeroAsset,loaded,'same pet reuses its loaded master');
 stored={id:'uncached',name:'新宠',status:'current',generatedAvatarFileId:'new-master'};vm.pageVisible=false;c.methods.loadHomeData.call(vm);
 assert.equal(vm.petName,'新宠');assert.equal(vm.hydratedHeroAsset,null);assert.equal(c.computed.homeHeroAsset.call(vm).imageUrl,'','uncached owner shows no previous pet');
});
