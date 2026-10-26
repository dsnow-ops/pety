'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { PNG } = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/node_modules/pngjs');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

global.uniCloud = {
  database() { return { collection() { return {}; } }; },
  async downloadFile() { return { fileContent: revisionPng }; }
};

const { buildAvatarPrompt } = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/avatar-prompt.js');
const { buildAvatarRevisionPrompt } = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/avatar-revision-prompt.js');
const { buildWanPayload } = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/wan-client.js');
const storage = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/storage.js');
const avatar = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/index.js').__test;

function createPng(width, height, alphaFactory) {
  const image = new PNG({ width, height });
  let state = 0x12345678;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      state = (state * 1664525 + 1013904223) >>> 0;
      const index = (y * width + x) * 4;
      image.data[index] = state & 255;
      image.data[index + 1] = (state >>> 8) & 255;
      image.data[index + 2] = (state >>> 16) & 255;
      image.data[index + 3] = alphaFactory ? alphaFactory(x, y) : 255;
    }
  }
  return PNG.sync.write(image);
}

const revisionPng = createPng(1024, 1024);

(async () => {
  const basePrompt = buildAvatarPrompt(3);
  assert.equal(basePrompt.length, 1705);
  assert.equal(crypto.createHash('sha256').update(basePrompt).digest('hex'), 'd4bc2b10df557435b9386d9b015cde348b9a4ff9da90d80f06dc08b40fa3a378');

  assert.deepEqual(avatar.buildOrderedFileIds('revision', 'style', 'current-result', ['user-original']), ['current-result']);
  const source = await storage.inspectRevisionSource('cloud://space/pet-avatar/output/p/job/candidate.png');
  assert.equal(source.width, 1024);
  assert.equal(source.height, 1024);
  assert.ok(source.bytes >= 64 * 1024);
  assert.match(source.dataUrl, /^data:image\/png;base64,/);
  assert.equal(source.sha256, source.encodedSha256);
  assert.equal(crypto.createHash('sha256').update(Buffer.from(source.dataUrl.split(',')[1], 'base64')).digest('hex'), source.sha256);

  const prompt = buildAvatarRevisionPrompt(0, '脸再瘦一点');
  assert.ok(prompt.length < 5000);
  assert.doesNotMatch(prompt, /第1张图 = 官方风格参考图/);
  assert.doesNotMatch(prompt, /用户真实宠物的身份参考图/);
  const payload = buildWanPayload(avatar.DEFAULT_CONFIG, prompt, [source.dataUrl], {
    seed: 9,
    size: '2K',
    n: 1,
    watermark: false,
    enableSequential: false
  });
  assert.equal(payload.input.messages[0].content.filter(item => item.image).length, 1);
  assert.equal(payload.input.messages[0].content[0].image, source.dataUrl);
  assert.equal(payload.parameters.size, '2K');
  assert.equal(payload.parameters.n, 1);
  assert.equal(payload.parameters.watermark, false);
  assert.equal(payload.parameters.enable_sequential, false);

  global.uniCloud.downloadFile = async () => ({ fileContent: createPng(700, 1024) });
  await assert.rejects(
    storage.inspectRevisionSource('cloud://space/pet-avatar/output/p/job/small.png'),
    error => error.code === 'REVISION_SOURCE_INVALID' && error.reasonCode === 'REVISION_SOURCE_TOO_SMALL'
  );

  const transparent = createPng(96, 96, (x, y) => (x < 12 || y < 12 ? 0 : 255));
  const alpha = storage.inspectTransparentPng(transparent);
  assert.equal(alpha.hasAlpha, true);
  assert.ok(alpha.alphaPixelCount > 0);
  assert.ok(alpha.transparentPixelRatio > 0);
  assert.throws(() => storage.inspectTransparentPng(createPng(96, 96)), error => error.code === 'CUTOUT_ALPHA_INVALID');

  const cloudSource = read('uniCloud-alipay/cloudfunctions/api_pet_avatar/index.js');
  assert.match(cloudSource, /jobKind === 'revision'[\s\S]*\? \[revisionSource\.dataUrl\]/);
  assert.doesNotMatch(cloudSource, /providerReferenceFileIds = \[identityReference\.fileId\]/);
  assert.match(cloudSource, /jobs\.doc\(lockId\)\.update\(\{[\s\S]*currentResultFileId,[\s\S]*seed,/);
  assert.match(cloudSource, /finalCloudPath[\s\S]*final\\\.png/);
  const display = read('common/avatar-display-asset.js');
  assert.match(display, /\['SUCCEEDED', 'READY'\]\.includes\(cutoutStatus\)/);
  assert.match(display, /kind: 'local-cutout'/);
  const hero = read('components/PetAvatarHero.vue');
  assert.match(hero, /previousImageUrl/);
  assert.match(hero, /@error="onCurrentError"/);
  assert.match(hero, /620ms/);
  assert.match(hero, /const maxX = this\.hasCutout \? 3 : 2/);
  assert.match(hero, /const maxY = this\.hasCutout \? 2 : 1\.5/);
  assert.match(hero, /reduce-motion/);
  assert.match(hero, /@keyframes heroIdle/);

  console.log('PETY avatar revision and cutout V6 tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
