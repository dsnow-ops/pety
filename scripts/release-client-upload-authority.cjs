'use strict';
// Only asks the official SDK for upload authorization. The upload transport is disabled.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const base = path.resolve('unpackage/release-sprint-20261013');
const config = JSON.parse(fs.readFileSync(path.join(base, 'cloud-private/client-app-init.json')))[0];
if (config.provider !== 'alipay' || config.spaceId !== 'env-00jy6ft635sf') throw Error('Wrong test environment');
const marker = crypto.randomUUID(), cloudPath = `pety-release-private-20261013/${marker}/never-uploaded.png`;
const output = path.join(base, `client-upload-authority-${marker}.json`);
const report = { createdAt: new Date().toISOString(), provider: config.provider, spaceId: config.spaceId, accountToken: false, cookie: false, backendReceiptCalls: 0, authorizationRequests: 0, responseBytes: 0, uploadRequests: 0, uploadedBytes: 0, createdObjects: 0, deletedObjects: 0, anonymousUploadAuthorizationReturned: false, limits: 'Upload authorization only. The upload transport is deliberately disabled; no file write or overwrite is proved.' };
const store = new Map();
global.uni = {
 getStorageSync: key => store.get(key), setStorageSync: (key, value) => store.set(key, value), removeStorageSync: key => store.delete(key), clearStorageSync: () => store.clear(),
 getSystemInfoSync: () => ({ platform: 'web', uniPlatform: 'web', appId: '__UNI__A23A379', deviceId: 'pety-isolated-upload-probe' }), getLocale: () => 'zh-Hans', addInterceptor() {},
 request(options) {
  (async () => {
   const url = new URL(options.url);
   if (process.argv.includes('--validate-only') || report.authorizationRequests || url.protocol !== 'https:' || url.hostname !== `${config.spaceId}.api-hz.cloudbasefunction.cn` || decodeURIComponent(url.pathname) !== `/${cloudPath}` || !url.searchParams.has('post_url') || options.method !== 'GET' || /uni.?id.?token|cookie/i.test(JSON.stringify(options))) throw Error('Request outside allowlist');
   report.authorizationRequests++;
   const response = await fetch(url, { method: 'GET', headers: options.header, credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(15000) });
   report.authorizationHttpStatus = response.status;
   const parts = []; for await (const part of response.body) { report.responseBytes += part.length; if (report.responseBytes > 65536) throw Error('Body limit'); parts.push(part); }
   const data = JSON.parse(Buffer.concat(parts).toString());
   const inner = data?.data;
   if (data.success && inner?.file_id !== `cloud://${config.spaceId}/${cloudPath}` && inner?.file_id !== cloudPath) throw Error('Unexpected file ID');
   options.complete({ statusCode: response.status, data, header: Object.fromEntries(response.headers) });
  })().catch(() => options.complete({ statusCode: 0, data: { message: 'Probe request blocked or failed' } }));
  return { abort() {} };
 },
 uploadFile(options) {
  report.anonymousUploadAuthorizationReturned = Boolean(options.url && options.formData && Object.keys(options.formData).length);
  report.uploadTransportBlocked = true;
  report.formFieldNames = Object.keys(options.formData || {}).sort();
  // Never print, save, or redeem the upload URL, signature, token or policy.
  options.fail({ code: 'PROBE_UPLOAD_DISABLED', message: 'Upload deliberately disabled' });
  return { abort() {}, onProgressUpdate() {} };
 }, connectSocket() { throw Error('Socket disabled'); }
};
process.env.NODE_ENV = 'production'; process.env.UNI_PLATFORM = 'h5'; process.env.UNI_CLOUD_PROVIDER = '[]'; process.env.UNI_APP_ID = '__UNI__A23A379'; delete process.env.RUN_BY_HBUILDERX;
(async () => {
 const sdk = require('D:/HBuilderX/plugins/uniapp-cli-vite/node_modules/@dcloudio/uni-cloud/dist/uni-cloud.cjs.js');
 const client = (sdk.uniCloud || sdk.default).init(config);
 if (process.argv.includes('--validate-only')) { console.log(JSON.stringify({ sdkLoaded: true, storageEmpty: store.size === 0, networkRequests: 0, uploadTransportDisabled: true })); return; }
 try { if (store.size) throw Error('Unexpected storage'); await client.uploadFile({ cloudPath, filePath: 'synthetic-file-never-opened.png', fileType: 'image' }); }
 catch (error) { report.terminationCode = String(error.errCode || error.code || 'PROBE_INCOMPLETE').slice(0, 100); }
 fs.writeFileSync(output, JSON.stringify(report, null, 2), { flag: 'wx' }); console.log(JSON.stringify({ output, ...report }));
})().catch(() => { console.error('Probe failed; no credentials printed'); process.exitCode = 1; });
