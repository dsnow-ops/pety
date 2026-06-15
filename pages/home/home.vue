<template>
  <view :class="['home-page', themeClass]">
    <scroll-view scroll-y class="home-scroll">
      <view class="home-shell">
        <view class="top-greeting">
          <view class="greeting-copy">
            <text class="greeting-kicker">{{ greetingKicker }}</text>
            <text class="pet-name">{{ petName }}</text>
            <text class="greeting-text">{{ greetingText }}</text>
          </view>
          <view class="top-actions">
            <button class="float-button" hover-class="tap-soft" @click="handleSupportCard('reminder')">
              <uni-icons type="info" size="19" color="#5F5144"></uni-icons>
            </button>
            <button class="float-button" hover-class="tap-soft" @click="showMenu">
              <uni-icons type="more-filled" size="20" color="#5F5144"></uni-icons>
            </button>
          </view>
        </view>

        <view class="pet-hero">
          <view :class="['hero-stage', hasGeneratedAvatar ? 'has-avatar' : 'is-placeholder']">
            <view class="stage-backdrop"></view>
            <view class="stage-platform"></view>
            <view class="hero-image-wrap">
              <image class="pet-main-img" :src="petPhoto" mode="aspectFit"></image>
              <view class="stage-shadow"></view>
            </view>
            <view class="hero-status-card">
              <text class="mode-badge">{{ modeBadgeText }}</text>
              <text class="hero-status-text">{{ companionLine }}</text>
            </view>
            <view class="hero-copy">
              <text class="hero-title">{{ avatarTitle }}</text>
              <text class="hero-hint">{{ avatarHintText }}</text>
            </view>
            <button class="hero-avatar-button" hover-class="tap-scale" @click="handleAvatarMock">
              <text>{{ avatarActionText }}</text>
            </button>
          </view>
        </view>

        <view class="core-actions">
          <button
            v-for="item in coreActions"
            :key="item.key"
            :class="['core-action', item.primary ? 'core-action-primary' : 'core-action-secondary']"
            hover-class="tap-scale"
            @click="handleCoreAction(item.key)"
          >
            <view class="core-icon">
              <uni-icons :type="item.icon" size="22" :color="item.primary ? '#FFFDF8' : '#4C4036'"></uni-icons>
            </view>
            <view class="core-copy">
              <text class="core-title">{{ item.title }}</text>
              <text class="core-desc">{{ item.desc }}</text>
            </view>
          </button>
        </view>

        <view class="support-section">
          <view
            v-for="card in supportCards"
            :key="card.key"
            class="support-card"
            hover-class="support-card-hover"
            @click="handleSupportCard(card.key)"
          >
            <view class="support-icon">
              <uni-icons :type="card.icon" size="20" color="#7D6853"></uni-icons>
            </view>
            <view class="support-copy">
              <text class="support-kicker">{{ card.kicker }}</text>
              <text class="support-title">{{ card.title }}</text>
              <text class="support-desc">{{ card.desc }}</text>
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

const ONBOARDING_SEEN_KEY = 'guizhua_onboarding_seen';
const ONBOARDING_PENDING_KEY = 'guizhua_onboarding_pending';

export default {
  data() {
    return {
      activePet: null,
      petName: '毛孩子',
      petPhoto: '/static/pet.png',
      profile: {},
      todayRecord: null,
      petStats: {
        days: 0,
        moments: 0,
        chats: 0
      }
    }
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
    greetingKicker() {
      return this.isMemorialMode ? '温柔纪念' : '正在陪伴';
    },
    greetingText() {
      if (!this.activePet) return '先为它建立一张生命卡。';
      return this.isMemorialMode ? '今天也可以慢慢想起它。' : '今天也在这里，陪你慢慢记录。';
    },
    modeBadgeText() {
      return this.isMemorialMode ? '纪念模式' : '陪伴中';
    },
    hasGeneratedAvatar() {
      return Boolean(this.activePet && this.activePet.avatarStatus === 'ready' && this.activePet.generatedAvatarUrl);
    },
    avatarTitle() {
      if (this.isMemorialMode) return this.hasGeneratedAvatar ? `${this.petName} 的纪念肖像` : '生成一张纪念肖像，把它温柔留在这里';
      return this.hasGeneratedAvatar ? `${this.petName} 的电子宠物` : '上传一张照片，让它成为首页主角';
    },
    avatarActionText() {
      if (this.isMemorialMode) return this.hasGeneratedAvatar ? '查看纪念肖像' : '生成纪念肖像';
      return this.hasGeneratedAvatar ? '查看电子宠物' : '生成电子宠物形象';
    },
    avatarHintText() {
      if (this.hasGeneratedAvatar) {
        return this.isMemorialMode ? '这不是复活，只是把真实拥有过的陪伴安静收好。' : '它会优先出现在首页，成为每天打开时最先看见的主角。';
      }
      return '第一版只需要一张清晰照片；如果效果不理想，再换一张角度更好的照片。';
    },
    companionLine() {
      if (!this.activePet) return '建立档案后，归爪会把它的照片、记录和故事慢慢收好。';
      if (this.isMemorialMode) return `${this.petName} 被温柔地留在这里，今天也可以慢慢想起它。`;
      return `${this.petName} 今天也在这里，已经陪伴你 ${this.petStats.days} 天。`;
    },
    coreActions() {
      if (this.isMemorialMode) {
        return [
          { key: 'journal', icon: 'compose', title: '写一段回忆', desc: '留下今天想起的事', primary: true },
          { key: 'chat', icon: 'chatbubble', title: '整理想念', desc: '慢慢说给它听', primary: false },
          { key: 'archive', icon: 'folder-add', title: '它的故事', desc: '查看纪念档案', primary: false }
        ];
      }

      return [
        { key: 'journal', icon: 'compose', title: '记录今天', desc: '饮食、状态和小事', primary: true },
        { key: 'chat', icon: 'chatbubble', title: '和它聊聊', desc: '整理照护问题', primary: false },
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
    healthReminderTitle() {
      if (this.isMemorialMode) return '最近整理';
      if (!this.activePet) return '轻提醒';
      return this.profile.weight ? '照护线索已在档案里' : '可以补充体重';
    },
    healthReminderDesc() {
      if (this.isMemorialMode) return `${this.petStats.moments} 条回忆记录，${this.petStats.chats} 次对话。`;
      if (!this.activePet) return '建立档案后，这里只放一条最需要看的提醒。';
      if (this.profile.weight) return `年龄 ${this.ageText}，绝育 ${this.neuteredText}。`;
      return '体重、疫苗、过敏等信息会帮助后续照护判断。';
    },
    memorialEntryTitle() {
      return this.isMemorialMode ? '纪念模式已开启' : '温柔纪念';
    },
    memorialEntryDesc() {
      return this.isMemorialMode ? '布局不变，只把文案和氛围放慢。' : '需要时，可在档案中主动开启。';
    },
    supportCards() {
      return [
        {
          key: 'recent',
          icon: this.isMemorialMode ? 'heart' : 'calendar',
          kicker: this.homeCopy.timelineLabel,
          title: this.recentRecordTitle,
          desc: this.recentRecordDesc
        },
        {
          key: 'reminder',
          icon: this.isMemorialMode ? 'email' : 'info',
          kicker: this.isMemorialMode ? 'MEMORY' : 'CARE',
          title: this.healthReminderTitle,
          desc: this.healthReminderDesc
        },
        {
          key: 'memorial',
          icon: this.isMemorialMode ? 'heart' : 'info',
          kicker: 'MODE',
          title: this.memorialEntryTitle,
          desc: this.memorialEntryDesc
        }
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
        this.petPhoto = '/static/pet.png';
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
    handleSupportCard(key) {
      if (key === 'recent') {
        uni.navigateTo({ url: '/pages/calendar/calendar' });
        return;
      }

      if (key === 'reminder' || key === 'memorial') {
        this.openArchive();
      }
    },
    openArchive() {
      uni.navigateTo({ url: '/pages/archive/archive' });
    }
  }
}
</script>

<style scoped>
.home-page {
  width: 100vw;
  min-height: 100vh;
  overflow: hidden;
  color: #302A23;
  background:
    linear-gradient(180deg, #FFFCF5 0%, #EEE5D6 54%, #FBFAF6 100%);
}

.home-scroll {
  width: 100%;
  height: 100vh;
}

.home-shell {
  min-height: 100vh;
  padding: 78rpx 30rpx 132rpx;
  padding-top: calc(var(--status-bar-height) + 34rpx);
  box-sizing: border-box;
  animation: pageRise 520ms ease both;
}

.top-greeting {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24rpx;
  min-height: 126rpx;
}

.greeting-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.greeting-kicker {
  font-size: 22rpx;
  line-height: 1.3;
  color: #8A7D6A;
}

.pet-name {
  margin-top: 8rpx;
  font-size: 56rpx;
  font-weight: 650;
  line-height: 1.08;
  color: #2E2923;
}

.greeting-text {
  margin-top: 12rpx;
  max-width: 490rpx;
  font-size: 25rpx;
  line-height: 1.45;
  color: #776D60;
}

.top-actions {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex-shrink: 0;
  padding-top: 2rpx;
}

.float-button {
  width: 70rpx;
  height: 70rpx;
  margin: 0;
  padding: 0;
  border-radius: 50%;
  border: 1rpx solid rgba(146, 126, 99, 0.18);
  background: rgba(255, 255, 255, 0.64);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 18rpx 40rpx rgba(66, 55, 43, 0.08);
}

.float-button::after,
.hero-avatar-button::after,
.core-action::after {
  border: none;
}

.pet-hero {
  margin-top: 18rpx;
}

.hero-stage {
  position: relative;
  min-height: 648rpx;
  padding: 22rpx 22rpx 30rpx;
  box-sizing: border-box;
  overflow: visible;
}

.stage-backdrop {
  position: absolute;
  left: 10rpx;
  right: 10rpx;
  top: 62rpx;
  height: 390rpx;
  border-radius: 54rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.68);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.56) 0%, rgba(255, 249, 238, 0.3) 100%);
  box-shadow: 0 34rpx 90rpx rgba(84, 68, 49, 0.13);
}

.stage-platform {
  position: absolute;
  left: 50%;
  top: 376rpx;
  width: 460rpx;
  height: 92rpx;
  border-radius: 50%;
  transform: translateX(-50%);
  background: rgba(189, 166, 132, 0.24);
  box-shadow: 0 26rpx 52rpx rgba(93, 75, 53, 0.12);
}

.hero-image-wrap {
  position: relative;
  z-index: 3;
  height: 456rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.pet-main-img {
  width: 690rpx;
  height: 430rpx;
  object-fit: contain;
  animation: petBreath 5.8s ease-in-out infinite;
}

.is-placeholder .pet-main-img {
  opacity: 0.9;
  filter: saturate(0.82) contrast(0.94);
}

.stage-shadow {
  width: 380rpx;
  height: 26rpx;
  margin-top: -18rpx;
  border-radius: 50%;
  background: rgba(62, 52, 43, 0.16);
  filter: blur(7px);
  animation: shadowBreath 5.8s ease-in-out infinite;
}

.hero-status-card {
  position: relative;
  z-index: 4;
  width: 600rpx;
  min-height: 118rpx;
  margin: -30rpx auto 0;
  padding: 20rpx 26rpx;
  box-sizing: border-box;
  border-radius: 34rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.68);
  box-shadow: 0 24rpx 58rpx rgba(74, 62, 49, 0.12);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.mode-badge {
  font-size: 20rpx;
  line-height: 1.2;
  color: #9A8668;
}

.hero-status-text {
  margin-top: 8rpx;
  color: #4D4338;
  font-size: 27rpx;
  line-height: 1.45;
  font-weight: 560;
}

.hero-copy {
  position: relative;
  z-index: 4;
  margin-top: 18rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.hero-title {
  max-width: 620rpx;
  font-size: 31rpx;
  font-weight: 650;
  line-height: 1.25;
  color: #302A23;
}

.hero-hint {
  margin-top: 10rpx;
  max-width: 560rpx;
  font-size: 22rpx;
  line-height: 1.48;
  color: #7E7468;
}

.hero-avatar-button {
  position: relative;
  z-index: 4;
  height: 70rpx;
  margin: 22rpx auto 0;
  padding: 0 34rpx;
  border-radius: 999rpx;
  background: rgba(76, 64, 54, 0.9);
  color: #FFFDF8;
  font-size: 24rpx;
  line-height: 70rpx;
  box-shadow: 0 18rpx 42rpx rgba(76, 64, 54, 0.2);
}

.core-actions {
  margin-top: 12rpx;
  display: grid;
  grid-template-columns: 1.15fr 1fr 1fr;
  gap: 14rpx;
}

.core-action {
  min-width: 0;
  min-height: 132rpx;
  margin: 0;
  padding: 18rpx 14rpx;
  border-radius: 28rpx;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  transition: transform 180ms ease, opacity 180ms ease;
}

.core-action-primary {
  background: #675746;
  color: #FFFDF8;
  box-shadow: 0 22rpx 46rpx rgba(78, 64, 49, 0.2);
}

.core-action-secondary {
  border: 1rpx solid rgba(214, 203, 187, 0.78);
  background: rgba(255, 255, 255, 0.62);
  color: #3D342C;
  box-shadow: 0 16rpx 38rpx rgba(58, 51, 43, 0.06);
}

.core-icon {
  width: 56rpx;
  height: 56rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.18);
}

.core-action-secondary .core-icon {
  background: rgba(239, 232, 220, 0.86);
}

.core-copy {
  margin-top: 14rpx;
  min-width: 0;
}

.core-title {
  display: block;
  font-size: 25rpx;
  font-weight: 650;
  line-height: 1.24;
}

.core-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 20rpx;
  line-height: 1.35;
  opacity: 0.72;
}

.support-section {
  margin-top: 20rpx;
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.support-card {
  min-height: 112rpx;
  padding: 20rpx 22rpx;
  border-radius: 26rpx;
  display: flex;
  align-items: center;
  gap: 18rpx;
  border: 1rpx solid rgba(225, 216, 202, 0.72);
  background: rgba(255, 255, 255, 0.56);
  box-shadow: 0 14rpx 34rpx rgba(58, 51, 43, 0.045);
  transition: transform 180ms ease, opacity 180ms ease;
}

.support-card-hover {
  opacity: 0.82;
  transform: translateY(2rpx);
}

.support-icon {
  width: 58rpx;
  height: 58rpx;
  flex-shrink: 0;
  border-radius: 22rpx;
  background: rgba(241, 235, 225, 0.88);
  display: flex;
  align-items: center;
  justify-content: center;
}

.support-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.support-kicker {
  font-size: 19rpx;
  line-height: 1.25;
  color: #9B8A73;
}

.support-title {
  margin-top: 4rpx;
  font-size: 27rpx;
  font-weight: 650;
  line-height: 1.3;
  color: #342D26;
}

.support-desc {
  margin-top: 7rpx;
  font-size: 23rpx;
  line-height: 1.42;
  color: #7A7065;
}

.tap-scale {
  transform: scale(0.985);
  opacity: 0.9;
}

.tap-soft {
  opacity: 0.76;
}

.home-page.theme-memorial {
  color: #292C35;
  background:
    linear-gradient(180deg, rgba(247, 248, 251, 0.96) 0%, rgba(229, 232, 239, 0.94) 50%, #FAFAFB 100%);
}

.theme-memorial .greeting-kicker,
.theme-memorial .support-kicker {
  color: #7B7F9B;
}

.theme-memorial .pet-name,
.theme-memorial .hero-title,
.theme-memorial .support-title {
  color: #282B36;
}

.theme-memorial .greeting-text,
.theme-memorial .hero-hint,
.theme-memorial .hero-status-text,
.theme-memorial .support-desc {
  color: #686D7E;
}

.theme-memorial .float-button,
.theme-memorial .stage-backdrop,
.theme-memorial .hero-status-card,
.theme-memorial .core-action-secondary,
.theme-memorial .support-card {
  border-color: rgba(191, 197, 216, 0.5);
  background: rgba(255, 255, 255, 0.5);
  box-shadow: 0 24rpx 64rpx rgba(76, 80, 104, 0.09);
}

.theme-memorial .stage-platform {
  background: rgba(150, 148, 174, 0.2);
  box-shadow: 0 26rpx 52rpx rgba(76, 80, 104, 0.12);
}

.theme-memorial .mode-badge {
  color: #7B7F9B;
}

.theme-memorial .hero-avatar-button,
.theme-memorial .core-action-primary {
  background: #52566F;
  box-shadow: 0 22rpx 48rpx rgba(82, 86, 111, 0.22);
}

.theme-memorial .core-action-secondary .core-icon,
.theme-memorial .support-icon {
  background: rgba(235, 236, 244, 0.9);
}

@keyframes pageRise {
  0% {
    opacity: 0;
    transform: translateY(18rpx);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes petBreath {
  0%, 100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-12rpx) scale(1.012);
  }
}

@keyframes shadowBreath {
  0%, 100% {
    transform: scale(1);
    opacity: 0.74;
  }
  50% {
    transform: scale(0.88);
    opacity: 0.44;
  }
}
</style>
