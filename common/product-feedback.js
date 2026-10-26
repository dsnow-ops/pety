export const PRODUCT_FEEDBACK_DRAFT_KEY = 'product_feedback_draft_v1';
export const PRODUCT_FEEDBACK_DEVICE_KEY = 'product_feedback_device_v1';
export const PRODUCT_FEEDBACK_MAX_IMAGES = 3;
export const PRODUCT_FEEDBACK_MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const PRODUCT_FEEDBACK_MIN_CONTENT_LENGTH = 10;
export const PRODUCT_FEEDBACK_MAX_CONTENT_LENGTH = 1000;
export const PRODUCT_FEEDBACK_MAX_TITLE_LENGTH = 60;

export const PRODUCT_FEEDBACK_CATEGORIES = Object.freeze([
  { key: 'product_suggestion', label: '产品建议' },
  { key: 'feature_request', label: '功能需求' },
  { key: 'ui_experience', label: '界面体验' },
  { key: 'ai_conversation', label: 'AI 对话问题' },
  { key: 'bug', label: 'Bug' },
  { key: 'emotional_experience', label: '情感体验问题' },
  { key: 'privacy_security', label: '隐私与安全' },
  { key: 'other', label: '其他' }
]);
