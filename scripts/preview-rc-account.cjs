// Actual account SFC, isolated local data only. No cloud, phone or user data.
const fs=require('node:fs'),http=require('node:http');
const {parse,compileTemplate}=require('D:/HBuilderX/plugins/uniapp-cli-vite/node_modules/@vue/compiler-sfc');
const {chromium}=require('C:/Users/杜冲/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out='unpackage/rc-20260921/account-preview';fs.mkdirSync(out,{recursive:true});const files={};
for(const [variant,path] of [['before','unpackage/rc-20260921/baseline/source/pages/account/account-security.vue'],['after','pages/account/account-security.vue']]){
 const d=parse(fs.readFileSync(path,'utf8')).descriptor;
 const template=d.template.content.replace(/<(\/?)(view|text|scroll-view)(?=[\s>])/g,(_,slash,tag)=>`<${slash}${tag==='text'?'span':'div'}`).replace(/<uni-icons[^>]*><\/uni-icons>/g,'<span aria-hidden="true">›</span>').replace(/<checkbox([^>]*)\/>/g,'<input type="checkbox"$1/>');
 const render=compileTemplate({source:template,id:'account',filename:path}).code.replace(/from "vue"/g,'from "/vue.js"');
 const script=d.script.content.replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g,'').replace('export default','const component =');
 files[`/${variant}.js`]=`import {createApp} from '/vue.js';
 const getCurrentUser=()=>({loggedIn:true});const getAuthCapabilities=()=>Object.fromEntries(['wechatLogin','appleLogin','oneClickLogin','accountCancellation'].map(k=>[k,{reason:'暂未配置',status:k==='appleLogin'?'UNSUPPORTED_PLATFORM':'NOT_CONFIGURED'}]));
 ${script}\n${render}
 component.render=render;component.mixins=[{data:()=>({petThemeClass:'',appThemeStyle:{}})}];window.preview=createApp(component).mount('#app');
 Object.assign(window.preview,{loading:false,securityInfo:{loggedIn:true,nickname:'测试账号',maskedUserId:'测试样本',loginMethod:'手机号',maskedMobile:'测试号码',isPasswordSet:false},guestImport:{status:'pending',count:2}});`;
 files[`/${variant}.css`]=d.styles.map(s=>s.content).join('\n').replace(/([\d.]+)rpx/g,(_,n)=>`calc(${n} * 100vw / 750)`)+`\n*{box-sizing:border-box}body{margin:0;font-family:Arial,'Microsoft YaHei',sans-serif}button,input{font-family:inherit}button{border:0}.preview-label{padding:7px 14px;background:#eee9e1;color:#584e43;font-size:11px}.account-page{--status-bar-height:22px}`;
 files[`/${variant}`]=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/${variant}.css"><div class="preview-label">浏览器隔离预览 · 虚构样本 · 无云端调用</div><div id="app"></div><script type="module" src="/${variant}.js"></script>`;
}
files['/vue.js']=fs.readFileSync('D:/HBuilderX/plugins/uniapp-cli-vite/node_modules/vue/dist/vue.esm-browser.js','utf8');
(async()=>{const server=http.createServer((req,res)=>{const value=files[req.url];if(!value){res.writeHead(404);res.end();return}res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript':req.url.endsWith('.css')?'text/css':'text/html; charset=utf-8');res.end(value)});await new Promise(r=>server.listen(0,'127.0.0.1',r));let b;
 try{b=await chromium.launch({headless:true,channel:'msedge'});const results=[];
 for(const width of [360,390,412])for(const variant of ['before','after']){
  const p=await b.newPage({viewport:{width,height:844},deviceScaleFactor:1}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(`http://127.0.0.1:${server.address().port}/${variant}`);await p.waitForFunction(()=>window.preview);
  await p.screenshot({path:`${out}/${variant}-${width}.png`,fullPage:true});results.push({variant,width,errors,overflow:await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});
  if(variant==='after'){await p.evaluate(()=>{window.preview.guestImport={status:'imported',count:2};for(const e of document.querySelectorAll('button,.state-title,.state-desc,.page-title,.row'))e.style.fontSize=parseFloat(getComputedStyle(e).fontSize)*1.3+'px'});await p.screenshot({path:`${out}/imported-large-${width}.png`,fullPage:true});results.push({variant:'imported-large',width,overflow:await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});}
  await p.close();
 }
 fs.writeFileSync(`${out}/coverage.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results));if(results.some(r=>r.errors?.length||r.overflow))process.exitCode=1;
 }finally{await b?.close();server.close()}
})().catch(e=>{console.error(e.message);process.exitCode=1});
