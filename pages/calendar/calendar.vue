<template>
  <view :class="['calendar-page', themeClass, reduceMotion ? 'reduce-motion' : '']">
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
        <button class="month-title-button" hover-class="month-title-button-hover" @click="openMonthPicker">
          <text class="month-title">{{ monthTitle }}</text>
          <text class="month-title-hint">选择年月</text>
        </button>
        <button class="month-arrow" hover-class="month-arrow-hover" @click="changeMonth(1)">
          <uni-icons type="right" size="18" color="#6B5D4D"></uni-icons>
        </button>
      </view>

      <view class="week-row">
        <text v-for="weekday in weekDays" :key="weekday" class="week-label">{{ weekday }}</text>
      </view>

      <view :class="['date-grid', monthTransitionClass]">
        <view
          v-for="item in calendarDays"
          :key="item.key"
          :class="[
            'date-cell',
            item.isCurrentMonth ? '' : 'date-cell-muted',
            item.isToday ? 'date-cell-today' : '',
            item.dateKey === selectedDateKey ? 'date-cell-active' : ''
          ]"
          @click="selectDate(item)"
        >
          <text class="date-number">{{ item.monthDayLabel }}</text>
          <text class="date-lunar">{{ item.lunarShortLabel }}</text>
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
        <text class="note-help">{{ noteHelpText }}</text>
      </view>

      <button class="save-btn" hover-class="save-btn-hover" @click="saveRecord">
        <text>{{ recordCopy.recordPrimaryActionText }}</text>
      </button>
    </view>

    <view v-if="showMonthPicker" class="picker-mask" @click="closeMonthPicker">
      <view class="picker-sheet" @click.stop>
        <view class="picker-head">
          <button class="picker-action" hover-class="picker-action-hover" @click="closeMonthPicker">取消</button>
          <text class="picker-title">选择年月</text>
          <button class="picker-action picker-action-strong" hover-class="picker-action-hover" @click="confirmMonthPicker">跳转</button>
        </view>
        <picker-view class="month-picker" :value="pickerValue" indicator-style="height: 48px;" @change="handlePickerChange">
          <picker-view-column>
            <view v-for="year in supportedYears" :key="year" class="picker-item">{{ year }} 年</view>
          </picker-view-column>
          <picker-view-column>
            <view v-for="month in supportedMonths" :key="month" class="picker-item">{{ month }} 月</view>
          </picker-view-column>
        </picker-view>
        <button class="picker-today" hover-class="picker-today-hover" @click="pickerGoToday">回到今天</button>
      </view>
    </view>
  </view>
</template>

<script>
import { getActivePet } from '../../common/pet-store.js';
import {
  formatDateKey,
  getDiaryMap,
  getDiaryRecord,
  getEventLabel,
  getMoodColor,
  getMoodLabel,
  hasDiaryRecord,
  saveDiaryRecord
} from '../../common/diary-store.js';
import {
  formatLocalCalendarSummary,
  getLocalCalendarDate,
  getLocalMonthGridDates,
  LUNAR_SUPPORTED_SOLAR_YEAR_MAX,
  LUNAR_SUPPORTED_SOLAR_YEAR_MIN
} from '../../common/lunar-calendar.js';
import { isReduceMotionEnabled, successHaptic } from '../../common/haptics.js';
import {
  getPetRelationshipStage,
  getRelationshipConfig,
  getRelationshipRecordCopy,
  getRelationshipRecordTypeLabel,
  getRelationshipRecordTypes,
  getRelationshipThemeClass
} from '../../common/relationship-config.js';

function parseLocalDateKey(dateKey) {
  const parts = String(dateKey || '').split('-').map(Number);
  if (parts.length !== 3 || parts.some(part => !Number.isFinite(part))) return new Date();
  return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0);
}

export default {
  data() {
    return {
      activePet: null,
      activePetId: null,
      currentMonthDate: new Date(),
      selectedDateKey: formatDateKey(),
      diaryMap: {},
      showMonthPicker: false,
      pickerValue: [new Date().getFullYear() - LUNAR_SUPPORTED_SOLAR_YEAR_MIN, new Date().getMonth()],
      supportedYears: Array.from(
        { length: LUNAR_SUPPORTED_SOLAR_YEAR_MAX - LUNAR_SUPPORTED_SOLAR_YEAR_MIN + 1 },
        (_, index) => LUNAR_SUPPORTED_SOLAR_YEAR_MIN + index
      ),
      supportedMonths: Array.from({ length: 12 }, (_, index) => index + 1),
      monthTransitionClass: '',
      monthTransitionLocked: false,
      monthTransitionTimer: null,
      reduceMotion: isReduceMotionEnabled(),
      weekDays: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
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
    themeClass() {
      return getRelationshipThemeClass(this.relationshipStage);
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
      return `${this.currentMonthDate.getFullYear()} 年 ${this.currentMonthDate.getMonth() + 1} 月`;
    },
    selectedDateLabel() {
      const parts = this.selectedDateKey.split('-').map(Number);
      if (parts.length !== 3) return this.selectedDateKey;
      return formatLocalCalendarSummary(parts[0], parts[1], parts[2]) || this.selectedDateKey;
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
    noteHelpText() {
      if (this.relationshipStage === 'deceased') {
        return '这些文字会慢慢组成你们的故事，方便以后整理回忆、写信，或回看那些真实拥有过的陪伴。';
      }
      return '你写下的小事，归爪会认真记住。之后整理照护记录、准备问诊或回看变化时，这些文字都会成为重要线索。';
    },
    calendarDays() {
      const displayYear = this.currentMonthDate.getFullYear();
      const displayMonth = this.currentMonthDate.getMonth() + 1;
      const todayKey = formatDateKey();
      return getLocalMonthGridDates(displayYear, displayMonth).map((date, index) => {
        const dateKey = formatDateKey(date);
        const calendarDate = getLocalCalendarDate(date);
        return {
          key: `${dateKey}_${index}`,
          dateKey,
          day: date.getDate(),
          year: calendarDate.year,
          month: calendarDate.month,
          weekdayShortLabel: calendarDate.weekdayShortLabel,
          monthDayLabel: calendarDate.monthDayLabel,
          lunarShortLabel: calendarDate.lunar ? calendarDate.lunar.shortLabel : '',
          isCurrentMonth: calendarDate.year === displayYear && calendarDate.month === displayMonth,
          isToday: dateKey === todayKey,
          hasRecord: this.hasRecord(dateKey),
          moodColor: this.moodColor(this.diaryMap[dateKey] && this.diaryMap[dateKey].mood)
        };
      });
    }
  },
  onLoad(options = {}) {
    const requestedDate = options.selectedDate || options.date;
    if (requestedDate) {
      const routeDate = parseLocalDateKey(requestedDate);
      this.selectedDateKey = formatDateKey(routeDate);
      this.currentMonthDate = new Date(routeDate.getFullYear(), routeDate.getMonth(), 1, 12, 0, 0, 0);
    }
  },
  onShow() {
    this.loadCalendar();
  },
  onHide() {
    this.clearMonthTransition();
  },
  onUnload() {
    this.clearMonthTransition();
  },
  methods: {
    loadCalendar() {
      const activePet = getActivePet();
      this.activePet = activePet;
      this.activePetId = activePet ? activePet.id : null;
      this.diaryMap = this.activePetId ? getDiaryMap(this.activePetId) : {};
      this.reduceMotion = isReduceMotionEnabled();
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
      if (!item.isCurrentMonth) {
        this.currentMonthDate = new Date(item.year, item.month - 1, 1, 12, 0, 0, 0);
      }
      this.loadSelectedRecord();
    },
    changeMonth(step) {
      if (this.monthTransitionLocked) return;
      this.monthTransitionLocked = true;
      const next = new Date(
        this.currentMonthDate.getFullYear(),
        this.currentMonthDate.getMonth() + step,
        1,
        12,
        0,
        0,
        0
      );
      if (
        next.getFullYear() < LUNAR_SUPPORTED_SOLAR_YEAR_MIN ||
        next.getFullYear() > LUNAR_SUPPORTED_SOLAR_YEAR_MAX
      ) {
        this.monthTransitionLocked = false;
        uni.showToast({ title: `可查看 ${LUNAR_SUPPORTED_SOLAR_YEAR_MIN}-${LUNAR_SUPPORTED_SOLAR_YEAR_MAX} 年`, icon: 'none' });
        return;
      }
      this.monthTransitionClass = this.reduceMotion ? '' : (step > 0 ? 'month-slide-left' : 'month-slide-right');
      this.currentMonthDate = next;
      if (this.monthTransitionTimer) clearTimeout(this.monthTransitionTimer);
      this.monthTransitionTimer = setTimeout(() => {
        this.monthTransitionTimer = null;
        this.monthTransitionClass = '';
        this.monthTransitionLocked = false;
      }, this.reduceMotion ? 80 : 240);
    },
    goToday() {
      const today = new Date();
      this.currentMonthDate = new Date(today.getFullYear(), today.getMonth(), 1, 12, 0, 0, 0);
      this.selectedDateKey = formatDateKey(today);
      this.loadSelectedRecord();
    },
    openMonthPicker() {
      this.pickerValue = [
        Math.max(0, Math.min(
          this.supportedYears.length - 1,
          this.currentMonthDate.getFullYear() - LUNAR_SUPPORTED_SOLAR_YEAR_MIN
        )),
        this.currentMonthDate.getMonth()
      ];
      this.showMonthPicker = true;
    },
    closeMonthPicker() {
      this.showMonthPicker = false;
    },
    handlePickerChange(event) {
      this.pickerValue = event.detail.value;
    },
    confirmMonthPicker() {
      const year = this.supportedYears[this.pickerValue[0]];
      const month = this.supportedMonths[this.pickerValue[1]];
      if (!year || !month) return;
      this.currentMonthDate = new Date(year, month - 1, 1, 12, 0, 0, 0);
      this.selectedDateKey = formatDateKey(this.currentMonthDate);
      this.loadSelectedRecord();
      this.showMonthPicker = false;
      successHaptic();
    },
    pickerGoToday() {
      this.showMonthPicker = false;
      this.goToday();
      successHaptic();
    },
    clearMonthTransition() {
      if (this.monthTransitionTimer) {
        clearTimeout(this.monthTransitionTimer);
        this.monthTransitionTimer = null;
      }
      this.monthTransitionClass = '';
      this.monthTransitionLocked = false;
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
      successHaptic();
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

.date-grid {
  flex-wrap: nowrap;
  margin-top: 8rpx;
}

.week-row {
  margin-top: 22rpx;
}

.week-label {
  width: 14.285%;
  color: #9A9082;
  font-size: 18rpx;
  line-height: 1.25;
  text-align: center;
}

.date-cell {
  width: 14.285%;
  height: 94rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  border-radius: 14rpx;
  box-sizing: border-box;
}

.date-number {
  color: #302A23;
  font-size: 22rpx;
  line-height: 1.25;
  text-align: center;
}

.date-lunar {
  color: #9A9082;
  font-size: 17rpx;
  line-height: 1.25;
  text-align: center;
}

.date-number {
  margin-bottom: 7rpx;
}

.date-cell-today {
  border: 1rpx solid rgba(109, 89, 69, 0.42);
}

.date-cell-active {
  background: rgba(109, 89, 69, 0.14);
}

.date-cell-active .date-number,
.date-cell-active .date-lunar {
  color: #302A23;
}

.record-dot {
  position: absolute;
  bottom: 4rpx;
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
  padding: 13rpx 18rpx;
  font-size: 22rpx;
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

.note-help {
  display: block;
  margin-top: 14rpx;
  color: var(--ui-muted, #8F877A);
  font-size: 21rpx;
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

.calendar-page {
  --ui-card: var(--pety-surface, #FCFAF6);
  --ui-border: var(--pety-rule, #E4DED4);
  --ui-text: var(--pety-text, #2F2A24);
  --ui-muted: var(--pety-text-secondary, #786F64);
  --ui-accent: var(--pety-primary, #6D5945);
  --ui-soft: var(--pety-primary-soft, #EAE1D6);
  background: var(--pety-page-bg, #F5F2EC);
  animation: calendarFadeUp 360ms ease both;
}

.calendar-page.theme-memorial {
  --ui-card: var(--pety-surface, #FAF9FB);
  --ui-border: var(--pety-rule, #DDDDE3);
  --ui-text: var(--pety-text, #2D2E35);
  --ui-muted: var(--pety-text-secondary, #737580);
  --ui-accent: var(--pety-primary, #62677A);
  --ui-soft: var(--pety-primary-soft, #E2E3EA);
}

.icon-button,
.pet-strip,
.empty-panel,
.month-card,
.record-card,
.note-input {
  border-color: var(--ui-border);
  background: var(--ui-card);
  box-shadow: 0 16rpx 42rpx rgba(72, 58, 43, 0.055);
}

.pet-strip,
.empty-panel,
.month-card,
.record-card {
  border-radius: 30rpx;
}

.title-kicker,
.record-kicker,
.field-title {
  color: var(--ui-accent);
}

.pet-desc,
.empty-desc,
.legend-text {
  color: var(--ui-muted);
}

.month-arrow,
.mood-chip,
.event-chip,
.record-state {
  background: rgba(255, 255, 255, 0.42);
  border-color: var(--ui-border);
}

.date-number {
  transition: transform 140ms ease, background 140ms ease;
}

.date-cell-active,
.mood-chip-active,
.event-chip-active,
.save-btn {
  border-color: transparent;
}

.mood-chip-active,
.event-chip-active,
.save-btn {
  background: var(--ui-accent);
}

.date-cell-active {
  background: var(--ui-soft);
}

.date-cell-active .date-number,
.date-cell-active .date-lunar {
  color: var(--ui-text);
}

.calendar-page.theme-memorial .date-cell-active {
  background: var(--ui-soft);
}

.calendar-page.theme-memorial .date-cell-today {
  border-color: rgba(95, 100, 120, 0.44);
}

.icon-button,
.month-arrow,
.date-cell,
.mood-chip,
.event-chip,
.save-btn {
  transition: transform 160ms ease, opacity 160ms ease;
}

.icon-button-hover,
.month-arrow-hover {
  transform: scale(0.94);
  opacity: 0.82;
}

.save-btn-hover {
  transform: scale(0.98);
  opacity: 0.88;
}

.date-cell:active,
.mood-chip:active,
.event-chip:active {
  transform: scale(0.985);
  opacity: 0.88;
}

@keyframes calendarFadeUp {
  from {
    opacity: 0;
    transform: translateY(16rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.month-title-button {
  min-width: 210rpx;
  padding: 4rpx 18rpx;
  margin: 0;
  background: transparent;
  text-align: center;
}

.month-title-button::after,
.picker-action::after,
.picker-today::after {
  border: none;
}

.month-title,
.month-title-hint {
  display: block;
}

.month-title-hint {
  margin-top: 4rpx;
  color: var(--ui-muted);
  font-size: 18rpx;
}

.month-title-button-hover {
  opacity: 0.72;
}

.date-grid {
  flex-wrap: wrap;
  transition: opacity 220ms ease, transform 220ms ease;
}

.date-cell {
  height: 100rpx;
}

.date-cell-muted {
  opacity: 0.42;
}

.month-slide-left {
  animation: monthSlideLeft 230ms ease both;
}

.month-slide-right {
  animation: monthSlideRight 230ms ease both;
}

.picker-mask {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: flex-end;
  background: rgba(37, 34, 31, 0.34);
  animation: pickerMaskIn 220ms ease both;
}

.picker-sheet {
  width: 100%;
  padding: 24rpx 28rpx calc(30rpx + env(safe-area-inset-bottom));
  border-radius: 32rpx 32rpx 0 0;
  background: var(--ui-card);
  box-sizing: border-box;
  animation: pickerSheetIn 260ms ease both;
}

.picker-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.picker-title {
  color: var(--ui-text);
  font-size: 30rpx;
  font-weight: 600;
}

.picker-action {
  min-width: 96rpx;
  height: 72rpx;
  padding: 0 12rpx;
  margin: 0;
  background: transparent;
  color: var(--ui-muted);
  font-size: 25rpx;
  line-height: 72rpx;
}

.picker-action-strong {
  color: var(--ui-accent);
  font-weight: 600;
}

.picker-action-hover,
.picker-today-hover {
  opacity: 0.68;
}

.month-picker {
  width: 100%;
  height: 360rpx;
  margin-top: 8rpx;
}

.picker-item {
  height: 96rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ui-text);
  font-size: 30rpx;
}

.picker-today {
  width: 100%;
  height: 80rpx;
  margin: 4rpx 0 0;
  border-radius: 18rpx;
  background: var(--ui-soft);
  color: var(--ui-accent);
  font-size: 26rpx;
  line-height: 80rpx;
}

@keyframes monthSlideLeft {
  from { opacity: 0.35; transform: translateX(16rpx); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes monthSlideRight {
  from { opacity: 0.35; transform: translateX(-16rpx); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes pickerMaskIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes pickerSheetIn {
  from { opacity: 0; transform: translateY(24rpx); }
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .calendar-page,
  .month-slide-left,
  .month-slide-right,
  .picker-mask,
  .picker-sheet {
    animation: none;
  }
}

.reduce-motion.calendar-page,
.reduce-motion .month-slide-left,
.reduce-motion .month-slide-right,
.reduce-motion .picker-mask,
.reduce-motion .picker-sheet {
  animation: none;
}
</style>
