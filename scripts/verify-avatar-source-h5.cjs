// Real local uni-app H5 and file picker; disposable TEST profile, no cloud/model calls.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require('C:/Users/杜冲/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { assertSourceHeaderDimensions, inspectImageBuffer } = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/storage');
const origin = 'http://localhost:5173';
const out = path.resolve('docs/avatar-source-20261022', process.argv[2] || 'run-1');
if (fs.existsSync(out)) throw Error('Use a fresh evidence directory');
fs.mkdirSync(out, { recursive: true });
const results = { scope: 'Actual H5, isolated TEST pet, all external requests blocked', checks: [], errors: [] };
let browser;
(async () => {
  browser = await chromium.launch({channel:'chrome', headless:true});
  const page = await browser.newPage({viewport:{width:390,height:844}});
  page.setDefaultTimeout(15000);
  page.on('pageerror', e => results.errors.push(e.message));
  await page.route('**/*', r => r.request().url().startsWith(origin + '/') ? r.continue() : r.abort());
  await page.addInitScript(() => {
    const data = {guizhua_onboarding_seen:true, my_pets_list:[{id:'avatar-source-TEST',name:'TEST 大图',species:'cat',status:'current',relationshipStage:'current'}],current_active_pet_id:'avatar-source-TEST'};
    for (const [key,value] of Object.entries(data)) localStorage.setItem(key,JSON.stringify({type:typeof value==='object'?'object':typeof value,data:value}));
    window.avatarVm = () => {let c=document.querySelector('.avatar-page')?.__vueParentComponent;while(c&&!c.proxy?.startGeneration)c=c.parent;return c?.proxy;};
  });
  await page.goto(origin + '/#/pages/avatar-generate/avatar-generate?petId=avatar-source-TEST');
  await page.waitForSelector('.photo-slot');
  // Match the failing camera-photo dimensions with synthetic, non-user pixels.
  const fixture = await page.evaluate(() => {
    const c=document.createElement('canvas');c.width=4284;c.height=5712;
    const g=c.getContext('2d');g.fillStyle='#91866e';g.fillRect(0,0,c.width,c.height);
    g.fillStyle='#efe7d8';g.fillRect(400,600,3000,4000);
    return c.toDataURL('image/jpeg',0.95).split(',')[1];
  });
  const file=path.join(out,'TEST-2447MP.jpg');fs.writeFileSync(file,Buffer.from(fixture,'base64'));
  assert.throws(()=>assertSourceHeaderDimensions(fs.readFileSync(file)),e=>e.code==='INVALID_SOURCE_IMAGES');
  await page.locator('.photo-slot').first().click();
  const picker=page.waitForEvent('filechooser');
  await page.getByText('从相册选择',{exact:true}).click();
  await (await picker).setFiles(file);
  await page.waitForFunction(()=>window.avatarVm()?.selectedPhotoPaths.length===1);
  const prepared=await page.evaluate(async()=>{
    const source=window.avatarVm().selectedPhotoPaths[0];
    const blob=await(await fetch(source)).blob();const bitmap=await createImageBitmap(blob);
    const base64=await new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.readAsDataURL(blob);});
    const result={width:bitmap.width,height:bitmap.height,bytes:blob.size,base64};bitmap.close();return result;
  });
  assert.equal(prepared.width,1536);assert.equal(prepared.height,2048);
  const preparedBytes=Buffer.from(prepared.base64,'base64');
  assert.deepEqual(assertSourceHeaderDimensions(preparedBytes),{width:1536,height:2048});
  assert.equal(inspectImageBuffer(preparedBytes).width,1536);
  delete prepared.base64;results.prepared=prepared;
  results.checks.push('Actual picker converts oversized source to 1536x2048; production server header AND full decoder checks pass');
  // Directly exercise the same production preparation module on boundary cases.
  const cases=await page.evaluate(async()=>{
    const {prepareAvatarSourceImage}=await import('/common/avatar-source-image.js');
    const outputs=[];
    for(const [width,height] of [[1280,1707],[2048,2048],[4000,4000],[9000,100]]){
      const c=document.createElement('canvas');c.width=width;c.height=height;
      const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',0.95));const source=URL.createObjectURL(blob);
      const result=await prepareAvatarSourceImage(source);const image=await createImageBitmap(await(await fetch(result)).blob());
      outputs.push({width,height,unchanged:result===source,outWidth:image.width,outHeight:image.height});image.close();URL.revokeObjectURL(source);if(result!==source)URL.revokeObjectURL(result);
    }
    try{await prepareAvatarSourceImage('data:image/jpeg;base64,AAAA');outputs.push({invalidAccepted:true});}catch(e){outputs.push({invalidCode:e.code,stage:e.stage});}
    return outputs;
  });
  assert.equal(cases[0].unchanged,true);assert.equal(cases[1].unchanged,true);assert.equal(cases[2].outWidth,2048);assert.equal(cases[3].outWidth,2048);
  assert.equal(cases[4].invalidCode,'AVATAR_SOURCE_IMAGE_UNREADABLE');results.cases=cases;
  results.checks.push('Small and 2048-edge boundary photos retained byte-for-byte; 16MP and long panorama reduced; unreadable photo fails before upload');
  for(const width of [360,390,412]){
    await page.setViewportSize({width,height:844});
    await page.screenshot({path:path.join(out,`selection-${width}.png`),fullPage:true});
    await page.evaluate(()=>window.avatarVm().failGeneration({code:'INVALID_SOURCE_IMAGES',stage:'SOURCE_VALIDATION'}));
    await page.getByText('返回选图',{exact:true}).waitFor();
    await page.screenshot({path:path.join(out,`failure-${width}.png`),fullPage:true});
    await page.getByText('返回选图',{exact:true}).click();
    await page.waitForSelector('.photo-slot');
    assert.equal(await page.evaluate(()=>window.avatarVm().selectedPhotoPaths.length),1);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  }
  results.checks.push('360/390/412 actual selection, failure text, recovery click, retained photo and no horizontal overflow');
  assert.deepEqual(results.errors,[]);
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));
  console.log(JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();});
