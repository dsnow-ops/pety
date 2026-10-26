import assert from 'node:assert/strict';

import {
  formatLocalCalendarSummary,
  getCalendarDateState,
  getCalendarMonthGrid,
  getCalendarSecondaryLabel,
  getCalendarWeek,
  getLunarDateInfo,
  getLocalCalendarDate,
  getLocalMonthGridDates,
  getLocalWeekDates,
  LUNAR_SUPPORTED_SOLAR_YEAR_MAX,
  LUNAR_SUPPORTED_SOLAR_YEAR_MIN
} from '../common/lunar-calendar.js';
import {
  getCurrentAssistantOwnerCall,
  getMemorialOwnerCall,
  getOwnerRelationLabel,
  getOwnerRelationPatch,
  getRelationshipOptions,
  normalizeRelationshipStage,
  normalizeOwnerRelation,
  setRelationshipTabBar
} from '../common/relationship-config.js';

const lunarCases = [
  { solar: [2024, 7, 24], expected: '六月十九' },
  { solar: [2024, 2, 29], expected: '正月二十' },
  { solar: [2024, 3, 1], expected: '正月廿一' },
  { solar: [2024, 12, 31], expected: '腊月初一' },
  { solar: [2025, 1, 1], expected: '腊月初二' },
  { solar: [2024, 2, 10], expected: '正月初一' },
  { solar: [2023, 3, 22], expected: '闰二月初一', isLeapMonth: true }
];

lunarCases.forEach(({ solar, expected, isLeapMonth = false }) => {
  const result = getLunarDateInfo(...solar);
  assert.ok(result, `missing lunar result for ${solar.join('-')}`);
  assert.equal(`${result.monthLabel}${result.dayLabel}`, expected);
  assert.equal(result.isLeapMonth, isLeapMonth);
});

const localDate = getLocalCalendarDate(new Date(2024, 6, 24, 12, 0, 0));
assert.equal(localDate.weekdayLabel, '星期三');
assert.equal(localDate.monthDayLabel, '7/24');
assert.equal(localDate.lunar.shortLabel, '十九');
assert.equal(localDate.dayNumber, '24');
assert.equal(localDate.secondaryLabel, '十九');
assert.equal(
  formatLocalCalendarSummary(2024, 7, 24),
  '星期三 · 7月24日 · 农历六月十九'
);

const weekAcrossYear = getLocalWeekDates(new Date(2025, 0, 1, 12, 0, 0));
assert.equal(weekAcrossYear.length, 7);
assert.equal(`${weekAcrossYear[0].getFullYear()}-${weekAcrossYear[0].getMonth() + 1}-${weekAcrossYear[0].getDate()}`, '2024-12-30');
assert.equal(`${weekAcrossYear[6].getFullYear()}-${weekAcrossYear[6].getMonth() + 1}-${weekAcrossYear[6].getDate()}`, '2025-1-5');

const februaryGrid = getLocalMonthGridDates(2026, 2);
assert.equal(februaryGrid.length, 35);
assert.equal(februaryGrid[0].getDay(), 1);
assert.equal(februaryGrid[34].getDay(), 0);

const sixWeekGrid = getLocalMonthGridDates(2026, 8);
assert.equal(sixWeekGrid.length, 42);
assert.equal(`${sixWeekGrid[0].getFullYear()}-${sixWeekGrid[0].getMonth() + 1}-${sixWeekGrid[0].getDate()}`, '2026-7-27');
assert.equal(`${sixWeekGrid[41].getFullYear()}-${sixWeekGrid[41].getMonth() + 1}-${sixWeekGrid[41].getDate()}`, '2026-9-6');
assert.equal(LUNAR_SUPPORTED_SOLAR_YEAR_MIN, 1901);
assert.equal(LUNAR_SUPPORTED_SOLAR_YEAR_MAX, 2100);

assert.equal(getCalendarWeek(new Date(2025, 0, 1, 12)).length, 7);
assert.equal(getCalendarMonthGrid(2026, 2).length, 35);
assert.equal(getCalendarMonthGrid(2026, 8).length, 42);
assert.equal(getCalendarMonthGrid(2026, 8)[0].dayNumber, '27');
assert.equal(getCalendarMonthGrid(2026, 8)[0].isCurrentMonth, false);
assert.equal(getCalendarMonthGrid(2026, 8)[5].isCurrentMonth, true);
assert.equal(getCalendarSecondaryLabel(new Date(2026, 7, 7, 12)), '立秋');
assert.equal(getCalendarSecondaryLabel(new Date(2024, 1, 10, 12)), '春节');
assert.equal(getCalendarSecondaryLabel(new Date(2024, 5, 10, 12)), '端午');
assert.equal(getCalendarSecondaryLabel(new Date(2024, 8, 17, 12)), '中秋');
assert.equal(getCalendarSecondaryLabel(new Date(2026, 0, 1, 12)), '元旦');
assert.equal(getCalendarSecondaryLabel(new Date(2023, 2, 22, 12)), '闰二月');
assert.equal(getCalendarSecondaryLabel({ lunar: { traditionalFestival: '春节', solarFestival: '元旦', solarTerm: '立春', shortLabel: '初一' } }), '春节');
assert.equal(getCalendarSecondaryLabel({ lunar: { traditionalFestival: '', solarFestival: '元旦', solarTerm: '立春', shortLabel: '初一' } }), '元旦');
assert.equal(getCalendarSecondaryLabel({ lunar: { traditionalFestival: '', solarFestival: '', solarTerm: '立春', shortLabel: '初一' } }), '立春');
assert.deepEqual(
  getCalendarDateState(new Date(2026, 7, 7, 12), {
    todayDate: new Date(2026, 7, 7, 8),
    selectedDateKey: '2026-08-07',
    hasRecord: true,
    isImportant: true,
    isCurrentMonth: true
  }),
  {
    dateKey: '2026-08-07',
    isToday: true,
    isSelected: true,
    hasRecord: true,
    isImportant: true,
    isCurrentMonth: true
  }
);

assert.deepEqual(
  normalizeOwnerRelation({ ownerCallType: 'mother', ownerPreferredCall: '妈妈' }),
  { ownerRelationKey: 'mother', ownerRelationCustom: '' }
);
assert.deepEqual(
  normalizeOwnerRelation({ ownerCallType: 'owner', ownerPreferredCall: '主人' }),
  { ownerRelationKey: 'custom', ownerRelationCustom: '主人' }
);
assert.equal(
  getOwnerRelationLabel({ ownerRelationKey: 'friend' }),
  '朋友'
);
assert.equal(
  getCurrentAssistantOwnerCall({ name: '酱酱', ownerRelationKey: 'father' }),
  '酱酱的爸爸'
);
assert.equal(
  getMemorialOwnerCall({ ownerPreferredCall: '姐姐', ownerRelationKey: 'sister' }),
  '姐姐'
);
assert.deepEqual(
  getOwnerRelationPatch('caregiver'),
  {
    ownerRelationKey: 'caregiver',
    ownerRelationCustom: '',
    ownerPreferredCall: '照护人',
    ownerCallType: 'caregiver'
  }
);
assert.equal(normalizeRelationshipStage('future'), 'current');
assert.equal(normalizeRelationshipStage('memorial'), 'current');
assert.deepEqual(getRelationshipOptions().map(option => option.stageKey), ['current', 'deceased']);

const storage = new Map();
const tabItems = [];
globalThis.uni = {
  getStorageSync(key) {
    return storage.get(key);
  },
  setStorageSync(key, value) {
    storage.set(key, value);
  },
  removeStorageSync(key) {
    storage.delete(key);
  },
  setTabBarItem(item) {
    tabItems[item.index] = item.text;
  }
};
storage.set('pety_locale_v1', 'en');
setRelationshipTabBar('deceased');
assert.deepEqual(tabItems, ['Home', 'Letters', 'Me']);

const { getPetList } = await import('../common/pet-store.js');
const {
  getChatSessionKey,
  loadChatSession,
  normalizeChatSessionStage
} = await import('../common/chat-session-store.js');
storage.set('my_pets_list', [
  {
    id: 'legacy_pet',
    name: '花花',
    relationshipStage: 'deceased',
    ownerCallType: 'owner',
    ownerPreferredCall: '主人'
  }
]);
let normalizedPet = getPetList()[0];
assert.equal(normalizedPet.ownerRelationKey, 'custom');
assert.equal(normalizedPet.ownerRelationCustom, '主人');
assert.equal(normalizedPet.ownerPreferredCall, '主人');

storage.set('my_pets_list', [
  {
    id: 'canonical_pet',
    name: '酱酱',
    relationshipStage: 'current',
    ownerRelationKey: 'father',
    ownerPreferredCall: '旧称呼'
  }
]);
normalizedPet = getPetList()[0];
assert.equal(normalizedPet.ownerRelationKey, 'father');
assert.equal(normalizedPet.ownerRelationCustom, '');
assert.equal(normalizedPet.ownerPreferredCall, '爸爸');

storage.set('my_pets_list', [{ id: 'future_pet', name: '旧数据', relationshipStage: 'future' }]);
normalizedPet = getPetList()[0];
assert.equal(normalizedPet.relationshipStage, 'current');
assert.equal(normalizedPet.status, 'current');

assert.equal(normalizeChatSessionStage('future'), 'current');
assert.equal(getChatSessionKey('future_pet', 'future'), 'chat_history_future_pet_current');
storage.set('chat_history_future_pet_future', [{
  id: 'legacy_future_message',
  petId: 'future_pet',
  relationshipStage: 'future',
  type: 'user',
  content: '旧会话',
  createdAt: 1
}]);
const migratedFutureChat = loadChatSession('future_pet', 'current');
assert.equal(migratedFutureChat.length, 1);
assert.equal(migratedFutureChat[0].relationshipStage, 'current');
assert.equal(storage.has('chat_history_future_pet_future'), false);

console.log(`relationship-calendar-v1 tests passed (TZ=${process.env.TZ || 'system'})`);
