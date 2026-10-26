'use strict';
// Read downloaded sources as bytes only; never execute remote code or print secrets.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = process.cwd(), base = path.join(root, 'unpackage/release-sprint-20261013/cloud-private');
const latest = new Map();
for (const name of fs.readdirSync(base).sort()) {
  const file = path.join(base, name, 'journal.json');
  if (!fs.existsSync(file)) continue;
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (j.success && j.localUnchanged) latest.set(j.key, j);
}
const resources = [];
for (const j of latest.values()) {
  const localFiles = new Map(j.before.map(f => [f.path, f]));
  const differences = [];
  for (const remote of j.downloaded) {
    const local = localFiles.get(remote.path);
    if (!local || local.sha256 !== remote.sha256) differences.push({ path: remote.path, state: local ? 'different' : 'remote-only' });
    localFiles.delete(remote.path);
  }
  for (const [name] of localFiles) if (!name.startsWith('node_modules/')) differences.push({ path: name, state: 'local-only' });
  const row = { resource: j.key, capturedAt: j.finishedAt, remotePath: j.remote, fileCount: j.downloaded.length, localUnchanged: j.localUnchanged, differences };
  const remotePath = path.join(root, j.remote);
  if (remotePath.endsWith('.schema.json')) {
    const bytes = fs.readFileSync(remotePath);
    row.sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    try { row.permission = JSON.parse(bytes).permission; } catch { row.permission = 'requires-jsonc-review'; }
  }
  // Only package capability metadata, no environment values or config contents.
  const pkg = path.join(remotePath, 'package.json');
  if (fs.existsSync(pkg)) {
    const config = JSON.parse(fs.readFileSync(pkg, 'utf8'));
    row.dependencies = Object.keys(config.dependencies || {});
    row.timeout = config['cloudfunction-config']?.timeout ?? null;
  }
  resources.push(row);
}
const result = { createdAt: new Date().toISOString(), provider: 'alipay', spaceId: 'env-00jy6ft635sf', purpose: 'user-confirmed-development-test', resources, limits: ['Source and schema only; no database records exported', 'Provider function environment, actual indexes and storage rules not captured', 'Raw sources and CLI logs remain private and must not enter delivery ZIP'] };
const file = path.join(root, 'unpackage/release-sprint-20261013/cloud-baseline-summary-' + Date.now() + '.json');
fs.writeFileSync(file, JSON.stringify(result, null, 2), { flag: 'wx' });
console.log(JSON.stringify({ file: path.relative(root, file), resources: resources.length, differences: resources.map(r => ({ resource: r.resource, differentFiles: r.differences.length, permission: r.permission })) }, null, 2));
