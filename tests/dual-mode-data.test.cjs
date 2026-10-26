const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
function setup(){
 let owner={namespace:'guest:local',ready:true,version:0};const disk=new Map();
 const api=Function('getAccountScope','uni',fs.readFileSync('common/scoped-storage.js','utf8').replace(/^import[^;]+;\s*/gm,'').replace(/export /g,'')+';return {createScopedStorage};')(()=>owner,{});
 const storage=api.createScopedStorage({getStorageSync:k=>structuredClone(disk.get(k)),setStorageSync:(k,v)=>disk.set(k,structuredClone(v)),removeStorageSync:k=>disk.delete(k)},()=>owner);
 const mod=Function('scopedStorage','captureDataScope',fs.readFileSync('common/narrative-store.js','utf8').replace(/^import[^;]+;\s*/gm,'').replace(/export /g,'')+';return {createNarrativeStore,localEventDate,validLocalDate};')(storage,()=>owner);
 return {...mod,disk,storage,store:pet=>mod.createNarrativeStore(storage,{...owner},pet),login:uid=>{owner={namespace:uid?'account:'+uid:'guest:local',ready:true,version:owner.version+1}}};
}
test('old diaries remain byte-for-byte unchanged; mode switch keeps original kind and draft ownership',()=>{
 const s=setup();s.storage.setStorageSync('pet_diaries_p',{ '2026-09-01':{note:'old',relationshipStage:'current',updatedAt:1}});const before=JSON.stringify([...s.disk]);const store=s.store('p');assert.equal(store.list()[0].text,'old');assert.equal(store.list()[0].kind,'care');assert.equal(JSON.stringify([...s.disk]),before);
 const d=store.create('current');d.original=d.text='生活';d.revision++;store.saveDraft(d);assert.equal(s.store('p').open(d.id).mode,'current');assert.equal(s.store('q').open(d.id),null);
});
test('formal saves are idempotent or conflicting, never duplicated; original survives candidate use',()=>{
 const s=setup(),store=s.store('p'),d=store.create('deceased');d.original='我并不后悔那天的决定。';d.text='候选';d.revision++;store.saveDraft(d);const saved=store.save(d);assert.equal(saved.original,d.original);assert.equal(Object.keys(store.read().drafts).length,0);assert.throws(()=>store.save(d),{code:'NARRATIVE_VERSION_CONFLICT'});assert.equal(store.list().length,1);assert.equal(s.store('p').open(saved.id).text,'候选');
});
test('A guest B scopes and old async leases cannot share private writing',()=>{
 const s=setup();s.login('A');const a=s.store('same'),d=a.create('current');d.original='private';a.saveDraft(d);s.login(null);assert.equal(s.store('same').open(d.id),null);s.login('B');assert.equal(s.store('same').open(d.id),null);assert.throws(()=>a.saveDraft(d),{code:'DATA_SCOPE_CHANGED'});s.login('A');assert.equal(s.store('same').open(d.id).original,'private');assert.throws(()=>a.saveDraft(d),{code:'DATA_SCOPE_CHANGED'});
});
test('empty, temp media and invalid dates fail without erasing draft; snapshots are independently deleted',()=>{
 const s=setup(),store=s.store('p'),d=store.create('current');assert.throws(()=>store.save(d),{code:'NARRATIVE_EMPTY'});d.original='hello';d.media=[{id:'temp'}];assert.throws(()=>store.save(d),{code:'NARRATIVE_MEDIA_NOT_PERSISTED'});d.media=[];d.localDate='2026-02-30';assert.throws(()=>store.save(d),{code:'NARRATIVE_DATE_INVALID'});d.localDate='2026-09-28';const saved=store.save(d);store.saveWork({petId:'p',namespace:'guest:local',sources:[{id:saved.id}],text:'independent'});store.remove(saved.id);assert.equal(store.list().length,0);assert.equal(Object.keys(store.read().works).length,1);assert.equal(s.validLocalDate('2024-02-29'),true);
});
