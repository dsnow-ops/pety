<template>
  <canvas
    class="particle-canvas"
    :class="{ completing }"
    :canvas-id="canvasId"
    :id="canvasId"
  ></canvas>
</template>

<script>
import { isReduceMotionEnabled } from '../common/haptics.js';

const TAU = Math.PI * 2;
const COLORS = [
  [250, 247, 238],
  [247, 235, 204],
  [218, 232, 240],
  [224, 219, 239]
];

export default {
  name: 'PetGenerationParticlesLegacy',
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
      canvasId: `pet-particles-${Math.random().toString(36).slice(2, 9)}`,
      particles: [],
      frameId: null,
      timerId: null,
      paused: false,
      reduceMotion: false,
      width: 320,
      height: 320,
      glowEnabled: true,
      frameSamples: [],
      lastFrameAt: 0,
      degraded: false,
      resizeTimer: null,
      attractionMix: 0,
      targetAttractionMix: 0
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
    density(value) {
      // The display density is fixed for one generation session. Rebuilding the
      // particle array mid-animation would visibly reset every trajectory.
      if (!this.particles.length) this.createLayers(value);
    },
    progress() { if (this.reduceMotion) this.drawFrame(); },
    completing(value) {
      this.targetAttractionMix = value ? 1 : 0;
      if (this.reduceMotion) { this.attractionMix = this.targetAttractionMix; this.drawFrame(); }
    },
    motionReduced(value) { this.reduceMotion = value || isReduceMotionEnabled(); }
  },
  methods: {
    initialize() {
      uni.createSelectorQuery().in(this).select(`#${this.canvasId}`).boundingClientRect(rect => {
        if (rect) {
          this.width = Math.max(rect.width, 1);
          this.height = Math.max(rect.height, 1);
        }
        this.createLayers();
        this.drawFrame();
        this.resizeTimer = setTimeout(() => this.refreshBounds(), 320);
      }).exec();
    },
    refreshBounds() {
      uni.createSelectorQuery().in(this).select(`#${this.canvasId}`).boundingClientRect(rect => {
        if (!rect) return;
        const nextWidth = Math.max(rect.width, 1);
        const nextHeight = Math.max(rect.height, 1);
        if (Math.abs(nextWidth - this.width) < 1 && Math.abs(nextHeight - this.height) < 1) return;
        const scaleX = nextWidth / Math.max(this.width, 1);
        const scaleY = nextHeight / Math.max(this.height, 1);
        this.particles.forEach(particle => {
          particle.x *= scaleX;
          particle.y *= scaleY;
          particle.previousX = particle.x;
          particle.previousY = particle.y;
        });
        this.width = nextWidth;
        this.height = nextHeight;
      }).exec();
    },
    createLayers(forcedTotal) {
      const total = Math.min(Math.max(Number(forcedTotal || this.density) || 520, 260), 560);
      const farCount = Math.round(total * 0.44);
      const midCount = Math.round(total * 0.45);
      const frontCount = total - farCount - midCount;
      this.particles = [];
      for (let index = 0; index < farCount; index += 1) this.particles.push(this.createParticle('far'));
      for (let index = 0; index < midCount; index += 1) this.particles.push(this.createParticle('mid'));
      for (let index = 0; index < frontCount; index += 1) this.particles.push(this.createParticle('front'));
    },
    createParticle(layer) {
      const ranges = {
        far: { radius: [0.35, 0.9], alpha: [0.10, 0.28], speed: [0.035, 0.09] },
        mid: { radius: [0.75, 1.65], alpha: [0.20, 0.54], speed: [0.18, 0.34] },
        front: { radius: [1.7, 3.1], alpha: [0.24, 0.56], speed: [0.28, 0.48] }
      };
      const range = ranges[layer];
      const angle = Math.random() * TAU;
      const speed = range.speed[0] + Math.random() * (range.speed[1] - range.speed[0]);
      const radialBias = Math.random() < 0.58;
      const orbitRadius = Math.min(this.width, this.height) * (0.08 + Math.pow(Math.random(), 0.7) * 0.5);
      const x = radialBias ? this.width * 0.5 + Math.cos(angle) * orbitRadius : Math.random() * this.width;
      const y = radialBias ? this.height * 0.5 + Math.sin(angle) * orbitRadius * 0.82 : Math.random() * this.height;
      return {
        layer,
        x,
        y,
        previousX: x,
        previousY: y,
        radius: range.radius[0] + Math.random() * (range.radius[1] - range.radius[0]),
        alpha: range.alpha[0] + Math.random() * (range.alpha[1] - range.alpha[0]),
        vx: Math.cos(angle + Math.PI * 0.5) * speed,
        vy: Math.sin(angle + Math.PI * 0.5) * speed,
        phase: Math.random() * TAU,
        color: COLORS[Math.floor(Math.random() * COLORS.length)]
      };
    },
    drawGlow(context, now) {
      if (!this.glowEnabled || typeof context.createRadialGradient !== 'function') return;
      const progress = Math.min(Math.max(Number(this.progress) || 0, 0), 100) / 100;
      const glows = [
        { x: 0.3 + Math.sin(now * 0.11) * 0.08, y: 0.35, r: 0.5, color: 'rgba(132, 166, 204, 0.10)' },
        { x: 0.72, y: 0.6 + Math.cos(now * 0.09) * 0.07, r: 0.55, color: 'rgba(177, 151, 206, 0.08)' },
        { x: 0.5, y: 0.5, r: 0.34 + progress * 0.08, color: 'rgba(226, 191, 130, 0.07)' }
      ];
      glows.forEach(item => {
        const radius = Math.max(this.width, this.height) * item.r;
        const gradient = context.createRadialGradient(item.x * this.width, item.y * this.height, 0, item.x * this.width, item.y * this.height, radius);
        gradient.addColorStop(0, item.color);
        gradient.addColorStop(1, 'rgba(20, 23, 31, 0)');
        context.setFillStyle(gradient);
        context.fillRect(0, 0, this.width, this.height);
      });
    },
    moveParticle(particle, now, progress) {
      particle.wrapped = false;
      if (this.reduceMotion) return;
      particle.previousX = particle.x;
      particle.previousY = particle.y;
      const completionPull = this.attractionMix * 0.0011;
      const centerPull = (progress > 0.25 ? (progress - 0.25) * 0.00034 : 0) + completionPull;
      const dx = this.width * 0.5 - particle.x;
      const dy = this.height * 0.5 - particle.y;
      const progressSpeed = 1 + progress * 0.16;
      const curl = Math.sin(particle.y * 0.014 + now * 0.55 + particle.phase) + Math.cos(particle.x * 0.012 - now * 0.42);
      const orbit = Math.sin(now * 0.28 + particle.phase) * 0.004;
      const layerFlow = particle.layer === 'far' ? 0.0035 : (particle.layer === 'mid' ? 0.014 : 0.022);
      particle.vx += (Math.cos(curl * 1.25 + particle.phase) * layerFlow - dy * orbit / Math.max(this.height, 1)) * progressSpeed + dx * centerPull;
      particle.vy += (Math.sin(curl + particle.phase) * layerFlow + dx * orbit / Math.max(this.width, 1)) * progressSpeed + dy * centerPull;
      const maxSpeed = (particle.layer === 'far' ? 0.10 : (particle.layer === 'mid' ? 0.36 : 0.52)) * progressSpeed;
      const speed = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy) || 1;
      if (speed > maxSpeed) {
        particle.vx = particle.vx * maxSpeed / speed;
        particle.vy = particle.vy * maxSpeed / speed;
      }
      particle.x += particle.vx;
      particle.y += particle.vy;
      if (particle.x < -8) { particle.x = this.width + 8; particle.wrapped = true; }
      if (particle.x > this.width + 8) { particle.x = -8; particle.wrapped = true; }
      if (particle.y < -8) { particle.y = this.height + 8; particle.wrapped = true; }
      if (particle.y > this.height + 8) { particle.y = -8; particle.wrapped = true; }
      if (particle.wrapped) {
        particle.previousX = particle.x;
        particle.previousY = particle.y;
      }
    },
    monitorPerformance(frameAt) {
      if (!this.lastFrameAt) { this.lastFrameAt = frameAt; return; }
      this.frameSamples.push(frameAt - this.lastFrameAt);
      this.lastFrameAt = frameAt;
      if (this.frameSamples.length < 45 || this.degraded) return;
      const average = this.frameSamples.reduce((sum, value) => sum + value, 0) / this.frameSamples.length;
      this.frameSamples = [];
      if (average <= 29) return;
      this.degraded = true;
      // Keep existing positions and velocities. Disabling the expensive glow
      // lowers the fill cost without creating a second particle animation.
      this.glowEnabled = false;
    },
    drawFrame() {
      if (this.paused || !this.active) return;
      const context = uni.createCanvasContext(this.canvasId, this);
      const frameAt = Date.now();
      const now = frameAt / 1000;
      const progress = Math.min(Math.max(Number(this.progress) || 0, 0), 100) / 100;
      context.clearRect(0, 0, this.width, this.height);
      this.drawGlow(context, now);
      try { context.setGlobalCompositeOperation('lighter'); } catch (error) {}
      this.particles.forEach(particle => {
        if (!this.reduceMotion) this.moveParticle(particle, now, progress);
        const progressLift = (particle.layer === 'front' && progress > 0.7 ? 1.28 : 1) * (1 + this.attractionMix * 0.32);
        const revealOpacity = 1 - this.attractionMix * 0.84;
        const breath = this.reduceMotion ? 1 : 0.78 + Math.sin(now * 0.7 + particle.phase) * 0.22;
        const [red, green, blue] = particle.color;
        if (particle.layer !== 'far' && !particle.wrapped) {
          context.beginPath();
          context.setStrokeStyle(`rgba(${red}, ${green}, ${blue}, ${particle.alpha * 0.13})`);
          context.setLineWidth(particle.layer === 'front' ? 1.2 : 0.65);
          context.moveTo(particle.previousX, particle.previousY);
          context.lineTo(particle.x, particle.y);
          context.stroke();
        }
        if (particle.layer === 'front') {
          context.beginPath();
          context.setFillStyle(`rgba(${red}, ${green}, ${blue}, ${particle.alpha * 0.10})`);
          context.arc(particle.x, particle.y, particle.radius * 2.8, 0, TAU);
          context.fill();
        }
        context.beginPath();
        context.setFillStyle(`rgba(${red}, ${green}, ${blue}, ${Math.max(particle.alpha * breath * progressLift * revealOpacity, 0.02)})`);
        context.arc(particle.x, particle.y, particle.radius, 0, TAU);
        context.fill();
      });
      try { context.setGlobalCompositeOperation('source-over'); } catch (error) {}
      context.draw(false);
      this.attractionMix += (this.targetAttractionMix - this.attractionMix) * (this.reduceMotion ? 0.22 : 0.075);
      this.monitorPerformance(frameAt);
      if (this.reduceMotion) return;
      if (typeof requestAnimationFrame === 'function') this.frameId = requestAnimationFrame(() => this.drawFrame());
      else this.timerId = setTimeout(() => this.drawFrame(), 34);
    },
    pauseAnimation() {
      this.paused = true;
      this.cancelScheduledFrame();
    },
    resumeAnimation() {
      if (!this.paused && (this.frameId || this.timerId)) return;
      this.paused = false;
      this.cancelScheduledFrame();
      this.drawFrame();
    },
    cancelScheduledFrame() {
      if (this.frameId && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.frameId);
      if (this.timerId) clearTimeout(this.timerId);
      this.frameId = null;
      this.timerId = null;
    },
    cancelAnimation() {
      this.paused = true;
      this.cancelScheduledFrame();
      if (this.resizeTimer) clearTimeout(this.resizeTimer);
      this.resizeTimer = null;
      this.particles = [];
    }
  }
};
</script>

<style scoped>
.particle-canvas { width: 100%; height: 100%; opacity: 1; transition: opacity 520ms ease; }
.particle-canvas.completing { opacity: .16; }
</style>
