'use strict';
// Actual compiled H5 UI; cloud transport deliberately mocked, all external hosts blocked.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/杜冲/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve('unpackage/care-photo-v1/build/h5'),out=path.resolve('unpackage/care-photo-v1');
const server=http.createServer((req,res)=>{let p;try{p=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));}catch(_){res.writeHead(400).end();return;}if(!p.startsWith(root+path.sep)&&p!==root){res.writeHead(403).end();return;}if(fs.existsSync(p)&&fs.statSync(p).isDirectory())p=path.join(p,'index.html');if(!fs.existsSync(p)){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{let browser;const checks=[],errors=[];
 try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
  await page.addInitScript(()=>{const put=(key,data)=>localStorage.setItem(key,JSON.stringify({type:typeof data==='object'?'object':typeof data,data}));put('guizhua_onboarding_seen',true);put('my_pets_list',[{id:'care_review_pet',name:'测试宠物',species:'cat',status:'current',relationshipStage:'current'}]);put('current_active_pet_id','care_review_pet');put('pety_ai_data_consent_v1',{version:1,accepted:true,providerScopes:{deepseek_chat:true,pet_avatar:true}});put('care_photo_consent_v1',true);});
  await page.goto(origin+'/#/pages/chat/chat');await page.waitForSelector('.chat-page');
  const installMock=()=>page.evaluate(()=>{window.careVM=()=>{let c=document.querySelector('.chat-page').__vueParentComponent;while(c){if(c.proxy&&'sendCarePhotos'in c.proxy)return c.proxy;c=c.parent;}throw Error('Chat VM missing');};window.mockCareCalls=[];uniCloud.callFunction=async args=>{window.mockCareCalls.push(args.data);return{result:{code:422,errorCode:'PROVIDER_AUTH',requestId:'ui-mock-request'}};};});
  await installMock();
  const chooser=page.waitForEvent('filechooser');await page.locator('.round-tool').click();await(await chooser).setFiles(path.join(out,'synthetic-non-pet.png'));
  await page.waitForFunction(()=>!window.careVM().$refs.carePhotoComposer.picking);
  if(!await page.locator('.photo-thumb').count()){await page.screenshot({path:path.join(out,'h5-picker-failure.png')});throw Error('Picker: '+await page.locator('.photo-composer').innerText()+'; errors='+errors.join('|'));}
  assert.equal(await page.locator('.photo-thumb').count(),1);assert.equal(await page.evaluate(()=>window.mockCareCalls.length),0);checks.push('real local file selected/rasterized; selecting never sends');
  await page.locator('.purpose-row').getByText('检查报告',{exact:true}).click();assert.equal(await page.evaluate(()=>window.careVM().careDraft.purpose),'report');
  await page.locator('.purpose-row').getByText('患处照片',{exact:true}).click();await page.locator('.chat-input textarea').fill('皮肤发红，出现两天');
  await page.screenshot({path:path.join(out,'h5-draft-mocked.png')});
  await page.locator('.send-btn').click();await page.waitForFunction(()=>window.careVM().careError.includes('授权'));
  assert.equal(await page.locator('.photo-thumb').count(),1);assert.equal(await page.locator('.chat-input textarea').inputValue(),'皮肤发红，出现两天');checks.push('purpose correction; failed mocked request retains photo and text');
  await page.screenshot({path:path.join(out,'h5-error-mocked.png')});
  await page.reload();await page.waitForSelector('.photo-thumb');await installMock();
  await page.waitForFunction(()=>document.querySelector('.chat-input textarea')?.value==='皮肤发红，出现两天');
  assert.equal(await page.locator('.chat-input textarea').inputValue(),'皮肤发红，出现两天');checks.push('reload restores the same pet photo/text/request draft');
  // Restore the failure message by checking the retained receipt (still mocked).
  await page.locator('.send-btn').click();await page.waitForFunction(()=>window.careVM().careError.includes('授权'));
  const real=JSON.parse(fs.readFileSync(path.join(out,'real-response-revalidated.json'),'utf8'));
  await page.evaluate(analysis=>{uniCloud.callFunction=async args=>{window.mockCareCalls.push(args.data);return args.data.requestType==='carePhotoAnalyze'?{result:{code:0,requestId:'ui-mock-replay',analysis}}:{result:{code:503,errorCode:'WEB_SEARCH_NOT_EXECUTED'}};};},real.analysis);
  await page.getByText('重试一次',{exact:true}).click();await page.waitForSelector('.photo-result');
  assert.equal(await page.locator('.photo-thumb').count(),0);assert.equal(await page.locator('.photo-result').count(),1);checks.push('saved real non-pet response rendered through mocked transport; search failure independent');
  for(const width of [320,390,430]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(600);await page.screenshot({path:path.join(out,'h5-result-mocked.png'),fullPage:true});checks.push('320/390/430 widths no horizontal overflow');
  const input=await page.locator('.input-bar').boundingBox(),tabs=await page.locator('.uni-tabbar').boundingBox();assert.ok(input.y+input.height<=tabs.y+2);checks.push('composer above tab bar');
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'h5-ui-evidence.json'),JSON.stringify({scope:'Actual compiled H5, mocked cloud responses, no real cloud/auth/device test',checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
 }finally{if(browser)await browser.close();server.close();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
