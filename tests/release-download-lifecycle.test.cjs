'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createDownloader } = require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/safe-download');
const base = 'https://dashscope-result-bj.oss-cn-beijing.aliyuncs.com';
const publicAddress = [{ address: '8.8.8.8', family: 4 }];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function transport(rows) {
  const requests = [], responses = [];
  function get(url, options, callback) {
    const request = new EventEmitter();
    request.destroyed = false;
    request.destroy = () => { request.destroyed = true; };
    requests.push(request);
    const row = rows[requests.length - 1];
    queueMicrotask(() => {
      const response = new EventEmitter();
      response.statusCode = row.status || 200;
      response.headers = { 'content-type': 'image/png', ...row.headers };
      response.destroyed = false;
      response.resumed = false;
      response.destroy = () => { response.destroyed = true; };
      response.resume = () => { response.resumed = true; };
      responses.push(response);
      callback(response);
      if (row.end) setTimeout(() => {
        if (response.destroyed || request.destroyed) return;
        response.emit('data', Buffer.from('isolated-image'));
        response.emit('end');
      }, row.end);
    });
    return request;
  }
  return { get, requests, responses };
}

test('error and rejected redirect responses are closed without draining arbitrary bodies', async () => {
  for (const row of [{ status: 500 }, { status: 302, headers: { location: 'http://127.0.0.1/private' } }, { status: 302 }]) {
    const io = transport([row]);
    const download = createDownloader({ lookup: async () => publicAddress, get: io.get });
    await assert.rejects(download(base + '/image'));
    assert.equal(io.responses[0].resumed, false, 'rejected body must not be consumed');
    assert.equal(io.responses[0].destroyed, true, 'rejected body must close immediately');
    assert.equal(io.requests[0].destroyed, true, 'failed socket must be stopped');
  }
});

test('one deadline covers both DNS and response streaming', async () => {
  const io = transport([{ end: 80 }]);
  const download = createDownloader({ lookup: async () => { await sleep(80); return publicAddress; }, get: io.get, timeoutMs: 120 });
  await assert.rejects(download(base + '/image'), error => error.code === 'RESULT_DOWNLOAD_TIMEOUT');
  assert.equal(io.requests[0].destroyed, true);
  assert.equal(io.responses[0].destroyed, true);
});

test('redirect body closes and the active child request is cancelled when the original deadline expires', async () => {
  const io = transport([{ status: 302, headers: { location: '/next' } }, {}]);
  const download = createDownloader({ lookup: async () => publicAddress, get: io.get, timeoutMs: 40 });
  await assert.rejects(download(base + '/image'), error => error.code === 'RESULT_DOWNLOAD_TIMEOUT');
  assert.equal(io.requests.length, 2);
  assert.equal(io.responses[0].resumed, false);
  assert.equal(io.responses[0].destroyed, true);
  assert.equal(io.requests[1].destroyed, true, 'child socket cannot outlive the failed download');
  assert.equal(io.responses[1].destroyed, true);
});

test('a DNS lookup resolving after timeout cannot start a late network request', async () => {
  let resolveLookup;
  const pending = new Promise(resolve => { resolveLookup = resolve; });
  const io = transport([{}]);
  const download = createDownloader({ lookup: () => pending, get: io.get, timeoutMs: 20 });
  await assert.rejects(download(base + '/image'), error => error.code === 'RESULT_DOWNLOAD_TIMEOUT');
  resolveLookup(publicAddress);
  await sleep(5);
  assert.equal(io.requests.length, 0);
});

test('normal same-host redirect keeps the exact successful image bytes', async () => {
  const io = transport([{ status: 302, headers: { location: '/next' } }, { end: 1 }]);
  const download = createDownloader({ lookup: async () => publicAddress, get: io.get });
  assert.deepEqual(await download(base + '/image'), Buffer.from('isolated-image'));
  assert.equal(io.responses[0].resumed, false);
  assert.equal(io.responses[0].destroyed, true);
});

test('actual loopback HTTP sockets stop rejected and redirect bodies while the final image remains intact', async () => {
  const http = require('node:http');
  const events = [];
  const server = http.createServer((request, response) => {
    if (request.url === '/image') {
      response.writeHead(200, { 'content-type': 'image/png' });
      response.end(Buffer.from('isolated-image'));
      return;
    }
    const event = { path: request.url, closed: false, chunks: 0 };
    events.push(event);
    response.writeHead(request.url === '/redirect' ? 302 : 500, {
      'content-type': 'image/png', location: '/image'
    });
    response.flushHeaders();
    // An unbounded fixture body makes socket cancellation observable. Bytes
    // stay on loopback; this is not a provider, CDN or TLS integration test.
    const interval = setInterval(() => { event.chunks++; response.write(Buffer.alloc(64)); }, 5);
    response.on('close', () => { event.closed = true; clearInterval(interval); });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const download = createDownloader({
      lookup: async () => publicAddress,
      get: (url, options, callback) => http.get({ host: '127.0.0.1', port: server.address().port, path: url.pathname, agent: false }, callback),
      timeoutMs: 500
    });
    await assert.rejects(download(base + '/error'), error => error.code === 'RESULT_DOWNLOAD_FAILED');
    assert.deepEqual(await download(base + '/redirect'), Buffer.from('isolated-image'));
    for (let attempt = 0; attempt < 30 && events.some(event => !event.closed); attempt++) await sleep(5);
    assert.equal(events.length, 2);
    assert.ok(events.every(event => event.closed), 'both unwanted sockets close, rather than drain the endless bodies');
    const counts = events.map(event => event.chunks);
    await sleep(15);
    assert.deepEqual(events.map(event => event.chunks), counts, 'no further body writes after cancellation');
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
