const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),crypto=require('node:crypto');
const {createRequire}=require('node:module');
const file=path.resolve('uniCloud-alipay/cloudfunctions/api_pet_avatar/index.js');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
function setup(mode='valid'){
 let verifies=0,dbReads=0,signed=0,configs=0;const queries=[];
 const record={recordType:'candidate',petHash:hash('cat').slice(0,24),jobId:'job',quotaOwnerHash:hash('uid:A'),confirmed:true,finalFileId:'cloud://test/final'};
 const module={exports:{}},load=createRequire(file);
 const collection={where(q){
  queries.push(q);
  return {limit:()=>({get:async()=>({data:Object.entries(q).every(([k,v])=>record[k]===v)?[record]:[]})})};
 }};
 const cloud={getCurrentUserInfo:()=>({uid:'forged'}),database:()=>{dbReads++;return{collection:()=>collection}}};
 const auth={verifyRequest:async(event,context)=>{verifies++;if(mode==='expired')throw{errCode:'uni-id-token-expired'};if(mode==='offline')throw Error('auth offline');if(!event.uniIdToken)return{uid:null};context.uid='ambient-changed';return{uid:event.uniIdToken==='token-A'?'A':'B'}}};
 vm.runInNewContext(fs.readFileSync(file,'utf8'),{module,exports:module.exports,__dirname:path.dirname(file),process:{env:{},version:process.version},Buffer,console:{info(){},warn(){},error(){}},uniCloud:cloud,require:n=>n==='pety-auth'?auth:n==='fs'?{...fs,existsSync:()=>{configs++;return false}}:n==='./storage'?{...load(n),getTempUrls:async files=>{signed++;return files.map(()=> 'https://test.invalid/image')}}:load(n)});
 return{api:module.exports,record,queries,counts:()=>({verifies,dbReads,signed,configs})};
}
const business=['createJob','getJobStatus','getEntitlement','confirmAvatar','startAvatarCutout','getAvatarCutoutStatus','getAvatarDisplayUrls','getCandidateDisplayUrls','prepareHeroDisplay','retryAvatarCleanup','getGenerationSession','submitAvatarFeedback','issueSourceUpload','completeSourceUpload'];
test('every business action rejects forged guest context before config, database, or provider work',async()=>{
 const s=setup();for(const action of business){const r=await s.api.main({action,uid:'A',devEntitlementBypassRequested:true},{uid:'A',UID:'A',DEVICEID:'known-device',CLIENTIP:'127.0.0.1'});assert.equal(r.errorCode,'AVATAR_LOGIN_REQUIRED',action)}
 assert.deepEqual(s.counts(),{verifies:business.length,dbReads:0,signed:0,configs:0});
});
test('one verified identity owns the entire URL request; another account or legacy device cannot claim its files',async()=>{
 const s=setup(),event={action:'getAvatarDisplayUrls',uniIdToken:'token-A',petId:'cat',selectedJobId:'job',expectedFinalFileId:s.record.finalFileId,fileIds:[s.record.finalFileId]};
 assert.equal((await s.api.main(event,{uid:'forged'})).code,0);assert.equal(s.counts().verifies,1);assert.equal(s.queries[0].quotaOwnerHash,hash('uid:A'));
 assert.equal((await s.api.main({...event,uniIdToken:'token-B'},{uid:'A'})).errorCode,'JOB_OWNER_MISMATCH');
 s.record.quotaOwnerHash=hash('device:known-device');
 assert.equal((await s.api.main(event,{DEVICEID:'known-device'})).errorCode,'JOB_OWNER_MISMATCH');assert.equal(s.counts().signed,1);
});
test('expired token and authentication outage fail closed with distinct recovery messages',async()=>{
 for(const [mode,code] of [['expired','AVATAR_AUTH_EXPIRED'],['offline','AVATAR_AUTH_UNAVAILABLE']]){
  const s=setup(mode),r=await s.api.main({action:'getEntitlement',uniIdToken:'token-A'},{uid:'A'});assert.equal(r.errorCode,code);assert.equal(s.counts().dbReads,0);assert.equal(s.counts().configs,0);
 }
});
