'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = file => fs.readFileSync(path.join(root, file), 'utf8');
const { buildAvatarPrompt } = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/avatar-prompt');

const prompt = buildAvatarPrompt(3);
assert.equal(prompt.length, 1705);
assert.equal(crypto.createHash('sha256').update(prompt).digest('hex'), 'd4bc2b10df557435b9386d9b015cde348b9a4ff9da90d80f06dc08b40fa3a378');

const cloud = source('uniCloud-alipay/cloudfunctions/api_pet_avatar/index.js');
const storage = source('uniCloud-alipay/cloudfunctions/api_pet_avatar/storage.js');
const derivatives = source('uniCloud-alipay/cloudfunctions/api_pet_avatar/avatar-display-derivatives.js');
const workbench = source('pages/avatar-generate/avatar-generate.vue');
const home = source('pages/home/home.vue');

assert.match(cloud, /size: '2K'/);
assert.doesNotMatch(cloud, /size: '1K'/);
assert.match(cloud, /providerSize: '2K'/);
assert.match(storage, /preservesProviderBytes = providerInspection\.mime === 'image\/png'/);
assert.match(storage, /preservesProviderBytes\s*\? providerContent/);
assert.match(storage, /wasDownscaled: false/);
assert.match(storage, /providerOriginal: preservesProviderBytes/);
assert.match(storage, /persistFinalImage\(petHash, jobId, candidateFileId/);

assert.match(workbench, /stageImage\(\) \{ return this\.visibleResultUrl; \}/);
assert.match(workbench, /const fileId = candidate\.fileId \|\| candidate\.generatedFileId/);
assert.match(workbench, /generatedThumbnailFileId \|\| candidate\.generatedFileId/);
assert.match(workbench, /SURFACE: workbench/);
assert.match(home, /SURFACE: home hero/);
assert.match(home, /PROVIDER ORIGINAL:/);

assert.match(derivatives, /const topLeft/);
assert.match(derivatives, /const bottomRight/);
assert.doesNotMatch(derivatives, /Math\.floor\(\(x \+ 0\.5\) \/ scale\)/);

const displayModuleSource = source('common/avatar-display-asset.js')
  .replace(/export function /g, 'function ')
  .replace(/export async function /g, 'async function ')
  .replace(/export const /g, 'const ');
const display = Function('uniCloud', `${displayModuleSource}; return { resolvePetHeroAsset };`)({});
const master = { width: 2048, height: 2048, bytes: 1800000, mime: 'image/png', providerOriginal: true };

assert.equal(display.resolvePetHeroAsset({
  id: 'pet-quality',
  generatedAvatarFileId: 'final', generatedAvatarDerivedFromFileId: 'final',
  generatedAvatarMainAssetMetadata: master,
  generatedAvatarCutoutStatus: 'SUCCEEDED',
  generatedAvatarCutoutFileId: 'cutout',
  generatedAvatarCutoutAlphaValid: true,
  generatedAvatarCutoutMetrics: { width: 2048, height: 2048, bytes: 900000, qualityVersion: 2, qualified: true, hasAlpha: true, mime: 'image/png' }
}).assetKind, 'viapi-cutout');

const lowQualityCutout = display.resolvePetHeroAsset({
  id: 'pet-quality',
  generatedAvatarFileId: 'final', generatedAvatarDerivedFromFileId: 'final',
  generatedAvatarMainAssetMetadata: master,
  generatedAvatarCutoutStatus: 'SUCCEEDED',
  generatedAvatarCutoutFileId: 'cutout-small',
  generatedAvatarCutoutAlphaValid: true,
  generatedAvatarCutoutMetrics: { width: 768, height: 768, bytes: 180000 },
  generatedAvatarFeatheredDisplayFileId: 'feather',
  generatedAvatarDisplayDimensions: { displayWidth: 768, displayHeight: 768 }
});
assert.equal(lowQualityCutout.assetKind, 'final');
assert.equal(lowQualityCutout.providerOriginal, true);
assert.equal(lowQualityCutout.wasDownscaled, false);

console.log('PETY avatar quality degradation V1 tests passed');
