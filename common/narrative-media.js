import { assertManagedPetMedia } from './pet-removal.js';
import { narrativeId } from './narrative-store.js';
import { assertDataScope, scopedStorage } from './scoped-storage.js';

const imageInfo = src => new Promise((resolve, reject) => uni.getImageInfo({ src, success: resolve, fail: reject }));
function database() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('pety_private_creative_media_v1', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('photos');
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  });
}
async function binary(key, value) {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('photos', value === undefined ? 'readonly' : 'readwrite');
      const req = value === undefined ? tx.objectStore('photos').get(key) : value === null ? tx.objectStore('photos').delete(key) : tx.objectStore('photos').put(value, key);
      tx.oncomplete = () => resolve(req.result); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || new Error('MEDIA_STORAGE_FAILED'));
    });
  } finally { db.close(); }
}
export async function persistNarrativePhoto(path, scope, petId) {
  assertDataScope(scope);
  const id = narrativeId(), key = `${scope.namespace}:${petId}:${id}`;
  const info = await imageInfo(path); assertDataScope(scope);
  let durablePath = '', backend = '';
  // H5 stores the actual bytes, never a blob URL. No upload, no shared LRU.
  // #ifdef H5
  const response = await fetch(path); if (!response.ok) throw new Error('MEDIA_SOURCE_FAILED');
  const blob = await response.blob(); assertDataScope(scope);
  if (!blob.size || blob.size > 32 * 1024 * 1024 || !blob.type.startsWith('image/')) throw new Error('MEDIA_SIZE_OR_TYPE');
  await binary(key, blob); backend = 'indexeddb';
  // #endif
  // #ifdef APP-PLUS
  // Copy bytes into a separate document folder. Never move an existing master
  // out of the avatar cache, and never recompress a photo for persistence.
  const source=await new Promise((ok,fail)=>plus.io.resolveLocalFileSystemURL(info.path||path,ok,fail));
  const fs=await new Promise((ok,fail)=>plus.io.requestFileSystem(plus.io.PRIVATE_DOC,ok,fail));
  const folder=await new Promise((ok,fail)=>fs.root.getDirectory('pety-narrative-media',{create:true},ok,fail));
  const copy=await new Promise((ok,fail)=>source.copyTo(folder,`${id}.${info.type==='jpeg'?'jpg':'png'}`,ok,fail));
  durablePath=copy.toLocalURL();backend='sandbox';
  // #endif
  // #ifndef H5 || APP-PLUS
  const saved = await new Promise((success,fail) => uni.saveFile({tempFilePath:info.path || path,success,fail}));
  durablePath = saved.savedFilePath; backend = 'sandbox';
  if (!durablePath) throw new Error('MEDIA_STORAGE_FAILED');
  // #endif
  assertDataScope(scope);
  return { id, key, namespace: scope.namespace, petId, durable: true, backend, path: durablePath, width: info.width, height: info.height, fit: 'contain' };
}
export function narrativeMediaRefs(state) {
  const refs=[...Object.values(state.drafts||{}),...Object.values(state.records||{}),...Object.values(state.works||{}).map(w=>w.snapshot)];
  return [...new Map(refs.flatMap(r=>r?.renderPayload?.media||r?.media||[]).map(a=>[a.id,a])).values()];
}
export async function removeUnusedNarrativeMedia(store,before) {
  const diary=scopedStorage.forScope(store.scope).getStorageSync('pet_diaries_'+store.petId)||{};
  const retained=new Set([...narrativeMediaRefs(store.read()),...Object.values(diary).flatMap(r=>r.media||[]),...Object.values(store.read().dailyDrafts||{}).flatMap(d=>d.form?.media||[]),...Object.values(store.read().compositions||{}).flatMap(d=>d.payload?.media||[])].map(a=>a.id));
  let pending=[...new Map([...store.read().mediaGarbage,...before].filter(a=>!retained.has(a.id)).map(a=>[a.id,a])).values()];
  store.updateSection('mediaGarbage',pending);
  for(const asset of [...pending]){
    assertDataScope(store.scope);
    const mediaOptions={nativeSandbox:false};
    // #ifdef APP-PLUS
    mediaOptions.nativeSandbox=true;
    // #endif
    assertManagedPetMedia(asset,store.scope,store.petId,mediaOptions);
    // #ifdef H5
    await binary(asset.key,null);
    // #endif
    // #ifdef APP-PLUS
    if(!asset.path?.includes('/pety-narrative-media/'))throw new Error('MEDIA_PATH_INVALID');
    await new Promise((ok,fail)=>plus.io.resolveLocalFileSystemURL(asset.path,entry=>entry.remove(ok,fail),fail));
    // #endif
    // #ifndef H5 || APP-PLUS
    await new Promise((success,fail)=>uni.removeSavedFile({filePath:asset.path,success,fail}));
    // #endif
    pending=pending.filter(a=>a.id!==asset.id);store.updateSection('mediaGarbage',pending);
  }
}
export async function cleanupDeletedPetMedia(scope) {
  const storage=scopedStorage.forScope(scope);
  const pending=storage.getStorageSync('pety_creative_media_gc_v1')||[];
  // Reuse the same allowlisted remover, with a durable owner-level retry queue.
  for(const petId of [...new Set(pending.map(a=>a.petId))]){
    const group=pending.filter(a=>a.petId===petId);
    const adapter={scope,petId,read:()=>({drafts:{},records:{},works:{},mediaGarbage:group}),updateSection:(_,remaining)=>{
      const latest=storage.getStorageSync('pety_creative_media_gc_v1')||[];
      storage.setStorageSync('pety_creative_media_gc_v1',[...latest.filter(a=>a.petId!==petId),...remaining]);
    }};
    await removeUnusedNarrativeMedia(adapter,group);
  }
}
export async function resolveNarrativePhoto(asset, scope, petId) {
  assertDataScope(scope);
  if (asset.namespace !== scope.namespace || asset.petId !== petId || !asset.durable) throw new Error('MEDIA_OWNER_CHANGED');
  let path = asset.path;
  // #ifdef H5
  const blob = await binary(asset.key); assertDataScope(scope);
  if (!blob) throw new Error('MEDIA_SOURCE_MISSING');
  path = URL.createObjectURL(blob);
  // #endif
  try { const info = await imageInfo(path); assertDataScope(scope); return { ...asset, ...info, path }; }
  catch (error) { releaseNarrativePhoto(path); throw error; }
}
export function releaseNarrativePhoto(path) {
  // #ifdef H5
  if (path?.startsWith('blob:')) URL.revokeObjectURL(path);
  // #endif
}
