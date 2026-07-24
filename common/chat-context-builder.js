const DEFAULT_MAX_MESSAGES = 10;
const DEFAULT_MAX_ITEM_CHARS = 360;
const DEFAULT_MAX_TOTAL_CHARS = 2200;

export function sanitizeChatPlainText(value) {
  return String(value || '')
    .replace(/```[\w-]*\s*/g, '')
    .replace(/```/g, '')
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .trim();
}

function isKnownHistoryPollution(message) {
  if (!message || message.type !== 'ai') return false;
  if (message.isFallback || message.isError || message.guardRejected) return true;
  if (['fallback', 'error'].includes(message.replySource)) return true;

  const content = String(message.content || '').replace(/\s+/g, ' ').trim();
  return /(这个我不太懂呀。我们还是说说你和我的事吧|这个问题我可能帮不上太多，怕给你一个不够负责的答案|我更适合陪你一起看宝贝的身体变化|AI 服务暂时不可用|刚刚没能把话送到)/i.test(content);
}

function isMessageInContext(message, context) {
  return Boolean(
    message &&
    String(message.petId || '') === String(context.petId || '') &&
    message.relationshipStage === context.relationshipStage
  );
}

function isHistoryMessageAllowed(message, context, currentMessageId) {
  if (!message || `${message.id}` === `${currentMessageId}`) return false;
  if (!['user', 'ai'].includes(message.type)) return false;
  if (`${message.id}` === '0' || message.replySource === 'greeting') return false;
  if (!isMessageInContext(message, context)) return false;
  if (message.excludeFromHistory || message.isFallback || message.isError || message.guardRejected) return false;
  if (['fallback', 'error'].includes(message.replySource)) return false;

  const content = String(message.content || '').replace(/\s+/g, ' ').trim();
  if (!content) return false;
  if (/^(整理中|正在输入|对方正在输入)[…...]*$/i.test(content)) return false;
  if (/(AI 服务暂时不可用|AI 响应超时|刚刚没能把话送到|api_deepseek|scope_check_result|relationship_stage_resolved)/i.test(content)) {
    return false;
  }
  if (/(?:memoryCandidates|\"memoryCandidates\"|当前关系阶段：|阶段边界：|内部 debug)/i.test(content)) {
    return false;
  }
  return !(/^(?:\{|\[)/.test(content) && /\"(?:reply|memoryCandidates)\"\s*:/.test(content));
}

export function buildChatConversationHistory(messages, context = {}, options = {}) {
  const maxMessages = Number.isFinite(options.maxMessages)
    ? options.maxMessages
    : DEFAULT_MAX_MESSAGES;
  const maxItemChars = Number.isFinite(options.maxItemChars)
    ? options.maxItemChars
    : DEFAULT_MAX_ITEM_CHARS;
  const maxTotalChars = Number.isFinite(options.maxTotalChars)
    ? options.maxTotalChars
    : DEFAULT_MAX_TOTAL_CHARS;
  const currentMessageId = options.currentMessageId;
  const candidates = [];

  (Array.isArray(messages) ? messages : []).forEach(message => {
    if (!isMessageInContext(message, context)) return;
    if (isKnownHistoryPollution(message)) {
      if (candidates.length && candidates[candidates.length - 1].role === 'user') {
        candidates.pop();
      }
      return;
    }
    if (!isHistoryMessageAllowed(message, context, currentMessageId)) return;

    const content = sanitizeChatPlainText(message.content)
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxItemChars);
    if (!content) return;
    candidates.push({
      role: message.type === 'user' ? 'user' : 'assistant',
      content
    });
  });

  const selected = [];
  let totalChars = 0;
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const item = candidates[index];
    if (selected.length >= maxMessages) break;
    if (totalChars + item.content.length > maxTotalChars) break;
    selected.unshift(item);
    totalChars += item.content.length;
  }

  while (selected.length && selected[0].role === 'assistant') {
    selected.shift();
  }
  return selected;
}

export function hasMedicalNoticeShown(messages, petId, stage) {
  if (stage !== 'current') return false;
  return (Array.isArray(messages) ? messages : []).some(message => (
    message &&
    message.type === 'ai' &&
    String(message.petId || '') === String(petId || '') &&
    message.relationshipStage === 'current' &&
    message.medicalNotice === true
  ));
}
