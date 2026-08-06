const REDUCE_MOTION_KEY = 'pety_reduce_motion_v1';

export function isReduceMotionEnabled() {
  return Boolean(uni.getStorageSync(REDUCE_MOTION_KEY));
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
