<template>
  <view :class="[petThemeClass, 'avatar-page', { 'generation-immersive': isProcessing }, reduceMotion ? 'reduce-motion' : '']" :style="[workbenchPalette ? {backgroundColor:workbenchPalette.page} : {}, appThemeStyle, isProcessing ? {backgroundColor: '#111c21'} : {}]">
    <view class="page-shell">
      <view class="page-nav">
        <button class="back-button" hover-class="tap-small" @click="goBack">‹</button>
        <text class="nav-kicker">{{ copy.kicker }}</text>
        <text v-if="quotaText" class="quota-text">{{ quotaText }}</text>
      </view>

      <view class="top-copy">
        <text class="title">{{ pageTitle }}</text>
        <text class="subtitle">{{ pageSubtitle }}</text>
      </view>

      <template v-if="phase === 'select'">
        <view class="photo-slots">
          <view v-for="index in 3" :key="index" class="photo-slot" hover-class="slot-tap" @click="onSlotTap(index - 1)">
            <image v-if="selectedPhotos[index - 1]" :src="selectedPhotos[index - 1].path" class="slot-image" mode="aspectFill" @error="onSourcePhotoError(index - 1)"></image>
            <view v-else class="slot-empty"><text class="slot-plus">＋</text></view>
            <button v-if="selectedPhotos[index - 1]" class="remove-photo" @click.stop="removePhoto(index - 1)">×</button>
          </view>
        </view>
        <text class="photo-hint">{{ copy.photoHint }}</text>
        <view class="portrait-invitation"><text class="invitation-kicker">A PORTRAIT, ONLY YOURS</text><text class="invitation-title">{{ locale === 'en' ? 'Familiar eyes. A little light.' : '熟悉的眼神，独一份的光。' }}</text><text class="invitation-note">{{ locale === 'en' ? 'Keep a little of today, always.' : '为它留下一幅，属于你们的肖像。' }}</text></view>
        <button class="primary-button" :disabled="!selectedPhotoPaths.length || actionLocked || entitlementLoading" :loading="entitlementLoading" hover-class="button-tap" @click="requestGeneration('initial')">{{ copy.generate }}</button>
      </template>

      <template v-else>
        <view :class="['avatar-preview-shell', 'ai-stage', isProcessing ? 'is-processing' : 'is-result']">
          <PetPortraitStage :active="pageVisible" :reduce-motion="reduceMotion" v-if="stageImage" :pet-id="pet && pet.id || ''" :master-key="visibleResultJobId" :asset-key="visibleResultJobId" :image-url="stageImage" variant="workbench" @palette="onWorkbenchPalette" @tap="handleWorkbenchDebugTap" @asset-error="onStageImageError" @asset-retry="retryResultPreview" />
          <image v-if="preloadCandidateUrl" :key="preloadRequestId" :data-request-id="preloadRequestId" :data-url="preloadCandidateUrl" :src="preloadCandidateUrl" class="result-preloader" mode="aspectFit" @load="onResultPreloaded" @error="onResultPreloadFailed"></image>
          <view class="stage-shade"></view>
          <PetGenerationParticles
            ref="particles"
            class="particles"
            :class="{ 'particles-hidden': !isProcessing }"
            :active="pageVisible && isProcessing"
            :progress="experienceProgress"
            :density="320"
            :completing="resultStage === 'RESULT_REVEALING'"
            :motion-reduced="reduceMotion"
            @lifecycle-mounted="particleMountCount += 1"
          />
          <view v-if="isProcessing" class="generation-progress-track" role="progressbar" :aria-valuenow="Math.round(experienceProgress)" aria-valuemin="0" aria-valuemax="100"><view class="generation-progress-fill" :style="{width: progressPercentText}"></view></view>
          <view v-if="isProcessing" class="stage-progress">
            <view class="progress-copy">
              <text class="progress-title">{{ progressText }}</text>
              <text class="progress-caption">{{ progressCaption }}</text>
            </view>
            <text class="progress-percent">{{ progressPercentText }}</text>
          </view>
        </view>

        <view v-if="isProcessing" class="processing-actions">
          <text class="generation-dedication">{{ locale === 'en' ? 'A little light. A one-of-a-kind companion.' : '每一个小小的它，都值得被认真珍藏。' }}</text>
          <text v-if="phase === 'uploading'" class="upload-status">{{ uploadStatusText }}</text>
          <template v-if="phase === 'loading' && preloadFailed">
            <text class="background-hint">{{ copy.previewPreparing }}</text>
            <button class="light-button" hover-class="button-tap" @click="retryResultPreview">{{ copy.previewRetry }}</button>
          </template>
          <template v-else-if="!['loading', 'revealing'].includes(phase)">
            <button class="light-button" hover-class="button-tap" @click="continueInBackground">{{ copy.background }}</button>
            <text class="background-hint">{{ copy.backgroundHint }}</text>
          </template>
        </view>

        <view v-else-if="phase === 'result'" class="workbench-actions">
          <text class="workbench-question">{{ resultQuestion }}</text>
          <view v-if="candidates.length > 1" class="history-block">
            <text class="section-label">{{ copy.history }}</text>
            <scroll-view class="history-scroll" scroll-x>
              <view class="history-row">
                <view v-for="candidate in candidates" :key="candidate.jobId" class="candidate" :class="{ selected: candidate.jobId === selectedJobId, previewed: candidate.jobId === previewJobId }" @click="chooseCandidate(candidate)">
                  <image :src="getCandidateThumbnailUrl(candidate)" :data-url="getCandidateThumbnailUrl(candidate)" :data-asset-key="candidateThumbnailKey(candidate)" class="candidate-image" mode="aspectFill" @error="onCandidateThumbnailError(candidate, $event)"></image>
                </view>
              </view>
            </scroll-view>
          </view>
          <text v-if="resultStage === 'RESULT_LOADING'" class="background-hint">{{ copy.previewPreparing }}</text>
          <button v-if="preloadFailed" class="light-button" :disabled="actionLocked" @click="retryResultPreview">{{ copy.previewRetry }}</button>
          <button class="primary-button" :disabled="actionLocked || resultStage !== 'RESULT_READY'" :loading="confirmingAvatar" hover-class="button-tap" @click="useGeneratedAvatar">{{ confirmingAvatar ? copy.confirmSaving : copy.use }}</button>
          <view class="secondary-actions">
            <button class="light-button" :disabled="actionLocked || entitlementLoading" :loading="entitlementLoading" hover-class="button-tap" @click="requestGeneration('regenerate')">{{ copy.regenerate }}</button>
            <button class="light-button" hover-class="button-tap" @click="revisionOpen = !revisionOpen">{{ copy.revise }}</button>
          </view>
          <view v-if="revisionOpen" class="revision-panel">
            <text class="revision-title">{{ copy.revisionTitle }}</text>
            <text class="revision-subtitle">{{ copy.revisionSubtitle }}</text>
            <textarea v-model="revisionText" class="revision-input" :maxlength="300" :placeholder="copy.revisionPlaceholder"></textarea>
            <text class="revision-count">{{ revisionCountText }}</text>
            <button class="revision-button" :disabled="!normalizedRevisionText || actionLocked || entitlementLoading" :loading="entitlementLoading" hover-class="button-tap" @click="requestGeneration('revision')">{{ copy.revisionSubmit }}</button>
          </view>
          <button class="feedback-link" hover-class="tap-small" @click="openFeedback">{{ copy.feedbackEntry }}</button>
        </view>

        <view v-else-if="phase === 'failed'" class="error-panel">
          <text class="error-title" @click="handleGenerationFailureDebugTap">{{ errorMessage || copy.jobFailed }}</text>
          <button class="primary-button" hover-class="button-tap" @click="resumeOrRetry">{{ generationRecoveryLabel }}</button>
        </view>
      </template>
    </view>

    <view v-if="showMemberWall" class="modal-mask" @click="showMemberWall = false">
      <view class="member-sheet" @click.stop>
        <text class="member-title">{{ copy.memberTitle }}</text>
        <text class="member-text">{{ copy.memberText }}</text>
        <text class="member-notes">{{ copy.memberNotes }}</text>
        <button class="primary-button" hover-class="button-tap" @click="openMembership">{{ copy.memberPrimary }}</button>
        <button class="sheet-cancel" hover-class="button-tap" @click="showMemberWall = false">{{ copy.memberLater }}</button>
      </view>
    </view>
    <view v-if="feedbackOpen" class="modal-mask" @click="closeFeedback">
      <view class="feedback-sheet" @click.stop>
        <text class="feedback-title">{{ copy.feedbackTitle }}</text>
        <text class="feedback-help">{{ copy.feedbackHelp }}</text>
        <view class="feedback-categories">
          <button v-for="item in feedbackCategories" :key="item.key" class="feedback-category" :class="{ selected: feedbackCategory === item.key }" hover-class="button-tap" @click="feedbackCategory = item.key">{{ item.label }}</button>
        </view>
        <textarea v-model="feedbackNote" class="feedback-note" :maxlength="600" :placeholder="copy.feedbackPlaceholder"></textarea>
        <button class="primary-button" :disabled="!feedbackCategory || feedbackSubmitting" hover-class="button-tap" @click="submitFeedback">{{ feedbackSubmitting ? copy.feedbackSubmitting : copy.feedbackSubmit }}</button>
        <button class="sheet-cancel" :disabled="feedbackSubmitting" hover-class="button-tap" @click="closeFeedback">{{ copy.feedbackCancel }}</button>
      </view>
    </view>
    <view v-if="confirmingAvatar" class="confirm-saving-mask">
      <view class="confirm-saving-card">
        <view class="confirm-saving-spinner"></view>
        <text class="confirm-saving-title">{{ copy.confirmSaving }}</text>
        <text class="confirm-saving-subtitle">{{ copy.confirmSavingHint }}</text>
      </view>
    </view>
    <AiDataConsentSheet :visible="showConsent" @accepted="onConsentAccepted" @decline="onConsentDeclined" />
  </view>
</template>

<script>
import {privateMediaUrls} from '../../common/private-media-urls.js';
import {captureDataScope,isDataScopeCurrent} from "../../common/scoped-storage.js";
import {subscribeAccountScope} from "../../common/auth-store.js";
import PetPortraitStage from '../../components/PetPortraitStage.vue';
import { resolveWorkbenchMasterAsset } from '../../common/workbench-master-asset.js';
import AiDataConsentSheet from '../../components/AiDataConsentSheet.vue';
import PetGenerationParticles from '../../components/PetGenerationParticles.vue';
import { hasAiConsent } from '../../common/ai-consent.js';
import { getAvatarGenerationEntitlement } from '../../common/avatar-generation-entitlement.js';
import { isReduceMotionEnabled, lightHaptic } from '../../common/haptics.js';
import { getAppLocale, t } from '../../common/i18n.js';
import { isDevelopmentEnvironment } from '../../common/dev-flags.js';
import { getAvatarAssetHashPrefix, isAvatarFileCacheEnabled, peekAvatarCandidateUrl, hydrateAvatarCandidateAsset, pinAvatarCandidateAsset, invalidateAvatarUrl } from '../../common/avatar-display-asset.js';
import { getAvatarResultCopy } from '../../common/avatar-result-copy.js';
import { getActivePet, setActivePet, updatePet } from '../../common/pet-store.js';
import { saveAvatarHandoff } from '../../common/avatar-handoff.js';
import {
  clearAvatarGenerationSession,
  clearAvatarJob,
  confirmGeneratedAvatar,
  createAvatarJob,
  ensureAvatarGenerationSession,
  fillAvatarPhotoSlots,
  getAvatarGenerationSession,
  getAvatarJobStatus,
  readAvatarCandidateTransport,
  getStoredAvatarJob,
  persistAvatarSourceImages,
  refreshAvatarGenerationSession,
  saveGeneratedAvatar,
  selectAvatarCandidate,
  submitAvatarFeedback,
  uploadAvatarSourceImages
} from '../../common/pet-avatar-generator.js';

const TERMINAL_STATUSES = ['SUCCEEDED', 'FAILED', 'CANCELED'];

export default {
  components: { PetPortraitStage, AiDataConsentSheet, PetGenerationParticles },
  data() {
    return {
      loadedDataScope:captureDataScope(),unsubscribeDataScope:null,locale: getAppLocale(), pet: null, phase: 'select', selectedPhotos: [], candidates: [], selectedJobId: '', previewJobId: '',
      experienceProgress: 0, uploadProgress: [], pollTimer: null, progressTimer: null, overtimeTimer: null, revealTimer: null,
      overtime: false, pageVisible: true, actionLocked: false, showConsent: false, showMemberWall: false,
      pendingJobKind: 'initial', errorMessage: '', revisionOpen: false, revisionText: '', entitlement: null,
      entitlementLoading: false,
      statusQueryFailures: 0, resultSaveRetries: 0, resultStoragePending: false,
      feedbackOpen: false, feedbackCategory: '', feedbackNote: '', feedbackSubmitting: false, confirmingAvatar: false,
      resultStage: 'GENERATING', visibleResultUrl: '', previousResultUrl: '', preloadCandidateUrl: '', preloadCandidateJobId: '', preloadFailed: false,
      candidateUrlCache: new Map(), candidateThumbnailUrlCache: new Map(), candidateUrlInvalid: new Set(), candidateThumbnailUrlInvalid: new Set(), candidateCacheVersion: 0, particleMountCount: 0,
      candidateUrlHydrationInFlight: new Map(), candidateThumbnailHydrationInFlight: new Map(),
      candidateFilePins: [], candidateThumbnailRecovery: new Map(),
      workbenchPalette: null, visibleResultJobId: '', stageRecoveryUrl: '', workbenchDebugTapCount: 0, workbenchDebugTapTimer: null, failureDebugTapCount: 0, failureDebugTapTimer: null, lastGenerationFailure: null, preloadRequestId: 0, preloadTimer: null, pageDisposed: false,
      reduceMotion: isReduceMotionEnabled()
    };
  },
  computed: {
    copy() {
      const keys = ['kicker', 'selectTitle', 'selectSubtitle', 'photoHint', 'generate', 'generating', 'background', 'backgroundHint', 'prepare', 'submit', 'create', 'persist', 'overtime', 'estimate', 'resultTitle', 'use', 'regenerate', 'revise', 'history', 'revisionTitle', 'revisionSubtitle', 'revisionPlaceholder', 'revisionSubmit', 'revisionCount', 'confirmTitle', 'confirmText', 'confirmSaving', 'confirmSavingHint', 'quotaText', 'memberTitle', 'memberText', 'memberNotes', 'memberPrimary', 'memberLater', 'uploadFailed', 'jobFailed', 'previewPreparing', 'previewRetry', 'feedbackEntry', 'feedbackTitle', 'feedbackHelp', 'feedbackPlaceholder', 'feedbackSubmit', 'feedbackSubmitting', 'feedbackCancel', 'feedbackSuccess', 'photoPermissionTitle', 'photoPermissionText', 'photoPermissionSettings', 'photoChooseFailed', 'photoExpired'];
      return keys.reduce((result, key) => { result[key] = t(`avatar.${key}`, {}, this.locale); return result; }, {});
    },
    isProcessing() { return ['uploading', 'submitting', 'generating', 'loading', 'revealing'].includes(this.phase); },
    generationRecoveryLabel() {
      const action = this.generationRecoveryAction();
      return t(action === 'home' ? 'avatar.returnToPets' : action === 'login' ? 'avatar.loginAction' : action === 'account' ? 'avatar.accountDataAction' : action === 'photos' ? 'avatar.selectPhotosAgain' : this.lastGenerationFailure?.errorCode === 'RESULT_SAVE_PENDING' ? 'avatar.checkSavedResult' : 'common.retry', {}, this.locale);
    },
    selectedPhotoPaths() { return this.selectedPhotos.filter(Boolean).map(item => item.path).filter(Boolean).slice(0, 3); },
    selectedCandidate() { return this.candidates.find(item => item.jobId === (this.previewJobId || this.selectedJobId)) || this.candidates.find(item => item.jobId === this.selectedJobId) || this.candidates[this.candidates.length - 1] || null; },
    stageImage() { return this.visibleResultUrl; },
    resultCopyState() {
      const candidate = this.selectedCandidate || {};
      return getAvatarResultCopy({
        jobKind: candidate.jobKind || this.pendingJobKind,
        jobId: candidate.jobId || this.previewJobId || this.selectedJobId,
        locale: this.locale
      });
    },
    resultQuestion() { return this.resultCopyState.text; },
    pageTitle() { if (this.phase === 'failed') return t('avatar.failedTitle', {}, this.locale); if (this.phase === 'generating' && this.resultStoragePending) return this.copy.persist; return this.phase === 'select' ? this.copy.selectTitle : (this.phase === 'result' ? this.copy.resultTitle : this.copy.generating); },
    pageSubtitle() { if (this.phase === 'failed') return ''; if (this.phase === 'generating' && this.resultStoragePending) return t('avatar.resultSavingHint', {}, this.locale); return this.phase === 'select' ? this.copy.selectSubtitle : (this.phase === 'result' ? (this.resultCopyState.context === 'revision' ? this.copy.revisionSubtitle : this.copy.resultReviewSubtitle) : this.copy.estimate); },
    progressCaption() { return this.resultStoragePending ? t('avatar.resultSavingHint', {}, this.locale) : (this.overtime ? this.copy.overtime : this.copy.estimate); },
    progressText() { if (this.phase === 'uploading') return this.copy.prepare; if (this.phase === 'submitting') return this.copy.submit; if (this.phase === 'generating' && this.resultStoragePending) return this.copy.persist; if (this.phase === 'loading' || this.phase === 'revealing') return this.copy.previewPreparing; return this.copy.create; },
    progressPercentText() { return `${Math.round(Math.min(Math.max(Number(this.experienceProgress) || 0, 0), 100))}%`; },
    uploadStatusText() { const complete = this.uploadProgress.filter(value => value >= 100).length; return this.uploadProgress.length ? `${complete}/${this.uploadProgress.length}` : ''; },
    normalizedRevisionText() { return String(this.revisionText || '').replace(/\s+/g, ' ').trim(); },
    revisionCountText() { return t('avatar.revisionCount', { count: this.revisionText.length }, this.locale); },
    quotaText() { return this.entitlement && Number.isFinite(this.entitlement.limit) ? t('avatar.quotaText', this.entitlement, this.locale) : ''; },
    feedbackCategories() {
      return ['poor_quality', 'revision_ineffective', 'identity_mismatch', 'distorted', 'other'].map(key => ({ key, label: t(`avatar.feedbackCategories.${key}`, {}, this.locale) }));
    }
  },
  onLoad(options = {}) {
    this.loadedDataScope=captureDataScope();
    this.unsubscribeDataScope=subscribeAccountScope(()=>{if(!this.ownsDataScope())this.discardAccountView();});
    if (!this.loadedDataScope.ready) { this.failPetEntry('DATA_SCOPE_UNRESOLVED'); return; }
    let requestedPetId = '';
    try { requestedPetId = decodeURIComponent(String(options.petId || '')); } catch (error) { requestedPetId = String(options.petId || ''); }
    if (requestedPetId) {
      const routedPet = setActivePet(requestedPetId);
      if (!routedPet || routedPet.id !== requestedPetId) {
        this.failPetEntry();
        return;
      }
      this.pet = routedPet;
    } else {
      this.pet = getActivePet();
    }
    if (!this.pet) { this.failPetEntry(); return; }
    this.restoreSession(String(options.resumeJobId || ''));
    this.refreshEntitlement();
  },
  onShow() {
    if(!this.ownsDataScope()){this.discardAccountView();uni.switchTab({url:'/pages/home/home'});return;}
    this.pageVisible = true;
    this.locale = getAppLocale();
    if (this.$refs.particles) this.$refs.particles.resumeAnimation();
    if (this.phase === 'generating') { this.beginExperienceProgress(); this.schedulePoll(150); }
    if (this.resultStage === 'RESULT_LOADING' && this.selectedCandidate) {
      this.beginCandidatePreload(this.selectedCandidate, { preserveWorkbench: Boolean(this.visibleResultUrl) });
    }
    if (this.phase === 'revealing' && this.visibleResultUrl) { this.phase = 'result'; this.resultStage = 'RESULT_READY'; }
  },
  onHide() { this.pageVisible = false; this.preloadRequestId += 1; this.preloadCandidateUrl = ''; this.stopUiTimers(); this.clearWorkbenchDebugTimer(); this.clearFailureDebugTimer(); if (this.$refs.particles) this.$refs.particles.pauseAnimation(); },
  onUnload() { this.releaseCandidatePins();this.unsubscribeDataScope?.();this.unsubscribeDataScope=null;this.pageVisible = false; this.pageDisposed = true; this.preloadRequestId += 1; this.preloadCandidateUrl = ''; this.stopUiTimers(); this.clearWorkbenchDebugTimer(); this.clearFailureDebugTimer(); if (this.$refs.particles) this.$refs.particles.cancelAnimation(); },
  methods: {
    failPetEntry(code = 'AVATAR_PET_NOT_FOUND') {
      this.pet = null;
      this.phase = 'failed';
      this.errorMessage = t('avatar.petUnavailable', {}, this.locale);
      this.lastGenerationFailure = { status: 'NOT_STARTED', stage: 'PAGE_ENTRY', errorCode: code,
        attempts: 0, jobId: '', providerErrorCode: '', providerErrorMessage: '', providerRequestId: '', httpStatus: 0 };
    },
    releaseCandidatePins() { this.candidateFilePins?.forEach(release => release()); this.candidateFilePins = []; },
    ownsDataScope(){return !this.pageDisposed && isDataScopeCurrent(this.loadedDataScope);},
    discardAccountView(){
      this.releaseCandidatePins();
      this.pageDisposed=true;this.preloadRequestId++;this.stopUiTimers();this.clearWorkbenchDebugTimer();this.clearFailureDebugTimer();
      this.pet=null;this.selectedPhotos=[];this.candidates=[];this.visibleResultUrl='';this.previousResultUrl='';this.preloadCandidateUrl='';
      this.candidateUrlCache.clear();this.candidateThumbnailUrlCache.clear();this.candidateUrlHydrationInFlight.clear();this.candidateThumbnailHydrationInFlight.clear();
      this.candidateThumbnailRecovery.clear();
      this.entitlement=null;this.showConsent=false;this.showMemberWall=false;this.feedbackOpen=false;this.confirmingAvatar=false;
    },
    setCandidates(candidates = []) {
      if(!this.ownsDataScope())return;
      this.releaseCandidatePins();
      this.candidates = Array.isArray(candidates) ? candidates.slice() : [];
      this.candidates.forEach(candidate => {
        const fileId = candidate.fileId || candidate.generatedFileId;
        if (isAvatarFileCacheEnabled()) {
          this.candidateFilePins.push(pinAvatarCandidateAsset(candidate, this.pet || {}));
          const local = peekAvatarCandidateUrl(candidate, this.pet || {});
          if (local) this.candidateUrlCache.set(fileId, local);
          else this.candidateUrlCache.delete(fileId);
          if (candidate.generatedThumbnailFileId && (this.candidateThumbnailRecovery.get(this.candidateThumbnailKey(candidate)) || 0) < 2) this.hydrateCandidateFile(candidate, true).catch(() => {});
          return;
        }
        if (fileId && candidate.generatedTempUrl) this.candidateUrlCache.set(fileId, candidate.generatedTempUrl);
        if (candidate.generatedThumbnailFileId && candidate.generatedThumbnailUrl) {
          this.candidateThumbnailUrlCache.set(candidate.generatedThumbnailFileId, candidate.generatedThumbnailUrl);
        }
      });
      this.candidateCacheVersion += 1;
    },
    candidateThumbnailKey(candidate = {}) {
      return JSON.stringify([this.pet?.id || '', candidate.fileId || candidate.generatedFileId || '', candidate.generatedThumbnailFileId || '']);
    },
    getCandidateThumbnailUrl(candidate = {}) {
      void this.candidateCacheVersion;
      if (isAvatarFileCacheEnabled()) {
        const stopped = (this.candidateThumbnailRecovery.get(this.candidateThumbnailKey(candidate)) || 0) >= 2;
        return (!stopped && peekAvatarCandidateUrl(candidate, this.pet || {}, true)) || peekAvatarCandidateUrl(candidate, this.pet || {});
      }
      const fileId = candidate.generatedThumbnailFileId || candidate.generatedFileId || '';
      if (fileId && this.candidateThumbnailUrlInvalid.has(fileId)) return this.candidateThumbnailUrlCache.get(fileId) || '';
      return (fileId && this.candidateThumbnailUrlCache.get(fileId)) || candidate.generatedThumbnailUrl || candidate.generatedTempUrl || '';
    },
    async hydrateCandidateFile(candidate = {}, thumbnail = false, options = {}) {
      if(!this.ownsDataScope())return;
      const master = resolveWorkbenchMasterAsset(candidate, this.pet?.id);
      const fileId = thumbnail ? candidate.generatedThumbnailFileId : master.fileId;
      if (isAvatarFileCacheEnabled()) {
        if (!fileId || !master.qualified) return '';
        const owner = this.pet;
        const result = await hydrateAvatarCandidateAsset(candidate, owner, { thumbnail, userRetry: options.userRetry === true, loadUrl: async () => {
          const job = await readAvatarCandidateTransport(owner.id, candidate);
          if (!this.ownsDataScope() || this.pet?.id !== owner.id) throw new Error('DATA_SCOPE_CHANGED');
          if (job?.jobId !== candidate.jobId || job?.generatedFileId !== master.fileId ||
              (thumbnail && job.generatedThumbnailFileId !== fileId)) throw new Error('CANDIDATE_ASSET_CHANGED');
          return thumbnail ? job.generatedThumbnailUrl : job.generatedTempUrl;
        } });
        if (!this.ownsDataScope() || this.pet?.id !== owner.id) return '';
        (thumbnail ? this.candidateThumbnailUrlCache : this.candidateUrlCache).set(fileId, result.url);
        this.candidateCacheVersion += 1;
        return result.url;
      }
      if (!fileId) return thumbnail ? candidate.generatedThumbnailUrl || '' : '';
      const cache = thumbnail ? this.candidateThumbnailUrlCache : this.candidateUrlCache;
      if (cache.has(fileId)) return cache.get(fileId);
      const inFlight = thumbnail ? this.candidateThumbnailHydrationInFlight : this.candidateUrlHydrationInFlight;
      if (inFlight.has(fileId)) return inFlight.get(fileId);
      const request = (async () => {
        const response = await privateMediaUrls([fileId],this.petId);
        if(!this.ownsDataScope())return '';
        const item = response && response.fileList && response.fileList[0];
        const url = item && (item.tempFileURL || item.tempFileUrl) || '';
        if (url) {
          cache.set(fileId, url);
          (thumbnail ? this.candidateThumbnailUrlInvalid : this.candidateUrlInvalid).delete(fileId);
          this.candidateCacheVersion += 1;
        }
        return url;
      })();
      inFlight.set(fileId, request);
      try {
        return await request;
      } finally {
        if (inFlight.get(fileId) === request) inFlight.delete(fileId);
      }
    },
    async onCandidateThumbnailError(candidate, event) {
      const fileId = candidate && candidate.generatedThumbnailFileId;
      if (!fileId || !this.ownsDataScope()) return;
      const native = isAvatarFileCacheEnabled(), key = this.candidateThumbnailKey(candidate);
      if (native) {
        const dataset = event?.currentTarget?.dataset;
        const currentUrl = peekAvatarCandidateUrl(candidate, this.pet || {}, true);
        if (!currentUrl || dataset?.assetKey !== key || dataset?.url !== currentUrl) return;
        const attempts = this.candidateThumbnailRecovery.get(key) || 0;
        this.candidateThumbnailRecovery.set(key, Math.min(2, attempts + 1));
        this.candidateCacheVersion += 1;
        if (attempts >= 1) return;
        invalidateAvatarUrl(this.pet.id, fileId, currentUrl);
      }
      this.candidateThumbnailUrlCache.delete(fileId);
      this.candidateThumbnailUrlInvalid.add(fileId);
      this.candidateCacheVersion += 1;
      try { await this.hydrateCandidateFile(candidate, true); }
      catch (error) {
        if (native && this.ownsDataScope() && this.candidateThumbnailKey(candidate) === key) {
          this.candidateThumbnailRecovery.set(key, 2); this.candidateCacheVersion += 1;
        }
      }
    },
    async refreshEntitlement() {
      if (!this.ownsDataScope()) return;
      const petId = this.pet?.id;
      if (!petId) return;
      try {
        const value = await getAvatarGenerationEntitlement(petId);
        if (this.ownsDataScope() && this.pet?.id === petId) this.entitlement = value;
      } catch (error) {
        if (!this.ownsDataScope() || this.pet?.id !== petId) return;
        this.entitlement = null;
        this.rememberGenerationFailure({ stage: 'ENTITLEMENT', errorCode: error?.code || error?.errCode || 'AVATAR_ENTITLEMENT_UNAVAILABLE' });
      }
    },
    async restoreSession(resumeJobId = '') {
      if(!this.ownsDataScope())return;
      if (!this.pet) return;
      // Recover an existing owned task through the normal authenticated endpoint.
      // A recovery link never starts a new generation or changes ownership checks.
      if (resumeJobId) {
        const petId = this.pet.id;
        try {
          await getAvatarJobStatus(petId, resumeJobId);
        } catch (error) {
          if (this.ownsDataScope() && this.pet?.id === petId) this.failGeneration({ ...error, stage: 'STATUS_QUERY' });
          return;
        }
        if (!this.ownsDataScope() || this.pet?.id !== petId) return;
      }
      let session = getAvatarGenerationSession(this.pet.id);
      if (session) {
        this.selectedPhotos = session.sourcePhotoPaths.map(path => ({ path }));
        try { session = await refreshAvatarGenerationSession(this.pet.id) || session; } catch (error) {}
        if(!this.ownsDataScope())return;
        this.setCandidates(session.candidates || []);
        this.selectedJobId = session.selectedJobId || '';
        this.previewJobId = this.selectedJobId;
      } else if (this.pet.originalPhotoUrl) {
        this.selectedPhotos = [{ path: this.pet.originalPhotoUrl }];
      }
      const job = getStoredAvatarJob(this.pet.id);
      if (job && ['CREATING', 'PENDING', 'RUNNING'].includes(job.status)) {
        this.phase = 'generating'; this.experienceProgress = 38; this.beginExperienceProgress(); this.schedulePoll(150); return;
      }
      if (job && job.status === 'SUCCEEDED' && job.generatedFileId) {
        try {
          await getAvatarJobStatus(this.pet.id, job.jobId);
          if(!this.ownsDataScope())return;
          session = getAvatarGenerationSession(this.pet.id);
          this.setCandidates(session ? session.candidates : this.candidates);
          this.selectedJobId = session ? session.selectedJobId : this.selectedJobId;
          this.previewJobId = this.selectedJobId;
        } catch (error) {}
      }
      if(!this.ownsDataScope())return;
      if (this.candidates.length) this.beginCandidatePreload(this.selectedCandidate);
      else if (session?.lastFailure) this.failGeneration(session.lastFailure);
    },
    onSlotTap(index) {
      const photo = this.selectedPhotos[index];
      if (photo) { uni.previewImage({ current: photo.path, urls: this.selectedPhotos.map(item => item.path) }); return; }
      this.showPhotoSource(index);
    },
    showPhotoSource(index) {
      if(!this.ownsDataScope())return;
      uni.showActionSheet({ itemList: [t('avatar.camera', {}, this.locale), t('avatar.album', {}, this.locale)], success: result => this.choosePhoto(index, result.tapIndex === 0 ? 'camera' : 'album') });
    },
    choosePhoto(index, sourceType) {
      if(!this.ownsDataScope())return;
      const remaining = Math.max(3 - this.selectedPhotos.filter(Boolean).length, 0);
      const count = sourceType === 'camera' ? 1 : remaining;
      if (!count) return;
      uni.chooseImage({ count, sizeType: ['compressed'], sourceType: [sourceType], success: async result => {
        if(!this.ownsDataScope())return;
        const paths = (result.tempFilePaths || []).filter(Boolean).slice(0, count);
        if (!paths.length) return;
        let savedPaths;try{savedPaths=await persistAvatarSourceImages(paths);}catch(error){if(this.ownsDataScope())this.handlePhotoChooseFailure(error);return;}
        if (!this.ownsDataScope()) return;
        this.selectedPhotos = fillAvatarPhotoSlots(this.selectedPhotos, index, savedPaths);
        this.invalidateUploadedSources();
      }, fail: error => this.handlePhotoChooseFailure(error) });
    },
    handlePhotoChooseFailure(error) {
      const message = String(error && (error.errMsg || error.message) || '');
      if (/cancel/i.test(message)) return;
      if (/deny|denied|auth|permission|authorize/i.test(message)) {
        uni.showModal({
          title: this.copy.photoPermissionTitle,
          content: this.copy.photoPermissionText,
          confirmText: this.copy.photoPermissionSettings,
          success: result => {
            if (!result.confirm) return;
            if (typeof uni.openSetting === 'function') uni.openSetting({});
            else if (typeof plus !== 'undefined' && plus.runtime && typeof plus.runtime.openSystemSettings === 'function') plus.runtime.openSystemSettings();
          }
        });
        return;
      }
      uni.showToast({ title: this.copy.photoChooseFailed, icon: 'none' });
    },
    removePhoto(index) { if (!this.actionLocked) { this.selectedPhotos.splice(index, 1); this.invalidateUploadedSources(); } },
    onSourcePhotoError(index) {
      if (this.actionLocked || !this.selectedPhotos[index]) return;
      this.selectedPhotos.splice(index, 1);
      this.invalidateUploadedSources();
      uni.showToast({ title: this.copy.photoExpired, icon: 'none' });
    },
    invalidateUploadedSources() {
      if(!this.ownsDataScope())return; if (!this.pet) return; ensureAvatarGenerationSession(this.pet.id, { sourceFileIds: [], sourcePhotoPaths: this.selectedPhotoPaths }); },
    async requestGeneration(jobKind) {
      if(!this.ownsDataScope())return;
      if (!this.pet || this.actionLocked || this.entitlementLoading || !this.selectedPhotoPaths.length) return;
      this.pendingJobKind = jobKind;
      if (!hasAiConsent('pet_avatar')) { this.showConsent = true; return; }
      this.entitlementLoading = true;
      try {
        const entitlement = await this.ensureEntitlement();
        if (!entitlement || !this.ownsDataScope() || !this.pageVisible) return;
        this.startGeneration(jobKind);
      } finally {
        this.entitlementLoading = false;
      }
    },
    async ensureEntitlement() {
      if(!this.ownsDataScope())return;
      const petId = this.pet?.id;
      if (!petId) { this.failPetEntry(); return null; }
      try {
        const value=await getAvatarGenerationEntitlement(petId);
        if(!this.ownsDataScope() || this.pet?.id !== petId)return null;
        this.entitlement=value;
        if (!this.entitlement.allowed) { this.showMemberWall = true; return null; }
        return this.entitlement;
      } catch (error) {
        if (this.ownsDataScope() && this.pet?.id === petId) {
          this.failGeneration({ code: error?.code || error?.errCode || 'AVATAR_ENTITLEMENT_UNAVAILABLE', stage: 'ENTITLEMENT' });
        }
        return null;
      }
    },
    onConsentAccepted() { this.showConsent = false; this.requestGeneration(this.pendingJobKind); },
    onConsentDeclined() { this.showConsent = false; },
    async startGeneration(jobKind) {
      if(!this.ownsDataScope())return;
      if (this.actionLocked || !this.pet) return;
      const generationPetId = this.pet.id;
      this.statusQueryFailures = 0;
      this.resultSaveRetries = 0; this.resultStoragePending = false;
      this.actionLocked = true; this.errorMessage = ''; this.lastGenerationFailure = null; this.overtime = false;
      lightHaptic();
      try {
        const savedPaths = await persistAvatarSourceImages(this.selectedPhotoPaths);
        if (!this.ownsDataScope() || !this.pet || this.pet.id !== generationPetId) return;
        let savedIndex = 0;
        this.selectedPhotos = this.selectedPhotos.map(photo => photo ? { ...photo, path: savedPaths[savedIndex++] || photo.path } : photo);
        let session = ensureAvatarGenerationSession(this.pet.id, { sourcePhotoPaths: this.selectedPhotoPaths, lastFailure: null });
        let sourceFileIds = session.sourceFileIds;
        if (jobKind !== 'revision' && !sourceFileIds.length) {
          this.phase = 'uploading'; this.experienceProgress = 5; this.uploadProgress = this.selectedPhotoPaths.map(() => 0);
          sourceFileIds = await uploadAvatarSourceImages(this.pet, this.selectedPhotoPaths, (index, progress) => { this.uploadProgress[index] = progress; });
          if (!this.ownsDataScope() || !this.pet || this.pet.id !== generationPetId) return;
          session = ensureAvatarGenerationSession(this.pet.id, { sourceFileIds, sourcePhotoPaths: this.selectedPhotoPaths });
        }
        const selected = this.selectedCandidate;
        if (jobKind === 'revision' && (!selected || !this.normalizedRevisionText)) throw new Error('INVALID_REVISION_TEXT');
        this.phase = 'submitting'; this.experienceProgress = 18;
        this.pet = updatePet(this.pet.id, { originalPhotoUrl: this.selectedPhotoPaths[0], avatarStatus: 'pending', avatarUpdatedAt: Date.now() }) || this.pet;
        await createAvatarJob(this.pet, {
          ...(jobKind === 'revision' ? {} : { sourceFileIds, sourcePhotoPaths: this.selectedPhotoPaths }), jobKind,
          parentJobId: selected && selected.jobId,
          revisionText: jobKind === 'revision' ? this.normalizedRevisionText : ''
        });
        if(!this.ownsDataScope())return;
        this.phase = 'generating'; this.resultStage = 'GENERATING'; this.visibleResultUrl = ''; this.previousResultUrl = ''; this.preloadCandidateUrl = ''; this.experienceProgress = 25; this.revisionOpen = false; this.beginExperienceProgress(); this.schedulePoll(300);
        this.overtimeTimer = setTimeout(() => { this.overtime = true; }, 90000);
      } catch (error) {
        if(!this.ownsDataScope())return;
        if (error && error.code === 'AVATAR_QUOTA_EXCEEDED') { this.phase = this.candidates.length ? 'result' : 'select'; this.showMemberWall = true; }
        else this.failGeneration(error);
      } finally { this.actionLocked = false; }
    },
    schedulePoll(delay = 3000) { if (!this.pageVisible || !this.pet || this.pollTimer) return; this.pollTimer = setTimeout(() => { this.pollTimer = null; this.pollJob(); }, delay); },
    async pollJob() {
      if(!this.ownsDataScope())return;
      if (!this.pageVisible || !this.pet) return;
      const stored = getStoredAvatarJob(this.pet.id); if (!stored || !stored.jobId) return;
      const petId = this.pet.id;
      try {
        const job = await getAvatarJobStatus(petId, stored.jobId);
        if(!this.ownsDataScope() || this.pet?.id !== petId || getStoredAvatarJob(petId)?.jobId !== stored.jobId)return;
        this.statusQueryFailures = 0;
        this.resultStoragePending = ['PENDING', 'RUNNING'].includes(job.status) && job.errorCode === 'RESULT_SAVE_PENDING';
        if (this.resultStoragePending) {
          this.resultSaveRetries = (this.resultSaveRetries || 0) + 1;
          if (this.resultSaveRetries >= 4) {
            this.failGeneration({ code: 'RESULT_SAVE_PENDING', stage: 'RESULT_STORAGE', jobId: stored.jobId });
            return;
          }
          this.schedulePoll(5000 * this.resultSaveRetries);
          return;
        }
        this.resultSaveRetries = 0;
        if (job.status === 'SUCCEEDED') {
          this.experienceProgress = 100;
          const session = getAvatarGenerationSession(this.pet.id); this.setCandidates(session ? session.candidates : []); this.selectedJobId = session ? session.selectedJobId : job.jobId;
          this.previewJobId = job.jobId;
          this.stopGenerationTimers();
          this.beginCandidatePreload(this.candidates.find(item => item.jobId === job.jobId) || job);
          return;
        }
        if (TERMINAL_STATUSES.includes(job.status)) { this.failGeneration(job); return; }
        this.schedulePoll(3000);
      } catch (error) {
        if(!this.ownsDataScope() || this.pet?.id !== petId || getStoredAvatarJob(petId)?.jobId !== stored.jobId)return;
        const code = String(error?.code || error?.errCode || 'AVATAR_STATUS_FAILED');
        const retryable = ['AVATAR_REQUEST_FAILED', 'AVATAR_STATUS_FAILED', 'WAN_REQUEST_TIMEOUT',
          'WAN_INVALID_RESPONSE', 'ECONNRESET', 'ETIMEDOUT', 'NETWORK_ERROR'].includes(code)
          || (code === 'WAN_REQUEST_FAILED' && (error.httpStatus === 429 || error.httpStatus >= 500));
        this.statusQueryFailures = (this.statusQueryFailures || 0) + 1;
        if (retryable && this.statusQueryFailures <= 4) {
          this.schedulePoll(Math.min(3000 * (2 ** (this.statusQueryFailures - 1)), 15000));
          return;
        }
        this.failGeneration({ ...error, code, stage: 'STATUS_QUERY' });
      }
    },
    beginExperienceProgress() { if (this.progressTimer) return; this.progressTimer = setInterval(() => { if (this.experienceProgress < 90) this.experienceProgress += this.experienceProgress < 60 ? 2 : 1; }, 1100); },
    failGeneration(error) {
      if(!this.ownsDataScope())return;
      this.stopUiTimers();
      const stored = this.pet ? getStoredAvatarJob(this.pet.id) : null;
      const source = error && typeof error === 'object' ? error : {};
      const errorCode = String(source.errorCode || source.code || stored?.errorCode || 'AVATAR_REQUEST_FAILED');
      const entitlementFailure = source.stage === 'ENTITLEMENT';
      const accessMessage = { LOCAL_IMPORT_CLOUD_LINK_REQUIRED: 'cloudLinkPending', AVATAR_LOGIN_REQUIRED: 'loginRequired',
        AVATAR_AUTH_EXPIRED: 'loginExpired', AVATAR_AUTH_UNAVAILABLE: 'authUnavailable' }[errorCode];
      this.errorMessage = accessMessage ? t(`avatar.${accessMessage}`, {}, this.locale)
        : errorCode === 'RESULT_SAVE_PENDING' ? t('avatar.resultSavePending', {}, this.locale)
        : ['INVALID_SOURCE_IMAGES', 'AVATAR_SOURCE_IMAGE_UNREADABLE'].includes(errorCode) ? t('avatar.sourceImageInvalid', {}, this.locale)
        : entitlementFailure ? t('avatar.entitlementUnavailable', {}, this.locale)
        : source.stage === 'STATUS_QUERY' ? t('avatar.statusQueryUnavailable', {}, this.locale)
        : errorCode === 'AVATAR_SOURCE_UPLOAD_FAILED' ? this.copy.uploadFailed : this.copy.jobFailed;
      this.lastGenerationFailure = {
        status: String(source.status || stored?.status || 'FAILED'),
        stage: String(source.stage || (source.jobId || stored?.jobId ? 'PROVIDER_JOB' : 'REQUEST_SETUP')),
        attempts: Number(source.attempts) || 0,
        errorCode,
        providerErrorCode: String(source.providerErrorCode || stored?.providerErrorCode || ''),
        providerErrorMessage: String(source.providerErrorMessage || source.message || stored?.providerErrorMessage || ''),
        providerRequestId: String(source.providerRequestId || stored?.providerRequestId || ''),
        httpStatus: Number(source.httpStatus || stored?.httpStatus) || 0,
        jobId: String(source.jobId || stored?.jobId || '')
      };
      this.rememberGenerationFailure(this.lastGenerationFailure);
      // Access failure says nothing about the saved image or a submitted job.
      // Keep their state intact and offer an explicit route instead of repolling.
      if (accessMessage || entitlementFailure || ['STATUS_QUERY', 'RESULT_STORAGE', 'SOURCE_PREPARATION', 'SOURCE_VALIDATION'].includes(source.stage)) { this.phase = 'failed'; return; }
      if (this.pendingJobKind === 'revision' && this.candidates.length) {
        const baseline = this.candidates.find(item => item.jobId === this.selectedJobId) || this.candidates[0];
        this.previewJobId = baseline.jobId;
        this.beginCandidatePreload(baseline);
        uni.showToast({ title: this.copy.jobFailed, icon: 'none' });
        return;
      }
      this.phase = 'failed';
      if (this.pet) this.pet = updatePet(this.pet.id, { avatarStatus: 'failed', avatarUpdatedAt: Date.now() }) || this.pet;
    },
    rememberGenerationFailure(failure) {
      if (!this.ownsDataScope()) return;
      const diagnostic = { stage: String(failure.stage || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60),
        errorCode: String(failure.errorCode || '').replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 80), at: Date.now() };
      try {
        if (this.pet) ensureAvatarGenerationSession(this.pet.id, { lastFailure: diagnostic,
          ...(this.selectedPhotoPaths?.length ? { sourcePhotoPaths: this.selectedPhotoPaths } : {}) });
      } catch (_) { /* Diagnostics must not mask the original failure. */ }
      if (typeof isDevelopmentEnvironment === 'function' && isDevelopmentEnvironment()) console.warn('[AvatarGenerationFailure]', JSON.stringify(diagnostic));
    },
    resumeOrRetry() {
      if (!this.ownsDataScope()) return;
      const recovery = this.generationRecoveryAction();
      if (recovery === 'photos') { this.phase = 'select'; return; }
      if (recovery === 'home') { uni.switchTab({ url: '/pages/home/home' }); return; }
      if (recovery === 'login') {
        const destination = this.loadedDataScope.namespace === 'guest:local'
          ? '/pages/welcome/welcome?mode=create'
          : '/pages/avatar-generate/avatar-generate?petId=' + encodeURIComponent(this.pet.id);
        uni.navigateTo({ url: '/pages/auth/login?uniIdRedirectUrl=' + encodeURIComponent(destination) });
        return;
      }
      if (recovery === 'account') { uni.navigateTo({ url: '/pages/account/account-security' }); return; }
      const job = this.pet && getStoredAvatarJob(this.pet.id);
      if (job && ['PENDING', 'RUNNING'].includes(job.status)) { this.statusQueryFailures = 0; this.resultSaveRetries = 0; this.phase = 'generating'; this.beginExperienceProgress(); this.schedulePoll(100); return; }
      if (this.lastGenerationFailure && this.selectedPhotoPaths.length) {
        this.requestGeneration(this.pendingJobKind || 'initial');
        return;
      }
      this.phase = this.candidates.length ? 'result' : 'select';
    },
    generationRecoveryAction() {
      const code = this.lastGenerationFailure?.errorCode;
      if (!this.pet || ['AVATAR_PET_NOT_FOUND', 'DATA_SCOPE_UNRESOLVED'].includes(code)) return 'home';
      if (['AVATAR_LOGIN_REQUIRED', 'AVATAR_AUTH_EXPIRED'].includes(code)) return 'login';
      if (code === 'LOCAL_IMPORT_CLOUD_LINK_REQUIRED') return 'account';
      if (['INVALID_SOURCE_IMAGES', 'AVATAR_SOURCE_IMAGE_UNREADABLE'].includes(code)) return 'photos';
      return 'retry';
    },
    chooseCandidate(candidate) {
      if (!candidate || candidate.jobId === this.previewJobId || this.actionLocked) return;
      this.selectedJobId = candidate.jobId;
      this.previewJobId = candidate.jobId;
      selectAvatarCandidate(this.pet.id, candidate.jobId);
      this.beginCandidatePreload(candidate, { preserveWorkbench: true });
    },
    async beginCandidatePreload(candidate, options = {}) {
      if(!this.ownsDataScope())return;
      if (!candidate || !this.ownsDataScope()) return;
      const requestId = ++this.preloadRequestId;
      if (this.revealTimer) clearTimeout(this.revealTimer);
      clearTimeout(this.preloadTimer);
      this.revealTimer = null;
      const preserveWorkbench = options.preserveWorkbench === true && Boolean(this.visibleResultUrl);
      if (!preserveWorkbench) this.phase = 'loading';
      this.resultStage = 'RESULT_LOADING';
      this.preloadFailed = false;
      this.preloadCandidateUrl = '';
      this.preloadCandidateJobId = candidate.jobId;
      this.previewJobId = candidate.jobId;
      this.preloadTimer = setTimeout(() => {
        if (requestId === this.preloadRequestId && this.resultStage === 'RESULT_LOADING') this.onResultPreloadFailed();
      }, 20000);
      const master = resolveWorkbenchMasterAsset(candidate, this.pet?.id);
      if (!master.qualified) { this.onResultPreloadFailed(); return; }
      const fileId = master.fileId;
      let targetUrl = isAvatarFileCacheEnabled() ? peekAvatarCandidateUrl(candidate, this.pet || {}) : (fileId && this.candidateUrlCache.get(fileId)) || (fileId && this.candidateUrlInvalid.has(fileId) ? '' : candidate.generatedTempUrl) || '';
      // An explicit retry revalidates the file; page returns still reuse it.
      if (isAvatarFileCacheEnabled() && options.userRetry === true) targetUrl = '';
      if (!targetUrl) {
        try { targetUrl = await this.hydrateCandidateFile(candidate, false, options); } catch (error) {
          if (isDevelopmentEnvironment()) console.warn('[AvatarPreview]', JSON.stringify({stage:'HYDRATE',code:String(error?.code||error?.errCode||'UNKNOWN'),message:String(error?.message||error?.errMsg||'').replace(/https?:\/\/\S+/g,'[url]').slice(0,160)}));
          targetUrl = '';
        }
      }
      if (requestId !== this.preloadRequestId || !this.ownsDataScope() || this.preloadFailed) return;
      if (!targetUrl) {
        clearTimeout(this.preloadTimer);
        if (!preserveWorkbench) this.phase = 'loading';
        this.resultStage = 'RESULT_LOADING'; this.preloadFailed = true; return;
      }
      if (!preserveWorkbench) this.phase = 'loading';
      this.resultStage = 'RESULT_LOADING';
      this.preloadFailed = false;
      this.preloadCandidateJobId = candidate.jobId;
      this.previewJobId = candidate.jobId;
      this.preloadCandidateUrl = targetUrl;
    },
    isCurrentPreloadEvent(event) {
      const dataset = event && event.currentTarget && event.currentTarget.dataset;
      return !event || Boolean(dataset && Number(dataset.requestId) === this.preloadRequestId);
    },
    onResultPreloaded(event) {
      if (!this.isCurrentPreloadEvent(event) || !this.ownsDataScope() || this.preloadFailed) return;
      if (!this.preloadCandidateUrl || this.resultStage !== 'RESULT_LOADING') return;
      clearTimeout(this.preloadTimer);
      const requestId = this.preloadRequestId;
      const wasProcessing = this.phase === 'loading';
      this.previousResultUrl = this.visibleResultUrl && this.visibleResultUrl !== this.preloadCandidateUrl ? this.visibleResultUrl : '';
      this.visibleResultUrl = this.preloadCandidateUrl;
      this.visibleResultJobId = this.preloadCandidateJobId;
      this.resultStage = 'RESULT_REVEALING';
      if (wasProcessing) this.phase = 'revealing';
      this.preloadFailed = false;
      if (wasProcessing) lightHaptic();
      if (this.revealTimer) clearTimeout(this.revealTimer);
      this.revealTimer = setTimeout(() => {
        if (requestId !== this.preloadRequestId || !this.ownsDataScope()) return;
        this.phase = 'result';
        this.resultStage = 'RESULT_READY';
        this.previousResultUrl = '';
        this.preloadCandidateUrl = '';
        this.revisionText = '';
        this.revealTimer = null;
        this.refreshEntitlement();
      }, wasProcessing ? 620 : 260);
    },
    onResultPreloadFailed(event) {
      if (!this.isCurrentPreloadEvent(event) || !this.ownsDataScope()) return;
      if (this.resultStage !== 'RESULT_LOADING') return;
      const failedUrl = event?.currentTarget?.dataset?.url;
      if (event && isAvatarFileCacheEnabled() && (!failedUrl || failedUrl !== this.preloadCandidateUrl)) return;
      clearTimeout(this.preloadTimer);
      this.preloadFailed = true;
      const candidate = this.candidates.find(item => item.jobId === this.preloadCandidateJobId);
      const fileId = candidate && (candidate.fileId || candidate.generatedFileId);
      if (fileId) {
        // A timeout is not evidence of corrupt bytes. Only a matching image
        // decoder error invalidates the native file for a bounded recovery.
        if (event && isAvatarFileCacheEnabled()) invalidateAvatarUrl(this.pet.id, fileId, failedUrl);
        this.candidateUrlCache.delete(fileId);
        this.candidateUrlInvalid.add(fileId);
        this.candidateCacheVersion += 1;
      }
    },
    onWorkbenchPalette(event) {
      if(event.petId === this.pet?.id && event.masterKey === this.visibleResultJobId && event.imageUrl === this.visibleResultUrl) this.workbenchPalette=event.palette;
    },
    onStageImageError(event) {
      const url = event?.currentTarget?.dataset?.url;
      if (!this.ownsDataScope() || !this.pageVisible || !url || url !== this.visibleResultUrl || url === this.stageRecoveryUrl || this.resultStage === 'RESULT_LOADING') return;
      const candidate = this.candidates.find(item => item.jobId === this.visibleResultJobId);
      if (!candidate) return;
      this.stageRecoveryUrl = url;
      const master = resolveWorkbenchMasterAsset(candidate, this.pet?.id);
      if (isAvatarFileCacheEnabled()) invalidateAvatarUrl(this.pet.id, master.fileId, url);
      this.candidateUrlCache.delete(master.fileId);
      this.candidateUrlInvalid.add(master.fileId);
      this.beginCandidatePreload(candidate, { preserveWorkbench: true });
    },
    async retryResultPreview() {
      if (!this.pet || this.actionLocked) return;
      this.actionLocked = true;
      try {
        const candidate = this.candidates.find(item => item.jobId === this.preloadCandidateJobId) || this.selectedCandidate;
        await this.beginCandidatePreload(candidate, { userRetry: true });
      } catch (error) { this.preloadFailed = true; }
      finally { this.actionLocked = false; }
    },
    useGeneratedAvatar() {
      if(!this.ownsDataScope())return;
      const selected = this.selectedCandidate; if (!this.pet || !selected || this.actionLocked || this.resultStage !== 'RESULT_READY') return;
      const confirmPet = { ...this.pet };
      this.actionLocked = true;
      uni.showModal({ title: this.copy.confirmTitle, content: t('avatar.confirmText', { petName: this.pet.name }, this.locale), success: async result => {
        if (!result.confirm || !this.ownsDataScope()) { this.actionLocked = false; return; }
        this.actionLocked = true; this.confirmingAvatar = true; lightHaptic();
        try {
          const confirmStartedAt = Date.now();
          const previewUrl = this.visibleResultUrl || this.candidateUrlCache.get(selected.fileId || selected.generatedFileId) || selected.generatedTempUrl || '';
          const confirmed = await confirmGeneratedAvatar(confirmPet, selected.jobId);
          if(!this.ownsDataScope())return;
          const responseMs = Date.now() - confirmStartedAt;
          const petStoreStartedAt = Date.now();
          const patch = saveGeneratedAvatar(confirmPet, confirmed);
          const savedPet = updatePet(confirmPet.id, patch);
          if (!this.ownsDataScope() || getActivePet()?.id !== confirmPet.id) return;
          this.pet = savedPet || { ...confirmPet, ...patch };
          const petStoreWriteMs = Date.now() - petStoreStartedAt;
          const confirmedPetId = this.pet.id;
          saveAvatarHandoff({
            petId: confirmedPetId,
            jobId: selected.jobId,
            fileId: confirmed.generatedFileId,
            previewUrl,
            mainAssetMetadata: confirmed.mainAssetMetadata || selected.mainAssetMetadata || null
          });
          if (isDevelopmentEnvironment()) {
            console.info('[AVATAR CONFIRM TIMING]', {
              confirm_start: confirmStartedAt,
              candidate_final_copy_ms: Number(confirmed.timings && confirmed.timings.candidateFinalCopyMs) || 0,
              final_verify_ms: Number(confirmed.timings && confirmed.timings.finalVerifyMs) || 0,
              pet_store_write_ms: petStoreWriteMs,
              response_ms: responseMs
            });
          }
          uni.switchTab({
            url: '/pages/home/home',
            success: () => setTimeout(() => {
              if(!isDataScopeCurrent(this.loadedDataScope))return;
              clearAvatarJob(confirmedPetId);
              clearAvatarGenerationSession(confirmedPetId);
            }, 0)
          });
        } catch (error) { uni.showToast({ title: this.copy.jobFailed, icon: 'none' }); }
        finally { this.actionLocked = false; this.confirmingAvatar = false; }
      }, fail: () => { this.actionLocked = false; } });
    },
    openFeedback() { if (this.selectedCandidate) this.feedbackOpen = true; },
    closeFeedback() { if (!this.feedbackSubmitting) this.feedbackOpen = false; },
    async submitFeedback() {
      if(!this.ownsDataScope())return;
      const selected = this.selectedCandidate;
      if (!this.pet || !selected || !this.feedbackCategory || this.feedbackSubmitting) return;
      this.feedbackSubmitting = true;
      try {
        await submitAvatarFeedback(this.pet.id, selected.jobId, this.feedbackCategory, this.feedbackNote, this.locale);
        this.feedbackOpen = false; this.feedbackCategory = ''; this.feedbackNote = '';
        uni.showToast({ title: this.copy.feedbackSuccess, icon: 'none' });
      } catch (error) { uni.showToast({ title: this.copy.jobFailed, icon: 'none' }); }
      finally { this.feedbackSubmitting = false; }
    },
    openMembership() { this.showMemberWall = false; uni.navigateTo({ url: '/pages/settings/settings' }); },
    handleWorkbenchDebugTap() {
      if (!isDevelopmentEnvironment() || this.phase !== 'result') return;
      this.workbenchDebugTapCount += 1;
      this.clearWorkbenchDebugTimer();
      if (this.workbenchDebugTapCount < 5) {
        this.workbenchDebugTapTimer = setTimeout(() => { this.workbenchDebugTapCount = 0; }, 3500);
        return;
      }
      this.workbenchDebugTapCount = 0;
      const candidate = this.candidates.find(item => item.jobId === this.visibleResultJobId) || this.selectedCandidate || {};
      const metadata = candidate.mainAssetMetadata || {};
      uni.showModal({
        title: 'Main Asset Debug',
        content: [
          'SURFACE: workbench',
          'ASSET: workbench_master',
          `PET: ${this.pet?.id || 'none'}`,
          `sourceType: ${resolveWorkbenchMasterAsset(candidate, this.pet?.id).sourceType}`,
          `qualified: ${resolveWorkbenchMasterAsset(candidate, this.pet?.id).qualified}`,
          `fallbackReason: ${resolveWorkbenchMasterAsset(candidate, this.pet?.id).fallbackReason || 'none'}`,
          `hasAlpha: ${metadata.hasAlpha === true}`,
          `COMPOSITION: ${metadata.compositionVersion || 'legacy-unverified'}`,
          'POSE VERIFICATION: visual check required',
          'FIT: contain (no crop)',
          `FILE: ${getAvatarAssetHashPrefix(candidate.fileId || candidate.generatedFileId)}`,
          `SIZE: ${Number(metadata.width) || 0} x ${Number(metadata.height) || 0}`,
          `BYTES: ${Number(metadata.bytes) || 0}`,
          `MIME: ${metadata.mime || 'unknown'}`,
          `EXT: ${metadata.extension || 'unknown'}`,
          `REENCODED: ${metadata.wasReencoded === true}`,
          `DOWNSCALED: ${metadata.wasDownscaled === true}`,
          `PROVIDER ORIGINAL: ${metadata.providerOriginal === true}`
        ].join('\n'),
        showCancel: false
      });
    },
    clearWorkbenchDebugTimer() {
      if (this.workbenchDebugTapTimer) clearTimeout(this.workbenchDebugTapTimer);
      this.workbenchDebugTapTimer = null;
    },
    handleGenerationFailureDebugTap() {
      if (!isDevelopmentEnvironment() || this.phase !== 'failed') return;
      this.failureDebugTapCount += 1;
      this.clearFailureDebugTimer();
      if (this.failureDebugTapCount < 5) {
        this.failureDebugTapTimer = setTimeout(() => { this.failureDebugTapCount = 0; }, 3500);
        return;
      }
      this.failureDebugTapCount = 0;
      const failure = this.lastGenerationFailure || {};
      uni.showModal({
        title: 'Generation Debug',
        content: [
          `PET: ${this.pet?.id || 'none'}`,
          `STATUS: ${failure.status || 'unknown'}`,
          `STAGE: ${failure.stage || 'unknown'}`,
          `ATTEMPTS: ${Number(failure.attempts) || 0}`,
          `ERROR CODE: ${failure.errorCode || 'unknown'}`,
          `PROVIDER CODE: ${failure.providerErrorCode || 'not captured'}`,
          `PROVIDER MESSAGE: ${failure.providerErrorMessage || 'not captured'}`,
          `HTTP: ${Number(failure.httpStatus) || 0}`,
          `REQUEST ID: ${failure.providerRequestId || 'none'}`,
          `JOB: ${getAvatarAssetHashPrefix(failure.jobId)}`,
          'MODEL: wan2.7-image-pro'
        ].join('\n'),
        showCancel: false
      });
    },
    clearFailureDebugTimer() {
      if (this.failureDebugTapTimer) clearTimeout(this.failureDebugTapTimer);
      this.failureDebugTapTimer = null;
    },
    continueInBackground() { this.stopUiTimers(); const pages = getCurrentPages(); if (pages.length > 1) uni.navigateBack(); else uni.switchTab({ url: '/pages/home/home' }); },
    goBack() { const pages = getCurrentPages(); if (pages.length > 1) uni.navigateBack(); else uni.switchTab({ url: '/pages/home/home' }); },
    stopGenerationTimers() { if (this.pollTimer) clearTimeout(this.pollTimer); if (this.progressTimer) clearInterval(this.progressTimer); if (this.overtimeTimer) clearTimeout(this.overtimeTimer); this.pollTimer = null; this.progressTimer = null; this.overtimeTimer = null; },
    stopUiTimers() { this.stopGenerationTimers(); if (this.revealTimer) clearTimeout(this.revealTimer); if (this.preloadTimer) clearTimeout(this.preloadTimer); this.revealTimer = null; this.preloadTimer = null; }
  }
};
</script>

<style scoped>
.avatar-page { min-height: 100vh; color: #302d29; background: linear-gradient(180deg, #f5f1e9 0%, #ece9e3 48%, #f7f4ee 100%); }
.page-shell { min-height: 100vh; padding: calc(var(--status-bar-height, 0px) + 28rpx) 34rpx calc(54rpx + env(safe-area-inset-bottom)); box-sizing: border-box; }
.page-nav { min-height: 84rpx; display: flex; align-items: center; gap: 18rpx; }
.back-button { width: 88rpx; height: 88rpx; margin: 0; padding: 0; border: 1rpx solid rgba(66,59,52,.08); border-radius: 50%; color: #4c463f; background: rgba(255,255,255,.58); font-size: 48rpx; line-height: 80rpx; }
.back-button::after, button::after { border: none; }
.nav-kicker { flex: 1; color: rgba(48,45,41,.45); font-size: 19rpx; letter-spacing: 1.2rpx; }
.quota-text { color: rgba(48,45,41,.58); font-size: 20rpx; }
.top-copy { margin-top: 30rpx; display: flex; flex-direction: column; }
.title { font-size: 44rpx; font-weight: 650; line-height: 1.2; }.subtitle { max-width: 630rpx; margin-top: 13rpx; color: rgba(48,45,41,.58); font-size: 24rpx; line-height: 1.55; }
.photo-slots { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14rpx; margin-top: 34rpx; }
.photo-slot { position: relative; aspect-ratio: 1; overflow: hidden; border: 1rpx solid rgba(83,73,63,.12); border-radius: 24rpx; background: rgba(255,255,255,.58); box-shadow: 0 14rpx 34rpx rgba(68,57,47,.06); }
.slot-image, .slot-empty { width: 100%; height: 100%; }.slot-empty { display: flex; align-items: center; justify-content: center; }.slot-plus { color: rgba(74,66,58,.46); font-size: 46rpx; font-weight: 300; }
.remove-photo { position: absolute; top: 7rpx; right: 7rpx; width: 42rpx; height: 42rpx; margin: 0; padding: 0; border-radius: 50%; color: #fff; background: rgba(36,33,30,.72); font-size: 28rpx; line-height: 40rpx; }
.photo-hint { display: block; margin-top: 18rpx; color: rgba(48,45,41,.56); font-size: 22rpx; line-height: 1.55; }
.quiet-stage { position: relative; height: 270rpx; margin-top: 24rpx; overflow: hidden; border-radius: 34rpx; background: linear-gradient(145deg, #252933, #393642); }
.quiet-glow { position: absolute; inset: 15%; border-radius: 50%; background: radial-gradient(circle, rgba(220,202,160,.24), rgba(156,170,203,.08) 48%, transparent 72%); }
.pet-outline { position: absolute; left: 50%; top: 50%; width: 190rpx; height: 200rpx; transform: translate(-50%,-48%); opacity: .72; }
.ear, .head, .body { position: absolute; background: #d8cdbb; }.ear { top: 10rpx; width: 62rpx; height: 80rpx; border-radius: 60% 60% 28% 28%; }.ear.left { left: 20rpx; transform: rotate(-20deg); }.ear.right { right: 20rpx; transform: rotate(20deg); }.head { left: 28rpx; top: 44rpx; width: 134rpx; height: 116rpx; border-radius: 48%; }.body { left: 15rpx; bottom: 0; width: 160rpx; height: 84rpx; border-radius: 52%; opacity: .82; }
.primary-button, .light-button, .revision-button, .sheet-cancel { min-height: 88rpx; margin: 24rpx 0 0; border-radius: 24rpx; font-size: 26rpx; line-height: 88rpx; }
.primary-button { color: #faf7ef; background: #514a42; box-shadow: 0 16rpx 34rpx rgba(60,52,44,.14); }.primary-button[disabled], .revision-button[disabled] { opacity: .38; }
.avatar-preview-shell { position: relative; width: min(100%, 640rpx); aspect-ratio: 1 / 1; margin: 32rpx auto 0; overflow: hidden; border-radius: 40rpx; box-shadow: 0 12rpx 30rpx rgba(53,48,39,.06); }
.ai-stage { background: #ebe8e0; transition: background-color 420ms ease; }
.ai-stage.is-processing { background: radial-gradient(circle at 48% 58%, #25211f 0%, #111313 48%, #070808 100%); }
.stage-image, .particles, .stage-shade { position: absolute; inset: 0; width: 100%; height: 100%; }.result-backdrop { z-index: 0; opacity: .34; filter: blur(24rpx) saturate(.72); transform: scale(1.09); }.result-image { z-index: 1; object-fit: contain; }.result-image.revealing { animation: resultIn 620ms cubic-bezier(.22,.75,.3,1) both; }.result-image.revealing.quick { animation-duration: 260ms; }.result-image-previous { opacity: 1; }.result-preloader { position: fixed; left: -9999px; top: -9999px; width: 2px; height: 2px; opacity: .01; pointer-events: none; }.stage-shade { z-index: 2; pointer-events: none; background: radial-gradient(circle at 50% 44%, rgba(255,255,255,.13), rgba(224,220,210,.02) 52%, rgba(110,99,85,.08) 100%); }.is-result .stage-shade { background: transparent; }.is-processing .stage-shade { background: radial-gradient(circle at 50% 55%, rgba(208,171,123,.08), rgba(115,168,155,.035) 42%, transparent 66%); }.particles { z-index: 3; opacity: .98; }
.particles { transition: opacity 520ms ease; }.particles-hidden { opacity: 0; pointer-events: none; }
.stage-progress { position: absolute; z-index: 4; left: 28rpx; right: 24rpx; bottom: 24rpx; display: flex; align-items: flex-end; justify-content: space-between; gap: 18rpx; color: #f5f8ff; pointer-events: none; }
.progress-copy { min-width: 0; padding: 14rpx 18rpx; border: 1rpx solid rgba(193,166,126,.2); border-radius: 20rpx; background: rgba(12,13,13,.58); box-shadow: inset 0 1rpx rgba(255,255,255,.045); backdrop-filter: blur(12rpx); }
.progress-title, .progress-caption { display: block; }.progress-title { color: #F2E9DC; font-size: 23rpx; font-weight: 600; letter-spacing: .02em; }.progress-caption { max-width: 360rpx; margin-top: 6rpx; overflow: hidden; color: rgba(208,219,211,.56); font-size: 18rpx; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
.progress-percent { flex: 0 0 auto; min-width: 86rpx; height: 54rpx; padding: 0 17rpx; border: 1rpx solid rgba(205,174,128,.32); border-radius: 999rpx; color: #DAB77F; background: rgba(13,15,14,.86); box-shadow: inset 0 1rpx rgba(255,255,255,.065), 0 8rpx 24rpx rgba(0,0,0,.22); font-size: 26rpx; font-variant-numeric: tabular-nums; line-height: 54rpx; text-align: center; }
.processing-actions, .workbench-actions, .error-panel { width: min(100%, 640rpx); margin: 24rpx auto 0; }.processing-actions { text-align: center; }.upload-status, .background-hint { display: block; color: rgba(48,45,41,.5); font-size: 21rpx; }.light-button { color: #47413b; background: rgba(255,255,255,.58); border: 1rpx solid rgba(75,67,59,.1); }.background-hint { margin-top: 9rpx; }
.workbench-question { display: block; text-align: center; font-size: 31rpx; font-weight: 620; }.section-label { display: block; margin-top: 28rpx; color: rgba(48,45,41,.56); font-size: 21rpx; }.history-scroll { width: 100%; margin-top: 13rpx; white-space: nowrap; }.history-row { display: inline-flex; gap: 12rpx; padding: 2rpx; }.candidate { width: 106rpx; height: 106rpx; overflow: hidden; border: 3rpx solid transparent; border-radius: 20rpx; opacity: .62; transition: opacity .2s ease, border-color .2s ease, transform .2s ease; }.candidate.selected { border-color: #776957; opacity: .9; }.candidate.previewed { border-color: #d4b981; opacity: 1; transform: translateY(-2rpx); box-shadow: 0 8rpx 22rpx rgba(58,49,41,.16); }.candidate-image { width: 100%; height: 100%; }
.secondary-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 14rpx; }.revision-panel { margin-top: 22rpx; padding: 26rpx; border: 1rpx solid rgba(79,69,60,.1); border-radius: 28rpx; background: rgba(255,255,255,.54); }.revision-title, .revision-subtitle, .revision-count { display: block; }.revision-title { font-size: 28rpx; font-weight: 620; }.revision-subtitle { margin-top: 8rpx; color: rgba(48,45,41,.56); font-size: 22rpx; line-height: 1.5; }.revision-input { width: 100%; height: 170rpx; margin-top: 18rpx; padding: 20rpx; box-sizing: border-box; border-radius: 20rpx; color: #302d29; background: rgba(244,241,235,.9); font-size: 24rpx; line-height: 1.5; }.revision-count { margin-top: 7rpx; text-align: right; color: rgba(48,45,41,.42); font-size: 19rpx; }.revision-button { color: #f9f5ed; background: #655c53; }
.feedback-link { min-height: 72rpx; margin: 16rpx auto 0; padding: 0 24rpx; color: rgba(48,45,41,.58); background: transparent; font-size: 22rpx; line-height: 72rpx; }
.feedback-sheet { width: 100%; padding: 36rpx 30rpx calc(24rpx + env(safe-area-inset-bottom)); border-radius: 34rpx 34rpx 26rpx 26rpx; background: #f8f5ef; box-shadow: 0 -18rpx 70rpx rgba(34,30,27,.18); }.feedback-title, .feedback-help { display: block; }.feedback-title { font-size: 34rpx; font-weight: 650; }.feedback-help { margin-top: 12rpx; color: rgba(48,45,41,.58); font-size: 22rpx; line-height: 1.55; }.feedback-categories { display: flex; flex-wrap: wrap; gap: 12rpx; margin-top: 24rpx; }.feedback-category { min-height: 88rpx; margin: 0; padding: 0 22rpx; border: 1rpx solid rgba(79,69,60,.12); border-radius: 999rpx; color: #514a42; background: rgba(255,255,255,.62); font-size: 22rpx; line-height: 88rpx; }.feedback-category.selected { color: #faf7ef; background: #655c53; }.feedback-note { width: 100%; height: 160rpx; margin-top: 22rpx; padding: 20rpx; box-sizing: border-box; border-radius: 22rpx; color: #302d29; background: rgba(236,232,224,.78); font-size: 23rpx; line-height: 1.5; }
.confirm-saving-mask { position: fixed; z-index: 30; inset: 0; display: flex; align-items: center; justify-content: center; padding: 40rpx; background: rgba(34,31,29,.18); }.confirm-saving-card { width: 320rpx; padding: 34rpx 30rpx; border: 1rpx solid rgba(255,255,255,.58); border-radius: 30rpx; text-align: center; background: rgba(248,245,239,.92); box-shadow: 0 24rpx 70rpx rgba(38,33,29,.16); }.confirm-saving-spinner { width: 42rpx; height: 42rpx; margin: 0 auto; border: 4rpx solid rgba(81,74,66,.16); border-top-color: #655c53; border-radius: 50%; animation: confirmSpin .9s linear infinite; }.confirm-saving-title, .confirm-saving-subtitle { display: block; }.confirm-saving-title { margin-top: 20rpx; font-size: 26rpx; font-weight: 620; }.confirm-saving-subtitle { margin-top: 7rpx; color: rgba(48,45,41,.52); font-size: 21rpx; }
.error-panel { text-align: center; }.error-title { display: block; color: #6e4e48; font-size: 25rpx; line-height: 1.5; }
.modal-mask { position: fixed; z-index: 20; inset: 0; display: flex; align-items: flex-end; padding: 24rpx; box-sizing: border-box; background: rgba(24,22,21,.36); }.member-sheet { width: 100%; padding: 36rpx 30rpx calc(24rpx + env(safe-area-inset-bottom)); border-radius: 34rpx 34rpx 26rpx 26rpx; background: #f8f5ef; box-shadow: 0 -18rpx 70rpx rgba(34,30,27,.18); }.member-title, .member-text, .member-notes { display: block; }.member-title { font-size: 34rpx; font-weight: 650; }.member-text { margin-top: 16rpx; color: rgba(48,45,41,.7); font-size: 24rpx; line-height: 1.65; }.member-notes { margin-top: 14rpx; color: rgba(48,45,41,.48); font-size: 21rpx; line-height: 1.55; }.sheet-cancel { color: #57504a; background: transparent; }
.slot-tap, .button-tap { transform: scale(.975); opacity: .88; }.tap-small { transform: scale(.94); opacity: .84; }
@keyframes resultIn { from { opacity: 0; filter: blur(18rpx); transform: scale(.982); } to { opacity: 1; filter: blur(0); transform: scale(1); } }
@keyframes confirmSpin { to { transform: rotate(360deg); } }
.reduce-motion .result-image.revealing, .reduce-motion .confirm-saving-spinner { animation: none; }
.reduce-motion .particles { transition: none; }

.avatar-page .page-nav{min-height:88rpx;}.avatar-page .back-button{min-width:88rpx;min-height:88rpx;}.avatar-page .title{font-size:44rpx;font-weight:500;line-height:1.4;}.avatar-page .subtitle{font-size:24rpx;line-height:1.7;}.avatar-page .primary-button{min-height:96rpx;border-radius:48rpx;box-shadow:none;background:#596650;}.avatar-page .photo-slot{border-radius:26rpx;box-shadow:none;}.avatar-page .quiet-stage{box-shadow:none;}.avatar-page .avatar-preview-shell{border-radius:30rpx;box-shadow:none;}.avatar-page .is-result{border:1rpx solid #e7e5dc;}.avatar-page .result-image.revealing{animation:none;}.avatar-page .workbench-question{font-size:32rpx;font-weight:500;line-height:1.6;}.avatar-page .light-button{min-height:88rpx;box-shadow:none;border-radius:44rpx;}.avatar-page .candidate{border-radius:20rpx;}.avatar-page .candidate.previewed{box-shadow:none;transform:none;border-color:#7b8b6b;}
.generation-immersive{min-height:100vh;background:#111c21!important;color:#f6f0e4;}.generation-immersive .nav-kicker,.generation-immersive .quota-text{color:#a7b5b4;}.generation-immersive .back-button{color:#f2e8d8;background:transparent;border-color:rgba(196,213,206,.2);}.generation-immersive .top-copy{margin-top:40rpx;}.generation-immersive .title{color:#f5efdf;font-size:42rpx;}.generation-immersive .subtitle{color:#aab9b8;}.generation-immersive .avatar-preview-shell.ai-stage{background:#111c21;border:0;border-radius:0;box-shadow:none;}.generation-immersive .stage-shade{background:transparent;}.generation-immersive .progress-copy{padding:0;border:0;background:transparent;box-shadow:none;backdrop-filter:none;}.generation-immersive .progress-title{font-size:24rpx;font-weight:400;color:#e6eee6;}.generation-immersive .progress-caption{font-size:20rpx;color:#acbab8;max-width:460rpx;white-space:normal;line-height:1.6;}.generation-immersive .progress-percent{padding:0;min-width:68rpx;background:transparent;border:0;border-radius:0;color:#d4dfcb;box-shadow:none;font-size:26rpx;}.generation-immersive .stage-progress{left:22rpx;right:22rpx;bottom:40rpx;align-items:center;}.generation-progress-track{position:absolute;z-index:4;bottom:20rpx;left:22rpx;right:22rpx;height:5rpx;background:#344347;border-radius:4rpx;overflow:hidden;}.generation-progress-fill{height:100%;background:#c4d6c1;border-radius:4rpx;transition:width 500ms ease;}.generation-dedication{display:block;margin:26rpx 0 38rpx;color:#b6c4be;font-size:24rpx;letter-spacing:2rpx;line-height:1.8;text-align:center;}.generation-immersive .light-button{border:1rpx solid #43534f;color:#e4eadd;background:transparent;}.generation-immersive .background-hint,.generation-immersive .upload-status{color:#aebeb8;font-size:21rpx;}.reduce-motion .generation-progress-fill{transition:none;}@media(prefers-reduced-motion:reduce){.generation-progress-fill{transition:none;}}

.portrait-invitation{margin:38rpx 0 12rpx;padding:36rpx 24rpx;border-top:1rpx solid #dddccf;border-bottom:1rpx solid #dddccf;text-align:center;}.invitation-kicker{display:block;color:#838875;font-size:17rpx;letter-spacing:4rpx;}.invitation-title{display:block;margin-top:20rpx;font-family:'Songti SC','Noto Serif CJK SC',serif;font-size:32rpx;color:#454d3e;line-height:1.7;}.invitation-note{display:block;margin-top:12rpx;font-size:22rpx;color:#737a68;line-height:1.6;}
</style>
