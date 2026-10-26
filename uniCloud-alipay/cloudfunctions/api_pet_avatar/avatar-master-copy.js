'use strict';

// Issued only after confirmAvatar has checked owner/session and saved the copy.
function masterCopyReceipt(candidate, targetFileId, metadata) {
  const sha256 = candidate.generatedCandidateSha256;
  if (!/^[a-f0-9]{64}$/.test(sha256 || '') || metadata.contentSha256 !== sha256 ||
      !candidate.generatedFileId || !targetFileId ||
      !['bytes', 'width', 'height'].every(key => Number.isSafeInteger(metadata[key]) && metadata[key] > 0)) return null;
  return { version: 1, sourceFileId: candidate.generatedFileId, targetFileId, sha256,
    bytes: metadata.bytes, width: metadata.width, height: metadata.height };
}
module.exports = { masterCopyReceipt };
