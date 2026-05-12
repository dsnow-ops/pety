<template>
  <view class="profile-container">
    
    <view class="user-header">
      <view class="avatar-section" v-if="activePet">
        <image :src="activePet.avatar" class="user-avatar" mode="aspectFill"></image>
        <view class="user-info">
          <text class="user-name">{{ activePet.name || '我的宝贝' }}</text>
          <text class="user-desc">这是陪伴他/她的专属空间</text>
        </view>
      </view>
      <view class="avatar-section" v-else>
        <view class="user-avatar-placeholder">主</view>
        <view class="user-info">
          <text class="user-name">未登录</text>
          <text class="user-desc">请先去大堂结识宝贝</text>
        </view>
      </view>
    </view>

    <view class="stats-board">
      <view class="stat-item">
        <text class="stat-num">{{ memoryCount }}</text>
        <text class="stat-label">回忆瞬间</text>
      </view>
      <view class="stat-divider"></view>
      <view class="stat-item">
        <text class="stat-num">{{ eventCount }}</text>
        <text class="stat-label">专属打卡</text>
      </view>
      <view class="stat-divider"></view>
      <view class="stat-item">
        <text class="stat-num">{{ chatCount }}</text>
        <text class="stat-label">问诊对话</text>
      </view>
    </view>

    <view class="menu-section">
      <view class="menu-list">
        <view class="menu-item">
          <view class="menu-left">
            <text class="menu-icon">👑</text>
            <text class="menu-text">开通 Plus 专属会员</text>
          </view>
          <text class="menu-arrow">›</text>
        </view>
        <view class="menu-item">
          <view class="menu-left">
            <text class="menu-icon">🗂️</text>
            <text class="menu-text">宝贝档案管理</text>
          </view>
          <text class="menu-arrow">›</text>
        </view>
        <view class="menu-item">
          <view class="menu-left">
            <text class="menu-icon">☁️</text>
            <text class="menu-text">数据云端同步</text>
          </view>
          <text class="menu-arrow">›</text>
        </view>
      </view>

      <view class="menu-list secondary-menu">
        <view class="menu-item">
          <view class="menu-left">
            <text class="menu-icon">📖</text>
            <text class="menu-text">导出回忆纪念册</text>
          </view>
          <text class="menu-arrow">›</text>
        </view>
        <view class="menu-item">
          <view class="menu-left">
            <text class="menu-icon">💌</text>
            <text class="menu-text">关于《归爪》</text>
          </view>
          <text class="menu-arrow">›</text>
        </view>
      </view>
    </view>

  </view>
</template>

<script>
export default {
  data() {
    return {
      activePetId: null,
      activePet: null,
      memoryCount: 0,
      eventCount: 0,
      chatCount: 0
    };
  },
  onShow() {
    // 1. 读取当前活跃的宠物
    const globalActive = uni.getStorageSync('current_active_pet_id');
    const savedPets = uni.getStorageSync('my_pets_list') || [];
    
    if (globalActive) {
      this.activePetId = globalActive;
      this.activePet = savedPets.find(p => p.id === globalActive);
    } else {
      this.activePet = null;
    }

    // 2. 计算这只宠物的真实数据！
    this.calculateStats();
  },
  methods: {
    calculateStats() {
      if (!this.activePetId) return;

      // 统计日记与打卡次数
      const history = uni.getStorageSync('pet_diaries_' + this.activePetId) || {};
      const dates = Object.keys(history);
      this.memoryCount = dates.length; // 写了多少天日记

      let eventsTotal = 0;
      dates.forEach(date => {
        if (history[date].events && history[date].events.length > 0) {
          eventsTotal += history[date].events.length;
        }
      });
      this.eventCount = eventsTotal; // 总共打了多少个卡

      // 统计聊天问诊次数
      const chatHistory = uni.getStorageSync('chat_history_' + this.activePetId) || [];
      // 减去 AI 的默认开场白，剩下的用户提问记为问诊对话数
      this.chatCount = Math.max(0, chatHistory.filter(msg => msg.type === 'user').length);
    }
  }
}
</script>

<style>
page { font-family: "PingFang SC", "Hiragino Sans GB", sans-serif; background-color: #F7F6F2; }

.profile-container { min-height: 100vh; display: flex; flex-direction: column; }

.user-header { background-color: #EFEBE4; padding: 80px 30px 40px 30px; border-bottom-left-radius: 40px; border-bottom-right-radius: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.02); }
.avatar-section { display: flex; align-items: center; }
.user-avatar { width: 75px; height: 75px; border-radius: 50%; border: 3px solid #FFFFFF; box-shadow: 0 8px 20px rgba(140, 134, 122, 0.15); object-fit: cover; margin-right: 20px; background-color: #FFFFFF;}
.user-avatar-placeholder { width: 75px; height: 75px; background-color: #CBAE88; border-radius: 50%; color: #FFFFFF; font-size: 24px; font-weight: bold; display: flex; justify-content: center; align-items: center; margin-right: 20px; }

.user-name { display: block; font-size: 22px; color: #5C5446; font-weight: bold; margin-bottom: 5px; letter-spacing: 1px; }
.user-desc { display: block; font-size: 13px; color: #8C867A; letter-spacing: 1px; }

.stats-board { margin: -25px 25px 25px 25px; background-color: #FFFFFF; border-radius: 20px; display: flex; justify-content: space-around; align-items: center; padding: 25px 15px; box-shadow: 0 8px 25px rgba(0,0,0,0.03); position: relative; z-index: 10; }
.stat-item { display: flex; flex-direction: column; align-items: center; flex: 1; }
.stat-num { font-size: 24px; font-weight: bold; color: #CBAE88; margin-bottom: 5px; font-family: "Constantia", serif; }
.stat-label { font-size: 13px; color: #A8A092; }
.stat-divider { width: 1px; height: 25px; background-color: #F1EDE4; }

.menu-section { padding: 0 25px; }
.menu-list { background-color: #FFFFFF; border-radius: 20px; padding: 5px 25px; margin-bottom: 20px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.02); }
.menu-item { display: flex; justify-content: space-between; align-items: center; padding: 20px 0; border-bottom: 1px solid #F8F7F5; }
.menu-item:last-child { border-bottom: none; }
.menu-left { display: flex; align-items: center; }
.menu-icon { font-size: 18px; margin-right: 12px; }
.menu-text { font-size: 15px; color: #5C5446; letter-spacing: 1px; }
.menu-arrow { font-size: 20px; color: #D1CBC0; font-family: "Courier New", monospace; }
</style>