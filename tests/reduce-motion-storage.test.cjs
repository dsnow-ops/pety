'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.resolve(__dirname, '../common/haptics.js'), 'utf8')
  .replace(/export function /g, 'function ');
const helpers = Function(`${source}; return { normalizeStoredBoolean };`)();

test('reduce-motion storage accepts only explicit enabled values', () => {
  for (const value of [true, 1, '1', 'true']) assert.equal(helpers.normalizeStoredBoolean(value), true);
  for (const value of [false, 0, '0', 'false', '', null, undefined]) assert.equal(helpers.normalizeStoredBoolean(value), false);
});

