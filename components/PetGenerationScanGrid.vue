<template>
  <canvas
    class="scan-grid-canvas"
    :class="{ completing }"
    :canvas-id="canvasId"
    :id="canvasId"
  ></canvas>
</template>

<script>
import { isReduceMotionEnabled } from '../common/haptics.js';

const TAU = Math.PI * 2;
const FRAME_INTERVAL_MS = 48;

export default {
  name: 'PetGenerationScanGrid',
  emits: ['lifecycle-mounted'],
  props: {
    active: { type: Boolean, default: true },
    density: { type: Number, default: 520 },
    progress: { type: Number, default: 0 },
    completing: { type: Boolean, default: false },
    motionReduced: { type: Boolean, default: false }
  },
  data() {
    return {
      canvasId: `pet-scan-grid-${Math.random().toString(36).slice(2, 9)}`,
      width: 320,
      height: 320,
      columns: 27,
      rows: 27,
      timerId: null,
      resizeTimer: null,
      paused: false,
      disposed: false,
      reduceMotion: false,
      animationTime: 0,
      renderedFrameCount: 0,
      completionMix: 0
    };
  },
  mounted() {
    this.reduceMotion = this.motionReduced || isReduceMotionEnabled();
    this.$emit('lifecycle-mounted');
    this.$nextTick(() => this.initialize());
  },
  beforeUnmount() { this.cancelAnimation(); },
  watch: {
    active(value) { value ? this.resumeAnimation() : this.pauseAnimation(); },
    progress() { if (this.reduceMotion) this.drawFrame(); },
    completing() { if (this.reduceMotion) { this.completionMix = this.completing ? 1 : 0; this.drawFrame(); } },
    motionReduced(value) {
      this.reduceMotion = value || isReduceMotionEnabled();
      this.reduceMotion ? this.cancelScheduledFrame() : this.resumeAnimation();
      this.drawFrame();
    }
  },
  methods: {
    initialize() {
      uni.createSelectorQuery().in(this).select(`#${this.canvasId}`).boundingClientRect(rect => {
        if (rect) { this.width = Math.max(rect.width, 1); this.height = Math.max(rect.height, 1); }
        this.recalculateGrid();
        this.drawFrame();
        this.resizeTimer = setTimeout(() => this.refreshBounds(), 320);
      }).exec();
    },
    recalculateGrid() {
      const target = Math.min(Math.max(Number(this.density) || 520, 320), 720);
      const ratio = this.width / Math.max(this.height, 1);
      this.columns = Math.max(20, Math.round(Math.sqrt(target * ratio)));
      this.rows = Math.max(20, Math.round(target / this.columns));
    },
    refreshBounds() {
      uni.createSelectorQuery().in(this).select(`#${this.canvasId}`).boundingClientRect(rect => {
        if (!rect || this.disposed) return;
        const width = Math.max(rect.width, 1), height = Math.max(rect.height, 1);
        if (Math.abs(width - this.width) < 1 && Math.abs(height - this.height) < 1) return;
        this.width = width; this.height = height; this.recalculateGrid(); this.drawFrame();
      }).exec();
    },
    gaussian(distance, spread) {
      const normalized = distance / Math.max(spread, 0.001);
      return Math.exp(-normalized * normalized * 0.5);
    },
    drawFrame() {
      if (this.paused || !this.active || this.disposed) return;
      const context = uni.createCanvasContext(this.canvasId, this);
      const time = this.reduceMotion ? 0.8 : this.animationTime;
      const progress = Math.min(Math.max(Number(this.progress) || 0, 0), 100) / 100;
      this.completionMix += ((this.completing ? 1 : 0) - this.completionMix) * (this.reduceMotion ? 1 : 0.08);
      context.clearRect(0, 0, this.width, this.height);

      const marginX = this.width * 0.055, marginY = this.height * 0.04;
      const stepX = (this.width - marginX * 2) / Math.max(this.columns - 1, 1);
      const stepY = (this.height - marginY * 2) / Math.max(this.rows - 1, 1);
      const scanCycle = (Math.sin(time * 0.92 - Math.PI / 2) + 1) * 0.5;
      const scanX = this.width * (0.13 + scanCycle * 0.74);
      const breathing = this.reduceMotion ? 0.75 : 0.77 + Math.sin(time * 1.35) * 0.12;

      for (let row = 0; row < this.rows; row += 1) {
        for (let column = 0; column < this.columns; column += 1) {
          const baseX = marginX + column * stepX;
          const baseY = marginY + row * stepY;
          const waveY = this.height * (0.56 + Math.sin(column * 0.34 - time * 2.05) * 0.075);
          const waveInfluence = this.gaussian(baseY - waveY, this.height * 0.22);
          const x = baseX + (this.reduceMotion ? 0 : Math.sin(time * 1.7 + row * 0.19) * stepX * 0.08 * waveInfluence);
          const y = baseY + (this.reduceMotion ? 0 : Math.sin(time * 2.25 + column * 0.31) * stepY * 0.34 * waveInfluence);
          const ridge = this.gaussian(y - waveY, this.height * 0.19);
          const focusDistance = Math.sqrt(Math.pow(x - scanX, 2) + Math.pow(y - this.height * 0.59, 2));
          const focus = this.gaussian(focusDistance, this.width * 0.31);
          const trailing = this.gaussian(x - scanX, this.width * 0.2) * ridge;
          const edgeFade = Math.max(0, Math.min(1, x / (this.width * 0.18), (this.width - x) / (this.width * 0.18), y / (this.height * 0.14), (this.height - y) / (this.height * 0.14)));
          const energy = Math.min(1, (ridge * 0.46 + focus * 0.42 + trailing * 0.36) * breathing * edgeFade);
          const completionFade = 1 - this.completionMix * 0.82;
          const radius = 0.55 + energy * (1.65 + progress * 0.35);
          const alpha = Math.max(0.05, (0.09 + energy * 0.82) * completionFade);
          const pearlMix = 0.5 + Math.sin(column * 0.23 + row * 0.11 - time * 0.55) * 0.5;
          const red = Math.round(74 + energy * (62 + pearlMix * 56));
          const green = Math.round(68 + energy * (116 - pearlMix * 22));
          const blue = Math.round(82 + energy * (92 - pearlMix * 36));
          context.beginPath();
          context.setFillStyle(`rgba(${red}, ${green}, ${blue}, ${alpha})`);
          context.arc(x, y, radius, 0, TAU);
          context.fill();
        }
      }
      context.draw(false);
      this.renderedFrameCount += 1;
      if (this.reduceMotion) return;
      this.scheduleNextFrame();
    },
    scheduleNextFrame() {
      // APP-PLUS can expose a frame callback in the service layer even when it
      // does not continuously wake a native canvas.
      // A single timer loop is slower but reliable on both APP and H5.
      if (this.timerId || this.paused || !this.active || this.disposed || this.reduceMotion) return;
      this.timerId = setTimeout(() => {
        this.timerId = null;
        if (this.paused || !this.active || this.disposed || this.reduceMotion) return;
        this.animationTime += FRAME_INTERVAL_MS / 1000;
        this.drawFrame();
      }, FRAME_INTERVAL_MS);
    },
    pauseAnimation() { this.paused = true; this.cancelScheduledFrame(); },
    resumeAnimation() {
      if (!this.paused && this.timerId) return;
      this.paused = false; this.disposed = false; this.cancelScheduledFrame(); this.drawFrame();
    },
    cancelScheduledFrame() {
      if (this.timerId) clearTimeout(this.timerId);
      this.timerId = null;
    },
    cancelAnimation() {
      this.disposed = true; this.paused = true; this.cancelScheduledFrame();
      if (this.resizeTimer) clearTimeout(this.resizeTimer);
      this.resizeTimer = null;
    }
  }
};
</script>

<style scoped>
.scan-grid-canvas { width: 100%; height: 100%; opacity: 1; transition: opacity 520ms ease; }
.scan-grid-canvas.completing { opacity: .2; }
</style>
