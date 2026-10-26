import { resolveNarrativePhoto, releaseNarrativePhoto } from './narrative-media.js';
import { runPhotoExport } from './photo-export-core.js';

export function photoExportDestination() {
  // #ifdef H5
  return '浏览器下载';
  // #endif
  // #ifndef H5
  return '系统相册';
  // #endif
}
export async function exportLifePhotos(items, { scope, petId, isCurrent, sourceCurrent, cancelled, progress }) {
  const adapter = { isCurrent, sourceCurrent, cancelled, progress, resolve: asset => {
    // #ifdef H5
    if (asset.backend !== 'indexeddb' || asset.key !== `${scope.namespace}:${petId}:${asset.id}`) throw new Error('PHOTO_EXPORT_LOCAL_SOURCE_REQUIRED');
    // #endif
    // #ifndef H5
    if (asset.backend !== 'sandbox' || typeof asset.path !== 'string' || !asset.path || /^(?:https?:|data:|blob:|cloud:|unicloud:|\/\/)/i.test(asset.path)) throw new Error('PHOTO_EXPORT_LOCAL_SOURCE_REQUIRED');
    // #endif
    return resolveNarrativePhoto(asset, scope, petId);
  }, release: releaseNarrativePhoto };
  // #ifdef H5
  adapter.mode = 'archive';
  adapter.beforeDownload = () => new Promise(resolve => setTimeout(resolve, 0));
  adapter.readBytes = async path => {
    // resolveNarrativePhoto returns a fresh blob from this owner's IndexedDB.
    // Never download a remote URL as an export fallback.
    if (!path.startsWith('blob:')) throw new Error('PHOTO_EXPORT_LOCAL_SOURCE_REQUIRED');
    const response = await fetch(path); if (!response.ok) throw new Error('PHOTO_EXPORT_SOURCE_UNAVAILABLE');
    const blob = await response.blob();
    const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' }[blob.type];
    return { bytes: new Uint8Array(await blob.arrayBuffer()), extension };
  };
  adapter.downloadArchive = async bytes => {
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
    try {
      const a = document.createElement('a'); a.href = url; a.download = 'guizhua-photos-' + Date.now() + '.zip';
      document.body.appendChild(a); try { a.click(); } finally { a.remove(); }
    } finally { setTimeout(() => URL.revokeObjectURL(url), 30000); }
  };
  // #endif
  // #ifndef H5
  adapter.mode = 'album';
  adapter.saveToAlbum = path => new Promise((success, fail) => uni.saveImageToPhotosAlbum({ filePath: path, success, fail }));
  // #endif
  return runPhotoExport(items, adapter);
}
