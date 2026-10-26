'use strict';
const crypto=require('crypto');
const COLLECTION='pety_provider_budgets';
const hash=s=>crypto.createHash('sha256').update(String(s)).digest('hex');
const error=code=>{const e=new Error(code);e.code=code;return e;};
const unavailable=()=>{throw error('PROVIDER_BUDGET_UNAVAILABLE');};
function confirmedResult(result){
 if(!result||typeof result!=='object'||Array.isArray(result))unavailable();
 for(const key of ['errCode','code'])if(result[key]!==undefined&&result[key]!==null&&result[key]!==0&&result[key]!=='0'&&result[key]!=='')unavailable();
 if(result.error)unavailable();
 return result;
}
function readCounter(result,id){
 confirmedResult(result);
 if(!Array.isArray(result.data)||result.data.length>1)unavailable();
 if(!result.data.length)return null;
 const row=result.data[0];
 if(!row||typeof row!=='object'||Array.isArray(row)||row._id!==id||!Number.isSafeInteger(row.count)||row.count<0)unavailable();
 return row;
}
function changedCount(result){
 confirmedResult(result);
 const counts=['updated','updatedCount','affectedDocs','modifiedCount'].filter(key=>Object.prototype.hasOwnProperty.call(result,key)).map(key=>result[key]);
 if(!counts.length||counts.some(value=>!Number.isSafeInteger(value)||value<0||value>1||value!==counts[0]))unavailable();
 return counts[0];
}
// Cost counters are conservative attempt ceilings, separate from user success
// entitlements. Never undo them on provider timeout or unknown acceptance.
async function take(collection,command,id,limit,now){
 for(let attempt=0;attempt<2;attempt++){
  const row=readCounter(await collection.doc(id).get(),id);
  if(!row){let created;
   try{created=await collection.add({_id:id,count:1,createdAt:now,updatedAt:now,expiresAt:now+2*86400000});}
   catch(e){if(/duplicate|already exists|E11000|DOCUMENT_EXISTS/i.test(String(e?.code||e?.message)))continue;throw e;}
   // Unknown write outcomes may already have spent a reservation. Do not retry,
   // refund, or authorize provider work from a missing/contradictory receipt.
   if(confirmedResult(created).id!==id)unavailable();return;
  }
  if(row.count>=limit)throw error('PROVIDER_BUDGET_EXCEEDED');
  const changed=await collection.where({_id:id,count:command.lt(limit)}).update({count:command.inc(1),updatedAt:now});
  if(changedCount(changed)===1)return;
 }
 // After only confirmed duplicate/zero-write races, read once to distinguish
 // an actual ceiling from an unavailable counter. This never retries a write.
 const latest=readCounter(await collection.doc(id).get(),id);
 if(latest&&latest.count>=limit)throw error('PROVIDER_BUDGET_EXCEEDED');
 unavailable();
}
function createCostBudget(db,config={},clock=()=>Date.now()){
 const cap=(value,fallback,max)=>Number.isSafeInteger(value)&&value>=0?Math.min(value,max):fallback;
 return{async reserve({uid,feature}){
  if(typeof uid!=='string'||!uid||!['ai','avatar','cutout'].includes(feature))throw error('PROVIDER_BUDGET_UNAVAILABLE');
  const limits=feature==='ai'?{account:cap(config.aiAccountDay,100,300),global:cap(config.aiGlobalDay,1000,5000)}:feature==='avatar'?{account:cap(config.avatarAccountDay,10,30),global:cap(config.avatarGlobalDay,50,100)}:{account:cap(config.cutoutAccountDay,5,10),global:cap(config.cutoutGlobalDay,20,50)};
  if(limits.account===0||limits.global===0)throw error('PROVIDER_BUDGET_EXCEEDED');
  const now=clock(),day=Math.floor((now+8*3600000)/86400000),c=db.collection(COLLECTION);
  try{await take(c,db.command,`${feature}_account_${hash(uid)}_${day}`,limits.account,now);await take(c,db.command,`${feature}_global_${day}`,limits.global,now);}catch(e){if(e?.code==='PROVIDER_BUDGET_EXCEEDED')throw e;throw error('PROVIDER_BUDGET_UNAVAILABLE');}
  return{reserved:true};
 }};
}
async function reserve({uid,feature}){
 const config={};for(const key of ['aiAccountDay','aiGlobalDay','avatarAccountDay','avatarGlobalDay','cutoutAccountDay','cutoutGlobalDay']){const env='PETY_COST_'+key.replace(/[A-Z]/g,c=>'_'+c).toUpperCase();if(process.env[env])config[key]=Number(process.env[env]);}
 return createCostBudget(uniCloud.database(),config).reserve({uid,feature});
}
module.exports={createCostBudget,reserve,COLLECTION};
