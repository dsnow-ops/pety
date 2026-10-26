'use strict';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict');
// Production main is executed unchanged; identity and admission are isolated
// service boundaries. No real account, provider, or cloud transaction is used.
function localServer() {
  const filename = path.resolve('uniCloud-alipay/cloudfunctions/api_deepseek/index.js'), dir = path.dirname(filename), receipts = [], docs = new Map();
  const identity = { uid: 'isolated-health-owner', session: { secret: 'isolated-session-proof', version: 1 } };
  const collection = { doc: id => ({ get: async () => ({ data: docs.has(id) ? [docs.get(id)] : [] }) }),
    add: async r => { docs.set(r._id, structuredClone(r)); return {id:r._id}; }, where: where => ({ update: async patch => {
      const r = docs.get(where._id); if (!r || r.count >= where.count.lt) return { updated: 0 };
      r.count += patch.count.inc; return { updated: 1 };
    } }) };
  const cloud = { database: () => ({ command: { lt: n => ({ lt: n }), inc: n => ({ inc: n }) }, collection: () => collection }),
    httpclient: { request: async (url, options) => { receipts.push(JSON.parse(JSON.stringify(options.data)));
      return { status: 200, data: { choices: [{ message: { content: '这是本地隔离测试的替身响应。' } }] } };
    } } };
  const sandbox = { exports: {}, __dirname: dir, process: { env: {} }, Buffer, console: { info() {}, error() {} }, uniCloud: cloud,
    require: name => {
      if (name === 'pety-auth') return { verifyRequest: async event => { assert.equal(event.uniIdToken, 'isolated-health-token'); return identity; }, authErrorResult: error => ({ errCode: error.errCode || 'isolated-auth-error' }) };
      if (name === 'pety-auth/sessions') return { admit: async (uid, proof) => { assert.equal(uid, identity.uid); assert.deepEqual(proof, identity.session); return true; } };
      if (name === 'pety-auth/cost-budget') return { reserve: async input => { assert.equal(input.uid, identity.uid); assert.equal(input.feature, 'ai'); return { reserved: true }; } };
      if (name === 'fs') return { ...fs, existsSync: p => /config\.json$/.test(p) ? false : fs.existsSync(p) };
      if (name === 'uni-config-center') return options => ({ config: () => ({ ...options.defaultConfig, deepseek: { ...options.defaultConfig.deepseek, apiKey: 'local-test-only', baseUrl: 'https://local-test.invalid' } }) });
      return require(name.startsWith('.') ? path.resolve(dir, name) : name);
    } };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), sandbox, { filename });
  return { receipts, async request(data) {
    const count = receipts.length;
    const result = await sandbox.exports.main(JSON.parse(JSON.stringify({ ...data, uniIdToken: 'isolated-health-token', petySession: identity.session })), { CLIENTIP: '192.0.2.10' });
    if (receipts.length !== count + 1) throw Error('No provider boundary receipt: ' + JSON.stringify(result));
    return { result, payload: receipts.at(-1) };
  } };
}
module.exports = { localServer };
