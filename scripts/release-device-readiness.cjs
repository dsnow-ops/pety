'use strict';
// Read-only ADB metadata. Never reads accounts, tokens, logs, OTP or other apps.
// Usage: node scripts/release-device-readiness.cjs [app-build-directory] [evidence-directory] [explicit-adb-target]
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const root = process.cwd();
const adb = 'D:/HBuilderX/plugins/launcher-tools/tools/adbs/adb.exe';
const createdAt = new Date().toISOString();
const runId = createdAt.replace(/[:.]/g, '-') + '-' + crypto.randomBytes(3).toString('hex');
const buildDir = path.resolve(process.argv[2] || 'unpackage/release-sprint-20261011-desktop/build/app');
const evidence = path.resolve(process.argv[3] || 'unpackage/release-phone-readiness');
const output = path.join(evidence, 'phone-readiness-' + runId + '.json');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function call(...args) {
  return cp.execFileSync(adb, args, { encoding: 'utf8', maxBuffer: 2e6,
    stdio: ['ignore', 'pipe', 'ignore'], timeout: 15000, windowsHide: true });
}
function localBuild(directory) {
  const service = path.join(directory, 'app-service.js');
  const manifest = path.join(directory, 'manifest.json');
  const config = fs.existsSync(manifest) ? JSON.parse(fs.readFileSync(manifest, 'utf8')) : {};
  return { directory: path.relative(root, directory).replaceAll('\\', '/'),
    appId: config.id || config.appid || null,
    serviceSha256: fs.existsSync(service) ? hash(fs.readFileSync(service)) : null,
    lastWriteUtc: fs.existsSync(service) ? fs.statSync(service).mtime.toISOString() : null };
}
const report = { createdAt, readOnly: true, state: 'checking',
  installedPackage: 'io.dcloud.HBuilder', manualBuild: localBuild(buildDir),
  hbuilderDevBuild: localBuild(path.join(root, 'unpackage/dist/dev/app-plus')),
  limits: 'Metadata only for the standard HBuilder base. Matching disk bytes does not prove the running webview reloaded them, source freshness, cloud deployment, runtime acceptance or final signed APK permissions. No resources, settings or user data are changed.' };
try {
  // Do not save serials, wireless addresses or unrelated device metadata.
  const devices = call('devices').split(/\r?\n/).map(line => line.trim())
    .filter(line => line && !line.startsWith('List of devices'))
    .map(line => { const [serial, state] = line.split(/\s+/); return { serial, state }; });
  report.transportStates = devices.map(device => device.state);
  report.totalConnectedTransports = devices.filter(device => device.state === 'device').length;
  const explicitTarget = process.argv[4];
  const selected = explicitTarget ? devices.filter(device => device.serial === explicitTarget) : devices;
  report.explicitTargetSelected = !!explicitTarget;
  report.connectedCount = selected.filter(device => device.state === 'device').length;
  if (selected.length !== 1 || report.connectedCount !== 1) {
    report.state = !selected.length ? (explicitTarget ? 'selected-device-not-found' : 'no-device') : selected.length > 1 ? 'multiple-devices' : 'device-not-ready';
    try { report.wirelessServiceCount = call('mdns', 'services').split(/\r?\n/).filter(line => /_adb.*\._tcp/.test(line)).length; }
    catch { report.wirelessDiscoveryAvailable = false; }
    process.exitCode = 2;
  } else {
    const shell = (...args) => call('-s', selected[0].serial, 'shell', ...args);
    const installed = shell('dumpsys', 'package', report.installedPackage);
    if (!/versionName=/.test(installed)) {
      report.state = 'standard-base-not-installed';
      process.exitCode = 2;
    } else {
      report.model = shell('getprop', 'ro.product.model').trim();
      report.versionName = installed.match(/versionName=([^\s]+)/)?.[1] || null;
      report.versionCode = installed.match(/versionCode=(\d+)/)?.[1] || null;
      report.debuggable = /\bDEBUGGABLE\b/.test(installed);
      report.installedBasePermissions = [...new Set(installed.match(/android\.permission\.[A-Z_]+/g) || [])].sort();
      const www = '/sdcard/Android/data/io.dcloud.HBuilder/apps/HBuilder/www/';
      const remote = JSON.parse(shell('cat', www + 'manifest.json'));
      report.phoneResourceAppId = remote.id || remote.appid || null;
      report.phoneServiceSha256 = shell('sha256sum', www + 'app-service.js').trim().split(/\s+/)[0];
      if (!/^[a-f0-9]{64}$/i.test(report.phoneServiceSha256)) throw Object.assign(new Error(), { code: 'INVALID_PHONE_HASH' });
      report.manualBuildResourcesInstalled = report.phoneServiceSha256 === report.manualBuild.serviceSha256;
      report.hbuilderDevMatchesPhone = report.phoneServiceSha256 === report.hbuilderDevBuild.serviceSha256;
      report.appIdMatches = report.phoneResourceAppId === report.manualBuild.appId;
      report.state = 'metadata-captured';
    }
  }
} catch (error) {
  report.state = 'metadata-unavailable';
  report.error = { code: error.code || 'ADB_METADATA_FAILED', exitStatus: error.status ?? null };
  process.exitCode = 2;
}
fs.mkdirSync(evidence, { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output: path.relative(root, output), state: report.state,
  connectedCount: report.connectedCount, manualBuildResourcesInstalled: report.manualBuildResourcesInstalled,
  hbuilderDevMatchesPhone: report.hbuilderDevMatchesPhone }));
