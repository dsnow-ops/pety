'use strict';
// Actual cache and native-adapter code; isolated Node filesystem/uni/plus bridge.
// The bridge translates only the synthetic HTTPS host to a loopback HTTP server.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const evidence = path.join(root, 'unpackage/release-sprint-20261010', `cache-io-${stamp}-${crypto.randomBytes(3).toString('hex')}`);
fs.mkdirSync(evidence, { recursive: true });
const disk = path.join(evidence, 'isolated-app-doc');
const sources = path.join(evidence, 'synthetic-test-data');
const backup = path.join(evidence, 'test-backup');
for (const folder of [disk, sources, backup]) fs.mkdirSync(folder);
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const slash = value => value.replace(/\\/g, '/');
const events = [];
const report = {
  status: 'RUNNING', startedAt: new Date().toISOString(), evidenceDirectory: evidence,
  verification: '真实本地 HTTP 正文计数、磁盘存取和备份恢复；运行生产缓存与原生适配器，uni/plus 由隔离 Node 桥模拟。',
  limitations: '不是手机安装包、WebView 图片显示或真实云存储验证；没有外部业务调用。',
  externalBusinessCalls: 0, loopback: {}, stages: [], sourceHashes: {}, backupRestore: []
};
function record(stage, detail) {
  const item = { stage, ...detail };
  report.stages.push(item); events.push(JSON.stringify(item));
  console.log(JSON.stringify(item));
}
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const tag = Buffer.from(type), size = Buffer.alloc(4), crc = Buffer.alloc(4);
  size.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([tag, data])));
  return Buffer.concat([size, tag, data, crc]);
}
function png(rgba) {
  const width = 8, height = 8, header = Buffer.alloc(13), raw = Buffer.alloc(height * (1 + width * 4));
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    for (let i = 0; i < 4; i++) raw[y * (1 + width * 4) + 1 + x * 4 + i] = rgba[i];
  }
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
// Independently validate the generated PNG chunks and decode its raw RGBA rows.
function inspectPng(bytes) {
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  let width, height, ended = false, offset = 8; const idat = [];
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset), tag = bytes.subarray(offset + 4, offset + 8), data = bytes.subarray(offset + 8, offset + 8 + length);
    assert.ok(offset + 12 + length <= bytes.length);
    assert.equal(bytes.readUInt32BE(offset + 8 + length), crc32(Buffer.concat([tag, data])));
    if (tag.toString() === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      assert.deepEqual(Array.from(data.subarray(8)), [8, 6, 0, 0, 0]);
    } else if (tag.toString() === 'IDAT') idat.push(data);
    else if (tag.toString() === 'IEND') ended = true;
    offset += 12 + length;
  }
  assert.equal(ended, true); assert.equal(offset, bytes.length);
  const raw = zlib.inflateSync(Buffer.concat(idat)); assert.equal(raw.length, height * (1 + width * 4));
  for (let y = 0; y < height; y++) assert.equal(raw[y * (1 + width * 4)], 0);
  return { width, height, type: 'png' };
}
function loadExports(relative, exports) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  report.sourceHashes[relative] = sha(source);
  return Function(source.replace(/export /g, '') + `\nreturn {${exports.join(',')}};`)();
}

let server, serverClosed = false;
const io = { reads: 0, writes: 0, renames: 0, removes: 0, indexReads: 0, indexWrites: 0, downloads: 0 };
let owner = 'account:synthetic-A', version = 1, port;
function inside(file) {
  const absolute = path.resolve(file), relative = path.relative(evidence, absolute);
  assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative), 'filesystem bridge may access only this run directory');
  return absolute;
}
function physical(value) {
  const name = String(value).replace(/^file:\/\//, '');
  return inside(name.startsWith('_doc/') ? path.join(disk, name.slice(5)) : name);
}
function read(file) { io.reads++; return fs.readFileSync(inside(file)); }
function write(file, bytes) { io.writes++; fs.writeFileSync(inside(file), bytes); }
function move(from, to) { io.renames++; fs.renameSync(inside(from), inside(to)); }
function entry(file) {
  const absolute = physical(file), stat = fs.statSync(absolute);
  return {
    isFile: stat.isFile(), toLocalURL: () => slash(absolute),
    getDirectory(name, options, success, fail) {
      try { const folder = inside(path.join(absolute, name)); if (options.create) fs.mkdirSync(folder, { recursive: true }); success(entry(folder)); } catch (error) { fail(error); }
    },
    createReader() {
      let reads = 0;
      return { readEntries(success, fail) { try {
        assert.ok(++reads <= 3, 'native repeated snapshots must terminate');
        success(fs.readdirSync(absolute).map(name => entry(path.join(absolute, name))));
      } catch (error) { fail(error); } } };
    },
    moveTo(folder, name, success, fail) {
      try { const destination = path.join(physical(folder.toLocalURL()), name); move(absolute, destination); success(entry(destination)); } catch (error) { fail(error); }
    },
    remove(success, fail) { try { assert.equal(stat.isFile(), true); io.removes++; fs.unlinkSync(inside(absolute)); success(); } catch (error) { fail(error); } }
  };
}
const indexPath = path.join(evidence, 'native-storage-index.json');
const uni = {
  getStorageSync(key) {
    assert.equal(key, 'pety_avatar_file_cache_v1'); io.indexReads++;
    return fs.existsSync(indexPath) ? JSON.parse(read(indexPath)) : undefined;
  },
  setStorageSync(key, value) { assert.equal(key, 'pety_avatar_file_cache_v1'); io.indexWrites++; write(indexPath, JSON.stringify(value, null, 2)); },
  getFileInfo({ filePath, success, fail }) { try { success({ size: fs.statSync(physical(filePath)).size }); } catch (error) { fail(error); } },
  getImageInfo({ src, success, fail }) { try { success(inspectPng(read(physical(src)))); } catch (error) { fail(error); } },
  saveFile({ tempFilePath, success, fail }) {
    try { const saved = path.join(disk, `saved-${crypto.randomBytes(6).toString('hex')}.png`); move(physical(tempFilePath), saved); success({ savedFilePath: slash(saved) }); } catch (error) { fail(error); }
  },
  downloadFile({ url, success, fail }) {
    const transport = new URL(url);
    assert.equal(transport.protocol, 'https:'); assert.equal(transport.hostname, 'cache-io.invalid');
    assert.ok(['/pet-one.png', '/pet-two.png'].includes(transport.pathname)); io.downloads++;
    let progress, received = 0;
    const request = http.get({ hostname: '127.0.0.1', port, path: transport.pathname + transport.search, timeout: 3000 }, response => {
      const body = []; response.on('data', bytes => { body.push(bytes); received += bytes.length; progress?.({ totalBytesWritten: received, totalBytesExpectedToWrite: Number(response.headers['content-length']) }); });
      response.on('end', () => {
        try { const temporary = path.join(disk, `download-${crypto.randomBytes(6).toString('hex')}.png`); write(temporary, Buffer.concat(body)); success({ tempFilePath: slash(temporary), statusCode: response.statusCode }); } catch (error) { fail(error); }
      }); response.on('error', fail);
    });
    request.on('error', fail); request.on('timeout', () => request.destroy(new Error('isolated download timeout')));
    return { onProgressUpdate(fn) { progress = fn; }, abort() { request.destroy(new Error('isolated download aborted')); } };
  }
};
const plus = { io: {
  convertLocalFileSystemURL: value => slash(physical(value)),
  resolveLocalFileSystemURL(value, success, fail) { try { success(entry(value)); } catch (error) { fail(error); } }
} };

async function run() {
  const { createAvatarFileCache } = loadExports('common/avatar-file-cache.js', ['createAvatarFileCache']);
  const { createNativeAvatarCacheAdapter } = loadExports('common/avatar-file-cache-native.js', ['createNativeAvatarCacheAdapter']);
  const images = { '/pet-one.png': png([44, 100, 120, 255]), '/pet-two.png': png([190, 80, 40, 255]) };
  for (const [route, bytes] of Object.entries(images)) { inspectPng(bytes); write(path.join(sources, route.slice(1)), bytes); }
  write(path.join(sources, 'synthetic-draft.json'), JSON.stringify({ owner: 'synthetic-A', pets: ['synthetic-pet-one', 'synthetic-pet-two'], note: 'isolated test draft' }));
  for (const name of fs.readdirSync(sources)) {
    const original = path.join(sources, name), saved = path.join(backup, name), before = sha(read(original));
    fs.copyFileSync(original, saved); write(original, Buffer.from('intentional isolated test modification')); fs.copyFileSync(saved, original);
    const after = sha(read(original)); assert.equal(after, before); assert.equal(sha(read(saved)), before);
    report.backupRestore.push({ testFile: name, originalSha256: before, backupSha256: sha(read(saved)), restoredSha256: after, match: true });
  }
  record('test-backup-and-restore', { files: report.backupRestore.length, sha256Matches: true, realUserFilesRead: 0 });
  const traffic = { requests: 0, completedBodies: 0, completedBodyBytes: 0, paths: {} };
  server = http.createServer((request, response) => {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    assert.ok(Object.hasOwn(images, pathname)); traffic.requests++; traffic.paths[pathname] = (traffic.paths[pathname] || 0) + 1;
    const body = read(path.join(sources, pathname.slice(1)));
    response.writeHead(200, { 'content-type': 'image/png', 'content-length': body.length });
    response.on('finish', () => { traffic.completedBodies++; traffic.completedBodyBytes += body.length; }); response.end(body);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); port = server.address().port;
  report.loopback = { address: '127.0.0.1', port, adapterHttpsHost: 'cache-io.invalid', transport: 'HTTPS synthetic URL is mapped to this HTTP loopback endpoint only' };
  const fresh = () => createAvatarFileCache(createNativeAvatarCacheAdapter({ uni, plus, namespace: () => owner, ownerVersion: () => version }));
  let cache = fresh(), urlRevision = 1, urlLookups = 0;
  const assets = [1, 2].map(number => ({ namespace: owner, petId: `synthetic-pet-${number}`, masterId: `synthetic-master-${number}`, fileId: `cloud://synthetic-space/owner-A/master-${number}.png`, purpose: 'master', expectedWidth: 8, expectedHeight: 8 }));
  const url = number => async () => { urlLookups++; return `https://cache-io.invalid/pet-${number === 1 ? 'one' : 'two'}.png?synthetic-signature=${urlRevision}`; };
  const verify = (result, number, hit) => {
    assert.equal(result.cacheHit, hit); assert.equal(result.width, 8); assert.equal(result.height, 8);
    const bytes = read(physical(result.localPath)); assert.equal(sha(bytes), sha(images[number === 1 ? '/pet-one.png' : '/pet-two.png'])); return result.localPath;
  };
  const firstPath = verify(await cache.acquire(assets[0], url(1)), 1, false);
  verify(await cache.acquire(assets[1], url(2)), 2, false);
  const coldBytes = Object.values(images).reduce((sum, bytes) => sum + bytes.length, 0);
  assert.equal(traffic.requests, 2); assert.equal(traffic.completedBodies, 2); assert.equal(traffic.completedBodyBytes, coldBytes);
  record('cold-cache', { ...traffic, urlLookups, diagnostics: cache.diagnostics() });
  for (let cycle = 0; cycle < 20; cycle++) {
    verify(await cache.acquire(assets[1], url(2)), 2, true);
    assert.equal(verify(await cache.acquire(assets[0], url(1)), 1, true), firstPath);
  }
  assert.equal(traffic.requests, 2); assert.equal(urlLookups, 2);
  record('20-pet-switch-return-cycles', { cacheAcquisitions: 40, additionalImageRequests: 0, additionalBodyBytes: 0, diagnostics: cache.diagnostics() });
  urlRevision++;
  verify(await cache.acquire(assets[0], url(1)), 1, true); assert.equal(urlLookups, 2); assert.equal(traffic.requests, 2);
  assert.ok(!read(indexPath).toString().includes('synthetic-signature')); assert.ok(!read(indexPath).toString().includes('https://'));
  record('changed-signed-url', { additionalImageRequests: 0, signedUrlResolverNotCalledForValidBytes: true, signedUrlsPersisted: false });
  cache = fresh(); verify(await cache.acquire(assets[0], url(1)), 1, true); verify(await cache.acquire(assets[1], url(2)), 2, true);
  assert.equal(traffic.requests, 2); assert.equal(urlLookups, 2);
  record('new-cache-and-native-adapter-instance', { indexLoadedFromDisk: true, additionalImageRequests: 0, diagnostics: cache.diagnostics() });
  await new Promise(resolve => server.close(resolve)); serverClosed = true;
  const noTransport = async () => { throw new Error('offline cached read must not request a URL'); };
  cache = fresh(); verify(await cache.acquire(assets[0], noTransport), 1, true); verify(await cache.acquire(assets[1], noTransport), 2, true);
  assert.equal(io.downloads, 2); assert.equal(traffic.requests, 2);
  record('offline-server-closed-and-cache-restarted', { cachedImagesReadable: 2, networkBodyRequests: 0, diagnostics: cache.diagnostics() });
  owner = 'account:synthetic-B'; version++;
  await assert.rejects(cache.acquire(assets[0], noTransport), error => error.code === 'ASSET_OWNER_CHANGED');
  assert.equal(cache.peek(assets[0]), null);
  const ownB = { ...assets[0], namespace: owner, fileId: 'cloud://synthetic-space/owner-B/master-1.png' };
  assert.equal(cache.peek(ownB), null); assert.equal(cache.diagnostics().entries, 0); assert.equal(io.downloads, 2);
  record('account-A-to-B-isolation', { previousOwnerReadError: 'ASSET_OWNER_CHANGED', previousOwnerPeek: null, newOwnerCacheEntries: 0, additionalImageRequests: 0 });
  owner = 'account:synthetic-A'; version++; verify(await cache.acquire(assets[0], noTransport), 1, true);
  assert.equal(io.downloads, 2);
  record('return-to-account-A-offline', { originalBytesPreserved: true, additionalImageRequests: 0 });
  report.status = 'PASS'; report.traffic = traffic; report.diskIO = io; report.finalDiagnostics = cache.diagnostics();
  report.expectedColdBodyBytes = coldBytes;
}
run().catch(error => { report.status = 'FAIL'; report.failure = { name: error.name, code: error.code, message: error.message, stack: error.stack }; process.exitCode = 1; })
  .finally(async () => {
    if (server && !serverClosed) await new Promise(resolve => server.close(resolve));
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(evidence, 'cache-io-report.json'), JSON.stringify(report, null, 2));
    fs.writeFileSync(path.join(evidence, 'cache-io-events.log'), events.join('\n') + '\n' + JSON.stringify({ status: report.status, failure: report.failure }) + '\n');
    console.log(JSON.stringify({ status: report.status, report: path.join(evidence, 'cache-io-report.json'), preservedTestDirectory: evidence }));
  });
