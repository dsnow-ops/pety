const fs=require('node:fs'),test=require('node:test'),assert=require('node:assert/strict');
const source=fs.readFileSync('common/avatar-file-cache.js','utf8').replace(/export /g,'');
const {createAvatarFileCache}=Function(source+';return{createAvatarFileCache};')();
function setup(options={}){
 let owner='guest:local',ownerVersion=0,time=1000,index=null,id=0,downloads=0,writeFails=false,downloadFails=false,hold=null;
 const files=new Map(),removed=[];
 const info={bytes:10,width:2048,height:2048,format:'png',readable:true};
 const adapter={namespace:()=>owner,ownerVersion:()=>ownerVersion,readIndex:()=>structuredClone(index),writeIndex:x=>{if(writeFails)throw Error('disk-full');index=structuredClone(x)},
  isCachePath:p=>typeof p==='string'&&p.startsWith('_doc/pety-avatar-cache-v1/'),inspect:async p=>{if(!files.has(p))throw Object.assign(Error('missing'),{code:'ASSET_FILE_MISSING'});return files.get(p)},
  download:async(url,progress)=>{downloads++;if(hold)await hold;if(downloadFails)throw Error('network');const p='tmp/'+(++id);files.set(p,{...info});progress(6);progress(10);progress(9);return{path:p,statusCode:200}},
  persist:async p=>{const target='_doc/pety-avatar-cache-v1/'+id+'.png';files.set(target,files.get(p));files.delete(p);return target},
  remove:async p=>{assert.ok(adapter.isCachePath(p));removed.push(p);files.delete(p)},removeTemporary:async p=>{assert.ok(p.startsWith('tmp/'));files.delete(p)}};
 const create=()=>createAvatarFileCache(adapter,{now:()=>time,...options});
 return{create,adapter,files,removed,info,cache:create(),setOwner:v=>{owner=v;ownerVersion++},advance:()=>time+=70000,setWriteFails:v=>writeFails=v,setDownloadFails:v=>downloadFails=v,setHold:v=>hold=v,
  downloads:()=>downloads,index:()=>index};
}
const asset=(pet='cat',purpose='master',namespace='guest:local')=>({namespace,petId:pet,masterId:'cloud://master/'+pet,fileId:'cloud://master/'+pet,revision:'v1',purpose});
const url=async()=> 'https://cdn.test/file.png?signature=private';

test('transient WebView failure revalidates local bytes without CDN download, missing file recovers once',async()=>{
 const s=setup(),a=asset();const first=await s.cache.acquire(a,url);
 s.cache.suspect(a);assert.equal(s.cache.peek(a),null);assert.ok(s.files.has(first.localPath));
 const next=await s.cache.acquire(a,()=>{throw Error('must reuse local bytes')});
 assert.equal(next.localPath,first.localPath);assert.equal(s.downloads(),1);
 s.files.delete(first.localPath);s.cache.suspect(a);
 const recovered=await s.cache.acquire(a,url);assert.ok(recovered.localPath);assert.equal(s.downloads(),2);
});

test('confirmed master alias shares bytes across restart; removing candidate keeps final alive',async()=>{
 const s=setup({limitBytes:20}),from=asset(),to={...from,masterId:'cloud://final',fileId:'cloud://final',revision:'cloud://final'};
 const original=await s.cache.acquire(from,url);
 assert.equal(await s.cache.reuse(from,to),true);
 assert.equal(s.cache.diagnostics().cachedBytes,10);
 await s.cache.invalidate(from);
 assert.ok(s.files.has(original.localPath));
 const restarted=s.create();const final=await restarted.acquire(to,async()=>{throw Error('must stay offline')});
 assert.equal(final.localPath,original.localPath);assert.equal(s.downloads(),1);
 await restarted.invalidate(to);assert.equal(s.files.size,0);
});

test('cache alias cannot cross owner or pet; failed index commit leaves original bytes usable',async()=>{
 const s=setup(),from=asset(),to={...from,masterId:'final',fileId:'final'};
 const original=await s.cache.acquire(from,url);
 await assert.rejects(s.cache.reuse(from,{...to,petId:'dog'}),{code:'ASSET_REUSE_SCOPE_MISMATCH'});
 await assert.rejects(s.cache.reuse(from,{...to,namespace:'account:B'}),{code:'ASSET_REUSE_SCOPE_MISMATCH'});
 s.setWriteFails(true);await assert.rejects(s.cache.reuse(from,to),/disk-full/);
 assert.equal(s.files.size,1);assert.equal(s.cache.peek(from).localPath,original.localPath);
});

test('alias eviction counts physical bytes and preserves a pinned final until its last reference leaves',async()=>{
 const s=setup({limitBytes:30}),from=asset(),to={...from,masterId:'final',fileId:'final'};
 const first=await s.cache.acquire(from,url);await s.cache.reuse(from,to);const unpin=s.cache.pin(to);
 for(const pet of ['dog','bird']){s.advance();await s.cache.acquire(asset(pet),url)}
 assert.equal(s.cache.diagnostics().cachedBytes,30);
 await s.cache.clearDisposable();assert.ok(s.files.has(first.localPath));
 assert.equal(s.cache.peek(to).localPath,first.localPath);
 unpin();await s.cache.clearDisposable();assert.equal(s.files.has(first.localPath),false);
 assert.equal(s.cache.diagnostics().cachedBytes,20);
});

test('owner changes during alias validation cannot publish a late index entry',async()=>{
 const s=setup(),from=asset(),to={...from,masterId:'final',fileId:'final'};
 await s.cache.acquire(from,url);const inspect=s.adapter.inspect;
 s.adapter.inspect=async path=>{const info=await inspect(path);s.setOwner('account:B');return info};
 await assert.rejects(s.cache.reuse(from,to),{code:'ASSET_OWNER_CHANGED'});
 assert.equal(s.index().entries.length,1);assert.equal(s.files.size,1);
});

test('saved draft protection survives restart and prevents eviction until its session is cleared',async()=>{
 const s=setup({limitBytes:40}),draft=asset('draft');let retained=true;
 s.adapter.isAssetRetained=a=>retained&&a.petId==='draft';
 const saved=await s.cache.acquire(draft,url);s.advance();
 for(const pet of ['b','c','d']){await s.cache.acquire(asset(pet),url);s.advance()}
 const restarted=s.create();await restarted.acquire(asset('e'),url);
 assert.ok(s.files.has(saved.localPath),'unsaved draft must survive LRU before its page is mounted');
 await restarted.clearDisposable();assert.ok(s.files.has(saved.localPath));
 retained=false;await restarted.clearDisposable();assert.equal(s.files.has(saved.localPath),false);
});

test('unreadable draft protection never authorizes deleting cached assets',async()=>{
 const s=setup();for(const pet of ['a','b','c']){await s.cache.acquire(asset(pet),url);s.advance()}
 s.adapter.isAssetRetained=()=>{throw Object.assign(Error('draft state unavailable'),{code:'ASSET_DRAFT_STATE_UNAVAILABLE'})};
 await assert.rejects(s.cache.clearDisposable(),{code:'ASSET_DRAFT_STATE_UNAVAILABLE'});assert.equal(s.removed.length,0);
});

test('temporary directory inventory failure can recover without restarting or downloading twice',async()=>{
 const s=setup();let calls=0;s.adapter.listOwnedFiles=async()=>{if(++calls===1)throw Error('inventory-temporary-failure');return[]};
 await assert.rejects(s.cache.acquire(asset(),url),/inventory-temporary/);
 const result=await s.cache.acquire(asset(),url);assert.ok(result.localPath);assert.equal(calls,2);assert.equal(s.downloads(),1);
});
test('failed LRU metadata write does not delete or redownload a verified cached master',async()=>{
 const s=setup(),a=asset(),first=await s.cache.acquire(a,url);s.setWriteFails(true);
 const next=await s.cache.acquire(a,()=>{throw Error('unexpected download')});
 assert.equal(next.localPath,first.localPath);assert.ok(s.files.has(first.localPath));assert.equal(s.removed.length,0);assert.equal(s.downloads(),1);
});
test('temporary local inspection failure preserves the indexed bytes for a later retry',async()=>{
 const s=setup(),a=asset(),first=await s.cache.acquire(a,url),inspect=s.adapter.inspect;
 s.adapter.inspect=async()=>{throw Object.assign(Error('temporarily unavailable'),{code:'CACHE_IO_FAILED'})};
 await assert.rejects(s.cache.acquire(a,url),{code:'CACHE_IO_FAILED'});
 assert.ok(s.files.has(first.localPath));assert.equal(s.index().entries.length,1);assert.equal(s.downloads(),1);
 s.adapter.inspect=inspect;assert.equal((await s.cache.acquire(a,url)).localPath,first.localPath);
});
test('20 returns, parallel consumers and signature renewal reuse one persistent 2K file',async()=>{
 const s=setup(),a=asset(),results=await Promise.all(Array.from({length:8},()=>s.cache.acquire(a,url)));
 assert.equal(s.downloads(),1);assert.equal(s.cache.diagnostics().joined,7);assert.equal(results[0].width,2048);assert.ok(results.every(r=>r.localPath===results[0].localPath));
 for(let n=0;n<20;n++)await s.cache.acquire(a,()=>{throw Error('must not renew url for local bytes')});
 assert.equal(s.downloads(),1);assert.equal(s.cache.diagnostics().completedBodyBytes,10);assert.equal(s.cache.diagnostics().observedTransferBytes,10);
 assert.equal(JSON.stringify(s.index()).includes('signature'),false);assert.equal([...s.files.keys()].some(k=>k.startsWith('tmp/')),false);
});
test('restart and offline read validate and reuse the persistent returned path',async()=>{
 const s=setup(),a=asset(),first=await s.cache.acquire(a,url);s.setDownloadFails(true);const restarted=s.create();
 assert.equal(restarted.peek(a),null,'unvalidated restart index is not a decoded image');const hit=await restarted.acquire(a,()=>{throw Error('offline')});assert.equal(hit.localPath,first.localPath);assert.equal(hit.cacheHit,true);assert.equal(s.downloads(),1);
});
test('one missing cache file is recovered once with a concurrent acquisition',async()=>{
 const s=setup(),a=asset(),r=await s.cache.acquire(a,url);s.files.delete(r.localPath);await Promise.all([s.cache.acquire(a,url),s.cache.acquire(a,url)]);assert.equal(s.downloads(),2);
});
test('account namespace rejects foreign reads and stale downloads never publish after logout',async()=>{
 const s=setup(),a=asset();await s.cache.acquire(a,url);s.setOwner('account:B');assert.equal(s.cache.peek(a),null);await assert.rejects(s.cache.acquire(a,url),{code:'ASSET_OWNER_CHANGED'});
 let release;s.setHold(new Promise(r=>release=r));const b=s.cache.acquire(asset('cat','master','account:B'),url);await Promise.resolve();s.setOwner('guest:local');release();await assert.rejects(b,{code:'ASSET_OWNER_CHANGED'});assert.equal(s.index().entries.length,1);
});
test('cancelling one consumer does not abort a shared download used by another page',async()=>{
 const s=setup(),controller=new AbortController();let release;s.setHold(new Promise(r=>release=r));const cancelled=s.cache.acquire(asset(),url,{signal:controller.signal}),rejection=assert.rejects(cancelled,{code:'ASSET_CONSUMER_CANCELLED'});
 const other=s.cache.acquire(asset(),url);controller.abort();release();await rejection;assert.ok((await other).localPath);assert.equal(s.downloads(),1);
});
test('leaving and reentering the same account does not revive its old in-flight request',async()=>{
 const s=setup();let release;s.setHold(new Promise(r=>release=r));const old=s.cache.acquire(asset(),url),rejected=assert.rejects(old,{code:'ASSET_OWNER_CHANGED'});
 await Promise.resolve();s.setOwner('account:B');s.setOwner('guest:local');release();await rejected;assert.equal(s.index(),null);assert.equal(s.files.size,0);
});
test('invalid bytes are rejected and never indexed, even if HTTP succeeds',async()=>{
 const s=setup();s.info.format='html';await assert.rejects(s.cache.acquire(asset(),url),{code:'ASSET_BYTES_INVALID'});assert.equal(s.index(),null);assert.equal(s.files.size,0);
});
test('a smaller image cannot silently replace a declared 2K master',async()=>{
 const s=setup();s.info.width=1024;s.info.height=1024;
 await assert.rejects(s.cache.acquire({...asset(),expectedWidth:2048,expectedHeight:2048},url),{code:'ASSET_DIMENSIONS_MISMATCH'});
 assert.equal(s.index(),null);assert.equal(s.files.size,0);
});
test('failed index commit deletes only the newly created cache copy',async()=>{
 const s=setup();s.files.set('_doc/irreplaceable-user-photo.png',{...s.info});s.setWriteFails(true);await assert.rejects(s.cache.acquire(asset(),url),/disk-full/);assert.equal(s.index(),null);assert.equal(s.files.size,1);assert.ok(s.files.has('_doc/irreplaceable-user-photo.png'));
});
test('LRU removes disposable copies while current/recent masters and pinned drafts are protected',async()=>{
 const s=setup({limitBytes:40});await s.cache.acquire(asset('draft','candidate'),url);const unpin=s.cache.pin(asset('draft','candidate'));
 s.advance();await s.cache.acquire(asset('old','avatar'),url);s.advance();await s.cache.acquire(asset('cat'),url);s.advance();await s.cache.acquire(asset('dog'),url);s.advance();await s.cache.acquire(asset('new','avatar'),url);
 assert.equal(s.index().entries.length,4);assert.ok(!s.index().entries.some(r=>r.asset.petId==='old'));assert.ok(s.index().entries.some(r=>r.asset.petId==='draft'));
 await s.cache.clearDisposable();assert.deepEqual(s.index().entries.map(r=>r.asset.petId).sort(),['cat','dog','draft']);unpin();await s.cache.clearDisposable();assert.equal(s.index().entries.length,2);
});
test('cache pressure rejects a new copy without evicting the two recent masters',async()=>{
 const s=setup({limitBytes:20});await s.cache.acquire(asset('cat'),url);s.advance();await s.cache.acquire(asset('dog'),url);await assert.rejects(s.cache.acquire(asset('third'),url),{code:'ASSET_CACHE_FULL'});assert.equal(s.index().entries.length,2);assert.equal(s.files.size,2);
});
test('failure retries are bounded and back off without counting image events as downloads',async()=>{
 const s=setup();s.setDownloadFails(true);for(let n=0;n<3;n++){await assert.rejects(s.cache.acquire(asset(),url),/network/);await assert.rejects(s.cache.acquire(asset(),url),{code:'ASSET_RETRY_PAUSED'});s.advance()}
 await assert.rejects(s.cache.acquire(asset(),url),{code:'ASSET_RETRY_PAUSED'});assert.equal(s.downloads(),3);assert.equal(s.cache.diagnostics().completedBodyBytes,0);
});

test('invalidate during a cached read hides the old path immediately and rejects its late result',async()=>{
 const s=setup(),a=asset();await s.cache.acquire(a,url);
 const inspect=s.adapter.inspect;let release,started;
 const entered=new Promise(r=>started=r),hold=new Promise(r=>release=r);let first=true;
 s.adapter.inspect=async p=>{const result=await inspect(p);if(first){first=false;started();await hold}return result};
 const old=s.cache.acquire(a,url);const rejected=assert.rejects(old,{code:'ASSET_INVALIDATED'});await entered;
 const clearing=s.cache.invalidate(a);assert.equal(s.cache.peek(a),null);
 const next=s.cache.acquire(a,url);release();await clearing;await rejected;
 const renewed=await next;assert.equal(renewed.cacheHit,false);assert.equal(s.downloads(),2);assert.ok(s.files.has(renewed.localPath));
});

test('in-flight invalidated download cannot republish after a replacement has committed',async()=>{
 const s=setup(),a=asset();let release,started;const entered=new Promise(r=>started=r);
 const download=s.adapter.download;
 s.adapter.download=async(...args)=>{const response=await download(...args);started();await new Promise(r=>release=r);return response};
 const old=s.cache.acquire(a,url),rejected=assert.rejects(old,{code:'ASSET_INVALIDATED'});await entered;
 await s.cache.invalidate(a);s.adapter.download=download;const current=await s.cache.acquire(a,url);release();await rejected;
 assert.equal(s.cache.peek(a).localPath,current.localPath);assert.equal(s.index().entries.length,1);assert.equal(s.files.size,1);
});

test('callers cannot mutate an acquired descriptor into a different pet while it waits',async()=>{
 const s=setup(),a=asset();let release;s.setHold(new Promise(r=>release=r));
 const pending=s.cache.acquire(a,url);await Promise.resolve();a.petId='dog';a.masterId='other';release();await pending;
 assert.equal(s.index().entries[0].asset.petId,'cat');assert.equal(s.index().entries[0].asset.masterId,asset().masterId);
});

test('a malformed index row does not discard unrelated validated local files',async()=>{
 const s=setup();await s.cache.acquire(asset(),url);const saved=s.index();saved.entries.push({...saved.entries[0],asset:null});
 s.adapter.writeIndex(saved);const restored=s.create();const hit=await restored.acquire(asset(),()=>{throw Error('offline')});
 assert.equal(hit.cacheHit,true);assert.equal(s.downloads(),1);
});

test('restart reclaims only orphan copies and preserves indexed masters and source photos',async()=>{
 const s=setup(),a=asset(),cached=await s.cache.acquire(a,url);
 const orphan='_doc/pety-avatar-cache-v1/crash-copy.png',photo='_doc/user-photo.png';
 s.files.set(orphan,{...s.info});s.files.set(photo,{...s.info});
 s.adapter.listOwnedFiles=async()=>[...s.files].map(([path,info])=>({path,bytes:info.bytes}));
 const restarted=s.create();await restarted.acquire(a,url);
 assert.equal(s.files.has(orphan),false);assert.ok(s.files.has(photo));assert.ok(s.files.has(cached.localPath));assert.equal(s.downloads(),1);
});

test('failed orphan deletion remains counted against disk capacity',async()=>{
 const s=setup({limitBytes:15}),orphan='_doc/pety-avatar-cache-v1/locked.png';s.files.set(orphan,{...s.info});
 s.adapter.listOwnedFiles=async()=>[{path:orphan,bytes:10}];const remove=s.adapter.remove;
 s.adapter.remove=async p=>{if(p===orphan)throw Error('busy');return remove(p)};
 await assert.rejects(s.cache.acquire(asset(),url),{code:'ASSET_CACHE_FULL'});
 assert.equal(s.cache.diagnostics().unreclaimedBytes,10);assert.equal(s.files.size,1);assert.equal(s.index(),null);
});

test('directory inventory failure prevents downloads instead of assuming unlimited free space',async()=>{
 const s=setup();s.adapter.listOwnedFiles=async()=>{throw Error('directory-unreadable')};
 await assert.rejects(s.cache.acquire(asset(),url),/directory-unreadable/);assert.equal(s.downloads(),0);
});
