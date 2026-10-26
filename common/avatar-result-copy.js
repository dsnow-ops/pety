import { t } from './i18n.js';

const RESULT_COPY_KEYS = {
  initial_first: [
    'resultFirst1', 'resultFirst2', 'resultFirst3', 'resultFirst4',
    'resultFirst5', 'resultFirst6', 'resultFirst7', 'resultFirst8'
  ],
  regenerate: ['resultRegenerate1', 'resultRegenerate2', 'resultRegenerate3', 'resultRegenerate4'],
  revision: ['resultRevision1', 'resultRevision2', 'resultRevision3', 'resultRevision4']
};

function stableHash(value) {
  let hash = 2166136261;
  const text = String(value || 'avatar-result');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getAvatarResultContext(jobKind) {
  if (jobKind === 'revision') return 'revision';
  if (jobKind === 'regenerate') return 'regenerate';
  return 'initial_first';
}

export function getAvatarResultCopy({ jobKind = 'initial', jobId = '', locale = 'zh-Hans' } = {}) {
  const context = getAvatarResultContext(jobKind);
  const keys = RESULT_COPY_KEYS[context];
  const variant = stableHash(`${context}:${jobId || 'pending'}`) % keys.length;
  return {
    context,
    variant,
    text: t(`avatar.${keys[variant]}`, {}, locale)
  };
}

export { RESULT_COPY_KEYS };
