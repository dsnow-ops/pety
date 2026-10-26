// Browser boundary evidence only; native captures are collected separately.
const fs=require('fs'),assert=require('assert/strict');
const {chromium}=require('C:/Users/杜冲/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out='unpackage/home-c1';
const src=fs.readFileSync('pages/home/home.vue','utf8').match(/<script>([\s\S]*?)<\/script>/)[1].replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g,'').replace('export default','return');
const home=Function('PetAvatarHero','PetPortraitStage','hasDiaryRecord',src)({}, {},()=>false);
(async()=>{const b=await chromium.launch({headless:true,channel:'msedge'});const p=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});const rows=[];
async function scene(pet,width,label,{name='',scale=1,memorial=false}={}){
 await p.setViewportSize({width,height:844});await p.goto('http://127.0.0.1:4190');
 const ctx={isMemorialMode:memorial,hasGeneratedAvatar:true,activePet:{id:pet},todayRecord:null};
 const copy=Object.fromEntries(['headerKicker','heroCardActionText','todayPanelTitle','secondaryActions'].map(k=>[k,home.computed[k].call(ctx)]));
 await p.evaluate(({pet,name,scale,memorial,copy})=>{review.swap(pet,'space');review.nameOverride=name;review.homeLargeText=scale>1.15;review.isMemorialMode=memorial;Object.assign(review,copy);review.todayPrimaryText=memorial?'写下今天的想念':'记录今天';},{pet,name,scale,memorial,copy});
 await p.waitForSelector('.stage-ready');await p.waitForTimeout(180);
 if(scale!==1)await p.evaluate(scale=>{for(const el of document.querySelectorAll('.pet-name,.header-kicker,.today-date,.today-title,.today-primary-action,.space-caption,.space-chat-action'))el.style.fontSize=parseFloat(getComputedStyle(el).fontSize)*scale+'px'},scale);
 const result=await p.evaluate(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,b:r.bottom,right:r.right}};return{image:rect('.portrait-photo.current'),stage:rect('.portrait-stage'),header:rect('.home-header'),record:rect('.today-panel'),button:rect('.today-primary-action'),reserved:review.spaceReservedHeader,top:review.palette.topTextureSafe,bottom:review.palette.bottomTextureSafe,natural:[document.querySelector('.portrait-photo.current').naturalWidth,document.querySelector('.portrait-photo.current').naturalHeight],pageOverflow:document.documentElement.scrollWidth>innerWidth}});
 assert.equal(result.pageOverflow,false);assert.ok(result.image.x>=result.stage.x-1&&result.image.right<=result.stage.right+1);assert.ok(result.image.y>=result.stage.y-1&&result.image.b<=result.stage.b+1);assert.ok(Math.abs(result.image.w/result.image.h-result.natural[0]/result.natural[1])<.01);
 if(name.length>12||scale>1.15){assert.equal(result.reserved,true);assert.ok(result.header.b<=result.stage.y+1)}
 assert.ok(result.button.b<=result.record.b+1);
 if(pet==='reference'){assert.equal(result.reserved,true);assert.notEqual(result.top,true);}
 await p.screenshot({path:`${out}/browser-${label}.png`,fullPage:false});rows.push({label,pet,width,nameLength:name.length,fontScale:scale,memorial,...result});
}
for(const pet of ['white','dog','gray'])for(const width of [360,390,412])await scene(pet,width,`${pet}-${width}`);
for(const width of [360,390,412]){await scene('white',width,`long-cn-${width}`,{name:'陪伴我们很多很多年的可爱小猫咪'});await scene('dog',width,`long-en-${width}`,{name:'Sir Beagle the Gentle Companion'});}
for(const scale of [1.5,2])await scene('white',360,`large-${scale}`,{name:'陪伴我们很多很多年的小猫咪',scale});
await scene('gray',390,'memorial',{memorial:true});await scene('reference',390,'complex-photo');
fs.writeFileSync(`${out}/browser-coverage.json`,JSON.stringify(rows,null,2));console.log('19 browser boundary scenes passed. Large text is browser font enlargement, not Android system-font verification.');await b.close();})().catch(e=>{console.error(e);process.exitCode=1});
