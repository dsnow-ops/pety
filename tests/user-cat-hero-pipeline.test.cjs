'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { decodeImage } = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/image-quality-gate');
const derivatives = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/avatar-display-derivatives');
const storage = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/storage');
const { HERO_CHARACTER_VERSION, HERO_KEY_COLOR, buildHeroCharacterPrompt } = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/hero-character-prompt');

const fixture = name => fs.readFileSync(path.join(__dirname, 'fixtures', name));

test('the supplied cat photo is a permanent real-image regression input', () => {
  const reference = fixture('user-cat-reference.jpg');
  assert.ok(reference.length > 100000);
  const decoded = decodeImage(reference);
  assert.ok(decoded.width >= 900 && decoded.height >= 1800);
});

test('prompt-only fake transparency is rejected', () => {
  assert.throws(
    () => storage.inspectTransparentPng(fixture('user-cat-hero-generated-v1.png')),
    error => error.code === 'CUTOUT_ALPHA_INVALID'
  );
});

test('the Hero provider receives a real opaque JPEG instead of an RGBA PNG', () => {
  const prepared = storage.buildHeroProviderSourceJpeg(fixture('user-cat-hero-generated-v1.png'));
  assert.equal(prepared.mime, 'image/jpeg');
  assert.equal(prepared.alphaChannel, false);
  assert.ok(prepared.width <= 1280 && prepared.height <= 1280);
  assert.equal(prepared.buffer[0], 0xff);
  assert.equal(prepared.buffer[1], 0xd8);
  const decoded = decodeImage(prepared.buffer);
  for (let index = 3; index < decoded.data.length; index += 4) assert.equal(decoded.data[index], 255);
});

test('the supplied cat passes the separated magenta Hero pipeline', () => {
  const source = decodeImage(fixture('user-cat-hero-chroma-v1.png'));
  const local = derivatives.createLocalCutout(source);
  assert.doesNotThrow(() => storage.assertMagentaTechnicalSource(source, local.metrics));
  assert.ok(local.buffer);
  const inspection = storage.inspectTransparentPng(local.buffer);
  assert.equal(inspection.qualified, true, inspection.fallbackReason);
  const tight = derivatives.buildTightCutout(local.buffer);
  assert.equal(tight.metrics.qualified, true, tight.metrics.fallbackReason);
  assert.ok(tight.buffer);

  const decoded = decodeImage(tight.buffer);
  let visible = 0, leaked = 0;
  for (let index = 0; index < decoded.width * decoded.height; index += 1) {
    const offset = index * 4;
    if (decoded.data[offset + 3] <= 16) continue;
    visible += 1;
    const red = decoded.data[offset], green = decoded.data[offset + 1], blue = decoded.data[offset + 2];
    if (red > 150 && blue > 120 && green < 100 && red - green > 70 && blue - green > 50) leaked += 1;
  }
  assert.ok(leaked / Math.max(visible, 1) <= 0.003, `magenta matte leak ${leaked}/${visible}`);
});

test('muted jade source is rejected before its damaged alpha can reach Home', () => {
  const source = decodeImage(fixture('user-cat-hero-jade-v1.png'));
  const local = derivatives.createLocalCutout(source);
  assert.throws(
    () => storage.assertMagentaTechnicalSource(source, local.metrics),
    error => error.code === 'HERO_TECHNICAL_BACKGROUND_INVALID'
  );
});

test('workbench and Home use different generation contracts', () => {
  const composition = fs.readFileSync(path.join(__dirname, '..', 'uniCloud-alipay/cloudfunctions/api_pet_avatar/avatar-composition-contract.js'), 'utf8');
  const heroPrompt = buildHeroCharacterPrompt();
  const api = fs.readFileSync(path.join(__dirname, '..', 'uniCloud-alipay/cloudfunctions/api_pet_avatar/index.js'), 'utf8');
  assert.doesNotMatch(composition, /#FF00CC|#5F9888/);
  assert.match(composition, /工作台审阅的主图/);
  assert.equal(HERO_KEY_COLOR, '#FF00CC');
  assert.match(HERO_CHARACTER_VERSION, /^hero-character-/);
  assert.match(heroPrompt, /仅替换图1背景/);
  assert.match(heroPrompt, /姿势和身体比例不变/);
  assert.doesNotMatch(heroPrompt, /猫咪|狗狗|重新设计|坐姿|3\/4/);
  assert.ok(heroPrompt.length < 180, 'Hero edit keeps a single instruction instead of conflicting generation goals');
  assert.match(api, /persistChromaHeroImage/);
  assert.match(api, /persistHeroProviderSource/);
  assert.match(api, /heroFileId: persisted\.heroFileId/);
});
