const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {harness,pet}=require('./fixtures/pet-store-runtime.cjs');
test('ordinary pet reads do not write, change legacy fields or require writable storage',()=>{
 const h=harness();h.seed([pet()]);h.disk.set('pet_name','TEST original cache');const before=structuredClone([...h.disk]);h.resetCounts();h.fail('my_pets_list');
 for(let i=0;i<10;i++){assert.equal(h.getPetList()[0].id,'TEST-A');assert.equal(h.getActivePet().id,'TEST-A');}
 assert.equal(h.counts().writes,0);assert.equal(h.counts().removes,0);assert.deepEqual([...h.disk],before);
});
test('corrupt list or identity cannot be replaced by legacy cache through reads or mutations',()=>{
 for(const value of [42,'broken',{},null,[null],[{}],[pet(),pet()],[{...pet(),id:7}],[{...pet(),generatedAvatarFileId:5}]]){
  const h=harness();h.disk.set('my_pets_list',value);h.disk.set('pet_name','TEST cached');const before=structuredClone([...h.disk]);
  for(const action of [()=>h.getPetList(),()=>h.addPet({name:'new'}),()=>h.updatePet('TEST-A',{name:'new'}),()=>h.removePet('TEST-A')])assert.throws(action,{code:'PET_STORAGE_INVALID'});
  assert.deepEqual([...h.disk],before);
 }
});
test('explicit empty pet list never resurrects stale legacy cache',()=>{const h=harness();h.seed([]);h.disk.set('pet_name','TEST deleted old pet');assert.deepEqual(h.getPetList(),[]);assert.equal(h.getActivePet(),null);assert.equal(h.counts().writes,0);});
test('legacy-only migration becomes stable once, while failed migration restores all keys',()=>{
 const h=harness();h.disk.set('pet_name','TEST legacy');const first=h.getActivePet();assert.ok(first.id);assert.equal(first.name,'TEST legacy');h.resetCounts();assert.equal(h.getActivePet().id,first.id);assert.equal(h.counts().writes,0);
 const failed=harness();failed.disk.set('pet_name','TEST legacy');const before=structuredClone([...failed.disk]);failed.fail('current_active_pet_id',true);assert.throws(()=>failed.getPetList());assert.deepEqual([...failed.disk],before);failed.fail('');assert.equal(failed.getActivePet().name,'TEST legacy');
});
test('pet addition is atomic across list, selection and compatibility fields',()=>{
 const h=harness();h.seed([pet()]);h.setActivePet('TEST-A');const before=structuredClone([...h.disk]);h.fail('pet_photo',true);assert.throws(()=>h.addPet({id:'TEST-B',name:'B',photo:'TEST-B.jpg'}));assert.deepEqual([...h.disk],before);h.fail('');h.addPet({id:'TEST-B',name:'B',photo:'TEST-B.jpg'});assert.equal(h.getActivePet().id,'TEST-B');assert.equal(h.getPetList().length,2);
});
test('pet update failure cannot leave renamed list with old compatibility name',()=>{
 const h=harness();h.seed([pet()]);h.setActivePet('TEST-A');const before=structuredClone([...h.disk]);h.fail('pet_name',true);assert.throws(()=>h.updatePet('TEST-A',{name:'TEST renamed'}));assert.deepEqual([...h.disk],before);h.fail('');assert.equal(h.updatePet('TEST-A',{name:'TEST renamed'}).name,'TEST renamed');assert.equal(h.disk.get('pet_name'),'TEST renamed');
});
test('selection failure restores active pet and no successful listener is fired',()=>{const h=harness();h.seed([pet(),pet('TEST-B')]);h.setActivePet('TEST-A');let notifications=0;h.subscribePetSelection(()=>notifications++);const before=structuredClone([...h.disk]);h.fail('pet_name',true);assert.throws(()=>h.setActivePet('TEST-B'));assert.equal(notifications,0);assert.deepEqual([...h.disk],before);assert.equal(h.getActivePet().id,'TEST-A');});
test('duplicate explicit ids are rejected and unknown legacy fields survive an ordinary update',()=>{
 const h=harness();h.seed([{...pet(),legacyExtra:{keep:true}}]);assert.throws(()=>h.addPet({id:'TEST-A',name:'duplicate'}),{code:'PET_ID_EXISTS'});h.updatePet('TEST-A',{name:'new'});assert.deepEqual(h.disk.get('my_pets_list')[0].legacyExtra,{keep:true});
});
test('pet data remains separated after account change even with identical identifiers',()=>{const h=harness();h.seed([pet()]);h.changeAccount();assert.deepEqual(h.getPetList(),[]);h.addPet({id:'TEST-A',name:'B owned'});assert.equal(h.getActivePet().name,'B owned');assert.equal(h.disk.get('my_pets_list')[0].name,'TEST-A');});

test('account changes during pet writes roll back old account and never touch the next account',()=>{const h=harness();h.seed([pet()]);h.setActivePet('TEST-A');const before=structuredClone([...h.disk]);let switched=false;h.onWrite(key=>{if(!switched&&key==='my_pets_list'){switched=true;h.changeAccount();}});assert.throws(()=>h.addPet({id:'TEST-new',name:'new'}),{code:'DATA_SCOPE_CHANGED'});assert.equal(switched,true);assert.deepEqual([...h.disk],before);assert.deepEqual(h.getPetList(),[]);});
