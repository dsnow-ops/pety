'use strict';
const https=require('node:https');
const {fs,path,ROOT,sha,writeJson,inside,inspect,composites,configPresence}=require('./lib.cjs');
const base=__dirname;
function loadConfig() {
 const c=JSON.parse(fs.readFileSync(path.join(ROOT,'uniCloud-alipay/cloudfunctions/api_pet_avatar/config.json'),'utf8').replace(/^\uFEFF/,''));
 return {apiKey:process.env.DASHSCOPE_API_KEY||process.env.WAN_API_KEY||c.apiKey||'',workspaceId:process.env.DASHSCOPE_WORKSPACE_ID||process.env.WAN_WORKSPACE_ID||c.workspaceId||''};
}
const PRICES={'qwen-image-2.1-pro':25,'qwen-image-2.1-turbo':10};
function paidGate(plan,authorization) {
 const failures=[];
 if(!authorization||authorization.status!=='USER_APPROVED'||authorization.scope!=='THIS_EXPERIMENT_IMAGES_ONLY')return ['PAID_AUTHORIZATION_REQUIRED'];
 if(authorization.maxCostCny!==1.4||authorization.maxSubmissions!==8||authorization.planSha256!==sha(Buffer.from(JSON.stringify(plan))))failures.push('PAID_AUTHORIZATION_SCOPE_MISMATCH');
 if(plan.costs.paidBudgetCny!==1.4||plan.costs.maxOutputs!==8||plan.costs.maxListPriceCny!==1.4)failures.push('PAID_BUDGET_EXCEEDS_APPROVAL');
 for(const m of plan.models)if(plan.costs.listPricePerOutput[m]*100!==PRICES[m])failures.push('UNVERIFIED_PRICE');
 if(plan.models.reduce((n,m)=>n+PRICES[m]*plan.samplesPerModel,0)>140)failures.push('PAID_BUDGET_EXCEEDS_APPROVAL');
 return failures;
}
function reservationGate(receipts,model) {
 const failures=[];
 if(receipts.some(r=>!['PIXEL_ALPHA_PASSED_VISUAL_REVIEW_PENDING','NATIVE_ALPHA_REJECTED','PROVIDER_REJECTED','TASK_FAILED'].includes(r.status)))failures.push('UNRESOLVED_PRIOR_SUBMISSION');
 if(receipts.length>=8||receipts.filter(r=>r.model===model).length>=4)failures.push('MAX_SUBMISSIONS_REACHED');
 const reserved=receipts.reduce((sum,r)=>sum+(PRICES[r.model]||100000),0);
 if(reserved+PRICES[model]>140)failures.push('BUDGET_RESERVATION_EXCEEDED');
 return failures;
}
function gate(plan,attestation,config,now=Date.now(),authorization=null) {
 const failures=[];
 if(plan.postGenerationBackgroundRemoval!==false || plan.productionChange!==false)failures.push('FORBIDDEN_EXPERIMENT_SCOPE');
 if(!config.apiKey||!config.workspaceId)failures.push('MISSING_EXISTING_CREDENTIALS');
 if(!/^[a-zA-Z0-9-]+$/.test(config.workspaceId||''))failures.push('INVALID_WORKSPACE_ID');
 if(plan.costs.paidBudgetCny!==0&&plan.costs.paidBudgetCny!==1.4)failures.push('ZERO_PAID_BUDGET_REQUIRED');
 if(plan.samplesPerModel<1||plan.samplesPerModel>4||plan.parameters.n!==1||plan.models.length!==2||new Set(plan.models).size!==2||plan.seeds.length<plan.samplesPerModel)failures.push('SMALL_FIRST_ROUND_REQUIRED');
 if(plan.region!=='cn-beijing'||plan.endpointPath!=='/api/v1/services/aigc/image-generation/generation')failures.push('UNVERIFIED_REGION_OR_ENDPOINT');
 for(const model of plan.models)if(!['qwen-image-2.1-pro','qwen-image-2.1-turbo'].includes(model))failures.push('MODEL_NOT_ALLOWLISTED');
 if(plan.costs.paidBudgetCny!==0)return failures.concat(paidGate(plan,authorization));
 if(!attestation||attestation.status!=='VERIFIED')return failures.concat('FREE_QUOTA_AND_FREE_TIER_ONLY_UNVERIFIED');
 const age=now-Date.parse(attestation.verifiedAt);
 if(!Number.isFinite(age)||age<0||age>30*60000)failures.push('ACCOUNT_EVIDENCE_NOT_FRESH');
 if(attestation.workspaceSha256!==sha(Buffer.from(config.workspaceId)))failures.push('ACCOUNT_WORKSPACE_MISMATCH');
 if(attestation.region!==plan.region)failures.push('ACCOUNT_REGION_MISMATCH');
 if(!attestation.evidenceFile||!attestation.evidenceSha256)failures.push('ACCOUNT_EVIDENCE_MISSING');
 else {try {if(sha(fs.readFileSync(inside(attestation.evidenceFile)))!==attestation.evidenceSha256)failures.push('ACCOUNT_EVIDENCE_HASH_MISMATCH');}catch{failures.push('ACCOUNT_EVIDENCE_UNREADABLE');}}
 for(const model of plan.models){
  const q=attestation.models&&attestation.models[model];
  if(!q||q.enabled!==true||q.freeTierOnly!==true||!Number.isInteger(q.remainingFreeImages)||q.remainingFreeImages<plan.samplesPerModel)failures.push(model+':ZERO_COST_NOT_VERIFIED');
  if(!q||!q.expiresAt||!(Date.parse(q.expiresAt)>now+plan.transport.maxPollMs))failures.push(model+':FREE_QUOTA_EXPIRY_NOT_VERIFIED');
 }
 return failures;
}
function request(url,method,key,payload,timeoutMs=45000) {
 return new Promise((resolve,reject)=>{
  const bytes=payload?Buffer.from(JSON.stringify(payload)):null;
  const req=https.request(url,{method,headers:{Authorization:'Bearer '+key,'Content-Type':'application/json',...(bytes?{'X-DashScope-Async':'enable','Content-Length':bytes.length}:{})}},res=>{
   const chunks=[];let size=0;
   res.on('data',b=>{size+=b.length;if(size>3e6){req.destroy(new Error('RESPONSE_TOO_LARGE'));return;}chunks.push(b);});
   res.on('end',()=>{let data;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return reject(new Error('INVALID_PROVIDER_JSON'));}
    resolve({statusCode:res.statusCode,data});});
  });
  req.setTimeout(timeoutMs,()=>req.destroy(new Error('NETWORK_TIMEOUT_NO_AUTOMATIC_RESUBMIT')));
  req.on('error',()=>reject(new Error('NETWORK_ERROR_NO_AUTOMATIC_RESUBMIT')));
  if(bytes)req.write(bytes);req.end();
 });
}
function download(url) {
 const parsed=new URL(url);
 if(parsed.protocol!=='https:'||!/(\.aliyuncs\.com|\.alicdn\.com|\.aliyun\.com)$/.test(parsed.hostname))throw new Error('OUTPUT_DOWNLOAD_HOST_REQUIRES_REVIEW');
 return new Promise((resolve,reject)=>{
  https.get(parsed,res=>{
   if(res.statusCode!==200){res.resume();return reject(new Error('OUTPUT_DOWNLOAD_FAILED'));}
   let size=0;const chunks=[];res.on('data',b=>{size+=b.length;if(size>30e6)res.destroy(new Error('OUTPUT_TOO_LARGE'));else chunks.push(b);});
   res.on('end',()=>resolve(Buffer.concat(chunks)));res.on('error',()=>reject(new Error('OUTPUT_DOWNLOAD_FAILED')));
  }).on('error',()=>reject(new Error('OUTPUT_DOWNLOAD_FAILED'))).setTimeout(45000,function(){this.destroy();});
 });
}
function resultUrl(data) {
 for(const c of data.output&&data.output.choices||[])for(const v of c.message&&c.message.content||[])if(v.image)return v.image;
 for(const r of data.output&&data.output.results||[])if(r.url)return r.url;
 return '';
}
async function main() {
 const plan=JSON.parse(fs.readFileSync(path.join(base,'plan.json'),'utf8')),config=loadConfig();
 const aFile=path.join(base,'private/account-attestation.json');
 const attestation=fs.existsSync(aFile)?JSON.parse(fs.readFileSync(aFile,'utf8')):null;
 const authorizationFile=path.join(base,'evidence/paid-authorization.json');
 const authorization=fs.existsSync(authorizationFile)?JSON.parse(fs.readFileSync(authorizationFile,'utf8')):null;
 const failures=gate(plan,attestation,config,Date.now(),authorization);
 const report={checkedAt:new Date().toISOString(),executeRequested:process.argv.includes('--execute'),failures,networkRequests:0,generationSubmissions:0,paidCostCny:0,config:configPresence()};
 writeJson(path.join(base,'evidence/preflight.json'),report);
 if(failures.length){console.log(JSON.stringify({status:'BLOCKED_BEFORE_NETWORK',...report}));process.exitCode=2;return;}
 if(!process.argv.includes('--execute')){console.log(JSON.stringify({status:'DRY_RUN_PASSED',...report}));return;}
 if(!fs.existsSync(path.join(base,'evidence/input-review.json')))throw new Error('VISUAL_INPUT_REVIEW_REQUIRED');
 const review=JSON.parse(fs.readFileSync(path.join(base,'evidence/input-review.json'),'utf8'));
 if(review.samePetVerified!==true||review.okToUseForNativeTrial!==true)throw new Error('SAME_PET_INPUT_REVIEW_REQUIRED');
 const prompt=fs.readFileSync(inside(plan.promptFile),'utf8');
 if(sha(Buffer.from(prompt))!==plan.promptSha256)throw new Error('PROMPT_CHANGED_REPREPARE');
 const content=plan.identityFiles.map(f=>{
  const b=fs.readFileSync(inside(f.file));if(sha(b)!==f.sha256)throw new Error('IDENTITY_BYTES_CHANGED');
  const m=inspect(b);return {image:'data:'+m.mime+';base64,'+b.toString('base64')};
 }).concat({text:prompt});
 fs.mkdirSync(path.join(base,'private'),{recursive:true});
 const lock=path.join(base,'private/execution.running.lock');
 fs.writeFileSync(lock,JSON.stringify({startedAt:new Date().toISOString(),planSha256:sha(fs.readFileSync(path.join(base,'plan.json')))}),{flag:'wx'});
 try {
 const host='https://'+config.workspaceId+'.cn-beijing.maas.aliyuncs.com';
 const outputs=path.join(base,'outputs');
 const receipts=fs.existsSync(outputs)?fs.readdirSync(outputs).filter(d=>fs.existsSync(path.join(outputs,d,'receipt.json'))).map(d=>JSON.parse(fs.readFileSync(path.join(outputs,d,'receipt.json'),'utf8'))):[];
 for(let n=0;n<plan.samplesPerModel;n++)for(const model of plan.models){
  if(plan.costs.paidBudgetCny===0&&Date.now()-Date.parse(attestation.verifiedAt)>30*60000)throw new Error('ACCOUNT_EVIDENCE_EXPIRED_STOP');
  const id=model+'-'+String(n+1).padStart(2,'0'),privateDir=path.join(base,'private',id),outDir=path.join(base,'outputs',id);
  if(receipts.some(r=>r.id===id))continue;
  if(receipts.some(r=>r.model===model&&['NATIVE_ALPHA_REJECTED','PROVIDER_REJECTED','TASK_FAILED'].includes(r.status)))continue;
  const reservedFailures=reservationGate(receipts,model);if(reservedFailures.length)throw new Error(reservedFailures.join(' '));
  fs.mkdirSync(privateDir,{recursive:true});fs.mkdirSync(outDir,{recursive:true});
  const payload={model,input:{messages:[{role:'user',content}]},parameters:{...plan.parameters,seed:plan.seeds[n]}};
  fs.writeFileSync(path.join(privateDir,'request.json'),JSON.stringify(payload),{flag:'wx'});
  const receipt={id,model,seed:plan.seeds[n],submittedAt:new Date().toISOString(),promptSha256:plan.promptSha256,inputHashes:plan.identityFiles.map(f=>f.sha256),
   requestSha256:sha(Buffer.from(JSON.stringify(payload))),postRetries:0,status:'SUBMISSION_STARTED',cost:{paidBudgetCny:plan.costs.paidBudgetCny,listPriceReservationCny:PRICES[model]/100,actualChargedCny:null,quotaConsumption:'AWAITING_ACCOUNT_READBACK'}};
  const receiptPath=path.join(outDir,'receipt.json');writeJson(receiptPath,receipt);
  let submit;try{submit=await request(host+plan.endpointPath,'POST',config.apiKey,payload);}
  catch{receipt.status='SUBMISSION_UNCERTAIN_DO_NOT_RESUBMIT';writeJson(receiptPath,receipt);throw new Error(receipt.status);}
  fs.writeFileSync(path.join(privateDir,'submission-response.json'),JSON.stringify(submit));
  receipt.httpStatus=submit.statusCode;receipt.requestId=submit.data.request_id||null;
  if(submit.statusCode<200||submit.statusCode>=300){receipt.status='PROVIDER_REJECTED';receipt.providerCode=String(submit.data.code||'').replace(/[^A-Za-z0-9_.-]/g,'').slice(0,100);writeJson(receiptPath,receipt);throw new Error('PROVIDER_REJECTED_STOP_NO_RETRY');}
  const taskId=submit.data.output&&submit.data.output.task_id;
  if(!taskId){receipt.status='ACCEPTED_TASK_ID_MISSING_STOP';writeJson(receiptPath,receipt);throw new Error(receipt.status);}
  receipt.taskId=taskId;receipt.status='ACCEPTED';writeJson(receiptPath,receipt);
  const start=Date.now();let done;
  while(Date.now()-start<plan.transport.maxPollMs){
   await new Promise(r=>setTimeout(r,plan.transport.pollEveryMs));
   let polled;try{polled=await request(host+'/api/v1/tasks/'+encodeURIComponent(taskId),'GET',config.apiKey,null);}catch{continue;}
   if(polled.statusCode!==200){receipt.status='POLL_HTTP_ERROR';writeJson(receiptPath,receipt);throw new Error('POLL_HTTP_ERROR_KEEP_TASK_ID');}
   fs.writeFileSync(path.join(privateDir,'last-task-response.json'),JSON.stringify(polled));
   receipt.providerTaskStatus=polled.data.output&&polled.data.output.task_status;receipt.usage=polled.data.usage||null;writeJson(receiptPath,receipt);
   if(receipt.providerTaskStatus==='SUCCEEDED'){done=polled.data;break;}
   if(['FAILED','CANCELED','UNKNOWN'].includes(receipt.providerTaskStatus)){receipt.status='TASK_FAILED';writeJson(receiptPath,receipt);throw new Error('TASK_FAILED_STOP_NO_RETRY');}
  }
  if(!done){receipt.status='POLL_TIMEOUT_TASK_MAY_COMPLETE';writeJson(receiptPath,receipt);throw new Error(receipt.status);}
  const url=resultUrl(done);if(!url)throw new Error('SUCCEEDED_OUTPUT_URL_MISSING');
  const bytes=await download(url),file=path.join(outDir,'provider-original.png');
  fs.writeFileSync(file,bytes,{flag:'wx'});const metrics=inspect(bytes);
  writeJson(path.join(outDir,'alpha.json'),metrics);composites(bytes,outDir,'display');
  receipt.status=metrics.pixelTransparencyPassed?'PIXEL_ALPHA_PASSED_VISUAL_REVIEW_PENDING':'NATIVE_ALPHA_REJECTED';
  receipt.completedAt=new Date().toISOString();receipt.elapsedMs=Date.now()-Date.parse(receipt.submittedAt);receipt.originalSha256=sha(bytes);
  writeJson(receiptPath,receipt);console.log(JSON.stringify({id,status:receipt.status,sha256:receipt.originalSha256}));
  if(!metrics.pixelTransparencyPassed)throw new Error('OPAQUE_OUTPUT_STOP_COMPARE_BEFORE_MORE_CALLS');
  return; // One submission per invocation. Inspect the original and composites before continuing.
 }
 console.log(JSON.stringify({status:'NO_REMAINING_ELIGIBLE_SAMPLES'}));
 } finally {fs.unlinkSync(lock);}
}
if(require.main===module)main().catch(e=>{console.error(JSON.stringify({status:'STOPPED',code:/^[A-Z0-9_: -]+$/.test(e.message)?e.message:'LOCAL_OR_NETWORK_FAILURE_REVIEW_PRIVATE_RECEIPTS'}));process.exitCode=1;});
module.exports={gate,paidGate,reservationGate};
