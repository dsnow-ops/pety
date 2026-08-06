<template>
  <view :class="['home-page', themeClass, reduceMotion ? 'reduce-motion' : '']">
    <scroll-view scroll-y class="home-scroll">
      <view class="home-shell">
        <view class="home-header">
          <view class="header-copy">
            <view class="mode-line">
              <view class="mode-dot"></view>
              <text class="header-kicker">{{ headerKicker }}</text>
            </view>
            <text class="pet-name">{{ petName }}</text>
          </view>
          <view class="header-actions">
            <button class="top-icon-button" hover-class="top-icon-button-active" aria-label="查看宠物档案" @click="handleInfoCard('reminder')">
              <uni-icons type="info" size="19" :color="headerIconColor"></uni-icons>
            </button>
            <button class="top-icon-button" hover-class="top-icon-button-active" aria-label="更多操作" @click="showMenu">
              <uni-icons type="more-filled" size="21" :color="headerIconColor"></uni-icons>
            </button>
          </view>
        </view>

        <view class="pet-stage-area">
          <view class="hero-visual">
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
          </view>

          <button
            v-if="!hasGeneratedAvatar"
            class="stage-pending-action"
            hover-class="light-button-active"
            @click="openAvatarGenerate"
          >
            <text>电子宠物形象尚未准备好 · 继续</text>
          </button>
        </view>

        <view class="companion-line">
          <text>{{ companionLine }}</text>
        </view>

        <view class="today-panel">
          <view class="today-panel-head">
            <view class="today-copy">
              <text class="today-date">{{ todayDateText }}</text>
              <text class="today-title">{{ todayPanelTitle }}</text>
            </view>
            <view :class="['today-status-dot', hasTodayRecord ? 'today-status-dot-active' : '']"></view>
          </view>

          <button class="today-primary-action" hover-class="primary-button-active" @click="handleCoreAction('journal')">
            <uni-icons type="compose" size="20" color="#FFFDF8"></uni-icons>
            <text>{{ todayPrimaryText }}</text>
          </button>
        </view>

        <view class="home-week">
          <view class="home-week-head">
            <button class="week-arrow" hover-class="week-arrow-active" @click="changeHomeWeek(-1)">
              <uni-icons type="left" size="16" :color="headerIconColor"></uni-icons>
            </button>
            <button class="week-title-button" hover-class="week-title-active" @click="openCalendar">
              <text class="week-title">{{ homeWeekTitle }}</text>
              <text class="week-view-all">查看整月</text>
            </button>
            <button class="week-arrow" hover-class="week-arrow-active" @click="changeHomeWeek(1)">
              <uni-icons type="right" size="16" :color="headerIconColor"></uni-icons>
            </button>
          </view>
          <view class="home-week-grid">
            <view
              v-for="item in homeWeekDays"
              :key="item.dateKey"
              :class="[
                'home-week-day',
                item.isToday ? 'home-week-day-today' : '',
                item.dateKey === selectedHomeDateKey ? 'home-week-day-selected' : '',
                item.hasRecord ? 'home-week-day-recorded' : ''
              ]"
              @click="selectHomeDate(item)"
            >
              <text class="home-week-label">{{ item.weekday }}</text>
              <text class="home-week-solar">{{ item.solar }}</text>
              <text class="home-week-lunar">{{ item.lunar }}</text>
              <view v-if="item.hasRecord" class="home-week-record-dot"></view>
            </view>
          </view>
        </view>

        <view class="secondary-actions">
          <button
            v-for="item in secondaryActions"
            :key="item.key"
            class="secondary-action"
            hover-class="secondary-action-active"
            @click="handleCoreAction(item.key)"
          >
            <view class="secondary-action-icon">
              <uni-icons :type="item.icon" size="20" :color="headerIconColor"></uni-icons>
            </view>
            <view class="secondary-action-copy">
              <text class="secondary-action-title">{{ item.title }}</text>
              <text class="secondary-action-desc">{{ item.desc }}</text>
            </view>
            <uni-icons type="right" size="16" color="#9A948C"></uni-icons>
          </button>
        </view>

        <view class="recent-info" hover-class="recent-info-active" @click="handleInfoCard(recentInfo.key)">
          <view class="recent-info-icon">
            <uni-icons :type="recentInfo.icon" size="19" :color="headerIconColor"></uni-icons>
          </view>
          <view class="recent-info-copy">
            <text class="recent-info-title">{{ recentInfo.title }}</text>
            <text class="recent-info-desc">{{ recentInfo.desc }}</text>
          </view>
          <uni-icons type="right" size="15" color="#9A948C"></uni-icons>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import { getActivePet } from '../../common/pet-store.js';
import { formatDateKey, getDiaryMap, getDiaryRecord, getEventLabel, getMoodLabel, hasDiaryRecord } from '../../common/diary-store.js';
import { getDailyHomeCopy } from '../../common/home-daily-copy.js';
import { getLocalCalendarDate, getLocalWeekDates } from '../../common/lunar-calendar.js';
import { getPetProfile } from '../../common/profile-store.js';
import { getPetRelationshipStage, getRelationshipThemeClass, setRelationshipTabBar } from '../../common/relationship-config.js';
import { isReduceMotionEnabled } from '../../common/haptics.js';
import { scheduleMemorialPersonaIntro } from '../../common/memorial-persona.js';

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
      diaryMap: {},
      homeWeekDate: new Date(),
      selectedHomeDateKey: formatDateKey(),
      reduceMotion: isReduceMotionEnabled(),
      personaIntroTimer: null,
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
    themeClass() {
      return getRelationshipThemeClass(this.activeRelationshipStage);
    },
    headerKicker() {
      return this.isMemorialMode ? '温柔纪念' : '正在陪伴';
    },
    headerIconColor() {
      return this.isMemorialMode ? '#596071' : '#59604F';
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
      if (!this.activePet) return '建立档案后，归爪会把照片、记录和故事慢慢收好。';
      return getDailyHomeCopy({
        petId: this.activePet.id,
        petName: this.petName,
        relationshipStage: this.activeRelationshipStage,
        date: new Date()
      });
    },
    todayPanelTitle() {
      if (!this.activePet) return '先建立档案，今天就有地方安放。';
      if (this.isMemorialMode) return hasDiaryRecord(this.todayRecord) ? '今天的想念已经收好' : '今天还没有写下想念';
      return hasDiaryRecord(this.todayRecord) ? '今天已记录' : '今天还没有记录';
    },
    hasTodayRecord() {
      return hasDiaryRecord(this.todayRecord);
    },
    todayDateText() {
      const date = new Date();
      const weekLabels = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
      return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 · ${weekLabels[date.getDay()]}`;
    },
    todayPrimaryText() {
      return this.isMemorialMode ? '写下今天的想念' : '记录今天';
    },
    homeWeekTitle() {
      const first = this.homeWeekDays[0];
      const last = this.homeWeekDays[6];
      if (!first || !last) return '';
      if (first.year === last.year && first.month === last.month) {
        return `${first.year}年${first.month}月`;
      }
      if (first.year === last.year) return `${first.year}年${first.month}月 - ${last.month}月`;
      return `${first.year}年${first.month}月 - ${last.year}年${last.month}月`;
    },
    homeWeekDays() {
      const todayKey = formatDateKey();
      return getLocalWeekDates(this.homeWeekDate).map((date, index) => {
        const dateKey = formatDateKey(date);
        const calendarDate = getLocalCalendarDate(date);
        return {
          dateKey,
          year: date.getFullYear(),
          month: date.getMonth() + 1,
          weekday: `周${'一二三四五六日'[index]}`,
          solar: calendarDate.monthDayLabel,
          lunar: calendarDate.lunar ? calendarDate.lunar.shortLabel : '',
          isToday: dateKey === todayKey,
          hasRecord: hasDiaryRecord(this.diaryMap[dateKey])
        };
      });
    },
    secondaryActions() {
      if (this.isMemorialMode) {
        return [
          { key: 'chat', icon: 'chatbubble', title: '和他/她说说话', desc: '把今天想说的慢慢告诉他/她' },
          { key: 'archive', icon: 'folder-add', title: '查看档案', desc: '回看真实留下的故事和资料' }
        ];
      }
      return [
        { key: 'chat', icon: 'chatbubble', title: 'AI 问诊', desc: '整理症状、观察点和就医问题' },
        { key: 'archive', icon: 'folder-add', title: '查看档案', desc: '补充身体、习惯和关系信息' }
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
          { title: '写下一件今天想起他/她的小事', desc: '一句话也可以，真实的片段会慢慢组成你们的故事。' },
          { title: '整理一张和他/她有关的照片', desc: '为照片补一句当时发生的事。' },
          { title: '记录他/她的一个习惯', desc: '那些熟悉的小动作，也值得被好好留下。' },
          { title: '写一句想对他/她说的话', desc: '不必完整，先把此刻的想念放下来。' },
          { title: '补充他/她的性格和小动作', desc: '这些细节会让回忆整理得更真实。' }
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
    recentInfo() {
      if (hasDiaryRecord(this.todayRecord)) {
        return {
          key: 'calendar',
          icon: this.isMemorialMode ? 'heart' : 'calendar',
          title: this.recentRecordTitle,
          desc: this.recentRecordDesc
        };
      }
      return {
        key: this.lightReminder.key,
        icon: this.isMemorialMode ? 'heart' : 'info',
        title: this.lightReminder.title,
        desc: this.lightReminder.desc
      };
    }
  },
  onShow() {
    this.loadHomeData();
    this.schedulePersonaIntro();
    this.$nextTick(() => {
      this.maybeShowOnboardingGuide();
    });
  },
  onHide() {
    this.clearPersonaIntroTimer();
  },
  onUnload() {
    this.clearPersonaIntroTimer();
  },
  methods: {
    clearPersonaIntroTimer() {
      if (!this.personaIntroTimer) return;
      clearTimeout(this.personaIntroTimer);
      this.personaIntroTimer = null;
    },
    schedulePersonaIntro() {
      this.clearPersonaIntroTimer();
      if (!this.activePet) return;
      const petId = this.activePet.id;
      const stage = this.activeRelationshipStage;
      this.personaIntroTimer = scheduleMemorialPersonaIntro({
        petId,
        relationshipStage: stage,
        delay: 420,
        isStillCurrent: () => Boolean(
          this.activePet &&
          this.activePet.id === petId &&
          this.activeRelationshipStage === stage
        ),
        onStart: () => {
          uni.navigateTo({ url: `/pages/memorial-persona/memorial-persona?petId=${encodeURIComponent(petId)}` });
        }
      });
    },
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
        this.diaryMap = {};
        this.petStats = { days: 0, moments: 0, chats: 0 };
        return;
      }

      this.petName = activePet.name || '毛孩子';
      this.profile = getPetProfile(activePet.id);
      this.todayRecord = getDiaryRecord(activePet.id, formatDateKey());
      this.diaryMap = getDiaryMap(activePet.id);
      this.reduceMotion = isReduceMotionEnabled();
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
    openAvatarGenerate() {
      uni.navigateTo({ url: '/pages/avatar-generate/avatar-generate' });
    },
    openCalendar() {
      uni.navigateTo({ url: '/pages/calendar/calendar' });
    },
    openArchive() {
      uni.navigateTo({ url: '/pages/archive/archive' });
    },
    changeHomeWeek(step) {
      const date = new Date(this.homeWeekDate);
      date.setDate(date.getDate() + (step * 7));
      this.homeWeekDate = date;
    },
    selectHomeDate(item) {
      this.selectedHomeDateKey = item.dateKey;
      if (item.hasRecord) {
        uni.navigateTo({ url: `/pages/calendar/calendar?date=${item.dateKey}` });
      }
    }
  }
};
</script>

<style scoped>
.home-scroll {
  position: relative;
  width: 100%;
  height: 100vh;
}

.home-shell {
  min-height: 100vh;
  padding: calc(var(--status-bar-height, 0px) + 40rpx) 30rpx calc(154rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  animation: fadeUp 360ms ease both;
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
}

.pet-placeholder {
  position: relative;
  z-index: 2;
  width: 260rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.placeholder-ears {
  width: 184rpx;
  display: flex;
  justify-content: space-between;
  margin-bottom: 0;
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
  margin-top: 0;
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
}

.stage-pending-action {
  width: 360rpx;
  height: 52rpx;
  margin: 0 auto;
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

/* Home UI V1: one pet, one relationship moment, one primary action. */
.home-page {
  --home-stage-fill: #E7E9DF;
  --home-placeholder: #C9CEBF;
  --home-placeholder-light: #E9EBE3;
  --home-pedestal: rgba(76, 82, 68, 0.14);
  --home-action: var(--pety-accent, #73806C);
  --home-warm: #A66F52;
  width: 100%;
  background: var(--pety-page-bg, #F5F2EC);
  color: var(--pety-text, #2F2A24);
  overflow-x: hidden;
  overflow-y: hidden;
}

.home-page.theme-memorial {
  --home-stage-fill: #E4E6EC;
  --home-placeholder: #C7CAD5;
  --home-placeholder-light: #ECECF0;
  --home-pedestal: rgba(79, 84, 104, 0.14);
  --home-action: var(--pety-primary, #62677A);
  --home-warm: var(--pety-accent, #8A7968);
}

.home-scroll {
  width: 100%;
  height: 100vh;
}

.home-shell {
  min-height: 100vh;
  padding:
    calc(var(--status-bar-height, 0px) + 24rpx)
    var(--pety-page-gutter, 32rpx)
    calc(148rpx + env(safe-area-inset-bottom));
  animation: homeV1Enter 420ms ease both;
}

.home-header {
  min-height: 104rpx;
  margin-bottom: 28rpx;
  gap: 16rpx;
  align-items: flex-start;
}

.header-copy {
  flex: 1;
  overflow: hidden;
}

.header-kicker {
  color: var(--pety-primary, #6D5945);
  font-size: 22rpx;
  font-weight: 500;
  line-height: 30rpx;
}

.mode-line {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.mode-dot {
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  background: var(--home-warm);
  flex-shrink: 0;
}

.pet-name {
  display: block;
  max-width: 100%;
  margin-top: 4rpx;
  color: var(--pety-text, #2F2A24);
  font-size: 48rpx;
  font-weight: 600;
  line-height: 64rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-actions {
  gap: 8rpx;
}

.top-icon-button {
  width: 88rpx;
  height: 88rpx;
  border: none;
  background: transparent;
  box-shadow: none;
}

.top-icon-button::after,
.stage-pending-action::after,
.today-primary-action::after,
.secondary-action::after {
  border: none;
}

.pet-stage-area {
  min-height: 314rpx;
  padding: 0;
  animation: none;
}

.hero-visual {
  height: 286rpx;
  animation: none;
}

.hero-pedestal {
  bottom: 12rpx;
  width: 390rpx;
  height: 30rpx;
  background: var(--home-pedestal);
  filter: none;
}

.hero-pet-image {
  width: 100%;
  max-width: 520rpx;
  height: 286rpx;
  object-fit: contain;
  filter: drop-shadow(0 18rpx 22rpx rgba(47, 46, 39, 0.12));
  animation: none;
}

.pet-placeholder {
  position: relative;
  width: 250rpx;
  height: 228rpx;
  display: block;
  animation: none;
}

.placeholder-ears {
  position: absolute;
  top: 8rpx;
  left: 50%;
  width: 170rpx;
  margin: 0;
  transform: translateX(-50%);
}

.placeholder-ear {
  width: 52rpx;
  height: 72rpx;
  border-radius: 44rpx 44rpx 20rpx 20rpx;
  background: var(--home-placeholder);
}

.placeholder-head {
  position: absolute;
  top: 44rpx;
  left: 50%;
  width: 144rpx;
  height: 126rpx;
  transform: translateX(-50%);
  background: var(--home-placeholder-light);
  box-shadow: inset 0 -12rpx 0 rgba(0, 0, 0, 0.025);
}

.placeholder-body {
  position: absolute;
  left: 50%;
  bottom: 0;
  width: 190rpx;
  height: 92rpx;
  margin: 0;
  transform: translateX(-50%);
  background: var(--home-placeholder);
  box-shadow: none;
}

.stage-pending-action {
  width: auto;
  min-width: 320rpx;
  height: 88rpx;
  margin: 0 auto;
  padding: 0 28rpx;
  border: none;
  background: transparent;
  color: var(--pety-text-secondary, #786F64);
  font-size: 22rpx;
  line-height: 88rpx;
  box-shadow: none;
}

.companion-line {
  display: -webkit-box;
  max-width: 610rpx;
  margin: 24rpx auto 0;
  color: var(--pety-text, #2F2A24);
  font-size: 27rpx;
  font-weight: 500;
  line-height: 42rpx;
  text-align: center;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.today-panel {
  margin-top: 40rpx;
  padding: 30rpx 32rpx 32rpx;
  border: 1rpx solid var(--pety-rule, #E4DED4);
  border-radius: 16rpx;
  background: var(--pety-surface, #FCFAF6);
  box-shadow: var(--pety-shadow, 0 14rpx 38rpx rgba(58, 49, 39, 0.08));
  animation: none;
}

.today-panel-head {
  align-items: center;
}

.today-copy {
  flex: 1;
  min-width: 0;
}

.today-date {
  margin: 0;
  color: var(--pety-text-secondary, #786F64);
  font-size: 22rpx;
  font-variant-numeric: tabular-nums;
  line-height: 30rpx;
}

.today-title {
  margin-top: 8rpx;
  color: var(--pety-text, #2F2A24);
  font-size: 30rpx;
  font-weight: 600;
  line-height: 42rpx;
}

.today-status-dot {
  width: 16rpx;
  height: 16rpx;
  margin-left: 18rpx;
  border: 2rpx solid var(--pety-rule, #E4DED4);
  border-radius: 50%;
  background: transparent;
  flex-shrink: 0;
}

.today-status-dot-active {
  border-color: var(--home-action);
  background: var(--home-action);
}

.today-primary-action {
  width: 100%;
  height: var(--pety-button-height, 88rpx);
  margin: 26rpx 0 0;
  padding: 0 32rpx;
  border-radius: 16rpx;
  background: var(--home-action);
  color: #FFFDF8;
  font-size: 27rpx;
  font-weight: 600;
  line-height: var(--pety-button-height, 88rpx);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  box-shadow: none;
  transition: transform 100ms ease, opacity 100ms ease;
}

.secondary-actions {
  margin-top: 24rpx;
  border-top: 1rpx solid var(--pety-rule, #E4DED4);
  border-bottom: 1rpx solid var(--pety-rule, #E4DED4);
}

.secondary-action {
  width: 100%;
  min-height: 96rpx;
  margin: 0;
  padding: 16rpx 4rpx;
  border-radius: 0;
  border-bottom: 1rpx solid var(--pety-rule, #E4DED4);
  background: transparent;
  color: var(--pety-text, #2F2A24);
  display: flex;
  align-items: center;
  text-align: left;
  transition: transform 100ms ease, opacity 100ms ease;
}

.secondary-action:last-child {
  border-bottom: none;
}

.secondary-action-icon {
  width: 64rpx;
  height: 64rpx;
  margin-right: 16rpx;
  border-radius: 16rpx;
  background: var(--pety-primary-soft, #EAE1D6);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.secondary-action-copy {
  flex: 1;
  min-width: 0;
  padding-right: 16rpx;
}

.secondary-action-title {
  display: block;
  color: var(--pety-text, #2F2A24);
  font-size: 27rpx;
  font-weight: 500;
  line-height: 38rpx;
}

.secondary-action-desc {
  display: block;
  margin-top: 2rpx;
  color: var(--pety-text-secondary, #786F64);
  font-size: 21rpx;
  line-height: 30rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-info {
  min-height: 96rpx;
  margin-top: 24rpx;
  padding: 18rpx 20rpx;
  border-radius: 16rpx;
  background: var(--pety-surface-muted, #EEE9E0);
  display: flex;
  align-items: center;
  transition: transform 100ms ease, opacity 100ms ease;
}

.recent-info-icon {
  width: 52rpx;
  height: 52rpx;
  margin-right: 16rpx;
  border-radius: 16rpx;
  background: var(--pety-surface, #FCFAF6);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.recent-info-copy {
  flex: 1;
  min-width: 0;
  padding-right: 14rpx;
}

.recent-info-title {
  display: block;
  color: var(--pety-text, #2F2A24);
  font-size: 25rpx;
  font-weight: 500;
  line-height: 36rpx;
}

.recent-info-desc {
  display: block;
  margin-top: 2rpx;
  color: var(--pety-text-secondary, #786F64);
  font-size: 21rpx;
  line-height: 30rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.top-icon-button-active {
  transform: scale(0.96);
  opacity: 0.72;
}

.primary-button-active {
  transform: scale(0.98);
  opacity: 0.9;
}

.light-button-active,
.secondary-action-active,
.recent-info-active {
  transform: scale(0.99);
  opacity: 0.78;
}

.home-page.theme-memorial .placeholder-ear,
.home-page.theme-memorial .placeholder-head,
.home-page.theme-memorial .placeholder-body {
  background: var(--home-placeholder);
}

@media (max-width: 370px) {
  .home-shell {
    padding-right: 24rpx;
    padding-left: 24rpx;
  }

  .pet-name {
    font-size: 44rpx;
  }

  .hero-pet-image {
    max-width: 470rpx;
  }

  .today-panel {
    padding-right: 24rpx;
    padding-left: 24rpx;
  }

  .secondary-action-desc,
  .recent-info-desc {
    font-size: 20rpx;
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-shell,
  .hero-pet-image,
  .pet-placeholder,
  .today-panel,
  .recent-info {
    animation: none;
  }
}

.reduce-motion .home-shell {
  animation: none;
}

@keyframes homeV1Enter {
  from {
    opacity: 0;
    transform: translateY(10rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.home-week {
  margin-top: 18rpx;
  padding: 18rpx 12rpx 16rpx;
  border-top: 1rpx solid var(--pety-rule, #E4DED4);
  border-bottom: 1rpx solid var(--pety-rule, #E4DED4);
}

.home-week-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.week-arrow,
.week-title-button {
  padding: 0;
  margin: 0;
  background: transparent;
}

.week-arrow::after,
.week-title-button::after {
  border: none;
}

.week-arrow {
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.week-title-button {
  min-width: 220rpx;
  text-align: center;
}

.week-title,
.week-view-all {
  display: block;
}

.week-title {
  color: var(--pety-text, #2F2A24);
  font-size: 25rpx;
  font-weight: 600;
}

.week-view-all {
  margin-top: 2rpx;
  color: var(--pety-text-secondary, #786F64);
  font-size: 18rpx;
}

.home-week-grid {
  display: flex;
  width: 100%;
}

.home-week-day {
  position: relative;
  width: 14.285%;
  min-width: 0;
  height: 112rpx;
  padding: 9rpx 2rpx 12rpx;
  border: 1rpx solid transparent;
  border-radius: 14rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.home-week-label,
.home-week-solar,
.home-week-lunar {
  width: 100%;
  text-align: center;
  white-space: nowrap;
}

.home-week-label {
  color: var(--pety-text-secondary, #786F64);
  font-size: 17rpx;
}

.home-week-solar {
  margin-top: 5rpx;
  color: var(--pety-text, #2F2A24);
  font-size: 21rpx;
  font-weight: 600;
}

.home-week-lunar {
  margin-top: 4rpx;
  color: var(--pety-text-tertiary, #9C948A);
  font-size: 16rpx;
}

.home-week-day-selected {
  background: var(--pety-primary-soft, #EAE1D6);
}

.home-week-day-today {
  border-color: var(--pety-primary, #6D5945);
}

.home-week-record-dot {
  position: absolute;
  bottom: 5rpx;
  width: 7rpx;
  height: 7rpx;
  border-radius: 50%;
  background: var(--pety-primary, #6D5945);
}

.week-arrow-active,
.week-title-active,
.home-week-day:active {
  opacity: 0.7;
}

@media (max-width: 370px) {
  .home-week {
    padding-right: 4rpx;
    padding-left: 4rpx;
  }

  .home-week-day {
    height: 106rpx;
  }

  .home-week-label,
  .home-week-lunar {
    font-size: 15rpx;
  }

  .home-week-solar {
    font-size: 19rpx;
  }
}
</style>
