const {chromium}=require('C:/Users/杜冲/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4190');
 for(const pet of ['white','dog','gray'])for(const [label,mode] of [['A','studio'],['B','ambient'],['C','space']]){
  await page.evaluate(({pet,mode})=>review.swap(pet,mode),{pet,mode});
  await page.waitForFunction(()=>document.querySelector('.stage-ready')&&review.palette.blend);
  await page.waitForTimeout(350);
  const metrics=await page.evaluate(()=>{const image=document.querySelector('.portrait-photo.current'),stage=document.querySelector('.pet-stage-area');return{pet:review.pet,mode:review.mode,width:document.documentElement.scrollWidth,imageWidth:image.naturalWidth,mask:getComputedStyle(image).maskImage,radius:getComputedStyle(stage).borderRadius,bg:getComputedStyle(document.querySelector('.home-page')).backgroundColor}});
  assert.equal(metrics.width,390);assert.equal(metrics.pet,pet);assert.equal(metrics.imageWidth,2048);
  if(mode==='space'){assert.equal(metrics.mask,'none');assert.equal(metrics.radius,'0px');}
  await page.screenshot({path:`unpackage/home-c/browser-${pet}-${label}.png`});console.log(pet,label,JSON.stringify(metrics));
 }
 for(const width of [360,412]){
  await page.setViewportSize({width,height:844});await page.evaluate(()=>review.swap('dog','space'));await page.waitForTimeout(350);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:`unpackage/home-c/browser-dog-C-${width}.png`});
 }
 await page.locator('.space-chat-action').click();await page.locator('.today-primary-action').click();assert.equal(await page.evaluate(()=>review.clicks),2);
 await page.evaluate(()=>{review.swap('white','space');review.swap('gray','space');review.swap('dog','space')});await page.waitForFunction(()=>document.querySelector('.stage-ready'));
 assert.equal(await page.evaluate(()=>review.pet),'dog');assert.deepEqual(errors,[]);
 console.log('9 A/B/C scenes, 2 additional widths, CTA and rapid owner switches passed');await browser.close();
})();
