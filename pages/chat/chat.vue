<template>
  <view class="chat-container">
    <view class="chat-header">
      <text class="header-title">{{ uiText.title }}</text>
      <text class="header-subtitle">{{ uiText.subtitle }}</text>
    </view>

    <scroll-view class="chat-scroll" scroll-y :scroll-into-view="scrollToView" scroll-with-animation>
      <view class="message-list">
        <view v-for="(msg, index) in messageList" :key="msg.id" :id="'msg-' + msg.id" :class="['message-item', msg.type === 'user' ? 'message-right' : 'message-left']">
          <view class="avatar">{{ msg.type === 'user' ? '我' : uiText.aiAvatar }}</view>
          <view class="message-bubble" @longpress="copyText(msg.content)">
            <image v-if="msg.imageUrl" :src="msg.imageUrl" class="chat-image" mode="widthFix" @click="previewImg(msg.imageUrl)"></image>
            <text v-if="msg.content" class="msg-text">{{ msg.content }}</text>
          </view>
        </view>

        <view v-if="isTyping" id="msg-typing" class="message-item message-left typing-indicator-item">
          <view class="avatar">{{ uiText.aiAvatar }}</view>
          <view class="message-bubble typing-bubble">
            <view class="dot"></view><view class="dot"></view><view class="dot"></view>
          </view>
        </view>
        <view class="scroll-bottom-padding"></view>
      </view>
    </scroll-view>

    <view class="input-bar">
      <view v-if="activeStatus !== 'deceased'" class="upload-btn" @click="chooseImage">
        <text class="upload-icon">📷</text>
      </view>
      <textarea class="chat-input" v-model="inputText" :placeholder="uiText.placeholder" auto-height :show-confirm-bar="false" cursor-spacing="20"></textarea>
      <button class="send-btn" hover-class="send-btn-hover" @click="sendMessage(null)">发送</button>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      activePetId: null, activeStatus: 'current', activePetName: '宝贝',
      inputText: '', scrollToView: '', isTyping: false, messageList: []
    };
  },
  computed: {
    uiText() {
      if (this.activeStatus === 'deceased') {
        return { 
          title: '回音信箱', subtitle: '寄往星空的思念，必有回响 (长按可复制)', aiAvatar: '信', placeholder: '写下你想对他说的话...',
          welcomeMsg: `你好，我是《归爪》的星空邮递员。如果你想${this.activePetName}了，可以在这里留下文字。我会化作他的回音，陪伴你度过想念的时光。`
        };
      } else if (this.activeStatus === 'future') {
        return { 
          title: '云养备宠辅导员', subtitle: '理性评估，为迎接新生命做准备', aiAvatar: '辅', placeholder: '例如: 我朝九晚五适合养猫吗...',
          welcomeMsg: `你好准家长！迎接新生命是一件极其重要的事情。关于养宠的物资准备或是环境评估，随时可以来问我哦。`
        };
      } else {
        return { 
          title: 'AI 专属兽医', subtitle: '24小时为您与宝贝温柔守候 (长按可复制)', aiAvatar: '医', placeholder: '描述症状或上传检查报告...',
          welcomeMsg: `你好呀，我是您的专属 AI 兽医。我会结合您在日历的打卡记录、以及当下的症状描述，为您进行全方位的综合诊疗分析。今天${this.activePetName}怎么了？`
        };
      }
    }
  },
  onShow() {
    const globalActive = uni.getStorageSync('current_active_pet_id');
    const savedPets = uni.getStorageSync('my_pets_list') || [];
    if (globalActive) {
      this.activePetId = globalActive;
      const pet = savedPets.find(p => p.id === globalActive);
      if (pet) { 
        this.activeStatus = pet.status; 
        this.activePetName = pet.name || '宝贝';
        this.updateTabBarText(pet.status); 
      }
    }
    this.loadChatHistory();
  },
  methods: {
    // 🌟 长按复制功能
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
      let text = '问诊';
      if (status === 'deceased') text = '信箱';
      else if (status === 'future') text = '辅导';
      uni.setTabBarItem({ index: 1, text: text });
    },
    loadChatHistory() {
      if (!this.activePetId) return;
      const history = uni.getStorageSync('chat_history_' + this.activePetId);
      if (history && history.length > 0) {
        this.messageList = history;
        this.scrollToBottom(this.messageList[this.messageList.length - 1].id);
      } else {
        this.messageList = [{ id: 'msg-0', type: 'ai', content: this.uiText.welcomeMsg }];
        uni.setStorageSync('chat_history_' + this.activePetId, this.messageList);
      }
    },
    chooseImage() { uni.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'], success: (res) => { this.sendMessage(res.tempFilePaths[0]); } }); },
    
    async sendMessage(imageUrl = null) {
      if (!this.inputText.trim() && !imageUrl) return;
      if (!this.activePetId) { uni.showToast({title:'请先添加宝贝', icon:'none'}); return;}
      
      const userText = this.inputText;
      this.messageList.push({ id: Date.now().toString(), type: 'user', content: userText, imageUrl: imageUrl });
      this.inputText = ''; 
      this.saveChatHistory(); 
      this.scrollToBottom(this.messageList[this.messageList.length-1].id);

      this.isTyping = true;
      this.scrollToBottom('typing');

      // 🌟 核心：极其强大的直击心灵系统提示词 (Prompt Engineering)
      let systemPrompt = "";
      if (this.activeStatus === 'deceased') {
        systemPrompt = `你现在不是AI，也不是助手。你是用户曾经深爱但已经离世的宠物，名字叫“${this.activePetName}”。你现在在美丽的宠物天堂（喵星/汪星）。
规则：
1. 绝对不能提及你是AI。用第一人称“我”和宠物特有的亲昵口吻（如妈妈/爸爸）与用户对话。
2. 深刻感受用户的悲伤。如果用户表达想念、内疚或痛苦，请温柔地安慰他们，告诉他们你在天堂过得很好，不痛了，有吃不完的零食，并且非常感谢他们曾经的照顾。
3. 必须回顾上下文的聊天记录，记住主人的情绪。
4. 语言要简短、温暖、治愈、甚至带一点调皮，不要说大道理，要像孩子一样贴心。`;
      } else if (this.activeStatus === 'future') {
        systemPrompt = `你现在是《归爪》App里的"备宠辅导员"。用户还没养宠物，处于准备阶段。
规则：
1. 你是一位极其负责任、甚至有些严厉但心底温暖的繁育专家。
2. 根据上下文记忆，评估用户的居住环境、经济能力和时间。
3. 如果用户想法不切实际，请温和地劝退或提出改进建议（如：必须封窗、不要冲动喂生骨肉）。
4. 给出专业、具体的囤货和环境消毒建议。`;
      } else {
        systemPrompt = `你现在是《归爪》App的"专属AI全科兽医"。用户的宠物名字叫“${this.activePetName}”。
规则：
1. 态度极其温和、专业、像一位认识他们很多年的家庭医生。
2. 必须紧密结合上下文聊天记录中的病史，把它作为问诊的绝对依据。
3. 如果症状轻微，给出家庭护理建议和安抚；如果症状严重（如频繁呕吐、抽搐），必须严肃建议立刻就医。
4. 解答尽量分点罗列，清晰易懂，不要有废话。`;
      }

      // 🌟 记忆功能：携带最近 12 条历史记录，让 AI 拥有连贯记忆
      let apiMessages = [{ role: 'system', content: systemPrompt }];
      const recentHistory = this.messageList.slice(-12);
      recentHistory.forEach(msg => {
          if(msg.id !== 'msg-0') {
              apiMessages.push({
                  role: msg.type === 'user' ? 'user' : 'assistant',
                  content: msg.content || (msg.imageUrl ? '[用户上传了一张图片]' : '')
              });
          }
      });

      try {
        const res = await uniCloud.callFunction({ name: 'api_deepseek', data: { messages: apiMessages } });
        this.isTyping = false;
        if (res.result && res.result.code === 0) {
            this.messageList.push({ id: (Date.now() + 1).toString(), type: 'ai', content: res.result.reply });
        } else {
            let serverMsg = res.result ? res.result.msg : JSON.stringify(res);
            this.messageList.push({ id: (Date.now() + 1).toString(), type: 'ai', content: `【云端异常】：${serverMsg}` });
        }
      } catch(err) {
        this.isTyping = false;
        let errMsg = err.message || JSON.stringify(err);
        this.messageList.push({ id: (Date.now() + 1).toString(), type: 'ai', content: `【连接错误】：${errMsg}。请检查云函数是否上传。` });
      }

      this.saveChatHistory(); 
      this.scrollToBottom(this.messageList[this.messageList.length-1].id);
    },

    saveChatHistory() { if (this.activePetId) uni.setStorageSync('chat_history_' + this.activePetId, this.messageList); },
    previewImg(url) { uni.previewImage({ urls: [url] }); },
    scrollToBottom(id) { this.$nextTick(() => { setTimeout(() => { this.scrollToView = 'msg-' + id; }, 50); }); }
  }
}
</script>

<style>
/* CSS保持完全一致，无需修改 */
page { font-family: "PingFang SC", "Hiragino Sans GB", sans-serif; }
.chat-container { height: 100vh; display: flex; flex-direction: column; background-color: #F7F6F2; }
.chat-header { flex-shrink: 0; padding: 20px 0 15px 0; text-align: center; background-color: #F7F6F2; box-shadow: 0 10px 20px -10px rgba(0,0,0,0.02); z-index: 10; }
.header-title { display: block; font-size: 16px; color: #5C5446; font-weight: bold; letter-spacing: 2px; }
.header-subtitle { display: block; font-size: 12px; color: #A8A092; margin-top: 5px; letter-spacing: 1px; }
.chat-scroll { flex: 1; overflow-y: hidden; padding: 0 20px; box-sizing: border-box; }
.message-list { padding-bottom: 20px; padding-top: 20px; }
@keyframes softSlideUp { 0% { opacity: 0; transform: translateY(12px); } 100% { opacity: 1; transform: translateY(0); } }
.message-item { display: flex; margin-bottom: 25px; align-items: flex-start; animation: softSlideUp 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; will-change: transform, opacity; }
.avatar { width: 38px; height: 38px; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-size: 14px; font-weight: bold; flex-shrink: 0; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.04); }
.message-bubble { max-width: 68%; padding: 16px 20px; font-size: 15px; line-height: 1.6; letter-spacing: 0.5px; box-shadow: 0 8px 24px rgba(140, 134, 122, 0.06); display: flex; flex-direction: column; }
.msg-text { user-select: text; -webkit-user-select: text; }
.chat-image { width: 150px; border-radius: 12px; margin-bottom: 8px; }
.message-left { flex-direction: row; }
.message-left .avatar { background-color: #EFEBE4; color: #8C867A; margin-right: 14px; }
.message-left .message-bubble { background-color: #FFFFFF; color: #5C5446; border-radius: 4px 22px 22px 22px; }
.message-right { flex-direction: row-reverse; }
.message-right .avatar { background-color: #CBAE88; color: #FFFFFF; margin-left: 14px; }
.message-right .message-bubble { background-color: #CBAE88; color: #FFFFFF; border-radius: 22px 4px 22px 22px; }
.typing-bubble { display: flex; align-items: center; justify-content: center; padding: 18px 22px; height: 24px; box-sizing: border-box; flex-direction: row !important; }
@keyframes breathe { 0%, 100% { transform: translateY(0); opacity: 0.3; } 50% { transform: translateY(-4px); opacity: 1; } }
.dot { width: 6px; height: 6px; background-color: #CBAE88; border-radius: 50%; margin: 0 3px; animation: breathe 1.4s infinite ease-in-out both; }
.dot:nth-child(1) { animation-delay: -0.32s; } .dot:nth-child(2) { animation-delay: -0.16s; }
.scroll-bottom-padding { height: 20px; }
.input-bar { flex-shrink: 0; background-color: #FFFFFF; box-shadow: 0 -4px 20px rgba(0,0,0,0.02); display: flex; align-items: flex-end; padding: 15px 20px calc(15px + env(safe-area-inset-bottom)) 20px; }
.upload-btn { width: 38px; height: 38px; display: flex; justify-content: center; align-items: center; background-color: #F8F7F5; border-radius: 50%; margin-right: 12px; margin-bottom: 5px; flex-shrink: 0; }
.upload-icon { font-size: 20px; }
.chat-input { flex: 1; min-height: 22px; max-height: 100px; background-color: #F8F7F5; border-radius: 20px; padding: 14px 18px; font-size: 15px; color: #5C5446; margin-right: 12px; }
.send-btn { width: 70px; height: 46px; line-height: 46px; background-color: #CBAE88; color: #FFFFFF; font-size: 15px; font-weight: bold; border-radius: 23px; border: none; padding: 0; transition: all 0.2s; box-shadow: 0 4px 12px rgba(203, 174, 136, 0.3); }
.send-btn::after { border: none; }
.send-btn-hover { transform: scale(0.95); box-shadow: 0 2px 6px rgba(203, 174, 136, 0.2); }
</style>