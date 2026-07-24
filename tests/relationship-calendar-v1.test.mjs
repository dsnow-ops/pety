import assert from 'node:assert/strict';

import {
  formatLocalCalendarSummary,
  getLunarDateInfo,
  getLocalCalendarDate
} from '../common/lunar-calendar.js';
import {
  getCurrentAssistantOwnerCall,
  getMemorialOwnerCall,
  getOwnerRelationLabel,
  getOwnerRelationPatch,
  normalizeOwnerRelation
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
assert.equal(
  formatLocalCalendarSummary(2024, 7, 24),
  '星期三 · 7月24日 · 农历六月十九'
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

const storage = new Map();
globalThis.uni = {
  getStorageSync(key) {
    return storage.get(key);
  },
  setStorageSync(key, value) {
    storage.set(key, value);
  },
  removeStorageSync(key) {
    storage.delete(key);
  }
};

const { getPetList } = await import('../common/pet-store.js');
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

console.log(`relationship-calendar-v1 tests passed (TZ=${process.env.TZ || 'system'})`);
