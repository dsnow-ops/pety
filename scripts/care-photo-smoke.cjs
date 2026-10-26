'use strict';
// Real provider calls only. No cloud deployment, fake auth, or medical sample claims.
const fs=require('node:fs'),path=require('node:path'),https=require('node:https');
if(process.env.PETY_RUN_CARE_PHOTO_SMOKE!=='true'){console.error('Set PETY_RUN_CARE_PHOTO_SMOKE=true to allow at most 2 real API calls with a synthetic non-private test image.');process.exit(1);}
const root=path.resolve(__dirname,'..'),dir=path.join(root,'uniCloud-alipay/cloudfunctions/api_deepseek');
const care=require(path.join(dir,'care-photo')),search=require(path.join(dir,'care-search'));
const raw=JSON.parse(fs.readFileSync(path.join(dir,'config.json'),'utf8').replace(/^\uFEFF/,''));
const config={deepseek:{...(raw.deepseek||raw),visionEnabled:true,visionModel:'deepseek-flash',visionMaxTokens:1800,visionRequestTimeoutMs:45000}};
config.deepseek.apiKey=process.env.DEEPSEEK_API_KEY||config.deepseek.apiKey;
if(config.deepseek.baseUrl!=='https://api.deepseek.com'||!config.deepseek.apiKey)throw Error('Official local provider configuration required');
const {PNG}=require(path.join(dir,'node_modules/pngjs'));
const p=new PNG({width:640,height:480});for(let y=0;y<480;y++)for(let x=0;x<640;x++){const i=(y*640+x)*4;p.data[i]=x<213?220:40;p.data[i+1]=x>=213&&x<426?210:40;p.data[i+2]=x>=426?220:40;p.data[i+3]=255;}
const image=PNG.sync.write(p);
const out=path.join(root,'unpackage/care-photo-v1');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'synthetic-non-pet.png'),image);
function request(url,options){return new Promise((resolve,reject)=>{const body=JSON.stringify(options.data);const req=https.request(url,{method:'POST',headers:{...options.headers,'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}},res=>{let chunks=[],size=0;res.on('data',chunk=>{size+=chunk.length;if(size>2*1024*1024)req.destroy(Error('RESPONSE_TOO_LARGE'));else chunks.push(chunk);});res.on('end',()=>{try{resolve({status:res.statusCode,data:JSON.parse(Buffer.concat(chunks).toString())});}catch(_){reject(Error('INVALID_RESPONSE'));}});});req.setTimeout(options.timeout,()=>req.destroy(Error('REQUEST_TIMEOUT')));req.on('error',()=>reject(Error('TRANSPORT_FAILED')));req.end(body);});}
(async()=>{
  const evidence={date:new Date().toISOString(),scope:'Local Node to real DeepSeek API; synthetic color chart, no pet or medical accuracy validation; uniCloud/auth/UI not exercised',calls:[]};
  const observedRequest=async(url,options)=>{const response=await request(url,options);fs.writeFileSync(path.join(out,'synthetic-provider-response.json'),JSON.stringify(response,null,2));return response;};
  try{const result=await care.requestVision(config,[care.inspectImage(image.toString('base64'))],{purpose:'photo',profile:'测试样本，不含私人资料',description:'请依据实际图片说明是否适合宠物患处分析。',history:[]},observedRequest,'local-smoke-'+Date.now());evidence.calls.push({kind:'vision',ok:true,...result});}catch(error){evidence.calls.push({kind:'vision',ok:false,errorCode:error.code||'TRANSPORT_FAILED'});}
  if(!process.argv.includes('--vision-only')) {
  try{const built=search.buildSearchRequest(config,'猫 皮肤 发红 脱毛');const res=await request(built.endpoint,{timeout:90000,headers:{Authorization:`Bearer ${config.deepseek.apiKey}`,'x-api-key':config.deepseek.apiKey,'anthropic-version':'2023-06-01'},data:built.payload});const normalized=search.nativeSearchResponse(res.data);const executed=normalized.output.length>0;evidence.calls.push({kind:'search',protocol:'DeepSeek Anthropic Messages',ok:res.status===200&&executed,transportOk:res.status===200,httpStatus:res.status,requestId:res.data?.id||'',usage:res.data?.usage||{},webSearchExecuted:executed,result:search.groundedResults(normalized,'猫 皮肤 发红 脱毛')});}catch(_){evidence.calls.push({kind:'search',ok:false,errorCode:'TRANSPORT_FAILED'});}
  }
  fs.writeFileSync(path.join(out,process.argv.includes('--vision-only')?'real-smoke-vision-recheck.json':'real-smoke.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));
  if(!evidence.calls.every(v=>v.ok))process.exitCode=1;
})();
