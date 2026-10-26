<template>
  <view :class="[petThemeClass, 'home-page ui-v2', themeClass, reduceMotion ? 'reduce-motion' : '', homeLargeText ? 'home-large-text' : '']" :style="[portraitVariables, portraitPageStyle, appThemeStyle]">
    <view v-if="heroScrollTop>210" class="home-glass-bar"><view class="compact-identity"><text class="compact-brand">归爪</text><view class="compact-divider"/><text class="compact-context">{{ isMemorialMode ? '想念与珍藏' : '日常与陪伴' }}</text></view><button @click="showMenu" aria-label="更多操作"><uni-icons type="more-filled" size="22" color="currentColor"/></button></view><scroll-view scroll-y class="home-scroll" @scroll="heroScrollTop=$event.detail.scrollTop">
      <view class="home-shell">
        <!-- Locked hero composition: see AGENTS.md and the user reference dated 2026-10-22. -->
        <view class="pet-home-intro" :class="{'extended-name': Array.from(petName || '').length > 6 || homeLargeText}" :style="portraitVariables">
        <view class="brand-masthead"><text class="brand-wordmark">归爪</text><text class="brand-signature">LUMIÈRE PET</text><AppButton variant="icon" class="brand-switch" aria-label="更多操作" icon="more-filled" @click="showMenu"/></view>
        <view class="home-header">
          <view class="header-copy">
            <text class="header-kicker">{{ greetingText }}</text>
            <text class="pet-name">{{ petName }}</text>
            <text class="hero-note">{{ isMemorialMode ? '熟悉的片段，\n都在这里。' : '今天的你，\n也值得好好记着。' }}</text>
          </view>
        </view>

        <view :class="['companion-hero-section', homeHeroAsset.hasCutout ? 'character-ready' : 'character-fallback', 'integrated-stage']" :style="portraitVariables">
          <view class="pet-stage-area" >
            <PetPortraitStage :active="pageVisible" :variant="petThemeMode === 'space' ? 'space' : 'home'" :reduce-motion="reduceMotion" ref="portrait" v-if="!homeHeroAsset.hasCutout" :key="`${loadedDataScope?.version}:${homeHeroAsset.petId}:${homeHeroAsset.masterFileId}`" :pet-id="homeHeroAsset.petId" :master-key="homeHeroAsset.masterFileId" :asset-key="homeHeroAsset.displayFileId" :image-url="homeHeroAsset.imageUrl" @asset-retry="retryHeroPreview" @palette="onPortraitPalette" @tap="handleHeroTap" @asset-loaded="onHeroAssetLoaded" @asset-error="onHeroAssetError" />
            <PetAvatarHero v-else
              ref="hero"
              placement="card-overlap"
              :key="`${loadedDataScope?.version}:${homeHeroAsset.petId}:${homeHeroAsset.masterFileId}`"
              :pet-id="activePet && activePet.id || ''"
              :master-key="homeHeroAsset.masterFileId"
              :asset-key="`${homeHeroAsset.petId || ''}:${homeHeroAsset.displayFileId || homeHeroAsset.assetKind}`"
              :image-url="homeHeroAsset.imageUrl"
              :asset-kind="homeHeroAsset.assetKind"
              :has-cutout="homeHeroAsset.hasCutout"
              :image-width="homeHeroAsset.assetMetadata.width"
              :image-height="homeHeroAsset.assetMetadata.height"
              :alpha-bounds="homeHeroAsset.assetMetadata.alphaBoundingBox"
              :memorial="isMemorialMode"
              :reduce-motion="reduceMotion || !pageVisible"
              @tap="handleHeroTap"
              @asset-error="onHeroAssetError"
              @asset-loaded="onHeroAssetLoaded"
            />
          </view>
        </view>

        </view>
        <view class="home-floor"><AppSurface v-if="!isMemorialMode" variant="primary" class="today-panel">
          <view class="today-panel-head">
            <view class="today-copy">
              <view class="today-meta"><text class="today-date">{{ todayDateText }}</text><text class="today-state">{{todayStateText}}</text></view>
              <text v-if="!todayHasContent" class="today-title">{{ todayPanelTitle }}</text>
            </view>
            <view :class="['today-status-dot', hasTodayRecord ? 'today-status-dot-active' : '']"></view>
          </view>

          <view class="today-actions"><AppButton variant="primary" icon="compose" class="today-primary-action" @click="handleCoreAction('journal')">{{isMemorialMode?narrativeCopy('write'):'记录今天'}}</AppButton><AppButton v-if="!isMemorialMode" icon="chatbubble" class="care-consult" @click="handleCoreAction('chat')">AI 问诊</AppButton></view>
        </AppSurface>
        <view v-else class="memorial-arrival">
          <text class="memorial-invitation">不必说什么，也可以待一会儿。</text>
          <view class="today-actions"><AppButton variant="primary" icon="heart" @click="openAlbum">翻开回忆册</AppButton><AppButton icon="compose" @click="openLifeRecord">写一封信</AppButton></view>
        </view></view>

        <view class="life-section">
          <view class="life-title-row"><text class="life-heading">{{isMemorialMode?'关于它的片段':'陪伴册'}}</text><button @click="openAlbum">{{isMemorialMode?'慢慢翻阅':'查看全部'}} <uni-icons type="right" size="14" color="currentColor"/></button></view>
          <HomeLifePreview v-if="pageVisible" :key="loadedDataScope?.version+':'+activePet?.id" :pet="activePet" :refresh="homeContentRevision" @album="openAlbum"/>
          <text v-if="homeHasWork" class="home-work-label">{{isMemorialMode?'珍藏的文字与作品':'整理好的作品'}}</text>
          <HomeAlbumCover v-if="pageVisible" :key="loadedDataScope?.version+':'+activePet?.id" :pet="activePet" @availability="homeHasWork=$event" @open="openHomeWork"/>
        </view>

        <view v-if="!isMemorialMode" class="home-week">
          <view class="home-week-head">
            <button class="week-arrow" hover-class="week-arrow-active" aria-label="上一周" @click="changeHomeWeek(-1)">
              <uni-icons type="left" size="16" :color="headerIconColor"></uni-icons>
            </button>
            <button class="week-title-button" hover-class="week-title-active" @click="openCalendar">
              <text class="week-title">{{ homeWeekTitle }}</text>
              <text class="week-view-all">查看整月</text>
            </button>
            <button class="week-arrow" hover-class="week-arrow-active" aria-label="下一周" @click="changeHomeWeek(1)">
              <uni-icons type="right" size="16" :color="headerIconColor"></uni-icons>
            </button>
          </view>
          <view class="home-week-grid">
            <view
              v-for="item in homeWeekDays"
              :key="item.dateKey"
              :class="[
                'home-week-day',
                item.isToday ? 'home-week-day-today' : '',
                item.isSelected ? 'home-week-day-selected' : '',
                item.hasRecord ? 'home-week-day-recorded' : ''
              ]"
              @click="selectHomeDate(item)"
            >
              <text class="home-week-label">{{ item.isToday ? '今天' : item.weekday }}</text>
              <text class="home-week-solar">{{ item.solar }}</text>
              <text class="home-week-lunar">{{ item.lunar }}</text>
              <view v-if="item.hasRecord" class="home-week-record-dot"></view>
            </view>
          </view>
        </view>

        <view class="home-utilities"><AppSettingsRow title="专属形象" icon="image" action @click="handleShortcut('portrait')"/><AppSettingsRow title="宠物档案与展示设置" icon="folder-add" action @click="openArchive"/><AppSettingsRow v-if="isMemorialMode" title="历史健康资料" icon="calendar" action @click="openCalendar"/></view>
        <companion-prompt :pet="activePet" :refresh="heroRequestId" />
      </view>
    </scroll-view>
  </view>
</template>

<script>
import HomeAlbumCover from '../../components/HomeAlbumCover.vue';
import HomeLifePreview from '../../components/HomeLifePreview.vue';
import { getActivePet, updateActivePet, subscribePetSelection } from '../../common/pet-store.js';
import { formatDateKey, getDiaryMap, getDiaryRecord, getEventLabel, getMoodLabel, hasDiaryRecord, isHealthDiaryRecord } from '../../common/diary-store.js';
import { getDailyHomeCopy } from '../../common/home-daily-copy.js';
import { isDevelopmentEnvironment } from '../../common/dev-flags.js';
import { getCalendarDateState, getCalendarWeek } from '../../common/lunar-calendar.js';
import { getPetProfile } from '../../common/profile-store.js';
import { getPetRelationshipStage, getRelationshipThemeClass, setRelationshipTabBar } from '../../common/relationship-config.js';
import { isReduceMotionEnabled } from '../../common/haptics.js';
import { getAppLocale, t } from '../../common/i18n.js';
import { openMemorialPersona, scheduleMemorialPersonaIntro } from '../../common/memorial-persona.js';
import { subscribeAvatarAssets, invalidateAvatarUrl, getAvatarAssetHashPrefix } from '../../common/avatar-display-asset.js';
import { hydrateHeroVisualAsset, resolveHeroVisualAsset } from '../../common/home-hero-asset.js';
import {rememberPetTheme,applyNativePetTheme,setThemePet} from '../../common/pet-app-theme.js';
import {scopedStorage,captureDataScope,isDataScopeCurrent} from '../../common/scoped-storage.js';
import { getAvatarCutoutStatus, prepareAvatarHeroDisplay, retryAvatarCleanup, startAvatarCutout } from '../../common/pet-avatar-generator.js';
import PetAvatarHero from '../../components/PetAvatarHero.vue';
import PetPortraitStage from '../../components/PetPortraitStage.vue';
import { DEFAULT_STAGE_PALETTE, stageVariables, readStagePalette } from '../../common/pet-stage-palette.js';

const ONBOARDING_SEEN_KEY = 'guizhua_onboarding_seen';
const ONBOARDING_PENDING_KEY = 'guizhua_onboarding_pending';
const HOME_HERO_PIPELINE_VERSION = 6;
const HOME_HERO_GENERATION_VERSION = 'hero-character-magenta-v3';

export default {
  components: { HomeAlbumCover, HomeLifePreview, PetAvatarHero, PetPortraitStage },
  data() {
    return {
      activePet: null,
      portraitPalette: null,
      displayedPortrait: null,
      stageUrlRecoveryTimer:null,
      stageUrlRecoveryAttempts:0,
      heroScrollTop:0,homeHasWork:false,
      hydratedHeroAsset: null,
      heroAssetRevision: 0,
      unsubscribeHeroAssets: null,
      unsubscribePetSelection:null,
      loadedDataScope:null,
      heroHandoff: null,
      avatarDebugTapCount: 0,
      avatarDebugTapTimer: null,
      avatarCutoutPollTimer: null,
      avatarCleanupInFlight: '',
      avatarAssetRefreshInFlight: '',
      pageVisible: false,
      avatarOwnerEpoch: 0,
      heroRequestId: 0,
      homeContentRevision: 0,
      heroRecoveryAttempts: {},
      petName: '毛孩子',
      homeLargeText: false,
      profile: {},
      todayRecord: null,
      todayCreative: false,
      diaryMap: {},
      homeWeekDate: new Date(),
      selectedHomeDateKey: formatDateKey(),
      reduceMotion: isReduceMotionEnabled(),
      personaIntroTimer: null,
      petStats: {
        days: 0,
        moments: 0,
        chats: 0
      }
    };
  },
  computed: {
    greetingText() {
      if(this.isMemorialMode)return '想念，也是一种陪伴';
      const hour = new Date().getHours();
      return hour < 11 ? '早上好，' : hour < 18 ? '午后好，' : '晚上好，';
    },
    homeShortcuts() {
      return [{key:'portrait',icon:'camera',label:'专属形象'},{key:'chat',icon:this.isMemorialMode?'heart':'chatbubble',label:this.isMemorialMode?'说说想念':'AI 问诊'},{key:'journal',icon:'calendar',label:this.isMemorialMode?'写下想念':'健康打卡'},{key:'archive',icon:'folder-add',label:'宠物档案'}];
    },
    activeRelationshipStage() {
      return getPetRelationshipStage(this.activePet);
    },
    isMemorialMode() {
      return this.activeRelationshipStage === 'deceased';
    },
    themeClass() {
      return getRelationshipThemeClass(this.activeRelationshipStage);
    },
    headerKicker() {
      return this.isMemorialMode ? '温柔纪念' : '正在陪伴';
    },
    headerIconColor() {
      return '#BCC4AE';
    },
    hasGeneratedAvatar() {
      return Boolean(this.activePet && this.activePet.avatarStatus === 'ready' && this.activePet.generatedAvatarFileId);
    },
    heroCardKicker() {
      if (!this.activePet) return '专属伙伴';
      return this.isMemorialMode ? '今天的想念' : '今日陪伴';
    },
    heroCardTitle() {
      if (!this.activePet) return '先认识一位新朋友';
      return this.isMemorialMode ? '想念一直都在' : '今天也陪着你';
    },
    heroCardActionText() {
      return this.isMemorialMode ? t('narrative.write') : '健康打卡';
    },
    portraitPaletteValue() {
      const asset=this.homeHeroAsset;
      const cached=readStagePalette(`${asset.petId}::${asset.masterFileId}::${asset.displayFileId}`);
      return this.portraitPalette?.owner === `${this.activePet?.id}:${asset.masterFileId}` ? this.portraitPalette.value : cached || DEFAULT_STAGE_PALETTE;
    },
    portraitVariables() {return stageVariables(this.portraitPaletteValue);},
    portraitTextureStyle() {
      const asset=this.homeHeroAsset,loaded=this.displayedPortrait;
      const retained=loaded?.petId===asset.petId&&loaded?.masterFileId===asset.masterFileId?loaded.imageUrl:'';
      const url=asset.imageUrl||retained;
      return {backgroundImage:url?`url(${JSON.stringify(url)})`:'none'};
    },
    spaceReservedHeader() {return this.petThemeMode==='space' && (this.homeLargeText || Array.from(this.petName||'').length>12 || this.portraitPaletteValue.headerSafe!==true);},
    portraitPageStyle() {return {backgroundColor:'var(--ui-page)'};},
    homeHeroAsset() {
      const pet = this.activePet || {};
      this.heroAssetRevision;
      // Hydration can finish without a cache notification (for example a deduped refresh).
      // Re-evaluate on that result too; ownership still comes from the shared selector.
      this.hydratedHeroAsset;
      return resolveHeroVisualAsset(pet);
    },
    shouldShowPetImage() {
      return this.hasGeneratedAvatar;
    },
    companionLine() {
      if (!this.activePet) return '建立档案后，归爪会把照片、记录和故事慢慢收好。';
      return getDailyHomeCopy({
        petId: this.activePet.id,
        petName: this.petName,
        relationshipStage: this.activeRelationshipStage,
        date: new Date()
      });
    },
    todayStateText(){return this.isMemorialMode?'':this.hasTodayRecord?'已记录健康观察':hasDiaryRecord(this.todayRecord)||this.todayCreative?'已留下日常':'留下一刻就好';},
    todayHasContent(){return hasDiaryRecord(this.todayRecord)||this.todayCreative;},
    todayPanelTitle() {
      if (!this.activePet) return '先建立档案，今天就有地方安放。';
      if (this.isMemorialMode) return t('narrative.quietVisit');
      return hasDiaryRecord(this.todayRecord)||this.todayCreative ? '今天的日常，已收好。' : '把今天，留在这里。';
    },
    hasTodayRecord() {
      return this.isMemorialMode ? hasDiaryRecord(this.todayRecord) : isHealthDiaryRecord(this.todayRecord);
    },
    todayDateText() {
      const date = new Date();
      const weekLabels = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
      return `${date.getMonth() + 1}月${date.getDate()}日 · ${weekLabels[date.getDay()]}`;
    },
    todayPrimaryText() {
      return this.isMemorialMode ? '写下今天的想念' : '健康打卡';
    },
    homeWeekTitle() {
      const first = this.homeWeekDays[0];
      const last = this.homeWeekDays[6];
      if (!first || !last) return '';
      if (first.year === last.year && first.month === last.month) {
        return `${first.month}月`;
      }
      if (first.year === last.year) return `${first.month}月 · ${last.month}月`;
      return `${first.year}年${first.month}月 - ${last.year}年${last.month}月`;
    },
    homeWeekDays() {
      return getCalendarWeek(this.homeWeekDate).map(calendarDate => {
        const dateKey = calendarDate.dateKey;
        const state = getCalendarDateState(calendarDate.date, {
          selectedDateKey: this.selectedHomeDateKey,
          hasRecord: isHealthDiaryRecord(this.diaryMap[dateKey])
        });
        return {
          dateKey,
          year: calendarDate.year,
          month: calendarDate.month,
          weekday: calendarDate.weekdayShortLabel,
          solar: calendarDate.dayNumber,
          lunar: calendarDate.secondaryLabel,
          ...state
        };
      });
    },
    secondaryActions() {
      if (this.isMemorialMode) {
        return [
          { key: 'chat', icon: 'chatbubble', title: '和他/她说说话', desc: '把今天想说的慢慢告诉他/她' },
          { key: 'archive', icon: 'folder-add', title: '查看档案', desc: '回看真实留下的故事和资料' }
        ];
      }
      return [
        { key: 'chat', icon: 'chatbubble', title: 'AI 问诊', desc: '整理症状、观察点和就医问题' },
        { key: 'archive', icon: 'folder-add', title: '查看档案', desc: '补充身体、习惯和关系信息' }
      ];
    },
    recentRecordTitle() {
      if (!hasDiaryRecord(this.todayRecord)) return this.isMemorialMode ? '今天还没有回忆记录' : '今天还没有记录';
      return this.isMemorialMode ? '今天的想念已收好' : '今天已经有记录';
    },
    recentRecordDesc() {
      if (!hasDiaryRecord(this.todayRecord)) return this.isMemorialMode ? '可以从一句想说的话开始。' : '可以从饮食、精神或一个小片段开始。';
      const events = this.todayRecord.events || [];
      if (events.length) return events.slice(0, 2).map(getEventLabel).join('、');
      return getMoodLabel(this.todayRecord.mood);
    },
    lightReminder() {
      if (!this.activePet) {
        return { key: 'archive', title: '先完善一份生命档案', desc: '名字、生日和照护信息会慢慢汇在这里。' };
      }

      if (this.isMemorialMode) {
        const memorialPool = [
          { title: '写下一件今天想起他/她的小事', desc: '一句话也可以，真实的片段会慢慢组成你们的故事。' },
          { title: '整理一张和他/她有关的照片', desc: '为照片补一句当时发生的事。' },
          { title: '记录他/她的一个习惯', desc: '那些熟悉的小动作，也值得被好好留下。' },
          { title: '写一句想对他/她说的话', desc: '不必完整，先把此刻的想念放下来。' },
          { title: '补充他/她的性格和小动作', desc: '这些细节会让回忆整理得更真实。' }
        ];
        return { key: 'calendar', ...memorialPool[new Date().getDate() % memorialPool.length] };
      }

      if (!this.profile.weight) {
        return { key: 'archive', title: '可以补充体重', desc: '体重、疫苗和过敏信息会帮助后续照护判断。' };
      }
      if (!this.profile.vaccineDate || !this.profile.dewormDate) {
        return { key: 'archive', title: '补充疫苗 / 驱虫信息', desc: '这些日期会让后续提醒更准确。' };
      }
      if (!this.profile.birthday) {
        return { key: 'archive', title: '完善生日或到家日', desc: '归爪会帮你记住重要日子。' };
      }
      if (!this.activePet.originalPhotoUrl) {
        return { key: 'photo', title: '上传一张近照', desc: '近照能帮助你回看它最近的变化。' };
      }

      const dailyPool = [
        { title: '记录一次便便情况', desc: '颜色、形态和频率，常常能反映身体变化。' },
        { title: '记录今天的精神状态', desc: '一句话也可以，长期看会很有用。' }
      ];
      return { key: 'calendar', ...dailyPool[new Date().getDate() % dailyPool.length] };
    },
    recentInfo() {
      if (hasDiaryRecord(this.todayRecord)) {
        return {
          key: 'calendar',
          icon: this.isMemorialMode ? 'heart' : 'calendar',
          title: this.recentRecordTitle,
          desc: this.recentRecordDesc
        };
      }
      return {
        key: this.lightReminder.key,
        icon: this.isMemorialMode ? 'heart' : 'info',
        title: this.lightReminder.title,
        desc: this.lightReminder.desc
      };
    }
  },
  watch: {
    'homeHeroAsset.imageUrl'(url) {
      if(url){clearTimeout(this.stageUrlRecoveryTimer);return;}
      if(this.pageVisible && this.activePet?.generatedAvatarFileId)
        this.scheduleStageUrlRecovery(this.activePet,this.heroRequestId);
    }
  },
  onShow() {
    try{const info=uni.getSystemInfoSync();this.homeLargeText=Number(info.fontSizeSetting)>18||Number(info.fontScale)>1.15;}catch(e){}
    this.avatarOwnerEpoch += 1;
    this.pageVisible = true;
    if(!this.unsubscribePetSelection)this.unsubscribePetSelection=subscribePetSelection((petId,change)=>{
      // Native tab pages can paint their retained view before onShow reaches it.
      // Keep the hidden view owned by the selected pet; same-owner returns stay cached.
      if(change?.scopeChanged||petId!==this.activePet?.id)this.loadHomeData();
    });
    if (!this.unsubscribeHeroAssets) this.unsubscribeHeroAssets = subscribeAvatarAssets(petId => { if (this.activePet && this.activePet.id === petId) this.heroAssetRevision += 1; });
    this.loadHomeData();
    this.refreshPendingAvatarAsset();
    // Browsing memories does not require setting up a conversation persona.
    // The existing archive/chat entry remains available when the user wants it.
    this.$nextTick(() => {
      this.maybeShowOnboardingGuide();
      this.$refs?.portrait?.resume();
    });
  },
  onHide() {
    clearTimeout(this.stageUrlRecoveryTimer);
    this.avatarOwnerEpoch += 1;
    this.pageVisible = false;
    if (this.unsubscribeHeroAssets) this.unsubscribeHeroAssets();
    this.unsubscribeHeroAssets = null;
    this.heroRequestId += 1;
    this.clearPersonaIntroTimer();
    this.clearAvatarCutoutPoll();
    this.clearAvatarDebugTapTimer();
  },
  onUnload() {
    this.unsubscribePetSelection?.();this.unsubscribePetSelection=null;
    clearTimeout(this.stageUrlRecoveryTimer);
    this.avatarOwnerEpoch += 1;
    this.pageVisible = false;
    if (this.unsubscribeHeroAssets) this.unsubscribeHeroAssets();
    this.unsubscribeHeroAssets = null;
    this.heroRequestId += 1;
    this.clearPersonaIntroTimer();
    this.clearAvatarCutoutPoll();
    this.clearAvatarDebugTapTimer();
  },
  methods: {
    openPetSwitcher(){uni.switchTab({url:'/pages/profile/profile'});},
    handleShortcut(key){if(key==='portrait')this.openAvatarGenerate();else this.handleCoreAction(key);},
    async retryHeroPreview(){
      const pet=this.activePet;if(!pet||!this.pageVisible)return;
      const requestId=++this.heroRequestId;
      this.heroRecoveryAttempts={};this.stageUrlRecoveryAttempts=0;
      const asset=await hydrateHeroVisualAsset(pet,{userRetry:true,forceRefresh:true});
      if(requestId!==this.heroRequestId||!this.isCurrentAvatarOwner(pet))return;
      this.hydratedHeroAsset=asset;this.heroAssetRevision++;
    },
    onPortraitPalette(event) {
      if(!isDataScopeCurrent(this.loadedDataScope)||!isDataScopeCurrent(event.dataScope))return;
      if(!this.pageVisible)return;
      if(event.petId !== this.activePet?.id || event.masterKey !== this.homeHeroAsset.masterFileId || event.imageUrl !== this.homeHeroAsset.imageUrl) return;
      this.portraitPalette={owner:`${event.petId}:${event.masterKey}`,value:event.palette};
      if(rememberPetTheme(this.activePet,event.palette,event.dataScope))applyNativePetTheme();
    },
    async onHeroAssetError(event) {
      let pet = this.activePet;
      if (!pet || !event || event.petId !== pet.id || event.masterKey !== this.homeHeroAsset.masterFileId || event.imageUrl !== this.homeHeroAsset.imageUrl || !this.pageVisible) return;
      const failed = this.homeHeroAsset;
      invalidateAvatarUrl(pet.id, failed.displayFileId, failed.imageUrl);
      const fileId = failed.displayFileId || failed.imageUrl;
      const key = `${pet.id}::${fileId}`;
      this.heroRecoveryAttempts[key] = (this.heroRecoveryAttempts[key] || 0) + 1;
      const excludedFileIds = Object.keys(this.heroRecoveryAttempts)
        .filter(item => item.startsWith(`${pet.id}::`) && this.heroRecoveryAttempts[item] > 1)
        .map(item => item.slice(pet.id.length + 2));
      const requestId = ++this.heroRequestId;
      this.heroHandoff = null;
      try {
        const asset = await hydrateHeroVisualAsset(pet, { forceRefresh: true, excludedFileIds });
        if (requestId !== this.heroRequestId || !this.isCurrentAvatarOwner(pet)) return;
        this.hydratedHeroAsset = asset;
        this.heroAssetRevision += 1;
        if(!asset.imageUrl)this.scheduleStageUrlRecovery(pet,requestId);
      } catch (error) {
        if (requestId === this.heroRequestId && this.isCurrentAvatarOwner(pet)) this.hydratedHeroAsset = resolveHeroVisualAsset(pet);
      }
    },
    onHeroAssetLoaded(event) {
      const asset = this.homeHeroAsset;
      if (!this.pageVisible || event.petId !== this.activePet?.id ||
        event.masterKey !== asset.masterFileId || event.imageUrl !== asset.imageUrl) return;
      this.displayedPortrait={petId:asset.petId,masterFileId:asset.masterFileId,imageUrl:asset.imageUrl};
      if (!isDevelopmentEnvironment()) return;
      const metadata = asset.assetMetadata || {};
      const receipt = { petId: event.petId, fileIdHash: getAvatarAssetHashPrefix(asset.displayFileId),
        sourceType: asset.assetKind, loaded: true, hasAlpha: asset.alphaValid === true,
        qualified: asset.qualityAccepted === true, fallbackReason: asset.fallbackReason || '',
        width: metadata.width, height: metadata.height, bytes: metadata.bytes, mime: metadata.mime,
        cutoutStatus: asset.cutoutStatus, heroJob: this.activePet?.generatedAvatarHeroGenerationStatus,
        renderTreatment: asset.renderTreatment, urlRuntime: asset.urlRuntime, at: Date.now() };
      scopedStorage.setStorageSync('pety_hero_render_receipt', receipt);
      console.info('[AvatarHeroRendered] ' + JSON.stringify(receipt));
    },
    logAvatarDisplay(asset = this.homeHeroAsset) {
      if (!isDevelopmentEnvironment()) return;
      console.info('[AvatarUrlState] ' + JSON.stringify({petId:asset.petId,selectedPetId:getActivePet()?.id,fileHash:getAvatarAssetHashPrefix(asset.displayFileId),kind:asset.assetKind,hasUrl:Boolean(asset.imageUrl),boundPetId:this.homeHeroAsset.petId,boundHasUrl:Boolean(this.homeHeroAsset.imageUrl),fallbackReason:asset.fallbackReason || 'NONE'}));
      console.info('[AvatarDisplay]', {
        masterReady: Boolean(asset && asset.masterFileId),
        cutoutStatus: asset && asset.cutoutStatus || 'NOT_CONFIGURED',
        cutoutReady: Boolean(asset && asset.hasCutout && asset.imageUrl),
        heroAssetKind: asset && asset.assetKind || (asset && asset.masterFileId ? 'final' : 'placeholder'),
        alphaValid: Boolean(asset && asset.alphaValid),
        localCutoutUsed: Boolean(asset && asset.assetKind === 'local-cutout'),
        featherFallbackUsed: Boolean(asset && asset.assetKind === 'feathered-final'),
        width: Number(asset && asset.assetMetadata && asset.assetMetadata.width) || 0,
        height: Number(asset && asset.assetMetadata && asset.assetMetadata.height) || 0,
        bytes: Number(asset && asset.assetMetadata && asset.assetMetadata.bytes) || 0,
        mime: asset && asset.assetMetadata && asset.assetMetadata.mime || '',
        wasReencoded: Boolean(asset && asset.wasReencoded),
        wasDownscaled: Boolean(asset && asset.wasDownscaled),
        providerOriginal: Boolean(asset && asset.providerOriginal),
        qualityReason: asset && asset.qualityReason || ''
      });
    },
    clearAvatarCutoutPoll() {
      if (this.avatarCutoutPollTimer) clearTimeout(this.avatarCutoutPollTimer);
      this.avatarCutoutPollTimer = null;
    },
    scheduleAvatarCutoutPoll(delay = 3000) {
      this.clearAvatarCutoutPoll();
      if (!this.pageVisible) return;
      this.avatarCutoutPollTimer = setTimeout(() => this.refreshPendingAvatarAsset(), delay);
    },
    async refreshPendingAvatarAsset() {
      const pet = this.activePet;
      if (!pet || !pet.generatedAvatarCutoutJobId || !this.isCurrentAvatarOwner(pet)) return;
      const refreshKey = `${pet.id}:${pet.generatedAvatarCutoutJobId}:${pet.generatedAvatarFileId || ''}`;
      if (this.avatarAssetRefreshInFlight === refreshKey) return;
      this.avatarAssetRefreshInFlight = refreshKey;
      try {
        await this.runPendingAvatarAssetRefresh();
      } finally {
        if (this.avatarAssetRefreshInFlight === refreshKey) this.avatarAssetRefreshInFlight = '';
      }
    },
    async runPendingAvatarAssetRefresh() {
      // Studio presentation never starts a paid character job on page entry.
      // Existing character assets remain selectable when a master is unavailable.
      return;
    },
    async runOptionalCharacterAssetRefresh() {
      let pet = this.activePet;
      if (!pet || !pet.generatedAvatarCutoutJobId || !this.isCurrentAvatarOwner(pet)) return;
      const owner = pet;
      const ownerEpoch = this.avatarOwnerEpoch;
      const ownsRefresh = () => ownerEpoch === this.avatarOwnerEpoch && this.isCurrentAvatarOwner(owner);
      const needsTight = (pet.generatedAvatarCutoutFileId && pet.generatedAvatarCutoutTightMetrics?.sourceFileId !== pet.generatedAvatarCutoutFileId) ||
        (pet.generatedAvatarLocalCutoutFileId && pet.generatedAvatarLocalCutoutTightMetrics?.sourceFileId !== pet.generatedAvatarLocalCutoutFileId);
      const hasQualifiedCharacterAsset = Boolean(
        (pet.generatedAvatarHeroFileId && pet.generatedAvatarHeroMetrics?.qualified === true) ||
        (pet.generatedAvatarCutoutTightFileId && pet.generatedAvatarCutoutTightMetrics?.qualified === true) ||
        (pet.generatedAvatarLocalCutoutTightFileId && pet.generatedAvatarLocalCutoutTightMetrics?.qualified === true) ||
        (pet.generatedAvatarCutoutFileId && pet.generatedAvatarCutoutMetrics?.qualified === true) ||
        (pet.generatedAvatarLocalCutoutFileId && pet.generatedAvatarLocalCutoutMetrics?.qualified === true)
      );
      const heroEngineReady = String(pet.generatedAvatarCutoutEngine || '').startsWith('hero-character-');
      const needsHeroStart = heroEngineReady && pet.generatedAvatarCutoutStatus === 'PENDING' &&
        !['PROCESSING', 'RUNNING', 'SUCCEEDED'].includes(pet.generatedAvatarHeroGenerationStatus);
      const needsHeroUpgrade = !hasQualifiedCharacterAsset && (
        Number(pet.generatedAvatarCutoutPipelineVersion || 0) < HOME_HERO_PIPELINE_VERSION ||
        (heroEngineReady && pet.generatedAvatarCutoutStatus === 'FAILED' && pet.generatedAvatarHeroPromptRevision !== 'background-only-v1' &&
          ['HERO_TECHNICAL_BACKGROUND_INVALID', 'HERO_CHROMA_CUTOUT_FAILED', 'HERO_CHROMA_EDGE_CONTAMINATION'].includes(pet.generatedAvatarHeroGenerationErrorCode)) ||
        (heroEngineReady && pet.generatedAvatarHeroGenerationVersion !== HOME_HERO_GENERATION_VERSION)
      );
      const needsProviderConfigCheck = !hasQualifiedCharacterAsset && pet.generatedAvatarCutoutEngine !== 'aliyun-viapi' && !heroEngineReady;
      if (pet.generatedAvatarHeroAssetVersion !== 3 || pet.generatedAvatarHeroDisplayPreparedFor !== pet.generatedAvatarFileId || needsTight || needsHeroStart || needsHeroUpgrade || needsProviderConfigCheck) {
        try {
          const prepared = await prepareAvatarHeroDisplay(pet.id, pet.generatedAvatarCutoutJobId);
          if (!ownsRefresh()) return;
          if (prepared) {
            await this.applyAvatarAssetResult(prepared, pet);
            if (!ownsRefresh()) return;
            pet = this.activePet;
          }
        } catch (error) {
          if (!ownsRefresh()) return;
          this.activePet = updateActivePet({ generatedAvatarHeroGenerationErrorCode: error?.code || 'HERO_PREPARE_FAILED' }) || this.activePet;
          this.scheduleAvatarCutoutPoll(4500);
          return;
        }
      }
      if (!ownsRefresh()) return;
      const cleanupKey = `${pet.id}:${pet.generatedAvatarCutoutJobId}`;
      if (pet.generatedAvatarCleanupPending && this.avatarCleanupInFlight !== cleanupKey) {
        this.avatarCleanupInFlight = cleanupKey;
        retryAvatarCleanup(pet.id, pet.generatedAvatarCutoutJobId).then(result => {
          if (result && result.cleanupPending === false && ownsRefresh()) {
            this.activePet = updateActivePet({ generatedAvatarCleanupPending: false }) || this.activePet;
          }
        }).catch(() => {}).finally(() => {
          if (this.avatarCleanupInFlight === cleanupKey) this.avatarCleanupInFlight = '';
        });
      }
      // Even a ready cached Hero reconciles with the server on page entry: CPU-only
      // quality repairs can publish a new immutable file without a new generation.
      const isPendingCutout = ['PENDING', 'PROCESSING', 'RUNNING'].includes(pet.generatedAvatarCutoutStatus);
      const needsDisplayDerivative = !pet.generatedAvatarLocalCutoutFileId && !pet.generatedAvatarFeatheredDisplayFileId;
      const needsQualityInspection = (pet.generatedAvatarCutoutFileId && pet.generatedAvatarCutoutMetrics?.qualityVersion !== 2) ||
        (pet.generatedAvatarLocalCutoutFileId && pet.generatedAvatarLocalCutoutMetrics?.qualityVersion !== 2);
      if (!isPendingCutout) {
        // The device may have cached FAILED before a server-side recovery finished.
        // Reconcile confirmed jobs on page entry without submitting another job.
        try {
          const latest = await getAvatarCutoutStatus(pet.id, pet.generatedAvatarCutoutJobId);
          if (!ownsRefresh()) return;
          await this.applyAvatarAssetResult(latest, pet);
          if (ownsRefresh() && ['PENDING', 'PROCESSING', 'RUNNING'].includes(latest?.cutoutStatus)) this.scheduleAvatarCutoutPoll();
        } catch (error) {
          if (ownsRefresh()) this.scheduleAvatarCutoutPoll(4500);
        }
        return;
      }
      try {
      if (pet.generatedAvatarCutoutStatus === 'PENDING' || needsDisplayDerivative || needsQualityInspection) {
        const started = await startAvatarCutout(pet.id, pet.generatedAvatarCutoutJobId);
        if (!ownsRefresh()) return;
        await this.applyAvatarAssetResult(started, pet);
        if (started && started.cutoutStatus === 'NOT_CONFIGURED') {
          return;
        }
      }
        const result = await getAvatarCutoutStatus(pet.id, pet.generatedAvatarCutoutJobId);
        if (!result || !ownsRefresh()) return;
		await this.applyAvatarAssetResult(result, pet);
        if (!ownsRefresh()) return;
        if (result.cutoutStatus === 'SUCCEEDED' && result.cutoutFileId) {
          return;
        }
        if (result.cutoutStatus === 'FAILED') {
          this.activePet = updateActivePet({ generatedAvatarCutoutStatus: 'FAILED' }) || this.activePet;
          return;
        }
        if (result.cutoutStatus === 'NOT_CONFIGURED') {
          this.activePet = updateActivePet({ generatedAvatarCutoutStatus: 'NOT_CONFIGURED' }) || this.activePet;
          return;
        }
        this.scheduleAvatarCutoutPoll();
      } catch (error) {
        if (ownsRefresh()) {
          this.activePet = updateActivePet({
            generatedAvatarHeroGenerationErrorCode: error?.code || 'HERO_START_FAILED'
          }) || this.activePet;
          if (isDevelopmentEnvironment()) console.warn('[AvatarHeroStart]', error?.code || error?.message || error);
          this.scheduleAvatarCutoutPoll(4500);
        }
      }
    },
    isCurrentAvatarOwner(pet) {
      if(!isDataScopeCurrent(this.loadedDataScope))return false;
      const stored = getActivePet();
      return Boolean(this.pageVisible && pet && pet.id && this.activePet && stored && stored.id === pet.id &&
        this.activePet.id === pet.id && this.activePet.generatedAvatarCutoutJobId === pet.generatedAvatarCutoutJobId &&
        this.activePet.generatedAvatarFileId === pet.generatedAvatarFileId && stored.generatedAvatarFileId === pet.generatedAvatarFileId);
    },
    async applyAvatarAssetResult(result, expectedPet = this.activePet) {
      if (!result || !this.isCurrentAvatarOwner(expectedPet)) return;
      if (result.finalFileId && result.finalFileId !== expectedPet.generatedAvatarFileId) return;
      const patch = {
        generatedAvatarDerivedFromFileId: expectedPet.generatedAvatarFileId,
        generatedAvatarHeroFileId: result.heroFileId ?? this.activePet.generatedAvatarHeroFileId ?? '',
        generatedAvatarHeroMetrics: result.heroMetrics ?? this.activePet.generatedAvatarHeroMetrics ?? null,
        generatedAvatarHeroAssetVersion: Number(result.heroAssetVersion || this.activePet.generatedAvatarHeroAssetVersion) || 0,
        generatedAvatarHeroDisplayPreparedFor: result.heroDisplayPreparedFor || this.activePet.generatedAvatarHeroDisplayPreparedFor || '',
        generatedAvatarHeroGenerationStatus: result.heroGenerationStatus || this.activePet.generatedAvatarHeroGenerationStatus || 'NOT_STARTED',
        generatedAvatarHeroGenerationVersion: result.heroGenerationVersion || this.activePet.generatedAvatarHeroGenerationVersion || '',
        generatedAvatarHeroGenerationErrorCode: result.heroGenerationErrorCode || '',
        generatedAvatarHeroGenerationPhase: result.heroGenerationPhase || this.activePet.generatedAvatarHeroGenerationPhase || 'NOT_STARTED',
        generatedAvatarHeroGenerationRequestId: result.heroGenerationRequestId || this.activePet.generatedAvatarHeroGenerationRequestId || '',
        generatedAvatarHeroPromptRevision: result.heroPromptRevision || this.activePet.generatedAvatarHeroPromptRevision || '',
        generatedAvatarHeroProviderSourceMetadata: result.heroProviderSourceMetadata || this.activePet.generatedAvatarHeroProviderSourceMetadata || null,
        generatedAvatarCutoutTightFileId: result.cutoutTightFileId || '',
        generatedAvatarCutoutTightMetrics: result.cutoutTightMetrics || null,
        generatedAvatarLocalCutoutTightFileId: result.localCutoutTightFileId || '',
        generatedAvatarLocalCutoutTightMetrics: result.localCutoutTightMetrics || null,
        generatedAvatarCutoutStatus: result.cutoutStatus || this.activePet.generatedAvatarCutoutStatus,
        generatedAvatarCutoutErrorCode: result.cutoutErrorCode || '',
        generatedAvatarCutoutPipelineVersion: Number(result.cutoutPipelineVersion || this.activePet.generatedAvatarCutoutPipelineVersion) || 0,
        generatedAvatarCutoutEngine: result.cutoutEngine || this.activePet.generatedAvatarCutoutEngine || 'unknown',
        generatedAvatarSemanticCutoutAvailable: typeof result.semanticCutoutAvailable === 'boolean' ? result.semanticCutoutAvailable : this.activePet.generatedAvatarSemanticCutoutAvailable === true,
        generatedAvatarCutoutFileId: result.cutoutFileId || this.activePet.generatedAvatarCutoutFileId || '',
        generatedAvatarCutoutUrl: result.cutoutUrl || this.activePet.generatedAvatarCutoutUrl || '',
        generatedAvatarCutoutAlphaValid: typeof result.cutoutAlphaValid === 'boolean' ? result.cutoutAlphaValid : this.activePet.generatedAvatarCutoutAlphaValid === true,
        generatedAvatarDisplayFileId: result.displayFileId || this.activePet.generatedAvatarDisplayFileId || '',
        generatedAvatarDisplayUrl: result.displayUrl || this.activePet.generatedAvatarDisplayUrl || '',
        generatedAvatarThumbnailFileId: result.thumbnailFileId || this.activePet.generatedAvatarThumbnailFileId || '',
        generatedAvatarThumbnailUrl: result.thumbnailUrl || this.activePet.generatedAvatarThumbnailUrl || '',
        generatedAvatarFeatheredDisplayFileId: result.featheredDisplayFileId || this.activePet.generatedAvatarFeatheredDisplayFileId || '',
        generatedAvatarFeatheredDisplayUrl: result.featheredDisplayUrl || this.activePet.generatedAvatarFeatheredDisplayUrl || '',
        generatedAvatarLocalCutoutFileId: result.localCutoutFileId || this.activePet.generatedAvatarLocalCutoutFileId || '',
        generatedAvatarLocalCutoutUrl: result.localCutoutUrl || this.activePet.generatedAvatarLocalCutoutUrl || '',
        generatedAvatarLocalCutoutAlphaValid: typeof result.localCutoutAlphaValid === 'boolean' ? result.localCutoutAlphaValid : this.activePet.generatedAvatarLocalCutoutAlphaValid === true,
        generatedAvatarLocalCutoutMetrics: result.localCutoutMetrics || this.activePet.generatedAvatarLocalCutoutMetrics || null,
        generatedAvatarCutoutMetrics: result.cutoutAlphaMetrics || this.activePet.generatedAvatarCutoutMetrics || null,
        generatedAvatarDisplayDimensions: result.displayDimensions || this.activePet.generatedAvatarDisplayDimensions || null,
        generatedAvatarMainAssetMetadata: result.mainAssetMetadata || this.activePet.generatedAvatarMainAssetMetadata || null
      };
      this.activePet = updateActivePet(patch) || this.activePet;
      const requestId = ++this.heroRequestId;
      const asset = await hydrateHeroVisualAsset(this.activePet);
      if (requestId !== this.heroRequestId || !this.isCurrentAvatarOwner(expectedPet)) return;
      this.hydratedHeroAsset = asset;
      if (this.hydratedHeroAsset && this.hydratedHeroAsset.imageUrl) this.heroHandoff = null;
      this.logAvatarDisplay(this.hydratedHeroAsset);
      if (!this.hydratedHeroAsset?.imageUrl) this.scheduleAvatarCutoutPoll(32000);
    },
    clearPersonaIntroTimer() {
      if (!this.personaIntroTimer) return;
      clearTimeout(this.personaIntroTimer);
      this.personaIntroTimer = null;
    },
    schedulePersonaIntro() {
      this.clearPersonaIntroTimer();
      if (!this.activePet) return;
      const petId = this.activePet.id;
      const stage = this.activeRelationshipStage;
      this.personaIntroTimer = scheduleMemorialPersonaIntro({
        petId,
        relationshipStage: stage,
        delay: 420,
        isStillCurrent: () => Boolean(
          this.activePet &&
          this.activePet.id === petId &&
          this.activeRelationshipStage === stage
        ),
        onStart: () => openMemorialPersona(petId)
      });
    },
    maybeShowOnboardingGuide() {
      if (!isDataScopeCurrent(this.loadedDataScope)) return;
      if (scopedStorage.getStorageSync(ONBOARDING_SEEN_KEY)) return;

      const pendingAfterCreate = Boolean(scopedStorage.getStorageSync(ONBOARDING_PENDING_KEY));
      const firstEnterWithoutPet = !this.activePet;
      if (!pendingAfterCreate && !firstEnterWithoutPet) return;

      scopedStorage.setStorageSync(ONBOARDING_SEEN_KEY, true);
      scopedStorage.removeStorageSync(ONBOARDING_PENDING_KEY);
      const locale = getAppLocale();
      uni.showModal({
        title: t(pendingAfterCreate ? 'home.onboardingReadyTitle' : 'home.onboardingStartTitle', {}, locale),
        content: t(pendingAfterCreate ? 'home.onboardingReadyText' : 'home.onboardingStartText', {}, locale),
        cancelText: t('home.onboardingLater', {}, locale),
        confirmText: t('home.onboardingConfirm', {}, locale),
        showCancel: true
      });
    },
    loadHomeData() {
      this.homeContentRevision += 1;
      const nextScope=captureDataScope(),scopeChanged=!isDataScopeCurrent(this.loadedDataScope);
      if(scopeChanged){
        this.avatarOwnerEpoch+=1;
        this.hydratedHeroAsset=null;this.heroHandoff=null;this.displayedPortrait=null;this.portraitPalette=null;
        this.clearPersonaIntroTimer();this.clearAvatarCutoutPoll();
      }
      this.loadedDataScope=nextScope;
      this.homeHasWork=false;
      clearTimeout(this.stageUrlRecoveryTimer);
      this.stageUrlRecoveryAttempts=0;
      const requestId = ++this.heroRequestId;
      const previousPetId = this.activePet && this.activePet.id;
      const previousAsset = this.hydratedHeroAsset;
      const activePet = getActivePet();
      if (!activePet || activePet.id !== previousPetId) {
        this.heroRecoveryAttempts = {};
        this.hydratedHeroAsset = null;
        this.heroHandoff = null;
      }
      this.activePet = activePet;
      setThemePet(activePet);
      setRelationshipTabBar(getPetRelationshipStage(activePet));

      if (!activePet) {
        this.hydratedHeroAsset = null;
        this.heroHandoff = null;
        this.petName = '毛孩子';
        this.profile = {};
        this.todayRecord = null;
        this.todayCreative = false;
        this.diaryMap = {};
        this.petStats = { days: 0, moments: 0, chats: 0 };
        return;
      }

      this.petName = activePet.name || '毛孩子';
      const expectedPetId = activePet.id;
      const expectedAsset = resolveHeroVisualAsset(activePet);
      this.heroHandoff = null;
      if (previousPetId === expectedPetId && previousAsset && previousAsset.displayFileId === expectedAsset.displayFileId && previousAsset.imageUrl) {
        this.hydratedHeroAsset = previousAsset;
      } else {
        this.hydratedHeroAsset = null;
      }
      hydrateHeroVisualAsset(activePet).then(asset => {
        if (requestId === this.heroRequestId && this.isCurrentAvatarOwner(activePet)) {
          this.hydratedHeroAsset = asset;
          this.heroAssetRevision += 1;
          this.logAvatarDisplay(asset);
          if(!asset.imageUrl)this.scheduleStageUrlRecovery(activePet,requestId);
        }
      }).catch(() => {});
      this.profile = getPetProfile(activePet.id);
      this.todayRecord = getDiaryRecord(activePet.id, formatDateKey());
      this.todayCreative = Object.values(scopedStorage.getStorageSync('pet_diaries_' + activePet.id + '_creative_v1')?.records || {}).some(record => record.kind === 'life' && record.localDate === formatDateKey());
      this.diaryMap = getDiaryMap(activePet.id);
      this.reduceMotion = isReduceMotionEnabled();
      this.petStats = this.calculatePetStats(activePet);
    },
    scheduleStageUrlRecovery(owner,requestId,attempt=0) {
      if(this.stageUrlRecoveryAttempts>=3||!owner.generatedAvatarFileId)return;
      clearTimeout(this.stageUrlRecoveryTimer);
      this.stageUrlRecoveryTimer=setTimeout(async()=>{
        if(requestId!==this.heroRequestId||!this.isCurrentAvatarOwner(owner))return;
        if(resolveHeroVisualAsset(owner).imageUrl)return;
        this.stageUrlRecoveryAttempts++;
        const asset=await hydrateHeroVisualAsset(owner,{forceRefresh:true}).catch(()=>null);
        if(requestId!==this.heroRequestId||!this.isCurrentAvatarOwner(owner))return;
        if(asset){this.hydratedHeroAsset=asset;this.heroAssetRevision++;}
        if(!asset?.imageUrl)this.scheduleStageUrlRecovery(owner,requestId,attempt+1);
      },[1500,5000,15000][this.stageUrlRecoveryAttempts]);
    },
    calculatePetStats(pet) {
      const createdAt = pet.createdAt || Date.now();
      const days = Math.max(1, Math.ceil((Date.now() - createdAt) / 86400000));
      const diary = scopedStorage.getStorageSync('pet_diaries_' + pet.id) || {};
      const moments = Object.keys(diary).length;
      const chatHistory = scopedStorage.getStorageSync('chat_history_' + pet.id) || [];
      const chats = chatHistory.filter(msg => msg.type === 'user').length;
      return { days, moments, chats };
    },
    showMenu() {
      uni.showActionSheet({
        itemList: ['编辑当前宝贝', '查看档案'],
        success: (res) => {
          if (res.tapIndex === 0) {
            uni.reLaunch({ url: '/pages/welcome/welcome?mode=edit' });
            return;
          }
          this.openArchive();
        }
      });
    },
    handleCoreAction(key) {
      if (key === 'journal') {
        if (!this.activePet?.id) { uni.reLaunch({url:'/pages/welcome/welcome'});return; }
        if (this.isMemorialMode) this.openLifeRecord();
        else uni.navigateTo({ url: '/pages/calendar/calendar?date=' + formatDateKey() + '&petId=' + encodeURIComponent(this.activePet.id) });
        return;
      }
      if (key === 'chat') {
        if (this.isMemorialMode) {
          scopedStorage.setStorageSync('pending_chat_prompt', `我今天有点想${this.petName}，想慢慢整理一下。`);
        }
        uni.switchTab({ url: '/pages/chat/chat' });
        return;
      }
      if (key === 'archive') this.openArchive();
    },
    handleInfoCard(key) {
      if (key === 'calendar') {
        this.openCalendar();
        return;
      }
      if (key === 'photo') {
        uni.reLaunch({ url: '/pages/welcome/welcome?mode=edit' });
        return;
      }
      this.openArchive();
    },
    narrativeCopy(key) { return t('narrative.'+key); },
    openLifeRecord() { uni.navigateTo({url:'/pages/narrative/narrative'}); },
    openHomeWork(id){uni.navigateTo({url:'/pages/card-compose/card-compose?work='+encodeURIComponent(id)});},
    openAlbum() { uni.navigateTo({url:'/pages/album/album'}); },
    openAvatarGenerate() {
      if (!this.activePet?.id) { uni.reLaunch({url:'/pages/welcome/welcome'}); return; }
      uni.navigateTo({ url: `/pages/avatar-generate/avatar-generate?petId=${encodeURIComponent(this.activePet.id)}` });
    },
    handleHeroTap() {
      if (!isDevelopmentEnvironment()) return;
      this.avatarDebugTapCount += 1;
      this.clearAvatarDebugTapTimer();
      if (this.avatarDebugTapCount < 5) {
        this.avatarDebugTapTimer = setTimeout(() => { this.avatarDebugTapCount = 0; }, 3500);
        return;
      }
      this.avatarDebugTapCount = 0;
      const asset = this.homeHeroAsset;
      const metadata = asset.assetMetadata || {};
      uni.showModal({
        title: 'Avatar Debug',
        content: [
          `CURRENT PET: ${this.activePet && this.activePet.id || 'none'}`,
          `HERO SOURCE: ${asset.assetKind || 'placeholder'}`,
          `FILE: ${getAvatarAssetHashPrefix(asset.displayFileId)}`,
          `URL RUNTIME: ${asset.urlRuntime || 'unknown'}`,
          `EDGE GATE: ${metadata.edgeQuality ? (metadata.edgeQuality.qualified ? 'PASS' : 'REJECT') : 'LEGACY'}`,
          `EDGE SPILL / FOG: ${metadata.edgeQuality?.spillRatio ?? 'n/a'} / ${metadata.edgeQuality?.fogRatio ?? 'n/a'}`,
          `ALPHA MODE: ${metadata.edgeQuality?.alphaMode || 'unknown'}`,
          `CUTOUT: ${asset.cutoutStatus || 'NONE'}`,
          `CUTOUT ENGINE: ${this.activePet?.generatedAvatarCutoutEngine || 'unknown'}`,
          `CUTOUT PIPELINE: ${Number(this.activePet?.generatedAvatarCutoutPipelineVersion) || 0}`,
          `HERO JOB: ${this.activePet?.generatedAvatarHeroGenerationStatus || 'NOT_STARTED'}`,
          `HERO JOB VERSION: ${this.activePet?.generatedAvatarHeroGenerationVersion || 'none'}`,
          `HERO JOB ERROR: ${this.activePet?.generatedAvatarHeroGenerationErrorCode || 'none'}`,
          `HERO JOB PHASE: ${this.activePet?.generatedAvatarHeroGenerationPhase || 'NOT_STARTED'}`,
          `HERO REQUEST: ${this.activePet?.generatedAvatarHeroGenerationRequestId || 'none'}`,
          `CUTOUT ERROR: ${this.activePet?.generatedAvatarCutoutErrorCode || 'none'}`,
          `PROVIDER SOURCE: ${this.activePet?.generatedAvatarHeroProviderSourceMetadata?.mime || 'none'} ${Number(this.activePet?.generatedAvatarHeroProviderSourceMetadata?.width) || 0}x${Number(this.activePet?.generatedAvatarHeroProviderSourceMetadata?.height) || 0} alpha=${this.activePet?.generatedAvatarHeroProviderSourceMetadata?.alphaChannel === true}`,
          `SEMANTIC READY: ${this.activePet?.generatedAvatarSemanticCutoutAvailable === true}`,
          `CHARACTER ALPHA VALID: ${asset.hasCutout && asset.alphaValid === true}`,
          `qualified: ${asset.hasCutout && asset.qualityAccepted === true}`,
          `CHARACTER QUALIFIED: ${asset.hasCutout && asset.qualityAccepted === true}`,
          `fallbackReason: ${asset.fallbackReason || 'NONE'}`,
          `LOCAL CUTOUT: ${asset.assetKind === 'local-cutout'}`,
          `FEATHER FALLBACK: ${asset.assetKind === 'feathered-final'}`,
          `WIDTH: ${Number(metadata.width) || 0}`,
          `HEIGHT: ${Number(metadata.height) || 0}`,
          `sourceType: ${asset.imageUrl && (this.$refs?.portrait?.ready || this.$refs?.hero?.currentReady) ? asset.assetKind : 'placeholder'}`,
          `hasAlpha: ${metadata.hasAlpha === true}`,
          `alphaCoverage: ${metadata.alphaCoverage ?? 'unknown'}`,
          `alphaBoundingBox: ${JSON.stringify(metadata.alphaBoundingBox || null)}`,
          `contentWidth: ${metadata.contentWidth ?? 'unknown'}`,
          `contentHeight: ${metadata.contentHeight ?? 'unknown'}`,
          `transparentPaddingRatio: ${metadata.transparentPaddingRatio ?? 'unknown'}`,
          `renderTreatment: ${asset.renderTreatment || (asset.hasCutout ? 'transparent-character' : asset.imageUrl ? 'interactive-portrait' : 'placeholder')}`,
          `BYTES: ${Number(metadata.bytes) || 0}`,
          `MIME: ${metadata.mime || 'unknown'}`,
          `EXT: ${metadata.extension || 'unknown'}`,
          `REENCODED: ${asset.wasReencoded === true}`,
          `DOWNSCALED: ${asset.wasDownscaled === true}`,
          `PROVIDER ORIGINAL: ${asset.providerOriginal === true}`,
          `QUALITY: ${asset.qualityReason || 'unknown'}`,
          'SURFACE: home hero',
          `STAGE PALETTE: ${this.portraitPalette?.value?.family || 'neutral'} / ${this.portraitPalette?.value?.confidence ?? 0}`,
          `EDGE EXTENSION: ${this.portraitPalette?.value?.blend === true}`,
          'AUTO CHARACTER GENERATION: OFF',
          `ASSET ROLE: ${asset.assetRole || 'unknown'}`,
          `POLICY: ${asset.policyVersion || 'unknown'}`,
          `CACHE: ${asset.cacheHit ? 'hit' : 'miss'}`,
          `HYDRATION: ${Number(asset.hydrationMs) || 0} ms`
        ].join('\n'),
        showCancel: false
      });
    },
    clearAvatarDebugTapTimer() {
      if (this.avatarDebugTapTimer) clearTimeout(this.avatarDebugTapTimer);
      this.avatarDebugTapTimer = null;
    },
    openCalendar() {
      uni.navigateTo({ url: '/pages/calendar/calendar' });
    },
    openArchive() {
      uni.navigateTo({ url: '/pages/archive/archive' });
    },
    changeHomeWeek(step) {
      const date = new Date(this.homeWeekDate);
      date.setDate(date.getDate() + (step * 7));
      this.homeWeekDate = date;
    },
    selectHomeDate(item) {
      if (!this.activePet?.id) { uni.reLaunch({url:'/pages/welcome/welcome'});return; }
      this.selectedHomeDateKey = item.dateKey;
      uni.navigateTo({ url: `/pages/calendar/calendar?date=${item.dateKey}&petId=${encodeURIComponent(this.activePet.id)}` });
    }
  }
};
</script>

<style scoped>
.home-page{height:100vh;overflow:hidden;color:var(--ui-ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif}
.home-scroll{height:100%;width:100%}.home-shell{padding:0 var(--ui-gutter) calc(40px + env(safe-area-inset-bottom));background:var(--ui-page)}
.pet-home-intro{position:relative;margin:0 calc(-1 * var(--ui-gutter));padding-top:var(--status-bar-height,0px);background:var(--stage-top)}
.brand-masthead{position:relative;z-index:5;display:flex;align-items:center;gap:12px;height:64px;padding:0 var(--ui-gutter)}.brand-wordmark{font-family:'Songti SC',serif;font-size:30px;letter-spacing:2px;color:#f2f4ea}.brand-signature{font-size:10px;letter-spacing:2px;color:#f2f4ea}.brand-switch{margin-left:auto;color:#f2f4ea}
.home-header{position:absolute;z-index:4;top:calc(var(--status-bar-height,0px) + 96px);left:var(--ui-gutter);width:35%;pointer-events:none}.header-copy{min-width:0}.header-kicker{display:block;font-size:16px;line-height:24px;color:#383b31}.pet-name{display:block;font-size:34px;line-height:1.25;font-weight:600;margin-top:12px;color:#f5f4e9;text-shadow:0 1px 8px rgba(26,28,20,.22);overflow-wrap:anywhere;word-break:normal}.hero-note{display:block;font-size:14px;line-height:22px;margin-top:26px;color:#383b31;white-space:pre-line}
.companion-hero-section.integrated-stage{position:relative;margin-top:-48px;height:calc(100vw - 26px);max-height:554px;width:100%;background:var(--stage-surface);border-radius:0;overflow:hidden;isolation:isolate}.pet-stage-area{position:absolute;inset:0;width:100%;height:100%}.character-ready .pet-stage-area{left:14%;width:86%}.character-fallback .pet-stage-area{left:0;width:100%}
.extended-name .home-header{position:relative;top:auto;left:auto;width:auto;margin:10px var(--ui-gutter) 16px}.extended-name .pet-name{margin-top:6px}.extended-name .hero-note{margin-top:10px}.extended-name .companion-hero-section.integrated-stage{margin-top:0}
.home-glass-bar{position:fixed;z-index:30;inset:0 0 auto;box-sizing:border-box;padding:calc(var(--status-bar-height,0px) + 4px) var(--ui-gutter) 4px;display:flex;gap:12px;align-items:center;justify-content:space-between;background:#25241e;border-bottom:1px solid rgba(221,228,202,.07);color:var(--ui-ink);min-height:56px}.compact-identity{display:flex;align-items:center;gap:14px;flex:1;min-width:0}.compact-brand{flex-shrink:0;font-family:'Songti SC',serif;font-size:22px;letter-spacing:2px}.compact-divider{width:1px;height:16px;background:var(--ui-line);flex-shrink:0}.compact-context{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;color:var(--ui-muted)}.home-glass-bar button{display:flex;align-items:center;justify-content:center;flex-shrink:0;width:44px;min-height:44px;background:transparent;margin:0;padding:0;color:var(--ui-muted)}button:after{border:0}
.home-floor{position:relative;margin:0 calc(-1 * var(--ui-gutter));padding:16px var(--ui-gutter) 20px;background:linear-gradient(180deg,transparent,#514b3d 55%,var(--ui-page)),var(--stage-floor)}.home-floor:after{content:"";position:absolute;bottom:0;left:0;right:0;height:24px;background:linear-gradient(transparent,var(--ui-page));pointer-events:none}.memorial-arrival{position:relative;background:var(--ui-page);border:1px solid var(--ui-line);border-radius:24px;padding:20px 16px}.today-panel{position:relative;margin-top:0;border:1px solid var(--ui-line);box-shadow:none}.today-panel-head{display:block}.today-copy{width:100%}.today-meta{display:flex;justify-content:space-between;gap:8px;align-items:baseline;flex-wrap:wrap}.today-date,.today-state{font-size:12px;line-height:20px;color:var(--ui-muted)}.today-title{display:block;font-size:20px;line-height:28px;font-weight:500;margin:10px 0 16px}.today-status-dot{display:none}.today-actions{display:flex;gap:12px}.today-panel .today-actions{margin-top:14px}.today-actions :deep(.ui-button){flex:1;min-width:0;white-space:normal;height:auto;min-height:48px;padding-top:10px;padding-bottom:10px}.memorial-arrival{padding:20px 16px}.memorial-invitation{display:block;text-align:center;font-size:14px;line-height:24px;color:var(--ui-muted);margin:0 0 18px}
.life-section{padding:12px 0 24px}.life-heading{display:block;font-size:calc(20px * var(--ui-font-scale,1));line-height:1.5;font-weight:500;letter-spacing:1px}.life-title-row{display:flex;gap:12px;justify-content:space-between;align-items:center;margin-bottom:4px}.life-title-row button{display:flex;align-items:center;gap:4px;flex-shrink:0;background:none;color:var(--ui-muted);font-size:calc(12px * var(--ui-font-scale,1));line-height:22px;margin:0;padding:11px 0 11px 12px;min-height:44px}.home-work-label{display:block;font-size:13px;color:var(--ui-muted);margin-top:24px;padding-top:18px;border-top:1px solid var(--ui-line)}
.home-week{padding:22px 0 10px;border-top:1px solid rgba(221,228,202,.08)}.home-week-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}.week-arrow{width:44px;height:44px;padding:0;margin:0;display:flex;align-items:center;justify-content:center;background:transparent}.week-title-button{margin:0;padding:0;min-height:44px;display:flex;align-items:center;gap:10px;background:none;line-height:1.5;color:var(--ui-ink)}.week-title{display:block;font-size:18px;font-weight:500}.week-view-all{display:block;font-size:11px;color:var(--ui-muted)}.home-week-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}.home-week-day{position:relative;min-height:82px;padding:10px 0 12px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:7px;border-radius:18px}.home-week-label,.home-week-lunar{font-size:11px;line-height:14px;color:var(--ui-muted)}.home-week-solar{font-size:20px;line-height:24px;font-variant-numeric:tabular-nums}.home-week-day-selected{background:var(--ui-primary);color:var(--ui-paper)}.home-week-day-selected .home-week-label,.home-week-day-selected .home-week-lunar{color:var(--ui-paper)}.home-week-day-today:not(.home-week-day-selected){box-shadow:inset 0 0 0 1px var(--ui-line)}.home-week-record-dot{position:absolute;bottom:4px;width:4px;height:4px;background:currentColor;border-radius:50%}
.home-utilities{display:block;margin-top:24px;border-radius:20px;border:1px solid rgba(221,228,202,.08);background:linear-gradient(120deg,#303027,#2b2b23);overflow:hidden}.home-utilities :deep(.ui-settings-row){min-height:72px;padding:14px 16px;border-bottom:0}.home-utilities :deep(.ui-settings-row + .ui-settings-row){position:relative}.home-utilities :deep(.ui-settings-row + .ui-settings-row):before{content:'';position:absolute;top:0;left:64px;right:16px;height:1px;background:rgba(221,228,202,.08)}.home-utilities :deep(.ui-settings-title){font-size:calc(14px * var(--ui-font-scale,1));line-height:1.6}
.home-large-text .pet-name{font-size:40px}.home-large-text .hero-note,.home-large-text .header-kicker{font-size:18px;line-height:28px}.home-large-text .today-actions,.home-page.ui-large-text .today-actions{flex-direction:column}
@media(min-width:600px){.home-shell{max-width:560px;margin:auto}.companion-hero-section.integrated-stage{height:534px}}
.home-page :deep(.portrait-placeholder){background:transparent;color:var(--stage-ink)}.home-page :deep(.placeholder-note){color:var(--stage-ink)}.home-page :deep(.placeholder-mark){border-color:var(--ui-line)}
/* #ifdef H5 */
.home-page{height:calc(100vh - var(--window-bottom,0px))}
/* #endif */
</style>
