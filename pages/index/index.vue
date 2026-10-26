<template>
  <view class="page-container" :class="petThemeClass" :style="appThemeStyle">
    <view class="canvas-container" id="pixi-canvas"></view>

    <scroll-view scroll-y class="content-scroll">
      <view class="spacer"></view>
      <view class="health-dashboard-container">
        
        <view class="grid-menu">
          <view class="menu-item" @click="handleMenuClick('report')">
            <view class="icon-box bg-orange">📄</view>
            <text class="menu-text">报告解读</text>
          </view>
          <view class="menu-item" @click="handleMenuClick('hospital')">
            <view class="icon-box bg-red">🏥</view>
            <text class="menu-text">附近急诊</text>
          </view>
          <view class="menu-item" @click="handleMenuClick('goal')">
            <view class="icon-box bg-green">🎯</view>
            <text class="menu-text">小目标</text>
          </view>
          <view class="menu-item" @click="handleMenuClick('diet')">
            <view class="icon-box bg-yellow">🍖</view>
            <text class="menu-text">营养配餐</text>
          </view>
        </view>

        <view class="dashboard-card glass-effect">
          <view class="card-header">
            <text class="title">💊 待办与用药</text>
            <text class="more">查看日历 ></text>
          </view>
          <view class="todo-list">
            <view class="todo-item">
              <view class="todo-info">
                <text class="todo-title">体内外同驱 (海乐妙)</text>
                <text class="todo-time">今天 20:00</text>
              </view>
              <button class="check-btn" @click="handleCheckIn">打卡</button>
            </view>
          </view>
        </view>

        <view class="dashboard-card glass-effect">
          <view class="card-header">
            <text class="title">📂 宝贝健康档案</text>
            <text class="more">完整报告 ></text>
          </view>
          <view class="record-content">
            <view class="data-block">
              <text class="data-num">4.5<text class="unit">kg</text></text>
              <text class="data-label">最新体重</text>
            </view>
            <view class="data-block">
              <text class="data-num">已绝育</text>
              <text class="data-label">生理状态</text>
            </view>
            <view class="data-block">
              <text class="data-num">36天后</text>
              <text class="data-label">下针疫苗</text>
            </view>
          </view>
        </view>

        <view class="agent-section">
          <text class="section-title">🤖 专属专家天团</text>
          <scroll-view scroll-x="true" class="agent-scroll">
            <view class="agent-card">
              <view class="agent-avatar">👨‍⚕️</view>
              <text class="agent-name">行为纠正师</text>
              <text class="agent-desc">解决拆家/乱尿</text>
            </view>
            <view class="agent-card">
              <view class="agent-avatar">🥗</view>
              <text class="agent-name">宠物营养师</text>
              <text class="agent-desc">自制猫饭狗饭</text>
            </view>
            <view class="agent-card">
              <view class="agent-avatar">🕊️</view>
              <text class="agent-name">心理疗愈师</text>
              <text class="agent-desc">缓解丧宠之痛</text>
            </view>
          </scroll-view>
        </view>

      </view>
    </scroll-view>
  </view>
</template>

<script>
export default {
  methods: {
    handleMenuClick(type) {
      uni.showToast({ title: '功能开发中', icon: 'none' });
    },
    handleCheckIn() {
      uni.showToast({ title: '打卡成功！', icon: 'success' });
    }
  }
}
</script>

<script module="pixi" lang="renderjs">
export default {
  data() {
    return {
      pixiApp: null // 🌟 存储实例以便销毁
    }
  },
  mounted() {
    if (typeof window.PIXI === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://pixijs.download/v7.3.2/pixi.min.js';
      script.onload = this.initPixi;
      document.head.appendChild(script);
    } else {
      this.initPixi();
    }
  },
  // 🌟 核心修复：离开页面时销毁 PIXI
  beforeDestroy() {
    if (this.pixiApp) {
      this.pixiApp.destroy(true, true);
      this.pixiApp = null;
    }
  },
  methods: {
    initPixi() {
      const app = new PIXI.Application({
        width: window.innerWidth,
        height: window.innerHeight,
        transparent: true,
        resolution: window.devicePixelRatio || 1,
      });
      this.pixiApp = app; // 存入实例
      document.getElementById('pixi-canvas').appendChild(app.view);

      PIXI.Assets.load(['/static/pet.png', '/static/depth.png']).then((resources) => {
        const petContainer = new PIXI.Container();
        app.stage.addChild(petContainer);

        const petMesh = new PIXI.SimplePlane(resources['/static/pet.png'], 20, 20);
        const depthSprite = new PIXI.Sprite(resources['/static/depth.png']);

        petMesh.x = app.screen.width / 2 - petMesh.width / 2;
        petMesh.y = app.screen.height * 0.4 - petMesh.height / 2;
        petContainer.addChild(petMesh);

        depthSprite.anchor.set(0.5);
        depthSprite.x = app.screen.width / 2;
        depthSprite.y = app.screen.height * 0.4;
        app.stage.addChild(depthSprite);
        depthSprite.renderable = false;

        const displacementFilter = new PIXI.DisplacementFilter(depthSprite);
        petContainer.filters = [displacementFilter];

        const vertices = petMesh.geometry.getBuffer('aVertexPosition').data;
        const originalVertices = new Float32Array(vertices);
        let time = 0;
        app.ticker.add(() => {
          time += 0.02; 
          for (let i = 0; i < vertices.length; i += 2) {
            const originalY = originalVertices[i + 1];
            const normalizedY = originalY / petMesh.height;
            if (normalizedY > 0.30 && normalizedY < 0.85) {
               vertices[i + 1] = originalY + Math.sin(time) * 2.0; 
            } else {
               vertices[i + 1] = originalY;
            }
          }
          petMesh.geometry.getBuffer('aVertexPosition').update();
        });

        const leftEyeOffsetX = 953;
        const leftEyeOffsetY = 489;
        const rightEyeOffsetX = 1135;
        const rightEyeOffsetY = 525;
        
        const leftEye = new PIXI.Graphics();
        leftEye.lineStyle(4, 0x1a1a1a, 1);
        leftEye.moveTo(-12, 0);
        leftEye.quadraticCurveTo(0, 6, 12, 0); 
        leftEye.x = petMesh.x + leftEyeOffsetX;
        leftEye.y = petMesh.y + leftEyeOffsetY;
        leftEye.alpha = 0; 
        petContainer.addChild(leftEye);
        
        const rightEye = new PIXI.Graphics();
        rightEye.lineStyle(4, 0x1a1a1a, 1);
        rightEye.moveTo(-12, 0);
        rightEye.quadraticCurveTo(0, 6, 12, 0);
        rightEye.x = petMesh.x + rightEyeOffsetX;
        rightEye.y = petMesh.y + rightEyeOffsetY;
        rightEye.alpha = 0; 
        petContainer.addChild(rightEye);
        
        let blinkTimer = 0;
        app.ticker.add(() => {
           blinkTimer++;
           if (blinkTimer > 180 && Math.random() < 0.02) {
               leftEye.alpha = 1;
               rightEye.alpha = 1;
               blinkTimer = 0;
               setTimeout(() => {
                   leftEye.alpha = 0;
                   rightEye.alpha = 0;
               }, 150); 
           }
        });
        
        app.stage.interactive = true;
        app.stage.hitArea = new PIXI.Rectangle(0, 0, app.screen.width, app.screen.height);
        
        app.stage.on('pointermove', (event) => {
          const mouseX = event.global.x - app.screen.width / 2;
          const mouseY = event.global.y - app.screen.height / 2;
          let targetX = mouseX * 0.03;
          let targetY = mouseY * 0.03;
          targetX = Math.max(-10, Math.min(10, targetX));
          targetY = Math.max(-10, Math.min(10, targetY));
          displacementFilter.scale.x = targetX;
          displacementFilter.scale.y = targetY;
        });
        app.stage.on('pointerout', () => {
           displacementFilter.scale.x = 0;
           displacementFilter.scale.y = 0;
        });
      });
    }
  }
}
</script>

<style scoped>
.page-container { width: 100vw; height: 100vh; position: relative; background-color: #000000; }
.canvas-container { position: absolute; top: 0; left: 0; width: 100vw; height: 100vh; overflow: hidden; z-index: 0; }
.content-scroll { position: absolute; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 1; }
.spacer { height: 48vh; width: 100%; }
.health-dashboard-container { padding: 40rpx 30rpx 80rpx 30rpx; background: linear-gradient(180deg, rgba(255,251,245,0.92) 0%, rgba(255,248,238,1) 100%); border-radius: 40rpx 40rpx 0 0; min-height: 52vh; backdrop-filter: blur(8px); }
.glass-effect { background: rgba(255, 255, 255, 0.65); backdrop-filter: blur(16px); box-shadow: 0 8rpx 32rpx rgba(180, 160, 140, 0.08); border: 1px solid rgba(255, 255, 255, 0.8); }
.grid-menu { display: flex; justify-content: space-between; margin-bottom: 40rpx; }
.menu-item { display: flex; flex-direction: column; align-items: center; }
.icon-box { width: 96rpx; height: 96rpx; border-radius: 32rpx; display: flex; justify-content: center; align-items: center; font-size: 40rpx; margin-bottom: 12rpx; box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.05); }
.bg-orange { background-color: #FFF0E5; }
.bg-red { background-color: #FFEBEB; }
.bg-green { background-color: #E8F5E9; }
.bg-yellow { background-color: #FFF8E1; }
.menu-text { font-size: 24rpx; color: #5C544D; font-weight: 500; }
.dashboard-card { border-radius: 32rpx; padding: 30rpx; margin-bottom: 30rpx; }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24rpx; }
.title { font-size: 30rpx; font-weight: bold; color: #3E362E; }
.more { font-size: 24rpx; color: #A69D95; }
.todo-item { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.8); border-radius: 20rpx; padding: 20rpx; }
.todo-title { font-size: 28rpx; color: #3E362E; display: block; }
.todo-time { font-size: 22rpx; color: #C07954; margin-top: 6rpx; }
.check-btn { background: #E8D5C4; color: #5C544D; font-size: 24rpx; border-radius: 30rpx; padding: 0 30rpx; line-height: 56rpx; margin: 0; }
.check-btn::after { border: none; }
.record-content { display: flex; justify-content: space-around; text-align: center; }
.data-num { font-size: 36rpx; font-weight: bold; color: #5B8B7A; display: block; }
.unit { font-size: 22rpx; margin-left: 4rpx; }
.data-label { font-size: 22rpx; color: #A69D95; margin-top: 10rpx; }
.agent-section { margin-top: 10rpx; }
.section-title { font-size: 30rpx; font-weight: bold; color: #3E362E; margin-bottom: 20rpx; display: block; }
.agent-scroll { white-space: nowrap; }
.agent-card { display: inline-block; width: 220rpx; background: rgba(255, 255, 255, 0.7); border-radius: 24rpx; padding: 24rpx; margin-right: 20rpx; text-align: center; box-shadow: 0 4rpx 16rpx rgba(180, 160, 140, 0.05); }
.agent-avatar { font-size: 50rpx; margin-bottom: 16rpx; }
.agent-name { font-size: 26rpx; font-weight: bold; color: #3E362E; display: block; }
.agent-desc { font-size: 20rpx; color: #A69D95; margin-top: 8rpx; display: block; }
</style>