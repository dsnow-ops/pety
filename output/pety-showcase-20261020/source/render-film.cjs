const fs=require('fs'),path=require('path'),cp=require('child_process'),{once}=require('events');
const {chromium}=require('C:/Users/杜冲/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base=path.resolve(__dirname,'..'),fps=30,duration=34;
const ffmpeg=process.env.PETY_FFMPEG||'D:/BaiduNetdiskDownload/20250313-某映绿色版/电脑端某映 v6.0.1绿色版/Jianying_Pro/6.0.1.11779/ffmpeg.exe';
function makeAudio(){
 const sr=48000,n=sr*duration,left=new Float64Array(n),right=new Float64Array(n);
 const chords=[[146.832,220,293.665,349.228],[116.541,174.614,233.082,293.665],[130.813,196,261.626,329.628],[130.813,196,261.626,391.995]];
 const add=(start,len,hz,amp,pan)=>{const at=Math.round(start*sr),cnt=Math.min(Math.round(len*sr),n-at);for(let i=0;i<cnt;i++){const t=i/sr,en=(1-Math.exp(-t*28))*Math.exp(-t/1.7)*Math.min(1,(len-t)/.35);const v=amp*en*(Math.sin(2*Math.PI*hz*t)+.24*Math.sin(4*Math.PI*hz*t)*Math.exp(-t*2)+.08*Math.sin(6*Math.PI*hz*t));left[at+i]+=v*(1-pan*.3);right[at+i]+=v*(1+pan*.3);}};
 for(let step=0;step<42;step++){const time=.6+step*.75;if(time>31)break;const chord=chords[Math.floor(step/8)%4],hz=chord[[0,2,1,3,2,1,3,2][step%8]];add(time,4,hz,.075,step%2?.5:-.5);add(time+.21,3,hz,.016,step%2?-.5:.5);if(step%8===0)add(time,5,chord[0]/2,.09,0);}
 // Gentle tonal punctuation for the stamp, generated without sampled material.
 add(23.45,2,587.33,.04,.1);add(23.45,2,880,.02,-.1);
 const buf=Buffer.alloc(44+n*4);buf.write('RIFF',0);buf.writeUInt32LE(36+n*4,4);buf.write('WAVEfmt ',8);buf.writeUInt32LE(16,16);buf.writeUInt16LE(1,20);buf.writeUInt16LE(2,22);buf.writeUInt32LE(sr,24);buf.writeUInt32LE(sr*4,28);buf.writeUInt16LE(4,32);buf.writeUInt16LE(16,34);buf.write('data',36);buf.writeUInt32LE(n*4,40);
 for(let i=0;i<n;i++){const gain=Math.min(1,i/sr/1.2,(duration-i/sr)/2.5);buf.writeInt16LE(Math.round(Math.tanh(left[i])*gain*28000),44+i*4);buf.writeInt16LE(Math.round(Math.tanh(right[i])*gain*28000),46+i*4);}
 const file=path.join(base,'source/pety-original-score.wav');fs.writeFileSync(file,buf);return file;
}
let browser,encoder;
(async()=>{browser=await chromium.launch({channel:'msedge',headless:true});const p=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:4178/film.html?render');await p.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await p.evaluate(()=>document.fonts.ready);
for(const t of [3,10,17,24.5,30]){await p.evaluate(t=>window.renderFrame(t),t);await p.screenshot({path:path.join(base,`qa/film-${t}.jpg`),type:'jpeg',quality:92});if(t===3)await p.screenshot({path:path.join(base,'dist/assets/film-poster.jpg'),type:'jpeg',quality:92});}
if(process.argv.includes('--preview')){console.log('Preview frames ready');return}
const score=makeAudio();const log=fs.createWriteStream(path.join(base,'qa/encode.log'));
encoder=cp.spawn(ffmpeg,['-hide_banner','-y','-f','image2pipe','-framerate',String(fps),'-vcodec','mjpeg','-i','pipe:0','-i',score,'-c:v','h264_mf','-b:v','12M','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart','-t',String(duration),path.join(base,'dist/pety-film.mp4')],{stdio:['pipe','ignore','pipe'],windowsHide:true});
encoder.stderr.pipe(log);const done=once(encoder,'close');encoder.stdin.on('error',()=>{});
for(let f=0;f<duration*fps;f++){await p.evaluate(t=>window.renderFrame(t),f/fps);const jpg=await p.screenshot({type:'jpeg',quality:90});if(encoder.exitCode!==null)throw Error('Encoder exited early: '+encoder.exitCode);if(!encoder.stdin.write(jpg))await Promise.race([once(encoder.stdin,'drain'),done.then(([c])=>{throw Error('Encoder closed: '+c)})]);if(f%150===0)console.log(`Rendered ${f}/${duration*fps} frames`);}
encoder.stdin.end();const[code]=await done;if(code!==0)throw Error('Encoder failed '+code);if(errors.length)throw Error(errors.join('\n'));fs.writeFileSync(path.join(base,'qa/film-render.json'),JSON.stringify({width:1920,height:1080,fps,duration,frames:duration*fps,audio:'Original procedural stereo score; no reference audio or samples reused',errors},null,2));console.log('Film ready');
})().catch(e=>{console.error(e);encoder?.kill();process.exitCode=1}).finally(async()=>await browser?.close());
