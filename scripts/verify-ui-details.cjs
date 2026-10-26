// Real compiled H5, disposable browser storage, TEST fixtures, external traffic blocked.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { chromium } = require('C:/Users/杜冲/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const phase = process.argv[2] || 'after', run = process.argv[3] || phase;
const root = path.resolve('unpackage/ui-details-20261022', phase, 'h5'), out = path.resolve('docs/ui-details-20261022', run);
if (fs.existsSync(out)) throw Error('Use a new evidence directory');
fs.mkdirSync(out, { recursive: true });
const assets = { '/master.png': 'unpackage/hero-e2e/master.png' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]), file = assets[url] ? path.resolve(assets[url]) : path.resolve(root, '.' + (url === '/' ? '/index.html' : url));
  if ((!assets[url] && !file.startsWith(root + path.sep)) || !fs.existsSync(file)) return res.writeHead(404).end();
  res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
let browser, context, page, origin;
const result = { scope: 'Compiled H5, disposable TEST guest fixtures; account states injected for visual coverage only, no real authentication/cloud requests', phase, checks: [], errors: [], consoleErrors: [], blockedRequests: [], screenshots: [], geometry: [] };
async function shot(name) { await page.screenshot({ path: path.join(out, name + '.png') }); result.screenshots.push(name + '.png'); }
async function fresh(width, mode = 'current', name = '酱酱') {
  await context?.close(); context = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 2, timezoneId: 'Asia/Shanghai' });
  page = await context.newPage(); page.on('pageerror', e => result.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') result.consoleErrors.push(m.text()); });
  await page.route('**/*', r => { if (r.request().url().startsWith(origin + '/')) return r.continue(); const u = new URL(r.request().url()); result.blockedRequests.push(u.origin + u.pathname); return r.abort(); });
  await page.addInitScript(({ origin, mode, name }) => {
    window.vm = (s, m) => { let c = [...document.querySelectorAll(s)].find(e => e.getBoundingClientRect().width)?.__vueParentComponent; while (c) { if (c.proxy && m in c.proxy) return c.proxy; c = c.parent; } throw Error('Missing component ' + s); };
    if (localStorage.getItem('ui-details-TEST')) return;
    const pets = [{ id: 'ui-details-TEST', name, species: 'cat', status: mode, relationshipStage: mode, originalPhotoUrl: origin + '/master.png', heroDisplayMode: 'original' }, { id: 'ui-details-TEST-2', name: '小满', species: 'dog', relationshipStage: 'current' }, { id: 'ui-details-TEST-3', name: '一个名字很长很长的小朋友', species: 'cat', relationshipStage: 'current' }];
    for (const [k, v] of Object.entries({ 'ui-details-TEST': true, guizhua_onboarding_seen: true, my_pets_list: pets, current_active_pet_id: pets[0].id })) localStorage.setItem(k, JSON.stringify({ type: typeof v === 'object' ? 'object' : typeof v, data: v }));
  }, { origin, mode, name });
  await home();
}
async function home() { await page.goto(origin + '/#/pages/home/home'); await page.waitForSelector('.portrait-stage.stage-ready'); await page.waitForTimeout(500); }
async function scrollTo(selector, offset = 76) {
  await page.locator(selector).first().evaluate((el, offset) => { const sc = el.closest('.uni-scroll-view'); if (!sc) throw Error('No uni scroll container'); sc.scrollTop += el.getBoundingClientRect().top - sc.getBoundingClientRect().top - offset; }, offset);
  await page.waitForTimeout(250);
}
async function geometry(label) {
  const g = await page.evaluate(() => {
    const rect = s => { const el = document.querySelector(s); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom }; };
    const stage = document.querySelector('.integrated-stage');
    return { width: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth, stage: rect('.integrated-stage'), header: rect('.home-header'), radius: stage && getComputedStyle(stage).borderRadius, prompt: rect('.prompt-toggle'), name: rect('.compact-context') };
  });
  assert.equal(g.overflow, false, label + ' horizontal overflow');
  if (g.stage) { assert.equal(g.radius, '0px'); assert.equal(g.stage.x, 0); }
  result.geometry.push({ label, ...g });
}
async function profile() { await page.goto(origin + '/#/pages/profile/profile'); await page.waitForSelector('.account-settings'); await page.waitForTimeout(500); }
async function accountState(state) {
  await page.evaluate(state => {
    const vm = window.vm('.profile-page', 'loadUserProfile');
    vm.authLoading = state === 'loading';
    vm.userProfile = { loggedIn: state !== 'guest', userId: state === 'guest' ? '' : 'TEST-visual-account', message: state === 'failed' ? 'profile_refresh_failed' : 'ok', isMember: false };
  }, state);
  await page.waitForTimeout(80);
}
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r)); origin = `http://127.0.0.1:${server.address().port}`;
  result.origin = origin;
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  for (const width of [360, 390, 412]) {
    await fresh(width); await geometry('hero-' + width); await shot('home-top-' + width);
    await scrollTo('.life-section'); await shot('home-lower-' + width); await geometry('home-lower-' + width);
    await scrollTo('.companion-prompt'); await page.locator(phase === 'before' ? '.prompt-heading .prompt-title' : '.prompt-toggle').click();
    await page.locator('.companion-prompt').evaluate(el => { el.closest('.uni-scroll-view').scrollTop = 99999; }); await page.waitForTimeout(200); await shot('prompt-expanded-' + width);
    if (phase !== 'before') {
      const bottom = await page.locator('.companion-prompt').evaluate(el => ({ card: el.getBoundingClientRect().bottom, viewport: document.querySelector('.home-scroll').getBoundingClientRect().bottom, action: el.querySelector('.prompt-write').getBoundingClientRect().bottom }));
      assert.ok(bottom.card <= bottom.viewport - 20, 'Prompt card needs bottom breathing room'); assert.ok(bottom.action < bottom.viewport, 'Action remains in viewport');
    }
    if (phase !== 'before') {
      assert.ok((await page.locator('.prompt-copy').innerText()).length > 5);
      const copy = await page.locator('.prompt-copy').innerText(); await page.locator('.prompt-change').click();
      assert.notEqual(await page.locator('.prompt-copy').innerText(), copy);
      const style = await page.locator('.prompt-toggle').evaluate(el => ({ bg: getComputedStyle(el).backgroundColor, minHeight: getComputedStyle(el).minHeight }));
      assert.equal(style.bg, 'rgba(0, 0, 0, 0)'); assert.ok(parseFloat(style.minHeight) >= 44);
      await page.locator('.prompt-write').click(); await page.waitForSelector('.daily-life-input textarea');
      await page.locator('.daily-life-input textarea').fill('TEST 今天一起晒太阳，把平凡的一刻留下来。');
      await page.locator('.daily-life .save-btn').click(); await home();
      await page.waitForSelector('.preview-excerpt'); assert.match(await page.locator('.preview-excerpt').innerText(), /一起晒太阳/);
      await scrollTo('.life-section'); await shot('saved-record-' + width); await page.locator('.life-preview-record').click();
      await page.waitForSelector('.daily-life-input textarea'); assert.match(await page.locator('.daily-life-input textarea').inputValue(), /一起晒太阳/);
      await home(); await scrollTo('.home-week');
      const days = await page.locator('.home-week-solar').allTextContents(); await page.getByLabel('下一周', { exact: true }).click();
      assert.notDeepEqual(await page.locator('.home-week-solar').allTextContents(), days); await page.getByLabel('上一周', { exact: true }).click();
      assert.deepEqual(await page.locator('.home-week-solar').allTextContents(), days);
      assert.equal(await page.locator('.home-week-day-today .home-week-label').innerText(), '今天');
      await page.locator('.week-title-button').click(); await page.waitForSelector('.calendar-page');
      await home(); await scrollTo('.home-utilities'); await page.locator('.home-utilities').getByText('宠物档案与展示设置', { exact: true }).click(); await page.waitForSelector('.archive-page');
      result.checks.push(width + ': proposal expand/change/write, input/save/reopen original, previous/next week, full calendar, archive navigation');
    }
    await profile(); await shot('profile-top-' + width); await scrollTo('.account-settings', 110); await shot('profile-guest-' + width); await geometry('profile-' + width);
    await accountState('verified'); await shot('profile-account-' + width);
    if (phase !== 'before') {
      await page.locator('.profile-footer').evaluate(el => { el.closest('.uni-scroll-view').scrollTop = 99999; }); await page.waitForTimeout(150);
      const footer = await page.locator('.profile-footer').evaluate(el => ({ bottom: el.getBoundingClientRect().bottom, viewport: document.querySelector('.profile-scroll').getBoundingClientRect().bottom }));
      assert.ok(footer.bottom < footer.viewport, 'Profile footer is above tab bar'); await shot('profile-bottom-' + width); await scrollTo('.account-settings',110);
    }
    if (phase !== 'before') {
      assert.doesNotMatch(await page.locator('.account-settings').innerText(), /UID:/);
      assert.match(await page.locator('.account-note').innerText(), /已验证.*尚未接入/);
      await accountState('failed'); assert.doesNotMatch(await page.locator('.account-note').innerText(), /已验证/);
      await shot('profile-offline-' + width);
      await accountState('loading'); assert.match(await page.locator('.account-settings').innerText(), /核对中/);
      await accountState('guest'); await page.locator('.account-settings').getByText('账号与安全', { exact: true }).click(); await page.waitForSelector('.auth-page');
      result.checks.push(width + ': guest login navigation, verified/failed/loading visual account states, backup remains explicitly unavailable');
    }
  }
  if (phase !== 'before') {
    await fresh(360, 'current', '，，，，，，，，名字很长的 Sunshine');
    await scrollTo('.life-section'); await geometry('long-name'); await shot('long-name');
    assert.equal(await page.locator('.compact-context').innerText(), '日常与陪伴');
    assert.equal(await page.locator('.pet-name').innerText(), '，，，，，，，，名字很长的 Sunshine');
    await page.evaluate(() => { window.vm('.home-page', 'loadHomeData').uiFontScale = 1.3; window.vm('.home-page', 'loadHomeData').uiLargeText = true; });
    await scrollTo('.life-section'); await shot('large-text-home'); await geometry('large-text-home');
    await profile(); await page.evaluate(() => { const v = window.vm('.profile-page', 'loadUserProfile'); v.uiFontScale = 1.3; v.uiLargeText = true; });
    await scrollTo('.account-settings', 100); await shot('large-text-profile'); await geometry('large-text-profile');
    for (const width of [360, 390, 412]) {
      await fresh(width, 'deceased'); await scrollTo('.life-section'); await shot('memorial-' + width);
      assert.equal(await page.locator('.companion-prompt').count(), 0); assert.equal(await page.locator('.home-week').count(), 0);
      await page.locator('.memory-open').click(); await page.waitForSelector('.album-page');
    }
    result.checks.push('Compact header uses mode context; original pet name preserved in hero; large text home/profile; memorial album navigation at 360/390/412');
  }
  assert.deepEqual(result.errors, []);
  console.log(JSON.stringify({ checks: result.checks, errors: result.errors, consoleErrors: result.consoleErrors, screenshots: result.screenshots.length }, null, 2));
})().catch(async e => { result.failure = e.stack; await shot('failure').catch(() => {}); console.error(e); process.exitCode = 1; })
  .finally(async () => { fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(result, null, 2)); await context?.close(); await browser?.close(); server.close(); });
