'use strict';
// Run against a locally built H5 app: NODE_PATH=<bundled node_modules> node tests/avatar-tight-visual.cjs
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { PNG } = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/node_modules/pngjs');
const { makePetFixture } = require('./fixtures/transparent-pets.cjs');
const { buildTightCutout } = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/avatar-display-derivatives');
const { inspectTransparentPng } = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/storage');
const root = path.resolve(__dirname, '../unpackage/avatar-tight-h5');
const output = path.resolve(__dirname, '../unpackage/avatar-tight-qa');
fs.mkdirSync(output, { recursive: true });
const assets = new Map(), pets = [];
for (const kind of ['cat', 'dog']) {
  const raw = makePetFixture(kind), tight = buildTightCutout(raw);
  const base = `cloud://space/pet-avatar/final/${kind}/job/`;
  assets.set(`${kind}/cutout.png`, raw); assets.set(`${kind}/cutout-tight.png`, tight.buffer);
  const final = PNG.sync.read(raw);
  for (let i = 0; i < final.data.length; i += 4) {
    const a = final.data[i + 3] / 255;
    for (let c = 0; c < 3; c++) final.data[i + c] = Math.round(final.data[i + c] * a + [235, 227, 213][c] * (1 - a));
    final.data[i + 3] = 255;
  }
  assets.set(`${kind}/final.png`, PNG.sync.write(final));
  pets.push({ id: kind, name: kind === 'cat' ? '透明猫咪' : '透明小狗', avatarStatus: 'ready', generatedAvatarFileId: base+'final.png', generatedAvatarMainAssetMetadata:{width:1600,height:2200,mime:'image/png'}, generatedAvatarCutoutStatus:'SUCCEEDED', generatedAvatarCutoutAlphaValid:true, generatedAvatarCutoutFileId:base+'cutout.png', generatedAvatarCutoutMetrics:inspectTransparentPng(raw), generatedAvatarCutoutTightFileId:base+'cutout-tight.png', generatedAvatarCutoutTightMetrics:{...tight.metrics,bytes:tight.buffer.length,sourceFileId:base+'cutout.png'} });
  fs.writeFileSync(path.join(output,`${kind}-cutout-tight.png`), tight.buffer);
}
const server = http.createServer((req,res) => {
  const name = decodeURIComponent(req.url.split('?')[0]);
  if (name.startsWith('/fixture/')) { const body=assets.get(name.slice(9)); res.writeHead(body?200:404,{'Content-Type':'image/png'});res.end(body);return; }
  const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.png':'image/png'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
});
(async()=>{
  await new Promise(r=>server.listen(4178,'127.0.0.1',r));
  const browser=await chromium.launch({headless:true,channel:process.env.QA_BROWSER_CHANNEL||'msedge'});
  const receipts=[];
  try {
    const page=await browser.newPage({viewport:{width:390,height:920},reducedMotion:'reduce'});
    await page.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:4178/')?r.continue():r.abort());
    await page.goto('http://127.0.0.1:4178/'); await page.waitForTimeout(600);
    await page.evaluate(async pets=>{
      const entry=await import(document.querySelector('script[type=module]').src);
      window.qaCloud=entry.V;
      if(typeof qaCloud.getTempFileURL!=='function') throw Error('H5 cloud export changed; update harness binding');
      qaCloud.getTempFileURL=async({fileList})=>({fileList:fileList.map(file=>{ const match=file.match(/final\/(cat|dog)\/job\/(.+)$/);return{tempFileURL:location.origin+'/fixture/'+match[1]+'/'+match[2]};})});
      qaCloud.callFunction=async()=>{throw Error('Cloud functions disabled during visual QA');};
      window.put=(key,data)=>localStorage.setItem(key,typeof data==='string'?data:JSON.stringify({type:typeof data,data}));
      window.findVM=(selector,key)=>{let c=document.querySelector(selector).__vueParentComponent;while(c){if(c.proxy&&key in c.proxy)return c.proxy;c=c.parent;}throw Error('VM missing: '+key);};
      put('my_pets_list',pets);put('current_active_pet_id','cat');put('guizhua_onboarding_seen',true);
      location.hash='/pages/home/home';
    },pets);
    await page.waitForSelector('.current-frame.ready');
    for(const pet of pets)for(const width of [360,390,412]) {
      await page.setViewportSize({width,height:920});
      await page.evaluate(id=>{put('current_active_pet_id',id);findVM('.home-page','loadHomeData').loadHomeData();},pet.id);
      await page.waitForFunction(id=>document.querySelector('.pet-avatar-hero')?.__vueParentComponent && findVM('.pet-avatar-hero','petId').petId===id && findVM('.pet-avatar-hero','currentReady').currentReady,pet.id);
      await page.waitForTimeout(750);
      const geometry=await page.evaluate(()=>{
        const section=document.querySelector('.companion-hero-section'),card=document.querySelector('.companion-card-backdrop');
        const stage=document.querySelector('.pet-avatar-hero'),frame=stage.querySelector('.current-frame'),img=frame.querySelector('img');
        const sr=section.getBoundingClientRect(),cr=card.getBoundingClientRect(),s=stage.getBoundingClientRect(),f=frame.getBoundingClientRect(),cs=getComputedStyle(frame),im=getComputedStyle(img);
        return {section:{x:sr.x,y:sr.y,width:sr.width,height:sr.height,overflow:getComputedStyle(section).overflow},card:{x:cr.x,y:cr.y,width:cr.width,height:cr.height},stage:{x:s.x,y:s.y,width:s.width,height:s.height},frame:{x:f.x,y:f.y,width:f.width,height:f.height},frameBackground:cs.backgroundColor,mask:im.maskImage,filter:im.filter,source:findVM('.home-page','homeHeroAsset').homeHeroAsset.assetKind,pageText:document.querySelector('.home-page').innerText};
      });
      assert.equal(geometry.source,'cutout-tight'); assert.equal(geometry.mask,'none'); assert.equal(geometry.filter,'none'); assert.equal(geometry.frameBackground,'rgba(0, 0, 0, 0)');
      assert.equal(geometry.section.overflow,'visible');
      assert.ok(geometry.frame.x > geometry.card.x + geometry.card.width*.35,JSON.stringify(geometry));
      assert.ok(geometry.frame.y < geometry.card.y,JSON.stringify(geometry));
      assert.doesNotMatch(geometry.pageText,/function\s*\(\)|undefined|null|\{name\}/);
      const m=pet.generatedAvatarCutoutTightMetrics;
      const subjectRatio=geometry.frame.width*m.contentWidth/m.width/geometry.stage.width;
      const subjectBounds={
        left:geometry.frame.x+geometry.frame.width*m.alphaBoundingBox.minX/m.width,
        right:geometry.frame.x+geometry.frame.width*(m.alphaBoundingBox.maxX+1)/m.width,
        top:geometry.frame.y+geometry.frame.height*m.alphaBoundingBox.minY/m.height,
        bottom:geometry.frame.y+geometry.frame.height*(m.alphaBoundingBox.maxY+1)/m.height
      };
      assert.ok(subjectRatio>=.65&&subjectRatio<=.78,JSON.stringify({width,subjectRatio,geometry}));
      assert.ok(subjectBounds.left>=0 && subjectBounds.right<=width,JSON.stringify({width,subjectBounds,geometry}));
      assert.ok(subjectBounds.top>=0 && subjectBounds.bottom<=geometry.section.y+geometry.section.height,JSON.stringify({width,subjectBounds,geometry}));
      assert.ok(geometry.frame.y>=geometry.stage.y); assert.ok(geometry.frame.y+geometry.frame.height<=geometry.stage.y+geometry.stage.height);
      const visible=await page.locator('.pet-avatar-hero').screenshot({path:path.join(output,`${pet.id}-${width}-hero.png`)});
      await page.screenshot({path:path.join(output,`${pet.id}-${width}-home.png`),fullPage:true});
      await page.locator('.current-frame').evaluate(el=>el.style.visibility='hidden');
      const empty=await page.locator('.pet-avatar-hero').screenshot();
      await page.locator('.current-frame').evaluate(el=>el.style.visibility='');
      const a=PNG.sync.read(visible),b=PNG.sync.read(empty),source=PNG.sync.read(assets.get(`${pet.id}/cutout-tight.png`));
      const fx=geometry.frame.x-geometry.stage.x,fy=geometry.frame.y-geometry.stage.y;
      const radius=Math.ceil(source.width/geometry.frame.width*2);let checked=0,changed=0;
      for(let y=0;y<a.height;y++)for(let x=0;x<a.width;x++) {
        const sx=Math.floor((x-fx)/geometry.frame.width*source.width),sy=Math.floor((y-fy)/geometry.frame.height*source.height);
        let clear=true;
        for(const dy of [-radius,0,radius])for(const dx of [-radius,0,radius]){
          const px=sx+dx,py=sy+dy;if(px>=0&&py>=0&&px<source.width&&py<source.height&&source.data[(py*source.width+px)*4+3]>0)clear=false;
        }
        if(!clear)continue; checked++;const i=(y*a.width+x)*4;
        if([0,1,2].some(c=>Math.abs(a.data[i+c]-b.data[i+c])>2))changed++;
      }
      assert.ok(checked>a.width*a.height*.3);
      assert.ok(changed/checked<.001,`transparent pixels contain a rectangle: ${changed}/${checked}`);
      receipts.push({pet:pet.id,width,source:geometry.source,subjectRatio,subjectBounds,transparentPixelsChecked:checked,unexpectedBackgroundPixels:changed});
    }
    // Transparent characters and embedded master portraits both keep restrained interaction.
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.waitForTimeout(100);
    assert.notEqual(await page.locator('.hero-motion').evaluate(el=>getComputedStyle(el).animationName),'none');
    const bounds=await page.locator('.pet-avatar-hero').boundingBox();
    await page.mouse.move(bounds.x+bounds.width/2,bounds.y+100);await page.mouse.down();await page.mouse.move(bounds.x+bounds.width/2+100,bounds.y+140);
    const offsets=await page.evaluate(()=>{const v=findVM('.pet-avatar-hero','offsetX');return[v.offsetX,v.offsetY];});
    console.log('pointerReceipt',await page.evaluate(()=>{const v=findVM('.pet-avatar-hero','offsetX');return{offsets:[v.offsetX,v.offsetY],touching:v.touching,reduced:v.motionReduced,start:[v.touchStartX,v.touchStartY],bounds:document.querySelector('.pet-avatar-hero').getBoundingClientRect().toJSON()};}));
    assert.ok(Math.abs(offsets[0])>0&&Math.abs(offsets[0])<=3&&Math.abs(offsets[1])<=2);await page.mouse.up();
    await page.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await page.locator('.hero-motion').evaluate(el=>getComputedStyle(el).animationName),'none');
    await page.evaluate(()=>{const pets=JSON.parse(localStorage.getItem('my_pets_list')).data;for(const p of pets){p.generatedAvatarCutoutTightFileId='';p.generatedAvatarCutoutFileId='';}put('my_pets_list',pets);findVM('.home-page','loadHomeData').loadHomeData();});
    await page.waitForSelector('.current-frame.master-surface.ready');await page.waitForTimeout(700);
    assert.equal(await page.locator('.hero-motion').evaluate(el=>getComputedStyle(el).animationName),'none');
    assert.equal(await page.locator('.hero-glow').count(),0);
    assert.equal(await page.locator('.hero-image-current').evaluate(el=>getComputedStyle(el).maskImage),'none');
    const fallbackGeometry=await page.evaluate(()=>{
      const section=document.querySelector('.companion-hero-section').getBoundingClientRect();
      const card=document.querySelector('.companion-card-backdrop').getBoundingClientRect();
      const stage=document.querySelector('.pet-stage-area').getBoundingClientRect();
      const frame=document.querySelector('.current-frame').getBoundingClientRect();
      return {section:section.toJSON(),card:card.toJSON(),stage:stage.toJSON(),frame:frame.toJSON()};
    });
    assert.ok(fallbackGeometry.section.height<230,JSON.stringify(fallbackGeometry));
    assert.ok(Math.abs(fallbackGeometry.stage.bottom-fallbackGeometry.card.bottom)<2,JSON.stringify(fallbackGeometry));
    assert.ok(fallbackGeometry.frame.left>=fallbackGeometry.card.left+fallbackGeometry.card.width*.4,JSON.stringify(fallbackGeometry));
    await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(100);
    assert.match(await page.locator('.hero-image-current').evaluate(el=>getComputedStyle(el).animationName),/^portraitIdle(?:-[a-z0-9]+)?$/);
    const fallbackBounds=await page.locator('.pet-avatar-hero').boundingBox();
    await page.mouse.move(fallbackBounds.x+fallbackBounds.width/2,fallbackBounds.y+fallbackBounds.height/2);await page.mouse.down();await page.mouse.move(fallbackBounds.x+fallbackBounds.width*.85,fallbackBounds.y+fallbackBounds.height*.25);
    const fallbackOffsets=await page.evaluate(()=>{const v=findVM('.pet-avatar-hero','offsetX');return[v.offsetX,v.offsetY];});
    assert.ok(Math.abs(fallbackOffsets[0])>0&&Math.abs(fallbackOffsets[0])<=2&&Math.abs(fallbackOffsets[1])<=1.5,JSON.stringify(fallbackOffsets));await page.mouse.up();
    receipts.push({surface:'home-final-fallback',treatment:'interactive-portrait',embeddedInCard:true,portraitAnimation:true,parallaxClamp:[2,1.5]});
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.screenshot({path:path.join(output,'fallback-final-framed.png'),fullPage:true});
    // Workbench uses its own master policy and a fixed contain stage, including legacy portraits.
    await page.evaluate(()=>{location.hash='/pages/avatar-generate/avatar-generate';});
    await page.waitForSelector('.avatar-page');
    await page.evaluate(()=>{
      const v=findVM('.avatar-page','beginCandidatePreload');
      v.phase='generating';v.resultStage='GENERATING';v.experienceProgress=65;v.pageVisible=true;
    });
    await page.waitForSelector('.scan-grid-canvas');
    await page.waitForTimeout(240);
    const firstScanFrame=PNG.sync.read(await page.locator('.scan-grid-canvas').screenshot());
    const firstFrameCount=await page.locator('.scan-grid-canvas').evaluate(el=>findVM('.scan-grid-canvas','renderedFrameCount').renderedFrameCount);
    await page.waitForTimeout(620);
    const secondScanFrame=PNG.sync.read(await page.locator('.scan-grid-canvas').screenshot());
    const secondFrameCount=await page.locator('.scan-grid-canvas').evaluate(el=>findVM('.scan-grid-canvas','renderedFrameCount').renderedFrameCount);
    let changedScanPixels=0;
    for(let i=0;i<firstScanFrame.data.length;i+=4){
      const delta=Math.max(
        Math.abs(firstScanFrame.data[i]-secondScanFrame.data[i]),
        Math.abs(firstScanFrame.data[i+1]-secondScanFrame.data[i+1]),
        Math.abs(firstScanFrame.data[i+2]-secondScanFrame.data[i+2])
      );
      if(delta>8)changedScanPixels++;
    }
    assert.ok(secondFrameCount-firstFrameCount>=5,`scan scheduler stopped: ${firstFrameCount} -> ${secondFrameCount}`);
    assert.ok(changedScanPixels>900,`scan field is visually static: only ${changedScanPixels} pixels changed`);
    const scanShot=await page.locator('.avatar-preview-shell').screenshot({path:path.join(output,'generation-scan-grid-390.png')});
    const scanPng=PNG.sync.read(scanShot);let dark=0,iridescent=0;
    for(let i=0;i<scanPng.data.length;i+=4){
      const r=scanPng.data[i],g=scanPng.data[i+1],b=scanPng.data[i+2];
      if(r<35&&g<45&&b<65)dark++;
      if(r>105&&g>105&&b>90&&Math.max(r,g,b)-Math.min(r,g,b)<95)iridescent++;
    }
    assert.ok(dark>scanPng.width*scanPng.height*.55,`scan field is not predominantly dark: ${dark}`);
    assert.ok(iridescent>250,`scan field lacks a visible pearl and jade dot wave: ${iridescent}`);
    assert.equal(await page.locator('.particle-host').evaluate(el=>findVM('.particle-host','resolvedVariant').resolvedVariant),'scan-grid');
    receipts.push({surface:'generation',width:390,effect:'scan-grid',darkPixels:dark,iridescentPixels:iridescent,changedScanPixels,framesAdvanced:secondFrameCount-firstFrameCount,legacyPreserved:true});
    await page.evaluate(()=>{
      const v=findVM('.avatar-page','beginCandidatePreload');
      v.pet={id:'cat',name:'测试宠物'};
      v.setCandidates(['cat','dog'].map((id,i)=>({jobId:id,fileId:`cloud://space/pet-avatar/final/${id}/job/final.png`,generatedThumbnailUrl:location.origin+`/fixture/${id}/final.png`,jobKind:i?'revision':'initial',mainAssetMetadata:{width:1600,height:2200,bytes:1234567,mime:'image/png',providerOriginal:true}})));
      v.selectedJobId='cat';v.beginCandidatePreload(v.candidates[0]);
    });
    await page.waitForFunction(()=>findVM('.avatar-page','resultStage').resultStage==='RESULT_READY');
    for(const width of [360,390,412]) {
      await page.setViewportSize({width,height:920});
      await page.waitForTimeout(180); // uni-app updates rpx after the viewport resize event.
      const before=await page.locator('.avatar-preview-shell').boundingBox();
      const beforeStyle=await page.locator('.avatar-preview-shell').evaluate(e=>{const s=getComputedStyle(e);return [s.borderRadius,s.boxShadow];});
      assert.ok(Math.abs(before.width-before.height)<1);
      const fit=await page.locator('.result-image:not(.result-image-previous)').evaluate(e=>({html:e.outerHTML, layers:[...e.children].map(c=>({tag:c.tagName,fit:getComputedStyle(c).objectFit,bg:getComputedStyle(c).backgroundSize,display:getComputedStyle(c).display}))}));

      assert.ok(fit.layers.some(c=>c.bg==='contain'||c.fit==='contain'));
      await page.evaluate(()=>{
        const v=findVM('.avatar-page','chooseCandidate');
        window.qaThumbs=[...document.querySelectorAll('.candidate-image')];
        const next=v.candidates.find(c=>c.jobId!==v.previewJobId);v.chooseCandidate(next);
      });
      const during=await page.locator('.avatar-preview-shell').boundingBox();
      assert.equal(before.width,during.width);assert.equal(before.height,during.height);
      await page.waitForFunction(()=>findVM('.avatar-page','resultStage').resultStage==='RESULT_READY');
      assert.ok(await page.evaluate(()=>qaThumbs.every((e,i)=>e===document.querySelectorAll('.candidate-image')[i]&&e.isConnected)));
      await page.screenshot({path:path.join(output,`workbench-${width}.png`),fullPage:true});
      const loaded=await page.locator('.avatar-preview-shell').boundingBox();
      await page.evaluate(()=>{findVM('.avatar-page','phase').phase='loading';});
      const loading=await page.locator('.avatar-preview-shell').boundingBox();
      const afterStyle=await page.locator('.avatar-preview-shell').evaluate(e=>{const s=getComputedStyle(e);return [s.borderRadius,s.boxShadow];});
      assert.equal(loaded.width,loading.width);assert.equal(loaded.height,loading.height);assert.deepEqual(beforeStyle,afterStyle);
      await page.evaluate(()=>{findVM('.avatar-page','phase').phase='result';});
      receipts.push({surface:'workbench',width,fit:'contain',stageWidth:loaded.width,stageHeight:loaded.height,stableThumbnails:true});
    }
    fs.writeFileSync(path.join(output,'receipt.json'),JSON.stringify(receipts,null,2));
    console.log(JSON.stringify({visualCases:receipts.length,receipts},null,2));
  } finally {await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
