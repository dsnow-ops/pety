// Current HBuilderX H5, disposable TEST-only context, no cloud or model traffic.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/杜冲/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const run=process.argv[2]||'h5-1';if(!/^[a-z0-9-]+$/.test(run))throw Error('Invalid run');
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
  for(const[k,v]of Object.entries({'overnight-TEST':true,guizhua_onboarding_seen:true,my_pets_list:[{id:'overnight-TEST-P1',name:'TEST 酱酱',species:'cat',status:'current',relationshipStage:'current',originalPhotoUrl:origin+'/master.png',heroDisplayMode:'original'},{id:'overnight-TEST-P2',name:'TEST 第二只',species:'dog',status:'current',relationshipStage:'current'}],current_active_pet_id:'overnight-TEST-P1'}))localStorage.setItem(k,JSON.stringify({type:typeof v==='object'?'object':typeof v,data:v}));
 },origin);
 for(const[date,text]of [['2026-10-22','TEST 十月窗边晒太阳'],['2026-09-20','TEST 九月一起看树叶'],['2025-09-10','TEST 去年喜欢的小球']]){
  await go('calendar/calendar?date='+date);await page.locator('.daily-life-input textarea').fill(text);await page.locator('.daily-life .save-btn').click();await page.reload();await page.waitForSelector('.daily-life-input textarea');assert.equal(await page.locator('.daily-life-input textarea').inputValue(),text);
 }
 result.checks.push('Three actual date-specific saves survive reload');
 for(const width of [360,390,412]){
  await page.setViewportSize({width,height:844});await go('album/album');await page.waitForSelector('.period-toggle');assert.equal(await page.locator('.entry').count(),3);await geometry();await shot('album-'+width);
  await page.locator('.period-toggle').click();await shot('directory-'+width);assert.equal(await page.locator('.period-list uni-button').count(),4);
  await page.locator('.period-list uni-button').filter({hasText:'2026年9月'}).click();assert.equal(await page.locator('.entry').count(),1);assert.match(await page.locator('.entry-text').innerText(),/九月一起看树叶/);await shot('september-'+width);
  await page.locator('.record-preview').click();await page.waitForSelector('.daily-life-input textarea');assert.equal(await page.locator('.daily-life-input textarea').inputValue(),'TEST 九月一起看树叶');
  await go('album/album');await page.locator('[aria-label="查找记录"]').click();await page.locator('.find-records input').fill('小球');assert.equal(await page.locator('.entry').count(),1);
  result.checks.push(width+': month directory -> exact original editor; keyword search; no overflow');
 }
 await go('album/album');
 // Additional date precision fixtures use the real store, separate from UI save evidence.
 await page.evaluate(()=>{const vm=window.vm('.album-page','load');for(const[id,time]of [['unknown',{precision:'unknown'}],['year',{precision:'year',year:2020}]]){const d=vm.store.create('current');d.original='TEST '+id+' 旧日片段';d.eventTime=time;d.localDate='';vm.store.save(d);}vm.refresh();});
 await page.locator('.period-toggle').click();await page.locator('.period-list uni-button').filter({hasText:'时间未详'}).click();assert.equal(await page.locator('.entry').count(),1);await shot('unknown-date');
 await page.locator('.period-clear').click();await page.locator('.period-toggle').click();await page.locator('.period-list uni-button').filter({hasText:'2020年'}).click();assert.match(await page.locator('.entry-date').innerText(),/2020年/);await shot('year-only');
 result.checks.push('Unknown and year-only fixtures stay distinct without invented exact dates');
 await page.setViewportSize({width:360,height:844});await page.locator('.period-clear').click();await page.evaluate(()=>{const v=window.vm('.album-page','load');v.uiFontScale=1.3;v.uiLargeText=true;});await page.locator('.period-toggle').click();await geometry();assert.ok(await page.locator('.period-title').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=19));await shot('directory-large-text-360');await page.locator('.period-list uni-button').filter({hasText:'2020年'}).click();assert.match(await page.locator('.entry-date').innerText(),/2020年/);result.checks.push('1.3 font-scale fixture at 360: directory remains readable and selectable');
 await go('home/home');await page.waitForSelector('.portrait-stage.stage-ready');await shot('home-locked');await geometry();
 await go('archive/archive?petId=overnight-TEST-P1');
 // Mode/owner changes are test state setup; subsequent UI interactions are real.
 await page.evaluate(()=>{const x=JSON.parse(localStorage.getItem('my_pets_list'));x.data[0].status='deceased';x.data[0].relationshipStage='deceased';localStorage.setItem('my_pets_list',JSON.stringify(x));});
 await go('album/album');await page.reload();await page.waitForSelector('.memory-album');await page.locator('.period-toggle').click();await shot('memorial-directory');assert.doesNotMatch(await page.locator('.period-browser').innerText(),/今天还没有|任务|连续/);
 await page.evaluate(()=>localStorage.setItem('current_active_pet_id',JSON.stringify({type:'string',data:'overnight-TEST-P2'})));await page.reload();await page.waitForSelector('.album-page');assert.equal(await page.locator('.period-browser').count(),0);assert.equal(await page.locator('.entry').count(),0);
 result.checks.push('Memorial neutral browsing; another pet has no previous directory or records');assert.deepEqual(result.errors,[]);
 console.log(JSON.stringify(result.checks));
})().catch(async e=>{result.failure=e.stack;await shot('failure').catch(()=>{});console.error(e);process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));await context?.close();await browser?.close();server.close();});

