<template>
  <view class="insights-page">
    <view class="top-bar">
      <button class="icon-button" hover-class="icon-button-hover" @click="goBack">
        <uni-icons type="left" size="22" color="#302A23"></uni-icons>
      </button>
      <view class="title-copy">
        <text class="title-kicker">{{ typeMeta.kicker }}</text>
        <text class="title-main">{{ typeMeta.title }}</text>
      </view>
      <view class="icon-placeholder"></view>
    </view>

    <view class="summary-card">
      <text class="summary-num">{{ entries.length }}</text>
      <text class="summary-text">{{ typeMeta.summary }}</text>
    </view>

    <scroll-view scroll-y class="entry-scroll">
      <view v-if="entries.length" class="entry-list">
        <view v-for="entry in entries" :key="entry.id" class="entry-card">
          <view class="entry-head">
            <view class="entry-dot" :style="{ background: entry.color }"></view>
            <text class="entry-date">{{ entry.date }}</text>
            <text class="entry-tag">{{ entry.tag }}</text>
          </view>
          <text class="entry-title">{{ entry.title }}</text>
          <text v-if="entry.desc" class="entry-desc">{{ entry.desc }}</text>
        </view>
      </view>

      <view v-else class="empty-card">
        <text class="empty-title">{{ typeMeta.emptyTitle }}</text>
        <text class="empty-desc">{{ typeMeta.emptyDesc }}</text>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import { getActivePet } from '../../common/pet-store.js';
import { getDiaryMap, getEventLabel, getMoodColor, getMoodLabel, hasDiaryRecord, normalizeDiaryRecord } from '../../common/diary-store.js';
import { getConsultationRecords } from '../../common/consultation-store.js';

export default {
  data() {
    return {
      type: 'memory',
      activePet: null,
      entries: []
    };
  },
  computed: {
    typeMeta() {
      const map = {
        memory: {
          kicker: 'MEMORIES',
          title: '回忆记录',
          summary: '条日历回忆',
          emptyTitle: '还没有回忆',
          emptyDesc: '去日历里写下某一天的状态或备注，这里就会慢慢长出来。'
        },
        events: {
          kicker: 'CHECK-INS',
          title: '打卡明细',
          summary: '条生活状态',
          emptyTitle: '还没有打卡',
          emptyDesc: '在日历里选择食欲、排便、呕吐、用药等状态后，这里会自动汇总。'
        },
        chat: {
          kicker: 'DIALOGUES',
          title: '问诊摘要',
          summary: '条问诊摘要',
          emptyTitle: '还没有问诊摘要',
          emptyDesc: '完成一次问诊后，这里会保存问题、回复摘录和当时参考的信息。'
        }
      };

      return map[this.type] || map.memory;
    }
  },
  onLoad(options = {}) {
    this.type = ['memory', 'events', 'chat'].includes(options.type) ? options.type : 'memory';
  },
  onShow() {
    this.activePet = getActivePet();
    this.entries = this.buildEntries();
  },
  methods: {
    buildEntries() {
      if (!this.activePet) return [];
      if (this.type === 'chat') return this.buildChatEntries();
      if (this.type === 'events') return this.buildEventEntries();
      return this.buildMemoryEntries();
    },
    buildMemoryEntries() {
      const diaryMap = getDiaryMap(this.activePet.id);
      return Object.keys(diaryMap)
        .sort()
        .reverse()
        .map(dateKey => {
          const record = normalizeDiaryRecord(diaryMap[dateKey]);
          if (!hasDiaryRecord(record)) return null;
          const eventText = record.events.map(getEventLabel).join('、');
          return {
            id: `memory_${dateKey}`,
            date: dateKey,
            tag: getMoodLabel(record.mood),
            title: record.note || eventText || '状态已记录',
            desc: record.note && eventText ? eventText : '',
            color: getMoodColor(record.mood)
          };
        })
        .filter(Boolean);
    },
    buildEventEntries() {
      const diaryMap = getDiaryMap(this.activePet.id);
      const entries = [];

      Object.keys(diaryMap).sort().reverse().forEach(dateKey => {
        const record = normalizeDiaryRecord(diaryMap[dateKey]);
        record.events.forEach((eventKey, index) => {
          entries.push({
            id: `event_${dateKey}_${eventKey}_${index}`,
            date: dateKey,
            tag: getMoodLabel(record.mood),
            title: getEventLabel(eventKey),
            desc: record.note,
            color: getMoodColor(record.mood)
          });
        });
      });

      return entries;
    },
    buildChatEntries() {
      const consultationRecords = getConsultationRecords(this.activePet.id);
      if (consultationRecords.length) {
        return consultationRecords.map(record => ({
          id: record.id,
          date: this.formatMessageTime(record.createdAt),
          tag: record.riskLevel === 'urgent' ? '需关注' : '问诊',
          title: record.question,
          desc: this.buildConsultationDesc(record),
          color: record.riskLevel === 'urgent' ? '#B95757' : '#8C7557'
        }));
      }

      const history = uni.getStorageSync('chat_history_' + this.activePet.id) || [];
      return history
        .filter(message => message.type === 'user')
        .slice()
        .reverse()
        .map((message, index) => ({
          id: `chat_${message.id || index}`,
          date: this.formatMessageTime(message.id),
          tag: '提问',
          title: message.content || '图片提问',
          desc: message.imageUrl ? '包含图片' : '',
          color: '#8C7557'
        }));
    },
    buildConsultationDesc(record) {
      const parts = [];
      if (record.contextLabels && record.contextLabels.length) {
        parts.push(`参考：${record.contextLabels.join('、')}`);
      }
      if (record.riskTerms && record.riskTerms.length) {
        parts.push(`风险提醒：${record.riskTerms.join('、')}`);
      }
      if (record.answerExcerpt) {
        parts.push(record.answerExcerpt);
      }
      return parts.join('\n');
    },
    formatMessageTime(value) {
      const timestamp = Number(value);
      if (!Number.isFinite(timestamp)) return '最近';
      const date = new Date(timestamp);
      if (Number.isNaN(date.getTime())) return '最近';
      const month = `${date.getMonth() + 1}`.padStart(2, '0');
      const day = `${date.getDate()}`.padStart(2, '0');
      return `${month}.${day}`;
    },
    goBack() {
      uni.navigateBack();
    }
  }
}
</script>

<style scoped>
.insights-page {
  min-height: 100vh;
  padding: 78rpx 30rpx calc(42rpx + env(safe-area-inset-bottom));
  background: #F4F1EA;
  color: #302A23;
}

.top-bar,
.entry-head {
  display: flex;
  align-items: center;
}

.top-bar {
  justify-content: space-between;
}

.icon-button,
.icon-placeholder {
  width: 72rpx;
  height: 72rpx;
}

.icon-button {
  padding: 0;
  margin: 0;
  border-radius: 50%;
  background: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 12rpx 30rpx rgba(58, 51, 43, 0.06);
}

.icon-button::after {
  border: none;
}

.icon-button-hover {
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

.summary-card,
.entry-card,
.empty-card {
  border-radius: 16rpx;
  background: #FFFFFF;
  border: 1rpx solid #EEE6DA;
  box-shadow: 0 14rpx 34rpx rgba(58, 51, 43, 0.05);
}

.summary-card {
  margin-top: 30rpx;
  padding: 30rpx;
  display: flex;
  align-items: flex-end;
}

.summary-num {
  color: #5F735C;
  font-size: 56rpx;
  font-weight: 600;
  line-height: 1;
}

.summary-text {
  margin-left: 14rpx;
  color: #7C756B;
  font-size: 25rpx;
  line-height: 1.25;
}

.entry-scroll {
  margin-top: 22rpx;
  height: calc(100vh - 280rpx);
}

.entry-card {
  padding: 26rpx;
  margin-bottom: 18rpx;
}

.entry-dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  margin-right: 12rpx;
}

.entry-date {
  color: #8F877A;
  font-size: 22rpx;
  line-height: 1.25;
}

.entry-tag {
  margin-left: auto;
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  background: #F1ECE3;
  color: #6B5D4D;
  font-size: 20rpx;
  line-height: 1.2;
}

.entry-title {
  display: block;
  margin-top: 18rpx;
  color: #302A23;
  font-size: 29rpx;
  font-weight: 600;
  line-height: 1.45;
}

.entry-desc {
  display: block;
  margin-top: 10rpx;
  color: #7C756B;
  font-size: 24rpx;
  line-height: 1.55;
}

.empty-card {
  padding: 34rpx;
}

.empty-title {
  display: block;
  color: #302A23;
  font-size: 32rpx;
  font-weight: 600;
  line-height: 1.25;
}

.empty-desc {
  display: block;
  margin-top: 12rpx;
  color: #7C756B;
  font-size: 24rpx;
  line-height: 1.55;
}
</style>
