// One 68-byte synthetic object in the console-created private test directory.
// No real files, deletion, provider calls, or production path changes.
import {randomUUID,createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import https from 'node:https';

test('console-created private directory rejects unsigned access',async()=>{
 expect(process.env.UNICLOUD_TEST_MODE).toBe('integration');
 const folder='pety-private-v3', marker=randomUUID();
 const cloudPath=folder+'/'+marker+'/probe.png';
 const base=new URL('../../../unpackage/release-sprint-20261013/',import.meta.url);
 const content=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZV8AAAAASUVORK5CYII=','base64');
 const hash=b=>createHash('sha256').update(b).digest('hex');
 let requests=0,downloadedBytes=0,uploadedBytes=0,result;
 const read=uri=>new Promise((resolve,reject)=>{
  const u=new URL(uri);
  if(u.protocol!=='https:'||u.hostname!=='env-00jy6ft635sf.normal.cloudstatic.cn'||u.username||u.password||!u.pathname.endsWith('/'+cloudPath)||++requests>2)return reject(Error('TEST_REQUEST_SCOPE'));
  const req=https.get(u,{timeout:8000,headers:{Accept:'image/png'}},res=>{
   let bytes=0;const parts=[];
   res.on('data',p=>{bytes+=p.length;downloadedBytes+=p.length;if(bytes>8192){req.destroy(Error('TEST_BODY_LIMIT'));return;}parts.push(p);});
   res.on('end',()=>resolve({status:res.statusCode,bytes,sameContent:hash(Buffer.concat(parts))===hash(content)}));res.on('error',reject);
  });
  const deadline=setTimeout(()=>req.destroy(Error('TEST_DEADLINE')),10000);
  req.on('close',()=>clearTimeout(deadline));req.on('timeout',()=>req.destroy(Error('TEST_TIMEOUT')));req.on('error',reject);
 });
 try{
  await uniCloudTest.seed(async()=>{
   const target=JSON.parse(process.env.UNICLOUD_SPACE_INFO||'{}');
   expect(target.provider).toBe('alipay');expect(target.spaceId).toBe('env-00jy6ft635sf');
   const uploaded=await uniCloud.uploadFile({cloudPath,fileContent:content});uploadedBytes=content.length;
   const fileID=uploaded.fileID||uploaded.fileId;
   expect(fileID).toBe('cloud://env-00jy6ft635sf/'+cloudPath);
   writeFileSync(new URL('cloud-private/private-directory-'+marker+'.json',base),JSON.stringify({cloudPath,fileID}),{flag:'wx'});
   const response=await uniCloud.getTempFileURL({fileList:[fileID]});
   const uri=response.fileList?.[0]?.tempFileURL;expect(typeof uri).toBe('string');
   const unsigned=new URL(uri);unsigned.search='';unsigned.hash='';
   const denied=await read(unsigned.href),signed=await read(uri);
   result={unsigned:denied,signed};
  });
 }finally{
  const pass=!!result&&[401,403].includes(result.unsigned.status)&&!result.unsigned.sameContent&&result.signed.status===200&&result.signed.sameContent;
  const report={createdAt:new Date().toISOString(),folder,pass,result,requests,downloadedBytes,uploadedBytes,deletedFiles:0,limits:'New private test directory only; not existing business folders or anonymous client signing'};
  writeFileSync(new URL('private-directory-probe-'+marker+'.json',base),JSON.stringify(report,null,2),{flag:'wx'});
  console.info('PETY_PRIVATE_DIRECTORY_RESULT',JSON.stringify(report));
 }
 expect(result.signed.status).toBe(200);expect(result.signed.sameContent).toBe(true);
 expect([401,403]).toContain(result.unsigned.status);expect(result.unsigned.sameContent).toBe(false);
},45000);
