import { assertDataScope } from './scoped-storage.js';
import { buildAiConsentPayload } from './ai-consent.js';
import { narrativeId } from './narrative-store.js';
export function createNarrativePolisher(call = args => uniCloud.callFunction(args)) {
  let pending = false;
  return {
    async request(draft,style,scope) {
      if(pending)throw new Error('NARRATIVE_BUSY');
      if(draft.original.length>600)throw new Error('NARRATIVE_TOO_LONG');
      assertDataScope(scope);
      if(!scope.namespace.startsWith('account:'))throw new Error('NARRATIVE_LOGIN_REQUIRED');
      pending=true;
      try {
        const response=await call({name:'api_deepseek',data:{requestType:'narrative_polish',action:'narrative_polish',userMessage:draft.original,style,petId:draft.petId,
          draftId:draft.id,revision:draft.revision,clientRequestId:narrativeId(),uniIdToken:uni.getStorageSync('uni_id_token'),narrativeConsent:true,...buildAiConsentPayload('deepseek_chat')}});
        assertDataScope(scope);const result=response?.result;
        if(result?.code!==0)throw Object.assign(new Error(result?.errorCode||'NARRATIVE_SERVICE_UNAVAILABLE'),{code:result?.errorCode||'NARRATIVE_SERVICE_UNAVAILABLE',status:result?.code});
        if(typeof result.candidate!=='string')throw new Error('NARRATIVE_ENDPOINT_MISMATCH');
        if(!result.candidate.trim())throw new Error('NARRATIVE_EMPTY_RESULT');
        if(typeof result.candidate!=='string'||!result.candidate.trim()||result.revision!==draft.revision||result.draftId!==draft.id||result.style!==style)throw new Error('NARRATIVE_INVALID_RESULT');
        return {text:result.candidate,revision:result.revision,style,promptVersion:result.promptVersion};
      } finally { pending=false; }
    }
  };
}

// Display an actionable stage without leaking provider details, tokens or user text.
export function narrativeFailureMessage(error){
 const code=String(error?.code||error?.errCode||error?.message||'UNKNOWN');
 const messages={NARRATIVE_LOGIN_REQUIRED:'尚未发送：请先登录后再整理文字。原文与草稿已保留。',NARRATIVE_PET_UNVERIFIED:'服务已响应，但该宠物缺少服务端归属凭据，整理被拒绝（403）。原文与草稿已保留。',NARRATIVE_ENDPOINT_MISMATCH:'服务返回与文字整理接口不匹配，请检查 api_deepseek 的 narrative_polish 部署版本。',NARRATIVE_EMPTY_RESULT:'文字整理服务返回了空候选，未改动原文。',NARRATIVE_INVALID_RESULT:'候选的草稿版本或风格不匹配，未采用返回内容。',NARRATIVE_SERVICE_UNAVAILABLE:'未收到有效的文字整理服务响应，请检查云空间连接与接口部署。',NARRATIVE_OUTCOME_UNKNOWN:'请求已发送但结果未确认；为避免重复调用，请稍后重试。原文已保留。',NARRATIVE_TOO_LONG:'原文超过 600 字，请缩短后再整理。',NARRATIVE_ALREADY_REQUESTED:'这一版本已请求过整理，服务未返回可重用的候选；原文已保留。',NARRATIVE_RATE_LIMIT:'服务已响应：请求频率受限，请稍后重试。',NARRATIVE_FAILED:'文字服务处理失败，原文与草稿已保留。',NARRATIVE_INCOMPLETE:'文字服务返回不完整，未采用候选。'};
 if([401,403,429].includes(Number(error?.status))&&code==='NARRATIVE_SERVICE_UNAVAILABLE')return '文字服务已响应：'+({401:'登录凭据失效',403:'身份或权限验证未通过',429:'服务请求受限'})[Number(error.status)]+'（'+error.status+'）。原文与草稿已保留。';
 if(messages[code])return messages[code]+' · '+code;
 if(/FUNCTION_NOT_FOUND|function.*not.*found/i.test(code))return '云端未找到 api_deepseek，请检查函数部署。原文已保留。';
 if(/timeout|network|request:fail|fetch/i.test(code))return '文字整理请求未完成：连接失败或超时，未确认服务结果。原文已保留。';
 return '文字整理请求失败，未改动原文。诊断码：'+(/^[A-Z0-9_-]{1,60}$/.test(code)?code:'TRANSPORT_ERROR');
}
