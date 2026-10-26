'use strict';
const fs=require('node:fs'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
test('official profile store can initialize the login page without a cloud DB connection',()=>{
 const prefix=process.env.PETY_RELEASE_BASELINE==='1'?'unpackage/release-sprint-20261010/baseline/source/':'';
 const file=prefix+'uni_modules/uni-id-pages/common/store.js',source=fs.readFileSync(file,'utf8').replace(/\/\/ #ifdef VUE2[\s\S]*?\/\/ #endif/g,'').replace(/^import[\s\S]*?from\s*['"][^'"]+['"];?/gm,'').replace(/export default /g,'const exported = ').replace(/export /g,'');let calls=0;
 const box={uni:{getStorageSync:()=>null},uniCloud:{importObject:()=>({}),database:()=>{calls++;return undefined;}},config:{},pagesJson:{},Vue:{reactive:x=>x},reactive:x=>x};
 vm.runInNewContext(source,box);assert.equal(calls,0);
});
