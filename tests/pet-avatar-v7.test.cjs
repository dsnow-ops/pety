'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { PNG } = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/node_modules/pngjs');
const { buildAvatarPrompt } = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/avatar-prompt');
const { buildAvatarRevisionPrompt } = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/avatar-revision-prompt');
const { buildWanPayload } = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/wan-client');
const { buildDisplayDerivatives } = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/avatar-display-derivatives');
const { evaluateRevisionQuality } = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/image-quality-gate');

const root = path.resolve(__dirname, '..');
const source = file => fs.readFileSync(path.join(root, file), 'utf8');

function makePetPng(noise = false, tint = 0) {
  const image = new PNG({ width: 1024, height: 1024 });
  for (let y = 0; y < 1024; y += 1) {
    for (let x = 0; x < 1024; x += 1) {
      const index = (y * 1024 + x) * 4;
      const subject = ((x - 512) ** 2) / (250 ** 2) + ((y - 550) ** 2) / (350 ** 2) < 1;
      const noisy = noise && ((x + y) % 2 === 0);
      const color = noisy ? (noisy ? [0, 0, 0] : [255, 255, 255]) : (subject ? [126 + tint, 104 + tint, 84 + tint] : [238, 232, 220]);
      image.data[index] = color[0]; image.data[index + 1] = color[1]; image.data[index + 2] = color[2]; image.data[index + 3] = 255;
    }
  }
  return PNG.sync.write(image);
}

const prompt = buildAvatarPrompt(3);
assert.equal(prompt.length, 1705);
assert.equal(crypto.createHash('sha256').update(prompt).digest('hex'), 'd4bc2b10df557435b9386d9b015cde348b9a4ff9da90d80f06dc08b40fa3a378');
for (const kind of ['initial', 'regenerate', 'revision']) {
  const payload = buildWanPayload({ size: '2K', n: 1, watermark: false, model: 'wan2.7-image-pro' }, kind, ['data:image/png;base64,AA=='], { size: '2K', n: 1, watermark: false });
  assert.equal(payload.parameters.size, '2K');
  assert.equal(payload.parameters.n, 1);
  assert.equal(payload.parameters.watermark, false);
}

const derivatives = buildDisplayDerivatives(makePetPng());
const display = PNG.sync.read(derivatives.displayBuffer);
const thumbnail = PNG.sync.read(derivatives.thumbnailBuffer);
assert.equal(Math.max(display.width, display.height), 768);
assert.equal(Math.max(thumbnail.width, thumbnail.height), 256);
assert.ok(derivatives.localCutoutBuffer, 'uniform light background produces local Alpha cutout');
const cutout = PNG.sync.read(derivatives.localCutoutBuffer);
assert.ok(Array.from(cutout.data).filter((_, index) => index % 4 === 3).some(alpha => alpha < 255));
assert.ok(derivatives.featheredBuffer.length > 0);

const subtle = makePetPng(false, 2);
assert.doesNotThrow(() => evaluateRevisionQuality(makePetPng(), subtle));
const noisyImage = new PNG({ width: 1024, height: 1024 });
for (let i = 0; i < noisyImage.data.length; i += 4) {
  const value = (i / 4) % 2 ? 0 : 255;
  noisyImage.data[i] = value; noisyImage.data[i + 1] = value; noisyImage.data[i + 2] = value; noisyImage.data[i + 3] = 255;
}
assert.throws(() => evaluateRevisionQuality(makePetPng(), PNG.sync.write(noisyImage)), error => error.code === 'REVISION_RESULT_UNSTABLE');
const colorDriftImage = PNG.sync.read(makePetPng());
for (let i = 0; i < colorDriftImage.data.length; i += 4) {
  const green = colorDriftImage.data[i + 1];
  const blue = colorDriftImage.data[i + 2];
  colorDriftImage.data[i] = 0;
  colorDriftImage.data[i + 1] = Math.round(green * 0.15);
  colorDriftImage.data[i + 2] = Math.min(255, 220 + Math.round(blue * 0.1));
}
assert.throws(
  () => evaluateRevisionQuality(makePetPng(), PNG.sync.write(colorDriftImage)),
  error => error.code === 'REVISION_RESULT_UNSTABLE' && error.qualityGateResult.reasonCode === 'EXTREME_COLOR_DRIFT'
);

const revisionPrompt = buildAvatarRevisionPrompt(0, '尾巴改为纯白色');
assert.match(revisionPrompt, /保持身份，仅修改指定局部/);
assert.match(revisionPrompt, /旧图姿势或构图不合规范时同时纠正为标准坐姿/);
assert.doesNotMatch(revisionPrompt, /官方风格参考图/);
assert.match(source('uniCloud-alipay/cloudfunctions/api_pet_avatar/index.js'), /jobKind === 'revision'[\s\S]*\? \[revisionSource\.dataUrl\]/);
assert.match(source('uniCloud-alipay/cloudfunctions/api_pet_avatar/storage.js'), /MIN_REVISION_SOURCE_EDGE = 768/);
assert.match(source('common/avatar-display-asset.js'), /viapi-cutout[\s\S]*local-cutout[\s\S]*kind: 'final'/);
assert.match(source('common/avatar-display-asset.js'), /getCacheKey\(petId, fileId\)/);
assert.match(source('uniCloud-alipay/cloudfunctions/api_pet_avatar/index.js'), /userQuotaConsumed: false/);
assert.equal((source('uniCloud-alipay/cloudfunctions/api_pet_avatar/index.js').match(/createWanTask\(/g) || []).length, 2);

console.log('PETY avatar V7 2K, revision and display derivative tests passed');
