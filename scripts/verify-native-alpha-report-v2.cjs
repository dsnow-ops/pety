const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/杜冲/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const label=process.argv[2];if(!/^[a-z0-9-]+$/.test(label||''))throw Error('Fresh evidence label required');
(async()=>{
 const out=path.resolve('docs/overnight-20261023',label),summary=JSON.parse(fs.readFileSync('experiments/native-alpha-20261023/summary.json','utf8'));
 if(fs.existsSync(out))throw Error('Fresh evidence required');fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1360,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route(/^https?:/,r=>r.abort());
  await page.goto(pathToFileURL(path.resolve('experiments/native-alpha-20261023/report.html')).href);await page.locator('article').last().waitFor();
  assert.equal(await page.locator('article').count(),summary.sampleCount);assert.ok(await page.locator('img').evaluateAll(imgs=>imgs.every(i=>i.complete&&i.naturalWidth>0)));
  await page.getByText('白色背景',{exact:true}).click();assert.equal(await page.locator('.asset').first().evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 255, 255)');
  await page.getByText('深暖背景',{exact:true}).click();await page.screenshot({path:path.join(out,'desktop.png')});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.screenshot({path:path.join(out,'mobile.png')});
  await page.locator('article').last().scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'latest-sample-mobile.png')});assert.deepEqual(errors,[]);
  if(summary.sampleCount===7){await page.setViewportSize({width:1000,height:900});const pair=page.locator('.refs').first();assert.equal(await pair.locator('img').count(),2);assert.match(await pair.locator('img').last().getAttribute('src'),/pro-identity-v6-01/);await pair.screenshot({path:path.join(out,'v3-v6-comparison.png')});}
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({at:new Date().toISOString(),imagesLoaded:true,sampleCards:summary.sampleCount,backgroundControl:true,mobileNoOverflow:true,errors},null,2));console.log(JSON.stringify({sampleCards:summary.sampleCount,passed:true}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
