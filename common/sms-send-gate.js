import { sendSmsLoginCode } from './auth-session.js';

// A device-local UX cooldown, never an authorization or server rate-limit decision.
// Persist only time/status: no phone number, OTP, captcha, password or token.
const KEY = 'pety_sms_login_cooldown_v1';
const COOLDOWN_MS = 60000;
const error = errCode => Object.assign(new Error(errCode), { errCode });

export function createSmsSendGate({ storage, send, now = Date.now }) {
  let state, pending = false;
  function restore() {
    if (state) return;
    const saved = storage.getStorageSync(KEY), time = now();
    const valid = saved && Number.isFinite(saved.deadline) && saved.deadline > time && saved.deadline <= time + COOLDOWN_MS;
    state = valid ? { deadline: saved.deadline, status: saved.status === 'accepted' ? 'accepted' : 'unknown' } : { deadline: 0, status: 'idle' };
  }
  function snapshot() {
    restore();
    return { ...state, pending, remaining: Math.max(0, Math.min(60, Math.ceil((state.deadline - now()) / 1000))) };
  }
  function save(next, required = false) {
    // Before dispatch a durable lease is required; after dispatch retain the earlier
    // unknown lease if writing the acknowledgement fails (never resend to recover it).
    try { storage.setStorageSync(KEY, next); } catch (e) { if (required) throw error('pety-sms-cooldown-storage'); }
    state = next;
  }
  async function request(mobile, { captcha } = {}) {
    const current = snapshot();
    if (pending || current.remaining > 0) throw error('pety-sms-cooldown');
    if (!/^1\d{10}$/.test(mobile || '') || !String(captcha || '').trim()) throw error('pety-sms-input-required');
    save({ deadline: now() + COOLDOWN_MS, status: 'unknown' }, true);
    pending = true;
    try {
      const result = await send(mobile, { captcha: String(captcha).trim() });
      if (!result || result.errCode !== 0) throw result || error('pety-sms-response-unknown');
      save({ deadline: now() + COOLDOWN_MS, status: 'accepted' });
      return result;
    } catch (e) {
      // Only these documented pre-delivery rejections permit immediate correction.
      const code = String(e?.errCode || '');
      if (/^(uni-captcha-|uni-id-captcha)/.test(code) || ['uni-id-invalid-sms-template-id','pety-auth-smsLogin-not-ready'].includes(code)) {
        save({ deadline: 0, status: 'rejected' });
      } else {
        save({ deadline: now() + COOLDOWN_MS, status: 'unknown' });
      }
      throw e;
    } finally { pending = false; }
  }
  return { snapshot, request };
}

let gate;
function sharedGate() {
  if (!gate) gate = createSmsSendGate({ storage: {
    getStorageSync: key => uni.getStorageSync(key),
    setStorageSync: (key, value) => uni.setStorageSync(key, value)
  }, send: sendSmsLoginCode });
  return gate;
}
export const getSmsSendState = () => sharedGate().snapshot();
export const requestSmsLoginCode = (mobile, options) => sharedGate().request(mobile, options);
