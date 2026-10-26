// Read only the current Home image state. Never export URLs, tokens or storage.
const {chromium}=require('C:/Users/杜冲/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
(async()=>{
 const browser=await chromium.connectOverCDP('http://127.0.0.1:9227',{timeout:10000});
 try {
  const diagnostics=[];
  const pages=browser.contexts()[0].pages();
  console.log('App WebViews:',await Promise.all(pages.map(async p=>({title:await p.title(),surface:await p.evaluate(()=>({visible:document.visibilityState,uni:typeof uni,cloud:typeof uniCloud,getApp:typeof getApp,getCurrentPages:typeof getCurrentPages}))}))));
  for(const p of pages)p.on('console',msg=>{
   const text=msg.text();if(!text.includes('[AvatarUrlState]'))return;
   try {const a=JSON.parse(text.slice(text.indexOf('{')));diagnostics.push({kind:a.kind,hasUrl:a.hasUrl,boundHasUrl:a.boundHasUrl,fallbackReason:a.fallbackReason});}catch(_){}
  });
  if(process.argv.includes('--return')){
   const adb='D:/HBuilderX/plugins/launcher-tools/tools/adbs/adb.exe';
   execFileSync(adb,['shell','input','tap','1095','2748']);
   await new Promise(r=>setTimeout(r,600));
   execFileSync(adb,['shell','input','tap','218','2748']);
   await new Promise(r=>setTimeout(r,4000));
  }
  for(const page of browser.contexts()[0].pages()) {
   if(!(await page.title()).includes('pages/home/'))continue;
   const state=await page.evaluate(()=>{
    const root=document.querySelector('.home-page');const components=[];
    let vm=root?.__vueParentComponent;
    while(vm){const p=vm.proxy;if(p){for(const key of ['heroAsset','homeHeroAsset','heroVisualAsset','heroDisplayAsset']){
     const a=p[key];if(a&&typeof a==='object')components.push({key,source:a.sourceType||a.assetKind,fallbackReason:a.fallbackReason,hasUrl:!!a.imageUrl,urlRuntime:a.urlRuntime});
    }}vm=vm.parent;}
    return {name:document.querySelector('.pet-name')?.textContent,ready:!!document.querySelector('.stage-ready'),placeholder:document.querySelector('.portrait-placeholder')?.textContent,
     images:[...document.querySelectorAll('.portrait-photo')].map(i=>({tag:i.tagName,hasBoundUrl:!!i.dataset.url,childTags:[...i.children].map(c=>c.tagName),width:i.querySelector('img')?.naturalWidth||0})),components};
   });
   state.diagnostics=diagnostics;
   fs.writeFileSync('unpackage/home-c1-runtime-device/current-image-state.json',JSON.stringify(state,null,2));console.log(JSON.stringify(state));
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e.name);process.exitCode=1});
