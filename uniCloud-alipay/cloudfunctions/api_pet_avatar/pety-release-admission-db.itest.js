// Composition test with a synthetic session proof, not an end-to-end login.
import {createRequire} from 'node:module';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
const require=createRequire(import.meta.url);
const {createSessionService,COLLECTION}=require('../common/pety-auth/sessions.js');
const {createQuotaLedger}=require('./avatar-quota-ledger.js');
test('release session admission and quota commit atomically in the real database',async()=>{
 expect(process.env.UNICLOUD_TEST_MODE).toBe('integration');
 const uid='pety-release-admission-20261013-'+randomUUID();
 const proof={secret:randomBytes(32).toString('hex'),version:1};
 const hash=v=>createHash('sha256').update(v).digest('hex');
 await uniCloudTest.seed(async db=>{
  const target=JSON.parse(process.env.UNICLOUD_SPACE_INFO||'{}');expect(target.provider).toBe('alipay');expect(target.spaceId).toBe('env-00jy6ft635sf');
  await db.collection(COLLECTION).add({_id:'guizhua_'+hash(uid),uid,product:'guizhua',version:1,secretHash:hash(proof.secret),expiresAt:Date.now()+60000,fence:0,releaseTest:uid});
  const scope={owner:uid,pet:'synthetic-cat',pool:'free',cycle:'free-lifetime'};
  const col=db.collection('pety_avatar_quota_ledgers'),replace=v=>db.command.set(v);
  const normal=createQuotaLedger(col,async()=>[],replace);await normal.read(scope);
  const service=createSessionService(db);
  await service.admit(uid,proof,async tx=>{
   const memberships=await tx.collection('pety_memberships').where({userId:uid,status:'active'}).limit(1).get();
   expect(memberships.data).toEqual([]);
   const quota=createQuotaLedger(tx.collection('pety_avatar_quota_ledgers'),async()=>{throw Error('EXISTING_LEDGER_MUST_NOT_RESEED');},replace,{transactional:true});
   expect((await quota.reserve(scope,'request_once')).fresh).toBe(true);
  });
  expect(await normal.read(scope)).toEqual({used:0,reserved:1});
  await service.logout(uid,proof);
  await expect(service.admit(uid,proof,async tx=>createQuotaLedger(tx.collection('pety_avatar_quota_ledgers'),async()=>[],replace,{transactional:true}).reserve(scope,'must_not_reserve'))).rejects.toMatchObject({errCode:'pety-session-revoked'});
  expect(await normal.read(scope)).toEqual({used:0,reserved:1});
 });
 console.info('PETY_RELEASE_ADMISSION_DB_RESULT',JSON.stringify({pass:true,testRows:2,realTokensIssued:0,providerCalls:0,deletedRows:0,verification:'real-database-session-and-quota-composition'}));
},60000);
