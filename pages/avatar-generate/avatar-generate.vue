<template>
  <view class="avatar-page">
    <view class="star-field">
      <view class="star star-a"></view>
      <view class="star star-b"></view>
      <view class="star star-c"></view>
    </view>

    <view class="page-shell">
      <view class="top-copy">
        <text class="kicker">LUMIERE PET AVATAR</text>
        <text class="title">{{ pageTitle }}</text>
        <text class="subtitle">{{ pageSubtitle }}</text>
      </view>

      <view class="scan-stage">
        <view class="orbit orbit-one"></view>
        <view class="orbit orbit-two"></view>
        <view class="scan-line" v-if="phase === 'generating'"></view>

        <view class="pet-preview">
          <image v-if="previewImage" :src="previewImage" class="preview-image" mode="aspectFill"></image>
          <view v-else class="preview-placeholder">
            <view class="placeholder-ear left"></view>
            <view class="placeholder-ear right"></view>
            <view class="placeholder-head"></view>
            <view class="placeholder-body"></view>
          </view>
        </view>
      </view>

      <view v-if="phase === 'select'" class="action-panel">
        <text class="panel-title">先选择一张清晰照片</text>
        <text class="panel-desc">第一版只需要一张。之后如果不像，可以换一张角度更好的照片重新生成。</text>
        <view class="source-row">
          <button class="source-btn" hover-class="source-btn-active" @click="choosePhoto('camera')">拍照</button>
          <button class="source-btn source-btn-light" hover-class="source-btn-active" @click="choosePhoto('album')">从相册选择</button>
        </view>
      </view>

      <view v-if="phase === 'generating'" class="action-panel">
        <text class="panel-title">{{ progressText }}</text>
        <view class="progress-track">
          <view class="progress-fill"></view>
        </view>
        <text class="panel-desc">这是本地 mock 流程，不会上传云端，也不会调用真实图片生成 API。</text>
      </view>

      <view v-if="phase === 'result'" class="action-panel result-panel">
        <text class="panel-title">这是它的归爪电子形象</text>
        <text class="panel-desc">当前是 mock 形象，用来先跑通产品流程。真实生成 API 后续再替换这里。</text>
        <button class="confirm-btn" hover-class="confirm-btn-active" @click="enterHome">满意，进入首页</button>
        <button class="retry-btn" hover-class="source-btn-active" @click="resetToSelect">重新选择照片</button>
      </view>
    </view>
  </view>
</template>

<script>
import { getActivePet, setActivePet, updateActivePet } from '../../common/pet-store.js';
import { createAvatarJob, saveGeneratedAvatar } from '../../common/pet-avatar-generator.js';

const DEFAULT_PET_PHOTO = '/static/pet.png';

export default {
  data() {
    return {
      pet: null,
      phase: 'select',
      selectedPhoto: '',
      resultImage: '',
      progressIndex: 0,
      progressTimer: null,
      finishTimer: null,
      progressSteps: [
        '正在识别毛色与轮廓',
        '正在保留它的神态',
        '正在生成归爪电子形象',
        '马上就能见到它了'
      ]
    };
  },
  computed: {
    pageTitle() {
      if (this.phase === 'result') return '生成完成';
      if (this.phase === 'generating') return '正在生成电子宠物';
      return '生成电子宠物形象';
    },
    pageSubtitle() {
      if (this.phase === 'result') return '确认满意后，它会成为首页的第一眼主角。';
      if (this.phase === 'generating') return '我们会把这张照片变成归爪里的陪伴形象。';
      return '拍照或从相册选择一张照片就够了。';
    },
    progressText() {
      return this.progressSteps[this.progressIndex] || this.progressSteps[0];
    },
    previewImage() {
      if (this.phase === 'result') return this.resultImage;
      return this.selectedPhoto || this.inputPhoto || '';
    },
    inputPhoto() {
      if (!this.pet) return '';
      return this.pet.originalPhotoUrl || (this.pet.photo && this.pet.photo !== DEFAULT_PET_PHOTO ? this.pet.photo : '');
    }
  },
  onLoad(options = {}) {
    if (options.petId) setActivePet(options.petId);
    this.loadPet();

    if (this.inputPhoto) {
      this.selectedPhoto = this.inputPhoto;
      this.startMockGenerate();
    }
  },
  onUnload() {
    this.clearTimers();
  },
  methods: {
    loadPet() {
      this.pet = getActivePet();
    },
    choosePhoto(sourceType) {
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: [sourceType],
        success: (res) => this.saveSelectedPhoto(res.tempFilePaths[0])
      });
    },
    saveSelectedPhoto(tempPath) {
      uni.saveFile({
        tempFilePath: tempPath,
        success: (saveRes) => this.preparePhoto(saveRes.savedFilePath),
        fail: () => this.preparePhoto(tempPath)
      });
    },
    preparePhoto(photoPath) {
      this.selectedPhoto = photoPath;
      const updatedPet = updateActivePet({
        photo: photoPath,
        avatar: photoPath,
        originalPhotoUrl: photoPath,
        avatarSource: 'original',
        generatedAvatarUrl: '',
        avatarStatus: 'pending',
        avatarUpdatedAt: Date.now()
      });
      if (updatedPet) this.pet = updatedPet;
      this.startMockGenerate();
    },
    startMockGenerate() {
      if (!this.pet) {
        uni.showToast({ title: '请先建立宠物档案', icon: 'none' });
        return;
      }

      this.clearTimers();
      this.phase = 'generating';
      this.progressIndex = 0;
      updateActivePet({ avatarStatus: 'pending', avatarSource: 'original' });

      this.progressTimer = setInterval(() => {
        this.progressIndex = Math.min(this.progressIndex + 1, this.progressSteps.length - 1);
      }, 700);

      this.finishTimer = setTimeout(() => {
        const job = createAvatarJob(this.pet, { avatarStyle: this.pet.avatarStyle });
        const patch = saveGeneratedAvatar(this.pet, job.result);
        const updatedPet = updateActivePet(patch);
        this.pet = updatedPet || { ...this.pet, ...patch };
        this.resultImage = patch.generatedAvatarUrl;
        this.phase = 'result';
        this.clearTimers();
      }, 2600);
    },
    resetToSelect() {
      this.clearTimers();
      this.phase = 'select';
      this.resultImage = '';
      this.progressIndex = 0;
    },
    enterHome() {
      uni.switchTab({ url: '/pages/home/home' });
    },
    clearTimers() {
      if (this.progressTimer) {
        clearInterval(this.progressTimer);
        this.progressTimer = null;
      }
      if (this.finishTimer) {
        clearTimeout(this.finishTimer);
        this.finishTimer = null;
      }
    }
  }
};
</script>

<style scoped>
.avatar-page {
  min-height: 100vh;
  overflow: hidden;
  color: #F8F4EA;
  background:
    radial-gradient(circle at 22% 12%, rgba(220, 183, 120, 0.34) 0%, rgba(13, 18, 28, 0) 30%),
    radial-gradient(circle at 82% 18%, rgba(126, 145, 190, 0.32) 0%, rgba(13, 18, 28, 0) 34%),
    linear-gradient(145deg, #111723 0%, #232434 54%, #11151F 100%);
}

.star-field {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  pointer-events: none;
}

.star {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 0 26rpx rgba(255, 255, 255, 0.42);
  animation: starDrift 8s ease-in-out infinite;
}

.star-a {
  width: 8rpx;
  height: 8rpx;
  top: 18%;
  left: 18%;
}

.star-b {
  width: 10rpx;
  height: 10rpx;
  top: 28%;
  right: 16%;
  animation-delay: 1.2s;
}

.star-c {
  width: 6rpx;
  height: 6rpx;
  bottom: 28%;
  left: 26%;
  animation-delay: 2s;
}

.page-shell {
  position: relative;
  min-height: 100vh;
  padding: calc(var(--status-bar-height, 0px) + 62rpx) 40rpx calc(56rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  animation: pageEnter 520ms ease both;
}

.top-copy {
  display: flex;
  flex-direction: column;
}

.kicker {
  color: rgba(248, 244, 234, 0.54);
  font-size: 20rpx;
  line-height: 1.25;
}

.title {
  margin-top: 14rpx;
  color: #FFF9ED;
  font-size: 48rpx;
  font-weight: 650;
  line-height: 1.16;
}

.subtitle {
  margin-top: 14rpx;
  max-width: 560rpx;
  color: rgba(248, 244, 234, 0.68);
  font-size: 25rpx;
  line-height: 1.5;
}

.scan-stage {
  position: relative;
  height: 560rpx;
  margin-top: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.orbit {
  position: absolute;
  border-radius: 50%;
  border: 1rpx solid rgba(255, 255, 255, 0.16);
  box-shadow: inset 0 0 60rpx rgba(222, 190, 132, 0.12), 0 0 70rpx rgba(126, 145, 190, 0.12);
}

.orbit-one {
  width: 520rpx;
  height: 520rpx;
  animation: orbitPulse 4.8s ease-in-out infinite;
}

.orbit-two {
  width: 390rpx;
  height: 390rpx;
  border-color: rgba(222, 190, 132, 0.22);
  animation: orbitPulse 5.6s ease-in-out infinite reverse;
}

.scan-line {
  position: absolute;
  z-index: 4;
  width: 420rpx;
  height: 2rpx;
  border-radius: 999rpx;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0), rgba(255, 244, 214, 0.9), rgba(255, 255, 255, 0));
  animation: scanMove 1.6s ease-in-out infinite;
}

.pet-preview {
  position: relative;
  z-index: 3;
  width: 360rpx;
  height: 360rpx;
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.08);
  border: 1rpx solid rgba(255, 255, 255, 0.16);
  box-shadow: 0 34rpx 90rpx rgba(0, 0, 0, 0.28);
  overflow: hidden;
}

.preview-image {
  width: 100%;
  height: 100%;
}

.preview-placeholder {
  position: relative;
  width: 230rpx;
  height: 250rpx;
}

.placeholder-ear {
  position: absolute;
  top: 18rpx;
  width: 72rpx;
  height: 96rpx;
  border-radius: 50rpx 50rpx 24rpx 24rpx;
  background: rgba(232, 213, 176, 0.86);
}

.placeholder-ear.left {
  left: 20rpx;
  transform: rotate(-22deg);
}

.placeholder-ear.right {
  right: 20rpx;
  transform: rotate(22deg);
}

.placeholder-head {
  position: absolute;
  left: 34rpx;
  top: 58rpx;
  width: 162rpx;
  height: 138rpx;
  border-radius: 48%;
  background: linear-gradient(180deg, #FFF5DE 0%, #D7B989 100%);
}

.placeholder-body {
  position: absolute;
  left: 14rpx;
  bottom: 6rpx;
  width: 202rpx;
  height: 92rpx;
  border-radius: 50%;
  background: rgba(194, 157, 104, 0.72);
}

.action-panel {
  margin-top: 34rpx;
  padding: 30rpx;
  border-radius: 34rpx;
  background: rgba(255, 255, 255, 0.1);
  border: 1rpx solid rgba(255, 255, 255, 0.16);
  box-shadow: 0 26rpx 80rpx rgba(0, 0, 0, 0.18);
}

.panel-title {
  display: block;
  color: #FFF9ED;
  font-size: 32rpx;
  font-weight: 650;
  line-height: 1.3;
}

.panel-desc {
  display: block;
  margin-top: 12rpx;
  color: rgba(248, 244, 234, 0.62);
  font-size: 24rpx;
  line-height: 1.5;
}

.source-row {
  margin-top: 26rpx;
  display: flex;
  gap: 16rpx;
}

.source-row .source-btn {
  flex: 1;
  min-width: 0;
}

.source-btn,
.confirm-btn,
.retry-btn {
  height: 82rpx;
  margin: 0;
  padding: 0 24rpx;
  border-radius: 999rpx;
  font-size: 27rpx;
  line-height: 82rpx;
  transition: transform 160ms ease, opacity 160ms ease;
}

.source-btn,
.confirm-btn {
  background: #F4D79B;
  color: #1D1B18;
  box-shadow: 0 18rpx 44rpx rgba(244, 215, 155, 0.22);
}

.source-btn-light,
.retry-btn {
  background: rgba(255, 255, 255, 0.12);
  color: #FFF9ED;
  border: 1rpx solid rgba(255, 255, 255, 0.18);
}

.source-btn::after,
.confirm-btn::after,
.retry-btn::after {
  border: none;
}

.source-btn-active,
.confirm-btn-active {
  transform: scale(0.97);
  opacity: 0.84;
}

.progress-track {
  margin-top: 28rpx;
  height: 10rpx;
  border-radius: 999rpx;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.12);
}

.progress-fill {
  height: 100%;
  width: 72%;
  border-radius: inherit;
  background: linear-gradient(90deg, rgba(244, 215, 155, 0.2), #F4D79B, rgba(152, 170, 218, 0.9));
  animation: progressFlow 1.8s ease-in-out infinite;
}

.result-panel {
  text-align: center;
}

.confirm-btn {
  margin-top: 28rpx;
  width: 100%;
}

.retry-btn {
  margin-top: 16rpx;
  width: 100%;
}

@keyframes pageEnter {
  from {
    opacity: 0;
    transform: translateY(18rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes starDrift {
  0%, 100% {
    opacity: 0.35;
    transform: translate3d(0, 0, 0);
  }
  50% {
    opacity: 0.9;
    transform: translate3d(18rpx, -16rpx, 0);
  }
}

@keyframes orbitPulse {
  0%, 100% {
    opacity: 0.5;
    transform: scale(0.96);
  }
  50% {
    opacity: 1;
    transform: scale(1.03);
  }
}

@keyframes scanMove {
  0% {
    opacity: 0;
    transform: translateY(-160rpx);
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateY(160rpx);
  }
}

@keyframes progressFlow {
  0%, 100% {
    transform: translateX(-36%);
  }
  50% {
    transform: translateX(48%);
  }
}
</style>
