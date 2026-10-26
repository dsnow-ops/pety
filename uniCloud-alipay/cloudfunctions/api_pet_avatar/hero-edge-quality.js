'use strict';

// PNG stores straight (unassociated) RGB. Never multiply RGB by alpha on export:
// the renderer/compositor does that exactly once. All units below are source px.
const EDGE_VERSION = 1;
const BACKGROUNDS = { white: [255,255,255], app: [245,242,236], charcoal: [35,38,40], contrast: [42,119,139] };

function geometry(image) {
 const {width:w,height:h,data}=image,n=w*h,dist=new Uint16Array(n),owner=new Int32Array(n),queue=new Int32Array(n);
 for(let i=0;i<n;i++)dist[i]=data[i*4+3]<=8?0:30000;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(x)dist[i]=Math.min(dist[i],dist[i-1]+1);if(y)dist[i]=Math.min(dist[i],dist[i-w]+1)}
 for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){const i=y*w+x;if(x+1<w)dist[i]=Math.min(dist[i],dist[i+1]+1);if(y+1<h)dist[i]=Math.min(dist[i],dist[i+w]+1)}
 let head=0,tail=0;
 for(let i=0;i<n;i++)if(dist[i]>=12&&data[i*4+3]>=248){owner[i]=i+1;queue[tail++]=i}
 while(head<tail){const i=queue[head++],x=i%w,y=(i/w)|0;const visit=j=>{if(owner[j]||!dist[j])return;owner[j]=owner[i];queue[tail++]=j};if(x)visit(i-1);if(x+1<w)visit(i+1);if(y)visit(i-w);if(y+1<h)visit(i+w)}
 return {dist,owner};
}
function composite(rgb,alpha,bg) {return rgb.map((v,c)=>v*alpha+bg[c]*(1-alpha))}
function largestCluster(indices,width) {
 const remaining=new Set(indices);let largest=0;
 while(remaining.size){const first=remaining.values().next().value,queue=[first];remaining.delete(first);let count=0;
  while(queue.length){const i=queue.pop(),x=i%width;count++;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(x+dx<0||x+dx>=width)continue;const j=i+dy*width+dx;if(remaining.delete(j))queue.push(j)}}
  largest=Math.max(largest,count);
 }return largest;
}
function evidence(image,geo=geometry(image)) {
 const backgrounds=Object.fromEntries(Object.keys(BACKGROUNDS).map(k=>[k,{tested:0,spill:0,fog:0,maxError:0}]));
 const {data}=image;let tested=0,spill=0,fog=0;const spillIndices=[],fogIndices=[];
 for(let i=0;i<geo.dist.length;i++){
  if(!geo.dist[i]||geo.dist[i]>4)continue;
  const j=i*4,s=(geo.owner[i]-1)*4,a=data[j+3]/255;if(a<.08)continue;
  const rgb=Array.from(data.subarray(j,j+3)),neutral=(rgb[0]+2*rgb[1]+rgb[2])/4;
  const ref=geo.owner[i]?Array.from(data.subarray(s,s+3)):[neutral,neutral,neutral],delta=rgb.map((v,c)=>v-ref[c]);
  // Compare local foreground, not absolute hue, so naturally pink ears and
  // ginger fur are not classified just because of their own color.
  const magenta=delta[0]-delta[1]+.65*(delta[2]-delta[1]);
  const green=delta[1]-(delta[0]+delta[2])/2;
  const isSpill=(magenta>16&&delta[0]-delta[1]>8)||(green>16);
  const mean=(delta[0]+delta[1]+delta[2])/3;
  const isFog=Math.abs(mean)>42&&Math.max(...delta)-Math.min(...delta)<10;
  tested++;
  let visibleSpill=false,visibleFog=false;
  for(const [name,bg] of Object.entries(BACKGROUNDS)){
   const actual=composite(rgb,a,bg),expected=composite(ref,a,bg);
   const error=Math.max(...actual.map((v,c)=>Math.abs(v-expected[c])));
   const row=backgrounds[name];row.tested++;row.maxError=Math.max(row.maxError,error);
   if(isSpill&&error>10){row.spill++;visibleSpill=true}
   if(isFog&&error>18){row.fog++;visibleFog=true}
  }
  if(visibleSpill){spill++;spillIndices.push(i)}if(visibleFog){fog++;fogIndices.push(i)}
 }
 const spillRatio=spill/Math.max(tested,1),fogRatio=fog/Math.max(tested,1);
 const spillCluster=largestCluster(spillIndices,image.width),fogCluster=largestCluster(fogIndices,image.width);
 return {version:EDGE_VERSION,alphaMode:'straight',bandPx:4,tested,spillPixels:spill,fogPixels:fog,spillRatio,fogRatio,spillCluster,fogCluster,
  thresholds:{spillRatio:.005,fogRatio:.01,spillCluster:12,fogCluster:32,visibleSpillError:10,visibleFogError:18},backgrounds,
  qualified:tested>0&&spillRatio<=.005&&fogRatio<=.01&&spillCluster<=12&&fogCluster<=32};
}
function refine(image,{contractPx=1}={}) {
 const geo=geometry(image),source=Buffer.from(image.data);let corrected=0;
 for(let i=0;i<geo.dist.length;i++){
  const j=i*4;
  if(source[j+3]===0){image.data[j]=image.data[j+1]=image.data[j+2]=0;continue}
  if(geo.dist[i]>8)continue;
  const s=(geo.owner[i]-1)*4,neutral=Math.round((source[j]+2*source[j+1]+source[j+2])/4);
  const ref=geo.owner[i]?[source[s],source[s+1],source[s+2]]:[neutral,neutral,neutral];
  const d=[0,1,2].map(c=>source[j+c]-ref[c]);
  const spill=(d[0]-d[1]+.65*(d[2]-d[1])>10&&d[0]-d[1]>5)||(d[1]-(d[0]+d[2])/2>10);
  const fog=Math.abs((d[0]+d[1]+d[2])/3)>36&&Math.max(...d)-Math.min(...d)<12;
  if(spill||fog){for(let c=0;c<3;c++)image.data[j+c]=ref[c];corrected++}
  // Contract only the outer fractional matte; keep isolated whiskers and
  // opaque interior untouched. At 2K this is 1 source px, not a CSS blur.
  if(geo.owner[i]&&contractPx&&geo.dist[i]<=contractPx+1&&source[j+3]<248){const a=source[j+3]/255;image.data[j+3]=Math.round(255*a*a)}
 }
 return {corrected,contractPx,alphaMode:'straight'};
}
function enforceHeroEdges(image) {
 const before=evidence(image),repair=refine(image),after=evidence(image);
 // One bounded color-only retry; never repeatedly erode the silhouette.
 if(!after.qualified){refine(image,{contractPx:0});const retry=evidence(image);return {...retry,repair,before:{spillRatio:before.spillRatio,fogRatio:before.fogRatio},passes:2}}
 return {...after,repair,before:{spillRatio:before.spillRatio,fogRatio:before.fogRatio},passes:1};
}
module.exports={EDGE_VERSION,BACKGROUNDS,geometry,evaluateHeroEdges:evidence,refineHeroEdges:refine,enforceHeroEdges,composite};
