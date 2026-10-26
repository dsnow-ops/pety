function detectImageMime(base64Text) {
  const prefix = base64Text.slice(0, 30);
  if (/^iVBORw0KGgo/i.test(prefix)) return 'image/png';
  if (/^\/9j\//.test(prefix)) return 'image/jpeg';
  if (/^R0lGOD/i.test(prefix)) return 'image/gif';
  return 'image/svg+xml';
}

export function normalizeCaptchaSource(captchaBase64 = '') {
  const raw = String(captchaBase64 || '').trim();
  if (!raw) return '';

  if (/^data:image\//i.test(raw)) return raw;

  if (/^<svg/i.test(raw)) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(raw)}`;
  }

  return `data:${detectImageMime(raw)};base64,${raw}`;
}

export function writeSafeCaptchaLog(source, response, error) {
  const rawCaptcha = response && response.captchaBase64 ? String(response.captchaBase64) : '';
  const safeLog = {
    source,
    errCode: error && error.errCode ? error.errCode : '',
    hasCaptcha: Boolean(rawCaptcha)
  };

  console.info('[auth-captcha]', safeLog);
}
