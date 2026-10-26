'use strict';
const fs=require('node:fs'),test=require('node:test'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const source=file=>fs.readFileSync(file,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'');
const views=Function('eventTimeLabel',source('common/record-views.js')+';return {lifePhotos,hasCareContent};')(()=> 'TEST');
const api=Function('lifePhotos','hasCareContent',source('common/photo-export-core.js')+';return {photoExportReference,photoExportPlan,storedZip,runPhotoExport,PHOTO_EXPORT_MAX_BYTES};')(views.lifePhotos,views.hasCareContent);
const scope={ready:true,namespace:'TEST-A'},petId='TEST-P1';
function row(id='one'){return{id,namespace:scope.namespace,petId,revision:1,localDate:'2026-10-23',kind:'life',original:'TEST 窗边的生活照片',media:[{id:'asset-'+id,key:'TEST-key-'+id,path:'',backend:'indexeddb',namespace:scope.namespace,petId,durable:true,purpose:'life'}]};}
const ref=r=>api.photoExportReference(r,r.media[0]);
test('photo export resolves only explicit current-owner life sources and rejects changed or ambiguous selection',()=>{
 const r=row();assert.equal(api.photoExportPlan([r],[ref(r)],scope,petId).length,1);
 for(const changed of [{...r,namespace:'TEST-B'},{...r,petId:'TEST-P2'},{...r,revision:2},{...r,_group:'drafts'},{...r,example:true},{...r,note:'TEST care'},{...r,media:[{...r.media[0],purpose:'care'}]}])assert.throws(()=>api.photoExportPlan([changed],[ref(r)],scope,petId));
 assert.throws(()=>api.photoExportPlan([r,r],[ref(r)],scope,petId));assert.throws(()=>api.photoExportPlan([r],[ref(r),ref(r)],scope,petId));assert.throws(()=>api.photoExportPlan([r],[ref(r)],{...scope,ready:false},petId));
 const rows=Array.from({length:31},(_,i)=>row(String(i)));assert.throws(()=>api.photoExportPlan(rows,rows.map(ref),scope,petId));
 const imprecise={...r,eventTime:{precision:'year',year:2026}};assert.equal(api.photoExportPlan([imprecise],[ref(imprecise)],scope,petId)[0].date,'date-unknown');
});
test('ZIP STORE is readable by independent .NET ZipArchive and retains exact bytes',()=>{
 const files=[{name:'2026-10-23_001.png',bytes:Uint8Array.from([0,1,2,250,255])},{name:'date-unknown_002.jpg',bytes:new TextEncoder().encode('TEST 原图字节，不重新编码')}];
 const zip=api.storedZip(files),script="$b=[Convert]::FromBase64String([Console]::In.ReadToEnd());$m=[IO.MemoryStream]::new($b);$z=[IO.Compression.ZipArchive]::new($m);$out=@($z.Entries|ForEach-Object{$s=$_.Open();$v=[IO.MemoryStream]::new();$s.CopyTo($v);[pscustomobject]@{name=$_.FullName;base64=[Convert]::ToBase64String($v.ToArray())};$s.Dispose();$v.Dispose()});$out|ConvertTo-Json -Compress;$z.Dispose();$m.Dispose()";
 const result=spawnSync('pwsh',['-NoProfile','-NonInteractive','-Command',script],{input:Buffer.from(zip).toString('base64'),encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert.deepEqual(JSON.parse(result.stdout),files.map(file=>({name:file.name,base64:Buffer.from(file.bytes).toString('base64')})));
 assert.throws(()=>api.storedZip([{name:'../private.png',bytes:new Uint8Array([1])}]));assert.throws(()=>api.storedZip([{name:'huge.png',bytes:new Uint8Array(api.PHOTO_EXPORT_MAX_BYTES)}]),e=>e.code==='PHOTO_EXPORT_SIZE_LIMIT');
 const known=api.storedZip([{name:'crc.png',bytes:new TextEncoder().encode('123456789')}]);assert.equal(new DataView(known.buffer).getUint32(14,true),0xcbf43926);
});
function flow(mode='archive'){
 const rows=[row('one'),row('two'),row('three')],items=api.photoExportPlan(rows,rows.map(ref),scope,petId),calls={resolve:[],release:[],save:[],download:[]};let active=true,cancelled=false;
 const adapter={mode,isCurrent:()=>active,cancelled:()=>cancelled,sourceCurrent:item=>api.photoExportPlan(rows,[item],scope,petId),resolve:async asset=>{calls.resolve.push(asset.id);return{path:'blob:'+asset.id}},release:path=>calls.release.push(path),readBytes:async()=>({bytes:new Uint8Array([1,2,3]),extension:'png'}),saveToAlbum:async path=>calls.save.push(path),downloadArchive:async bytes=>calls.download.push(bytes)};
 return{items,rows,adapter,calls,stop:()=>cancelled=true,switchOwner:()=>active=false};
}
test('partial archive preserves successes, reports missing sources, and releases every resolved URL',async()=>{
 const f=flow();f.adapter.resolve=async asset=>{if(asset.id==='asset-two')throw Error('missing');return{path:'blob:'+asset.id}};const report=await api.runPhotoExport(f.items,f.adapter);
 assert.deepEqual(report.results.map(r=>r.status),['download-started','failed','download-started']);assert.equal(f.calls.download.length,1);assert.deepEqual(f.calls.release,['blob:asset-one','blob:asset-three']);assert.equal(f.calls.save.length,0);
});
test('owner switch, cancellation, or source mutation before download never exports a stale archive',async()=>{
 for(const action of ['switch','cancel','mutate']){const f=flow();let reads=0;f.adapter.readBytes=async()=>{reads++;if(action==='switch')f.switchOwner();if(action==='cancel')f.stop();if(action==='mutate'&&reads===2)f.rows[0].revision++;return{bytes:new Uint8Array([1]),extension:'png'}};const report=await api.runPhotoExport(f.items,f.adapter);assert.equal(f.calls.download.length,0);assert.ok(report.results.every(r=>r.status!=='download-started'));assert.ok(f.calls.release.length>0);}
});
test('native failure stops additional permission prompts and retains only unfinished items for retry',async()=>{
 const f=flow('album');f.adapter.saveToAlbum=async path=>{f.calls.save.push(path);if(path==='blob:asset-two')throw Error('permission denied')};const report=await api.runPhotoExport(f.items,f.adapter);
 assert.deepEqual(report.results.map(r=>r.status),['saved','failed','pending']);assert.equal(f.calls.save.length,2);assert.equal(f.calls.resolve.length,2);assert.equal(f.calls.release.length,2);assert.equal(f.calls.download.length,0);
 const unfinished=f.items.filter(item=>report.results.find(r=>r.key===item.key).status!=='saved');f.adapter.saveToAlbum=async path=>f.calls.save.push(path);await api.runPhotoExport(unfinished,f.adapter);assert.equal(f.calls.save.filter(p=>p==='blob:asset-one').length,1);
});
test('native operation already acknowledged stays saved after cancellation; later photos never start',async()=>{
 const f=flow('album');f.adapter.saveToAlbum=async path=>{f.calls.save.push(path);f.stop()};const report=await api.runPhotoExport(f.items,f.adapter);assert.deepEqual(report.results.map(r=>r.status),['saved','pending','pending']);assert.equal(f.calls.save.length,1);assert.equal(report.cancelled,true);
});
test('download failure and oversized batch cannot be reported as saved',async()=>{
 const f=flow();f.adapter.downloadArchive=async()=>{throw Error('blocked')};const report=await api.runPhotoExport(f.items,f.adapter);assert.ok(report.results.every(r=>r.status==='failed'));
 const big=flow();big.adapter.readBytes=async()=>({bytes:new Uint8Array(api.PHOTO_EXPORT_MAX_BYTES+1),extension:'png'});const stopped=await api.runPhotoExport(big.items,big.adapter);assert.equal(big.calls.download.length,0);assert.equal(stopped.results[0].errorCode,'PHOTO_EXPORT_SIZE_LIMIT');
});
test('platform adapters reject another owner binary key and remote native sources before resolving',async()=>{
 for(const platform of ['H5','APP']){
  let resolved=0;const raw=fs.readFileSync('common/photo-export.js','utf8').replace(platform==='H5'?/\/\/ #ifndef H5[\s\S]*?\/\/ #endif/g:/\/\/ #ifdef H5[\s\S]*?\/\/ #endif/g,'').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'');
  const run=Function('resolveNarrativePhoto','releaseNarrativePhoto','runPhotoExport',raw+';return exportLifePhotos;')(()=>{resolved++;throw Error('must not resolve')},()=>{},api.runPhotoExport);
  const asset={...row().media[0],key:'TEST-B:TEST-P1:private',backend:platform==='H5'?'indexeddb':'sandbox',path:'https://private.invalid/photo.png'};
  const report=await run([{key:'one',asset}],{scope,petId,isCurrent:()=>true,sourceCurrent:()=>{},cancelled:()=>false});assert.equal(resolved,0);assert.equal(report.results[0].status,'failed');
 }
});
