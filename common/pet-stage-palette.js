import { scopedStorage, captureDataScope, isDataScopeCurrent } from './scoped-storage.js';
// Palette extraction is display-only: never changes source pixels or asset identity.
const median = values => [...values].sort((a,b)=>a-b)[Math.floor(values.length / 2)] || 0;
const hex = rgb => '#' + rgb.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
export const DEFAULT_STAGE_PALETTE = Object.freeze({surface:'#e9e5dd',page:'#f5f3ee',ink:'#363a33',accent:'#596650',family:'stone',confidence:0,blend:false});
export function deriveStagePalette(data, width, height) {
  if(!data||!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||data.length<width*height*4)return {...DEFAULT_STAGE_PALETTE};
  const samples=[];
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
    if(x>2 && x<width-3 && y>2 && y<height-3) continue;
    const i=(y*width+x)*4;
    if(data[i+3]<245) continue;
    samples.push([data[i],data[i+1],data[i+2]]);
  }
  if(samples.length<24) return {...DEFAULT_STAGE_PALETTE};
  const rgb=[0,1,2].map(c=>median(samples.map(v=>v[c])));
  const deviation=median(samples.map(v=>Math.max(...v.map((c,i)=>Math.abs(c-rgb[i])))));
  const neutral=Math.max(...rgb)-Math.min(...rgb)<48 && Math.min(...rgb)>115;
  const blend=neutral && deviation<20;
  // Only repeat narrow, low-detail background strips. This is a conservative
  // display gate, not a claim that color sampling can segment an animal.
  const pixel=(x,y)=>{const i=(y*width+x)*4;return [data[i],data[i+1],data[i+2],data[i+3]];};
  const edgeSafe=bottom=>{
    if(!blend || width!==height)return false;
    const rows=Math.max(2,Math.ceil(height*.03));
    for(let y=0;y<rows;y++)for(let x=0;x<width;x++){
      const p=pixel(x,bottom?height-1-y:y),anchor=pixel(x,bottom?height-1:0);
      if(p[3]<245||Math.min(...p.slice(0,3))<105||Math.max(...p.slice(0,3))-Math.min(...p.slice(0,3))>55)return false;
      if(p.slice(0,3).some((v,c)=>Math.abs(v-anchor[c])>14))return false;
      if(x && p.slice(0,3).some((v,c)=>Math.abs(v-pixel(x-1,bottom?height-1-y:y)[c])>18))return false;
    }return true;
  };
  const topTextureSafe=edgeSafe(false),bottomTextureSafe=edgeSafe(true);
  let headerSafe=topTextureSafe;
  for(let y=0;headerSafe&&y<height*.26;y++)for(let x=0;x<width;x++){
    if(x>width*.38 && (x<width*.75||y>height*.14))continue;
    const p=pixel(x,y),anchor=pixel(x,0);
    if(p.slice(0,3).some((v,c)=>Math.abs(v-anchor[c])>22)){headerSafe=false;break;}
  }
  const family=rgb[0]-rgb[2]>10?'sand':rgb[2]-rgb[0]>5?'mist':'stone';
  // The page always stays inside the brand's narrow neutral range.
  const page={sand:'#f5f2ec',mist:'#f1f3f2',stone:'#f4f3ef'}[family];
  const gradientFor = side => {
    const edgeRows=[];
    for(let band=0;band<9;band++) {
      const row=[]; const y=Math.min(height-1,Math.round(band*(height-1)/8));
      for(let dy=-1;dy<=1;dy++) for(let dx=0;dx<2;dx++) {
        const x=side==='left'?dx:width-1-dx;
        const yy=Math.max(0,Math.min(height-1,y+dy)),i=(yy*width+x)*4;
        if(data[i+3]>245)row.push([data[i],data[i+1],data[i+2]]);
      }
      edgeRows.push([0,1,2].map(c=>median(row.map(v=>v[c]))));
    }
    return 'linear-gradient(180deg, '+edgeRows.map((v,i)=>`${hex(v)} ${Math.round(i*100/8)}%`).join(', ')+')';
  };
  const surface=blend?gradientFor('left'):DEFAULT_STAGE_PALETTE.surface;
  const rightSurface=blend?gradientFor('right'):DEFAULT_STAGE_PALETTE.surface;
  const horizontalEdge=bottom=>{
    const colors=[];
    for(let band=0;band<9;band++){
      const x=Math.round(band*(width-1)/8),ys=bottom?[height-1,height-2]:[0,1];
      const row=ys.map(y=>{const i=(Math.max(0,y)*width+x)*4;return [data[i],data[i+1],data[i+2]];});
      colors.push(hex([0,1,2].map(c=>median(row.map(v=>v[c]))))+' '+Math.round(band*100/8)+'%');
    }
    return `linear-gradient(90deg, ${colors.join(', ')})`;
  };
  // Extending edge COLOR does not require the stricter empty-texture gate.
  // Varied neutral studio photos (e.g. brown dogs) still meet their header and
  // floor naturally, while saturated/dark images cannot color the whole app.
  return {surface,rightSurface,topSurface:neutral?horizontalEdge(false):DEFAULT_STAGE_PALETTE.surface,bottomSurface:neutral?horizontalEdge(true):DEFAULT_STAGE_PALETTE.surface,topTextureSafe,bottomTextureSafe,headerSafe,edgeVersion:2,page,backgroundRgb:blend?rgb:null,ink:'#34372f',accent:'#596650',family,confidence:Math.max(0,1-deviation/40),blend};
}
export function stageVariables(palette=DEFAULT_STAGE_PALETTE) {
 return {'--stage-surface':palette.surface,'--stage-right':palette.rightSurface||palette.surface,'--stage-top':palette.topSurface||palette.surface,'--stage-floor':palette.bottomSurface||palette.surface,'--stage-page':palette.page,'--stage-ink':palette.ink,'--stage-accent':palette.accent};
}
const palettes = new Map();
let loadedScope=null;
function restore(){const scope=captureDataScope();if(loadedScope?.version===scope.version&&loadedScope?.namespace===scope.namespace)return;loadedScope=scope;palettes.clear();if(!scope.ready)return;try{const saved=scopedStorage.getStorageSync('pety_stage_palettes_v3');if(Array.isArray(saved))for(const [key,value] of saved.slice(-40)){if(typeof key==='string'&&value&&typeof value.surface==='string'&&value.ink==='#34372f')palettes.set(key,value);}}catch(e){}}
export function readStagePalette(identity) {restore();return palettes.get(identity);}
export function rememberStagePalette(identity,palette,scope=captureDataScope()) {
 if(!isDataScopeCurrent(scope))return false;
 restore();
 if(!identity) return;
 palettes.set(identity,palette);
 if(palettes.size>40) palettes.delete(palettes.keys().next().value);
 try{scopedStorage.forScope(scope).setStorageSync('pety_stage_palettes_v3',[...palettes]);}catch(e){}
}
