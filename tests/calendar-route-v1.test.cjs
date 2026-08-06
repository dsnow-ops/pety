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
assert.match(calendar, /getLocalMonthGridDates\(displayYear, displayMonth\)/);
assert.ok(pages.pages.some(page => page.path === 'pages/calendar/calendar'));
assert.ok(pages.pages.some(page => page.path === 'pages/memorial-persona/memorial-persona'));

console.log('calendar route tests passed');
