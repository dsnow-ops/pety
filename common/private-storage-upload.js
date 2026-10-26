// Detached transport preparation. Current upload pages do not import this file.
// Never persist formData/signatures. Receipts, scope leases and the existing
// cache remain the caller's responsibility.
const privateUploadError = code => Object.assign(new Error(code), { code });

// Future resolver bridge uses this absolute deadline, retaining the existing
// Expires behavior for legacy URLs. Current resolver is intentionally unchanged.
export function privateStorageUrlExpiresAt(value) {
  try {
    const query = new URL(value).searchParams;
    const legacy = Number(query.get('Expires') || query.get('expires'));
    if (Number.isFinite(legacy) && legacy > 0) return legacy * 1000;
    const date = (query.get('x-oss-date') || '').match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
    const seconds = Number(query.get('x-oss-expires'));
    if (!date || !Number.isInteger(seconds) || seconds <= 0) return null;
    const start = Date.parse(`${date[1]}-${date[2]}-${date[3]}T${date[4]}:${date[5]}:${date[6]}Z`);
    return Number.isFinite(start) ? start + seconds * 1000 : null;
  } catch (_) { return null; }
}

export async function uploadPrivateStorageFile(grant, filePath, { uploadFile, assertCurrent, now = Date.now, onProgress } = {}) {
  if (typeof uploadFile !== 'function' || typeof assertCurrent !== 'function') throw privateUploadError('PRIVATE_UPLOAD_RUNTIME_REQUIRED');
  assertCurrent();
  const fields = grant?.formData;
  let url;
  try { url = new URL(grant?.url); } catch (_) { throw privateUploadError('PRIVATE_UPLOAD_GRANT_INVALID'); }
  if (grant?.version !== 1 || grant.transport !== 'oss-post-v4' || grant.method !== 'POST' || grant.name !== 'file' ||
      typeof filePath !== 'string' || !filePath || !Number.isSafeInteger(grant.maxBytes) || grant.maxBytes < 1 || grant.maxBytes > 20 * 1024 * 1024 ||
      !grant.ticketId || !/^pety-private:\/\/oss\/[a-f0-9]{48}$/.test(grant.fileId || '') ||
      url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash ||
      !/^[a-z0-9-]+\.oss-[a-z0-9-]+\.aliyuncs\.com$/.test(url.hostname) ||
      fields?.['x-oss-object-acl'] !== 'private' || fields?.['x-oss-forbid-overwrite'] !== 'true' ||
      fields?.['x-oss-signature-version'] !== 'OSS4-HMAC-SHA256' || !fields?.policy ||
      !/^[a-f0-9]{64}$/.test(fields?.['x-oss-signature'] || '') || fields?.success_action_status !== '204' ||
      !['image/png', 'image/jpeg'].includes(fields?.['x-oss-content-type']) ||
      !Number.isSafeInteger(grant.expiresAt) || grant.expiresAt <= now()) throw privateUploadError('PRIVATE_UPLOAD_GRANT_INVALID');
  const response = await new Promise((resolve, reject) => {
    const task = uploadFile({ url: grant.url, filePath, name: 'file', formData: { ...fields },
      success: resolve, fail: () => reject(privateUploadError('PRIVATE_UPLOAD_TRANSPORT_FAILED')) });
    if (typeof task?.onProgressUpdate === 'function') task.onProgressUpdate(progress => {
      try { assertCurrent(); if (typeof onProgress === 'function') onProgress(progress); }
      catch (_) { task.abort?.(); }
    });
  });
  assertCurrent();
  if (Number(response?.statusCode) !== 204) throw privateUploadError('PRIVATE_UPLOAD_TRANSPORT_FAILED');
  // Ignore Location/url/body. Storage success is not a completed business receipt.
  return { ticketId: grant.ticketId, fileId: grant.fileId, requiresCompletion: true };
}
