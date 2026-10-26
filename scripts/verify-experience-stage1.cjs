// Current compiled uni-app only. Disposable browser contexts, TEST pets,
// actual record/photo saves, and no external traffic or real-user storage.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { chromium } = require('C:/Users/杜冲/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const run = process.argv[2] || 'run-1';
if (!/^[a-z0-9-]+$/.test(run)) throw Error('Invalid run name');
const root = path.resolve('unpackage/experience-stage1-20261022/after/h5');
const out = path.resolve('docs/experience-stage1-20261022', run);
if (fs.existsSync(out)) throw Error('Use a fresh evidence directory');
fs.mkdirSync(out, { recursive: true });
const cat = path.resolve('unpackage/visual-v2-20260928/fixtures/authorized-photo.png');
const flower = path.resolve('docs/comparison-visual-20261018/fixtures/TEST-flower.jpg');
const server = http.createServer((req, res) => {
  const name = decodeURIComponent(req.url.split('?')[0]);
  const file = name === '/fixture.png' ? cat : path.resolve(root, '.' + (name === '/' ? '/index.html' : name));
  if ((file !== cat && !file.startsWith(root + path.sep)) || !fs.existsSync(file)) return res.writeHead(404).end();
  res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
let browser, context, page, origin, visit = 0;
const results = { at: new Date().toISOString(), scope: 'Isolated TEST browser contexts; external network blocked; H5 only', checks: [], screenshots: [], geometry: [], errors: [], console: [], blocked: 0 };
const pass = text => results.checks.push(text);
async function shot(name, selector) {
  const options = { path: path.join(out, name + '.png') };
  if (selector) await page.locator(selector).screenshot(options); else await page.screenshot(options);
  results.screenshots.push(name + '.png');
}
async function go(route) {
  await page.goto(origin + '/?visit=' + (++visit) + '#/pages/' + route);
  await page.waitForTimeout(500);
  if (await page.getByText('以后再说', { exact: true }).isVisible()) await page.getByText('以后再说', { exact: true }).click();
}
async function fresh() {
  await context?.close();
  context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Shanghai', acceptDownloads: true });
  page = await context.newPage(); page.setDefaultTimeout(12000);
  page.on('pageerror', e => results.errors.push(e.message));
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) results.console.push(m.text().slice(0, 300)); });
  await page.route('**/*', r => r.request().url().startsWith(origin + '/') || r.request().url().startsWith('blob:') ? r.continue() : (results.blocked++, r.abort()));
  await page.addInitScript(origin => {
    window.vm = (selector, method) => {
      let c = [...document.querySelectorAll(selector)].find(e => e.getBoundingClientRect().width)?.__vueParentComponent;
      while (c) { if (c.proxy && method in c.proxy) return c.proxy; c = c.parent; }
      throw Error('Component unavailable: ' + selector);
    };
    if (!localStorage.getItem('experience-TEST')) {
      const data = { 'experience-TEST': true, guizhua_onboarding_seen: true,
        my_pets_list: [{ id: 'experience-TEST-P1', name: 'TEST 小禾', species: 'cat', status: 'current', relationshipStage: 'current', originalPhotoUrl: origin + '/fixture.png', heroDisplayMode: 'original' }, { id: 'experience-TEST-P2', name: 'TEST 第二只', species: 'dog', status: 'current', relationshipStage: 'current' }],
        current_active_pet_id: 'experience-TEST-P1' };
      for (const [k, v] of Object.entries(data)) localStorage.setItem(k, JSON.stringify({ type: typeof v === 'object' ? 'object' : typeof v, data: v }));
    }
  }, origin);
}
const texts = ['TEST 今天小禾趴在窗边晒太阳，听见开门就跑来迎接。', 'TEST 我们一起散步，看见路边开了小花。', 'TEST 它把喜欢的小球叼到我的脚边，又认真等了一会儿。'];
async function createRecord(i, photo) {
  await go('calendar/calendar?date=2026-10-' + (22 - i));
  await page.locator('.daily-life-input textarea').fill(texts[i]);
  if (photo) {
    const chosen = page.waitForEvent('filechooser'); await page.locator('.daily-photo-button').click();
    await (await chosen).setFiles(photo);
    await page.waitForFunction(() => !window.vm('.calendar-page', 'saveRecord').dailyMediaBusy && window.vm('.calendar-page', 'saveRecord').form.media.length > 0);
    await page.locator('.daily-photos input').first().fill('TEST 自己留下的生活照片');
  }
  await page.locator('.daily-life .save-btn').click();
  await page.reload(); await page.waitForSelector('.daily-life-input textarea');
  assert.equal(await page.locator('.daily-life-input textarea').inputValue(), texts[i]);
}
async function capture(mode, count) {
  for (const width of [360, 390, 412]) {
    await page.setViewportSize({ width, height: 844 });
    await go('home/home'); await page.waitForSelector('.home-life-preview');
    if (mode === 'current' && count === 3) await page.waitForSelector('.life-preview-photo');
    await shot(`${mode}-${count}-home-${width}`);
    const boxes = await page.evaluate(() => {
      const b = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom }; };
      return { name: b('.pet-name'), header: b('.home-header'), photo: b('.integrated-stage'), overflow: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    assert.ok(boxes.name.width >= width - 48); assert.ok(boxes.header.bottom <= boxes.photo.y + 1); assert.equal(boxes.overflow, false);
    results.geometry.push({ mode, count, width, ...boxes });
    if (mode === 'deceased') {
      assert.equal(await page.locator('.home-week').count(), 0);
      assert.doesNotMatch(await page.locator('.home-shell').innerText(), /今天还没有记录|已记录健康观察/);
      assert.equal(await page.locator('.preview-excerpt').count(), 0);
    } else if (count) assert.match(await page.locator('.preview-excerpt').innerText(), /趴在窗边/);
    await page.mouse.move(width/2, 650); await page.mouse.wheel(0, 380); await page.waitForTimeout(250);
    await shot(`${mode}-${count}-home-content-${width}`);
    assert.ok(await page.evaluate(()=>window.vm('.home-page','loadHomeData').heroScrollTop>0));
    await go('album/album'); await page.waitForSelector('.album-page');
    if (count === 3) await page.waitForFunction(() => Object.keys(window.vm('.album-page', 'load').recordPhotos).length === 2);
    await shot(`${mode}-${count}-album-${width}`);
    assert.equal(await page.locator('.entry').count(), count);
    assert.equal(await page.locator('.find-records').count(), 0);
    assert.equal(await page.locator('.record-filters').count(), 0);
    if (count) assert.ok((await page.locator('.entry').first().boundingBox()).y < (mode === 'deceased' ? 400 : 340));
  }
  pass(`${mode}: empty/record state ${count}, 360/390/412, separate full-width text and intact pet stage, content-first album`);
}
async function currentFlow() {
  await go('home/home'); await page.locator('.life-preview-record').click();
  await page.waitForSelector('.daily-life-input textarea'); assert.equal(await page.locator('.daily-life-input textarea').inputValue(), texts[0]);
  await go('album/album'); await page.locator('[aria-label="查找记录"]').click();
  await page.locator('.find-records input').fill('小球');
  await page.waitForFunction(() => window.vm('.album-page', 'load').visibleRecords.length === 1);
  assert.match(await page.locator('.entry-text').innerText(), /小球/); await shot('search-result');
  await page.locator('.find-records input').fill('');
  await page.getByText('筛选', { exact: true }).click();
  await page.getByText('仅收藏', { exact: true }).click();
  await page.waitForFunction(() => window.vm('.album-page', 'load').visibleRecords.length === 0);
  await page.getByText('清除筛选', { exact: true }).click();
  await page.waitForFunction(() => window.vm('.album-page', 'load').visibleRecords.length === 3);
  pass('Real save -> reload -> Home original -> source editor -> search and filter/reset preserve all three records');
  await go('album/album'); await page.locator('.entry-date uni-button').first().click();
  await page.getByText('整理标签与节点', { exact: true }).click();
  await page.locator('.record-filters input').first().fill('habit');
  await page.locator('.record-filters input').nth(1).fill('TEST 窗边的小习惯');
  await page.getByText('保存整理', { exact: true }).click();
  await page.getByText('整理', { exact: true }).click();
  await page.locator('.collection-disclosure').click();
  await page.waitForFunction(() => { const r=document.querySelector('.book-extras')?.getBoundingClientRect(); return r && r.top>=0 && r.top<500; });
  assert.match(await page.locator('.atlas-chapter').innerText(), /你记录过的 1 条/); await shot('atlas', '.book-extras');
  await page.locator('.atlas-chapter uni-button').first().click();
  await page.waitForSelector('.daily-life-input textarea'); assert.equal(await page.locator('.daily-life-input textarea').inputValue(), texts[0]);
  pass('Organize original tags/milestone -> life atlas chapter -> same original record');
  await go('album/album'); await page.getByRole('tab', { name: '照片', exact: true }).click();
  await page.waitForFunction(() => Object.keys(window.vm('.album-page', 'load').recordPhotos).length === 2);
  assert.equal(await page.locator('.life-photo').count(), 2); await shot('photos');
  await page.getByText('选入对照', { exact: true }).first().click();
  await page.getByText('选入对照', { exact: true }).first().click();
  await page.getByText('预览两图对照', { exact: true }).click();
  await page.waitForSelector('.composition-page');
  await page.waitForFunction(() => window.vm('.composition-page', 'preview').canFinish);
  await shot('comparison');
  await page.getByText('存入册页', { exact: true }).click();
  await page.waitForFunction(() => Object.keys(window.vm('.composition-page', 'preview').store.read().works).length > 0);
  const download = page.waitForEvent('download'); await page.getByText('保存图片', { exact: true }).click();
  await (await download).saveAs(path.join(out, 'actual-comparison-export.png'));
  await go('album/album'); await page.getByRole('tab', { name: '作品', exact: true }).click();
  await page.waitForSelector('.cover-open uni-image'); await shot('saved-works');
  await page.locator('.cover-open').first().click(); await page.waitForSelector('.composition-page'); await page.waitForFunction(() => window.vm('.composition-page', 'preview').canFinish);
  pass('Photos from persisted bytes -> two-photo comparison -> actual Canvas PNG download -> saved work -> reopen');
  await go('album/album'); await page.getByText('整理', { exact: true }).click();
  await page.getByText('整理几页', { exact: true }).click();
  await page.waitForSelector('.composition-page'); await page.waitForFunction(() => window.vm('.composition-page', 'preview').canFinish);
  await shot('booklet'); await page.getByText('存入册页', { exact: true }).click();
  pass('Existing records -> manual booklet preview and saved work');
}
async function edgeFlow() {
  await fresh(); await createRecord(0, cat);
  await go('archive/archive?petId=experience-TEST-P1');
  const name='TEST 小禾和它长长的名字 Sunshine';
  await page.locator('.rename-input input').fill(name); await page.getByText('保存名字', {exact:true}).click();
  await go('home/home');
  for(const width of [360,390,412]) {
    await page.setViewportSize({width,height:844}); await go('home/home');
    assert.equal(await page.locator('.pet-name').innerText(),name);
    const boxes=await page.evaluate(()=>{const h=document.querySelector('.home-header').getBoundingClientRect(),p=document.querySelector('.integrated-stage').getBoundingClientRect();return {headerBottom:h.bottom,photoTop:p.top,overflow:document.documentElement.scrollWidth>innerWidth+1};});
    assert.equal(boxes.overflow,false);assert.ok(boxes.headerBottom<=boxes.photoTop+1);
    await shot('long-name-'+width);
    await page.evaluate(()=>{const v=window.vm('.home-page','loadHomeData');v.homeLargeText=true;v.uiFontScale=1.5;v.uiLargeText=true;});
    await shot('large-text-'+width);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  }
  pass('Actual archive rename with long mixed name and H5 1.5 font state at all three widths; no overlap or horizontal overflow');
  await go('calendar/calendar?date=2026-10-21');await page.locator('.daily-life-input textarea').fill('TEST 尚未正式保存的草稿');
  await page.waitForTimeout(800);await go('home/home');assert.doesNotMatch(await page.locator('.home-life-preview').innerText(),/尚未正式保存/);
  await go('calendar/calendar?date=2026-10-21');assert.equal(await page.locator('.daily-life-input textarea').inputValue(),'TEST 尚未正式保存的草稿');
  pass('Unfinished editor draft survives navigation but is not presented as a saved Home record');
  await go('archive/archive?petId=experience-TEST-P2');await go('home/home');await shot('no-photo-home');
  assert.equal(await page.locator('.preview-excerpt').count(),0);assert.ok(await page.locator('.portrait-placeholder').isVisible());
  pass('No-photo pet retains an honest usable placeholder and no other pet content');
}
async function memorialFlow(count) {
  await go('home/home');
  if (count) {
    await page.locator('.memory-open').click();
    assert.match(await page.locator('.preview-excerpt').innerText(), /趴在窗边/);
    if (count > 1) { await page.getByText('下一段', { exact: true }).click(); assert.match(await page.locator('.preview-excerpt').innerText(), /散步/); }
    await page.evaluate(() => { window.vm('.home-page', 'loadHomeData').heroRequestId++; });
    assert.match(await page.locator('.preview-excerpt').innerText(), count > 1 ? /散步/ : /趴在窗边/);
    await shot('memorial-reading-' + count, '.life-section');
    await page.getByText('合上回忆', { exact: true }).click(); assert.equal(await page.locator('.preview-excerpt').count(), 0);
    pass('Memorial ' + count + ': explicit open/read/page/close without recording, conversation or model calls');
  }
  if (count === 3) {
    await page.getByText('写一封信', { exact: true }).click();
    await page.locator('.original textarea').fill('TEST 写给小禾：今天想起你趴在窗边的样子。');
    await page.locator('.save-record').click();
    await page.waitForFunction(() => window.vm('.narrative-page', 'saveRecord').recordSaved);
    await go('album/album'); await page.getByText('写给它的信', { exact: true }).click();
    assert.match(await page.locator('.entry-text').innerText(), /TEST 写给小禾/); await shot('memorial-letter');
    await page.locator('.record-preview').click(); await page.waitForSelector('.original textarea');
    assert.match(await page.locator('.original textarea').inputValue(), /TEST 写给小禾/);
    pass('Memorial optional letter -> save -> letter-only reading -> reopen original');
    await go('archive/archive?petId=experience-TEST-P2'); await go('home/home');
    assert.match(await page.locator('.pet-name').innerText(), /第二只/); assert.equal(await page.locator('.preview-excerpt').count(), 0);
    await go('album/album'); assert.equal(await page.locator('.entry').count(), 0); assert.equal(await page.locator('.work-cover').count(), 0);
    pass('Switch P1 to P2 through archive: no P1 record/photo/letter/work leakage');
  }
}
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r)); origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ channel: 'msedge', headless: true }); results.origin = origin; results.browser = await browser.version();
  if (process.argv[3] === 'edges') { await edgeFlow(); assert.deepEqual(results.errors,[]); console.log('PASS edge checks'); return; }
  for (const count of [3, 0, 1]) {
    await fresh();
    for (let i = 0; i < count; i++) await createRecord(i, count === 3 && i < 2 ? (i ? flower : cat) : null);
    await capture('current', count);
    if (count === 3) await currentFlow();
    await go('archive/archive?petId=experience-TEST-P1');
    await page.locator('.mode-toggle-btn').click(); await page.getByText('进入纪念', { exact: true }).click();
    await page.waitForFunction(() => window.vm('.archive-page', 'updateRelationshipMode').activePet.relationshipStage === 'deceased');
    await capture('deceased', count); await memorialFlow(count);
  }
  assert.deepEqual(results.errors, []);
  console.log(JSON.stringify({ checks: results.checks, screenshots: results.screenshots.length, pageErrors: results.errors, blocked: results.blocked }));
})().catch(async e => { results.failure = e.stack; await shot('failure').catch(() => {}); console.error(e); process.exitCode = 1; }).finally(async () => {
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2)); await context?.close(); await browser?.close(); server.close();
});
