<template>
  <view class="page-container">
    
    <view class="top-menu" @click="showMenu">
      <view class="dot"></view><view class="dot"></view><view class="dot"></view>
    </view>

    <view class="pet-hero">
      <text class="pet-name-title">{{petName}}</text>

      <view v-if="mode === 'simple'" class="photo-container">
        <image class="pet-main-img" :src="petPhoto" mode="aspectFill"></image>
        <view class="vignette-shadow"></view>
      </view>

      <view v-if="mode === '2.5d'" class="pixi-box" id="pixi-canvas"></view>
    </view>

    <scroll-view scroll-y class="ui-scroll">
      <view class="spacer"></view>
      
      <view class="health-base">
        
        <view class="grid-menu">
          <view class="menu-item">
            <view class="icon-box bg-orange">📄</view>
            <text class="menu-text">报告解读</text>
          </view>
          <view class="menu-item">
            <view class="icon-box bg-red">🏥</view>
            <text class="menu-text">附近急诊</text>
          </view>
          <view class="menu-item">
            <view class="icon-box bg-green">🎯</view>
            <text class="menu-text">小目标</text>
          </view>
          <view class="menu-item">
            <view class="icon-box bg-yellow">🍖</view>
            <text class="menu-text">营养配餐</text>
          </view>
        </view>

        <view class="card-glass">
          <view class="card-header">
            <text class="title">💊 药管家</text>
            <text class="more">查看日历 ></text>
          </view>
          <view class="todo-item">
            <view class="todo-info">
              <text class="todo-title">体内外同驱</text>
              <text class="todo-time">今日 20:00 - 给 {{petName}} 驱虫</text>
            </view>
            <button class="check-btn">打卡</button>
          </view>
        </view>

        <view class="card-glass">
          <view class="card-header">
            <text class="title">📂 宝贝健康档案</text>
            <text class="more">完整报告 ></text>
          </view>
          <view class="record-content">
            <view class="data-block"><text class="data-num">4.5<text class="unit">kg</text></text><text class="data-label">最新体重</text></view>
            <view class="data-block"><text class="data-num">已绝育</text><text class="data-label">生理状态</text></view>
            <view class="data-block"><text class="data-num">36天后</text><text class="data-label">下针疫苗</text></view>
          </view>
        </view>

      </view>
    </scroll-view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      petName: '毛孩子',
      petPhoto: '',
      mode: '2.5d'
    }
  },
  onShow() {
    // 每次进入主页，读取你在欢迎页存下的名字和照片
    this.petName = uni.getStorageSync('pet_name') || '毛孩子';
    this.petPhoto = uni.getStorageSync('pet_photo') || '/static/pet.png';
    this.mode = uni.getStorageSync('pet_mode') || '2.5d';
  },
  methods: {
    showMenu() {
      uni.showActionSheet({
        itemList: ['重新设置名字和照片', '切换模式 (照片/2.5D)'],
        success: (res) => {
          if(res.tapIndex === 0) {
            uni.reLaunch({ url: '/pages/welcome/welcome' });
          } else {
            this.mode = this.mode === 'simple' ? '2.5d' : 'simple';
            uni.setStorageSync('pet_mode', this.mode);
            uni.reLaunch({ url: '/pages/home/home' });
          }
        }
      });
    }
  }
}
</script>

<script module="pixi" lang="renderjs">
export default {
  mounted() {
    this.initPixi();
  },
  methods: {
    initPixi() {
      const petPhoto = uni.getStorageSync('pet_photo') || '/static/pet.png';
      if (typeof window.PIXI === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://pixijs.download/v7.3.2/pixi.min.js';
        script.onload = () => this.startRender(petPhoto);
        document.head.appendChild(script);
      } else {
        this.startRender(petPhoto);
      }
    },
    startRender(imgUrl) {
      const canvasDom = document.getElementById('pixi-canvas');
      if(!canvasDom) return;
      canvasDom.innerHTML = ''; // 清除旧的画布防止重叠

      const app = new PIXI.Application({
        width: window.innerWidth,
        height: window.innerHeight * 0.5,
        transparent: true,
        resolution: window.devicePixelRatio || 1,
      });
      canvasDom.appendChild(app.view);

      PIXI.Assets.load([imgUrl]).then((resources) => {
        const petMesh = new PIXI.SimplePlane(resources[imgUrl], 20, 20);
        // 这里控制 2.5D 模式下图片的大小，0.4 代表占据屏幕宽度的 40%
        petMesh.scale.set(0.4); 
        petMesh.x = (app.screen.width - petMesh.width) / 2;
        petMesh.y = (app.screen.height - petMesh.height) / 2 + 20;
        app.stage.addChild(petMesh);

        let time = 0;
        app.ticker.add(() => {
          time += 0.02;
          const vertices = petMesh.geometry.getBuffer('aVertexPosition').data;
          for (let i = 1; i < vertices.length; i += 2) {
             vertices[i] += Math.sin(time) * 0.2; // 微弱的呼吸感
          }
          petMesh.geometry.getBuffer('aVertexPosition').update();
        });
      });
    }
  }
}
</script>

<style scoped>
/* 1. 基础容器与重置 */
.page-container {
  width: 100vw;
  height: 100vh;
  background-color: #F7F6F2;
  position: relative;
  overflow: hidden;
}

/* 2. 右上角精致菜单 */
.top-menu {
  position: absolute;
  top: 100rpx;
  right: 40rpx;
  z-index: 999;
  width: 70rpx;
  height: 70rpx;
  background: rgba(255,255,255,0.6);
  backdrop-filter: blur(10px);
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8rpx;
  box-shadow: 0 4rpx 10rpx rgba(0,0,0,0.05);
}
.dot { width: 8rpx; height: 8rpx; background: #5C544D; border-radius: 50%; }

/* 3. 顶部宠物区 */
.pet-hero {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 50vh;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 0;
}
.pet-name-title {
  position: absolute;
  top: 110rpx;
  width: 100%;
  text-align: center;
  font-size: 40rpx;
  font-weight: bold;
  color: #3E362E;
  letter-spacing: 8rpx;
  z-index: 2;
}

/* 4. 经典照片模式专属样式与呼吸悬浮动画 */
.photo-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 60rpx;
}
.pet-main-img {
  width: 360rpx;
  height: 360rpx;
  border-radius: 50rpx;
  box-shadow: 0 20rpx 50rpx rgba(0,0,0,0.15);
  border: 8rpx solid #FFF;
  animation: floatAnim 3s ease-in-out infinite;
  object-fit: cover;
}
.vignette-shadow {
  width: 200rpx;
  height: 16rpx;
  background: rgba(0,0,0,0.08);
  border-radius: 50%;
  margin-top: 40rpx;
  filter: blur(6px);
  animation: shadowAnim 3s ease-in-out infinite;
}
@keyframes floatAnim {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-20rpx); }
}
@keyframes shadowAnim {
  0%, 100% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.2); opacity: 0.3; }
}

/* 2.5D 画布 */
.pixi-box { width: 100%; height: 100%; }

/* 5. 底部滚动交互层 */
.ui-scroll {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100vh;
  z-index: 10;
}
.spacer { height: 45vh; width: 100%; }

/* 6. 高奢毛玻璃底座 (修复你截图里变成白板的问题) */
.health-base {
  padding: 50rpx 40rpx 100rpx 40rpx;
  background: linear-gradient(180deg, rgba(255,251,245,0.85) 0%, rgba(255,248,238,1) 100%);
  backdrop-filter: blur(20px);
  border-radius: 60rpx 60rpx 0 0;
  min-height: 60vh;
  box-shadow: 0 -10rpx 40rpx rgba(0,0,0,0.05);
  border-top: 1px solid rgba(255,255,255,0.8);
}

/* 7. 金刚区排版 */
.grid-menu {
  display: flex;
  justify-content: space-between;
  margin-bottom: 40rpx;
}
.menu-item { display: flex; flex-direction: column; align-items: center; }
.icon-box {
  width: 110rpx;
  height: 110rpx;
  border-radius: 36rpx;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 48rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 8rpx 20rpx rgba(0,0,0,0.04);
}
.bg-orange { background: #FFF0E5; color: #FF8A00; }
.bg-red { background: #FFEBEB; color: #FF4D4F; }
.bg-green { background: #E8F5E9; color: #4CAF50; }
.bg-yellow { background: #FFF8E1; color: #FFC107; }
.menu-text { font-size: 24rpx; color: #5C544D; font-weight: 500; }

/* 8. 卡片内部极其精细的样式 (上次遗漏导致排版崩溃的元凶) */
.card-glass {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(16px);
  border-radius: 40rpx;
  padding: 40rpx;
  margin-bottom: 30rpx;
  border: 1px solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 10rpx 30rpx rgba(180, 160, 140, 0.08);
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30rpx;
}
.title { font-size: 32rpx; font-weight: bold; color: #3E362E; }
.more { font-size: 24rpx; color: #A69D95; }

.todo-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255,255,255,0.9);
  border-radius: 24rpx;
  padding: 24rpx 30rpx;
}
.todo-info { display: flex; flex-direction: column; }
.todo-title { font-size: 28rpx; color: #3E362E; font-weight: bold; }
.todo-time { font-size: 22rpx; color: #C07954; margin-top: 8rpx; }
.check-btn {
  background: #E8D5C4;
  color: #5C544D;
  font-size: 26rpx;
  font-weight: bold;
  border-radius: 40rpx;
  padding: 0 40rpx;
  line-height: 64rpx;
  margin: 0;
}
.check-btn::after { border: none; }

.record-content { display: flex; justify-content: space-around; text-align: center; }
.data-num { font-size: 36rpx; font-weight: bold; color: #5B8B7A; display: block; }
.unit { font-size: 22rpx; margin-left: 4rpx; }
.data-label { font-size: 22rpx; color: #A69D95; margin-top: 10rpx; }
</style>