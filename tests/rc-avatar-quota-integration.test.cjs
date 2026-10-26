const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {createRequire}=require('node:module');
const file=path.resolve('uniCloud-alipay/cloudfunctions/api_pet_avatar/index.js'),load=createRequire(file);
async function setup(mode='pending',faults={}){
 const tables=new Map();let calls=0,saveAttempts=0;const polls=[];
 const copy=value=>JSON.parse(JSON.stringify(value));
 const db={command:{set:value=>({replacement:value})},collection(name){
  if(!tables.has(name))tables.set(name,new Map());const rows=tables.get(name);
  const patch=(row,data)=>{
   for(const [k,v] of Object.entries(data))if(row[k]===null&&v&&typeof v==='object'&&!Object.hasOwn(v,'replacement'))throw Object.assign(Error(`Cannot create field in null ${k}`),{errCode:100104});
   Object.assign(row,Object.fromEntries(Object.entries(data).map(([k,v])=>[k,v&&Object.hasOwn(v,'replacement')?v.replacement:v])));
  };
  return{doc:id=>({get:async()=>{const normal={data:rows.has(id)?[copy(rows.get(id))]:[]};return faults.read?faults.read(normal,{name,id,kind:'doc'}):normal},set:async value=>rows.set(id,{_id:id,...copy(value)}),update:async value=>{patch(rows.get(id),value);return{updated:1}}}),
   add:async value=>{if(rows.has(value._id))throw Error('E11000 duplicate');rows.set(value._id,copy(value));return faults.add?faults.add({id:value._id},{name,value}):{id:value._id}},
   where(query){let skip=0,limit=100;const matches=row=>Object.entries(query).every(([k,v])=>row[k]===v);const q={
    field(){return q},skip(value){skip=value;return q},limit(value){limit=value;return q},
    get:async()=>{const normal={data:[...rows.values()].filter(matches).slice(skip,skip+limit).map(copy)};return faults.read?faults.read(normal,{name,query,kind:'where'}):normal},
    update:async data=>{const found=[...rows.values()].filter(matches);found.forEach(row=>patch(row,data));return faults.update?faults.update({updated:found.length},{name,query,data}):{updated:found.length}}
   };return q;}
  };
 }};
 if(mode==='member')db.collection('pety_memberships').add({_id:'member',userId:'A',status:'active',plan:'plus',startedAt:1});
 if(mode==='paid'){
  const key='paid_'+require('node:crypto').createHash('sha256').update('A').digest('hex');
  db.collection('pety_membership_schedules').add({_id:key,userId:'A',periods:{['a'.repeat(24)]:{
   orderId:'isolated-order',cycleKey:'a'.repeat(24),plan:'plus',limit:10,startsAt:Date.now()-1000,endsAt:Date.now()+60000,state:'scheduled'
  }}});
 }
 const module={exports:{}};
 vm.runInNewContext(fs.readFileSync(file,'utf8'),{module,exports:module.exports,__dirname:path.dirname(file),process:{...process,env:{...process.env,PETY_PAID_MEMBERSHIP_ENABLED:mode==='paid'?'true':'false'}},Buffer,console:{info(){},warn(){},error(){}},uniCloud:{database:()=>db},require:n=>{
  if(n==='pety-auth')return{verifyRequest:async()=>({uid:'A'})};
  if(n==='pety-auth/cost-budget')return{reserve:async input=>{assert.equal(input.uid,'A');assert.equal(input.feature,'avatar');}};
  if(n==='pety-membership-orders/effective-membership')return require('../uniCloud-alipay/cloudfunctions/common/pety-membership-orders/effective-membership');
  if(n==='./storage')return{...load(n),inspectUploadedSource:async()=>({sha256:'a'.repeat(64),mime:'image/jpeg',width:100,height:100,bytes:1024}),getProviderImageInputs:async()=>['data:image/jpeg;base64,isolated'],
   getTempUrls:async()=>['https://test.invalid/generated'],persistGeneratedImage:async()=>{saveAttempts++;if(mode==='save-fails-once'&&saveAttempts===1)throw Object.assign(Error('storage outage'),{code:'RESULT_SAVE_FAILED'});return{generatedFileId:'cloud://test/generated',generatedThumbnailFileId:'cloud://test/thumb',generatedCandidateSha256:'test',styleReferenceSha256:'style',mainAssetMetadata:{width:2048,height:2048}};}};
  if(n==='./wan-client')return{...load(n),getWanTask:()=>{if(faults.poll){polls.push('unexpected-poll');return Promise.resolve(faults.poll())}return new Promise(resolve=>polls.push(resolve))},createWanTask:async()=>{calls++;if(mode==='timeout')throw Error('WAN_REQUEST_TIMEOUT');if(mode==='rejected')throw Object.assign(Error('rejected'),{code:'WAN_REQUEST_FAILED',statusCode:400});return{taskId:`task-${calls}`,taskStatus:'PENDING'};}};
  return load(n);
 }});
 const api=module.exports.__test,context=await api.authorizeAvatarContext({uniIdToken:'isolated'},{});
 const config={apiKey:'isolated',workspaceId:'isolated',region:'cn-beijing',model:'wan2.7-image-pro',size:'2K',n:1,watermark:false,maxSourceImages:3,styleReferenceFileId:'cloud://test/style',isDevelopment:false};
 const event=petId=>({petId,operationId:`operation-${petId}`,generationSessionId:`session-${petId}`,jobKind:'initial',sourceFileIds:['cloud://test/source'],aiConsentAccepted:true,aiConsentVersion:1,aiConsentScopes:['pet_avatar']});
 return{api,tables,polls,calls:()=>calls,run:async(pet,operationId,overrides={})=>{
  const e={...event(pet),...(operationId?{operationId}:{}),...overrides};
  const ticket=await api.issueSourceUpload({...e,batchId:`batch-${pet}`,slot:0},config,context);
  const receipt=await api.completeSourceUpload({...e,ticketId:ticket.ticketId,fileId:`cloud://test/${ticket.cloudPath}`},context);
  return api.createJob({...e,sourceFileIds:[receipt.fileId]},config,context);
 },poll:(pet,jobId)=>api.getJobStatus({...event(pet),jobId},config,context)};
}
const databaseUnavailable=e=>e.code==='AVATAR_DATABASE_UNAVAILABLE';

test('actual source upload entry stops on malformed reads and unconfirmed insertion before any provider work',async()=>{
 for(const fault of ['read','add']){let enabled=true;const s=await setup('pending',{
  read:(normal,ctx)=>enabled&&fault==='read'&&ctx.name==='pety_avatar_source_receipts'?{data:[],errCode:'TEST_ERROR'}:normal,
  add:(normal,ctx)=>enabled&&fault==='add'&&ctx.name==='pety_avatar_source_receipts'?{}:normal
 });await assert.rejects(s.run('source-'+fault),databaseUnavailable);assert.equal(s.calls(),0);assert.equal(s.tables.get('pety_avatar_source_receipts').size,fault==='read'?0:1);enabled=false;await s.run('source-'+fault);assert.equal(s.calls(),1);assert.equal(s.tables.get('pety_avatar_source_receipts').size,1);}
});

test('actual source completion with an unknown write receipt recovers the same ready source before one provider submission',async()=>{
 let enabled=true;const s=await setup('pending',{update:(normal,ctx)=>enabled&&ctx.name==='pety_avatar_source_receipts'?{updated:1,updatedCount:0}:normal});
 await assert.rejects(s.run('source-complete'),databaseUnavailable);assert.equal(s.calls(),0);const original=[...s.tables.get('pety_avatar_source_receipts').values()][0];assert.equal(original.state,'ready');enabled=false;await s.run('source-complete');assert.equal(s.calls(),1);assert.equal(s.tables.get('pety_avatar_source_receipts').size,1);assert.equal([...s.tables.get('pety_avatar_source_receipts').values()][0].fileId,original.fileId);
});

test('avatar history errors cannot seed an empty allowance or reach the provider',async()=>{
 for(const response of [{data:[],errCode:'TEST_DB_ERROR'},{data:[null]},{}]){
  const s=await setup('pending',{read:(normal,ctx)=>ctx.name==='pet_avatar_jobs'&&ctx.kind==='where'&&ctx.query.entitlementPool?response:normal});
  await assert.rejects(s.run('history-seed-fault'),databaseUnavailable);assert.equal(s.calls(),0);assert.equal(s.tables.get('pety_avatar_quota_ledgers').size,0);
 }
});

test('avatar cannot submit from an unconfirmed quota insert or errored quota read',async()=>{
 for(const response of [undefined,{}, {id:'wrong'},{errCode:'TEST_DB_ERROR'}]){
  const s=await setup('pending',{add:(normal,ctx)=>ctx.name==='pety_avatar_quota_ledgers'?response:normal});
  await assert.rejects(s.run('quota-insert-fault'),{code:'AVATAR_QUOTA_STATE_INVALID'});assert.equal(s.calls(),0);
  assert.ok([...s.tables.get('pety_avatar_quota_ledgers').values()].every(row=>Object.keys(row.entries).length===0));
 }
 const s=await setup('pending',{read:(normal,ctx)=>ctx.name==='pety_avatar_quota_ledgers'?{data:[],errCode:'TEST_DB_ERROR'}:normal});
 await assert.rejects(s.run('quota-read-fault'),{code:'AVATAR_QUOTA_STATE_INVALID'});assert.equal(s.calls(),0);
});

test('unknown quota reservation acknowledgement retains one occupied slot and zero provider submissions on replay',async()=>{
 for(const response of [{},{updated:'1'},{updated:1,errCode:'TEST_DB_ERROR'},{updated:0,affectedDocs:1}]){
  const s=await setup('pending',{update:(normal,ctx)=>ctx.name==='pety_avatar_quota_ledgers'?response:normal});
  await assert.rejects(s.run('quota-write-fault'),{code:'AVATAR_QUOTA_STATE_INVALID'});assert.equal(s.calls(),0);
  await assert.rejects(s.run('quota-write-fault'));assert.equal(s.calls(),0);
  assert.deepEqual(Object.values([...s.tables.get('pety_avatar_quota_ledgers').values()][0].entries),['reserved']);
 }
});
test('avatar operation lookup faults stop before a task lock, quota reservation or provider call',async()=>{
 for(const result of [{},{data:[],errCode:'TEST_PRIVATE_DB_ERROR'},{data:[null]}]){
  const s=await setup('pending',{read:(normal,ctx)=>ctx.name==='pet_avatar_jobs'&&ctx.kind==='where'&&ctx.query.operationId?result:normal});
  await assert.rejects(s.run('db-fault-cat'),databaseUnavailable);assert.equal(s.calls(),0);assert.equal(s.tables.get('pet_avatar_jobs').size,0);assert.equal(s.tables.get('pety_avatar_quota_ledgers')?.size||0,0);
 }
});
test('avatar active lookup failure never falls through to a legacy lock or a new paid task',async()=>{
 let reads=0;const s=await setup('pending',{read:(normal,ctx)=>{if(ctx.name==='pet_avatar_jobs'&&ctx.kind==='doc'){reads++;return{data:[],errCode:'TEST_PRIVATE_DB_ERROR'}}return normal}});
 await assert.rejects(s.run('active-fault-cat'),databaseUnavailable);assert.equal(reads,1);assert.equal(s.calls(),0);
});
test('unconfirmed avatar lock creation stops paid work and a later request cannot blindly reuse the uncertain lock',async()=>{
 for(const result of [undefined,{}, {id:'wrong'},{errCode:'TEST_PRIVATE_DB_ERROR'}]){
  const s=await setup('pending',{add:(normal,ctx)=>ctx.name==='pet_avatar_jobs'?result:normal});
  await assert.rejects(s.run('create-fault-cat'),databaseUnavailable);assert.equal(s.calls(),0);assert.ok([...(s.tables.get('pety_avatar_quota_ledgers')?.values()||[])].every(row=>Object.keys(row.entries||{}).length===0));
  assert.equal([...s.tables.get('pet_avatar_jobs').values()][0].status,'CREATING');
  await assert.rejects(s.run('create-fault-cat'),e=>e.code==='ACTIVE_JOB_EXISTS');assert.equal(s.calls(),0);
 }
});
test('ambiguous avatar replacement acknowledgements cannot dispatch a second provider request',async()=>{
 for(const result of [{updated:'1'},{updated:1,errCode:'TEST_PRIVATE_DB_ERROR'},{updated:0,affectedDocs:1},{}]){
  let fault=false;const s=await setup('rejected',{update:(normal,ctx)=>fault&&ctx.name==='pet_avatar_jobs'?result:normal});
  await assert.rejects(s.run('replace-fault-cat'));assert.equal(s.calls(),1);fault=true;
  await assert.rejects(s.run('replace-fault-cat','new-operation-replace'),databaseUnavailable);assert.equal(s.calls(),1);
 }
});
test('avatar status does not reconstruct missing history from an errored history read or poll the provider',async()=>{
 let fault=false,adds=0;const s=await setup('pending',{poll:()=>({output:{task_status:'FAILED'}}),read:(normal,ctx)=>fault&&ctx.name==='pet_avatar_jobs'&&ctx.kind==='doc'&&ctx.id.startsWith('job_')?{data:[],errCode:'TEST_PRIVATE_DB_ERROR'}:normal,add:(normal,ctx)=>{if(fault&&ctx.name==='pet_avatar_jobs')adds++;return normal}});
 await s.run('history-fault-cat');fault=true;
 await assert.rejects(s.poll('history-fault-cat','task-1'),databaseUnavailable);assert.equal(s.polls.length,0);assert.equal(adds,0);assert.equal(s.calls(),1);
});
test('avatar incomplete lock recovery rejects a corrupt candidate list instead of reporting no task',async()=>{
 const s=await setup('pending',{read:(normal,ctx)=>ctx.name==='pet_avatar_jobs'?{data:null}:normal});
 const active={_id:'TEST-active',petHash:'pet',quotaOwnerHash:'owner',generationSessionId:'session',jobKind:'initial',status:'CREATING'};
 await assert.rejects(s.api.recoverActiveAvatarJob(active,active._id,'pet','session','owner','initial'),databaseUnavailable);assert.equal(s.calls(),0);
});

test('real createJob path reserves shared member allowance before dispatching concurrent pets',async()=>{
 const s=await setup('member');const r=await Promise.allSettled(Array.from({length:12},(_,i)=>s.run(`pet-${i}`)));
 assert.equal(r.filter(v=>v.status==='fulfilled').length,10);assert.equal(s.calls(),10);
 assert.ok(r.filter(v=>v.status==='rejected').every(v=>v.reason.code==='AVATAR_QUOTA_EXCEEDED'));
});

test('new tasks clear old provider receipts and completed operation replays resolve owned history without charging again',async()=>{
 const s=await setup();await s.run('history-cat');const first=s.poll('history-cat','task-1');
 while(!s.polls.length)await new Promise(resolve=>setImmediate(resolve));
 s.polls[0]({output:{task_status:'SUCCEEDED',choices:[{message:{content:[{type:'image',image:'https://test.invalid/first'}]}}]}});await first;
 await s.run('history-cat','operation-two');
 const active=[...s.tables.get('pet_avatar_jobs').values()].find(r=>!r.recordType);
 assert.equal(active.providerSucceeded,false);assert.equal(active.providerResultUrl,'');
 const second=s.poll('history-cat','task-2');while(s.polls.length<2)await new Promise(resolve=>setImmediate(resolve));
 s.polls[1]({output:{task_status:'SUCCEEDED',choices:[{message:{content:[{type:'image',image:'https://test.invalid/second'}]}}]}});await second;
 assert.equal((await s.run('history-cat')).jobId,'task-1');assert.equal(s.calls(),2);
 assert.equal((await s.poll('history-cat','task-1')).status,'SUCCEEDED');assert.equal(s.polls.length,2);
 const old=[...s.tables.get('pet_avatar_jobs').values()].find(r=>r.recordType==='candidate'&&r.jobId==='task-1');
 old.confirmed=true;old.finalFileId='cloud://test/final-master';old.generatedFileId='';old.generatedThumbnailFileId='';
 assert.equal((await s.poll('history-cat','task-1')).generatedFileId,'cloud://test/final-master');assert.equal(s.polls.length,2);
 old.candidateStatus='discarded';await assert.rejects(s.poll('history-cat','task-1'),e=>e.code==='AVATAR_RESULT_NOT_READY');
 await assert.rejects(s.run('history-cat',undefined,{seed:123}),e=>e.code==='AVATAR_REQUEST_CONFLICT');
 assert.equal(s.calls(),2);assert.equal(active.jobId,'task-2');assert.equal(active.status,'SUCCEEDED');
 const ledger=[...s.tables.get('pety_avatar_quota_ledgers').values()][0];assert.deepEqual(Object.values(ledger.entries),['consumed','consumed']);
});

test('paid order cycle reaches actual createJob quota ledger without borrowing free or legacy pools',async()=>{
 const s=await setup('paid');const results=await Promise.allSettled(Array.from({length:11},(_,i)=>s.run(`paid-${i}`)));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,10);assert.equal(s.calls(),10);
 const rows=[...s.tables.get('pet_avatar_jobs').values()];
 assert.ok(rows.every(r=>r.entitlementPool==='member'&&r.entitlementCycleKey==='a'.repeat(24)));
 assert.equal([...s.tables.get('pety_avatar_quota_ledgers').values()].length,1);
});
test('unknown submission never releases allowance or blindly retries after lock age',async()=>{
 const s=await setup('timeout');await assert.rejects(s.run('cat'),e=>e.code==='WAN_SUBMISSION_UNCERTAIN');
 const lock=[...s.tables.get('pet_avatar_jobs').values()].find(r=>r.status==='SUBMISSION_UNKNOWN');assert.ok(lock);lock.updatedAt=1;
 await assert.rejects(s.run('cat'),e=>e.code==='WAN_SUBMISSION_UNCERTAIN');assert.equal(s.calls(),1);
 const ledger=[...s.tables.get('pety_avatar_quota_ledgers').values()][0];assert.equal(Object.values(ledger.entries).filter(v=>v==='reserved').length,1);
});
test('definite provider refusal releases quota and repeat attempt does not consume success count',async()=>{
 const s=await setup('rejected');await assert.rejects(s.run('cat'));await assert.rejects(s.run('cat'));assert.equal(s.calls(),2);
 const ledger=[...s.tables.get('pety_avatar_quota_ledgers').values()][0];assert.deepEqual(ledger.entries,{});
});
test('stale failed poll cannot release a consumed slot or overwrite successful candidate',async()=>{
 const s=await setup();await s.run('cat');const success=s.poll('cat','task-1'),failure=s.poll('cat','task-1');
 while(s.polls.length<2)await new Promise(resolve=>setImmediate(resolve));
 s.polls[0]({output:{task_status:'SUCCEEDED',choices:[{message:{content:[{type:'image',image:'https://test.invalid/master'}]}}]}});await success;
 s.polls[1]({output:{task_status:'FAILED',code:'provider-failed'}});
 await assert.rejects(failure,e=>e.code==='AVATAR_JOB_STATE_CHANGED');
 const ledger=[...s.tables.get('pety_avatar_quota_ledgers').values()][0];assert.deepEqual(Object.values(ledger.entries),['consumed']);
 const candidate=[...s.tables.get('pet_avatar_jobs').values()].find(v=>v.recordType==='candidate');assert.equal(candidate.status,'SUCCEEDED');
 // Transport retry reuses the completed operation; deliberate new operation creates another task.
 assert.equal((await s.run('cat')).jobId,'task-1');assert.equal(s.calls(),1);
 assert.equal((await s.run('cat','new-operation-cat')).jobId,'task-2');assert.equal(s.calls(),2);
 const active=[...s.tables.get('pet_avatar_jobs').values()].find(v=>!v.recordType);assert.equal(active.generatedFileId,'');assert.equal(active.resultSaved,false);
});
test('persisted terminal failure cannot be repolled into an uncharged success',async()=>{
 const s=await setup();await s.run('cat');const p=s.poll('cat','task-1');
 while(!s.polls.length)await new Promise(resolve=>setImmediate(resolve));
 s.polls[0]({output:{task_status:'FAILED'}});await p;
 assert.equal((await s.poll('cat','task-1')).status,'FAILED');assert.equal(s.polls.length,1);
 const ledger=[...s.tables.get('pety_avatar_quota_ledgers').values()][0];assert.deepEqual(ledger.entries,{});
});

test('accepted provider success with a storage outage keeps quota reserved and recovers the same output without another submission',async()=>{
 const s=await setup('save-fails-once');await s.run('storage-cat');const first=s.poll('storage-cat','task-1');
 while(!s.polls.length)await new Promise(resolve=>setImmediate(resolve));
 s.polls[0]({output:{task_status:'SUCCEEDED',choices:[{message:{content:[{type:'image',image:'https://test.invalid/master'}]}}]}});
 const pending=await first;assert.equal(pending.status,'PENDING');assert.equal(pending.resultStoragePending,true);
 const ledger=[...s.tables.get('pety_avatar_quota_ledgers').values()][0];assert.deepEqual(Object.values(ledger.entries),['reserved']);
 assert.equal((await s.run('storage-cat','deliberate-new-operation')).jobId,'task-1');assert.equal(s.calls(),1);
 const recovered=await s.poll('storage-cat','task-1');assert.equal(recovered.status,'SUCCEEDED');assert.equal(s.calls(),1);assert.equal(s.polls.length,1);
 assert.deepEqual(Object.values(ledger.entries),['consumed']);
});

test('a late provider failure while renewing accepted output cannot release the reservation or enable another paid task',async()=>{
 const s=await setup('save-fails-once');await s.run('renew-cat');const first=s.poll('renew-cat','task-1');
 while(!s.polls.length)await new Promise(resolve=>setImmediate(resolve));
 s.polls[0]({output:{task_status:'SUCCEEDED',choices:[{message:{content:[{type:'image',image:'https://test.invalid/master'}]}}]}});await first;
 const active=[...s.tables.get('pet_avatar_jobs').values()].find(r=>!r.recordType);active.refreshProviderResult=true;
 const renewal=s.poll('renew-cat','task-1');while(s.polls.length<2)await new Promise(resolve=>setImmediate(resolve));
 s.polls[1]({output:{task_status:'FAILED',code:'late-failure'}});
 assert.equal((await renewal).status,'PENDING');
 const ledger=[...s.tables.get('pety_avatar_quota_ledgers').values()][0];assert.deepEqual(Object.values(ledger.entries),['reserved']);
 assert.equal((await s.run('renew-cat','different-operation')).jobId,'task-1');assert.equal(s.calls(),1);
});
