// Observe one existing native image attempt; do not persist URLs or response bodies.
const fs=require('node:fs'),{execFileSync}=require('node:child_process');
const {chromium}=require('C:/Users/杜冲/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const adb='D:/HBuilderX/plugins/launcher-tools/tools/adbs/adb.exe';
(async()=>{
 const b=await chromium.connectOverCDP('http://127.0.0.1:9227');const events=[];
 try {
  for(const p of b.contexts()[0].pages()){
   const s=await b.contexts()[0].newCDPSession(p);await s.send('Network.enable');const ids=new Set();
   s.on('Network.responseReceived',e=>{if(e.type==='Image'){ids.add(e.requestId);events.push({type:'response',status:e.response.status,mime:e.response.mimeType,length:e.response.headers['content-length']||e.response.headers['Content-Length'],cached:e.response.fromDiskCache});}});
   s.on('Network.loadingFailed',e=>{if(ids.has(e.requestId))events.push({type:'failure',error:e.errorText,canceled:e.canceled});});
   s.on('Network.loadingFinished',e=>{if(ids.has(e.requestId))events.push({type:'complete',bytes:e.encodedDataLength});});
  }
  execFileSync(adb,['shell','input','tap','218','2748']);
  await new Promise(r=>setTimeout(r,6000));
  execFileSync(adb,['shell','input','tap','1095','2748']);
  fs.writeFileSync('unpackage/home-c1-runtime-device/image-failure-summary.json',JSON.stringify(events,null,2));console.log(JSON.stringify(events));
 }finally{await b.close();}
})().catch(e=>{console.error(e.name);process.exitCode=1;});
