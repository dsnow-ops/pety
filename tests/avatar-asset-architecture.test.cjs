'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const cloud = '../uniCloud-alipay/cloudfunctions/api_pet_avatar/';
const { buildAvatarPrompt } = require(cloud + 'avatar-prompt');
const { buildAvatarRevisionPrompt } = require(cloud + 'avatar-revision-prompt');
const { applyCompositionContract, MASTER_SIZE } = require(cloud + 'avatar-composition-contract');
const { buildWanPayload } = require(cloud + 'wan-client');
const { makePetFixture } = require('./fixtures/transparent-pets.cjs');
const { ownedMediaCloud, clientUni } = require('./fixtures/owned-media-cloud.cjs');
const { isolatedStorage } = require('./fixtures/isolated-avatar-storage.cjs');
const { persistTightCutout, persistGeneratedImage } = require(cloud + 'storage');
const masterSelector = Function(read('common/workbench-master-asset.js').replace(/export /g, '') + ';return resolveWorkbenchMasterAsset;')();
function selectors() {
  const core = Function('uni', read('common/avatar-display-asset.js').replace(/export /g, '') + ';return {resolvePetHeroAsset,hydratePetHeroAsset,clearAvatarDisplayAssetCache};')(clientUni);
  const hero = Function('captureDataScope','isDataScopeCurrent',...Object.keys(core), read('common/home-hero-asset.js').replace(/import[^;]+;/g, '').replace(/export /g, '') + ';return {resolveHeroVisualAsset,hydrateHeroVisualAsset};')(()=>({namespace:'guest:test',version:1}),()=>true,...Object.values(core));
  return { ...core, ...hero };
}
test('locked base bytes stay intact; all request types use a separate square seated composition contract', () => {
  const base = buildAvatarPrompt(1);
  assert.equal(base.length,1705);
  assert.equal(crypto.createHash('sha256').update(base).digest('hex'),'d4bc2b10df557435b9386d9b015cde348b9a4ff9da90d80f06dc08b40fa3a378');
  for(const kind of ['initial','regenerate','revision']) {
    const prompt=applyCompositionContract(kind==='revision'?buildAvatarRevisionPrompt(0,'脸瘦一点'):base,kind);
    assert.ok(prompt.length<5000);
    for(const term of ['坐姿','全身完整','四肢','尾巴','至少12%','绝不继承','正方形','无投影']) assert.ok(prompt.includes(term),term);
    const payload=buildWanPayload({model:'wan2.7-image-pro',size:'2K',n:1,watermark:false},prompt,['portrait-input'],{size:MASTER_SIZE});
    assert.equal(payload.parameters.size,'2048*2048');assert.equal(payload.parameters.n,1);assert.equal(payload.parameters.watermark,false);
  }
  assert.match(read('uniCloud-alipay/cloudfunctions/api_pet_avatar/index.js'),/applyCompositionContract\(basePrompt, jobKind\)/);
});
test('workbench never resolves derivatives or URL-only history as a master', () => {
  for(const fileId of ['','cloud://a/thumbnail.png','cloud://a/cutout-tight.png','cloud://a/hero-native-tight.png']) {
    assert.equal(masterSelector({jobId:'job',fileId,generatedTempUrl:'stale'},'pet').qualified,false);
  }
  const good=masterSelector({jobId:'job',fileId:'cloud://a/candidate.png'},'pet');
  assert.equal(good.assetRole,'workbench_master');assert.equal(good.fit,'contain');assert.equal(good.qualified,true);
  assert.equal(masterSelector({jobId:'job',fileId:good.fileId,mainAssetMetadata:{wasDownscaled:true}},'pet').qualified,false);
});
test('native transparency creates a dedicated Hero file without replacing the master', async()=>{
  const raw=makePetFixture('dog'), uploads=[];
  global.uniCloud={downloadFile:async()=>({fileContent:raw}),uploadFile:async value=>{uploads.push(value);return {fileID:'cloud://space/'+value.cloudPath};}};
  const result=await persistTightCutout('pet','job','cloud://space/pet-avatar/final/pet/job/final.png',false,true);
  assert.equal(uploads.length,1);assert.ok(result.fileId.endsWith('/hero-native-tight.png'));
  assert.equal(result.metrics.qualified,true);assert.equal(result.metrics.wasDownscaled,false);
  const d=selectors(), base='cloud://space/pet-avatar/final/pet/job/';
  const pet={id:'pet',generatedAvatarFileId:base+'final.png',generatedAvatarMainAssetMetadata:{width:1600,height:2200},generatedAvatarHeroFileId:result.fileId,generatedAvatarHeroMetrics:{...result.metrics,assetRole:'home_hero'}};
  Object.assign(global.uniCloud, ownedMediaCloud(async({fileList})=>({fileList:fileList.map(id=>({tempFileURL:'https://fixture.test/'+encodeURIComponent(id)}))})));
  assert.equal((await d.hydrateHeroVisualAsset(pet)).assetRole,'home_portrait');
  assert.equal(d.resolveHeroVisualAsset(pet).assetKind,'final');
  const changed={...pet,generatedAvatarFileId:base.replace('/job/','/next/')+'final.png'};
  assert.equal(d.resolveHeroVisualAsset(changed).assetKind,'final');assert.equal(d.resolveHeroVisualAsset(changed).imageUrl,'');
  pet.generatedAvatarHeroMetrics.qualified=false;
  assert.equal((await d.hydrateHeroVisualAsset(pet)).assetRole,'home_portrait');
});
test('home excludes unconfirmed candidate aliases and never uses a preview URL',()=>{
  const d=selectors();
  const pet={id:'pet',generatedFileId:'candidate',generatedAvatarUrl:'https://old',previewUrl:'https://candidate'};
  assert.equal(d.resolveHeroVisualAsset(pet).assetKind,'placeholder');
  assert.equal(d.resolveHeroVisualAsset(pet).imageUrl,'');
  for (const generatedAvatarFileId of ['cloud://space/pet-avatar/output/pet/job/candidate.png','cloud://space/pet-avatar/final/pet/job/thumbnail.png']) {
    assert.equal(d.resolveHeroVisualAsset({...pet,generatedAvatarFileId}).assetKind,'placeholder');
  }
});
test('failed native hydration falls back to the same final and records failure',async()=>{
  const d=selectors(), base='cloud://space/pet-avatar/final/pet/job/';
  const pet={id:'pet',generatedAvatarFileId:base+'final.png',generatedAvatarHeroFileId:base+'hero-native-tight.png',generatedAvatarHeroMetrics:{assetRole:'home_hero',sourceFileId:base+'final.png',hasAlpha:true,mime:'image/png',width:900,height:900,originalWidth:2048,originalHeight:2048,bytes:500000,qualityVersion:2,tightVersion:1,contentAreaRatio:.76,cornersTransparent:true,qualified:true}};
  global.uniCloud=ownedMediaCloud(async({fileList})=>{if(fileList[0].includes('hero-native'))throw Error('expired');return {fileList:[{tempFileURL:'https://fixture.test/current-final'}]};});
  const asset=await d.hydrateHeroVisualAsset(pet);
  assert.equal(asset.assetKind,'final');assert.equal(asset.fallbackReason,'');assert.equal(asset.hasCutout,false);
});
test('home copy handles empty variables, invisible text and replacement metacharacters',()=>{
  const copy=Function(read('common/home-daily-copy.js').replace(/export /g,'')+';return getDailyHomeCopy;')();
  for(const petName of ['','  ','undefined','null','&#x20;','\u200b']) {
    const text=copy({petName}); assert.ok(text.includes('宝贝'));assert.doesNotMatch(text,/他\/她|undefined|null|&#|\{name\}/);
  }
  assert.ok(copy({petName:'$&猫'}).includes('$&猫'));
});
test('confirmation completion writes the initiating pet when active pet changes',async()=>{
  let modal, finish; const pending=new Promise(resolve=>{finish=resolve;}), writes=[];
  const source=read('pages/avatar-generate/avatar-generate.vue').match(/<script[^>]*>([\s\S]*?)<\/script>/)[1].replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g,'').replace('export default','return');
  const scope={namespace:'account:confirmation-test',version:1,ready:true};
  const bindings={isDataScopeCurrent:s=>s===scope,AiDataConsentSheet:{},PetPortraitStage:{},PetGenerationParticles:{},uni:{showModal:o=>{modal=o;}},t:()=>'',lightHaptic(){},confirmGeneratedAvatar:()=>pending,saveGeneratedAvatar:(pet)=>({generatedAvatarFileId:'final-'+pet.id}),updatePet:(id,patch)=>{writes.push({id,patch});return{id,...patch};},getActivePet:()=>({id:'B'})};
  const page=Function(...Object.keys(bindings),source)(...Object.values(bindings));
  const vm=Object.assign({},page.methods,{loadedDataScope:scope,pet:{id:'A',name:'A'},selectedCandidate:{jobId:'jobA'},resultStage:'RESULT_READY',copy:{},candidateUrlCache:new Map()});
  vm.useGeneratedAvatar(); const completion=modal.success({confirm:true});
  vm.pet={id:'B'};finish({generatedFileId:'final-A'});await completion;
  assert.deepEqual(writes,[{id:'A',patch:{generatedAvatarFileId:'final-A'}}]);assert.equal(vm.pet.id,'B');
});
test('non-square provider output is rejected before any candidate upload',async()=>{
	let uploads=0; const raw=makePetFixture('cat');
	global.uniCloud={uploadFile:async()=>{uploads++;return{};}};
	const storage = isolatedStorage(async()=>raw, global.uniCloud);
	await assert.rejects(()=>storage.persistGeneratedImage('pet','job','https://isolated-provider.invalid/image',{requestedSize:MASTER_SIZE}),e=>e.code==='MASTER_COMPOSITION_SIZE_REJECTED');
	assert.equal(uploads,0);
});
