import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { deriveStagePalette, DEFAULT_STAGE_PALETTE, rememberStagePalette, readStagePalette } from '../common/pet-stage-palette.js';
globalThis.uni={getStorageSync:()=>undefined,setStorageSync:()=>{}};
function pixels(background,subject=[20,20,20]) {
 const data=new Uint8ClampedArray(48*48*4);
 for(let y=0;y<48;y++)for(let x=0;x<48;x++)data.set([...(x>8&&x<40&&y>8&&y<40?subject:background),255],(y*48+x)*4);
 return data;
}

test('varied neutral backgrounds still extend their edge colors without repeating texture',()=>{
 const data=pixels([200,190,180]);
 for(let y=0;y<48;y++)for(let x=0;x<48;x++)if(x<3||x>44||y<3||y>44){const v=(x+y)%2?150:230;data.set([v,v-8,v-16,255],(y*48+x)*4);}
 const palette=deriveStagePalette(data,48,48);
 assert.match(palette.topSurface,/linear-gradient/);assert.match(palette.bottomSurface,/linear-gradient/);
 assert.equal(palette.topTextureSafe,false);assert.equal(palette.edgeVersion,2);
});
test('C1 edge continuation rejects foreground and unsafe title regions without recoloring the pet',()=>{
 const clean=new Uint8ClampedArray(48*48*4);for(let i=0;i<clean.length;i+=4)clean.set([190,181,172,255],i);
 const before=clean.slice(),p=deriveStagePalette(clean,48,48);
 assert.equal(p.topTextureSafe,true);assert.equal(p.bottomTextureSafe,true);assert.equal(p.headerSafe,true);assert.deepEqual(clean,before);
 clean.set([30,25,20,255],(47*48+24)*4);assert.equal(deriveStagePalette(clean,48,48).bottomTextureSafe,false);
 clean.set([250,250,250,255],(6*48+8)*4);assert.equal(deriveStagePalette(clean,48,48).headerSafe,false);
 assert.equal(deriveStagePalette(pixels([60,55,50]),48,48).topTextureSafe,false);
});
test('warm cool and neutral references remain inside a three-color page palette regardless of fur',()=>{
 for(const bg of [[200,190,175],[188,192,198],[195,195,195]]) {
  const a=deriveStagePalette(pixels(bg),48,48),b=deriveStagePalette(pixels(bg,[250,140,20]),48,48);
  assert.equal(a.surface,b.surface);assert.equal(a.blend,true);
  assert.ok(['#f5f2ec','#f1f3f2','#f4f3ef'].includes(a.page));
 }
});
test('saturated or dark surroundings never create dirty feathering or dark page colors',()=>{
 assert.equal(deriveStagePalette(undefined,48,48).blend,false);
 assert.equal(deriveStagePalette([],48,48).blend,false);
 for(const bg of [[255,0,200],[20,25,20],[0,255,0]]) {
  const p=deriveStagePalette(pixels(bg),48,48);
  assert.equal(p.blend,false);assert.equal(p.surface,DEFAULT_STAGE_PALETTE.surface);
 }
 assert.equal(deriveStagePalette(new Uint8ClampedArray(48*48*4),48,48).blend,false);
});
test('palette cache is isolated by pet and immutable image identity',()=>{
 rememberStagePalette('petA::master1',deriveStagePalette(pixels([200,190,180]),48,48));
 assert.equal(readStagePalette('petB::master1'),undefined);
 assert.equal(readStagePalette('petA::master2'),undefined);
});
test('late image events from a different pet or master cannot reveal or recolor the stage',()=>{
 const source=fs.readFileSync(new URL('../components/PetPortraitStage.vue',import.meta.url),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1].replace(/import[^;]+;/g,'').replace('export default','return');
 const scope={};const component=Function('isDataScopeCurrent',source)(s=>s===scope);
 const vm={dataScope:scope,disposed:false,identity:'B::new::asset',imageUrl:'urlB',ready:false};
 assert.equal(component.methods.owns.call(vm,{currentTarget:{dataset:{identity:'A::old::asset',url:'urlA'}}}),false);
 assert.equal(component.methods.owns.call(vm,{currentTarget:{dataset:{identity:vm.identity,url:'expired'}}}),false);
 assert.equal(component.methods.owns.call(vm,{currentTarget:{dataset:{identity:vm.identity,url:vm.imageUrl}}}),true);
});
test('four edge continuations preserve ground light and survive a cold page without storing URLs',()=>{
 const disk={},uni={getStorageSync:k=>disk[k],setStorageSync:(k,v)=>disk[k]=JSON.parse(JSON.stringify(v))};
 const source=fs.readFileSync(new URL('../common/pet-stage-palette.js',import.meta.url),'utf8').replace(/^import[^;]+;\s*/gm,'').replace(/export /g,'');
 const scope={namespace:'guest:local',version:0,ready:true};const store={...uni,forScope:()=>uni};
 const load=()=>Function('scopedStorage','captureDataScope','isDataScopeCurrent',source+';return {deriveStagePalette,rememberStagePalette,readStagePalette};')(store,()=>scope,s=>s===scope);
 const first=load(),palette=first.deriveStagePalette(pixels([180,175,166]),48,48);
 assert.match(palette.topSurface,/linear-gradient\(90deg/);assert.match(palette.bottomSurface,/linear-gradient\(90deg/);
 first.rememberStagePalette('A::master1::master1',palette);const next=load();
 assert.deepEqual(next.readStagePalette('A::master1::master1'),palette);
 assert.equal(next.readStagePalette('B::master1::master1'),undefined);
 assert.equal(next.readStagePalette('A::master2::master2'),undefined);
 assert.equal(JSON.stringify(disk).includes('https://'),false);
});
