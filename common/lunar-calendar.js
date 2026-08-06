import solarLunar from './vendor/solarlunar.esm.js';

// Calendar conversion is provided by solarlunar-es 1.0.9 (MIT), vendored for offline use.
const WEEKDAY_LABELS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const WEEKDAY_SHORT_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

// solar2lunar starts at 1900-01-31. The picker uses the first and last complete solar years.
export const LUNAR_SUPPORTED_SOLAR_YEAR_MIN = 1901;
export const LUNAR_SUPPORTED_SOLAR_YEAR_MAX = 2100;

function normalizeLocalDateParts(year, month, day) {
  const normalizedYear = Number(year);
  const normalizedMonth = Number(month);
  const normalizedDay = Number(day);
  const date = new Date(normalizedYear, normalizedMonth - 1, normalizedDay, 12, 0, 0, 0);

  if (
    !Number.isInteger(normalizedYear) ||
    !Number.isInteger(normalizedMonth) ||
    !Number.isInteger(normalizedDay) ||
    date.getFullYear() !== normalizedYear ||
    date.getMonth() + 1 !== normalizedMonth ||
    date.getDate() !== normalizedDay
  ) {
    return null;
  }

  return {
    year: normalizedYear,
    month: normalizedMonth,
    day: normalizedDay,
    date
  };
}

export function getLunarDateInfo(year, month, day) {
  const local = normalizeLocalDateParts(year, month, day);
  if (!local) return null;

  const lunar = solarLunar.solar2lunar(local.year, local.month, local.day);
  if (!lunar || lunar === -1) return null;

  return {
    lunarYear: lunar.lYear,
    lunarMonth: lunar.lMonth,
    lunarDay: lunar.lDay,
    isLeapMonth: Boolean(lunar.isLeap),
    monthLabel: lunar.monthCn,
    dayLabel: lunar.dayCn,
    shortLabel: lunar.lDay === 1 ? lunar.monthCn : lunar.dayCn,
    fullLabel: `农历${lunar.monthCn}${lunar.dayCn}`
  };
}

export function getLocalCalendarDate(date = new Date()) {
  const local = normalizeLocalDateParts(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate()
  );
  if (!local) return null;

  const lunar = getLunarDateInfo(local.year, local.month, local.day);
  const weekdayIndex = local.date.getDay();
  return {
    ...local,
    weekdayLabel: WEEKDAY_LABELS[weekdayIndex],
    weekdayShortLabel: WEEKDAY_SHORT_LABELS[weekdayIndex],
    monthDayLabel: `${local.month}/${local.day}`,
    fullSolarLabel: `${local.month}月${local.day}日`,
    lunar
  };
}

export function formatLocalCalendarSummary(year, month, day) {
  const local = normalizeLocalDateParts(year, month, day);
  if (!local) return '';

  const calendarDate = getLocalCalendarDate(local.date);
  return [
    calendarDate.weekdayLabel,
    calendarDate.fullSolarLabel,
    calendarDate.lunar && calendarDate.lunar.fullLabel
  ].filter(Boolean).join(' · ');
}

export function getLocalWeekDates(anchorDate = new Date()) {
  const anchor = new Date(anchorDate);
  anchor.setHours(12, 0, 0, 0);
  const mondayOffset = (anchor.getDay() + 6) % 7;
  anchor.setDate(anchor.getDate() - mondayOffset);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(anchor);
    date.setDate(anchor.getDate() + index);
    return date;
  });
}

export function getLocalMonthGridDates(year, month) {
  const firstDay = normalizeLocalDateParts(year, month, 1);
  if (!firstDay) return [];
  const start = new Date(firstDay.date);
  start.setDate(1 - ((start.getDay() + 6) % 7));

  const lastDay = new Date(year, month, 0, 12, 0, 0, 0);
  const end = new Date(lastDay);
  end.setDate(lastDay.getDate() + (6 - ((lastDay.getDay() + 6) % 7)));
  const naturalDays = Math.round((end - start) / 86400000) + 1;
  const totalDays = naturalDays > 35 ? 42 : 35;

  return Array.from({ length: totalDays }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}
