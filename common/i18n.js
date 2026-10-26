import zhHans from '../locale/zh-Hans.js';
import en from '../locale/en.js';

export const LOCALE_STORAGE_KEY = 'pety_locale_v1';
export const SUPPORTED_LOCALES = ['zh-Hans', 'en'];
export const DEFAULT_LOCALE = 'zh-Hans';

const messages = { 'zh-Hans': zhHans, en };

export function normalizeLocale(locale) {
  return SUPPORTED_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE;
}

export function getAppLocale() {
  return normalizeLocale(uni.getStorageSync(LOCALE_STORAGE_KEY));
}

function readPath(source, key) {
  return String(key || '').split('.').reduce((value, part) => (
    value && Object.prototype.hasOwnProperty.call(value, part) ? value[part] : undefined
  ), source);
}

export function t(key, params = {}, locale = getAppLocale()) {
  const normalizedLocale = normalizeLocale(locale);
  const fallback = readPath(messages[DEFAULT_LOCALE], key);
  const value = readPath(messages[normalizedLocale], key);
  const template = typeof value === 'string' ? value : (typeof fallback === 'string' ? fallback : String(key || ''));
  return template.replace(/\{(\w+)\}/g, (_, name) => String(params[name] == null ? '' : params[name]));
}

export function applyLocalizedTabBar(locale = getAppLocale(), relationshipStage = 'current') {
  const normalizedLocale = normalizeLocale(locale);
  const chatKey = relationshipStage === 'deceased' ? 'tab.chatDeceased' : 'tab.chatCurrent';
  const items = [t('tab.home', {}, normalizedLocale), t(chatKey, {}, normalizedLocale), t('tab.profile', {}, normalizedLocale)];
  items.forEach((text, index) => {
    try {
      uni.setTabBarItem({ index, text, fail() {} });
    } catch (error) {
      // Some non-tab contexts do not expose setTabBarItem.
    }
  });
}

export function setAppLocale(locale, relationshipStage = 'current') {
  const normalized = normalizeLocale(locale);
  uni.setStorageSync(LOCALE_STORAGE_KEY, normalized);
  if (typeof uni.setLocale === 'function') {
    try { uni.setLocale(normalized); } catch (error) {}
  }
  applyLocalizedTabBar(normalized, relationshipStage);
  return normalized;
}

export function initializeAppLocale() {
  const stored = uni.getStorageSync(LOCALE_STORAGE_KEY);
  return setAppLocale(stored ? normalizeLocale(stored) : DEFAULT_LOCALE);
}

export function getResponseLanguage() {
  return getAppLocale();
}

export function isEnglishLocale() {
  return getAppLocale() === 'en';
}
