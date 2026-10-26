'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
test('existing Hero receipt survives transient polling errors and resumes without a second submission',async()=>{
 const petId='recovery',jobId='job';const record={_id:'r',recordType:'candidate',jobId,petHash:hash(petId).slice(0,24),quotaOwnerHash:hash('uid:owner'),confirmed:true,finalFileId:'cloud://space/pet-avatar/final/pet/job/final.png',cutoutStatus:'PROCESSING',cutoutEngine:'hero-character-magenta-v3',cutoutProviderJobId:'paid-task',cutoutInvocationCount:1};
 const collection={where:()=>({limit:()=>({get:async()=>({data:[{...record}]})})}),doc:()=>({get:async()=>({data:[{...record}]}),update:async p=>{Object.assign(record,p);return {updated:1}}})};
 global.uniCloud={database:()=>({collection:()=>collection,command:{set:v=>v}}),getTempFileURL:async({fileList})=>({fileList:fileList.map(fileID=>({fileID,tempFileURL:'https://test.invalid/asset'}))})};
 const base='../uniCloud-alipay/cloudfunctions/api_pet_avatar/';const wan=require(base+'wan-client'),storage=require(base+'storage');const oldGet=wan.getWanTask,oldCreate=wan.createWanTask,oldPersist=storage.persistChromaHeroImage;let submits=0,polls=0;
 wan.createWanTask=async()=>{submits++;throw Error('must not resubmit')};
 wan.getWanTask=async(c,id)=>{assert.equal(id,'paid-task');if(++polls===1)throw Object.assign(Error('reset'),{code:'ECONNRESET'});return {output:{task_status:'SUCCEEDED',choices:[{message:{content:[{type:'image',image:'https://test.invalid/result.png'}]}}]}}};
 storage.persistChromaHeroImage=async()=>({heroFileId:'cloud://space/pet-avatar/final/pet/job/hero-character-hash.png',heroMetrics:{qualified:true,qualityVersion:2,hasAlpha:true}});
 const file=require.resolve(base+'index');delete require.cache[file];
 try{const api=require(file).__test,event={petId,selectedJobId:jobId},context=await require('./fixtures/authorize-avatar-context.cjs')(api,'owner');let result=await api.getAvatarCutoutStatus(event,{},context);assert.equal(result.cutoutStatus,'PROCESSING');assert.equal(result.heroGenerationPhase,'RETRYING_EXISTING_TASK');assert.equal(record.cutoutProviderJobId,'paid-task');result=await api.getAvatarCutoutStatus(event,{},context);assert.equal(result.heroGenerationStatus,'SUCCEEDED');assert.equal(result.heroMetrics.sourceFileId,record.finalFileId);assert.equal(result.heroMetrics.qualified,true);assert.equal(submits,0);assert.equal(record.cutoutInvocationCount,1);await api.getAvatarCutoutStatus(event,{},context);assert.equal(polls,2,'saved success never polls provider again');
 assert.equal(api.isRetryableHeroError({code:'HERO_TECHNICAL_BACKGROUND_INVALID'}),false);assert.equal(api.isRetryableHeroError({statusCode:503}),true);
 }finally{wan.getWanTask=oldGet;wan.createWanTask=oldCreate;storage.persistChromaHeroImage=oldPersist;delete require.cache[file]}
});

test('key spill removal preserves alpha geometry and interior pink features',()=>{
 const {decontaminateMatteEdges}=require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/avatar-display-derivatives');
 const width=200,height=200,data=Buffer.alloc(width*height*4),alpha=new Uint8Array(width*height);
 for(let y=30;y<170;y++)for(let x=40;x<160;x++){const i=y*width+x;alpha[i]=255;data.set(x>=147?(y<100?[230,150,195,255]:[236,203,203,255]):[180,180,180,255],i*4)}
 data.set([255,120,150,255],(100*width+100)*4);const before=Buffer.from(alpha);const image={width,height,data};
 decontaminateMatteEdges(image,alpha,[255,0,204]);const edge=(100*width+153)*4;
 assert.ok(Math.abs(image.data[edge]-image.data[edge+1])<=8,'no pink fringe donor');assert.deepEqual(Array.from(image.data.subarray((100*width+100)*4,(100*width+100)*4+4)),[255,120,150,255]);assert.deepEqual(Buffer.from(alpha),before,'no silhouette erosion');
});

test('only a proven legacy chroma quality failure receives one automatic migration',()=>{
 const {planHeroRecovery,HERO_PROMPT_REVISION}=require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/hero-recovery-policy');
 const candidate={cutoutStatus:'FAILED',cutoutProviderJobId:'legacy-paid-task',cutoutInvocationCount:1,cutoutEngine:'hero-character-magenta-v3',heroGenerationErrorCode:'HERO_TECHNICAL_BACKGROUND_INVALID'};
 const patch=planHeroRecovery(candidate,true);assert.equal(patch.cutoutStatus,'PENDING');assert.equal(patch.heroPreviousProviderJobId,'legacy-paid-task');assert.equal(patch.heroAutomaticRetryCount,1);assert.equal(patch.heroPriorInvocationCount,1);
 assert.deepEqual(planHeroRecovery({...candidate,...patch,cutoutStatus:'FAILED',cutoutProviderJobId:'new-paid-task'},true),{});
 for(const c of [{...candidate,cutoutStatus:'PROCESSING'},{...candidate,heroGenerationErrorCode:'WAN_QUOTA_EXCEEDED'},{...candidate,heroPromptRevision:HERO_PROMPT_REVISION},{...candidate,cutoutProviderJobId:''},{...candidate,heroAutomaticRetryCount:1}])assert.deepEqual(planHeroRecovery(c,true),{});
 assert.deepEqual(planHeroRecovery(candidate,false),{});
});

test('display URL signing is restricted to the confirmed master and its owner-bound assets',async()=>{
 const record={recordType:'candidate',petHash:hash('pet').slice(0,24),jobId:'job',quotaOwnerHash:hash('uid:owner'),confirmed:true,finalFileId:'cloud://space/final.png',heroFileId:'cloud://space/hero.png'};
 let signed=0;
 const collection={where:query=>({limit:()=>({get:async()=>({data:Object.entries(query).every(([key,value])=>record[key]===value)?[record]:[]})})})};
 global.uniCloud={database:()=>({collection:()=>collection,command:{set:v=>v}}),getTempFileURL:async({fileList})=>{signed++;return {fileList:fileList.map(fileID=>({fileID,tempFileURL:'https://owned.test/hero'}))}}};
 const file=require.resolve('../uniCloud-alipay/cloudfunctions/api_pet_avatar/index');delete require.cache[file];
 try{
  const api=require(file).__test,context=await require('./fixtures/authorize-avatar-context.cjs')(api,'owner',{RUNTIME_ENV:'cloud'}),event={petId:'pet',selectedJobId:'job',expectedFinalFileId:record.finalFileId,fileIds:[record.heroFileId]};
  const response=await api.getAvatarDisplayUrls(event,context);assert.equal(response.runtimeEnvironment,'cloud');assert.equal(response.fileList[0].fileID,record.heroFileId);assert.equal(signed,1);
  await assert.rejects(api.getAvatarDisplayUrls({...event,fileIds:['cloud://space/another-pet.png']},context),{code:'AVATAR_ASSET_OWNER_MISMATCH'});
  await assert.rejects(api.getAvatarDisplayUrls({...event,expectedFinalFileId:'old-master'},context),{code:'JOB_OWNER_MISMATCH'});
  await assert.rejects(api.getAvatarDisplayUrls(event,await require('./fixtures/authorize-avatar-context.cjs')(api,'someone-else')),{code:'JOB_OWNER_MISMATCH'});
  assert.equal(signed,1,'rejected requests never sign a URL');
 }finally{delete require.cache[file]}
});
