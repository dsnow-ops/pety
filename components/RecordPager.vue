<template>
 <view v-if="total>size" class="record-pager" role="navigation" :aria-label="label">
  <view class="page-step"><button :disabled="disabled||offset<=0" @click="$emit('change',Math.max(0,offset-size))">上一页</button><text class="page-position">第 {{Math.floor(offset/size)+1}} / {{Math.ceil(total/size)}} 页</text><button :disabled="disabled||offset+size>=total" @click="$emit('change',offset+size)">下一页</button></view>
  <view class="page-range"><text>{{offset+1}}–{{Math.min(offset+size,total)}} / {{total}} {{unit}}</text><button :disabled="disabled" @click="$emit('change',offset?0:Math.floor((total-1)/size)*size)">{{offset?'回到第一页':'查看末页'}}</button></view>
 </view>
</template>
<script>
export default {props:{total:{type:Number,default:0},offset:{type:Number,default:0},size:{type:Number,default:30},disabled:{type:Boolean,default:false},unit:{type:String,default:'条记录'},label:{type:String,default:'记录分页'}},emits:['change']};
</script>
<style scoped>
.record-pager{margin:18px 0 24px;padding:12px 0;border-top:1px solid rgba(231,214,174,.16);border-bottom:1px solid rgba(231,214,174,.16);color:var(--ui-muted,#BCC4AE)}
.page-step,.page-range{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
.page-step button,.page-range button{margin:0;min-height:44px;padding:8px 4px;background:transparent;color:inherit;font-size:calc(13px * var(--ui-font-scale,1));line-height:1.5;border:0;border-radius:0}
.page-step button::after,.page-range button::after{border:0}.page-step button[disabled],.page-range button[disabled]{opacity:.4;color:inherit;background:transparent}
.page-position{font-size:calc(13px * var(--ui-font-scale,1));line-height:1.6;text-align:center}.page-range text{font-size:calc(12px * var(--ui-font-scale,1));line-height:1.6}.page-range button{color:var(--ui-text,#E7D6AE)}
</style>
