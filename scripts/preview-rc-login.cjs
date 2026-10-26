// Local-only rendering of the real login SFC. No cloud calls, credentials or SMS.
const fs=require('node:fs'),http=require('node:http');
const {parse,compileTemplate}=require('D:/HBuilderX/plugins/uniapp-cli-vite/node_modules/@vue/compiler-sfc');
const {chromium}=require('C:/Users/杜冲/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out='unpackage/rc-20260921/login-preview';fs.mkdirSync(out,{recursive:true});
const files={};
for(const [variant,path] of [['after','pages/auth/login.vue'],['before','unpackage/rc-20260921/baseline/source/pages/auth/login.vue']]){
 if(!fs.existsSync(path))continue;
 const d=parse(fs.readFileSync(path,'utf8')).descriptor;
 const template=d.template.content.replace(/<(\/?)(view|text)(?=[\s>])/g,(_,slash,tag)=>`<${slash}${tag==='view'?'div':'span'}`).replace(/<image\b/g,'<img').replace(/<\/image>/g,'').replace(/<uni-icons[^>]*><\/uni-icons>/g,'<span aria-hidden="true">○</span>');
 const render=compileTemplate({source:template,id:'login',filename:path}).code.replace(/from "vue"/g,'from "/vue.js"');
 const script=d.script.content.replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g,'').replace('export default','const component =');
 files[`/${variant}.js`]=`import {createApp} from '/vue.js';
 const uniCloud={importObject:()=>({createCaptcha:async()=>{throw Error('Preview: no cloud access')}})};
 const uni={showToast(){}};const getAppLocale=()=> 'zh-Hans';const getAuthCapabilities=()=>({smsLogin:{available:false},appleLogin:{status:'UNSUPPORTED_PLATFORM'}});
 const getSmsSendState=()=>({remaining:0,status:'idle',pending:false});
 ${script}\n${render}
 component.render=render;component.mixins=[{data:()=>({petThemeClass:'',appThemeStyle:{}})}];window.preview=createApp(component).mount('#app');`;
 const css=d.styles.map(s=>s.content).join('\n').replace(/([\d.]+)rpx/g,(_,n)=>`calc(${n} * 100vw / 750)`);
 files[`/${variant}.css`]=css+`\n*{box-sizing:border-box}body{margin:0;font-family:Arial,'Microsoft YaHei',sans-serif}button,input{font-family:inherit;border:0}button:disabled{cursor:default}input{outline:none}.preview-label{padding:7px 14px;background:#eee9e1;color:#584e43;font-size:11px}.auth-page{--status-bar-height:22px}`;
 files[`/${variant}`]=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/${variant}.css"><div class="preview-label">浏览器隔离预览 · 无短信 / 云端调用</div><div id="app"></div><script type="module" src="/${variant}.js"></script>`;
}
files['/vue.js']=fs.readFileSync('D:/HBuilderX/plugins/uniapp-cli-vite/node_modules/vue/dist/vue.esm-browser.js','utf8');
(async()=>{const server=http.createServer((req,res)=>{const value=files[req.url];if(!value){res.writeHead(404);res.end();return}res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript':req.url.endsWith('.css')?'text/css':'text/html; charset=utf-8');res.end(value)});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let b;try{b=await chromium.launch({headless:true,channel:'msedge'})}catch(e){server.close();throw e}const results=[];
 try{for(const width of [360,390,412])for(const variant of ['before','after']){
  if(!files['/'+variant])continue;
  const p=await b.newPage({viewport:{width,height:844},deviceScaleFactor:1});const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(`http://127.0.0.1:${server.address().port}/${variant}`);await p.waitForFunction(()=>window.preview);
  await p.screenshot({path:`${out}/${variant}-${width}.png`,fullPage:true});
  results.push({variant,width,errors,overflow:await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});
  if(variant==='after'){
   await p.evaluate(()=>{window.preview.capabilities={...window.preview.capabilities,smsLogin:{available:true}};window.preview.smsStatus='unknown';window.preview.countdown=48;window.preview.needCaptcha=true});
   await p.screenshot({path:`${out}/sms-challenge-${width}.png`,fullPage:true});
   await p.evaluate(()=>{for(const e of document.querySelectorAll('input,button,.field-label,.auth-subtitle,.sms-status,.agreement-copy')){e.style.fontSize=parseFloat(getComputedStyle(e).fontSize)*1.3+'px'}});
   await p.screenshot({path:`${out}/sms-large-${width}.png`,fullPage:true});
   results.push({variant:'sms-large',width,overflow:await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});
  }
  await p.close();
 }}finally{await b.close();server.close()}
 fs.writeFileSync(`${out}/coverage.json`,JSON.stringify(results,null,2));if(results.some(r=>r.errors?.length||r.overflow))process.exitCode=1;console.log(JSON.stringify(results));
})().catch(e=>{console.error(e.message);process.exitCode=1});
