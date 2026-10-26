// Actual compiled H5 app with isolated guest fixtures and a local URL resolver.
// Never sends a consultation, submits generation, or contacts an external host.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/杜冲/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out='unpackage/lumiere-ui-20260927',fixture=path.join(out,'h5/__review');fs.mkdirSync(fixture,{recursive:true});
for(const [name,source] of [['white','unpackage/stage-review/device-master-0.png'],['dog','unpackage/stage-review/device-master-1.png'],['gray','unpackage/hero-e2e/master.png']])if(fs.existsSync(source))fs.copyFileSync(source,path.join(fixture,name+'.png'));
(async()=>{
 const b=await chromium.launch({channel:'msedge',headless:true});globalThis.reviewBrowser=b;const p=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
 const blocked=[],errors=[],checks=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:4196')?r.continue():(blocked.push(new URL(r.request().url()).hostname),r.abort()));
 await p.addInitScript(()=>{localStorage.setItem('guizhua_onboarding_seen',JSON.stringify({type:'boolean',data:true}));window.reviewRejections=[];window.addEventListener('unhandledrejection',e=>window.reviewRejections.push(JSON.stringify(e.reason)));});
 await p.goto('http://127.0.0.1:4196/#/pages/home/home');await p.waitForSelector('.home-page');
 await p.evaluate(()=>{
  window.uiVm=(selector,method)=>{let c=document.querySelector(selector)?.__vueParentComponent;while(c){if(c.proxy&&method in c.proxy)return c.proxy;c=c.parent;}throw Error('Missing component '+selector)};
  window.urlCalls=0;uniCloud.getTempFileURL=async({fileList})=>{window.urlCalls++;return {fileList:fileList.map(fileID=>({fileID,tempFileURL:location.origin+'/__review/'+fileID+'.png?Expires=9999999999'}))}};
  const pets=[{id:'white',name:'Yyuy',breed:'布偶猫',species:'cat'},{id:'dog',name:'狗狗',breed:'比格犬',species:'dog'},{id:'gray',name:'团团',species:'cat'}].map(p=>({...p,status:'current',relationshipStage:'current',avatarStatus:'ready',generatedAvatarFileId:p.id,generatedAvatarMainAssetMetadata:{width:2048,height:2048}}));
  localStorage.setItem('my_pets_list',JSON.stringify({type:'object',data:pets}));localStorage.setItem('current_active_pet_id',JSON.stringify({type:'string',data:'white'}));window.uiVm('.home-page','loadHomeData').loadHomeData();
 });
 await p.waitForSelector('.stage-ready');await p.screenshot({path:out+'/h5-home-white.png'});checks.push('white master decoded');
 const original=await p.locator('.portrait-photo.current').getAttribute('src');
 await p.locator('.brand-switch').click();await p.waitForSelector('.profile-page');
 await p.screenshot({path:out+'/h5-profile.png'});
 for(const pet of ['狗狗','Yyuy','狗狗']){
  await p.locator('.pet-chip').filter({has:p.locator('.pet-chip-name',{hasText:pet})}).locator('.pet-chip-name').click();
  await p.locator('.uni-tabbar__item').filter({hasText:'首页'}).click();await p.waitForSelector('.home-page .stage-ready');
  assert.equal(await p.locator('.pet-name').textContent(),pet);checks.push('switch '+pet);
  if(pet==='狗狗'){await p.waitForTimeout(1700);assert.equal(await p.evaluate(()=>window.uiVm('.portrait-stage','sample').palette.edgeVersion),2,'pet switch must restore the edge palette');await p.screenshot({path:out+'/h5-home-dog.png'});}
  await p.locator('.brand-switch').click();await p.waitForSelector('.profile-page');
 }
 await p.locator('.uni-tabbar__item').filter({hasText:'首页'}).click();await p.waitForSelector('.home-page .stage-ready');
 const callsBefore=await p.evaluate(()=>window.urlCalls);
 for(let n=0;n<5;n++){await p.locator('.brand-switch').click();await p.waitForSelector('.profile-page');await p.locator('.uni-tabbar__item').filter({hasText:'首页'}).click();await p.waitForSelector('.home-page .stage-ready');}
 assert.equal(await p.evaluate(()=>window.urlCalls),callsBefore);checks.push('five returns without URL resolution');
 await p.evaluate(()=>{window.uiVm('.home-page','loadHomeData').petName='这是一只拥有很长很长昵称的毛孩子';});
 for(const width of [320,390,430]){await p.setViewportSize({width,height:844});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await p.screenshot({path:out+'/h5-home-long-name.png'});checks.push('long name: 320, 390, 430 widths');
 await p.setViewportSize({width:390,height:844});
 await p.locator('.home-shortcut').nth(1).click();await p.waitForSelector('.chat-page');
 await p.locator('.suggestion-item').first().click();await p.waitForFunction(()=>document.querySelector('textarea')?.value.length>0);checks.push('suggestion fills composer');
 await p.evaluate(()=>{const v=window.uiVm('.chat-page','applySuggestion');v.inputText='';v.promptPanelCollapsed=true;v.messageList=[{id:'fixture-q',type:'user',content:'它最近吃得比以前少，精神还不错，我该观察些什么？'},{id:'fixture-a',type:'ai',content:'可以先把食量、饮水和精神状态记下来。\n\n也留意是否伴随呕吐、腹泻或明显疼痛。如果持续异常，建议联系兽医进一步检查。',medicalNotice:true}];});
 await p.waitForTimeout(1700);await p.screenshot({path:out+'/h5-chat-conversation.png'});
 const composer=await p.locator('.input-bar').boundingBox(),tabbar=await p.locator('.uni-tabbar').boundingBox();assert.ok(composer.y+composer.height<=tabbar.y+2,'composer must stay above H5 tab bar');
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));checks.push('conversation and composer fit');
 await p.locator('.uni-tabbar__item').filter({hasText:'首页'}).click();await p.locator('.home-shortcut').nth(0).click();await p.waitForSelector('.avatar-page');
 await p.screenshot({path:out+'/h5-generation-select.png'});
 await p.evaluate(()=>{const v=window.uiVm('.avatar-page','stopUiTimers');v.stopUiTimers();v.phase='generating';v.experienceProgress=68;v.pageVisible=true;v.reduceMotion=true;});
 await p.waitForSelector('.generation-immersive');await p.screenshot({path:out+'/h5-generation-processing.png'});checks.push('isolated generation at 68 percent; no provider job');
 await p.evaluate(()=>{const v=window.uiVm('.avatar-page','stopUiTimers');v.phase='result';v.visibleResultUrl=location.origin+'/__review/dog.png';v.visibleResultJobId='fixture';v.resultStage='RESULT_READY';});await p.waitForSelector('.avatar-page .stage-ready');
 await p.screenshot({path:out+'/h5-generation-result.png'});checks.push('generation return to light review');
 await p.locator('.back-button').click();await p.waitForSelector('.home-page');
 await p.evaluate(()=>{const v=window.uiVm('.home-page','loadHomeData');const pets=JSON.parse(localStorage.getItem('my_pets_list')).data;pets.push({id:'missing',name:'小满',status:'current',avatarStatus:'ready',generatedAvatarFileId:'missing'});localStorage.setItem('my_pets_list',JSON.stringify({type:'object',data:pets}));localStorage.setItem('current_active_pet_id',JSON.stringify({type:'string',data:'missing'}));v.loadHomeData();});
 await p.waitForSelector('.portrait-placeholder');await p.screenshot({path:out+'/h5-image-unavailable.png'});assert.ok(await p.locator('.portrait-retry').isVisible());checks.push('unavailable photo retains placeholder and retry');
 const rejections=await p.evaluate(()=>window.reviewRejections);fs.writeFileSync(out+'/h5-review.json',JSON.stringify({checks,blockedExternalHosts:[...new Set(blocked)],errors,rejections,scope:'actual H5 build; isolated fixtures and synthetic conversation/generation state; no live provider calls'},null,2));
 console.log(JSON.stringify({checks,blockedHosts:[...new Set(blocked)],errors},null,2));await b.close();
})().catch(async e=>{console.error(e);await globalThis.reviewBrowser?.close();process.exitCode=1});
