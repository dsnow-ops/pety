// Reuses the two original synthetic files. Never upload/delete/change ACL.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import https from 'node:https';

test('release existing synthetic files require signed URLs',async()=>{
 expect(process.env.UNICLOUD_TEST_MODE).toBe('integration');
 const base=new URL('../../../unpackage/release-sprint-20261013/',import.meta.url);
 const manifest=JSON.parse(readFileSync(new URL('cloud-private/acl-recheck-selection.json',base),'utf8')).manifest;
 expect(manifest).toMatch(/^pety-release-acl-[a-f0-9-]{36}\.json$/);
 const files=JSON.parse(readFileSync(new URL('cloud-private/'+manifest,base),'utf8'));
 expect(files.length).toBe(2);
 const marker=manifest.slice(0,-5),folders=['pet-avatar/input-v2','product-feedback/v2'];
 files.forEach((row,i)=>{
  expect(row.cloudPath).toBe(folders[i]+'/'+marker+'/probe.png');
  expect(row.fileID).toBe('cloud://env-00jy6ft635sf/'+row.cloudPath);
 });
 const original=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZV8AAAAASUVORK5CYII=','base64');
 const hash=b=>createHash('sha256').update(b).digest('hex');
 let requests=0,downloadedBytes=0;
 const rows=[];
 const read=uri=>new Promise((resolve,reject)=>{
  const u=new URL(uri);
  if(u.protocol!=='https:'||u.username||u.password||!files.some(f=>u.pathname.endsWith('/'+f.cloudPath))||++requests>4)return reject(Error('TEST_REQUEST_SCOPE'));
  const req=https.get(u,{timeout:8000,headers:{Accept:'image/png'}},res=>{
   let bytes=0;const parts=[];
   res.on('data',part=>{bytes+=part.length;downloadedBytes+=part.length;if(bytes>8192){req.destroy(Error('TEST_BODY_LIMIT'));return;}parts.push(part);});
   res.on('end',()=>resolve({status:res.statusCode,bytes,sameContent:hash(Buffer.concat(parts))===hash(original)}));res.on('error',reject);
  });
  const deadline=setTimeout(()=>req.destroy(Error('TEST_DEADLINE')),10000);
  req.on('close',()=>clearTimeout(deadline));req.on('timeout',()=>req.destroy(Error('TEST_TIMEOUT')));req.on('error',reject);
 });
 try{
  await uniCloudTest.seed(async()=>{
   const target=JSON.parse(process.env.UNICLOUD_SPACE_INFO||'{}');
   expect(target.provider).toBe('alipay');expect(target.spaceId).toBe('env-00jy6ft635sf');
   for(let i=0;i<files.length;i++){
    const result=await uniCloud.getTempFileURL({fileList:[files[i].fileID]});
    const uri=result.fileList?.[0]?.tempFileURL;expect(typeof uri).toBe('string');
    const unsigned=new URL(uri);unsigned.search='';unsigned.hash='';
    // Check unsigned first; do not warm its CDN entry with an authorized read.
    const denied=await read(unsigned.href),signed=await read(uri);
    rows.push({folder:folders[i],unsigned:denied,signed});
   }
  });
 }finally{
  const pass=rows.length===2&&rows.every(r=>[401,403].includes(r.unsigned.status)&&!r.unsigned.sameContent&&r.signed.status===200&&r.signed.sameContent);
  const report={createdAt:new Date().toISOString(),pass,rows,requests,downloadedBytes,uploadedFiles:0,deletedFiles:0,aclChanges:0};
  writeFileSync(new URL('storage-acl-recheck-'+Date.now()+'-'+randomUUID().slice(0,8)+'.json',base),JSON.stringify(report,null,2),{flag:'wx'});
  console.info('PETY_RELEASE_STORAGE_ACL_RECHECK_RESULT',JSON.stringify(report));
 }
 expect(rows.length).toBe(2);
 for(const r of rows){expect([401,403]).toContain(r.unsigned.status);expect(r.unsigned.sameContent).toBe(false);expect(r.signed.status).toBe(200);expect(r.signed.sameContent).toBe(true);}
},60000);
