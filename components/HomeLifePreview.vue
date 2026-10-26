<template>
  <view class="home-life-preview" :class="{ 'memory-preview': memorial }">
    <view v-if="loadError" class="life-preview-empty"><text>册页暂时未能读取</text><button @click="load">重新读取</button></view>
    <view v-else-if="memorial && !opened" class="memory-book">
      <view class="book-spine" aria-hidden="true"><uni-icons type="heart" size="25" color="#BCC4AE"/></view>
      <view class="memory-book-copy"><text class="preview-title">一起走过的日子</text><text class="preview-caption">{{ records.length ? '你留下的片段，在这里好好收着。' : '回忆可以慢慢收好，不必今天写完。' }}</text><button class="memory-open" @click="openMemory">{{ records.length ? '翻开一段回忆' : '翻开回忆册' }} <uni-icons type="right" size="15" color="currentColor"/></button></view>
    </view>
    <template v-else-if="record">
      <view class="preview-meta"><text>{{ memorial ? '陪你翻一页' : '最近留下的一刻' }}</text><text>{{ record.eventLabel }}</text></view>
      <button class="life-preview-record" :class="{ 'has-photo': !!photo }" @click="openRecord">
        <image v-if="photo" :src="photo" mode="aspectFill" class="life-preview-photo" @error="photoFailed"/>
        <view class="preview-copy"><text v-if="record.title" class="preview-title">{{ record.title }}</text><text class="preview-excerpt">{{ excerpt }}</text><text class="preview-origin">来自原记录 <uni-icons type="right" size="12" color="currentColor"/></text></view>
      </button>
      <text v-if="photoError" class="preview-caption">照片暂不可读取，文字和原记录仍保留。</text>
      <view v-if="memorial" class="memory-page-controls"><button :disabled="index===0" @click="turn(-1)">上一段</button><text>{{ index + 1 }} / {{ records.length }}</text><button :disabled="index===records.length-1" @click="turn(1)">下一段</button><button @click="closeMemory">合上回忆</button></view>
      <view v-else class="preview-footer"><text>{{ total === 1 ? '第一段日常，已经收好' : '已收存 ' + total + ' 段生活片段' }}</text><button @click="$emit('album')">翻开陪伴册 <uni-icons type="right" size="13" color="currentColor"/></button></view>
    </template>
    <view v-else class="life-preview-empty companion-book"><view class="empty-book-mark" aria-hidden="true"><uni-icons type="compose" size="24" color="currentColor"/></view><view class="empty-book-copy"><text class="preview-title">日常，慢慢成册</text><text class="preview-caption">一句话，一张照片。<br/>把一起度过的小日子收好。</text><button @click="$emit('album')">翻开陪伴册 <uni-icons type="right" size="13" color="currentColor"/></button></view></view>
  </view>
</template>

<script>
import { getNarrativeStore, narrativeMode } from '../common/narrative-store.js';
import { queryRecords, lifeText, lifePhotos, safeForRecall } from '../common/record-views.js';
import { captureDataScope, isDataScopeCurrent } from '../common/scoped-storage.js';
import { getActivePet } from '../common/pet-store.js';
import { resolveNarrativePhoto, releaseNarrativePhoto } from '../common/narrative-media.js';

export default {
  props: { pet: Object, refresh: Number },
  emits: ['album'],
  data: () => ({ records: [], total: 0, index: 0, opened: false, photo: '', photoError: false, loadError: false, scope: null, owner: '', epoch: 0, disposed: false }),
  computed: {
    memorial() { return narrativeMode(this.pet?.relationshipStage || this.pet?.status) === 'deceased'; },
    record() { return this.records[this.index] || null; },
    excerpt() { return lifeText(this.record || {}) || lifePhotos(this.record || {})[0]?.caption || '一张留下来的生活照片'; }
  },
  watch: { refresh() { this.load(); }, 'pet.id'() { this.load(); }, memorial() { this.load(); } },
  mounted() { this.load(); },
  beforeUnmount() { this.disposed = true; this.clearPhoto(); this.records = []; },
  methods: {
    current() { return !this.disposed && isDataScopeCurrent(this.scope) && this.owner === this.pet?.id && getActivePet()?.id === this.owner; },
    clearPhoto() { this.epoch++; if (this.photo) releaseNarrativePhoto(this.photo); this.photo = ''; this.photoError = false; },
    load() {
      this.clearPhoto(); this.records = []; this.total = 0; this.index = 0; this.opened = false; this.loadError = false;
      this.scope = captureDataScope(); this.owner = this.pet?.id || '';
      if (!this.current() || !this.owner) return;
      try {
        const rows = getNarrativeStore(this.owner, this.scope).list().filter(r => safeForRecall(r) && (this.memorial || r.mode === 'current'));
        const result = queryRecords(rows, { namespace: this.scope.namespace, petId: this.owner, limit: 1000 });
        this.records = result.rows; this.total = result.total;
        if (!this.memorial) this.loadPhoto();
      } catch (_) { this.loadError = true; }
    },
    async loadPhoto() {
      this.clearPhoto();
      if (!this.current() || this.memorial && !this.opened) return;
      const asset = lifePhotos(this.record || {})[0], epoch = this.epoch, id = this.record?.id;
      if (!asset) return;
      try {
        const result = await resolveNarrativePhoto(asset, this.scope, this.owner);
        if (this.current() && epoch === this.epoch && id === this.record?.id) this.photo = result.path;
        else releaseNarrativePhoto(result.path);
      } catch (_) { if (this.current() && epoch === this.epoch) this.photoError = true; }
    },
    photoFailed() { this.clearPhoto(); this.photoError = true; },
    openMemory() { if (!this.current()) return; if (!this.records.length) { this.$emit('album'); return; } this.opened = true; this.loadPhoto(); },
    closeMemory() { this.opened = false; this.clearPhoto(); },
    turn(step) { if (!this.current()) return; this.index = Math.max(0, Math.min(this.records.length - 1, this.index + step)); this.loadPhoto(); },
    openRecord() {
      if (!this.current() || !this.record) return;
      const row = getNarrativeStore(this.owner, this.scope).list().find(r => r.id === this.record.id);
      if (!row || !safeForRecall(row)) { this.load(); return; }
      const pet = '&petId=' + encodeURIComponent(this.owner);
      const url = row.legacy ? '/pages/calendar/calendar?date=' + encodeURIComponent(row.localDate) + pet
        : row.dailyVersion === 2 ? '/pages/calendar/calendar?recordId=' + encodeURIComponent(row.id) + pet
        : '/pages/narrative/narrative?id=' + encodeURIComponent(row.id) + pet;
      uni.navigateTo({ url });
    }
  }
};
</script>

<style scoped>
.home-life-preview{margin-top:12px;color:var(--ui-ink)}
button{margin:0;padding:0;background:transparent;color:inherit;text-align:left;font:inherit;line-height:1.6}button:after{border:0}
.preview-meta,.preview-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:12px;line-height:20px;color:var(--ui-muted)}
.preview-meta{margin-bottom:14px}.life-preview-record{display:flex;width:100%;gap:16px;align-items:center;min-height:80px}.preview-copy{flex:1;min-width:0}.preview-title{display:block;font-size:19px;line-height:28px;font-weight:500;overflow-wrap:anywhere}.preview-excerpt{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden;white-space:pre-wrap;overflow-wrap:anywhere;font-size:16px;line-height:27px}.life-preview-photo{width:96px;height:112px;flex-shrink:0;border-radius:12px;background:var(--ui-group)}.preview-origin{display:block;margin-top:10px;font-size:12px;color:var(--ui-muted)}.preview-footer{margin-top:18px;padding-top:10px;border-top:1px solid var(--ui-line)}.preview-footer button,.life-preview-empty button{min-height:44px;display:flex;align-items:center;gap:6px}.preview-caption{display:block;font-size:14px;line-height:24px;color:var(--ui-muted);margin-top:8px}.life-preview-empty{padding:10px 0}.life-preview-empty button{font-size:14px;margin-top:12px}.memory-book{display:flex;gap:20px;padding:24px 20px;border:1px solid var(--ui-line);border-radius:4px 20px 20px 4px;background:linear-gradient(120deg,#34352b,#292b23);box-shadow:inset 6px 0 0 rgba(188,196,174,.08)}.book-spine{width:42px;display:flex;align-items:center;justify-content:center;flex-shrink:0}.memory-book-copy{min-width:0;flex:1}.memory-open{min-height:44px;margin-top:16px;font-size:15px;display:flex;align-items:center;gap:8px}.memory-preview .preview-excerpt{-webkit-line-clamp:5;font-size:17px;line-height:30px}.memory-page-controls{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:16px;color:var(--ui-muted);font-size:12px}.memory-page-controls button{min-height:44px;font-size:13px}.memory-page-controls button[disabled]{opacity:.35;background:none;color:inherit}.memory-page-controls button:last-child{margin-left:auto}
/* A quiet book surface, shared by the empty and saved life states. */
.home-life-preview{margin-top:8px}
.companion-book{display:flex;align-items:flex-start;gap:16px;padding:24px 20px;border:1px solid rgba(221,228,202,.1);border-radius:4px 20px 20px 4px;background:linear-gradient(120deg,#34342a,#2b2c23);box-shadow:inset 4px 0 0 rgba(188,196,174,.12)}
.empty-book-mark{display:flex;align-items:center;justify-content:center;flex:0 0 40px;height:48px;border:1px solid rgba(221,228,202,.14);border-radius:3px 10px 10px 3px;color:#c7c6ad;margin-top:3px}
.empty-book-copy{flex:1;min-width:0}.companion-book .preview-title{font-size:calc(18px * var(--ui-font-scale,1));line-height:1.6;letter-spacing:1px}.companion-book .preview-caption{font-size:calc(13px * var(--ui-font-scale,1));line-height:1.85;margin-top:8px}.companion-book button{font-size:calc(13px * var(--ui-font-scale,1));color:#d2d8c4;margin-top:14px;gap:8px}
.life-preview-record{box-sizing:border-box;padding:18px;border:1px solid rgba(221,228,202,.08);border-radius:18px;background:linear-gradient(120deg,#303027,#2b2b23)}.preview-footer{border-top:0;padding-top:0;margin-top:8px}.preview-excerpt{font-size:calc(15px * var(--ui-font-scale,1));line-height:1.8}
</style>
