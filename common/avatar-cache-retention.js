// Read only the matching local draft's asset IDs. Never enumerate private chats,
// import data, renew URLs, or expose another owner's cached image.
export function canImportGuestAvatarAsset(asset, readValue) {
  if (!asset?.namespace?.startsWith('account:') || !['master', 'avatar'].includes(asset.purpose) || asset.revision !== asset.fileId) return false;
  const prefix = `pety_owner_v1:${encodeURIComponent(asset.namespace)}:`;
  const receipt = readValue(prefix + 'pety_guest_import_v1');
  if (receipt?.status !== 'imported' || !receipt.ids?.includes(asset.petId)) return false;
  const original = receipt.pets?.find(p => p.id === asset.petId);
  const current = readValue(prefix + 'my_pets_list')?.find(p => p.id === asset.petId);
  const matches = pet => pet?.localImportPending === true && pet.generatedAvatarFileId === asset.masterId &&
    ['generatedAvatarFileId', 'generatedAvatarHeroFileId', 'generatedAvatarCutoutTightFileId',
      'generatedAvatarLocalCutoutTightFileId', 'generatedAvatarCutoutFileId', 'generatedAvatarLocalCutoutFileId']
      .some(key => pet[key] && pet[key] === asset.fileId);
  return matches(original) && matches(current);
}

export function isAvatarDraftRetained(asset, readValue) {
  const fail = () => { throw Object.assign(new Error('ASSET_DRAFT_STATE_UNAVAILABLE'), { code: 'ASSET_DRAFT_STATE_UNAVAILABLE' }); };
  if (!asset?.petId || !asset?.namespace || typeof readValue !== 'function') return fail();
  const prefix = asset.namespace === 'guest:local' ? '' :
    asset.namespace.startsWith('account:') && asset.namespace.length > 8 ? `pety_owner_v1:${encodeURIComponent(asset.namespace)}:` : null;
  if (prefix === null) return fail();
  let session;
  try { session = readValue(`${prefix}pet_avatar_session_${asset.petId}`); }
  catch (_) { return fail(); }
  if (session === undefined || session === null || session === '') return false;
  if (typeof session !== 'object' || session.petId !== asset.petId || !Array.isArray(session.candidates)) return fail();
  for (const candidate of session.candidates) {
    if (!candidate || typeof candidate !== 'object') return fail();
    const master = candidate.fileId || candidate.generatedFileId;
    if (master === asset.masterId && (master === asset.fileId || candidate.generatedThumbnailFileId === asset.fileId)) return true;
  }
  return false;
}
