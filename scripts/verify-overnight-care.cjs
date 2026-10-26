// Current HBuilderX H5, disposable TEST-only context, no cloud or model traffic.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/杜冲/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const run=process.argv[2]||'care-h5-1';if(!/^[a-z0-9-]+$/.test(run))throw Error('Invalid run');
const root=path.resolve('unpackage/overnight-20261023',process.argv[3]||'round-12','h5'),out=path.resolve('docs/overnight-20261023',run);
if(fs.existsSync(out))throw Error('Fresh evidence directory required');fs.mkdirSync(out,{recursive:true});
const master=path.resolve('unpackage/hero-e2e/master.png');
const server=http.createServer((req,res)=>{const name=decodeURIComponent(req.url.split('?')[0]),file=name==='/master.png'?master:path.resolve(root,'.'+(name==='/'?'/index.html':name));if((file!==master&&!file.startsWith(root+path.sep))||!fs.existsSync(file))return res.writeHead(404).end();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});
let browser,context,page,origin,visit=0;
const result={scope:'Real compiled H5; actual editor saves; isolated TEST pets; external traffic blocked',checks:[],errors:[],console:[],screenshots:[],at:new Date().toISOString()};
async function go(route){await page.goto(origin+'/?visit='+(++visit)+'#/pages/'+route);await page.waitForTimeout(400);}
async function shot(name){await page.screenshot({path:path.join(out,name+'.png')});result.screenshots.push(name+'.png');}
async function geometry(){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({channel:'msedge',headless:true});context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Shanghai'});page=await context.newPage();page.setDefaultTimeout(12000);
 page.on('pageerror',e=>result.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')result.console.push(m.text().slice(0,300))});
 await page.route('**/*',r=>r.request().url().startsWith(origin+'/')||r.request().url().startsWith('blob:')?r.continue():r.abort());
 await page.addInitScript(origin=>{
  window.vm=(s,m)=>{let c=[...document.querySelectorAll(s)].find(e=>e.getBoundingClientRect().width)?.__vueParentComponent;while(c){if(c.proxy&&m in c.proxy)return c.proxy;c=c.parent;}throw Error('Missing component '+s);};
  if(localStorage.getItem('overnight-TEST'))return;
  for(const[k,v]of Object.entries({'overnight-TEST':true,guizhua_onboarding_seen:true,'consultation_records_overnight-TEST-P1':[{id:'TEST-consult-1',createdAt:1792600000000,question:'TEST 昨天食欲和平常不一样，想把后续情况记下来。',answerExcerpt:'TEST 占位原咨询，不是实际模型结果。'}],my_pets_list:[{id:'overnight-TEST-P1',name:'TEST 酱酱',species:'cat',status:'current',relationshipStage:'current',originalPhotoUrl:origin+'/master.png',heroDisplayMode:'original'},{id:'overnight-TEST-P2',name:'TEST 第二只',species:'dog',status:'current',relationshipStage:'current'}],current_active_pet_id:'overnight-TEST-P1'}))localStorage.setItem(k,JSON.stringify({type:typeof v==='object'?'object':typeof v,data:v}));
 },origin);

 await go('care/care');await page.waitForSelector('.followup-row');
 for(const[note,status]of [['TEST 昨天未呕吐，食量有变化。',1],['TEST 今天已就医，尚未开始用药。',2]]){
  await page.locator('.followup-row > uni-button').last().click();await page.locator('.followup-form textarea').fill(note);await page.locator('.followup-options uni-button').nth(status).click();assert.equal(await page.locator('.followup-save').innerText(),'记下这次观察');await page.locator('.followup-save').click();await page.waitForSelector('.care-history');assert.match(await page.locator('.care-history').innerText(),new RegExp(note));
 }
 await page.reload();await page.waitForSelector('.history-toggle');await page.locator('.history-toggle').click();assert.equal(await page.locator('.history-entry').count(),2);assert.match(await page.locator('.care-history').innerText(),/昨天未呕吐/);assert.match(await page.locator('.care-history').innerText(),/尚未开始用药/);
 result.checks.push('Two actual followup saves persist and reopen as distinct historical observations, no model calls');
 for(const width of [360,390,412]){await page.setViewportSize({width,height:844});await page.locator('.followups').scrollIntoViewIfNeeded();await geometry();await shot('care-history-'+width);await page.locator('.followup-row > uni-button').last().click();assert.equal(await page.locator('.followup-form textarea').inputValue(),'');await page.locator('.followup-form').scrollIntoViewIfNeeded();await shot('care-new-entry-'+width);await page.locator('.followup-cancel').click();}
 result.checks.push('360/390/412 history and new-entry form; blank new note, cancel preserves saved history');
 await page.setViewportSize({width:360,height:844});await page.evaluate(()=>{const v=window.vm('.care-page','loadCare');v.uiFontScale=1.3;v.uiLargeText=true;});await page.locator('.followups').scrollIntoViewIfNeeded();await geometry();assert.ok(await page.locator('.history-note').first().evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=19));await shot('care-history-large-text-360');await page.locator('.followup-add').click();await page.locator('.followup-form').scrollIntoViewIfNeeded();await shot('care-form-large-text-360');await page.locator('.followup-cancel').click();result.checks.push('1.3 font-scale fixture at 360: actual history font enlarges and form remains usable');
 await page.evaluate(()=>{const x=JSON.parse(localStorage.getItem('my_pets_list'));x.data[0].status='deceased';x.data[0].relationshipStage='deceased';localStorage.setItem('my_pets_list',JSON.stringify(x));});await page.reload();await page.waitForSelector('.history-toggle');await page.locator('.history-toggle').click();assert.equal(await page.locator('.followup-row > uni-button').count(),1);await page.locator('.followups').scrollIntoViewIfNeeded();await shot('care-memorial-history');
 await page.evaluate(()=>localStorage.setItem('current_active_pet_id',JSON.stringify({type:'string',data:'overnight-TEST-P2'})));await page.reload();await page.waitForSelector('.care-page');assert.equal(await page.locator('.followups').count(),0);result.checks.push('Memorial can read saved history; another pet never sees it');assert.deepEqual(result.errors,[]);console.log(JSON.stringify(result.checks));
})().catch(async e=>{result.failure=e.stack;await shot('failure').catch(()=>{});console.error(e);process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));await context?.close();await browser?.close();server.close();});
