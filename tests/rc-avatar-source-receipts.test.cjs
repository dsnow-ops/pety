const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createSourceReceipts}=require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/avatar-source-receipts');
function setup(){
 const rows=new Map();let inspections=0;
 const collection={doc:id=>({get:async()=>({data:rows.has(id)?[{...rows.get(id)}]:[]})}),add:async row=>{if(rows.has(row._id))throw Error('E11000');rows.set(row._id,{...row});return{id:row._id};},where:q=>({update:async patch=>{const row=rows.get(q._id);if(!row||!Object.entries(q).every(([k,v])=>row[k]===v))return{updated:0};Object.assign(row,patch);return{updated:1}}})};
 const receipts=createSourceReceipts(collection,async()=>{inspections++;return{sha256:'a'.repeat(64),mime:'image/jpeg',bytes:1024,width:512,height:512}});
 const scope={owner:'verified-A',pet:'b'.repeat(24),session:'session-A'};
 return{rows,receipts,scope,inspections:()=>inspections,issue:()=>receipts.issue(scope,{batchId:'upload-batch',slot:0,prefix:'cloud://trusted-space/'})};
}
test('only issued exact-space file can become an owned source; foreign account/pet/session rejected before read',async()=>{
 const s=setup(),ticket=await s.issue(),fileId=`cloud://trusted-space/${ticket.cloudPath}`;
 assert.ok(ticket.cloudPath.startsWith('pety-private-v3/pet-avatar/input-v2/'));
 for(const scope of [{...s.scope,owner:'B'},{...s.scope,pet:'c'.repeat(24)},{...s.scope,session:'other'}])await assert.rejects(s.receipts.complete(scope,ticket.ticketId,fileId),e=>e.code==='AVATAR_SOURCE_NOT_OWNED');
 await assert.rejects(s.receipts.complete(s.scope,ticket.ticketId,fileId.replace('trusted-space','foreign-space')),e=>e.code==='AVATAR_SOURCE_NOT_OWNED');
 await assert.rejects(s.receipts.hashes(s.scope,['cloud://trusted-space/arbitrary-existing-file']),e=>e.code==='AVATAR_SOURCE_NOT_OWNED');
 assert.equal(s.inspections(),0);
 await s.receipts.complete(s.scope,ticket.ticketId,fileId);await s.receipts.complete(s.scope,ticket.ticketId,fileId);assert.equal(s.inspections(),1);
 assert.equal((await s.receipts.hashes(s.scope,[fileId]))[fileId],'a'.repeat(64));
});
test('legacy ready receipts remain owned; changing only the private prefix cannot forge a receipt',async()=>{
 const s=setup(),ticket=await s.issue(),row=s.rows.get(ticket.ticketId);
 row.cloudPath=row.cloudPath.replace('pety-private-v3/','');row.fileId='cloud://trusted-space/'+row.cloudPath;
 await s.receipts.complete(s.scope,ticket.ticketId,row.fileId);
 assert.equal((await s.receipts.hashes(s.scope,[row.fileId]))[row.fileId],'a'.repeat(64));
 await assert.rejects(s.receipts.hashes(s.scope,[row.fileId.replace('/pet-avatar/','/pety-private-v3/pet-avatar/')]),e=>e.code==='AVATAR_SOURCE_NOT_OWNED');
});
test('expired upload fails before inspection; duplicate issue is idempotent',async()=>{
 const s=setup(),ticket=await s.issue();assert.deepEqual(await s.issue(),ticket);
 Object.assign(s.rows.get(ticket.ticketId),{createdAt:Date.now()-2000,expiresAt:Date.now()-1000});
 await assert.rejects(s.receipts.complete(s.scope,ticket.ticketId,`cloud://trusted-space/${ticket.cloudPath}`),e=>e.code==='AVATAR_SOURCE_TICKET_EXPIRED');assert.equal(s.inspections(),0);
});
test('provider input checks registered hash on the exact bytes it will send, including later cloud overwrite',async()=>{
 let bytes=Buffer.from([0xff,0xd8,1,2,3,4]);global.uniCloud={getTempFileURL:async({fileList})=>({fileList:fileList.map(fileID=>({fileID,tempFileURL:'https://test.invalid/source'}))})};
 const {EventEmitter}=require('node:events');
 const get=(url,options,callback)=>{assert.equal(url.hostname,'test.invalid');
  options.lookup(url.hostname,{},(error,address,family)=>{assert.equal(error,null);assert.equal(address,'93.184.216.34');assert.equal(family,4)});
  const request=new EventEmitter();queueMicrotask(()=>{
  const response=new EventEmitter();response.statusCode=200;response.headers={'content-type':'image/jpeg'};response.destroy=error=>{if(error)response.emit('error',error)};
  callback(response);response.emit('data',bytes);response.emit('end');
 });return request;};
 const fs=require('node:fs'),vm=require('node:vm'),module={exports:{}};
 vm.runInNewContext(fs.readFileSync('uniCloud-alipay/cloudfunctions/api_pet_avatar/safe-download.js','utf8'),{module,Buffer,URL,process:{env:{}},setTimeout,clearTimeout,
  require:name=>name==='https'?{get}:name==='dns'?{promises:{lookup:async host=>{assert.equal(host,'test.invalid');return[{address:'93.184.216.34',family:4}]}}}:require(name)});
 const download=module.exports.createDownloader({hosts:['test.invalid']});
 const {getProviderImageInputs}=require('./fixtures/isolated-avatar-storage.cjs').isolatedStorage(download,global.uniCloud);
 const file='cloud://trusted/source',sha=crypto.createHash('sha256').update(bytes).digest('hex');
 const valid=await getProviderImageInputs([file],{[file]:sha});assert.equal(valid[0],`data:image/jpeg;base64,${bytes.toString('base64')}`);
 bytes=Buffer.from([0xff,0xd8,9,8,7]);await assert.rejects(getProviderImageInputs([file],{[file]:sha}),e=>e.code==='AVATAR_SOURCE_CHANGED');
});
test('source header dimensions reject allocation bombs without decoding; cleanup includes new temporary inputs only',()=>{
 const {assertSourceHeaderDimensions}=require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/storage');
 const bytes=Buffer.alloc(24);Buffer.from([137,80,78,71,13,10,26,10]).copy(bytes);bytes.write('IHDR',12);bytes.writeUInt32BE(2048,16);bytes.writeUInt32BE(2048,20);
 assert.deepEqual(assertSourceHeaderDimensions(bytes),{width:2048,height:2048});bytes.writeUInt32BE(100000,16);assert.throws(()=>assertSourceHeaderDimensions(bytes),e=>e.code==='INVALID_SOURCE_IMAGES');
 assert.throws(()=>assertSourceHeaderDimensions(Buffer.from([0xff,0xd8,1,2,3])),e=>e.code==='INVALID_SOURCE_IMAGES');
 const {isTemporarySourceFile}=require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/index').__test;
 assert.equal(isTemporarySourceFile('cloud://test/pet-avatar/input-v2/pet/ticket/source.jpg'),true);
 assert.equal(isTemporarySourceFile('cloud://test/pety-private-v3/pet-avatar/input-v2/pet/ticket/source.jpg'),true);
 assert.equal(isTemporarySourceFile('cloud://test/pety-private-v3/pet-avatar/final/pet/final.png'),false);
 assert.equal(isTemporarySourceFile('cloud://test/pet-avatar/final/pet/final.png'),false);
});
