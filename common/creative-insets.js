// Read the actual window, including native status bar. No device-specific offset.
export function creativeInsets(api = uni) {
  let info = {};
  try { info = typeof api.getWindowInfo === 'function' ? api.getWindowInfo() : api.getSystemInfoSync(); } catch (_) {}
  const top = Math.max(0, Number(info.statusBarHeight) || 0, Number(info.safeAreaInsets?.top) || 0);
  const bottom = Math.max(0, Number(info.safeAreaInsets?.bottom) || 0);
  return { '--creative-top': `${top}px`, '--creative-bottom': `${bottom}px` };
}
