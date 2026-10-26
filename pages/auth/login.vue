<template>
  <view class="auth-page" :class="petThemeClass" :style="appThemeStyle">
    <view class="brand-head">
      <text class="brand-mark">LUMIERE PET</text>
      <text class="auth-title">{{ redirectUrl.includes('resume=create_') ? '登录，继续创建宠物' : '欢迎回到归爪' }}</text>
      <text v-if="sessionLocked" class="auth-subtitle">账号会话已结束。原账号的草稿和照片仍保存在这台设备，重新登录该账号后可继续。</text><text v-if="redirectUrl.includes('resume=create_')" class="auth-subtitle">刚填的名字和资料已暂存，登录成功后直接进入照片与形象生成页面。</text><text v-else class="auth-subtitle">登录后进入你的账号空间。本机体验资料会保留，不会自动并入账号。</text>
    </view>

    <AppButton v-if="sessionLocked" variant="text" @click="enterGuestSpace">使用本机游客空间</AppButton><view class="auth-surface">
      <view class="mode-tabs" role="group" aria-label="登录方式">
        <view :class="['mode-tab', mode === 'sms' ? 'mode-tab-active' : '']" role="button" tabindex="0" :aria-pressed="mode === 'sms'" @click="setMode('sms')" @keydown.enter.prevent="setMode('sms')" @keydown.space.prevent="setMode('sms')">验证码登录</view>
        <view :class="['mode-tab', mode === 'password' ? 'mode-tab-active' : '']" role="button" tabindex="0" :aria-pressed="mode === 'password'" @click="setMode('password')" @keydown.enter.prevent="setMode('password')" @keydown.space.prevent="setMode('password')">密码登录</view>
      </view>

      <template v-if="mode === 'password'">
        <view class="field">
          <text class="field-label">手机号 / 账号 / 邮箱</text>
          <input v-model.trim="account" class="auth-input" maxlength="64" placeholder="请输入登录账号" placeholder-class="input-placeholder" />
        </view>
        <view class="field">
          <text class="field-label">密码</text>
          <view class="password-field">
            <input v-model="password" class="auth-input password-input" :password="!showPassword" maxlength="20" placeholder="请输入密码" placeholder-class="input-placeholder" />
            <button class="eye-button" role="button" tabindex="0" :aria-label="showPassword ? '隐藏密码' : '显示密码'" hover-class="tap-soft" @click="showPassword = !showPassword" @keydown.enter.prevent="showPassword = !showPassword" @keydown.space.prevent="showPassword = !showPassword">
              <uni-icons :type="showPassword ? 'eye-filled' : 'eye-slash-filled'" size="19" color="#756C63"></uni-icons>
            </button>
          </view>
        </view>
        <view v-if="needCaptcha" class="field">
          <view class="field-head"><text class="field-label">图形验证码</text><text class="field-link" @click="loadCaptcha">换一张</text></view>
          <view class="captcha-row">
            <image v-if="captchaSrc" :src="captchaSrc" class="captcha-image" mode="aspectFit" @click="loadCaptcha"></image>
            <view v-else class="captcha-empty" @click="loadCaptcha">重新加载</view>
            <input v-model.trim="captcha" class="auth-input captcha-input" maxlength="6" placeholder="输入图片文字" placeholder-class="input-placeholder" />
          </view>
          <text v-if="captchaError" class="field-error">{{ captchaError }}</text>
        </view>
        <text class="forgot-link" role="link" tabindex="0" @click="openRetrieve" @keydown.enter.prevent="openRetrieve">忘记密码</text>
      </template>

      <template v-else>
        <view class="field">
          <text class="field-label">手机号</text>
          <view class="mobile-field"><text class="country-code">+86</text><input v-model.trim="mobile" class="auth-input mobile-input" type="number" maxlength="11" placeholder="中国大陆手机号" placeholder-class="input-placeholder" :disabled="smsSending || submitting" @input="onMobileChanged" /><button v-if="mobile" class="clear-mobile" :disabled="smsSending || submitting" aria-label="清除手机号" @click="clearMobile">×</button></view>
        </view>
        <view v-if="smsReady" class="field">
          <view class="field-head"><text class="field-label">图形验证码</text><text class="field-link" @click="loadSmsCaptcha">{{ smsCaptchaLoading ? '加载中…' : '换一张' }}</text></view>
          <view class="captcha-row">
            <image v-if="smsCaptchaSrc" :src="smsCaptchaSrc" class="captcha-image" mode="aspectFit" @click="loadSmsCaptcha"></image>
            <view v-else class="captcha-empty" @click="loadSmsCaptcha">{{ smsCaptchaLoading ? '正在加载…' : (/^1\d{10}$/.test(mobile) ? '点击重新加载' : '填完手机号自动显示') }}</view>
            <input v-model.trim="smsCaptcha" class="auth-input captcha-input" maxlength="6" placeholder="输入图片文字" :disabled="smsSending || smsCaptchaLoading || submitting" />
          </view>
          <text v-if="smsCaptchaError" class="field-error">{{ smsCaptchaError }}</text>
          <text v-else-if="smsCaptchaUsed" class="sms-status">图形与输入已保留。若需再次发送短信，请先点“换一张”。</text>
        </view>
        <view class="field">
          <text class="field-label">短信验证码</text>
          <view class="sms-row">
            <input v-model.trim="smsCode" class="auth-input sms-input" type="number" maxlength="6" autocomplete="one-time-code" placeholder="6 位验证码" placeholder-class="input-placeholder" />
            <button class="code-button" role="button" :tabindex="smsSending || submitting || smsCaptchaLoading || countdown > 0 || !smsReady ? -1 : 0" :disabled="smsSending || submitting || smsCaptchaLoading || countdown > 0 || !smsReady" hover-class="tap-soft" @click="sendCode" @keydown.enter.prevent="sendCode" @keydown.space.prevent="sendCode">{{ codeButtonText }}</button>
          </view>
        </view>
        <text v-if="smsStatusText" class="sms-status" role="status">{{ smsStatusText }}</text>
        <view v-if="needCaptcha" class="field">
          <view class="field-head"><text class="field-label">登录安全验证</text><text class="field-link" @click="loadCaptcha">换一张</text></view>
          <view class="captcha-row">
            <image v-if="captchaSrc" :src="captchaSrc" class="captcha-image" mode="aspectFit" @click="loadCaptcha"></image>
            <view v-else class="captcha-empty" @click="loadCaptcha">重新加载</view>
            <input v-model.trim="captcha" class="auth-input captcha-input" maxlength="6" placeholder="输入图片文字" />
          </view>
          <text v-if="captchaError" class="field-error">{{ captchaError }}</text>
        </view>
        <view v-if="!smsReady" class="capability-note">当前版本尚未配置短信服务。你可以切换到密码登录，或继续以游客身份使用。</view>
      </template>

      <text v-if="formError" class="field-error" role="alert">{{ formError }}</text>

      <view class="agreement-row" @click="agreed = !agreed">
        <view :class="['agreement-check', agreed ? 'agreement-check-on' : '']" role="checkbox" tabindex="0" :aria-checked="agreed" aria-label="同意用户协议和隐私政策" @keydown.enter.stop.prevent="agreed = !agreed" @keydown.space.stop.prevent="agreed = !agreed"><uni-icons v-if="agreed" type="checkmarkempty" size="14" color="#FFFFFF"></uni-icons></view>
        <view class="agreement-copy">我已阅读并同意<text class="legal-link" role="link" tabindex="0" @click.stop="openLegal('terms')" @keydown.enter.stop.prevent="openLegal('terms')">《用户协议》</text>和<text class="legal-link" role="link" tabindex="0" @click.stop="openLegal('privacy')" @keydown.enter.stop.prevent="openLegal('privacy')">《隐私政策》</text></view>
      </view>

      <button :class="['primary-button', !agreed ? 'primary-button-muted' : '']" role="button" :tabindex="submitting ? -1 : 0" :disabled="submitting" hover-class="tap-button" @click="submitLogin" @keydown.enter.prevent="submitLogin" @keydown.space.prevent="submitLogin">{{ submitting ? '正在登录' : '登录' }}</button>
      <view class="bottom-actions"><text role="link" tabindex="0" @click="goRegister" @keydown.enter.prevent="goRegister">创建账号</text><text role="link" tabindex="0" @click="continueAsGuest" @keydown.enter.prevent="continueAsGuest">{{ redirectUrl.includes('resume=create_') ? '返回填写资料' : '游客继续' }}</text></view>

      <view class="alternative-logins">
        <text class="alternative-title">其他登录方式</text>
        <view class="alternative-grid">
          <button
            v-for="item in alternativeLoginMethods"
            :key="item.key"
            class="alternative-login"
            role="button"
            :tabindex="item.available ? 0 : -1"
            :disabled="!item.available"
            :aria-label="`${item.title}，${item.statusText}`"
            hover-class="tap-soft"
            @click="startAlternativeLogin(item)"
            @keydown.enter.prevent="startAlternativeLogin(item)"
            @keydown.space.prevent="startAlternativeLogin(item)"
          >
            <view class="alternative-icon">
              <uni-icons v-if="item.icon" :type="item.icon" size="22" color="#665D54"></uni-icons>
              <text v-else class="alternative-icon-text">A</text>
            </view>
            <text class="alternative-name">{{ item.title }}</text>
            <text class="alternative-status">{{ item.statusText }}</text>
          </button>
        </view>
      </view>

      <text class="language-switch" role="button" tabindex="0" @click="toggleLanguage" @keydown.enter.prevent="toggleLanguage" @keydown.space.prevent="toggleLanguage">{{ locale === 'en' ? '中文' : 'English' }}</text>

    </view>
  </view>
</template>

<script>
import {clearSession} from '../../common/single-session-client.js';
import { getAuthCapabilities } from '../../common/auth-capabilities.js';
import { friendlyAuthError, loginWithPassword, loginWithSms, beginAuthAttempt, cancelPendingAuth } from '../../common/auth-session.js';
import { getSmsSendState, requestSmsLoginCode } from '../../common/sms-send-gate.js';
import { normalizeAuthRedirect, navigateAuthDestination } from '../../common/auth-redirect.js';
import { normalizeCaptchaSource, writeSafeCaptchaLog } from '../../common/auth-captcha.js';
import { successHaptic } from '../../common/haptics.js';
import { getAppLocale, setAppLocale } from '../../common/i18n.js';

const uniIdCo = uniCloud.importObject('uni-id-co', { customUI: true });

export default {
  data() {
    const capabilities = getAuthCapabilities();
    return {
      capabilities,
      authAttempt: null,
      viewAttempt: 0,
      disposed: false,
      pageVisible: true,
      locale: getAppLocale(),
      mode: 'sms',
      account: '',
      password: '',
      showPassword: false,
      mobile: '',
      smsCode: '',
      agreed: false,
      captcha: '',
      captchaSrc: '',
      captchaError: '',
      needCaptcha: false,
      captchaRequest: 0,
      smsCaptchaRequest: 0,
      smsCaptcha: '',
      smsCaptchaSrc: '',
      smsCaptchaError: '',
      smsCaptchaLoading: false,
      smsCaptchaUsed: false,
      smsCaptchaMobile: '',
      lastSmsMobile: '',
      smsStatus: 'idle',
      formError: '',
      submitting: false,
      smsSending: false,
      countdown: 0,
      countdownTimer: null,
      sessionLocked:false, redirectUrl: ''
    };
  },
  computed: {
    smsReady() {
      return this.capabilities.smsLogin.callable === true;
    },
    codeButtonText() {
      if (!this.smsReady) return '尚未接入';
      if (this.smsSending) return '正在发送';
      return this.countdown > 0 ? `${this.countdown}s 后重发` : '获取短信';
    },
    smsStatusText() {
      if (!this.lastSmsMobile || this.lastSmsMobile !== this.mobile) return this.countdown > 0 ? '请等待发送间隔结束后，再获取短信。' : '';
      if (this.smsStatus === 'accepted') return '发送请求已受理，请查看手机短信。收到后在上方填写验证码。';
      if (this.smsStatus === 'unknown') return this.countdown > 0 ? '暂未确认发送结果，请先查看短信，倒计时结束后可重试。' : '上次发送结果未确认。如果仍未收到，可以重新获取。';
      return '';
    },
    alternativeLoginMethods() {
      const methods = [
        this.createAlternativeMethod('oneClickLogin', '本机号码一键登录', 'phone-filled'),
        this.createAlternativeMethod('wechatLogin', '微信', 'weixin')
      ];
      if (this.capabilities.appleLogin.status !== 'UNSUPPORTED_PLATFORM') {
        methods.push(this.createAlternativeMethod('appleLogin', 'Apple', ''));
      }
      return methods;
    }
  },
  onLoad(options = {}) {
    this.sessionLocked=!!uni.getStorageSync('pety_session_lock_v1');
    this.redirectUrl = this.normalizeRedirectUrl(options.uniIdRedirectUrl);
  },
  onShow() { this.pageVisible = true; this.startCountdown(); },
  onHide() { this.pageVisible = false; this.clearCountdown(); this.cancelLoginAttempt(); },
  onBackPress() { this.cancelLoginAttempt(); return this.sessionLocked; },
  onUnload() {
    this.disposed = true;
    this.pageVisible = false;
    if (this.authAttempt !== null) cancelPendingAuth(this.authAttempt);
    this.clearCountdown();
    this.password = '';
    this.smsCode = '';
    this.captcha = '';
    this.smsCaptcha = '';
    this.captchaRequest += 1;
    this.smsCaptchaRequest += 1;
    this.redirectUrl = '';
  },
  methods: {
    enterGuestSpace(){clearSession();uni.reLaunch({url:'/pages/home/home'});},
    cancelLoginAttempt() {
      this.viewAttempt += 1;
      if (this.authAttempt !== null) cancelPendingAuth(this.authAttempt);
    },
    setMode(mode) {
      if (this.submitting || this.smsSending || this.mode === mode) return;
      this.mode = mode;
      this.captchaRequest += 1;
      this.captcha = ''; this.captchaSrc = ''; this.needCaptcha = false; this.formError = '';
      if (mode === 'sms' && !this.smsCaptchaSrc) this.loadSmsCaptcha();
    },
    onMobileChanged(event) {
      if (event?.detail?.value !== undefined) this.mobile = String(event.detail.value).trim();
      if (this.smsCaptchaMobile === this.mobile) return;
      this.smsCaptchaMobile = this.mobile;
      this.smsCode = ''; this.formError = '';
      this.smsCaptchaRequest += 1;
      this.smsCaptchaLoading = false;
      this.smsCaptcha = ''; this.smsCaptchaSrc = ''; this.smsCaptchaError = ''; this.smsCaptchaUsed = false;
      if (/^1\d{10}$/.test(this.mobile) && this.mode === 'sms') return this.loadSmsCaptcha();
    },
    clearMobile() {
      if (this.smsSending || this.submitting) return;
      this.mobile = ''; this.onMobileChanged();
    },
    toggleLanguage() {
      this.locale = setAppLocale(this.locale === 'en' ? 'zh-Hans' : 'en');
      uni.showToast({ title: this.locale === 'en' ? 'Language updated' : '已切换为中文', icon: 'none' });
    },
    createAlternativeMethod(key, title, icon) {
      const capability = this.capabilities[key];
      const available = Boolean(capability && capability.available);
      return {
        key,
        title,
        icon,
        available,
        statusText: available ? '可使用' : '暂未开通'
      };
    },
    startAlternativeLogin(item) {
      if (!item || !item.available) return;
      const handlerName = {
        oneClickLogin: 'startOneClickLogin',
        wechatLogin: 'startWechatLogin',
        appleLogin: 'startAppleLogin'
      }[item.key];
      if (handlerName && typeof this[handlerName] === 'function') this[handlerName]();
    },
    async loadCaptcha() {
      if (this.disposed) return;
      const request = ++this.captchaRequest;
      const scene = this.mode === 'sms' ? 'login-by-sms' : 'login-by-pwd';
      try {
        const res = await uniIdCo.createCaptcha({ scene });
        if (this.disposed || request !== this.captchaRequest) return;
        this.captchaSrc = normalizeCaptchaSource(res && res.captchaBase64);
        this.captchaError = this.captchaSrc ? '' : '验证码暂时没有加载出来。';
        this.captcha = '';
        writeSafeCaptchaLog('login', res);
      } catch (error) {
        if (this.disposed || request !== this.captchaRequest) return;
        this.captchaSrc = '';
        this.captchaError = '验证码加载失败，请稍后再试。';
        writeSafeCaptchaLog('login', null, error);
      }
    },
    async loadSmsCaptcha() {
      if (this.disposed || this.smsSending || this.submitting || this.smsCaptchaLoading || !this.smsReady || !/^1\d{10}$/.test(this.mobile)) return;
      const request = ++this.smsCaptchaRequest;
      const mobile = this.mobile;
      this.smsCaptchaLoading = true;
      this.smsCaptchaError = '';
      try {
        const res = await uniIdCo.createCaptcha({ scene: 'send-sms-code' });
        if (this.disposed || request !== this.smsCaptchaRequest || this.mobile !== mobile) return;
        const source = normalizeCaptchaSource(res?.captchaBase64);
        if (!source) throw new Error('CAPTCHA_IMAGE_MISSING');
        this.smsCaptchaSrc = source;
        this.smsCaptcha = ''; this.smsCaptchaUsed = false;
        this.smsCaptchaError = this.smsCaptchaSrc ? '' : '图形验证码暂时没有加载出来，请重试。';
      } catch (_) {
        if (this.disposed || request !== this.smsCaptchaRequest) return;
        this.smsCaptchaUsed = true;
        this.smsCaptchaError = '图形验证码加载失败，请点“换一张”重试。';
      } finally {
        if (!this.disposed && request === this.smsCaptchaRequest) this.smsCaptchaLoading = false;
      }
    },
    validateAgreement() {
      if (this.agreed) return true;
      uni.showToast({ title: '请先阅读并同意用户协议和隐私政策', icon: 'none' });
      return false;
    },
    async submitLogin() {
      if (this.disposed || this.submitting || !this.validateAgreement()) return;
      this.formError = '';
      if (this.mode === 'sms') {
        if (!this.smsReady) {
          uni.showToast({ title: this.capabilities.smsLogin.reason, icon: 'none' });
          return;
        }
        if (!/^1\d{10}$/.test(this.mobile) || !/^\d{6}$/.test(this.smsCode)) {
          uni.showToast({ title: '请检查手机号和 6 位验证码', icon: 'none' });
          return;
        }
      } else if (!this.account || !this.password) {
        uni.showToast({ title: '请填写账号和密码', icon: 'none' });
        return;
      }
      if (this.needCaptcha && !this.captcha) {
        uni.showToast({ title: '请填写图形验证码', icon: 'none' });
        return;
      }

      this.submitting = true;
      const viewAttempt = ++this.viewAttempt;
      this.authAttempt = beginAuthAttempt();
      try {
        if (this.mode === 'sms') await loginWithSms(this.mobile, this.smsCode, { attempt: this.authAttempt, captcha: this.needCaptcha ? this.captcha : '' });
        else await loginWithPassword(this.account, this.password, { attempt: this.authAttempt, captcha: this.needCaptcha ? this.captcha : '' });
        if (this.disposed || viewAttempt !== this.viewAttempt) return;
        successHaptic();
        uni.showToast({ title: '欢迎回来', icon: 'success' });
        this.navigateAfterLogin();
      } catch (error) {
        if (this.disposed || viewAttempt !== this.viewAttempt || error?.errCode === 'pety-auth-session-changed') return;
        if (error && error.errCode === 'uni-id-captcha-required') {
          this.needCaptcha = true;
          await this.loadCaptcha();
          if (this.disposed || viewAttempt !== this.viewAttempt) return;
          uni.showToast({ title: '这次登录需要图形验证码', icon: 'none' });
        } else {
          if (this.needCaptcha) await this.loadCaptcha();
          if (this.disposed || viewAttempt !== this.viewAttempt) return;
          this.formError = friendlyAuthError(error);
        }
      } finally {
        this.submitting = false;
      }
    },
    async sendCode() {
      if (this.disposed || this.smsSending || this.submitting || this.smsCaptchaLoading || !this.validateAgreement()) return;
      this.syncCountdown();
      if (this.countdown > 0 || this.smsSending) return;
      if (!this.smsReady) {
        uni.showToast({ title: this.capabilities.smsLogin.reason, icon: 'none' });
        return;
      }
      if (!/^1\d{10}$/.test(this.mobile)) {
        uni.showToast({ title: '请输入正确的 11 位手机号', icon: 'none' });
        return;
      }
      if (this.smsCaptchaUsed) {
        this.smsCaptchaError = '再次发送前，请点“换一张”并填写新的图形验证码。';
        return;
      }
      if (!this.smsCaptcha) {
        this.formError = '请先填写发送前的图形验证码。';
        if (!this.smsCaptchaSrc) await this.loadSmsCaptcha();
        return;
      }
      this.formError = '';
      this.smsCaptchaRequest += 1;
      this.smsSending = true;
      this.lastSmsMobile = this.mobile;
      try {
        await requestSmsLoginCode(this.mobile, { captcha: this.smsCaptcha });
      } catch (error) {
        writeSafeCaptchaLog('sms-send', null, error);
        if (!this.disposed) {
          if (String(error?.errCode || '').includes('captcha')) this.smsCaptchaError = '图形验证码不正确或已过期，请点“换一张”后重试。';
          else this.formError = friendlyAuthError(error);
        }
      } finally {
        if (!this.disposed) {
          this.smsSending = false;
          this.smsCaptchaUsed = true;
          if (this.pageVisible) this.startCountdown();
          else this.syncCountdown();
        }
      }
    },
    syncCountdown() {
      try {
        const state = getSmsSendState();
        this.countdown = state.remaining; this.smsStatus = state.status; this.smsSending = state.pending;
      } catch (_) { this.formError = '暂时无法读取发送状态，请稍后再试。'; }
    },
    startCountdown() {
      this.clearCountdown();
      this.syncCountdown();
      this.countdownTimer = setInterval(() => this.syncCountdown(), 1000);
    },
    clearCountdown() {
      if (this.countdownTimer) clearInterval(this.countdownTimer);
      this.countdownTimer = null;
      if (this.countdown < 0) this.countdown = 0;
    },
    normalizeRedirectUrl(value) {
      return normalizeAuthRedirect(value);
    },
    navigateAfterLogin() {
      if (this.redirectUrl) {
        // Explicit API references survive uni-app's H5 API tree shaking.
        navigateAuthDestination(this.redirectUrl, {
          switchTab: options => uni.switchTab(options),
          redirectTo: options => uni.redirectTo(options),
          navigateBack: options => uni.navigateBack(options)
        }, getCurrentPages());
        return;
      }
      const pages = getCurrentPages();
      for (let index = pages.length - 2; index >= 0; index--) {
        const route = '/' + pages[index].route;
        if (normalizeAuthRedirect(route)) {
          uni.navigateBack({ delta: pages.length - 1 - index, fail: () => uni.switchTab({ url: '/pages/profile/profile' }) });
          return;
        }
      }
      uni.switchTab({ url: '/pages/profile/profile' });
    },
    openRetrieve() {
      uni.navigateTo({ url: '/uni_modules/uni-id-pages/pages/retrieve/retrieve' });
    },
    openLegal(type) {
      uni.navigateTo({ url: `/pages/legal/legal?type=${type}` });
    },
    goRegister() {
      if (this.submitting || this.smsSending) return;
      const suffix = this.redirectUrl ? `?uniIdRedirectUrl=${encodeURIComponent(this.redirectUrl)}` : '';
      uni.navigateTo({ url: `/pages/auth/register${suffix}` });
    },
    continueAsGuest() {
      this.cancelLoginAttempt();
      if (this.redirectUrl.includes('resume=create_')) {
        uni.navigateBack({ fail: () => uni.redirectTo({ url: '/pages/welcome/welcome?mode=create' }) });
        return;
      }
      if (this.redirectUrl) {
        uni.switchTab({ url: '/pages/profile/profile' });
        return;
      }
      uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/profile/profile' }) });
    }
  }
};
</script>

<style scoped>
.auth-page { min-height: 100vh; padding: calc(var(--status-bar-height, 0px) + 70rpx) 36rpx calc(52rpx + env(safe-area-inset-bottom)); box-sizing: border-box; background: linear-gradient(160deg, #F7F2EA 0%, #EEF1EA 100%); color: #302D29; }
.brand-head { max-width: 620rpx; margin: 0 auto 30rpx; }
.brand-mark, .auth-title, .auth-subtitle, .field-label, .field-error, .forgot-link { display: block; }
.brand-mark { color: #88745F; font-size: 20rpx; }
.auth-title { margin-top: 12rpx; font-size: 46rpx; font-weight: 650; line-height: 1.2; }
.auth-subtitle { margin-top: 12rpx; color: #756F68; font-size: 24rpx; line-height: 1.55; }
.auth-surface { max-width: 620rpx; margin: 0 auto; padding: 30rpx; border: 1rpx solid rgba(255,255,255,.72); border-radius: 30rpx; background: rgba(255,255,255,.68); box-shadow: 0 18rpx 50rpx rgba(56,48,40,.08); }
.mode-tabs { display: flex; gap: 8rpx; padding: 6rpx; border-radius: 18rpx; background: rgba(92,83,73,.08); }
.mode-tab { flex: 1; min-height: 68rpx; border-radius: 14rpx; color: #777068; font-size: 24rpx; line-height: 68rpx; text-align: center; }
.mode-tab-active { background: rgba(255,255,255,.9); color: #3A342E; box-shadow: 0 5rpx 14rpx rgba(64,54,44,.07); }
.field { margin-top: 24rpx; }
.field-label { margin-bottom: 10rpx; color: #5F584F; font-size: 23rpx; }
.field-head { display: flex; justify-content: space-between; align-items: center; }
.field-link, .forgot-link, .legal-link { color: #766451; font-size: 22rpx; }
.auth-input { width: 100%; height: 84rpx; padding: 0 22rpx; border: 1rpx solid #E5DED4; border-radius: 18rpx; background: rgba(251,250,247,.84); box-sizing: border-box; color: #302D29; font-size: 27rpx; }
.input-placeholder { color: #AEA69D; }
.password-field, .captcha-row, .sms-row, .mobile-field, .agreement-row, .bottom-actions { display: flex; align-items: center; }
.password-field { position: relative; }
.password-input { padding-right: 90rpx; }
.eye-button { position: absolute; right: 4rpx; top: 2rpx; width: 80rpx; height: 80rpx; padding: 0; margin: 0; border-radius: 50%; background: transparent; line-height: 80rpx; }
.eye-button::after, .code-button::after, .primary-button::after { border: none; }
.captcha-row, .sms-row { gap: 14rpx; }
.captcha-image, .captcha-empty { width: 210rpx; height: 84rpx; flex-shrink: 0; border-radius: 18rpx; background: #EFE9DF; }
.captcha-empty { color: #766451; font-size: 22rpx; line-height: 84rpx; text-align: center; }
.captcha-input, .sms-input, .mobile-input { flex: 1; min-width: 0; }
.field-error { margin-top: 8rpx; color: #A45252; font-size: 21rpx; }
.forgot-link { margin-top: 18rpx; text-align: right; }
.country-code { width: 86rpx; color: #5F584F; font-size: 25rpx; text-align: center; }
.mobile-input { border-left: 0; border-radius: 0 18rpx 18rpx 0; }
.mobile-field { border-radius: 18rpx; background: rgba(251,250,247,.84); }
.clear-mobile { flex-shrink: 0; width: 72rpx; height: 84rpx; padding: 0; margin: 0; background: transparent; color: #756C63; line-height: 84rpx; }
.clear-mobile::after { border: none; }
.sms-status { display: block; margin-top: 16rpx; color: #756F68; font-size: 23rpx; line-height: 1.6; }
.mode-tab, .auth-input, .code-button, .primary-button, .eye-button, .clear-mobile { min-height: 44px; }
.eye-button, .clear-mobile { min-width: 44px; }
.code-button { width: 190rpx; height: 84rpx; padding: 0 12rpx; margin: 0; border-radius: 18rpx; background: #E6E1D8; color: #665A4E; font-size: 23rpx; line-height: 84rpx; }
.code-button[disabled] { opacity: .62; }
.capability-note { margin-top: 18rpx; padding: 20rpx; border-radius: 16rpx; background: rgba(103,99,91,.07); color: #777068; font-size: 22rpx; line-height: 1.5; }
.agreement-row { align-items: flex-start; gap: 12rpx; margin-top: 28rpx; }
.agreement-check { width: 34rpx; height: 34rpx; flex-shrink: 0; border: 1rpx solid #AAA197; border-radius: 9rpx; display: flex; align-items: center; justify-content: center; }
.agreement-check-on { border-color: #65584B; background: #65584B; }
.agreement-copy { color: #777068; font-size: 21rpx; line-height: 1.6; }
.primary-button { width: 100%; height: 88rpx; margin: 28rpx 0 0; border-radius: 999rpx; background: #4B433B; color: #FFFFFF; font-size: 28rpx; line-height: 88rpx; }
.primary-button-muted { opacity: .58; }
.primary-button[disabled] { opacity: .55; }
.bottom-actions { justify-content: space-between; margin-top: 24rpx; padding: 0 8rpx; color: #766451; font-size: 23rpx; }
.alternative-logins { margin-top: 30rpx; padding-top: 26rpx; border-top: 1rpx solid rgba(121,111,101,.14); }
.alternative-title { display: block; color: #817970; font-size: 21rpx; text-align: center; }
.alternative-grid { display: flex; justify-content: center; gap: 18rpx; margin-top: 20rpx; }
.alternative-login { width: 154rpx; min-height: 150rpx; padding: 16rpx 10rpx 14rpx; margin: 0; display: flex; flex-direction: column; align-items: center; border: 1rpx solid rgba(120,109,98,.13); border-radius: 20rpx; background: rgba(255,255,255,.36); color: #4D4741; line-height: 1.3; }
.alternative-login::after { border: none; }
.alternative-login[disabled] { opacity: .48; }
.alternative-icon { width: 54rpx; height: 54rpx; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: rgba(101,88,75,.08); }
.alternative-icon-text { color: #665D54; font-size: 24rpx; font-weight: 600; }
.alternative-name { margin-top: 10rpx; font-size: 20rpx; white-space: nowrap; }
.alternative-status { margin-top: 4rpx; color: #8E877F; font-size: 18rpx; }
.language-switch { display: block; width: fit-content; margin: 28rpx auto 0; padding: 12rpx 20rpx; color: #7B7168; font-size: 21rpx; }
.tap-button { transform: scale(.975); opacity: .9; }
.tap-soft { transform: scale(.96); opacity: .78; }
.auth-page [tabindex="0"]:focus-visible { outline: 2px solid #756C63; outline-offset: 3px; }
@media (max-width: 370px) { .auth-page { padding-left: 28rpx; padding-right: 28rpx; } .auth-surface { padding: 26rpx; } }
</style>
