const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
function mod(file,names,deps={}){return Function(...Object.keys(deps),fs.readFileSync(file,'utf8').replace(/^import[^;]+;\s*/gm,'').replace(/^export \{[^}]+\};?/gm,'').replace(/export /g,'')+';return {'+names+'};')(...Object.values(deps));}
const layout=mod('common/card-layout.js','layoutCard,wrapCardText,photoRect');
const render=mod('common/card-renderer.js','createCardExportSession,renderCardPage,canvasCallback',layout);
test('export state prevents reentry, reuses rendered pages, retries only incomplete saves',async()=>{
 const s=render.createCardExportSession();let resolve,count=0;const p=s.prepare('v1',()=>{count++;return new Promise(r=>resolve=r)});
 assert.equal(s.state,'rendering');assert.equal(await s.prepare('v1',()=>{throw Error('duplicate')}),false);resolve(['one','two','three']);await p;
 const saved=[];assert.equal(await s.save(async(_,i)=>{if(i===1)throw Error('denied');saved.push(i)}),false);assert.deepEqual(s.saved,[0]);assert.equal(s.state,'failed');
 await s.save(async(_,i)=>saved.push(i));assert.deepEqual(saved,[0,1,2]);assert.equal(s.state,'saved');await s.prepare('v1',()=>{count++;});assert.equal(count,1);
});
test('cancelled or invalidated render never publishes another pets image',async()=>{
 const s=render.createCardExportSession();let done;const pending=s.prepare('A',()=>new Promise(r=>done=r));s.invalidate();done(['A private']);assert.equal(await pending,false);assert.deepEqual(s.pages,[]);assert.equal(s.key,'');
});
test('wrapping preserves newlines and emoji; image placement preserves aspect ratio',()=>{
 const text='今天🙂\n\nSuperLongWordThatMustWrap';const lines=layout.wrapCardText(text,100,t=>Array.from(t).length*42);
 assert.equal(lines.join('').replace(/\n/g,''),text.replace(/\n/g,''));assert.ok(lines.includes(''));
 const p=layout.photoRect({width:2000,height:1000},[0,0,300,300]);assert.deepEqual(p.dest,[0,75,300,150]);
});
test('2000+ characters paginate at readable size, all text survives; title overflow is explicit',()=>{
 const text=('今天看到窗边，想起你。🙂\n\nI do not regret this. LongWordWithoutSpacesAndMoreLetters\n').repeat(30);
 const measure=(t,size)=>Array.from(t).reduce((n,c)=>n+(/[\x00-\x7f]/.test(c)?size*.6:size),0);
 const pages=layout.layoutCard({templateId:'letter',text,petName:'很长但真实的宠物名字',media:[]},measure);assert.ok(pages.length>1);
 const body=pages.flatMap(p=>p.commands.filter(c=>c.role==='body'));assert.equal(body.map(c=>c.text).join(''),text.replace(/\n/g,''));
 for(const p of pages){assert.equal(p.height,1440);for(const op of p.commands.filter(c=>c.role==='body')){assert.ok(op.size>=42);assert.ok(op.y+op.size<1335);assert.ok(measure(op.text,op.size)<=880);}}
 assert.throws(()=>layout.layoutCard({templateId:'quote',text,media:[]},measure),/CARD_USE_LETTER/);
 assert.throws(()=>layout.layoutCard({templateId:'letter',text:'一句',petName:'长'.repeat(300)},measure),/CARD_TITLE_LONG/);
});
