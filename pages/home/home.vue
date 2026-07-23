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
            <button class="top-icon-button" hover-class="top-icon-button-active" @click="handleInfoCard('reminder')">
              <uni-icons type="info" size="18" color="#5E5044"></uni-icons>
            </button>
            <button class="top-icon-button" hover-class="top-icon-button-active" @click="showMenu">
              <uni-icons type="more-filled" size="20" color="#5E5044"></uni-icons>
            </button>
          </view>
        </view>

        <view class="pet-stage-area">
          <view class="hero-visual">
            <view class="hero-glow"></view>
            <view class="hero-pedestal"></view>
            <image v-if="shouldShowPetImage" class="hero-pet-image" :src="homeHeroAvatar" mode="aspectFit"></image>
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

          <button
            v-if="!hasGeneratedAvatar"
            class="stage-pending-action"
            hover-class="primary-button-active"
            @click="openAvatarGenerate"
          >
            <text>电子宠物形象准备中 · 继续生成</text>
          </button>
        </view>

        <view class="companion-line">
          <text>{{ companionLine }}</text>
        </view>

        <view class="today-panel" hover-class="today-panel-active" @click="openCalendar">
          <view class="today-panel-head">
            <view>
              <text class="today-kicker">今日陪伴</text>
              <text class="today-date">{{ todayDateText }}</text>
              <text class="today-title">{{ todayPanelTitle }}</text>
            </view>
            <button class="today-primary-action" hover-class="primary-button-active" @click.stop="handleCoreAction('journal')">
              <text>{{ todayPrimaryText }}</text>
            </button>
          </view>

          <view class="today-quick-row">
            <view
              v-for="item in todayQuickActions"
              :key="item.key"
              class="today-quick-chip"
              hover-class="today-quick-chip-active"
              @click.stop="handleTodayQuick(item.key)"
            >
              <text>{{ item.label }}</text>
            </view>
          </view>

          <view class="week-strip">
            <view
              v-for="day in weekStripDays"
              :key="day.key"
              :class="['week-item', day.isToday ? 'week-item-today' : '', day.hasRecord ? 'week-item-recorded' : '']"
            >
              <text class="week-label">{{ day.label }}</text>
              <view class="week-dot"></view>
            </view>
          </view>
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
            @click="handleInfoCard(card.key)"
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
import { getActivePet } from '../../common/pet-store.js';
import { formatDateKey, getDiaryRecord, getEventLabel, getMoodLabel, hasDiaryRecord } from '../../common/diary-store.js';
import { getPetProfile } from '../../common/profile-store.js';
import { getPetRelationshipStage, getRelationshipHomeCopy, getRelationshipThemeClass, setRelationshipTabBar } from '../../common/relationship-config.js';

const DEFAULT_AVATAR_PLACEHOLDER = '/static/pet.png';
const ONBOARDING_SEEN_KEY = 'guizhua_onboarding_seen';
const ONBOARDING_PENDING_KEY = 'guizhua_onboarding_pending';

export default {
  data() {
    return {
      activePet: null,
      petName: '毛孩子',
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
      return Boolean(this.homeHeroAvatar);
    },
    homeHeroAvatar() {
      return this.getHomeHeroAvatar(this.activePet);
    },
    shouldShowPetImage() {
      return Boolean(this.homeHeroAvatar);
    },
    companionLine() {
      if (!this.activePet) return '建立档案后，归爪会把它的照片、记录和故事慢慢收好。';
      if (this.isMemorialMode) return `${this.petName} 被温柔地留在这里，今天也可以慢慢想起它。`;
      return `${this.petName} 今天也在这里，已经陪伴你 ${this.petStats.days} 天。`;
    },
    todayPanelTitle() {
      if (!this.activePet) return '先建立档案，今天就有地方安放。';
      if (this.isMemorialMode) return hasDiaryRecord(this.todayRecord) ? '今天已整理回忆' : '今天想它了吗？';
      return hasDiaryRecord(this.todayRecord) ? '今天已记录' : '今天还没有记录';
    },
    todayDateText() {
      const date = new Date();
      const weekLabels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      return `${date.getMonth() + 1}月${date.getDate()}日 ${weekLabels[date.getDay()]}`;
    },
    todayPrimaryText() {
      return this.isMemorialMode ? '写一段回忆' : '记录今天';
    },
    todayQuickActions() {
      if (this.isMemorialMode) {
        return [
          { key: 'miss', label: '写一句想念' },
          { key: 'habit', label: '记一个习惯' },
          { key: 'photo', label: '整理一张照片' },
          { key: 'letter', label: '写给它的话' }
        ];
      }
      return [
        { key: 'food', label: '饮食' },
        { key: 'mood', label: '精神' },
        { key: 'poop', label: '便便' },
        { key: 'weight', label: '体重' }
      ];
    },
    weekStripDays() {
      const labels = ['一', '二', '三', '四', '五', '六', '日'];
      const today = new Date();
      const todayKey = formatDateKey(today);
      const start = new Date(today);
      const day = today.getDay() || 7;
      start.setDate(today.getDate() - day + 1);

      return labels.map((label, index) => {
        const current = new Date(start);
        current.setDate(start.getDate() + index);
        const dateKey = formatDateKey(current);
        const record = this.activePet && this.activePet.id
          ? getDiaryRecord(this.activePet.id, dateKey)
          : null;

        return {
          key: dateKey,
          label,
          isToday: dateKey === todayKey,
          hasRecord: hasDiaryRecord(record)
        };
      });
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
        { key: 'chat', icon: 'chatbubble', title: 'AI 问诊', desc: '整理症状和问题', primary: false },
        { key: 'archive', icon: 'folder-add', title: '查看档案', desc: '身体与习惯', primary: false }
      ];
    },
    recentRecordTitle() {
      if (!hasDiaryRecord(this.todayRecord)) return this.isMemorialMode ? '今天还没有回忆记录' : '今天还没有记录';
      return this.isMemorialMode ? '今天的想念已收好' : '今天已经有记录';
    },
    recentRecordDesc() {
      if (!hasDiaryRecord(this.todayRecord)) return this.isMemorialMode ? '可以从一句想说的话开始。' : '可以从饮食、精神或一个小片段开始。';
      const events = this.todayRecord.events || [];
      if (events.length) return events.slice(0, 2).map(getEventLabel).join('、');
      return getMoodLabel(this.todayRecord.mood);
    },
    lightReminder() {
      if (!this.activePet) {
        return { key: 'archive', title: '先完善一份生命档案', desc: '名字、生日和照护信息会慢慢汇在这里。' };
      }

      if (this.isMemorialMode) {
        const memorialPool = [
          { title: '写下一件今天想起它的小事', desc: '一句话也可以，真实的片段会慢慢组成你们的故事。' },
          { title: '整理一张和它有关的照片', desc: '为照片补一句当时发生的事。' },
          { title: '记录它的一个习惯', desc: '那些熟悉的小动作，也值得被好好留下。' },
          { title: '写一句想对它说的话', desc: '不必完整，先把此刻的想念放下来。' },
          { title: '补充它的性格和小动作', desc: '这些细节会让回忆整理得更真实。' }
        ];
        return { key: 'calendar', ...memorialPool[new Date().getDate() % memorialPool.length] };
      }

      if (!this.profile.weight) {
        return { key: 'archive', title: '可以补充体重', desc: '体重、疫苗和过敏信息会帮助后续照护判断。' };
      }
      if (!this.profile.vaccineDate || !this.profile.dewormDate) {
        return { key: 'archive', title: '补充疫苗 / 驱虫信息', desc: '这些日期会让后续提醒更准确。' };
      }
      if (!this.profile.birthday) {
        return { key: 'archive', title: '完善生日或到家日', desc: '归爪会帮你记住重要日子。' };
      }
      if (!this.activePet.originalPhotoUrl) {
        return { key: 'photo', title: '上传一张近照', desc: '近照能帮助你回看它最近的变化。' };
      }

      const dailyPool = [
        { title: '记录一次便便情况', desc: '颜色、形态和频率，常常能反映身体变化。' },
        { title: '记录今天的精神状态', desc: '一句话也可以，长期看会很有用。' }
      ];
      return { key: 'calendar', ...dailyPool[new Date().getDate() % dailyPool.length] };
    },
    lightInfoCards() {
      if (this.isMemorialMode) {
        return [
          { key: this.lightReminder.key, icon: 'heart', kicker: '轻提醒', title: this.lightReminder.title, desc: this.lightReminder.desc }
        ];
      }
      return [
        { key: this.lightReminder.key, icon: 'info', kicker: '轻提醒', title: this.lightReminder.title, desc: this.lightReminder.desc }
      ];
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
        content: '1. 建立宠物档案\n2. 上传照片，生成电子宠物形象\n3. 记录今天，或者使用 AI 问诊',
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
        this.profile = {};
        this.todayRecord = null;
        this.petStats = { days: 0, moments: 0, chats: 0 };
        return;
      }

      this.petName = activePet.name || '毛孩子';
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
    getHomeHeroAvatar(pet = {}) {
      if (!pet || pet.avatarStatus !== 'ready' || !pet.generatedAvatarUrl) return '';

      const generatedUrl = pet.generatedAvatarUrl;
      const rawPhotoCandidates = [
        pet.originalPhotoUrl,
        pet.avatar,
        pet.avatarUrl,
        pet.imageUrl,
        pet.image,
        pet.photo,
        pet.petImage,
        pet.profileImage,
        pet.petPhoto
      ].filter(path => path && path !== DEFAULT_AVATAR_PLACEHOLDER);

      if (rawPhotoCandidates.includes(generatedUrl)) return '';

      return generatedUrl;
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
      if (key === 'archive') this.openArchive();
    },
    handleInfoCard(key) {
      this.safeVibrate();
      if (key === 'calendar') {
        this.openCalendar();
        return;
      }
      if (key === 'photo') {
        uni.reLaunch({ url: '/pages/welcome/welcome' });
        return;
      }
      this.openArchive();
    },
    handleTodayQuick() {
      this.safeVibrate();
      this.openCalendar();
    },
    openAvatarGenerate() {
      this.safeVibrate();
      uni.navigateTo({ url: '/pages/avatar-generate/avatar-generate' });
    },
    openCalendar() {
      uni.navigateTo({ url: '/pages/calendar/calendar' });
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
  --home-bg-1: #F8F2E8;
  --home-bg-2: #EFE5D5;
  --home-bg-3: #E7EADF;
  --home-glow-1: rgba(232, 188, 128, 0.34);
  --home-glow-2: rgba(176, 190, 154, 0.28);
  --home-card: rgba(255, 252, 246, 0.62);
  --home-card-strong: rgba(255, 252, 246, 0.76);
  --home-text: #2C2924;
  --home-muted: rgba(44, 41, 36, 0.58);
  --home-soft: rgba(87, 74, 58, 0.62);
  --home-accent: #6D5945;
  --home-border: rgba(255, 255, 255, 0.58);
  --home-shadow: rgba(72, 58, 43, 0.11);
  width: 100vw;
  min-height: 100vh;
  position: relative;
  overflow: hidden;
  color: var(--home-text);
  background:
    radial-gradient(circle at 20% 4%, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0) 36%),
    linear-gradient(145deg, var(--home-bg-1) 0%, var(--home-bg-2) 52%, var(--home-bg-3) 100%);
}

.home-page.theme-memorial {
  --home-bg-1: #F3F1ED;
  --home-bg-2: #E5E7EE;
  --home-bg-3: #DDD8E8;
  --home-glow-1: rgba(150, 162, 190, 0.3);
  --home-glow-2: rgba(204, 173, 128, 0.2);
  --home-card: rgba(255, 255, 255, 0.56);
  --home-card-strong: rgba(255, 255, 255, 0.68);
  --home-text: #292B32;
  --home-muted: rgba(41, 43, 50, 0.55);
  --home-soft: rgba(80, 84, 104, 0.62);
  --home-accent: #5F6478;
  --home-border: rgba(255, 255, 255, 0.55);
  --home-shadow: rgba(76, 80, 104, 0.1);
}

.gradient-background {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 18% 12%, var(--home-glow-1) 0%, rgba(255, 255, 255, 0) 38%),
    radial-gradient(circle at 84% 22%, var(--home-glow-2) 0%, rgba(255, 255, 255, 0) 34%);
  animation: gradientBreathe 14s ease-in-out infinite;
}

.home-scroll {
  position: relative;
  width: 100%;
  height: 100vh;
}

.home-shell {
  min-height: 100vh;
  padding: calc(var(--status-bar-height, 0px) + 40rpx) 30rpx calc(154rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  animation: fadeUp 520ms ease both;
}

.home-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 22rpx;
  min-height: 112rpx;
  margin-bottom: 36rpx;
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
}

.top-icon-button {
  width: 70rpx;
  height: 70rpx;
  margin: 0;
  padding: 0;
  border-radius: 50%;
  border: 1rpx solid var(--home-border);
  background: rgba(255, 255, 255, 0.46);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 16rpx 34rpx rgba(66, 55, 43, 0.08);
  transition: transform 160ms ease, opacity 160ms ease;
}

.top-icon-button::after,
.stage-pending-action::after,
.today-primary-action::after,
.action-card::after {
  border: none;
}

.pet-stage-area {
  min-height: 244rpx;
  padding: 4rpx 8rpx 0;
  box-sizing: border-box;
  overflow: visible;
  animation: cardRise 560ms 80ms ease both;
}

.hero-visual {
  position: relative;
  height: 218rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hero-glow {
  position: absolute;
  width: 520rpx;
  height: 190rpx;
  border-radius: 50%;
  background: radial-gradient(circle, var(--home-glow-1) 0%, rgba(255, 255, 255, 0) 72%);
  animation: glowPulse 8.4s ease-in-out infinite;
}

.hero-pedestal {
  position: absolute;
  left: 50%;
  bottom: 10rpx;
  width: 360rpx;
  height: 36rpx;
  border-radius: 50%;
  transform: translateX(-50%);
  background: rgba(61, 50, 39, 0.11);
}

.hero-pet-image {
  position: relative;
  z-index: 2;
  width: 470rpx;
  height: 172rpx;
  object-fit: contain;
  filter: drop-shadow(0 24rpx 34rpx rgba(55, 45, 34, 0.12));
  animation: petFloat 6.4s ease-in-out infinite;
}

.pet-placeholder {
  position: relative;
  z-index: 2;
  width: 260rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: petFloat 6.4s ease-in-out infinite;
}

.placeholder-ears {
  width: 184rpx;
  display: flex;
  justify-content: space-between;
  margin-bottom: -34rpx;
}

.placeholder-ear {
  width: 56rpx;
  height: 78rpx;
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
  width: 150rpx;
  height: 132rpx;
  border-radius: 48% 48% 44% 44%;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.86) 0%, rgba(226, 211, 190, 0.72) 100%);
  box-shadow: inset 0 -16rpx 30rpx rgba(122, 98, 70, 0.08), 0 22rpx 46rpx rgba(93, 75, 53, 0.12);
}

.placeholder-body {
  width: 196rpx;
  height: 96rpx;
  margin-top: -18rpx;
  border-radius: 48% 48% 38% 38%;
  background: linear-gradient(180deg, rgba(245, 238, 226, 0.88) 0%, rgba(209, 187, 158, 0.66) 100%);
  box-shadow: inset 0 18rpx 34rpx rgba(255, 255, 255, 0.32), 0 24rpx 48rpx rgba(93, 75, 53, 0.12);
}

.pet-shadow {
  position: absolute;
  left: 50%;
  bottom: 8rpx;
  width: 300rpx;
  height: 24rpx;
  border-radius: 50%;
  transform: translateX(-50%);
  background: rgba(61, 50, 39, 0.16);
  animation: shadowBreathe 6.4s ease-in-out infinite;
}

.stage-pending-action {
  width: 360rpx;
  height: 52rpx;
  margin: -2rpx auto 0;
  padding: 0 20rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.3);
  border: 1rpx solid rgba(255, 255, 255, 0.42);
  color: var(--home-soft);
  font-size: 20rpx;
  line-height: 52rpx;
  box-shadow: 0 8rpx 22rpx rgba(76, 64, 54, 0.045);
  transition: transform 160ms ease, opacity 160ms ease;
}

.companion-line {
  margin: 18rpx auto 0;
  max-width: 620rpx;
  color: var(--home-text);
  text-align: center;
  font-size: 27rpx;
  font-weight: 560;
  line-height: 1.45;
}

.today-panel {
  margin-top: 24rpx;
  padding: 24rpx 24rpx 22rpx;
  border-radius: 32rpx;
  border: 1rpx solid var(--home-border);
  background: rgba(255, 252, 246, 0.5);
  box-shadow: 0 16rpx 42rpx rgba(72, 58, 43, 0.055);
  transition: transform 160ms ease, opacity 160ms ease;
  animation: cardRise 520ms 110ms ease both;
}

.today-panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
}

.today-kicker {
  display: block;
  color: var(--home-soft);
  font-size: 20rpx;
  line-height: 1.25;
}

.today-date {
  display: block;
  margin-top: 6rpx;
  color: var(--home-muted);
  font-size: 21rpx;
  line-height: 1.25;
}

.today-title {
  display: block;
  margin-top: 7rpx;
  color: var(--home-text);
  font-size: 31rpx;
  font-weight: 650;
  line-height: 1.25;
}

.today-primary-action {
  flex-shrink: 0;
  height: 62rpx;
  margin: 0;
  padding: 0 24rpx;
  border-radius: 999rpx;
  background: var(--home-accent);
  color: #FFFDF8;
  font-size: 23rpx;
  line-height: 62rpx;
  box-shadow: 0 14rpx 32rpx rgba(76, 64, 54, 0.14);
  transition: transform 160ms ease, opacity 160ms ease;
}

.today-quick-row {
  margin-top: 18rpx;
  display: flex;
  gap: 10rpx;
}

.today-quick-chip {
  flex: 1;
  min-width: 0;
  padding: 13rpx 8rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.38);
  border: 1rpx solid rgba(255, 255, 255, 0.44);
  color: var(--home-text);
  font-size: 21rpx;
  line-height: 1.2;
  text-align: center;
  transition: transform 160ms ease, opacity 160ms ease;
}

.week-strip {
  margin-top: 20rpx;
  padding: 14rpx 12rpx;
  border-radius: 24rpx;
  display: flex;
  gap: 8rpx;
  background: rgba(255, 255, 255, 0.25);
  border: 1rpx solid rgba(255, 255, 255, 0.34);
}

.week-item {
  flex: 1;
  min-width: 0;
  height: 58rpx;
  border-radius: 20rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  color: var(--home-muted);
}

.week-label {
  font-size: 19rpx;
  line-height: 1;
}

.week-dot {
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
  background: rgba(44, 41, 36, 0.18);
}

.week-item-today {
  background: rgba(109, 89, 69, 0.1);
  color: var(--home-accent);
  font-weight: 650;
}

.week-item-recorded .week-dot {
  width: 12rpx;
  height: 12rpx;
  background: var(--home-accent);
}

.action-row {
  margin-top: 18rpx;
  display: flex;
  gap: 14rpx;
}

.action-card {
  flex: 1;
  min-width: 0;
  min-height: 108rpx;
  margin: 0;
  padding: 16rpx 13rpx;
  border-radius: 26rpx;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  transition: transform 160ms ease, opacity 160ms ease;
}

.action-card-primary {
  background: linear-gradient(180deg, var(--home-accent) 0%, #514337 100%);
  color: #FFFDF8;
  box-shadow: 0 20rpx 42rpx rgba(78, 64, 49, 0.18);
}

.action-card-secondary {
  border: 1rpx solid var(--home-border);
  background: var(--home-card);
  color: var(--home-text);
  box-shadow: 0 12rpx 30rpx rgba(58, 51, 43, 0.045);
}

.action-icon {
  width: 46rpx;
  height: 46rpx;
  border-radius: 18rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.18);
}

.action-card-secondary .action-icon {
  background: rgba(255, 255, 255, 0.34);
}

.action-title {
  margin-top: 9rpx;
  color: inherit;
  font-size: 24rpx;
  font-weight: 650;
  line-height: 1.24;
}

.action-desc {
  margin-top: 5rpx;
  color: inherit;
  font-size: 19rpx;
  line-height: 1.3;
  opacity: 0.72;
}

.light-info-section {
  margin-top: 16rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.light-info-card {
  min-height: 92rpx;
  padding: 16rpx 20rpx;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.42);
  background: rgba(255, 255, 255, 0.32);
  box-shadow: 0 10rpx 26rpx rgba(58, 51, 43, 0.03);
  animation: cardRise 520ms 150ms ease both;
}

.light-info-icon {
  width: 50rpx;
  height: 50rpx;
  flex-shrink: 0;
  border-radius: 18rpx;
  background: rgba(255, 255, 255, 0.34);
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

.today-panel-active,
.action-card-active {
  transform: scale(0.985);
  opacity: 0.9;
}

.today-quick-chip-active {
  transform: scale(0.97);
  opacity: 0.84;
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
  box-shadow: 0 20rpx 42rpx rgba(82, 86, 111, 0.18);
}

.theme-memorial .action-card-secondary .action-icon,
.theme-memorial .light-info-icon {
  background: rgba(255, 255, 255, 0.28);
}

@media (min-height: 800px) {
  .home-header {
    margin-bottom: 42rpx;
  }

  .pet-stage-area {
    min-height: 292rpx;
  }

  .hero-visual {
    height: 260rpx;
  }

  .companion-line,
  .today-panel {
    margin-top: 28rpx;
  }

  .action-row,
  .light-info-section {
    margin-top: 22rpx;
  }
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
    opacity: 0.7;
    transform: translate3d(-8rpx, -6rpx, 0) scale(0.98);
  }
  50% {
    opacity: 0.95;
    transform: translate3d(16rpx, 12rpx, 0) scale(1.04);
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
