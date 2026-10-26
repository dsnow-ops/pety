// Native verification is separate. This only verifies the browser's tab adapter.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('C:/Users/杜冲/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out='unpackage/home-c1-runtime';fs.mkdirSync(out,{recursive:true});
const source=fs.readFileSync('pages/home/home.vue','utf8').match(/<script>([\s\S]*?)<\/script>/)[1].replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g,'').replace('export default','return');
const home=Function('PetAvatarHero','PetPortraitStage','hasDiaryRecord',source)({},{},()=>false);
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
  await page.goto('http://127.0.0.1:4190');await page.waitForSelector('.stage-ready');
  assert.equal(await page.locator('.preview-nav span').nth(1).textContent(),'问诊');
  const copy=Object.fromEntries(['headerKicker','heroCardActionText','todayPanelTitle','secondaryActions'].map(key=>[key,home.computed[key].call({isMemorialMode:true,hasGeneratedAvatar:true,activePet:{id:'white'},todayRecord:null})]));
  await page.evaluate(copy=>{review.isMemorialMode=true;Object.assign(review,copy);review.todayPrimaryText='写下今天的想念';},copy);
  await page.waitForFunction(()=>document.querySelector('.preview-nav span:nth-child(2)').textContent==='信笺');
  await page.screenshot({path:out+'/browser-memorial-fixed.png'});
  await page.evaluate(()=>{review.isMemorialMode=false;review.headerKicker='正在陪伴';});
  await page.waitForFunction(()=>document.querySelector('.preview-nav span:nth-child(2)').textContent==='问诊');
  console.log('Browser adapter follows existing native localized tab config in both directions. Native memorial remains a separate verification.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
