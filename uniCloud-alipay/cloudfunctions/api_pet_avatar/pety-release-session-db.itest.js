// Storage/transaction contract only. Token issuance is an inert test double;
// this cannot establish a logged-in client or change runtime enforcement mode.
import { createRequire } from 'node:module';
import { randomUUID, createHash } from 'node:crypto';
const require=createRequire(import.meta.url);
const {createSessionService,COLLECTION,TICKETS}=require('../common/pety-auth/sessions.js');

test('release isolated session storage: takeover, stale logout and concurrent confirmation',async()=>{
 expect(process.env.UNICLOUD_TEST_MODE).toBe('integration');
 expect(process.env.UNICLOUD_TEST_PROVIDER).toBe('alipay');
 const uid='pety-release-session-20261013-'+randomUUID();
 const sessionId='guizhua_'+createHash('sha256').update(uid).digest('hex');
 const ticketIds=new Set();let operations=0,issued=0;
 await uniCloudTest.seed(async real=>{
  const target=JSON.parse(process.env.UNICLOUD_SPACE_INFO||'{}');
  expect(target.provider).toBe('alipay');expect(target.spaceId).toBe('env-00jy6ft635sf');
  const count=()=>{if(++operations>100)throw Error('TEST_OPERATION_BUDGET');};
  // No password, contact, role, or valid token. A synthetic storage fixture only.
  count();await real.collection('uni-id-users').add({_id:uid,status:0,token:[],releaseTest:uid});
  function adapter(raw,transaction=false){return {collection(name){
   if(!['uni-id-users',COLLECTION,TICKETS].includes(name))throw Error('TEST_SCOPE_VIOLATION');
   const col=raw.collection(name);
   const check=id=>{if(name==='uni-id-users'?id!==uid:name===COLLECTION?id!==sessionId:!ticketIds.has(id))throw Error('TEST_SCOPE_VIOLATION');};
   return {
    doc(id){check(id);return {get:async()=>{count();const result=await col.doc(id).get();if(!Array.isArray(result?.data))console.info('PETY_RELEASE_DB_SHAPE',JSON.stringify({table:name,transaction,shape:result?.data===null?'null':typeof result?.data,operations}));return result;},update:async patch=>{count();return col.doc(id).update(patch);}};},
    where(q){check(q._id);return {update:async patch=>{count();return col.where(q).update(patch);}};},
    async add(row){if(row.uid!==uid||name==='uni-id-users')throw Error('TEST_SCOPE_VIOLATION');if(name===TICKETS)ticketIds.add(row._id);else check(row._id);count();return col.add({...row,releaseTest:uid});}
   };
  },async startTransaction(){count();const tx=await raw.startTransaction();return {...adapter(tx,true),commit:async()=>{count();return tx.commit();},rollback:async()=>{count();return tx.rollback();}};}};}
  const service=createSessionService(adapter(real));
  const issue=async identity=>{expect(identity).toBe(uid);issued++;return{errCode:0,token:'INERT_TEST_NON_CREDENTIAL',tokenExpired:Date.now()+60000};};
  const login=async()=>service.confirm((await service.beginVerified(uid)).petySessionChallenge.ticket,issue);
  const a=await login();await service.validate(uid,a.petySession);
  const b=await login();
  await expect(service.validate(uid,a.petySession)).rejects.toMatchObject({errCode:'pety-session-revoked'});
  await expect(service.renew(uid,a.petySession)).rejects.toMatchObject({errCode:'pety-session-revoked'});
  await service.logout(uid,a.petySession);await service.validate(uid,b.petySession);
  expect(b.petySession.version).toBe(2);
  const t1=(await service.beginVerified(uid)).petySessionChallenge.ticket;
  const t2=(await service.beginVerified(uid)).petySessionChallenge.ticket;
  const results=await Promise.allSettled([service.confirm(t1,issue),service.confirm(t2,issue)]);
  const winners=results.filter(r=>r.status==='fulfilled');expect(winners.length).toBe(1);
  await service.validate(uid,winners[0].value.petySession);
  await expect(service.validate(uid,b.petySession)).rejects.toMatchObject({errCode:'pety-session-revoked'});
 });
 console.info('PETY_RELEASE_SESSION_DB_RESULT',JSON.stringify({pass:true,operations,syntheticUsers:1,sessionRows:1,ticketRows:ticketIds.size,inertIssuances:issued,realTokensIssued:0,deletedRows:0,verification:'real-database-session-storage-only'}));
},60000);
