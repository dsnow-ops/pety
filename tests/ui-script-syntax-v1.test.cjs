'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const files = [
  'pages/home/home.vue',
  'pages/calendar/calendar.vue',
  'pages/memorial-persona/memorial-persona.vue',
  'pages/auth/login.vue',
  'pages/account/account-security.vue',
  'pages/legal/legal.vue',
  'pages/archive/archive.vue',
  'pages/chat/chat.vue',
  'pages/profile/profile.vue',
  'pages/settings/settings.vue'
  ,'pages/avatar-generate/avatar-generate.vue'
  ,'components/AiDataConsentSheet.vue'
  ,'components/PetGenerationParticles.vue'
  ,'components/PetGenerationParticlesLegacy.vue'
  ,'components/PetGenerationScanGrid.vue'
  ,'components/PetAvatarHero.vue'
  ,'pages/welcome/welcome.vue'
];

for (const file of files) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const script = source.match(/<script[^>]*>([\s\S]*?)<\/script>/);
  if (!script) continue;
  const executable = script[1]
    .replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g, '')
    .replace('export default', 'return');
  assert.doesNotThrow(() => new Function(executable), `script syntax failed: ${file}`);
}

const pages = JSON.parse(fs.readFileSync(path.join(root, 'pages.json'), 'utf8').replace(/^\uFEFF/, ''));
assert.ok(Array.isArray(pages.pages));
assert.equal(new Set(pages.pages.map(page => page.path)).size, pages.pages.length, 'duplicate page route');

const memorialPersona = fs.readFileSync(
  path.join(root, 'pages/memorial-persona/memorial-persona.vue'),
  'utf8'
);
assert.match(memorialPersona, /class="relation-chip"/, 'overview should show a compact relation chip');
assert.match(memorialPersona, />你们的关系</, 'relation editing should live in its own section');
assert.doesNotMatch(
  memorialPersona,
  /ownerRelationText\s*\}\}\s*[·・]\s*编辑关系/,
  'overview header should not mix relation and edit actions'
);
assert.match(
  memorialPersona,
  /return `更新于 \$\{date\.getFullYear\(\)\}\.\$\{month\}\.\$\{day\}`/,
  'updated date should be independent'
);
assert.match(memorialPersona, /你记得的 \{\{ petName \}\}/, 'overview should read like a pet portrait');
assert.match(memorialPersona, /如果只记住一件事/, 'core truth should have a dedicated section');
assert.match(memorialPersona, /id="real-memory-input"/, 'quick memory entry should target the actual memory field');
assert.match(memorialPersona, /允许归爪偶尔使用这句话/, 'private phrase consent must be explicit');
assert.match(memorialPersona, /step \* 20/, 'persona editor must remain a five-step flow');
assert.equal((memorialPersona.match(/name:\s*'api_deepseek'/g) || []).length, 1, 'persona page should have one AI call site');
const quickMemoryMethod = memorialPersona.match(/startMemoryEdit\(\)\s*\{[\s\S]*?\n\s*\},/);
assert.ok(quickMemoryMethod, 'quick memory method should exist');
assert.doesNotMatch(quickMemoryMethod[0], /uniCloud|api_deepseek/, 'saving a memory must not call AI');
assert.match(memorialPersona, /@media \(max-width: 380px\)/, 'persona page should include a compact-width layout');
assert.doesNotMatch(memorialPersona, /相似度|人格完整度|天堂|灵魂|蜡烛|星空/, 'persona UI should avoid invented scores and memorial clichés');

console.log('UI script syntax tests passed');
