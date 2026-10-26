'use strict';
// Read-only local deployment checks. No cloud SDK, credentials or network calls.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const hash = require('node:crypto');
const root = process.cwd();
const packages = [
  'uniCloud-alipay/cloudfunctions/api_deepseek/package.json',
  'uniCloud-alipay/cloudfunctions/api_pet_avatar/package.json',
  'uniCloud-alipay/cloudfunctions/submit_product_feedback/package.json',
  'uniCloud-alipay/cloudfunctions/membership_get/package.json',
  'uniCloud-alipay/cloudfunctions/user_get_profile/package.json',
  'uniCloud-alipay/cloudfunctions/common/pety-auth/package.json',
  'uniCloud-alipay/cloudfunctions/common/pety-membership-orders/package.json',
  'uni_modules/uni-id-pages/uniCloud/cloudfunctions/uni-id-co/package.json',
  'uni_modules/uni-pay/uniCloud/cloudfunctions/uni-pay-co/package.json'
];
const findings = [], files = [], dependencies = [], visited = new Set();
function inspectPackage(relative) {
  if (visited.has(relative)) return;
  visited.add(relative);
  const file = path.resolve(root, relative);
  if (!fs.existsSync(file)) { findings.push({ code: 'PACKAGE_MISSING', path: relative }); return; }
  const bytes = fs.readFileSync(file), config = JSON.parse(bytes);
  files.push({ path: relative, sha256: hash.createHash('sha256').update(bytes).digest('hex') });
  for (const [name, spec] of Object.entries(config.dependencies || {})) {
    if (typeof spec !== 'string' || !spec.startsWith('file:')) continue;
    const target = path.resolve(path.dirname(file), spec.slice(5), 'package.json');
    const rel = path.relative(root, target).replaceAll('\\', '/');
    if (rel.startsWith('../') || path.isAbsolute(rel)) { findings.push({ code: 'DEPENDENCY_OUTSIDE_PROJECT', path: relative, name }); continue; }
    dependencies.push({ from: relative, name, to: rel });
    inspectPackage(rel);
  }
}
async function inspectDownloadDeadline() {
  const sourcePath = 'uniCloud-alipay/cloudfunctions/common/pety-auth/safe-image-download.js';
  const module = { exports: {} }, timers = [];
  vm.runInNewContext(fs.readFileSync(sourcePath, 'utf8'), {
    module, exports: module.exports, URL, Buffer, process: { env: {} },
    require(name) {
      if (name === 'net') return require('node:net');
      if (name === 'https') return { get() { throw Error('NETWORK_DISABLED_IN_PREFLIGHT'); } };
      if (name === 'dns') return { promises: { lookup() { throw Error('NETWORK_DISABLED_IN_PREFLIGHT'); } } };
      throw Error('Unsupported preflight dependency');
    },
    setTimeout(callback, ms) { const timer = { callback, ms }; timers.push(timer); return timer; },
    clearTimeout() {}
  }, { filename: sourcePath });
  const download = module.exports.createDownloader({ lookup: () => new Promise(() => {}) });
  const result = download('https://dashscope-result-bj.oss-cn-beijing.aliyuncs.com/preflight').catch(error => error);
  if (timers.length !== 1 || !Number.isFinite(timers[0].ms) || timers[0].ms <= 0) throw Error('Download deadline missing');
  timers[0].callback();
  const error = await result;
  if (error.code !== 'RESULT_DOWNLOAD_TIMEOUT') throw Error('Download timeout contract changed');
  return timers[0].ms;
}
(async () => {
  packages.forEach(inspectPackage);
  const downloadDeadlineMs = await inspectDownloadDeadline();
  const feedbackPath = 'uniCloud-alipay/cloudfunctions/submit_product_feedback/package.json';
  const feedback = JSON.parse(fs.readFileSync(feedbackPath, 'utf8'));
  const functionDeadlineMs = Number(feedback['cloudfunction-config']?.timeout) * 1000;
  if (!Number.isFinite(functionDeadlineMs) || functionDeadlineMs <= downloadDeadlineMs) findings.push({ code: 'FEEDBACK_FUNCTION_SHORTER_THAN_DOWNLOAD', path: feedbackPath, functionDeadlineMs, downloadDeadlineMs });
  const result = { localOnly: true, reportDate: new Date().toISOString().slice(0,10), createdAt: new Date().toISOString(), downloadDeadlineMs, functionDeadlineMs, declaredHeadroomMs: functionDeadlineMs - downloadDeadlineMs, files, dependencies, findings, limits: 'Checks local file dependencies and executes the download deadline contract with all network disabled. Does not prove cloud deployment, ACLs, provider availability or real runtime latency.' };
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = findings.length ? 1 : 0;
})().catch(error => { console.error('Local preflight failed:', error.code || error.name); process.exitCode = 1; });
