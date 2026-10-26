<template>
  <view class="photo-composer">
    <view v-if="images.length" class="purpose-row">
      <button :disabled="busy" :class="{selected:purpose==='photo'}" @click="setPurpose('photo')">患处照片</button>
      <button :disabled="busy" :class="{selected:purpose==='report'}" @click="setPurpose('report')">检查报告</button>
      <text>{{images.length}} / 3</text>
    </view>
    <view v-if="images.length" class="photo-row">
      <view v-for="(item,index) in images" :key="item.url" class="photo-thumb">
        <image :src="item.url" mode="aspectFill" @click="preview(index)" />
        <button :disabled="busy" @click="remove(index)" aria-label="删除照片">×</button>
      </view>
      <button v-if="images.length<3" :disabled="busy||picking" @click="choose(purpose)">＋</button>
    </view>
    <text v-if="images.length || picking" class="photo-hint">建议一张患处近照，必要时补一张能看清身体部位的照片。可删除重选，不必凑满。</text>
    <text v-if="picking||error" class="photo-hint">{{picking?'正在处理照片…':error}}</text>
    <canvas canvas-id="carePhotoCanvas" id="carePhotoCanvas" class="photo-canvas" :style="{width:canvasWidth+'px',height:canvasHeight+'px'}" />
  </view>
</template>
<script>
import {readLocalImageBase64} from '../common/care-photo-client.js';
export default {
  props:{busy:Boolean,contextKey:String},
  emits:['change'],
  data(){return {images:[],purpose:'photo',picking:false,error:'',canvasWidth:1,canvasHeight:1,generation:0};},
  watch:{contextKey(){this.clear();}},
  methods:{
    restore(draft){this.generation++;this.images=(draft.images||[]).slice(0,3).map(v=>({...v,url:`data:image/jpeg;base64,${v.base64}`}));this.purpose=draft.purpose==='report'?'report':'photo';this.error='';this.picking=false;this.emit();},
    clear(){this.generation++;this.images=[];this.error='';this.picking=false;this.emit();},
    emit(){this.$emit('change',{images:this.images.slice(),purpose:this.purpose});},
    setPurpose(value){this.purpose=value;this.emit();},
    remove(index){if(this.busy)return;this.images.splice(index,1);this.emit();},
    preview(index){uni.previewImage({urls:this.images.map(v=>v.url),current:index});},
    async choose(purpose='photo'){
      if(this.busy||this.picking||this.images.length>=3)return;
      this.purpose=purpose;this.error='';this.picking=true;
      const generation=this.generation;
      try{
        const picked=await new Promise((resolve,reject)=>uni.chooseImage({count:3-this.images.length,sizeType:['original'],sourceType:['album','camera'],success:resolve,fail:reject}));
        for(const path of picked.tempFilePaths){
          if(generation!==this.generation)return;
          const info=await new Promise((resolve,reject)=>uni.getImageInfo({src:path,success:resolve,fail:reject}));
          // H5 getImageInfo omits type. Verify original magic bytes as well as decoding;
          // never infer the format from a renamed extension or convert HEIC silently.
          const raw=await readLocalImageBase64(path);
          if(!/^(?:\/9j\/|iVBORw0KGgo)/.test(raw))throw new Error('暂只支持 JPEG / PNG，请将 HEIC 等格式真正导出为 JPEG 后重选。');
          if(raw.length>25*1024*1024*4/3)throw new Error('原图过大，请先裁剪无关区域后重选。');
          if(!info.width||!info.height||info.width*info.height>50000000)throw new Error('图片尺寸过大或无法读取，请重新选择。');
          const scale=Math.min(1,1800/Math.max(info.width,info.height));
          this.canvasWidth=Math.round(info.width*scale);this.canvasHeight=Math.round(info.height*scale);
          await this.$nextTick();
          const ctx=uni.createCanvasContext('carePhotoCanvas',this);
          ctx.setFillStyle('#ffffff');ctx.fillRect(0,0,this.canvasWidth,this.canvasHeight);
          // drawImage uses the platform decoded image; no beauty filter or generated pixels.
          ctx.drawImage(info.path||path,0,0,this.canvasWidth,this.canvasHeight);
          await new Promise(resolve=>ctx.draw(false,resolve));
          const result=await new Promise((resolve,reject)=>uni.canvasToTempFilePath({canvasId:'carePhotoCanvas',width:this.canvasWidth,height:this.canvasHeight,destWidth:this.canvasWidth,destHeight:this.canvasHeight,fileType:'jpg',quality:0.9,success:resolve,fail:reject},this));
          const base64=await readLocalImageBase64(result.tempFilePath);
          if(generation!==this.generation)return;
          if(!base64.startsWith('/9j/')||base64.length>2*1024*1024*4/3)throw new Error('照片仍然过大，请裁剪无关区域后重选，保留患处细节。');
          if([...this.images,{base64}].reduce((n,v)=>n+v.base64.length,0)>1350*1024*4/3)throw new Error('本组照片较大，请先发送已有照片，再补充其他照片。');
          this.images.push({url:result.tempFilePath,base64,width:this.canvasWidth,height:this.canvasHeight});this.emit();
        }
      }catch(error){if(generation===this.generation&&!/cancel/i.test(error.errMsg||''))this.error=error.message||'无法读取照片，请检查相册或相机权限后重试。';}
      finally{if(generation===this.generation)this.picking=false;}
    }
  }
};
</script>
<style scoped>
.photo-composer{padding:0 26rpx;background:#fbfaf6;flex-shrink:0;}.purpose-row,.photo-row{display:flex;align-items:center;gap:14rpx;margin:12rpx 0;}.purpose-row button{margin:0;font-size:23rpx;background:#f1ece3;color:#645748;line-height:2.4;}.purpose-row .selected{background:#645748;color:#fff;}.purpose-row text{font-size:22rpx;color:#70675c;}.photo-thumb{position:relative;width:106rpx;height:106rpx;}.photo-thumb image{width:100%;height:100%;border-radius:14rpx;}.photo-thumb button{position:absolute;right:-6rpx;top:-6rpx;padding:0;width:38rpx;height:38rpx;line-height:34rpx;background:#fff;color:#463d33;font-size:30rpx;}.photo-row>button{margin:0;width:72rpx;padding:0;background:#f1ece3;}.photo-hint{display:block;color:#736455;font-size:22rpx;line-height:1.5;margin:8rpx 0;}.photo-canvas{position:fixed;left:-3000px;top:-3000px;pointer-events:none;}
</style>
