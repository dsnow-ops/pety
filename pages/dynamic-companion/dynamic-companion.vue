<template>
  <view class="dynamic-companion-page ui-v2" :class="[{ memorial, 'motion-paused': motionPaused || !visible }, 'doing-' + action]" :style="{ '--ui-font-scale': String(uiFontScale) }">
    <scroll-view scroll-y class="companion-scroll" @scroll="refreshPlayBounds">
      <view class="companion-room">
        <view class="preview-navigation">
          <button class="back icon-button" aria-label="返回设置" @click="goBack"><uni-icons type="left" size="20" color="currentColor"/></button>
          <text class="space-title">{{ memorial ? '安放心念' : '陪伴空间' }}</text>
          <button class="motion-toggle icon-button" :aria-label="motionPaused ? '开启动效' : '暂停动效'" :aria-pressed="String(motionPaused)" @click="motionPaused = !motionPaused"><view class="motion-glyph" :class="{ 'is-paused': motionPaused }" aria-hidden="true"/></button>
        </view>
        <view class="room-intro">
          <view class="name-row"><text class="room-name">{{ petName }}</text><view class="presence-chip"><view class="presence-dot"/><text>{{ memorial ? '留在心里' : '此刻 · 在一起' }}</text></view></view>
          <text class="room-invitation">{{ memorial ? '想起你的时候，就来这里坐坐。' : '把手边的事放一放，来陪它玩一会。' }}</text>
        </view>
        <view class="pet-presence-space" :class="{ 'has-character': previewCharacter }">
          <view class="ambient-light" aria-hidden="true"/><view class="room-orbit orbit-one" aria-hidden="true"/><view class="room-orbit orbit-two" aria-hidden="true"/>
          <view v-if="characterReady" class="floor-light" aria-hidden="true"/>
          <view class="response-bubble" role="status" aria-live="polite"><text>{{ responseText }}</text><view class="bubble-tip"/></view>
          <view v-if="previewCharacter && !characterFailed" class="character-position" :style="characterStyle"><image class="preview-character" :class="{ loaded: characterLoaded }" :src="characterSource" mode="aspectFit" :draggable="false" aria-label="浅金长毛猫互动预览素材" @load="characterLoaded = true" @error="onCharacterError"/></view>
          <button v-if="characterReady && action !== 'play'" class="pet-touch-target" :aria-label="memorial ? '留一束光' : '摸摸头'" @click="interact(memorial ? 'light' : 'stroke')"/>
          <view v-if="characterReady && action === 'play'" class="play-surface" aria-label="在宠物身边划动逗猫光点" @mousemove="moveToy" @touchstart.stop.prevent="moveToy" @touchmove.stop.prevent="moveToy"><view class="toy-light" :style="toyStyle" aria-hidden="true"><view class="toy-core"/><view class="toy-ring"/></view></view>
          <view v-if="action === 'stroke'" :key="reactionSerial" class="affection" aria-hidden="true"><text>♡</text><text>♡</text><text>·</text></view>
          <view v-if="action === 'light'" class="memory-light" aria-hidden="true"><view/><view/><view/></view>
          <view v-if="previewCharacter && !characterLoaded" class="character-status"><text>{{ characterFailed ? '形象暂时没能显示' : '正在载入形象…' }}</text><button v-if="characterFailed" @click="retryCharacter">重新载入</button></view>
          <button v-if="!previewCharacter" class="empty-stage-action" @click="toggleCharacter">让试放形象回来 <uni-icons type="right" size="14" color="currentColor"/></button>
          <text class="stage-hint">{{ stageHint }}</text>
        </view>
        <view class="interaction-panel">
          <view class="interaction-heading"><text>{{ memorial ? '用你喜欢的方式想念' : '这一刻，想做什么？' }}</text><text class="small-star">✦</text></view>
          <view class="interaction-actions">
            <button class="interaction-action stroke-action" :class="{ selected: action === 'stroke' || action === 'light' }" :disabled="!characterReady" :aria-pressed="String(action === 'stroke' || action === 'light')" @click="interact(memorial ? 'light' : 'stroke')"><view class="action-symbol"><uni-icons :type="memorial ? 'star' : 'heart'" size="24" color="currentColor"/></view><text>{{ memorial ? '留一束光' : '摸摸它' }}</text><text class="action-note">{{ memorial ? '让想念有个落点' : '轻轻靠近一点' }}</text></button>
            <button class="interaction-action play-action" :class="{ selected: action === 'play' || (memorial && action === 'quiet') }" :disabled="!characterReady" :aria-pressed="String(action === 'play' || (memorial && action === 'quiet'))" @click="interact(memorial ? 'quiet' : 'play')"><view class="action-symbol"><view v-if="memorial" class="crescent-symbol" aria-hidden="true"/><uni-icons v-else type="paperplane" size="23" color="currentColor"/></view><text>{{ memorial ? '静静陪伴' : '逗一逗' }}</text><text class="action-note">{{ memorial ? '不用急着说话' : '划动光点试试看' }}</text></button>
            <button class="interaction-action quiet-action" :class="{ selected: !memorial && action === 'quiet' }" :disabled="!characterReady" :aria-pressed="String(!memorial && action === 'quiet')" @click="memorial ? secondaryAction() : interact('quiet')"><view class="action-symbol"><uni-icons v-if="memorial" type="compose" size="23" color="currentColor"/><view v-else class="crescent-symbol" aria-hidden="true"/></view><text>{{ memorial ? '写封信' : '陪一会' }}</text><text class="action-note">{{ memorial ? '留下想说的话' : '把节奏慢下来' }}</text></button>
          </view>
          <view class="interaction-feedback" role="status" aria-live="polite">
            <view v-if="action === 'quiet'" class="quiet-status"><view class="quiet-orb"/><view><text class="quiet-title">{{ memorial ? '静静地，陪这份想念待一会' : '不用做什么，在一起就好' }}</text><text class="quiet-time">这一刻 · {{ quietTime }}</text></view></view>
            <text v-else class="feedback-copy">{{ feedbackText }}</text>
            <button v-if="action === 'play' || action === 'quiet'" class="end-interaction" @click="finishInteraction">结束 <uni-icons type="closeempty" size="12" color="currentColor"/></button>
          </view>
        </view>
        <view class="preview-controls"><text>交互预览 · 不改变宠物资料</text><button :aria-pressed="String(previewCharacter)" @click="toggleCharacter">{{ previewCharacter ? '隐藏形象' : '显示形象' }}</button></view>
      </view>
      <view class="companion-content">
        <view class="collection-heading"><view><text class="collection-overline">{{ memorial ? 'THOSE DAYS WITH YOU' : 'KEEP THIS LITTLE MOMENT' }}</text><text class="collection-title">{{ memorial ? '把你放在心上' : '把今天，也留住' }}</text><text v-if="previewCharacter && activePet" class="records-owner">{{ activePet.name }}的真实记录</text></view><button class="primary-action record-action" @click="primaryAction"><uni-icons :type="memorial ? 'heart' : 'compose'" size="17" color="currentColor"/><text>{{ !activePet ? '认识宠物' : memorial ? '回忆册' : '记一笔' }}</text></button></view>
        <HomeLifePreview v-if="visible" :key="contentKey" :pet="activePet" :refresh="revision" @album="openAlbum"/>
        <button class="album-link" @click="openAlbum">{{ memorial ? '翻开全部回忆' : '看看我们的小日子' }} <uni-icons type="right" size="13" color="currentColor"/></button>
        <view class="preview-footnote"><text>当前为透明静态形象的交互模拟，非角色骨骼动画。</text><button @click="goBack">返回显示设置 <uni-icons type="right" size="12" color="currentColor"/></button></view>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import HomeLifePreview from '../../components/HomeLifePreview.vue';
import { getActivePet, subscribePetSelection } from '../../common/pet-store.js';
import { getPetRelationshipStage } from '../../common/relationship-config.js';
import { captureDataScope } from '../../common/scoped-storage.js';
import { formatDateKey } from '../../common/diary-store.js';
import { isReduceMotionEnabled, lightHaptic } from '../../common/haptics.js';
export default {
  components: { HomeLifePreview },
  data() { return { activePet: null, visible: false, revision: 0, contentKey: '', unsubscribeSelection: null, previewCharacter: false, characterLoaded: false, characterFailed: false, characterSource: '/static/preview/transparent-cat-20261024.png', action: 'idle', reactionSerial: 0, strokeCount: 0, quietSeconds: 0, lastFeedback: '', motionPaused: false, toyX: 74, toyY: 60, toyMoved: false }; },
  computed: {
    memorial() { return getPetRelationshipStage(this.activePet) === 'deceased'; },
    petName() { return this.previewCharacter ? '浅金长毛猫' : this.activePet?.name || '给陪伴，留一个位置'; },
    characterReady() { return this.previewCharacter && this.characterLoaded && !this.characterFailed; },
    quietTime() { return String(Math.floor(this.quietSeconds / 60)).padStart(2, '0') + ':' + String(this.quietSeconds % 60).padStart(2, '0'); },
    responseText() {
      if (!this.previewCharacter) return '这里，一直留着一个位置';
      if (this.action === 'light') return '把这一束温柔，留给想念';
      if (this.action === 'quiet') return this.memorial ? '慢慢来，想念不必有答案' : '就这样，安静地待一会儿';
      if (this.action === 'play') return this.toyMoved ? '咦，光点跑到那边去了' : '把光点轻轻移到另一边';
      if (this.action === 'stroke') return ['收到一个温柔的摸摸', '再靠近一点点', '把这一刻的温柔收下'][Math.max(0, this.strokeCount - 1) % 3];
      return this.memorial ? '轻触形象，为想念留一束光' : '轻轻点我，打个招呼吧';
    },
    stageHint() { return !this.characterReady ? '' : this.action === 'play' ? '在这里划动 · 光点会跟着你的手' : this.action === 'quiet' ? '让这一刻慢下来' : this.memorial ? '轻触形象 · 留一束光' : '轻触猫咪 · 它会靠近一点'; },
    feedbackText() { return this.lastFeedback || (this.action === 'play' ? '划动宠物身边的光点，换个方向逗它。' : this.memorial ? '想念可以很轻，不需要完成任何任务。' : '没有任务，也不用打卡。想来就来。'); },
    characterStyle() { const lean = this.action === 'play' && !this.motionPaused ? (this.toyX - 50) / 30 : 0; return { '--pet-lean': lean + 'deg', '--pet-shift': lean * 3 + 'px' }; },
    toyStyle() { return { left: this.toyX + '%', top: this.toyY + '%' }; }
  },
  onLoad(options) {
    this.previewCharacter = options?.preview === 'native-alpha'; this.motionPaused = isReduceMotionEnabled();
    // #ifdef H5
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) this.motionPaused = true;
    this._visibilityHandler = () => { if (document.hidden) this.resetInteraction(); };
    document.addEventListener('visibilitychange', this._visibilityHandler);
    // #endif
    this.unsubscribeSelection = subscribePetSelection(() => { if (this.visible) this.refreshContent(); });
  },
  onShow() { this.refreshContent(); this.visible = true; },
  onHide() { this.visible = false; this.resetInteraction(); },
  onUnload() {
    this.visible = false; this.resetInteraction(); this.unsubscribeSelection?.();
    // #ifdef H5
    document.removeEventListener('visibilitychange', this._visibilityHandler);
    // #endif
  },
  methods: {
    clearTimers() { clearTimeout(this._reactionTimer); clearInterval(this._quietTimer); this._reactionTimer = null; this._quietTimer = null; this._stageRect = null; },
    resetInteraction() { this.clearTimers(); this.action = 'idle'; this.lastFeedback = ''; this.toyMoved = false; this.reactionSerial++; },
    toggleCharacter() { this.resetInteraction(); this.characterLoaded = false; this.characterFailed = false; this.previewCharacter = !this.previewCharacter; },
    retryCharacter() { this.characterLoaded = false; this.characterFailed = false; },
    refreshPlayBounds() {
      if (this.action !== 'play' || !this.visible) return;
      const serial = this.reactionSerial;
      uni.createSelectorQuery().in(this).select('.pet-presence-space').boundingClientRect(rect => { if (serial === this.reactionSerial && this.action === 'play' && this.visible) this._stageRect = rect; }).exec();
    },
    onCharacterError() { this.characterFailed = true; this.characterLoaded = false; this.resetInteraction(); },
    interact(action) {
      if (!this.characterReady || !this.visible) return;
      if (this.memorial && !['light', 'quiet'].includes(action)) return;
      this.clearTimers(); this.action = action; this.lastFeedback = ''; this.reactionSerial++; lightHaptic();
      if (action === 'stroke') this.strokeCount++;
      if (action === 'stroke' || action === 'light') {
        const serial = this.reactionSerial;
        this._reactionTimer = setTimeout(() => { if (this.visible && serial === this.reactionSerial) { this.action = 'idle'; this.lastFeedback = this.memorial ? '这一束光，为你多留了一会。' : '又多了一次轻轻的靠近。'; } }, 2400);
      }
      if (action === 'play') {
        this.toyX = 74; this.toyY = 60; this.toyMoved = false; const serial = this.reactionSerial;
        this.$nextTick(() => uni.createSelectorQuery().in(this).select('.pet-presence-space').boundingClientRect(rect => { if (serial === this.reactionSerial && this.action === 'play' && this.visible) this._stageRect = rect; }).exec());
      }
      if (action === 'quiet') { this.quietSeconds = 0; const started = Date.now(); this._quietTimer = setInterval(() => { this.quietSeconds = Math.floor((Date.now() - started) / 1000); }, 1000); }
    },
    moveToy(event) {
      if (this.action !== 'play' || !this._stageRect || !this.visible) return;
      const point = event.touches?.[0] || event.changedTouches?.[0] || event;
      const x = Number(point.clientX), y = Number(point.clientY), rect = this._stageRect;
      if (!Number.isFinite(x) || !Number.isFinite(y) || !rect.width || !rect.height) return;
      this.toyX = Math.max(10, Math.min(90, (x - rect.left) / rect.width * 100)); this.toyY = Math.max(22, Math.min(86, (y - rect.top) / rect.height * 100)); this.toyMoved = true;
    },
    finishInteraction() { const seconds = this.quietSeconds, quiet = this.action === 'quiet'; this.resetInteraction(); this.lastFeedback = quiet ? `刚刚一起待了${seconds < 60 ? seconds + '秒' : Math.floor(seconds / 60) + '分' + seconds % 60 + '秒'}，按自己的节奏就好。` : '光点收起来了，歇一会儿吧。'; },
    refreshContent() {
      const scope = captureDataScope(); this.activePet = getActivePet(); const key = `${scope.namespace}:${scope.version}:${this.activePet?.id || ''}:${getPetRelationshipStage(this.activePet)}`;
      if (this.contentKey !== key) { this.resetInteraction(); this.strokeCount = 0; } this.contentKey = key; this.revision++;
    },
    goBack() {
      this.resetInteraction();
      if (getCurrentPages().length > 1) uni.navigateBack({ fail: () => uni.redirectTo({ url: '/pages/settings/settings' }) });
      else uni.redirectTo({ url: '/pages/settings/settings' });
    },
    requirePet() { this.refreshContent(); if (this.activePet?.id) return true; uni.navigateTo({ url: '/pages/welcome/welcome' }); return false; },
    openAlbum() { if (this.requirePet()) uni.navigateTo({ url: '/pages/album/album' }); },
    primaryAction() { if (!this.requirePet()) return; if (this.memorial) this.openAlbum(); else uni.navigateTo({ url: '/pages/calendar/calendar?date=' + formatDateKey() + '&petId=' + encodeURIComponent(this.activePet.id) }); },
    secondaryAction() { if (!this.requirePet()) return; if (this.memorial) uni.navigateTo({ url: '/pages/narrative/narrative?petId=' + encodeURIComponent(this.activePet.id) }); else this.openAlbum(); }
  }
};
</script>

<style scoped>
.dynamic-companion-page{height:100vh;background:#24251f;color:#eee9dc;--ui-ink:#eee9dc;--ui-muted:#bcb7a7;--ui-line:rgba(225,222,198,.13);--ui-group:#303128}
.companion-scroll{height:100%}button{margin:0;padding:0;background:transparent;color:inherit;font:inherit;line-height:1.5}button::after{border:none}button[disabled]{opacity:.4;color:inherit;background:transparent}
.companion-room{position:relative;padding:calc(10px + env(safe-area-inset-top)) 22px 0;max-width:600px;margin:auto;background:radial-gradient(ellipse at 50% 43%,rgba(171,137,87,.14),transparent 62%)}
.preview-navigation{display:flex;align-items:center;justify-content:space-between;gap:12px}.icon-button{display:flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:50%;flex-shrink:0;color:#d0ccba}.back{margin-left:-10px}.motion-toggle{border:1px solid rgba(216,211,187,.16)}.space-title{font-size:13px;letter-spacing:3px;color:#c6c3af}
.room-intro{padding-top:22px}.name-row{display:flex;align-items:center;justify-content:space-between;gap:12px}.room-name{min-width:0;overflow-wrap:anywhere;font-family:'Noto Serif SC','Songti SC',serif;font-size:calc(29px * var(--ui-font-scale,1));line-height:1.4;font-weight:500;letter-spacing:1px}.presence-chip{display:flex;align-items:center;gap:6px;flex-shrink:0;color:#c9cbb1;font-size:10px}.presence-dot{width:5px;height:5px;background:#b1be91;border-radius:50%;box-shadow:0 0 9px rgba(177,190,145,.28)}.room-invitation{display:block;margin-top:9px;color:#aaa995;font-size:calc(12px * var(--ui-font-scale,1));line-height:1.7}
.pet-presence-space{position:relative;height:min(calc(97vw + 16px),416px);margin:17px -22px 0;overflow:hidden;isolation:isolate}
.ambient-light{position:absolute;width:88%;height:80%;left:6%;top:8%;background:radial-gradient(ellipse,rgba(173,142,93,.1),transparent 68%)}.room-orbit{position:absolute;border:1px solid rgba(207,192,153,.05);border-radius:50%;pointer-events:none;z-index:-1}.orbit-one{width:87%;height:66%;left:6.5%;top:16%;transform:rotate(-25deg)}.orbit-two{width:72%;height:80%;left:14%;top:9%;transform:rotate(25deg)}
.floor-light{position:absolute;left:50%;bottom:29px;transform:translateX(-50%);width:160px;height:20px;background:radial-gradient(ellipse,rgba(10,11,8,.35),transparent 70%)}
.character-position{position:absolute;width:min(96vw,400px);height:min(96vw,400px);left:50%;bottom:0;transform:translateX(-55.6%);pointer-events:none}.preview-character{width:100%;height:100%;opacity:0;transform-origin:55.6% 88%;transition:transform .22s ease-out}.preview-character.loaded{opacity:1;animation:companion-breathe 5s ease-in-out infinite}.doing-stroke .preview-character{animation:companion-nuzzle 2.4s ease-in-out}.doing-play .preview-character{animation:none;transform:translateX(var(--pet-shift,0px)) rotate(var(--pet-lean,0deg))}.memorial .preview-character{animation:none}.doing-quiet .preview-character{animation:companion-breathe 7s ease-in-out infinite}
.pet-touch-target{position:absolute;left:17%;top:10%;width:67%;height:79%;border:0;border-radius:48% 48% 26% 26%;z-index:2;cursor:pointer}.pet-touch-target:focus-visible{outline:1px dashed #c7bc92;outline-offset:-8px}.pet-touch-target:active{background:rgba(234,216,180,.02)}
.response-bubble{position:absolute;top:0;left:50%;transform:translateX(-50%);z-index:4;max-width:88%;white-space:nowrap;padding:8px 14px;border:1px solid rgba(207,202,171,.18);background:#35382d;border-radius:15px;color:#dddcc8;font-size:11px;line-height:1.6;pointer-events:none}.bubble-tip{position:absolute;bottom:-4px;left:50%;width:6px;height:6px;transform:rotate(45deg);background:#35382d;border-right:1px solid rgba(207,202,171,.18);border-bottom:1px solid rgba(207,202,171,.18)}
.stage-hint{position:absolute;bottom:1px;left:0;width:100%;text-align:center;color:#aaa68d;font-size:10px;letter-spacing:1px;pointer-events:none}.character-status{position:absolute;inset:60px 0 25px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;color:#c5beab;font-size:13px;z-index:5}.character-status button{min-height:44px;padding:8px 18px;border:1px solid #6a6b55;border-radius:22px}.empty-stage-action{position:absolute;top:44%;width:100%;min-height:48px;color:#c9c4ac;font-size:14px}
.play-surface{position:absolute;inset:0;z-index:3;cursor:crosshair;touch-action:none}.toy-light{position:absolute;width:26px;height:26px;transform:translate(-50%,-50%);pointer-events:none}.toy-core{position:absolute;inset:7px;background:#ecce82;border-radius:50%;box-shadow:0 0 18px 6px rgba(235,201,115,.3)}.toy-ring{position:absolute;inset:0;border:1px solid rgba(236,206,130,.5);border-radius:50%;animation:toy-pulse 1.8s ease-in-out infinite}
.affection{position:absolute;width:70px;height:80px;left:64%;top:25%;pointer-events:none;z-index:4;color:#dfb49b}.affection text{position:absolute;font-size:26px;animation:affection-rise 2.4s ease-out both}.affection text:nth-child(2){left:20px;top:22px;font-size:17px;animation-delay:.15s}.affection text:nth-child(3){left:-15px;top:8px;animation-delay:.25s}.memory-light{position:absolute;inset:12% 20% 10%;pointer-events:none;z-index:3}.memory-light view{position:absolute;width:5px;height:5px;background:#ead4a2;box-shadow:0 0 24px 8px rgba(234,212,162,.2);border-radius:50%;left:15%;top:45%;animation:affection-rise 2.4s ease-out both}.memory-light view:nth-child(2){left:83%;top:33%}.memory-light view:nth-child(3){left:70%;top:67%}
.interaction-panel{margin-top:18px;padding:16px 12px 0;border:1px solid rgba(212,215,182,.17);border-radius:26px;background:linear-gradient(145deg,#363a2e,#2b3027);box-shadow:0 15px 40px rgba(0,0,0,.09)}.interaction-heading{display:flex;justify-content:space-between;padding:0 8px;color:#c3c8ae;font-size:11px;letter-spacing:1px}.small-star{color:#abae82}.interaction-actions{display:flex;gap:6px;margin-top:13px}.interaction-action{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:7px;padding:10px 2px 12px;border-radius:18px;border:1px solid transparent;font-size:calc(14px * var(--ui-font-scale,1));color:#e4e4d2;transition:background .2s,border-color .2s}.action-symbol{display:flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:50%;background:#454c39;color:#ccd7b3;transition:transform .2s}.interaction-action:active .action-symbol{transform:scale(.91)}.interaction-action.selected{background:#454e38;border-color:#657353}.interaction-action.selected .action-symbol{background:#b6c495;color:#28321f}.action-note{font-size:10px;color:#a8b094;line-height:1.6}.interaction-action.selected .action-note{color:#d3dcc0}
.interaction-feedback{border-top:1px solid rgba(210,216,185,.1);min-height:58px;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 8px;box-sizing:border-box}.feedback-copy{font-size:11px;line-height:1.7;color:#b6bca5}.end-interaction{display:flex;align-items:center;gap:3px;min-height:40px;flex-shrink:0;padding:0 8px;font-size:11px;color:#dddcc4}.quiet-status{display:flex;align-items:center;gap:10px}.quiet-title,.quiet-time{display:block;font-size:11px;line-height:1.7;color:#c9ceb8}.quiet-time{font-variant-numeric:tabular-nums;font-size:10px;color:#a2ad90}.quiet-orb{width:20px;height:20px;flex-shrink:0;border:1px solid #a9b98c;background:rgba(169,185,140,.12);border-radius:50%;animation:quiet-breathe 6s ease-in-out infinite}
.preview-controls{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:49px;color:#8f9681;font-size:10px}.preview-controls button{min-height:44px;padding:8px 4px;font-size:11px;color:#b7bfa8}
.companion-content{padding:0 22px calc(24px + env(safe-area-inset-bottom));max-width:600px;margin:auto;box-sizing:border-box}.collection-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:24px 0 18px;border-top:1px solid rgba(209,212,183,.1)}.collection-heading>view{min-width:0}.collection-overline{display:block;font-size:8px;letter-spacing:1.6px;color:#969c86}.collection-title{display:block;margin-top:8px;font-size:calc(22px * var(--ui-font-scale,1));letter-spacing:1px;line-height:1.4}.records-owner{display:block;margin-top:6px;font-size:11px;line-height:1.6;color:#acaf9a;overflow-wrap:anywhere}.record-action{display:flex;align-items:center;justify-content:center;gap:6px;flex-shrink:0;min-height:44px;padding:0 12px;border:1px solid #555e46;border-radius:22px;font-size:12px;color:#d6dec4}.album-link{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;min-height:48px;margin-top:12px;color:#bcc6a7;font-size:12px}.preview-footnote{margin-top:22px;padding-top:18px;border-top:1px solid rgba(211,216,186,.08);text-align:center;color:#929883;font-size:10px;line-height:1.8}.preview-footnote button{display:flex;align-items:center;justify-content:center;gap:4px;min-height:44px;color:#bdc3ad;font-size:12px}
.memorial .presence-dot{background:#c6b899}.memorial .presence-chip{color:#c6b899}.memorial .interaction-panel{background:linear-gradient(145deg,#39392e,#2f3028)}.memorial .interaction-action.selected{background:#514f3c;border-color:#7c775b}.memorial .interaction-action.selected .action-symbol{background:#ccc19c;color:#393423}
.motion-paused .preview-character,.motion-paused .affection text,.motion-paused .memory-light view,.motion-paused .quiet-orb,.motion-paused .toy-ring{animation:none!important;transition:none!important}.motion-paused .preview-character{transform:none!important}
.memorial .preview-character{animation:none!important}
@keyframes companion-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.008)}}
@keyframes companion-nuzzle{0%,100%{transform:scale(1) rotate(0)}30%{transform:scale(1.025) rotate(-1.3deg)}65%{transform:scale(1.015) rotate(.6deg)}}
@keyframes affection-rise{0%{opacity:0;transform:translateY(12px) scale(.7)}20%{opacity:.9}100%{opacity:0;transform:translateY(-43px) scale(1.15)}}
@keyframes toy-pulse{50%{transform:scale(1.25);opacity:.4}}
@keyframes quiet-breathe{50%{transform:scale(1.18);background:rgba(169,185,140,.28)}}
@media(prefers-reduced-motion:reduce){.preview-character,.affection text,.memory-light view,.quiet-orb,.toy-ring{animation:none!important;transition:none!important}}
@media(min-width:600px){.companion-room{padding-left:32px;padding-right:32px;box-sizing:border-box}.pet-presence-space{margin-left:-32px;margin-right:-32px}.companion-content{padding-left:32px;padding-right:32px}}
.motion-glyph{width:12px;height:14px;box-sizing:border-box;border-left:2px solid currentColor;border-right:2px solid currentColor}.motion-glyph.is-paused{width:0;height:0;border:7px solid transparent;border-left:11px solid currentColor;border-right:0;margin-left:3px}.crescent-symbol{width:23px;height:23px;border-radius:50%;box-shadow:inset -6px -3px 0 0 currentColor;transform:rotate(-20deg)}
</style>
