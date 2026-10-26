const fs=require('node:fs'),test=require('node:test'),assert=require('node:assert/strict');
const {isAvatarDraftRetained}=Function(fs.readFileSync('common/avatar-cache-retention.js','utf8').replace(/export /g,'')+';return{isAvatarDraftRetained};')();
const asset=(namespace='guest:local',fileId='master')=>({namespace,petId:'cat',masterId:'master',fileId});
const session={petId:'cat',candidates:[{fileId:'master',generatedThumbnailFileId:'thumb'}]};

test('guest image authorization requires the committed import and unchanged current master',()=>{
 const {canImportGuestAvatarAsset}=Function(fs.readFileSync('common/avatar-cache-retention.js','utf8').replace(/export /g,'')+';return{canImportGuestAvatarAsset};')();
 const pet={id:'cat',localImportPending:true,generatedAvatarFileId:'master',generatedAvatarHeroFileId:'hero'};
 const receipt={status:'imported',ids:['cat'],pets:[structuredClone(pet)]};
 const values=new Map([['pety_owner_v1:account%3AA:pety_guest_import_v1',receipt],['pety_owner_v1:account%3AA:my_pets_list',[pet]]]);
 const read=k=>values.get(k),master={...asset('account:A'),revision:'master',purpose:'master'};
 assert.equal(canImportGuestAvatarAsset(master,read),true);
 assert.equal(canImportGuestAvatarAsset({...master,fileId:'hero',revision:'hero',purpose:'avatar'},read),true);
 assert.equal(canImportGuestAvatarAsset({...master,fileId:'other',revision:'other'},read),false);
 assert.equal(canImportGuestAvatarAsset({...master,namespace:'account:B'},read),false);
 assert.equal(canImportGuestAvatarAsset({...master,purpose:'candidate'},read),false);
 pet.generatedAvatarFileId='replacement';assert.equal(canImportGuestAvatarAsset(master,read),false);
 pet.generatedAvatarFileId='master';receipt.status='retained';assert.equal(canImportGuestAvatarAsset(master,read),false);
});

test('restart draft lookup protects both master and thumbnail using only its exact namespace key',()=>{
 const values=new Map([['pet_avatar_session_cat',session],['pety_owner_v1:account%3AA:pet_avatar_session_cat',session]]),seen=[];
 const read=k=>{seen.push(k);return values.get(k)};
 assert.equal(isAvatarDraftRetained(asset(),read),true);
 assert.equal(isAvatarDraftRetained(asset('account:A','thumb'),read),true);
 assert.equal(isAvatarDraftRetained(asset('account:B'),read),false);
 assert.deepEqual(seen,['pet_avatar_session_cat','pety_owner_v1:account%3AA:pet_avatar_session_cat','pety_owner_v1:account%3AB:pet_avatar_session_cat']);
 values.delete('pet_avatar_session_cat');assert.equal(isAvatarDraftRetained(asset(),read),false);
});

test('another master is not protected, while malformed/unreadable draft state forbids cleanup',()=>{
 assert.equal(isAvatarDraftRetained({...asset(),masterId:'other'},()=>session),false);
 assert.equal(isAvatarDraftRetained(asset('guest:local','unrelated'),()=>session),false);
 for(const value of [{petId:'other',candidates:[]},{petId:'cat',candidates:[null]},'corrupt']){
  assert.throws(()=>isAvatarDraftRetained(asset(),()=>value),{code:'ASSET_DRAFT_STATE_UNAVAILABLE'});
 }
 assert.throws(()=>isAvatarDraftRetained(asset(),()=>{throw Error('storage failed')}),{code:'ASSET_DRAFT_STATE_UNAVAILABLE'});
 assert.throws(()=>isAvatarDraftRetained(asset('auth:pending'),()=>session),{code:'ASSET_DRAFT_STATE_UNAVAILABLE'});
});
