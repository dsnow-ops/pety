const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {persistFinalImage}=require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/storage.js');
const {masterCopyReceipt}=require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/avatar-master-copy.js');

test('real final persistence preserves source bytes and issues a hash-bound receipt; replay keeps the same proof',async()=>{
 const bytes=fs.readFileSync('tests/fixtures/user-cat-hero-generated-v1.png');
 const sha=crypto.createHash('sha256').update(bytes).digest('hex');
 const previous=global.uniCloud;let uploads=0;
 global.uniCloud={downloadFile:async({fileID})=>{assert.equal(fileID,'cloud://source');return {fileContent:bytes}},
  uploadFile:async({cloudPath,fileContent})=>{assert.equal(cloudPath,'pety-private-v3/pet-avatar/final/pet/job/final.png');assert.deepEqual(fileContent,bytes);uploads++;return {fileID:'cloud://final'}},
  getTempFileURL:async({fileList})=>({fileList:fileList.map(fileID=>({fileID,tempFileURL:'https://test.invalid/final'}))})};
 try {
  const final=await persistFinalImage('pet','job','cloud://source',{contentSha256:'untrusted-previous-value'});
  assert.equal(final.mainAssetMetadata.contentSha256,sha);assert.equal(final.finalSha256,sha);assert.equal(uploads,1);
  const candidate={generatedFileId:'cloud://source',generatedCandidateSha256:sha};
  const receipt=masterCopyReceipt(candidate,final.finalFileId,final.mainAssetMetadata);
  assert.equal(receipt.bytes,bytes.length);assert.equal(receipt.sha256,sha);
  assert.deepEqual(masterCopyReceipt(candidate,final.finalFileId,JSON.parse(JSON.stringify(final.mainAssetMetadata))),receipt);
  assert.equal(masterCopyReceipt({...candidate,generatedCandidateSha256:'b'.repeat(64)},final.finalFileId,final.mainAssetMetadata),null);
  assert.equal(masterCopyReceipt(candidate,final.finalFileId,{}),null);
 } finally {global.uniCloud=previous}
 const schema=JSON.parse(fs.readFileSync('uniCloud-alipay/database/pet_avatar_jobs.schema.json','utf8'));
 assert.equal(schema.properties.mainAssetMetadata.properties.contentSha256.bsonType,'string');
});
