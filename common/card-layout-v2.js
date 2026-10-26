// Only the two approved-for-exploration structures. V1 remains in card-layout.js.
export const EDITORIAL_METRICS = Object.freeze({ width:1080,height:1440,ink:'#363D35',muted:'#78806F',paper:'#FBF8F1',letterMargin:120,body:44,leading:72,paragraphGap:24 });
export function layoutEditorialCard(input,measure,wrap) {
  const m=EDITORIAL_METRICS,photos=input.media||[],pages=[];
  const text=(value,x,y,size=m.body,role='meta',color=m.ink)=>({type:'text',text:value,x,y,size,color,role});
  const lines=(value,width,size)=>wrap(value||'',width,t=>measure(t,size));
  const page=commands=>({width:m.width,height:m.height,background:input.mode==='deceased'?'#F7F5F0':m.paper,templateVersion:2,commands});
  const name=lines(input.petName,760,28);if(name.length>2)throw Error('CARD_TITLE_LONG');
  const date=input.hideDate?'':input.dateText||'';
  if(lines(date,820,26).length>2)throw Error('CARD_TITLE_LONG');
  if(input.templateId==='day') {
    if(photos.length!==1)throw Error('CARD_PHOTO_COUNT');
    const portrait=Boolean(photos[0].sourceFileId||photos[0].sourceKind==='portrait');
    const cmds=[];name.forEach((s,i)=>cmds.push(text(s,88,66+i*36,28)));
    const box=portrait?[152,164,776,700]:[88,156,904,776];
    if(!portrait)cmds.push({type:'rect',box,color:'#EDEBE3'});
    cmds.push({type:'photo',index:0,box,fit:portrait?'contain':photos[0].fit||'contain'});
    let y=portrait?942:992;
    if(input.title){const title=lines(input.title,904,58);if(title.length>1)throw Error('CARD_TITLE_LONG');cmds.push(text(title[0],88,y,58));y+=92;}
    const body=lines(input.text,904,44);
    const available=Math.floor((date?1280:1340)-y)/66;
    if(body.length>Math.min(5,Math.floor(available)))throw Error('CARD_DAY_LONG');
    body.forEach(s=>{cmds.push(text(s,88,y,44,'body'));y+=66;});
    if(date)lines(date,820,26).forEach((s,i)=>cmds.push(text(s,88,1334+i*32,26,'meta',m.muted)));
    return [page(cmds)];
  }
  if(input.templateId!=='letter')throw Error('CARD_TEMPLATE_INVALID');
  if(photos.length>1)throw Error('CARD_PHOTO_COUNT');
  if(!String(input.text||'').trim()&&!photos.length)throw Error('NARRATIVE_EMPTY');
  const greeting=lines(input.salutation,840,56),signature=lines(input.signature,600,32);
  if(greeting.length>2||signature.length>2)throw Error('CARD_TITLE_LONG');
  let commands=[],y=156;
  if(input.title){const heading=lines(input.title,840,50);if(heading.length>2)throw Error('CARD_TITLE_LONG');heading.forEach(s=>{commands.push(text(s,120,y,50));y+=66;});y+=36;}
  if(input.salutation){greeting.forEach(s=>{commands.push(text(s,120,y,56));y+=76;});y+=44;}
  // Optional photo stays a small personal inset; it never changes the original text.
  if(photos.length){commands.push({type:'photo',index:0,box:[760,y,200,180],fit:photos[0].fit||'contain'});y+=216;}
  const limit=1120;
  const next=()=>{pages.push(page(commands));if(pages.length>=100)throw Error('CARD_TOO_MANY_PAGES');commands=[];y=156;};
  // A blank separator creates paragraph space, not another full-height text row.
  // The snapshot keeps every original newline; this only controls page rhythm.
  for(const paragraph of String(input.text||'').replace(/\r\n?/g,'\n').split(/\n+/)){
    const row=lines(paragraph,840,m.body);let index=0;
    while(index<row.length){
      let capacity=Math.floor((limit-y)/m.leading)+1;
      if(capacity<1||(capacity===1&&row.length-index>1)){next();continue;}
      let take=Math.min(capacity,row.length-index);
      if(row.length-index-take===1&&take>2)take--;
      for(let i=0;i<take;i++){commands.push(text(row[index++],120,y,m.body,'body'));y+=m.leading;}
      if(index<row.length)next();
    }
    y+=m.paragraphGap;
  }
  // Reserve a readable closing area; move two final body lines with the closing
  // rather than creating a separate page containing only a signature/date.
  const closingHeight=(input.signature?signature.length*44:0)+(date?70:0);
  if(closingHeight&&y+80+closingHeight>1330){
    const tail=[];while(commands.length&&tail.length<2&&commands[commands.length-1].role==='body')tail.unshift(commands.pop());
    next();for(const op of tail){commands.push({...op,y});y+=m.leading;}
  }
  y=Math.max(y+80,1068);
  if(input.signature)for(const s of signature){commands.push(text(s,120,y,32));y+=44;}
  if(date){y+=26;for(const s of lines(date,820,26)){commands.push(text(s,120,y,26,'meta',m.muted));y+=34;}}
  pages.push(page(commands));
  if(pages.length>1)pages.forEach((p,i)=>p.commands.push(text(`${String(i+1).padStart(2,'0')} / ${String(pages.length).padStart(2,'0')}`,850,1360,24,'pageNumber',m.muted)));
  return pages;
}
