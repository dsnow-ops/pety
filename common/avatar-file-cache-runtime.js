import { createAvatarFileCache } from './avatar-file-cache.js';
import { createNativeAvatarCacheAdapter } from './avatar-file-cache-native.js';
import { configureAvatarFileCache } from './avatar-display-asset.js';
import { getAccountScope } from './auth-store.js';
import { getActivePet, subscribePetSelection } from './pet-store.js';
import { isAvatarDraftRetained, canImportGuestAvatarAsset } from './avatar-cache-retention.js';

let runtime;
export function installNativeAvatarFileCache() {
  if (runtime) return runtime;
  let cache;
  let activePin = () => {};
  const pinActive = () => {
    activePin(); activePin = () => {};
    if (!cache || !getAccountScope().ready) return;
    const pet = getActivePet();
    if (!pet || pet.localImportPending || !pet.generatedAvatarFileId) return;
    activePin = cache.pin({ namespace: getAccountScope().namespace, petId: pet.id,
      masterId: pet.generatedAvatarFileId, fileId: pet.generatedAvatarFileId, revision: pet.generatedAvatarFileId, purpose: 'master' });
  };
  runtime = {
    readOwner: getAccountScope,
    getCache() {
      // Lazy initialization allows App onLaunch to precede the native IO bridge.
      // Failure stays explicit; never silently expose a remote URL to WebView.
      if (!cache) { const adapter = createNativeAvatarCacheAdapter({
        uni, plus: typeof plus === 'undefined' ? null : plus,
        namespace: () => { const owner = getAccountScope(); return owner.ready ? owner.namespace : ''; },
        ownerVersion: () => getAccountScope().version
      });
        adapter.isAssetRetained = asset => canImportGuestAvatarAsset(asset, key => uni.getStorageSync(key)) || isAvatarDraftRetained(asset, key => uni.getStorageSync(key));
        adapter.canImportGuestAsset = asset => canImportGuestAvatarAsset(asset, key => uni.getStorageSync(key));
        cache = createAvatarFileCache(adapter); pinActive(); }
      return cache;
    }
  };
  configureAvatarFileCache(runtime);
  subscribePetSelection(pinActive);
  return runtime;
}
