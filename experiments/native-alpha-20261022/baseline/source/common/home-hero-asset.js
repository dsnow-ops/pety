import {privateMediaUrls} from './private-media-urls.js';
import {captureDataScope,isDataScopeCurrent} from './scoped-storage.js';
import { resolvePetHeroAsset, hydratePetHeroAsset } from './avatar-display-asset.js';

// Home accepts committed assets only. Workbench selection / handoff preview URLs
// cannot enter this policy. The shared resolver owns URL lifetime and generation isolation.
const HERO_CHARACTER_KINDS = new Set(['hero-native-tight', 'cutout-tight', 'local-cutout-tight', 'viapi-cutout', 'local-cutout']);
function policyFor(pet) {
  const master = String(pet.generatedAvatarFileId || '');
  const committed = master.startsWith('cloud://') ? /\/pet-avatar\/final\/[^/]+\/[^/]+\/final\.png$/.test(master) : Boolean(master);
  return { preferFinal: true, accept(asset) {
    if (!pet.id || !committed) return false;
    if (asset.kind === 'final') return asset.fileId === pet.generatedAvatarFileId;
    return HERO_CHARACTER_KINDS.has(asset.kind) && asset.transparent && asset.alphaValid && asset.qualityAccepted;
  } };
}
function describe(asset) {
  return { ...asset, assetRole: asset.assetKind === 'placeholder' ? 'placeholder' : asset.hasCutout ? 'home_hero' : 'home_portrait',
    renderTreatment: asset.hasCutout ? 'transparent-character' : asset.assetKind === 'final' ? 'integrated-stage' : 'placeholder',
    fallbackReason: asset.assetKind === 'final' && asset.imageUrl ? '' : asset.fallbackReason, policyVersion: 'home-stage-v1' };
}
const originals=new Map();
function originalAsset(pet){const raw=String(pet.originalPhotoUrl||'');const source=pet.localImportPending===true&&!['_doc/','file:///'].some(prefix=>raw.startsWith(prefix))?'':raw;const scope=captureDataScope();const key=scope.namespace+':'+pet.id+':'+source;const url=source.startsWith('cloud://')?originals.get(key)||'':['https://','http://','file:///','_doc/','/static/'].some(prefix=>source.startsWith(prefix))?source:'';return {...describe(resolvePetHeroAsset({},policyFor({}))),petId:pet.id,masterFileId:source,displayFileId:source,imageUrl:url,assetKind:'original',assetRole:'home_portrait',renderTreatment:'integrated-stage',assetMetadata:{},fallbackReason:url?'':'ORIGINAL_PHOTO_UNAVAILABLE'};}
function wantsOriginal(pet,ai){return pet.heroDisplayMode==='original'||(pet.heroDisplayMode!=='ai'&&Boolean(pet.originalPhotoUrl)&&!pet.generatedAvatarFileId&&!ai.imageUrl);}
export function resolveHeroVisualAsset(pet = {}) {const ai=describe(resolvePetHeroAsset(pet,policyFor(pet)));return wantsOriginal(pet,ai)?originalAsset(pet):ai;}
export async function hydrateHeroVisualAsset(pet = {}, options = {}) {
  const ai=resolveHeroVisualAsset(pet);if(ai.assetKind==='original'){const scope=captureDataScope();const source=String(pet.originalPhotoUrl||'');if(source.startsWith('cloud://')&&pet.localImportPending!==true){const response=await privateMediaUrls([source],pet.id);if(!isDataScopeCurrent(scope))throw new Error('STALE_DATA_SCOPE');const url=response.fileList?.[0]?.tempFileURL||'';if(url)originals.set(scope.namespace+':'+pet.id+':'+source,url);}return originalAsset(pet);}
  return describe(await hydratePetHeroAsset(pet, { ...options, ...policyFor(pet) }));
}
