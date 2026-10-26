const fs=require('node:fs'),test=require('node:test'),assert=require('node:assert/strict');
const {createNativeAvatarCacheAdapter}=Function(fs.readFileSync('common/avatar-file-cache-native.js','utf8').replace(/export /g,'')+';return{createNativeAvatarCacheAdapter};')();
function setup(repeatSnapshot=false){
 const files=new Map(),resolved=[],removed=[];let progress,abortCount=0,downloadArgs,savedUsed='',index;
 const makeEntry=path=>({getDirectory:(name,options,ok)=>ok({path:'_doc/'+name+'/',createReader:()=>{
  let sent=false,calls=0;return{readEntries:ok=>{assert.ok(++calls<=3,'directory enumeration must stop on repeated native snapshot');if(sent&&!repeatSnapshot)return ok([]);sent=true;ok([...files.keys()].map(p=>({isFile:!p.endsWith('/'),toLocalURL:()=>p})))}};
 }}),
  remove:ok=>{files.delete(path);removed.push(path);ok()},
  moveTo:(dir,name,ok)=>{assert.equal(path,'_doc/saved-returned.png');const dest=dir.path+name;files.set(dest,files.get(path));files.delete(path);ok({toLocalURL:()=>dest})}});
 const plus={io:{convertLocalFileSystemURL:p=>'/private/doc/'+p.slice(5),resolveLocalFileSystemURL:(p,ok,fail)=>{resolved.push(p);if(p==='_doc/'||files.has(p))ok(makeEntry(p));else fail(Error('not-found'))}}};
 const uni={getStorageSync:()=>index,setStorageSync:(k,v)=>index=v,
  getFileInfo:({filePath,success,fail})=>files.has(filePath)?success({size:24}):fail(Error('missing')),
  getImageInfo:({src,success,fail})=>files.has(src)?success({width:2048,height:2048,type:'png'}):fail(Error('missing')),
  downloadFile:args=>{downloadArgs=args;return{onProgressUpdate:fn=>progress=fn,abort:()=>{abortCount++;args.fail()}}},
  saveFile:({tempFilePath,success})=>{savedUsed=tempFilePath;files.set('_doc/saved-returned.png',files.get(tempFilePath));files.delete(tempFilePath);success({savedFilePath:'_doc/saved-returned.png'})}};
 const adapter=createNativeAvatarCacheAdapter({uni,plus,namespace:()=> 'guest:local',ownerVersion:()=>0});
 return{adapter,files,resolved,removed,progress:e=>progress(e),abortCount:()=>abortCount,args:()=>downloadArgs,savedUsed:()=>savedUsed,
  complete:()=>{files.set('tmp/download.png','bytes');downloadArgs.success({tempFilePath:'tmp/download.png',statusCode:200})}};
}
test('native adapter moves the saveFile returned path, never the invalidated download path',async()=>{
 const s=setup(),promise=s.adapter.download('https://cdn.test/file?secret=not-persisted',()=>{});s.complete();const result=await promise;
 assert.equal(s.args().timeout,25000);const info=await s.adapter.inspect(result.path);assert.equal(info.width,2048);
 const final=await s.adapter.persist(result.path,info.format);assert.equal(s.savedUsed(),result.path);assert.ok(s.resolved.includes('_doc/saved-returned.png'));assert.equal(s.resolved.includes('tmp/download.png'),false);assert.ok(s.files.has(final));assert.equal(s.files.has(result.path),false);
});
test('cache clear cannot remove source photos, arbitrary private files or traversal paths',async()=>{
 const s=setup();for(const path of ['_doc/user-photo.png','_doc/pety-avatar-cache-v1/../photo.png','/private/doc/user-photo.png','https://cdn.test/file.png']){
  assert.equal(s.adapter.isCachePath(path),false);await assert.rejects(s.adapter.remove(path),{code:'CACHE_DELETE_OUTSIDE_OWNED_DIRECTORY'});
 }
 await s.adapter.removeTemporary('_doc/user-photo.png');assert.deepEqual(s.removed,[]);
});

test('native display uses a physical file URL usable by both CSS and uni-image',()=>{
 const s=setup();assert.equal(s.adapter.toDisplayPath('_doc/pety-avatar-cache-v1/abc-123.png'),'file:///private/doc/pety-avatar-cache-v1/abc-123.png');
 assert.throws(()=>s.adapter.toDisplayPath('_doc/user-photo.png'),{code:'CACHE_DISPLAY_OUTSIDE_OWNED_DIRECTORY'});
});
test('missing persistent file is confirmed from owned directory, not a generic image error',async()=>{
 const s=setup();await assert.rejects(s.adapter.inspect('_doc/pety-avatar-cache-v1/absent.png'),{code:'ASSET_FILE_MISSING'});
});
test('native cache path accepts only dedicated app directory and recognized filenames',()=>{
 const s=setup();assert.equal(s.adapter.isCachePath('_doc/pety-avatar-cache-v1/abc-123.png'),true);assert.equal(s.adapter.isCachePath('file:///private/doc/pety-avatar-cache-v1/abc-123.webp'),true);
 assert.equal(s.adapter.isCachePath('/elsewhere/pety-avatar-cache-v1/abc-123.png'),false);assert.equal(s.adapter.isCachePath('_doc/pety-avatar-cache-v1/nested/photo.png'),false);
});
test('oversized download is aborted from reported byte progress',async()=>{
 const s=setup(),bytes=[],p=s.adapter.download('https://cdn.test/file',n=>bytes.push(n));const rejection=assert.rejects(p,{code:'CACHE_DOWNLOAD_TOO_LARGE'});
 s.progress({totalBytesWritten:100,totalBytesExpectedToWrite:40*1024*1024});await rejection;assert.equal(s.abortCount(),1);assert.deepEqual(bytes,[100]);
});

test('inventory is limited to recognized flat cache copies and aliases share an identity',async()=>{
 const s=setup(),path='_doc/pety-avatar-cache-v1/abc-123.png';
 for(const p of [path,'_doc/user.png','_doc/pety-avatar-cache-v1/nested/photo.png','_doc/pety-avatar-cache-v1/folder/'])s.files.set(p,'bytes');
 assert.deepEqual(await s.adapter.listOwnedFiles(),[{path,bytes:24}]);
 assert.equal(s.adapter.cachePathKey(path),s.adapter.cachePathKey('file:///private/doc/pety-avatar-cache-v1/abc-123.png'));
});

test('Android repeated directory snapshots terminate inventory and missing-file checks',async()=>{
 const s=setup(true),path='_doc/pety-avatar-cache-v1/existing.png';s.files.set(path,'bytes');
 assert.deepEqual(await s.adapter.listOwnedFiles(),[{path,bytes:24}]);
 await assert.rejects(s.adapter.inspect('_doc/pety-avatar-cache-v1/missing.png'),{code:'ASSET_FILE_MISSING'});
});
