<template>
  <view v-if="visible" class="consent-mask" @touchmove.stop.prevent>
    <view class="consent-sheet">
      <view class="sheet-grabber"></view>
      <text class="sheet-title">{{ copy.title }}</text>
      <scroll-view scroll-y class="sheet-scroll">
        <text class="intro">{{ copy.intro }}</text>
        <view class="provider-block">
          <text class="provider-title">{{ copy.avatarTitle }}</text>
          <text class="provider-line">{{ copy.avatarProvider }}</text>
          <text class="provider-line">{{ copy.avatarData }}</text>
          <text class="provider-purpose">{{ copy.avatarPurpose }}</text>
        </view>
        <view class="provider-block">
          <text class="provider-title">{{ copy.chatTitle }}</text>
          <text class="provider-line">{{ copy.chatProvider }}</text>
          <text class="provider-line">{{ copy.chatData }}</text>
          <text class="provider-purpose">{{ copy.chatPurpose }}</text>
        </view>
        <view class="legal-links">
          <text @click="openLegal('privacy')">{{ copy.privacy }}</text>
          <text @click="openLegal('terms')">{{ copy.terms }}</text>
          <text @click="openLegal('ai-data')">{{ copy.detail }}</text>
        </view>
      </scroll-view>
      <view class="agreement" @click="checked = !checked">
        <view :class="['check', checked ? 'check-on' : '']"><text v-if="checked">✓</text></view>
        <text>{{ copy.agreement }}</text>
      </view>
      <button :class="['accept-btn', checked ? '' : 'accept-disabled']" :disabled="!checked" hover-class="tap" @click="accept">{{ copy.accept }}</button>
      <button class="decline-btn" hover-class="tap" @click="$emit('decline')">{{ copy.decline }}</button>
    </view>
  </view>
</template>

<script>
import { acceptAiConsent } from '../common/ai-consent.js';
import { getAppLocale, t } from '../common/i18n.js';

export default {
  name: 'AiDataConsentSheet',
  props: { visible: { type: Boolean, default: false } },
  emits: ['accepted', 'decline'],
  data() { return { checked: false, locale: getAppLocale() }; },
  computed: {
    copy() {
      const keys = ['title', 'intro', 'avatarTitle', 'avatarProvider', 'avatarData', 'avatarPurpose', 'chatTitle', 'chatProvider', 'chatData', 'chatPurpose', 'agreement', 'accept', 'decline', 'privacy', 'terms', 'detail'];
      return keys.reduce((result, key) => { result[key] = t(`aiConsent.${key}`, {}, this.locale); return result; }, {});
    }
  },
  watch: {
    visible(value) { if (value) { this.checked = false; this.locale = getAppLocale(); } }
  },
  methods: {
    accept() {
      if (!this.checked) return;
      this.$emit('accepted', acceptAiConsent(this.locale));
    },
    openLegal(type) { uni.navigateTo({ url: `/pages/legal/legal?type=${type}` }); }
  }
};
</script>

<style scoped>
.consent-mask { position: fixed; z-index: 999; inset: 0; display: flex; align-items: flex-end; background: rgba(27, 25, 23, .46); }
.consent-sheet { width: 100%; max-height: 88vh; padding: 18rpx 32rpx calc(28rpx + env(safe-area-inset-bottom)); border-radius: 32rpx 32rpx 0 0; background: #FBFAF7; box-shadow: 0 -18rpx 60rpx rgba(34, 30, 26, .16); }
.sheet-grabber { width: 72rpx; height: 8rpx; margin: 0 auto 24rpx; border-radius: 99rpx; background: #D8D3CB; }
.sheet-title, .provider-title, .provider-line, .provider-purpose, .intro { display: block; }
.sheet-title { color: #2F2A24; font-size: 36rpx; font-weight: 650; line-height: 1.3; }
.sheet-scroll { max-height: 56vh; margin-top: 20rpx; }
.intro, .provider-line { color: #6F685F; font-size: 24rpx; line-height: 1.65; }
.provider-block { margin-top: 24rpx; padding: 24rpx; border-radius: 22rpx; background: #F0ECE5; }
.provider-title { color: #332E28; font-size: 27rpx; font-weight: 600; }
.provider-line { margin-top: 9rpx; }
.provider-purpose { margin-top: 10rpx; color: #665745; font-size: 23rpx; line-height: 1.5; }
.legal-links { margin: 26rpx 0; display: flex; flex-wrap: wrap; gap: 24rpx; color: #6D5945; font-size: 23rpx; }
.agreement { min-height: 76rpx; display: flex; align-items: center; gap: 16rpx; color: #514B44; font-size: 23rpx; line-height: 1.45; }
.check { width: 36rpx; height: 36rpx; flex: 0 0 36rpx; border: 1rpx solid #B9B1A7; border-radius: 10rpx; display: flex; align-items: center; justify-content: center; color: #fff; }
.check-on { border-color: #6D5945; background: #6D5945; }
.accept-btn, .decline-btn { height: 86rpx; margin: 14rpx 0 0; border-radius: 22rpx; font-size: 27rpx; line-height: 86rpx; }
.accept-btn { color: #fff; background: #5F5142; }
.accept-disabled { opacity: .42; }
.decline-btn { color: #71695F; background: transparent; }
.accept-btn::after, .decline-btn::after { border: none; }
.tap { transform: scale(.98); opacity: .86; }
</style>
