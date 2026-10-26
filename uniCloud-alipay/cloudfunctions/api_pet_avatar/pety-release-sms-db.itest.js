// Tests budget storage only: no SMS API, phone verification or code generation.
import { createRequire } from 'node:module';
import { randomUUID, createHash } from 'node:crypto';
const require=createRequire(import.meta.url);
const {createSmsBudget,COLLECTION}=require('../common/pety-auth/sms-budget.js');
test('release isolated SMS budget: real transaction and cooldown with zero sends',async()=>{
 expect(process.env.UNICLOUD_TEST_MODE).toBe('integration');
 const prefix='pety-release-sms-20261013-'+randomUUID()+'_';let operations=0,created=0;
 await uniCloudTest.seed(async real=>{
  const target=JSON.parse(process.env.UNICLOUD_SPACE_INFO||'{}');expect(target.provider).toBe('alipay');expect(target.spaceId).toBe('env-00jy6ft635sf');
  const count=()=>{if(++operations>70)throw Error('TEST_OPERATION_BUDGET');};
  const key=id=>{if(typeof id!=='string'||!/^(cooldown_|phone_hour_|phone_day_|ip_hour_|global_day_)[a-z0-9_]+$/.test(id))throw Error('TEST_SCOPE_VIOLATION');return createHash('sha256').update(prefix+id).digest('hex');};
  function adapter(raw){return {collection(name){if(name!==COLLECTION)throw Error('TEST_SCOPE_VIOLATION');const c=raw.collection(name);return{
   doc(id){const physical=key(id);return {get:async()=>{count();return c.doc(physical).get();},update:async patch=>{count();return c.doc(physical).update(patch);}};},
   async add(row){count();const result=await c.add({...row,_id:key(row._id),releaseTest:prefix});created++;return result;}
  };},async startTransaction(){count();const tx=await raw.startTransaction();return{...adapter(tx),commit:async()=>{count();return tx.commit();},rollback:async()=>{count();return tx.rollback();}};}};}
  const db=adapter(real), now=Date.now(),request={mobile:'synthetic-not-a-phone',clientIP:'synthetic-not-an-ip'};
  const budget=createSmsBudget(db,{},()=>now);
  expect(await budget.reserve(request)).toEqual({reserved:true});
  await expect(createSmsBudget(db,{},()=>now+1000).reserve(request)).rejects.toMatchObject({errCode:'pety-sms-rate-limit'});
  expect(await createSmsBudget(db,{},()=>now+61000).reserve(request)).toEqual({reserved:true});
 });
 console.info('PETY_RELEASE_SMS_DB_RESULT',JSON.stringify({pass:true,operations,testRows:created,smsSent:0,otpGenerated:0,deletedRows:0,verification:'real-database-namespaced-budget-storage-only'}));
},60000);
