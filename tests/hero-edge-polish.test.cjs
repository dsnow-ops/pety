'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const q=require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/hero-edge-quality');
function sample(edge){const width=100,height=100,data=Buffer.alloc(width*height*4);for(let y=15;y<85;y++)for(let x=15;x<85;x++){const c=Math.min(x-15,84-x,y-15,84-y)<4?edge:[190,185,176];data.set([...c,255],(y*width+x)*4)}data.set([245,130,150,255],(50*width+50)*4);return {width,height,data}}
test('four-background edge gate rejects magenta, green and neutral fog, then verifies bounded repair',()=>{
 for(const c of [[236,140,218],[100,238,130],[250,245,236]]){const p=sample(c),before=q.evaluateHeroEdges(p);assert.equal(before.qualified,false);assert.equal(Object.keys(before.backgrounds).length,4);const result=q.enforceHeroEdges(p);assert.equal(result.qualified,true);assert.ok(result.repair.corrected>0);assert.deepEqual(Array.from(p.data.subarray((50*100+50)*4,(50*100+50)*4+4)),[245,130,150,255],'interior pink identity preserved')}
});
test('straight alpha is not premultiplied; only fractional boundary is contracted',()=>{
 const p=sample([190,185,176]),i=(15*100+50)*4;p.data[i+3]=128;const result=q.enforceHeroEdges(p);assert.equal(result.alphaMode,'straight');assert.equal(p.data[i],190);assert.ok(p.data[i+3]<128);assert.equal(p.data[(40*100+40)*4+3],255);assert.equal(p.data[0],0);
 const rgb=q.composite([190,185,176],.5,[255,255,255]);assert.equal(rgb[0],222.5);
});
test('empty/unsupported matte cannot be published as qualified',()=>{
 const p={width:24,height:24,data:Buffer.alloc(24*24*4)};assert.equal(q.enforceHeroEdges(p).qualified,false);
});
test('disconnected tinted whiskers are audited and neutralized without deleting their alpha',()=>{
 const p=sample([190,185,176]);for(let y=20;y<80;y++)p.data.set([250,40,210,128],(y*100+5)*4);
 assert.equal(q.evaluateHeroEdges(p).qualified,false);assert.equal(q.enforceHeroEdges(p).qualified,true);
 const j=(40*100+5)*4;assert.equal(p.data[j],p.data[j+1]);assert.equal(p.data[j+3],128);
});
test('press links shadow and character; reduced motion and scroll gestures reset displacement',()=>{
 const text=fs.readFileSync('components/PetAvatarHero.vue','utf8');const script=text.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1].replace(/import[^;]+;/g,'').replace('export default','return');const c=Function(script)();
 const vm={motionReduced:false,touching:true,tapAnimating:false,currentReady:true,offsetX:3,subjectGeometry:{foot:30,width:200},imageUrl:'hero',touchStartX:0,touchStartY:0,hasCutout:true,...c.methods};
 assert.match(c.computed.pedestalStyle.call(vm).transform,/1.035/);vm.motionReduced=true;assert.match(c.computed.pedestalStyle.call(vm).transform,/scale\(1\)/);vm.motionReduced=false;vm.onTouchMove({touches:[{clientX:5,clientY:30}]});assert.equal(vm.touching,false);assert.equal(vm.offsetX,0);
});
