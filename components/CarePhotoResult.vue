<template>
  <view class="photo-result">
    <text class="heading">照片可见情况</text>
    <view v-for="item in result.images" :key="item.imageIndex" class="section">
      <text class="label">图 {{item.imageIndex}} · {{purposes[item.purpose]}} · {{qualities[item.quality]}}</text>
      <text v-for="line in item.visible" :key="line" class="line">{{line}}</text>
      <text v-if="!item.visible.length" class="line">未获得可可靠描述的患处或报告信息。</text>
    </view>
    <view class="section urgency"><text class="heading">就医提示 · {{urgencies[result.urgency]}}</text><text class="line">{{result.reason}}</text><text class="line">{{result.advice}}</text></view>
    <text v-if="result.needsRetake" class="line">需补拍：请对焦患处、改善光线，避免遮挡；不要为补拍延误就诊。</text>
    <view v-if="result.userDescription" class="section"><text class="heading">你补充的描述</text><text class="line">{{result.userDescription}}</text></view>
    <view class="section"><text class="heading">可能原因（尚未确认）</text>
      <view v-for="item in result.possibleCauses" :key="item.name" class="section"><text class="label">{{item.name}}</text><text class="line">线索：{{item.evidence}}</text><text class="line">仍缺少：{{item.missing}}</text></view>
      <text v-if="!result.possibleCauses.length" class="line">目前依据不足，不推测具体病名。</text>
    </view>
    <view v-if="result.questions.length" class="section"><text class="heading">可补充的信息</text><text v-for="q in result.questions" :key="q" class="line">{{q}}</text></view>
    <text class="line limitations">{{result.limitations}}</text>
  </view>
</template>
<script>
export default {props:{result:{type:Object,required:true}},data(){return{purposes:{photo:'患处照片',report:'检查报告',other:'其他内容',unknown:'用途无法确认'},qualities:{usable:'可用',limited:'信息有限',unusable:'需补拍'},urgencies:{emergency:'立即急诊',prompt:'尽快联系兽医',uncertain:'无法可靠判断'}};}};
</script>
<style scoped>
.photo-result{max-width:100%;word-break:break-word;}.heading,.label,.line{display:block;line-height:1.65;}.heading{font-size:27rpx;font-weight:600;color:#493c30;}.label{font-size:24rpx;color:#625548;}.line{font-size:25rpx;margin:7rpx 0;color:#60564a;white-space:pre-wrap;}.section{margin:16rpx 0;}.urgency{padding:16rpx;background:#f7eee5;border-radius:14rpx;}.limitations{font-size:23rpx;color:#847366;}
</style>
