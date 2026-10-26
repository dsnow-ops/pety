export const AUTH_CAPABILITY_STATUS = Object.freeze({
  READY: 'READY',
  PARTIAL: 'PARTIAL',
  NOT_CONFIGURED: 'NOT_CONFIGURED',
  UNSUPPORTED_PLATFORM: 'UNSUPPORTED_PLATFORM'
});

function getRuntimePlatform() {
  try {
    const info = uni.getSystemInfoSync();
    const osPlatform = String(info.platform || '').toLowerCase();
    if (osPlatform === 'android' || osPlatform === 'ios') return osPlatform;
    return String(info.uniPlatform || osPlatform).toLowerCase();
  } catch (error) {
    return '';
  }
}

function capability(status, reason, options = {}) {
  return Object.freeze({
    status,
    available: status === AUTH_CAPABILITY_STATUS.READY,
    callable: status === AUTH_CAPABILITY_STATUS.READY || options.callable === true,
    reason
  });
}

export function getAuthCapabilities(platformOverride = '') {
  const platform = String(platformOverride || getRuntimePlatform()).toLowerCase();
  const isIos = platform === 'ios' || platform.includes('ios');
  const isAndroid = platform === 'android' || platform.includes('android');

  return Object.freeze({
    platform: platform || 'unknown',
    passwordLogin: capability(
      AUTH_CAPABILITY_STATUS.PARTIAL,
      '密码登录已接入官方接口，完整登录验证尚未完成',
      { callable: true }
    ),
    smsLogin: capability(AUTH_CAPABILITY_STATUS.PARTIAL, '官方短信登录已部署，实际送达与登录待验证', { callable: true }),
    oneClickLogin: capability(AUTH_CAPABILITY_STATUS.NOT_CONFIGURED, 'manifest 未配置一键登录模块'),
    wechatLogin: capability(AUTH_CAPABILITY_STATUS.NOT_CONFIGURED, '当前项目未配置可用的微信登录 provider'),
    appleLogin: isAndroid
      ? capability(AUTH_CAPABILITY_STATUS.UNSUPPORTED_PLATFORM, 'Android 不支持 Apple 登录')
      : capability(AUTH_CAPABILITY_STATUS.NOT_CONFIGURED, isIos ? '当前 iOS 构建未配置 Apple 登录' : '当前平台未配置 Apple 登录'),
    logout: capability(
      AUTH_CAPABILITY_STATUS.PARTIAL,
      '退出登录已接入官方接口，真实会话退出验证尚未完成',
      { callable: true }
    ),
    accountCancellation: capability(AUTH_CAPABILITY_STATUS.PARTIAL, '客户端模块存在，但服务端注销能力尚未验证'),
    profileFetch: capability(
      AUTH_CAPABILITY_STATUS.PARTIAL,
      '账号资料接口已接入，真实登录后的资料读取尚未完成验证',
      { callable: true }
    )
  });
}

export function isAuthCapabilityReady(name, platformOverride = '') {
  const item = getAuthCapabilities(platformOverride)[name];
  return Boolean(item && item.status === AUTH_CAPABILITY_STATUS.READY);
}

export function isAuthCapabilityCallable(name, platformOverride = '') {
  const item = getAuthCapabilities(platformOverride)[name];
  return Boolean(item && item.callable === true);
}

export function getAuthCapabilityReason(name, platformOverride = '') {
  const item = getAuthCapabilities(platformOverride)[name];
  return item ? item.reason : '未知账号能力';
}
