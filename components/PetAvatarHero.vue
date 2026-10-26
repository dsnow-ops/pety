<template>
  <view
    :class="['pet-avatar-hero', `placement-${placement}`, memorial ? 'memorial' : '', motionReduced ? 'reduce-motion' : '', hasCutout ? 'has-cutout' : 'has-master', assetKindClass, currentReady ? 'character-loaded' : '', touching ? 'is-touching' : '', tapAnimating ? 'tap-animating' : '']"
    :style="stageStyle"
    @touchstart="onTouchStart"
    @touchmove="onTouchMove"
    @touchend="resetParallax"
    @touchcancel="resetParallax"
    @click="onTap"
  >
    <view v-if="hasCutout" class="hero-glow"></view>
    <view v-if="hasCutout" class="hero-environment" :style="environmentStyle"></view>
    <view v-if="hasCutout" class="hero-pedestal" :style="pedestalStyle">
      <view class="shadow-ambient"></view>
      <view class="shadow-contact shadow-tail"></view>
      <view class="shadow-contact shadow-paws"></view>
    </view>
    <view class="hero-asset" :style="assetTransformStyle">
      <view class="hero-motion" :style="motionOriginStyle">
        <view v-if="previousImageUrl" class="hero-image-frame previous-frame" :style="previousFrameStyle" :class="{ fading: currentReady, 'master-surface': !previousHasCutout }">
          <image :src="previousImageUrl" class="hero-image hero-image-previous" mode="aspectFit"></image>
        </view>
        <view class="hero-image-frame current-frame" :style="frameStyle" :class="{ ready: currentReady, 'master-surface': !hasCutout }">
        <image v-if="imageUrl" :key="assetIdentity + imageUrl + imageGeneration" :data-generation="imageGeneration" :data-identity="assetIdentity" :data-url="imageUrl" :src="imageUrl" class="hero-image hero-image-current" :class="{ ready: currentReady }" mode="aspectFit" @load="onCurrentLoaded" @error="onCurrentError"></image>
        <view v-if="imageUrl && !hasCutout" class="portrait-vignette"></view>
        <view v-if="imageUrl && !hasCutout" class="portrait-sheen"></view>
        </view>
        <view v-if="!currentReady && !previousImageUrl" class="hero-placeholder">
          <view class="placeholder-ear left"></view><view class="placeholder-ear right"></view>
          <view class="placeholder-head"></view><view class="placeholder-body"></view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { lightHaptic } from '../common/haptics.js';

export default {
  name: 'PetAvatarHero',
  emits: ['tap', 'asset-error', 'asset-loaded'],
  props: {
    petId: { type: String, default: '' },
    masterKey: { type: String, default: '' },
    assetKey: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    assetKind: { type: String, default: 'placeholder' },
    hasCutout: { type: Boolean, default: false },
    imageWidth: { type: Number, default: 0 },
    imageHeight: { type: Number, default: 0 },
    alphaBounds: { type: Object, default: null },
    placement: { type: String, default: 'spotlight' },
    memorial: { type: Boolean, default: false },
    reduceMotion: { type: Boolean, default: false }
  },
  data() {
    return { stageWidth: 320, imageGeneration: 0, systemReduceMotion: false, mediaQuery: null, mediaListener: null, resizeListener: null, disposed: false, previousFrameStyle: {}, loadedFrameStyle: {}, previousImageUrl: '', previousHasCutout: false, loadedHasCutout: false, currentReady: false, renderedPetId: this.petId, renderedMasterKey: this.masterKey, suppressedPreviousUrl: '', touchStartX: 0, touchStartY: 0, offsetX: 0, offsetY: 0, touching: false, tapAnimating: false, tapTimer: null, revealTimer: null };
  },
  mounted() {
    this.measureStage();
    // #ifdef H5
    // uni's generic event wrapper drops pointer coordinates; bind native H5
    // pointers here. APP-PLUS uses the normal touch events above.
    this.pointerBindings = { pointerdown: this.onPointerStart, pointermove: this.onPointerMove, pointerup: this.resetParallax, pointerleave: this.resetParallax };
    Object.entries(this.pointerBindings).forEach(([name, listener]) => this.$el.addEventListener(name, listener));
    // #endif
    this.resizeListener = () => this.measureStage();
    if (typeof uni.onWindowResize === 'function') uni.onWindowResize(this.resizeListener);
    if (typeof matchMedia === 'function') {
      this.mediaQuery = matchMedia('(prefers-reduced-motion: reduce)');
      this.mediaListener = event => { this.systemReduceMotion = event.matches; this.resetParallax(); };
      this.mediaListener(this.mediaQuery);
      if (this.mediaQuery.addEventListener) this.mediaQuery.addEventListener('change', this.mediaListener);
    }
  },
  beforeUnmount() {
    this.disposed = true;
    // #ifdef H5
    Object.entries(this.pointerBindings || {}).forEach(([name, listener]) => this.$el.removeEventListener(name, listener));
    // #endif
    if (this.resizeListener && typeof uni.offWindowResize === 'function') uni.offWindowResize(this.resizeListener);
    if (this.mediaQuery && this.mediaQuery.removeEventListener) this.mediaQuery.removeEventListener('change', this.mediaListener);
    if (this.tapTimer) clearTimeout(this.tapTimer);
    if (this.revealTimer) clearTimeout(this.revealTimer);
  },
  computed: {
    motionReduced() { return this.reduceMotion || this.systemReduceMotion; },
    subjectGeometry() {
      const ratio = this.imageWidth > 0 && this.imageHeight > 0 ? this.imageWidth / this.imageHeight : 1;
      const bounds = this.alphaBounds;
      const contentFraction = bounds && this.imageWidth ? (bounds.maxX - bounds.minX + 1) / this.imageWidth : 0.88;
      const integratedPortrait = !this.hasCutout && this.placement === 'card-overlap';
      const width = integratedPortrait ? this.stageWidth : this.stageWidth * (this.hasCutout ? Math.min(0.94, 0.72 / Math.max(contentFraction, 0.01)) : 0.84);
      const height = this.hasCutout ? width / ratio : this.stageWidth * (integratedPortrait ? 0.86 : 0.88);
      const bottomPadding = this.hasCutout && bounds && this.imageHeight ? height * (this.imageHeight - bounds.maxY - 1) / this.imageHeight : 0;
      return { width, height, foot: 12 + bottomPadding };
    },
    stageStyle() {
      if (!this.hasCutout && this.placement === 'card-overlap') return { height: `${this.subjectGeometry.height}px` };
      return { height: `${Math.max(this.stageWidth * 0.78, this.subjectGeometry.height + 24)}px` };
    },
    pedestalStyle() {
      const pressed = !this.motionReduced && (this.touching || this.tapAnimating);
      return { bottom: `${Math.max(4, this.subjectGeometry.foot - 6)}px`, width: `${this.subjectGeometry.width * 0.75}px`,
        transform: `translateX(calc(-50% + ${this.motionReduced ? 0 : this.offsetX * 0.35}px)) scale(${pressed ? 1.035 : 1})`, opacity: this.currentReady ? (pressed ? '.96' : '.78') : '0' };
    },
    environmentStyle() { return { bottom: `${this.subjectGeometry.foot + this.subjectGeometry.height * 0.05}px`, width: `${this.subjectGeometry.width * .78}px`, height: `${this.subjectGeometry.height * .68}px` }; },
    motionOriginStyle() { return { transformOrigin: `52% calc(100% - ${this.subjectGeometry.foot}px)` }; },
    frameStyle() {
      return { width: `${this.subjectGeometry.width}px`, height: `${this.subjectGeometry.height}px`, bottom: !this.hasCutout && this.placement === 'card-overlap' ? '0' : '12px' };
    },
    assetIdentity() {
      return `${this.petId}::${this.masterKey}::${this.assetKey || this.imageUrl}`;
    },
    assetKindClass() {
      const kind = String(this.assetKind || 'placeholder').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
      return `asset-${kind}`;
    },
    assetTransformStyle() {
      if (this.motionReduced || !this.imageUrl) return {};
      return { transform: `translate(${this.offsetX}px, ${this.offsetY}px)` };
    }
  },
  watch: {
    hasCutout(next, previous) {
      if (next === previous) return;
      this.resetParallax();
      this.$nextTick(() => this.measureStage());
    },
    petId(next, previous) {
      if (next === previous) return;
      this.resetOwner();
    },
    masterKey(next, previous) { if (next !== previous) this.resetOwner(); },
    imageUrl(next, previous) {
      if (next === previous) return;
      this.imageGeneration += 1;
      const mayPreserve = this.renderedPetId === this.petId && this.renderedMasterKey === this.masterKey && previous && previous !== this.suppressedPreviousUrl;
      this.previousImageUrl = mayPreserve && this.currentReady ? previous : '';
      this.previousHasCutout = this.loadedHasCutout;
      this.previousFrameStyle = this.loadedFrameStyle;
      this.renderedPetId = this.petId;
      this.suppressedPreviousUrl = '';
      this.currentReady = false;
      if (this.revealTimer) clearTimeout(this.revealTimer);
    }
  },
  methods: {
    measureStage() {
      this.$nextTick(() => {
        if (this.disposed) return;
        uni.createSelectorQuery().in(this).select('.pet-avatar-hero').boundingClientRect(rect => {
          if (!this.disposed && rect && rect.width) this.stageWidth = rect.width;
        }).exec();
      });
    },
    resetOwner() {
      this.imageGeneration += 1;
      this.suppressedPreviousUrl = this.imageUrl;
      this.previousImageUrl = ''; this.currentReady = false;
      this.resetParallax();
      if (this.revealTimer) clearTimeout(this.revealTimer);
    },
    isCurrentImageEvent(event) {
      const data = event && event.currentTarget && event.currentTarget.dataset;
      return !event || Boolean(data && data.identity === this.assetIdentity && data.url === this.imageUrl && Number(data.generation) === this.imageGeneration);
    },
    onCurrentLoaded(event) {
      if (!this.isCurrentImageEvent(event)) return;
      this.renderedPetId = this.petId;
      this.renderedMasterKey = this.masterKey;
      this.loadedFrameStyle = { ...this.frameStyle };
      this.currentReady = true;
      this.loadedHasCutout = this.hasCutout;
      this.$emit('asset-loaded', { petId: this.petId, masterKey: this.masterKey, imageUrl: this.imageUrl, generation: this.imageGeneration });
      const generation = this.imageGeneration;
      this.revealTimer = setTimeout(() => {
        if (generation !== this.imageGeneration || this.disposed) return;
        if (this.currentReady) this.previousImageUrl = '';
        this.revealTimer = null;
      }, this.motionReduced ? 300 : 640);
    },
    onCurrentError(event) {
      if (!this.isCurrentImageEvent(event)) return;
      this.currentReady = false;
      this.$emit('asset-error', { petId: this.petId, masterKey: this.masterKey, imageUrl: this.imageUrl, generation: this.imageGeneration });
    },
    onTouchStart(event) {
      const touch = event && event.touches && event.touches[0];
      if (!touch || !Number.isFinite(touch.clientX) || !Number.isFinite(touch.clientY) || !this.imageUrl || this.motionReduced) return;
      this.touching = true;
      this.touchStartX = touch.clientX; this.touchStartY = touch.clientY;
    },
    onTouchMove(event) {
      const touch = event && event.touches && event.touches[0];
      if (!touch || !Number.isFinite(touch.clientX) || !Number.isFinite(touch.clientY) || !this.imageUrl || this.motionReduced) return;
      if (!this.touching) return;
      if (Math.abs(touch.clientY - this.touchStartY) > 18) { this.resetParallax(); return; }
      const maxX = this.hasCutout ? 3 : 2;
      const maxY = this.hasCutout ? 2 : 1.5;
      this.offsetX = Math.max(-maxX, Math.min(maxX, (touch.clientX - this.touchStartX) * 0.05));
      this.offsetY = Math.max(-maxY, Math.min(maxY, (touch.clientY - this.touchStartY) * 0.035));
    },
    onPointerStart(event) { this.onTouchStart({ touches: [event] }); },
    onPointerMove(event) { if (this.touching) this.onTouchMove({ touches: [event] }); },
    resetParallax() { this.touching = false; this.offsetX = 0; this.offsetY = 0; },
    onTap() {
      if (this.imageUrl) lightHaptic();
      if (this.imageUrl && !this.motionReduced) {
        this.tapAnimating = false;
        this.$nextTick(() => {
          if (this.disposed) return;
          this.tapAnimating = true;
          if (this.tapTimer) clearTimeout(this.tapTimer);
          this.tapTimer = setTimeout(() => { this.tapAnimating = false; }, 220);
        });
      }
      this.$emit('tap');
    }
  }
};
</script>

<style scoped>
.pet-avatar-hero { position: relative; width: 100%; overflow: visible; transition: height 620ms ease; }
.hero-glow { position: absolute; left: 50%; top: 42%; width: 86%; height: 64%; border-radius: 50%; transform: translate(-50%,-50%); background: radial-gradient(ellipse, rgba(181,190,168,.13), transparent 68%); pointer-events: none; }
.memorial .hero-glow { background: radial-gradient(ellipse, rgba(183,186,204,.14), transparent 68%); }
.hero-environment { position: absolute; left: 54%; transform: translateX(-50%) rotate(-7deg); border-radius: 50%; background: radial-gradient(ellipse, rgba(79,77,63,.10), rgba(100,99,83,.035) 42%, transparent 70%); opacity: 0; transition: opacity 620ms ease; pointer-events: none; }
.character-loaded .hero-environment { opacity: 1; }
.hero-pedestal { position: absolute; left: 50%; height: 34rpx; pointer-events: none; transition: transform 220ms ease, opacity 220ms ease; }
.shadow-ambient { position: absolute; inset: -8rpx -12rpx; border-radius: 50%; background: radial-gradient(ellipse, rgba(62,57,46,.13), rgba(74,68,55,.045) 48%, transparent 72%); }
.shadow-contact { position: absolute; bottom: 9rpx; height: 13rpx; border-radius: 50%; background: radial-gradient(ellipse, rgba(50,46,37,.23), rgba(65,60,48,.09) 38%, transparent 70%); }
.shadow-tail { left: 4%; width: 51%; transform: rotate(3deg); }
.shadow-paws { right: 6%; width: 36%; height: 10rpx; }
.hero-asset { position: absolute; inset: 0; transition: transform 220ms ease; }
.hero-motion { position: relative; width: 100%; height: 100%; transform-origin: 50% 94%; }
.has-cutout .hero-motion { animation: heroIdle 7s ease-in-out infinite; }
.has-master .hero-image { transform-origin: 58% 56%; animation: portraitIdle 10s ease-in-out infinite; }
.hero-image-frame { position: absolute; left: 50%; transform: translateX(-50%); }
.hero-image { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
.master-surface { border-radius: 28rpx; overflow: hidden; background: #e8e2d7; border: 1rpx solid rgba(86,73,55,.08); }
.portrait-vignette, .portrait-sheen { position: absolute; inset: 0; pointer-events: none; }
.portrait-vignette { z-index: 2; background: linear-gradient(90deg, rgba(255,253,248,.86) 0%, rgba(255,253,248,.34) 17%, rgba(255,253,248,0) 45%), linear-gradient(180deg, rgba(255,253,248,.08), transparent 32%, rgba(67,57,44,.07)); }
.portrait-sheen { z-index: 3; width: 54%; opacity: 0; transform: translateX(-135%) skewX(-12deg); background: linear-gradient(90deg, transparent, rgba(255,255,255,.28), transparent); }
.current-frame { opacity: 0; transition: opacity 620ms ease, transform 620ms ease; }
.has-cutout .current-frame { transform: translate(-50%, 5px); }
.current-frame.ready { opacity: 1; transform: translate(-50%, 0); }
.previous-frame { opacity: 1; transition: opacity 620ms ease; }.previous-frame.fading { opacity: 0; }
.hero-placeholder { position: absolute; left: 50%; bottom: 36rpx; width: 180rpx; height: 180rpx; transform: translateX(-50%); border-radius: 50%; background: #e4e5dc; opacity: .65; }
.placement-card-overlap .hero-image-frame { left: 52%; }
.placement-card-overlap .hero-glow { left: 53%; top: 48%; width: 94%; height: 72%; }
.placement-card-overlap .hero-pedestal { left: 53%; }
.placement-card-overlap .hero-placeholder { left: 52%; bottom: 30rpx; }
.placement-card-overlap.has-master .master-surface { left: 50%; border: 0; border-radius: 0 34rpx 34rpx 0; background: var(--pety-surface-muted, #EEE9E0); }
.is-touching .hero-motion, .is-touching .hero-image { animation-play-state: paused; }
.has-cutout.is-touching .hero-motion { animation: none; transform: scale(.992,.982); transition: transform 180ms ease; }
.has-cutout.tap-animating .hero-motion { animation: heroTap 220ms ease; }
.has-master.tap-animating .hero-motion { animation: portraitTap 260ms ease; }
.has-master.tap-animating .portrait-sheen { animation: portraitSheen 520ms ease-out; }
.reduce-motion, .reduce-motion .hero-asset, .reduce-motion .hero-pedestal, .reduce-motion .hero-environment { transition: none; }
.reduce-motion .hero-motion, .reduce-motion .hero-image, .reduce-motion .portrait-sheen { animation: none !important; transform: none; }
.reduce-motion .current-frame, .reduce-motion .previous-frame { transform: translateX(-50%); transition: opacity 280ms ease; }
@keyframes heroTap { 0% { transform: scale(.992,.982); } 65% { transform: scale(1.002,1.005); } 100% { transform: scale(1); } }
@keyframes heroIdle { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.001,1.004); } }
@keyframes portraitIdle { 0%, 100% { transform: scale(1.015) translate3d(0,0,0); } 50% { transform: scale(1.035) translate3d(-1.2%, -.7%, 0); } }
@keyframes portraitTap { 0% { transform: scale(.985); } 55% { transform: scale(1.012); } 100% { transform: scale(1); } }
@keyframes portraitSheen { 0% { opacity: 0; transform: translateX(-135%) skewX(-12deg); } 24% { opacity: .7; } 100% { opacity: 0; transform: translateX(250%) skewX(-12deg); } }
@media (prefers-reduced-motion: reduce) {
  .pet-avatar-hero, .hero-asset { transition: none; }
  .hero-motion, .hero-image, .portrait-sheen { animation: none !important; transform: none !important; }
  .hero-asset { transform: none !important; }
  .hero-pedestal, .hero-environment { transition: none !important; }
  .current-frame, .previous-frame { transition: opacity 280ms ease; transform: translateX(-50%) !important; }
}
</style>
