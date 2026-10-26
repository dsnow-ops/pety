// Storage-level recovery checks against the authorized test DB. No client login,
// remote handler, provider task, image download, SMS or payment is performed.
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import vm from 'node:vm';
const require=createRequire(import.meta.url);

test('release real DB: active-job CAS and receipt recovery survive isolated runtime restart',async()=>{
 expect(process.env.UNICLOUD_TEST_MODE).toBe('integration');
 const marker='pety-release-recovery-'+randomUUID();
 const ownerA=marker+'-A',ownerB=marker+'-B',pet=marker+'-pet',session=marker+'-session';
 let operations=0,providerAttempts=0;
 await uniCloudTest.seed(async db=>{
  const target=JSON.parse(process.env.UNICLOUD_SPACE_INFO||'{}');
  expect(target.provider).toBe('alipay');expect(target.spaceId).toBe('env-00jy6ft635sf');
  const allowedIds=new Set();
  const real=db.collection('pet_avatar_jobs');
  const count=()=>{if(++operations>65)throw Error('TEST_OPERATION_BUDGET');};
  const check=filter=>{
   if(filter._id ? !allowedIds.has(filter._id) : filter.petHash!==pet||![ownerA,ownerB].includes(filter.quotaOwnerHash))throw Error('TEST_SCOPE_VIOLATION');
   count();
  };
  const scoped={
   async add(row){check({_id:row._id});if(![ownerA,ownerB].includes(row.quotaOwnerHash)||row.petHash!==pet)throw Error('TEST_SCOPE_VIOLATION');return real.add({...row,releaseTest:marker});},
   doc(id){return {async get(){check({_id:id});return real.doc(id).get();}};},
   where(filter){return {
    async get(){check(filter);return real.where(filter).get();},
    async update(patch){check(filter);if(patch.quotaOwnerHash&&! [ownerA,ownerB].includes(patch.quotaOwnerHash))throw Error('TEST_SCOPE_VIOLATION');return real.where(filter).update(patch);}
   };}
  };
  const blocked=new Proxy({}, {get:()=>()=>{providerAttempts++;throw Error('PROVIDER_DISABLED_IN_STORAGE_TEST');}});
  const runtime=()=>{
   const module={exports:{}};
   const localRequire=name=>['./wan-client','./storage','./avatar-cutout-provider'].includes(name)?blocked:require(name);
   vm.runInNewContext(readFileSync(new URL('./index.js',import.meta.url),'utf8'),{
    module,exports:module.exports,require:localRequire,Buffer,console,process,
    uniCloud:{database:()=>({command:db.command,collection:name=>{if(name!=='pet_avatar_jobs')throw Error('TEST_COLLECTION_VIOLATION');return scoped;}})}
   },{filename:'release-actual-avatar-index.js'});
   return module.exports.__test;
  };
  const first=runtime(),second=runtime();
  const a=first.getAvatarJobLockId(pet,ownerA),b=first.getAvatarJobLockId(pet,ownerB),candidate=marker+'-candidate';
  [a,b,candidate,'active_'+pet].forEach(id=>allowedIds.add(id));
  const lock={petHash:pet,quotaOwnerHash:ownerA,generationSessionId:session,jobKind:'initial',status:'CREATING',updatedAt:1};
  expect((await Promise.all([first.acquireAvatarJobLock(a,null,lock),second.acquireAvatarJobLock(a,null,lock)])).sort()).toEqual([false,true]);
  expect(await first.acquireAvatarJobLock(b,null,{...lock,quotaOwnerHash:ownerB})).toBe(true);
  await scoped.add({_id:candidate,recordType:'candidate',...lock,status:'PENDING',jobId:'inert-provider-receipt',requestId:'inert-request',seed:7,createdAt:2});
  const saved=await first.getJobDocument(pet,ownerA);
  expect(saved._id).toBe(a);
  const recovered=await Promise.all([first,second].map(api=>api.recoverActiveAvatarJob(saved,a,pet,session,ownerA,'initial')));
  recovered.forEach(result=>expect(result).toMatchObject({code:0,jobId:'inert-provider-receipt',resumed:true,taskStatus:'PENDING'}));
  expect(await second.recoverActiveAvatarJob(saved,a,pet,session,ownerB,'initial')).toBeNull();
  expect(await second.recoverActiveAvatarJob(saved,a,pet,session+'-wrong',ownerA,'initial')).toBeNull();
  const restarted=runtime(),current=await restarted.getJobDocument(pet,ownerA);
  expect(current.jobId).toBe('inert-provider-receipt');
  expect(await restarted.updateActiveAvatarJob({...current,quotaOwnerHash:ownerB},{status:'FAILED'})).toBe(false);
  expect(await restarted.updateActiveAvatarJob(current,{status:'SUCCEEDED',updatedAt:Date.now()})).toBe(true);
  expect(await first.updateActiveAvatarJob(current,{status:'FAILED',updatedAt:Date.now()})).toBe(false);
  expect(await first.acquireAvatarJobLock(a,saved,lock)).toBe(false);
  expect((await restarted.getJobDocument(pet,ownerA)).status).toBe('SUCCEEDED');
  expect((await restarted.getJobDocument(pet,ownerB)).status).toBe('CREATING');
  expect(providerAttempts).toBe(0);
 });
 console.info('PETY_RELEASE_JOB_RECOVERY_DB_RESULT',JSON.stringify({pass:true,operations,testRows:3,deletedRows:0,providerAttempts,verification:'production-recovery-helpers-with-real-test-database-and-disabled-providers'}));
},60000);
