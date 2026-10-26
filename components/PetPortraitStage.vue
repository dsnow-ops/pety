<template>
  <view class="portrait-stage" :class="[variant, { 'edge-blend': palette.blend, 'stage-ready': displayReady, 'no-motion': reduceMotion }]" :style="variables" @click="$emit('tap')">
    <view v-if="ready || previous" class="right-extension"></view>
    <image v-if="previous" :src="previous" mode="aspectFit" class="portrait-photo previous" :style="imageStyle" />
    <image v-if="displayUrl" :key="identity + displayUrl" :src="displayUrl" :data-url="displayUrl" :data-identity="identity" mode="aspectFit" class="portrait-photo current" :style="imageStyle" @load="loaded" @error="failed" />
    <view v-if="!displayReady && !previous" class="portrait-placeholder"><view class="placeholder-mark"><uni-icons type="heart" size="34" color="#929a83" /></view><text>{{ failedUrl ? '形象暂时未能加载' : masterKey ? '正在迎接它回来' : '从一张照片，认识它' }}</text><button v-if="masterKey" class="portrait-retry" @click.stop="$emit('asset-retry')">轻触重试</button><text v-else class="placeholder-note">它的专属位置，一直为它留着</text></view>
    <canvas class="palette-sampler" :canvas-id="canvasId" :id="canvasId" :width="48" :height="48" />
  </view>
</template>
<script>
import {DEFAULT_STAGE_PALETTE,deriveStagePalette,stageVariables,readStagePalette,rememberStagePalette} from '../common/pet-stage-palette.js';
import {captureDataScope,isDataScopeCurrent} from '../common/scoped-storage.js';
let nextStageId=0;
export default {
 name:'PetPortraitStage', emits:['tap','asset-loaded','asset-error','asset-retry','palette'],
 props:{active:{type:Boolean,default:true},reduceMotion:{type:Boolean,default:false},imageUrl:{type:String,default:''},petId:{type:String,default:''},masterKey:{type:String,default:''},assetKey:{type:String,default:''},variant:{type:String,default:'home'}},
 data(){return {dataScope:captureDataScope(),canvasId:`portrait-palette-${++nextStageId}`,frame:{},ready:false,paletteSettled:false,previous:'',loadedUrl:'',failedUrl:'',paletteTimer:null,paletteRetryTimer:null,paletteRetryKey:'',epoch:0,disposed:false,palette:{...DEFAULT_STAGE_PALETTE}};},
 computed:{identity(){return `${this.petId}::${this.masterKey}::${this.assetKey||this.masterKey}`;},displayUrl(){return this.imageUrl||this.loadedUrl;},displayReady(){return this.ready && (this.variant!=='space'||this.paletteSettled);},variables(){return stageVariables(this.palette);},imageStyle(){return this.frame;}},
 watch:{
  active(value){if(value){this.resume();return;}this.epoch++;clearTimeout(this.paletteTimer);clearTimeout(this.paletteRetryTimer);},
  identity(){this.epoch++;clearTimeout(this.paletteTimer);clearTimeout(this.paletteRetryTimer);this.paletteRetryKey='';this.failedUrl='';this.ready=false;this.frame={};this.previous='';this.loadedUrl='';const cached=readStagePalette(this.identity);this.paletteSettled=Boolean(cached);this.palette=cached||{...DEFAULT_STAGE_PALETTE};this.publishPalette();},
  variant(){this.$nextTick(()=>this.resume());},
  imageUrl(next,old){if(next===old)return;this.epoch++;if(!next&&this.loadedUrl){this.previous='';this.ready=true;return;}this.previous=this.loadedUrl||this.previous;this.ready=false;}
 },
 mounted(){this.palette=readStagePalette(this.identity)||{...DEFAULT_STAGE_PALETTE};this.publishPalette();this.resizeListener=()=>{if(this.ready)this.sample();};if(typeof uni.onWindowResize==='function')uni.onWindowResize(this.resizeListener);},
 beforeUnmount(){this.disposed=true;this.epoch++;clearTimeout(this.paletteTimer);clearTimeout(this.paletteRetryTimer);if(this.resizeListener&&typeof uni.offWindowResize==='function')uni.offWindowResize(this.resizeListener);},
 methods:{
  resume(){if(this.disposed||this.active===false)return;this.$nextTick(()=>{if(this.active!==false&&this.imageUrl&&(this.ready||this.loadedUrl===this.imageUrl))this.sample();});},
  owns(event){const d=event?.currentTarget?.dataset;return isDataScopeCurrent(this.dataScope) && !this.disposed && d?.identity===this.identity && d?.url===this.imageUrl;},
  publishPalette(){if(!isDataScopeCurrent(this.dataScope))return;this.$emit('palette',{petId:this.petId,masterKey:this.masterKey,imageUrl:this.imageUrl,palette:this.palette,dataScope:this.dataScope});},
  loaded(event){if(!this.owns(event))return;this.failedUrl='';this.ready=true;this.loadedUrl=this.imageUrl;this.previous='';this.$emit('asset-loaded',{petId:this.petId,masterKey:this.masterKey,imageUrl:this.imageUrl});this.sample();},
  failed(event){if(!this.owns(event))return;this.failedUrl=this.imageUrl;this.ready=false;this.$emit('asset-error',{petId:this.petId,masterKey:this.masterKey,imageUrl:this.imageUrl,currentTarget:{dataset:{url:this.imageUrl}}});},
  sample(){
   if(this.active===false||this.disposed)return;
   const identity=this.identity,url=this.imageUrl,epoch=++this.epoch;
   const dataScope=this.dataScope;
   const valid=()=>isDataScopeCurrent(dataScope) && this.active!==false && !this.disposed && epoch===this.epoch && identity===this.identity && url===this.imageUrl;
   const settled=()=>{if(valid()){clearTimeout(this.paletteTimer);this.publishPalette?.();this.paletteSettled=true;}};
   const retryPalette=()=>{
    settled();const key=identity+'::'+url;
    if(!valid()||this.paletteRetryKey===key)return;
    this.paletteRetryKey=key;clearTimeout(this.paletteRetryTimer);
    // During a tab transition the scoped canvas can exist before the platform
    // has registered it. One delayed local read repairs color, never downloads.
    this.paletteRetryTimer=setTimeout(()=>{if(valid())this.sample();},400);
   };
   // Color extraction is optional. A lost native canvas callback must never
   // hide an already decoded image indefinitely.
   clearTimeout(this.paletteTimer);this.paletteTimer=setTimeout(retryPalette,450);
   const cached=readStagePalette(identity);if(cached){this.palette=cached;settled();}
   uni.getImageInfo({src:url,success:info=>{
    if(!valid())return;
    uni.createSelectorQuery().in(this).select('.portrait-stage').boundingClientRect(rect=>{
      if(!valid()||!rect?.width||!rect?.height)return;
      const scale=Math.min(rect.width/info.width,rect.height/info.height);
      const w=info.width*scale,h=info.height*scale;
      this.frame={width:`${w}px`,height:`${h}px`,left:`${(rect.width-w)/2}px`,top:`${(rect.height-h)/2}px`};
    }).exec();
    if(cached?.edgeVersion===2){return;}
    // Sample the same immutable URL that the image view consumed. Native
    // getImageInfo temp paths are not asset identities and can be reused.
    const ctx=uni.createCanvasContext(this.canvasId,this);ctx.clearRect(0,0,48,48);ctx.drawImage(url,0,0,48,48);
    ctx.draw(false,()=>{if(!valid())return;uni.canvasGetImageData({canvasId:this.canvasId,x:0,y:0,width:48,height:48,success:result=>{
     if(!valid())return;if(!result?.data||result.data.length<48*48*4){retryPalette();return;}this.palette=deriveStagePalette(result.data,48,48);rememberStagePalette(identity,this.palette,dataScope);settled();
    },fail:retryPalette},this);});
   },fail:settled});
  }
 }
};
</script>
<style scoped>
.portrait-stage{position:relative;width:100%;height:100%;isolation:isolate;background:var(--stage-surface);overflow:hidden;}
.right-extension{position:absolute;inset:0 0 0 50%;background:var(--stage-right);}
.portrait-photo{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;}
.current{opacity:0;}.stage-ready .current{opacity:1;transition:opacity 180ms ease;}
.edge-blend .portrait-photo{-webkit-mask-image:linear-gradient(to right,transparent,black 2%,black 98%,transparent),linear-gradient(to bottom,transparent,black 2%,black 98%,transparent);-webkit-mask-composite:source-in;mask-image:linear-gradient(to right,transparent,black 2%,black 98%,transparent),linear-gradient(to bottom,transparent,black 2%,black 98%,transparent);mask-composite:intersect;}
.portrait-placeholder{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:#777c70;font-size:12px;}
.placeholder-mark{font-size:40px;font-weight:200;}
.placeholder-mark{display:flex;align-items:center;justify-content:center;width:120rpx;height:120rpx;border:1rpx solid #ced2c4;border-radius:50%;margin-bottom:18rpx;}.portrait-placeholder{background:linear-gradient(160deg,#f0ede3,#e5e9dd);font-size:25rpx;color:#67715b;letter-spacing:1rpx;}.placeholder-note{font-size:21rpx;color:#7a826e;}.portrait-retry{min-height:88rpx;line-height:88rpx;margin:12rpx 0 0;padding:0 32rpx;color:#596650;background:transparent;font-size:23rpx;}.portrait-retry::after{border:0;}
.palette-sampler{position:absolute;left:-100px;top:0;width:48px;height:48px;pointer-events:none;}
.no-motion .current{transition:none;}
.space.edge-blend .portrait-photo{-webkit-mask-image:none;mask-image:none;}
@media(prefers-reduced-motion:reduce){.stage-ready .current{transition:none;}}
</style>
