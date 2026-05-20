<template>
  <view class="home-page">
    <view class="home-hero">
      <view class="brand-bar">
        <view class="brand-copy">
          <text class="brand-en">Lumière Pet</text>
          <text class="brand-cn">归爪</text>
        </view>
        <button class="icon-button" hover-class="icon-button-hover" @click="showMenu">
          <uni-icons type="more-filled" size="22" color="#3A332B"></uni-icons>
        </button>
      </view>

      <view class="pet-stage">
        <text class="stage-kicker">{{ statusText }}</text>
        <text class="pet-name-title">{{ petName }}</text>

        <view v-if="mode === 'simple'" class="photo-stage">
          <image class="pet-main-img" :src="petPhoto" mode="aspectFit"></image>
          <view class="stage-shadow"></view>
        </view>

        <view v-else class="pixi-box" id="pixi-canvas"></view>
      </view>
    </view>

    <scroll-view scroll-y class="home-scroll">
      <view class="hero-spacer"></view>
      <view class="home-content">
        <view class="today-row">
          <view>
            <text class="section-kicker">TODAY</text>
            <text class="section-title">{{ todayTitle }}</text>
          </view>
          <view class="mode-chip">{{ modeText }}</view>
        </view>

        <view class="quick-grid">
          <view
            v-for="item in quickActions"
            :key="item.key"
            class="quick-item"
            hover-class="quick-item-hover"
            @click="handleQuickAction(item.key)"
          >
            <view class="quick-icon">
              <uni-icons :type="item.icon" size="22" color="#3A332B"></uni-icons>
            </view>
            <text class="quick-title">{{ item.title }}</text>
            <text class="quick-desc">{{ item.desc }}</text>
          </view>
        </view>

        <view class="insight-card">
          <view class="card-head">
            <view>
              <text class="card-kicker">{{ relationshipConfig.home.insightKicker }}</text>
              <text class="card-title">{{ relationshipConfig.home.insightTitle }}</text>
            </view>
            <button class="text-button" hover-class="text-button-hover" @click="openArchive">
              <text>查看</text>
              <uni-icons type="right" size="14" color="#8C7557"></uni-icons>
            </button>
          </view>

          <view class="metric-row">
            <view class="metric-item">
              <text class="metric-num">{{ petStats.days }}</text>
              <text class="metric-label">{{ metricLabels[0] }}</text>
            </view>
            <view class="metric-line"></view>
            <view class="metric-item">
              <text class="metric-num">{{ petStats.moments }}</text>
              <text class="metric-label">{{ metricLabels[1] }}</text>
            </view>
            <view class="metric-line"></view>
            <view class="metric-item">
              <text class="metric-num">{{ petStats.chats }}</text>
              <text class="metric-label">{{ metricLabels[2] }}</text>
            </view>
          </view>
        </view>

        <view class="archive-panel" hover-class="archive-panel-hover" @click="openArchive">
          <view class="archive-main">
            <text class="card-kicker">{{ relationshipConfig.home.archiveKicker }}</text>
            <text class="archive-title">{{ archiveTitle }}</text>
            <text class="archive-desc">{{ archiveDesc }}</text>
          </view>
          <view class="archive-list">
            <view v-for="line in archiveLines" :key="line.label" class="archive-line">
              <text class="archive-label">{{ line.label }}</text>
              <text class="archive-value">{{ line.value }}</text>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import { getActivePet, updateActivePet } from '../../common/pet-store.js';
import { formatDateKey, getDiaryRecord, getEventLabel, getMoodLabel, hasDiaryRecord } from '../../common/diary-store.js';
import { formatPetAge, getNeuteredLabel, getPetProfile, getProfileCompletion, getSpeciesLabel } from '../../common/profile-store.js';
import { getRelationshipConfig, setRelationshipTabBar } from '../../common/relationship-config.js';

export default {
  data() {
    return {
      activePet: null,
      petName: '毛孩子',
      petPhoto: '/static/pet.png',
      mode: '2.5d',
      profile: {},
      todayRecord: null,
      petStats: {
        days: 0,
        moments: 0,
        chats: 0
      }
    }
  },
  computed: {
    relationshipConfig() {
      return getRelationshipConfig(this.activePet && this.activePet.status);
    },
    quickActions() {
      return this.relationshipConfig.home.quickActions;
    },
    metricLabels() {
      return this.relationshipConfig.home.metricLabels;
    },
    statusText() {
      if (!this.activePet) return '等待相遇';
      return this.relationshipConfig.stageKicker;
    },
    modeText() {
      return this.mode === 'simple' ? '照片模式' : '2.5D 陪伴';
    },
    todayTitle() {
      if (!this.activePet) return '先为一个生命建立入口';
      return this.relationshipConfig.home.todayTitle(this.petName);
    },
    archiveTitle() {
      if (!this.activePet) return this.relationshipConfig.home.archiveTitleFallback;
      if (this.activePet.status === 'deceased') return this.profile.note ? '一份被收好的想念' : '一份安静的纪念';
      if (this.activePet.status === 'future' && !this.profile.breed) return '还在慢慢确认';
      const species = getSpeciesLabel(this.profile.species);
      const breed = this.profile.breed ? ` · ${this.profile.breed}` : '';
      return `${species}${breed}`;
    },
    archiveDesc() {
      if (!this.activePet) return '添加照片和名字后，首页会自动读取当前宠物数据。';
      if (this.profile.note) return this.profile.note;
      const completion = getProfileCompletion(this.profile);
      return completion ? `档案完整度 ${completion}%，继续补充会让陪伴更贴近它。` : this.relationshipConfig.home.archiveDescEmpty;
    },
    updatedAtText() {
      if (!this.activePet) return '待补充';
      return this.formatDate(this.profile.updatedAt || this.activePet.updatedAt || this.activePet.createdAt);
    },
    ageText() {
      return formatPetAge(this.profile.birthday);
    },
    neuteredText() {
      return getNeuteredLabel(this.profile.neutered);
    },
    todayDiaryText() {
      if (!hasDiaryRecord(this.todayRecord)) return '待记录';
      const events = this.todayRecord.events || [];
      if (events.length) return events.slice(0, 2).map(getEventLabel).join('、');
      return getMoodLabel(this.todayRecord.mood);
    },
    archiveLines() {
      if (!this.activePet) {
        return [
          { label: '状态', value: '待创建' },
          { label: '最近更新', value: '待补充' }
        ];
      }

      if (this.activePet.status === 'future') {
        return [
          { label: '阶段', value: this.relationshipConfig.label },
          { label: '倾向', value: this.archiveTitle },
          { label: this.relationshipConfig.home.diaryLabel, value: this.todayDiaryText },
          { label: '档案完整', value: `${getProfileCompletion(this.profile)}%` },
          { label: '最近更新', value: this.updatedAtText }
        ];
      }

      if (this.activePet.status === 'deceased') {
        return [
          { label: '关系', value: this.relationshipConfig.label },
          { label: '记录', value: `${this.petStats.moments} 条` },
          { label: this.relationshipConfig.home.diaryLabel, value: this.todayDiaryText },
          { label: '信笺', value: `${this.petStats.chats} 次` },
          { label: '最近更新', value: this.updatedAtText }
        ];
      }

      return [
        { label: '年龄', value: this.ageText },
        { label: '体重', value: this.profile.weight || '待补充' },
        { label: '绝育', value: this.neuteredText },
        { label: this.relationshipConfig.home.diaryLabel, value: this.todayDiaryText },
        { label: '最近更新', value: this.updatedAtText }
      ];
    }
  },
  onShow() {
    this.loadHomeData();
  },
  methods: {
    loadHomeData() {
      const activePet = getActivePet();
      this.activePet = activePet;
      setRelationshipTabBar(activePet && activePet.status);

      if (!activePet) {
        this.petName = '毛孩子';
        this.petPhoto = '/static/pet.png';
        this.mode = '2.5d';
        this.profile = {};
        this.todayRecord = null;
        this.petStats = { days: 0, moments: 0, chats: 0 };
        return;
      }

      this.petName = activePet.name || '毛孩子';
      this.petPhoto = activePet.photo || activePet.avatar || '/static/pet.png';
      this.mode = activePet.mode || '2.5d';
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
    formatDate(value) {
      if (!value) return '待补充';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '待补充';
      const month = `${date.getMonth() + 1}`.padStart(2, '0');
      const day = `${date.getDate()}`.padStart(2, '0');
      return `${month}.${day}`;
    },
    showMenu() {
      uni.showActionSheet({
        itemList: ['编辑当前宝贝', '切换展示方式', '重新进入欢迎页'],
        success: (res) => {
          if (res.tapIndex === 0 || res.tapIndex === 2) {
            uni.reLaunch({ url: '/pages/welcome/welcome' });
            return;
          }

          this.mode = this.mode === 'simple' ? '2.5d' : 'simple';
          updateActivePet({ mode: this.mode });
          this.loadHomeData();
          uni.showToast({ title: `已切换为${this.modeText}`, icon: 'none' });
        }
      });
    },
    handleQuickAction(key) {
      const promptMap = {
        fit: '我想认真评估一下自己是否适合现在养宠。可以从作息、预算、居住环境和照护能力开始问我。',
        supplies: '请帮我整理一份第一次接宠前的用品清单，区分必须准备和可以稍后再买的东西。',
        routine: '请帮我做一个接宠前后一周的流程安排，尽量稳妥、不要太焦虑。',
        letter: `我想写一封给${this.petName}的信，可以陪我慢慢整理吗？`,
        memory: `我想整理一段关于${this.petName}的回忆，可以温柔地引导我吗？`,
        anniversary: `我想为${this.petName}整理一个纪念日和纪念方式。`,
        comfort: '我今天有点想它，可以陪我说一会儿吗？'
      };

      if (promptMap[key]) {
        uni.setStorageSync('pending_chat_prompt', promptMap[key]);
        uni.switchTab({ url: '/pages/chat/chat' });
        return;
      }

      if (key === 'chat') {
        uni.switchTab({ url: '/pages/chat/chat' });
        return;
      }

      if (key === 'archive') {
        this.openArchive();
        return;
      }

      if (key === 'journal' || key === 'memory') {
        uni.navigateTo({ url: '/pages/calendar/calendar' });
        return;
      }

      if (key === 'care') {
        uni.navigateTo({ url: '/pages/care/care' });
        return;
      }

      uni.showToast({ title: '下一步接入', icon: 'none' });
    },
    openProfile() {
      uni.switchTab({ url: '/pages/profile/profile' });
    },
    openArchive() {
      uni.navigateTo({ url: '/pages/archive/archive' });
    }
  }
}
</script>

<script module="pixi" lang="renderjs">
export default {
  data() {
    return {
      pixiApp: null
    }
  },
  mounted() {
    this.initPixi();
  },
  beforeDestroy() {
    this.destroyPixi();
  },
  beforeUnmount() {
    this.destroyPixi();
  },
  methods: {
    getActivePetPhoto() {
      const activePetId = uni.getStorageSync('current_active_pet_id');
      const pets = uni.getStorageSync('my_pets_list') || [];
      const activePet = Array.isArray(pets) ? pets.find(pet => pet.id === activePetId) : null;
      return activePet ? (activePet.photo || activePet.avatar || '/static/pet.png') : '/static/pet.png';
    },
    initPixi() {
      const petPhoto = this.getActivePetPhoto();
      if (typeof window.PIXI === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://pixijs.download/v7.3.2/pixi.min.js';
        script.onload = () => this.startRender(petPhoto);
        document.head.appendChild(script);
      } else {
        this.startRender(petPhoto);
      }
    },
    destroyPixi() {
      if (this.pixiApp) {
        this.pixiApp.destroy(true, true);
        this.pixiApp = null;
      }
    },
    startRender(imgUrl) {
      const canvasDom = document.getElementById('pixi-canvas');
      if (!canvasDom) return;
      canvasDom.innerHTML = '';

      const app = new PIXI.Application({
        width: window.innerWidth,
        height: Math.floor(window.innerHeight * 0.34),
        transparent: true,
        backgroundAlpha: 0,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1
      });
      this.pixiApp = app;
      canvasDom.appendChild(app.view);

      PIXI.Assets.load([imgUrl]).then((resources) => {
        const texture = resources[imgUrl];
        const petMesh = new PIXI.SimplePlane(texture, 22, 22);
        const maxWidth = app.screen.width * 0.78;
        const maxHeight = app.screen.height * 0.82;
        const scale = Math.min(maxWidth / texture.width, maxHeight / texture.height, 0.72);
        petMesh.scale.set(scale);
        petMesh.x = (app.screen.width - petMesh.width) / 2;
        petMesh.y = (app.screen.height - petMesh.height) / 2 + 8;
        app.stage.addChild(petMesh);

        const buffer = petMesh.geometry.getBuffer('aVertexPosition');
        const base = Array.from(buffer.data);
        let time = 0;

        app.ticker.add(() => {
          time += 0.018;
          const vertices = buffer.data;
          for (let i = 1; i < vertices.length; i += 2) {
            vertices[i] = base[i] + Math.sin(time + i * 0.12) * 1.8;
          }
          buffer.update();
        });
      }).catch(() => {});
    }
  }
}
</script>

<style scoped>
.home-page {
  width: 100vw;
  height: 100vh;
  position: relative;
  overflow: hidden;
  background: #F4F1EA;
  color: #302A23;
}

.home-hero {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 54vh;
  background: linear-gradient(180deg, #F7F3EA 0%, #E9E1D3 100%);
  overflow: hidden;
}

.brand-bar {
  position: relative;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 88rpx 36rpx 0;
}

.brand-copy {
  display: flex;
  flex-direction: column;
}

.brand-en {
  font-size: 20rpx;
  color: #8A7D6A;
  line-height: 1.3;
}

.brand-cn {
  margin-top: 6rpx;
  font-size: 42rpx;
  font-weight: 600;
  color: #302A23;
  line-height: 1.1;
}

.icon-button {
  width: 72rpx;
  height: 72rpx;
  padding: 0;
  margin: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.68);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 12rpx 32rpx rgba(58, 51, 43, 0.08);
}

.icon-button::after,
.text-button::after {
  border: none;
}

.icon-button-hover {
  opacity: 0.76;
}

.pet-stage {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 26rpx;
  height: 36vh;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stage-kicker {
  font-size: 24rpx;
  color: #6E7C67;
  line-height: 1.4;
}

.pet-name-title {
  margin-top: 8rpx;
  font-size: 56rpx;
  font-weight: 600;
  color: #2E2923;
  line-height: 1.15;
}

.photo-stage {
  margin-top: 22rpx;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.pet-main-img {
  width: 520rpx;
  height: 300rpx;
  object-fit: contain;
  animation: floatStage 4.8s ease-in-out infinite;
}

.stage-shadow {
  width: 260rpx;
  height: 18rpx;
  margin-top: 18rpx;
  border-radius: 50%;
  background: rgba(48, 42, 35, 0.12);
  filter: blur(5px);
  animation: shadowStage 4.8s ease-in-out infinite;
}

.pixi-box {
  width: 100%;
  height: 34vh;
}

.home-scroll {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 10;
  width: 100%;
  height: 100vh;
}

.hero-spacer {
  height: 50vh;
}

.home-content {
  min-height: 58vh;
  padding: 34rpx 32rpx 120rpx;
  background: #FBFAF6;
  border-radius: 18rpx 18rpx 0 0;
  box-shadow: 0 -18rpx 48rpx rgba(58, 51, 43, 0.08);
}

.today-row,
.card-head,
.archive-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-kicker,
.card-kicker {
  display: block;
  font-size: 20rpx;
  color: #8C7557;
  line-height: 1.3;
}

.section-title {
  display: block;
  margin-top: 6rpx;
  font-size: 36rpx;
  font-weight: 600;
  color: #302A23;
  line-height: 1.25;
}

.mode-chip {
  padding: 12rpx 18rpx;
  border: 1rpx solid #D9CBB8;
  border-radius: 999rpx;
  color: #6B5D4D;
  font-size: 22rpx;
  background: #FFFDF8;
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14rpx;
  margin-top: 30rpx;
}

.quick-item {
  min-height: 146rpx;
  padding: 20rpx 10rpx;
  border-radius: 16rpx;
  background: #FFFFFF;
  border: 1rpx solid #EEE6DA;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-sizing: border-box;
  box-shadow: 0 10rpx 28rpx rgba(58, 51, 43, 0.04);
}

.quick-item-hover {
  transform: translateY(2rpx);
  opacity: 0.82;
}

.quick-icon {
  width: 54rpx;
  height: 54rpx;
  border-radius: 50%;
  background: #F1ECE3;
  display: flex;
  align-items: center;
  justify-content: center;
}

.quick-title {
  margin-top: 12rpx;
  color: #302A23;
  font-size: 24rpx;
  font-weight: 600;
  line-height: 1.2;
}

.quick-desc {
  margin-top: 6rpx;
  color: #908778;
  font-size: 20rpx;
  line-height: 1.2;
}

.insight-card,
.archive-panel {
  margin-top: 22rpx;
  border-radius: 16rpx;
  background: #FFFFFF;
  border: 1rpx solid #EEE6DA;
  box-shadow: 0 14rpx 34rpx rgba(58, 51, 43, 0.05);
}

.insight-card {
  padding: 28rpx;
}

.card-title {
  display: block;
  margin-top: 6rpx;
  color: #302A23;
  font-size: 32rpx;
  font-weight: 600;
  line-height: 1.25;
}

.text-button {
  height: 52rpx;
  padding: 0 0 0 20rpx;
  margin: 0;
  background: transparent;
  color: #8C7557;
  font-size: 24rpx;
  display: flex;
  align-items: center;
  gap: 4rpx;
}

.text-button-hover {
  opacity: 0.72;
}

.metric-row {
  margin-top: 28rpx;
  display: flex;
  align-items: center;
}

.metric-item {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.metric-num {
  color: #5F735C;
  font-size: 42rpx;
  font-weight: 600;
  line-height: 1.1;
}

.metric-label {
  margin-top: 10rpx;
  color: #92887A;
  font-size: 22rpx;
  line-height: 1.2;
}

.metric-line {
  width: 1rpx;
  height: 48rpx;
  background: #EEE6DA;
  margin: 0 18rpx;
}

.archive-panel {
  display: flex;
  padding: 28rpx;
  gap: 24rpx;
}

.archive-panel-hover {
  opacity: 0.82;
}

.archive-main {
  flex: 1.05;
  min-width: 0;
}

.archive-title {
  display: block;
  margin-top: 6rpx;
  color: #302A23;
  font-size: 30rpx;
  font-weight: 600;
  line-height: 1.25;
}

.archive-desc {
  display: block;
  margin-top: 14rpx;
  color: #7C756B;
  font-size: 24rpx;
  line-height: 1.55;
}

.archive-list {
  flex: 0.95;
  border-left: 1rpx solid #EEE6DA;
  padding-left: 24rpx;
}

.archive-line {
  min-height: 48rpx;
}

.archive-label {
  color: #9A9082;
  font-size: 22rpx;
}

.archive-value {
  color: #3A332B;
  font-size: 23rpx;
  font-weight: 500;
  text-align: right;
}

@keyframes floatStage {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-14rpx);
  }
}

@keyframes shadowStage {
  0%, 100% {
    transform: scale(1);
    opacity: 0.75;
  }
  50% {
    transform: scale(0.86);
    opacity: 0.42;
  }
}
</style>
