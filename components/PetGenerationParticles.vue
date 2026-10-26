<template>
  <view class="particle-host">
    <PetGenerationParticlesLegacy
      v-if="resolvedVariant === 'legacy-orbit'"
      ref="renderer"
      class="particle-renderer"
      :active="active"
      :density="density"
      :progress="progress"
      :completing="completing"
      :motion-reduced="motionReduced"
      @lifecycle-mounted="$emit('lifecycle-mounted')"
    />
    <PetGenerationScanGrid
      v-else
      ref="renderer"
      class="particle-renderer"
      :active="active"
      :density="density"
      :progress="progress"
      :completing="completing"
      :motion-reduced="motionReduced"
      @lifecycle-mounted="$emit('lifecycle-mounted')"
    />
  </view>
</template>

<script>
import PetGenerationParticlesLegacy from './PetGenerationParticlesLegacy.vue';
import PetGenerationScanGrid from './PetGenerationScanGrid.vue';

// Change this one value to restore the previous particle field.
const DEFAULT_GENERATION_EFFECT = 'scan-grid';

export default {
  name: 'PetGenerationParticles',
  components: { PetGenerationParticlesLegacy, PetGenerationScanGrid },
  emits: ['lifecycle-mounted'],
  props: {
    variant: { type: String, default: DEFAULT_GENERATION_EFFECT },
    active: { type: Boolean, default: true },
    density: { type: Number, default: 520 },
    progress: { type: Number, default: 0 },
    completing: { type: Boolean, default: false },
    motionReduced: { type: Boolean, default: false }
  },
  computed: {
    resolvedVariant() { return this.variant === 'legacy-orbit' ? 'legacy-orbit' : 'scan-grid'; }
  },
  methods: {
    resumeAnimation() { this.$refs.renderer?.resumeAnimation(); },
    pauseAnimation() { this.$refs.renderer?.pauseAnimation(); },
    cancelAnimation() { this.$refs.renderer?.cancelAnimation(); }
  }
};
</script>

<style scoped>
.particle-host, .particle-renderer { width: 100%; height: 100%; }
</style>
