const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const source=file=>fs.readFileSync(file,'utf8').replace(/^import[^;]+;\s*/gm,'').replace(/export /g,'');
function setup(namespace='account:TEST-A'){
 let scope={namespace,version:1,ready:true},writes=0,failAt=0,locked=false,keepFailing=false;
 const disk=new Map(),copy=v=>v===undefined?undefined:structuredClone(v);
 function checkWrite(){if(locked||++writes===failAt){if(keepFailing)locked=true;throw Error('TEST disk unavailable');}}
 const physical={getStorageInfoSync:()=>({keys:[...disk.keys()]}),getStorageSync:k=>copy(disk.get(k)),setStorageSync(k,v){checkWrite();disk.set(k,copy(v));},removeStorageSync(k){checkWrite();disk.delete(k);}};
 const {createScopedStorage}=Function('getAccountScope','uni',source('common/scoped-storage.js')+';return {createScopedStorage}')( ()=>scope,physical);
 const storage=createScopedStorage(physical,()=>scope);
 const {createNarrativeStore}=Function('scopedStorage','captureDataScope',source('common/narrative-store.js')+';return {createNarrativeStore}')(storage,()=>scope);
 storage.setStorageSync('pet_diaries_TEST-p',{'2026-10-01':{note:'TEST original',updatedAt:1},'2026-10-02':{note:'TEST unrelated',updatedAt:2}});
 const store=createNarrativeStore(storage,{...scope},'TEST-p');
 store.saveWork({id:'TEST-linked',petId:'TEST-p',namespace,sources:[{id:'legacy:2026-10-01'}],text:'TEST independent snapshot'});
 store.saveWork({id:'TEST-unrelated',petId:'TEST-p',namespace,sources:[{id:'legacy:2026-10-02'}],text:'TEST unrelated snapshot'});
 return{disk,storage,store,physical,failAfter:(n,persistent=false)=>{failAt=writes+n;keepFailing=persistent;},lock:v=>locked=v,reopen:()=>createNarrativeStore(createScopedStorage(physical,()=>scope),{...scope},'TEST-p'),switch:()=>scope={namespace:'account:TEST-B',version:2,ready:true}};
}
for(const namespace of ['guest:local','account:TEST-A']){
 test(namespace+' legacy removal is all-or-nothing at every journal and business write boundary',()=>{
  for(let step=1;step<=5;step++){
   const h=setup(namespace);h.failAfter(step);try{h.store.remove('legacy:2026-10-01',true);}catch(e){assert.match(e.message,/TEST disk unavailable/);}
   const reopened=h.reopen(),original=reopened.list().some(r=>r.id==='legacy:2026-10-01'),linked=Boolean(reopened.read().works['TEST-linked']);
   assert.equal(original,linked,'source and linked snapshot must commit or recover together at step '+step);
   assert.ok(reopened.list().some(r=>r.id==='legacy:2026-10-02'));assert.ok(reopened.read().works['TEST-unrelated']);
   assert.ok(![...h.disk.keys()].some(k=>k.endsWith('__local_transaction_v1')));
  }
 });
 test(namespace+' explicit snapshot retention preserves its bytes and rejects a stale account lease',()=>{
  const h=setup(namespace),before=structuredClone(h.store.read().works);h.store.remove('legacy:2026-10-01',false);
  assert.equal(h.store.list().length,1);assert.deepEqual(h.store.read().works,before);
  const disk=structuredClone([...h.disk]);h.switch();assert.throws(()=>h.store.remove('legacy:2026-10-02',true),{code:'DATA_SCOPE_CHANGED'});assert.deepEqual([...h.disk],disk);
 });
 test(namespace+' persistent failure blocks reads until restart can recover the entire old record',()=>{
  const h=setup(namespace),before=structuredClone([...h.disk]);h.failAfter(3,true);
  assert.throws(()=>h.store.remove('legacy:2026-10-01',true),{code:'DATA_RECOVERY_REQUIRED'});
  assert.throws(()=>h.reopen().list(),/TEST disk unavailable/);
  h.lock(false);const reopened=h.reopen();assert.equal(reopened.list().length,2);assert.ok(reopened.read().works['TEST-linked']);assert.deepEqual([...h.disk],before);
 });
}
