'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { getProviderImageInputs } = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/storage');

test('initial generation sends identical reference bytes in order without signed URLs', async () => {
  const images = [Buffer.from([255,216,255,1]), Buffer.from([137,80,78,71,13,10,26,10,1])];
  let calls = 0;
  global.uniCloud = {
    async downloadFile({ fileID }) { assert.equal(fileID, ['cloud://s/style','cloud://s/pet'][calls]); return { fileContent: images[calls++] }; },
    getTempFileURL() { throw new Error('Provider must not need CDN URLs'); }
  };
  const result = await getProviderImageInputs(['cloud://s/style','cloud://s/pet']);
  assert.match(result[0], /^data:image\/jpeg;base64,/);
  assert.match(result[1], /^data:image\/png;base64,/);
  result.forEach((input, i) => assert.deepEqual(Buffer.from(input.split(',')[1], 'base64'), images[i]));
});

test('unavailable references stop before submission with a safe stage and index', async () => {
  global.uniCloud = { async downloadFile() { throw new Error('private signed URL'); } };
  await assert.rejects(getProviderImageInputs(['cloud://s/style']), e => e.stage === 'REFERENCE_PREPARATION' && e.message === 'PROVIDER_INPUT_DOWNLOAD_FAILED: reference 1');
});

test('HTML storage error pages and oversized files are not sent as images', async () => {
  global.uniCloud = { async downloadFile() { return { fileContent: Buffer.from('<html>service suspended</html>') }; } };
  await assert.rejects(getProviderImageInputs(['cloud://s/style']), { code: 'PROVIDER_INPUT_INVALID_IMAGE' });
  const large = Buffer.alloc(20 * 1024 * 1024 + 1); large[0] = 255; large[1] = 216;
  global.uniCloud.downloadFile = async () => ({ fileContent: large });
  await assert.rejects(getProviderImageInputs(['cloud://s/style']), { code: 'PROVIDER_INPUT_TOO_LARGE' });
});
