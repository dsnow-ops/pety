'use strict';
const https=require('node:https');
const {fs,path,ROOT,sha,writeJson,inspect,composites}=require('../native-alpha-20261022/lib.cjs');
const base=__dirname,PRICES={'qwen-image-2.1-pro':25,'qwen-image-2.1-turbo':10};
function assertSubmissionAllowed(spec){if(spec.submissionBlocked)throw Error('SPECIFIC_IMAGE_UPLOAD_APPROVAL_REQUIRED');}
function budgetGate(auth,receipts,spec){
 if(auth.userApproved!==true||auth.totalCapFen!==2000||auth.previousReservationFen!==140)throw Error('AUTHORIZATION_MISMATCH');
 if(!PRICES[spec.model]||auth.pricesFen[spec.model]!==PRICES[spec.model])throw Error('PRICE_NOT_VERIFIED');
 const used=140+receipts.reduce((n,r)=>n+(PRICES[r.model]||100000),0);
 if(used+PRICES[spec.model]>2000)throw Error('TOTAL_BUDGET_EXCEEDED');
 if(receipts.some(r=>r.id===spec.id))throw Error('EXISTING_SUBMISSION_NEVER_REPOST');
 if(receipts.some(r=>!['READY_FOR_VISUAL_REVIEW','REJECTED_ALPHA','PROVIDER_REJECTED','TASK_FAILED'].includes(r.status)))throw Error('UNRESOLVED_SUBMISSION');
 return {previousAndReservedFen:used,nextReservationFen:PRICES[spec.model],afterFen:used+PRICES[spec.model],capFen:2000,actualCharged:null};
}
function request(url,method,key,payload){return new Promise((resolve,reject)=>{
 const bytes=payload?Buffer.from(JSON.stringify(payload)):null;
 const req=https.request(url,{method,headers:{Authorization:'Bearer '+key,'Content-Type':'application/json',...(bytes?{'X-DashScope-Async':'enable','Content-Length':bytes.length}:{})}},res=>{
  let size=0;const chunks=[];res.on('data',b=>{size+=b.length;if(size>3e6){res.destroy();return;}chunks.push(b)});res.on('error',()=>reject(Error('RESPONSE_FAILED')));res.on('end',()=>{try{resolve({statusCode:res.statusCode,data:JSON.parse(Buffer.concat(chunks).toString('utf8'))})}catch{reject(Error('INVALID_RESPONSE'))}});
 });req.on('error',()=>reject(Error('NETWORK_OUTCOME_UNKNOWN')));req.setTimeout(45000,()=>req.destroy());if(bytes)req.write(bytes);req.end();
});}
function download(url){const u=new URL(url);if(u.protocol!=='https:'||!/(\.aliyuncs\.com|\.alicdn\.com|\.aliyun\.com)$/.test(u.hostname))throw Error('DOWNLOAD_HOST_REVIEW_REQUIRED');return new Promise((resolve,reject)=>{
 const req=https.get(u,res=>{if(res.statusCode!==200){res.resume();return reject(Error('DOWNLOAD_FAILED'))}let size=0;const chunks=[];res.on('data',b=>{size+=b.length;if(size>30e6)res.destroy();else chunks.push(b)});res.on('error',()=>reject(Error('DOWNLOAD_FAILED')));res.on('end',()=>resolve(Buffer.concat(chunks)))});req.on('error',()=>reject(Error('DOWNLOAD_FAILED')));req.setTimeout(45000,()=>req.destroy());
});}
function outputUrl(data){for(const c of data.output?.choices||[])for(const x of c.message?.content||[])if(x.image)return x.image;return data.output?.results?.find(x=>x.url)?.url||'';}
function inside(file,dir=base){const target=path.resolve(dir,file);if(target!==dir&&!target.startsWith(dir+path.sep))throw Error('OUTSIDE_EXPERIMENT');return target;}
async function main(){
 const id=process.argv[2];if(!/^[a-z0-9-]{3,80}$/.test(id||''))throw Error('SAMPLE_ID_REQUIRED');
 const spec=JSON.parse(fs.readFileSync(inside('samples/'+id+'.json')));if(spec.id!==id)throw Error('ID_MISMATCH');
 if(spec.parameters.n!==1||spec.parameters.size!=='2048*2048'||spec.parameters.prompt_extend!==false||spec.images.length<1||spec.images.length>10)throw Error('INVALID_PLAN');
 const auth=JSON.parse(fs.readFileSync(inside('authorization.json'))),outputs=inside('outputs');fs.mkdirSync(outputs,{recursive:true});
 const receipts=fs.readdirSync(outputs).map(d=>JSON.parse(fs.readFileSync(path.join(outputs,d,'receipt.json'))));
 const budget=budgetGate(auth,receipts,spec);
 for(const r of receipts){const reviewFile=inside('outputs/'+r.id+'/review.json');if(!fs.existsSync(reviewFile))throw Error('REVIEW_PREVIOUS_SAMPLE_FIRST');const review=JSON.parse(fs.readFileSync(reviewFile));if(review.reviewed!==true||review.originalSha256!==r.originalSha256)throw Error('VISUAL_REVIEW_INVALID');}
 const prompt=fs.readFileSync(inside(spec.promptFile),'utf8');if(sha(Buffer.from(prompt))!==spec.promptSha256)throw Error('PROMPT_HASH_MISMATCH');
 // Input paths are confined to the experiments parent; no arbitrary upload path.
 const images=spec.images.map(f=>{const file=path.resolve(base,f.file),parent=path.resolve(base,'..');if(!file.startsWith(parent+path.sep))throw Error('INPUT_OUTSIDE_EXPERIMENTS');const b=fs.readFileSync(file);if(sha(b)!==f.sha256)throw Error('INPUT_HASH_MISMATCH');const m=inspect(b);return{image:'data:'+m.mime+';base64,'+b.toString('base64')};});
 const payload={model:spec.model,input:{messages:[{role:'user',content:[...images,{text:prompt}]}]},parameters:{...spec.parameters,seed:spec.seed}};
 console.log(JSON.stringify({status:process.argv.includes('--execute')?'PREPARED':'DRY_RUN',id,budget,inputCount:images.length,productionChanges:false,postRetries:0}));
 if(!process.argv.includes('--execute'))return;
 assertSubmissionAllowed(spec);
 const c=JSON.parse(fs.readFileSync(path.join(ROOT,'uniCloud-alipay/cloudfunctions/api_pet_avatar/config.json'),'utf8').replace(/^\uFEFF/,''));
 const apiKey=process.env.DASHSCOPE_API_KEY||process.env.WAN_API_KEY||c.apiKey,workspace=process.env.DASHSCOPE_WORKSPACE_ID||process.env.WAN_WORKSPACE_ID||c.workspaceId;
 if(!apiKey||!workspace||!/^[a-zA-Z0-9-]+$/.test(workspace))throw Error('CONFIG_NOT_READY');
 const lock=inside('execution.lock');fs.writeFileSync(lock,String(process.pid),{flag:'wx'});
 try{
  // Recheck under the exclusive lock before reserving any charge.
  const fresh=fs.readdirSync(outputs).map(d=>JSON.parse(fs.readFileSync(path.join(outputs,d,'receipt.json'))));budgetGate(auth,fresh,spec);
  const out=inside('outputs/'+id),priv=inside('private/'+id);fs.mkdirSync(out);fs.mkdirSync(priv,{recursive:true});
  const receipt={id,model:spec.model,seed:spec.seed,status:'SUBMISSION_STARTED',submittedAt:new Date().toISOString(),reservedFen:PRICES[spec.model],budget,requestSha256:sha(Buffer.from(JSON.stringify(payload))),promptSha256:spec.promptSha256,inputHashes:spec.images.map(i=>i.sha256),postRetries:0,productionAccepted:false};
  const save=()=>writeJson(path.join(out,'receipt.json'),receipt);save();fs.writeFileSync(path.join(priv,'request.json'),JSON.stringify(payload));
  const host='https://'+workspace+'.cn-beijing.maas.aliyuncs.com';let submitted;
  try{submitted=await request(host+'/api/v1/services/aigc/image-generation/generation','POST',apiKey,payload)}catch{receipt.status='SUBMISSION_UNCERTAIN';save();throw Error('DO_NOT_RESUBMIT');}
  fs.writeFileSync(path.join(priv,'submission.json'),JSON.stringify(submitted));receipt.httpStatus=submitted.statusCode;
  if(submitted.statusCode<200||submitted.statusCode>=300){receipt.status='PROVIDER_REJECTED';save();throw Error('PROVIDER_REJECTED');}
  receipt.taskId=submitted.data.output?.task_id;if(!receipt.taskId){receipt.status='TASK_ID_MISSING';save();throw Error('DO_NOT_RESUBMIT');}receipt.status='ACCEPTED';save();
  const start=Date.now();let done;
  while(Date.now()-start<20*60000){await new Promise(r=>setTimeout(r,10000));let poll;try{poll=await request(host+'/api/v1/tasks/'+encodeURIComponent(receipt.taskId),'GET',apiKey)}catch{continue}fs.writeFileSync(path.join(priv,'last-task.json'),JSON.stringify(poll));
   const status=poll.data.output?.task_status;receipt.providerStatus=status;save();if(status==='SUCCEEDED'){done=poll.data;break}if(['FAILED','CANCELED','UNKNOWN'].includes(status)){receipt.status='TASK_FAILED';save();throw Error('TASK_FAILED');}
  }
  if(!done){receipt.status='POLL_TIMEOUT';save();throw Error('RESUME_EXISTING_TASK_ONLY');}
  const url=outputUrl(done);if(!url)throw Error('OUTPUT_MISSING');const bytes=await download(url);fs.writeFileSync(path.join(out,'provider-original.png'),bytes,{flag:'wx'});const alpha=inspect(bytes);writeJson(path.join(out,'alpha.json'),alpha);composites(bytes,out,'display');
  receipt.originalSha256=sha(bytes);receipt.status=alpha.pixelTransparencyPassed?'READY_FOR_VISUAL_REVIEW':'REJECTED_ALPHA';receipt.completedAt=new Date().toISOString();receipt.usage=done.usage||null;save();console.log(JSON.stringify({id,status:receipt.status,budget,originalSha256:receipt.originalSha256}));
 }finally{fs.unlinkSync(lock);}
}
if(require.main===module)main().catch(e=>{console.error(JSON.stringify({status:'STOPPED',code:/^[A-Z_]+$/.test(e.message)?e.message:'LOCAL_OR_NETWORK_ERROR_REVIEW_RECEIPT'}));process.exitCode=1});
module.exports={budgetGate,assertSubmissionAllowed};
