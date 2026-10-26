// Real Android interactions. No synthetic pets, messages, or generation jobs.
const fs=require('node:fs'),cp=require('node:child_process'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('C:/Users/杜冲/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const adb='D:/HBuilderX/plugins/launcher-tools/tools/adbs/adb.exe',out='unpackage/lumiere-ui-20260927';
const cmd=(...args)=>cp.execFileSync(adb,args,{timeout:15000,maxBuffer:20000000});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function foreground(){assert.match(cmd('shell','dumpsys','window').toString().split('\n').find(x=>x.includes('mCurrentFocus'))||'',/io\.dcloud\.HBuilder/,'Stop if the user moves to another app');}
(async()=>{
 const b=await chromium.connectOverCDP('http://127.0.0.1:9230');globalThis.reviewBrowser=b;
 const pages=b.contexts()[0],checks=[];
 const find=async name=>{for(let n=0;n<50;n++){for(const p of pages.pages())if((await p.title()).includes('pages/'+name+'/'))return p;await delay(150);}throw Error('Missing page '+name)};
 const home=await find('home');const original=await home.locator('.pet-name').textContent();
 const size=cmd('shell','wm','size').toString().match(/(\d+)x(\d+)/);const width=+size[1],height=+size[2];
 const tap=async(x,y)=>{foreground();cmd('shell','input','tap',String(Math.round(x)),String(Math.round(y)));await delay(250)};
 const tab=async(name)=>{await tap(width*({home:1/6,chat:.5,profile:5/6}[name]),height-100);return find(name)};
 const tapElement=async(p,selector)=>{const el=p.locator(selector);await el.scrollIntoViewIfNeeded();const r=await el.boundingBox(),w=await p.evaluate(()=>innerWidth);await tap((r.x+r.width/2)*width/w,(r.y+r.height/2)*width/w)};
 const shot=label=>{foreground();fs.writeFileSync(out+'/'+label+'.png',cmd('exec-out','screencap','-p'))};
 const loaded=async name=>{await home.waitForFunction(n=>document.querySelector('.pet-name')?.textContent===n&&!!document.querySelector('.stage-ready')&&[...document.querySelectorAll('.portrait-photo.current img')].some(i=>i.complete&&i.naturalWidth>0),name,{timeout:25000});};
 const identity=async()=>{const src=await home.locator('.portrait-photo.current img').getAttribute('src');assert.ok(src,'decoded native image must expose an actual source');return crypto.createHash('sha256').update(src).digest('hex').slice(0,12)};
 const homeTop=async()=>{await home.evaluate(()=>{for(const e of document.querySelectorAll('.home-scroll, .uni-scroll-view'))e.scrollTop=0});await delay(250)};
 await tab('home');await loaded(original);await homeTop();shot('native-home-final');
 const profile=await tab('profile');await profile.waitForSelector('.membership-banner');await delay(500);shot('native-profile-final');
 const names=await profile.locator('.pet-chip-name').allTextContents();const sources={};
 for(const name of [...names.filter(n=>n!==original).slice(0,2),original]){
  await tab('profile');const el=profile.locator('.pet-chip').filter({has:profile.locator('.pet-chip-name',{hasText:name})}).locator('.pet-chip-name');await el.scrollIntoViewIfNeeded();const r=await el.boundingBox(),w=await profile.evaluate(()=>innerWidth);await tap((r.x+r.width/2)*width/w,(r.y+r.height/2)*width/w);
  await tab('home');await loaded(name);sources[name]=await identity();checks.push('native switch, decoded local image: '+name);await delay(1600);shot('native-pet-'+Object.keys(sources).length);
 }
 const stable=await identity();
 for(const destination of ['profile','chat','profile']){await tab(destination);await delay(400);await tab('home');await loaded(original);assert.equal(await identity(),stable);checks.push('same local resource after '+destination);}
 const chat=await tab('chat');await chat.waitForSelector('.input-bar');shot('native-chat-final');
 await tapElement(chat,'.chat-input');await delay(900);
 const keyboard=cmd('shell','dumpsys','input_method').toString();const keyboardShown=/mInputShown=true|isInputViewShown=true/.test(keyboard);checks.push('keyboard visible: '+keyboardShown);shot('native-chat-keyboard');
 const keyboardLayout=await chat.evaluate(()=>({height:innerHeight,headerTop:document.querySelector('.chat-header').getBoundingClientRect().top,inputBottom:document.querySelector('.input-bar').getBoundingClientRect().bottom}));
 if(keyboardShown){assert.ok(keyboardLayout.headerTop>=0,'header stays in resized webview');assert.ok(keyboardLayout.inputBottom<=keyboardLayout.height+1,'composer stays inside resized webview');}checks.push('keyboard layout: '+JSON.stringify(keyboardLayout));
 if(keyboardShown){foreground();cmd('shell','input','keyevent','4');await delay(350);}
 await tab('home');await loaded(original);await homeTop();shot('native-home-final');
 fs.writeFileSync(out+'/native-review.json',JSON.stringify({checks,keyboardShown,localSourceHashes:sources,restoredOriginalPet:true,scope:'Android taps and system screenshots. Hash stability is not a measurement of total native CDN bytes.'},null,2));
 console.log(JSON.stringify({checks,keyboardShown,restoredOriginalPet:true}));await b.close();
})().catch(async e=>{console.error(e);await globalThis.reviewBrowser?.close();process.exitCode=1});
