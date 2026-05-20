<template>
  <view class="auth-page">
    <view class="auth-bg"></view>
    <view class="auth-card">
      <view class="auth-head">
        <text class="auth-kicker">LUMIERE PET</text>
        <text class="auth-title">创建你的归爪账号</text>
        <text class="auth-subtitle">先把账号打通，宠物和日历数据这一步仍保留在本地。</text>
      </view>

      <view class="form-block">
        <view class="field">
          <text class="field-label">用户名</text>
          <input
            class="auth-input"
            v-model.trim="form.username"
            type="text"
            maxlength="32"
            placeholder="3-32 位字母、数字或下划线"
            placeholder-class="input-placeholder"
          />
        </view>

        <view class="field">
          <text class="field-label">昵称</text>
          <input
            class="auth-input"
            v-model.trim="form.nickname"
            type="text"
            maxlength="20"
            placeholder="以后可以再改"
            placeholder-class="input-placeholder"
          />
        </view>

        <view class="field">
          <text class="field-label">密码</text>
          <input
            class="auth-input"
            v-model.trim="form.password"
            :password="true"
            maxlength="20"
            placeholder="建议使用 Test123456 这类组合"
            placeholder-class="input-placeholder"
          />
        </view>

        <view class="field">
          <text class="field-label">确认密码</text>
          <input
            class="auth-input"
            v-model.trim="form.password2"
            :password="true"
            maxlength="20"
            placeholder="再输入一次密码"
            placeholder-class="input-placeholder"
          />
        </view>

        <view class="field captcha-field">
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
              v-model.trim="form.captcha"
              type="text"
              maxlength="6"
              placeholder="输入图片文字"
              placeholder-class="input-placeholder"
            />
          </view>
          <text v-if="captchaError" class="captcha-error">{{ captchaError }}</text>
        </view>
      </view>

      <button class="primary-button" hover-class="primary-button-hover" :disabled="submitting" @click="submitRegister">
        {{ submitting ? '正在创建' : '注册并登录' }}
      </button>

      <view class="action-row">
        <button class="ghost-button" hover-class="ghost-button-hover" @click="goLogin">返回登录</button>
        <button class="ghost-button" hover-class="ghost-button-hover" @click="continueAsGuest">游客继续</button>
      </view>
    </view>
  </view>
</template>

<script>
import { completeUniIdLogin, friendlyAuthError } from '../../common/auth-session.js';
import { normalizeCaptchaSource, writeSafeCaptchaLog } from '../../common/auth-captcha.js';

const uniIdCo = uniCloud.importObject('uni-id-co', { customUI: true });
const REGISTER_CAPTCHA_SCENE = 'register';

export default {
  data() {
    return {
      form: {
        username: '',
        nickname: '',
        password: '',
        password2: '',
        captcha: ''
      },
      captchaBase64: '',
      captchaSrc: '',
      captchaError: '',
      submitting: false
    };
  },
  onLoad() {
    this.loadCaptcha();
  },
  methods: {
    async loadCaptcha() {
      try {
        const res = await uniIdCo.createCaptcha({ scene: REGISTER_CAPTCHA_SCENE });
        this.captchaBase64 = res && res.captchaBase64 ? res.captchaBase64 : '';
        this.captchaSrc = normalizeCaptchaSource(this.captchaBase64);
        this.captchaError = this.captchaSrc ? '' : '验证码未返回，请检查云函数 uni-id-co 是否正常。';
        this.form.captcha = '';
        writeSafeCaptchaLog('register', res);
      } catch (error) {
        this.captchaBase64 = '';
        this.captchaSrc = '';
        this.captchaError = '验证码加载失败，请检查云函数 uni-id-co 是否正常。';
        writeSafeCaptchaLog('register', null, error);
        uni.showToast({ title: this.captchaError, icon: 'none' });
      }
    },
    validateForm() {
      if (!/^[A-Za-z0-9_]{3,32}$/.test(this.form.username)) {
        return '用户名需要 3-32 位字母、数字或下划线。';
      }
      if (!this.form.nickname) {
        return '给自己取一个昵称吧。';
      }
      if (this.form.password.length < 8 || this.form.password.length > 16) {
        return '密码需要 8-16 位。';
      }
      if (!/[A-Za-z]/.test(this.form.password) || !/[0-9]/.test(this.form.password)) {
        return '密码需要同时包含字母和数字。';
      }
      if (this.form.password !== this.form.password2) {
        return '两次输入的密码不一致。';
      }
      if (!this.form.captcha) {
        return '请填写图形验证码。';
      }
      return '';
    },
    async submitRegister() {
      if (this.submitting) return;

      const errorText = this.validateForm();
      if (errorText) {
        uni.showToast({ title: errorText, icon: 'none' });
        return;
      }

      this.submitting = true;
      try {
        const res = await uniIdCo.registerUser({
          username: this.form.username,
          password: this.form.password,
          captcha: this.form.captcha,
          nickname: this.form.nickname
        });

        if (res && (res.newToken || res.token)) {
          await completeUniIdLogin(res);
          uni.showToast({ title: '账号创建好了。', icon: 'none' });
          setTimeout(() => {
            uni.switchTab({ url: '/pages/profile/profile' });
          }, 350);
        } else {
          uni.showToast({ title: '账号创建好了，请登录。', icon: 'none' });
          uni.redirectTo({ url: '/pages/auth/login' });
        }
      } catch (error) {
        await this.loadCaptcha();
        uni.showToast({ title: friendlyAuthError(error), icon: 'none' });
      } finally {
        this.submitting = false;
      }
    },
    goLogin() {
      uni.redirectTo({ url: '/pages/auth/login' });
    },
    continueAsGuest() {
      uni.switchTab({ url: '/pages/profile/profile' });
    }
  }
};
</script>

<style scoped>
.auth-page {
  min-height: 100vh;
  padding: 68rpx 36rpx 56rpx;
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
  padding: 38rpx 34rpx 34rpx;
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.92);
  border: 1rpx solid #eee3d6;
  box-shadow: 0 18rpx 46rpx rgba(61, 49, 37, 0.08);
}

.auth-head {
  margin-bottom: 30rpx;
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
  font-size: 42rpx;
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
  margin-bottom: 20rpx;
}

.field-label {
  margin-bottom: 10rpx;
  color: #5e5146;
  font-size: 24rpx;
  line-height: 1.2;
}

.auth-input {
  height: 80rpx;
  padding: 0 24rpx;
  border-radius: 18rpx;
  background: #fbfaf7;
  border: 1rpx solid #eadfce;
  color: #302a23;
  font-size: 27rpx;
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
  height: 80rpx;
  border-radius: 18rpx;
  background: #efe7da;
  flex-shrink: 0;
}

.captcha-empty {
  color: #8c7557;
  font-size: 23rpx;
  line-height: 80rpx;
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
  height: 86rpx;
  margin: 14rpx 0 0;
  border-radius: 999rpx;
  background: #302a23;
  color: #fbfaf6;
  font-size: 29rpx;
  line-height: 86rpx;
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
  height: 72rpx;
  padding: 0;
  margin: 0;
  border-radius: 999rpx;
  background: #f3eee6;
  color: #6c5b4b;
  font-size: 25rpx;
  line-height: 72rpx;
}
</style>
