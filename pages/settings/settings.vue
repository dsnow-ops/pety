<template>
  <view :class="['settings-page', themeClass, reduceMotion ? 'reduce-motion' : '']">
    <scroll-view scroll-y class="settings-scroll">
      <view class="settings-header">
        <button class="back-button" hover-class="tap-soft" @click="goBack">
          <uni-icons type="left" size="22" color="#4A443D"></uni-icons>
        </button>
        <view class="header-copy">
          <text class="page-title">设置</text>
          <text class="page-subtitle">账号、显示与归爪服务</text>
        </view>
        <view class="header-spacer"></view>
      </view>

      <view class="settings-group">
        <text class="group-title">账号与服务</text>
        <view class="group-surface">
          <view class="settings-row" hover-class="row-hover" @click="openAccountSecurity">
            <view class="row-copy">
              <text class="row-title">账号与安全</text>
              <text class="row-desc">{{ accountStatusText }}</text>
            </view>
            <uni-icons type="right" size="16" color="#A09A92"></uni-icons>
          </view>
          <view class="settings-row" hover-class="row-hover" @click="showCloudBackupInfo">
            <view class="row-copy">
              <text class="row-title">云端备份与同步</text>
              <text class="row-desc">当前以本地存储为主，尚未接入自动云备份</text>
            </view>
            <uni-icons type="right" size="16" color="#A09A92"></uni-icons>
          </view>
          <view class="settings-row" hover-class="row-hover" @click="showMembershipInfo">
            <view class="row-copy">
              <text class="row-title">会员与权益</text>
              <text class="row-desc">{{ membershipStatusText }}</text>
            </view>
            <uni-icons type="right" size="16" color="#A09A92"></uni-icons>
          </view>
          <view v-if="userProfile.loggedIn" class="settings-row" hover-class="row-hover" @click="confirmLogout">
            <view class="row-copy">
              <text class="row-title">退出登录</text>
              <text class="row-desc">退出后，本机宠物与记录仍会保留</text>
            </view>
            <uni-icons type="right" size="16" color="#A09A92"></uni-icons>
          </view>
        </view>
      </view>

      <view class="settings-group">
        <text class="group-title">通知与权限</text>
        <view class="group-surface">
          <view class="settings-row" hover-class="row-hover" @click="showNotificationInfo">
            <view class="row-copy">
              <text class="row-title">通知设置</text>
              <text class="row-desc">当前版本尚未接入主动推送服务</text>
            </view>
            <text class="row-status">未接入</text>
          </view>
          <view class="settings-row" hover-class="row-hover" @click="showPermissionInfo">
            <view class="row-copy">
              <text class="row-title">相机与相册权限</text>
              <text class="row-desc">仅在选择或拍摄照片时由系统询问</text>
            </view>
            <uni-icons type="right" size="16" color="#A09A92"></uni-icons>
          </view>
          <view class="settings-row" hover-class="row-hover" @click="openSystemSettings">
            <view class="row-copy">
              <text class="row-title">前往系统设置</text>
              <text class="row-desc">查看当前 App 的系统权限状态</text>
            </view>
            <uni-icons type="right" size="16" color="#A09A92"></uni-icons>
          </view>
        </view>
      </view>

      <view class="settings-group">
        <text class="group-title">界面与显示</text>
        <view class="group-surface">
          <view class="settings-row">
            <view class="row-copy">
              <text class="row-title">当前显示模式</text>
              <text class="row-desc">跟随当前宠物的关系模式，不建立额外主题开关</text>
            </view>
            <text class="row-status">{{ displayModeText }}</text>
          </view>
          <view class="settings-row" hover-class="row-hover" @click="showReadabilityInfo">
            <view class="row-copy">
              <text class="row-title">字体与可读性</text>
              <text class="row-desc">使用系统字体，并跟随设备文字渲染能力</text>
            </view>
            <uni-icons type="right" size="16" color="#A09A92"></uni-icons>
          </view>
          <view class="settings-row">
            <view class="row-copy">
              <text class="row-title">减少动态效果</text>
              <text class="row-desc">保存为本机偏好，页面会逐步适配</text>
            </view>
            <switch
              :checked="reduceMotion"
              color="#6D5945"
              style="transform: scale(0.82)"
              @change="setReduceMotion"
            />
          </view>
        </view>
      </view>

      <view class="settings-group">
        <text class="group-title">归爪特色</text>
        <view class="group-surface">
          <view class="settings-row" hover-class="row-hover" @click="openCurrentPetArchive">
            <view class="row-copy">
              <text class="row-title">当前宠物与关系</text>
              <text class="row-desc">{{ petRelationText }}</text>
            </view>
            <uni-icons type="right" size="16" color="#A09A92"></uni-icons>
          </view>
          <view class="settings-row" hover-class="row-hover" @click="toggleMemorialMode">
            <view class="row-copy">
              <text class="row-title">温柔纪念模式</text>
              <text class="row-desc">{{ memorialModeText }}</text>
            </view>
            <text class="row-status">{{ isMemorial ? '已开启' : '未开启' }}</text>
          </view>
          <view class="settings-row" hover-class="row-hover" @click="openMemorialPersona">
            <view class="row-copy">
              <text class="row-title">让归爪更像他/她</text>
              <text class="row-desc">补充真实的小习惯、表达方式和边界</text>
            </view>
            <uni-icons type="right" size="16" color="#A09A92"></uni-icons>
          </view>
          <view class="settings-row" hover-class="row-hover" @click="openAvatarManager">
            <view class="row-copy">
              <text class="row-title">宠物形象管理</text>
              <text class="row-desc">查看或重新生成当前宠物的 mock 形象</text>
            </view>
            <uni-icons type="right" size="16" color="#A09A92"></uni-icons>
          </view>
          <view class="settings-row" hover-class="row-hover" @click="showAiGuide">
            <view class="row-copy">
              <text class="row-title">AI 问诊使用说明</text>
              <text class="row-desc">了解照护建议的能力与医疗边界</text>
            </view>
            <uni-icons type="right" size="16" color="#A09A92"></uni-icons>
          </view>
          <view class="settings-row" hover-class="row-hover" @click="showDataExplanation">
            <view class="row-copy">
              <text class="row-title">对话与记录数据说明</text>
              <text class="row-desc">查看本地数据、云函数调用与隐私范围</text>
            </view>
            <uni-icons type="right" size="16" color="#A09A92"></uni-icons>
          </view>
        </view>
      </view>

      <view class="settings-group">
        <text class="group-title">数据与存储</text>
        <view class="group-surface">
          <view class="settings-row">
            <view class="row-copy">
              <text class="row-title">当前存储状态</text>
              <text class="row-desc">宠物、聊天、记录和档案主要保存在本机</text>
            </view>
            <text class="row-status">{{ storageSizeText }}</text>
          </view>
          <view class="settings-row" hover-class="row-hover" @click="clearTemporaryCache">
            <view class="row-copy">
              <text class="row-title">清理临时缓存</text>
              <text class="row-desc">{{ temporaryCacheText }}</text>
            </view>
            <uni-icons type="right" size="16" color="#A09A92"></uni-icons>
          </view>
        </view>
      </view>

      <view class="settings-group">
        <text class="group-title">帮助与反馈</text>
        <view class="group-surface">
          <view class="settings-row" hover-class="row-hover" @click="showFaq = !showFaq">
            <view class="row-copy">
              <text class="row-title">常见问题</text>
              <text class="row-desc">陪伴、纪念、数据与账号的真实说明</text>
            </view>
            <uni-icons :type="showFaq ? 'up' : 'down'" size="16" color="#A09A92"></uni-icons>
          </view>
          <view v-if="showFaq" class="faq-list">
            <view
              v-for="(item, index) in faqItems"
              :key="item.question"
              class="faq-row"
              hover-class="row-hover"
              @click="showFaqAnswer(item)"
            >
              <text class="faq-index">{{ index + 1 }}</text>
              <text class="faq-question">{{ item.question }}</text>
              <uni-icons type="right" size="14" color="#A09A92"></uni-icons>
            </view>
          </view>
          <view class="settings-row" hover-class="row-hover" @click="openFeedback">
            <view class="row-copy">
              <text class="row-title">归爪留言信箱</text>
              <text class="row-desc">建议、问题和想告诉归爪的话</text>
            </view>
            <uni-icons type="right" size="16" color="#A09A92"></uni-icons>
          </view>
          <view class="settings-row" hover-class="row-hover" @click="openFeedback">
            <view class="row-copy">
              <text class="row-title">功能建议与问题反馈</text>
              <text class="row-desc">可附带最多三张图片，私下提交给开发者</text>
            </view>
            <uni-icons type="right" size="16" color="#A09A92"></uni-icons>
          </view>
        </view>
      </view>

      <view class="settings-group">
        <text class="group-title">关于与法律</text>
        <view class="group-surface">
          <view class="settings-row" hover-class="row-hover" @click="showAbout">
            <view class="row-copy">
              <text class="row-title">关于归爪</text>
              <text class="row-desc">Lumière Pet，温柔保存人与宠物的关系</text>
            </view>
            <uni-icons type="right" size="16" color="#A09A92"></uni-icons>
          </view>
          <view class="settings-row">
            <view class="row-copy">
              <text class="row-title">当前版本</text>
              <text class="row-desc">应用版本信息</text>
            </view>
            <text class="row-status">1.0.0</text>
          </view>
          <view
            v-for="item in legalItems"
            :key="item.title"
            class="settings-row"
            hover-class="row-hover"
            @click="showLegalDraft(item)"
          >
            <view class="row-copy">
              <text class="row-title">{{ item.title }}</text>
              <text class="row-desc">{{ item.desc }}</text>
            </view>
            <uni-icons type="right" size="16" color="#A09A92"></uni-icons>
          </view>
        </view>
      </view>

      <view class="settings-group danger-group">
        <text class="group-title">账号操作</text>
        <view class="group-surface">
          <view class="settings-row" hover-class="row-hover" @click="showDeleteAccountInfo">
            <view class="row-copy">
              <text class="row-title danger-text">注销账号</text>
              <text class="row-desc">当前版本尚未开放 App 内服务端注销</text>
            </view>
            <uni-icons type="right" size="16" color="#A65353"></uni-icons>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import { getCurrentUser } from '../../common/auth-store.js';
import { logoutUniIdAccount } from '../../common/auth-session.js';
import { getActivePet, updateActivePet } from '../../common/pet-store.js';
import {
  getOwnerRelationLabel,
  getPetRelationshipStage,
  getRelationshipConfig,
  getRelationshipThemeClass,
  isMemorialMode,
  withRelationshipStage
} from '../../common/relationship-config.js';
import { mediumHaptic } from '../../common/haptics.js';

const REDUCE_MOTION_KEY = 'pety_reduce_motion_v1';
const CACHE_STORAGE_KEYS = [];
const PROTECTED_STORAGE_KEYS = [
  'my_pets_list',
  'current_active_pet_id',
  'pet_name',
  'pet_photo',
  'pet_mode',
  'pety_membership_plan',
  'pety_user_profile_cache',
  'uni_id_token',
  'uni_id_token_expired',
  'uni-id-pages-userInfo',
  'product_feedback_draft_v1',
  'product_feedback_device_v1',
  'guizhua_onboarding_seen',
  'guizhua_onboarding_pending',
  REDUCE_MOTION_KEY
];
const PROTECTED_STORAGE_PREFIXES = [
  'chat_history_',
  'chat_history_legacy_',
  'chat_history_stage_migrated_',
  'pet_diaries_',
  'pet_profile_',
  'consultation_records_',
  'memorial_owner_call_prompt_seen_',
  'memorial_persona_'
];
const LOGIN_PAGE = '/uni_modules/uni-id-pages/pages/login/login-withpwd';
const ACCOUNT_PAGE = '/uni_modules/uni-id-pages/pages/userinfo/userinfo';

const FAQ_ITEMS = [
  { question: '陪伴模式和怀念模式有什么区别？', answer: '陪伴模式用于日常照护、记录和问诊准备；怀念模式对应 deceased 阶段，会切换文案、记录语义与对话身份，但不改变页面主结构。' },
  { question: 'AI 问诊能否代替兽医？', answer: '不能。AI 只提供观察、记录和就医准备建议；持续异常、疼痛、呼吸困难、抽搐等高风险情况应尽快联系专业兽医。' },
  { question: '如何修改我和宠物的关系？', answer: '进入当前宠物档案，在“你和宠物的关系”中选择爸爸、妈妈、家人等，也可以填写自定义关系。' },
  { question: '如何修改宠物称呼？', answer: '关系称呼与自定义称呼都在宠物档案中维护。陪伴模式的助手只会在需要时使用“宠物名的关系”，怀念模式可直接使用关系称呼。' },
  { question: '如何添加或切换宠物？', answer: '在“我的归爪”的宠物列表中切换；添加数量遵循当前普通用户、会员与开发测试规则。' },
  { question: '普通用户和会员有什么区别？', answer: '当前产品规则会在会员说明中展示。支付和完整云端会员校验尚未在本版本开放，不会伪装成已生效能力。' },
  { question: '为什么 AI 回复可能不准确？', answer: 'AI 可能误解上下文或给出不完整建议。请核对宠物真实状态，医疗问题以兽医判断为准。' },
  { question: '聊天内容和宠物照片如何保存？', answer: '聊天、宠物档案和多数记录主要保存在当前设备；主动选择的反馈图片会按留言信箱流程上传云存储。' },
  { question: '本地数据与云端备份有什么区别？', answer: '本地数据只存在当前设备。自动云端备份尚未接入，因此不能承诺换机后自动恢复。' },
  { question: '换手机后数据是否会自动出现？', answer: '当前不会自动出现。请不要卸载 App 或清除应用数据；正式云备份能力需后续单独实现。' },
  { question: '删除宠物后能否恢复？', answer: '当前删除会同时移除该宠物的本地日历、聊天和档案记录，没有回收站，请谨慎确认。' },
  { question: '怀念模式是否表示宠物真实复活？', answer: '不是。怀念对话是一种基于资料和回忆的数字陪伴表达，不代表宠物真实复活，也不应替代现实支持。' },
  { question: '为什么通知没有出现？', answer: '当前版本尚未接入主动推送服务。系统权限页面只能查看权限，不能让未接入的通知服务自动生效。' },
  { question: '如何提交问题和截图？', answer: '进入“归爪留言信箱”，填写至少 10 个字，并可主动选择最多 3 张图片后提交。' },
  { question: '如何退出登录和注销账号？', answer: '已登录用户可在设置中退出。服务端账号注销流程尚未开放，当前不会用清空本地 Storage 冒充注销。' }
];

export default {
  data() {
    return {
      activePet: null,
      userProfile: getCurrentUser(),
      reduceMotion: Boolean(uni.getStorageSync(REDUCE_MOTION_KEY)),
      storageSizeKb: 0,
      showFaq: false,
      faqItems: FAQ_ITEMS,
      legalItems: [
        { title: '隐私政策', desc: '内部产品草案，正式发布前需单独审核' },
        { title: '用户协议', desc: '内部产品草案，正式发布前需单独审核' },
        { title: '使用条款', desc: '内部产品草案，正式发布前需单独审核' },
        { title: 'AI 内容与医疗免责声明', desc: 'AI 不替代兽医诊断或治疗' },
        { title: '第三方服务说明', desc: '云服务与 AI 服务边界说明' }
      ]
    };
  },
  computed: {
    relationshipStage() {
      return getPetRelationshipStage(this.activePet);
    },
    themeClass() {
      return getRelationshipThemeClass(this.relationshipStage);
    },
    isMemorial() {
      return isMemorialMode(this.relationshipStage);
    },
    accountStatusText() {
      return this.userProfile.loggedIn
        ? `已登录${this.userProfile.userId ? ` · ${this.maskUserId(this.userProfile.userId)}` : ''}`
        : '当前为游客，本地数据仍保存在这台设备';
    },
    membershipStatusText() {
      if (!this.userProfile.loggedIn) return '游客状态 · 当前按普通用户规则使用';
      return ['plus', 'pro'].includes(this.userProfile.plan) ? '会员状态已记录' : '当前为普通用户';
    },
    displayModeText() {
      return this.isMemorial ? '温柔纪念' : '正在陪伴';
    },
    petRelationText() {
      if (!this.activePet) return '尚未建立宠物档案';
      const relation = getOwnerRelationLabel(this.activePet);
      return relation ? `${this.activePet.name} · ${relation}` : `${this.activePet.name} · 尚未设置关系`;
    },
    memorialModeText() {
      if (!this.activePet) return '请先建立宠物档案';
      return this.isMemorial
        ? '文案、记录语义和对话身份已切换，可恢复陪伴模式'
        : '由你主动开启，不会删除任何档案和记录';
    },
    storageSizeText() {
      if (!this.storageSizeKb) return '少于 1 KB';
      if (this.storageSizeKb < 1024) return `${this.storageSizeKb} KB`;
      return `${(this.storageSizeKb / 1024).toFixed(1)} MB`;
    },
    temporaryCacheText() {
      return CACHE_STORAGE_KEYS.length ? '仅清理明确列入白名单的非核心缓存' : '暂无可清理的临时缓存';
    }
  },
  onShow() {
    this.activePet = getActivePet();
    this.userProfile = getCurrentUser();
    this.refreshStorageSize();
  },
  methods: {
    maskUserId(userId) {
      const value = String(userId || '');
      if (value.length <= 8) return value;
      return `${value.slice(0, 4)}...${value.slice(-4)}`;
    },
    refreshStorageSize() {
      try {
        const info = uni.getStorageInfoSync();
        this.storageSizeKb = Number(info.currentSize || 0);
      } catch (error) {
        this.storageSizeKb = 0;
      }
    },
    goBack() {
      const pages = getCurrentPages();
      if (pages.length > 1) {
        uni.navigateBack();
        return;
      }
      uni.switchTab({ url: '/pages/profile/profile' });
    },
    showInfo(title, content) {
      uni.showModal({
        title,
        content,
        showCancel: false,
        confirmText: '知道了',
        confirmColor: '#6D5945'
      });
    },
    openAccountSecurity() {
      uni.navigateTo({
        url: this.userProfile.loggedIn ? ACCOUNT_PAGE : LOGIN_PAGE,
        fail: () => this.showInfo('账号与安全', '账号页面暂不可用，请稍后再试。')
      });
    },
    showCloudBackupInfo() {
      this.showInfo('云端备份与同步', '当前宠物、聊天和记录主要保存在本机，自动云备份尚未接入。换机或清除应用数据前，请留意本地数据无法自动恢复。');
    },
    showMembershipInfo() {
      this.showInfo('会员与权益', '当前规则：普通用户可保留 1 只宠物，每天 3 次 AI 问诊；会员规则保持现状。支付和完整云端会员校验尚未在本页接入。');
    },
    confirmLogout() {
      uni.showModal({
        title: '退出登录',
        content: '退出账号不会删除本机的宠物档案、聊天和记录。',
        cancelText: '取消',
        confirmText: '退出',
        confirmColor: '#A65353',
        success: async (res) => {
          if (!res.confirm) return;
          this.userProfile = await logoutUniIdAccount();
          uni.showToast({ title: '已退出账号，本地记录仍在', icon: 'none' });
        }
      });
    },
    showNotificationInfo() {
      this.showInfo('通知设置', '当前版本尚未接入主动推送服务，因此这里不提供无效的通知开关。后续接入时会在需要的场景中明确请求授权。');
    },
    showPermissionInfo() {
      this.showInfo('相机与相册权限', '归爪只会在你主动拍照或选择照片时请求对应权限，不会在后台读取相册。');
    },
    openSystemSettings() {
      // #ifdef APP-PLUS
      try {
        if (typeof uni.openAppAuthorizeSetting === 'function') {
          uni.openAppAuthorizeSetting();
          return;
        }
        if (typeof plus !== 'undefined' && plus.runtime && typeof plus.runtime.openSystemSettings === 'function') {
          plus.runtime.openSystemSettings();
          return;
        }
      } catch (error) {
        // Fall through to the honest platform notice below.
      }
      // #endif
      this.showInfo('系统设置', '当前运行端无法直接打开 App 权限页，请在设备系统设置中找到“归爪”查看权限。');
    },
    showReadabilityInfo() {
      this.showInfo('字体与可读性', '归爪使用设备系统字体，避免依赖网络字体。全局字号调节尚未接入，本轮不会放置无效开关。');
    },
    setReduceMotion(event) {
      this.reduceMotion = Boolean(event.detail.value);
      uni.setStorageSync(REDUCE_MOTION_KEY, this.reduceMotion);
      uni.showToast({ title: '已保存为本机偏好', icon: 'none' });
    },
    openCurrentPetArchive() {
      if (!this.activePet) {
        uni.showToast({ title: '请先建立宠物档案', icon: 'none' });
        return;
      }
      uni.navigateTo({ url: `/pages/archive/archive?petId=${encodeURIComponent(this.activePet.id)}&from=settings` });
    },
    toggleMemorialMode() {
      if (!this.activePet) {
        uni.showToast({ title: '请先建立宠物档案', icon: 'none' });
        return;
      }
      if (this.isMemorial) {
        uni.showModal({
          title: '恢复为陪伴模式',
          content: '这会把文案、记录语义和聊天身份恢复为陪伴模式，不会删除任何档案和记录。',
          cancelText: '先不恢复',
          confirmText: '恢复陪伴',
          confirmColor: '#6D5945',
          success: (res) => {
            if (res.confirm) this.updateRelationshipMode('current', '已恢复为陪伴模式');
          }
        });
        return;
      }
      const memorialConfig = getRelationshipConfig('deceased');
      uni.showModal({
        title: memorialConfig.modeConfirmTitle,
        content: memorialConfig.modeConfirmText,
        cancelText: '先不进入',
        confirmText: '进入纪念',
        confirmColor: '#62677A',
        success: (res) => {
          if (res.confirm) this.updateRelationshipMode('deceased', '纪念模式已开启');
        }
      });
    },
    updateRelationshipMode(stage, toastTitle) {
      const updatedPet = updateActivePet(withRelationshipStage({}, stage));
      if (updatedPet) this.activePet = updatedPet;
      mediumHaptic();
      uni.showToast({ title: toastTitle, icon: 'none' });
    },
    openAvatarManager() {
      if (!this.activePet) {
        uni.showToast({ title: '请先建立宠物档案', icon: 'none' });
        return;
      }
      uni.navigateTo({ url: `/pages/avatar-generate/avatar-generate?petId=${encodeURIComponent(this.activePet.id)}` });
    },
    openMemorialPersona() {
      if (!this.activePet) {
        uni.showToast({ title: '请先建立宠物档案', icon: 'none' });
        return;
      }
      if (!this.isMemorial) {
        uni.showToast({ title: '请先开启温柔纪念模式', icon: 'none' });
        return;
      }
      uni.navigateTo({ url: `/pages/memorial-persona/memorial-persona?petId=${encodeURIComponent(this.activePet.id)}` });
    },
    showAiGuide() {
      this.showInfo('AI 问诊使用说明', '陪伴模式可帮助整理症状、观察点与就医前问题，但不能替代兽医诊断或治疗。高风险症状请尽快就医。');
    },
    showDataExplanation() {
      this.showInfo('对话与记录数据', '宠物档案、聊天与日历记录主要保存在本机。AI 对话会把当前问题和必要的宠物上下文发送给 api_deepseek；不会自动上传完整照片、联系人、支付信息或无关文件。');
    },
    clearTemporaryCache() {
      if (!CACHE_STORAGE_KEYS.length) {
        uni.showToast({ title: '暂无可清理的临时缓存', icon: 'none' });
        return;
      }
      const safeCacheKeys = CACHE_STORAGE_KEYS.filter(key => {
        if (PROTECTED_STORAGE_KEYS.includes(key)) return false;
        return !PROTECTED_STORAGE_PREFIXES.some(prefix => key.startsWith(prefix));
      });
      if (!safeCacheKeys.length) {
        uni.showToast({ title: '暂无可清理的临时缓存', icon: 'none' });
        return;
      }
      uni.showModal({
        title: '清理临时缓存',
        content: '只会清理明确列入白名单的非核心缓存，不会删除宠物、聊天、日历、档案、照片、账号或留言。',
        cancelText: '取消',
        confirmText: '继续',
        confirmColor: '#A65353',
        success: (firstResult) => {
          if (!firstResult.confirm) return;
          uni.showModal({
            title: '再次确认',
            content: '确定清理这些临时缓存吗？',
            cancelText: '取消',
            confirmText: '清理',
            confirmColor: '#A65353',
            success: (secondResult) => {
              if (!secondResult.confirm) return;
              safeCacheKeys.forEach(key => uni.removeStorageSync(key));
              this.refreshStorageSize();
              uni.showToast({ title: '临时缓存已清理', icon: 'none' });
            }
          });
        }
      });
    },
    showFaqAnswer(item) {
      this.showInfo(item.question, item.answer);
    },
    openFeedback() {
      uni.navigateTo({ url: '/pages/feedback/feedback' });
    },
    showAbout() {
      this.showInfo('关于归爪', '归爪 Lumière Pet 是一款默认陪伴、可主动进入温柔纪念模式的宠物关系档案 App。当前版本专注于本地记录、对话与宠物档案。');
    },
    showLegalDraft(item) {
      const copy = {
        '隐私政策': '当前为内部产品草案承载入口，正式发布前需要单独完成隐私条款、数据清单与法务审核。',
        '用户协议': '当前为内部产品草案承载入口，正式发布前需要结合账号、会员、云存储与 AI 服务能力单独审核。',
        '使用条款': '请仅将归爪用于合法的宠物记录与陪伴场景，不上传密码、支付信息或无关隐私内容。正式条款仍需单独审核。',
        'AI 内容与医疗免责声明': 'AI 输出可能不准确，不能替代兽医诊断、处方或治疗。遇到持续异常或高风险症状，请尽快寻求专业帮助。',
        '第三方服务说明': '当前可能使用 uniCloud 与 DeepSeek 承载账号、反馈或 AI 对话。实际数据范围以正式隐私政策和发布配置为准。'
      };
      this.showInfo(item.title, copy[item.title] || '该内容仍处于内部产品草案阶段，正式发布前需单独审核。');
    },
    showDeleteAccountInfo() {
      this.showInfo('注销账号', '当前版本尚未开放 App 内服务端账号注销。不会用清空本地 Storage 冒充注销，也不会在这里删除宠物数据。正式注销流程需与账号服务一起单独实现和审核。');
    }
  }
};
</script>

<style scoped>
.settings-page {
  min-height: 100vh;
  background: var(--pety-page-bg, #F5F2EC);
  color: var(--pety-text, #2F2A24);
}

.settings-scroll {
  height: 100vh;
  padding: 72rpx var(--pety-page-gutter, 32rpx) calc(48rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  animation: settingsFadeUp 360ms ease both;
}

.settings-header,
.settings-row,
.faq-row {
  display: flex;
  align-items: center;
}

.settings-header {
  justify-content: space-between;
  margin-bottom: 38rpx;
}

.back-button,
.header-spacer {
  width: 68rpx;
  height: 68rpx;
}

.back-button {
  padding: 0;
  margin: 0;
  border-radius: 50%;
  background: var(--pety-surface, #FCFAF6);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--pety-shadow);
}

.back-button::after {
  border: none;
}

.header-copy {
  text-align: center;
}

.page-title {
  display: block;
  font-size: 38rpx;
  font-weight: 600;
  line-height: 1.2;
}

.page-subtitle {
  display: block;
  margin-top: 8rpx;
  color: var(--pety-text-secondary, #786F64);
  font-size: 22rpx;
  line-height: 1.35;
}

.settings-group {
  margin-top: 34rpx;
}

.settings-group:first-of-type {
  margin-top: 0;
}

.group-title {
  display: block;
  margin: 0 10rpx 14rpx;
  color: var(--pety-text-secondary, #786F64);
  font-size: 22rpx;
  font-weight: 600;
  line-height: 1.3;
}

.group-surface {
  overflow: hidden;
  border: 1rpx solid var(--pety-rule, #E4DED4);
  border-radius: var(--pety-radius, 24rpx);
  background: var(--pety-surface, #FCFAF6);
  box-shadow: var(--pety-shadow);
}

.settings-row {
  min-height: 96rpx;
  padding: 20rpx 24rpx;
  border-bottom: 1rpx solid var(--pety-rule, #E4DED4);
  box-sizing: border-box;
  transition: transform 140ms ease, opacity 140ms ease, background 140ms ease;
}

.settings-row:last-child {
  border-bottom: none;
}

.row-copy {
  flex: 1;
  min-width: 0;
  padding-right: 18rpx;
}

.row-title {
  display: block;
  color: var(--pety-text, #2F2A24);
  font-size: 28rpx;
  font-weight: 500;
  line-height: 1.3;
}

.row-desc {
  display: block;
  margin-top: 6rpx;
  color: var(--pety-text-secondary, #786F64);
  font-size: 21rpx;
  line-height: 1.45;
}

.row-status {
  max-width: 180rpx;
  color: var(--pety-primary, #6D5945);
  font-size: 22rpx;
  line-height: 1.3;
  text-align: right;
}

.faq-list {
  border-bottom: 1rpx solid var(--pety-rule, #E4DED4);
  background: var(--pety-surface-muted, #EEE9E0);
}

.faq-row {
  min-height: 82rpx;
  padding: 16rpx 24rpx;
  border-bottom: 1rpx solid var(--pety-rule, #E4DED4);
}

.faq-row:last-child {
  border-bottom: none;
}

.faq-index {
  width: 42rpx;
  color: var(--pety-primary, #6D5945);
  font-size: 20rpx;
}

.faq-question {
  flex: 1;
  padding-right: 14rpx;
  color: var(--pety-text, #2F2A24);
  font-size: 24rpx;
  line-height: 1.4;
}

.danger-group {
  margin-bottom: 10rpx;
}

.danger-text {
  color: var(--pety-danger, #A65353);
}

.row-hover {
  background: var(--pety-surface-muted, #EEE9E0);
  opacity: 0.88;
  transform: scale(0.995);
}

.tap-soft {
  opacity: 0.82;
  transform: scale(0.94);
}

@keyframes settingsFadeUp {
  from {
    opacity: 0;
    transform: translateY(12rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.reduce-motion .settings-scroll {
  animation: none;
}
</style>
