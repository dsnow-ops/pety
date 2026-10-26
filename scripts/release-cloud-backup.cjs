'use strict';
// Installed HBuilderX resolves --name as a path, then uses basename for the
// remote function name. Export directly into a new private evidence directory.
// Never uploads, deletes a cloud resource or accesses database records.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process'), crypto = require('node:crypto');
const root = fs.realpathSync(process.cwd());
const targets = {
  api_deepseek: ['cloudfunction', 'api_deepseek', 'uniCloud-alipay/cloudfunctions/api_deepseek'],
  api_pet_avatar: ['cloudfunction', 'api_pet_avatar', 'uniCloud-alipay/cloudfunctions/api_pet_avatar'],
  membership_get: ['cloudfunction', 'membership_get', 'uniCloud-alipay/cloudfunctions/membership_get'],
  user_get_profile: ['cloudfunction', 'user_get_profile', 'uniCloud-alipay/cloudfunctions/user_get_profile'],
  submit_product_feedback: ['cloudfunction', 'submit_product_feedback', 'uniCloud-alipay/cloudfunctions/submit_product_feedback'],
  'uni-id-co': ['cloudfunction', 'uni-id-co', 'uni_modules/uni-id-pages/uniCloud/cloudfunctions/uni-id-co', 'uni-id-pages'],
  'pety-auth': ['common', 'pety-auth', 'uniCloud-alipay/cloudfunctions/common/pety-auth'],
  'pety-membership-orders': ['common', 'pety-membership-orders', 'uniCloud-alipay/cloudfunctions/common/pety-membership-orders'],
  'uni-id-common': ['common', 'uni-id-common', 'uni_modules/uni-id-common/uniCloud/cloudfunctions/common/uni-id-common', 'uni-id-common'],
  'uni-config-center': ['common', 'uni-config-center', 'uni_modules/uni-config-center/uniCloud/cloudfunctions/common/uni-config-center', null, 'uniCloud-alipay/cloudfunctions/common/uni-config-center'],
  'uni-captcha': ['common', 'uni-captcha', 'uni_modules/uni-captcha/uniCloud/cloudfunctions/common/uni-captcha', 'uni-captcha'],
  'uni-open-bridge-common': ['common', 'uni-open-bridge-common', 'uni_modules/uni-open-bridge-common/uniCloud/cloudfunctions/common/uni-open-bridge-common', 'uni-open-bridge-common'],
  'uni-cloud-s2s': ['common', 'uni-cloud-s2s', 'uni_modules/uni-cloud-s2s/uniCloud/cloudfunctions/common/uni-cloud-s2s', 'uni-cloud-s2s'],
  pety_memberships: ['db', 'pety_memberships.schema.json', 'uniCloud-alipay/database/pety_memberships.schema.json'],
  memorial_reflection_limits: ['db', 'memorial_reflection_limits.schema.json', 'uniCloud-alipay/database/memorial_reflection_limits.schema.json'],
  pety_provider_budgets: ['db', 'pety_provider_budgets.schema.json', 'uniCloud-alipay/database/pety_provider_budgets.schema.json'],
  pety_sms_send_budgets: ['db', 'pety_sms_send_budgets.schema.json', 'uniCloud-alipay/database/pety_sms_send_budgets.schema.json'],
  pety_active_sessions: ['db', 'pety_active_sessions.schema.json', 'uniCloud-alipay/database/pety_active_sessions.schema.json'],
  pety_session_tickets: ['db', 'pety_session_tickets.schema.json', 'uniCloud-alipay/database/pety_session_tickets.schema.json'],
  pety_avatar_quota_ledgers: ['db', 'pety_avatar_quota_ledgers.schema.json', 'uniCloud-alipay/database/pety_avatar_quota_ledgers.schema.json'],
  pety_avatar_source_receipts: ['db', 'pety_avatar_source_receipts.schema.json', 'uniCloud-alipay/database/pety_avatar_source_receipts.schema.json'],
  product_feedback_uploads: ['db', 'product_feedback_uploads.schema.json', 'uniCloud-alipay/database/product_feedback_uploads.schema.json'],
  pet_avatar_jobs: ['db', 'pet_avatar_jobs.schema.json', 'uniCloud-alipay/database/pet_avatar_jobs.schema.json'],
  'uni-id-users': ['db', 'uni-id-users.schema.json', 'uni_modules/uni-id-pages/uniCloud/database/uni-id-users.schema.json', 'uni-id-pages'],
  'uni-id-device': ['db', 'uni-id-device.schema.json', 'uni_modules/uni-id-pages/uniCloud/database/uni-id-device.schema.json', 'uni-id-pages'],
  'uni-id-log': ['db', 'uni-id-log.schema.json', 'uni_modules/uni-id-pages/uniCloud/database/uni-id-log.schema.json', 'uni-id-pages'],
  'opendb-verify-codes': ['db', 'opendb-verify-codes.schema.json', 'uni_modules/uni-captcha/uniCloud/database/opendb-verify-codes.schema.json', 'uni-captcha'],
  product_feedback: ['db', 'product_feedback.schema.json', 'uniCloud-alipay/database/product_feedback.schema.json'],
  product_feedback_rate_limits: ['db', 'product_feedback_rate_limits.schema.json', 'uniCloud-alipay/database/product_feedback_rate_limits.schema.json'],
  similar_case_search_jobs: ['db', 'similar_case_search_jobs.schema.json', 'uniCloud-alipay/database/similar_case_search_jobs.schema.json']
};
const key = process.argv[2], target = targets[key];
if (!target) throw Error('Choose an allowlisted resource');
function within(relative) {
  const absolute = path.resolve(root, relative), rel = path.relative(root, absolute);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw Error('Path outside workspace');
  return absolute;
}
function manifest(base) {
  const entries = [];
  function visit(file, relative) {
    const stat = fs.lstatSync(file);
    // file: dependencies are links. Preserve the link itself without traversing
    // or reading its target; the enclosing directory is moved back unchanged.
    if (stat.isSymbolicLink()) { entries.push({ path: relative, type: 'link', target: fs.readlinkSync(file) }); return; }
    if (stat.isDirectory()) for (const name of fs.readdirSync(file).sort()) visit(path.join(file, name), relative ? relative + '/' + name : name);
    else if (stat.isFile()) entries.push({ path: relative || path.basename(file), bytes: stat.size, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') });
    else throw Error('Unsupported file type');
  }
  if (fs.existsSync(base)) visit(base, '');
  return entries;
}
const local = within(target[2]);
const run = within('unpackage/release-sprint-20261013/cloud-private/' + new Date().toISOString().replace(/[:.]/g, '-') + '-' + key);
fs.mkdirSync(run, { recursive: true });
const remote = within(path.relative(root, path.join(run, 'remote-source', target[4] || target[2])));
// Download handlers for functions, common modules and single schemas all use
// basename for the remote name, and the supplied resolved path for local output.
if (fs.existsSync(remote)) throw Error('Export destination must be absent');
fs.mkdirSync(path.dirname(remote), { recursive: true });
const before = manifest(local);
const journal = { createdAt: new Date().toISOString(), key, local: target[2], remote: path.relative(root, remote), state: 'prepared', before };
const save = () => fs.writeFileSync(path.join(run, 'journal.json'), JSON.stringify(journal, null, 2));
save();
const args = ['cloud', 'functions', '--download', target[0], '--prj', 'pety', '--provider', 'alipay', '--name', remote];
let stdout = '', stderr = '';
const child = cp.spawn('D:/HBuilderX/cli.exe', args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
child.stdout.on('data', data => { stdout += data.toString('utf8'); });
child.stderr.on('data', data => { stderr += data.toString('utf8'); });
journal.cliPid = child.pid; journal.state = 'downloading'; save();
let finished = false;
function finish(code, error) {
  if (finished) return;
  finished = true;
  // Raw official CLI output remains private: it may contain signed URLs.
  fs.writeFileSync(path.join(run, 'cli-private.log'), stdout + stderr);
  journal.localUnchanged = JSON.stringify(manifest(local)) === JSON.stringify(before);
  journal.exitCode = code;
  journal.downloaded = manifest(remote);
  journal.success = code === 0 && !error && journal.localUnchanged && journal.downloaded.length > 0 && /下载.*(?:完成|成功)|download.*success/i.test(stdout);
  journal.state = journal.success ? 'complete' : 'requires-review';
  journal.finishedAt = new Date().toISOString(); save();
  console.log(JSON.stringify({ run: path.relative(root, run), resource: key, localUnchanged: journal.localUnchanged, remoteFiles: journal.downloaded.length, success: journal.success, exitCode: code }));
  process.exitCode = journal.success ? 0 : 1;
}
child.on('error', error => finish(null, error));
child.on('close', code => finish(code));
