'use strict';
const fs=require('node:fs'),vm=require('node:vm');
const file='uniCloud-alipay/cloudfunctions/submit_product_feedback/index.js';
function harness(options={}) {
  const tables=new Map(),logs=[],calls={add:0,rate:0,read:0};
  const db={command:{lt:lt=>({lt}),inc:inc=>({inc})},collection(name){
    if(!tables.has(name))tables.set(name,new Map());const rows=tables.get(name);
    return {
      doc:id=>({get:async()=>{calls.read++;if(options.readFailure)throw Error('private database hostname');if(options.readResult!==undefined)return options.readResult;return{data:rows.has(id)?[structuredClone(rows.get(id))]:[]};}}),
      add:async row=>{if(name==='product_feedback'){
        calls.add++;if(options.addBeforeError)throw Error(options.addBeforeError);
        if(rows.has(row._id))throw Error('E11000 duplicate key');rows.set(row._id,structuredClone(row));
        if(options.ackLost){options.ackLost=false;throw Error('connection lost after commit');}
      }else{calls.rate++;if(rows.has(row._id))throw Error('E11000 duplicate key');rows.set(row._id,structuredClone(row));}
      return{id:row._id};},
      where:query=>({update:async patch=>{if(options.updateResult!==undefined)return options.updateResult;let updated=0;for(const row of rows.values()){
        if(!Object.entries(query).every(([key,value])=>value?.lt!==undefined?row[key]<value.lt:row[key]===value))continue;
        for(const[key,value]of Object.entries(patch))row[key]=value?.inc!==undefined?row[key]+value.inc:value;updated++;
      }return{updated};}})
    };
  }};
  const realAuthModule={exports:{}};vm.runInNewContext(fs.readFileSync('uniCloud-alipay/cloudfunctions/common/pety-auth/index.js','utf8'),{module:realAuthModule,exports:realAuthModule.exports,require:()=>({})});
  const auth={verifyRequest:async()=>{if(options.authError)throw options.authError;return{uid:'TEST-account'};},authErrorResult:realAuthModule.exports.authErrorResult};
  const module={exports:{}};vm.runInNewContext(fs.readFileSync(file,'utf8'),{module,exports:module.exports,require:n=>n==='pety-auth'?auth:n==='pety-auth/feedback-media'?{service:()=>({validate:async()=>{if(options.mediaError)throw{code:'FEEDBACK_IMAGE_EXPIRED'};return true;}})}:require(n),uniCloud:{database:()=>db},console:{error:(...args)=>logs.push(args)},Date});
  const payload={category:'bug',title:'TEST isolated',content:'TEST 明确标注的合成留言，不含真实资料。',uniIdToken:'test'};
  return{call:extra=>module.exports.main({...payload,...extra},{CLIENTIP:'198.51.100.23'}),tables,calls,logs,options};
}
module.exports={harness};
