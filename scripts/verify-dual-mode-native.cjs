// Isolated synthetic draft within the currently resolved owner; no auth changes,
// no pet-list changes, no cloud calls. Removes only IDs created by this run.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/杜冲/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const adb='D:/HBuilderX/plugins/launcher-tools/tools/adbs/adb.exe',out=path.resolve('docs/dual-mode-evidence');
const cmd=(...args)=>cp.execFileSync(adb,args,{timeout:15000,maxBuffer:8000000});
const draftId='dual_native_test_'+Date.now();let b,home,native;
const foreground=()=>assert.match(cmd('shell','dumpsys','window').toString().split('\n').find(x=>x.includes('mCurrentFocus'))||'',/io\.dcloud\.HBuilder/);
(async()=>{
 const pid=cmd('shell','pidof','io.dcloud.HBuilder').toString().trim();cmd('forward','tcp:9230','localabstract:webview_devtools_remote_'+pid);
 b=await chromium.connectOverCDP('http://127.0.0.1:9230');for(const page of b.contexts()[0].pages())if((await page.title()).includes('pages/home/'))home=page;if(!home)throw Error('Home is not active');
 await home.evaluate(async id=>{
  const read=k=>{const raw=plus.storage.getItem(k);try{const value=JSON.parse(raw);return value&&typeof value==='object'&&'data'in value?value.data:value}catch{return raw}};
  const profile=read('pety_user_profile_cache'),token=read('uni_id_token'),expiry=Number(read('uni_id_token_expired'));
  if(token&&expiry>Date.now()&&!profile?.userId)throw Error('Unresolved owner; stop');
  const ns=token&&expiry>Date.now()&&profile?.loggedIn?'account:'+profile.userId:'guest:local',prefix=ns==='guest:local'?'':'pety_owner_v1:'+encodeURIComponent(ns)+':';
  const pets=read(prefix+'my_pets_list')||[],petId=read(prefix+'current_active_pet_id')||pets[0]?.id;
  if(!petId||!pets.some(p=>p.id===petId))throw Error('No current pet; stop');
  const key=prefix+'pet_diaries_'+petId+'_creative_v1',prior=read(key);
  const document=prior||{version:1,drafts:{},records:{},works:{},receipts:{},proposals:{},followups:{},mediaGarbage:[]};
  if(document.drafts[id]||document.records[id])throw Error('Fixture ID collision');
  const file=await new Promise((ok,fail)=>plus.io.resolveLocalFileSystemURL('_www/static/pet.png',ok,fail));
  const fs=await new Promise((ok,fail)=>plus.io.requestFileSystem(plus.io.PRIVATE_DOC,ok,fail));
  const folder=await new Promise((ok,fail)=>fs.root.getDirectory('pety-narrative-media',{create:true},ok,fail));
  const photo=await new Promise((ok,fail)=>file.copyTo(folder,id+'.png',ok,fail));
  const now=Date.now();document.drafts[id]={id,petId,namespace:ns,revision:1,baseRevision:0,kind:'letter',mode:'deceased',original:'今天看到窗边，想起你。\n这一页是虚构的原生验收样本。',text:'今天看到窗边，想起你。\n这一页是虚构的原生验收样本。',title:'原生导出验收',hidePetName:true,hidden:true,media:[{id:id+'_photo',namespace:ns,petId,durable:true,backend:'sandbox',path:photo.toLocalURL(),fit:'contain'}],tags:[],localDate:'',dateText:'',createdAt:now,updatedAt:now};
  plus.storage.setItem(key,JSON.stringify({type:'object',data:document}));
  // Receipt holds a key, never exported; cleanup is narrowly scoped to our ID.
  plus.storage.setItem(id+'_cleanup',JSON.stringify({key,wasAbsent:!prior,photo:photo.toLocalURL()}));
 },draftId);
 foreground();await home.locator('.album-link').click();
 const album=await new Promise((resolve,reject)=>{const start=Date.now();const timer=setInterval(async()=>{for(const p of b.contexts()[0].pages())if((await p.title()).includes('pages/album/')){clearInterval(timer);resolve(p);return;}if(Date.now()-start>15000){clearInterval(timer);reject(Error('Native album did not open'))}},150)});
 await album.locator('.entry').filter({hasText:'原生导出验收'}).locator('.entry-actions uni-button').first().click();
 native=await new Promise((resolve,reject)=>{const start=Date.now();const timer=setInterval(async()=>{for(const p of b.contexts()[0].pages())if((await p.title()).includes('pages/narrative/')){clearInterval(timer);resolve(p);return;}if(Date.now()-start>20000){clearInterval(timer);reject(Error('Native editor did not open'))}},150)});
 await native.waitForSelector('.preview-card');foreground();await native.locator('.preview-card').click();
 await native.waitForSelector('.previews uni-image,.previews img',{timeout:30000});
 const imagePath=await native.locator('.previews img').first().getAttribute('src');assert.ok(imagePath);
 // Read only our generated file from the known app sandbox; no user album scan.
 const localPath=await native.evaluate(src=>plus.io.convertLocalFileSystemURL(src),imagePath);
 assert.match(localPath,/io\.dcloud\.HBuilder/);const target=path.join(out,'native-quote.png');cmd('pull',localPath,target);
 const png=fs.readFileSync(target),dimensions=[png.readUInt32BE(16),png.readUInt32BE(20)];assert.deepEqual(dimensions,[1080,1080]);
 foreground();await native.locator('.export-card').click();
 await native.waitForFunction(()=>document.body.textContent.includes('保存步骤完成')||document.body.textContent.includes('部分页面未能保存'),{timeout:25000});
 const saved=await native.evaluate(()=>document.body.textContent.includes('保存步骤完成'));
 fs.writeFileSync(path.join(out,'native-acceptance.json'),JSON.stringify({dimensions,rendered:true,albumSave:saved,fixture:'static/pet.png and fictional text; pet name hidden',modelCalls:0,scope:'Real Android development base; one template only; seeded durable fixture; source picking not exercised'},null,2));console.log(JSON.stringify({rendered:true,dimensions,albumSave:saved}));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{
 if(b){const page=b.contexts()[0].pages()[0];try{await native?.evaluate(()=>uni.navigateBack());await page.evaluate(async id=>{
  const raw=plus.storage.getItem(id+'_cleanup');if(!raw)return;const receipt=JSON.parse(raw),value=JSON.parse(plus.storage.getItem(receipt.key));const data=value.data;
  delete data.drafts[id];delete data.records[id];for(const [key,w]of Object.entries(data.works||{}))if(w.sources?.some(s=>s.id===id))delete data.works[key];
  const isEmpty=Object.entries(data).filter(([key])=>key!=='version').every(([,value])=>Object.keys(value||{}).length===0);
  if(receipt.wasAbsent&&isEmpty)plus.storage.removeItem(receipt.key);else plus.storage.setItem(receipt.key,JSON.stringify({type:'object',data}));
  await new Promise((ok,fail)=>plus.io.resolveLocalFileSystemURL(receipt.photo,e=>e.remove(ok,fail),fail));plus.storage.removeItem(id+'_cleanup');
 },draftId);console.log('Synthetic draft and source photo cleaned; original pet/account unchanged');}catch(e){console.error('Fixture cleanup requires review:',e.message);process.exitCode=1;}await b.close();}
});
