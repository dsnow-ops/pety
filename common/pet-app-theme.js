import { scopedStorage, captureDataScope, isDataScopeCurrent } from './scoped-storage.js';
import { subscribeAccountScope } from './auth-store.js';
// Display-only theme. The committed account/pet/master owns colors, never a temp URL.
const KEY='pety_app_palette_v1';
const listeners=new Set();
let state={mode:'space',owner:'',palettes:{}};
const validMode=mode=>['studio','ambient','space'].includes(mode)?mode:'space';
let loadedScope=null, unsubscribeScope=null;
const rgbHex=rgb=>'#'+rgb.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
const mix=(rgb,amount)=>rgb.map(v=>v+(255-v)*amount);
export function themeOwner(pet){return pet?.id&&pet?.generatedAvatarFileId?`${pet.id}::${pet.generatedAvatarFileId}`:'';}
function initialize(){
 const scope=captureDataScope();
 if(loadedScope?.version===scope.version&&loadedScope?.namespace===scope.namespace)return;
 loadedScope=scope;state={mode:'space',owner:'',palettes:{}};
 if(scope.ready)try {const saved=scopedStorage.getStorageSync(KEY);if(saved?.version===1)state={...state,mode:validMode(saved.mode),palettes:saved.palettes||{}};}catch(e){}
}
function notify(){listeners.forEach(fn=>{try{fn();}catch(e){}});}
function persist(){try{scopedStorage.forScope(loadedScope).setStorageSync(KEY,{version:1,mode:state.mode,palettes:state.palettes});}catch(e){}}
export function subscribePetTheme(fn){initialize();if(!unsubscribeScope)unsubscribeScope=subscribeAccountScope(()=>{initialize();notify();});listeners.add(fn);return()=>{listeners.delete(fn);if(!listeners.size){unsubscribeScope?.();unsubscribeScope=null;}};}
export function setThemePet(pet){initialize();const owner=themeOwner(pet);if(state.owner!==owner){state.owner=owner;notify();}}
export function setPetThemeMode(mode){initialize();state.mode=validMode(mode);persist();notify();}
export function rememberPetTheme(pet,palette,scope=captureDataScope()){
 if(!isDataScopeCurrent(scope))return false;
 initialize();const owner=themeOwner(pet),rgb=palette?.backgroundRgb;
 if(!owner||owner!==state.owner||palette?.blend!==true||!Array.isArray(rgb)||rgb.length!==3||rgb.some(v=>!Number.isFinite(v)||v<0||v>255))return false;
 if(Math.max(...rgb)-Math.min(...rgb)>=48||Math.min(...rgb)<=115)return false;
 const previous=state.palettes[owner];if(previous&&previous.every((v,i)=>v===rgb[i]))return true;
 state.palettes={...state.palettes,[owner]:rgb.slice()};
 const keys=Object.keys(state.palettes);while(keys.length>12)delete state.palettes[keys.shift()];
 persist();notify();return true;
}
export function buildPetTheme(rgb=[185,174,158]){
 // Quiet related surfaces, not a full-screen photo or a saturated color wash.
 const page=rgbHex(mix(rgb,.30)),surface=rgbHex(mix(rgb,.76)),muted=rgbHex(mix(rgb,.52));
 const primary=rgbHex(rgb.map(v=>v*.43));
 return {page,surface,muted,primary,ink:'#2c2925',secondary:'#504940',rule:rgbHex(mix(rgb,.16))};
}
export function buildBrightPetTheme(rgb=[185,174,158]){
 // The photo supplies temperature, never the page's exposure or text contrast.
 const mean=rgb.reduce((a,b)=>a+b,0)/3;
 const tint=rgb.map(v=>Math.max(-9,Math.min(9,(v-mean)*.3)));
 const tone=light=>rgbHex(tint.map(v=>Math.max(0,Math.min(255,light+v))));
 return {page:tone(246),surface:tone(252),muted:tone(237),primary:'#596650',
  ink:tone(43),secondary:tone(99),rule:tone(225)};
}
export function getPetTheme(){
 initialize();const stored=state.palettes[state.owner];
 const rgb=Array.isArray(stored)&&stored.length===3&&stored.every(v=>Number.isFinite(v)&&v>115&&v<=255)&&Math.max(...stored)-Math.min(...stored)<48?stored:undefined;
 return{mode:state.mode,owner:state.owner,ready:Boolean(rgb),...(state.mode==='space'?buildBrightPetTheme(rgb):buildPetTheme(rgb))};
}
export function petThemeVariables(){
 const t=getPetTheme();if(t.mode==='studio')return{};
 return {'--pety-page-bg':t.page,'--pety-surface':t.surface,'--pety-surface-muted':t.muted,
 '--pety-text':t.ink,'--pety-text-secondary':t.secondary,'--pety-rule':t.rule,'--pety-primary':t.primary,
 '--pety-primary-soft':t.muted,'--pety-accent':t.primary,'--ui-bg':t.page,'--ui-card':t.surface,'--ui-accent':t.primary,
 '--ui-text':t.ink,'--ui-muted':t.secondary,'--ui-border':t.rule,
 '--home-accent':t.primary,'--home-text':t.ink,'--home-muted':t.secondary,'--home-card':t.surface,'--home-border':t.rule,
 backgroundColor:t.page,backgroundImage:'none',color:t.ink};
}
export function applyNativePetTheme(){
 try{uni.setTabBarStyle({backgroundColor:'#202119',color:'#A6B095',selectedColor:'#D0DCBD',borderStyle:'black',fail(){}});}catch(e){}
 try{uni.setNavigationBarColor({frontColor:'#ffffff',backgroundColor:'#25241E',fail(){}});}catch(e){}
}
