'use strict';

const HERO_PROMPT_REVISION = 'background-only-v1';

// A narrowly bounded migration of a proven bad output, not a retry of an
// ambiguous submission, unpaid account, network failure, or still-running job.
function planHeroRecovery(candidate, enabled) {
  if (!enabled || candidate.cutoutStatus !== 'FAILED' || !candidate.cutoutProviderJobId ||
    !String(candidate.cutoutEngine || '').startsWith('hero-character-') ||
    candidate.heroPromptRevision === HERO_PROMPT_REVISION || Number(candidate.heroAutomaticRetryCount || 0) >= 1 ||
    !['HERO_TECHNICAL_BACKGROUND_INVALID', 'HERO_CHROMA_CUTOUT_FAILED', 'HERO_CHROMA_EDGE_CONTAMINATION'].includes(candidate.heroGenerationErrorCode)) return {};
  return {
    heroPreviousProviderJobId: candidate.cutoutProviderJobId,
    heroPreviousRequestId: candidate.heroGenerationRequestId || '',
    heroAutomaticRetryCount: 1,
    heroPriorInvocationCount: Number(candidate.cutoutInvocationCount || 0),
    cutoutProviderJobId: '', cutoutInvocationCount: 0, cutoutStatus: 'PENDING', cutoutErrorCode: '',
    heroGenerationStatus: 'PENDING', heroGenerationPhase: 'RECOVERY_QUEUED', heroGenerationErrorCode: '',
    heroPromptRevision: HERO_PROMPT_REVISION
  };
}

module.exports = { HERO_PROMPT_REVISION, planHeroRecovery };
