'use strict';
const crypto=require('crypto');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const fail=code=>{throw Object.assign(new Error(code),{code})};
const positive=value=>Number.isSafeInteger(value)&&value>0;
function confirmed(result){
 if(!result||typeof result!=='object'||Array.isArray(result)||result.success===false||result.ok===false||result.error||['errCode','code'].some(key=>Object.hasOwn(result,key)&&![0,'0',null,undefined,''].includes(result[key])))fail('AVATAR_DATABASE_UNAVAILABLE');
 return result;
}
function readOne(result){
 confirmed(result);
 if(!Array.isArray(result.data)||result.data.length>1||result.data.some(row=>!row||typeof row!=='object'||Array.isArray(row)))fail('AVATAR_DATABASE_UNAVAILABLE');
 return result.data[0]||null;
}
function affected(result){
 confirmed(result);const values=['updated','updatedCount','affectedDocs','modifiedCount','affectedRows'].filter(key=>Object.hasOwn(result,key)).map(key=>result[key]);
 if(!values.length||values.some(value=>!Number.isSafeInteger(value)||value<0||value>1||value!==values[0]))fail('AVATAR_DATABASE_UNAVAILABLE');
 return values[0];
}
function validate(row,id,scope){
 if(row._id!==id||row.owner!==scope.owner||row.pet!==scope.pet||row.session!==scope.session)fail('AVATAR_SOURCE_NOT_OWNED');
 const path=String(row.cloudPath||'').match(/^(?:pety-private-v3\/)?pet-avatar\/input-v2\/([a-f0-9]{24})\/([a-f0-9]{64})\/[a-f0-9]{48}\.jpg$/);
 const prefix=typeof row.fileId==='string'&&row.fileId.match(/^(cloud:\/\/[^/?#]+\/)/)?.[1];
 if(!path||path[1]!==scope.pet||path[2]!==id||!prefix||prefix+row.cloudPath!==row.fileId||!['issued','ready'].includes(row.state)||!positive(row.createdAt)||!positive(row.expiresAt)||row.expiresAt<=row.createdAt)fail('AVATAR_SOURCE_STATE_INVALID');
 if(row.state==='ready'&&(!/^[a-f0-9]{64}$/.test(row.sha256)||!positive(row.bytes)||row.bytes>20*1024*1024||!positive(row.readyAt)))fail('AVATAR_SOURCE_STATE_INVALID');
 return row;
}
function createSourceReceipts(collection,inspect) {
 async function owned(id,scope){
  if(!/^[a-f0-9]{64}$/.test(id))fail('AVATAR_SOURCE_NOT_OWNED');
  const row=readOne(await collection.doc(id).get());
  if(!row)fail('AVATAR_SOURCE_NOT_OWNED');
  return validate(row,id,scope);
 }
 return {
  async issue(scope,{batchId,slot,prefix}){
   if(!/^[a-zA-Z0-9_-]{8,100}$/.test(batchId)||!Number.isInteger(slot)||slot<0||slot>2||!/^cloud:\/\/[^/?#]+\/$/.test(prefix))fail('INVALID_SOURCE_IMAGES');
   const id=hash(JSON.stringify([scope.owner,scope.pet,scope.session,batchId,slot]));
   let row=readOne(await collection.doc(id).get());
   if(!row){
    const cloudPath=`pety-private-v3/pet-avatar/input-v2/${scope.pet}/${id}/${crypto.randomBytes(24).toString('hex')}.jpg`;
    row={_id:id,...scope,cloudPath,fileId:prefix+cloudPath,state:'issued',expiresAt:Date.now()+15*60*1000,createdAt:Date.now()};
    try{const receipt=confirmed(await collection.add(row));if(receipt.id!==id)fail('AVATAR_DATABASE_UNAVAILABLE');}
    catch(error){if(!/duplicate|already exists|E11000/i.test(String(error?.code||error?.message||'')))throw error;}
    // Both confirmed insertion and a duplicate race must read the persisted
    // ticket. A missing acknowledgment stops this attempt; retry uses this id.
    row=await owned(id,scope);
   }
   validate(row,id,scope);
   if(prefix+row.cloudPath!==row.fileId)fail('AVATAR_SOURCE_NOT_OWNED');
   if(row.state==='issued'&&row.expiresAt<=Date.now())fail('AVATAR_SOURCE_TICKET_EXPIRED');
   return{ticketId:id,cloudPath:row.cloudPath};
  },
  async complete(scope,id,fileId){
   const row=await owned(id,scope);
   if(fileId!==row.fileId)fail('AVATAR_SOURCE_NOT_OWNED');
   if(row.state==='ready')return{fileId:row.fileId};
   if(row.expiresAt<=Date.now())fail('AVATAR_SOURCE_TICKET_EXPIRED');
   const image=await inspect(fileId);
   if(!image||!/^[a-f0-9]{64}$/.test(image.sha256)||!['image/jpeg','image/png'].includes(image.mime)||!positive(image.bytes)||image.bytes>20*1024*1024||!positive(image.width)||!positive(image.height))fail('INVALID_SOURCE_IMAGES');
   if(row.expiresAt<=Date.now())fail('AVATAR_SOURCE_TICKET_EXPIRED');
   const result=await collection.where({_id:id,owner:scope.owner,pet:scope.pet,session:scope.session,fileId:row.fileId,expiresAt:row.expiresAt,state:'issued'}).update({state:'ready',sha256:image.sha256,bytes:image.bytes,readyAt:Date.now()});
   affected(result);
   const current=await owned(id,scope);
   if(current.state!=='ready'||current.sha256!==image.sha256||current.bytes!==image.bytes)fail('AVATAR_SOURCE_CHANGED');
   return{fileId:row.fileId};
  },
  async hashes(scope,fileIds){
   const expected={};
   for(const fileId of fileIds){
    const match=String(fileId).match(/^cloud:\/\/[^/?#]+\/(?:pety-private-v3\/)?pet-avatar\/input-v2\/[a-f0-9]{24}\/([a-f0-9]{64})\/[a-f0-9]{48}\.jpg$/);
    if(!match)fail('AVATAR_SOURCE_NOT_OWNED');
    const row=await owned(match[1],scope);
    if(row.state!=='ready'||row.fileId!==fileId||!/^[a-f0-9]{64}$/.test(row.sha256))fail('AVATAR_SOURCE_NOT_OWNED');
    expected[fileId]=row.sha256;
   }
   return expected;
  }
 };
}
module.exports={createSourceReceipts};
