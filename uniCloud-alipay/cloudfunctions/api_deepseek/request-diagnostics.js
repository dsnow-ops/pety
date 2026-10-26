'use strict';
const crypto = require('crypto');
const SCENES = new Set(['chat','narrative_polish','carePhotoAnalyze','carePhotoStatus','memorial_persona_builder','memorial_daily_reflection','createSimilarCaseSearch','processSimilarCaseSearch','getSimilarCaseSearchStatus']);
const unavailable = traceId => ({code:503,errorCode:'AI_SERVICE_UNAVAILABLE',msg:'AI 服务暂时不可用，请稍后再试。',traceId});

// Exactly one completion record per entry invocation. Only a server-generated
// correlation ID, a bounded scene, result code and timing enter this new log.
// This boundary neither retries requests nor changes quota/accounting decisions.
function withRequestDiagnostics(handler, logger = console, now = Date.now) {
  return async (event, context) => {
    const traceId = crypto.randomBytes(12).toString('hex'), started = now();
    const health = event?.action === 'healthCheck';
    const scene = health ? 'healthCheck' : !event?.requestType ? 'chat' : SCENES.has(event.requestType) ? event.requestType : 'unsupported';
    let code = 503, outcome = 'unexpected_error';
    try {
      const result = await handler(event, context);
      // Preserve the existing deliberately minimal public liveness contract.
      if (health && result?.ok === true) { code = 0; outcome = 'success'; return result; }
      if (!result || typeof result !== 'object' || Array.isArray(result) || !Number.isInteger(result.code) || result.code < 0 || result.code > 599) return unavailable(traceId);
      code = result.code;
      outcome = code === 0 ? 'success' : code >= 500 ? 'service_error' : 'rejected';
      return {...result,traceId};
    } catch (_) {
      // An unexpected DB/runtime failure must not serialize a stack, prompt,
      // provider response, token or error message back to the client or this log.
      return unavailable(traceId);
    } finally {
      try {
        const duration = Number(now()) - Number(started);
        logger.info('pety_api_completed', {traceId,service:'api_deepseek',scene,code,outcome,elapsedMs:Number.isFinite(duration)?Math.min(86400000,Math.max(0,Math.round(duration))):0});
      } catch (_) { /* Logging failure must not change the business result. */ }
    }
  };
}
module.exports = {withRequestDiagnostics};
