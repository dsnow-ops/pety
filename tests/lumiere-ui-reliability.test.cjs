const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {ownedMediaCloud,clientUni}=require('./fixtures/owned-media-cloud.cjs');
const script=p=>fs.readFileSync(p,'utf8').match(/<script>([\s\S]*?)<\/script>/)[1].replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g,'').replace('export default','return');
test('decoded portrait becomes visible when native color sampling never calls back',()=>{
 let finish;const scope={};
 const c=Function('uni','readStagePalette','isDataScopeCurrent','setTimeout','clearTimeout',script('components/PetPortraitStage.vue'))({getImageInfo(){}},()=>null,s=>s===scope,fn=>{finish=fn;return 1},()=>{});
 const vm={dataScope:scope,identity:'A',imageUrl:'local:A',epoch:0,disposed:false,ready:true,paletteSettled:false,publishPalette(){}};
 c.methods.sample.call(vm);assert.equal(vm.paletteSettled,false);finish();assert.equal(vm.paletteSettled,true);
 assert.equal(c.computed.displayReady.call({...vm,variant:'space'}),true);
});
test('late palette fallback cannot reveal a new pet or an unmounted stage',()=>{
 const scope={};let finish;
 const c=Function('uni','readStagePalette','isDataScopeCurrent','setTimeout','clearTimeout',script('components/PetPortraitStage.vue'))({getImageInfo(){}},()=>null,s=>s===scope,fn=>{finish=fn;return 1},()=>{});
 const vm={dataScope:scope,identity:'A',imageUrl:'local:A',epoch:0,disposed:false,paletteSettled:false,publishPalette(){throw Error('stale palette')}};
 c.methods.sample.call(vm);vm.identity='B';finish();assert.equal(vm.paletteSettled,false);
 vm.identity='A';c.methods.sample.call(vm);vm.disposed=true;finish();assert.equal(vm.paletteSettled,false);
});
test('lost canvas completion retries one local sample then stops without hiding the image',()=>{
 const timers=[],scope={};let reads=0;
 const c=Function('uni','readStagePalette','isDataScopeCurrent','setTimeout','clearTimeout',script('components/PetPortraitStage.vue'))({getImageInfo(){reads++}},()=>null,s=>s===scope,(fn,delay)=>{timers.push({fn,delay});return timers.length},()=>{});
 const vm={dataScope:scope,identity:'A',imageUrl:'local:A',epoch:0,disposed:false,ready:true,paletteSettled:false,publishPalette(){}};vm.sample=()=>c.methods.sample.call(vm);
 vm.sample();timers.shift().fn();assert.equal(vm.paletteSettled,true);
 const retry=timers.shift();assert.equal(retry.delay,400);retry.fn();assert.equal(reads,2);
 timers.shift().fn();assert.equal(timers.length,0);assert.equal(vm.paletteSettled,true);
});
test('hidden portrait never starts native sampling and rejects pending callbacks',()=>{
 let reads=0,finish;const scope={};
 const c=Function('uni','readStagePalette','isDataScopeCurrent','setTimeout','clearTimeout',script('components/PetPortraitStage.vue'))({getImageInfo(){reads++}},()=>null,s=>s===scope,fn=>{finish=fn;return 1},()=>{});
 const vm={active:false,dataScope:scope,identity:'A',imageUrl:'local:A',epoch:0,disposed:false,paletteSettled:false,publishPalette(){throw Error('hidden callback')}};
 c.methods.sample.call(vm);assert.equal(reads,0);
 vm.active=true;c.methods.sample.call(vm);assert.equal(reads,1);
 vm.active=false;c.watch.active.call(vm,false);finish();assert.equal(vm.paletteSettled,false);
});
test('pet strip is cache-only until selected and then shares the committed master',async()=>{
 let calls=0,options;
 const c=Function('hydratePetHeroAsset',script('components/PetAvatarImage.vue'))(async(p,o)=>{calls++;options=o});
 const vm={load:false,pet:{id:'A'},revision:0};vm.refresh=()=>c.methods.refresh.call(vm);
 await vm.refresh();assert.equal(calls,0);
 vm.load=true;c.watch.load.call(vm,true);await Promise.resolve();assert.equal(calls,1);assert.equal(options.preferFinal,true);
});
function resolver(){let time=100000,calls=0;const source=fs.readFileSync('common/avatar-display-asset.js','utf8').replace(/export /g,'');
 const api=Function('uniCloud','Date','uni',source+';return {hydratePetHeroAsset,resolvePetHeroAsset,invalidateAvatarUrl}')(ownedMediaCloud(async()=>({fileList:[{tempFileURL:`https://cdn.test/final.png?Expires=1000&v=${++calls}`}]})),{now:()=>time},clientUni);
 return{api,advance:n=>time+=n,calls:()=>calls};}
test('re-entry keeps signed image address stable, expiry refreshes once across concurrent pages',async()=>{
 const {api,advance,calls}=resolver(),pet={id:'A',generatedAvatarFileId:'final-A'};
 await api.hydratePetHeroAsset(pet,{preferFinal:true});advance(6*60000);
 for(let n=0;n<12;n++)await api.hydratePetHeroAsset(pet,{preferFinal:true});assert.equal(calls(),1);
 advance(550000);await Promise.all([api.hydratePetHeroAsset(pet),api.hydratePetHeroAsset(pet)]);assert.equal(calls(),2);
});
test('signed address decode error can refresh without waiting for expiry',async()=>{
 const {api,calls}=resolver(),pet={id:'A',generatedAvatarFileId:'final-A'};
 const original=await api.hydratePetHeroAsset(pet);api.invalidateAvatarUrl(pet.id,pet.generatedAvatarFileId,original.imageUrl);
 const renewed=await api.hydratePetHeroAsset(pet,{forceRefresh:true});assert.equal(calls(),2);assert.notEqual(original.imageUrl,renewed.imageUrl);
});
test('manual Home retry cannot publish into a newly selected pet',async()=>{
 let finish;const c=Function('HomeAlbumCover','PetAvatarHero','PetPortraitStage','hydrateHeroVisualAsset',script('pages/home/home.vue'))({},{},{},()=>new Promise(r=>finish=r));
 const pet={id:'A'},vm={activePet:pet,pageVisible:true,heroRequestId:0,heroAssetRevision:0,isCurrentAvatarOwner:p=>vm.activePet===p};
 const pending=c.methods.retryHeroPreview.call(vm);vm.activePet={id:'B'};finish({imageUrl:'old-pet'});await pending;assert.equal(vm.heroAssetRevision,0);assert.equal(vm.hydratedHeroAsset,undefined);
});
