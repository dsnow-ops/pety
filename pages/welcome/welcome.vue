<template>
  <view class="welcome-page" :class="petThemeClass" :style="appThemeStyle">
    <view class="brand-row">
      <view class="brand-mark"><text>归</text></view>
      <view class="brand-copy"><text class="brand-name">归爪</text><text class="brand-subtitle">Lumière Pet</text></view>
    </view>

    <view class="intro-block">
      <text class="step-kicker">{{ copy.kicker }}</text>
      <text class="page-title">{{ copy.title }}</text>
      <text class="page-subtitle">{{ copy.subtitle }}</text>
    </view>

    <view class="form-panel">
      <view class="field-block">
        <text class="field-label">{{ copy.name }}</text>
        <input v-model="petName" class="name-input" :placeholder="copy.namePlaceholder" maxlength="30" />
      </view>

      <view class="field-block">
        <text class="field-label">{{ copy.type }}</text>
        <view class="choice-row">
          <button v-for="option in typeOptions" :key="option.key" class="choice-button" :class="{ active: petType === option.key }" hover-class="choice-tap" @click="petType = option.key">{{ option.label }}</button>
        </view>
        <input v-if="petType === 'other'" v-model="petTypeCustom" class="other-input" :placeholder="copy.otherPlaceholder" maxlength="20" />
      </view>

      <view class="field-block">
        <text class="field-label">{{ copy.gender }}</text>
        <view class="choice-row gender-row">
          <button v-for="option in genderOptions" :key="option.key" class="choice-button" :class="{ active: petGender === option.key }" hover-class="choice-tap" @click="petGender = option.key">{{ option.label }}</button>
        </view>
      </view>
    </view>

    <button class="continue-button" :disabled="isSaving" :loading="isSaving" hover-class="button-tap" @click="continueToAvatar">{{ isSaving ? copy.saving : copy.continue }}</button>
  </view>
</template>

<script>
import {scopedStorage} from "../../common/scoped-storage.js";
import { addPet, getActivePet, setActivePet, updateActivePet } from '../../common/pet-store.js';
import { canCreateAnotherPet } from '../../common/pet-creation-access.js';
import { savePetProfile, getPetProfile } from '../../common/profile-store.js';
import { getPetRelationshipStage, withRelationshipStage } from '../../common/relationship-config.js';
import { getDefaultAvatarStyle } from '../../common/pet-avatar-generator.js';
import { getAppLocale, t } from '../../common/i18n.js';
import { isLoggedIn } from '../../common/auth-store.js';
import { beginPetCreationIntent, takePetCreationIntent } from '../../common/pet-creation-intent.js';

const ONBOARDING_PENDING_KEY = 'guizhua_onboarding_pending';

export default {
  data() {
    return {
      locale: getAppLocale(), entryMode: 'auto', startupRedirecting: false, activePetId: '', activePetSnapshot: null,
      petName: '', petType: 'cat', petTypeCustom: '', petGender: 'unknown', isSaving: false,
      formInitialized: false, resumeCreation: '', resumingCreation: false, loginOpening: false
    };
  },
  computed: {
    copy() {
      const keys = ['kicker', 'title', 'subtitle', 'name', 'namePlaceholder', 'type', 'cat', 'dog', 'other', 'otherPlaceholder', 'gender', 'male', 'female', 'unknown', 'continue', 'saving', 'saveFailed'];
      return keys.reduce((result, key) => { result[key] = t(`welcome.${key}`, {}, this.locale); return result; }, {});
    },
    typeOptions() { return ['cat', 'dog', 'other'].map(key => ({ key, label: this.copy[key] })); },
    genderOptions() { return ['male', 'female', 'unknown'].map(key => ({ key, label: this.copy[key] })); }
  },
  onLoad(options = {}) {
    this.entryMode = options.mode === 'create' ? 'create' : options.mode === 'edit' ? 'edit' : 'auto';
    this.resumeCreation = this.entryMode === 'create' ? String(options.resume || '') : '';
  },
  onShow() {
    this.locale = getAppLocale();
    this.loginOpening = false;
    if (this.resumeCreation && isLoggedIn()) {
      const draft = takePetCreationIntent(this.resumeCreation);
      this.resumeCreation = '';
      if (draft) {
        this.resetForm(); Object.assign(this, draft); this.formInitialized = true; this.resumingCreation = true;
        this.continueToAvatar();
        return;
      }
    }
    if (this.entryMode === 'auto') {
      const existingPet = getActivePet();
      if (existingPet) {
        if (!this.startupRedirecting) {
          this.startupRedirecting = true;
          uni.switchTab({ url: '/pages/home/home', fail: () => { this.startupRedirecting = false; } });
        }
        return;
      }
      this.entryMode = 'create';
    }
    if (this.entryMode === 'create') {
      if (!this.formInitialized) { this.resetForm(); this.formInitialized = true; }
      return;
    }
    const pet = getActivePet(); if (!pet) return;
    const profile = getPetProfile(pet.id);
    this.activePetId = pet.id; this.activePetSnapshot = pet; this.petName = pet.name;
    this.petType = pet.petType || (['cat', 'dog'].includes(profile.species) ? profile.species : 'other');
    this.petTypeCustom = pet.petTypeCustom || '';
    this.petGender = pet.petGender || profile.gender || 'unknown';
  },
  methods: {
    resetForm() { this.activePetId = ''; this.activePetSnapshot = null; this.petName = ''; this.petType = 'cat'; this.petTypeCustom = ''; this.petGender = 'unknown'; },
    continueToAvatar() {
      if (this.isSaving || this.loginOpening) return;
      const name = this.petName.trim();
      if (!name) { uni.showToast({ title: this.copy.namePlaceholder, icon: 'none' }); return; }
      if (this.petType === 'other' && !this.petTypeCustom.trim()) { uni.showToast({ title: this.copy.otherPlaceholder, icon: 'none' }); return; }
      if (!this.activePetId && !isLoggedIn()) {
        const destination = beginPetCreationIntent(this);
        this.loginOpening = true;
        uni.navigateTo({ url: '/pages/auth/login?uniIdRedirectUrl=' + encodeURIComponent(destination),
          fail: () => { this.loginOpening = false; uni.showToast({ title: this.copy.saveFailed, icon: 'none' }); } });
        return;
      }
      if (!this.activePetId) {
        const access = canCreateAnotherPet();
        if (!access.allowed) {
          uni.showToast({ title: access.reason === 'development_limit_reached' ? t('welcome.developmentLimit', { limit: access.limit }, this.locale) : t('welcome.membershipRequired', {}, this.locale), icon: 'none' });
          return;
        }
      }
      this.isSaving = true;
      try {
        const creatingNewPet = !this.activePetId;
        const existing = this.activePetSnapshot || {};
        const relationshipStage = this.activePetId ? getPetRelationshipStage(existing) : 'current';
        const patch = withRelationshipStage({
          name, petType: this.petType, petTypeCustom: this.petType === 'other' ? this.petTypeCustom.trim() : '', petGender: this.petGender,
          avatarSource: existing.avatarSource || 'placeholder', originalPhotoUrl: existing.originalPhotoUrl || '',
          generatedAvatarUrl: existing.generatedAvatarUrl || '', generatedAvatarFileId: existing.generatedAvatarFileId || '',
          avatarStyle: existing.avatarStyle || getDefaultAvatarStyle('current'), avatarStatus: existing.avatarStatus || 'none',
          avatarUpdatedAt: existing.avatarUpdatedAt || 0
        }, relationshipStage);
        const created = (this.activePetId ? updateActivePet(patch) : null) || addPet(patch);
        const ownedPet = setActivePet(created.id) || created;
        this.activePetId = ownedPet.id;
        this.activePetSnapshot = ownedPet;
        const profile = getPetProfile(ownedPet.id);
        savePetProfile(ownedPet.id, { ...profile, species: this.petType === 'other' ? 'other' : this.petType, gender: this.petGender });
        if (creatingNewPet) scopedStorage.setStorageSync(ONBOARDING_PENDING_KEY, true);
        const navigation = {
          url: !creatingNewPet && ownedPet.avatarStatus === 'ready' && (ownedPet.generatedAvatarUrl || ownedPet.generatedAvatarFileId)
            ? '/pages/home/home'
            : `/pages/avatar-generate/avatar-generate?petId=${encodeURIComponent(ownedPet.id)}`,
          fail: () => {
            this.isSaving = false;
            uni.showToast({ title: this.copy.saveFailed, icon: 'none' });
          }
        };
        if (navigation.url === '/pages/home/home') uni.switchTab(navigation);
        else if (this.resumingCreation) uni.reLaunch(navigation);
        else uni.redirectTo(navigation);
      } catch (error) {
        this.isSaving = false;
        uni.showToast({ title: this.copy.saveFailed, icon: 'none' });
      }
    }
  }
};
</script>

<style scoped>
.welcome-page { min-height: 100vh; padding: calc(var(--status-bar-height, 0px) + 48rpx) 38rpx calc(54rpx + env(safe-area-inset-bottom)); box-sizing: border-box; color: #302d29; background: radial-gradient(circle at 86% 12%, rgba(198,208,190,.34), transparent 32%), linear-gradient(160deg, #f7f3eb, #eee8de 58%, #f5f3ee); }
.brand-row { display: flex; align-items: center; gap: 18rpx; }.brand-mark { width: 74rpx; height: 74rpx; display: flex; align-items: center; justify-content: center; border-radius: 24rpx; color: #f8f4ec; background: #5c554d; font-size: 30rpx; box-shadow: 0 14rpx 32rpx rgba(63,55,47,.14); }.brand-copy { display: flex; flex-direction: column; }.brand-name { font-size: 28rpx; font-weight: 650; }.brand-subtitle { margin-top: 2rpx; color: rgba(48,45,41,.48); font-size: 18rpx; }
.intro-block { margin-top: 66rpx; display: flex; flex-direction: column; }.step-kicker { color: #7d715f; font-size: 20rpx; letter-spacing: 1rpx; }.page-title { margin-top: 14rpx; font-size: 48rpx; font-weight: 660; line-height: 1.2; }.page-subtitle { margin-top: 14rpx; color: rgba(48,45,41,.58); font-size: 25rpx; line-height: 1.55; }
.form-panel { margin-top: 42rpx; display: flex; flex-direction: column; gap: 18rpx; }.field-block { padding: 27rpx; border: 1rpx solid rgba(75,67,59,.08); border-radius: 28rpx; background: rgba(255,255,255,.6); box-shadow: 0 16rpx 36rpx rgba(62,54,47,.05); }.field-label { display: block; color: rgba(48,45,41,.58); font-size: 22rpx; }.name-input { height: 72rpx; margin-top: 8rpx; color: #302d29; font-size: 33rpx; font-weight: 560; }.choice-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12rpx; margin-top: 18rpx; }.choice-button { min-width: 0; height: 76rpx; margin: 0; padding: 0 8rpx; border-radius: 20rpx; color: #5d554d; background: rgba(239,235,227,.86); font-size: 23rpx; line-height: 76rpx; }.choice-button::after, .continue-button::after { border: none; }.choice-button.active { color: #faf7ef; background: #5d574f; }.other-input { height: 74rpx; margin-top: 14rpx; padding: 0 20rpx; border-radius: 18rpx; background: rgba(238,234,226,.8); font-size: 24rpx; }.gender-row .choice-button:last-child { font-size: 20rpx; }
.continue-button { height: 94rpx; margin: 34rpx 0 0; border-radius: 26rpx; color: #faf7ef; background: #62584d; font-size: 28rpx; font-weight: 620; line-height: 94rpx; box-shadow: 0 18rpx 40rpx rgba(67,57,48,.16); }.continue-button[disabled] { opacity: .5; }.choice-tap, .button-tap { transform: scale(.975); opacity: .88; }
</style>
