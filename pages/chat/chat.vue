<template>
  <view class="chat-page">
    <view class="chat-header">
      <view class="pet-mini">
        <image v-if="activePetPhoto" :src="activePetPhoto" class="pet-mini-img" mode="aspectFill"></image>
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
              <text class="prompt-kicker">SMART GUIDE</text>
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

        <view v-if="contextBadges.length" class="context-card">
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
          <view class="avatar">{{ msg.type === 'user' ? '我' : uiText.aiAvatar }}</view>
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
        </view>

        <view v-if="isTyping" id="message-typing" class="message-item message-left">
          <view class="avatar">{{ uiText.aiAvatar }}</view>
          <view class="message-bubble typing-bubble">
            <view class="typing-dot"></view>
            <view class="typing-dot"></view>
            <view class="typing-dot"></view>
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
      <button class="send-btn" hover-class="send-btn-hover" @click="sendMessage(null)">
        <uni-icons type="paperplane-filled" size="20" color="#FBFAF6"></uni-icons>
      </button>
    </view>
  </view>
</template>

<script>
import { getActivePet } from '../../common/pet-store.js';
import { buildDiaryContext } from '../../common/diary-store.js';
import { buildProfileContext, getPetProfile } from '../../common/profile-store.js';
import { saveConsultationRecord } from '../../common/consultation-store.js';
import { getRelationshipConfig, setRelationshipTabBar } from '../../common/relationship-config.js';

const MAX_CLOUD_MESSAGE_CHARS = 760;
const SAFETY_FOOTER = '我先陪你把情况梳理到这里。若宝贝的症状持续、加重，或出现明显疼痛、精神沉郁、脱水等变化，请尽快联系线下兽医，让它得到更稳妥的检查。';
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
      messageList: []
    };
  },
  computed: {
    relationshipConfig() {
      return getRelationshipConfig(this.activeStatus);
    },
    promptSuggestions() {
      return this.relationshipConfig.chat.suggestions(this.activePetName);
    },
    serviceActions() {
      return this.relationshipConfig.chat.serviceActions;
    },
    showCameraButton() {
      return this.relationshipConfig.chat.showCamera;
    },
    contextBadges() {
      const badges = [];
      if (!this.activePetId || !this.activePet) return badges;

      const profileContext = buildProfileContext(this.activePet, getPetProfile(this.activePetId), { maxChars: 240 });
      const diaryContext = buildDiaryContext(this.activePetId, { maxDays: 14, maxChars: 220 });

      if (profileContext) badges.push('基础档案');
      if (diaryContext) badges.push('最近日历');
      return badges;
    },
    uiText() {
      const chat = this.relationshipConfig.chat;
      return {
        title: chat.title,
        subtitle: chat.subtitle(this.activePetName),
        aiAvatar: chat.aiAvatar,
        placeholder: chat.placeholder,
        welcomeMsg: chat.welcomeMsg(this.activePetName),
        promptTitle: chat.promptTitle,
        collapsedText: chat.collapsedText
      };
    }
  },
  onShow() {
    const activePet = getActivePet();
    if (activePet) {
      this.activePet = activePet;
      this.activePetId = activePet.id;
      this.activeStatus = activePet.status;
      this.activePetName = activePet.name || '宝贝';
      this.activePetPhoto = activePet.photo || activePet.avatar || '';
      this.updateTabBarText(activePet.status);
    } else {
      this.activePet = null;
      this.activePetId = null;
      this.activeStatus = 'current';
      this.activePetName = '宝贝';
      this.activePetPhoto = '';
      this.messageList = [];
      this.updateTabBarText('current');
    }
    this.loadChatHistory();
    this.applyPendingPrompt();
  },
  methods: {
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
        return;
      }

      const history = uni.getStorageSync('chat_history_' + this.activePetId);
      if (history && history.length > 0) {
        this.messageList = history;
        this.scrollToBottom(this.messageList[this.messageList.length - 1].id);
      } else {
        this.messageList = [{ id: '0', type: 'ai', content: this.uiText.welcomeMsg }];
        uni.setStorageSync('chat_history_' + this.activePetId, this.messageList);
      }
    },
    applyPendingPrompt() {
      const pendingPrompt = uni.getStorageSync('pending_chat_prompt');
      if (!pendingPrompt) return;
      this.inputText = pendingPrompt;
      uni.removeStorageSync('pending_chat_prompt');
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
        letter: `我想写一封给${this.activePetName}的信，可以陪我慢慢整理吗？`,
        memory: `我想整理一段关于${this.activePetName}的回忆，可以温柔地引导我吗？`,
        anniversary: `我想为${this.activePetName}整理一个纪念日和纪念方式。`,
        comfort: '我今天有点想它，可以陪我说一会儿吗？'
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
      const currentQuestion = trimmedText ? `用户当前问题：${trimmedText}` : '用户当前问题：上传了一张图片。';
      const imageHint = imageUrl
        ? '用户上传了一张图片。请提醒用户补充图片中的关键症状或检查结果文字描述，不要声称已经看到了图片。'
        : '';
      const fixedContent = [currentQuestion, imageHint].filter(Boolean).join('\n');
      const profileContext = buildProfileContext(this.activePet, getPetProfile(this.activePetId), {
        maxChars: Math.min(240, Math.max(MAX_CLOUD_MESSAGE_CHARS - fixedContent.length - 48, 0))
      });
      const diaryBudget = Math.max(MAX_CLOUD_MESSAGE_CHARS - fixedContent.length - profileContext.length - 32, 0);
      const diaryContext = buildDiaryContext(this.activePetId, {
        maxDays: 14,
        maxChars: Math.min(diaryBudget, 420)
      });
      const message = [profileContext, diaryContext, fixedContent].filter(Boolean).join('\n\n');

      if (message.length <= MAX_CLOUD_MESSAGE_CHARS) {
        return message;
      }

      if (trimmedText.length > MAX_CLOUD_MESSAGE_CHARS - 24) {
        return `用户当前问题：${trimmedText.slice(0, MAX_CLOUD_MESSAGE_CHARS - 32)}…`;
      }

      if (imageUrl) {
        return [profileContext, diaryContext, currentQuestion].filter(Boolean).join('\n\n').slice(0, MAX_CLOUD_MESSAGE_CHARS);
      }

      return currentQuestion;
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
    decorateAssistantReply(reply, riskInfo) {
      if (this.activeStatus === 'deceased') {
        return `${reply}\n\n我会陪你慢慢收好今天这一点想念，不急着把它变成什么结论。`;
      }

      if (this.activeStatus === 'future') {
        return `${reply}\n\n准备可以慢慢来。我们先把最重要的条件理清，再一步一步迎接它。`;
      }

      const urgentFooter = riskInfo && riskInfo.level === 'urgent'
        ? '如果这些症状现在仍在发生，请先把宝贝的安全放在第一位，尽快联系附近兽医或急诊。我也可以帮你整理就医前要说清楚的信息。'
        : SAFETY_FOOTER;

      return `${reply}\n\n${urgentFooter}`;
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
      if (this.isTyping) {
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

      this.messageList.push({ id: Date.now().toString(), type: 'user', content: userText, imageUrl });
      this.inputText = '';
      this.saveChatHistory();
      this.scrollToBottom(this.messageList[this.messageList.length - 1].id);

      this.isTyping = true;
      this.scrollToBottom('typing');

      const userMessage = this.buildUserMessage(userText, imageUrl);

      try {
        const res = await uniCloud.callFunction({ name: 'api_deepseek', data: { userMessage } });
        this.isTyping = false;
        if (res.result && res.result.code === 0) {
          const reply = res.result.outOfScope
            ? res.result.reply
            : this.decorateAssistantReply(res.result.reply, riskInfo);
          this.messageList.push({ id: (Date.now() + 1).toString(), type: 'ai', content: reply });
          if (!res.result.outOfScope) {
            this.saveConsultationSummary(userText || '图片提问', reply, riskInfo);
          }
        } else {
          console.warn('api_deepseek_failed', res && res.result ? res.result.code : 'no_result');
          this.messageList.push({ id: (Date.now() + 1).toString(), type: 'ai', content: 'AI 服务暂时不可用，请稍后再试。' });
        }
      } catch (err) {
        this.isTyping = false;
        console.warn('api_deepseek_call_failed', err && (err.errCode || err.message));
        this.messageList.push({ id: (Date.now() + 1).toString(), type: 'ai', content: 'AI 服务暂时不可用，请稍后再试。' });
      }

      this.saveChatHistory();
      this.scrollToBottom(this.messageList[this.messageList.length - 1].id);
    },
    saveChatHistory() {
      if (this.activePetId) uni.setStorageSync('chat_history_' + this.activePetId, this.messageList);
    },
    previewImg(url) {
      uni.previewImage({ urls: [url] });
    },
    scrollToBottom(id) {
      this.$nextTick(() => {
        setTimeout(() => {
          this.scrollToView = 'message-' + id;
        }, 50);
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
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 22rpx;
  font-weight: 600;
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

.message-bubble {
  max-width: 68%;
  padding: 22rpx 26rpx;
  border-radius: 16rpx;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  box-shadow: 0 12rpx 30rpx rgba(58, 51, 43, 0.05);
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

.chat-image {
  width: 300rpx;
  border-radius: 14rpx;
  margin-bottom: 14rpx;
}

.typing-bubble {
  min-width: 96rpx;
  min-height: 56rpx;
  flex-direction: row;
  align-items: center;
  justify-content: center;
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
</style>
