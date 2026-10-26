'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const testScope={};
function load(file,bindings={}) {
  bindings={isDataScopeCurrent:s=>s===testScope,...bindings};
  const text=fs.readFileSync(path.join(__dirname,'..',file),'utf8').match(/<script[^>]*>([\s\S]*?)<\/script>/)[1].replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g,'').replace('export default','return');
  return Function(...Object.keys(bindings),text)(...Object.values(bindings));
}

test('studio page entry never submits or polls optional character generation',async()=>{
  const forbidden=()=>{throw Error('optional provider path must stay dormant');};
  const home=load('pages/home/home.vue',{HomeAlbumCover:{},PetAvatarHero:{},PetPortraitStage:{},prepareAvatarHeroDisplay:forbidden,startAvatarCutout:forbidden,getAvatarCutoutStatus:forbidden});
  await home.methods.runPendingAvatarAssetRefresh.call({activePet:{id:'pet',generatedAvatarCutoutStatus:'FAILED'}});
});
test('Hero rejects old image generation and old master even when petId is unchanged',()=>{
  const hero=load('components/PetAvatarHero.vue',{lightHaptic(){},clearTimeout(){},setTimeout(){return 1;}});
  const vm={petId:'pet',masterKey:'master-1',assetKey:'tight',imageUrl:'https://current',hasCutout:true,reduceMotion:false,$emit(){}};
  Object.assign(vm,hero.data.call(vm),hero.methods);
  Object.defineProperty(vm,'assetIdentity',{get:()=>hero.computed.assetIdentity.call(vm)});
  const stale={currentTarget:{dataset:{identity:vm.assetIdentity,url:vm.imageUrl,generation:vm.imageGeneration}}};
  vm.currentReady=true;vm.previousImageUrl='https://old';vm.masterKey='master-2';
  hero.watch.masterKey.call(vm,'master-2','master-1');
  assert.equal(vm.previousImageUrl,'');assert.equal(vm.currentReady,false);
  vm.onCurrentLoaded(stale);assert.equal(vm.currentReady,false);
  vm.onCurrentLoaded({currentTarget:{dataset:{identity:vm.assetIdentity,url:vm.imageUrl,generation:0}}});assert.equal(vm.currentReady,false);
  vm.onCurrentLoaded({currentTarget:{dataset:{identity:vm.assetIdentity,url:vm.imageUrl,generation:vm.imageGeneration}}});assert.equal(vm.currentReady,true);
});
test('transparent Hero and master portrait both respond, with motion clamped by treatment',()=>{
  let haptics=0;
  const hero=load('components/PetAvatarHero.vue',{lightHaptic(){haptics++;},clearTimeout(){},setTimeout(){return 1;}});
  const vm=Object.assign({hasCutout:false,imageUrl:'',motionReduced:false,$nextTick:fn=>fn(),$emit(){}},hero.data.call({}),hero.methods);
  vm.onTouchStart({touches:[{clientX:100,clientY:100}]});vm.onTap();assert.equal(vm.touching,false);assert.equal(haptics,0);
  vm.imageUrl='https://master';vm.onPointerStart({clientX:100,clientY:100});vm.onPointerMove({clientX:1000,clientY:90});
  assert.equal(vm.offsetX,2);assert.equal(vm.offsetY,-0.35000000000000003);vm.onTap();assert.equal(haptics,1);vm.resetParallax();
  vm.hasCutout=true;vm.onTouchStart({touches:[{}]});assert.equal(vm.touching,false);
  vm.onPointerStart({clientX:100,clientY:100});vm.onPointerMove({clientX:1000,clientY:90});
  assert.equal(vm.offsetX,3);assert.equal(vm.offsetY,-0.35000000000000003);vm.onTap();assert.equal(haptics,2);
  vm.resetParallax();vm.motionReduced=true;vm.onPointerStart({clientX:100,clientY:100});vm.onPointerMove({clientX:1000,clientY:90});
  assert.equal(vm.offsetX,0);assert.equal(vm.offsetY,0);assert.equal(vm.touching,false);
});
test('storage-only preparation from an earlier page generation cannot write after hide/show',async()=>{
  let resolve;const prepared=new Promise(r=>{resolve=r;});let writes=0;
  const pet={id:'pet',generatedAvatarFileId:'final',generatedAvatarCutoutJobId:'job',generatedAvatarCutoutStatus:'FAILED'};
  const home=load('pages/home/home.vue',{HomeAlbumCover:{},PetAvatarHero:{},PetPortraitStage:{},getActivePet:()=>pet,prepareAvatarHeroDisplay:()=>prepared});
  const vm=Object.assign({},home.methods,{loadedDataScope:testScope,activePet:pet,pageVisible:true,avatarOwnerEpoch:1,applyAvatarAssetResult(){writes++;}});
  const task=vm.runOptionalCharacterAssetRefresh();
  vm.avatarOwnerEpoch=3;resolve({code:0,finalFileId:'final',cutoutTightFileId:'tight'});await task;
  assert.equal(writes,0);
});

test('prepared running state replaces failed state and continues polling the same master',async()=>{
 const pet={id:'pet',generatedAvatarFileId:'final',generatedAvatarCutoutJobId:'job',generatedAvatarCutoutStatus:'FAILED'};
 let polls=0,scheduled=0;
 const home=load('pages/home/home.vue',{HomeAlbumCover:{},PetAvatarHero:{},PetPortraitStage:{},getActivePet:()=>pet,prepareAvatarHeroDisplay:async()=>({cutoutStatus:'PROCESSING'}),getAvatarCutoutStatus:async()=>{polls++;return {cutoutStatus:'PROCESSING'};},startAvatarCutout:async()=>({cutoutStatus:'PROCESSING'})});
 const vm=Object.assign({},home.methods,{loadedDataScope:testScope,activePet:pet,pageVisible:true,avatarOwnerEpoch:1,async applyAvatarAssetResult(r){this.activePet={...this.activePet,generatedAvatarCutoutStatus:r.cutoutStatus};},scheduleAvatarCutoutPoll(){scheduled++;}});
 await vm.runOptionalCharacterAssetRefresh();
 assert.equal(polls,1);assert.equal(scheduled,1);assert.equal(vm.activePet.generatedAvatarCutoutStatus,'PROCESSING');
});

test('cached FAILED reconciles a recovered cloud Hero without another paid submission',async()=>{
 const pet={id:'pet',generatedAvatarFileId:'final',generatedAvatarCutoutJobId:'job',generatedAvatarCutoutStatus:'FAILED',generatedAvatarHeroAssetVersion:3,generatedAvatarHeroDisplayPreparedFor:'final',generatedAvatarCutoutPipelineVersion:6,generatedAvatarCutoutEngine:'hero-character-magenta-v3',generatedAvatarHeroGenerationVersion:'hero-character-magenta-v3'};
 let submits=0,polls=0,applied=null;
 const home=load('pages/home/home.vue',{HomeAlbumCover:{},PetAvatarHero:{},PetPortraitStage:{},getActivePet:()=>pet,prepareAvatarHeroDisplay:async()=>{throw Error('must not prepare cached current pipeline');},getAvatarCutoutStatus:async()=>{polls++;return {cutoutStatus:'SUCCEEDED',heroFileId:'hero'};},startAvatarCutout:async()=>{submits++;}});
 const vm=Object.assign({},home.methods,{loadedDataScope:testScope,activePet:pet,pageVisible:true,avatarOwnerEpoch:1,async applyAvatarAssetResult(r){applied=r;},scheduleAvatarCutoutPoll(){throw Error('terminal success must not poll');}});
 await vm.runOptionalCharacterAssetRefresh();assert.equal(polls,1);assert.equal(submits,0);assert.equal(applied.heroFileId,'hero');
});
