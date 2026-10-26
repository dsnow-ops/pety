function normalizeExternalHttpsUrl(value) {
  try {
    const raw = String(value || '').trim();
    if (!/^https:\/\/[^/]/i.test(raw)) return '';
    const url = new URL(raw);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return '';
    const sensitiveKeys = /^(?:access_?token|id_?token|token|api_?key|authorization|auth|secret|signature|sig)$/i;
    if (Array.from(url.searchParams.keys()).some(key => sensitiveKeys.test(key))) return '';
    return url.toString();
  } catch (error) {
    return '';
  }
}

function prepareLinkFallback(url, options = {}) {
  if (typeof uni === 'undefined' || typeof uni.setClipboardData !== 'function') return;
  uni.setClipboardData({
    data: url,
    success() {
      if (typeof uni.showToast === 'function') uni.showToast({ title: options.copiedText || '未能直接打开，链接已复制', icon: 'none' });
    },
    fail() {
      if (typeof uni.showToast === 'function') uni.showToast({ title: options.failedText || '未能直接打开，已为你准备链接', icon: 'none' });
    }
  });
}

export function openExternalUrl(value, options = {}) {
  const url = normalizeExternalHttpsUrl(value);
  if (!url) return false;

  // #ifdef APP-PLUS
  if (typeof plus !== 'undefined' && plus.runtime && typeof plus.runtime.openURL === 'function') {
    try {
      plus.runtime.openURL(url, () => {
        try {
          if (typeof plus.runtime.openWeb === 'function') {
            plus.runtime.openWeb(url);
            return;
          }
        } catch (error) {}
        prepareLinkFallback(url, options);
      });
      return true;
    } catch (error) {
      prepareLinkFallback(url, options);
      return false;
    }
  }
  // #endif

  // #ifdef H5
  if (typeof window !== 'undefined' && typeof window.open === 'function') {
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (opened) return true;
  }
  // #endif

  prepareLinkFallback(url, options);
  return false;
}

export { normalizeExternalHttpsUrl };
