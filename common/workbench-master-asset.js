// Candidates are for likeness review; never substitute a cutout or thumbnail.
export function resolveWorkbenchMasterAsset(candidate = {}, petId = '') {
  const fileId = String(candidate.fileId || candidate.generatedFileId || '');
  const metadata = candidate.mainAssetMetadata || {};
  const forbidden = /(?:thumbnail|display|cutout|hero-feather|hero-native)/i.test(fileId);
  const qualified = Boolean(petId && candidate.jobId && fileId && !forbidden && metadata.wasDownscaled !== true);
  return { petId, jobId: candidate.jobId || '', fileId: qualified ? fileId : '', assetRole: 'workbench_master',
    sourceType: qualified ? 'candidate-original' : 'placeholder', metadata, qualified,
    fallbackReason: qualified ? '' : forbidden ? 'DERIVATIVE_NOT_MASTER' : 'MASTER_UNAVAILABLE',
    fit: 'contain', compositionVersion: metadata.compositionVersion || 'legacy-unverified' };
}
