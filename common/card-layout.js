import { layoutIdentityCard } from './card-layout-v3.js';
import { layoutEditorialCard } from './card-layout-v2.js';
// Canvas measurements (not character counts) determine wrapping and pagination.
export const CARD_TEMPLATES = [
  { id:'quote',ratio:[1,1],minPhotos:0,maxPhotos:1,version:1,layout:'center',modes:['current','deceased'] },
  { id:'letter',ratio:[3,4],minPhotos:0,maxPhotos:1,version:3,layout:'letter',modes:['current','deceased'] },
  { id:'day',ratio:[3,4],minPhotos:1,maxPhotos:1,version:3,layout:'photo',modes:['current','deceased'] },
  { id:'collage',ratio:[3,4],minPhotos:2,maxPhotos:4,version:1,layout:'grid',modes:['current','deceased'] },
  { id:'date',ratio:[1,1],minPhotos:0,maxPhotos:1,version:1,layout:'date',modes:['current','deceased'] },
  { id:'habit',ratio:[3,4],minPhotos:0,maxPhotos:1,version:1,layout:'side',modes:['current','deceased'] }
];
export function wrapCardText(text, width, measure) {
  const lines = [];
  for (const paragraph of String(text || '').replace(/\r\n?/g, '\n').split('\n')) {
    let line = '';
    const graphemes = typeof Intl !== 'undefined' && Intl.Segmenter
      ? Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(paragraph), s => s.segment) : Array.from(paragraph);
    for (const char of graphemes) {
      if (line && measure(line + char) > width) {
        // Avoid a dangling opening mark or a closing mark at the next line start.
        const chars=Array.from(line),tail=chars[chars.length-1];
        if (chars.length>1 && (/[（《「『【(“‘]/.test(tail) || /[，。！？；：、）》」』】!?.,;:“”’]/.test(char))) {
          chars.pop();lines.push(chars.join(''));line=tail;
        } else { lines.push(line); line = ''; }
      }
      line += char;
    }
    lines.push(line);
  }
  return lines;
}
export function photoRect(photo, box, fit = 'contain') {
  const [x, y, w, h] = box, scale = fit === 'cover' ? Math.max(w / photo.width, h / photo.height) : Math.min(w / photo.width, h / photo.height);
  const cx=fit==='cover'?Math.max(0,Math.min(1,photo.cropX??.5)):.5,cy=fit==='cover'?Math.max(0,Math.min(1,photo.cropY??.5)):.5;
  return { box, dest: [x + (w - photo.width * scale) * cx, y + (h - photo.height * scale) * cy, photo.width * scale, photo.height * scale] };
}
export function layoutCard(input, measure) {
  if(input.templateVersion===3 && ['day','letter'].includes(input.templateId))return layoutIdentityCard(input,measure,wrapCardText);
  if(input.templateVersion===2&&['day','letter'].includes(input.templateId))return layoutEditorialCard(input,measure,wrapCardText);
  const template = CARD_TEMPLATES.find(t => t.id === input.templateId);
  if (!template) throw new Error('CARD_TEMPLATE_INVALID');
  const width=1080,height=template.ratio[1]===1?1080:1440,margin=100,font=template.id==='quote'?48:44,leading=70;
  const photos=input.media||[];
  if(photos.length<template.minPhotos || photos.length>template.maxPhotos)throw new Error('CARD_PHOTO_COUNT');
  if(!String(input.text||'').trim()&&!photos.length)throw new Error('NARRATIVE_EMPTY');
  const ink='#333A32',rule='#C9CBBB',pages=[];
  const textOp=(text,x,y,size=font)=>({type:'text',text,x,y,size,color:ink});
  const photoOp=(index,box)=>({type:'photo',index,box,fit:photos[index].fit||'contain'});
  const lineOp=(y,x=margin,end=980)=>({type:'line',from:[x,y],to:[end,y],color:rule});
  const header=[];let top=90;
  for(const [value,size,spacing] of [[input.petName,32,44],[input.title,52,66]]){
    if(!value)continue;
    const wrapped=wrapCardText(value,880,t=>measure(t,size));if(wrapped.length>4)throw new Error('CARD_TITLE_LONG');
    for(const text of wrapped){header.push(textOp(text,margin,top,size));top+=spacing;}top+=24;
  }
  if(top>430)throw new Error('CARD_TITLE_LONG');
  const first=[...header];let bodyTop=top+80,bodyX=margin,bodyWidth=880;
  if(template.id==='quote'){
    first.push(lineOp(top+10));bodyTop=Math.max(top+100,320);
    if(photos.length){first.push(photoOp(0,[340,top+60,400,280]));bodyTop=top+395;}
  }else if(template.id==='letter'){
    first.push(lineOp(top+10));bodyTop=top+70;
    if(photos.length){first.push(photoOp(0,[770,top+40,210,180]));bodyTop=top+260;}
  }else if(template.id==='day'){
    first.push(photoOp(0,[70,top+20,940,560]));bodyTop=top+640;
  }else if(template.id==='collage'){
    const gridTop=top+20,h=photos.length===2?450:300;
    for(let i=0;i<photos.length;i++)first.push(photoOp(i,[70+(i%2)*480,gridTop+Math.floor(i/2)*(h+24),460,h]));
    bodyTop=gridTop+Math.ceil(photos.length/2)*(h+24)+55;
  }else if(template.id==='date'){
    if(input.dateText){const dateLines=wrapCardText(input.dateText,880,t=>measure(t,58));if(dateLines.length>3)throw new Error('CARD_TITLE_LONG');for(const line of dateLines){first.push(textOp(line,margin,bodyTop,58));bodyTop+=76;}bodyTop+=25;}
    first.push(lineOp(bodyTop));bodyTop+=65;
    if(photos.length){first.push(photoOp(0,[760,bodyTop,220,230]));bodyWidth=610;}
  }else if(template.id==='habit'){
    first.push({type:'line',from:[70,top+20],to:[70,height-140],color:rule});
    if(photos.length){first.push(photoOp(0,[470,top+20,510,440]));bodyTop=top+530;}else bodyTop=top+150;
  }
  const lines=wrapCardText(input.text,bodyWidth,t=>measure(t,font));let cursor=0,pageNumber=0;
  do{
    const pageTop=pageNumber?130:bodyTop,commands=pageNumber?[lineOp(85)]:[...first];
    const count=Math.floor((height-150-pageTop)/leading);
    if(count<1)throw new Error('CARD_TITLE_LONG');
    if(template.id==='quote'&&lines.length>count)throw new Error('CARD_USE_LETTER');
    for(let i=0;i<count&&cursor<lines.length;i++,cursor++)commands.push({...textOp(lines[cursor],bodyX,pageTop+i*leading),role:'body'});
    pages.push({width,height,background:input.mode==='deceased'?'#F7F5F0':'#FAF7F0',templateVersion:1,commands});pageNumber++;
    if(pageNumber>100)throw new Error('CARD_TOO_MANY_PAGES');
  }while(cursor<lines.length);
  pages.forEach((page,i)=>{page.commands.push(lineOp(height-105));page.commands.push(textOp(`${i+1} / ${pages.length}`,920,height-70,28));});
  return pages;
}
