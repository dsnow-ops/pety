const fs=require('node:fs'),test=require('node:test'),assert=require('node:assert/strict');
function load(file,names,deps={}){return Function(...Object.keys(deps),fs.readFileSync(file,'utf8').replace(/^import[^;]+;\s*/gm,'').replace(/export /g,'')+';return {'+names+'};')(...Object.values(deps));}
const v2=load('common/card-layout-v2.js','layoutEditorialCard'),layout=load('common/card-layout.js','layoutCard,photoRect',v2);
const measure=(text,size)=>Array.from(text).reduce((n,c)=>n+(/[\x00-\x7f]/.test(c)?size*.55:size),0);
test('legacy versions stay unchanged, v2 is explicit and only two templates adopt it',()=>{
 for(const id of ['day','letter']){const input={templateId:id,text:'普通的一天',media:id==='day'?[{width:900,height:600}]:[]};const old=layout.layoutCard(input,measure);assert.equal(old[0].templateVersion,1);assert.ok(old[0].commands.some(c=>c.text==='1 / 1'));const next=layout.layoutCard({...input,templateVersion:2},measure);assert.equal(next[0].templateVersion,2);assert.ok(!next[0].commands.some(c=>c.text==='1 / 1'));}
 for(const id of ['quote','date','habit','collage']){const pages=layout.layoutCard({templateId:id,templateVersion:1,text:'留下一刻',media:id==='collage'?[{},{}]:[]},measure);assert.equal(pages[0].templateVersion,1);}
});
test('natural and stress letters preserve body and signature within real page bounds',()=>{
 for(const body of ['一句话。','自然的一段话。'.repeat(18),('我并不后悔。🙂\n\nLongWordWithoutSpaces and a quiet day.\n').repeat(40)]){
  const original={templateId:'letter',templateVersion:2,text:body,media:[],salutation:'亲爱的小禾：',signature:'一直记着你的我',dateText:'2026年9月28日'};const snapshot=structuredClone(original),pages=layout.layoutCard(original,measure);assert.deepEqual(original,snapshot);
  assert.equal(pages.flatMap(p=>p.commands.filter(c=>c.role==='body')).map(c=>c.text).join(''),body.replace(/\n/g,''));
  assert.equal(pages.flatMap(p=>p.commands).filter(c=>c.text===original.salutation).length,1);
  for(const p of pages)for(const op of p.commands.filter(c=>c.type==='text')){assert.ok(op.y>=0&&op.y+op.size<=1440);assert.ok(measure(op.text,op.size)<=840||op.role==='pageNumber');}
  assert.ok(pages.at(-1).commands.some(c=>c.text===original.signature));
 }
});
test('photo page overflow is explicit, transparent portrait and crop positions retain aspect ratio',()=>{
 assert.throws(()=>layout.layoutCard({templateId:'day',templateVersion:2,text:'长文。'.repeat(100),media:[{width:500,height:900}]},measure),/CARD_DAY_LONG/);
 const p=layout.layoutCard({templateId:'day',templateVersion:2,text:'今天安静地待了一会儿。',media:[{width:900,height:900,sourceFileId:'existing',fit:'cover'}]},measure)[0];assert.equal(p.commands.find(c=>c.type==='photo').fit,'contain');
 const left=layout.photoRect({width:1600,height:900,cropX:0},[0,0,500,700],'cover'),right=layout.photoRect({width:1600,height:900,cropX:1},[0,0,500,700],'cover');assert.equal(left.dest[0],0);assert.ok(right.dest[0]<left.dest[0]);assert.ok(Math.abs(left.dest[2]/left.dest[3]-1600/900)<1e-12);
});
test('blank paragraph separators use spacing without consuming another body line',()=>{
 const pages=layout.layoutCard({templateId:'letter',templateVersion:2,text:'第一段。\n\n第二段。',media:[]},measure);
 const body=pages[0].commands.filter(c=>c.role==='body');assert.equal(body.length,2);assert.equal(body[1].y-body[0].y,96);
});
test('safe area takes actual window values, without a guessed device height',()=>{
 const {creativeInsets}=load('common/creative-insets.js','creativeInsets');assert.deepEqual(creativeInsets({getWindowInfo:()=>({statusBarHeight:40,safeAreaInsets:{top:44,bottom:34}})}),{'--creative-top':'44px','--creative-bottom':'34px'});assert.deepEqual(creativeInsets({getSystemInfoSync:()=>({statusBarHeight:27})}),{'--creative-top':'27px','--creative-bottom':'0px'});
});
