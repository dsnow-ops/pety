// A small local monochrome asset; no provider, quota or generated-avatar mutation.
export function sealFromPixels(rgba,width,height,sourceKey){
 if(!rgba||rgba.length!==width*height*4)throw Error('SEAL_PIXELS_INVALID');
 const light=[];for(let i=0;i<width*height;i++)light.push((rgba[i*4]*.299+rgba[i*4+1]*.587+rgba[i*4+2]*.114));
 const sorted=[...light].sort((a,b)=>a-b),low=sorted[Math.floor(sorted.length*.05)],high=sorted[Math.floor(sorted.length*.95)];
 const pixels=light.map((v,i)=>rgba[i*4+3]>32?Math.max(0,Math.min(3,Math.round((high-v)/Math.max(1,high-low)*3))):0);
 if(!pixels.some(Boolean))throw Error('SEAL_IMAGE_EMPTY');
 return {containsName:false,version:2,width,height,pixels,sourceKey,createdAt:Date.now()};
}
export function drawPetSeal(ctx,asset,box,style='vermilion'){
 if(![1,2].includes(asset?.version)||!Array.isArray(asset.pixels)||asset.pixels.length!==asset.width*asset.height)return;
 const [x,y,size]=box,emboss=style==='emboss',ink=emboss?'#B8B3A4':'#A44735',pad=size*.13,cell=(size-pad*2)/asset.width;
 const pass=(dx,dy,color)=>{
  ctx.setFillStyle(color);
  const frame=(left,top,width,thickness)=>{ctx.fillRect(left,top,width,thickness);ctx.fillRect(left,top+width-thickness,width,thickness);ctx.fillRect(left,top,thickness,width);ctx.fillRect(left+width-thickness,top,thickness,width);};
  frame(x+dx,y+dy,size,size*.019);frame(x+size*.045+dx,y+size*.045+dy,size*.91,size*.006);
  asset.pixels.forEach((p,i)=>{if(!p)return;if(asset.version===2)ctx.setFillStyle(color==='#FFFFFF'?color:emboss?['','#E0DDD3','#CBC6B9',ink][p]:['','#D8ABA0','#BC7564',ink][p]);ctx.fillRect(x+pad+(i%asset.width)*cell+dx,y+pad+Math.floor(i/asset.width)*cell+dy,cell+.12,cell+.12);});
 };
 if(emboss)pass(1.7,2.2,'#FFFFFF');pass(0,0,ink);
}
export function sealBox(page,settings={}){const size=settings.size==='small'?78:settings.size==='large'?116:96;return [settings.position==='left'?72:page.width-72-size,page.height-60-size,size];}
