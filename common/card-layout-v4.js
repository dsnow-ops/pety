import {wrapCardText} from './card-layout.js';
// V4 only; historical layouts retain their frozen algorithms.
export function layoutComposedCard(input,measure){
 const id=input.templateId,square=['quote','date'].includes(id),height=square?1080:1440,paper=input.presentation||{},pages=[],margin=84,width=912,ink='#394338',muted='#7A806E';
 const text=(value,x,y,size=44,role='body')=>({type:'text',text:value,x,y,size,color:role==='meta'?muted:ink,role});
 const line=(x,y,x2,y2,color='#D7D8CA')=>({type:'line',from:[x,y],to:[x2,y2],color});
 const wrap=(value,w=width,size=44)=>wrapCardText(value,w,t=>measure(t,size));
 const noticeRows=input.healthNotice?wrap(input.healthNotice,912,23):[],noticeY=height-202-noticeRows.length*30;
 let commands=[],y=156;
 const start=()=>{commands=[];y=156;
  if(paper.paperTextureId)for(let yy=18;yy<height;yy+=22)commands.push(line(0,yy,1080,yy,'#F4F1E9'));
  if(input.petName)for(const row of wrap(input.petName,620,28)){commands.push(text(row,margin,64+(y-156),28,'meta'));y+=34;}y=Math.max(156,y);
  if(paper.illustrationId==='window'){for(let n=0;n<3;n++)commands.push(line(850+n*30,54,850+n*30,112,'#C4C6B6'));commands.push(line(834,84,926,84,'#C4C6B6'));}
  if(paper.illustrationId==='botanical'){commands.push(line(886,114,900,52,'#B4BCA4'));for(let n=0;n<3;n++){commands.push(line(890+n*3,99-n*15,870,90-n*15,'#B4BCA4'));commands.push(line(894+n*3,91-n*15,916,82-n*15,'#B4BCA4'));}}
  if(paper.illustrationId==='postmark'){for(let n=0;n<4;n++)commands.push(line(842,60+n*12,968,60+n*12,'#C7BAA7'));}
 };
 const finish=()=>{const p={width:1080,height,background:'#FBF8F1',templateVersion:4,commands,seal:input.seal};
  if(input.healthNotice)noticeRows.forEach((r,i)=>commands.push(text(r,84,noticeY+i*30,23,'meta')));
  if(input.dateText&&id!=='date')wrap(input.dateText,590,24).forEach((r,i)=>commands.push(text(r,245,height-100+i*30,24,'meta')));
  if(paper.footerBrand)commands.push(text('归爪 · Lumière Pet',84,height-42,20,'meta'));
  pages.push(p);if(pages.length>100)throw Error('CARD_TOO_MANY_PAGES');};
 const limit=input.healthNotice?noticeY-42:height-220,canPage=['letter','daily_record'].includes(id);
 const room=(needed)=>{if(y+needed<=limit)return;if(!canPage)throw Error('CARD_COMPOSITION_OVERFLOW');finish();start();};
 const rows=(value,{size=44,gap=74,rule=false,role='body',x=margin,w=width}={})=>{for(const row of wrap(value,w,size)){room(gap);commands.push(text(row,x,y,size,role));if(rule&&row.trim())commands.push(line(x,y+size*1.25,x+w,y+size*1.25));y+=gap;}};
 start();if(input.title){rows(input.title,{size:id==='quote'?36:54,gap:72,role:'title'});y+=24;}
 const photos=input.media||[];
 if(photos.length){const grid=id==='collage',photoHeight=grid?640:id==='day'?620:220,columns=grid?2:1,cellW=grid?440:width;room(photoHeight+26);photos.forEach((m,i)=>{const box=[margin+(i%columns)*472,y+(grid?Math.floor(i/2)*320:0),cellW,grid?296:photoHeight];if(paper.photoFrameId==='paper')commands.push({type:'rect',box:[box[0]-12,box[1]-12,box[2]+24,box[3]+24],color:'#FFFFFF'});commands.push({type:'photo',index:i,box,fit:m.fit||'contain'});if(paper.photoFrameId==='thin'){const [x,yy,w,h]=box;commands.push(line(x-8,yy-8,x+w+8,yy-8),line(x-8,yy+h+8,x+w+8,yy+h+8),line(x-8,yy-8,x-8,yy+h+8),line(x+w+8,yy-8,x+w+8,yy+h+8));}});y+=photoHeight+44;}
 if(id==='quote')y=Math.max(y,300);if(id==='date'&&input.dateText){rows(input.dateText,{size:40,gap:62,role:'meta'});y+=30;}
 if(input.salutation){rows(input.salutation,{size:50,gap:72,role:'title'});y+=22;}
 for(const b of input.blocks||[]){const health=b.health;if(health){room(106);commands.push(text(b.label,margin,y,25,'meta'));y+=38;rows(b.text,{size:40,gap:62,rule:paper.ruleLines&&b.key==='text.observation',role:b.key==='text.observation'?'body':'health'});}else{if(!b.key.startsWith('text.')){room(90);commands.push(text(b.label,margin,y,24,'meta'));y+=34;}rows(b.text,{size:id==='quote'?50:44,gap:id==='quote'?84:74,rule:paper.ruleLines&&b.key.startsWith('text.')});}y+=22;}
 if(input.signature){y+=28;rows(input.signature,{size:30,gap:48,role:'signature'});}
 finish();if(pages.length>1)pages.forEach((p,i)=>p.commands.push(text((i+1)+' / '+pages.length,506,height-48,22,'meta')));return pages;
}
