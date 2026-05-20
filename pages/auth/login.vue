<template>
  <view class="auth-page">
    <view class="auth-bg"></view>
    <view class="auth-card">
      <view class="auth-head">
        <text class="auth-kicker">LUMIERE PET</text>
        <text class="auth-title">欢迎回到归爪</text>
        <text class="auth-subtitle">登录后可验证云端账号，当前本地宠物记录会继续保留。</text>
      </view>

      <view class="form-block">
        <view class="field">
          <text class="field-label">用户名</text>
          <input
            class="auth-input"
            v-model.trim="username"
            type="text"
            maxlength="32"
            placeholder="例如 test001"
            placeholder-class="input-placeholder"
          />
        </view>

        <view class="field">
          <text class="field-label">密码</text>
          <input
            class="auth-input"
            v-model.trim="password"
            :password="true"
            maxlength="20"
            placeholder="请输入账号密码"
            placeholder-class="input-placeholder"
          />
        </view>

        <view v-if="needCaptcha" class="field captcha-field">
          <view class="captcha-title-row">
            <text class="field-label">图形验证码</text>
            <button class="text-button" hover-class="text-button-hover" @click="loadCaptcha">换一张</button>
          </view>
          <view class="captcha-row">
            <image
              v-if="captchaSrc"
              class="captcha-image"
              :src="captchaSrc"
              mode="aspectFit"
              @click="loadCaptcha"
            ></image>
            <view v-else class="captcha-empty" @click="loadCaptcha">加载验证码</view>
            <input
              class="auth-input captcha-input"
              v-model.trim="captcha"
              type="text"
              maxlength="6"
              placeholder="输入图片文字"
              placeholder-class="input-placeholder"
            />
          </view>
          <text v-if="captchaError" class="captcha-error">{{ captchaError }}</text>
        </view>
      </view>

      <button class="primary-button" hover-class="primary-button-hover" :disabled="submitting" @click="submitLogin">
        {{ submitting ? '正在登录' : '登录' }}
      </button>

      <view class="action-row">
        <button class="ghost-button" hover-class="ghost-button-hover" @click="goRegister">创建账号</button>
        <button class="ghost-button" hover-class="ghost-button-hover" @click="continueAsGuest">游客继续</button>
      </view>
    </view>
  </view>
</template>

<script>
import { completeUniIdLogin, friendlyAuthError } from '../../common/auth-session.js';
import { normalizeCaptchaSource, writeSafeCaptchaLog } from '../../common/auth-captcha.js';

const uniIdCo = uniCloud.importObject('uni-id-co', { customUI: true });
const LOGIN_CAPTCHA_SCENE = 'login-by-pwd';

export default {
  data() {
    return {
      username: '',
      password: '',
      captcha: '',
      captchaBase64: '',
      captchaSrc: '',
      captchaError: '',
      needCaptcha: false,
      submitting: false
    };
  },
  methods: {
    async loadCaptcha() {
      try {
        const res = await uniIdCo.createCaptcha({ scene: LOGIN_CAPTCHA_SCENE });
        this.captchaBase64 = res && res.captchaBase64 ? res.captchaBase64 : '';
        this.captchaSrc = normalizeCaptchaSource(this.captchaBase64);
        this.captchaError = this.captchaSrc ? '' : '验证码未返回，请检查云函数 uni-id-co 是否正常。';
        this.captcha = '';
        writeSafeCaptchaLog('login', res);
      } catch (error) {
        this.captchaBase64 = '';
        this.captchaSrc = '';
        this.captchaError = '验证码加载失败，请检查云函数 uni-id-co 是否正常。';
        writeSafeCaptchaLog('login', null, error);
        uni.showToast({ title: this.captchaError, icon: 'none' });
      }
    },
    async submitLogin() {
      if (this.submitting) return;

      if (!this.username) {
        uni.showToast({ title: '先输入用户名。', icon: 'none' });
        return;
      }
      if (!this.password) {
        uni.showToast({ title: '还需要输入密码。', icon: 'none' });
        return;
      }
      if (this.needCaptcha && !this.captcha) {
        uni.showToast({ title: '请填写图形验证码。', icon: 'none' });
        return;
      }

      this.submitting = true;
      try {
        const payload = {
          username: this.username,
          password: this.password
        };
        if (this.needCaptcha) payload.captcha = this.captcha;

        const res = await uniIdCo.login(payload);
        await completeUniIdLogin(res);
        uni.showToast({ title: '欢迎回来。', icon: 'none' });
        setTimeout(() => {
          uni.switchTab({ url: '/pages/profile/profile' });
        }, 350);
      } catch (error) {
        if (error && error.errCode === 'uni-id-captcha-required') {
          this.needCaptcha = true;
          await this.loadCaptcha();
          uni.showToast({ title: '这次登录需要验证码。', icon: 'none' });
        } else {
          if (this.needCaptcha) await this.loadCaptcha();
          uni.showToast({ title: friendlyAuthError(error), icon: 'none' });
        }
      } finally {
        this.submitting = false;
      }
    },
    goRegister() {
      uni.navigateTo({ url: '/pages/auth/register' });
    },
    continueAsGuest() {
      uni.navigateBack({
        fail: () => {
          uni.switchTab({ url: '/pages/profile/profile' });
        }
      });
    }
  }
};
</script>

<style scoped>
.auth-page {
  min-height: 100vh;
  padding: 92rpx 36rpx 56rpx;
  box-sizing: border-box;
  background: #f7f4ee;
  position: relative;
  overflow: hidden;
}

.auth-bg {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 360rpx;
  background: linear-gradient(180deg, #efe2d3 0%, rgba(247, 244, 238, 0) 100%);
}

.auth-card {
  position: relative;
  padding: 40rpx 34rpx 34rpx;
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.92);
  border: 1rpx solid #eee3d6;
  box-shadow: 0 18rpx 46rpx rgba(61, 49, 37, 0.08);
}

.auth-head {
  margin-bottom: 34rpx;
}

.auth-kicker,
.auth-title,
.auth-subtitle,
.field-label {
  display: block;
}

.auth-kicker {
  color: #9a785b;
  font-size: 21rpx;
  line-height: 1.2;
}

.auth-title {
  margin-top: 12rpx;
  color: #302a23;
  font-size: 46rpx;
  font-weight: 700;
  line-height: 1.18;
}

.auth-subtitle {
  margin-top: 14rpx;
  color: #766d62;
  font-size: 25rpx;
  line-height: 1.55;
}

.field {
  margin-bottom: 22rpx;
}

.field-label {
  margin-bottom: 10rpx;
  color: #5e5146;
  font-size: 24rpx;
  line-height: 1.2;
}

.auth-input {
  height: 84rpx;
  padding: 0 24rpx;
  border-radius: 18rpx;
  background: #fbfaf7;
  border: 1rpx solid #eadfce;
  color: #302a23;
  font-size: 28rpx;
  box-sizing: border-box;
}

.input-placeholder {
  color: #b5ab9f;
}

.captcha-title-row,
.captcha-row,
.action-row {
  display: flex;
  align-items: center;
}

.captcha-title-row {
  justify-content: space-between;
}

.text-button {
  height: 42rpx;
  padding: 0;
  margin: 0;
  background: transparent;
  color: #8c7557;
  font-size: 23rpx;
  line-height: 42rpx;
}

.text-button::after,
.primary-button::after,
.ghost-button::after {
  border: none;
}

.captcha-row {
  gap: 16rpx;
}

.captcha-image,
.captcha-empty {
  width: 216rpx;
  height: 84rpx;
  border-radius: 18rpx;
  background: #efe7da;
  flex-shrink: 0;
}

.captcha-empty {
  color: #8c7557;
  font-size: 23rpx;
  line-height: 84rpx;
  text-align: center;
}

.captcha-input {
  flex: 1;
  min-width: 0;
}

.captcha-error {
  display: block;
  margin-top: 10rpx;
  color: #b95757;
  font-size: 22rpx;
  line-height: 1.35;
}

.primary-button {
  height: 88rpx;
  margin: 16rpx 0 0;
  border-radius: 999rpx;
  background: #302a23;
  color: #fbfaf6;
  font-size: 29rpx;
  line-height: 88rpx;
}

.primary-button[disabled] {
  opacity: 0.72;
}

.primary-button-hover,
.ghost-button-hover,
.text-button-hover {
  opacity: 0.78;
}

.action-row {
  margin-top: 22rpx;
  justify-content: space-between;
  gap: 18rpx;
}

.ghost-button {
  flex: 1;
  height: 74rpx;
  padding: 0;
  margin: 0;
  border-radius: 999rpx;
  background: #f3eee6;
  color: #6c5b4b;
  font-size: 25rpx;
  line-height: 74rpx;
}
</style>
