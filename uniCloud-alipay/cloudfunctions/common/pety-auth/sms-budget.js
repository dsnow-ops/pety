'use strict';
const crypto=require('crypto');
const transactionDocument=require('./transaction-document');
const COLLECTION='pety_sms_send_budgets';
const hash=s=>crypto.createHash('sha256').update(String(s)).digest('hex');
const fail=(code,seconds)=>{throw{errCode:code,errMsg:code==='pety-sms-rate-limit'?'短信请求过于频繁，请稍后再试。':'短信服务暂时不可用，请稍后再试。',...(seconds?{retryAfter:seconds}:{})};};
function confirmedResult(result){
 if(!result||typeof result!=='object'||Array.isArray(result))fail('pety-sms-budget-unavailable');
 for(const key of ['errCode','code'])if(result[key]!==undefined&&result[key]!==null&&result[key]!==0&&result[key]!=='0'&&result[key]!=='')fail('pety-sms-budget-unavailable');
 if(result.error)fail('pety-sms-budget-unavailable');
 return result;
}
function validCounter(row,id){
 if(!row||typeof row!=='object'||Array.isArray(row)||row._id!==id||
  !Number.isSafeInteger(row.count)||row.count<0||row.count>=Number.MAX_SAFE_INTEGER||
  !Number.isSafeInteger(row.version)||row.version<0||row.version>=Number.MAX_SAFE_INTEGER||
  !Number.isSafeInteger(row.nextAt)||row.nextAt<0)fail('pety-sms-budget-unavailable');
 return row;
}
function confirmedUpdate(result){
 confirmedResult(result);
 const counts=['updated','updatedCount','affectedDocs','modifiedCount'].filter(key=>Object.prototype.hasOwnProperty.call(result,key)).map(key=>result[key]);
 if(!counts.length||counts.some(value=>value!==1))fail('pety-sms-budget-unavailable');
}
function createSmsBudget(db,config={},now=()=>Date.now()){
 const positive=(v,d,max)=>Number.isSafeInteger(v)&&v>0?Math.min(v,max):d;
 const limits={phoneHour:positive(config.phoneHour,5,20),phoneDay:positive(config.phoneDay,10,50),ipHour:positive(config.ipHour,50,200),globalDay:positive(config.globalDay,100,10000),cooldownMs:positive(config.cooldownMs,60000,300000)};
 return{async reserve({mobile,clientIP}){
  if(typeof mobile!=='string'||!mobile||typeof clientIP!=='string'||!clientIP.trim())fail('pety-sms-budget-unavailable');
  const time=now(),hour=Math.floor(time/3600000),day=Math.floor((time+8*3600000)/86400000),phone=hash(mobile),ip=hash(clientIP);
  const budgets=[{id:'cooldown_'+phone,limit:Infinity,cooldown:true},{id:`phone_hour_${phone}_${hour}`,limit:limits.phoneHour},{id:`phone_day_${phone}_${day}`,limit:limits.phoneDay},{id:`ip_hour_${ip}_${hour}`,limit:limits.ipHour},{id:`global_day_${day}`,limit:limits.globalDay}];
  // Ensure deterministic documents before CAS transaction; simultaneous creators
  // may collide, but no request can send until all counters commit together.
  const collection=db.collection(COLLECTION);
  try{for(const b of budgets){
   const existing=confirmedResult(await collection.doc(b.id).get());
   if(!Array.isArray(existing.data)||existing.data.length>1)fail('pety-sms-budget-unavailable');
   if(existing.data.length){validCounter(existing.data[0],b.id);continue;}
   let created;
   try{created=await collection.add({_id:b.id,count:0,version:0,nextAt:0,expiresAt:time+2*86400000});}
   catch(e){if(/duplicate|already exists|E11000|DOCUMENT_EXISTS/i.test(String(e?.code||e?.message)))continue;throw e;}
   if(confirmedResult(created).id!==b.id)fail('pety-sms-budget-unavailable');
  }
   const tx=await db.startTransaction();try{
    for(const b of budgets){const c=tx.collection(COLLECTION),row=validCounter(transactionDocument(confirmedResult(await c.doc(b.id).get())),b.id);
     if(b.cooldown&&row.nextAt>time)fail('pety-sms-rate-limit',Math.ceil((row.nextAt-time)/1000));
     if(row.count>=b.limit)fail('pety-sms-rate-limit');
     const changed=await c.doc(b.id).update({count:row.count+1,version:row.version+1,nextAt:b.cooldown?time+limits.cooldownMs:0,updatedAt:time});confirmedUpdate(changed);
    }await tx.commit();
   }catch(e){try{await tx.rollback();}catch(_){}throw e;}
  }catch(e){if(e?.errCode==='pety-sms-rate-limit')throw e;fail('pety-sms-budget-unavailable');}
  // Never refund on uncertain provider outcome: it may already have sent.
  return{reserved:true};
 }};
}
async function reserve({mobile}){
 const info=this.getUniversalClientInfo();
 return createSmsBudget(uniCloud.database(),this.config?.service?.sms?.sendBudget).reserve({mobile,clientIP:info?.clientIP});
}
module.exports={createSmsBudget,reserve,COLLECTION};
