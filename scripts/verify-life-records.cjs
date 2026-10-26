// Compiled application only. Fresh TEST browser profile; external requests blocked.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('C:/Users/杜冲/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const phase = process.argv[2] || 'before';
const root = path.resolve(`unpackage/life-records-20261016/${phase}/h5`);
const out = path.resolve(`docs/life-records-20261016/${phase}`);
fs.mkdirSync(out, { recursive: true });
const server = http.createServer((req, res) => {
  const name = decodeURIComponent(req.url.split('?')[0]);
  const file = name === '/fixture.png' ? path.resolve('unpackage/visual-v2-20260928/fixtures/authorized-photo.png') : path.resolve(root, '.' + (name === '/' ? '/index.html' : name));
  if ((!file.startsWith(root + path.sep) && name !== '/fixture.png') || !fs.existsSync(file)) return res.writeHead(404).end();
  res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
let browser, activePage;
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  activePage=page;page.setDefaultTimeout(12000);
  const errors = [], checks = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', r => r.request().url().startsWith(origin) ? r.continue() : r.abort());
  await page.addInitScript(origin => {
    window.vm = (selector, method) => {
      let c = [...document.querySelectorAll(selector)].find(e => e.getBoundingClientRect().width)?.__vueParentComponent;
      while (c) { if (c.proxy && method in c.proxy) return c.proxy; c = c.parent; }
      throw Error('Component unavailable: ' + selector);
    };
    if (!localStorage.getItem('life-records-TEST')) {
      const entries = { 'life-records-TEST': true, guizhua_onboarding_seen: true, my_pets_list: [
        { id: 'life-TEST-P1', name: 'TEST 小禾', species: 'cat', status: 'current', relationshipStage: 'current', originalPhotoUrl: origin + '/fixture.png', heroDisplayMode: 'original' },
        { id: 'life-TEST-P2', name: 'TEST 第二只', species: 'dog', status: 'current', relationshipStage: 'current' }
      ], current_active_pet_id: 'life-TEST-P1' };
      for (const [k, data] of Object.entries(entries)) localStorage.setItem(k, JSON.stringify({ type: typeof data === 'object' ? 'object' : typeof data, data }));
    }
  }, origin);
  const go = async route => { await page.goto(origin + '/?testRoute='+encodeURIComponent(route)+'#/pages/' + route); await page.waitForTimeout(900); };
  const shot = async name => page.screenshot({ path: path.join(out, name + '.png') });
  await go('home/home'); await page.waitForSelector('.today-panel'); await shot('home');
  await go('calendar/calendar?date=2026-10-10'); await page.waitForSelector('.daily-flow'); await shot('record');
  await page.evaluate(() => { const v = window.vm('.calendar-page', 'saveRecord'); v.form.lifeText = 'TEST 窗边的一刻。\n没有吃新食物。'; });
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => window.vm('.calendar-page', 'saveRecord').saveRecord()), true);
  await page.evaluate(() => window.vm('.calendar-page', 'composeDay').composeDay());
  await page.waitForSelector('.composition-page');
  await page.waitForFunction(() => ['ready', 'failed'].includes(window.vm('.composition-page', 'preview').session.state));
  await shot('work');
  checks.push({ check: 'Current compiled home, record and work screens captured', fixture: 'Fresh browser context, TEST P1/P2', result: 'PASS' });
  if (phase !== 'before') {
    await go('calendar/calendar?date=2026-10-10');
    const original='TEST 窗边的一刻。\n没有吃新食物。';
    assert.equal(await page.locator('.daily-life-input textarea').inputValue(),original);
    // Genuine file picker and IndexedDB bytes; no mock persistence callback.
    const chooser=page.waitForEvent('filechooser');await page.locator('.daily-photo-button').click();
    await (await chooser).setFiles(path.resolve('unpackage/visual-v2-20260928/fixtures/authorized-photo.png'));
    await page.waitForFunction(()=>window.vm('.calendar-page','saveRecord').form.media.length===1&&!window.vm('.calendar-page','saveRecord').dailyMediaBusy);
    await page.locator('.daily-photos input').fill('TEST 窗边照片说明');
    await page.locator('.daily-life .save-btn').click();
    const mediaId=await page.evaluate(()=>window.vm('.calendar-page','saveRecord').form.media[0].id);
    await page.reload();await page.waitForSelector('.daily-life-input');
    await page.waitForFunction(()=>window.vm('.calendar-page','saveRecord').dailyPhotoUrls.length===1);
    assert.equal(await page.evaluate(()=>window.vm('.calendar-page','saveRecord').form.media[0].id),mediaId);
    assert.equal(await page.evaluate(()=>window.vm('.calendar-page','saveRecord').form.mood),'');
    checks.push({check:'B text + actual photo bytes persisted and decoded after reload; unknown health unchanged',result:'PASS'});
    await page.getByText('补记一刻 / 新增一次观察',{exact:true}).click();
    await page.waitForSelector('.event-time-panel');
    await page.locator('.daily-life-input textarea').fill('TEST 同日独立观察 4.2 kg，没有呕吐。');
    await page.locator('.daily-life .save-btn').click();
    const secondId=await page.evaluate(()=>window.vm('.calendar-page','saveRecord').momentId);
    assert.ok(secondId,'new observation must have a stable source ID');
    await page.locator('.daily-life .save-btn').click();
    await go('calendar/calendar?date=2026-10-10');
    assert.equal(await page.evaluate(()=>window.vm('.calendar-page','saveRecord').form.lifeText),original);
    assert.equal(await page.evaluate(()=>window.vm('.calendar-page','saveRecord').creativeDateRecords.length),1);
    await go('calendar/calendar?recordId='+secondId);assert.match(await page.locator('.daily-life-input textarea').inputValue(),/同日独立观察/);
    await go('calendar/calendar?moment=1');await page.waitForSelector('.event-time-panel');
    await page.evaluate(()=>{const v=window.vm('.calendar-page','saveRecord');v.updateEventField('eventPrecision','month');});
    await page.locator('.event-time-panel input').nth(0).fill('2023');await page.locator('.event-time-panel input').nth(1).fill('12');
    await page.locator('.daily-life-input textarea').fill('TEST 冬天搬家的旧事');await page.locator('.daily-life .save-btn').click();
    const fuzzyId=await page.evaluate(()=>window.vm('.calendar-page','saveRecord').momentId);
    await go('calendar/calendar?recordId='+fuzzyId);assert.equal(await page.evaluate(()=>window.vm('.calendar-page','saveRecord').momentRecord.localDate),'');
    await go('album/album');await shot('album-debug');await page.locator('.find-records uni-input').click();await page.locator('.find-records input').fill('搬家');
    await page.waitForFunction(()=>window.vm('.album-page','load').visibleRecords.length===1);
    await shot('search-fuzzy');assert.match(await page.locator('.entry-date').innerText(),/2023年12月/);
    await page.locator('.find-records input').fill('TEST 不存在的事件');
    await page.waitForFunction(()=>window.vm('.album-page','load').visibleRecords.length===0);await shot('search-empty');
    await page.locator('.find-records input').fill('');
    await page.getByRole('tab',{name:'照片',exact:true}).click();await page.waitForFunction(()=>Object.keys(window.vm('.album-page','load').recordPhotos).length===1);
    await shot('photos');assert.equal(await page.locator('.life-photo').count(),1);
    await page.getByText('查看原记录',{exact:true}).click();await page.waitForSelector('.daily-life-input');
    assert.equal(await page.evaluate(()=>window.vm('.calendar-page','saveRecord').selectedDateKey),'2026-10-10');
    checks.push({check:'B independent same-day IDs, repeat save, fuzzy month, current-source search and photo-to-record navigation',result:'PASS'});
    for(const width of [360,375,390,412]){
      await page.setViewportSize({width,height:844});await go('album/album');await shot('album-'+width);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await go('calendar/calendar?moment=1');await shot('editor-'+width);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    }
    checks.push({check:'B actual H5 album/editor at 360/375/390/412 without document horizontal overflow',result:'PASS'});
    if(phase!=='B'){
      await page.setViewportSize({width:390,height:844});
      await go('calendar/calendar?recordId='+fuzzyId);
      const pick2=page.waitForEvent('filechooser');await page.locator('.daily-photo-button').click();await(await pick2).setFiles(path.resolve('static/card-studio-example.png'));
      await page.waitForFunction(()=>window.vm('.calendar-page','saveRecord').form.media.length===1&&!window.vm('.calendar-page','saveRecord').dailyMediaBusy);
      await page.locator('.daily-life .save-btn').click();
      await go('archive/archive');await page.getByText('制作专属印记',{exact:true}).click();
      await page.waitForFunction(()=>!window.vm('.archive-page','saveArchive').sealBusy);
      assert.ok(await page.evaluate(()=>window.vm('.archive-page','saveArchive').activePet.petSeal));
      await go('album/album');await page.getByRole('tab',{name:'照片',exact:true}).click();
      assert.equal(await page.locator('.life-photo').count(),2);
      await page.getByText('选入两图对照',{exact:true}).first().click();await page.getByText('选入两图对照',{exact:true}).first().click();
      await page.getByText('预览两图对照',{exact:true}).click();await page.waitForSelector('.composition-page');
      const ready=async()=>{await page.waitForFunction(()=>['ready','failed'].includes(window.vm('.composition-page','preview').session.state));assert.equal(await page.evaluate(()=>window.vm('.composition-page','preview').session.state),'ready');};
      await ready();await shot('comparison-initial');
      await page.locator('.studio-tools uni-button').filter({hasText:'内容'}).click();
      await page.locator('.recipe-item input').first().fill('TEST 那时的窗边');
      await page.locator('.recipe-item').first().getByText('后移',{exact:true}).click();
      await page.locator('.panel-head uni-button').filter({hasText:'应用'}).click();await ready();
      await page.locator('.studio-tools uni-button').filter({hasText:'印记'}).click();
      await page.getByRole('tab',{name:'自由放置',exact:true}).click();await page.waitForSelector('.free-selection');
      const box=await page.locator('.free-selection').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x-20,box.y-100,{steps:8});await page.mouse.up();
      await page.evaluate(()=>{const v=window.vm('.free-seal-editor','finish');v.slideEnd('rotationDeg',-17);v.slideEnd('widthRatio',.2);});
      await page.locator('.free-head').getByText('完成',{exact:true}).click();await ready();
      await page.locator('.finish-actions').getByText('存入册页',{exact:true}).click();
      const workId=await page.evaluate(()=>window.vm('.composition-page','preview').savedWork);assert.ok(workId);
      const payload=await page.evaluate(()=>window.vm('.composition-page','preview').resolved.payload);
      assert.equal(payload.recipe.items.length,2);assert.equal(payload.seal.rotationDeg,-17);assert.equal(payload.recipe.items[1].caption,'TEST 那时的窗边');
      await go('card-compose/card-compose?work='+workId);await ready();
      assert.deepEqual(await page.evaluate(()=>window.vm('.composition-page','preview').resolved.payload),payload);
      const download=page.waitForEvent('download');await page.locator('.finish-actions').getByText('保存图片',{exact:true}).click();await(await download).saveAs(path.join(out,'comparison-export.png'));
      await shot('comparison-frozen');
      checks.push({check:'C genuine two-photo composition, swapped identity/caption, free seal drag/rotation, frozen reopen and actual PNG download',result:'PASS'});
      await go('album/album');await page.getByText('整理几页',{exact:true}).click();await page.waitForSelector('.composition-page');await ready();
      await page.locator('.studio-tools uni-button').filter({hasText:'内容'}).click();
      await page.locator('.recipe-title input').fill('TEST 几个普通日子');
      await page.locator('.recipe-item textarea').first().fill('TEST 只编辑本作品，原文保留。');
      await page.locator('.panel-head uni-button').filter({hasText:'应用'}).click();await ready();
      await page.locator('.finish-actions').getByText('存入册页',{exact:true}).click();
      const booklet=await page.evaluate(()=>{const v=window.vm('.composition-page','preview');return {id:v.savedWork,payload:v.resolved.payload,pages:v.session.pages.length};});assert.ok(booklet.id);assert.ok(booklet.pages>=2);
      await go('card-compose/card-compose?work='+booklet.id);await ready();assert.deepEqual(await page.evaluate(()=>window.vm('.composition-page','preview').resolved.payload),booklet.payload);await shot('booklet-frozen');
      await go('calendar/calendar?date=2026-10-10');assert.equal(await page.evaluate(()=>window.vm('.calendar-page','saveRecord').form.lifeText),original);
      checks.push({check:'C editable source booklet, multiple real Canvas pages, frozen reopen and unchanged original',result:'PASS'});
    }
  }
  if(['D','E'].includes(phase)){
    await page.context().grantPermissions(['clipboard-read','clipboard-write']);
    await go('calendar/calendar?moment=1&section=health');
    await page.locator('.note-input textarea').fill('TEST 原观察：未呕吐。药物甲 2 mg，未服用。');
    await page.locator('.record-card:not(.daily-life) .save-btn').click();
    const careId=await page.evaluate(()=>window.vm('.calendar-page','saveRecord').momentId);
    await page.getByText('记录这次观察的后续',{exact:true}).click();await page.waitForSelector('.event-time-panel');
    await page.locator('.note-input textarea').fill('TEST 后续：仍在观察，无新增症状。');
    await page.evaluate(()=>{const v=window.vm('.calendar-page','saveRecord');v.careStatus='observing';v.saveDailyDraft();});
    await page.locator('.record-card:not(.daily-life) .save-btn').click();
    const followId=await page.evaluate(()=>window.vm('.calendar-page','saveRecord').momentId);assert.notEqual(followId,careId);
    await go('calendar/calendar?recordId='+careId+'&section=health');
    assert.equal(await page.evaluate(()=>window.vm('.calendar-page','saveRecord').followupRecords.length),1);
    await page.getByText('整理给医生看',{exact:true}).click();await page.locator('.doctor-facts uni-button').nth(0).click();await page.locator('.doctor-facts uni-button').nth(1).click();
    await page.getByText('预览事实整理',{exact:true}).click();const doctor=await page.locator('.doctor-preview').innerText();assert.match(doctor,/2 mg，未服用/);assert.match(doctor,/仍在观察/);
    await page.getByText('复制这些文字',{exact:true}).click();assert.equal((await page.evaluate(()=>navigator.clipboard.readText())).replace(/\r\n/g,'\n'),doctor);await shot('doctor-facts');
    checks.push({check:'D source to new followup, reopen relation, exact fact preview and real browser clipboard',result:'PASS'});
    await go('chat/chat');await page.locator('.reference-entry').click();
    const selection=await page.evaluate(()=>{const v=window.vm('.reference-mask','openReferences');return v.referenceRows.slice(0,3).map(r=>r.id);});assert.equal(selection.length,3);
    for(const id of selection){const index=await page.evaluate(id=>window.vm('.reference-mask','openReferences').referenceRows.findIndex(r=>r.id===id),id);await page.locator('.reference-row').nth(index).locator('uni-button').first().click();}
    const exclude=await page.evaluate(id=>window.vm('.reference-mask','openReferences').referenceRows.findIndex(r=>r.id===id),selection[1]);await page.locator('.reference-row').nth(exclude).locator('uni-button').first().click();
    const assembled=await page.evaluate(()=>{const v=window.vm('.reference-mask','openReferences');return {payload:v.buildUserMessage('TEST 请帮我梳理这些观察',''),bundle:v.lastReferenceBundle,selected:v.selectedReferenceIds};});
    assert.equal(assembled.selected.length,2);assert.ok(!assembled.payload.includes(selection[1]));assert.equal(assembled.bundle.included.length+assembled.bundle.omitted.length,2);for(const ref of assembled.bundle.included)assert.ok(assembled.payload.includes(ref.id));
    fs.writeFileSync(path.join(out,'TEST-request-assembly.json'),JSON.stringify(assembled,null,2));
    for(const width of [360,375,390,412]){await page.setViewportSize({width,height:844});await page.locator('.reference-scroll .uni-scroll-view').evaluate(el=>el.scrollTop=0).catch(()=>{});await shot('reference-'+width);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
    await page.getByText('不用历史记录',{exact:true}).click();assert.equal(await page.evaluate(()=>window.vm('.reference-mask','openReferences').buildUserMessage('TEST','').includes('本次选择的原始资料')),false);
    checks.push({check:'D actual reference selection 3 minus 1, production request assembly, whole-record omission accounting, clear selection; no service request',result:'PASS'});
  }
  if(phase==='E'){
    await page.setViewportSize({width:390,height:844});await go('album/album');await page.locator('.find-records input').fill('TEST NOTHING');await page.waitForSelector('.no-matches');await page.locator('.find-records input').fill('');assert.equal(await page.locator('.recall-card').count(),0);
    await page.getByText('允许在册里主动回看',{exact:true}).click();await page.waitForSelector('.recall-card');const recalled=await page.evaluate(()=>window.vm('.album-page','load').recall.recordId);await shot('recall');
    await page.getByText('这条不再推荐',{exact:true}).click();assert.notEqual(await page.evaluate(()=>window.vm('.album-page','load').recall?.recordId),recalled);
    await page.getByText('关闭主动回看',{exact:true}).click();assert.equal(await page.locator('.recall-card').count(),0);await page.reload();await page.waitForSelector('.album-page');assert.equal(await page.locator('.recall-card').count(),0);
    assert.ok(await page.evaluate(id=>window.vm('.album-page','load').store.list().some(r=>r.id===id&&r.hidden),recalled));
    await page.getByText('翻翻以前',{exact:true}).click();await page.waitForSelector('.recall-card');await page.getByText('暂时不看',{exact:true}).click();assert.equal(await page.locator('.recall-card').count(),0);
    checks.push({check:'E opt-in recall, hide one without deleting original, persisted global off and manual browse/pause',result:'PASS'});
    await go('home/home');await shot('home-final');assert.equal(await page.locator('.companion-prompt').count(),1);await page.getByText('查看原事件与后续',{exact:true}).click();await page.waitForSelector('.note-input');assert.match(await page.locator('.note-input textarea').inputValue(),/原观察/);
    for(const width of [360,375,390,412]){await page.setViewportSize({width,height:844});await go('album/album');await shot('final-album-'+width);await go('home/home');await shot('final-home-'+width);}
    await go('album/album');await page.evaluate(()=>document.documentElement.style.fontSize='125%');await shot('large-text');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await go('calendar/calendar?date=2026-10-10');const missingAsset=await page.evaluate(()=>window.vm('.calendar-page','saveRecord').form.media[0]);
    await page.evaluate(key=>new Promise((resolve,reject)=>{const req=indexedDB.open('pety_private_creative_media_v1',1);req.onsuccess=()=>{const db=req.result,tx=db.transaction('photos','readwrite');tx.objectStore('photos').delete(key);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};}),missingAsset.key);
    await page.reload();await page.waitForFunction(()=>window.vm('.calendar-page','saveRecord').saveError.includes('无法读取'));assert.match(await page.locator('.daily-life-input textarea').inputValue(),/窗边/);assert.equal(await page.evaluate(()=>window.vm('.calendar-page','saveRecord').form.media[0].id),missingAsset.id);await shot('missing-photo');
    checks.push({check:'E missing TEST-only IndexedDB media reports failure after reload and retains original text and reference',result:'PASS'});
    const png=fs.readFileSync(path.join(out,'comparison-export.png'));assert.equal(png.readUInt32BE(16),1080);assert.equal(png.readUInt32BE(20),1440);
    checks.push({check:'E single existing home prompt prioritizes explicit care event, 360/375/390/412 final screens, 125% root text setting, PNG 1080x1440',result:'PASS'});
  }
  fs.writeFileSync(path.join(out, 'browser.json'), JSON.stringify({ phase, origin, system:require('node:os').platform()+' '+require('node:os').release(), browser: await browser.version(), viewport: '390x844', checks, errors, externalTraffic: 'blocked', realModelCalls: 0 }, null, 2));
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ phase, checks, errors }));
})().catch(async e => { await activePage?.screenshot({path:path.join(out,'failure.png')});fs.writeFileSync(path.join(out,'failure.txt'),String(e)); console.error(e); process.exitCode = 1; }).finally(async () => { await browser?.close(); server.close(); });
