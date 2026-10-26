'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const ROOT = path.resolve(__dirname, '../..');
const cloudRequire = createRequire(path.join(ROOT, 'uniCloud-alipay/cloudfunctions/api_pet_avatar/package.json'));
const { PNG } = cloudRequire('pngjs');
const jpeg = cloudRequire('jpeg-js');
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}
function inside(file, base = __dirname) {
  const resolved = path.resolve(base, file);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) throw new Error('PATH_OUTSIDE_EXPERIMENT');
  return resolved;
}
function readImage(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) {
    const w = bytes.readUInt32BE(16), h = bytes.readUInt32BE(20);
    if (!w || !h || w * h > 36e6) throw new Error('IMAGE_DIMENSIONS_LIMIT');
    const image = PNG.sync.read(bytes);
    return { ...image, mime: 'image/png', pngColorType: bytes[25] };
  }
  if (bytes[0] === 255 && bytes[1] === 216) return { ...jpeg.decode(bytes, { useTArray:true, maxResolutionInMP:36, maxMemoryUsageInMB:256 }), mime:'image/jpeg', pngColorType:null };
  throw new Error('UNSUPPORTED_IMAGE_FORMAT');
}
function inspect(bytes) {
  const im = readImage(bytes), count = im.width * im.height;
  let zero=0, partial=0, opaque=0, minX=im.width, minY=im.height, maxX=-1, maxY=-1;
  let border=0, borderTransparent=0;
  const alphaHistogram=Array(256).fill(0);
  for (let y=0;y<im.height;y++) for(let x=0;x<im.width;x++) {
    const a=im.data[(y*im.width+x)*4+3];
    alphaHistogram[a]++;
    if(a===0)zero++; else if(a<255)partial++; else opaque++;
    if(a>8){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
    if(x<im.width*.03 || x>=im.width*.97 || y<im.height*.03 || y>=im.height*.97) {border++;if(a<=8)borderTransparent++;}
  }
  const corners=[[0,0],[im.width-1,0],[0,im.height-1],[im.width-1,im.height-1]].map(([x,y])=>im.data[(y*im.width+x)*4+3]);
  const reasons=[];
  if(im.mime!=='image/png') reasons.push('NOT_PNG_FOR_THIS_EXPERIMENT');
  if(zero/count<.05) reasons.push('NO_MEANINGFUL_TRANSPARENT_BACKGROUND');
  if(!corners.every(a=>a<=8)) reasons.push('OPAQUE_CORNERS');
  if(borderTransparent/Math.max(border,1)<.9) reasons.push('BORDER_BACKGROUND_NOT_TRANSPARENT');
  if(opaque/count<.02) reasons.push('NO_OPAQUE_SUBJECT');
  const bbox=maxX<0?null:{minX,minY,maxX,maxY,width:maxX-minX+1,height:maxY-minY+1};
  let outside=0,outsideNonzero=0,outsideMaxAlpha=0;
  if(bbox)for(let y=0;y<im.height;y++)for(let x=0;x<im.width;x++)if(x<minX||x>maxX||y<minY||y>maxY){const a=im.data[(y*im.width+x)*4+3];outside++;if(a>0)outsideNonzero++;outsideMaxAlpha=Math.max(outsideMaxAlpha,a);}
  return {sha256:sha(bytes),bytes:bytes.length,mime:im.mime,width:im.width,height:im.height,pngColorType:im.pngColorType,
    hasEffectiveTransparency:zero+partial>0,fullyTransparentRatio:zero/count,partiallyTransparentRatio:partial/count,opaqueRatio:opaque/count,
    cornerAlpha:corners,borderTransparentRatio:borderTransparent/Math.max(border,1),alphaBounds:bbox,
    alphaHistogram,lowAlphaOneThroughEightRatio:alphaHistogram.slice(1,9).reduce((n,v)=>n+v,0)/count,
    outsideAlpha8BoundingBox:{pixels:outside,nonzeroAlphaPixels:outsideNonzero,maxAlpha:outsideMaxAlpha,strictAllZero:outside>0&&outsideNonzero===0},
    productionReady:false,strictBackgroundNote:'Low nonzero alpha outside the subject remains in original bytes; no thresholding or background removal performed. Pixel pass is not production acceptance.',
    pixelTransparencyPassed:reasons.length===0,rejectionReasons:reasons,
    nativeOrigin:'REQUIRES_PROVIDER_REQUEST_AND_RESPONSE_PROVENANCE',identity:'NOT_SCORED',furAndAnatomy:'REQUIRES_VISUAL_REVIEW'};
}
function composites(bytes, outDir, prefix) {
  const im=readImage(bytes);
  fs.mkdirSync(outDir,{recursive:true});
  const files=[];
  for(const [name,bg] of Object.entries({white:[255,255,255],black:[0,0,0],guizhuaWarm:[40,28,23]})) {
    const out=new PNG({width:im.width,height:im.height});
    for(let i=0;i<im.data.length;i+=4){
      const a=im.data[i+3]/255;
      for(let c=0;c<3;c++)out.data[i+c]=Math.round(im.data[i+c]*a+bg[c]*(1-a));
      out.data[i+3]=255;
    }
    const file=path.join(outDir,prefix+'-'+name+'.png');
    fs.writeFileSync(file,PNG.sync.write(out));files.push(file);
  }
  return files;
}
function configPresence() {
  const p=path.join(ROOT,'uniCloud-alipay/cloudfunctions/api_pet_avatar/config.json');
  const c=fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf8')):{};
  return {configExists:fs.existsSync(p),apiKeyPresent:Boolean(process.env.DASHSCOPE_API_KEY||process.env.WAN_API_KEY||c.apiKey),
    workspacePresent:Boolean(process.env.DASHSCOPE_WORKSPACE_ID||process.env.WAN_WORKSPACE_ID||c.workspaceId),
    region:c.region||null,storedModel:c.model||null,storedSize:c.size||null,storedTimeoutMs:c.requestTimeoutMs||null,
    runtimeNote:'index.js forces size=2K; local config presence does not establish deployed cloud configuration',
    freeQuotaVerified:false,freeTierOnlyVerified:false};
}
module.exports={fs,path,ROOT,PNG,sha,writeJson,inside,readImage,inspect,composites,configPresence};
