// Closed set of product destinations; official auth/webview/admin pages must not
// become post-login targets. Query keys mirror these pages' actual onLoad inputs.
const routes = {
  '/pages/home/home': {}, '/pages/profile/profile': {}, '/pages/chat/chat': {},
  '/pages/settings/settings': {}, '/pages/account/account-security': {},
  '/pages/feedback/feedback': {}, '/pages/care/care': {},
  '/pages/archive/archive': { petId: /^[a-zA-Z0-9_-]{1,160}$/ },
  '/pages/avatar-generate/avatar-generate': { petId: /^[a-zA-Z0-9_-]{1,160}$/ },
  '/pages/calendar/calendar': { date: /^\d{4}-\d{2}-\d{2}$/, selectedDate: /^\d{4}-\d{2}-\d{2}$/ },
  '/pages/insights/insights': { type: /^(memory|events|chat)$/ },
  '/pages/welcome/welcome': { mode: /^(create|edit)$/, resume: /^create_[0-9]+_[a-z0-9]{1,10}$/ },
  '/pages/memorial-persona/memorial-persona': { petId: /^[a-zA-Z0-9_-]{1,160}$/, view: /^(edit|overview)$/, step: /^[0-5]$/ },
  '/pages/legal/legal': { type: /^(privacy|terms|ai-data)$/ }
};
export function normalizeAuthRedirect(value) {
  if (typeof value !== 'string' || value.length > 1000) return '';
  try {
    const decoded = value.startsWith('/') ? value : decodeURIComponent(value);
    if (/[\\#\s]/.test(decoded)) return '';
    const [route, query, extra] = decoded.split('?');
    if (!Object.prototype.hasOwnProperty.call(routes, route) || extra !== undefined) return '';
    const rules = routes[route], seen = new Set(), params = [];
    if (query) for (const item of query.split('&')) {
      const [key, encoded, overflow] = item.split('=');
      if (!Object.prototype.hasOwnProperty.call(rules,key) || seen.has(key) || encoded === undefined || overflow !== undefined) return '';
      const text = decodeURIComponent(encoded);
      if (!rules[key].test(text)) return '';
      seen.add(key);params.push(`${key}=${encodeURIComponent(text)}`);
    }
    return route + (params.length ? '?' + params.join('&') : '');
  } catch (_) { return ''; }
}

export function navigateAuthDestination(value, platform, pages = []) {
  const target = normalizeAuthRedirect(value) || '/pages/profile/profile';
  const route = target.split('?')[0];
  if (['/pages/home/home','/pages/profile/profile','/pages/chat/chat'].includes(route)) {
    platform.switchTab({ url: route }); return;
  }
  // A plain destination already below login should be restored, not duplicated.
  if (!target.includes('?')) {
    let index = -1;
    for (let n = pages.length - 1; n >= 0; n--) {
      if ('/' + pages[n].route === route && !Object.keys(pages[n].options || {}).length) { index = n; break; }
    }
    if (index >= 0 && index < pages.length - 1) {
      platform.navigateBack({ delta: pages.length - 1 - index, fail: () => platform.redirectTo({ url: target }) });return;
    }
  }
  platform.redirectTo({ url: target, fail: () => platform.switchTab({ url: '/pages/profile/profile' }) });
}
