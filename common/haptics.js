const REDUCE_MOTION_KEY = 'pety_reduce_motion_v1';

export function normalizeStoredBoolean(value) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

export function isReduceMotionEnabled() {
  return normalizeStoredBoolean(uni.getStorageSync(REDUCE_MOTION_KEY));
}

function vibrate(type) {
  // #ifdef APP-PLUS
  try {
    if (typeof uni.vibrateShort === 'function') {
      uni.vibrateShort({ type });
    }
  } catch (error) {
    // Haptics are optional and must never block the requested action.
  }
  // #endif
}

export function lightHaptic() {
  vibrate('light');
}

export function mediumHaptic() {
  vibrate('medium');
}

export function successHaptic() {
  vibrate('heavy');
}
