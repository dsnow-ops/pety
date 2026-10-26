// Paper coordinates only. Shared by the editor and final Canvas renderer.
export const SEAL_LIMITS=Object.freeze({minWidth:.06,maxWidth:.38});
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const finite=(v,f)=>Number.isFinite(Number(v))?Number(v):f;
export const sealAngle=n=>((finite(n,0)+180)%360+360)%360-180;
export function normalizeSealTransform(s={}){return {placementMode:'free',transformVersion:1,centerX:clamp(finite(s.centerX,.85),0,1),centerY:clamp(finite(s.centerY,.88),0,1),widthRatio:clamp(finite(s.widthRatio,.12),SEAL_LIMITS.minWidth,SEAL_LIMITS.maxWidth),rotationDeg:sealAngle(s.rotationDeg),pageIndex:Math.max(0,Math.floor(finite(s.pageIndex,0))),zOrder:'above-content'};}
export function presetToFree(page,box,pageIndex=0){const [x,y,w]=box;return normalizeSealTransform({centerX:(x+w/2)/page.width,centerY:(y+w/2)/page.height,widthRatio:w/page.width,rotationDeg:0,pageIndex});}
export function sealGeometry(page,s){const t=normalizeSealTransform(s),w=t.widthRatio*page.width;return {x:t.centerX*page.width,y:t.centerY*page.height,width:w,height:w,angle:t.rotationDeg*Math.PI/180};}
export function paperPoint(touch,rect){return{x:(touch.clientX-rect.left)/rect.width,y:(touch.clientY-rect.top)/rect.height};}
export function moveSeal(start,from,to){return normalizeSealTransform({...start,centerX:start.centerX+to.x-from.x,centerY:start.centerY+to.y-from.y});}
export function turnSeal(start,from,to,ratio){const dx=from.x-start.centerX,dy=(from.y-start.centerY)*ratio,x=to.x-start.centerX,y=(to.y-start.centerY)*ratio;return normalizeSealTransform({...start,widthRatio:start.widthRatio*Math.hypot(x,y)/Math.max(.001,Math.hypot(dx,dy)),rotationDeg:start.rotationDeg+(Math.atan2(y,x)-Math.atan2(dy,dx))*180/Math.PI});}
export function pinchSeal(start,a,b,c,d,ratio){const mx=(a.x+b.x)/2,my=(a.y+b.y)/2,nx=(c.x+d.x)/2,ny=(c.y+d.y)/2,angle=Math.atan2((d.y-c.y)*ratio,d.x-c.x)-Math.atan2((b.y-a.y)*ratio,b.x-a.x),scale=clamp(Math.hypot(d.x-c.x,(d.y-c.y)*ratio)/Math.max(.001,Math.hypot(b.x-a.x,(b.y-a.y)*ratio)),SEAL_LIMITS.minWidth/start.widthRatio,SEAL_LIMITS.maxWidth/start.widthRatio),ox=start.centerX-mx,oy=(start.centerY-my)*ratio;return normalizeSealTransform({...start,centerX:nx+scale*(Math.cos(angle)*ox-Math.sin(angle)*oy),centerY:ny+scale*(Math.sin(angle)*ox+Math.cos(angle)*oy)/ratio,widthRatio:start.widthRatio*scale,rotationDeg:start.rotationDeg+angle*180/Math.PI});}
export function drawFreeSeal(ctx,page,settings,draw){const g=sealGeometry(page,settings);ctx.save();ctx.beginPath();ctx.rect(0,0,page.width,page.height);ctx.clip();ctx.translate(g.x,g.y);ctx.rotate(g.angle);draw([-g.width/2,-g.height/2,g.width]);ctx.restore();}

// Advisory only: intersect the rotated seal square with actual measured text
// bounds. Never snap, clamp, or write back the user's transform here.
export function sealOverlapsText(page,settings,bounds=[]){
 const g=sealGeometry(page,settings),c=Math.cos(g.angle),s=Math.sin(g.angle),half=g.width/2;
 const square=[[-half,-half],[half,-half],[half,half],[-half,half]].map(([x,y])=>[g.x+x*c-y*s,g.y+x*s+y*c]);
 const area=p=>Math.abs(p.reduce((sum,a,i)=>{const b=p[(i+1)%p.length];return sum+a[0]*b[1]-b[0]*a[1];},0))/2;
 return bounds.some(box=>{
  const [x,y,w,h]=box;if(!(w>0&&h>0))return false;
  let points=square;
  for(const [axis,edge,direction] of [[0,x,1],[0,x+w,-1],[1,y,1],[1,y+h,-1]]){
   const result=[];
   for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length],insideA=direction*(a[axis]-edge)>=0,insideB=direction*(b[axis]-edge)>=0;
    if(insideA)result.push(a);
    if(insideA!==insideB){const t=(edge-a[axis])/(b[axis]-a[axis]);result.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}
   }
   points=result;if(!points.length)return false;
  }
  return area(points)>=Math.min(w*h*.22,g.width*g.height*.08);
 });
}
