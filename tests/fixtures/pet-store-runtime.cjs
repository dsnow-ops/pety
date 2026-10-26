const fs=require('node:fs');
function harness(){
 const disk=new Map();let scope={ready:true,namespace:'guest:local',version:1},fault='',once=false,onWrite=null,reads=0,writes=0,removes=0;
 const uni={showToast(){},getStorageInfoSync:()=>({keys:[...disk.keys()]}),getStorageSync:k=>{reads++;return structuredClone(disk.get(k));},setStorageSync:(k,v)=>{if(onWrite)onWrite(k);if(fault&&k.includes(fault)){if(once)fault='';throw Error('TEST_FULL')}writes++;disk.set(k,structuredClone(v));},removeStorageSync:k=>{if(onWrite)onWrite(k);if(fault&&k.includes(fault)){if(once)fault='';throw Error('TEST_FULL')}removes++;disk.delete(k);}};
 let src=fs.readFileSync('common/scoped-storage.js','utf8').replace(/^import[^;]+;\s*/gm,'').replace(/export /g,'');
 const {createScopedStorage}=Function('getAccountScope','uni',src+';return {createScopedStorage};')(()=>scope,uni),storage=createScopedStorage(uni,()=>scope);
 const removal=fs.existsSync('common/pet-removal.js')?Function(fs.readFileSync('common/pet-removal.js','utf8').replace(/export /g,'')+';return createPetRemovalPlan;')():undefined;
 const deps={createPetRemovalPlan:removal,uni,scopedStorage:storage,captureDataScope:()=>({...scope}),subscribeAccountScope:()=>()=>{},clearAvatarDisplayAssetCache(){},getOwnerRelationLabel:()=>'',getPetRelationshipStage:p=>p?.relationshipStage||p?.status||'current',normalizeOwnerRelation:()=>({ownerRelationKey:'unset',ownerRelationCustom:''}),getDefaultAvatarStyle:()=> 'soft3d',normalizeAvatarSource:s=>s,normalizeAvatarStatus:s=>s,normalizeAvatarStyle:s=>s};
 src=fs.readFileSync('common/pet-store.js','utf8').replace(/^import[^;]+;\s*/gm,'').replace(/export /g,'');
 const api=Function(...Object.keys(deps),src+';return {getPetList,getActivePet,setActivePet,addPet,updatePet,removePet,normalizePet,subscribePetSelection};')(...Object.values(deps));
 return{...api,disk,storage,scope:()=>scope,changeAccount:()=>scope={ready:true,namespace:'account:TEST-B',version:scope.version+1},fail:(key,single=false)=>{fault=key;once=single},onWrite:fn=>onWrite=fn,resetCounts:()=>{reads=0;writes=0;removes=0},counts:()=>({reads,writes,removes}),seed:(pets,active=pets[0]?.id)=>{disk.set('my_pets_list',structuredClone(pets));disk.set('current_active_pet_id',active)}};
}
const pet=(id='TEST-A')=>({id,name:id,createdAt:1,updatedAt:1,status:'current'});

module.exports={harness,pet};
