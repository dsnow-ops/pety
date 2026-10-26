'use strict';
// Exact synthetic, nonexistent IDs only. A successful empty read is NOT a permission pass.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const base = path.resolve('unpackage/release-sprint-20261013');
const cfg = JSON.parse(fs.readFileSync(path.join(base, 'cloud-private/client-app-init.json')))[0];
if (cfg.provider !== 'alipay' || cfg.spaceId !== 'env-00jy6ft635sf') throw Error('Wrong environment');
const marker = `pety-release-anon-${crypto.randomUUID()}`;
const collections = ['uni-id-users', 'pety_avatar_quota_ledgers', 'pet_avatar_jobs'];
const report = { createdAt: new Date().toISOString(), spaceId: cfg.spaceId, accountToken: false, cookies: false, requests: 0, responseBytes: 0, writes: 0, results: [], limits: 'Anonymous read denial only, three exact nonexistent synthetic IDs, _id projection and limit 1. No normal A/B login, mutation, count/export or single-device proof.' };
let expectedCommand;
global.uni = {
 getStorageSync: () => undefined, setStorageSync() {}, removeStorageSync() {}, getSystemInfoSync: () => ({ platform: 'web', uniPlatform: 'web', appId: '__UNI__A23A379' }), getLocale: () => 'zh-Hans',
 request(options) {
  (async () => {
   const url = new URL(options.url), data = JSON.parse(options.data);
   if (process.argv.includes('--validate-only') || report.requests >= 3 || url.protocol !== 'https:' || url.hostname !== `${cfg.spaceId}.api-hz.cloudbasefunction.cn` || url.pathname !== '/functions/invokeFunction' || options.header['x-to-function-name'] !== 'DCloud-clientDB' || options.method !== 'POST' || JSON.stringify(data.command) !== JSON.stringify(expectedCommand) || data.uniIdToken || /cookie/i.test(JSON.stringify(options.header))) throw Error('Request blocked');
   report.requests++;
   const response = await fetch(url, { method: 'POST', headers: options.header, body: options.data, credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(15000) });
   const parts = []; let length = 0;
   for await (const part of response.body) { length += part.length; report.responseBytes += part.length; if (length > 65536) throw Error('Body limit'); parts.push(part); }
   options.complete({ statusCode: response.status, data: JSON.parse(Buffer.concat(parts).toString()), header: Object.fromEntries(response.headers) });
  })().catch(() => options.complete({ statusCode: 0, data: { message: 'Transport failed or blocked' } }));
  return { abort() {} };
 }, uploadFile() { throw Error('Upload blocked'); }, connectSocket() { throw Error('Socket blocked'); }
};
process.env.NODE_ENV = 'production'; process.env.UNI_PLATFORM = 'h5'; process.env.UNI_CLOUD_PROVIDER = '[]'; process.env.UNI_APP_ID = '__UNI__A23A379'; delete process.env.RUN_BY_HBUILDERX;
(async () => {
 const sdk = require('D:/HBuilderX/plugins/uniapp-cli-vite/node_modules/@dcloudio/uni-cloud/dist/uni-cloud.cjs.js');
 const client = (sdk.uniCloud || sdk.default).init(cfg);
 if (process.argv.includes('--validate-only')) { console.log(JSON.stringify({ sdkLoaded: true, networkRequests: 0, collections })); return; }
 for (const collection of collections) {
  expectedCommand = { $db: [{ $method: 'collection', $param: [collection] }, { $method: 'where', $param: [{ _id: marker }] }, { $method: 'field', $param: [{ _id: true }] }, { $method: 'limit', $param: [1] }, { $method: 'get', $param: [] }] };
  const result = { collection };
  try { const value = await client.database().collection(collection).where({ _id: marker }).field({ _id: true }).limit(1).get(); result.requestSucceeded = true; result.rowsReturned = value.result?.data?.length ?? value.data?.length ?? null; result.permissionDenied = false; }
  catch (error) { result.errorCode = String(error.errCode || error.code || 'UNKNOWN').slice(0, 100); result.errorMessage = String(error.errMsg || error.message || '').slice(0, 250); result.permissionDenied = /permission|权限/i.test(result.errorCode + ' ' + result.errorMessage); }
  report.results.push(result);
 }
 report.allAnonymousReadsDenied = report.results.length === 3 && report.results.every(row => row.permissionDenied);
 const output = path.join(base, `anonymous-clientdb-${Date.now()}.json`); fs.writeFileSync(output, JSON.stringify(report, null, 2), { flag: 'wx' }); console.log(JSON.stringify({ output, ...report }));
})().catch(() => { console.error('Probe initialization failed'); process.exitCode = 1; });
