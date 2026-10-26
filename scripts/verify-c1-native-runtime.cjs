// Device-only evidence: native taps + screenrecord; never substitute image fixtures.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {execFileSync,spawn}=require('node:child_process');
const {chromium}=require('C:/Users/杜冲/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const adb='D:/HBuilderX/plugins/launcher-tools/tools/adbs/adb.exe';
const out='unpackage/home-c1-runtime-device/run-'+Date.now();
fs.mkdirSync(out,{recursive:true});console.log('Evidence:',out);
const cmd=(...args)=>execFileSync(adb,args,{maxBuffer:20000000,timeout:15000});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const events=[];const mark=(event,data={})=>events.push({time:Date.now(),event,...data});
(async()=>{
 const socket=cmd('shell','cat','/proc/net/unix').toString().match(/@webview_devtools_remote_\d+/)?.[0].slice(1);
 assert.ok(socket,'Pety must be running and unlocked');cmd('forward','tcp:9227','localabstract:'+socket);
 const b=await chromium.connectOverCDP('http://127.0.0.1:9227',{timeout:10000});
 const imageTransfers=[];let transferObserved=false,networkStopped=false,receivedBytes=0;
 let rejectNetwork;
 const networkFailure=new Promise((_,reject)=>{rejectNetwork=reject});networkFailure.catch(()=>{});
 const stopNetwork=reason=>{if(networkStopped)return;networkStopped=true;mark('network-stop',{reason});cmd('shell','input','tap','1095','2748');rejectNetwork(new Error(reason));};
 async function observeNetwork(p){
  const session=await b.contexts()[0].newCDPSession(p),requests=new Map();await session.send('Network.enable');
  session.on('Network.responseReceived',e=>{
   if(!/^image\//i.test(e.response.mimeType||''))return;
   transferObserved=true;const item={status:e.response.status,diskCache:!!e.response.fromDiskCache,serviceWorker:!!e.response.fromServiceWorker,decodedBodyBytes:0,encodedTransferBytes:0,finished:false};
   requests.set(e.requestId,item);imageTransfers.push(item);
  });
  session.on('Network.dataReceived',e=>{const item=requests.get(e.requestId);if(item){item.decodedBodyBytes+=e.dataLength||0;receivedBytes+=e.encodedDataLength||0;if(receivedBytes>24*1024*1024)stopNetwork('WEBVIEW_IMAGE_CAPTURE_BUDGET');}});
  session.on('Network.loadingFailed',e=>{const item=requests.get(e.requestId);if(item){item.failure=e.errorText;requests.delete(e.requestId);if(e.errorText==='net::ERR_CACHE_WRITE_FAILURE')stopNetwork('WEBVIEW_CACHE_WRITE_FAILURE');}});
  session.on('Network.loadingFinished',e=>{const item=requests.get(e.requestId);if(item){item.encodedTransferBytes=e.encodedDataLength||0;item.finished=true;requests.delete(e.requestId)}});
 }
 for(const p of b.contexts()[0].pages())await observeNetwork(p);
 b.contexts()[0].on('page',p=>observeNetwork(p).catch(()=>{}));
 const find=async name=>{for(const p of b.contexts()[0].pages())if((await p.title()).includes('pages/'+name+'/'))return p;};
 async function page(name){for(let i=0;i<30;i++){const p=await find(name);if(p)return p;await sleep(100)}throw Error('page unavailable: '+name)}
 const h=await page('home');
 await h.evaluate(()=>{
  window.c1RuntimeTrace=[];let last='';
  const hash=s=>{let n=2166136261;for(const c of s||'')n=Math.imul(n^c.charCodeAt(0),16777619);return(n>>>0).toString(16)};
  const sample=()=>{const image=document.querySelector('.portrait-photo.current');const state={name:document.querySelector('.pet-name')?.textContent||'',identity:hash(image?.dataset.identity),ready:!!document.querySelector('.stage-ready'),previous:!!document.querySelector('.portrait-photo.previous'),kicker:document.querySelector('.header-kicker')?.textContent||'',background:document.querySelector('.home-page')?getComputedStyle(document.querySelector('.home-page')).backgroundColor:''};const key=JSON.stringify(state);if(key!==last){last=key;window.c1RuntimeTrace.push({time:Date.now(),...state})}};
  sample();window.c1RuntimeObserver=new MutationObserver(sample);window.c1RuntimeObserver.observe(document.body,{subtree:true,attributes:true,childList:true,characterData:true});
 });
 const snap=label=>fs.writeFileSync(`${out}/${label}.png`,cmd('exec-out','screencap','-p'));
 async function tab(name){mark('tab-tap',{tab:name});cmd('shell','input','tap',name==='home'?'218':name==='profile'?'1095':'654','2748');return page(name)}
 async function settled(name){await Promise.race([h.waitForFunction(n=>document.querySelector('.pet-name')?.textContent===n&&!!document.querySelector('.stage-ready'),name,{timeout:20000}),networkFailure]);}
 async function select(name){
  const p=await tab('profile');const label=p.locator('.pet-chip').filter({has:p.locator('.pet-chip-name',{hasText:name})}).locator('.pet-chip-name');
  await label.waitFor({state:'visible'});await label.scrollIntoViewIfNeeded();const r=await label.boundingBox(),width=await p.evaluate(()=>innerWidth);
  mark('select-tap',{name});cmd('shell','input','tap',String(Math.round((r.x+r.width/2)*1312/width)),String(Math.round((r.y+r.height/2)*1312/width)));
  await p.waitForFunction(n=>document.querySelector('.pet-chip-active .pet-chip-name')?.textContent===n,name);
  // Observe hidden Home BEFORE showing it. This assertion exposes the old snapshot bug.
  const hiddenName=await h.locator('.pet-name').textContent();mark('hidden-home',{expected:name,actual:hiddenName});assert.equal(hiddenName,name);
  await tab('home');await settled(name);mark('home-ready',{name});
 }
 async function record(label,actions){
  mark('record-start',{label});const proc=spawn(adb,['shell','screenrecord','--size','656x1424','--bit-rate','4000000','--time-limit','22',`/sdcard/pety-${label}.mp4`],{stdio:'ignore'});
  await sleep(500);let failure;try{await actions()}catch(e){failure=e;mark('failure',{label,message:e.message})}
  await new Promise(r=>proc.exitCode!==null?r():proc.once('exit',r));cmd('pull',`/sdcard/pety-${label}.mp4`,`${out}/${label}.mp4`);
  if(failure)throw failure;
 }
 try{
  if(process.argv.includes('--restore-dog')) {await select('狗狗');snap('native-dog-restored');return;}
  await select('Yyuy');snap('native-white');
  await record('native-switch',async()=>{for(const name of ['狗狗','Yyuy','狗狗']){await select(name);await sleep(500)}});
  snap('native-dog');
  await record('native-return',async()=>{for(const route of ['profile','chat','profile']){await tab(route);await sleep(650);await tab('home');await settled('狗狗');mark('same-pet-return',{from:route,name:'狗狗'});await sleep(500)}});
  await tab('profile');const p=await page('profile');const pets=await p.locator('.pet-chip').evaluateAll(es=>es.map(e=>({name:e.querySelector('.pet-chip-name')?.textContent,status:e.querySelector('.pet-chip-status')?.textContent})));fs.writeFileSync(`${out}/pet-relationship-coverage.json`,JSON.stringify(pets,null,2));
  await tab('home');await settled('狗狗');
 }finally{
  fs.writeFileSync(`${out}/native-events.json`,JSON.stringify(events,null,2));
  fs.writeFileSync(`${out}/image-transfers.json`,JSON.stringify({scope:'CDP WebView only; does not prove native getImageInfo/downloadFile totals',transferObserved,images:imageTransfers},null,2));
  fs.writeFileSync(`${out}/native-render-trace.json`,JSON.stringify(await h.evaluate(()=>{window.c1RuntimeObserver?.disconnect();return window.c1RuntimeTrace}),null,2));await b.close();
 }
})().catch(e=>{console.error(e.message);process.exitCode=1});
