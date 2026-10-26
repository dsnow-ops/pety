// Extract contact sheets from the actual device MP4, without replacing content.
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('C:/Users/杜冲/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const dir=process.argv[2];if(!dir)throw Error('Evidence directory required');
const label=process.argv[3]||'native-switch';
const events=JSON.parse(fs.readFileSync(path.join(dir,'native-events.json'),'utf8'));
const recording=events.find(e=>e.event==='record-start'&&e.label===label);
const next=events.find(e=>e.event==='record-start'&&e.time>recording.time)?.time||Infinity;
const starts=events.filter(e=>e.event==='tab-tap'&&e.tab==='home'&&e.time>recording.time&&e.time<next)
 .slice(0,3).map((e,i)=>[`${label}-${i+1}`,Math.max(0,(e.time-recording.time)/1000-0.3)]);
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try {
  const page=await browser.newPage();await page.setContent('<video muted></video>');
  const data=fs.readFileSync(path.join(dir,label+'.mp4')).toString('base64');
  await page.evaluate(async data=>{const v=document.querySelector('video');await new Promise((ok,fail)=>{v.onloadeddata=ok;v.onerror=fail;v.src='data:video/mp4;base64,'+data;});},data);
  // Wider than the event clock uncertainty; includes profile and first Home frames.
  for(const [label,start] of starts){
   const png=await page.evaluate(async start=>{
    const v=document.querySelector('video'),c=document.createElement('canvas');c.width=1312;c.height=1504;
    const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);
    for(let i=0;i<24;i++){
     const t=start+i/30;await new Promise(ok=>{v.onseeked=ok;v.currentTime=t;});
     const x=(i%6)*218,y=Math.floor(i/6)*376;
     ctx.drawImage(v,0,0,v.videoWidth,1050,x,y+20,218,350);ctx.fillStyle='#000';ctx.font='14px sans-serif';ctx.fillText(t.toFixed(3)+'s',x+5,y+15);
    }
    return c.toDataURL('image/png').split(',')[1];
   },start);
   fs.writeFileSync(path.join(dir,'first-frames-'+label+'.png'),Buffer.from(png,'base64'));
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e.message);process.exitCode=1});
