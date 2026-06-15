<template>
  <view class="calendar-page">
    <view class="top-bar">
      <button class="icon-button" hover-class="icon-button-hover" @click="goBack">
        <uni-icons type="left" size="22" color="#302A23"></uni-icons>
      </button>
      <view class="title-copy">
        <text class="title-kicker">{{ relationshipConfig.stageName }}</text>
        <text class="title-main">{{ recordCopy.recordPageTitle }}</text>
      </view>
      <button class="icon-button" hover-class="icon-button-hover" @click="goToday">
        <uni-icons type="calendar" size="21" color="#302A23"></uni-icons>
      </button>
    </view>

    <view v-if="activePet" class="pet-strip">
      <image :src="activePet.photo || activePet.avatar" class="pet-photo" mode="aspectFill"></image>
      <view class="pet-copy">
        <text class="pet-name">{{ activePet.name }}</text>
        <text class="pet-desc">{{ recordCopy.recordPageSubtitle }}</text>
      </view>
    </view>

    <view v-else class="empty-panel">
      <text class="empty-title">还没有宝贝</text>
      <text class="empty-desc">先在欢迎页添加名字和照片，再回来记录日常。</text>
    </view>

    <view v-if="activePet" class="month-card">
      <view class="month-head">
        <button class="month-arrow" hover-class="month-arrow-hover" @click="changeMonth(-1)">
          <uni-icons type="left" size="18" color="#6B5D4D"></uni-icons>
        </button>
        <text class="month-title">{{ monthTitle }}</text>
        <button class="month-arrow" hover-class="month-arrow-hover" @click="changeMonth(1)">
          <uni-icons type="right" size="18" color="#6B5D4D"></uni-icons>
        </button>
      </view>

      <view class="week-row">
        <text v-for="day in weekDays" :key="day" class="week-label">{{ day }}</text>
      </view>

      <view class="date-grid">
        <view
          v-for="item in calendarDays"
          :key="item.key"
          :class="['date-cell', item.inMonth ? '' : 'date-cell-muted', item.dateKey === selectedDateKey ? 'date-cell-active' : '']"
          @click="selectDate(item)"
        >
          <text class="date-number">{{ item.day }}</text>
          <view v-if="item.hasRecord" class="record-dot" :style="{ background: item.moodColor }"></view>
        </view>
      </view>

      <view class="legend-row">
        <view v-for="mood in moodOptions" :key="mood.key" class="legend-item">
          <view class="legend-dot" :style="{ background: moodColor(mood.key) }"></view>
          <text class="legend-text">{{ mood.label }}</text>
        </view>
      </view>
    </view>

    <view v-if="activePet" class="record-card">
      <view class="record-head">
        <view>
          <text class="record-kicker">{{ selectedDateLabel }}</text>
          <text class="record-title">{{ recordTitle }}</text>
        </view>
        <text class="record-state" :style="{ color: moodColor(form.mood), background: moodSoftColor(form.mood) }">{{ currentMoodLabel }}</text>
      </view>

      <view class="mood-row">
        <view
          v-for="mood in moodOptions"
          :key="mood.key"
          :class="['mood-chip', form.mood === mood.key ? 'mood-chip-active' : '']"
          :style="form.mood === mood.key ? { background: moodColor(mood.key), borderColor: moodColor(mood.key) } : {}"
          @click="form.mood = mood.key"
        >
          <text>{{ mood.label }}</text>
        </view>
      </view>

      <view class="event-section">
        <text class="field-title">{{ recordCopy.recordTypeLabel }}</text>
        <view class="event-grid">
          <view
            v-for="event in eventOptions"
            :key="event.key"
            :class="['event-chip', isEventSelected(event.key) ? 'event-chip-active' : '']"
            @click="toggleEvent(event.key)"
          >
            <text>{{ event.label }}</text>
          </view>
        </view>
      </view>

      <view class="note-section">
        <text class="field-title">手写记录</text>
        <textarea
          class="note-input"
          v-model="form.note"
          :placeholder="recordCopy.recordEmptyText"
          placeholder-style="color:#AAA195"
          maxlength="500"
          :show-confirm-bar="false"
        ></textarea>
      </view>

      <button class="save-btn" hover-class="save-btn-hover" @click="saveRecord">
        <text>{{ recordCopy.recordPrimaryActionText }}</text>
      </button>
    </view>
  </view>
</template>

<script>
import { getActivePet } from '../../common/pet-store.js';
import {
  formatDateKey,
  getDiaryMap,
  getDiaryRecord,
  getMoodColor,
  getMoodLabel,
  hasDiaryRecord,
  saveDiaryRecord
} from '../../common/diary-store.js';
import {
  getPetRelationshipStage,
  getRelationshipConfig,
  getRelationshipRecordCopy,
  getRelationshipRecordTypeLabel,
  getRelationshipRecordTypes
} from '../../common/relationship-config.js';

export default {
  data() {
    return {
      activePet: null,
      activePetId: null,
      currentMonth: new Date(),
      selectedDateKey: formatDateKey(),
      diaryMap: {},
      weekDays: ['一', '二', '三', '四', '五', '六', '日'],
      moodOptions: [
        { key: 'good', label: '轻松' },
        { key: 'calm', label: '平稳' },
        { key: 'tired', label: '疲惫' },
        { key: 'uneasy', label: '不安' },
        { key: 'sick', label: '不适' }
      ],
      form: {
        type: '',
        mood: 'calm',
        events: [],
        note: ''
      }
    };
  },
  computed: {
    relationshipStage() {
      return getPetRelationshipStage(this.activePet);
    },
    relationshipConfig() {
      return getRelationshipConfig(this.relationshipStage);
    },
    recordCopy() {
      return getRelationshipRecordCopy(this.relationshipStage);
    },
    eventOptions() {
      const options = getRelationshipRecordTypes(this.relationshipStage);
      const knownKeys = options.map(item => item.key);
      const selectedKeys = [this.form.type].concat(this.form.events || []).filter(Boolean);
      const legacyOptions = selectedKeys
        .filter(key => !knownKeys.includes(key))
        .filter((key, index, list) => list.indexOf(key) === index)
        .map(key => ({
          key,
          label: this.getRecordTypeLabel(key)
        }));
      return options.concat(legacyOptions);
    },
    monthTitle() {
      return `${this.currentMonth.getFullYear()} 年 ${this.currentMonth.getMonth() + 1} 月`;
    },
    selectedDateLabel() {
      const parts = this.selectedDateKey.split('-');
      if (parts.length !== 3) return this.selectedDateKey;
      return `${parts[1]}月${parts[2]}日`;
    },
    currentMoodLabel() {
      return getMoodLabel(this.form.mood);
    },
    selectedHasRecord() {
      return hasDiaryRecord(this.diaryMap[this.selectedDateKey]);
    },
    recordTitle() {
      return this.selectedHasRecord ? this.recordCopy.recordPrimaryActionText : this.recordCopy.recordEmptyTitle;
    },
    calendarDays() {
      const year = this.currentMonth.getFullYear();
      const month = this.currentMonth.getMonth();
      const firstDate = new Date(year, month, 1);
      const startOffset = (firstDate.getDay() + 6) % 7;
      const startDate = new Date(year, month, 1 - startOffset);
      const days = [];

      for (let index = 0; index < 42; index += 1) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + index);
        const dateKey = formatDateKey(date);

        days.push({
          key: `${dateKey}_${index}`,
          dateKey,
          day: date.getDate(),
          inMonth: date.getMonth() === month,
          hasRecord: this.hasRecord(dateKey),
          moodColor: this.moodColor(this.diaryMap[dateKey] && this.diaryMap[dateKey].mood)
        });
      }

      return days;
    }
  },
  onShow() {
    this.loadCalendar();
  },
  methods: {
    loadCalendar() {
      const activePet = getActivePet();
      this.activePet = activePet;
      this.activePetId = activePet ? activePet.id : null;
      this.diaryMap = this.activePetId ? getDiaryMap(this.activePetId) : {};
      this.loadSelectedRecord();
    },
    loadSelectedRecord() {
      if (!this.activePetId) return;
      const record = getDiaryRecord(this.activePetId, this.selectedDateKey);
      this.form = {
        type: record.type,
        mood: record.mood,
        events: record.events.slice(),
        note: record.note
      };
    },
    hasRecord(dateKey) {
      const record = this.diaryMap[dateKey];
      return hasDiaryRecord(record);
    },
    moodColor(mood) {
      return getMoodColor(mood);
    },
    moodSoftColor(mood) {
      return `${getMoodColor(mood)}18`;
    },
    getRecordTypeLabel(type) {
      const label = getRelationshipRecordTypeLabel(this.relationshipStage, type);
      return label === '记录' ? getEventLabel(type) : label;
    },
    selectDate(item) {
      this.selectedDateKey = item.dateKey;
      this.loadSelectedRecord();
    },
    changeMonth(step) {
      this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + step, 1);
    },
    goToday() {
      const today = new Date();
      this.currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      this.selectedDateKey = formatDateKey(today);
      this.loadSelectedRecord();
    },
    isEventSelected(key) {
      return this.form.type === key || this.form.events.includes(key);
    },
    toggleEvent(key) {
      if (this.isEventSelected(key)) {
        this.form.events = this.form.events.filter(item => item !== key);
        return;
      }

      this.form.events = this.form.events.concat(key);
    },
    saveRecord() {
      if (!this.activePetId) {
        uni.showToast({ title: '请先添加宝贝', icon: 'none' });
        return;
      }

      saveDiaryRecord(this.activePetId, this.selectedDateKey, this.form);
      this.diaryMap = getDiaryMap(this.activePetId);
      uni.showToast({ title: '已保存', icon: 'success' });
    },
    goBack() {
      const pages = getCurrentPages();
      if (pages.length > 1) {
        uni.navigateBack();
        return;
      }
      uni.switchTab({ url: '/pages/home/home' });
    }
  }
}
</script>

<style scoped>
.calendar-page {
  min-height: 100vh;
  padding: 78rpx 30rpx calc(42rpx + env(safe-area-inset-bottom));
  background: #F4F1EA;
  color: #302A23;
}

.top-bar,
.pet-strip,
.month-head,
.week-row,
.date-grid,
.record-head,
.mood-row,
.event-grid {
  display: flex;
}

.top-bar {
  align-items: center;
  justify-content: space-between;
}

.icon-button,
.month-arrow {
  padding: 0;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-button {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: #FFFFFF;
  box-shadow: 0 12rpx 30rpx rgba(58, 51, 43, 0.06);
}

.icon-button::after,
.month-arrow::after,
.save-btn::after {
  border: none;
}

.icon-button-hover,
.month-arrow-hover,
.save-btn-hover {
  opacity: 0.78;
}

.title-copy {
  text-align: center;
}

.title-kicker {
  display: block;
  color: #8C7557;
  font-size: 20rpx;
  line-height: 1.3;
}

.title-main {
  display: block;
  margin-top: 6rpx;
  color: #302A23;
  font-size: 38rpx;
  font-weight: 600;
  line-height: 1.15;
}

.pet-strip,
.empty-panel,
.month-card,
.record-card {
  margin-top: 28rpx;
  border-radius: 16rpx;
  background: #FFFFFF;
  border: 1rpx solid #EEE6DA;
  box-shadow: 0 14rpx 34rpx rgba(58, 51, 43, 0.05);
}

.pet-strip {
  align-items: center;
  padding: 22rpx;
}

.pet-photo {
  width: 86rpx;
  height: 86rpx;
  border-radius: 50%;
  flex-shrink: 0;
}

.pet-copy {
  margin-left: 20rpx;
}

.pet-name {
  display: block;
  color: #302A23;
  font-size: 30rpx;
  font-weight: 600;
  line-height: 1.25;
}

.pet-desc,
.empty-desc {
  display: block;
  margin-top: 8rpx;
  color: #8F877A;
  font-size: 23rpx;
  line-height: 1.45;
}

.empty-panel {
  padding: 34rpx;
}

.empty-title {
  display: block;
  color: #302A23;
  font-size: 32rpx;
  font-weight: 600;
}

.month-card {
  padding: 24rpx;
}

.month-head {
  align-items: center;
  justify-content: space-between;
}

.month-title {
  color: #302A23;
  font-size: 31rpx;
  font-weight: 600;
  line-height: 1.25;
}

.month-arrow {
  width: 58rpx;
  height: 58rpx;
  border-radius: 50%;
  background: #F1ECE3;
}

.week-row {
  margin-top: 24rpx;
}

.week-label {
  flex: 1;
  text-align: center;
  color: #9A9082;
  font-size: 21rpx;
  line-height: 1.4;
}

.date-grid {
  flex-wrap: wrap;
  margin-top: 12rpx;
}

.date-cell {
  width: 14.285%;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.date-number {
  width: 52rpx;
  height: 52rpx;
  border-radius: 50%;
  color: #302A23;
  font-size: 25rpx;
  line-height: 52rpx;
  text-align: center;
}

.date-cell-muted .date-number {
  color: #C1B8AC;
}

.date-cell-active .date-number {
  background: #302A23;
  color: #FBFAF6;
}

.record-dot {
  position: absolute;
  bottom: 5rpx;
  left: 50%;
  width: 9rpx;
  height: 9rpx;
  margin-left: -4.5rpx;
  border-radius: 50%;
  box-shadow: 0 0 0 4rpx rgba(255, 255, 255, 0.8);
}

.legend-row {
  margin-top: 18rpx;
  padding-top: 18rpx;
  border-top: 1rpx solid #F0E8DD;
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx 18rpx;
}

.legend-item {
  display: flex;
  align-items: center;
}

.legend-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  margin-right: 8rpx;
}

.legend-text {
  color: #8F877A;
  font-size: 21rpx;
  line-height: 1.2;
}

.record-card {
  padding: 28rpx;
}

.record-head {
  align-items: flex-start;
  justify-content: space-between;
}

.record-kicker {
  display: block;
  color: #8C7557;
  font-size: 20rpx;
  line-height: 1.3;
}

.record-title {
  display: block;
  margin-top: 8rpx;
  color: #302A23;
  font-size: 32rpx;
  font-weight: 600;
  line-height: 1.2;
}

.record-state {
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  background: #F1ECE3;
  color: #6B5D4D;
  font-size: 22rpx;
  line-height: 1.2;
}

.mood-row {
  margin-top: 24rpx;
  gap: 12rpx;
  flex-wrap: wrap;
}

.mood-chip,
.event-chip {
  border-radius: 999rpx;
  background: #F7F3EA;
  border: 1rpx solid #EEE6DA;
  color: #6B5D4D;
  font-size: 24rpx;
  line-height: 1.2;
}

.mood-chip {
  padding: 16rpx 22rpx;
}

.mood-chip-active,
.event-chip-active {
  background: #302A23;
  border-color: #302A23;
  color: #FBFAF6;
}

.event-section,
.note-section {
  margin-top: 30rpx;
}

.field-title {
  display: block;
  color: #302A23;
  font-size: 28rpx;
  font-weight: 600;
  line-height: 1.25;
}

.event-grid {
  margin-top: 18rpx;
  flex-wrap: wrap;
  gap: 14rpx;
}

.event-chip {
  padding: 15rpx 20rpx;
}

.note-input {
  margin-top: 18rpx;
  width: 100%;
  min-height: 178rpx;
  padding: 22rpx;
  border-radius: 16rpx;
  background: #FBFAF6;
  border: 1rpx solid #EEE6DA;
  color: #302A23;
  font-size: 27rpx;
  line-height: 1.55;
}

.save-btn {
  margin-top: 28rpx;
  width: 100%;
  height: 88rpx;
  border-radius: 16rpx;
  background: #8C7557;
  color: #FBFAF6;
  font-size: 29rpx;
  font-weight: 600;
  line-height: 88rpx;
}
</style>
