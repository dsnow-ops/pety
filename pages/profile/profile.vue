<template>
  <view :class="['profile-page', themeClass, reduceMotion ? 'reduce-motion' : '']">
    <scroll-view scroll-y class="profile-scroll">
      <view class="profile-header">
        <view>
          <text class="page-kicker">归爪 Lumière Pet</text>
          <text class="page-title">我的归爪</text>
        </view>
        <button class="icon-button" hover-class="icon-button-hover" @click="editActivePet">
          <uni-icons type="compose" size="20" color="#4A443D"></uni-icons>
        </button>
      </view>

      <view v-if="activePet" class="relationship-surface" hover-class="surface-hover" @click="openArchive">
        <image :src="activePetAvatar" class="active-avatar" mode="aspectFill" @click.stop="openAvatarArchive" @error="handleActiveAvatarError"></image>
        <view class="relationship-copy">
          <text class="relationship-mode">{{ activeModeText }}</text>
          <text class="active-name">{{ activePet.name || '我的宝贝' }}</text>
          <text class="relationship-label">{{ ownerRelationSummary }}</text>
          <text class="active-desc">{{ activePetDesc }}</text>
        </view>
        <uni-icons type="right" size="17" color="#9B948B"></uni-icons>
      </view>

      <view v-else class="relationship-surface empty-relationship" hover-class="surface-hover" @click="addPet">
        <view class="empty-mark">归</view>
        <view class="relationship-copy">
          <text class="relationship-mode">本地陪伴空间</text>
          <text class="active-name">还没有宠物档案</text>
          <text class="active-desc">从名字和一张照片开始</text>
        </view>
        <uni-icons type="right" size="17" color="#9B948B"></uni-icons>
      </view>

      <view class="section-block">
        <view class="section-head">
          <view>
            <text class="section-title">宠物管理</text>
            <text class="section-meta">{{ membershipText }}</text>
          </view>
          <button class="section-action" hover-class="section-action-hover" @click="addPet">
            <uni-icons type="plus" size="15" color="#6D5945"></uni-icons>
            <text>添加</text>
          </button>
        </view>
        <scroll-view v-if="petList.length" scroll-x class="pet-strip">
          <view
            v-for="pet in petList"
            :key="pet.id"
            :class="['pet-chip', pet.id === activePetId ? 'pet-chip-active' : '']"
            @click="selectPet(pet)"
          >
            <button class="pet-delete" hover-class="pet-delete-hover" @click.stop="confirmDeletePet(pet)">
              <uni-icons type="closeempty" size="14" :color="pet.id === activePetId ? '#FFFFFF' : '#8C7557'"></uni-icons>
            </button>
            <image :src="petAvatar(pet)" class="pet-chip-img" mode="aspectFill"></image>
            <text class="pet-chip-name">{{ pet.name }}</text>
            <text class="pet-chip-status">{{ statusLabel(pet.relationshipStage || pet.status) }}</text>
          </view>
        </scroll-view>
      </view>

      <view class="stats-strip">
        <view class="stat-item" hover-class="stat-item-hover" @click="openStats('memory')">
          <text class="stat-num">{{ memoryCount }}</text>
          <text class="stat-label">记录</text>
        </view>
        <view class="stat-divider"></view>
        <view class="stat-item" hover-class="stat-item-hover" @click="openStats('events')">
          <text class="stat-num">{{ eventCount }}</text>
          <text class="stat-label">事件</text>
        </view>
        <view class="stat-divider"></view>
        <view class="stat-item" hover-class="stat-item-hover" @click="openStats('chat')">
          <text class="stat-num">{{ chatCount }}</text>
          <text class="stat-label">对话</text>
        </view>
      </view>

      <view class="section-block">
        <text class="section-title section-label">账号与备份</text>
        <view class="group-list">
          <view class="account-row">
            <view class="menu-copy">
              <text class="menu-title">{{ authStatusText }}</text>
              <text class="menu-desc">{{ accountDesc }}</text>
              <text class="account-note">{{ remotePlanText }}</text>
            </view>
            <view class="account-actions">
              <button class="account-action" hover-class="account-action-hover" @click="handleAccountAction">{{ accountActionText }}</button>
              <button v-if="userProfile.loggedIn" class="account-action account-action-light" hover-class="account-action-hover" @click="handleLogout">退出</button>
            </view>
          </view>
        </view>
      </view>

      <view class="section-block">
        <text class="section-title section-label">宠物功能</text>
        <view class="group-list">
          <view class="menu-item" hover-class="menu-item-hover" @click="openArchive">
            <view class="menu-icon"><uni-icons type="folder-add" size="21" color="#4A443D"></uni-icons></view>
            <view class="menu-copy">
              <text class="menu-title">宠物生命档案</text>
              <text class="menu-desc">关系、健康背景、习惯与形象</text>
            </view>
            <uni-icons type="right" size="16" color="#A09A92"></uni-icons>
          </view>
          <view class="menu-item" hover-class="menu-item-hover" @click="openCalendar">
            <view class="menu-icon"><uni-icons type="calendar" size="21" color="#4A443D"></uni-icons></view>
            <view class="menu-copy">
              <text class="menu-title">陪伴记录</text>
              <text class="menu-desc">查看日历、状态和手写记录</text>
            </view>
            <uni-icons type="right" size="16" color="#A09A92"></uni-icons>
          </view>
          <view class="menu-item" hover-class="menu-item-hover" @click="comingSoon">
            <view class="menu-icon"><uni-icons type="heart" size="21" color="#4A443D"></uni-icons></view>
            <view class="menu-copy">
              <text class="menu-title">回忆纪念册</text>
              <text class="menu-desc">照片与文字整理能力尚未接入</text>
            </view>
            <uni-icons type="right" size="16" color="#A09A92"></uni-icons>
          </view>
        </view>
      </view>

      <view class="section-block">
        <text class="section-title section-label">设置与帮助</text>
        <view class="group-list">
          <view class="menu-item" hover-class="menu-item-hover" @click="openSettings">
            <view class="menu-icon"><uni-icons type="gear" size="21" color="#4A443D"></uni-icons></view>
            <view class="menu-copy">
              <text class="menu-title">设置</text>
              <text class="menu-desc">账号、显示、数据与归爪服务</text>
            </view>
            <uni-icons type="right" size="16" color="#A09A92"></uni-icons>
          </view>
          <view class="menu-item" hover-class="menu-item-hover" @click="openFeedback">
            <view class="menu-icon"><uni-icons type="email" size="21" color="#4A443D"></uni-icons></view>
            <view class="menu-copy">
              <text class="menu-title">留言信箱</text>
              <text class="menu-desc">建议、问题和想告诉归爪的话</text>
            </view>
            <uni-icons type="right" size="16" color="#A09A92"></uni-icons>
          </view>
        </view>
      </view>

      <view class="section-block membership-block">
        <view class="group-list">
          <view class="menu-item" hover-class="menu-item-hover" @click="openMembership">
            <view class="menu-icon"><uni-icons type="medal" size="21" color="#4A443D"></uni-icons></view>
            <view class="menu-copy">
              <text class="menu-title">会员与权益</text>
              <text class="menu-desc">查看当前宠物数量与 AI 问诊额度规则</text>
            </view>
            <uni-icons type="right" size="16" color="#A09A92"></uni-icons>
          </view>
        </view>
      </view>

      <text class="profile-footer">归爪 Lumière Pet · 当前以本地陪伴体验为主</text>
    </scroll-view>
  </view>
</template>

<script>
import { getActivePet, getPetList, removePet, setActivePet } from '../../common/pet-store.js';
import { canCreateAnotherPet } from '../../common/pet-creation-access.js';
import {
  getOwnerRelationLabel,
  getPetRelationshipStage,
  getRelationshipConfig,
  getRelationshipThemeClass,
  setRelationshipTabBar
} from '../../common/relationship-config.js';
import { clearUserCache, getCurrentUser, refreshUserProfile } from '../../common/auth-store.js';
import { logoutUniIdAccount } from '../../common/auth-session.js';
import { getAvatarDisplayImage, getProfilePetAvatar } from '../../common/pet-avatar-generator.js';
import { isReduceMotionEnabled, lightHaptic } from '../../common/haptics.js';

const UNI_ID_LOGIN_PAGE = '/uni_modules/uni-id-pages/pages/login/login-withpwd';

export default {
  data() {
    return {
      activePetId: null,
      activePet: null,
      petList: [],
      isPlusUser: false,
      userProfile: getCurrentUser(),
      authLoading: false,
      memoryCount: 0,
      eventCount: 0,
      chatCount: 0,
      activeAvatarFailed: false,
      reduceMotion: isReduceMotionEnabled()
    };
  },
  computed: {
    relationshipStage() {
      return getPetRelationshipStage(this.activePet);
    },
    themeClass() {
      return getRelationshipThemeClass(this.relationshipStage);
    },
    activePetAvatar() {
      return this.activeAvatarFailed ? '/static/pet.png' : getProfilePetAvatar(this.activePet || {});
    },
    activeModeText() {
      return this.relationshipStage === 'deceased' ? '温柔纪念' : '正在陪伴';
    },
    ownerRelationSummary() {
      const relation = getOwnerRelationLabel(this.activePet);
      return relation ? `你是 ${this.activePet.name} 的${relation}` : '你们的关系还没有设置';
    },
    activePetDesc() {
      if (!this.activePet) return '';
      return getRelationshipConfig(this.relationshipStage).profileDesc;
    },
    membershipText() {
      if (this.isPlusUser) return `${this.petList.length} 位 · 会员不限数量`;
      return `${this.petList.length}/1 · 普通用户`;
    },
    authStatusText() {
      if (this.authLoading) return '正在刷新账号状态';
      return this.userProfile.loggedIn ? '已登录' : '游客模式';
    },
    maskedUserId() {
      const userId = this.userProfile.userId || '';
      if (!userId) return '';
      if (userId.length <= 8) return userId;
      return `${userId.slice(0, 4)}...${userId.slice(-4)}`;
    },
    accountDesc() {
      if (this.userProfile.loggedIn) return `UID: ${this.maskedUserId}`;
      return '登录后可验证云端账号，本地数据仍保存在当前设备';
    },
    remotePlanText() {
      if (!this.userProfile.loggedIn) return '当前为本地体验';
      return this.isPlusUser ? '会员状态已记录，自动云备份尚未接入' : '账号状态已验证，自动云备份尚未接入';
    },
    accountActionText() {
      if (this.authLoading) return '刷新中';
      return this.userProfile.loggedIn ? '刷新状态' : '登录';
    }
  },
  onLoad() {
    this.loginSuccessHandler = () => {
      this.loadUserProfile();
    };
    this.logoutHandler = () => {
      this.userProfile = clearUserCache();
      this.isPlusUser = false;
    };
    uni.$on('uni-id-pages-login-success', this.loginSuccessHandler);
    uni.$on('uni-id-pages-logout', this.logoutHandler);
  },
  onUnload() {
    if (this.loginSuccessHandler) {
      uni.$off('uni-id-pages-login-success', this.loginSuccessHandler);
    }
    if (this.logoutHandler) {
      uni.$off('uni-id-pages-logout', this.logoutHandler);
    }
  },
  onShow() {
    this.loadProfile();
    this.loadUserProfile();
  },
  methods: {
    loadProfile() {
      this.petList = getPetList();
      const cachedUser = getCurrentUser();
      this.userProfile = cachedUser;
      this.isPlusUser = cachedUser.loggedIn && ['plus', 'pro'].includes(cachedUser.plan);
      const activePet = getActivePet();
      this.activePet = activePet;
      this.activePetId = activePet ? activePet.id : null;
      this.activeAvatarFailed = false;
      this.reduceMotion = isReduceMotionEnabled();
      setRelationshipTabBar(activePet && activePet.status);
      this.calculateStats();
    },
    async loadUserProfile() {
      this.authLoading = true;
      const profile = await refreshUserProfile();
      this.userProfile = profile;
      this.isPlusUser = profile.loggedIn && ['plus', 'pro'].includes(profile.plan);
      this.authLoading = false;
    },
    handleAccountAction() {
      if (this.authLoading) return;

      if (this.userProfile.loggedIn) {
        this.loadUserProfile();
        return;
      }

      uni.navigateTo({
        url: UNI_ID_LOGIN_PAGE,
        fail: () => {
          uni.showModal({
            title: '登录页暂不可用',
            content: '请确认 uni-id-pages 登录页已注册，并已上传 uni-id-co 与 uni-id-common。',
            confirmText: '知道了',
            showCancel: false,
            confirmColor: '#8C7557'
          });
        }
      });
    },
    async handleLogout() {
      if (this.authLoading) return;
      this.authLoading = true;
      const guestProfile = await logoutUniIdAccount();
      this.userProfile = guestProfile;
      this.isPlusUser = false;
      this.authLoading = false;
      uni.showToast({ title: '已退出账号，本地记录仍在。', icon: 'none' });
    },
    selectPet(pet) {
      const selectedPet = setActivePet(pet.id);
      if (!selectedPet) return;
      this.loadProfile();
      uni.showToast({ title: `已切换到 ${selectedPet.name}`, icon: 'none' });
    },
    statusLabel(status) {
      return getRelationshipConfig(status).shortLabel;
    },
    petAvatar(pet) {
      return getAvatarDisplayImage(pet || {});
    },
    editActivePet() {
      uni.reLaunch({ url: '/pages/welcome/welcome' });
    },
    addPet() {
      const access = canCreateAnotherPet();
      if (!access.allowed) {
        if (access.reason === 'development_limit_reached') {
          uni.showToast({
            title: `当前开发测试最多创建 ${access.limit} 只宠物。`,
            icon: 'none'
          });
          return;
        }

        if (access.reason === 'membership_required') this.openMembership();
        return;
      }

      uni.navigateTo({ url: '/pages/welcome/welcome?mode=create' });
    },
    confirmDeletePet(pet) {
      uni.showModal({
        title: '删除宝贝',
        content: `会同时删除 ${pet.name} 的本地日历、对话和档案记录，确定继续吗？`,
        confirmText: '删除',
        confirmColor: '#B95757',
        success: (res) => {
          if (!res.confirm) return;
          removePet(pet.id);
          this.loadProfile();
          uni.showToast({ title: '已删除', icon: 'none' });
        }
      });
    },
    openStats(type) {
      uni.navigateTo({ url: `/pages/insights/insights?type=${type}` });
    },
    openArchive() {
      if (!this.activePetId) return;
      uni.navigateTo({ url: `/pages/archive/archive?petId=${encodeURIComponent(this.activePetId)}` });
    },
    openAvatarArchive() {
      lightHaptic();
      this.openArchive();
    },
    handleActiveAvatarError() {
      this.activeAvatarFailed = true;
    },
    openMembership() {
      uni.showModal({
        title: '会员功能',
        content: '当前规则：普通用户可保留 1 只宠物，每天 3 次 AI 问诊；会员可添加多只宠物，每月 300 次 AI 问诊。支付和云端会员校验下一步再接入。',
        confirmText: '知道了',
        showCancel: false,
        confirmColor: '#8C7557'
      });
    },
    openCalendar() {
      uni.navigateTo({ url: '/pages/calendar/calendar' });
    },
    openFeedback() {
      uni.navigateTo({ url: '/pages/feedback/feedback' });
    },
    openSettings() {
      uni.navigateTo({ url: '/pages/settings/settings' });
    },
    comingSoon() {
      uni.showToast({ title: '下一步接入', icon: 'none' });
    },
    calculateStats() {
      this.memoryCount = 0;
      this.eventCount = 0;
      this.chatCount = 0;
      if (!this.activePetId) return;

      const history = uni.getStorageSync('pet_diaries_' + this.activePetId) || {};
      const dates = Object.keys(history);
      this.memoryCount = dates.length;

      let eventsTotal = 0;
      dates.forEach(date => {
        if (history[date].events && history[date].events.length > 0) {
          eventsTotal += history[date].events.length;
        }
      });
      this.eventCount = eventsTotal;

      const chatHistory = uni.getStorageSync('chat_history_' + this.activePetId) || [];
      this.chatCount = Math.max(0, chatHistory.filter(msg => msg.type === 'user').length);
    }
  }
}
</script>

<style scoped>
.profile-page {
  min-height: 100vh;
  background: #F4F1EA;
  color: #302A23;
}

.profile-scroll {
  height: 100vh;
}

.profile-hero {
  padding: 86rpx 34rpx 70rpx;
  background: linear-gradient(180deg, #F7F3EA 0%, #E9E1D3 100%);
}

.hero-title-row,
.active-pet,
.empty-pet,
.section-head,
.menu-item {
  display: flex;
  align-items: center;
}

.hero-title-row {
  justify-content: space-between;
}

.hero-kicker {
  display: block;
  color: #8C7557;
  font-size: 20rpx;
  line-height: 1.3;
}

.hero-title {
  display: block;
  margin-top: 6rpx;
  color: #302A23;
  font-size: 42rpx;
  font-weight: 600;
  line-height: 1.15;
}

.icon-button {
  width: 72rpx;
  height: 72rpx;
  padding: 0;
  margin: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 12rpx 30rpx rgba(58, 51, 43, 0.08);
}

.icon-button::after {
  border: none;
}

.icon-button-hover,
.menu-item-hover {
  opacity: 0.78;
}

.active-pet,
.empty-pet {
  margin-top: 44rpx;
}

.active-avatar,
.empty-mark {
  width: 138rpx;
  height: 138rpx;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 20rpx 42rpx rgba(58, 51, 43, 0.14);
}

.empty-mark {
  background: #302A23;
  color: #F7F3EA;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 46rpx;
}

.active-info {
  margin-left: 28rpx;
  min-width: 0;
}

.active-name {
  display: block;
  color: #302A23;
  font-size: 44rpx;
  font-weight: 600;
  line-height: 1.2;
}

.active-desc {
  display: block;
  margin-top: 10rpx;
  color: #6F665B;
  font-size: 25rpx;
  line-height: 1.45;
}

.stats-board {
  margin: -42rpx 34rpx 0;
  padding: 30rpx 22rpx;
  border-radius: 16rpx;
  background: #FFFFFF;
  border: 1rpx solid #EEE6DA;
  display: flex;
  align-items: center;
  box-shadow: 0 18rpx 42rpx rgba(58, 51, 43, 0.08);
  position: relative;
  z-index: 2;
}

.stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-item-hover,
.section-action-hover,
.pet-delete-hover {
  opacity: 0.72;
}

.stat-num {
  color: #5F735C;
  font-size: 42rpx;
  font-weight: 600;
  line-height: 1.1;
}

.stat-label {
  margin-top: 10rpx;
  color: #92887A;
  font-size: 22rpx;
  line-height: 1.2;
}

.stat-divider {
  width: 1rpx;
  height: 50rpx;
  background: #EEE6DA;
}

.pet-switch-section,
.menu-section,
.about-panel {
  margin: 28rpx 34rpx 0;
}

.account-panel {
  margin: 28rpx 34rpx 0;
  padding: 26rpx 24rpx;
  border-radius: 16rpx;
  background: #FFFFFF;
  border: 1rpx solid #EEE6DA;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  box-shadow: 0 12rpx 30rpx rgba(58, 51, 43, 0.04);
}

.account-copy {
  flex: 1;
  min-width: 0;
}

.account-title {
  display: block;
  color: #302A23;
  font-size: 28rpx;
  font-weight: 600;
  line-height: 1.25;
}

.account-desc,
.account-plan {
  display: block;
  margin-top: 8rpx;
  color: #92887A;
  font-size: 22rpx;
  line-height: 1.35;
  word-break: break-all;
}

.account-plan {
  color: #8C7557;
}

.account-actions {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex-shrink: 0;
}

.account-action {
  width: 132rpx;
  height: 58rpx;
  padding: 0;
  margin: 0;
  border-radius: 999rpx;
  background: #302A23;
  color: #FBFAF6;
  font-size: 23rpx;
  line-height: 58rpx;
  flex-shrink: 0;
}

.account-action-light {
  background: #F3EEE6;
  color: #6C5B4B;
}

.account-action::after {
  border: none;
}

.account-action-hover {
  opacity: 0.78;
}

.section-head {
  justify-content: space-between;
  margin-bottom: 18rpx;
}

.section-title {
  color: #302A23;
  font-size: 30rpx;
  font-weight: 600;
  line-height: 1.25;
}

.section-meta {
  display: block;
  margin-top: 8rpx;
  color: #8C7557;
  font-size: 23rpx;
  line-height: 1.25;
}

.section-action {
  height: 58rpx;
  padding: 0 18rpx;
  margin: 0;
  border-radius: 999rpx;
  background: #FFFFFF;
  border: 1rpx solid #EEE6DA;
  color: #8C7557;
  font-size: 23rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
}

.section-action::after {
  border: none;
}

.pet-strip {
  white-space: nowrap;
  width: 100%;
}

.pet-chip {
  position: relative;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  width: 154rpx;
  padding: 22rpx 14rpx 18rpx;
  margin-right: 16rpx;
  border-radius: 16rpx;
  background: #FFFFFF;
  border: 1rpx solid #EEE6DA;
  box-sizing: border-box;
}

.pet-delete {
  position: absolute;
  top: 8rpx;
  right: 8rpx;
  width: 34rpx;
  height: 34rpx;
  padding: 0;
  margin: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.86);
  display: flex;
  align-items: center;
  justify-content: center;
}

.pet-delete::after {
  border: none;
}

.pet-chip-active {
  background: #302A23;
  border-color: #302A23;
}

.pet-chip-img {
  width: 76rpx;
  height: 76rpx;
  border-radius: 50%;
}

.pet-chip-name {
  margin-top: 12rpx;
  width: 100%;
  color: #302A23;
  font-size: 24rpx;
  font-weight: 600;
  line-height: 1.2;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pet-chip-status {
  margin-top: 6rpx;
  color: #8F877A;
  font-size: 20rpx;
  line-height: 1.2;
}

.pet-chip-active .pet-chip-name,
.pet-chip-active .pet-chip-status {
  color: #FBFAF6;
}

.menu-section {
  border-radius: 16rpx;
  background: #FFFFFF;
  border: 1rpx solid #EEE6DA;
  overflow: hidden;
  box-shadow: 0 12rpx 30rpx rgba(58, 51, 43, 0.04);
}

.menu-item {
  min-height: 112rpx;
  padding: 22rpx 24rpx;
  border-bottom: 1rpx solid #F0E8DD;
  box-sizing: border-box;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-icon {
  width: 62rpx;
  height: 62rpx;
  border-radius: 50%;
  background: #F1ECE3;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.menu-copy {
  flex: 1;
  margin: 0 20rpx;
  min-width: 0;
}

.menu-title {
  display: block;
  color: #302A23;
  font-size: 28rpx;
  font-weight: 600;
  line-height: 1.25;
}

.menu-desc {
  display: block;
  margin-top: 8rpx;
  color: #92887A;
  font-size: 22rpx;
  line-height: 1.35;
}

.about-panel {
  margin-bottom: calc(40rpx + env(safe-area-inset-bottom));
  padding: 28rpx;
  border-radius: 16rpx;
  background: #E7DED1;
}

.about-kicker {
  display: block;
  color: #8C7557;
  font-size: 20rpx;
  line-height: 1.3;
}

.about-title {
  display: block;
  margin-top: 8rpx;
  color: #302A23;
  font-size: 30rpx;
  font-weight: 600;
  line-height: 1.25;
}

.about-desc {
  display: block;
  margin-top: 12rpx;
  color: #6F665B;
  font-size: 24rpx;
  line-height: 1.55;
}

.profile-page {
  --ui-bg-1: #F8F2E8;
  --ui-bg-2: #EEE3D3;
  --ui-bg-3: #E8EBDD;
  --ui-card: rgba(255, 252, 246, 0.66);
  --ui-border: rgba(255, 255, 255, 0.58);
  --ui-text: #2F2A24;
  --ui-muted: rgba(47, 42, 36, 0.58);
  --ui-accent: #6D5945;
  background:
    radial-gradient(circle at 18% 8%, rgba(232, 188, 128, 0.25) 0%, rgba(255, 255, 255, 0) 34%),
    linear-gradient(145deg, var(--ui-bg-1) 0%, var(--ui-bg-2) 54%, var(--ui-bg-3) 100%);
}

.profile-scroll {
  animation: profileFadeUp 520ms ease both;
}

.profile-hero {
  margin: 0 24rpx;
  padding: 86rpx 28rpx 56rpx;
  border-radius: 0 0 42rpx 42rpx;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.54), rgba(255, 249, 239, 0.36));
  border: 1rpx solid var(--ui-border);
  box-shadow: 0 24rpx 66rpx rgba(72, 58, 43, 0.08);
}

.hero-kicker,
.section-meta,
.account-plan,
.about-kicker {
  color: var(--ui-accent);
}

.active-desc,
.account-desc,
.menu-desc,
.about-desc,
.pet-chip-status {
  color: var(--ui-muted);
}

.stats-board,
.account-panel,
.menu-section,
.about-panel,
.pet-chip,
.section-action {
  border-radius: 28rpx;
  border: 1rpx solid var(--ui-border);
  background: var(--ui-card);
  box-shadow: 0 16rpx 42rpx rgba(72, 58, 43, 0.06);
}

.menu-item {
  border-bottom-color: rgba(255, 255, 255, 0.42);
}

.menu-icon,
.section-action,
.account-action-light {
  background: rgba(255, 255, 255, 0.42);
}

.icon-button,
.account-action,
.section-action,
.pet-chip,
.menu-item,
.stat-item {
  transition: transform 160ms ease, opacity 160ms ease;
}

.icon-button-hover {
  transform: scale(0.94);
  opacity: 0.82;
}

.account-action-hover,
.section-action-hover,
.stat-item-hover,
.menu-item-hover {
  transform: scale(0.985);
  opacity: 0.86;
}

.account-action {
  background: var(--ui-accent);
  box-shadow: 0 14rpx 34rpx rgba(109, 89, 69, 0.18);
}

.account-action.account-action-light {
  background: rgba(255, 255, 255, 0.42);
  color: var(--ui-accent);
}

.pet-chip-active {
  background: var(--ui-accent);
  border-color: transparent;
}

@keyframes profileFadeUp {
  from {
    opacity: 0;
    transform: translateY(16rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.profile-page {
  background: var(--pety-page-bg, #F5F2EC);
  color: var(--pety-text, #2F2A24);
}

.profile-scroll {
  padding: 76rpx var(--pety-page-gutter, 32rpx) calc(52rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.profile-header,
.relationship-surface,
.account-row {
  display: flex;
  align-items: center;
}

.profile-header {
  justify-content: space-between;
  margin-bottom: 30rpx;
}

.page-kicker {
  display: block;
  color: var(--pety-primary, #6D5945);
  font-size: 21rpx;
  line-height: 1.3;
}

.page-title {
  display: block;
  margin-top: 7rpx;
  color: var(--pety-text, #2F2A24);
  font-size: 42rpx;
  font-weight: 600;
  line-height: 1.15;
}

.icon-button {
  width: 68rpx;
  height: 68rpx;
  background: var(--pety-surface, #FCFAF6);
  box-shadow: var(--pety-shadow);
}

.relationship-surface {
  min-height: 194rpx;
  padding: 28rpx;
  border: 1rpx solid var(--pety-rule, #E4DED4);
  border-radius: 30rpx;
  background: var(--pety-surface, #FCFAF6);
  box-shadow: var(--pety-shadow);
  transition: transform 150ms ease, opacity 150ms ease;
}

.active-avatar,
.empty-mark {
  width: 126rpx;
  height: 126rpx;
  border-radius: 34rpx;
  flex-shrink: 0;
  box-shadow: none;
}

.empty-mark {
  background: var(--pety-primary, #6D5945);
  color: #FFFFFF;
  font-size: 40rpx;
}

.relationship-copy {
  flex: 1;
  min-width: 0;
  margin: 0 22rpx;
}

.relationship-mode {
  display: block;
  color: var(--pety-primary, #6D5945);
  font-size: 21rpx;
  line-height: 1.3;
}

.active-name {
  margin-top: 5rpx;
  color: var(--pety-text, #2F2A24);
  font-size: 38rpx;
}

.relationship-label {
  display: block;
  margin-top: 8rpx;
  color: var(--pety-text, #2F2A24);
  font-size: 24rpx;
  line-height: 1.35;
}

.active-desc {
  margin-top: 5rpx;
  color: var(--pety-text-secondary, #786F64);
  font-size: 21rpx;
}

.surface-hover,
.menu-item-hover,
.stat-item-hover,
.section-action-hover,
.account-action-hover {
  opacity: 0.86;
  transform: scale(0.985);
}

.section-block {
  margin-top: 34rpx;
}

.section-label {
  display: block;
  margin: 0 8rpx 14rpx;
  font-size: 25rpx;
}

.section-meta {
  color: var(--pety-text-secondary, #786F64);
}

.section-action {
  border-color: var(--pety-rule, #E4DED4);
  border-radius: 999rpx;
  background: var(--pety-surface, #FCFAF6);
  color: var(--pety-primary, #6D5945);
  box-shadow: none;
}

.pet-chip {
  border-color: var(--pety-rule, #E4DED4);
  border-radius: 22rpx;
  background: var(--pety-surface, #FCFAF6);
  box-shadow: none;
}

.pet-chip-active {
  background: var(--pety-primary, #6D5945);
}

.stats-strip {
  margin-top: 24rpx;
  min-height: 94rpx;
  padding: 18rpx 16rpx;
  border-top: 1rpx solid var(--pety-rule, #E4DED4);
  border-bottom: 1rpx solid var(--pety-rule, #E4DED4);
  display: flex;
  align-items: center;
}

.stat-num {
  color: var(--pety-primary, #6D5945);
  font-size: 30rpx;
}

.stat-label {
  margin-top: 5rpx;
  color: var(--pety-text-secondary, #786F64);
  font-size: 20rpx;
}

.stat-divider {
  background: var(--pety-rule, #E4DED4);
}

.group-list {
  overflow: hidden;
  border: 1rpx solid var(--pety-rule, #E4DED4);
  border-radius: var(--pety-radius, 24rpx);
  background: var(--pety-surface, #FCFAF6);
  box-shadow: var(--pety-shadow);
}

.menu-item,
.account-row {
  min-height: 98rpx;
  padding: 20rpx 24rpx;
  border-bottom: 1rpx solid var(--pety-rule, #E4DED4);
  transition: transform 150ms ease, opacity 150ms ease, background 150ms ease;
}

.menu-item:last-child,
.account-row:last-child {
  border-bottom: none;
}

.menu-icon {
  width: 54rpx;
  height: 54rpx;
  border-radius: 18rpx;
  background: var(--pety-primary-soft, #EAE1D6);
}

.menu-copy {
  margin: 0 18rpx;
}

.menu-title {
  color: var(--pety-text, #2F2A24);
  font-size: 27rpx;
  font-weight: 500;
}

.menu-desc,
.account-desc {
  color: var(--pety-text-secondary, #786F64);
  font-size: 21rpx;
}

.account-note {
  display: block;
  margin-top: 6rpx;
  color: var(--pety-primary, #6D5945);
  font-size: 20rpx;
  line-height: 1.35;
}

.account-actions {
  gap: 8rpx;
}

.account-action {
  width: 118rpx;
  height: 56rpx;
  line-height: 56rpx;
  background: var(--pety-primary, #6D5945);
  box-shadow: none;
}

.account-action.account-action-light {
  background: var(--pety-primary-soft, #EAE1D6);
  color: var(--pety-primary, #6D5945);
}

.membership-block {
  opacity: 0.88;
}

.profile-footer {
  display: block;
  margin: 34rpx 0 10rpx;
  color: var(--pety-text-secondary, #786F64);
  font-size: 20rpx;
  line-height: 1.4;
  text-align: center;
}

.profile-page.theme-memorial .menu-icon {
  background: var(--pety-primary-soft, #E2E3EA);
}

.profile-scroll {
  animation-duration: 360ms;
}

.reduce-motion .profile-scroll {
  animation: none;
}
</style>
