import solarLunar from './vendor/solarlunar.esm.js';

// Calendar conversion is provided by solarlunar-es 1.0.9 (MIT), vendored for offline use.
const WEEKDAY_LABELS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const WEEKDAY_SHORT_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const WEEKDAY_LABELS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAY_SHORT_LABELS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CALENDAR_LABELS_EN = {
  春节: 'Spring Festival', 元宵节: 'Lantern Festival', 端午节: 'Dragon Boat Festival', 七夕节: 'Qixi Festival',
  中秋节: 'Mid-Autumn Festival', 重阳节: 'Double Ninth Festival', 除夕: 'Lunar New Year Eve',
  元旦: "New Year's Day", 清明: 'Qingming', 劳动: 'Labour Day', 国庆节: 'National Day',
  小寒: 'Minor Cold', 大寒: 'Major Cold', 立春: 'Start of Spring', 雨水: 'Rain Water', 惊蛰: 'Awakening of Insects',
  春分: 'Spring Equinox', 谷雨: 'Grain Rain', 立夏: 'Start of Summer', 小满: 'Grain Buds', 芒种: 'Grain in Ear',
  夏至: 'Summer Solstice', 小暑: 'Minor Heat', 大暑: 'Major Heat', 立秋: 'Start of Autumn', 处暑: 'End of Heat',
  白露: 'White Dew', 秋分: 'Autumn Equinox', 寒露: 'Cold Dew', 霜降: 'Frost Descent', 立冬: 'Start of Winter',
  小雪: 'Minor Snow', 大雪: 'Major Snow', 冬至: 'Winter Solstice'
};
const CALENDAR_LABEL_ALIASES = {
  清明节: '清明',
  劳动节: '劳动',
  建党节: '建党',
  建军节: '建军',
  教师节: '教师节',
  情人节: '情人节',
  妇女节: '妇女节',
  儿童节: '儿童节',
  青年节: '青年节'
};

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

function getDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeCalendarLabel(value) {
  const label = String(value || '').trim();
  if (!label) return '';
  return CALENDAR_LABEL_ALIASES[label] || label.slice(0, 4);
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
    fullLabel: `农历${lunar.monthCn}${lunar.dayCn}`,
    traditionalFestival: normalizeCalendarLabel(lunar.lunarFestival),
    solarFestival: normalizeCalendarLabel(lunar.festival),
    solarTerm: lunar.isTerm ? normalizeCalendarLabel(lunar.term) : ''
  };
}

export function getCalendarDayNumber(date = new Date()) {
  const local = normalizeLocalDateParts(date.getFullYear(), date.getMonth() + 1, date.getDate());
  return local ? String(local.day) : '';
}

export function getCalendarSecondaryLabel(dateOrCalendarInfo = new Date()) {
  const calendarInfo = dateOrCalendarInfo && dateOrCalendarInfo.lunar
    ? dateOrCalendarInfo
    : getLocalCalendarDate(dateOrCalendarInfo);
  const lunar = calendarInfo && calendarInfo.lunar;
  if (!lunar) return '';
  return lunar.traditionalFestival || lunar.solarFestival || lunar.solarTerm || lunar.shortLabel;
}

export function getLocalizedCalendarSecondaryLabel(calendarInfo, locale = 'zh-Hans') {
  if (locale !== 'en') return getCalendarSecondaryLabel(calendarInfo);
  const lunar = calendarInfo && calendarInfo.lunar;
  if (!lunar) return '';
  const special = lunar.traditionalFestival || lunar.solarFestival || lunar.solarTerm;
  if (special) return CALENDAR_LABELS_EN[special] || special;
  return `Lunar ${lunar.lunarMonth}/${lunar.lunarDay}`;
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
    dateKey: getDateKey(local.date),
    dayNumber: String(local.day),
    monthDayLabel: `${local.month}/${local.day}`,
    fullSolarLabel: `${local.month}月${local.day}日`,
    lunar,
    secondaryLabel: getCalendarSecondaryLabel({ lunar })
  };
}

export function getCalendarDateState(date, options = {}) {
  const localDate = new Date(date);
  localDate.setHours(12, 0, 0, 0);
  const dateKey = getDateKey(localDate);
  const today = options.todayDate ? new Date(options.todayDate) : new Date();
  today.setHours(12, 0, 0, 0);
  return {
    dateKey,
    isToday: dateKey === getDateKey(today),
    isSelected: dateKey === String(options.selectedDateKey || ''),
    hasRecord: Boolean(options.hasRecord),
    isImportant: Boolean(options.isImportant),
    isCurrentMonth: options.isCurrentMonth !== false
  };
}

export function formatLocalCalendarSummary(year, month, day, locale = 'zh-Hans') {
  const local = normalizeLocalDateParts(year, month, day);
  if (!local) return '';

  const calendarDate = getLocalCalendarDate(local.date);
  if (locale === 'en') {
    return [
      WEEKDAY_LABELS_EN[calendarDate.date.getDay()],
      `${calendarDate.month}/${calendarDate.day}/${calendarDate.year}`,
      getLocalizedCalendarSecondaryLabel(calendarDate, locale)
    ].filter(Boolean).join(' · ');
  }
  return [calendarDate.weekdayLabel, calendarDate.fullSolarLabel, calendarDate.lunar && calendarDate.lunar.fullLabel].filter(Boolean).join(' · ');
}

export function getLocalizedWeekdayLabels(locale = 'zh-Hans') {
  return locale === 'en'
    ? WEEKDAY_SHORT_LABELS_EN.slice(1).concat(WEEKDAY_SHORT_LABELS_EN[0])
    : WEEKDAY_SHORT_LABELS.slice(1).concat(WEEKDAY_SHORT_LABELS[0]);
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

export function getCalendarWeek(anchorDate = new Date()) {
  return getLocalWeekDates(anchorDate).map(date => getLocalCalendarDate(date));
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

export function getCalendarMonthGrid(year, month) {
  return getLocalMonthGridDates(year, month).map(date => {
    const calendarDate = getLocalCalendarDate(date);
    return {
      ...calendarDate,
      isCurrentMonth: calendarDate.year === Number(year) && calendarDate.month === Number(month)
    };
  });
}
