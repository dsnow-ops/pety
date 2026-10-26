from playwright.sync_api import sync_playwright
from pathlib import Path
import json
r=Path('/mnt/data/guizhua_visual_lock')
base='http://127.0.0.1:8765/'
results={'environment':'Isolated local Chromium via Playwright; not uni-app; no Android/production/cloud execution.','checks':[], 'rendering_note':'The environment blocked localhost URL navigation (ERR_BLOCKED_BY_ADMINISTRATOR); rendering used Playwright set_content with local document bytes and locally inlined role CSS, without changing browser policy.'}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 c=b.new_context(viewport={'width':1060,'height':1270},device_scale_factor=1)
 pg=c.new_page();errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
 pg.set_content(Path('/mnt/data/GUIZHUA_HOME_AND_FREE_SEAL_REFERENCE.html').read_text(),wait_until='load');pg.wait_for_function('window.referenceReady===true')
 results['original_default']=pg.evaluate('({body:getComputedStyle(document.body).backgroundColor,bg:getComputedStyle(document.documentElement).getPropertyValue("--bg"),panel:getComputedStyle(document.querySelector(".daily-panel")).backgroundImage})')
 pg.locator('#home-screen').screenshot(path=str(r/'evidence/original-default-light-home.png'))
 pg.close();pg=c.new_page();pg.on('pageerror',lambda e:errors.append(str(e)))
 pg.set_content((r/'reference/APPROVED_EXPLICIT_REFERENCE.html').read_text(),wait_until='load');pg.wait_for_function('window.referenceReady===true')
 pg.screenshot(path=str(r/'evidence/explicit-reference-overview.png'),full_page=True)
 pg.locator('#home-screen').screenshot(path=str(r/'evidence/explicit-home.png'))
 pg.locator('#studio-screen').screenshot(path=str(r/'evidence/explicit-studio.png')) if pg.locator('#studio-screen').count() else pg.locator('.screen.studio').screenshot(path=str(r/'evidence/explicit-studio.png'))
 results['explicit_computed']=pg.evaluate('''()=>{const pick=s=>{const e=document.querySelector(s),c=getComputedStyle(e),r=e.getBoundingClientRect();return {width:r.width,height:r.height,radius:c.borderRadius,fontSize:c.fontSize,lineHeight:c.lineHeight,color:c.color,backgroundColor:c.backgroundColor,backgroundImage:c.backgroundImage}};return {panel:pick('.daily-panel'),primary:pick('.actions .primary'),secondary:pick('.actions .btn:not(.primary)'),day:pick('.day.active'),nav:pick('.home-tabs'),screen:pick('.screen')}}''')
 assert results['explicit_computed']['primary']['height']==48
 assert results['explicit_computed']['day']['height']==74
 results['checks'].append('Explicit warm-dark panel and 48px buttons / 74px week cells in isolated Chromium.')
 pg.evaluate("document.querySelector('#home-scroll').scrollTop=650")
 pg.wait_for_timeout(200)
 pg.locator('#home-screen').screenshot(path=str(r/'evidence/explicit-home-scrolled.png'))
 pg.evaluate("setMode('free');seal.angle=-22;seal.width=.21;sync();draw()")
 with pg.expect_download() as d:
  pg.evaluate('exportPNG()')
 d.value.save_as(str(r/'evidence/independent-seal-export.png'))
 results['checks'].append('Existing independent stamp demo still switches to free placement and exports a real PNG; no native validation.')
 pg.close();pg=c.new_page();pg.on('pageerror',lambda e:errors.append(str(e)))
 pg.set_content((r/'reference/COMPONENT_CONTRACT_GALLERY.html').read_text().replace('<link rel="stylesheet" href="../code/visual-lock.roles.css">','<style>'+(r/'code/visual-lock.roles.css').read_text()+'</style>'),wait_until='load')
 pg.locator('.board').screenshot(path=str(r/'evidence/component-contracts.png'))
 gallery=[]
 for w in [360,375,390,412]:
  pg.set_viewport_size({'width':w,'height':844})
  row=pg.evaluate('''()=>{const all=s=>[...document.querySelectorAll(s)].map(e=>{const r=e.getBoundingClientRect(),c=getComputedStyle(e);return {width:r.width,height:r.height,radius:c.borderRadius,lineHeight:c.lineHeight}});return {viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,buttons:all('.gz-btn'),events:all('.gz-choice-hit'),faces:all('.gz-choice-face'),segments:all('.gz-segment-face'),days:all('.gz-day')}}''')
  assert row['documentWidth']==w,row
  assert all(x['height']==48 for x in row['buttons'])
  assert all(x['height']==44 for x in row['events'])
  assert all(x['height']==38 for x in row['faces'])
  assert all(x['height']==36 for x in row['segments'])
  assert all(x['height']==74 for x in row['days'])
  widths=[x['width'] for x in row['events']]
  assert max(widths)-min(widths)<.1
  gallery.append(row)
 pg.locator('.gz-choice-hit').first.click()
 assert pg.locator('.gz-choice-hit').first.get_attribute('aria-pressed')=='true'
 pg.locator('.gz-segment-hit').nth(1).click()
 assert pg.locator('.gz-segment-hit').nth(1).get_attribute('aria-selected')=='true'
 results['checks'].append('Gallery at 360/375/390/412: no horizontal overflow; role heights verified; equal 3-column event widths; selection interactions verified.')
 results['gallery_measurements']=gallery
 results['page_errors']=errors
 assert not errors,errors
 b.close()
(r/'evidence/reference-browser-check.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
print(json.dumps({k:v for k,v in results.items() if k!='gallery_measurements'},ensure_ascii=False,indent=2))
