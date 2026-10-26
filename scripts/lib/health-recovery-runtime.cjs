'use strict';
// Local test adapters only. Executes production business code, replaces I/O.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function moduleFrom(file,names,deps={}) {return Function(...Object.keys(deps),fs.readFileSync(file,'utf8').replace(/^import[\s\S]*?from\s+['"][^'"]+['"];?\s*/gm,'').replace(/export /g,'')+';return {'+names+'};')(...Object.values(deps));}
function dataRuntime(){
 let scope={namespace:'guest:local',ready:true,version:0},failWrite=false;const disk=new Map();
 const raw={getStorageInfoSync:()=>({keys:[...disk.keys()]}),getStorageSync:k=>structuredClone(disk.get(k)),setStorageSync:(k,v)=>{if(failWrite)throw Error('TEST_DISK_FULL');disk.set(k,structuredClone(v))},removeStorageSync:k=>disk.delete(k)};
 const {createScopedStorage}=moduleFrom('common/scoped-storage.js','createScopedStorage',{getAccountScope:()=>scope,uni:raw});const storage=createScopedStorage(raw,()=>scope);
 const daily=moduleFrom('common/daily-record-fields.js','healthValueLines,hasExplicitHealth');
 const narrative=moduleFrom('common/narrative-store.js','createNarrativeStore',{scopedStorage:storage,captureDataScope:()=>scope});
 const diary=moduleFrom('common/diary-store.js','getDiaryMap,getDiaryRecord,saveDiaryRecord,normalizeDiaryRecord,hasDiaryRecord,isHealthDiaryRecord,buildDiaryContext,formatDateKey',{scopedStorage:storage,getNarrativeStore:(petId,lease)=>narrative.createNarrativeStore(storage,lease,petId),...daily});
 return {disk,storage,diary,scope:()=>({...scope}),login:owner=>{scope={namespace:owner?'account:'+owner:'guest:local',ready:true,version:scope.version+1}},fail:value=>failWrite=value,creative:id=>narrative.createNarrativeStore(storage,scope,id)};
}
function localServer(){
 const filename=path.resolve('uniCloud-alipay/cloudfunctions/api_deepseek/index.js'),dir=path.dirname(filename),receipts=[],docs=new Map();
 const collection={doc:id=>({get:async()=>({data:docs.has(id)?[docs.get(id)]:[]})}),add:async r=>docs.set(r._id,structuredClone(r)),where:where=>({update:async patch=>{const r=docs.get(where._id);if(!r||r.count>=where.count.lt)return {updated:0};r.count+=patch.count.inc;return {updated:1};}})};
 const cloud={database:()=>({command:{lt:n=>({lt:n}),inc:n=>({inc:n})},collection:()=>collection}),httpclient:{request:async(url,options)=>{receipts.push(JSON.parse(JSON.stringify(options.data)));return {status:200,data:{choices:[{message:{content:'这是本地隔离测试的替身响应。'}}]}};}}};
 const sandbox={exports:{},__dirname:dir,process:{env:{}},Buffer,console:{info(){},error(){}},uniCloud:cloud,require:name=>{
  if(name==='pety-auth/sessions')return require('../../uniCloud-alipay/cloudfunctions/common/pety-auth/sessions');
  if(name==='fs')return {...fs,existsSync:p=>/config\.json$/.test(p)?false:fs.existsSync(p)};
  if(name==='uni-config-center')return options=>({config:()=>({...options.defaultConfig,deepseek:{...options.defaultConfig.deepseek,apiKey:'local-test-only',baseUrl:'https://local-test.invalid'}})});
  return require(name.startsWith('.')?path.resolve(dir,name):name);
 }};
 vm.runInNewContext(fs.readFileSync(filename,'utf8'),sandbox,{filename});
 return {receipts,async request(data){const count=receipts.length;const result=await sandbox.exports.main(JSON.parse(JSON.stringify(data)),{CLIENTIP:'127.0.0.1',DEVICEID:'health-recovery-fixture'});if(receipts.length!==count+1)throw Error('No provider boundary receipt: '+JSON.stringify(result));return {result,payload:receipts.at(-1)};}};
}
module.exports={moduleFrom,dataRuntime,localServer};
