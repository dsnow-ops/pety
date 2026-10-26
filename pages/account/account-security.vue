<template>
  <view class="account-page ui-v2" :class="petThemeClass" :style="appThemeStyle">
    <scroll-view scroll-y class="account-scroll">
      <view class="account-shell">
        <view class="page-header">
          <button class="back-button" hover-class="tap-icon" @click="goBack"><uni-icons type="left" size="22" color="#BCC4AE"></uni-icons></button>
          <view class="header-copy"><text class="page-title">账号与安全</text><text class="page-subtitle">账号会话与本机数据彼此独立</text></view>
          <view class="header-space"></view>
        </view>

        <view v-if="loading" class="state-surface"><text class="state-title">正在读取账号状态</text><text class="state-desc">不会读取宠物、聊天或照片内容。</text></view>

        <template v-else-if="!securityInfo.loggedIn">
          <view class="state-surface guest-surface">
            <text class="state-kicker">本地体验</text><text class="state-title">当前为游客</text>
            <text class="state-desc">宠物、日历、聊天与人格资料仍保存在这台设备。登录不会自动覆盖它们。</text>
            <button class="primary-button" hover-class="tap-button" @click="openLogin">登录归爪账号</button>
          </view>
          <view class="group"><text class="group-title">隐私与协议</text><view class="group-surface"><view class="row" @click="openLegal('privacy')"><text>隐私政策</text><uni-icons type="right" size="16" color="#AAA39A"></uni-icons></view><view class="row" @click="openLegal('terms')"><text>用户协议</text><uni-icons type="right" size="16" color="#AAA39A"></uni-icons></view></view></view>
        </template>

        <template v-else>
          <view v-if="accountRefreshFailed" class="state-surface" role="alert">
            <text class="state-title">账号状态暂未确认</text>
            <text class="state-desc">暂时无法读取云端账号信息。绑定与密码状态尚不确定，本机资料仍保留。</text>
            <button class="secondary-button" @click="loadAccount">重新读取</button>
          </view>
          <view class="identity-surface">
            <view class="identity-avatar">{{ avatarLetter }}</view>
            <view class="identity-copy"><text class="identity-name">{{ securityInfo.nickname || '归爪用户' }}</text><text class="identity-id">账号 ID · {{ securityInfo.maskedUserId || '已验证' }}</text></view>
          </view>

          <view v-if="guestImport.count" class="state-surface">
            <text class="state-title">{{ guestImport.status === 'imported' ? '已导入本机副本' : '这台设备还有游客资料' }}</text>
            <text class="state-desc">{{ guestImport.count }} 只宠物的资料。游客原件始终保留；导入仅在这台设备内生效，不代表云端备份或照片归属迁移。</text>
            <template v-if="guestImport.status !== 'imported'">
              <text class="state-desc">可导入宠物、档案、日历、问诊记录与纪念资料。会员、生成额度和未完成任务不会导入或重置。</text>
              <label class="import-consent"><checkbox :checked="importChats" @click="importChats = !importChats" /><text>同时导入游客聊天记录</text></label>
              <button class="primary-button" :disabled="importBusy" @click="confirmGuestImport">导入此账号</button>
              <button class="secondary-button" :disabled="importBusy" @click="keepGuestData">{{ guestImport.status === 'retained' ? '已选择保留在游客空间' : '保留在游客空间' }}</button>
              <text class="state-desc">以后可以在这里重新选择。导入后暂不自动调用原游客的云端生成任务。</text>
            </template>
            <template v-else>
              <text class="state-desc">云端照片和生成额度关联尚待验证；已有本机资料可继续查看。未修改的导入副本可以撤回。</text>
              <button class="secondary-button" :disabled="importBusy" @click="confirmUndoImport">撤回本次导入</button>
            </template>
          </view>
          <text v-if="importError" class="local-data-note" role="alert">{{ importError }}</text>

          <view class="group">
            <text class="group-title">账号摘要</text><AppSettingsRow title="单设备会话" :description="securityInfo.singleSessionStatus || '待验证云端状态'"/>
            <view class="group-surface">
              <view class="row"><text>当前登录方式</text><text class="row-value">{{ securityInfo.loginMethod }}</text></view>
              <view class="row"><text>绑定手机</text><text class="row-value">{{ mobileStatus }}</text></view>
              <view class="row"><text>绑定邮箱</text><text class="row-value">{{ emailStatus }}</text></view>
            </view>
          </view>

          <view class="group">
            <text class="group-title">登录方式</text>
            <view class="group-surface">
              <view class="row" :aria-disabled="accountRefreshFailed" @click="openPasswordSettings"><text>安全密码</text><text class="row-value row-link">{{ passwordStatus }}</text></view>
              <view class="row"><text>微信</text><text class="row-value">{{ accountRefreshFailed ? '暂未确认' : (securityInfo.wechatBound ? '已绑定' : capabilities.wechatLogin.reason) }}</text></view>
              <view v-if="capabilities.appleLogin.status !== 'UNSUPPORTED_PLATFORM'" class="row"><text>Apple</text><text class="row-value">{{ accountRefreshFailed ? '暂未确认' : (securityInfo.appleBound ? '已绑定' : capabilities.appleLogin.reason) }}</text></view>
              <view class="row"><text>本机号码一键登录</text><text class="row-value">{{ capabilities.oneClickLogin.reason }}</text></view>
            </view>
          </view>

          <view class="group">
            <text class="group-title">隐私与协议</text>
            <view class="group-surface"><view class="row" @click="openLegal('privacy')"><text>隐私政策</text><uni-icons type="right" size="16" color="#AAA39A"></uni-icons></view><view class="row" @click="openLegal('terms')"><text>用户协议</text><uni-icons type="right" size="16" color="#AAA39A"></uni-icons></view></view>
          </view>

          <view class="group account-actions">
            <text class="group-title">账号操作</text>
            <view class="group-surface">
              <view class="row" hover-class="tap-soft" @click="confirmLogout"><text>退出登录</text><uni-icons type="right" size="16" color="#AAA39A"></uni-icons></view>
              <view class="row"><text class="danger-text">注销账号</text><text class="row-value">{{ capabilities.accountCancellation.reason }}</text></view>
            </view>
            <text class="local-data-note">退出只结束账号会话，不会删除本机宠物、聊天、日历、档案、人格资料或照片。</text>
          </view>
        </template>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import { getAuthCapabilities } from '../../common/auth-capabilities.js';
import { friendlyAuthError, getAccountSecurityInfo, logoutUniIdAccount } from '../../common/auth-session.js';
import { getCurrentUser, refreshUserProfile, subscribeAccountScope, reportAuthFailure } from '../../common/auth-store.js';
import { captureDataScope, isDataScopeCurrent } from '../../common/scoped-storage.js';
import { getGuestImportState, retainGuestData, prepareGuestImport, commitGuestImport, undoGuestImport } from '../../common/guest-data-import.js';
import { successHaptic } from '../../common/haptics.js';

export default {
  data() {
    return {
      loading: true,
      signingOut: false,
      accountRefreshFailed: false,
      disposed: false, accountVisible: true, accountRequest: 0, unsubscribeScope: null,
      loadedScope: null, guestImport: { status: 'none', count: 0 }, importChats: false, importBusy: false, importError: '',
      capabilities: getAuthCapabilities(),
      securityInfo: { loggedIn: getCurrentUser().loggedIn }
    };
  },
  computed: {
    mobileStatus() { return this.accountRefreshFailed ? '暂未确认' : (this.securityInfo.maskedMobile || '未绑定'); },
    emailStatus() { return this.accountRefreshFailed ? '暂未确认' : (this.securityInfo.maskedEmail || '未绑定'); },
    passwordStatus() { return this.accountRefreshFailed ? '暂未确认' : (this.securityInfo.isPasswordSet ? '已设置' : '未设置'); },
    avatarLetter() {
      return String(this.securityInfo.nickname || '归').slice(0, 1);
    }
  },
  onShow() {
    this.accountVisible = true;
    if (!this.unsubscribeScope) this.unsubscribeScope = subscribeAccountScope(() => {
      this.accountRequest += 1;
      this.securityInfo = { loggedIn: false };
      this.guestImport = { status: 'none', count: 0 };
      this.importChats = false;this.importBusy = false;this.importError = '';this.signingOut = false;
      if (!this.disposed) this.loadAccount();
    });
    this.loadAccount();
  },
  onHide() { this.accountVisible = false; },
  onUnload() { this.disposed = true;this.accountRequest += 1;this.unsubscribeScope?.(); },
  methods: {
    async loadAccount() {
      const scope = captureDataScope();
      const request = ++this.accountRequest;
      this.loadedScope = scope;
      this.loading = true;
      const cached = getCurrentUser();
      const current = () => !this.disposed && request === this.accountRequest && isDataScopeCurrent(scope);
      try {
        if (current()) this.refreshImportState(scope);
        if (cached.loggedIn) await refreshUserProfile();
        if (!current()) return;
        const info = await getAccountSecurityInfo();
        if (!current()) return;
        this.securityInfo = info;
        this.accountRefreshFailed = false;
      } catch (error) {
        if (!current()) return;
        this.accountRefreshFailed = true;
        reportAuthFailure('account-security', error);
        this.securityInfo = { loggedIn: cached.loggedIn, nickname: cached.nickname, maskedUserId: this.maskUserId(cached.userId), loginMethod: '暂未确认' };
        uni.showToast({ title: '部分账号状态暂时无法刷新', icon: 'none' });
      } finally {
        if (current()) this.loading = false;
      }
    },
    refreshImportState(scope = this.loadedScope) {
      try { this.guestImport = getGuestImportState(scope); } catch (error) { this.importError = this.importErrorText(error); }
    },
    importErrorText(error) {
      return ({
        IMPORT_CONFLICT: '账号内已有同一标识的宠物或资料，未覆盖任何内容。',
        IMPORT_HAS_EDITS: '导入后已有资料更新，无法自动撤回。更新和游客原件都已保留。',
        IMPORT_LEGACY_PENDING: '请先回到游客空间打开一次宠物档案，再选择导入。',
        IMPORT_TOO_LARGE: '本机资料较多，本次未导入，原件完整保留。',
        IMPORT_SOURCE_CHANGED: '游客资料刚有变化，请重新确认。',
        IMPORT_TARGET_CHANGED: '账号资料刚有变化，请重新确认。',
        DATA_RECOVERY_REQUIRED: '本机存储暂时无法完成恢复，资料原件保留，请腾出空间后重试。',
        DATA_SCOPE_CHANGED: '账号已变化，请在当前账号重新操作。'
      })[error?.code] || '本次没有完成，游客原件保留，请稍后重试。';
    },
    canAct(scope) { return !this.disposed && this.accountVisible && isDataScopeCurrent(scope); },
    keepGuestData() {
      const scope = this.loadedScope;if (!this.canAct(scope) || this.importBusy) return;
      try { this.guestImport = retainGuestData(scope);this.importError = ''; } catch (error) { this.importError = this.importErrorText(error); }
    },
    confirmGuestImport() {
      const scope = this.loadedScope;if (!this.canAct(scope) || this.importBusy) return;
      let plan;
      try { plan = prepareGuestImport({ includeChats: this.importChats }, scope); } catch (error) { this.importError = this.importErrorText(error);return; }
      uni.showModal({ title: '导入此账号的本机空间', content: `导入 ${plan.count} 只宠物${plan.includeChats ? '，包含聊天记录' : '，不包含聊天记录'}。游客原件保留，不上传、不转移会员或生成额度。`, confirmText: '确认导入', cancelText: '取消', success: result => {
        if (!result.confirm || !this.canAct(scope) || this.importBusy) return;
        this.importBusy = true;this.importError = '';
        try { this.guestImport = commitGuestImport(plan); } catch (error) { if (this.canAct(scope)) this.importError = this.importErrorText(error); }
        finally { this.importBusy = false; }
      } });
    },
    confirmUndoImport() {
      const scope = this.loadedScope;if (!this.canAct(scope) || this.importBusy) return;
      uni.showModal({ title: '撤回本机导入', content: '仅移除未修改的导入副本，游客原件不变。已更新的资料不会被覆盖或删除。', confirmText: '撤回导入', success: result => {
        if (!result.confirm || !this.canAct(scope) || this.importBusy) return;
        this.importBusy = true;this.importError = '';
        try { this.guestImport = undoGuestImport(scope); } catch (error) { if (this.canAct(scope)) this.importError = this.importErrorText(error); }
        finally { this.importBusy = false; }
      } });
    },
    maskUserId(value) {
      const text = String(value || '');
      return text.length > 8 ? `${text.slice(0, 4)}...${text.slice(-4)}` : text;
    },
    openLogin() {
      uni.navigateTo({ url: '/pages/auth/login' });
    },
    openPasswordSettings() {
      if (!this.canAct(this.loadedScope) || !this.securityInfo.loggedIn || this.loading || this.accountRefreshFailed) return;
      const url = this.securityInfo.isPasswordSet
        ? '/uni_modules/uni-id-pages/pages/userinfo/change_pwd/change_pwd'
        : '/uni_modules/uni-id-pages/pages/userinfo/set-pwd/set-pwd';
      uni.navigateTo({ url });
    },
    openLegal(type) {
      uni.navigateTo({ url: `/pages/legal/legal?type=${type}` });
    },
    confirmLogout() {
      if (this.signingOut) return;
      const scope = captureDataScope();
      uni.showModal({
        title: '退出登录',
        content: '退出登录后，本机宠物和记录仍会保留。是否退出当前账号？',
        cancelText: '取消',
        confirmText: '退出',
        confirmColor: '#A65353',
        success: async result => {
          if (!result.confirm || !this.canAct(scope)) return;
          this.signingOut = true;
          try {
            await logoutUniIdAccount();
            if (this.disposed || !this.accountVisible || getCurrentUser().loggedIn) return;
            successHaptic();
            this.securityInfo = { loggedIn: false };
            uni.showToast({ title: '已退出，本机记录仍在', icon: 'none' });
          } catch (error) {
            if (this.canAct(scope)) uni.showToast({ title: friendlyAuthError(error), icon: 'none' });
          } finally {
            this.signingOut = false;
          }
        }
      });
    },
    goBack() {
      uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/profile/profile' }) });
    }
  }
};
</script>

<style scoped>
.account-page { min-height: 100vh; background: var(--pety-page-bg, #F4F2ED); color: var(--pety-text, #302D29); }
.account-scroll { height: 100vh; }
.account-shell { min-height: 100vh; padding: calc(var(--status-bar-height, 0px) + 30rpx) 30rpx calc(48rpx + env(safe-area-inset-bottom)); box-sizing: border-box; }
.page-header { display: flex; align-items: center; gap: 16rpx; }
.back-button { width: 88rpx; height: 88rpx; padding: 0; margin: 0; border-radius: 50%; background: transparent; }
.back-button::after, .primary-button::after { border: none; }
.header-copy { flex: 1; min-width: 0; }
.header-space { width: 88rpx; }
.page-title, .page-subtitle, .state-kicker, .state-title, .state-desc, .group-title, .identity-name, .identity-id, .local-data-note { display: block; }
.page-title { font-size: 38rpx; font-weight: 650; }
.page-subtitle { margin-top: 4rpx; color: var(--pety-text-secondary, #77716A); font-size: 21rpx; }
.state-surface, .identity-surface, .group-surface { border: 1rpx solid var(--pety-rule, #E0DDD7); border-radius: 26rpx; background: var(--pety-surface, rgba(255,255,255,.72)); }
.state-surface { margin-top: 32rpx; padding: 34rpx; }
.state-kicker { color: var(--pety-primary, #756451); font-size: 21rpx; }
.state-title { margin-top: 8rpx; font-size: 34rpx; font-weight: 650; }
.state-desc { margin-top: 12rpx; color: var(--pety-text-secondary, #77716A); font-size: 23rpx; line-height: 1.6; }
.primary-button { width: 100%; height: 86rpx; margin: 26rpx 0 0; border-radius: 999rpx; background: var(--pety-primary, #5E5145); color: #FFF; font-size: 27rpx; line-height: 86rpx; }
.identity-surface { display: flex; align-items: center; gap: 20rpx; margin-top: 30rpx; padding: 28rpx; }
.identity-avatar { width: 82rpx; height: 82rpx; border-radius: 50%; background: var(--pety-primary-soft, #E8E0D5); color: var(--pety-primary, #5E5145); font-size: 32rpx; line-height: 82rpx; text-align: center; }
.identity-copy { flex: 1; min-width: 0; }
.identity-name { overflow: hidden; font-size: 29rpx; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.identity-id { margin-top: 6rpx; color: var(--pety-text-secondary, #77716A); font-size: 21rpx; }
.group { margin-top: 30rpx; }
.group-title { margin: 0 8rpx 12rpx; color: var(--pety-text-secondary, #77716A); font-size: 21rpx; }
.group-surface { overflow: hidden; }
.row { min-height: 92rpx; padding: 0 26rpx; display: flex; align-items: center; justify-content: space-between; gap: 20rpx; border-bottom: 1rpx solid var(--pety-rule, #E0DDD7); box-sizing: border-box; font-size: 25rpx; }
.row:last-child { border-bottom: 0; }
.row-value { max-width: 62%; color: var(--pety-text-secondary, #77716A); font-size: 21rpx; line-height: 1.4; text-align: right; }
.row-link { color: var(--pety-primary, #756451); }
.danger-text { color: var(--ui-muted); }
.local-data-note { margin: 14rpx 8rpx 0; color: var(--pety-text-secondary, #77716A); font-size: 20rpx; line-height: 1.55; }
.tap-button { transform: scale(.975); opacity: .9; }
.tap-icon { transform: scale(.94); opacity: .72; }
.tap-soft { background: rgba(90,80,70,.05); }
.import-consent { display: flex; align-items: center; gap: 12rpx; min-height: 48px; margin-top: 18rpx; font-size: 25rpx; }
.secondary-button { margin: 16rpx 0 0; padding: 12px 16px; min-height: 44px; line-height: 1.5; font-size: 25rpx; color: var(--pety-primary, #5E5145); background: transparent; border-radius: 24rpx; }
.primary-button { min-height: 44px; height: auto; padding: 12px 16px; line-height: 1.5; }
</style>
