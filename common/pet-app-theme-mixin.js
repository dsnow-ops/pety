import {getActivePet} from './pet-store.js';
import {getPetTheme,petThemeVariables,setThemePet,subscribePetTheme,applyNativePetTheme,setPetThemeMode} from './pet-app-theme.js';
// Read the Android preference in the service layer: this base omits fontScale from uni system info.
function readUiFontScale(){
 let scale=1;try{const info=uni.getSystemInfoSync();scale=Number(info.fontScale)||Number(info.fontSizeSetting)/16||1;}catch(_){}
 // #ifdef APP-PLUS
 try{if(typeof plus!=='undefined'&&plus.os.name==='Android'){
  const resolver=plus.android.invoke(plus.android.runtimeMainActivity(),'getContentResolver');
  const value=Number(plus.android.invoke('android.provider.Settings$System','getFloat',resolver,'font_scale',1));
  if(Number.isFinite(value)&&value>0)scale=value;
 }}catch(_){}
 // #endif
 return scale;
}
export const petAppThemeMixin={
 data(){return{petThemeRevision:0,uiLargeText:false,uiFontScale:1,uiVisualLocked:false};},
 computed:{
  petThemeMode(){this.petThemeRevision;return getPetTheme().mode;},
  petThemeClass(){return (this.petThemeMode==='space'?'pet-ambient pet-space':'pet-ambient')+(this.uiLargeText?' ui-large-text':'');},
  appThemeStyle(){this.petThemeRevision;return this.uiVisualLocked?{'--ui-font-scale':String(this.uiFontScale)}:petThemeVariables();}
 },
 onLoad(){const pages=typeof getCurrentPages==='function'?getCurrentPages():[];const route=this.$page?.fullPath||this.$page?.route||this.$scope?.route||pages[pages.length-1]?.route||'';this.uiVisualLocked=['home/home','calendar/calendar','card-compose/card-compose','album/album','archive/archive','profile/profile','account/account-security','settings/settings'].some(p=>route.includes('pages/'+p));this._unsubscribePetTheme=subscribePetTheme(()=>{this.petThemeRevision++;});},
 onShow(){this.uiFontScale=readUiFontScale();this.uiLargeText=this.uiFontScale>1.15;if(uni.getStorageSync('pety_session_lock_v1'))return;try{setThemePet(getActivePet());}catch(_){setThemePet(null);uni.showToast({title:'宠物资料暂时无法读取，请到我的页面重试',icon:'none'});}this.petThemeRevision++;this.$nextTick(()=>applyNativePetTheme());},
 onUnload(){this._unsubscribePetTheme?.();this._unsubscribePetTheme=null;},
 methods:{
  choosePetTheme(mode){setPetThemeMode(mode);applyNativePetTheme();}
 }
};
