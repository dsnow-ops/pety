'use strict';
const crypto=require('crypto');
const transactionDocument=require('./transaction-document');
const COLLECTION='pety_active_sessions',TICKETS='pety_session_tickets',PRODUCT='guizhua';
const hash=v=>crypto.createHash('sha256').update(String(v)).digest('hex');
const token=()=>crypto.randomBytes(32).toString('hex');
const failure=code=>{throw{errCode:code,errMsg:code==='pety-session-revoked'?'账号已在其他设备登录。':'登录会话需要重新确认。'};};
function mode(){const m=process.env.PETY_SINGLE_SESSION_MODE||'staged';if(!['staged','enforce','deny'].includes(m))failure('pety-session-service-unavailable');return m;}
function enabled(){return mode()!=='staged';}
const id=uid=>PRODUCT+'_'+hash(uid);
function confirmedResult(result){
 if(!result||typeof result!=='object'||Array.isArray(result))failure('pety-session-service-unavailable');
 for(const key of ['errCode','code'])if(result[key]!==undefined&&result[key]!==null&&result[key]!==0&&result[key]!=='0'&&result[key]!=='')failure('pety-session-service-unavailable');
 if(result.error)failure('pety-session-service-unavailable');
 return result;
}
const first=result=>{const r=confirmedResult(result);if(!Array.isArray(r.data)||r.data.length>1||(r.data.length&&(!r.data[0]||typeof r.data[0]!=='object'||Array.isArray(r.data[0]))))failure('pety-session-service-unavailable');return r.data[0];};
const singleton=result=>transactionDocument(confirmedResult(result));
function changedCount(result){
 confirmedResult(result);
 const counts=['updated','updatedCount','affectedDocs','modifiedCount'].filter(key=>Object.prototype.hasOwnProperty.call(result,key)).map(key=>result[key]);
 if(!counts.length||counts.some(value=>!Number.isSafeInteger(value)||value<0||value>1||value!==counts[0]))failure('pety-session-service-unavailable');
 return counts[0];
}
function sessionRow(row,uid){
 if(!row||row._id!==id(uid)||row.uid!==uid||row.product!==PRODUCT||
  !Number.isSafeInteger(row.version)||row.version<0||row.version>=Number.MAX_SAFE_INTEGER||
  !Number.isSafeInteger(row.expiresAt)||row.expiresAt<0||
  !(row.secretHash===''||/^[a-f0-9]{64}$/.test(row.secretHash))||
  (row.fence!==undefined&&(!Number.isSafeInteger(row.fence)||row.fence<0||row.fence>=Number.MAX_SAFE_INTEGER)))failure('pety-session-service-unavailable');
 return row;
}
function tokenDate(user){
 const value=user.valid_token_date;
 if(value===undefined||value===null)return 0;
 if(!Number.isSafeInteger(value)||value<0)failure('pety-session-service-unavailable');
 return value;
}
function createSessionService(db,now=()=>Date.now()){
 async function ensure(uid){let row=first(await db.collection(COLLECTION).doc(id(uid)).get());if(row)return sessionRow(row,uid);
  let created,duplicate=false;
  try{created=await db.collection(COLLECTION).add({_id:id(uid),uid,product:PRODUCT,version:0,secretHash:'',expiresAt:0,fence:0});}catch(e){if(!/duplicate|already exists|E11000|DOCUMENT_EXISTS/i.test(String(e?.code||e?.message)))throw e;duplicate=true;}
  if(!duplicate&&confirmedResult(created).id!==id(uid))failure('pety-session-service-unavailable');
  return sessionRow(first(await db.collection(COLLECTION).doc(id(uid)).get()),uid);
 }
 function check(row,uid,proof){if(!proof||typeof proof.secret!=='string'||!/^[a-f0-9]{64}$/.test(proof.secret)||!Number.isSafeInteger(proof.version)||proof.version<1)failure('pety-session-required');if(!row)failure('pety-session-revoked');sessionRow(row,uid);if(row.version!==proof.version||row.secretHash!==hash(proof.secret)||row.expiresAt<=now())failure('pety-session-revoked');return row;}
 async function transaction(run){const tx=await db.startTransaction();try{const result=await run(tx);await tx.commit();return result;}catch(e){try{await tx.rollback();}catch(_){}throw e;}}
 return {
  async beginVerified(uid){if(typeof uid!=='string'||!uid)failure('pety-session-invalid-identity');const user=first(await db.collection('uni-id-users').doc(uid).get());if(!user||(user.status||0)!==0)failure('uni-id-account-not-exists');const validTokenDate=tokenDate(user),row=await ensure(uid),secret=token(),expiresAt=now()+120000;const created=confirmedResult(await db.collection(TICKETS).add({_id:hash(secret),uid,product:PRODUCT,expectedVersion:row.version,validTokenDate,expiresAt,used:false}));if(created.id!==hash(secret))failure('pety-session-service-unavailable');return{errCode:0,petySessionChallenge:{ticket:secret,takeoverRequired:!!row.secretHash&&row.expiresAt>now(),expiresAt}};},
  async confirm(ticket,issueToken){if(!/^[a-f0-9]{64}$/.test(String(ticket)))failure('pety-session-ticket-invalid');const proof={secret:token(),version:0};let uid;
   await transaction(async tx=>{const c=tx.collection(TICKETS),t=singleton(await c.doc(hash(ticket)).get());if(!t)failure('pety-session-ticket-expired');
    if(t._id!==hash(ticket)||typeof t.uid!=='string'||!t.uid||typeof t.used!=='boolean'||!Number.isSafeInteger(t.expiresAt)||t.expiresAt<0||!Number.isSafeInteger(t.expectedVersion)||t.expectedVersion<0||!Number.isSafeInteger(t.validTokenDate)||t.validTokenDate<0)failure('pety-session-service-unavailable');
    if(t.used||t.expiresAt<=now()||t.product!==PRODUCT)failure('pety-session-ticket-expired');uid=t.uid;const user=singleton(await tx.collection('uni-id-users').doc(uid).get());if(!user||(user.status||0)!==0||tokenDate(user)!==t.validTokenDate)failure('pety-session-ticket-expired');const sessions=tx.collection(COLLECTION),row=singleton(await sessions.doc(id(uid)).get());if(!row)failure('pety-session-confirmation-stale');sessionRow(row,uid);if(row.version!==t.expectedVersion)failure('pety-session-confirmation-stale');proof.version=row.version+1;
    // The preceding transaction read and commit conflict detection guard this
    // single-document write; transaction.where().update() is unsupported.
    const changed=await sessions.doc(id(uid)).update({secretHash:hash(proof.secret),version:proof.version,issuedAt:now(),expiresAt:now()+30*86400000,fence:(row.fence||0)+1});if(changedCount(changed)!==1)failure('pety-session-confirmation-stale');if(changedCount(await c.doc(hash(ticket)).update({used:true,usedAt:now()}))!==1)failure('pety-session-service-unavailable');
   });
   // Credentials are released only after the atomic takeover. A concurrent newer
   // takeover may win while token issuance is in flight, so recheck before return.
   const result=await issueToken(uid);if(result?.errCode)throw result;confirmedResult(result);if(typeof result.token!=='string'||!result.token||!Number.isSafeInteger(result.tokenExpired)||result.tokenExpired<=now())failure('pety-session-service-unavailable');await this.validate(uid,proof);return{errCode:0,uid,petyIssuedToken:{token:result.token,tokenExpired:result.tokenExpired},petySession:proof};
  },
  async cancel(ticket){if(!/^[a-f0-9]{64}$/.test(String(ticket)))return;changedCount(await db.collection(TICKETS).where({_id:hash(ticket),used:false}).update({used:true}));},
  async validate(uid,proof){return check(first(await db.collection(COLLECTION).doc(id(uid)).get()),uid,proof);},
  async admit(uid,proof,operation=async()=>true){return transaction(async tx=>{const c=tx.collection(COLLECTION),row=check(singleton(await c.doc(id(uid)).get()),uid,proof);const r=await c.doc(id(uid)).update({fence:(row.fence||0)+1});if(changedCount(r)!==1)failure('pety-session-revoked');return operation(tx);});},
  async logout(uid,proof){if(!proof?.secret)return;changedCount(await db.collection(COLLECTION).where({_id:id(uid),version:proof.version,secretHash:hash(proof.secret)}).update({secretHash:'',expiresAt:0}));},
  async renew(uid,proof){return this.admit(uid,proof,async tx=>{if(changedCount(await tx.collection(COLLECTION).doc(id(uid)).update({expiresAt:now()+30*86400000}))!==1)failure('pety-session-service-unavailable');return true;});}
 };
}
function service(){return createSessionService(uniCloud.database());}
async function assertCurrent(uid,proof){if(!enabled())return;if(mode()==='deny')failure('pety-session-service-unavailable');return service().validate(uid,proof);}
async function admit(uid,proof,fn){if(!enabled())return fn?fn(uniCloud.database()):true;if(mode()==='deny')failure('pety-session-service-unavailable');return service().admit(uid,proof,fn);}
module.exports={enabled,mode,service,assertCurrent,admit,createSessionService,COLLECTION,TICKETS};
