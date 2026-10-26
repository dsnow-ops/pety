'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {moduleFrom}=require('../scripts/lib/health-recovery-runtime.cjs');
const viewSource=fs.readFileSync('common/record-views.js','utf8');
const views=moduleFrom('common/record-views.js','queryRecords,queryWorkPage,lifeText,lifePhotos,hasCareContent,buildRecordDirectory,recordPeriodLabel'+(viewSource.includes('function queryRecordPage(')?',queryRecordPage':''),{eventTimeLabel:r=>r.localDate||'时间未详'});
const scope={namespace:'account:TEST-pagination',ready:true},petId='TEST-history-pet';
const row=(i,patch={})=>({id:'TEST-row-'+String(i).padStart(4,'0'),namespace:scope.namespace,petId,kind:'life',mode:'current',original:'TEST 日常 '+i,localDate:'2026-10-01',createdAt:i,media:[],...patch});
function page(rows){
 const script=fs.readFileSync('pages/album/album.vue','utf8').match(/<script>([\s\S]*?)<\/script>/)[1].replace(/^import[^;]+;\s*/gm,'').replace('export default','return');
 const deps={...views,NarrativeCanvas:{},RecordPager:{},creativeInsets:()=>({}),photoExportDestination:()=> '浏览器下载',isDataScopeCurrent:()=>true,getActivePet:()=>({id:petId})};
 const definition=Function(...Object.keys(deps),script)(...Object.values(deps));
 const vm={...definition.data(),scope,petId,rows,$nextTick:async()=>{}};
 for(const[name,fn]of Object.entries(definition.methods))vm[name]=fn.bind(vm);
 for(const[name,fn]of Object.entries(definition.computed))Object.defineProperty(vm,name,{get:()=>fn.call(vm)});
 vm.loadCovers=()=>{};return{vm,definition};
}
test('album can read every source beyond the thousandth record with at most thirty rows rendered',()=>{
 const rows=Array.from({length:1105},(_,i)=>row(i)),before=JSON.stringify(rows),{vm}=page(rows),seen=[];
 for(let offset=0;offset<1105;offset+=30){vm.recordOffset=offset;assert.ok(vm.visibleRecords.length<=30);seen.push(...vm.visibleRecords.map(r=>r.id));}
 assert.equal(new Set(seen).size,1105);assert.equal(seen.at(-1),'TEST-row-0000');assert.equal(JSON.stringify(rows),before);
});
test('photo browsing filters eligible originals before paging, including photos older than thirty text records',()=>{
 const photo={id:'TEST-photo',namespace:scope.namespace,petId,purpose:'life',durable:true};
 const rows=Array.from({length:45},(_,i)=>row(i));rows.push(row(-1,{id:'TEST-old-photo',media:[photo]}),row(-2,{id:'TEST-care',note:'TEST照护',media:[photo]}),row(-3,{id:'TEST-foreign',petId:'OTHER',media:[photo]}));
 const{vm}=page(rows);vm.viewMode='photos';assert.equal(vm.resultCount,1);assert.equal(vm.photoRows.length,1);assert.equal(vm.photoRows[0].row.id,'TEST-old-photo');
});
test('removing the last page sources clamps to the remaining final page rather than leaving a blank screen',()=>{
 const{vm}=page(Array.from({length:65},(_,i)=>row(i)));vm.recordOffset=60;assert.equal(vm.visibleRecords.length,5);
 vm.rows=vm.rows.slice(0,40);assert.equal(vm.recordResult.offset,30);assert.equal(vm.visibleRecords.length,10);
 vm.rows=[];assert.equal(vm.recordResult.offset,0);assert.equal(vm.visibleRecords.length,0);
});
test('page changes preserve deliberate photo selection and stop while an export is busy',async()=>{
 const{vm}=page(Array.from({length:65},(_,i)=>row(i)));vm.photoExportSelected=[{key:'TEST-kept'}];await vm.changeRecordPage(30);assert.equal(vm.recordOffset,30);assert.deepEqual(vm.photoExportSelected,[{key:'TEST-kept'}]);
 vm.photoExportBusy=true;await vm.changeRecordPage(60);assert.equal(vm.recordOffset,30);
});
test('filters and view changes start from the first page; photo month selection stays in photos',()=>{
 const{vm,definition}=page([row(1)]);vm.recordOffset=300;vm.searchChanged();assert.equal(vm.recordOffset,0);
 vm.viewMode='photos';vm.choosePeriod('2026-10');assert.equal(vm.viewMode,'photos');assert.equal(vm.period,'2026-10');
 vm.recordOffset=300;definition.watch.viewMode.call(vm,'records');assert.equal(vm.recordOffset,0);
});
test('every saved work remains browsable beyond one hundred, with only four covers per page',()=>{
 const rows=Array.from({length:105},(_,i)=>row(i,{_group:'works',_savedAt:i,title:'TEST 作品 '+i,original:'TEST 已保存文字 '+i}));
 const before=JSON.stringify(rows),{vm}=page(rows),seen=[];vm.viewMode='works';vm.filter='works';
 for(let offset=0;offset<105;offset+=4){vm.workOffset=offset;assert.ok(vm.visibleWorks.length<=4);seen.push(...vm.visibleWorks.map(r=>r.id));}
 assert.equal(new Set(seen).size,105);assert.equal(seen.at(-1),'TEST-row-0000');assert.equal(JSON.stringify(rows),before);
});
test('saved-work search uses frozen title and text, clamps page changes and never rewrites snapshots',()=>{
 const rows=[row(1,{_group:'works',_savedAt:1,title:'TEST 海边',original:'TEST 冻结文字'}),row(2,{_group:'works',_savedAt:2,title:'TEST 窗边',text:'TEST 阳光'}),row(3,{original:'TEST 阳光原记录'})],before=JSON.stringify(rows),{vm}=page(rows);
 vm.viewMode='works';vm.workOffset=100;vm.query='阳光';assert.equal(vm.workResult.offset,0);assert.deepEqual(vm.visibleWorks.map(r=>r.id),['TEST-row-0002']);
 vm.query='海边';assert.deepEqual(vm.visibleWorks.map(r=>r.id),['TEST-row-0001']);vm.query='TEST 不存在';assert.equal(vm.workResult.total,0);assert.equal(JSON.stringify(rows),before);
});
