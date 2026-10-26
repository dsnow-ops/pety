import {layoutStudioCardV6} from './card-layout-v6.js';
import {wrapCardText} from './card-layout.js';

// Opt-in paper metrics for newly created comparisons. Unmarked v7 snapshots
// continue through the original layout below, including their original size.
function balancedComparison(input,measure){
 const W=1080,items=input.recipe.items,paper=input.presentation||{},commands=[];
 const wrap=(value,width,size)=>String(value||'').trim()?wrapCardText(String(value),width,t=>measure(t,size)):[];
 const text=(value,x,y,size,role='body')=>commands.push({type:'text',text:value,x,y,size,color:role==='meta'?'#777D6B':'#354034',role});
 const line=(x,y,w,color='#D7D2C5')=>commands.push({type:'line',from:[x,y],to:[x+w,y],color});
 if(items.length!==2||input.media.length!==2)throw Error('CARD_PHOTO_COUNT');
 const name=wrap(input.petName,920,28);let title=wrap(input.title,920,52);
 // Avoid a lone final character on an otherwise nearly full title line.
 // Explicit user line breaks remain intentional.
 if(title.length===2&&!String(input.title).includes('\n')&&measure(title[1],52)<230){
  title=wrap(input.title,Math.min(920,Math.ceil(measure(input.title,52)/2+52)),52);
 }
 const dates=items.map(i=>wrap(i.dateText,440,28)),captions=items.map(i=>wrap(i.caption,440,34));
 if(name.length>2||title.length>2||dates.some(r=>r.length>2)||captions.some(r=>r.length>4))throw Error('CARD_COMPOSITION_OVERFLOW');
 let y=64;name.forEach((r,i)=>text(r,80,y+i*36,28,'meta'));if(name.length)y+=name.length*36+28;
 title.forEach((r,i)=>text(r,80,y+i*68,52,'title'));if(title.length)y+=title.length*68+40;
 const top=y,dated=Math.max(...dates.map(r=>r.length)),captioned=Math.max(...captions.map(r=>r.length));
 const tail=(dated?24+dated*38:0)+(captioned?(dated?22:24)+captioned*48:0);
 // Always reserve the same quiet foot, with or without a seal. The unsealed
 // editing paper and final paper must have exactly the same coordinate space.
 const ideal=Math.max(...items.map(i=>{const m=input.media[i.mediaIndex];return m?.width>0&&m?.height>0?440*m.height/m.width:640;}));
 const photoHeight=Math.min(Math.max(320,Math.min(740,ideal)),1440-top-tail-180);
 const H=Math.max(1000,Math.ceil(top+photoHeight+tail+180));
 if(photoHeight<260)throw Error('CARD_COMPOSITION_OVERFLOW');
 if(paper.paperTextureId){const texture=[];for(let y=16;y<H;y+=24)texture.push({type:'line',from:[0,y],to:[W,y],color:'#F5F2EA'});commands.unshift(...texture);}
 items.forEach((item,i)=>{
  const x=80+i*480,m=input.media[item.mediaIndex];let w=440,h=photoHeight;
  if(m.fit!=='cover'&&m.width>0&&m.height>0){const scale=Math.min(w/m.width,h/m.height);w=m.width*scale;h=m.height*scale;}
  const px=x+(440-w)/2,py=top+(photoHeight-h)/2;
  if(paper.photoFrameId==='paper')commands.push({type:'rect',box:[px-10,py-10,w+20,h+20],color:'#FFFFFF'});
  if(paper.photoFrameId==='thin'){line(px-4,py-4,w+8);line(px-4,py+h+4,w+8);commands.push({type:'line',from:[px-4,py-4],to:[px-4,py+h+4],color:'#D7D2C5'},{type:'line',from:[px+w+4,py-4],to:[px+w+4,py+h+4],color:'#D7D2C5'});}
  commands.push({type:'photo',index:item.mediaIndex,box:[px,py,w,h],fit:m.fit});
  const dateY=top+photoHeight+24,captionY=top+photoHeight+(dated?24+dated*38:0)+(dated?22:24);
  dates[i].forEach((r,j)=>text(r,x,dateY+j*38,28,'meta'));
  captions[i].forEach((r,j)=>{text(r,x,captionY+j*48,34);if(paper.ruleLines)line(x,captionY+j*48+42,440);});
 });
 if(paper.footerBrand)text('归爪 · Lumière Pet',80,H-38,19,'meta');
 return {width:W,height:H,background:'#FCF9F1',templateVersion:7,commands};
}

// New source-aware variants only. All historical versions keep their renderer.
export function layoutRecordWork(input,measure){
 if(!input.recipe)return layoutStudioCardV6(input,measure);
 const pages=[],items=input.recipe.items||[];
 const text=(value,x,y,size=36,role='body')=>({type:'text',text:value,x,y,size,color:role==='meta'?'#777D6B':'#354034',role});
 const wrap=(value,width,size)=>wrapCardText(String(value||''),width,t=>measure(t,size));
 if(input.recipe.type==='comparison'&&input.recipe.layoutRevision===2){
  pages.push(balancedComparison(input,measure));
 }else if(input.recipe.type==='comparison'){
  if(items.length!==2||input.media.length!==2)throw Error('CARD_PHOTO_COUNT');
  const commands=[],paper=input.presentation||{},line=(x,y,w)=>({type:'line',from:[x,y],to:[x+w,y],color:'#D7D2C5'}),title=wrap(input.title,920,52),name=wrap(input.petName,920,28);
  if(title.length>2||name.length>2)throw Error('CARD_COMPOSITION_OVERFLOW');
  name.forEach((r,i)=>commands.push(text(r,80,60+i*36,28,'meta')));
  title.forEach((r,i)=>commands.push(text(r,80,160+i*68,52,'title')));
  const top=title.length>1?330:260;
  if(paper.paperTextureId)for(let y=16;y<1440;y+=24)commands.unshift({...line(0,y,1080),color:'#F5F2EA'});
  if(paper.footerBrand)commands.push(text('归爪 · Lumière Pet',80,1404,19,'meta'));
  items.forEach((item,i)=>{
   const x=80+i*480;if(paper.photoFrameId==='paper')commands.push({type:'rect',box:[x-12,top-12,464,684],color:'#FFFFFF'});if(paper.photoFrameId==='thin')commands.push(line(x-5,top-5,450),line(x-5,top+665,450),{type:'line',from:[x-5,top-5],to:[x-5,top+665],color:'#D7D2C5'},{type:'line',from:[x+445,top-5],to:[x+445,top+665],color:'#D7D2C5'});commands.push({type:'photo',index:item.mediaIndex,box:[x,top,440,660],fit:input.media[item.mediaIndex].fit});
   const dates=wrap(item.dateText,430,28),caption=wrap(item.caption,430,36);
   if(dates.length>2||caption.length>4)throw Error('CARD_COMPOSITION_OVERFLOW');
   dates.forEach((r,j)=>commands.push(text(r,x,top+690+j*38,28,'meta')));
   caption.forEach((r,j)=>{commands.push(text(r,x,top+790+j*50,36));if(paper.ruleLines)commands.push(line(x,top+835+j*50,430));});
  });
  pages.push({width:1080,height:1440,background:'#FCF9F1',templateVersion:7,commands});
 }else{
  for(const item of items){
   const localMedia=item.mediaIndex>=0?[input.media[item.mediaIndex]]:[];
   const part=layoutStudioCardV6({...input,recipe:undefined,seal:undefined,templateId:'letter',templateVersion:6,dateText:item.dateText,blocks:[{key:'text.letter',text:item.text||item.caption||'',label:'原始生活记录'}],media:localMedia},measure);
   for(const page of part){page.templateVersion=7;page.commands=page.commands.filter(op=>!(op.type==='text'&&op.role==='meta'&&/^\d+ \/ \d+$/.test(op.text))).map(op=>op.type==='photo'?{...op,index:item.mediaIndex}:op);pages.push(page);}
  }
 }
 if(pages.length>100)throw Error('CARD_TOO_MANY_PAGES');
 pages.forEach((page,i)=>{page.pageIndex=i;page.seal=input.seal?.placementMode==='free'&&input.seal.pageIndex!==i?null:input.seal;if(pages.length>1)page.commands.push(text(`${i+1} / ${pages.length}`,490,1402,22,'meta'));});
 return pages;
}
