'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const {createMediaService}=require('../uniCloud-alipay/cloudfunctions/common/pety-auth/feedback-media');
function harness(){
 const tables=new Map();let inspected=0;
 const db={command:{lt:lt=>({lt}),inc:inc=>({inc})},collection(name){if(!tables.has(name))tables.set(name,new Map());const rows=tables.get(name);return{
  doc:id=>({get:async()=>({data:rows.has(id)?[structuredClone(rows.get(id))]:[]})}),
  add:async r=>{if(rows.has(r._id))throw Error('E11000 duplicate');rows.set(r._id,structuredClone(r));return{id:r._id};},
  where:q=>({update:async p=>{let updated=0;for(const row of rows.values()){if(!Object.entries(q).every(([k,v])=>v?.lt!==undefined?row[k]<v.lt:row[k]===v))continue;for(const[k,v]of Object.entries(p))row[k]=v?.inc!==undefined?row[k]+v.inc:v;updated++;}return{updated};}})
 };}};
 const media=createMediaService(db,{prefix:'cloud://isolated-space/',inspect:async()=>{inspected++;return{format:'png',bytes:1024,sha256:'a'.repeat(64)};}});
 const m={exports:{}},file=path.resolve((process.env.PETY_RELEASE_BASELINE==='1'?'unpackage/release-sprint-20261010/baseline/source/':'')+'uniCloud-alipay/cloudfunctions/submit_product_feedback/index.js');
 vm.runInNewContext(fs.readFileSync(file,'utf8'),{module:m,exports:m.exports,console:{error(){}},require:n=>n==='pety-auth'?{verifyRequest:async e=>{if(e.uniIdToken==='expired')throw{errCode:'uni-id-token-expired'};return{uid:e.uniIdToken==='account-A'?'A':e.uniIdToken==='account-B'?'B':null};},authErrorResult:()=>({errCode:'uni-id-token-expired'})}:n==='pety-auth/feedback-media'?{service:()=>media}:require(n),uniCloud:{database:()=>db},Date});
 const payload={category:'privacy_security',title:'测试留言',content:'明确标记的隔离测试内容，无真实用户资料。',imageFileIds:[]};
 const call=(data={},context={})=>m.exports.main({...payload,...data},{CLIENTIP:'198.51.100.1',...context});return{call,tables,media,inspected:()=>inspected};
}
test('guest text remains usable but rotating device identity cannot bypass persistent sending limits',async()=>{
 const h=harness(),codes=[];for(let i=0;i<7;i++)codes.push((await h.call({content:'隔离测试留言第'+i+'条，不含真实资料。'},{DEVICEID:'rotating-'+i,UID:'victim'})).code);
 assert.deepEqual(codes,[0,0,0,0,0,429,429]);assert.ok([...h.tables.get('product_feedback').values()].every(r=>r.userId===''));
});
test('expired identity and arbitrary screenshot references never become accepted feedback',async()=>{
 const h=harness();assert.equal((await h.call({uniIdToken:'expired'})).code,403);
 assert.notEqual((await h.call({imageFileIds:['https://untrusted.invalid/product-feedback/private.png']})).code,0);
 assert.equal(h.tables.get('product_feedback')?.size||0,0);assert.equal(h.inspected(),0);
});
test('actual handler issues owned screenshots, rejects a foreign ticket and preserves normal own submit',async()=>{
 const h=harness(),issue=await h.call({action:'issueImageUpload',uniIdToken:'account-A',extension:'png'});assert.equal(issue.code,0);
 assert.ok(issue.cloudPath.startsWith('pety-private-v3/product-feedback/v2/'));
 const fileId='cloud://isolated-space/'+issue.cloudPath;
 assert.notEqual((await h.call({action:'completeImageUpload',uniIdToken:'account-B',ticketId:issue.ticketId,fileId})).code,0);assert.equal(h.inspected(),0);
 assert.equal((await h.call({action:'completeImageUpload',uniIdToken:'account-A',ticketId:issue.ticketId,fileId})).code,0);assert.equal(h.inspected(),1);
 assert.notEqual((await h.call({uniIdToken:'account-B',imageFileIds:[fileId]})).code,0);
 assert.equal((await h.call({uniIdToken:'account-A',imageFileIds:[fileId]})).code,0);
 assert.equal([...h.tables.get('product_feedback').values()][0].userId,'A');
});
test('legacy feedback receipts stay bound to exact file and owner across private-directory migration',async()=>{
 const h=harness(),ticket=await h.media.issue('A','png');
 const row=h.tables.get('product_feedback_uploads').get(ticket.ticketId);
 row.cloudPath=row.cloudPath.replace('pety-private-v3/','');row.fileId='cloud://isolated-space/'+row.cloudPath;
 await h.media.complete('A',ticket.ticketId,row.fileId);
 assert.equal(await h.media.validate('A',[row.fileId]),true);
 await assert.rejects(h.media.validate('B',[row.fileId]),e=>e.code==='FEEDBACK_IMAGE_NOT_OWNED');
 await assert.rejects(h.media.validate('A',[row.fileId.replace('/product-feedback/','/pety-private-v3/product-feedback/')]),e=>e.code==='FEEDBACK_IMAGE_NOT_OWNED');
});
test('feedback and avatar downloaders enforce the same security boundaries without sharing extra host permissions',async()=>{
 const feedback=require('../uniCloud-alipay/cloudfunctions/common/pety-auth/safe-image-download');
 const avatar=require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/safe-download');
 for(const downloader of [feedback,avatar]){
  let lookups=0,requests=0;
  const download=downloader.createDownloader({lookup:async()=>{lookups++;return[{address:'127.0.0.1',family:4}];},get:()=>{requests++;throw Error('Network must not start');}});
  for(const url of ['http://127.0.0.1/private','https://169.254.169.254/latest','https://untrusted.invalid/a.png','https://env-test.normal.cloudstatic.cn.attacker.invalid/a.png','https://user:pass@env-test.normal.cloudstatic.cn/a.png','https://env-test.normal.cloudstatic.cn:8443/a.png']){
   await assert.rejects(download(url),e=>e.code==='INVALID_RESULT_URL');
  }
  assert.equal(lookups,0);assert.equal(requests,0);
  await assert.rejects(download('https://env-test.normal.cloudstatic.cn/a.png'),e=>e.code==='INVALID_RESULT_ADDRESS');
  assert.equal(lookups,1);assert.equal(requests,0);
 }
 const modelResult='https://dashscope-7c2c.oss-accelerate.aliyuncs.com/a.png';
 assert.equal(avatar.validateUrl(modelResult).hostname,'dashscope-7c2c.oss-accelerate.aliyuncs.com');
 assert.throws(()=>feedback.validateUrl(modelResult),e=>e.code==='INVALID_RESULT_URL');
});

test('real service factory uses trusted platform space and fails closed on ambiguous context',async()=>{
 const module=require('../uniCloud-alipay/cloudfunctions/common/pety-auth/feedback-media'),rows=[],db={collection:()=>({add:async row=>rows.push(row)})},prior=global.uniCloud;
 try{
  global.uniCloud={getCloudInfos:()=>[{spaceId:'trusted-space',provider:'alipay',requestId:'one'}]};
  const issued=await module.service(db,{requestId:'one',spaceId:'client-claim'}).issue('A','png');assert.equal(rows[0].fileId,'cloud://trusted-space/'+issued.cloudPath);
  global.uniCloud={getCloudInfos:()=>[{spaceId:'one',provider:'alipay',requestId:'one'},{spaceId:'two',provider:'alipay',requestId:'two'}]};
  assert.throws(()=>module.service(db,{}),e=>e.code==='FEEDBACK_MEDIA_UNAVAILABLE');
  const second=await module.service(db,{SPACEINFO:{spaceId:'context-space',provider:'alipay'}}).issue('A','png');assert.equal(rows[1].fileId,'cloud://context-space/'+second.cloudPath);
 }finally{global.uniCloud=prior;}
});

test('real screenshot inspector decodes PNG/JPEG and rejects pixel bombs and disguised content',async()=>{
 const module=require('../uniCloud-alipay/cloudfunctions/common/pety-auth/feedback-media');
 const download=require('../uniCloud-alipay/cloudfunctions/common/pety-auth/safe-image-download');
 const png=require('../uniCloud-alipay/cloudfunctions/common/pety-auth/node_modules/pngjs').PNG;
 const jpeg=require('../uniCloud-alipay/cloudfunctions/common/pety-auth/node_modules/jpeg-js');
 const original=download.downloadHttps,cloud=global.uniCloud;let bytes;
 global.uniCloud={getTempFileURL:async()=>({fileList:[{tempFileURL:'https://isolated.normal.cloudstatic.cn/test'}]})};
 download.downloadHttps=async()=>bytes;
 try{
  const image=new png({width:12,height:12});image.data.fill(128);bytes=png.sync.write(image);assert.equal((await module.inspect('cloud://test')).format,'png');
  bytes=jpeg.encode({width:12,height:12,data:image.data},90).data;assert.equal((await module.inspect('cloud://test')).format,'jpeg');
  bytes=Buffer.alloc(32);Buffer.from([137,80,78,71,13,10,26,10]).copy(bytes);bytes.writeUInt32BE(100000,16);bytes.writeUInt32BE(100000,20);await assert.rejects(module.inspect('cloud://test'),e=>e.code==='FEEDBACK_INVALID_IMAGES');
  bytes=Buffer.from('<script>invalid image</script>');await assert.rejects(module.inspect('cloud://test'),e=>e.code==='FEEDBACK_INVALID_IMAGES');
 }finally{download.downloadHttps=original;global.uniCloud=cloud;}
});
