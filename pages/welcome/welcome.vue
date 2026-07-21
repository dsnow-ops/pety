<template>
  <view class="welcome-page">
    <view class="brand-section">
      <view class="brand-mark">
        <text class="brand-mark-text">归</text>
      </view>
      <text class="brand-name">归爪</text>
      <text class="brand-subtitle">Lumière Pet</text>
      <text class="brand-line">为一段陪伴，留一处温柔的归处</text>
    </view>

    <view class="setup-section" v-if="!isAwakening">
      <view class="field-block">
        <text class="field-label">{{ currentConfig.welcome.nameLabel }}</text>
        <input
          class="pet-name-input"
          v-model="petName"
          :placeholder="currentConfig.welcome.namePlaceholder"
          placeholder-style="color:#AFA69A"
        />
      </view>

      <view class="photo-panel" hover-class="photo-panel-hover" @click="uploadPhoto">
        <image v-if="tempPhoto" :src="tempPhoto" class="preview-img" mode="aspectFill"></image>
        <view v-else class="upload-placeholder">
          <view class="upload-icon">
            <uni-icons type="camera" size="28" color="#8C7557"></uni-icons>
          </view>
          <text class="upload-title">{{ currentConfig.welcome.photoTitle }}</text>
          <text class="upload-subtitle">{{ currentConfig.welcome.photoSubtitle }}</text>
        </view>
      </view>

      <view class="avatar-mock-panel" hover-class="avatar-mock-panel-hover" @click="showAvatarMockHint">
        <view class="avatar-mock-icon">
          <uni-icons type="image" size="24" color="#8C7557"></uni-icons>
        </view>
        <view class="avatar-mock-copy">
          <text class="avatar-mock-title">先上传一张照片就够了</text>
          <text class="avatar-mock-desc">之后可以重新生成。将默认使用{{ defaultAvatarStyleText }}，本轮只保存在本地，不上传云端。</text>
        </view>
      </view>

      <button class="start-btn" hover-class="start-btn-hover" @click="startAwakening">
        <uni-icons type="heart-filled" size="18" color="#FBFAF6"></uni-icons>
        <text>{{ currentConfig.welcome.startText }}</text>
      </button>
    </view>

    <view class="awakening-overlay" v-if="isAwakening">
      <view class="breathing-mark">
        <text>归</text>
      </view>
      <text class="awakening-text">{{ awakeningText }}</text>
    </view>
  </view>
</template>

<script>
import { addPet, canCreatePet, getActivePet, updateActivePet } from '../../common/pet-store.js';
import { getPetRelationshipStage, getRelationshipConfig, normalizeRelationshipStage, withRelationshipStage } from '../../common/relationship-config.js';
import { getAvatarStyleText, getDefaultAvatarStyle } from '../../common/pet-avatar-generator.js';

const ONBOARDING_PENDING_KEY = 'guizhua_onboarding_pending';

export default {
  data() {
    return {
      activePetId: null,
      activePetSnapshot: null,
      entryMode: 'edit',
      petName: '',
      petMode: '2.5d',
      petStatus: 'current',
      tempPhoto: '',
      isAwakening: false
    }
  },
  computed: {
    currentConfig() {
      return getRelationshipConfig(this.petStatus);
    },
    defaultAvatarStyle() {
      return getDefaultAvatarStyle(this.petStatus);
    },
    defaultAvatarStyleText() {
      return getAvatarStyleText(this.defaultAvatarStyle, this.petStatus);
    },
    awakeningText() {
      return this.currentConfig.welcome.loadingText(this.petName || '这段关系');
    }
  },
  onLoad(options = {}) {
    this.entryMode = options.mode === 'create' ? 'create' : 'edit';
  },
  onShow() {
    if (this.entryMode === 'create') {
      this.activePetId = null;
      this.activePetSnapshot = null;
      this.petName = '';
      this.petMode = '2.5d';
      this.petStatus = 'current';
      this.tempPhoto = '';
      return;
    }

    const activePet = getActivePet();
    if (!activePet) return;

    this.activePetId = activePet.id;
    this.activePetSnapshot = activePet;
    this.petName = activePet.name;
    this.petMode = activePet.mode;
    this.petStatus = getPetRelationshipStage(activePet);
    this.tempPhoto = activePet.photo;
  },
  methods: {
    uploadPhoto() {
      uni.showActionSheet({
        itemList: ['拍照', '从相册选择'],
        success: (res) => {
          this.choosePetPhoto(res.tapIndex === 0 ? 'camera' : 'album');
        }
      });
    },
    choosePetPhoto(sourceType) {
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: [sourceType],
        success: (res) => this.saveTempPhoto(res.tempFilePaths[0])
      });
    },
    saveTempPhoto(tempPath) {
      uni.saveFile({
        tempFilePath: tempPath,
        success: (saveRes) => {
          this.tempPhoto = saveRes.savedFilePath;
        },
        fail: () => {
          this.tempPhoto = tempPath;
        }
      });
    },
    showAvatarMockHint() {
      uni.showToast({ title: '本轮仅预留 mock 流程，暂不调用真实生成', icon: 'none' });
    },
    buildAvatarPatch(relationshipStage, photo) {
      const existing = this.activePetSnapshot || {};
      const originalPhotoUrl = photo && photo !== '/static/pet.png'
        ? photo
        : (existing.originalPhotoUrl || '');
      const generatedAvatarUrl = existing.generatedAvatarUrl || '';
      const avatarSource = existing.avatarSource ||
        (generatedAvatarUrl ? 'generated' : (originalPhotoUrl ? 'original' : 'placeholder'));

      return {
        avatarSource,
        originalPhotoUrl,
        generatedAvatarUrl,
        avatarStyle: existing.avatarStyle || getDefaultAvatarStyle(relationshipStage),
        avatarStatus: existing.avatarStatus || 'none',
        avatarUpdatedAt: existing.avatarUpdatedAt || 0
      };
    },
    startAwakening() {
      const petName = this.petName.trim();
      if (!petName) {
        uni.showToast({ title: '先给这段关系一个称呼', icon: 'none' });
        return;
      }

      if (!this.activePetId && !canCreatePet()) {
        uni.showToast({ title: '普通用户只能添加一只宝贝，开通会员后可添加多只', icon: 'none' });
        return;
      }

      this.isAwakening = true;
      const photo = this.tempPhoto || '/static/pet.png';
      const relationshipStage = this.activePetId
        ? normalizeRelationshipStage(this.petStatus)
        : 'current';
      const petPatch = withRelationshipStage({
        name: petName,
        photo,
        mode: this.petMode,
        ...this.buildAvatarPatch(relationshipStage, photo)
      }, relationshipStage);

      const shouldTriggerOnboarding = !this.activePetId;
      const pet = (this.activePetId
        ? updateActivePet(petPatch)
        : null) || addPet(petPatch);

      this.petName = pet.name;
      if (shouldTriggerOnboarding) {
        uni.setStorageSync(ONBOARDING_PENDING_KEY, true);
      }

      const avatarReady = pet.avatarStatus === 'ready' && pet.generatedAvatarUrl;
      setTimeout(() => {
        if (avatarReady) {
          uni.switchTab({ url: '/pages/home/home' });
          return;
        }
        uni.redirectTo({ url: `/pages/avatar-generate/avatar-generate?petId=${pet.id}` });
      }, 900);
    }
  }
}
</script>

<style scoped>
.welcome-page {
  min-height: 100vh;
  padding: 88rpx 44rpx calc(64rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  background: linear-gradient(180deg, #F7F3EA 0%, #F2EDE3 42%, #FBFAF6 100%);
  color: #302A23;
}

.brand-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 34rpx;
}

.brand-mark {
  width: 126rpx;
  height: 126rpx;
  border-radius: 50%;
  background: #302A23;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 24rpx 52rpx rgba(48, 42, 35, 0.18);
}

.brand-mark-text {
  color: #F7F3EA;
  font-size: 52rpx;
  font-weight: 500;
  line-height: 1;
}

.brand-name {
  margin-top: 28rpx;
  font-size: 52rpx;
  color: #302A23;
  font-weight: 600;
  line-height: 1.1;
}

.brand-subtitle {
  margin-top: 8rpx;
  color: #8C7557;
  font-size: 22rpx;
  line-height: 1.3;
}

.brand-line {
  margin-top: 28rpx;
  color: #6F665B;
  font-size: 26rpx;
  line-height: 1.5;
}

.setup-section {
  margin-top: 60rpx;
}

.relationship-section {
  margin-bottom: 24rpx;
}

.section-label {
  display: block;
  color: #8C7557;
  font-size: 22rpx;
  line-height: 1.3;
}

.relationship-grid {
  margin-top: 14rpx;
  display: grid;
  grid-template-columns: 1fr;
  gap: 14rpx;
}

.relationship-card {
  padding: 24rpx 26rpx;
  border-radius: 16rpx;
  background: rgba(255, 255, 255, 0.78);
  border: 1rpx solid #EEE6DA;
  box-shadow: 0 12rpx 30rpx rgba(58, 51, 43, 0.04);
}

.relationship-card-active {
  background: #302A23;
  border-color: #302A23;
  box-shadow: 0 16rpx 38rpx rgba(48, 42, 35, 0.16);
}

.relationship-card-hover {
  opacity: 0.82;
}

.relationship-title,
.relationship-desc {
  display: block;
}

.relationship-title {
  color: #302A23;
  font-size: 28rpx;
  font-weight: 600;
  line-height: 1.25;
}

.relationship-desc {
  margin-top: 8rpx;
  color: #8F877A;
  font-size: 22rpx;
  line-height: 1.45;
}

.relationship-card-active .relationship-title,
.relationship-card-active .relationship-desc {
  color: #FBFAF6;
}

.field-block {
  padding: 26rpx 28rpx;
  border-radius: 16rpx;
  background: rgba(255, 255, 255, 0.78);
  border: 1rpx solid #EEE6DA;
  box-shadow: 0 14rpx 34rpx rgba(58, 51, 43, 0.05);
}

.field-label {
  display: block;
  color: #8C7557;
  font-size: 22rpx;
  line-height: 1.3;
}

.pet-name-input {
  margin-top: 12rpx;
  height: 58rpx;
  color: #302A23;
  font-size: 34rpx;
  font-weight: 500;
}

.photo-panel {
  margin-top: 24rpx;
  height: 390rpx;
  border-radius: 16rpx;
  background: #FFFFFF;
  border: 1rpx solid #EEE6DA;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 14rpx 34rpx rgba(58, 51, 43, 0.05);
}

.photo-panel-hover {
  opacity: 0.82;
}

.preview-img {
  width: 100%;
  height: 100%;
}

.upload-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.upload-icon {
  width: 78rpx;
  height: 78rpx;
  border-radius: 50%;
  background: #F2EDE3;
  display: flex;
  align-items: center;
  justify-content: center;
}

.upload-title {
  margin-top: 22rpx;
  color: #302A23;
  font-size: 30rpx;
  font-weight: 600;
  line-height: 1.25;
}

.upload-subtitle {
  margin-top: 8rpx;
  color: #8F877A;
  font-size: 24rpx;
  line-height: 1.4;
}

.avatar-mock-panel {
  margin-top: 20rpx;
  padding: 22rpx 24rpx;
  border-radius: 16rpx;
  background: #FFFDF8;
  border: 1rpx dashed #D9CBB8;
  display: flex;
  align-items: center;
  gap: 18rpx;
}

.avatar-mock-panel-hover {
  opacity: 0.82;
}

.avatar-mock-icon {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: #F2EDE3;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.avatar-mock-copy {
  flex: 1;
  min-width: 0;
}

.avatar-mock-title,
.avatar-mock-desc {
  display: block;
}

.avatar-mock-title {
  color: #302A23;
  font-size: 26rpx;
  font-weight: 600;
  line-height: 1.25;
}

.avatar-mock-desc {
  margin-top: 6rpx;
  color: #8F877A;
  font-size: 22rpx;
  line-height: 1.35;
}

.mode-selector {
  margin-top: 24rpx;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18rpx;
}

.mode-option {
  min-height: 116rpx;
  padding: 24rpx;
  border-radius: 16rpx;
  background: #FFFFFF;
  border: 1rpx solid #EEE6DA;
  box-sizing: border-box;
}

.mode-option-active {
  background: #302A23;
  border-color: #302A23;
  box-shadow: 0 16rpx 38rpx rgba(48, 42, 35, 0.16);
}

.mode-title,
.mode-desc {
  display: block;
}

.mode-title {
  color: #302A23;
  font-size: 28rpx;
  font-weight: 600;
  line-height: 1.25;
}

.mode-desc {
  margin-top: 8rpx;
  color: #8F877A;
  font-size: 22rpx;
  line-height: 1.3;
}

.mode-option-active .mode-title,
.mode-option-active .mode-desc {
  color: #FBFAF6;
}

.start-btn {
  margin-top: 34rpx;
  width: 100%;
  height: 96rpx;
  padding: 0;
  border-radius: 16rpx;
  background: #8C7557;
  color: #FBFAF6;
  font-size: 30rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  box-shadow: 0 18rpx 42rpx rgba(140, 117, 87, 0.24);
}

.start-btn::after {
  border: none;
}

.start-btn-hover {
  opacity: 0.82;
}

.awakening-overlay {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: #F7F3EA;
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.breathing-mark {
  width: 132rpx;
  height: 132rpx;
  border-radius: 50%;
  background: #302A23;
  color: #F7F3EA;
  font-size: 54rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: breatheMark 1.8s ease-in-out infinite;
}

.awakening-text {
  margin-top: 38rpx;
  color: #5E554B;
  font-size: 28rpx;
  line-height: 1.4;
}

@keyframes breatheMark {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(0.92);
    opacity: 0.72;
  }
}

.welcome-page {
  --ui-bg-1: #F8F2E8;
  --ui-bg-2: #EFE5D5;
  --ui-bg-3: #E7EADF;
  --ui-card: rgba(255, 252, 246, 0.66);
  --ui-border: rgba(255, 255, 255, 0.58);
  --ui-text: #2F2A24;
  --ui-muted: rgba(47, 42, 36, 0.58);
  --ui-accent: #6D5945;
  background:
    radial-gradient(circle at 18% 8%, rgba(232, 188, 128, 0.24) 0%, rgba(255, 255, 255, 0) 34%),
    linear-gradient(145deg, var(--ui-bg-1) 0%, var(--ui-bg-2) 52%, var(--ui-bg-3) 100%);
  animation: welcomeFadeUp 520ms ease both;
}

.brand-mark {
  background: var(--ui-accent);
  box-shadow: 0 24rpx 52rpx rgba(109, 89, 69, 0.2);
}

.brand-subtitle,
.section-label,
.field-label {
  color: var(--ui-accent);
}

.brand-line,
.relationship-desc,
.upload-subtitle,
.avatar-mock-desc,
.mode-desc {
  color: var(--ui-muted);
}

.relationship-card,
.field-block,
.photo-panel,
.avatar-mock-panel,
.mode-option {
  border-radius: 30rpx;
  border: 1rpx solid var(--ui-border);
  background: var(--ui-card);
  box-shadow: 0 16rpx 42rpx rgba(72, 58, 43, 0.055);
}

.avatar-mock-panel {
  border-style: solid;
}

.relationship-card-active,
.mode-option-active,
.start-btn {
  background: var(--ui-accent);
  border-color: transparent;
}

.upload-icon,
.avatar-mock-icon {
  background: rgba(255, 255, 255, 0.42);
}

.relationship-card,
.photo-panel,
.avatar-mock-panel,
.mode-option,
.start-btn {
  transition: transform 160ms ease, opacity 160ms ease;
}

.relationship-card-hover,
.photo-panel-hover,
.avatar-mock-panel-hover,
.start-btn-hover {
  transform: scale(0.985);
  opacity: 0.86;
}

.start-btn-hover {
  transform: scale(0.98);
}

@keyframes welcomeFadeUp {
  from {
    opacity: 0;
    transform: translateY(16rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
