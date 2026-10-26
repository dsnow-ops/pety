'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PNG } = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/node_modules/pngjs');
const { analyzeAlpha, buildTightCutout } = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/avatar-display-derivatives');
const { inspectTransparentPng, persistCutoutImage, persistTightCutout } = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/storage');
const { makePetFixture } = require('./fixtures/transparent-pets.cjs');
const { isolatedStorage } = require('./fixtures/isolated-avatar-storage.cjs');
const originals = new Map(), tightened = new Map();
for (const kind of ['cat','dog']) { originals.set(kind, makePetFixture(kind)); tightened.set(kind, buildTightCutout(originals.get(kind))); }

for (const kind of ['cat','dog']) {
  test(`${kind}: meaningful alpha bounds exclude noise and tight canvas has safe bounded padding`, () => {
    const source = PNG.sync.read(originals.get(kind)), output = tightened.get(kind), m = output.metrics;
    assert.ok(output.buffer); assert.equal(m.qualified, true); assert.equal(m.hasAlpha, true);
    assert.ok(m.originalAlphaBoundingBox.minX > 0); assert.ok(m.originalAlphaBoundingBox.minY > 0);
    assert.ok(m.croppedWidth < source.width); assert.ok(m.croppedHeight < source.height);
    assert.ok(m.contentAreaRatio >= .7 && m.contentAreaRatio <= .8);
    assert.ok(m.alphaCoverage > .3, 'real animal fixture fills a substantial area, not a tiny 20% icon');
    assert.ok(m.transparentPaddingRatio < .3);
    assert.equal(m.cornersTransparent, true);
    assert.ok(m.alphaBoundingBox.minX >= m.padding.left);
    assert.ok(m.alphaBoundingBox.minY >= m.padding.top);
    const png = PNG.sync.read(output.buffer);
    for (const i of [0,png.width-1,(png.height-1)*png.width,png.width*png.height-1]) assert.equal(png.data[i*4+3],0);
    for (let x=0;x<png.width;x++) { assert.equal(png.data[x*4+3],0); assert.equal(png.data[((png.height-1)*png.width+x)*4+3],0); }
  });
  test(`${kind}: every visible source RGBA pixel including ears feet and tail survives byte-for-byte`, () => {
    const source = PNG.sync.read(originals.get(kind)), { buffer, metrics:m } = tightened.get(kind), target = PNG.sync.read(buffer);
    let kept = 0;
    for (let y=0;y<source.height;y++) for(let x=0;x<source.width;x++) {
      const i=(y*source.width+x)*4;
      if(source.data[i+3]<=8)continue;
      const tx=x-m.cropRect.x,ty=y-m.cropRect.y,j=(ty*target.width+tx)*4;
      assert.ok(tx>0 && ty>0 && tx<target.width-1 && ty<target.height-1);
      for(let c=0;c<4;c++)assert.equal(target.data[j+c],source.data[i+c]);
      kept++;
    }
    assert.ok(kept>100000);
  });
}

test('opaque final and edge-feathered rectangle are rejected as independent transparent subjects', () => {
  const png = new PNG({width:1024,height:1024}); png.data.fill(255);
  assert.equal(buildTightCutout(PNG.sync.write(png)).metrics.qualified,false);
  for(let y=0;y<1024;y++)for(let x=0;x<1024;x++)png.data[(y*1024+x)*4+3]=Math.min(255,Math.min(x,y,1023-x,1023-y)*8);
  const feather=PNG.sync.write(png);
  assert.equal(buildTightCutout(feather).metrics.fallbackReason,'RECTANGULAR_ALPHA_MASK');
  assert.equal(inspectTransparentPng(feather).qualified,false);
});

test('an unqualified provider PNG is rejected before it can be persisted as a successful cutout', async () => {
  const png = new PNG({width:1024,height:1024}); png.data.fill(255);
  for(let y=0;y<1024;y++)for(let x=0;x<1024;x++)png.data[(y*1024+x)*4+3]=Math.min(255,Math.min(x,y,1023-x,1023-y)*8);
  const body=PNG.sync.write(png); let uploads=0;
  global.uniCloud={uploadFile:async()=>{uploads++;return{fileID:'cloud://should-not-exist'};}};
  const storage = isolatedStorage(async()=>body, global.uniCloud);
    await assert.rejects(
      ()=>storage.persistCutoutImage('owner','job','https://isolated-provider.invalid/cutout.png'),
      error=>error.code==='CUTOUT_ALPHA_INVALID'
    );
    assert.equal(uploads,0);
});

test('storage writes only the new tight path and retains source identity and original dimensions', async () => {
  const uploaded=[];
  global.uniCloud={ downloadFile:async()=>({fileContent:originals.get('cat')}), uploadFile:async({cloudPath,fileContent})=>{uploaded.push({cloudPath,fileContent});return{fileID:`cloud://space/${cloudPath}`};} };
  const result=await persistTightCutout('owner','job','cloud://space/pet-avatar/final/owner/job/cutout.png');
  assert.equal(uploaded.length,1); assert.ok(uploaded[0].cloudPath.endsWith('/cutout-tight.png'));
  assert.equal(result.metrics.originalWidth,1600);assert.equal(result.metrics.originalHeight,2200);
  assert.equal(result.metrics.sourceFileId,'cloud://space/pet-avatar/final/owner/job/cutout.png');
  assert.equal(result.metrics.wasDownscaled,false);
});

test('selector prefers qualified tight over raw cutout and final, never feather or a forged final-as-cutout', async () => {
  const source=fs.readFileSync(require.resolve('../common/avatar-display-asset.js'),'utf8').replace(/export /g,'');
  const d=Function(`${source};return {resolvePetHeroAsset};`)();
  const base='cloud://space/pet-avatar/final/owner/job/';
  const metrics={...tightened.get('cat').metrics,bytes:tightened.get('cat').buffer.length,sourceFileId:base+'cutout.png'};
  const pet={id:'cat',generatedAvatarFileId:base+'final.png',generatedAvatarMainAssetMetadata:{width:1600,height:2200},generatedAvatarCutoutStatus:'SUCCEEDED',generatedAvatarCutoutAlphaValid:true,generatedAvatarCutoutFileId:base+'cutout.png',generatedAvatarCutoutMetrics:inspectTransparentPng(originals.get('cat')),generatedAvatarCutoutTightFileId:base+'cutout-tight.png',generatedAvatarCutoutTightMetrics:metrics,generatedAvatarFeatheredDisplayFileId:base+'hero-feather.png'};
  assert.equal(d.resolvePetHeroAsset(pet).assetKind,'cutout-tight');
  assert.equal(d.resolvePetHeroAsset({...pet,generatedAvatarCutoutTightMetrics:{...metrics,qualified:false}}).assetKind,'viapi-cutout');
  assert.equal(d.resolvePetHeroAsset({...pet,generatedAvatarCutoutTightFileId:pet.generatedAvatarFileId,generatedAvatarCutoutFileId:pet.generatedAvatarFileId}).assetKind,'final');
  assert.equal(d.resolvePetHeroAsset({...pet,generatedAvatarCutoutFileId:pet.generatedAvatarFileId,generatedAvatarCutoutTightMetrics:{...metrics,sourceFileId:pet.generatedAvatarFileId}}).assetKind,'final');
  assert.equal(d.resolvePetHeroAsset({...pet,generatedAvatarCutoutAlphaValid:false,generatedAvatarCutoutStatus:'FAILED'}).assetKind,'final');
});

test('tight selector rejects alpha metadata that would retain excess transparent canvas', () => {
  const { metrics }=tightened.get('dog');
  const source=fs.readFileSync(require.resolve('../common/avatar-display-asset.js'),'utf8').replace(/export /g,'');
  const d=Function(`${source};return {resolvePetHeroAsset};`)();
  const base='cloud://space/owner/job/';
  const pet={id:'dog',generatedAvatarFileId:base+'final.png',generatedAvatarLocalCutoutFileId:base+'local.png',generatedAvatarLocalCutoutTightFileId:base+'local-cutout-tight.png',generatedAvatarLocalCutoutTightMetrics:{...metrics,bytes:20000,sourceFileId:base+'local.png',contentAreaRatio:.25}};
  assert.equal(d.resolvePetHeroAsset(pet).assetKind,'final');
});

test('FAILED avatar with no cutout recovers from existing final through storage-only preparation', async () => {
  const crypto=require('node:crypto'), hash=value=>crypto.createHash('sha256').update(value).digest('hex');
  const petId='existing-pet', petHash=hash(petId).slice(0,24), base=`cloud://space/pet-avatar/final/${petHash}/job/`;
  const rgba=PNG.sync.read(originals.get('cat'));
  for(let i=0;i<rgba.data.length;i+=4){const a=rgba.data[i+3]/255;for(let c=0;c<3;c++)rgba.data[i+c]=Math.round(rgba.data[i+c]*a+[238,232,220][c]*(1-a));rgba.data[i+3]=255;}
  const finalBuffer=PNG.sync.write(rgba), finalHash=hash(finalBuffer);
  const files=new Map([[base+'final.png',finalBuffer]]), writes=[];
  const record={_id:'owned-candidate',recordType:'candidate',jobId:'job',petHash,quotaOwnerHash:hash('uid:test-user'),confirmed:true,finalFileId:base+'final.png',cutoutStatus:'FAILED'};
  let providerCalls=0;
  global.uniCloud={
    database:()=>({collection:()=>({
      where:query=>({limit:()=>({get:async()=>({data:Object.entries(query).every(([k,v])=>record[k]===v)?[record]:[]})})}),
      doc:()=>({update:async patch=>{Object.assign(record,patch);return{updated:1};},get:async()=>({data:[record]})})
    })}),
    downloadFile:async({fileID})=>({fileContent:files.get(fileID)}),
    uploadFile:async({cloudPath,fileContent})=>{const id='cloud://space/'+cloudPath;files.set(id,fileContent);writes.push(cloudPath);return{fileID:id};},
    getTempFileURL:async({fileList})=>({fileList:fileList.map(id=>({fileID:id,tempFileURL:'https://fixture.test/'+id}))}),
    callFunction:async()=>{providerCalls++;throw Error('Provider calls forbidden');},
    httpclient:{request:async()=>{providerCalls++;throw Error('Provider calls forbidden');}}
  };
  const api=require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/index').__test;
  const {prepareHeroDisplay}=api;
  const context=await require('./fixtures/authorize-avatar-context.cjs')(api,'test-user');
  const response=await prepareHeroDisplay({petId,selectedJobId:'job'},{isDevelopment:false},context);
  assert.equal(response.code,0);assert.equal(response.cutoutStatus,'FAILED');
  assert.equal(response.heroDisplayPreparedFor,base+'final.png');
  assert.ok(response.localCutoutTightFileId && response.localCutoutTightFileId.endsWith('/local-cutout-tight.png'), JSON.stringify({local:response.localCutoutMetrics,tight:response.localCutoutTightMetrics}));
  assert.equal(response.localCutoutTightMetrics.qualified,true);
  assert.equal(providerCalls,0);assert.equal(hash(files.get(base+'final.png')),finalHash);
  assert.equal(writes.some(p=>p.endsWith('/final.png')||p.endsWith('/cutout.png')),false);
  const before=writes.length;
  await prepareHeroDisplay({petId,selectedJobId:'job'},{isDevelopment:false},context);
  assert.equal(writes.length,before,'ready tight assets are not regenerated on every page return');

  // A failed legacy provider attempt may already have invocationCount=1. The
  // new Hero pipeline is version-owned, so it receives exactly one migration.
  record.cutoutStatus='FAILED';record.cutoutInvocationCount=1;record.cutoutEngine='aliyun-viapi';record.heroGenerationVersion='';
  const heroMigration=await prepareHeroDisplay({petId,selectedJobId:'job'},{isDevelopment:false,heroChromaEnabled:true},context);
  assert.equal(heroMigration.cutoutStatus,'PENDING');
  assert.equal(heroMigration.cutoutEngine,'hero-character-magenta-v3');
  assert.equal(record.cutoutInvocationCount,0);
  assert.equal(heroMigration.heroGenerationVersion,'hero-character-magenta-v3');
  record.cutoutStatus='FAILED';record.cutoutInvocationCount=1;
  const noHeroRetry=await prepareHeroDisplay({petId,selectedJobId:'job'},{isDevelopment:false,heroChromaEnabled:true},context);
  assert.equal(noHeroRetry.cutoutStatus,'FAILED');
  assert.equal(record.cutoutInvocationCount,1);
  record.cutoutInvocationCount=0;

  // A previously unconfigured pre-provider failure is re-armed once semantic
  // segmentation becomes available. prepareHeroDisplay itself remains free of
  // provider calls; the client starts the separately guarded job afterwards.
  const beforeSemantic=writes.length;
  const semantic=await prepareHeroDisplay({petId,selectedJobId:'job'}, {
    isDevelopment:false,
    cutoutProvider:'aliyun-viapi',
    viapiEnabled:true,
    viapiAccessKeyId:'fixture-id',
    viapiAccessKeySecret:'fixture-secret'
  }, context);
  assert.equal(semantic.cutoutStatus,'PENDING');
  assert.equal(semantic.cutoutEngine,'aliyun-viapi');
  assert.equal(semantic.semanticCutoutAvailable,true);
  assert.equal(semantic.cutoutPipelineVersion,6);
  assert.equal(providerCalls,0);
  assert.equal(writes.length,beforeSemantic);
  const other=await require('./fixtures/authorize-avatar-context.cjs')(api,'other-user');
  await assert.rejects(()=>prepareHeroDisplay({petId,selectedJobId:'job'},{},other),e=>e.code==='JOB_OWNER_MISMATCH');
});
