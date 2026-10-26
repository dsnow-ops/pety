<template>
  <view class="legal-page" :class="petThemeClass" :style="appThemeStyle">
    <scroll-view scroll-y class="legal-scroll">
      <view class="legal-shell">
        <view class="legal-header"><button class="back-button" @click="goBack"><uni-icons type="left" size="22" color="#4A443D"></uni-icons></button><text class="legal-title">{{ document.title }}</text><view class="header-space"></view></view>
        <view class="draft-note">当前为发布前产品文本，正式上线前仍需完成法务审核与版本标注。</view>
        <view class="legal-content">
          <view v-for="section in document.sections" :key="section.title" class="legal-section"><text class="section-title">{{ section.title }}</text><text class="section-body">{{ section.body }}</text></view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import { getAppLocale } from '../../common/i18n.js';

const DOCUMENTS = {
  terms: {
    title: '用户协议',
    sections: [
      { title: '服务范围', body: '归爪用于宠物关系档案、日常记录、问诊准备与用户主动开启的怀念陪伴。AI 内容仅作辅助，不替代兽医诊断、治疗或现实中的专业支持。' },
      { title: '账号与本地数据', body: '登录用于验证云端账号。当前宠物、聊天、日历、档案、人设与照片主要保存在本机，登录或退出不会自动删除这些数据，也不代表已开启云端同步。' },
      { title: '使用边界', body: '请勿上传密码、支付信息、违法内容或无关隐私。用户应核对自己提交的宠物资料，并对重要医疗决定寻求专业兽医意见。' },
      { title: '账号操作', body: '退出登录只结束当前账号会话。账号注销需由真实服务端能力完成；在该能力接入前，归爪不会用清空本地数据冒充账号注销。' }
    ]
  },
  privacy: {
    title: '隐私政策',
    sections: [
      { title: '我们处理的信息', body: '账号登录会处理必要的账号标识与会话信息。宠物档案、聊天、日历、人设和照片当前主要保存在本机；使用 AI 对话时，会发送当前问题与必要的宠物上下文。' },
      { title: '我们不会默认上传的内容', body: '归爪不会默认上传完整聊天历史、完整宠物档案、联系人、精确地址、支付信息或未由你主动选择的照片。' },
      { title: '设备与反馈', body: '留言信箱只有在你选择附带诊断信息时，才提交轻量平台与版本信息；主动选择的图片会先上传云存储，不会以 base64 写入数据库。' },
      { title: '本地数据保护', body: '退出登录不会清空本机宠物、聊天、日历、档案、人设与照片。卸载 App 或清除应用数据可能导致尚未云端同步的本地内容无法恢复。' }
    ]
  },
  'ai-data': {
    title: 'AI 数据使用说明',
    sections: [
      { title: '何时传输', body: '只有当你主动使用 AI 对话或宠物形象生成时，归爪才会传输完成该功能所需的最少数据。选择本地照片本身不会触发上传。' },
      { title: '阿里云百炼 / 通义万相', body: '宠物形象生成可能发送你主动选择的宠物照片临时链接、固定生成指令和你主动填写的调整要求，仅用于生成或调整宠物形象。' },
      { title: 'DeepSeek（深度求索）', body: 'AI 对话可能发送你的当前输入、必要的近期上下文、最少宠物档案信息，以及怀念模式下已经确认的人格摘要，仅用于本次回复或你主动请求的 AI 功能。' },
      { title: '撤回同意', body: '你可以在设置中撤回授权。撤回不会删除本机已保存的数据；下一次使用相关 AI 功能时，归爪会重新请求明确同意。' }
    ]
  },
  'ai-data-en': {
    title: 'AI Features & Data Sharing',
    sections: [
      { title: 'When data is shared', body: 'Lumière Pet sends the minimum data necessary only when you actively use AI chat or pet-avatar generation. Selecting a local photo alone does not upload it.' },
      { title: 'Alibaba Cloud Model Studio / Wan', body: 'Pet-avatar generation may send temporary links to pet photos you select, fixed generation instructions, and adjustments you enter. This data is used only to generate or adjust the avatar.' },
      { title: 'DeepSeek', body: 'AI chat may send your current message, necessary recent context, minimum pet profile information, and confirmed remembrance-persona summaries. This is used only for the current response or AI feature you request.' },
      { title: 'Withdrawal', body: 'You can revoke consent in Settings. Existing local data is not deleted. Lumière Pet will ask again before the next related AI request.' }
    ]
  }
};

export default {
  data() {
    return { type: 'terms', locale: getAppLocale() };
  },
  computed: {
    document() {
      const key = this.type === 'ai-data' && this.locale === 'en' ? 'ai-data-en' : this.type;
      return DOCUMENTS[key] || DOCUMENTS.terms;
    }
  },
  onLoad(options = {}) {
    this.type = ['privacy', 'ai-data'].includes(options.type) ? options.type : 'terms';
  },
  methods: {
    goBack() {
      uni.navigateBack();
    }
  }
};
</script>

<style scoped>
.legal-page { min-height: 100vh; background: #F5F2EC; color: #302D29; }
.legal-scroll { height: 100vh; }
.legal-shell { min-height: 100vh; padding: calc(var(--status-bar-height, 0px) + 28rpx) 32rpx calc(44rpx + env(safe-area-inset-bottom)); box-sizing: border-box; }
.legal-header { display: flex; align-items: center; }
.back-button { width: 88rpx; height: 88rpx; padding: 0; margin: 0; background: transparent; }
.back-button::after { border: none; }
.legal-title { flex: 1; font-size: 34rpx; font-weight: 650; text-align: center; }
.header-space { width: 88rpx; }
.draft-note { margin-top: 20rpx; padding: 20rpx 22rpx; border-radius: 18rpx; background: #ECE7DE; color: #71685F; font-size: 21rpx; line-height: 1.5; }
.legal-content { margin-top: 22rpx; padding: 6rpx 28rpx; border: 1rpx solid #E1DDD5; border-radius: 26rpx; background: rgba(255,255,255,.7); }
.legal-section { padding: 28rpx 0; border-bottom: 1rpx solid #E5E1DA; }
.legal-section:last-child { border-bottom: 0; }
.section-title, .section-body { display: block; }
.section-title { font-size: 27rpx; font-weight: 600; }
.section-body { margin-top: 12rpx; color: #706A63; font-size: 23rpx; line-height: 1.75; }
</style>
