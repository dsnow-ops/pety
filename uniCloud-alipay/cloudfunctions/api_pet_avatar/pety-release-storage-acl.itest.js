// Two tiny synthetic files only. Keep them for evidence; no real-file access,
// deletion, ACL changes, credentials in output, model calls or client bypass.
import {randomUUID,createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import https from 'node:https';

test('release storage folders reject unsigned synthetic image access',async()=>{
 expect(process.env.UNICLOUD_TEST_MODE).toBe('integration');
 const marker='pety-release-acl-'+randomUUID();
 const content=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZV8AAAAASUVORK5CYII=','base64');
 const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
 const rows=[],privateResources=[];
 let requests=0,downloadedBytes=0;
 const read=uri=>new Promise((resolve,reject)=>{
  const u=new URL(uri);
  if(u.protocol!=='https:'||u.username||u.password||!u.pathname.includes(marker)||++requests>4)return reject(Error('TEST_REQUEST_SCOPE'));
  const request=https.get(u,{headers:{'Accept':'image/png'},timeout:8000},response=>{
   const parts=[];let size=0;
   response.on('data',part=>{size+=part.length;downloadedBytes+=part.length;if(size>8192){request.destroy(Error('TEST_BODY_LIMIT'));return;}parts.push(part);});
   response.on('end',()=>resolve({status:response.statusCode,bytes:size,sameContent:digest(Buffer.concat(parts))===digest(content)}));
   response.on('error',reject);
  });
  request.on('timeout',()=>request.destroy(Error('TEST_REQUEST_TIMEOUT')));request.on('error',reject);
 });
 await uniCloudTest.seed(async()=>{
  const target=JSON.parse(process.env.UNICLOUD_SPACE_INFO||'{}');
  expect(target.provider).toBe('alipay');expect(target.spaceId).toBe('env-00jy6ft635sf');
  for(const folder of ['pet-avatar/input-v2','product-feedback/v2']){
   const cloudPath=folder+'/'+marker+'/probe.png';
   const uploaded=await uniCloud.uploadFile({cloudPath,fileContent:content});
   const fileID=uploaded.fileID||uploaded.fileId;expect(typeof fileID).toBe('string');
   privateResources.push({cloudPath,fileID});
   writeFileSync(new URL('../../../unpackage/release-sprint-20261013/cloud-private/'+marker+'.json',import.meta.url),JSON.stringify(privateResources,null,2));
   const signed=await uniCloud.getTempFileURL({fileList:[fileID]});
   const uri=signed.fileList?.[0]?.tempFileURL;
   expect(typeof uri).toBe('string');
   const u=new URL(uri);const hadQuery=!!u.search;
   const signedResult=await read(uri);
   u.search='';u.hash='';
   const unsignedResult=await read(u.href);
   rows.push({folder,uploadedBytes:content.length,signedUrlHasQuery:hadQuery,signed:signedResult,unsigned:unsignedResult});
  }
 });
 const report={createdAt:new Date().toISOString(),rows,requests,downloadedBytes,deletedFiles:0,limits:'Only two newly uploaded synthetic files; server SDK signing; no anonymous client signing test or real user files'};
 writeFileSync(new URL('../../../unpackage/release-sprint-20261013/storage-acl-probe-summary.json',import.meta.url),JSON.stringify(report,null,2),{flag:'wx'});
 console.info('PETY_RELEASE_STORAGE_ACL_RESULT',JSON.stringify(report));
 for(const row of rows){expect(row.signed.status).toBe(200);expect(row.signed.sameContent).toBe(true);expect([401,403]).toContain(row.unsigned.status);expect(row.unsigned.sameContent).toBe(false);}
},60000);
