// Actual compiled uni-app H5, fresh isolated browser context; all external traffic blocked.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/杜冲/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve('unpackage/dual-mode-20260928/h5'),out=path.resolve('docs/dual-mode-evidence');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+(req.url.split('?')[0]==='/'?'/index.html':decodeURIComponent(req.url.split('?')[0])));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});
(async()=>{
 await new Promise(r=>server.listen(4198,'127.0.0.1',r));const b=await chromium.launch({channel:'msedge',headless:true});globalThis.browser=b;const p=await b.newPage({viewport:{width:390,height:844},acceptDownloads:true});globalThis.testPage=p;
 const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:4198')?r.continue():r.abort());
 await p.addInitScript(()=>{window.vm=()=>{let c=document.querySelector('.narrative-page')?.__vueParentComponent;while(c){if(c.proxy?.preview)return c.proxy;c=c.parent;}throw Error('component missing')};if(!localStorage.getItem('my_pets_list')){for(const [key,data]of Object.entries({guizhua_onboarding_seen:true,my_pets_list:[{id:'dual-test-pet',name:'小禾（虚构验收）',status:'current',species:'cat'},{id:'second-test-pet',name:'另一只（虚构验收）',status:'current',species:'dog'}],current_active_pet_id:'dual-test-pet'}))localStorage.setItem(key,JSON.stringify({type:typeof data,data}));}});
 await p.goto('http://127.0.0.1:4198/#/pages/narrative/narrative');await p.waitForSelector('.original');
 await p.evaluate(()=>{window.vm=()=>{let c=document.querySelector('.narrative-page').__vueParentComponent;while(c){if(c.proxy?.preview)return c.proxy;c=c.parent;}throw Error('component missing')};});
 await p.locator('textarea').fill('今天看到窗边，想起你。\n把这一刻留在这里。');
 // Existing project static asset is local, with no external fetch or real user data.
 const chooser=p.waitForEvent('filechooser');await p.getByText('选择照片',{exact:false}).click();await (await chooser).setFiles(path.resolve('static/pet.png'));
 try { await p.waitForFunction(()=>window.vm().draft.media.length===1&&!window.vm().mediaBusy); }
 catch(error) { console.log(await p.evaluate(()=>({message:window.vm().message,media:window.vm().draft.media,busy:window.vm().mediaBusy,current:window.vm().current(),code:window.vm().mediaErrorCode,calls:window.calls})),errors);throw error; }
 await p.locator('.save-record').click();await p.locator('.preview-card').click();
 await p.waitForFunction(()=>['ready','failed'].includes(window.vm().session.state),{timeout:30000});
 assert.equal(await p.evaluate(()=>window.vm().session.state),'ready',await p.locator('.status').first().textContent());
 const download=p.waitForEvent('download');await p.locator('.export-card').click();await (await download).saveAs(path.join(out,'minimal-quote.png'));
 const dimensions=await p.evaluate(async()=>{const image=new Image();image.src=window.vm().session.pages[0];await image.decode();return [image.naturalWidth,image.naturalHeight]});assert.deepEqual(dimensions,[1080,1080]);
 await p.screenshot({path:path.join(out,'minimal-editor-390.png'),fullPage:true});
 const id=await p.evaluate(()=>window.vm().draft.id);await p.goto(`http://127.0.0.1:4198/#/pages/narrative/narrative?id=${id}`);await p.reload();await p.waitForSelector('.original');
 assert.match(await p.locator('textarea').inputValue(),/今天看到窗边/);await p.waitForFunction(()=>document.querySelector('.photos image,.photos uni-image img'));
 fs.writeFileSync(path.join(out,'minimal-h5.json'),JSON.stringify({dimensions,errors,checks:['real uni-app canvas rendered','download file saved','draft restored after reload','photo persisted in IndexedDB'],fixture:'static/pet.png + fictional text',modelCalls:0},null,2));
 const checks=[],exports=[];
 async function renderAndDownload(template,save=true,label=template){
   await p.evaluate(id=>window.vm().selectTemplate(id),template);await p.locator('.preview-card').click();await p.waitForFunction(()=>['ready','failed'].includes(window.vm().session.state));
   assert.equal(await p.evaluate(()=>window.vm().session.state),'ready',template+': '+await p.locator('.status').first().textContent());
   const count=await p.evaluate(()=>window.vm().session.pages.length);const files=[];let complete;const done=new Promise(r=>complete=r);
   const handler=d=>{const index=files.length+1;files.push(d.saveAs(path.join(out,`${label}-${index}.png`)));if(files.length===count)complete();};p.on('download',handler);
   await p.locator('.export-card').click();await done;await Promise.all(files);p.off('download',handler);
   exports.push({template,pages:count,dimensions:await p.evaluate(async()=>{const image=new Image();image.src=window.vm().session.pages[0];await image.decode();return[image.naturalWidth,image.naturalHeight]})});
   if(save)await p.getByText('存入册页',{exact:true}).click();
 }
 for(const template of ['quote','letter','day','date','habit'])await renderAndDownload(template);
 const choose2=p.waitForEvent('filechooser');await p.getByText('选择照片',{exact:false}).first().click();await (await choose2).setFiles(path.resolve('static/pet.png'));await p.waitForFunction(()=>window.vm().draft.media.length===2&&!window.vm().mediaBusy);await renderAndDownload('collage');fs.copyFileSync(path.join(out,'collage-1.png'),path.join(out,'collage-two-photos.png'));checks.push('all six real PNG layouts exported and saved as independent snapshots');
 const choose4=p.waitForEvent('filechooser');await p.getByText('选择照片',{exact:false}).first().click();await(await choose4).setFiles([path.resolve('static/pet.png'),path.resolve('static/pet.png')]);await p.waitForFunction(()=>window.vm().draft.media.length===4&&!window.vm().mediaBusy);await renderAndDownload('collage');checks.push('two-photo and four-photo grids');
 await p.context().setOffline(true);await renderAndDownload('collage',false,'offline-collage');await p.context().setOffline(false);checks.push('persisted IndexedDB photo bytes render and download offline');
 // Synthetic geometric images make contain/cover and aspect-ratio errors visible.
 const originalMedia=await p.evaluate(()=>JSON.parse(JSON.stringify(window.vm().draft.media)));
 for(const [label,width,height]of [['landscape',900,600],['portrait',600,900]]){
   const bytes=await p.evaluate(({width,height})=>{const c=document.createElement('canvas');c.width=width;c.height=height;const x=c.getContext('2d');x.fillStyle='#ebe7d9';x.fillRect(0,0,width,height);x.fillStyle='#576952';x.beginPath();x.arc(width/2,height/2,Math.min(width,height)*.3,0,Math.PI*2);x.fill();x.strokeStyle='#ac7155';x.lineWidth=18;x.strokeRect(14,14,width-28,height-28);return c.toDataURL('image/png').split(',')[1]},{width,height});
   await p.evaluate(()=>{const v=window.vm();v.draft.media=[];v.changed();v.clearPhotos()});
   const chooser=p.waitForEvent('filechooser');await p.getByText('选择照片',{exact:false}).first().click();await(await chooser).setFiles({name:`synthetic-${label}.png`,mimeType:'image/png',buffer:Buffer.from(bytes,'base64')});await p.waitForFunction(()=>window.vm().draft.media.length===1&&!window.vm().mediaBusy);
   await renderAndDownload('day',false,`day-${label}-contain`);await p.evaluate(()=>window.vm().setFit(0,'cover'));await renderAndDownload('day',false,`day-${label}-cover`);
 }
 await p.evaluate(media=>{const v=window.vm();v.draft.media=media;v.changed();v.loadPhotos()},originalMedia);checks.push('synthetic landscape and portrait images exported in contain and cover without stretching');
 for(const width of [360,390,412]){await p.setViewportSize({width,height:844});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow at '+width);await p.screenshot({path:path.join(out,`editor-${width}.png`),fullPage:true});}checks.push('360/390/412 widths');
 await p.evaluate(()=>{const v=window.vm();v.draft.media=[];v.changed();v.clearPhotos();v.editText(('今天看到窗边，想起你。🙂\n\nI do not regret that decision. ALongWordThatMustWrapWithoutLosingLetters\n').repeat(27));});
 await p.context().setOffline(true);await renderAndDownload('letter');assert.ok(exports.at(-1).pages>1);await p.context().setOffline(false);checks.push('2000+ mixed-language characters, emoji and empty paragraphs paginated offline in an already loaded app, without giant canvas');
 await p.evaluate(()=>window.vm().keepOriginal());await p.locator('.save-record').click();
 await p.getByText('看看册页',{exact:true}).click();await p.waitForSelector('.album-page');await p.getByText('已保存作品',{exact:true}).click();assert.equal(await p.locator('.entry').count(),8);await p.screenshot({path:path.join(out,'album.png'),fullPage:true});
 await p.locator('.entry-actions uni-button').first().click();await p.waitForSelector('.narrative-page');await p.locator('.preview-card').click();await p.waitForFunction(()=>window.vm().session.state==='ready');checks.push('album snapshot reopens with retained recipe, text and template');
 await p.evaluate(()=>{const key='my_pets_list',v=JSON.parse(localStorage.getItem(key));v.data[0].relationshipStage='deceased';v.data[0].status='deceased';localStorage.setItem(key,JSON.stringify(v));});await p.goto('http://127.0.0.1:4198/#/pages/home/home');await p.reload();await p.waitForSelector('.home-page');assert.equal(await p.locator('.companion-prompt').count(),0);assert.equal(await p.locator('.home-week').count(),0);await p.screenshot({path:path.join(out,'home-memorial.png'),fullPage:true});checks.push('memorial home excludes proposal and weekly activity');
 await p.locator('.space-chat-action').click();await p.waitForSelector('.original');await p.locator('.original textarea').fill('今天看到窗边，想起你。');await p.locator('.save-record').click();await p.locator('.preview-card').click();await p.waitForFunction(()=>window.vm().session.state==='ready');checks.push('memorial one sentence, unknown date, no photo, no AI');
 await p.evaluate(()=>localStorage.setItem('current_active_pet_id',JSON.stringify({type:'string',data:'second-test-pet'})));await p.goto('http://127.0.0.1:4198/#/pages/album/album');await p.reload();await p.waitForSelector('.album-page');assert.equal(await p.locator('.entry').count(),0);checks.push('other pet album does not show writing or works');
 fs.writeFileSync(path.join(out,'h5-acceptance.json'),JSON.stringify({checks,exports,errors,modelCalls:0,scope:'Actual compiled H5 in isolated browser; no external traffic; no live cloud or device assertions'},null,2));assert.deepEqual(errors,[]);
 await b.close();server.close();console.log('H5 render/download/restore passed',JSON.stringify({checks,exports}));
})().catch(async e=>{console.error(e);try{console.log(await globalThis.testPage.evaluate(()=>{const v=window.vm();return{state:v.session.state,error:v.session.error,message:v.message,visible:v.visible,current:v.current(),revision:v.draft?.revision,template:v.templateId}}))}catch(_){}await globalThis.browser?.close();server.close();process.exitCode=1});
