<template>
  <view :class="[petThemeClass, 'calendar-page ui-v2', themeClass, reduceMotion ? 'reduce-motion' : '']" :style="[appThemeStyle,insets]">
    <view class="calendar-animated-content">
    <view class="top-bar">
      <button class="icon-button" hover-class="icon-button-hover" @click="goBack">
        <uni-icons type="left" size="22" color="#BCC4AE"></uni-icons>
      </button>
      <view class="title-copy">
        <text class="title-kicker">{{ relationshipConfig.stageName }}</text>
        <text class="title-main">{{ recordCopy.recordPageTitle }}</text>
      </view>
      <button class="icon-button" hover-class="icon-button-hover" @click="goToday">
        <uni-icons type="calendar" size="21" color="#302A23"></uni-icons>
      </button>
    </view>
    <view v-if="recordReadError" class="record-read-error" :style="{'--ui-font-scale':uiFontScale}" role="alert"><text class="read-error-title">资料暂时没能读取</text><text>为保护已有内容，暂不开放编辑。请重试读取。</text><button @click="loadCalendar">重新读取</button></view>
    <template v-else>
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

    <view v-if="activePet && !momentId" class="month-card">
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
          :data-date="item.dateKey"
          :class="[
            'date-cell',
            item.isCurrentMonth ? '' : 'date-cell-muted',
            item.isToday ? 'date-cell-today' : '',
            item.isSelected ? 'date-cell-active' : '',
            item.isImportant ? 'date-cell-important' : ''
          ]"
          @click="selectDate(item)"
        >
          <text class="date-number">{{ item.dayNumber }}</text>
          <text v-if="item.isCurrentMonth" class="date-lunar">{{ item.displaySecondaryLabel }}</text>
          <text v-if="item.isCurrentMonth && item.isToday" class="date-today-mark">今</text>
          <view v-if="item.isCurrentMonth && item.hasRecord" class="record-dot" :style="{ background: item.moodColor }"></view>
          <view v-if="item.isCurrentMonth && item.hasMultipleReflections" class="reflection-more-dot"></view>
        </view>
      </view>

      <view v-if="relationshipStage === 'current'" class="legend-row">
        <view v-for="mood in moodOptions" :key="mood.key" class="legend-item">
          <view class="legend-dot" :style="{ background: moodColor(mood.key) }"></view>
          <text class="legend-text">{{ mood.label }}</text>
        </view><view class="legend-item"><view class="legend-dot" :style="{background:moodColor('')}"/><text class="legend-text">未选状态</text></view>
      </view>
    </view>

    <view v-if="activePet && relationshipStage === 'deceased' && reflectionSuggestion" class="reflection-suggestion">
      <text class="suggestion-kicker">根据今天的对话整理</text>
      <text class="suggestion-title">也许可以把这一点留在今天</text>
      <text v-if="reflectionSuggestion.memoryText" class="suggestion-summary">{{ reflectionSuggestion.memoryText }}</text>
      <view class="suggestion-tags">
        <text v-for="tag in reflectionSuggestion.reflectionTags" :key="tag" class="suggestion-tag">{{ reflectionTagLabel(tag) }}</text>
      </view>
      <view class="suggestion-actions">
        <button class="suggestion-action suggestion-action-primary" @click="keepReflectionSuggestion">保留</button>
        <button class="suggestion-action" @click="editReflectionSuggestion">修改</button>
        <button class="suggestion-action" @click="deleteReflectionSuggestion">删除</button>
      </view>
    </view>

    <view v-if="activePet && momentId" class="event-time-panel">
 <text class="field-title">这是哪一天的事？也可以不确定。</text>
 <picker :range="['具体日期','具体时刻','只记得月份','只记得年份','某个季节','时间未知']" @change="updateEventField('eventPrecision',['day','exact','month','year','season','unknown'][$event.detail.value])"><button>{{({day:'具体日期',exact:'具体时刻',month:'只记得月份',year:'只记得年份',season:'某个季节',unknown:'时间未知'})[eventPrecision]}} · 更改</button></picker>
 <picker v-if="['day','exact'].includes(eventPrecision)" mode="date" :value="selectedDateKey" @change="updateEventField('selectedDateKey',$event.detail.value)"><button>{{selectedDateKey}}</button></picker>
 <picker v-if="eventPrecision==='exact'" mode="time" :value="eventClock" @change="updateEventField('eventClock',$event.detail.value)"><button>{{eventClock||'选择时刻'}}</button></picker>
 <input v-if="['month','year','season'].includes(eventPrecision)" :value="eventYear" type="number" placeholder="年份，例如 2023" @input="updateEventField('eventYear',$event.detail.value)"/>
 <input v-if="eventPrecision==='month'" :value="eventMonth" type="number" placeholder="月份，1–12" @input="updateEventField('eventMonth',$event.detail.value)"/>
 <input v-if="eventPrecision==='season'" :value="eventSeason" placeholder="例如：冬天" @input="updateEventField('eventSeason',$event.detail.value)"/>
 </view><view v-if="followupSource" class="event-time-panel"><text>这次后续关联原观察，不代替兽医结论。</text><picker :range="Object.values(careStatuses)" @change="careStatus=Object.keys(careStatuses)[$event.detail.value];saveDailyDraft()"><button>{{careStatuses[careStatus]||'选择主人报告的状态'}}</button></picker><button @click="openCareSource(followupSource)">查看原事件</button></view><view v-if="activePet" class="daily-flow"><text class="daily-kicker">{{relationshipStage==='deceased'?'安静地留下一页':'今天的日常'}}</text><text class="daily-caption">身体的变化，和那些值得记住的小事。</text><AppSegmented class="daily-tabs" v-model="dailySection" :options="[{value:'health',label:recordStage==='deceased'?'回忆与感受':'健康与观察'},{value:'life',label:'日常与照片'}]"/></view>
    <view v-if="dailyConflict" class="daily-conflict" :style="{'--ui-font-scale':uiFontScale}" role="alert">
      <text class="conflict-title">这份记录在别处有变化</text>
      <text>当前输入仅保留在此页。另存会创建一条独立观察，不覆盖原日期记录。</text>
      <button class="daily-conflict-copy" :disabled="saving||dailyMediaBusy||photoFailed" @click="saveDailyConflictCopy">另存为独立记录</button>
      <button class="daily-conflict-reload" :disabled="saving||dailyMediaBusy" @click="reloadDailyConflict">重新读取</button>
    </view>
    <view :key="'health:'+dailyEditorEpoch" v-if="activePet" class="record-card" v-show="dailySection==='health'">
      <text v-if="relationshipStage==='deceased' && recordStage==='current'" class="note-help">陪伴期的健康资料 · 按原日期查看与修改</text>
      <view class="record-head">
        <view>
          <text class="record-kicker">{{ selectedDateLabel }}</text>
          <text class="record-title">{{ recordTitle }}</text>
        </view>
        <text v-if="recordStage === 'current'" class="record-state" :style="{ color: moodColor(form.mood), background: moodSoftColor(form.mood) }">{{ currentMoodLabel }}</text>
        <text v-else class="record-state memorial-record-state">思念记录</text>
      </view>

      <view v-if="recordStage === 'current'" class="mood-row">
        <view
          v-for="mood in moodOptions"
          :key="mood.key"
          :class="['mood-chip', form.mood === mood.key ? 'mood-chip-active' : '']"
          :aria-pressed="form.mood === mood.key" role="button"
          @click="form.mood = form.mood === mood.key ? '' : mood.key"
        >
          <text class="choice-face">{{ mood.label }}</text>
        </view>
      </view>

      <view class="event-section">
        <text class="field-title">{{ recordCopy.recordTypeLabel }}</text>
        <view class="event-grid">
          <view
            v-for="event in eventOptions"
            :key="event.key"
            :class="['event-chip', isEventSelected(event.key) ? 'event-chip-active' : '']" :aria-pressed="isEventSelected(event.key)" role="button"
            @click="toggleEvent(event.key)"
          >
            <text class="choice-face">{{ event.label }}</text>
          </view>
        </view>
      </view>

      <view v-if="recordStage==='current'" class="health-results"><text class="field-title">具体观察 · 按需填写</text><text class="daily-caption">类别标签不代表结果。未填写保持未知。</text><view v-for="h in healthFields.filter(h=>isEventSelected(h.legacy)||form.healthValues?.[h.key]?.text)" :key="h.key" class="health-result"><text>{{h.label}}</text><input :value="form.healthValues?.[h.key]?.text||''" :placeholder="h.key==='weight'?'例如 4.2 kg；请保留单位':'写下观察、数量或时间'" @input="setHealthValue(h.key,$event.detail.value)"/></view></view>
      <view class="note-section">
        <text class="field-title">{{ recordStage === 'deceased' ? '今天想留下的话' : '手写记录' }}</text>
        <textarea
          v-if="recordStage === 'current'"
          class="note-input"
          v-model="form.note"
          :placeholder="recordCopy.recordEmptyText"
          placeholder-style="color:#AAA195"
          maxlength="500"
          :show-confirm-bar="false"
        ></textarea>
        <textarea
          v-else
          class="note-input"
          v-model="form.memoryText"
          placeholder="写下今天想起他/她的一件小事，或一句想说的话"
          placeholder-style="color:#AAA195"
          maxlength="1000"
          :show-confirm-bar="false"
        ></textarea>
        <text class="note-help">{{ noteHelpText }}</text>
      </view>

      <view v-if="recordStage === 'deceased'" class="note-section private-note-section">
        <text class="field-title">只给自己看的补充</text>
        <textarea class="note-input private-note-input" v-model="form.privateNote" placeholder="可选，不会进入 AI 对话" placeholder-style="color:#AAA195" maxlength="500" :show-confirm-bar="false"></textarea>
      </view>

      <text v-if="saveError" class="save-error">{{saveError}}</text>
      <AppButton variant="primary" class="save-btn" :disabled="saving" hover-class="save-btn-hover" @click="saveRecord">
        <text>{{recordStage==='deceased'?'保存这段回忆':'保存日常记录'}}</text>
      </AppButton>
    </view>
    <view :key="'life:'+dailyEditorEpoch" v-if="activePet" v-show="dailySection==='life'" class="record-card daily-life"><text class="field-title">{{relationshipStage==='deceased'?'记下一段回忆':'今天的小片段'}}</text><input class="daily-title" v-model="form.title" placeholder="可选标题"/><input class="daily-title" :value="(form.tags||[]).join('，')" placeholder="可选标签，用逗号分隔" @input="form.tags=$event.detail.value.split(/[,，]/).map(v=>v.trim()).filter(Boolean)"/><textarea class="daily-life-input" :value="form.lifeEditedText ?? form.lifeText" @input="editLife($event.detail.value)" placeholder="今天有什么想记下的？一句话也可以。" :maxlength="-1" auto-height/><button class="daily-polish" @click="dailyPolishOpen=!dailyPolishOpen">整理文字 · 可选</button><view v-if="dailyPolishOpen" class="daily-polish-panel"><text class="daily-caption">只发送生活原文；健康观察和私人补充不会发送。</text><view class="polish-styles"><button v-for="(label,key) in {preserve:'保留原话',diary:'自然日记',brief:'简短克制',letter:'写成一封信'}" :key="key" :class="{active:dailyPolishStyle===key}" @click="dailyPolishStyle=key">{{label}}</button></view><button :disabled="dailyPolishing" @click="polishDaily">{{dailyPolishing?'正在请求…':'帮我整理文字'}}</button><text class="daily-caption">{{dailyPolishStatus}}</text><view v-if="form.lifeCandidate"><text>{{form.lifeCandidate.text}}</text><button @click="adoptDailyCandidate">采用候选，继续编辑</button><button @click="form.lifeEditedText=null">保留原文</button></view></view><view class="daily-photos"><view v-for="(photo,i) in form.media||[]" :key="photo.id"><image v-if="dailyPhotoUrls[i]" :src="dailyPhotoUrls[i]" mode="aspectFit" @click="uniPreviewPhoto(i)"/><text v-else>照片暂不可读取</text><input :value="photo.caption||''" placeholder="照片说明（可选）" @input="captionDailyPhoto(i,$event.detail.value)"/><view class="photo-actions"><button :disabled="i===0" @click="moveDailyPhoto(i,-1)">前移</button><button :disabled="i===(form.media.length-1)" @click="moveDailyPhoto(i,1)">后移</button><button @click="removeDailyPhoto(i)">移除引用</button></view><picker :range="['生活照片','照护照片','报告','用途未知']" @change="classifyDailyPhoto(i,['life','care','report','unknown'][$event.detail.value])"><button>{{({life:'生活照片',care:'照护照片',report:'报告',unknown:'用途未知'})[photo.purpose||'unknown']}} · 用途</button></picker></view></view><button class="daily-photo-button" :disabled="dailyMediaBusy||(form.media?.length||0)>=4" @click="addDailyPhoto">{{dailyMediaBusy?'照片保存中…':'添加日常照片'}} · {{form.media?.length||0}}/4</button><text class="daily-caption">健康观察与生活片段都属于这一天；制卡时再选择展示哪些。</text><text v-if="saveError" class="save-error">{{saveError}}</text><AppButton variant="primary" class="save-btn" :disabled="saving||dailyMediaBusy" @click="saveRecord">保存日常记录</AppButton></view>
    <view v-if="activePet" class="daily-after"><button v-if="form.note||form.events?.length||Object.values(form.healthValues||{}).some(v=>v.text)||followupSource" @click="startCareFollowup">记录这次观察的后续</button><button @click="openDoctor">整理给医生看</button><view v-for="follow in followupRecords" :key="follow.id" @click="openCareSource(follow.id)"><text>{{follow.dateText||follow.localDate||'时间未详'}} · {{careStatuses[follow.careStatus]||'后续观察'}} · {{factExcerpt(follow)}}</text></view><view v-if="doctorOpen" class="doctor-facts"><text>选择需要的原始资料，复制前可核对全文。</text><button v-for="row in careRows" :key="row.id" @click="toggleDoctorSource(row.id)">{{doctorSelected.includes(row.id)?'✓ ':''}}{{row.dateText||row.localDate||'时间未详'}} · {{factExcerpt(row)}}</button><button @click="prepareDoctor">预览事实整理</button><text v-if="doctorPreview" class="doctor-preview">{{doctorPreview}}</text><button v-if="doctorPreview" @click="copyDoctor">复制这些文字</button><button @click="doctorOpen=false">收起</button></view><button v-if="photoFailed" @click="continueWithoutFailedPhotos">不带未成功的照片继续保存</button><button @click="startMoment">补记一刻 / 新增一次观察</button><text>记录保存后，可以再为它做一张作品。</text><button @click="composeDay">按这份记录制卡</button><button @click="openCreativeAlbum">看看陪伴册</button><view v-for="record in creativeDateRecords" :key="record.id" @click="openCreativeRecord(record.id)"><text>同日的另一段记录 · {{record.title || record.original || creativeCopy('photoMoment')}}</text></view></view>
    </template>
    </view>

    <VisualLockContract v-if="visualContractOpen" @close="visualContractOpen=false"/>
    <view v-if="showMonthPicker" class="picker-mask" @click="closeMonthPicker" @touchmove.stop.prevent></view>
    <view v-if="showMonthPicker" class="picker-sheet" @click.stop @touchmove.stop>
      <view class="picker-head">
        <button class="picker-action" hover-class="picker-action-hover" @click="closeMonthPicker">取消</button>
        <text class="picker-title">选择年月</text>
        <button class="picker-action picker-action-strong" hover-class="picker-action-hover" @click="confirmMonthPicker">确定</button>
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
</template>

<script>

import {createNarrativePolisher,narrativeFailureMessage} from '../../common/narrative-api.js';
import {DAILY_HEALTH,hasDailyContent} from "../../common/daily-record-fields.js";
import {persistNarrativePhoto,resolveNarrativePhoto,releaseNarrativePhoto} from "../../common/narrative-media.js";
import {syncCollections} from "../../common/companion-collection.js";
import {captureDataScope,isDataScopeCurrent} from "../../common/scoped-storage.js";
import {subscribeAccountScope} from "../../common/auth-store.js";
import { getActivePet, subscribePetSelection } from '../../common/pet-store.js';
import {
  formatDateKey,
  getDiaryMap,
  getDiaryRecord,
  getEventLabel,
  getMemorialReflectionSuggestion,
  getMoodColor,
  getMoodLabel,
  hasDiaryRecord,
  removeMemorialReflectionSuggestion,
  saveDiaryRecord
} from '../../common/diary-store.js';
import {
  formatLocalCalendarSummary,
  getCalendarDateState,
  getCalendarMonthGrid,
  getLocalizedCalendarSecondaryLabel,
  getLocalizedWeekdayLabels,
  LUNAR_SUPPORTED_SOLAR_YEAR_MAX,
  LUNAR_SUPPORTED_SOLAR_YEAR_MIN
} from '../../common/lunar-calendar.js';
import { getAppLocale, t } from '../../common/i18n.js';
import { creativeInsets } from '../../common/creative-insets.js';
import {getPetProfile} from '../../common/profile-store.js';
import {CARE_STATUS,originalFactLines,doctorFactText} from '../../common/care-record-context.js';
import { getNarrativeStore, eventTimeLabel } from '../../common/narrative-store.js';
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

function isImportantDiaryRecord(record) {
  if (!record || !hasDiaryRecord(record)) return false;
  const keys = [record.type].concat(record.events || []);
  return ['sick', 'uneasy'].includes(record.mood) || keys.includes('abnormal');
}

const MEMORIAL_REFLECTION_OPTIONS = [
  { key: 'longing', label: '想你了', shortLabel: '想你' },
  { key: 'dream', label: '梦到你了', shortLabel: '梦到你' },
  { key: 'photo', label: '翻到照片', shortLabel: '照片' },
  { key: 'memory', label: '想起一件小事', shortLabel: '小事' },
  { key: 'place', label: '去了熟悉的地方', shortLabel: '熟悉的地方' },
  { key: 'quiet', label: '今天很平静', shortLabel: '很平静' },
  { key: 'sad', label: '有点难熬', shortLabel: '有点难熬' },
  { key: 'letter', label: '想对你说', shortLabel: '想对你说' },
  { key: 'anniversary', label: '纪念日', shortLabel: '纪念日' },
  { key: 'custom', label: '自定义', shortLabel: '回忆' }
];

function getReflectionOption(key) {
  return MEMORIAL_REFLECTION_OPTIONS.find(item => item.key === key);
}

export default {

  data() {
    return {recordReadError:false,visualContractOpen:false,
      insets:creativeInsets(),saveError:'',saving:false,dailyConflict:false,dailyDraftSnapshot:null,loadedRecordVersion:0,loadedPetStage:'',unsubscribePet:null,loadedDataScope:captureDataScope(),unsubscribeDataScope:null,activePet: null,
      activePetId: null,
      currentMonthDate: new Date(),
      selectedDateKey: formatDateKey(),
      diaryMap: {},
      reflectionSuggestion: null,
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
      locale: getAppLocale(),
      moodOptions: [
        { key: 'good', label: '轻松' },
        { key: 'calm', label: '平稳' },
        { key: 'tired', label: '疲惫' },
        { key: 'uneasy', label: '不安' },
        { key: 'sick', label: '不适' }
      ],
      followupSource:'',careStatus:'',careStatuses:CARE_STATUS,doctorOpen:false,doctorSelected:[],doctorPreview:'',careRows:[],momentId:'',momentRecord:null,momentRequested:false,sourceMissing:false,photoFailed:false,lastSavedInput:'',eventPrecision:'day',eventYear:'',eventMonth:'',eventSeason:'',eventClock:'',
      dailyContextKey:"",dailyEditorEpoch:0,dailyPhotoEpoch:0,dailyPageVisible:true,dailySection:"life",dailyPolishOpen:false,dailyPolishStyle:"preserve",dailyPolishStatus:"",dailyPolishing:false,dailyPolisher:createNarrativePolisher(),healthFields:DAILY_HEALTH,dailyPhotoUrls:[],dailyMediaBusy:false,dailyLoading:false,
      form: {
        type: '',
        mood: '',
        events: [],
        note: '',
        memoryText: '',
        privateNote: '',
        source: 'manual',
        sourceChatIds: []
      }
    };
  },
  computed: {
    narrativeRows(){this.diaryMap;if(this.recordReadError||!this.activePetId)return [];try{return this.dailyStore().list();}catch(_){return [];}},
    followupRecords(){this.diaryMap;if(!this.activePetId)return [];const id=this.followupSource||this.momentId||'legacy:'+this.selectedDateKey;return this.narrativeRows.filter(r=>r.careSourceId===id).sort((a,b)=>(a.localDate||'').localeCompare(b.localDate||'')||a.createdAt-b.createdAt);},
    creativeDateRecords() { this.diaryMap; if(!this.activePetId)return [];return this.narrativeRows.filter(r=>!r.legacy&&r.localDate===this.selectedDateKey); },
    recordStage() { if(this.momentId)return this.momentRecord?.mode||this.loadedPetStage;const record=this.diaryMap[this.selectedDateKey];return hasDiaryRecord(record)?(record.relationshipStage==='deceased'?'deceased':'current'):this.relationshipStage; },
    relationshipStage() {
      return getPetRelationshipStage(this.activePet);
    },
    weekDays() {
      return getLocalizedWeekdayLabels(this.locale);
    },
    relationshipConfig() {
      return getRelationshipConfig(this.relationshipStage);
    },
    recordCopy() {
      return this.recordStage==='current' ? {...getRelationshipRecordCopy('current'),recordPageTitle:'日常记录',recordPageSubtitle:'健康观察与生活细节，都在这一天',recordPrimaryActionText:'保存日常记录',recordEmptyTitle:'这一天，想留下什么？',recordEmptyText:'记录观察到的情况、数值与单位；未填写的信息保持未知',recordTypeLabel:'健康与日常事件（可多选）'} : getRelationshipRecordCopy(this.recordStage);
    },
    themeClass() {
      return getRelationshipThemeClass(this.relationshipStage);
    },
    eventOptions() {
      const options = this.recordStage === 'deceased'
        ? MEMORIAL_REFLECTION_OPTIONS
        : getRelationshipRecordTypes(this.recordStage);
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
      return this.locale === 'en'
        ? `${this.currentMonthDate.toLocaleString('en', { month: 'long' })} ${this.currentMonthDate.getFullYear()}`
        : `${this.currentMonthDate.getFullYear()} 年 ${this.currentMonthDate.getMonth() + 1} 月`;
    },
    selectedDateLabel() {
      if(this.momentId)return eventTimeLabel({eventTime:this.currentEventTime()});
      const parts = this.selectedDateKey.split('-').map(Number);
      if (parts.length !== 3) return this.selectedDateKey;
      return formatLocalCalendarSummary(parts[0], parts[1], parts[2], this.locale) || this.selectedDateKey;
    },
    currentMoodLabel() {
      return getMoodLabel(this.form.mood);
    },
    selectedHasRecord() {
      return hasDiaryRecord(this.diaryMap[this.selectedDateKey]);
    },
    recordTitle() {
      return this.selectedHasRecord ? (this.recordStage==='current'?'查看 / 编辑这一天':this.recordCopy.recordPrimaryActionText) : this.recordCopy.recordEmptyTitle;
    },
    noteHelpText() {
      if (this.recordStage === 'deceased') {
        return '这些文字会慢慢组成你们的故事，方便以后整理回忆、写信，或回看那些真实拥有过的陪伴。';
      }
      return '你写下的小事，归爪会认真记住。之后整理照护记录、准备问诊或回看变化时，这些文字都会成为重要线索。';
    },
    calendarDays() {
      const displayYear = this.currentMonthDate.getFullYear();
      const displayMonth = this.currentMonthDate.getMonth() + 1;
      return getCalendarMonthGrid(displayYear, displayMonth).map((calendarDate, index) => {
        const dateKey = calendarDate.dateKey;
        const record = this.diaryMap[dateKey];
        const state = getCalendarDateState(calendarDate.date, {
          selectedDateKey: this.selectedDateKey,
          hasRecord: hasDiaryRecord(record) || this.activePetId && this.narrativeRows.some(r=>!r.legacy && r.localDate===dateKey),
          isImportant: isImportantDiaryRecord(record),
          isCurrentMonth: calendarDate.isCurrentMonth
        });
        return {
          key: `${dateKey}_${index}`,
          dateKey,
          day: calendarDate.day,
          year: calendarDate.year,
          month: calendarDate.month,
          weekdayShortLabel: calendarDate.weekdayShortLabel,
          dayNumber: calendarDate.dayNumber,
          secondaryLabel: calendarDate.secondaryLabel,
          displaySecondaryLabel: this.getCalendarCellLabel(calendarDate, record),
          hasMultipleReflections: this.relationshipStage === 'deceased' && Boolean(record && record.reflectionTags && record.reflectionTags.length > 1),
          moodColor: this.moodColor(record && record.mood),
          ...state
        };
      });
    }
  },
  onLoad(options = {}) {
    this.followupSource=options.followup||'';this.momentRequested=options.moment==='1'||!!this.followupSource;this.momentId=options.recordId||'';
    if(options.section==='health'||this.followupSource)this.dailySection='health';
    this.visualContractOpen=process.env.NODE_ENV!=="production" && options.visualContract==="1";
    this.loadedDataScope=captureDataScope();
    this.unsubscribeDataScope=subscribeAccountScope(()=>this.loadCalendar());
    this.unsubscribePet=subscribePetSelection(()=>this.loadCalendar());
    if(options.petId && options.petId!==getActivePet()?.id){uni.showToast({title:'当前宠物已切换，请重新选择日期',icon:'none'});uni.navigateBack();return;}
    const requestedDate = options.selectedDate || options.date;
    if (requestedDate) {
      const routeDate = parseLocalDateKey(requestedDate);
      this.selectedDateKey = formatDateKey(routeDate);
      this.currentMonthDate = new Date(routeDate.getFullYear(), routeDate.getMonth(), 1, 12, 0, 0, 0);
    }
  },
  onShow() {
    this.dailyPageVisible=true;this.loadCalendar();
  },
  onHide() {
    this.dailyPageVisible=false;this.dailyPhotoEpoch++;this.dailyPhotoUrls.forEach(releaseNarrativePhoto);this.dailyPhotoUrls=[];
    this.clearMonthTransition();
    this.closeMonthPicker();
  },
  onUnload() {
    this.dailyPageVisible=false;this.dailyPhotoUrls.forEach(releaseNarrativePhoto);
    this.unsubscribeDataScope?.();this.unsubscribeDataScope=null;this.unsubscribePet?.();
    this.clearMonthTransition();
  },
  onBackPress() {
    if (!this.showMonthPicker) return false;
    this.closeMonthPicker();
    return true;
  },
  watch:{form:{deep:true,handler(){this.saveDailyDraft();}}},
  methods: {
    factExcerpt(row){return originalFactLines(row).join('；').slice(0,100);},
    openCareSource(id){if(id.startsWith('legacy:'))uni.navigateTo({url:'/pages/calendar/calendar?date='+id.slice(7)+'&section=health'});else uni.navigateTo({url:'/pages/calendar/calendar?recordId='+encodeURIComponent(id)+'&section=health'});},
    startCareFollowup(){if(!this.saveRecord())return;const id=this.followupSource||this.momentId||'legacy:'+this.selectedDateKey;uni.navigateTo({url:'/pages/calendar/calendar?moment=1&followup='+encodeURIComponent(id)+'&petId='+encodeURIComponent(this.activePetId)});},
    openDoctor(){if(!isDataScopeCurrent(this.loadedDataScope))return;const id=this.followupSource||this.momentId||'legacy:'+this.selectedDateKey;const rows=this.dailyStore().list();this.careRows=rows.filter(r=>r.id===id||r.careSourceId===id);this.doctorSelected=[];this.doctorPreview='';this.doctorOpen=true;if(!this.careRows.length)this.saveError='先保存一条真实观察，再选择整理。';},
    toggleDoctorSource(id){this.doctorSelected=this.doctorSelected.includes(id)?this.doctorSelected.filter(v=>v!==id):[...this.doctorSelected,id];this.doctorPreview='';},
    prepareDoctor(){if(!isDataScopeCurrent(this.loadedDataScope)||getActivePet()?.id!==this.activePetId)return;this.doctorPreview=doctorFactText(this.dailyStore().list(),this.doctorSelected,this.loadedDataScope,this.activePet,getPetProfile(this.activePetId));},
    copyDoctor(){if(!isDataScopeCurrent(this.loadedDataScope)||getActivePet()?.id!==this.activePetId)return;const latest=doctorFactText(this.dailyStore().list(),this.doctorSelected,this.loadedDataScope,this.activePet,getPetProfile(this.activePetId));if(latest!==this.doctorPreview){this.doctorPreview=latest;this.saveError='来源已更新，请核对新预览后再复制。';return;}uni.setClipboardData({data:latest,success:()=>uni.showToast({title:'已复制，尚未发送给医生',icon:'none'})});},

    editLife(text){if(this.form.lifeEditedText!==null&&this.form.lifeEditedText!==undefined)this.form.lifeEditedText=text;else{this.form.lifeText=text;this.form.lifeCandidate=null;}},
    async polishDaily(){if(this.dailyPolishing)return;const editor=this.dailyEditorEpoch,scope=this.loadedDataScope,petId=this.activePetId,date=this.selectedDateKey,original=this.form.lifeText||'';const current=()=>editor===this.dailyEditorEpoch&&this.dailyPageVisible&&isDataScopeCurrent(scope)&&getActivePet()?.id===petId&&this.selectedDateKey===date&&getPetRelationshipStage(getActivePet())===this.loadedPetStage;
      if(!original.trim()){this.dailyPolishStatus='先写下一段生活原文。';return;}if(!scope.namespace.startsWith('account:')){this.dailyPolishStatus=narrativeFailureMessage(new Error('NARRATIVE_LOGIN_REQUIRED'));return;}
      const consent=await new Promise(resolve=>uni.showModal({title:'整理生活文字',content:'将生活原文发送给文字服务以返回候选，不发送健康观察和私人补充。是否继续？',success:resolve,fail:()=>resolve({confirm:false})}));if(!consent.confirm||!current())return;this.dailyPolishing=true;
      try{const candidate=await this.dailyPolisher.request({id:'daily:'+date,petId,original,revision:this.loadedRecordVersion},this.dailyPolishStyle,scope);if(current()&&this.form.lifeText===original){this.form.lifeCandidate={...candidate,original};this.dailyPolishStatus='候选已返回。原文仍保留，是否采用由你决定。';}}catch(e){if(current())this.dailyPolishStatus=narrativeFailureMessage(e);}finally{if(current())this.dailyPolishing=false;}
    },adoptDailyCandidate(){if(this.form.lifeCandidate?.original!==this.form.lifeText){this.dailyPolishStatus='原文已变更，请重新整理。';return;}this.form.lifeEditedText=this.form.lifeCandidate.text;},
    setHealthValue(key,text){this.form.healthValues={...(this.form.healthValues||{}),[key]:{text,date:!this.momentId||['day','exact'].includes(this.eventPrecision)?this.selectedDateKey:''}};},
    dailyStore(){return getNarrativeStore(this.activePetId,this.loadedDataScope);},
    saveDailyDraft(){if(this.recordReadError||this.sourceMissing||this.dailyLoading||!this.activePetId||!isDataScopeCurrent(this.loadedDataScope))return;try{const store=this.dailyStore();if(this.momentRecord){const draft={...this.momentRecord,...JSON.parse(JSON.stringify(this.form)),dailyVersion:2,photoFailed:this.photoFailed,original:this.form.lifeText||this.form.memoryText||this.form.note||'',eventTime:this.currentEventTime(),careSourceId:this.followupSource,careStatus:this.careStatus,revision:this.momentRecord.revision+1,draftVersion:this.momentRecord.draftVersion};store.saveDraft(draft);this.momentRecord=draft;return;}this.dailyDraftSnapshot=store.saveDailyDraft(this.selectedDateKey,this.loadedPetStage,{form:JSON.parse(JSON.stringify(this.form)),photoFailed:this.photoFailed,base:this.loadedRecordVersion,stage:this.loadedPetStage},this.dailyDraftSnapshot);}catch(error){this.dailyConflict=['DIARY_VERSION_CONFLICT','NARRATIVE_VERSION_CONFLICT','NARRATIVE_SOURCE_MISSING'].includes(error.code);this.saveError=this.dailyConflict?'另一处已有更新，当前输入尚未保存。':'草稿暂未写入本机，请保留当前页面。';}},
    saveDailyConflictCopy(){
      if(!this.dailyConflict||!this.dailyPageVisible||!isDataScopeCurrent(this.loadedDataScope)||getActivePet()?.id!==this.activePetId||this.saving||this.dailyMediaBusy||this.photoFailed)return;
      const store=this.dailyStore(),fresh=store.create(this.loadedPetStage),original=this.form.lifeText||this.form.memoryText||this.form.note||'';
      const copy={...fresh,...JSON.parse(JSON.stringify(this.form)),id:fresh.id,petId:fresh.petId,namespace:fresh.namespace,baseRevision:0,draftVersion:0,revision:0,legacy:false,dailyVersion:2,createdAt:fresh.createdAt,updatedAt:fresh.updatedAt,original,text:this.form.lifeEditedText||original,relationshipStage:this.recordStage,careSourceId:this.followupSource,careStatus:this.careStatus,eventTime:this.momentId?this.currentEventTime():{precision:'day',localDate:this.selectedDateKey,source:'user'},localDate:this.selectedDateKey};
      let saved;try{saved=store.save(copy);}catch(_){this.saveError='新记录尚未保存，请保留此页并重试。';return;}
      this.dailyLoading=true;this.dailyConflict=false;this.momentRecord=saved;this.momentId=saved.id;this.saveError='';
      uni.redirectTo({url:'/pages/calendar/calendar?recordId='+encodeURIComponent(saved.id)+'&section='+this.dailySection});
    },
    reloadDailyConflict(){
      if(!this.dailyConflict||!this.dailyPageVisible||this.saving||this.dailyMediaBusy)return;
      const epoch=this.dailyEditorEpoch,scope=this.loadedDataScope,petId=this.activePetId;
      uni.showModal({title:'重新读取已保存内容',content:'这会替换此页尚未保存的输入。要保留输入，请取消并另存为独立记录。',confirmText:'重新读取',success:result=>{
        if(!result.confirm||!this.dailyPageVisible||this.dailyEditorEpoch!==epoch||!isDataScopeCurrent(scope)||getActivePet()?.id!==petId)return;
        try{this.dailyStore().list();this.diaryMap=getDiaryMap(petId,scope,{strict:true});this.dailyEditorEpoch++;this.lastSavedInput='';this.loadSelectedRecordData({preferSaved:true});}catch(_){this.saveError='暂时无法重新读取，当前输入仍保留。';}
      }});
    },
    async loadDailyPhotos(){const ticket=++this.dailyPhotoEpoch,editor=this.dailyEditorEpoch,scope=this.loadedDataScope,id=this.activePetId,date=this.selectedDateKey,urls=[],valid=()=>ticket===this.dailyPhotoEpoch&&editor===this.dailyEditorEpoch&&isDataScopeCurrent(scope)&&id===this.activePetId&&date===this.selectedDateKey;this.dailyPhotoUrls.forEach(releaseNarrativePhoto);this.dailyPhotoUrls=[];try{for(const asset of [...(this.form.media||[])]){const result=await resolveNarrativePhoto(asset,scope,id);urls.push(result.path);if(!valid()){urls.forEach(releaseNarrativePhoto);return;}}if(valid())this.dailyPhotoUrls=urls;}catch(_){urls.forEach(releaseNarrativePhoto);if(valid())this.saveError='部分照片暂时无法读取，原记录仍保留。';}},
    uniPreviewPhoto(i){if(this.dailyPhotoUrls[i])uni.previewImage({urls:this.dailyPhotoUrls.filter(Boolean),current:this.dailyPhotoUrls[i]});},
    async addDailyPhoto(){if(this.dailyMediaBusy||!this.activePetId)return;const editor=this.dailyEditorEpoch,scope=this.loadedDataScope,id=this.activePetId,date=this.selectedDateKey,valid=()=>editor===this.dailyEditorEpoch&&isDataScopeCurrent(scope)&&id===this.activePetId&&date===this.selectedDateKey;this.dailyMediaBusy=true;try{const picked=await new Promise((success,fail)=>uni.chooseImage({count:4-(this.form.media?.length||0),success,fail}));for(const path of picked.tempFilePaths){if(!valid())return;const asset=await persistNarrativePhoto(path,scope,id);if(!valid())return;this.form.media=[...(this.form.media||[]),{...asset,purpose:this.dailySection==='health'?'care':'life'}];}if(valid()){this.photoFailed=false;await this.loadDailyPhotos();}}catch(e){if(valid()&&!String(e.errMsg||e.message).includes('cancel')){this.photoFailed=true;this.saveError='照片还没保存好，文字草稿已保留。请重试，或选择不带失败照片保存。';}}finally{if(valid()){this.dailyMediaBusy=false;this.saveDailyDraft();}}},
    removeDailyPhoto(i){this.form.media=this.form.media.filter((_,n)=>n!==i);this.loadDailyPhotos();},
    composeDay(){if(!this.saveRecord())return;uni.navigateTo({url:'/pages/card-compose/card-compose?'+(this.momentId?'recordId='+encodeURIComponent(this.momentId):'date='+this.selectedDateKey)+'&petId='+encodeURIComponent(this.activePet.id)});},
    currentEventTime(){return {precision:this.eventPrecision,source:'user',localDate:this.selectedDateKey,localTime:this.eventClock,year:this.eventYear,month:this.eventMonth,label:this.eventSeason};},
    updateEventField(key,value){this[key]=value;this.lastSavedInput='';this.saveDailyDraft();},
    startMoment(){uni.navigateTo({url:'/pages/calendar/calendar?moment=1&date='+this.selectedDateKey+'&petId='+encodeURIComponent(this.activePetId)});},
    moveDailyPhoto(i,direction){const next=i+direction;if(next<0||next>=this.form.media.length)return;const media=this.form.media.slice(),photo=media.splice(i,1)[0];media.splice(next,0,photo);this.form.media=media;this.loadDailyPhotos();},
    captionDailyPhoto(i,text){this.form.media=this.form.media.map((m,n)=>n===i?{...m,caption:text}:m);},
    classifyDailyPhoto(i,purpose){this.form.media=this.form.media.map((m,n)=>n===i?{...m,purpose}:m);},
    continueWithoutFailedPhotos(){this.photoFailed=false;this.saveDailyDraft();this.saveError='未加入的照片不会随本次记录保存。';},
    creativeCopy(key){return t('narrative.'+key);},
    openCreativeAlbum(){uni.navigateTo({url:'/pages/album/album'});},
    openCreativeRecord(id){const r=id&&this.dailyStore().open(id);uni.navigateTo({url:r?.dailyVersion===2?'/pages/calendar/calendar?recordId='+encodeURIComponent(id):'/pages/narrative/narrative?'+(id?'id='+encodeURIComponent(id):'date='+this.selectedDateKey)});},
    recordReadFailed(){this.recordReadError=true;this.dailyLoading=true;this.dailyEditorEpoch++;this.diaryMap={};this.momentRecord=null;this.doctorOpen=false;this.doctorPreview='';this.careRows=[];this.form={healthValues:{},media:[],lifeText:'',type:'',mood:'',events:[],note:'',memoryText:'',privateNote:'',source:'manual',sourceChatIds:[]};},
    loadCalendar(){this.recordReadError=false;try{this.loadCalendarData();}catch(_){this.recordReadFailed();}},
    loadCalendarData() {
      const nextScope=captureDataScope(),nextPet=getActivePet();if(this.activePetId&&(this.activePetId!==nextPet?.id||this.loadedDataScope?.version!==nextScope.version||this.loadedPetStage!==getPetRelationshipStage(nextPet))){this.momentId='';this.momentRecord=null;this.momentRequested=false;this.followupSource='';this.careStatus='';this.doctorOpen=false;this.doctorPreview='';this.careRows=[];this.doctorSelected=[];this.photoFailed=false;this.lastSavedInput='';}
      this.loadedDataScope=captureDataScope();
      const activePet = getActivePet();
      this.activePet = activePet;this.loadedPetStage=getPetRelationshipStage(activePet);this.insets=creativeInsets();this.saveError='';
      this.locale = getAppLocale();
      this.activePetId = activePet ? activePet.id : null;
      this.diaryMap = this.activePetId ? getDiaryMap(this.activePetId,this.loadedDataScope,{strict:true}) : {};
      this.reduceMotion = isReduceMotionEnabled();
      this.loadSelectedRecord();
    },
    loadSelectedRecord(){this.recordReadError=false;try{if(this.activePetId)this.dailyStore().list();this.loadSelectedRecordData();}catch(_){this.recordReadFailed();}},
    loadSelectedRecordData({preferSaved=false}={}) {
      this.sourceMissing=false;this.dailyConflict=false;
      if(this.activePetId&&(this.momentRequested||this.momentId)){
        const store=this.dailyStore();if(this.followupSource&&!store.list().some(r=>r.id===this.followupSource)){this.sourceMissing=true;this.form={media:[],events:[],healthValues:{},lifeText:''};this.saveError='原事件已不存在，请返回记录列表。';this.momentRequested=false;this.momentRecord=null;return;}let r=this.momentId?store.open(this.momentId):null;
        if(this.momentId&&!r){this.sourceMissing=true;this.saveError='来源记录已不存在，请返回陪伴册。';this.form={media:[],events:[],healthValues:{},lifeText:''};return;}
        if(preferSaved&&r){const formal=store.list().find(row=>row.id===r.id);if(formal&&formal.revision!==r.baseRevision)r=formal;}
        const created=!r;if(!r){r=store.create(this.loadedPetStage);r.dailyVersion=2;r.careSourceId=this.followupSource;r.careStatus=this.careStatus;r.localDate=this.selectedDateKey;r.eventTime={precision:'day',localDate:this.selectedDateKey,source:'user'};store.saveDraft(r);}
        this.photoFailed=!!r.photoFailed;this.followupSource=r.careSourceId||this.followupSource;this.careStatus=r.careStatus||'';this.momentRequested=false;this.momentRecord=r;this.momentId=r.id;this.dailyEditorEpoch++;this.dailyLoading=true;this.dailyMediaBusy=false;
        this.selectedDateKey=r.localDate||this.selectedDateKey;const e=r.eventTime||{precision:r.localDate?'day':'unknown'};this.eventPrecision=e.precision;this.eventYear=String(e.year||'');this.eventMonth=String(e.month||'');this.eventSeason=e.label||'';this.eventClock=e.localTime||'';
        this.form={type:'',mood:'',events:[],note:'',memoryText:'',privateNote:'',source:'manual',sourceChatIds:[],healthValues:{},media:[],lifeText:r.lifeText||'',...r};this.loadedRecordVersion=r.revision;this.loadDailyPhotos();this.$nextTick(()=>{this.dailyLoading=false;});
        // Keep a newly created H5 draft addressable across browser refresh.
        // #ifdef H5
        if(created)uni.redirectTo({url:'/pages/calendar/calendar?recordId='+encodeURIComponent(r.id)+'&section='+this.dailySection});
        // #endif
        return;
      }
      this.dailyLoading=true;const contextKey=JSON.stringify([this.loadedDataScope?.version,this.activePetId,this.selectedDateKey,this.loadedPetStage]);if(contextKey!==this.dailyContextKey){this.dailyContextKey=contextKey;this.dailyEditorEpoch++;this.dailyMediaBusy=false;}this.dailyPolishing=false;this.dailyPolishStatus="";
      if (!this.activePetId) {this.form={healthValues:{},media:[],lifeText:'',type:'',mood:'',events:[],note:'',memoryText:'',privateNote:'',source:'manual',sourceChatIds:[]};this.reflectionSuggestion=null;this.dailyLoading=false;return;}
      const record = getDiaryRecord(this.activePetId, this.selectedDateKey);
      this.loadedRecordVersion=Number(record.updatedAt||0);this.saveError='';
      this.form = {
        lifeEditedText:record.lifeEditedText??null,lifeCandidate:record.lifeCandidate||null,dailyVersion:1,lifeText:record.lifeText||"",title:record.title||"",media:record.media||[],healthValues:record.healthValues||{},
        type: record.type,
        mood: record.mood,
        events: (this.recordStage === 'deceased' ? record.reflectionTags : record.events).slice(),
        note: record.note,
        memoryText: record.memoryText,
        privateNote: record.privateNote,
        source: record.source,
        sourceChatIds: record.sourceChatIds.slice()
      };
      this.photoFailed=false;const envelope=this.dailyStore().readDailyDraft(this.selectedDateKey,this.loadedPetStage);this.dailyDraftSnapshot=envelope.snapshot;const recovered=envelope.record;if(recovered&&(!preferSaved||recovered.base===this.loadedRecordVersion)){this.form={...this.form,...recovered.form};this.dailyConflict=recovered.base!==this.loadedRecordVersion;this.loadedRecordVersion=recovered.base;this.photoFailed=!!recovered.photoFailed;}
      this.loadDailyPhotos();this.$nextTick(()=>{this.dailyLoading=false;});
      this.reflectionSuggestion = this.recordStage === 'deceased'
        ? getMemorialReflectionSuggestion(this.activePetId, this.selectedDateKey)
        : null;
    },
    hasRecord(dateKey) {
      const record = this.diaryMap[dateKey];
      return hasDiaryRecord(record);
    },
    moodColor(mood) {
      return mood?getMoodColor(mood):'#A6AA9D';
    },
    moodSoftColor(mood) {
      return `${this.moodColor(mood)}18`;
    },
    getRecordTypeLabel(type) {
      if (this.recordStage === 'deceased') {
        const option = getReflectionOption(type);
        return option ? option.label : '回忆';
      }
      const label = getRelationshipRecordTypeLabel(this.recordStage, type);
      return label === '记录' ? getEventLabel(type) : label;
    },
    reflectionTagLabel(type) {
      const option = getReflectionOption(type);
      return option ? option.label : type;
    },
    getCalendarCellLabel(calendarDate, record) {
      const lunar = calendarDate && calendarDate.lunar;
      const specialLabel = lunar && (lunar.traditionalFestival || lunar.solarFestival || lunar.solarTerm);
      if (specialLabel) return getLocalizedCalendarSecondaryLabel(calendarDate, this.locale);
      if (this.relationshipStage === 'deceased' && record && Array.isArray(record.reflectionTags) && record.reflectionTags.length) {
        const option = getReflectionOption(record.reflectionTags[0]);
        if (option) return option.shortLabel;
      }
      return getLocalizedCalendarSecondaryLabel(calendarDate, this.locale);
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
        if(this.form.type===key)this.form.type='';
        return;
      }

      this.form.events = this.form.events.concat(key);
    },
    keepReflectionSuggestion() {
      if(!isDataScopeCurrent(this.loadedDataScope))return;
      if (!this.reflectionSuggestion) return;
      const suggestion = this.reflectionSuggestion;
      this.form.events = Array.from(new Set(this.form.events.concat(suggestion.reflectionTags || [])));
      if (!this.form.memoryText) this.form.memoryText = suggestion.memoryText || '';
      this.form.source = 'chat_suggested';
      this.form.sourceChatIds = (suggestion.sourceChatIds || []).slice();
      if(!this.saveRecord())return;
      removeMemorialReflectionSuggestion(this.activePetId, this.selectedDateKey);
      this.reflectionSuggestion = null;
    },
    editReflectionSuggestion() {
      if(!isDataScopeCurrent(this.loadedDataScope))return;
      if (!this.reflectionSuggestion) return;
      const suggestion = this.reflectionSuggestion;
      this.form.events = Array.from(new Set(this.form.events.concat(suggestion.reflectionTags || [])));
      if (!this.form.memoryText) this.form.memoryText = suggestion.memoryText || '';
      this.form.source = 'chat_suggested';
      this.form.sourceChatIds = (suggestion.sourceChatIds || []).slice();
      uni.showToast({ title: '已放入下方，可继续修改', icon: 'none' });
    },
    deleteReflectionSuggestion() {
      if(!isDataScopeCurrent(this.loadedDataScope))return;
      removeMemorialReflectionSuggestion(this.activePetId, this.selectedDateKey);
      this.reflectionSuggestion = null;
    },
    saveRecord() {
      if(!isDataScopeCurrent(this.loadedDataScope))return false;
      if(this.saving||this.recordReadError)return false;
      if(this.sourceMissing){this.saveError='来源已不存在，请返回列表。';return false;}
      if(this.dailyMediaBusy||this.photoFailed){this.saveError='照片还没保存好，文字草稿已保留。请重试，或明确选择不带失败照片保存。';return false;}
      if(!this.activePetId || getActivePet()?.id!==this.activePetId || getPetRelationshipStage(getActivePet())!==this.loadedPetStage){this.saveError='当前宠物或模式已变化，请重新打开记录';return false;}
      if(!this.selectedHasRecord && !hasDailyContent(this.form)&&!(this.followupSource&&this.careStatus)){this.saveError='选择一项状态、事件或写下观察后再保存';return false;}
      this.saving=true;this.saveError='';
      try {
        this.dailyStore().list();
        if(!this.momentRecord)this.dailyStore().assertDailyDraft(this.selectedDateKey,this.loadedPetStage,this.dailyDraftSnapshot,this.loadedRecordVersion);
        else {const current=this.dailyStore().list().find(row=>row.id===this.momentRecord.id);if(current&&current.revision!==this.momentRecord.baseRevision)throw Object.assign(new Error('NARRATIVE_VERSION_CONFLICT'),{code:'NARRATIVE_VERSION_CONFLICT'});}
        const input=JSON.stringify([this.form,this.momentId?this.currentEventTime():null,this.careStatus]);if(input===this.lastSavedInput)return true;
        if(this.momentRecord){const original=this.form.lifeText||this.form.memoryText||this.form.note||'';const saved=this.dailyStore().save({...this.momentRecord,...this.form,dailyVersion:2,careSourceId:this.followupSource,careStatus:this.careStatus,original,text:this.form.lifeEditedText||original,eventTime:this.currentEventTime(),localDate:['day','exact'].includes(this.eventPrecision)?this.selectedDateKey:'',revision:this.momentRecord.revision,draftVersion:this.momentRecord.draftVersion,baseRevision:this.momentRecord.baseRevision});this.momentRecord=saved;this.lastSavedInput=input;this.diaryMap=getDiaryMap(this.activePetId);uni.showToast({title:'已记下。',icon:'success'});return true;}
        const record={...this.form,relationshipStage:this.recordStage};
        if(this.recordStage==='deceased'){record.reflectionTags=this.form.events.slice();record.events=[];}
        const saved=saveDiaryRecord(this.activePetId,this.selectedDateKey,record,{scope:this.loadedDataScope,expectedUpdatedAt:this.loadedRecordVersion,dailyDraft:{stage:this.loadedPetStage,snapshot:this.dailyDraftSnapshot}});
        this.loadedRecordVersion=saved.updatedAt;
        this.dailyDraftSnapshot='[null,null]';this.dailyConflict=false;
        try{syncCollections(this.dailyStore(),this.recordStage);}catch(_){}
        this.lastSavedInput=input;this.diaryMap=getDiaryMap(this.activePetId);successHaptic();uni.showToast({title:'已记下。',icon:'success'});return true;
      }catch(error){this.dailyConflict=['DIARY_VERSION_CONFLICT','NARRATIVE_VERSION_CONFLICT','NARRATIVE_SOURCE_MISSING'].includes(error.code);this.saveError=error.code==='NARRATIVE_DATE_INVALID'?'请核对日期；不确定时可以选择时间未知。':this.dailyConflict?'这条记录已在别处更新，当前输入仍保留。':'未能保存，请保留当前输入并重试。';return false;}
      finally{this.saving=false;}
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
.doctor-facts{padding:16px;border-radius:16px;background:var(--ui-surface);}.doctor-facts button{min-height:44px;font-size:14px;text-align:left;}.doctor-preview{display:block;white-space:pre-wrap;overflow-wrap:anywhere;font-size:16px;line-height:26px;padding:16px 0;}
.event-time-panel{margin:20px 16px;padding:20px;border-radius:24px;background:var(--ui-surface);color:var(--ui-ink);}.event-time-panel button,.photo-actions button{min-height:44px;background:transparent;color:inherit;font-size:14px;}.event-time-panel input,.daily-photos input{min-height:44px;background:var(--ui-input);color:var(--ui-ink);padding:8px;border-radius:14px;}.photo-actions{display:flex;flex-wrap:wrap;gap:8px;}
.creative-calendar{margin:16px 0;color:var(--ui-ink);}.creative-calendar button{background:transparent;color:inherit;font-size:16px;}.creative-calendar view{padding:14px 8px;line-height:1.7;border-bottom:1px solid #D9DDD1;overflow-wrap:anywhere;}
.save-error{display:block;color:var(--ui-muted);font-size:28rpx;line-height:1.6;margin:16rpx 0;}
.calendar-page {
  min-height: 100vh;
  background: var(--ui-surface);
  color: var(--ui-ink);
}

.calendar-animated-content {
  min-height: 100vh;
  padding: calc(max(var(--creative-top,0px), env(safe-area-inset-top)) + 30rpx) 30rpx calc(42rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.top-bar,
.pet-strip,
.month-head,
.week-row,
.date-grid,
.record-head {
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
  background: var(--ui-surface);
  box-shadow: 0 12rpx 30rpx rgba(58, 51, 43, 0.06);
}

.icon-button::after,
.month-arrow::after {
  border: none;
}

.icon-button-hover,
.month-arrow-hover {
  opacity: 0.78;
}

.title-copy {
  text-align: center;
}

.title-kicker {
  display: block;
  color: var(--ui-muted);
  font-size: 20rpx;
  line-height: 1.3;
}

.title-main {
  display: block;
  margin-top: 6rpx;
  color: var(--ui-ink);
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
  background: var(--ui-surface);
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
  color: var(--ui-ink);
  font-size: 30rpx;
  font-weight: 600;
  line-height: 1.25;
}

.pet-desc,
.empty-desc {
  display: block;
  margin-top: 8rpx;
  color: var(--ui-muted);
  font-size: 23rpx;
  line-height: 1.45;
}

.empty-panel {
  padding: 34rpx;
}

.empty-title {
  display: block;
  color: var(--ui-ink);
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
  color: var(--ui-ink);
  font-size: 31rpx;
  font-weight: 600;
  line-height: 1.25;
}

.month-arrow {
  width: 58rpx;
  height: 58rpx;
  border-radius: 50%;
  background: var(--ui-surface);
}

.date-grid {
  flex-wrap: wrap;
  margin-top: 8rpx;
}

.week-row {
  margin-top: 22rpx;
}

.week-label {
  width: 14.285%;
  color: var(--ui-muted);
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
  color: var(--ui-ink);
  font-size: 22rpx;
  line-height: 1.25;
  text-align: center;
}

.date-lunar {
  width: 100%;
  color: var(--ui-muted);
  font-size: 17rpx;
  line-height: 1.25;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
  color: var(--ui-ink);
}

.date-today-mark {
  position: absolute;
  top: 5rpx;
  right: 6rpx;
  color: var(--ui-muted);
  font-size: 13rpx;
  line-height: 1;
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

.date-cell-important .record-dot {
  width: 11rpx;
  height: 11rpx;
  margin-left: -5.5rpx;
  box-shadow: 0 0 0 3rpx var(--ui-card), 0 0 0 5rpx var(--ui-accent);
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
  color: var(--ui-muted);
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
  color: var(--ui-muted);
  font-size: 20rpx;
  line-height: 1.3;
}

.record-title {
  display: block;
  margin-top: 8rpx;
  color: var(--ui-ink);
  font-size: 32rpx;
  font-weight: 600;
  line-height: 1.2;
}

.record-state {
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  background: var(--ui-surface);
  color: var(--ui-muted);
  font-size: 22rpx;
  line-height: 1.2;
}

.event-section,
.note-section {
  margin-top: 30rpx;
}

.field-title {
  display: block;
  color: var(--ui-ink);
  font-size: 28rpx;
  font-weight: 600;
  line-height: 1.25;
}

.note-input {
  margin-top: 18rpx;
  width: 100%;
  min-height: 178rpx;
  padding: 22rpx;
  border-radius: 16rpx;
  background: var(--ui-surface);
  border: 1rpx solid #EEE6DA;
  color: var(--ui-ink);
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

.calendar-page {
  background: var(--pety-page-bg, #F5F2EC);
}

.calendar-animated-content {
  animation: calendarFadeUp 360ms ease both;
}

.calendar-page.theme-memorial {
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
  color: var(--ui-ink);
}

.pet-desc,
.empty-desc,
.legend-text {
  color: var(--ui-muted);
}

.month-arrow,
.record-state {
  background: var(--ui-surface);
  border-color: var(--ui-border);
}

.date-number {
  transition: transform 140ms ease, background 140ms ease;
}

.date-cell-active {
  border-color: transparent;
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
.date-cell {
  transition: transform 160ms ease, opacity 160ms ease;
}

.icon-button-hover,
.month-arrow-hover {
  transform: scale(0.94);
  opacity: 0.82;
}

.date-cell:active {
  transform: scale(0.985);
  opacity: 0.88;
}

.reflection-more-dot {
  position: absolute;
  right: 12rpx;
  bottom: 10rpx;
  width: 7rpx;
  height: 7rpx;
  border-radius: 50%;
  background: #80758F;
}

.reflection-suggestion {
  margin: 22rpx 28rpx 0;
  padding: 24rpx;
  border: 1rpx solid rgba(128, 117, 143, 0.18);
  border-radius: 24rpx;
  background: rgba(250, 249, 252, 0.78);
}

.suggestion-kicker,
.suggestion-title,
.suggestion-summary { display: block; }
.suggestion-kicker { color: var(--ui-muted); font-size: 20rpx; }
.suggestion-title { margin-top: 7rpx; color: var(--ui-ink); font-size: 27rpx; font-weight: 600; }
.suggestion-summary { margin-top: 12rpx; color: var(--ui-muted); font-size: 23rpx; line-height: 1.6; }
.suggestion-tags,
.suggestion-actions { display: flex; flex-wrap: wrap; gap: 12rpx; margin-top: 16rpx; }
.suggestion-tag { padding: 7rpx 15rpx; border-radius: 999rpx; background: rgba(128, 117, 143, 0.1); color: var(--ui-muted); font-size: 20rpx; }
.suggestion-action { min-width: 112rpx; height: 60rpx; padding: 0 20rpx; margin: 0; border-radius: 999rpx; background: rgba(128, 117, 143, 0.08); color: var(--ui-muted); font-size: 22rpx; line-height: 60rpx; }
.suggestion-action::after { border: none; }
.suggestion-action-primary { background: #625B6D; color: var(--ui-ink); }
.memorial-record-state { color: var(--ui-muted); background: rgba(128, 117, 143, 0.1); }
.private-note-section { margin-top: 18rpx; }
.private-note-input { min-height: 150rpx; }

@keyframes calendarFadeUp {
  from {
    opacity: 0;
    transform: translateY(16rpx);
  }
  to {
    opacity: 1;
    transform: none;
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
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 9000;
  background: rgba(37, 34, 31, 0.34);
  animation: pickerMaskIn 220ms ease both;
}

.picker-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9001;
  width: auto;
  max-height: 62vh;
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
  color: var(--ui-muted);
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
  color: var(--ui-muted);
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
  from { opacity: 0; transform: translateY(32rpx); }
  to { opacity: 1; transform: none; }
}

@media (prefers-reduced-motion: reduce) {
  .calendar-animated-content,
  .month-slide-left,
  .month-slide-right,
  .picker-mask,
  .picker-sheet {
    animation: none;
  }
}

.reduce-motion .calendar-animated-content,
.reduce-motion .month-slide-left,
.reduce-motion .month-slide-right {
  animation: none;
}

.reduce-motion .picker-mask,
.reduce-motion .picker-sheet {
  animation: pickerFadeIn 100ms ease both;
}

@keyframes pickerFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.creative-calendar{margin-top:36px;padding:22px 0;border-top:1px solid #d9ddd1;font-size:12px}.creative-section-label{display:block;font-size:16px;margin-bottom:8px}.creative-calendar button{display:inline-block;font-size:13px;margin:12px 14px 0 0;padding:0;background:none}
.creative-calendar>text{display:block;line-height:1.8}.creative-calendar button{padding:8px 14px!important;line-height:1.5;background:var(--ui-surface);border-radius:10px}.creative-calendar button:after{border:0}
.daily-flow{margin:24px 0 16px}.daily-kicker{display:block;font-size:24px;color:var(--ui-ink)}.daily-caption{display:block;font-size:12px;line-height:1.8;color:var(--ui-muted);margin:10px 0}.health-result{display:flex;align-items:center;gap:14px;border-bottom:1px solid #deded1;padding:12px 0}.health-result text{font-size:13px;min-width:66px}.health-result input{flex:1;min-width:0;height:36px;font-size:14px}.daily-title{height:44px;border-bottom:1px solid #e3e1d5;margin:14px 0}.daily-life-input{width:100%;min-height:170px;line-height:1.9;font-size:17px}.daily-photos{display:flex;flex-wrap:wrap;gap:10px}.daily-photos view{width:45%}.daily-photos image{width:100%;height:140px}.daily-photos button,.daily-photo-button{font-size:13px;background:var(--ui-surface);color:var(--ui-ink)}.daily-after{padding:22px 0;color:var(--ui-muted);font-size:12px}.daily-after>text{display:block}.daily-after button{display:inline-block;margin:12px 12px 0 0;font-size:13px;background:transparent;color:var(--ui-ink)}.daily-after>view{padding:14px 0;border-top:1px solid #ddd}.daily-after button:after{border:0}
.calendar-page .choice-face{color:var(--ui-muted)}.calendar-page .event-chip-active .choice-face,.calendar-page .mood-chip-active .choice-face{color:#f2f7e8}.polish-styles{display:flex;flex-wrap:wrap;gap:8px}.polish-styles button{min-height:44px;margin:0;padding:8px;font-size:14px;line-height:20px;background:var(--ui-group);color:var(--ui-muted)}.polish-styles .active{background:var(--ui-action);color:var(--ui-ink)}

.record-read-error{margin:24px 0;padding:24px 20px;border-radius:20px;background:#f5efe3;color:#403a32;display:flex;flex-direction:column;gap:14px;line-height:1.7;overflow-wrap:anywhere;font-size:calc(14px * var(--ui-font-scale,1));}.record-read-error .read-error-title{font-size:calc(20px * var(--ui-font-scale,1));font-weight:600;}.record-read-error button{margin:6px 0 0;min-height:44px;padding:10px 16px;line-height:1.5;white-space:normal;background:#596650;color:#fffdf8;border-radius:12px;font-size:inherit;}
.daily-conflict{display:flex;flex-direction:column;gap:12px;margin:20px 0;padding:18px;border:1px solid #697258;border-radius:16px;background:#34392c;color:#e5e8db;font-size:calc(14px * var(--ui-font-scale,1));line-height:1.65;overflow-wrap:anywhere}
.daily-conflict .conflict-title{font-weight:600;font-size:calc(17px * var(--ui-font-scale,1))}.daily-conflict button{box-sizing:border-box;width:100%;min-height:48px;margin:0;padding:12px 16px;font-size:inherit;line-height:1.5;white-space:normal;border-radius:10px;background:#e5e8db;color:#34392c}.daily-conflict .daily-conflict-reload{background:#424a37;color:#e5e8db}
</style>
