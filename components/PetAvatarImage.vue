<template>
  <view class="pet-avatar-image" :data-pet-id="pet && pet.id" :data-source-type="asset.assetKind" :data-file-hash="fileHash">
    <image v-if="asset.imageUrl" :key="identity + asset.imageUrl" :src="asset.imageUrl" :data-identity="identity" :data-url="asset.imageUrl" class="asset" :class="{ ready: loadedKey === identity + asset.imageUrl }" mode="aspectFill" @load="onLoad" @error="onError" />
    <view v-if="loadedKey !== identity + asset.imageUrl || !asset.imageUrl" class="placeholder"><text>{{ Array.from(pet.name || '归')[0] }}</text></view>
  </view>
</template>
<script>
import { resolvePetHeroAsset, hydratePetHeroAsset, subscribeAvatarAssets, invalidateAvatarUrl, getAvatarAssetHashPrefix } from '../common/avatar-display-asset.js';
export default {
  name: 'PetAvatarImage',
  props: { pet: { type: Object, default: () => ({}) }, load: { type: Boolean, default: true } },
  data() { return { revision: 0, loadedKey: '', unsubscribe: null, recovering: '' }; },
  computed: {
    asset() { this.revision; return resolvePetHeroAsset(this.pet || {}, { preferFinal: true }); },
    identity() { return `${this.asset.petId}:${this.asset.masterFileId}:${this.asset.displayFileId}`; },
    fileHash() { return getAvatarAssetHashPrefix(this.asset.displayFileId); }
  },
  watch: {
    identity: { immediate: true, handler() { this.loadedKey = ''; this.refresh(); } },
    pet() { this.refresh(); },
    load(value) { if (value) this.refresh(); }
  },
  mounted() {
    this.unsubscribe = subscribeAvatarAssets(petId => { if (petId === (this.pet || {}).id) this.revision++; });
    this.refresh();
  },
  beforeUnmount() { if (this.unsubscribe) this.unsubscribe(); },
  methods: {
    refresh() { if (!this.load) return Promise.resolve(); return hydratePetHeroAsset(this.pet || {}, { preferFinal: true }).then(() => { this.revision++; }).catch(() => {}); },
    current(event) { const d = event && event.currentTarget && event.currentTarget.dataset; return d && d.identity === this.identity && d.url === this.asset.imageUrl; },
    onLoad(event) { if (this.current(event)) this.loadedKey = this.identity + this.asset.imageUrl; },
    async onError(event) {
      if (!this.current(event) || this.recovering === this.identity) return;
      this.loadedKey = '';
      const owner = this.identity;
      this.recovering = owner;
      const asset = this.asset;
      invalidateAvatarUrl(asset.petId, asset.displayFileId, asset.imageUrl);
      try { await this.refresh(); } finally { if (this.recovering === owner) this.recovering = ''; }
    }
  }
};
</script>
<style scoped>
.pet-avatar-image { position: relative; overflow: hidden; background: #e9e6df; }
.asset, .placeholder { position: absolute; inset: 0; width: 100%; height: 100%; }
.asset { opacity: 0; }.asset.ready { opacity: 1; }
.placeholder { display: flex; align-items: center; justify-content: center; color: #b4aea2; background: #e9e6df; }
</style>
