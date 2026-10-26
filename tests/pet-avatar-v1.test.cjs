const assert = require('node:assert/strict');
const crypto = require('node:crypto');

global.uniCloud = {
  database() {
    return { collection() { return {}; } };
  }
};

const { buildAvatarPrompt, MAX_PROMPT_CHARS } = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/avatar-prompt.js');
const { buildWanPayload } = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/wan-client.js');
const { __test } = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/index.js');

for (const count of [1, 2, 3]) {
  const prompt = buildAvatarPrompt(count);
  assert.ok(prompt.length <= MAX_PROMPT_CHARS);
  assert.equal(prompt.length, 1705);
  assert.equal(crypto.createHash('sha256').update(prompt).digest('hex'), 'd4bc2b10df557435b9386d9b015cde348b9a4ff9da90d80f06dc08b40fa3a378');
  assert.match(prompt, /第1张图 = 官方风格参考图/);
  assert.match(prompt, /第2张及之后所有图片 = 同一只用户真实宠物的身份参考图/);
  const imageUrls = ['style'].concat(Array.from({ length: count }, (_, index) => `user-${index + 1}`));
  const payload = buildWanPayload(__test.DEFAULT_CONFIG, prompt, imageUrls);
  assert.deepEqual(payload.input.messages[0].content.slice(0, imageUrls.length), imageUrls.map(image => ({ image })));
  assert.equal(payload.parameters.size, '2K');
  assert.equal(payload.parameters.n, 1);
  assert.equal(payload.parameters.watermark, false);
  assert.equal(payload.parameters.enable_sequential, false);
}
assert.throws(() => buildAvatarPrompt(4), /INVALID_SOURCE_COUNT/);
assert.throws(() => __test.assertConsent({}), /AI_CONSENT_REQUIRED/);
assert.throws(() => __test.validateConfig(__test.DEFAULT_CONFIG), /AVATAR_PROVIDER_NOT_CONFIGURED/);
console.log('pet avatar V1 tests passed');
