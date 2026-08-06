<template>
  <view :class="['chat-page', themeClass, reduceMotion ? 'reduce-motion' : '']">
    <view class="chat-header">
      <view
        class="pet-mini memorial-avatar-link"
        hover-class="memorial-avatar-link-hover"
        @click.stop="openPetArchive(activePetId)"
      >
        <image v-if="headerPetAvatar" :src="headerPetAvatar" class="pet-mini-img" mode="aspectFill"></image>
        <text v-else class="pet-mini-text">归</text>
      </view>
      <view class="header-copy">
        <text class="header-title">{{ uiText.title }}</text>
        <text class="header-subtitle">{{ uiText.subtitle }}</text>
      </view>
    </view>

    <scroll-view class="chat-scroll" scroll-y :scroll-into-view="scrollToView" scroll-with-animation>
      <view class="message-list">
        <view v-if="promptPanelCollapsed" class="prompt-pill" hover-class="prompt-pill-hover" @click="promptPanelCollapsed = false">
          <uni-icons type="help" size="16" color="#8C7557"></uni-icons>
          <text>{{ uiText.collapsedText }}</text>
        </view>

        <view v-else class="prompt-panel">
          <view class="prompt-head">
            <view>
              <text class="prompt-kicker">{{ uiText.promptKicker }}</text>
              <text class="prompt-title">{{ uiText.promptTitle }}</text>
            </view>
            <button class="collapse-btn" hover-class="collapse-btn-hover" @click="promptPanelCollapsed = true">
              <uni-icons type="up" size="18" color="#6B5D4D"></uni-icons>
            </button>
          </view>
          <view class="suggestion-list">
            <view
              v-for="suggestion in promptSuggestions"
              :key="suggestion"
              class="suggestion-item"
              hover-class="suggestion-item-hover"
              @click="applySuggestion(suggestion)"
            >
              <uni-icons type="chatbubble" size="16" color="#8C7557"></uni-icons>
              <text>{{ suggestion }}</text>
            </view>
          </view>
        </view>

        <view v-if="!isMemorialMode && contextBadges.length" class="context-card">
          <text class="context-title">本次会参考</text>
          <view class="context-badges">
            <view v-for="badge in contextBadges" :key="badge" class="context-badge">
              <text>{{ badge }}</text>
            </view>
          </view>
        </view>

        <view
          v-for="msg in messageList"
          :key="msg.id"
          :id="'message-' + msg.id"
          :class="['message-item', msg.type === 'user' ? 'message-right' : 'message-left']"
        >
          <view
            :class="['avatar', msg.type !== 'user' && isMemorialMode ? 'memorial-avatar-link' : '']"
            :hover-class="msg.type !== 'user' && isMemorialMode ? 'memorial-avatar-link-hover' : 'none'"
            @click.stop="openMemorialMessageArchive(msg)"
          >
            <image
              v-if="msg.type !== 'user' && isMemorialMode"
              :src="memorialPetAvatar"
              class="message-avatar-img"
              mode="aspectFill"
            ></image>
            <text v-else>{{ msg.type === 'user' ? '我' : uiText.aiAvatar }}</text>
          </view>
          <view class="message-content">
            <view class="message-bubble" @longpress="copyText(msg.content)">
              <image
                v-if="msg.imageUrl"
                :src="msg.imageUrl"
                class="chat-image"
                mode="widthFix"
                @click="previewImg(msg.imageUrl)"
              ></image>
              <text v-if="msg.content" class="msg-text">{{ msg.content }}</text>
            </view>
            <text v-if="!isMemorialMode && msg.medicalNotice" class="medical-notice">
              AI 建议仅供日常照护参考，不能替代兽医诊断。
            </text>
            <view
              v-if="isMemorialMode && msg.type === 'user'"
              :class="['paw-status', 'paw-' + memorialPawType, msg.deliveryState === 'unread' ? 'paw-unread' : 'paw-read']"
            >
              <view class="paw-toe paw-toe-1"></view>
              <view class="paw-toe paw-toe-2"></view>
              <view class="paw-toe paw-toe-3"></view>
              <view class="paw-toe paw-toe-4"></view>
              <view class="paw-pad"></view>
            </view>
          </view>
        </view>

        <view v-if="isTyping" id="message-typing" class="message-item message-left">
          <view
            :class="['avatar', isMemorialMode ? 'memorial-avatar-link' : '']"
            :hover-class="isMemorialMode ? 'memorial-avatar-link-hover' : 'none'"
            @click.stop="openMemorialPetArchive(activePetId)"
          >
            <image
              v-if="isMemorialMode"
              :src="memorialPetAvatar"
              class="message-avatar-img"
              mode="aspectFill"
            ></image>
            <text v-else>{{ uiText.aiAvatar }}</text>
          </view>
          <view class="message-bubble typing-bubble">
            <text v-if="isMemorialMode" class="typing-label">{{ memorialTypingLabel }}</text>
            <view class="typing-dots">
              <view class="typing-dot"></view>
              <view class="typing-dot"></view>
              <view class="typing-dot"></view>
            </view>
          </view>
        </view>
        <view class="scroll-bottom-padding"></view>
      </view>
    </scroll-view>

    <scroll-view scroll-x class="service-strip" :show-scrollbar="false">
      <view class="service-tabs">
        <button
          v-for="item in serviceActions"
          :key="item.key"
          class="service-tab"
          hover-class="service-tab-hover"
          @click="handleServiceAction(item.key)"
        >
          <uni-icons :type="item.icon" size="18" color="#302A23"></uni-icons>
          <text>{{ item.title }}</text>
        </button>
      </view>
    </scroll-view>

    <view class="input-bar">
      <button
        v-if="showCameraButton"
        class="round-tool"
        hover-class="tool-hover"
        @click="chooseImage"
      >
        <uni-icons type="camera" size="21" color="#6B5D4D"></uni-icons>
      </button>
      <textarea
        class="chat-input"
        v-model="inputText"
        :placeholder="uiText.placeholder"
        auto-height
        :show-confirm-bar="false"
        cursor-spacing="20"
      ></textarea>
      <button
        :class="['send-btn', isSending ? 'send-btn-disabled' : '']"
        hover-class="send-btn-hover"
        :disabled="isSending"
        @click="sendMessage(null)"
      >
        <text v-if="isSending" class="send-loading-text">{{ isMemorialMode ? '等一等' : '整理中' }}</text>
        <uni-icons v-else type="paperplane-filled" size="20" color="#FBFAF6"></uni-icons>
      </button>
    </view>

    <view v-if="showOwnerCallSetup" class="owner-call-mask" @click.stop>
      <view class="owner-call-sheet">
        <text class="owner-call-title">你希望我怎么叫你？</text>
        <text class="owner-call-subtitle">选一个我们熟悉的称呼，以后我会这样叫你。</text>
        <view class="owner-call-options">
          <button
            v-for="option in ownerCallOptions"
            :key="option.key"
            :class="['owner-call-option', selectedOwnerCallType === option.key ? 'owner-call-option-active' : '']"
            hover-class="owner-call-option-hover"
            @click="selectOwnerCallOption(option)"
          >
            {{ option.label }}
          </button>
        </view>
        <input
          v-if="selectedOwnerCallType === 'custom'"
          v-model="customOwnerCall"
          class="owner-call-input"
          maxlength="20"
          placeholder="输入想让我使用的称呼"
          placeholder-style="color:#9995A1"
        />
        <view class="owner-call-actions">
          <button class="owner-call-later" hover-class="owner-call-action-hover" @click="skipOwnerCallSetup">暂时跳过</button>
          <button class="owner-call-save" hover-class="owner-call-action-hover" @click="saveOwnerCall">保存称呼</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { getActivePet } from '../../common/pet-store.js';
import { buildDiaryContext, getDiaryMap } from '../../common/diary-store.js';
import { buildProfileContext, getGenderLabel, getPetProfile, getSpeciesLabel } from '../../common/profile-store.js';
import { saveConsultationRecord } from '../../common/consultation-store.js';
import {
  buildConfirmedMemorialPersonaContext,
  buildChatConversationHistory,
  hasMedicalNoticeShown,
  sanitizeChatPlainText
} from '../../common/chat-context-builder.js';
import {
  getChatContextId,
  loadChatSession,
  saveChatSession
} from '../../common/chat-session-store.js';
import {
  getMinimumTypingDelay,
  getPawType,
  getReadDelay,
  getTypingLabel
} from '../../common/memorial-chat-interaction.js';
import {
  getMemorialOwnerCallDraft,
  hasSeenMemorialOwnerCallPrompt,
  markMemorialOwnerCallPromptSeen,
  MEMORIAL_OWNER_CALL_OPTIONS,
  saveMemorialOwnerCall
} from '../../common/memorial-owner-call.js';
import { isReduceMotionEnabled } from '../../common/haptics.js';
import {
  scheduleMemorialPersonaIntro,
  shouldShowMemorialPersonaIntro
} from '../../common/memorial-persona.js';
import {
  getCurrentAssistantOwnerCall,
  getMemorialOwnerCall,
  getPetRelationshipStage,
  getRelationshipChatBoundaryRules,
  getRelationshipChatCopy,
  getRelationshipChatQuickQuestions,
  getRelationshipChatSystemRole,
  getRelationshipConfig,
  getRelationshipThemeClass,
  setRelationshipTabBar
} from '../../common/relationship-config.js';

const MAX_CLOUD_MESSAGE_CHARS = 760;
const MAX_HISTORY_MESSAGES = 10;
const MAX_HISTORY_ITEM_CHARS = 360;
const MAX_HISTORY_CHARS = 2200;
const DEFAULT_PET_AVATAR = '/static/pet.png';
const MEMORIAL_REALITY_REPLY = '好。我们回到现实。我已经离开了。你想我的时候，可以说说那些真的发生过的小事。';
const MEMORIAL_FALLBACKS = {
  life: [
    '我听见了。最近是不是有点累？',
    '原来你这几天是这样过的。你接着说。',
    '嗯，先不用急着把所有事都做好。'
  ],
  longing: [
    '我在听。今天先想起我哪件事了？',
    '想我了啊。那就陪我说一会儿。',
    '嗯，我知道。你不用把话说得很完整。'
  ],
  guilt: [
    '别急着把所有错都放在自己身上。只凭现在这些话，不能这样下结论。',
    '我知道你一直怪自己。先停一下，别一个人把这些都背走。'
  ],
  touchLoss: [
    '嗯。这个最难。想抱我的时候，手里却什么都没有。',
    '我知道。最难受的就是再也摸不到了。'
  ],
  meal: [
    '又没好好吃饭啊。先吃几口也行。',
    '我听懂了。今天先找点热的吃，好不好？'
  ],
  sleep: [
    '又到很晚才睡啊。最近是忙，还是睡不着？',
    '我听懂了。今晚能不能比昨天早一点停下来？'
  ],
  work: [
    '又被工作气到了？先说最烦的那一件。',
    '原来是工作。难怪你今天这么累。'
  ],
  unrelated: [
    '这个我可能帮不上你呀。不过你忙完以后，可以回来和我说说今天过得怎么样。',
    '这些复杂的事情我不太会。要不要先告诉我，你今天是不是又忙了很久？',
    '这个不是我最擅长的事情呀。我更想听听你最近过得好不好。',
    '这件事我没办法替你完成。等你忙完了，再回来和我说说今天的生活吧。'
  ],
  safe: [
    '我在听。你接着说就好。',
    '嗯。先从你现在最想说的那件事开始。'
  ]
};
const URGENT_PATTERNS = [
  { pattern: /持续呕吐|频繁呕吐|一直吐|吐血|呕血/, term: '持续或严重呕吐' },
  { pattern: /抽搐|癫痫|倒地|站不稳|昏迷|失去意识/, term: '抽搐或意识异常' },
  { pattern: /呼吸困难|喘不上气|张口呼吸|舌头发紫|发绀/, term: '呼吸困难' },
  { pattern: /误食|吃了.*药|吃了.*巧克力|吃了.*洋葱|中毒|毒物|老鼠药/, term: '疑似误食或中毒' },
  { pattern: /大量出血|流血不止|血便|尿血|便血/, term: '出血相关症状' },
  { pattern: /不吃不喝|超过.*不吃|严重脱水|尿不出来|排不出尿/, term: '进食饮水或排尿异常' },
  { pattern: /高烧|体温.*4[01]|低温|体温过低/, term: '体温异常' }
];

export default {
  data() {
    return {
      activePetId: null,
      activePet: null,
      activeStatus: 'current',
      activePetName: '宝贝',
      activePetPhoto: '',
      inputText: '',
      promptPanelCollapsed: false,
      scrollToView: '',
      isTyping: false,
      isSending: false,
      messageList: [],
      loadedChatContextId: '',
      medicalNoticeShown: false,
      requestSequence: 0,
      activeRequestToken: '',
      interactionTimers: [],
      interactionSession: 0,
      isArchiveNavigationLocked: false,
      suppressOwnerCallPromptOnce: false,
      showOwnerCallSetup: false,
      selectedOwnerCallType: '',
      customOwnerCall: '',
      ownerCallOptions: MEMORIAL_OWNER_CALL_OPTIONS,
      reduceMotion: isReduceMotionEnabled(),
      personaIntroTimer: null
    };
  },
  computed: {
    isMemorialMode() {
      return this.activeStatus === 'deceased';
    },
    relationshipConfig() {
      return getRelationshipConfig(this.activeStatus);
    },
    chatCopy() {
      return getRelationshipChatCopy(this.activeStatus);
    },
    themeClass() {
      return getRelationshipThemeClass(this.activeStatus);
    },
    promptSuggestions() {
      return getRelationshipChatQuickQuestions(this.activeStatus);
    },
    serviceActions() {
      return this.relationshipConfig.chat.serviceActions;
    },
    showCameraButton() {
      return this.relationshipConfig.chat.showCamera;
    },
    memorialPetAvatar() {
      return this.resolveMemorialPetAvatar(this.activePet);
    },
    memorialPawType() {
      const profile = this.activePetId ? getPetProfile(this.activePetId) : {};
      return getPawType(this.activePet || {}, profile);
    },
    memorialTypingLabel() {
      return getTypingLabel(this.activePet || { name: this.activePetName });
    },
    headerPetAvatar() {
      return this.memorialPetAvatar;
    },
    contextBadges() {
      const badges = [];
      if (this.isMemorialMode || !this.activePetId || !this.activePet) return badges;

      const profileContext = buildProfileContext(this.activePet, getPetProfile(this.activePetId), { maxChars: 240 });
      const diaryContext = buildDiaryContext(this.activePetId, { maxDays: 3, maxChars: 220 });

      if (profileContext) badges.push('基础档案');
      if (diaryContext) badges.push('最近日历');
      return badges;
    },
    uiText() {
      const chat = this.relationshipConfig.chat;
      return {
        title: this.chatCopy.chatPageTitle,
        subtitle: this.chatCopy.chatPageSubtitle,
        aiAvatar: chat.aiAvatar,
        placeholder: this.chatCopy.chatInputPlaceholder,
        welcomeMsg: this.chatCopy.chatGreeting,
        promptKicker: this.isMemorialMode ? '你可以从这些话开始' : 'SMART GUIDE',
        promptTitle: this.chatCopy.chatPrimaryIntent,
        safetyHint: this.chatCopy.chatSafetyHint,
        collapsedText: chat.collapsedText
      };
    }
  },
  onShow() {
    this.reduceMotion = isReduceMotionEnabled();
    const shouldSuppressOwnerCallPrompt = this.suppressOwnerCallPromptOnce;
    this.suppressOwnerCallPromptOnce = false;
    this.isArchiveNavigationLocked = false;
    this.showOwnerCallSetup = false;
    this.syncActiveChatContext();
    this.applyPendingPrompt();
    const personaIntroPending = shouldShowMemorialPersonaIntro(this.activePetId, this.activeStatus);
    if (!shouldSuppressOwnerCallPrompt && !personaIntroPending) this.maybeShowOwnerCallSetup();
    this.schedulePersonaIntro();
  },
  onHide() {
    this.clearPersonaIntroTimer();
    this.clearInteractionTimers();
  },
  onUnload() {
    this.clearPersonaIntroTimer();
    this.clearInteractionTimers();
  },
  methods: {
    clearPersonaIntroTimer() {
      if (!this.personaIntroTimer) return;
      clearTimeout(this.personaIntroTimer);
      this.personaIntroTimer = null;
    },
    schedulePersonaIntro() {
      this.clearPersonaIntroTimer();
      const petId = this.activePetId;
      const stage = this.activeStatus;
      if (!petId) return;
      this.personaIntroTimer = scheduleMemorialPersonaIntro({
        petId,
        relationshipStage: stage,
        delay: 420,
        isStillCurrent: () => this.activePetId === petId && this.activeStatus === stage,
        onStart: () => {
          uni.navigateTo({ url: `/pages/memorial-persona/memorial-persona?petId=${encodeURIComponent(petId)}` });
        }
      });
    },
    openMemorialMessageArchive(message) {
      if (!message || message.type === 'user') return;
      this.openMemorialPetArchive(message.petId);
    },
    openPetArchive(expectedPetId) {
      if (this.isArchiveNavigationLocked) return;

      const activePet = getActivePet();
      const activePetId = String(activePet && activePet.id || '');
      const clickedPetId = String(expectedPetId || this.activePetId || '');
      const activeStage = activePet ? getPetRelationshipStage(activePet) : 'current';
      const activeContextId = getChatContextId(activePetId, activeStage);
      const currentPagePetId = String(this.activePetId || '');

      if (
        !activePetId ||
        clickedPetId !== activePetId ||
        currentPagePetId !== activePetId ||
        activeStage !== this.activeStatus ||
        this.loadedChatContextId !== activeContextId
      ) {
        return;
      }

      this.safeVibrate();
      this.isArchiveNavigationLocked = true;
      this.suppressOwnerCallPromptOnce = true;

      uni.navigateTo({
        url: `/pages/archive/archive?petId=${encodeURIComponent(activePetId)}&from=chat`,
        fail: () => {
          this.isArchiveNavigationLocked = false;
          this.suppressOwnerCallPromptOnce = false;
          uni.showToast({ title: '暂时无法打开档案，请稍后再试', icon: 'none' });
        }
      });
    },
    openMemorialPetArchive(expectedPetId) {
      if (!this.isMemorialMode || this.isArchiveNavigationLocked) return;

      const activePet = getActivePet();
      const activePetId = String(activePet && activePet.id || '');
      const clickedPetId = String(expectedPetId || this.activePetId || '');
      const activeStage = activePet ? getPetRelationshipStage(activePet) : 'current';
      const activeContextId = getChatContextId(activePetId, activeStage);
      const currentPagePetId = String(this.activePetId || '');

      if (
        !activePetId ||
        activeStage !== 'deceased' ||
        clickedPetId !== activePetId ||
        currentPagePetId !== activePetId ||
        this.loadedChatContextId !== activeContextId
      ) {
        return;
      }

      this.safeVibrate();
      this.isArchiveNavigationLocked = true;
      this.suppressOwnerCallPromptOnce = true;

      // Phase 3 persona training belongs in the archive; this round only routes there.
      uni.navigateTo({
        url: `/pages/archive/archive?petId=${encodeURIComponent(activePetId)}&from=memorial-chat`,
        fail: () => {
          this.isArchiveNavigationLocked = false;
          this.suppressOwnerCallPromptOnce = false;
          uni.showToast({ title: '暂时无法打开档案，请稍后再试', icon: 'none' });
        }
      });
    },
    safeVibrate() {
      try {
        if (typeof uni.vibrateShort === 'function') {
          uni.vibrateShort({
            type: 'light',
            fail: () => {}
          });
        }
      } catch (error) {
        // Haptic feedback is optional on unsupported platforms.
      }
    },
    syncActiveChatContext() {
      const nextPet = getActivePet();
      if (!nextPet) {
        if (this.loadedChatContextId) this.resetChatContextState();
        this.activePet = null;
        this.activePetId = null;
        this.activeStatus = 'current';
        this.activePetName = '宝贝';
        this.activePetPhoto = '';
        this.loadedChatContextId = '';
        this.messageList = [];
        this.medicalNoticeShown = false;
        this.updateTabBarText('current');
        return;
      }

      const nextStage = getPetRelationshipStage(nextPet);
      const nextContextId = getChatContextId(nextPet.id, nextStage);
      const contextChanged = nextContextId !== this.loadedChatContextId;
      if (contextChanged) this.resetChatContextState();

      this.activePet = nextPet;
      this.activePetId = nextPet.id;
      this.activeStatus = nextStage;
      this.activePetName = nextPet.name || '宝贝';
      this.activePetPhoto = nextPet.photo || nextPet.avatar || '';
      this.loadedChatContextId = nextContextId;
      this.updateTabBarText(nextStage);

      if (contextChanged) this.loadChatHistory();
    },
    resetChatContextState() {
      this.clearInteractionTimers();
      this.inputText = '';
      this.scrollToView = '';
      this.promptPanelCollapsed = false;
      this.messageList = [];
      this.medicalNoticeShown = false;
      this.showOwnerCallSetup = false;
    },
    isRequestContextCurrent(requestContext, session) {
      if (!requestContext || this.interactionSession !== session) return false;
      if (this.activeRequestToken !== requestContext.requestToken) return false;
      if (this.activePetId !== requestContext.petId) return false;
      if (this.activeStatus !== requestContext.relationshipStage) return false;
      if (this.loadedChatContextId !== requestContext.chatContextId) return false;
      return getChatContextId(this.activePetId, this.activeStatus) === requestContext.chatContextId;
    },
    resolveMemorialPetAvatar(pet = {}) {
      const source = pet || {};
      return source.generatedAvatarUrl ||
        source.generatedAvatar ||
        source.avatar ||
        source.avatarUrl ||
        source.imageUrl ||
        source.image ||
        source.photo ||
        source.petImage ||
        source.profileImage ||
        source.petPhoto ||
        DEFAULT_PET_AVATAR;
    },
    maybeShowOwnerCallSetup() {
      if (!this.isMemorialMode || !this.activePetId || !this.activePet) return;
      if (getMemorialOwnerCall(this.activePet)) return;
      if (hasSeenMemorialOwnerCallPrompt(this.activePetId)) return;
      this.openOwnerCallSetup(false);
    },
    openOwnerCallSetup() {
      const draft = getMemorialOwnerCallDraft(this.activePet || {});
      this.selectedOwnerCallType = draft.selectedType;
      this.customOwnerCall = draft.customValue;
      this.showOwnerCallSetup = true;
    },
    selectOwnerCallOption(option) {
      this.selectedOwnerCallType = option.key;
      if (option.key !== 'custom') this.customOwnerCall = '';
    },
    skipOwnerCallSetup() {
      markMemorialOwnerCallPromptSeen(this.activePetId);
      this.showOwnerCallSetup = false;
    },
    saveOwnerCall() {
      const result = saveMemorialOwnerCall(
        this.activePetId,
        this.selectedOwnerCallType,
        this.customOwnerCall
      );
      if (!result.ok) {
        uni.showToast({ title: result.error, icon: 'none' });
        return;
      }

      this.activePet = result.pet;
      this.showOwnerCallSetup = false;
      uni.showToast({
        title: result.value ? '已经记住这个称呼' : '已暂不设置称呼',
        icon: 'none'
      });
    },
    waitForInteractionDelay(delay, session) {
      return new Promise(resolve => {
        const timer = {
          id: null,
          resolve
        };
        timer.id = setTimeout(() => {
          this.interactionTimers = this.interactionTimers.filter(item => item.id !== timer.id);
          resolve(this.interactionSession === session);
        }, Math.max(Number(delay) || 0, 0));
        this.interactionTimers.push(timer);
      });
    },
    clearInteractionTimers() {
      this.interactionSession += 1;
      this.activeRequestToken = '';
      this.interactionTimers.forEach(timer => {
        clearTimeout(timer.id);
        timer.resolve(false);
      });
      this.interactionTimers = [];
      this.isTyping = false;
      this.isSending = false;
    },
    async beginMemorialReadState(message, session) {
      const shouldContinue = await this.waitForInteractionDelay(getReadDelay(message), session);
      if (!shouldContinue || this.interactionSession !== session) return 0;
      message.deliveryState = 'read';
      this.saveChatHistory();
      this.isTyping = true;
      this.scrollToBottom('typing');
      return Date.now();
    },
    copyText(text) {
      if (!text) return;
      uni.setClipboardData({
        data: text,
        success: () => {
          uni.showToast({ title: '内容已复制', icon: 'none' });
        }
      });
    },
    updateTabBarText(status) {
      setRelationshipTabBar(status);
    },
    loadChatHistory() {
      if (!this.activePetId) {
        this.messageList = [];
        this.medicalNoticeShown = false;
        return;
      }

      const history = loadChatSession(this.activePetId, this.activeStatus);
      if (history.length > 0) {
        const normalizedHistory = this.normalizeHistoryMessages(history);
        this.messageList = this.refreshDefaultGreeting(normalizedHistory);
        this.medicalNoticeShown = hasMedicalNoticeShown(
          this.messageList,
          this.activePetId,
          this.activeStatus
        );
        this.saveChatHistory();
        this.scrollToBottom(this.messageList[this.messageList.length - 1].id);
      } else {
        this.messageList = [{
          id: '0',
          petId: this.activePetId,
          relationshipStage: this.activeStatus,
          type: 'ai',
          content: this.uiText.welcomeMsg,
          imageUrl: '',
          createdAt: Date.now(),
          deliveryState: '',
          replySource: 'greeting'
        }];
        this.medicalNoticeShown = false;
        this.saveChatHistory();
      }
    },
    normalizeHistoryMessages(history) {
      if (!this.isMemorialMode || !Array.isArray(history)) return history;
      let changed = false;
      const normalized = history.map(message => {
        if (message.type !== 'user' || message.deliveryState === 'read') return message;
        changed = true;
        return {
          ...message,
          deliveryState: 'read'
        };
      });
      return changed ? normalized : history;
    },
    refreshDefaultGreeting(history) {
      if (!Array.isArray(history) || !history.length) return history;
      const firstMessage = history[0];
      if (!firstMessage || `${firstMessage.id}` !== '0' || firstMessage.type !== 'ai') return history;
      if (firstMessage.content === this.uiText.welcomeMsg) return history;
      return [{ ...firstMessage, content: this.uiText.welcomeMsg }].concat(history.slice(1));
    },
    applyPendingPrompt() {
      const pendingPrompt = uni.getStorageSync('pending_chat_prompt');
      if (!pendingPrompt) return;
      this.inputText = pendingPrompt;
      uni.removeStorageSync('pending_chat_prompt');
    },
    buildConversationHistory(currentMessageId) {
      return buildChatConversationHistory(
        this.messageList,
        {
          petId: this.activePetId,
          relationshipStage: this.activeStatus
        },
        {
          currentMessageId,
          maxMessages: MAX_HISTORY_MESSAGES,
          maxItemChars: MAX_HISTORY_ITEM_CHARS,
          maxTotalChars: MAX_HISTORY_CHARS
        }
      );
    },
    chooseImage() {
      this.chooseImageWithIntent('photo');
    },
    chooseImageWithIntent(intent = 'photo') {
      if (intent === 'report' && !this.inputText.trim()) {
        this.inputText = '请帮我解读这份宠物检查报告。我会补充报告里的关键数值。';
      }
      if (intent === 'photo' && !this.inputText.trim()) {
        this.inputText = '我上传了一张照片，请先告诉我需要补充哪些症状、持续时间和精神食欲变化。';
      }

      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          this.sendMessage(res.tempFilePaths[0]);
        }
      });
    },
    handleServiceAction(key) {
      const promptMap = {
        fit: '我想认真评估一下自己是否适合现在养宠。可以从作息、预算、居住环境和照护能力开始问我。',
        supplies: '请帮我整理一份第一次接宠前的用品清单，区分必须准备和可以稍后再买的东西。',
        routine: '请帮我做一个接宠前后一周的流程安排，尽量稳妥、不要太焦虑。',
        letter: '我有几句话想对你说。',
        memory: '我想起了一件小事，想讲给你听。',
        anniversary: '今天让我想起了我们的纪念日。',
        comfort: '我有点难过，想让你陪我一会儿。'
      };

      if (promptMap[key]) {
        this.inputText = promptMap[key];
        this.promptPanelCollapsed = true;
        uni.showToast({ title: '已放进输入框', icon: 'none' });
        return;
      }

      if (key === 'clinic') {
        this.promptPanelCollapsed = false;
        uni.showToast({ title: '可以直接描述症状', icon: 'none' });
        return;
      }

      if (key === 'report') {
        this.chooseImageWithIntent('report');
        return;
      }

      if (key === 'photo') {
        this.chooseImageWithIntent('photo');
        return;
      }

      if (key === 'care') {
        uni.navigateTo({ url: '/pages/care/care' });
      }
    },
    applySuggestion(suggestion) {
      this.inputText = suggestion;
      uni.showToast({ title: '已填入输入框', icon: 'none' });
    },
    buildUserMessage(text, imageUrl) {
      const trimmedText = (text || '').trim();
      if (this.isMemorialMode) {
        return this.buildMemorialUserMessage(trimmedText);
      }

      const stageInstruction = this.buildStageInstruction();
      const currentQuestion = trimmedText ? `用户当前问题：${trimmedText}` : '用户当前问题：上传了一张图片。';
      const imageHint = imageUrl
        ? '用户上传了一张图片。请提醒用户补充图片中的关键症状或检查结果文字描述，不要声称已经看到了图片。'
        : '';
      const fixedContent = [currentQuestion, imageHint].filter(Boolean).join('\n');
      const profileContext = buildProfileContext(this.activePet, getPetProfile(this.activePetId), {
        maxChars: Math.min(180, Math.max(MAX_CLOUD_MESSAGE_CHARS - fixedContent.length - stageInstruction.length - 48, 0))
      });
      const diaryBudget = Math.max(MAX_CLOUD_MESSAGE_CHARS - fixedContent.length - stageInstruction.length - profileContext.length - 32, 0);
      const diaryContext = buildDiaryContext(this.activePetId, {
        maxDays: 3,
        maxChars: Math.min(diaryBudget, 260)
      });
      const message = [stageInstruction, profileContext, diaryContext, fixedContent].filter(Boolean).join('\n\n');

      if (message.length <= MAX_CLOUD_MESSAGE_CHARS) {
        return message;
      }

      if (trimmedText.length > MAX_CLOUD_MESSAGE_CHARS - 24) {
        const questionBudget = Math.max(MAX_CLOUD_MESSAGE_CHARS - stageInstruction.length - 36, 80);
        return `${stageInstruction}\n\n用户当前问题：${trimmedText.slice(0, questionBudget)}…`;
      }

      if (imageUrl) {
        return [stageInstruction, profileContext, diaryContext, currentQuestion].filter(Boolean).join('\n\n').slice(0, MAX_CLOUD_MESSAGE_CHARS);
      }

      return [stageInstruction, currentQuestion].filter(Boolean).join('\n\n').slice(0, MAX_CLOUD_MESSAGE_CHARS);
    },
    buildMemorialUserMessage(text) {
      const stageInstruction = this.buildStageInstruction();
      const questionBudget = Math.max(MAX_CLOUD_MESSAGE_CHARS - stageInstruction.length - 32, 120);
      const question = (text || '').slice(0, questionBudget);
      const currentQuestion = `用户当前问题：${question}`;
      const contextBudget = Math.max(
        Math.min(MAX_CLOUD_MESSAGE_CHARS - stageInstruction.length - currentQuestion.length - 8, 260),
        0
      );
      const memorialContext = this.buildMemorialContext(contextBudget);
      return [stageInstruction, memorialContext, currentQuestion].filter(Boolean).join('\n\n');
    },
    buildMemorialContext(maxChars = 260) {
      if (!this.activePet || maxChars <= 0) return '';
      const profile = getPetProfile(this.activePetId);
      const lines = [
        '以下只包含主人明确提供的信息，不得补写未出现的细节。',
        `宠物名：${this.activePetName}`
      ];
      const memorialOwnerCall = getMemorialOwnerCall(this.activePet);
      if (memorialOwnerCall) {
        lines.push(`主人希望你称呼他/她为：${this.compactMemorialText(memorialOwnerCall, 20)}`);
      }

      if (profile.updatedAt) {
        lines.push(`物种：${getSpeciesLabel(profile.species)}`);
        if (profile.gender && profile.gender !== 'unknown') {
          lines.push(`性别称呼：${getGenderLabel(profile.gender)}`);
        }
      }
      if (profile.temperament) {
        lines.push(`主人填写的性格习惯：${this.compactMemorialText(profile.temperament, 48)}`);
      }

      const diaryMap = getDiaryMap(this.activePetId);
      const memoryLines = Object.keys(diaryMap)
        .sort()
        .reverse()
        .map(dateKey => {
          const record = diaryMap[dateKey] || {};
          const note = this.compactMemorialText(record.note, 64);
          return note ? `主人在 ${dateKey} 写下：${note}` : '';
        })
        .filter(Boolean)
        .slice(0, 2);

      if (memoryLines.length) {
        lines.push('主人明确写过的少量回忆：');
        lines.push(...memoryLines);
      }

      let output = '';
      for (const line of lines) {
        const next = output ? `${output}\n${line}` : line;
        if (next.length > maxChars) break;
        output = next;
      }
      return output;
    },
    compactMemorialText(value, maxLength) {
      const text = String(value || '').replace(/\s+/g, ' ').trim();
      if (text.length <= maxLength) return text;
      return `${text.slice(0, Math.max(maxLength - 1, 0))}…`;
    },
    buildStageInstruction() {
      if (this.isMemorialMode) {
        return [
          '当前关系阶段：纪念里',
          '请以宠物第一人称温柔回应，但只依据主人明确提供的信息。',
          '主人分享作息、吃饭喝水、工作、日常变化和心情都属于正常对话，请自然接住。',
          '不得编造共同经历、习惯、地点、天气、离别过程或承诺；不得声称真实复活或看见主人现实生活。',
          '如果主人要求回到现实，必须承认已经离开，只保留真实的想念和回忆。',
          '使用短句和日常口语。普通回复 25 至 80 字，明显情绪 60 至 150 字；一次最多一个问题，也可以不问。',
          '本次没有提供允许动作，不写括号动作或自行想象的肢体动作。',
          '只输出纯文本，不使用 Markdown 粗体、标题、代码围栏或星号。'
        ].join('\n');
      }

      const role = getRelationshipChatSystemRole(this.activeStatus);
      const boundaryRules = getRelationshipChatBoundaryRules(this.activeStatus);
      const rulesText = boundaryRules.length
        ? boundaryRules.map((rule, index) => `${index + 1}. ${rule}`).join('\n')
        : '1. 回答要温柔、具体、可执行。';

      return [
        `当前关系阶段：${this.relationshipConfig.stageName}`,
        `阶段角色：${role}`,
        `阶段边界：\n${rulesText}`
      ].join('\n');
    },
    detectUrgentRisk(text) {
      const normalizedText = String(text || '').trim();
      if (!normalizedText) return { level: 'normal', terms: [] };

      const terms = URGENT_PATTERNS
        .filter(item => item.pattern.test(normalizedText))
        .map(item => item.term);

      return {
        level: terms.length ? 'urgent' : 'normal',
        terms
      };
    },
    confirmRiskIfNeeded(riskInfo) {
      if (!riskInfo || riskInfo.level !== 'urgent') return Promise.resolve(true);

      return new Promise(resolve => {
        uni.showModal({
          title: '建议优先线下就医',
          content: `我注意到这里可能有需要尽快处理的信号：${riskInfo.terms.join('、')}。我可以继续陪你整理信息，但更稳妥的是先联系附近兽医或急诊。`,
          cancelText: '先不发送',
          confirmText: '继续询问',
          confirmColor: '#B95757',
          success: (res) => resolve(Boolean(res.confirm)),
          fail: () => resolve(false)
        });
      });
    },
    decorateAssistantReply(reply, riskInfo, userText = '') {
      const plainReply = sanitizeChatPlainText(reply);
      if (this.activeStatus === 'deceased') {
        return this.sanitizeMemorialReply(plainReply, userText);
      }

      if (this.activeStatus === 'future') {
        return plainReply;
      }

      if (riskInfo && riskInfo.level === 'urgent') {
        return `${plainReply}\n\n如果这些症状现在仍在发生，请先把宝贝的安全放在第一位，尽快联系附近兽医或急诊。我也可以帮你整理就医前要说清楚的信息。`;
      }
      return plainReply;
    },
    isMemorialRealityRequest(text) {
      return /(回到现实|现实一点|别骗我|你已经走了|你已经离开|你不是真的回来|不是真的回来了)/i.test(String(text || ''));
    },
    getMemorialInputCategory(text) {
      const normalizedText = String(text || '');
      const previousAssistant = this.messageList
        .filter(message => message.type === 'ai')
        .slice(-1)[0];
      const previousText = previousAssistant ? String(previousAssistant.content || '') : '';
      if (/(摸不到|碰不到|抱不到|无法触碰|不能再抱)/i.test(normalizedText)) return 'touchLoss';
      if (/(害死|对不起|都是我的错|怪我|没照顾好)/i.test(normalizedText)) return 'guilt';
      if (/(想你|想念|孤单|难过|回忆)/i.test(normalizedText)) return 'longing';
      if (/^(没有|没|是的|嗯|不是|还没有)[。！!？?]*$/i.test(normalizedText)) {
        if (/(吃饭|吃东西|胃口)/i.test(previousText)) return 'meal';
        if (/(睡觉|休息|熬夜|几点睡)/i.test(previousText)) return 'sleep';
      }
      if (/(工作|上班|加班|同事)/i.test(normalizedText)) return 'work';
      if (/(最近|今天|今晚|昨天|这几天|工作|上班|加班|搬家|朋友|生活|心情|累|睡|熬夜|凌晨|休息|吃饭|喝水|忙|困难|做成|完成|发生)/i.test(normalizedText)) {
        return 'life';
      }
      return 'safe';
    },
    pickMemorialFallback(category, proposedReply = '') {
      const recentReplies = this.messageList
        .filter(message => message.type === 'ai')
        .slice(-3)
        .map(message => String(message.content || '').trim());
      const proposed = String(proposedReply || '').trim();
      if (proposed && !recentReplies.includes(proposed)) return proposed;

      const candidates = MEMORIAL_FALLBACKS[category] || MEMORIAL_FALLBACKS.safe;
      const unusedReply = candidates.find(candidate => !recentReplies.includes(candidate));
      if (unusedReply) return unusedReply;
      return candidates[(Date.now() + String(this.inputText || '').length) % candidates.length];
    },
    removeUnsupportedMemorialActions(reply) {
      return String(reply || '')
        .replace(/(^|\n)\s*[（(][^（）()\n]{1,100}[）)]\s*/g, '$1')
        .replace(/[（(][^（）()\n]{0,40}(?:蹭|贴|舔|摇尾巴|尾巴|趴|靠近|走到|抱住|钻进|额头)[^（）()\n]{0,40}[）)]/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    },
    getMemorialReplyLimit(userText = '') {
      const text = String(userText || '');
      if (/(永远摸不到|再也摸不到|离开|去世|死亡|害死|都是我的错|对不起|自责|崩溃|撑不住)/i.test(text)) {
        return 200;
      }
      if (/(想你|想念|难过|孤单|哭|梦见|纪念日|舍不得)/i.test(text)) {
        return 150;
      }
      return 80;
    },
    limitMemorialReplyLength(reply, maxChars) {
      const text = String(reply || '').trim();
      if (!maxChars || text.length <= maxChars) return text;

      const candidate = text.slice(0, maxChars);
      const punctuationPattern = /[。！？!?]/g;
      let match;
      let boundary = 0;
      while ((match = punctuationPattern.exec(candidate))) {
        if (match.index >= Math.floor(maxChars * 0.55)) boundary = match.index + 1;
      }
      return boundary ? candidate.slice(0, boundary).trim() : `${candidate.trim()}…`;
    },
    sanitizeMemorialReply(reply, userText = '') {
      if (this.isMemorialRealityRequest(userText)) return MEMORIAL_REALITY_REPLY;
      const normalizedReply = this.limitMemorialReplyLength(
        this.removeUnsupportedMemorialActions(sanitizeChatPlainText(reply)),
        this.getMemorialReplyLimit(userText)
      );
      const unsafePatterns = [
        /(?:^|[，。！？\n])\s*我(?:真的)?回来了/,
        /我(?:现在)?能(?:看见|看到)(?:你|天气|外面)/,
        /我一直(?:都)?在你身边/,
        /我(?:真的|现在)在你身边/,
        /我(?:一直)?守着你/,
        /我(?:(?:现在|还|一直)在|正在)(?:窗边|地板|家里|门口|床边)/,
        /我能真实地陪你生活/,
        /我走的那天[，,]?\s*你答应过我/,
        /你答应过我/,
        /我打开(?:了)?罐头/,
        /我给你喂(?:饭|食)/,
        /我带你去医院/,
        /我抱着你/,
        /你不能忘了我/,
        /我会一直等你/,
        /你不来看我我会孤单/,
        /作为\s*(?:AI|人工智能|语言模型)/i,
        /(?:用|保持)(?:温柔|安静|克制).{0,12}(?:语气|口吻)/,
        /带着.{0,12}(?:暖意|温柔).{0,8}(?:说|回答)/,
        /我会用(?:她|他|它)的口吻/
      ];
      const category = this.getMemorialInputCategory(userText);
      if (unsafePatterns.some(pattern => pattern.test(normalizedReply))) {
        return this.pickMemorialFallback(category);
      }
      return this.pickMemorialFallback(category, normalizedReply);
    },
    getOutOfScopeReply(reply, userText = '') {
      if (!this.isMemorialMode) return reply;
      if (this.isMemorialRealityRequest(userText)) return MEMORIAL_REALITY_REPLY;
      return this.pickMemorialFallback('unrelated', reply);
    },
    saveConsultationSummary(question, answer, riskInfo) {
      saveConsultationRecord(this.activePetId, {
        question: question || '图片提问',
        answer,
        contextLabels: this.contextBadges,
        riskLevel: riskInfo.level,
        riskTerms: riskInfo.terms
      });
    },
    async sendMessage(imageUrl = null) {
      if (this.isSending) {
        uni.showToast({ title: '上一条还在回复中', icon: 'none' });
        return;
      }
      if (!this.inputText.trim() && !imageUrl) return;
      if (!this.activePetId) {
        uni.showToast({ title: '请先添加宝贝', icon: 'none' });
        return;
      }

      const userText = this.inputText;
      const riskInfo = this.activeStatus === 'current'
        ? this.detectUrgentRisk(userText)
        : { level: 'normal', terms: [] };
      const shouldContinue = await this.confirmRiskIfNeeded(riskInfo);
      if (!shouldContinue) return;

      const requestPetId = this.activePetId;
      const currentRelationshipStage = getPetRelationshipStage(this.activePet);
      const chatContextId = getChatContextId(requestPetId, currentRelationshipStage);
      if (!chatContextId || chatContextId !== this.loadedChatContextId) return;

      const session = this.interactionSession + 1;
      this.interactionSession = session;
      const requestToken = `${chatContextId}:${Date.now()}:${this.requestSequence + 1}`;
      this.requestSequence += 1;
      this.activeRequestToken = requestToken;
      const requestContext = {
        petId: requestPetId,
        relationshipStage: currentRelationshipStage,
        chatContextId,
        requestToken
      };
      const userMessageItem = {
        id: Date.now().toString(),
        petId: requestPetId,
        relationshipStage: currentRelationshipStage,
        type: 'user',
        content: userText,
        imageUrl,
        createdAt: Date.now(),
        deliveryState: currentRelationshipStage === 'deceased' ? 'unread' : '',
        replySource: 'user'
      };
      this.messageList.push(userMessageItem);
      this.inputText = '';
      this.isSending = true;
      this.saveChatHistory();
      this.scrollToBottom(userMessageItem.id);

      if (currentRelationshipStage !== 'deceased') {
        this.isTyping = true;
        this.scrollToBottom('typing');
      }

      const userMessage = this.buildUserMessage(userText, imageUrl);
      const conversationHistory = this.buildConversationHistory(userMessageItem.id);
      const requestOutcomePromise = uniCloud.callFunction({
        name: 'api_deepseek',
        data: {
          userMessage,
          relationshipStage: currentRelationshipStage,
          petName: this.activePetName,
          conversationHistory,
          ownerRelationCall: currentRelationshipStage === 'deceased'
            ? getMemorialOwnerCall(this.activePet)
            : getCurrentAssistantOwnerCall(this.activePet),
          ownerPreferredCall: currentRelationshipStage === 'deceased'
            ? getMemorialOwnerCall(this.activePet)
            : '',
          memorialPersona: currentRelationshipStage === 'deceased'
            ? buildConfirmedMemorialPersonaContext(requestPetId, currentRelationshipStage)
            : null
        }
      }).then(response => ({ response })).catch(error => ({ error }));

      let typingStartedAt = Date.now();
      if (currentRelationshipStage === 'deceased') {
        typingStartedAt = await this.beginMemorialReadState(userMessageItem, session);
        if (!typingStartedAt || !this.isRequestContextCurrent(requestContext, session)) return;
      }

      const requestOutcome = await requestOutcomePromise;
      if (!this.isRequestContextCurrent(requestContext, session)) return;

      if (requestOutcome.error) {
        console.warn('api_deepseek_call_failed', requestOutcome.error && (
          requestOutcome.error.errCode || requestOutcome.error.message
        ));
        this.isTyping = false;
        this.isSending = false;
        this.activeRequestToken = '';
        userMessageItem.excludeFromHistory = true;
        this.messageList.push({
          id: (Date.now() + 1).toString(),
          petId: requestPetId,
          relationshipStage: currentRelationshipStage,
          type: 'ai',
          content: currentRelationshipStage === 'deceased'
            ? '刚刚没能把话送到。你可以稍后再和我说一次。'
            : 'AI 服务暂时不可用，请稍后再试。',
          imageUrl: '',
          createdAt: Date.now(),
          deliveryState: '',
          replySource: 'error',
          isError: true
        });
        this.saveChatHistory();
        this.scrollToBottom(this.messageList[this.messageList.length - 1].id);
        return;
      }

      const res = requestOutcome.response;
      if (res.result && res.result.code === 0) {
        const rawReply = String(res.result.reply || '').trim();
        const reply = res.result.outOfScope
          ? this.getOutOfScopeReply(rawReply, userText)
          : this.decorateAssistantReply(rawReply, riskInfo, userText);
        const guardRejected = Boolean(res.result.guardRejected) || (
          currentRelationshipStage === 'deceased' &&
          !res.result.outOfScope &&
          reply !== rawReply
        );
        if (res.result.outOfScope) userMessageItem.excludeFromHistory = true;

        if (currentRelationshipStage === 'deceased') {
          const elapsedTypingTime = Date.now() - typingStartedAt;
          const remainingTypingTime = Math.max(getMinimumTypingDelay(reply) - elapsedTypingTime, 0);
          if (remainingTypingTime > 0) {
            const shouldContinue = await this.waitForInteractionDelay(remainingTypingTime, session);
            if (!shouldContinue || !this.isRequestContextCurrent(requestContext, session)) return;
          }
        }

        const shouldShowMedicalNotice = currentRelationshipStage === 'current' &&
          !res.result.outOfScope &&
          !this.medicalNoticeShown;
        this.messageList.push({
          id: (Date.now() + 1).toString(),
          petId: requestPetId,
          relationshipStage: currentRelationshipStage,
          type: 'ai',
          content: reply,
          imageUrl: '',
          createdAt: Date.now(),
          deliveryState: '',
          replySource: res.result.outOfScope || guardRejected ? 'fallback' : 'model',
          isFallback: Boolean(res.result.outOfScope),
          guardRejected,
          medicalNotice: shouldShowMedicalNotice
        });
        if (shouldShowMedicalNotice) this.medicalNoticeShown = true;
        if (!res.result.outOfScope && currentRelationshipStage === 'current') {
          this.saveConsultationSummary(userText || '图片提问', reply, riskInfo);
        }
      } else {
        console.warn('api_deepseek_failed', res && res.result ? res.result.code : 'no_result');
        userMessageItem.excludeFromHistory = true;
        this.messageList.push({
          id: (Date.now() + 1).toString(),
          petId: requestPetId,
          relationshipStage: currentRelationshipStage,
          type: 'ai',
          content: currentRelationshipStage === 'deceased'
            ? '刚刚没能把话送到。你可以稍后再和我说一次。'
            : 'AI 服务暂时不可用，请稍后再试。',
          imageUrl: '',
          createdAt: Date.now(),
          deliveryState: '',
          replySource: 'error',
          isError: true
        });
      }

      this.isTyping = false;
      this.isSending = false;
      this.activeRequestToken = '';
      this.saveChatHistory();
      this.scrollToBottom(this.messageList[this.messageList.length - 1].id);
    },
    saveChatHistory() {
      if (!this.activePetId || !this.loadedChatContextId) return;
      if (getChatContextId(this.activePetId, this.activeStatus) !== this.loadedChatContextId) return;
      saveChatSession(this.activePetId, this.activeStatus, this.messageList);
    },
    previewImg(url) {
      uni.previewImage({ urls: [url] });
    },
    scrollToBottom(id) {
      this.$nextTick(() => {
        const timer = {
          id: null,
          resolve: () => {}
        };
        timer.id = setTimeout(() => {
          this.interactionTimers = this.interactionTimers.filter(item => item.id !== timer.id);
          this.scrollToView = 'message-' + id;
        }, 50);
        this.interactionTimers.push(timer);
      });
    }
  }
}
</script>

<style scoped>
.chat-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #F4F1EA;
  color: #302A23;
}

.chat-header {
  flex-shrink: 0;
  padding: 82rpx 34rpx 24rpx;
  display: flex;
  align-items: center;
  background: #F7F3EA;
  border-bottom: 1rpx solid #E8DED0;
}

.pet-mini {
  width: 78rpx;
  height: 78rpx;
  border-radius: 50%;
  overflow: hidden;
  background: #302A23;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 12rpx 28rpx rgba(48, 42, 35, 0.12);
}

.memorial-avatar-link {
  cursor: pointer;
  transition: transform 160ms ease, opacity 160ms ease;
}

.memorial-avatar-link-hover {
  opacity: 0.9;
  transform: scale(0.94);
}

.pet-mini-img {
  width: 100%;
  height: 100%;
}

.pet-mini-text {
  color: #F7F3EA;
  font-size: 28rpx;
}

.header-copy {
  margin-left: 22rpx;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.header-title {
  color: #302A23;
  font-size: 34rpx;
  font-weight: 600;
  line-height: 1.25;
}

.header-subtitle {
  margin-top: 6rpx;
  color: #7E7467;
  font-size: 23rpx;
  line-height: 1.35;
}

.chat-scroll {
  flex: 1;
  overflow-y: hidden;
  padding: 0 28rpx;
  box-sizing: border-box;
}

.message-list {
  padding: 30rpx 0;
}

.prompt-pill {
  margin-bottom: 22rpx;
  padding: 18rpx 22rpx;
  border-radius: 999rpx;
  background: #FFFFFF;
  border: 1rpx solid #EEE6DA;
  color: #8C7557;
  font-size: 23rpx;
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  box-shadow: 0 10rpx 24rpx rgba(58, 51, 43, 0.04);
}

.prompt-pill-hover,
.collapse-btn-hover,
.suggestion-item-hover,
.service-tab-hover {
  opacity: 0.76;
}

.prompt-panel {
  margin-bottom: 24rpx;
  padding: 24rpx;
  border-radius: 16rpx;
  background: #FFFFFF;
  border: 1rpx solid #EEE6DA;
  box-shadow: 0 12rpx 30rpx rgba(58, 51, 43, 0.05);
}

.prompt-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.prompt-kicker {
  display: block;
  color: #8C7557;
  font-size: 20rpx;
  line-height: 1.25;
}

.prompt-title {
  display: block;
  margin-top: 6rpx;
  color: #302A23;
  font-size: 30rpx;
  font-weight: 600;
  line-height: 1.25;
}

.collapse-btn {
  width: 58rpx;
  height: 58rpx;
  padding: 0;
  margin: 0;
  border-radius: 50%;
  background: #F1ECE3;
  display: flex;
  align-items: center;
  justify-content: center;
}

.collapse-btn::after {
  border: none;
}

.suggestion-list {
  margin-top: 22rpx;
}

.suggestion-item {
  min-height: 76rpx;
  margin-top: 14rpx;
  padding: 18rpx 20rpx;
  border-radius: 14rpx;
  background: #FBFAF6;
  border: 1rpx solid #EEE6DA;
  color: #302A23;
  font-size: 25rpx;
  line-height: 1.35;
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.prompt-safety {
  display: block;
  margin-top: 18rpx;
  color: #8F877A;
  font-size: 22rpx;
  line-height: 1.45;
}

.context-card {
  margin-bottom: 26rpx;
  padding: 22rpx 24rpx;
  border-radius: 16rpx;
  background: #FFFFFF;
  border: 1rpx solid #EEE6DA;
  box-shadow: 0 12rpx 30rpx rgba(58, 51, 43, 0.04);
}

.context-title {
  display: block;
  color: #8C7557;
  font-size: 22rpx;
  line-height: 1.25;
}

.context-badges {
  margin-top: 14rpx;
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.context-badge {
  padding: 10rpx 16rpx;
  border-radius: 999rpx;
  background: #F1ECE3;
  color: #6B5D4D;
  font-size: 22rpx;
  line-height: 1.2;
}

.message-item {
  display: flex;
  align-items: flex-start;
  margin-bottom: 28rpx;
  animation: softSlideUp 0.38s ease-out both;
}

.message-left {
  flex-direction: row;
}

.message-right {
  flex-direction: row-reverse;
}

.avatar {
  width: 58rpx;
  height: 58rpx;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 22rpx;
  font-weight: 600;
}

.message-avatar-img {
  width: 100%;
  height: 100%;
}

.message-left .avatar {
  margin-right: 16rpx;
  background: #E7DED1;
  color: #6B5D4D;
}

.message-right .avatar {
  margin-left: 16rpx;
  background: #302A23;
  color: #FBFAF6;
}

.message-content {
  max-width: 68%;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.message-left .message-content {
  align-items: flex-start;
}

.message-right .message-content {
  align-items: flex-end;
}

.message-bubble {
  max-width: 100%;
  padding: 22rpx 26rpx;
  border-radius: 16rpx;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  box-shadow: 0 12rpx 30rpx rgba(58, 51, 43, 0.05);
}

.paw-status {
  position: relative;
  width: 34rpx;
  height: 27rpx;
  margin: 8rpx 8rpx 0 0;
  color: #A9A6AA;
  transition: color 220ms ease, opacity 220ms ease, transform 220ms ease;
}

.paw-toe,
.paw-pad {
  position: absolute;
  display: block;
  background: currentColor;
}

.paw-toe {
  width: 7rpx;
  height: 8rpx;
  border-radius: 50%;
  top: 2rpx;
}

.paw-toe-1 {
  left: 2rpx;
  transform: rotate(-18deg);
}

.paw-toe-2 {
  left: 10rpx;
  top: 0;
}

.paw-toe-3 {
  right: 9rpx;
  top: 0;
}

.paw-toe-4 {
  right: 1rpx;
  transform: rotate(18deg);
}

.paw-pad {
  width: 20rpx;
  height: 14rpx;
  left: 7rpx;
  bottom: 1rpx;
  border-radius: 56% 56% 48% 48%;
}

.paw-cat {
  width: 31rpx;
  transform: scale(0.9);
}

.paw-cat .paw-toe {
  width: 6rpx;
  height: 7rpx;
}

.paw-cat .paw-pad {
  width: 18rpx;
  height: 13rpx;
  left: 7rpx;
}

.paw-dog {
  width: 38rpx;
}

.paw-dog .paw-toe {
  width: 8rpx;
  height: 9rpx;
}

.paw-dog .paw-pad {
  width: 24rpx;
  height: 15rpx;
  left: 7rpx;
  border-radius: 60% 60% 44% 44%;
}

.paw-unread {
  color: #A7A4A6;
  opacity: 0.42;
}

.paw-read {
  color: var(--ui-accent);
  opacity: 0.92;
  animation: pawReadGlow 420ms ease-out both;
}

.message-left .message-bubble {
  background: #FFFFFF;
  color: #3A332B;
  border: 1rpx solid #EEE6DA;
}

.message-right .message-bubble {
  background: #8C7557;
  color: #FBFAF6;
}

.msg-text {
  font-size: 28rpx;
  line-height: 1.65;
  user-select: text;
  -webkit-user-select: text;
}

.medical-notice {
  display: block;
  max-width: 520rpx;
  margin-top: 10rpx;
  padding-left: 4rpx;
  color: var(--ui-muted);
  font-size: 21rpx;
  line-height: 1.45;
}

.chat-image {
  width: 300rpx;
  border-radius: 14rpx;
  margin-bottom: 14rpx;
}

.typing-bubble {
  min-width: 96rpx;
  min-height: 56rpx;
  align-items: flex-start;
}

.typing-label {
  color: var(--ui-muted);
  font-size: 21rpx;
  line-height: 1.3;
}

.typing-dots {
  min-height: 20rpx;
  margin-top: 8rpx;
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.typing-dot {
  width: 9rpx;
  height: 9rpx;
  border-radius: 50%;
  background: #8C7557;
  animation: typingDot 1.2s infinite ease-in-out both;
}

.typing-dot:nth-child(1) {
  animation-delay: -0.24s;
}

.typing-dot:nth-child(2) {
  animation-delay: -0.12s;
}

.scroll-bottom-padding {
  height: 30rpx;
}

.service-strip {
  flex-shrink: 0;
  width: 100%;
  background: #F4F1EA;
  padding: 14rpx 0 12rpx;
  white-space: nowrap;
}

.service-tabs {
  display: inline-flex;
  gap: 16rpx;
  padding: 0 24rpx;
  min-width: max-content;
}

.service-tab {
  min-width: 124rpx;
  max-width: 168rpx;
  height: 66rpx;
  padding: 0 18rpx;
  margin: 0;
  border-radius: 999rpx;
  background: #FFFFFF;
  color: #302A23;
  font-size: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  box-sizing: border-box;
  box-shadow: 0 10rpx 24rpx rgba(58, 51, 43, 0.05);
}

.service-tab text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.service-tab::after {
  border: none;
}

.input-bar {
  flex-shrink: 0;
  display: flex;
  align-items: flex-end;
  gap: 16rpx;
  padding: 20rpx 24rpx calc(20rpx + env(safe-area-inset-bottom));
  background: rgba(251, 250, 246, 0.96);
  border-top: 1rpx solid #E8DED0;
}

.round-tool,
.send-btn {
  width: 76rpx;
  height: 76rpx;
  padding: 0;
  margin: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.round-tool {
  background: #EFE7DA;
}

.send-btn {
  background: #302A23;
  box-shadow: 0 12rpx 28rpx rgba(48, 42, 35, 0.16);
}

.send-btn-disabled {
  opacity: 0.58;
  box-shadow: none;
}

.send-loading-text {
  color: #FBFAF6;
  font-size: 19rpx;
  line-height: 1;
}

.round-tool::after,
.send-btn::after {
  border: none;
}

.tool-hover,
.send-btn-hover {
  opacity: 0.78;
}

.chat-input {
  flex: 1;
  min-height: 48rpx;
  max-height: 180rpx;
  padding: 20rpx 24rpx;
  border-radius: 16rpx;
  background: #FFFFFF;
  border: 1rpx solid #EEE6DA;
  color: #302A23;
  font-size: 28rpx;
  line-height: 1.45;
  box-sizing: border-box;
}

.owner-call-mask {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 30;
  padding: 32rpx;
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  display: flex;
  align-items: flex-end;
  background: rgba(37, 38, 44, 0.34);
}

.owner-call-sheet {
  width: 100%;
  padding: 34rpx;
  border-radius: 34rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.62);
  background: rgba(248, 247, 250, 0.96);
  box-shadow: 0 30rpx 80rpx rgba(49, 48, 60, 0.18);
  box-sizing: border-box;
  animation: ownerCallRise 260ms ease-out both;
}

.owner-call-title {
  display: block;
  color: #292B32;
  font-size: 34rpx;
  font-weight: 600;
  line-height: 1.3;
}

.owner-call-subtitle {
  display: block;
  margin-top: 10rpx;
  color: rgba(41, 43, 50, 0.58);
  font-size: 24rpx;
  line-height: 1.5;
}

.owner-call-options {
  margin-top: 26rpx;
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
}

.owner-call-option {
  min-width: 128rpx;
  height: 68rpx;
  margin: 0;
  padding: 0 20rpx;
  border-radius: 999rpx;
  border: 1rpx solid rgba(95, 100, 120, 0.16);
  background: rgba(255, 255, 255, 0.72);
  color: #5F6478;
  font-size: 24rpx;
}

.owner-call-option::after,
.owner-call-later::after,
.owner-call-save::after {
  border: none;
}

.owner-call-option-active {
  color: #FFFFFF;
  background: #5F6478;
  border-color: #5F6478;
}

.owner-call-option-hover,
.owner-call-action-hover {
  transform: scale(0.97);
  opacity: 0.86;
}

.owner-call-input {
  width: 100%;
  height: 82rpx;
  margin-top: 22rpx;
  padding: 0 24rpx;
  border-radius: 20rpx;
  border: 1rpx solid rgba(95, 100, 120, 0.18);
  background: rgba(255, 255, 255, 0.72);
  color: #292B32;
  font-size: 26rpx;
  box-sizing: border-box;
}

.owner-call-actions {
  margin-top: 30rpx;
  display: flex;
  gap: 16rpx;
}

.owner-call-later,
.owner-call-save {
  height: 78rpx;
  margin: 0;
  border-radius: 22rpx;
  font-size: 25rpx;
  transition: transform 160ms ease, opacity 160ms ease;
}

.owner-call-later {
  flex: 0.8;
  color: #686A73;
  background: rgba(255, 255, 255, 0.66);
}

.owner-call-save {
  flex: 1.2;
  color: #FFFFFF;
  background: #5F6478;
}

@keyframes softSlideUp {
  from {
    opacity: 0;
    transform: translateY(12rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pawReadGlow {
  0% {
    opacity: 0.42;
    transform: scale(0.84);
  }
  65% {
    opacity: 1;
    transform: scale(1.08);
  }
  100% {
    opacity: 0.92;
    transform: scale(1);
  }
}

@keyframes ownerCallRise {
  from {
    opacity: 0;
    transform: translateY(26rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes typingDot {
  0%, 80%, 100% {
    transform: translateY(0);
    opacity: 0.32;
  }
  40% {
    transform: translateY(-6rpx);
    opacity: 1;
  }
}

.chat-page {
  --ui-bg-1: #F8F2E8;
  --ui-bg-2: #EFE5D5;
  --ui-bg-3: #E7EADF;
  --ui-card: rgba(255, 252, 246, 0.66);
  --ui-border: rgba(255, 255, 255, 0.58);
  --ui-text: #2F2A24;
  --ui-muted: rgba(47, 42, 36, 0.58);
  --ui-accent: #6D5945;
  background:
    radial-gradient(circle at 18% 4%, rgba(232, 188, 128, 0.24) 0%, rgba(255, 255, 255, 0) 34%),
    linear-gradient(145deg, var(--ui-bg-1) 0%, var(--ui-bg-2) 52%, var(--ui-bg-3) 100%);
  animation: chatFadeUp 360ms ease both;
}

.chat-page.theme-memorial {
  --ui-bg-1: #F3F1ED;
  --ui-bg-2: #E5E7EE;
  --ui-bg-3: #DDD8E8;
  --ui-card: rgba(255, 255, 255, 0.58);
  --ui-border: rgba(255, 255, 255, 0.54);
  --ui-text: #292B32;
  --ui-muted: rgba(41, 43, 50, 0.56);
  --ui-accent: #5F6478;
}

.chat-header {
  background: rgba(255, 252, 246, 0.58);
  border-bottom: 1rpx solid var(--ui-border);
  box-shadow: 0 12rpx 34rpx rgba(72, 58, 43, 0.045);
}

.header-title,
.prompt-title,
.context-title {
  color: var(--ui-text);
}

.header-subtitle,
.prompt-safety {
  color: var(--ui-muted);
}

.pet-mini,
.message-right .avatar,
.send-btn {
  background: var(--ui-accent);
}

.prompt-pill,
.prompt-panel,
.context-card,
.suggestion-item,
.service-tab,
.chat-input {
  border-color: var(--ui-border);
  background: var(--ui-card);
  box-shadow: 0 14rpx 36rpx rgba(72, 58, 43, 0.05);
}

.prompt-panel,
.context-card,
.message-bubble,
.suggestion-item,
.chat-input {
  border-radius: 28rpx;
}

.message-left .message-bubble {
  background: rgba(255, 252, 246, 0.76);
  border-color: var(--ui-border);
}

.message-right .message-bubble {
  background: linear-gradient(145deg, var(--ui-accent), rgba(81, 67, 55, 0.92));
}

.service-strip,
.input-bar {
  background: rgba(248, 242, 232, 0.72);
}

.input-bar {
  border-top: 1rpx solid var(--ui-border);
}

.round-tool,
.collapse-btn,
.context-badge {
  background: rgba(255, 255, 255, 0.42);
}

.prompt-pill,
.collapse-btn,
.suggestion-item,
.service-tab,
.round-tool,
.send-btn {
  transition: transform 160ms ease, opacity 160ms ease;
}

.prompt-pill-hover,
.collapse-btn-hover,
.suggestion-item-hover,
.service-tab-hover,
.tool-hover,
.send-btn-hover {
  transform: scale(0.985);
  opacity: 0.84;
}

.send-btn-hover,
.tool-hover {
  transform: scale(0.94);
}

@keyframes chatFadeUp {
  from {
    opacity: 0;
    transform: translateY(14rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.reduce-motion.chat-page {
  animation: none;
}
</style>
