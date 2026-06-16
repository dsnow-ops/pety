<template>
  <view :class="['home-page', themeClass]">
    <view class="gradient-background"></view>

    <scroll-view scroll-y class="home-scroll">
      <view class="home-shell">
        <view class="home-header">
          <view class="header-copy">
            <text class="header-kicker">{{ headerKicker }}</text>
            <text class="pet-name">{{ petName }}</text>
            <text class="header-subtitle">{{ headerSubtitle }}</text>
          </view>
          <view class="header-actions">
            <button class="top-icon-button" hover-class="top-icon-button-active" @click="handleLightInfo('reminder')">
              <uni-icons type="info" size="18" color="#5E5044"></uni-icons>
            </button>
            <button class="top-icon-button" hover-class="top-icon-button-active" @click="showMenu">
              <uni-icons type="more-filled" size="20" color="#5E5044"></uni-icons>
            </button>
          </view>
        </view>

        <view class="pet-hero-card">
          <view class="hero-glow"></view>
          <view class="hero-visual">
            <image v-if="shouldShowPetImage" class="hero-pet-image" :src="petPhoto" mode="aspectFit"></image>
            <view v-else class="pet-placeholder">
              <view class="placeholder-ears">
                <view class="placeholder-ear left"></view>
                <view class="placeholder-ear right"></view>
              </view>
              <view class="placeholder-head"></view>
              <view class="placeholder-body"></view>
            </view>
            <view class="pet-shadow"></view>
          </view>
          <view class="hero-caption">
            <view class="hero-caption-copy">
              <text class="hero-title">{{ avatarTitle }}</text>
              <text class="hero-subtitle">{{ avatarHintText }}</text>
            </view>
            <button class="avatar-action" hover-class="primary-button-active" @click="handleAvatarMock">
              <text>{{ avatarActionText }}</text>
            </button>
          </view>
        </view>

        <view class="companion-line">
          <text>{{ companionLine }}</text>
        </view>

        <view class="action-row">
          <button
            v-for="item in coreActions"
            :key="item.key"
            :class="['action-card', item.primary ? 'action-card-primary' : 'action-card-secondary']"
            hover-class="action-card-active"
            @click="handleCoreAction(item.key)"
          >
            <view class="action-icon">
              <uni-icons :type="item.icon" size="21" :color="item.primary ? '#FFFDF8' : '#4C4036'"></uni-icons>
            </view>
            <text class="action-title">{{ item.title }}</text>
            <text class="action-desc">{{ item.desc }}</text>
          </button>
        </view>

        <view class="light-info-section">
          <view
            v-for="card in lightInfoCards"
            :key="card.key"
            class="light-info-card"
            hover-class="light-info-card-active"
            @click="handleLightInfo(card.key)"
          >
            <view class="light-info-icon">
              <uni-icons :type="card.icon" size="19" color="#7D6853"></uni-icons>
            </view>
            <view class="light-info-copy">
              <text class="light-info-kicker">{{ card.kicker }}</text>
              <text class="light-info-title">{{ card.title }}</text>
              <text class="light-info-desc">{{ card.desc }}</text>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import { getActivePet, updateActivePet } from '../../common/pet-store.js';
import { formatDateKey, getDiaryRecord, getEventLabel, getMoodLabel, hasDiaryRecord } from '../../common/diary-store.js';
import { formatPetAge, getNeuteredLabel, getPetProfile } from '../../common/profile-store.js';
import { getPetRelationshipStage, getRelationshipHomeCopy, getRelationshipThemeClass, setRelationshipTabBar } from '../../common/relationship-config.js';
import { createAvatarJob, getAvatarDisplayImage, saveGeneratedAvatar } from '../../common/pet-avatar-generator.js';

const DEFAULT_AVATAR_PLACEHOLDER = '/static/pet.png';
const ONBOARDING_SEEN_KEY = 'guizhua_onboarding_seen';
const ONBOARDING_PENDING_KEY = 'guizhua_onboarding_pending';

export default {
  data() {
    return {
      activePet: null,
      petName: '毛孩子',
      petPhoto: DEFAULT_AVATAR_PLACEHOLDER,
      profile: {},
      todayRecord: null,
      petStats: {
        days: 0,
        moments: 0,
        chats: 0
      }
    };
  },
  computed: {
    activeRelationshipStage() {
      return getPetRelationshipStage(this.activePet);
    },
    isMemorialMode() {
      return this.activeRelationshipStage === 'deceased';
    },
    homeCopy() {
      return getRelationshipHomeCopy(this.activeRelationshipStage, this.activePet || { name: this.petName });
    },
    themeClass() {
      return getRelationshipThemeClass(this.activeRelationshipStage);
    },
    headerKicker() {
      return this.isMemorialMode ? '温柔纪念' : '正在陪伴';
    },
    headerSubtitle() {
      if (!this.activePet) return '先为它建立一张生命卡。';
      return this.isMemorialMode ? '今天也可以慢慢想起它。' : '今天也在这里，陪你慢慢记录。';
    },
    hasGeneratedAvatar() {
      return Boolean(this.activePet && this.activePet.avatarStatus === 'ready' && this.activePet.generatedAvatarUrl);
    },
    shouldShowPetImage() {
      return Boolean(this.petPhoto && this.petPhoto !== DEFAULT_AVATAR_PLACEHOLDER);
    },
    avatarTitle() {
      if (this.shouldShowPetImage) {
        return this.isMemorialMode ? `${this.petName} 的纪念肖像` : `${this.petName} 的电子宠物`;
      }
      return this.isMemorialMode ? '生成一张纪念肖像，把它温柔留在这里' : '上传一张照片，让它成为首页主角';
    },
    avatarHintText() {
      if (this.shouldShowPetImage) {
        return this.isMemorialMode ? '安静收好真实拥有过的陪伴。' : '每天打开时，先看见它。';
      }
      return '一张清晰照片就够了，效果不理想再换一张。';
    },
    avatarActionText() {
      if (this.isMemorialMode) return this.hasGeneratedAvatar ? '查看纪念肖像' : '生成纪念肖像';
      return this.hasGeneratedAvatar ? '查看电子宠物' : '生成电子宠物形象';
    },
    companionLine() {
      if (!this.activePet) return '建立档案后，归爪会把它的照片、记录和故事慢慢收好。';
      if (this.isMemorialMode) return `${this.petName} 被温柔地留在这里，今天也可以慢慢想起它。`;
      return `${this.petName} 今天也在这里，已经陪伴你 ${this.petStats.days} 天。`;
    },
    coreActions() {
      if (this.isMemorialMode) {
        return [
          { key: 'journal', icon: 'compose', title: '写一段回忆', desc: '今天想起的事', primary: true },
          { key: 'chat', icon: 'chatbubble', title: '整理想念', desc: '慢慢说', primary: false },
          { key: 'archive', icon: 'folder-add', title: '它的故事', desc: '纪念档案', primary: false }
        ];
      }

      return [
        { key: 'journal', icon: 'compose', title: '记录今天', desc: '状态和小事', primary: true },
        { key: 'chat', icon: 'chatbubble', title: '和它聊聊', desc: '照护问题', primary: false },
        { key: 'archive', icon: 'folder-add', title: '查看档案', desc: '身体与习惯', primary: false }
      ];
    },
    recentRecordTitle() {
      if (!hasDiaryRecord(this.todayRecord)) return this.isMemorialMode ? '今天还没有回忆记录' : '今天还没有记录';
      return this.isMemorialMode ? '今天的想念已收好' : '今天已经有记录';
    },
    recentRecordDesc() {
      if (!hasDiaryRecord(this.todayRecord)) {
        return this.isMemorialMode ? '可以从一句想说的话开始。' : '可以从饮食、精神或一个小片段开始。';
      }
      const events = this.todayRecord.events || [];
      if (events.length) return events.slice(0, 2).map(getEventLabel).join('、');
      return getMoodLabel(this.todayRecord.mood);
    },
    lightReminderTitle() {
      if (this.isMemorialMode) return '纪念模式已开启';
      if (!this.activePet) return '轻照护提醒';
      return this.profile.weight ? '照护线索已在档案里' : '可以补充体重';
    },
    lightReminderDesc() {
      if (this.isMemorialMode) return '布局不变，只把文案和氛围放慢。';
      if (!this.activePet) return '建立档案后，这里只保留一条轻提醒。';
      if (this.profile.weight) return `年龄 ${this.ageText}，绝育 ${this.neuteredText}。`;
      return '体重、疫苗、过敏信息会帮助后续照护判断。';
    },
    lightInfoCards() {
      if (this.isMemorialMode) {
        return [
          { key: 'recent', icon: 'heart', kicker: '最近回忆', title: this.recentRecordTitle, desc: this.recentRecordDesc },
          { key: 'memorial', icon: 'email', kicker: '纪念状态', title: this.lightReminderTitle, desc: this.lightReminderDesc }
        ];
      }

      return [
        { key: 'recent', icon: 'calendar', kicker: '今天', title: this.recentRecordTitle, desc: this.recentRecordDesc },
        { key: 'reminder', icon: 'info', kicker: '轻提醒', title: this.lightReminderTitle, desc: this.lightReminderDesc }
      ];
    },
    ageText() {
      return formatPetAge(this.profile.birthday);
    },
    neuteredText() {
      return getNeuteredLabel(this.profile.neutered);
    }
  },
  onShow() {
    this.loadHomeData();
    this.$nextTick(() => {
      this.maybeShowOnboardingGuide();
    });
  },
  methods: {
    maybeShowOnboardingGuide() {
      if (uni.getStorageSync(ONBOARDING_SEEN_KEY)) return;

      const pendingAfterCreate = Boolean(uni.getStorageSync(ONBOARDING_PENDING_KEY));
      const firstEnterWithoutPet = !this.activePet;
      if (!pendingAfterCreate && !firstEnterWithoutPet) return;

      uni.setStorageSync(ONBOARDING_SEEN_KEY, true);
      uni.removeStorageSync(ONBOARDING_PENDING_KEY);
      uni.showModal({
        title: '欢迎来到归爪',
        content: '1. 建立宠物档案\n2. 上传照片，生成电子宠物形象\n3. 记录今天，或者和它聊聊',
        cancelText: '稍后再说',
        confirmText: '知道了',
        showCancel: true
      });
    },
    loadHomeData() {
      const activePet = getActivePet();
      this.activePet = activePet;
      setRelationshipTabBar(getPetRelationshipStage(activePet));

      if (!activePet) {
        this.petName = '毛孩子';
        this.petPhoto = DEFAULT_AVATAR_PLACEHOLDER;
        this.profile = {};
        this.todayRecord = null;
        this.petStats = { days: 0, moments: 0, chats: 0 };
        return;
      }

      this.petName = activePet.name || '毛孩子';
      this.petPhoto = getAvatarDisplayImage(activePet);
      this.profile = getPetProfile(activePet.id);
      this.todayRecord = getDiaryRecord(activePet.id, formatDateKey());
      this.petStats = this.calculatePetStats(activePet);
    },
    calculatePetStats(pet) {
      const createdAt = pet.createdAt || Date.now();
      const days = Math.max(1, Math.ceil((Date.now() - createdAt) / 86400000));
      const diary = uni.getStorageSync('pet_diaries_' + pet.id) || {};
      const moments = Object.keys(diary).length;
      const chatHistory = uni.getStorageSync('chat_history_' + pet.id) || [];
      const chats = chatHistory.filter(msg => msg.type === 'user').length;

      return { days, moments, chats };
    },
    showMenu() {
      this.safeVibrate();
      uni.showActionSheet({
        itemList: ['编辑当前宝贝', '查看档案'],
        success: (res) => {
          if (res.tapIndex === 0) {
            uni.reLaunch({ url: '/pages/welcome/welcome' });
            return;
          }
          this.openArchive();
        }
      });
    },
    handleAvatarMock() {
      this.safeVibrate();
      if (!this.activePet) {
        uni.showToast({ title: '请先建立宠物档案', icon: 'none' });
        return;
      }

      if (this.hasGeneratedAvatar) {
        uni.showToast({ title: this.isMemorialMode ? '纪念肖像已在首页展示' : '电子宠物已在首页展示', icon: 'none' });
        return;
      }

      const job = createAvatarJob(this.activePet, { avatarStyle: this.activePet.avatarStyle });
      const patch = saveGeneratedAvatar(this.activePet, job.result);
      const updatedPet = updateActivePet(patch);
      this.activePet = updatedPet || { ...this.activePet, ...patch };
      this.petPhoto = getAvatarDisplayImage(this.activePet);
      uni.showToast({ title: this.isMemorialMode ? '已生成 mock 纪念肖像' : '已生成 mock 数字形象', icon: 'none' });
    },
    handleCoreAction(key) {
      this.safeVibrate();
      if (key === 'journal') {
        uni.navigateTo({ url: '/pages/calendar/calendar' });
        return;
      }

      if (key === 'chat') {
        if (this.isMemorialMode) {
          uni.setStorageSync('pending_chat_prompt', `我今天有点想${this.petName}，想慢慢整理一下。`);
        }
        uni.switchTab({ url: '/pages/chat/chat' });
        return;
      }

      if (key === 'archive') {
        this.openArchive();
      }
    },
    handleLightInfo(key) {
      this.safeVibrate();
      if (key === 'recent') {
        uni.navigateTo({ url: '/pages/calendar/calendar' });
        return;
      }
      this.openArchive();
    },
    openArchive() {
      uni.navigateTo({ url: '/pages/archive/archive' });
    },
    safeVibrate() {
      if (!uni.vibrateShort) return;
      try {
        uni.vibrateShort({ type: 'light' });
      } catch (err) {}
    }
  }
};
</script>

<style scoped>
.home-page {
  --home-bg-1: #FFFCF5;
  --home-bg-2: #EFE7D9;
  --home-bg-3: #FBFAF6;
  --home-glow-1: rgba(238, 202, 156, 0.34);
  --home-glow-2: rgba(255, 255, 255, 0.76);
  --home-card: rgba(255, 255, 255, 0.56);
  --home-card-strong: rgba(255, 255, 255, 0.78);
  --home-text: #302A23;
  --home-muted: #766B5F;
  --home-soft: #9A8668;
  --home-accent: #675746;
  --home-border: rgba(255, 255, 255, 0.68);
  --home-shadow: rgba(72, 58, 43, 0.13);
  width: 100vw;
  min-height: 100vh;
  position: relative;
  overflow: hidden;
  color: var(--home-text);
  background: linear-gradient(180deg, var(--home-bg-1) 0%, var(--home-bg-2) 54%, var(--home-bg-3) 100%);
  transition: background 420ms ease, color 420ms ease;
}

.home-page.theme-memorial {
  --home-bg-1: #F7F8FB;
  --home-bg-2: #E7E9F0;
  --home-bg-3: #FAFAFB;
  --home-glow-1: rgba(142, 142, 181, 0.26);
  --home-glow-2: rgba(255, 236, 205, 0.24);
  --home-card: rgba(255, 255, 255, 0.5);
  --home-card-strong: rgba(255, 255, 255, 0.66);
  --home-text: #282B36;
  --home-muted: #686D7E;
  --home-soft: #7B7F9B;
  --home-accent: #52566F;
  --home-border: rgba(195, 201, 218, 0.54);
  --home-shadow: rgba(76, 80, 104, 0.12);
}

.gradient-background {
  position: fixed;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 18% 14%, var(--home-glow-1) 0%, rgba(255, 255, 255, 0) 34%),
    radial-gradient(circle at 88% 24%, var(--home-glow-2) 0%, rgba(255, 255, 255, 0) 30%);
  animation: gradientBreathe 12s ease-in-out infinite;
}

.home-scroll {
  position: relative;
  width: 100%;
  height: 100vh;
}

.home-shell {
  min-height: 100vh;
  padding: calc(var(--status-bar-height, 0px) + 34rpx) 30rpx calc(154rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  animation: fadeUp 520ms ease both;
}

.home-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 22rpx;
  min-height: 124rpx;
  margin-bottom: 24rpx;
}

.header-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.header-kicker {
  color: var(--home-soft);
  font-size: 22rpx;
  line-height: 1.25;
}

.pet-name {
  margin-top: 8rpx;
  color: var(--home-text);
  font-size: 56rpx;
  font-weight: 650;
  line-height: 1.08;
}

.header-subtitle {
  margin-top: 10rpx;
  max-width: 500rpx;
  color: var(--home-muted);
  font-size: 24rpx;
  line-height: 1.42;
}

.header-actions {
  flex-shrink: 0;
  display: flex;
  gap: 12rpx;
  padding-top: 2rpx;
}

.top-icon-button {
  width: 70rpx;
  height: 70rpx;
  margin: 0;
  padding: 0;
  border-radius: 50%;
  border: 1rpx solid var(--home-border);
  background: rgba(255, 255, 255, 0.58);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 16rpx 36rpx rgba(66, 55, 43, 0.08);
  transition: transform 160ms ease, opacity 160ms ease;
}

.top-icon-button::after,
.avatar-action::after,
.action-card::after {
  border: none;
}

.pet-hero-card {
  min-height: 390rpx;
  padding: 24rpx 24rpx 22rpx;
  border-radius: 42rpx;
  border: 1rpx solid var(--home-border);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.68) 0%, rgba(255, 250, 242, 0.4) 100%);
  box-shadow: 0 30rpx 78rpx var(--home-shadow);
  box-sizing: border-box;
  overflow: hidden;
  animation: cardRise 560ms 80ms ease both;
}

.hero-visual {
  position: relative;
  height: 262rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hero-glow {
  position: absolute;
  width: 480rpx;
  height: 250rpx;
  border-radius: 50%;
  background: radial-gradient(circle, var(--home-glow-1) 0%, rgba(255, 255, 255, 0) 70%);
  animation: glowPulse 8.4s ease-in-out infinite;
}

.hero-pet-image {
  position: relative;
  z-index: 2;
  width: 610rpx;
  height: 250rpx;
  object-fit: contain;
  animation: petFloat 6.4s ease-in-out infinite;
}

.pet-placeholder {
  position: relative;
  z-index: 2;
  width: 330rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: petFloat 6.4s ease-in-out infinite;
}

.placeholder-ears {
  width: 210rpx;
  display: flex;
  justify-content: space-between;
  margin-bottom: -34rpx;
}

.placeholder-ear {
  width: 70rpx;
  height: 96rpx;
  border-radius: 48rpx 48rpx 24rpx 24rpx;
  background: rgba(226, 211, 190, 0.84);
}

.placeholder-ear.left {
  transform: rotate(-22deg);
}

.placeholder-ear.right {
  transform: rotate(22deg);
}

.placeholder-head {
  width: 190rpx;
  height: 168rpx;
  border-radius: 48% 48% 44% 44%;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.86) 0%, rgba(226, 211, 190, 0.72) 100%);
  box-shadow: inset 0 -16rpx 30rpx rgba(122, 98, 70, 0.08), 0 22rpx 46rpx rgba(93, 75, 53, 0.12);
}

.placeholder-body {
  width: 246rpx;
  height: 132rpx;
  margin-top: -18rpx;
  border-radius: 48% 48% 38% 38%;
  background: linear-gradient(180deg, rgba(245, 238, 226, 0.88) 0%, rgba(209, 187, 158, 0.66) 100%);
  box-shadow: inset 0 18rpx 34rpx rgba(255, 255, 255, 0.32), 0 24rpx 48rpx rgba(93, 75, 53, 0.12);
}

.pet-shadow {
  position: absolute;
  left: 50%;
  bottom: 8rpx;
  width: 320rpx;
  height: 24rpx;
  border-radius: 50%;
  transform: translateX(-50%);
  background: rgba(61, 50, 39, 0.16);
  animation: shadowBreathe 6.4s ease-in-out infinite;
}

.hero-caption {
  margin-top: 18rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
}

.hero-caption-copy {
  min-width: 0;
}

.hero-title {
  display: block;
  color: var(--home-text);
  font-size: 28rpx;
  font-weight: 650;
  line-height: 1.25;
}

.hero-subtitle {
  display: block;
  margin-top: 8rpx;
  color: var(--home-muted);
  font-size: 21rpx;
  line-height: 1.4;
}

.avatar-action {
  flex-shrink: 0;
  height: 66rpx;
  margin: 0;
  padding: 0 28rpx;
  border-radius: 999rpx;
  background: var(--home-accent);
  color: #FFFDF8;
  font-size: 23rpx;
  line-height: 66rpx;
  box-shadow: 0 16rpx 36rpx rgba(76, 64, 54, 0.18);
  transition: transform 160ms ease, opacity 160ms ease;
}

.companion-line {
  margin: 22rpx auto 0;
  max-width: 620rpx;
  color: var(--home-text);
  text-align: center;
  font-size: 27rpx;
  font-weight: 560;
  line-height: 1.45;
}

.action-row {
  margin-top: 24rpx;
  display: grid;
  grid-template-columns: 1.15fr 1fr 1fr;
  gap: 14rpx;
}

.action-card {
  min-width: 0;
  min-height: 128rpx;
  margin: 0;
  padding: 18rpx 14rpx;
  border-radius: 28rpx;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  transition: transform 160ms ease, opacity 160ms ease;
}

.action-card-primary {
  background: linear-gradient(180deg, var(--home-accent) 0%, #514337 100%);
  color: #FFFDF8;
  box-shadow: 0 22rpx 46rpx rgba(78, 64, 49, 0.2);
}

.action-card-secondary {
  border: 1rpx solid var(--home-border);
  background: var(--home-card);
  color: var(--home-text);
  box-shadow: 0 14rpx 32rpx rgba(58, 51, 43, 0.055);
}

.action-icon {
  width: 52rpx;
  height: 52rpx;
  border-radius: 18rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.18);
}

.action-card-secondary .action-icon {
  background: rgba(239, 232, 220, 0.86);
}

.action-title {
  margin-top: 12rpx;
  color: inherit;
  font-size: 24rpx;
  font-weight: 650;
  line-height: 1.24;
}

.action-desc {
  margin-top: 7rpx;
  color: inherit;
  font-size: 19rpx;
  line-height: 1.3;
  opacity: 0.72;
}

.light-info-section {
  margin-top: 18rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.light-info-card {
  min-height: 94rpx;
  padding: 18rpx 20rpx;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.54);
  background: rgba(255, 255, 255, 0.42);
  box-shadow: 0 10rpx 28rpx rgba(58, 51, 43, 0.035);
  animation: cardRise 520ms 150ms ease both;
}

.light-info-icon {
  width: 50rpx;
  height: 50rpx;
  flex-shrink: 0;
  border-radius: 18rpx;
  background: rgba(241, 235, 225, 0.88);
  display: flex;
  align-items: center;
  justify-content: center;
}

.light-info-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.light-info-kicker {
  color: var(--home-soft);
  font-size: 18rpx;
  line-height: 1.25;
}

.light-info-title {
  margin-top: 4rpx;
  color: var(--home-text);
  font-size: 25rpx;
  font-weight: 650;
  line-height: 1.28;
}

.light-info-desc {
  margin-top: 5rpx;
  color: var(--home-muted);
  font-size: 22rpx;
  line-height: 1.38;
}

.top-icon-button-active {
  transform: scale(0.94);
  opacity: 0.78;
}

.primary-button-active {
  transform: scale(0.97);
  opacity: 0.9;
}

.action-card-active {
  transform: scale(0.985);
  opacity: 0.9;
}

.light-info-card-active {
  transform: translateY(2rpx);
  opacity: 0.86;
}

.theme-memorial .placeholder-ear {
  background: rgba(212, 214, 230, 0.82);
}

.theme-memorial .placeholder-head,
.theme-memorial .placeholder-body {
  background: linear-gradient(180deg, rgba(248, 249, 253, 0.88) 0%, rgba(202, 204, 222, 0.7) 100%);
}

.theme-memorial .action-card-primary {
  background: linear-gradient(180deg, #5B607B 0%, #464A62 100%);
  box-shadow: 0 20rpx 44rpx rgba(82, 86, 111, 0.2);
}

.theme-memorial .action-card-secondary .action-icon,
.theme-memorial .light-info-icon {
  background: rgba(235, 236, 244, 0.9);
}

@keyframes fadeUp {
  0% {
    opacity: 0;
    transform: translateY(18rpx);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes gradientBreathe {
  0%, 100% {
    opacity: 0.62;
    transform: scale(0.96);
  }
  50% {
    opacity: 0.92;
    transform: scale(1.04);
  }
}

@keyframes glowPulse {
  0%, 100% {
    opacity: 0.76;
    transform: scale(0.96);
  }
  50% {
    opacity: 1;
    transform: scale(1.04);
  }
}

@keyframes petFloat {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10rpx);
  }
}

@keyframes shadowBreathe {
  0%, 100% {
    opacity: 0.72;
    transform: translateX(-50%) scale(1);
  }
  50% {
    opacity: 0.42;
    transform: translateX(-50%) scale(0.88);
  }
}

@keyframes cardRise {
  0% {
    opacity: 0;
    transform: translateY(12rpx);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
