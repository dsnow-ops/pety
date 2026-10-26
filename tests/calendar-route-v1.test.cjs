'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, '');
const home = read('pages/home/home.vue');
const archive = read('pages/archive/archive.vue');
const calendar = read('pages/calendar/calendar.vue');
const pages = JSON.parse(read('pages.json'));

assert.match(home, /pages\/calendar\/calendar\?date=\$\{item\.dateKey\}/);
assert.match(home, /pages\/calendar\/calendar/);
assert.match(archive, /pages\/calendar\/calendar/);
assert.doesNotMatch(`${home}\n${archive}\n${calendar}`, /view=week/);
assert.match(calendar, /options\.selectedDate \|\| options\.date/);
assert.match(calendar, /getCalendarMonthGrid\(displayYear, displayMonth\)/);
assert.match(calendar, /\.date-grid\s*\{[\s\S]*?flex-wrap:\s*wrap/);
assert.match(home, /getCalendarWeek\(this\.homeWeekDate\)/);
assert.match(calendar, /position:\s*fixed/);
assert.match(calendar, /@touchmove\.stop\.prevent/);
assert.match(calendar, /onBackPress\(\)/);
assert.match(calendar, /class="calendar-animated-content"/);
assert.match(calendar, /class="picker-mask"[^>]*><\/view>\s*<view v-if="showMonthPicker" class="picker-sheet"/);
assert.match(calendar, /\.picker-mask\s*\{[\s\S]*?z-index:\s*9000/);
assert.match(calendar, /\.picker-sheet\s*\{[\s\S]*?position:\s*fixed[\s\S]*?z-index:\s*9001[\s\S]*?max-height:\s*62vh/);
assert.match(calendar, /\.calendar-animated-content\s*\{[\s\S]*?animation:\s*calendarFadeUp/);
assert.match(calendar, /v-if="item\.isCurrentMonth" class="date-lunar"/);
assert.match(calendar, /v-if="item\.isCurrentMonth && item\.isToday" class="date-today-mark"/);
assert.match(calendar, /v-if="item\.isCurrentMonth && item\.hasRecord" class="record-dot"/);
assert.ok(pages.pages.some(page => page.path === 'pages/calendar/calendar'));
assert.ok(pages.pages.some(page => page.path === 'pages/memorial-persona/memorial-persona'));

console.log('calendar route tests passed');
