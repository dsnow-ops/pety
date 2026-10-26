import {scopedStorage,isDataScopeCurrent} from './scoped-storage.js';
import {hasAiConsent} from './ai-consent.js';
import {buildProfileContext,getPetProfile} from './profile-store.js';

export function readLocalImageBase64(path){
  if(typeof path!=='string'||/^https?:\/\//i.test(path))return Promise.reject(new Error('无法读取非本地图片。'));
  if(path.startsWith('data:image/jpeg;base64,'))return Promise.resolve(path.split(',')[1]);
  // #ifdef H5
  return fetch(path).then(r=>r.blob()).then(blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(blob);}));
  // #endif
  // #ifdef MP-WEIXIN
  return new Promise((resolve,reject)=>uni.getFileSystemManager().readFile({filePath:path,encoding:'base64',success:r=>resolve(r.data),fail:reject}));
  // #endif
  // #ifdef APP-PLUS
  return new Promise((resolve,reject)=>plus.io.resolveLocalFileSystemURL(path,entry=>entry.file(file=>{const reader=new plus.io.FileReader();reader.onloadend=event=>resolve(String(event.target.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file);},reject),reject));
  // #endif
}
const id=()=>`care_${Date.now()}_${Math.random().toString(36).slice(2,12)}`;
function summary(r){return ['照片观察：'+r.images.map(v=>`图${v.imageIndex}：${v.visible.join('；')||'不可可靠观察'}`).join('；'),'就医提示：'+r.advice,'尚未确认的可能原因：'+r.possibleCauses.map(v=>v.name).join('、'),'局限：'+r.limitations].join('\n');}
const SAFE_ERRORS={LOGIN_REQUIRED:'请先登录，再发送照片。',CONSENT_REQUIRED:'请先同意照片处理告知。',VISION_DISABLED:'照片分析尚未开启，可继续文字咨询。',CONFIG_MISSING:'照片分析服务未配置。',CONTEXT_INVALID:'宠物或会话已变化，请重新选图。',IMAGE_INVALID:'图片无法读取，请选择 JPEG / PNG。',IMAGE_TOO_LARGE:'图片较大，请分次发送。',IMAGE_DIMENSIONS:'请重新拍摄清晰照片，最长边不超过2000像素。',PROVIDER_AUTH:'图片服务授权失败，请联系管理员。',PROVIDER_BALANCE:'图片服务余额不足。',PROVIDER_RATE_LIMIT:'图片服务繁忙，请稍后再试。',PROVIDER_MODEL:'当前模型无法处理图片，请联系管理员。',PROVIDER_TIMEOUT:'分析超时，请先检查状态，避免重复调用。',OUTPUT_EMPTY:'模型未返回内容。',OUTPUT_JSON:'分析格式不完整。',OUTPUT_INVALID:'分析未通过完整性或安全检查。',OUTPUT_TRUNCATED:'分析被截断，无法展示完整结果。',REQUEST_RUNNING:'本次分析仍在处理中。',REQUEST_FINISHED:'本次分析已完成，但结果未保存在云端；请保留草稿。',OUTCOME_UNKNOWN:'调用结果尚未确认，请保留草稿并稍后查看状态。',RATE_LIMIT:'本期问诊次数已用完。',REQUEST_CONFLICT:'内容已改变，请重新发送。'};
export const carePhotoMixin={
  data(){return{careDraft:{images:[],purpose:'photo'},careBusy:false,careStatus:'',careError:'',careRequest:null,careSequence:0,careUrgentAdvice:'',careResetting:false};},
  watch:{inputText(){if(!this.careBusy&&this.careRequest&&this.careRequest.description!==this.inputText.trim())this.careRequest=null;this.persistCareDraft();}},
  methods:{
    persistCareDraft(){
      if(!this.activePetId||!isDataScopeCurrent(this.loadedDataScope)||!this.careDraft.images.length)return;
      try{scopedStorage.setStorageSync(`care_photo_draft_${this.activePetId}`,{petId:this.activePetId,images:this.careDraft.images,purpose:this.careDraft.purpose,text:this.inputText,request:this.careRequest});}
      catch(_){this.careError='设备草稿存储空间不足，请保持当前页面，避免丢失照片。';}
    },
    restoreCareDraft(){
      if(!this.activePetId||this.isMemorialMode||!isDataScopeCurrent(this.loadedDataScope))return;
      const saved=scopedStorage.getStorageSync(`care_photo_draft_${this.activePetId}`);
      if(!saved||saved.petId!==this.activePetId||!Array.isArray(saved.images)||!saved.images.length)return;
      const scope=this.loadedDataScope,context=this.loadedChatContextId;
      this.$nextTick(()=>{if(!isDataScopeCurrent(scope)||context!==this.loadedChatContextId)return;
        this.$refs.carePhotoComposer?.restore(saved);this.inputText=saved.text||'';this.careRequest=saved.request||null;this.careStatus='已恢复本宠物的照片草稿';});
    },
    updateCareDraft(draft){this.careDraft=draft;if(this.careResetting)return;if(!this.careBusy){this.careRequest=null;this.careError='';}if(draft.images.length)this.persistCareDraft();else if(this.activePetId&&isDataScopeCurrent(this.loadedDataScope))scopedStorage.removeStorageSync(`care_photo_draft_${this.activePetId}`);},
    clearCareContext(){this.careResetting=true;this.careSequence++;this.careBusy=false;this.careDraft={images:[],purpose:'photo'};this.careRequest=null;this.careStatus='';this.careError='';this.careUrgentAdvice='';this.$refs.carePhotoComposer?.clear();this.careResetting=false;},
    async sendCarePhotos(){
      if(this.careBusy||this.isSending||!this.careDraft.images.length||this.isMemorialMode)return;
      if(!this.activePetId||!isDataScopeCurrent(this.loadedDataScope))return;
      this.careUrgentAdvice='若有呼吸困难、无法排尿、意识异常或流血不止，请立即联系宠物急诊，不必等待分析。';
      if(!hasAiConsent('deepseek_chat')){this.pendingAiAction={type:'carePhoto'};this.showAiConsent=true;return;}
      const scope=this.loadedDataScope,context=this.loadedChatContextId,petId=this.activePetId;
      const current=()=>isDataScopeCurrent(scope)&&this.loadedChatContextId===context&&this.activePetId===petId;
      if(scopedStorage.getStorageSync('care_photo_consent_v1')!==true){
        this.careBusy=true;
        const accepted=await new Promise(resolve=>uni.showModal({title:'照片分析告知',content:'照片及必要描述将发送给 DeepSeek 处理。请勿上传含姓名、电话等信息的报告。服务端不保存原图；照片分析不能确诊。是否继续？',success:r=>resolve(r.confirm),fail:()=>resolve(false)}));
        if(!current())return;this.careBusy=false;if(!accepted)return;scopedStorage.setStorageSync('care_photo_consent_v1',true);
      }
      let sessionId=scopedStorage.getStorageSync(`care_photo_session_${petId}`);
      if(!sessionId){sessionId=id();scopedStorage.setStorageSync(`care_photo_session_${petId}`,sessionId);}
      const description=this.inputText.trim();
      if(description.length>600){this.careError='请将补充描述缩短到600字以内。';return;}
      const state=this.careRequest||{clientRequestId:id(),sessionId,attempt:0,description};
      if(state.attempt>1){this.careError='本次已重试一次，请保留草稿并稍后再试。';return;}
      this.careRequest=state;this.careBusy=true;this.careError='';this.careStatus='正在上传并分析照片…';
      this.promptPanelCollapsed=true;
      this.persistCareDraft();
      const sequence=++this.careSequence;
      const draft=this.careDraft.images.slice();
      try{
        const response=await uniCloud.callFunction({name:'api_deepseek',timeout:60000,data:{requestType:'carePhotoAnalyze',clientRequestId:state.clientRequestId,retry:state.attempt===1,sessionId,petId,relationshipStage:'current',photoConsent:true,
          description,purpose:this.careDraft.purpose,profile:buildProfileContext(this.activePet,getPetProfile(petId),{maxChars:320}),history:this.buildConversationHistory(''),
          images:draft.map(v=>({base64:v.base64,petId,sessionId}))}});
        if(!current()||sequence!==this.careSequence)return;
        const result=response?.result;state.requestId=result?.requestId||'';
        if(result?.code!==0){this.careError=SAFE_ERRORS[result?.errorCode]||'照片服务暂时不可用，草稿已保留。';state.errorCode=result?.errorCode||'SERVICE_UNAVAILABLE';this.careStatus='分析未完成';this.persistCareDraft();return;}
        if(!result.analysis?.images?.length)throw new Error('INVALID_RESPONSE');
        const now=Date.now(),answer=summary(result.analysis);
        this.messageList.push({id:now+'_photo_user',petId,relationshipStage:'current',type:'user',content:description||'请观察这些真实照片',imageUrl:'',imageUrls:draft.map(v=>v.url),createdAt:now,replySource:'user'});
        this.messageList.push({id:now+'_photo_result',petId,relationshipStage:'current',type:'ai',content:answer,carePhotoResult:result.analysis,careRequestId:result.requestId,createdAt:now+1,replySource:'model'});
        if(this.inputText.trim()===description)this.inputText='';
        this.$refs.carePhotoComposer.clear();this.careRequest=null;
        scopedStorage.removeStorageSync(`care_photo_draft_${petId}`);
        this.careStatus=result.analysis.needsRetake?'分析完成，部分照片需补拍':'分析完成';
        this.saveChatHistory();this.scrollToBottom(now+'_photo_result');
        const lexicon=['猫','狗','犬','兔','耳朵','眼睛','皮肤','腹部','爪','嘴','尾巴','红肿','发红','脱毛','结痂','皮屑','出血','肿块','伤口','分泌物','抓挠','舔咬','呕吐','腹泻','排尿困难','尿不出来','精神差'];
        const species=({cat:'猫',dog:'狗',rabbit:'兔'})[this.activePet.species]||this.activePet.species||'';
        const evidence=[species,getPetProfile(petId).species||'',description,...result.analysis.images.flatMap(v=>v.visible)].join(' ');
        const query=lexicon.filter(term=>evidence.includes(term)).join(' ');
        if(query)this.searchSimilarCases(query,null,true); // Keep the new observation in view while search runs separately.
      }catch(_){if(current()&&sequence===this.careSequence){this.careError='上传或分析结果尚未确认，原图和文字已保留。可检查状态或使用同一请求重试。';this.careStatus='未确认';state.errorCode='OUTCOME_UNKNOWN';this.persistCareDraft();}}
      finally{if(current()&&sequence===this.careSequence)this.careBusy=false;}
    },
    retryCarePhotos(){if(!this.careRequest||this.careBusy)return;this.careRequest.attempt++;return this.sendCarePhotos();},
    async checkCarePhotoStatus(){
      const request=this.careRequest;if(!request?.requestId||this.careBusy)return;
      const scope=this.loadedDataScope,context=this.loadedChatContextId;this.careBusy=true;
      try{const response=await uniCloud.callFunction({name:'api_deepseek',data:{requestType:'carePhotoStatus',requestId:request.requestId,petId:this.activePetId,sessionId:request.sessionId,relationshipStage:'current',photoConsent:true}});
        if(isDataScopeCurrent(scope)&&context===this.loadedChatContextId)this.careError=SAFE_ERRORS[response?.result?.errorCode]||'暂时无法查询请求状态。';
      }catch(_){if(isDataScopeCurrent(scope)&&context===this.loadedChatContextId)this.careError='暂时无法查询请求状态。';}
      finally{if(isDataScopeCurrent(scope)&&context===this.loadedChatContextId)this.careBusy=false;}
    }
  }
};
