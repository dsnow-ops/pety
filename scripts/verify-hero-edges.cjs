'use strict';
// Reproducible QA: inspect actual PNG bytes, flatten with straight alpha on four
// backgrounds, and save review artifacts. This does not alter the source asset.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {PNG}=require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/node_modules/pngjs');
const {evaluateHeroEdges,BACKGROUNDS}=require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/hero-edge-quality');
const file=path.resolve(process.argv[2]||'unpackage/hero-polish/cloud-hero.png'),out=path.dirname(file),image=PNG.sync.read(fs.readFileSync(file));
const result=evaluateHeroEdges(image);fs.writeFileSync(path.join(out,'edge-evidence.json'),JSON.stringify(result,null,2));
for(const [name,bg]of Object.entries(BACKGROUNDS)){
 const flat=new PNG({width:image.width,height:image.height});
 for(let i=0;i<image.data.length;i+=4){const a=image.data[i+3]/255;for(let c=0;c<3;c++)flat.data[i+c]=Math.round(image.data[i+c]*a+bg[c]*(1-a));flat.data[i+3]=255}
 fs.writeFileSync(path.join(out,`edge-${name}.png`),PNG.sync.write(flat));
}
console.log(result);assert.equal(result.qualified,true,'actual cloud Hero edge gate must pass');
