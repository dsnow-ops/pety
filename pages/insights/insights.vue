<template>
  <view class="insights-page" :class="petThemeClass" :style="[appThemeStyle, {'--ui-font-scale':uiFontScale}]">
    <view class="top-bar">
      <button class="icon-button" aria-label="返回" hover-class="icon-button-hover" @click="goBack">
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

    <scroll-view scroll-y class="entry-scroll" :scroll-into-view="historyScrollTarget">
      <view v-if="entries.length" class="history-filters">
        <view class="history-search"><input :key="searchInputVersion" :value="searchText" placeholder="查找原文、摘要或日期" aria-label="查找历史记录" @input="searchText=$event.detail.value;filtersChanged()"/><button v-if="searchText" @click="clearSearch">清除</button></view>
        <view class="history-filter-row"><button @click="chooseHistoryYear">{{ selectedYear==='unknown'?'时间未详':selectedYear?selectedYear+'年':'全部年份' }} · 选择</button><text>找到 {{ filteredEntries.length }} / {{ entries.length }} 条</text></view>
        <scroll-view v-if="yearFiltersOpen" scroll-y class="history-years" aria-label="选择历史年份"><view class="history-year-options"><button :aria-pressed="!selectedYear" @click="selectHistoryYear('')">全部年份</button><button v-for="year in historyYears" :key="year" :aria-pressed="selectedYear===year" @click="selectHistoryYear(year)">{{year==='unknown'?'时间未详':year+'年'}}</button></view></scroll-view>
      </view>
      <view v-if="entries.length && filteredEntries.length" class="entry-list" id="history-results">
        <RecordPager :total="filteredEntries.length" :offset="historyOffset" :size="30" label="历史记录分页" @change="changeHistoryPage"/>
        <view v-for="entry in visibleEntries" :key="entry.id" class="entry-card">
          <view class="entry-head">
            <view class="entry-dot" :style="{ background: entry.color }"></view>
            <text class="entry-date">{{ entry.date }}</text>
            <text class="entry-tag">{{ entry.tag }}</text>
          </view>
          <text class="entry-title">{{ entry.title }}</text>
          <text v-if="entry.desc" class="entry-desc">{{ entry.desc }}</text>
          <button v-if="entry.sourceDate" class="entry-source" @click="openSource(entry)">打开这一天</button>
        </view>
        <RecordPager :total="filteredEntries.length" :offset="historyOffset" :size="30" label="历史记录分页" @change="changeHistoryPage"/>
      </view>
      <view v-else-if="entries.length" class="empty-card history-no-matches"><text class="empty-title">没有找到符合条件的记录</text><text class="empty-desc">可以换个词，或查看全部年份。</text><button class="history-more" @click="clearFilters">查看全部记录</button></view>
      <view v-else-if="loadError" class="empty-card" role="alert"><text class="empty-title">记录暂时无法读取</text><text class="empty-desc">已有资料仍保留，请稍后重试。</text><button class="history-more" @click="refreshEntries">重新读取</button></view>
      <view v-else class="empty-card">
        <text class="empty-title">{{ typeMeta.emptyTitle }}</text>
        <text class="empty-desc">{{ typeMeta.emptyDesc }}</text>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import {scopedStorage, captureDataScope, isDataScopeCurrent} from "../../common/scoped-storage.js";
import RecordPager from '../../components/RecordPager.vue';
import { getActivePet, subscribePetSelection } from '../../common/pet-store.js';
import { subscribeAccountScope } from '../../common/auth-store.js';
import { getDiaryMap, getEventLabel, getMoodColor, getMoodLabel, hasDiaryRecord, normalizeDiaryRecord } from '../../common/diary-store.js';
import { getConsultationRecords } from '../../common/consultation-store.js';

export default {
  components: { RecordPager },
  data() {
    return {
      type: 'memory',
      activePet: null,
      entries: [],loadError:false,historyVisible:false,
      searchText:'',searchInputVersion:0,selectedYear:'',yearFiltersOpen:false,historyOffset:0,historyScrollTarget:'',loadedHistoryScope:null
    };
  },
  computed: {
    filteredEntries() {
      const keyword=this.searchText.trim().toLocaleLowerCase();
      return this.entries.filter(entry=>{
        const year=/^\d{4}[.-]/.test(entry.date||'')?entry.date.slice(0,4):'unknown';
        return (!this.selectedYear||year===this.selectedYear)&&(!keyword||[entry.title,entry.desc,entry.date,entry.tag].some(value=>String(value||'').toLocaleLowerCase().includes(keyword)));
      });
    },
    visibleEntries(){return this.filteredEntries.slice(this.historyOffset,this.historyOffset+30);},
    historyYears(){return [...new Set(this.entries.map(entry=>/^\d{4}[.-]/.test(entry.date||'')?entry.date.slice(0,4):'unknown'))].sort((a,b)=>a==='unknown'?1:b==='unknown'?-1:b.localeCompare(a));},
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
    this.offHistoryPet=subscribePetSelection(()=>{if(this.historyVisible)this.refreshEntries();});
    this.offHistoryScope=subscribeAccountScope(()=>{if(this.historyVisible)this.refreshEntries();});
  },
  onShow() {
    this.historyVisible=true;this.refreshEntries();
  },
  onHide(){this.historyVisible=false;this.entries=[];this.activePet=null;this.loadError=false;this.clearFilters();this.loadedHistoryScope=null;},
  onUnload(){this.historyVisible=false;this.entries=[];this.activePet=null;this.clearFilters();this.loadedHistoryScope=null;this.offHistoryPet?.();this.offHistoryScope?.();},
  methods: {
    filtersChanged(){this.historyOffset=0;},
    clearSearch(){this.searchText='';this.searchInputVersion++;this.filtersChanged();},
    clearFilters(){this.clearSearch();this.selectedYear='';this.yearFiltersOpen=false;this.historyScrollTarget='';},
    chooseHistoryYear(){this.yearFiltersOpen=!this.yearFiltersOpen;},
    selectHistoryYear(year){if(!this.historyVisible||!isDataScopeCurrent(this.loadedHistoryScope)||getActivePet()?.id!==this.activePet?.id||year!==''&&!this.historyYears.includes(year))return;this.selectedYear=year;this.yearFiltersOpen=false;this.filtersChanged();},
    changeHistoryPage(offset){const last=Math.max(0,Math.floor((this.filteredEntries.length-1)/30)*30);this.historyOffset=Math.max(0,Math.min(last,Math.floor((Number(offset)||0)/30)*30));this.historyScrollTarget='';this.$nextTick(()=>{this.historyScrollTarget='history-results';});},
    validSourceDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return '';const[y,m,d]=value.split('-').map(Number),date=new Date(y,m-1,d);return date.getFullYear()===y&&date.getMonth()===m-1&&date.getDate()===d?value:'';},
    openSource(entry){if(!this.historyVisible||!isDataScopeCurrent(this.loadedHistoryScope)||getActivePet()?.id!==this.activePet?.id||!this.entries.includes(entry)||!entry.sourceDate)return;uni.navigateTo({url:'/pages/calendar/calendar?date='+encodeURIComponent(entry.sourceDate)+'&section='+(entry.sourceSection||'health')+'&petId='+encodeURIComponent(this.activePet.id)});},
    refreshEntries(){this.entries=[];this.clearFilters();this.loadError=false;try{this.loadedHistoryScope=captureDataScope();this.activePet=getActivePet();this.entries=this.buildEntries();}catch(_){this.entries=[];this.loadError=true;}},
    buildEntries() {
      if (!this.activePet) return [];
      if (this.type === 'chat') return this.buildChatEntries();
      if (this.type === 'events') return this.buildEventEntries();
      return this.buildMemoryEntries();
    },
    buildMemoryEntries() {
      const diaryMap = getDiaryMap(this.activePet.id,undefined,{strict:true});
      return Object.keys(diaryMap)
        .sort()
        .reverse()
        .map(dateKey => {
          const record = normalizeDiaryRecord(diaryMap[dateKey]);
          if (!hasDiaryRecord(record)) return null;
          const eventText = record.events.map(getEventLabel).join('、');
          const memorial=record.relationshipStage==='deceased',life=typeof record.lifeText==='string'?record.lifeText:'';
          const title=(memorial?record.memoryText:record.note)||life||eventText||(memorial?'这一天的回忆':'已保存当天记录');
          return {
            id: `memory_${dateKey}`,
            date: dateKey,
            tag: memorial?'怀念':getMoodLabel(record.mood),
            title,
            desc: [...new Set([life,eventText].filter(value=>value&&value!==title))].join('\n'),
            color: getMoodColor(record.mood),
            sourceDate:this.validSourceDate(dateKey),sourceSection:!memorial&&life&&!record.note&&!record.events.length?'life':'health'
          };
        })
        .filter(Boolean);
    },
    buildEventEntries() {
      const diaryMap = getDiaryMap(this.activePet.id,undefined,{strict:true});
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
            color: getMoodColor(record.mood),sourceDate:this.validSourceDate(dateKey),sourceSection:'health'
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

      const history = scopedStorage.getStorageSync('chat_history_' + this.activePet.id) || [];
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
      if (!Number.isFinite(timestamp) || timestamp <= 0) return '时间未详';
      const date = new Date(timestamp);
      if (Number.isNaN(date.getTime())) return '时间未详';
      const month = `${date.getMonth() + 1}`.padStart(2, '0');
      const day = `${date.getDate()}`.padStart(2, '0');
      return `${date.getFullYear()}.${month}.${day}`;
    },
    goBack() {
      uni.navigateBack();
    }
  }
}
</script>

<style scoped>
.insights-page .entry-title,.insights-page .entry-desc{overflow-wrap:anywhere;white-space:pre-wrap}.insights-page.ui-large-text .entry-title{font-size:calc(15px * var(--ui-font-scale,1));line-height:1.6}.insights-page.ui-large-text .entry-desc,.insights-page.ui-large-text .summary-text,.insights-page.ui-large-text .empty-desc,.insights-page.ui-large-text .history-more{font-size:calc(13px * var(--ui-font-scale,1));line-height:1.7}.insights-page.ui-large-text .entry-date,.insights-page.ui-large-text .entry-tag{font-size:calc(11px * var(--ui-font-scale,1));line-height:1.5}.insights-page.ui-large-text .entry-head{flex-wrap:wrap;gap:6px}.insights-page.ui-large-text .title-main{font-size:calc(19px * var(--ui-font-scale,1));line-height:1.5}
.history-more{background:transparent;color:var(--pety-text-secondary,#756B5D);font-size:14px;line-height:1.7;min-height:48px;padding:12px;white-space:normal}.history-more::after{border:0}
.history-filters{margin:0 0 14px;padding:12px;border:1px solid #ded5c7;border-radius:12px;background:#fffdf8;color:#6b5d4d;}
.history-search,.history-filter-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.history-search input{min-width:120px;flex:1;height:44px;font-size:calc(14px * var(--ui-font-scale,1));color:#302a23;}
.history-search button,.history-filter-row button,.entry-source{margin:0;min-height:44px;padding:8px 6px;background:transparent;color:#6b5d4d;line-height:1.5;font-size:calc(13px * var(--ui-font-scale,1));}
.history-search button::after,.history-filter-row button::after,.entry-source::after{border:0;}
.history-filter-row{justify-content:space-between;border-top:1px solid #eee6da;margin-top:8px;padding-top:4px;}
.history-filter-row text{font-size:calc(12px * var(--ui-font-scale,1));line-height:1.6;}
.history-years{height:220px;max-height:32vh;margin-top:8px;border-top:1px solid #eee6da;}
.history-year-options{display:flex;flex-wrap:wrap;padding:8px 0;}
.history-year-options button{width:50%;margin:0;padding:10px 4px;min-height:44px;font-size:calc(13px * var(--ui-font-scale,1));line-height:1.5;background:transparent;color:#6b5d4d;border-radius:8px;}
.history-year-options button::after{border:0;}.history-year-options button[aria-pressed="true"]{background:#eee6da;color:#302a23;font-weight:600;}
.entry-source{display:block;margin-top:10px;text-align:left;border-top:1px solid #eee6da;border-radius:0;width:100%;}
.record-pager{color:#6b5d4d;--ui-text:#302a23;border-color:#ded5c7;}
.insights-page {
  height: 100vh;
  box-sizing: border-box;
  display:flex;
  flex-direction:column;
  padding: calc(var(--status-bar-height, 0px) + 30rpx) 30rpx calc(42rpx + env(safe-area-inset-bottom));
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
  flex-shrink:0;
}

.icon-button,
.icon-placeholder {
  width: 44px;
  height: 44px;
  flex-shrink:0;
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
  flex-shrink:0;
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
  flex:1;
  min-height:0;
  height:0;
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
