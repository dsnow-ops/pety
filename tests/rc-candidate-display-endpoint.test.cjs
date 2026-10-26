const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');

test('historical candidate URL endpoint reads the owned immutable candidate, not the active task',async()=>{
 const record={recordType:'candidate',petHash:hash('cat').slice(0,24),jobId:'old-job',quotaOwnerHash:hash('uid:owner'),status:'SUCCEEDED',generatedFileId:'cloud://space/old',generatedThumbnailFileId:'cloud://space/thumb'};
 let signed=0,read=0;
 const snapshot=JSON.stringify(record);
 const collection={where:query=>({limit:()=>({get:async()=>{read++;return{data:Object.entries(query).every(([k,v])=>record[k]===v)?[record]:[]}}})}),doc:()=>{throw Error('must not poll active task or mutate it')}};
 global.uniCloud={database:()=>({collection:()=>collection}),getTempFileURL:async({fileList})=>{signed++;return{fileList:fileList.map(fileID=>({fileID,tempFileURL:'https://test.invalid/image'}))}}};
 const file=require.resolve('../uniCloud-alipay/cloudfunctions/api_pet_avatar/index');delete require.cache[file];
 try {
  const api=require(file).__test,context=await require('./fixtures/authorize-avatar-context.cjs')(api,'owner'),event={petId:'cat',jobId:'old-job',expectedFileId:record.generatedFileId,expectedThumbnailFileId:record.generatedThumbnailFileId};
  const result=await api.getCandidateDisplayUrls(event,context);assert.equal(result.generatedFileId,record.generatedFileId);assert.equal(result.status,'SUCCEEDED');assert.equal(signed,1);
  await assert.rejects(api.getCandidateDisplayUrls({...event,expectedFileId:'cloud://space/other'},context),{code:'CANDIDATE_ASSET_CHANGED'});
  await assert.rejects(api.getCandidateDisplayUrls(event,await require('./fixtures/authorize-avatar-context.cjs')(api,'other-owner')),{code:'CANDIDATE_ASSET_CHANGED'});
  record.candidateStatus='discarded';await assert.rejects(api.getCandidateDisplayUrls(event,context),{code:'CANDIDATE_ASSET_CHANGED'});delete record.candidateStatus;
  assert.equal(signed,1);assert.equal(read,4);assert.equal(JSON.stringify(record),snapshot);
 }finally{delete require.cache[file]}
});
