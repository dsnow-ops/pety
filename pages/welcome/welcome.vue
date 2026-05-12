<template>
  <view class="welcome-container">
    <view class="logo-section">
      <view class="logo-wrapper">
        <image class="app-logo" src="/static/logo.png" mode="aspectFit"></image>
      </view>
      <text class="brand-name">归 爪</text>
      <text class="brand-tagline">Lumière Pet</text>
    </view>

    <view class="setup-section" v-if="!isAwakening">
      <view class="input-group glass">
        <text class="label">它的名字</text>
        <input class="pet-name-input" v-model="petName" placeholder="请赋予它一个名字" placeholder-style="color:#C4C4C4" />
      </view>

      <view class="upload-group glass" @click="uploadPhoto">
        <image v-if="tempPhoto" :src="tempPhoto" class="preview-img" mode="aspectFill"></image>
        <view v-else class="upload-placeholder">
          <text class="upload-icon">+</text>
          <text class="upload-text">点击上传毛孩子照片</text>
        </view>
      </view>

      <view class="mode-selector">
        <view :class="['mode-btn', petMode === 'simple' ? 'active' : '']" @click="petMode = 'simple'">经典照片</view>
        <view :class="['mode-btn', petMode === '2.5d' ? 'active' : '']" @click="petMode = '2.5d'">2.5D数字生命</view>
      </view>

      <button class="start-btn" @click="startAwakening">开启陪伴</button>
    </view>

    <view class="awakening-overlay" v-if="isAwakening" :class="{ 'fade-in': isAwakening }">
      <view class="pulse-circle"></view>
      <text class="awakening-text">正在唤醒 {{petName}} 的灵魂...</text>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      petName: '',
      petMode: '2.5d',
      tempPhoto: '',
      isAwakening: false
    }
  },
  methods: {
    uploadPhoto() {
      uni.chooseImage({
        count: 1,
        success: (res) => {
          this.tempPhoto = res.tempFilePaths[0];
        }
      });
    },
    startAwakening() {
      if (!this.petName || !this.tempPhoto) {
        uni.showToast({ title: '名字和照片都是灵魂的组成部分哦', icon: 'none' });
        return;
      }
      
      this.isAwakening = true;
      
      // 存储数据
      uni.setStorageSync('pet_name', this.petName);
      uni.setStorageSync('pet_photo', this.tempPhoto);
      uni.setStorageSync('pet_mode', this.petMode);

      // 模拟高奢加载感，3秒后跳转
      setTimeout(() => {
        uni.switchTab({ url: '/pages/home/home' });
      }, 3000);
    }
  }
}
</script>

<style scoped>
.welcome-container { padding: 120rpx 60rpx; background: #F7F6F2; min-height: 100vh; position: relative; }

/* Logo 样式 */
.logo-section { display: flex; flex-direction: column; align-items: center; margin-bottom: 80rpx; }
.logo-wrapper { width: 160rpx; height: 160rpx; background: #FFF; border-radius: 40rpx; box-shadow: 0 20rpx 40rpx rgba(0,0,0,0.05); display: flex; justify-content: center; align-items: center; margin-bottom: 30rpx; }
.app-logo { width: 100rpx; height: 100rpx; }
.brand-name { font-size: 44rpx; font-weight: bold; color: #3E362E; letter-spacing: 10rpx; }
.brand-tagline { font-size: 20rpx; color: #A69D95; letter-spacing: 4rpx; margin-top: 10rpx; }

/* 表单样式 */
.glass { background: rgba(255, 255, 255, 0.6); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.8); border-radius: 40rpx; padding: 30rpx; margin-bottom: 40rpx; }
.label { font-size: 24rpx; color: #A69D95; display: block; margin-bottom: 15rpx; }
.pet-name-input { font-size: 32rpx; color: #3E362E; font-weight: 500; }

.upload-group { height: 350rpx; display: flex; flex-direction: column; justify-content: center; align-items: center; overflow: hidden; }
.preview-img { width: 100%; height: 100%; border-radius: 30rpx; }
.upload-placeholder { display: flex; flex-direction: column; align-items: center; }
.upload-icon { font-size: 60rpx; color: #CBAE88; margin-bottom: 10rpx; }
.upload-text { font-size: 24rpx; color: #A69D95; }

.mode-selector { display: flex; gap: 30rpx; margin-bottom: 60rpx; }
.mode-btn { flex: 1; height: 80rpx; line-height: 80rpx; text-align: center; font-size: 26rpx; background: #E8D5C4; color: #5C544D; border-radius: 40rpx; transition: 0.3s; }
.mode-btn.active { background: #3E362E; color: #FFF; box-shadow: 0 10rpx 20rpx rgba(62, 54, 46, 0.2); }

.start-btn { width: 100%; height: 100rpx; line-height: 100rpx; background: #CBAE88; color: #FFF; font-weight: bold; border-radius: 50rpx; box-shadow: 0 10rpx 30rpx rgba(203, 174, 136, 0.3); }

/* 唤醒仪式过渡层 */
.awakening-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: #F7F6F2; z-index: 100; display: flex; flex-direction: column; justify-content: center; align-items: center; }
.pulse-circle { width: 200rpx; height: 200rpx; background: #CBAE88; border-radius: 50%; animation: pulse 2s infinite; opacity: 0.2; }
.awakening-text { margin-top: 60rpx; font-size: 30rpx; color: #3E362E; letter-spacing: 2rpx; font-weight: 300; }

@keyframes pulse {
  0% { transform: scale(0.9); opacity: 0.2; }
  50% { transform: scale(1.5); opacity: 0.1; }
  100% { transform: scale(0.9); opacity: 0.2; }
}
</style>