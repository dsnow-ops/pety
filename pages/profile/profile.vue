<template>
  <view :class="[petThemeClass, 'profile-page ui-v2', themeClass, reduceMotion ? 'reduce-motion' : '']" :style="appThemeStyle">
    <scroll-view scroll-y class="profile-scroll">
      <view class="profile-content">
      <view class="profile-header">
        <view>
          <text class="page-kicker">归爪 Lumière Pet</text>
          <text class="page-title">我的</text>
        </view>
        <button class="icon-button" hover-class="icon-button-hover" aria-label="设置" @click="openSettings">
          <uni-icons type="gear" size="20" color="#BCC4AE"></uni-icons>
        </button>
      </view>
      <button v-if="creativeCleanupPending" class="creative-cleanup" @click="retryCreativeCleanup">{{creativeCleanupLabel}}</button>
      <view v-if="petReadError" class="pet-read-error">
        <text class="pet-read-title">宠物资料暂时无法读取</text>
        <text class="pet-read-copy">原资料已保留。请重试读取，暂不添加或切换宠物。</text>
        <button class="pet-read-retry" @click="loadProfile">重新读取宠物资料</button>
      </view>

      <view v-if="!petReadError && activePet" class="relationship-surface" hover-class="surface-hover" @click="openArchive">
        <PetAvatarImage :key="activePetId" :pet="activePet || {}" class="active-avatar" @click.stop="openAvatarArchive" />
        <view class="relationship-copy">
          <text class="relationship-mode">{{ activeModeText }}</text>
          <text class="active-name">{{ activePet.name || '我的宝贝' }}</text>
          <text class="relationship-label">{{ ownerRelationSummary }}</text>
          <text class="active-desc">{{ activePetDesc }}</text>
        </view>
        <uni-icons type="right" size="17" color="#9B948B"></uni-icons>
      </view>

      <view v-else-if="!petReadError" class="relationship-surface empty-relationship" hover-class="surface-hover" @click="addPet">
        <view class="empty-mark">归</view>
        <view class="relationship-copy">
          <text class="relationship-mode">本地陪伴空间</text>
          <text class="active-name">还没有宠物档案</text>
          <text class="active-desc">从名字和一张照片开始</text>
        </view>
        <uni-icons type="right" size="17" color="#9B948B"></uni-icons>
      </view>

      <button class="membership-banner" hover-class="surface-hover" @click="openMembership"><view class="membership-emblem"><uni-icons type="medal" size="28" color="#DCC49B" /></view><view class="membership-copy"><text class="membership-title">归爪会员</text><text class="membership-subtitle">让每一份陪伴，都更从容</text></view><text class="membership-link">查看权益</text></button>
      <view v-if="!petReadError" class="section-block">
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
              <uni-icons type="closeempty" size="14" color="#717964"></uni-icons>
            </button>
            <PetAvatarImage :pet="pet" :load="pet.id === activePetId" class="pet-chip-img" />
            <text class="pet-chip-name">{{ pet.name }}</text>
            <text class="pet-chip-status">{{ statusLabel(pet.relationshipStage || pet.status) }}</text>
          </view>
        </scroll-view>
      </view>

      <view v-if="!petReadError" class="stats-strip">
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
        <view class="group-list account-settings">
          <AppSettingsRow title="账号与安全" icon="locked" :description="authStatusText+' · '+accountDesc" action @click="handleAccountAction"/>
          <view class="account-storage"><uni-icons type="download" size="16" color="currentColor"/><view class="account-storage-copy"><text class="storage-title">资料保存在本机</text><text class="account-note">{{remotePlanText}}</text></view></view>
          <AppSettingsRow v-if="userProfile.loggedIn && guestDataCount" title="本机游客资料" icon="folder-add" :description="guestDataCount+' 只宠物尚未导入；原件保留'" action @click="handleAccountAction"/>
        </view>
      </view>

      <view class="section-block">
        <text class="section-title section-label">宠物功能</text>
        <view class="group-list">
          <view class="menu-item" hover-class="menu-item-hover" @click="openArchive">
            <view class="menu-icon"><uni-icons type="folder-add" size="21" color="#BCC4AE"></uni-icons></view>
            <view class="menu-copy">
              <text class="menu-title">宠物生命档案</text>
              <text class="menu-desc">关系、健康背景、习惯与形象</text>
            </view>
            <uni-icons type="right" size="16" color="#A09A92"></uni-icons>
          </view>
          <view class="menu-item" hover-class="menu-item-hover" @click="openCalendar">
            <view class="menu-icon"><uni-icons type="calendar" size="21" color="#BCC4AE"></uni-icons></view>
            <view class="menu-copy">
              <text class="menu-title">陪伴记录</text>
              <text class="menu-desc">查看日历、状态和手写记录</text>
            </view>
            <uni-icons type="right" size="16" color="#A09A92"></uni-icons>
          </view>
          <view class="menu-item" hover-class="menu-item-hover" @click="openAlbum">
            <view class="menu-icon"><uni-icons type="heart" size="21" color="#BCC4AE"></uni-icons></view>
            <view class="menu-copy">
              <text class="menu-title">回忆纪念册</text>
              <text class="menu-desc">翻阅本地记录，制作与导出卡片</text>
            </view>
            <uni-icons type="right" size="16" color="#A09A92"></uni-icons>
          </view>
        </view>
      </view>

      <view class="section-block">
        <text class="section-title section-label">设置与帮助</text>
        <view class="group-list">
          <view class="menu-item" hover-class="menu-item-hover" @click="openSettings">
            <view class="menu-icon"><uni-icons type="gear" size="21" color="#BCC4AE"></uni-icons></view>
            <view class="menu-copy">
              <text class="menu-title">设置</text>
              <text class="menu-desc">账号、显示、数据与归爪服务</text>
            </view>
            <uni-icons type="right" size="16" color="#A09A92"></uni-icons>
          </view>
          <view class="menu-item" hover-class="menu-item-hover" @click="openFeedback">
            <view class="menu-icon"><uni-icons type="email" size="21" color="#BCC4AE"></uni-icons></view>
            <view class="menu-copy">
              <text class="menu-title">留言信箱</text>
              <text class="menu-desc">建议、问题和想告诉归爪的话</text>
            </view>
            <uni-icons type="right" size="16" color="#A09A92"></uni-icons>
          </view>
        </view>
      </view>

      <text class="profile-footer">归爪 Lumière Pet · 把爱，放进每一天</text>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import {scopedStorage,captureDataScope,isDataScopeCurrent} from "../../common/scoped-storage.js";
import {setThemePet,applyNativePetTheme} from '../../common/pet-app-theme.js';
import { getActivePet, getPetList, removePet, setActivePet } from '../../common/pet-store.js';
import { canCreateAnotherPet } from '../../common/pet-creation-access.js';
import {
  getOwnerRelationLabel,
  getPetRelationshipStage,
  getRelationshipConfig,
  getRelationshipThemeClass,
  setRelationshipTabBar
} from '../../common/relationship-config.js';
import { subscribeAccountScope,clearUserCache, getCurrentUser, refreshUserProfile } from '../../common/auth-store.js';
import PetAvatarImage from '../../components/PetAvatarImage.vue';
import { isReduceMotionEnabled, lightHaptic } from '../../common/haptics.js';
import { getGuestImportState } from '../../common/guest-data-import.js';
import {cleanupDeletedPetMedia} from '../../common/narrative-media.js';
import {t as creativeTranslate} from '../../common/i18n.js';

const LOGIN_PAGE = '/pages/auth/login';
const ACCOUNT_PAGE = '/pages/account/account-security';

export default {
  components: { PetAvatarImage },
  data() {
    return {
      loadedDataScope:captureDataScope(),unsubscribeDataScope:null,activePetId: null,
      petReadError:false,profileVisible:false,profileVersion:0,
      activePet: null,
      petList: [],
      isPlusUser: false,
      userProfile: getCurrentUser(),
      authLoading: false,
      guestDataCount: 0,
      creativeCleanupPending:false,
      profileRequestId: 0,
      memoryCount: 0,
      eventCount: 0,
      chatCount: 0,
      reduceMotion: isReduceMotionEnabled()
    };
  },
  computed: {
    creativeCleanupLabel(){return creativeTranslate('narrative.retryCleanup');},
    relationshipStage() {
      return getPetRelationshipStage(this.activePet);
    },
    themeClass() {
      return getRelationshipThemeClass(this.relationshipStage);
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
      return this.petList.length>1 ? `已保留 ${this.petList.length} 只 · 普通账号上限 1 只，暂不能新增` : `${this.petList.length} 只 · 普通账号上限 1 只`;
    },
    authStatusText() {
      if (this.authLoading) return '正在刷新账号状态';
      if (this.userProfile.loggedIn && this.userProfile.message !== 'ok') return '账号状态待确认';
      return this.userProfile.loggedIn ? '已登录' : '游客模式';
    },
    maskedUserId() {
      const userId = this.userProfile.userId || '';
      if (!userId) return '';
      if (userId.length <= 8) return userId;
      return `${userId.slice(0, 4)}...${userId.slice(-4)}`;
    },
    accountDesc() {
      return this.userProfile.loggedIn ? '管理登录与账号资料' : '登录管理账号';
    },
    remotePlanText() {
      if (!this.userProfile.loggedIn) return '自动云备份尚未接入';
      if (this.authLoading) return '账号核对中 · 自动云备份尚未接入';
      if (this.userProfile.message !== 'ok') return '云端状态待确认 · 自动云备份尚未接入';
      return this.isPlusUser ? '会员状态已记录 · 自动云备份尚未接入' : '账号已验证 · 自动云备份尚未接入';
    },
    accountActionText() {
      if (this.authLoading) return '刷新中';
      return this.userProfile.loggedIn ? '账号与安全' : '登录';
    }
  },
  onLoad() {
    this.unsubscribeDataScope=subscribeAccountScope(()=>{this.profileRequestId++;this.authLoading=false;this.loadProfile();});
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
    this.profileVisible=false;this.profileVersion++;
    this.unsubscribeDataScope?.();this.unsubscribeDataScope=null;
    this.profileRequestId += 1;
    if (this.loginSuccessHandler) {
      uni.$off('uni-id-pages-login-success', this.loginSuccessHandler);
    }
    if (this.logoutHandler) {
      uni.$off('uni-id-pages-logout', this.logoutHandler);
    }
  },
  onShow() {
    this.profileVisible=true;this.profileVersion++;
    this.loadProfile();
    this.loadUserProfile();
  },
  onHide(){this.profileVisible=false;this.profileVersion++;},
  methods: {
    async retryCreativeCleanup(){const scope=this.loadedDataScope;if(!isDataScopeCurrent(scope))return;try{await cleanupDeletedPetMedia(scope);if(isDataScopeCurrent(scope))this.creativeCleanupPending=false;}catch(_){if(isDataScopeCurrent(scope))uni.showToast({title:'宠物资料已删除，部分本机图片待清理。请点上方按钮重试。',icon:'none'});}},
    loadProfile() {
      this.petReadError=false;
      this.loadedDataScope=captureDataScope();
      try {
      this.creativeCleanupPending=captureDataScope().ready&&Boolean(scopedStorage.getStorageSync('pety_creative_media_gc_v1')?.length);
      this.guestDataCount = 0;
      try { const choice = getGuestImportState();if (choice.status === 'pending') this.guestDataCount = choice.count; } catch (_) { /* Account page shows actionable recovery errors. */ }
      this.loadedDataScope=captureDataScope();
      this.petList = getPetList();
      const cachedUser = getCurrentUser();
      this.userProfile = cachedUser;
      this.isPlusUser = cachedUser.loggedIn && ['plus', 'pro'].includes(cachedUser.plan);
      const activePet = getActivePet();
      this.activePet = activePet;
      this.activePetId = activePet ? activePet.id : null;
      this.reduceMotion = isReduceMotionEnabled();
      setRelationshipTabBar(activePet && activePet.status);
      this.calculateStats();
      } catch (_) {
        this.petReadError=true;this.activePet=null;this.activePetId=null;this.petList=[];
        this.memoryCount=0;this.eventCount=0;this.chatCount=0;
      }
    },
    async loadUserProfile() {
      const requestId = this.profileRequestId + 1;
      this.profileRequestId = requestId;
      this.authLoading = true;
      try {
        const profile = await refreshUserProfile();
        if (requestId !== this.profileRequestId) return;
        this.userProfile = profile;
        this.isPlusUser = profile.loggedIn && ['plus', 'pro'].includes(profile.plan);
      } finally {
        if (requestId === this.profileRequestId) this.authLoading = false;
      }
    },
    handleAccountAction() {
      if (this.authLoading) return;

      uni.navigateTo({
        url: this.userProfile.loggedIn ? ACCOUNT_PAGE : LOGIN_PAGE,
        fail: () => {
          uni.showModal({
            title: '账号页面暂不可用',
            content: '请确认账号页面路由已注册，并已上传 uni-id-co 与 uni-id-common。',
            confirmText: '知道了',
            showCancel: false,
            confirmColor: '#8C7557'
          });
        }
      });
    },
    selectPet(pet) {
      if(this.petReadError||!isDataScopeCurrent(this.loadedDataScope))return;
      try {
      const selectedPet = setActivePet(pet.id);
      setThemePet(selectedPet);
      applyNativePetTheme();
      if (!selectedPet) return;
      this.loadProfile();
      uni.showToast({ title: `已切换到 ${selectedPet.name}`, icon: 'none' });
      } catch (_) {uni.showToast({title:'切换未确认，请重新读取宠物资料',icon:'none'});}
    },
    statusLabel(status) {
      return getRelationshipConfig(status).shortLabel;
    },
    editActivePet() {
      uni.reLaunch({ url: '/pages/welcome/welcome?mode=edit' });
    },
    addPet() {
      if(this.petReadError)return;
      let access;try{access=canCreateAnotherPet();}catch(_){this.petReadError=true;return;}
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
      const scope=this.loadedDataScope;
      if(this.petReadError||!this.profileVisible||!isDataScopeCurrent(scope))return;
      const version=this.profileVersion,expectedPet={id:pet.id,name:pet.name,createdAt:pet.createdAt,updatedAt:pet.updatedAt};
      uni.showModal({
        title: '删除宝贝',
          content: creativeTranslate('narrative.deletePetHint',{name:pet.name}),
        confirmText: '删除',
        confirmColor: '#B95757',
        success: (res) => {
          if (!res.confirm) return;
          if(!this.profileVisible||version!==this.profileVersion||!isDataScopeCurrent(scope)){uni.showToast({title:'页面或账号已变化，请重新确认删除',icon:'none'});return;}
          try{const removed=removePet(pet.id,{expectedPet});if(!removed)throw Error('PET_REMOVE_UNCONFIRMED');}catch(error){uni.showToast({title:error.code==='PET_DELETE_CHANGED'?'资料已有变化，请重新确认删除':'删除未确认，请重新读取宠物资料',icon:'none'});return;}
          this.loadProfile();
          if(this.creativeCleanupPending)this.retryCreativeCleanup();
          uni.showToast({ title: '已删除', icon: 'none' });
        }
      });
    },
    openStats(type) {
      uni.navigateTo({ url: `/pages/insights/insights?type=${type}` });
    },
    openAlbum(){uni.navigateTo({url:'/pages/album/album'});},
    openArchive() {
      if (!this.activePetId) return;
      uni.navigateTo({ url: `/pages/archive/archive?petId=${encodeURIComponent(this.activePetId)}` });
    },
    openAvatarArchive() {
      lightHaptic();
      this.openArchive();
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

      const history = scopedStorage.getStorageSync('pet_diaries_' + this.activePetId) || {};
      const dates = Object.keys(history);
      this.memoryCount = dates.length;

      let eventsTotal = 0;
      dates.forEach(date => {
        if (history[date].events && history[date].events.length > 0) {
          eventsTotal += history[date].events.length;
        }
      });
      this.eventCount = eventsTotal;

      const chatHistory = scopedStorage.getStorageSync('chat_history_' + this.activePetId) || [];
      this.chatCount = Math.max(0, chatHistory.filter(msg => msg.type === 'user').length);
    }
  }
}
</script>

<style scoped>
.profile-page {
  min-height: 100vh;
  background: var(--ui-surface);
  color: var(--ui-ink);
}

.profile-scroll {
  height: 100vh;
}

.profile-hero {
  padding: 86rpx 34rpx 70rpx;
  background: var(--ui-surface);
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
  color: var(--ui-muted);
  font-size: 20rpx;
  line-height: 1.3;
}

.hero-title {
  display: block;
  margin-top: 6rpx;
  color: var(--ui-ink);
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
  background: var(--ui-surface);
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
  color: var(--ui-ink);
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
  color: var(--ui-ink);
  font-size: 44rpx;
  font-weight: 600;
  line-height: 1.2;
}

.active-desc {
  display: block;
  margin-top: 10rpx;
  color: var(--ui-muted);
  font-size: 25rpx;
  line-height: 1.45;
}

.stats-board {
  margin: -42rpx 34rpx 0;
  padding: 30rpx 22rpx;
  border-radius: 16rpx;
  background: var(--ui-surface);
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
  color: var(--ui-muted);
  font-size: 42rpx;
  font-weight: 600;
  line-height: 1.1;
}

.stat-label {
  margin-top: 10rpx;
  color: var(--ui-muted);
  font-size: 22rpx;
  line-height: 1.2;
}

.stat-divider {
  width: 1rpx;
  height: 50rpx;
  background: var(--ui-surface);
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
  background: var(--ui-surface);
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
  color: var(--ui-ink);
  font-size: 28rpx;
  font-weight: 600;
  line-height: 1.25;
}

.account-desc,
.account-plan {
  display: block;
  margin-top: 8rpx;
  color: var(--ui-muted);
  font-size: 22rpx;
  line-height: 1.35;
  word-break: break-all;
}

.account-plan {
  color: var(--ui-muted);
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
  color: var(--ui-ink);
  font-size: 23rpx;
  line-height: 58rpx;
  flex-shrink: 0;
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
  color: var(--ui-ink);
  font-size: 30rpx;
  font-weight: 600;
  line-height: 1.25;
}

.section-meta {
  display: block;
  margin-top: 8rpx;
  color: var(--ui-muted);
  font-size: 23rpx;
  line-height: 1.25;
}

.section-action {
  height: 58rpx;
  padding: 0 18rpx;
  margin: 0;
  border-radius: 999rpx;
  background: var(--ui-surface);
  border: 1rpx solid #EEE6DA;
  color: var(--ui-muted);
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
  background: var(--ui-surface);
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
  background: var(--ui-surface);
  display: flex;
  align-items: center;
  justify-content: center;
}

.pet-delete::after {
  border: none;
}

.pet-chip-active {
  background: #302A23;
  border-color: var(--ui-line);
}

.pet-chip-img {
  width: 76rpx;
  height: 76rpx;
  border-radius: 50%;
}

.pet-chip-name {
  margin-top: 12rpx;
  width: 100%;
  color: var(--ui-ink);
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
  color: var(--ui-muted);
  font-size: 20rpx;
  line-height: 1.2;
}

.pet-chip-active .pet-chip-name,
.pet-chip-active .pet-chip-status {
  color: var(--ui-ink);
}

.menu-section {
  border-radius: 16rpx;
  background: var(--ui-surface);
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
  background: var(--ui-surface);
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
  color: var(--ui-ink);
  font-size: 28rpx;
  font-weight: 600;
  line-height: 1.25;
}

.menu-desc {
  display: block;
  margin-top: 8rpx;
  color: var(--ui-muted);
  font-size: 22rpx;
  line-height: 1.35;
}

.about-panel {
  margin-bottom: calc(40rpx + env(safe-area-inset-bottom));
  padding: 28rpx;
  border-radius: 16rpx;
  background: var(--ui-surface);
}

.about-kicker {
  display: block;
  color: var(--ui-muted);
  font-size: 20rpx;
  line-height: 1.3;
}

.about-title {
  display: block;
  margin-top: 8rpx;
  color: var(--ui-ink);
  font-size: 30rpx;
  font-weight: 600;
  line-height: 1.25;
}

.about-desc {
  display: block;
  margin-top: 12rpx;
  color: var(--ui-muted);
  font-size: 24rpx;
  line-height: 1.55;
}

.profile-page {
  background:
    var(--ui-surface);
}

.profile-scroll {
  animation: profileFadeUp 520ms ease both;
}

.profile-hero {
  margin: 0 24rpx;
  padding: 86rpx 28rpx 56rpx;
  border-radius: 0 0 42rpx 42rpx;
  background: var(--ui-surface);
  border: 1rpx solid var(--ui-border);
  box-shadow: 0 24rpx 66rpx rgba(72, 58, 43, 0.08);
}

.hero-kicker,
.section-meta,
.account-plan,
.about-kicker {
  color: var(--ui-muted);
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
.section-action {
  background: var(--ui-surface);
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
  padding: calc(var(--status-bar-height, 0px) + 30rpx) var(--pety-page-gutter, 32rpx) calc(52rpx + env(safe-area-inset-bottom));
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
  color: var(--ui-muted);
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
  color: var(--ui-ink);
  font-size: 40rpx;
}

.relationship-copy {
  flex: 1;
  min-width: 0;
  margin: 0 22rpx;
}

.relationship-mode {
  display: block;
  color: var(--ui-muted);
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
  color: var(--ui-muted);
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
  color: var(--ui-ink);
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
  border-radius: 16px;
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
  color: var(--ui-muted);
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

/* Lumière: an account space with a quiet, consistent rhythm. */
.profile-page .profile-scroll{box-sizing:border-box;padding-left:36rpx;padding-right:36rpx;background:transparent;animation:none;}
.profile-page .profile-header{padding-top:calc(var(--status-bar-height,0px) + 34rpx);margin-bottom:26rpx;}.profile-page .page-kicker{font-size:19rpx;letter-spacing:2rpx;color:var(--ui-muted);}.profile-page .page-title{font-size:44rpx;font-weight:500;line-height:1.5;margin-top:8rpx;}.profile-page .icon-button{width:88rpx;height:88rpx;background:transparent;box-shadow:none;border:0;}
.profile-page .relationship-surface{padding:20rpx 0 32rpx;border:0;border-radius:0;background:transparent;box-shadow:none;}.profile-page .active-avatar{width:132rpx;height:132rpx;border-radius:50%;border:5rpx solid #fffdf8;box-shadow:none;}.profile-page .active-name{font-size:38rpx;font-weight:550;}.profile-page .active-desc,.profile-page .relationship-label{font-size:22rpx;line-height:1.6;}.profile-page .relationship-mode{font-size:19rpx;color:var(--ui-muted);}
.membership-banner{display:flex;align-items:center;gap:20rpx;width:100%;margin:0;padding:30rpx 26rpx;border-radius:26rpx;background:var(--ui-surface);text-align:left;line-height:1.5;box-shadow:none;}.membership-emblem{flex-shrink:0;}.membership-copy{flex:1;min-width:0;}.membership-title{display:block;color:var(--ui-ink);font-size:28rpx;font-weight:500;}.membership-subtitle{display:block;color:var(--ui-muted);font-size:19rpx;margin-top:6rpx;}.membership-link{flex-shrink:0;border-radius:32rpx;background:var(--ui-surface);color:var(--ui-ink);padding:16rpx 20rpx;font-size:21rpx;}.membership-banner::after{border:0;}
.profile-page .section-block{margin-top:34rpx;}.profile-page .section-title{font-size:25rpx;font-weight:500;}.profile-page .section-meta{font-size:20rpx;}.profile-page .section-label{margin-bottom:16rpx;color:var(--ui-muted);font-size:22rpx;letter-spacing:1rpx;}.profile-page .group-list{border:0;border-radius:16px;box-shadow:none;background:var(--pety-surface,#fcfaf6);}.profile-page .menu-item,.profile-page .account-row{min-height:110rpx;padding:22rpx 24rpx;border-color:rgba(90,94,78,.09);}.profile-page .menu-icon{width:44rpx;height:52rpx;border-radius:0;background:transparent;}.profile-page .menu-title{font-size:27rpx;}.profile-page .menu-desc{font-size:21rpx;line-height:1.6;}.profile-page .stats-strip{margin-top:28rpx;padding:20rpx 0;border:0;box-shadow:none;background:transparent;}.profile-page .stat-num{font-size:38rpx;font-weight:400;}.profile-page .pet-chip{box-shadow:none;border-radius:24rpx;}.profile-page .pet-chip-active{background:var(--ui-surface);border-color:var(--ui-line);}.profile-page .account-action{min-height:88rpx;height:auto;line-height:1.5;padding:16rpx 12rpx;}.profile-page .profile-footer{margin:46rpx 0 28rpx;font-size:19rpx;letter-spacing:1rpx;}

.profile-page .profile-scroll{padding-top:0;}.profile-page .pet-chip-active .pet-chip-name{color:var(--ui-ink);}.profile-page .pet-chip-active .pet-chip-status{color:var(--ui-ink);}.profile-page .pet-chip-active .pet-delete{background:var(--ui-surface);}.profile-page .pet-delete{width:60rpx;height:60rpx;}.profile-page .account-actions{flex-shrink:0;}.profile-page .account-action{width:auto;min-width:148rpx;padding:16rpx 22rpx;white-space:nowrap;font-size:23rpx;}
/* Match all account and utility rows to the same warm, quiet surface. */
.profile-page .profile-scroll{padding-left:20px;padding-right:20px;padding-bottom:0}.profile-content{padding-bottom:calc(32px + env(safe-area-inset-bottom))}.profile-page .profile-footer{margin-bottom:0}
.profile-page .section-block{margin-top:24px}.profile-page .section-label{display:block;margin:0 0 12px 4px;font-size:12px;line-height:20px;letter-spacing:1px}
.profile-page .group-list{border:1px solid rgba(221,228,202,.08);border-radius:20px;background:linear-gradient(120deg,#303027,#2b2b23)}
.profile-page .menu-item{position:relative;box-sizing:border-box;min-height:80px;padding:16px;border:0;gap:12px}.profile-page .menu-item + .menu-item:before{content:'';position:absolute;left:64px;right:16px;top:0;height:1px;background:rgba(221,228,202,.08)}
.profile-page .menu-icon{flex:0 0 36px;width:36px;height:36px;border-radius:12px;background:rgba(188,196,174,.06)}.profile-page .menu-copy{flex:1;min-width:0;margin:0}.profile-page .menu-title{font-size:calc(15px * var(--ui-font-scale,1));line-height:1.5;font-weight:500}.profile-page .menu-desc{margin-top:4px;font-size:calc(12px * var(--ui-font-scale,1));line-height:1.7;overflow-wrap:anywhere}
.account-settings :deep(.ui-settings-row){padding:18px 16px;min-height:84px;border-bottom:0}.account-settings :deep(.ui-settings-title){font-weight:500}.account-settings :deep(.ui-settings-description){margin-top:4px;line-height:1.7}
.account-storage{display:flex;align-items:flex-start;gap:10px;margin:0 16px 16px;padding:13px 14px;border-radius:12px;background:rgba(15,18,12,.18);color:var(--ui-muted)}.account-storage>uni-icons{margin-top:2px}.account-storage-copy{flex:1;min-width:0}.storage-title{display:block;font-size:calc(12px * var(--ui-font-scale,1));line-height:20px;color:#c9cebf}.account-settings .account-note{display:block;margin:3px 0 0;padding:0;color:var(--ui-muted);font-size:calc(11px * var(--ui-font-scale,1));line-height:1.7}
.profile-page .pet-chip-active{border-color:#899578;background:linear-gradient(145deg,#363a2d,#2e3026)}.profile-page .pet-delete{background:transparent}.profile-page .pet-chip-active .pet-delete{background:transparent}
/* #ifdef H5 */
.profile-page{min-height:calc(100vh - var(--window-bottom,0px))}.profile-page .profile-scroll{height:calc(100vh - var(--window-bottom,0px))}
/* #endif */
.pet-read-error{margin:18px 0;padding:20px;border:1px solid var(--ui-line);border-radius:18px;background:var(--ui-card)}
.pet-read-title{display:block;font-size:calc(18px * var(--ui-font-scale,1));line-height:1.5;color:var(--ui-ink);font-weight:600}
.pet-read-copy{display:block;margin:12px 0;font-size:calc(14px * var(--ui-font-scale,1));line-height:1.6;color:var(--ui-muted)}
.pet-read-retry{min-height:48px;margin:0;padding:12px;font-size:calc(15px * var(--ui-font-scale,1));line-height:1.5;background:var(--ui-accent);color:var(--ui-ink);border-radius:12px}
.creative-cleanup{box-sizing:border-box;width:100%;min-height:48px;margin:0 0 18px;padding:12px 16px;border:1px solid #697258;border-radius:12px;background:#34392c;color:#e5e8db;font-size:calc(14px * var(--ui-font-scale,1));line-height:1.6;white-space:normal;overflow-wrap:anywhere}
.creative-cleanup::after{border:0}
</style>
