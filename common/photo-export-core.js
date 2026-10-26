import { lifePhotos, hasCareContent } from './record-views.js';

export const PHOTO_EXPORT_LIMIT = 30;
export const PHOTO_EXPORT_MAX_BYTES = 64 * 1024 * 1024;
const failure = code => Object.assign(new Error(code), { code });
const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  return value >>> 0;
});
const fingerprint = (row, asset) => JSON.stringify([row.revision || row.updatedAt || row.createdAt || 0, asset.key, asset.path, asset.backend, asset.namespace, asset.petId]);
export function photoExportReference(row, asset) {
  return { key: row.id + ':' + asset.id, recordId: row.id, assetId: asset.id, fingerprint: fingerprint(row, asset) };
}
export function photoExportPlan(records, selected, scope, petId) {
  if (!scope?.ready || !scope.namespace || !petId || !selected.length || selected.length > PHOTO_EXPORT_LIMIT) throw failure('PHOTO_EXPORT_SELECTION_INVALID');
  if (new Set(selected.map(ref => ref.key)).size !== selected.length) throw failure('PHOTO_EXPORT_SELECTION_INVALID');
  return selected.map(ref => {
    const rows = records.filter(row => row.id === ref.recordId && row.namespace === scope.namespace && row.petId === petId && !row._group && !row.example && !row.generatedRecipe && !hasCareContent(row));
    if (rows.length !== 1) throw failure('PHOTO_EXPORT_SOURCE_CHANGED');
    const row = rows[0], assets = lifePhotos(row).filter(asset => asset.id === ref.assetId);
    if (assets.length !== 1 || ref.key !== row.id + ':' + assets[0].id || fingerprint(row, assets[0]) !== ref.fingerprint) throw failure('PHOTO_EXPORT_SOURCE_CHANGED');
    const precise = !row.eventTime || ['day', 'exact'].includes(row.eventTime.precision);
    const date = precise && /^\d{4}-\d{2}-\d{2}$/.test(row.localDate || '') ? row.localDate : 'date-unknown';
    return { ...ref, asset: { ...assets[0] }, date };
  });
}

// ZIP STORE preserves original image bytes. No recompression, metadata rewrite,
// upload, library download, or image-generation call is involved.
export function storedZip(files) {
  if (!files.length || files.length > PHOTO_EXPORT_LIMIT) throw failure('PHOTO_EXPORT_SELECTION_INVALID');
  const encoder = new TextEncoder(), names = new Set(); let size = 22, offset = 0;
  const entries = files.map(file => {
    if (!(file.bytes instanceof Uint8Array) || !file.bytes.length || !/^[a-zA-Z0-9_.-]+$/.test(file.name) || names.has(file.name)) throw failure('PHOTO_EXPORT_FILE_INVALID');
    names.add(file.name); const name = encoder.encode(file.name); size += 76 + name.length * 2 + file.bytes.length;
    if (size > PHOTO_EXPORT_MAX_BYTES) throw failure('PHOTO_EXPORT_SIZE_LIMIT');
    let crc = 0xffffffff; for (const byte of file.bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
    return { ...file, name, crc: (crc ^ 0xffffffff) >>> 0 };
  });
  const bytes = new Uint8Array(size), view = new DataView(bytes.buffer), u16 = (p, n) => view.setUint16(p, n, true), u32 = (p, n) => view.setUint32(p, n, true);
  for (const file of entries) {
    file.offset = offset; u32(offset, 0x04034b50); u16(offset + 4, 20); u16(offset + 6, 0x0800); u16(offset + 12, 33);
    u32(offset + 14, file.crc); u32(offset + 18, file.bytes.length); u32(offset + 22, file.bytes.length); u16(offset + 26, file.name.length);
    bytes.set(file.name, offset + 30); bytes.set(file.bytes, offset + 30 + file.name.length); offset += 30 + file.name.length + file.bytes.length;
  }
  const directoryOffset = offset;
  for (const file of entries) {
    u32(offset, 0x02014b50); u16(offset + 4, 20); u16(offset + 6, 20); u16(offset + 8, 0x0800); u16(offset + 14, 33);
    u32(offset + 16, file.crc); u32(offset + 20, file.bytes.length); u32(offset + 24, file.bytes.length); u16(offset + 28, file.name.length); u32(offset + 42, file.offset);
    bytes.set(file.name, offset + 46); offset += 46 + file.name.length;
  }
  u32(offset, 0x06054b50); u16(offset + 8, entries.length); u16(offset + 10, entries.length); u32(offset + 12, offset - directoryOffset); u32(offset + 16, directoryOffset);
  return bytes;
}

export async function runPhotoExport(items, adapter) {
  if (!items.length || items.length > PHOTO_EXPORT_LIMIT || !['archive', 'album'].includes(adapter.mode)) throw failure('PHOTO_EXPORT_SELECTION_INVALID');
  const results = items.map(item => ({ key: item.key, status: 'pending' })), files = []; let totalBytes = 0;
  const active = () => adapter.isCurrent() && !adapter.cancelled();
  const notify = index => adapter.progress?.({ index, total: items.length, saved: results.filter(r => r.status === 'saved').length });
  for (let index = 0; index < items.length; index++) {
    if (!active()) break;
    const item = items[index]; let photo;
    try {
      adapter.sourceCurrent(item); notify(index + 1);
      photo = await adapter.resolve(item.asset);
      if (!active()) break;
      adapter.sourceCurrent(item);
      if (adapter.mode === 'archive') {
        const file = await adapter.readBytes(photo.path);
        if (!active()) break;
        adapter.sourceCurrent(item); totalBytes += file.bytes.length;
        if (totalBytes > PHOTO_EXPORT_MAX_BYTES) throw failure('PHOTO_EXPORT_SIZE_LIMIT');
        if (!['png', 'jpg', 'webp', 'gif'].includes(file.extension)) throw failure('PHOTO_EXPORT_FORMAT_UNSUPPORTED');
        files.push({ name: item.date + '_' + String(index + 1).padStart(3, '0') + '.' + file.extension, bytes: file.bytes, key: item.key });
        results[index].status = 'prepared';
      } else {
        try { await adapter.saveToAlbum(photo.path); }
        catch (_) { results[index] = { key: item.key, status: 'failed', errorCode: 'PHOTO_EXPORT_ALBUM_FAILED' }; break; }
        results[index].status = 'saved'; notify(index + 1);
      }
    } catch (error) {
      results[index] = { key: item.key, status: 'failed', errorCode: error.code === 'PHOTO_EXPORT_SIZE_LIMIT' ? error.code : 'PHOTO_EXPORT_SOURCE_UNAVAILABLE' };
      if (error.code === 'PHOTO_EXPORT_SIZE_LIMIT') { files.length = 0; break; }
    } finally { if (photo?.path) { try { adapter.release(photo.path); } catch (_) {} } }
  }
  if (adapter.mode === 'archive' && files.length && active()) {
    try {
      files.forEach(file => adapter.sourceCurrent(items.find(item => item.key === file.key)));
      const archive = storedZip(files);
      await adapter.beforeDownload?.();
      if (!active()) throw failure('PHOTO_EXPORT_CANCELLED');
      files.forEach(file => adapter.sourceCurrent(items.find(item => item.key === file.key)));
      await adapter.downloadArchive(archive);
      for (const result of results) if (result.status === 'prepared') result.status = 'download-started';
    } catch (error) {
      for (const result of results) if (result.status === 'prepared') { result.status = 'failed'; result.errorCode = error.code === 'PHOTO_EXPORT_SIZE_LIMIT' ? error.code : 'PHOTO_EXPORT_DOWNLOAD_FAILED'; }
    }
  }
  for (const result of results) if (result.status === 'prepared') result.status = 'pending';
  return { mode: adapter.mode, results, cancelled: !active() };
}
