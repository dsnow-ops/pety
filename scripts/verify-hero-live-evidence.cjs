'use strict';
// Read-only verification of an actual cloud record, downloaded asset and device
// render receipt. Never generates images, injects fixtures, or modifies the App.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),dir=path.resolve(process.argv[2]||path.join(root,'unpackage/hero-e2e'));
// A failed fresh verification must not leave yesterday's success as its result.
const evidencePath=path.join(dir,'verified-evidence.json');if(fs.existsSync(evidencePath))fs.unlinkSync(evidencePath);
const read=name=>JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));
const record=read('cloud-record-final.json'),pet=read('device-current-pet.json'),render=read('device-render-receipt.json'),call=read('real-call-1.json');
const bytes=fs.readFileSync(path.join(dir,'cloud-hero.png'));
const pixels=require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/storage').inspectTransparentPng(bytes);
const code=fs.readFileSync(path.join(root,'common/avatar-display-asset.js'),'utf8').replace(/export /g,'');
const shared=Function(code+';return {resolvePetHeroAsset,hydratePetHeroAsset,getAvatarAssetHashPrefix};')();
const policy=fs.readFileSync(path.join(root,'common/home-hero-asset.js'),'utf8').replace(/import[^;]+;/,'').replace(/export /g,'');
const resolve=Function('resolvePetHeroAsset','hydratePetHeroAsset',policy+';return resolveHeroVisualAsset;')(shared.resolvePetHeroAsset,shared.hydratePetHeroAsset);
const selected=resolve(pet);
assert.equal(record.confirmed,true);assert.equal(record.heroGenerationStatus,'SUCCEEDED');assert.equal(record.heroGenerationPhase,'COMPLETE');assert.equal(record.cutoutProviderJobId,call.taskId);assert.equal(call.status,'SUCCEEDED');
assert.equal(record.finalFileId,pet.generatedAvatarFileId);assert.equal(record.heroFileId,pet.generatedAvatarHeroFileId);assert.equal(record.heroMetrics.sourceFileId,record.finalFileId);
assert.equal(pixels.qualified,true);assert.equal(pixels.cornersTransparent,true);assert.equal(pixels.sha256,record.heroMetrics.sha256);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),record.heroMetrics.sha256);
assert.equal(selected.displayFileId,record.heroFileId);assert.equal(selected.assetKind,'hero-native-tight');assert.equal(selected.hasCutout,true);
assert.equal(render.petId,pet.id);assert.equal(render.fileIdHash,shared.getAvatarAssetHashPrefix(record.heroFileId));assert.equal(render.loaded,true);assert.equal(render.sourceType,selected.assetKind);assert.equal(render.fallbackReason,'');assert.equal(render.urlRuntime,'cloud','must be the deployed cloud endpoint');assert.equal(render.bytes,bytes.length);
const evidence={verifiedAt:new Date().toISOString(),petId:pet.id,jobId:record.jobId,providerTaskId:call.taskId,requestId:call.requestId,sourceType:render.sourceType,fileIdHash:render.fileIdHash,sha256:pixels.sha256,width:pixels.width,height:pixels.height,bytes:bytes.length,alphaCoverage:pixels.alphaCoverage,cornersTransparent:true,qualified:true,fallbackReason:'',urlRuntime:render.urlRuntime,deviceLoaded:true,realGenerationCalls:1};
fs.writeFileSync(path.join(dir,'verified-evidence.json'),JSON.stringify(evidence,null,2));console.log(evidence);
