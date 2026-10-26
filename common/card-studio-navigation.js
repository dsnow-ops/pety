export const STUDIO_BUILD = 'ui-session-seal-20260929-v6';
let enabled = false, installed = false, rootTransition = false;
const routeListeners = new Set();
export const isStudioRootTransition = () => rootTransition;
export function subscribeStudioRoutes(listener) { routeListeners.add(listener); return () => routeListeners.delete(listener); }
export function studioTrace(event, details = {}) {
  if (!enabled) return;
  const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
  console.info('[studio-route]', JSON.stringify({build:STUDIO_BUILD,event,depth:pages.length,routes:pages.map(p=>p.route),...details}));
}
export function installStudioTrace(on = false) {
  enabled = on;
  if (installed) return;
  installed = true;
  for (const name of ['navigateTo','redirectTo','reLaunch','switchTab','navigateBack']) uni.addInterceptor(name, {
    invoke(args) { rootTransition=name==='reLaunch';studioTrace(name, {route:String(args.url||'').split('?')[0],parameterKeys:String(args.url||'').split('?')[1]?.split('&').map(x=>x.split('=')[0])||[]}); },
    success() { rootTransition=false;routeListeners.forEach(listener=>listener());studioTrace(name+':success'); }, fail() { rootTransition=false;studioTrace(name+':fail'); }
  });
}
// Synchronous decision shared by navigation buttons and native onBackPress.
export function studioBack({from,closeLayer,flush,pages,navigateBack,home}) {
  if (from === 'navigateBack') return false;
  if (closeLayer()) return true;
  if (!flush()) return true;
  if (pages.length > 1) navigateBack(); else home();
  return true;
}
