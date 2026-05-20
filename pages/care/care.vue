<template>
  <view class="care-page">
    <scroll-view scroll-y class="care-scroll">
      <view class="top-bar">
        <button class="icon-button" hover-class="icon-button-hover" @click="goBack">
          <uni-icons type="left" size="22" color="#302A23"></uni-icons>
        </button>
        <view class="title-copy">
          <text class="title-kicker">CARE SERVICE</text>
          <text class="title-main">就医服务</text>
        </view>
        <button class="icon-button" hover-class="icon-button-hover" @click="refreshLocation">
          <uni-icons type="location" size="21" color="#302A23"></uni-icons>
        </button>
      </view>

      <view class="emergency-card">
        <view class="emergency-head">
          <view>
            <text class="card-kicker">URGENT</text>
            <text class="card-title">这些情况优先线下急诊</text>
          </view>
          <view class="urgent-badge">急</view>
        </view>
        <view class="sign-list">
          <view v-for="sign in emergencySigns" :key="sign" class="sign-line">
            <view class="sign-dot"></view>
            <text>{{ sign }}</text>
          </view>
        </view>
      </view>

      <view class="service-grid">
        <view class="service-card" hover-class="service-card-hover" @click="startReportGuide">
          <uni-icons type="paperclip" size="24" color="#302A23"></uni-icons>
          <text class="service-title">报告解读</text>
          <text class="service-desc">上传报告后补充关键数值</text>
        </view>
        <view class="service-card" hover-class="service-card-hover" @click="startPhotoGuide">
          <uni-icons type="camera" size="24" color="#302A23"></uni-icons>
          <text class="service-title">拍照问诊</text>
          <text class="service-desc">照片 + 文字描述更稳妥</text>
        </view>
      </view>

      <view class="hospital-section">
        <view class="section-head">
          <view>
            <text class="card-kicker">NEARBY</text>
            <text class="card-title">附近医院信息</text>
          </view>
          <text class="data-note">示例数据</text>
        </view>

        <view v-for="hospital in hospitals" :key="hospital.id" class="hospital-card">
          <view class="hospital-head">
            <view class="hospital-main">
              <text class="hospital-name">{{ hospital.name }}</text>
              <text class="hospital-level">{{ hospital.level }} · {{ hospital.openHours }}</text>
            </view>
            <view v-if="hospital.isDemo" class="demo-pill">待接入</view>
          </view>

          <view class="tag-row">
            <view v-for="tag in hospital.tags" :key="tag" class="tag-chip">
              <text>{{ tag }}</text>
            </view>
          </view>

          <view class="address-row">
            <uni-icons type="location" size="16" color="#8F877A"></uni-icons>
            <text>{{ hospital.address }}</text>
          </view>

          <view class="action-row">
            <button class="action-btn primary" hover-class="action-btn-hover" @click="callHospital(hospital)">
              <uni-icons type="phone" size="17" color="#FBFAF6"></uni-icons>
              <text>{{ hospital.phone ? '拨打电话' : '待配置电话' }}</text>
            </button>
            <button class="action-btn" hover-class="action-btn-hover" @click="copyHospital(hospital)">
              <uni-icons type="compose" size="17" color="#6B5D4D"></uni-icons>
              <text>复制信息</text>
            </button>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import { getEmergencySigns, getHospitalList, hasCallablePhone } from '../../common/hospital-store.js';

export default {
  data() {
    return {
      hospitals: [],
      emergencySigns: []
    };
  },
  onShow() {
    this.hospitals = getHospitalList();
    this.emergencySigns = getEmergencySigns();
  },
  methods: {
    refreshLocation() {
      uni.showToast({ title: '地图 POI 待接入', icon: 'none' });
    },
    callHospital(hospital) {
      if (!hasCallablePhone(hospital)) {
        uni.showToast({ title: '请先配置真实医院电话', icon: 'none' });
        return;
      }

      uni.makePhoneCall({ phoneNumber: hospital.phone });
    },
    copyHospital(hospital) {
      const info = `${hospital.name}\n${hospital.level}\n${hospital.openHours}\n${hospital.address}`;
      uni.setClipboardData({
        data: info,
        success: () => uni.showToast({ title: '已复制', icon: 'none' })
      });
    },
    startReportGuide() {
      uni.setStorageSync('pending_chat_prompt', '请帮我解读这份宠物检查报告。我会上传图片，并补充报告里的关键数值。');
      uni.switchTab({
        url: '/pages/chat/chat'
      });
    },
    startPhotoGuide() {
      uni.setStorageSync('pending_chat_prompt', '我想通过照片描述一下宠物当前情况，请先提醒我补充症状、持续时间和精神食欲变化。');
      uni.switchTab({
        url: '/pages/chat/chat'
      });
    },
    goBack() {
      const pages = getCurrentPages();
      if (pages.length > 1) {
        uni.navigateBack();
        return;
      }
      uni.switchTab({ url: '/pages/chat/chat' });
    }
  }
}
</script>

<style scoped>
.care-page {
  min-height: 100vh;
  background: #F4F1EA;
  color: #302A23;
}

.care-scroll {
  height: 100vh;
  padding: 78rpx 30rpx calc(42rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.top-bar,
.emergency-head,
.section-head,
.hospital-head,
.address-row,
.action-row,
.service-grid {
  display: flex;
}

.top-bar,
.emergency-head,
.section-head,
.hospital-head {
  align-items: center;
  justify-content: space-between;
}

.icon-button {
  width: 72rpx;
  height: 72rpx;
  padding: 0;
  margin: 0;
  border-radius: 50%;
  background: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 12rpx 30rpx rgba(58, 51, 43, 0.06);
}

.icon-button::after,
.action-btn::after {
  border: none;
}

.icon-button-hover,
.action-btn-hover,
.service-card-hover {
  opacity: 0.78;
}

.title-copy {
  text-align: center;
}

.title-kicker,
.card-kicker {
  display: block;
  color: #8C7557;
  font-size: 20rpx;
  line-height: 1.3;
}

.title-main {
  display: block;
  margin-top: 6rpx;
  color: #302A23;
  font-size: 38rpx;
  font-weight: 600;
  line-height: 1.15;
}

.emergency-card,
.service-card,
.hospital-card {
  border-radius: 16rpx;
  background: #FFFFFF;
  border: 1rpx solid #EEE6DA;
  box-shadow: 0 14rpx 34rpx rgba(58, 51, 43, 0.05);
}

.emergency-card {
  margin-top: 30rpx;
  padding: 28rpx;
}

.card-title {
  display: block;
  margin-top: 8rpx;
  color: #302A23;
  font-size: 31rpx;
  font-weight: 600;
  line-height: 1.25;
}

.urgent-badge {
  width: 58rpx;
  height: 58rpx;
  border-radius: 50%;
  background: #B95757;
  color: #FFFFFF;
  font-size: 26rpx;
  line-height: 58rpx;
  text-align: center;
}

.sign-list {
  margin-top: 22rpx;
}

.sign-line {
  display: flex;
  align-items: flex-start;
  margin-bottom: 14rpx;
  color: #6B5D4D;
  font-size: 24rpx;
  line-height: 1.45;
}

.sign-dot {
  width: 10rpx;
  height: 10rpx;
  margin-top: 12rpx;
  margin-right: 12rpx;
  border-radius: 50%;
  background: #B95757;
  flex-shrink: 0;
}

.service-grid {
  gap: 18rpx;
  margin-top: 22rpx;
}

.service-card {
  flex: 1;
  min-height: 156rpx;
  padding: 24rpx;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.service-title {
  margin-top: 16rpx;
  color: #302A23;
  font-size: 27rpx;
  font-weight: 600;
  line-height: 1.2;
}

.service-desc {
  margin-top: 8rpx;
  color: #8F877A;
  font-size: 22rpx;
  line-height: 1.35;
}

.hospital-section {
  margin-top: 30rpx;
}

.data-note,
.demo-pill {
  padding: 8rpx 14rpx;
  border-radius: 999rpx;
  background: #F1ECE3;
  color: #8C7557;
  font-size: 20rpx;
  line-height: 1.2;
}

.hospital-card {
  margin-top: 18rpx;
  padding: 26rpx;
}

.hospital-main {
  min-width: 0;
}

.hospital-name {
  display: block;
  color: #302A23;
  font-size: 30rpx;
  font-weight: 600;
  line-height: 1.25;
}

.hospital-level {
  display: block;
  margin-top: 8rpx;
  color: #8F877A;
  font-size: 22rpx;
  line-height: 1.35;
}

.tag-row {
  margin-top: 18rpx;
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}

.tag-chip {
  padding: 9rpx 14rpx;
  border-radius: 999rpx;
  background: #F7F3EA;
  color: #6B5D4D;
  font-size: 21rpx;
  line-height: 1.2;
}

.address-row {
  margin-top: 18rpx;
  align-items: flex-start;
  color: #7C756B;
  font-size: 23rpx;
  line-height: 1.45;
  gap: 8rpx;
}

.action-row {
  margin-top: 22rpx;
  gap: 14rpx;
}

.action-btn {
  flex: 1;
  height: 74rpx;
  padding: 0;
  margin: 0;
  border-radius: 14rpx;
  background: #F1ECE3;
  color: #6B5D4D;
  font-size: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
}

.action-btn.primary {
  background: #302A23;
  color: #FBFAF6;
}
</style>
