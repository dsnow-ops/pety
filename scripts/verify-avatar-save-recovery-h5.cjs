// Actual uni-app H5; isolated TEST pet and simulated storage failure. No cloud calls.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/杜冲/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const origin='http://localhost:5173',out=path.resolve('docs/avatar-generation-recovery-20261022',process.argv[2]||'h5-1');
if(fs.existsSync(out))throw Error('Use fresh evidence directory');fs.mkdirSync(out,{recursive:true});
let browser;const results={scope:'Real H5 with isolated TEST pet; storage failure injected, external requests blocked',widths:[],errors:[]};
(async()=>{
 browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
 page.on('pageerror',e=>results.errors.push(e.message));
 await page.addInitScript(()=>{
  const data={guizhua_onboarding_seen:true,my_pets_list:[{id:'avatar-save-TEST',name:'TEST',species:'cat',status:'current',relationshipStage:'current'}],current_active_pet_id:'avatar-save-TEST'};
  for(const [key,value]of Object.entries(data))localStorage.setItem(key,JSON.stringify({type:typeof value==='object'?'object':typeof value,data:value}));
  window.avatarVm=()=>{let c=document.querySelector('.avatar-page')?.__vueParentComponent;while(c&&!c.proxy?.pollJob)c=c.parent;return c?.proxy};
 });
 await page.goto(origin+'/#/pages/avatar-generate/avatar-generate?petId=avatar-save-TEST');await page.waitForSelector('.photo-slot');
 for(const width of [360,390,412]){
  await page.setViewportSize({width,height:844});
  await page.evaluate(async()=>{
   const {saveAvatarJob}=await import('/common/pet-avatar-generator.js');saveAvatarJob({petId:'avatar-save-TEST',jobId:'existing-TEST-job',status:'PENDING'});
   const v=window.avatarVm();v.stopUiTimers();v.phase='generating';v.resultStoragePending=true;v.experienceProgress=90;
   // Isolate scheduler only, preserving the real click handler and retained job.
   window.scheduled=[];v.schedulePoll=d=>window.scheduled.push(d);
  });
  await page.getByText('正在保存形象',{exact:true}).first().waitFor();
  await page.screenshot({path:path.join(out,`saving-${width}.png`),fullPage:true});
  await page.evaluate(()=>window.avatarVm().failGeneration({code:'RESULT_SAVE_PENDING',stage:'RESULT_STORAGE'}));
  await page.getByText('检查已有结果',{exact:true}).waitFor();await page.screenshot({path:path.join(out,`recovery-${width}.png`),fullPage:true});
  await page.getByText('检查已有结果',{exact:true}).click();
  const state=await page.evaluate(async()=>{const {getStoredAvatarJob}=await import('/common/pet-avatar-generator.js');const v=window.avatarVm();const s={phase:v.phase,job:getStoredAvatarJob(v.pet.id).jobId,scheduled:window.scheduled,overflow:document.documentElement.scrollWidth>innerWidth+1};v.stopUiTimers();return s;});
  assert.equal(state.phase,'generating');assert.equal(state.job,'existing-TEST-job');assert.deepEqual(state.scheduled,[100]);assert.equal(state.overflow,false);results.widths.push({width,...state});
 }
 assert.deepEqual(results.errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close()});
