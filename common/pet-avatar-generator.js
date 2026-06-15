import { getPetRelationshipStage, normalizeRelationshipStage } from './relationship-config.js';

const PLACEHOLDER_IMAGE = '/static/pet.png';

const AVATAR_SOURCES = ['original', 'generated', 'placeholder'];
const AVATAR_STATUSES = ['none', 'pending', 'ready', 'failed'];
const AVATAR_STYLES = ['realistic', 'soft3d', 'memorial'];

const DEFAULT_STYLE_BY_STAGE = {
  future: 'soft3d',
  current: 'soft3d',
  deceased: 'memorial'
};

const STYLE_LABELS = {
  realistic: '真实照片风',
  soft3d: '柔和 3D 风',
  memorial: '纪念肖像风'
};

const STATUS_LABELS = {
  none: '尚未生成',
  pending: '生成中',
  ready: '已就绪',
  failed: '生成失败'
};

export function getDefaultAvatarStyle(stage) {
  return DEFAULT_STYLE_BY_STAGE[normalizeRelationshipStage(stage)] || DEFAULT_STYLE_BY_STAGE.current;
}

export function normalizeAvatarSource(source) {
  return AVATAR_SOURCES.includes(source) ? source : 'placeholder';
}

export function normalizeAvatarStatus(status) {
  return AVATAR_STATUSES.includes(status) ? status : 'none';
}

export function normalizeAvatarStyle(style, stage) {
  return AVATAR_STYLES.includes(style) ? style : getDefaultAvatarStyle(stage);
}

function resolveAvatarStatus(input) {
  if (input && typeof input === 'object') return input.avatarStatus;
  return input;
}

function resolveAvatarStyle(input) {
  if (input && typeof input === 'object') return input.avatarStyle;
  return input;
}

export function getAvatarStatusText(petOrStatus) {
  const status = resolveAvatarStatus(petOrStatus);
  return STATUS_LABELS[normalizeAvatarStatus(status)] || STATUS_LABELS.none;
}

export function getAvatarStyleText(styleOrPet, stage) {
  const style = resolveAvatarStyle(styleOrPet);
  const normalizedStyle = normalizeAvatarStyle(style, stage);
  return STYLE_LABELS[normalizedStyle] || STYLE_LABELS.realistic;
}

export function createAvatarJob(pet = {}, options = {}) {
  const stage = getPetRelationshipStage(pet);
  const style = normalizeAvatarStyle(options.avatarStyle || options.style || pet.avatarStyle, stage);
  const now = Date.now();
  const jobId = `mock_avatar_${pet.id || 'pet'}_${now}`;

  // Replace this block with the real AI image generation API request later.
  return {
    jobId,
    status: 'ready',
    provider: 'mock',
    petId: pet.id || '',
    avatarStyle: style,
    createdAt: now,
    result: {
      jobId,
      generatedAvatarUrl: getAvatarDisplayImage(pet),
      avatarSource: 'generated',
      avatarStatus: 'ready',
      avatarStyle: style,
      avatarUpdatedAt: now
    }
  };
}

export function getAvatarJobStatus(jobId) {
  const now = Date.now();

  // Replace this block with the real job polling API later.
  return {
    jobId,
    status: 'ready',
    progress: 100,
    result: {
      jobId,
      generatedAvatarUrl: PLACEHOLDER_IMAGE,
      avatarSource: 'generated',
      avatarStatus: 'ready',
      avatarStyle: getDefaultAvatarStyle('current'),
      avatarUpdatedAt: now
    }
  };
}

export function saveGeneratedAvatar(pet = {}, result = {}) {
  const stage = getPetRelationshipStage(pet);
  const generatedAvatarUrl = result.generatedAvatarUrl || result.avatarUrl || getAvatarDisplayImage(pet);

  return {
    generatedAvatarUrl,
    avatarSource: 'generated',
    avatarStatus: normalizeAvatarStatus(result.avatarStatus || result.status || 'ready'),
    avatarStyle: normalizeAvatarStyle(result.avatarStyle || pet.avatarStyle, stage),
    avatarUpdatedAt: result.avatarUpdatedAt || Date.now()
  };
}

export function getAvatarDisplayImage(pet = {}) {
  const source = pet || {};
  return source.generatedAvatarUrl ||
    source.originalPhotoUrl ||
    source.avatar ||
    source.avatarUrl ||
    source.imageUrl ||
    source.image ||
    source.photo ||
    source.petImage ||
    source.profileImage ||
    source.petPhoto ||
    PLACEHOLDER_IMAGE;
}
