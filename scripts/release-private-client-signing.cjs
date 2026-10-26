'use strict';
// Isolated official client SDK probe. Never reads account storage or calls cloud functions.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve('unpackage/release-sprint-20261013');
const sdkPath = 'D:/HBuilderX/plugins/uniapp-cli-vite/node_modules/@dcloudio/uni-cloud/dist/uni-cloud.cjs.js';
const config = JSON.parse(fs.readFileSync(path.join(root, 'cloud-private/client-app-init.json')))[0];
const fixture = JSON.parse(fs.readFileSync(path.join(root, 'cloud-private/private-directory-6a35b88d-a0be-4dea-9901-d6ef6260fa7a.json')));
if (config.provider !== 'alipay' || config.spaceId !== 'env-00jy6ft635sf' || fixture.cloudPath !== 'pety-private-v3/6a35b88d-a0be-4dea-9901-d6ef6260fa7a/probe.png' || fixture.fileID !== `cloud://${config.spaceId}/${fixture.cloudPath}`) throw Error('Fixture mismatch');
const report = { createdAt: new Date().toISOString(), sdkSha256: crypto.createHash('sha256').update(fs.readFileSync(sdkPath)).digest('hex'), environment: 'official client SDK with Node uni transport adapter', configSource: 'installed client app resource, no console credentials', accountToken: false, cookie: false, signedPlatformHeaders: true, sdkRequests: 0, sdkResponseBytes: 0, imageRequests: 0, imageBytes: 0, uploads: 0, deletes: 0, cloudFunctionCalls: 0, limits: 'One existing synthetic object; this is not phone UI or A/B normal-login acceptance.' };
const storage = new Map();
async function bounded(url, options, cap) {
  const response = await fetch(url, { ...options, credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(15000) });
  const chunks = []; let length = 0;
  for await (const chunk of response.body) { length += chunk.length; if (length > cap) throw Error('Response cap exceeded'); chunks.push(chunk); }
  return { status: response.status, bytes: Buffer.concat(chunks), headers: Object.fromEntries(response.headers) };
}
global.uni = {
  getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, value), removeStorageSync: key => storage.delete(key), clearStorageSync: () => storage.clear(),
  getSystemInfoSync: () => ({ platform: 'web', uniPlatform: 'web', appId: '__UNI__A23A379', deviceId: 'pety-isolated-client-acl-probe' }),
  getLocale: () => 'zh-Hans', addInterceptor: () => {},
  request(options) {
    (async () => {
      const url = new URL(options.url), body = JSON.parse(options.data);
      if (process.argv.includes('--validate-only')) throw Error('Validate only: network disabled');
      if (report.sdkRequests !== 0 || url.protocol !== 'https:' || url.hostname !== `${config.spaceId}.api-hz.cloudbasefunction.cn` || url.pathname !== '/' || !url.searchParams.has('download_url') || options.method !== 'POST') throw Error('Request outside allowlist');
      if (body.file_list?.length !== 1 || body.file_list[0].file_id !== fixture.cloudPath || /uni.?id.?token|cookie/i.test(JSON.stringify(options))) throw Error('Unexpected identity or file');
      report.sdkRequests++;
      const response = await bounded(url, { method: 'POST', headers: options.header, body: options.data }, 65536);
      report.sdkResponseBytes += response.bytes.length; report.sdkHttpStatus = response.status;
      options.complete({ statusCode: response.status, data: JSON.parse(response.bytes.toString()), header: response.headers });
    })().catch(() => options.complete({ statusCode: 0, data: { message: 'Isolated transport failed or blocked' } }));
    return { abort() {} };
  },
  uploadFile: () => { throw Error('Upload forbidden'); }, connectSocket: () => { throw Error('Socket forbidden'); }
};
process.env.NODE_ENV = 'production'; process.env.UNI_PLATFORM = 'h5'; process.env.UNI_CLOUD_PROVIDER = '[]'; process.env.UNI_APP_ID = '__UNI__A23A379'; delete process.env.RUN_BY_HBUILDERX;
(async () => {
  const sdk = require(sdkPath); const client = (sdk.uniCloud || sdk.default).init(config);
  if (process.argv.includes('--validate-only')) { console.log(JSON.stringify({ sdkLoaded: true, fixtureValidated: true, storageEmpty: storage.size === 0, networkRequests: 0 })); return; }
  try {
    if (storage.size) throw Error('Unexpected initial storage');
    const result = await client.getTempFileURL({ fileList: [fixture.fileID] });
    const item = result.fileList?.[0]; report.clientReturnedUrl = Boolean(item?.tempFileURL);
    if (item?.tempFileURL) {
      const url = new URL(item.tempFileURL);
      if (item.fileID !== fixture.fileID || url.protocol !== 'https:' || url.hostname !== `${config.spaceId}.normal.cloudstatic.cn` || decodeURIComponent(url.pathname) !== `/${fixture.cloudPath}`) throw Error('Returned URL outside fixture allowlist');
      report.imageRequests++;
      const response = await bounded(url, { method: 'GET' }, 8192);
      report.imageHttpStatus = response.status; report.imageBytes = response.bytes.length;
      report.sameSyntheticImage = crypto.createHash('sha256').update(response.bytes).digest('hex') === crypto.createHash('sha256').update(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZV8AAAAASUVORK5CYII=', 'base64')).digest('hex');
    }
  } catch (error) { report.errorCode = String(error.code || 'PROBE_INCOMPLETE').slice(0, 100); report.errorCategory = report.sdkRequests ? 'SDK response or returned URL failed validation; not proof of access denial' : 'No request sent'; }
  report.anonymousPrivateReadConfirmed = report.imageHttpStatus === 200 && report.sameSyntheticImage === true;
  const output = path.join(root, `private-client-signing-${Date.now()}.json`);
  fs.writeFileSync(output, JSON.stringify(report, null, 2), { flag: 'wx' }); console.log(JSON.stringify({ output, ...report }));
})().catch(() => { console.error('Probe initialization failed; no credentials printed'); process.exitCode = 1; });
