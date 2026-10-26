'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const base = 'unpackage/release-sprint-20261013/cloud-private';
const histories = new Map();
for (const d of fs.readdirSync(base).sort()) {
  const f = path.join(base, d, 'journal.json');
  if (!fs.existsSync(f)) continue;
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (j.success && j.localUnchanged) histories.set(j.key, [...(histories.get(j.key) || []), j]);
}
const canonical = v => JSON.stringify(v, (_, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x);
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const keys = ['pety-auth', 'pety-membership-orders', 'api_deepseek', 'api_pet_avatar', 'submit_product_feedback', 'uni-id-co', 'membership_get', 'user_get_profile', 'pety_provider_budgets', 'pety_sms_send_budgets', 'pety_active_sessions', 'pety_session_tickets', 'pety_avatar_quota_ledgers', 'pety_avatar_source_receipts', 'product_feedback_uploads', 'pet_avatar_jobs', 'product_feedback', 'product_feedback_rate_limits'];
const rows = [];
for (const key of keys) {
  const j = histories.get(key)?.at(-1);
  if (!j) { rows.push({ key, pass: false, reason: 'No successful readback' }); continue; }
  if (j.local.endsWith('.schema.json')) {
    const local = JSON.parse(fs.readFileSync(j.local, 'utf8')), remote = JSON.parse(fs.readFileSync(j.remote, 'utf8'));
    rows.push({ key, capturedAt: j.finishedAt, pass: canonical(local) === canonical(remote), type: 'schema-semantic-comparison', clientDenyAll: ['read', 'create', 'update', 'delete'].every(k => remote.permission[k] === false) });
    continue;
  }
  const files = [];
  for (const f of j.before) {
    if (f.type === 'link' || f.path.startsWith('node_modules/') || f.path === 'package-lock.json') continue;
    const remote = path.join(j.remote, f.path), local = path.join(j.local, f.path);
    const exists = fs.existsSync(remote);
    const semantic = f.path === 'package.json';
    const pass = exists && (semantic ? canonical(JSON.parse(fs.readFileSync(local))) === canonical(JSON.parse(fs.readFileSync(remote))) : hash(fs.readFileSync(remote)) === f.sha256);
    files.push({ path: f.path, pass, comparison: semantic ? 'json' : 'sha256' });
  }
  rows.push({ key, capturedAt: j.finishedAt, pass: files.length > 0 && files.every(f => f.pass), files });
}
const configs = histories.get('uni-config-center') || [];
const configUnchanged = configs.length >= 2 && canonical(configs[0].downloaded) === canonical(configs.at(-1).downloaded);
const auth = histories.get('pety-auth')?.at(-1);
const imageDependencies = {};
if (auth) for (const name of ['pngjs', 'jpeg-js']) {
  const f = path.join(auth.remote, 'node_modules', name, 'package.json');
  imageDependencies[name] = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f)).version : null;
}
const result = { createdAt: new Date().toISOString(), spaceId: 'env-00jy6ft635sf', rows, configUnchanged, imageDependencies, pass: configUnchanged && rows.every(r => r.pass), limits: ['Readback proves uploaded source/schema, not executed cloud handlers', 'Function environment, runtime configuration, storage ACL and live indexes remain unverified', 'Session enforcement was not enabled; formal payment and developer entitlement flags were not enabled', 'Common module upload installs dependencies without package-lock; actual image dependency versions recorded'] };
const out = 'unpackage/release-sprint-20261013/cloud-deployment-readback-' + Date.now() + '.json';
fs.writeFileSync(out, JSON.stringify(result, null, 2), { flag: 'wx' });
console.log(JSON.stringify({ out, pass: result.pass, configUnchanged, imageDependencies, rows: rows.map(r => ({ key: r.key, pass: r.pass, mismatches: r.files?.filter(f => !f.pass) })) }, null, 2));
process.exitCode = result.pass ? 0 : 1;
