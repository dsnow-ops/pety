// App-only adapter. No provider calls, image conversion, or business-data deletion.
// See uni.saveFile and HTML5+ FileEntry.moveTo: both may change the input path.
const INDEX_KEY = 'pety_avatar_file_cache_v1';
const DIRECTORY = '_doc/pety-avatar-cache-v1/';
const error = code => Object.assign(new Error(code), { code });
const callback = fn => new Promise((resolve, reject) => fn(resolve, reject));

export function createNativeAvatarCacheAdapter({ uni, plus, namespace, ownerVersion, maxFileBytes = 32 * 1024 * 1024 }) {
  if (!plus?.io || !uni?.downloadFile || !uni?.saveFile) throw error('NATIVE_CACHE_UNAVAILABLE');
  const temporary = new Set(), intermediates = new Set();
  const canonical = p => String(p || '').replace(/^file:\/\//, '').replace(/\/$/, '');
  const absoluteRoot = canonical(plus.io.convertLocalFileSystemURL(DIRECTORY));
  let directory;
  const entry = path => callback((ok, fail) => plus.io.resolveLocalFileSystemURL(path, ok, fail));
  const isCachePath = path => {
    if (typeof path !== 'string' || /[?#\\]/.test(path) || path.split('/').includes('..')) return false;
    const normalized = canonical(path);
    const prefix = path.startsWith(DIRECTORY) ? DIRECTORY.slice(0, -1) : absoluteRoot;
    if (!prefix || !normalized.startsWith(prefix + '/')) return false;
    return /^[a-z0-9-]+\.(png|jpeg|webp)$/.test(normalized.slice(prefix.length + 1));
  };
  async function cacheDirectory() {
    if (!directory) directory = entry('_doc/').then(root => callback((ok, fail) => root.getDirectory('pety-avatar-cache-v1', { create: true }, ok, fail)))
      .catch(e => { directory = null; throw e; });
    return directory;
  }
  async function remove(path) {
    if (!isCachePath(path)) throw error('CACHE_DELETE_OUTSIDE_OWNED_DIRECTORY');
    const file = await entry(path); await callback((ok, fail) => file.remove(ok, fail));
  }
  async function removeTemporary(path) {
    if (!temporary.has(path) && !intermediates.has(path)) return;
    const file = await entry(path); await callback((ok, fail) => file.remove(ok, fail));
    temporary.delete(path); intermediates.delete(path);
  }
  async function cacheEntries() {
    const reader = (await cacheDirectory()).createReader();
    const entries = new Map();
    for (;;) {
      const batch = await callback((ok, fail) => reader.readEntries(ok, fail));
      let added = 0;
      for (const file of batch) {
        const path = file.toLocalURL();
        if (!entries.has(path)) { entries.set(path, file); added++; }
      }
      if (entries.size > 10000) throw error('CACHE_DIRECTORY_LIMIT');
      // HTML5+ Android returns the same directory snapshot on every call.
      // Other adapters may paginate. Stop on an empty or repeated batch.
      if (!added) return [...entries.values()];
    }
  }
  async function cacheFileExists(path) {
    const name = path.slice(path.lastIndexOf('/') + 1);
    return (await cacheEntries()).some(file => file.isFile && file.toLocalURL().split('/').pop() === name);
  }
  return {
    namespace, ownerVersion, isCachePath,
    toDisplayPath(path) {
      if (!isCachePath(path)) throw error('CACHE_DISPLAY_OUTSIDE_OWNED_DIRECTORY');
      // Both uni-image and CSS texture extensions must resolve the same file.
      // WebView CSS cannot resolve the virtual _doc/ prefix on its own.
      const absolute = canonical(plus.io.convertLocalFileSystemURL(path));
      if (!isCachePath(absolute)) throw error('CACHE_DISPLAY_PATH_INVALID');
      return 'file://' + absolute;
    },
    cachePathKey: path => isCachePath(path) ? String(path).slice(String(path).lastIndexOf('/') + 1) : '',
    async listOwnedFiles() {
      const files = [];
      // Read only this directory; never recurse into subdirectories.
      for (const file of await cacheEntries()) {
          const path = file.toLocalURL();
          if (!file.isFile || !isCachePath(path)) continue;
          const info = await callback((success, fail) => uni.getFileInfo({ filePath: path, success, fail }));
          files.push({ path, bytes: Number(info.size) });
      }
      return files;
    },
    readIndex: () => uni.getStorageSync(INDEX_KEY),
    writeIndex: value => uni.setStorageSync(INDEX_KEY, value),
    async inspect(path) {
      if (!isCachePath(path) && !temporary.has(path)) throw error('CACHE_INSPECT_OUTSIDE_OWNED_FILES');
      const file = await callback((success, fail) => uni.getFileInfo({ filePath: path, success, fail })).catch(async original => {
          // Do not infer deletion from a transient platform error code. Only a
          // completed enumeration of our own directory proves absence.
          if (isCachePath(path) && !(await cacheFileExists(path))) throw error('ASSET_FILE_MISSING');
          throw original;
        });
      const image = await callback((success, fail) => uni.getImageInfo({ src: path, success, fail }));
      const format = String(image.type || '').toLowerCase().replace('jpg', 'jpeg');
      return { bytes: Number(file.size), width: Number(image.width), height: Number(image.height), format, readable: true };
    },
    download(url, progress) {
      return new Promise((resolve, reject) => {
        let tooLarge = false;
        const task = uni.downloadFile({ url, timeout: 25000,
          success: async result => {
            const path = result.tempFilePath;
            if (typeof path !== 'string' || !path) { reject(error('CACHE_DOWNLOAD_PATH_MISSING')); return; }
            temporary.add(path);
            if (tooLarge) { await removeTemporary(path).catch(() => {}); reject(error('CACHE_DOWNLOAD_TOO_LARGE')); return; }
            resolve({ path, statusCode: result.statusCode });
          },
          fail: () => reject(error(tooLarge ? 'CACHE_DOWNLOAD_TOO_LARGE' : 'CACHE_DOWNLOAD_FAILED'))
        });
        task?.onProgressUpdate?.(event => {
          progress(Number(event.totalBytesWritten) || 0);
          if (Number(event.totalBytesWritten) > maxFileBytes || Number(event.totalBytesExpectedToWrite) > maxFileBytes) {
            tooLarge = true; task.abort();
          }
        });
      });
    },
    async persist(path, format) {
      if (!temporary.has(path) || !['png', 'jpeg', 'webp'].includes(format)) throw error('CACHE_PERSIST_INPUT_INVALID');
      const saved = await callback((success, fail) => uni.saveFile({ tempFilePath: path, success, fail }));
      if (!saved.savedFilePath || saved.savedFilePath === path) throw error('CACHE_PERSIST_PATH_UNCONFIRMED');
      temporary.delete(path); intermediates.add(saved.savedFilePath);
      try {
        const [file, folder] = await Promise.all([entry(saved.savedFilePath), cacheDirectory()]);
        const name = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}.${format}`;
        const moved = await callback((ok, fail) => file.moveTo(folder, name, ok, fail));
        const finalPath = moved.toLocalURL();
        intermediates.delete(saved.savedFilePath);
        if (!isCachePath(finalPath)) throw error('CACHE_PERSIST_PATH_INVALID');
        return finalPath;
      } catch (e) { await removeTemporary(saved.savedFilePath).catch(() => {}); throw e; }
    },
    remove, removeTemporary
  };
}
