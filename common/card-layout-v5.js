import {wrapCardText} from './card-layout.js';
import {layoutComposedCard} from './card-layout-v4.js';
// Three compositions; same measured type, photo and seal renderer as old versions.
export function layoutStudioCard(input,measure){
 if(!['day','daily_record','letter'].includes(input.templateId))return layoutComposedCard(input,measure);
 const id=input.templateId,paper=input.presentation||{},pages=[],ink='#354034',muted='#777D6B',W=1080,H=1440;
 const wrap=(s,w,size)=>wrapCardText(String(s||''),w,t=>measure(t,size));
 const tx=(s,x,y,size=42,role='body')=>({type:'text',text:s,x,y,size,color:role==='meta'?muted:ink,role});
 const ln=(x,y,w)=>({type:'line',from:[x,y],to:[x+w,y],color:'#D7D2C5'});
 let ops=[],y=0,bodyEnd=0;const footerX=input.seal?.position==='left'?250:80,notice=wrap(input.healthNotice,730,24),limit=H-170-notice.length*32;
 const start=()=>{ops=[];y=170;if(paper.paperTextureId)for(let yy=16;yy<H;yy+=24)ops.push({...ln(0,yy,W),color:'#F5F2EA'});
  if(input.petName)wrap(input.petName,600,30).forEach((s,i)=>ops.push(tx(s,80,64+i*38,30,'meta')));
  ops.push(ln(80,130,920));
 };
 const finish=()=>{let sealBox;
  if(id==='letter'){const size=input.seal?.size==='small'?84:112,sy=Math.min(H-160,Math.max(bodyEnd+70,580));sealBox=[input.seal?.position==='left'?100:866,sy,size];}
  if(input.healthNotice)notice.forEach((s,i)=>ops.push(tx(s,footerX,H-122-notice.length*32+i*32,24,'meta')));
  if(input.dateText&&id!=='daily_record')wrap(input.dateText,650,25).forEach((s,i)=>ops.push(tx(s,footerX,H-86+i*29,25,'meta')));
  if(paper.footerBrand)ops.push(tx('归爪 · Lumière Pet',80,H-36,19,'meta'));
  pages.push({width:W,height:H,background:id==='letter'?'#FAF8EF':'#FCFAF4',templateVersion:5,commands:ops,seal:input.seal,sealBox});
  if(pages.length>100)throw Error('CARD_TOO_MANY_PAGES');
 };
 const room=n=>{if(y+n<=limit)return;if(id==='day')throw Error('CARD_COMPOSITION_OVERFLOW');bodyEnd=y;finish();start();};
 const rows=(s,{x=80,w=920,size=44,gap=76,rule=false,role='body'}={})=>{for(const row of wrap(s,w,size)){room(gap);ops.push(tx(row,x,y,size,role));if(rule&&row.trim())ops.push(ln(x,y+size+16,w));y+=gap;}bodyEnd=y;};
 const photo=(m,index,box)=>{let [x,yy,w,h]=box;const ratio=(m.width||1)/(m.height||1);if((m.fit||'contain')==='contain'){if(w/h>ratio)w=h*ratio;else h=w/ratio;}const b=[x,yy,w,h];if(paper.photoFrameId==='paper')ops.push({type:'rect',box:[x-12,yy-12,w+24,h+24],color:'#FFFFFF'});ops.push({type:'photo',index,box:b,fit:m.fit||'contain'});if(paper.photoFrameId==='thin')ops.push(ln(x-5,yy-5,w+10),ln(x-5,yy+h+5,w+10),{type:'line',from:[x-5,yy-5],to:[x-5,yy+h+5],color:'#D7D2C5'},{type:'line',from:[x+w+5,yy-5],to:[x+w+5,yy+h+5],color:'#D7D2C5'});return h;};
 const body=input.blocks||[],media=input.media||[];start();
 if(id==='day'){
  if(input.title){rows(input.title,{size:60,gap:80,role:'title'});y+=24;}
  const top=y,portrait=media[0]&&(media[0].width||1)/(media[0].height||1)<.95;
  if(media.length){const maxHeight=Math.min(portrait?820:570,limit-top-100);photo(media[0],0,portrait?[80,top,600,maxHeight]:[80,top,920,maxHeight]);}
  y=portrait?top+26:top+(media.length?Math.min(570,920*(media[0].height||1)/(media[0].width||1))+42:20);
  const x=portrait?735:80,w=portrait?265:920,size=portrait?39:44,gap=portrait?70:76;
  for(const b of body){if(b.health||!b.key.startsWith('text.')){room(38);ops.push(tx(b.label,x,y,24,'meta'));y+=38;}rows(b.text,{x,w,size,gap,role:b.health?'health':'body',rule:paper.ruleLines&&b.key.startsWith('text.')});y+=22;}
  ops.push(ln(80,H-170-notice.length*32,920));bodyEnd=y;
 }else if(id==='daily_record'){
  const date=String(input.dateText||'').replace(/^(事件日期|书写日期) · /,'');
  if(date){rows(date,{size:54,gap:74,w:media.length?615:920,role:'title'});y+=14;}
  if(input.title){rows(input.title,{size:42,gap:64,w:media.length?615:920,role:'title'});y+=24;}
  if(media.length){const h=photo(media[0],0,[754,166,246,320]);y=Math.max(y,166+h+42);}
  ops.push(ln(80,y,920));y+=42;
  for(const b of body){room(130);if(b.health||!b.key.startsWith('text.')){ops.push(tx(b.label,80,y,27,'meta'));y+=44;rows(b.text,{size:b.key==='health.items'?46:42,gap:72,role:b.health?'health':'body',rule:paper.ruleLines&&b.key==='text.observation'});y+=30;}else{rows(b.text,{size:46,gap:78,rule:paper.ruleLines});y+=34;} }
 }else{
  y=205;if(input.title){rows(input.title,{size:42,gap:64,role:'title'});y+=28;}
  if(input.salutation){rows(input.salutation,{size:56,gap:82,role:'title'});y+=28;}
  if(media.length){const h=photo(media[0],0,[100,y,860,320]);y+=h+44;}
  for(const b of body){rows(b.text,{x:100,w:880,size:46,gap:84,rule:paper.ruleLines});y+=28;}
  if(input.signature){y+=22;rows(input.signature,{x:620,w:350,size:32,gap:48,role:'signature'});}
 }
 finish();if(pages.length>1)pages.forEach((p,i)=>p.commands.push(tx((i+1)+' / '+pages.length,490,H-38,22,'meta')));return pages;
}
