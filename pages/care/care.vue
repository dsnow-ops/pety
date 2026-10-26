<template>
  <view class="care-page" :class="petThemeClass" :style="[appThemeStyle, {'--ui-font-scale':uiFontScale}]">
    <scroll-view scroll-y class="care-scroll">
      <view class="top-bar">
        <button class="icon-button" hover-class="icon-button-hover" @click="goBack">
          <uni-icons type="left" size="22" color="#302A23"></uni-icons>
        </button>
        <view class="title-copy">
          <text class="title-kicker">CARE SERVICE</text>
          <text class="title-main">就医服务</text>
        </view>
        <view class="icon-button-spacer"></view>
      </view>

      <view class="emergency-card">
        <view class="emergency-head">
          <view>
            <text class="card-kicker">URGENT</text>
            <text class="card-title">这些情况优先线下急诊</text>
          </view>
          <view class="urgent-badge">急</view>
        </view>
        <view class="sign-list">
          <view v-for="sign in emergencySigns" :key="sign" class="sign-line">
            <view class="sign-dot"></view>
            <text>{{ sign }}</text>
          </view>
        </view>
      </view>

      <view class="service-grid">
        <view class="service-card" hover-class="service-card-hover" @click="startReportGuide">
          <uni-icons type="paperclip" size="24" color="#302A23"></uni-icons>
          <text class="service-title">报告解读</text>
          <text class="service-desc">识别可读内容，保留不确定性</text>
        </view>
        <view class="service-card" hover-class="service-card-hover" @click="startPhotoGuide">
          <uni-icons type="camera" size="24" color="#302A23"></uni-icons>
          <text class="service-title">拍照问诊</text>
          <text class="service-desc">照片 + 文字描述更稳妥</text>
        </view>
      </view>

      <view v-if="careLoadError" class="care-load-error" role="alert"><text>照护记录暂时无法读取，已有资料仍保留。</text><button class="care-load-more" @click="loadCare">重新读取</button></view>
      <view class="followups" v-if="consultations.length">
        <text class="card-title">{{narrativeCopy('careContinue')}}</text><text class="followup-hint">{{narrativeCopy('followupHint')}}</text>
        <view class="followup-row" v-for="record in consultations.slice(0,consultationLimit)" :key="record.id">
          <text class="followup-question">{{record.question}}</text><text class="followup-hint">{{follows[record.id]?.localDate || ''}} {{narrativeCopy('followup_'+(follows[record.id]?.status||'none'))}}</text>
          <text v-if="follows[record.id]?.note && expandedHistory!==record.id" class="followup-hint">{{follows[record.id].note}}</text>
          <button v-if="history(record.id).length" class="history-toggle" :aria-expanded="expandedHistory===record.id" @click="expandedHistory=expandedHistory===record.id?'':record.id">{{expandedHistory===record.id?'收起经过':'查看照护经过 · '+history(record.id).length+' 次记录'}}</button>
          <view v-if="expandedHistory===record.id" class="care-history"><view v-for="entry in history(record.id)" :key="entry.key" class="history-entry"><text class="history-date">{{entry.localDate||'时间未详'}} · {{narrativeCopy('followup_'+(entry.status||'none'))}}</text><text v-if="entry.note" class="history-note">{{entry.note}}</text></view><text class="history-disclaimer">这些是你当时留下的观察，不代表诊断。</text></view>
          <text v-if="!memorial && follows[record.id]?.draft && followupId!==record.id" class="followup-draft-label">有未完成的本机草稿</text>
          <button v-if="!memorial && followupId!==record.id" class="followup-add" @click="startFollowup(record.id)">{{follows[record.id]?.draft?'继续草稿':narrativeCopy('followup')}} <uni-icons type="right" size="13" color="currentColor"/></button>
        <view v-if="followupId===record.id && !memorial" class="followup-form">
          <view class="followup-options"><button v-for="status in ['recovered','changed','visited','none']" :key="status" :class="{selected:followupStatus===status}" @click="setFollowupStatus(status)">{{narrativeCopy('followup_'+status)}}</button></view>
          <textarea :value="followupNote" @input="setFollowupNote($event.detail.value)" :maxlength="2000" :placeholder="narrativeCopy('followupNote')" />
          <text class="followup-hint">保存会新增一次经过，之前的观察仍然保留。</text><text v-if="followupMessage" class="followup-hint" role="status">{{followupMessage}}</text><view class="followup-form-actions"><button class="followup-save" :disabled="followupStatus==='none'&&!followupNote.trim()" @click="commitFollowup">记下这次观察</button><button class="followup-later" @click="closeFollowup">稍后继续</button></view><button class="followup-cancel" @click="cancelFollowup">放弃这次输入</button>
        </view>
        </view>
        <button v-if="consultations.length>consultationLimit" class="care-load-more" @click="consultationLimit+=30">查看更早的咨询 · {{consultationLimit}} / {{consultations.length}}</button>
        <text v-if="!followupId" class="followup-hint" role="status">{{followupMessage}}</text>
      </view>

    </scroll-view>
  </view>
</template>

<script>
import {scopedStorage} from "../../common/scoped-storage.js";
import { getEmergencySigns } from '../../common/hospital-store.js';
import {getConsultationRecords} from '../../common/consultation-store.js';
import {getActivePet,subscribePetSelection} from '../../common/pet-store.js';
import {subscribeAccountScope} from '../../common/auth-store.js';
import {getNarrativeStore,narrativeMode} from '../../common/narrative-store.js';
import {saveCareFollowup,careFollowupHistory,getCareFollowupDraft,saveCareFollowupDraft,discardCareFollowupDraft} from '../../common/care-followup.js';
import {isDataScopeCurrent} from '../../common/scoped-storage.js';
import {t} from '../../common/i18n.js';

export default {
  data() {
    return {
      emergencySigns: [],consultations:[],consultationLimit:30,careLoadError:false,follows:{},followupStore:null,followupId:'',followupStatus:'none',followupNote:'',followupDraftToken:'',followupMessage:'',memorial:false,expandedHistory:'',careVisible:false
    };
  },
  onLoad(){this.offCarePet=subscribePetSelection(()=>{if(this.careVisible)this.loadCare();});this.offCareScope=subscribeAccountScope(()=>{if(this.careVisible)this.loadCare();});},
  onShow() {
    this.careVisible=true;
    this.emergencySigns = getEmergencySigns();
    this.loadCare();
  },
  onHide(){this.careVisible=false;this.clearCare();},
  onUnload(){this.careVisible=false;this.clearCare();this.offCarePet?.();this.offCareScope?.();},
  methods: {
    clearCare(){this.consultations=[];this.consultationLimit=30;this.careLoadError=false;this.follows={};this.followupStore=null;this.resetFollowup();this.followupMessage='';this.expandedHistory='';},
    resetFollowup(){this.followupId='';this.followupStatus='none';this.followupNote='';this.followupDraftToken='';},
    loadCare(){this.clearCare();const pet=getActivePet();if(!pet)return;try{this.followupStore=getNarrativeStore(pet.id);this.memorial=narrativeMode(pet.relationshipStage||pet.status)==='deceased';this.consultations=getConsultationRecords(pet.id);this.follows=this.followupStore.read().followups;this.consultations.forEach(r=>{careFollowupHistory(this.follows,r.id);getCareFollowupDraft(this.follows,r.id);});}catch(_){this.clearCare();this.careLoadError=true;}},
    careCurrent(){return this.careVisible&&!!this.followupStore&&isDataScopeCurrent(this.followupStore.scope)&&getActivePet()?.id===this.followupStore.petId;},
    history(id){return careFollowupHistory(this.follows,id);},
    narrativeCopy(key){return t('narrative.'+key);},
    startFollowup(id){if(!this.careCurrent()||this.memorial||!this.consultations.some(r=>r.id===id)||this.followupId===id)return;if(this.followupId&&!this.persistFollowupDraft())return;try{this.follows=this.followupStore.read().followups;const draft=getCareFollowupDraft(this.follows,id);this.followupId=id;this.followupStatus=draft?.status||'none';this.followupNote=draft?.note||'';this.followupDraftToken=draft?.token||'';this.followupMessage=draft?'已恢复本机草稿，还未新增观察。':'';}catch(_){this.followupMessage='草稿暂时无法读取，请保留当前输入并重试。';}},
    followupError(error){this.followupMessage=error.message==='CARE_DRAFT_CHANGED'?'草稿已在别处更新，当前输入仍保留。请核对后再继续。':error.message==='CARE_FOLLOWUP_EMPTY'?'写下观察或选择明确状态后再保存。':'暂时无法确认保存结果，请保留当前页面并重试。';},
    setFollowupStatus(status){this.followupStatus=status;this.persistFollowupDraft();},
    setFollowupNote(note){this.followupNote=note;this.persistFollowupDraft();},
    persistFollowupDraft(){if(!this.followupId||!this.careCurrent()||narrativeMode(getActivePet()?.relationshipStage||getActivePet()?.status)==='deceased')return false;try{const draft=saveCareFollowupDraft(this.followupStore,this.followupId,this.followupStatus,this.followupNote,this.followupDraftToken);this.followupDraftToken=draft?.token||'';this.follows=this.followupStore.read().followups;this.followupMessage=draft?'草稿已保存在本机，还未新增观察。':'';return true;}catch(error){this.followupError(error);return false;}},
    closeFollowup(){if(!this.persistFollowupDraft())return;const saved=!!this.followupDraftToken;this.resetFollowup();this.followupMessage=saved?'草稿留在本机，下次可继续填写。':'';},
    cancelFollowup(){if(!this.followupId||!this.careCurrent()||narrativeMode(getActivePet()?.relationshipStage||getActivePet()?.status)==='deceased')return;try{discardCareFollowupDraft(this.followupStore,this.followupId,this.followupDraftToken);}catch(error){if(error.message!=='CARE_DRAFT_CHANGED'){this.followupError(error);return;}}try{this.follows=this.followupStore.read().followups;this.resetFollowup();this.followupMessage='已放弃当前输入；已保存的观察和其他草稿仍保留。';}catch(error){this.followupError(error);}},
    commitFollowup(){if(!this.followupId||!this.careCurrent()||narrativeMode(getActivePet()?.relationshipStage||getActivePet()?.status)==='deceased')return;try{saveCareFollowup(this.followupStore,this.followupId,this.followupStatus,this.followupNote,undefined,{expectedDraftToken:this.followupDraftToken});this.follows=this.followupStore.read().followups;this.expandedHistory=this.followupId;this.resetFollowup();this.followupMessage=this.narrativeCopy('followupSaved');}catch(error){this.followupError(error);}},
    startReportGuide() {
      scopedStorage.setStorageSync('pending_care_photo_purpose', 'report');
      scopedStorage.setStorageSync('pending_chat_prompt', '请帮我解读这份宠物检查报告。我会上传图片，并补充报告里的关键数值。');
      uni.switchTab({
        url: '/pages/chat/chat'
      });
    },
    startPhotoGuide() {
      scopedStorage.setStorageSync('pending_care_photo_purpose', 'photo');
      uni.switchTab({
        url: '/pages/chat/chat'
      });
    },
    goBack() {
      const pages = getCurrentPages();
      if (pages.length > 1) {
        uni.navigateBack();
        return;
      }
      uni.switchTab({ url: '/pages/chat/chat' });
    }
  }
}
</script>

<style scoped>
.care-page .followup-row .followup-form{border:0;border-top:1px solid var(--pety-rule,#E8E0D4);border-radius:0;background:transparent;padding:16px 0 0;margin:8px 0 0}
.care-page .followup-form .followup-save[disabled]{opacity:.45}
.care-load-error{margin:24px 0;padding:20px;border:1px solid var(--pety-rule,#E8E0D4);border-radius:18px;font-size:15px;line-height:1.8;color:var(--pety-text-primary,#302A23)}
.care-load-more{background:transparent;color:var(--pety-text-secondary,#626A5D);font-size:14px;min-height:48px;line-height:1.6;padding:12px}.care-load-more::after{border:0}
.care-page.ui-large-text .followup-question{font-size:calc(16px * var(--ui-font-scale,1))}.care-page.ui-large-text .history-note{font-size:calc(15px * var(--ui-font-scale,1))}.care-page.ui-large-text .history-date,.care-page.ui-large-text .history-disclaimer{font-size:calc(12px * var(--ui-font-scale,1))}.care-page.ui-large-text .followup-hint,.care-page.ui-large-text .followup-row button,.care-page.ui-large-text .followup-form button{font-size:calc(14px * var(--ui-font-scale,1));white-space:normal}.care-page.ui-large-text .followup-form textarea{font-size:calc(17px * var(--ui-font-scale,1));line-height:1.6;min-height:130px}.care-page.ui-large-text .followup-options button{min-height:52px}
.care-page .followup-row{margin:20px 0;padding:20px;border:1px solid var(--pety-rule,#E8E0D4);border-radius:20px;background:var(--pety-surface,#FFFDFA)}.care-page .followup-form{margin:20px 0;padding:20px;border:1px solid var(--pety-rule,#E8E0D4);border-radius:20px;background:var(--pety-surface,#FFFDFA)}.care-page .followup-row button::after,.care-page .followup-form button::after{border:0}.care-page .followup-add{display:flex;align-items:center;justify-content:space-between;width:100%;border-top:1px solid var(--pety-rule,#E8E0D4);margin-top:12px}.followup-form-actions{display:flex;align-items:center;gap:12px;margin-top:18px}.care-page .followup-form .followup-save{background:var(--pety-primary,#596650);color:#fff;text-align:center;flex:1;border-radius:14px;padding:12px 16px}.care-page .followup-form .followup-cancel{padding:12px;min-width:64px;text-align:center}.care-page .followup-options{gap:6px}.care-page .followup-options button{flex:1 1 40%;text-align:center;border:1px solid var(--pety-rule,#E8E0D4)}.care-page .followup-options .selected{border-color:var(--pety-primary,#596650);font-weight:600}
.followup-question{display:block;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--pety-text-primary,#302A23);font-size:16px;line-height:1.7}.care-history{border-left:2px solid var(--pety-rule,#D9DDD1);padding:0 0 0 16px;margin:12px 0 18px}.history-entry{padding:8px 0 16px}.history-date{display:block;color:var(--pety-text-secondary,#626A5D);font-size:12px;line-height:1.7}.history-note{display:block;white-space:pre-wrap;overflow-wrap:anywhere;font-size:15px;line-height:1.8;color:var(--pety-text-primary,#302A23);margin-top:6px}.history-disclaimer{display:block;color:var(--pety-text-secondary,#626A5D);font-size:12px;line-height:1.7}.care-page .followup-row button,.care-page .followup-form button{min-height:44px;color:var(--pety-text-primary,#596650);font-size:14px;text-align:left;line-height:1.7;padding:10px 0}.care-page .followup-hint{color:var(--pety-text-secondary,#626A5D)}.care-page .followup-row{border-color:var(--pety-rule,#D9DDD1)}.care-page .followup-options button{padding:10px 12px;border-radius:12px}.care-page .followup-options .selected{background:var(--pety-surface-muted,#E4E8DD)}.care-page .followup-form textarea{box-sizing:border-box;padding:14px;border:1px solid var(--pety-rule,#D9DDD1);border-radius:14px;background:var(--pety-surface,#fff);color:var(--pety-text-primary,#302A23)}
.followups{margin:30px 0;}.followup-hint{display:block;font-size:14px;line-height:1.7;color:#626A5D;margin:12px 0;}.followup-row{padding:20px 0;border-bottom:1px solid #D9DDD1;}.followup-row button,.followup-form button{background:transparent;color:#596650;font-size:15px;}.followup-options{display:flex;flex-wrap:wrap;gap:8px;}.followup-options .selected{background:#E4E8DD;}.followup-form textarea{width:100%;min-height:90px;font-size:17px;margin:15px 0;}
.care-page {
  min-height: 100vh;
  background: #F4F1EA;
  color: #302A23;
}

.care-scroll {
  height: 100vh;
  padding: calc(var(--status-bar-height, 0px) + 30rpx) 30rpx calc(42rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.top-bar,
.emergency-head,
.section-head,
.hospital-head,
.address-row,
.action-row,
.service-grid {
  display: flex;
}

.top-bar,
.emergency-head,
.section-head,
.hospital-head {
  align-items: center;
  justify-content: space-between;
}

.icon-button {
  width: 72rpx;
  height: 72rpx;
  padding: 0;
  margin: 0;
  border-radius: 50%;
  background: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 12rpx 30rpx rgba(58, 51, 43, 0.06);
}
.icon-button-spacer { width: 72rpx; height: 72rpx; flex: none; }

.icon-button::after,
.action-btn::after {
  border: none;
}

.icon-button-hover,
.action-btn-hover,
.service-card-hover {
  opacity: 0.78;
}

.title-copy {
  text-align: center;
}

.title-kicker,
.card-kicker {
  display: block;
  color: #8C7557;
  font-size: 20rpx;
  line-height: 1.3;
}

.title-main {
  display: block;
  margin-top: 6rpx;
  color: #302A23;
  font-size: 38rpx;
  font-weight: 600;
  line-height: 1.15;
}

.emergency-card,
.service-card,
.hospital-card {
  border-radius: 16rpx;
  background: #FFFFFF;
  border: 1rpx solid #EEE6DA;
  box-shadow: 0 14rpx 34rpx rgba(58, 51, 43, 0.05);
}

.emergency-card {
  margin-top: 30rpx;
  padding: 28rpx;
}

.card-title {
  display: block;
  margin-top: 8rpx;
  color: #302A23;
  font-size: 31rpx;
  font-weight: 600;
  line-height: 1.25;
}

.urgent-badge {
  width: 58rpx;
  height: 58rpx;
  border-radius: 50%;
  background: #B95757;
  color: #FFFFFF;
  font-size: 26rpx;
  line-height: 58rpx;
  text-align: center;
}

.sign-list {
  margin-top: 22rpx;
}

.sign-line {
  display: flex;
  align-items: flex-start;
  margin-bottom: 14rpx;
  color: #6B5D4D;
  font-size: 24rpx;
  line-height: 1.45;
}

.sign-dot {
  width: 10rpx;
  height: 10rpx;
  margin-top: 12rpx;
  margin-right: 12rpx;
  border-radius: 50%;
  background: #B95757;
  flex-shrink: 0;
}

.service-grid {
  gap: 18rpx;
  margin-top: 22rpx;
}

.service-card {
  flex: 1;
  min-height: 156rpx;
  padding: 24rpx;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.service-title {
  margin-top: 16rpx;
  color: #302A23;
  font-size: 27rpx;
  font-weight: 600;
  line-height: 1.2;
}

.service-desc {
  margin-top: 8rpx;
  color: #8F877A;
  font-size: 22rpx;
  line-height: 1.35;
}

.hospital-section {
  margin-top: 30rpx;
}

.data-note,
.demo-pill {
  padding: 8rpx 14rpx;
  border-radius: 999rpx;
  background: #F1ECE3;
  color: #8C7557;
  font-size: 20rpx;
  line-height: 1.2;
}

.hospital-card {
  margin-top: 18rpx;
  padding: 26rpx;
}

.hospital-main {
  min-width: 0;
}

.hospital-name {
  display: block;
  color: #302A23;
  font-size: 30rpx;
  font-weight: 600;
  line-height: 1.25;
}

.hospital-level {
  display: block;
  margin-top: 8rpx;
  color: #8F877A;
  font-size: 22rpx;
  line-height: 1.35;
}

.tag-row {
  margin-top: 18rpx;
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}

.tag-chip {
  padding: 9rpx 14rpx;
  border-radius: 999rpx;
  background: #F7F3EA;
  color: #6B5D4D;
  font-size: 21rpx;
  line-height: 1.2;
}

.address-row {
  margin-top: 18rpx;
  align-items: flex-start;
  color: #7C756B;
  font-size: 23rpx;
  line-height: 1.45;
  gap: 8rpx;
}

.action-row {
  margin-top: 22rpx;
  gap: 14rpx;
}

.action-btn {
  flex: 1;
  height: 74rpx;
  padding: 0;
  margin: 0;
  border-radius: 14rpx;
  background: #F1ECE3;
  color: #6B5D4D;
  font-size: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
}

.action-btn.primary {
  background: #302A23;
  color: #FBFAF6;
}
</style>
<style scoped>
.followup-draft-label{display:block;margin:12px 0 4px;color:#596650;font-size:calc(12px * var(--ui-font-scale,1));line-height:1.6;}
.care-page .followup-form .followup-later{flex:1;text-align:center;min-height:44px;padding:12px 10px;border:1px solid var(--pety-rule,#E8E0D4);border-radius:14px;}
.care-page .followup-form .followup-cancel{display:block;margin:12px auto 0;min-height:44px;font-size:calc(12px * var(--ui-font-scale,1));color:#756d60;white-space:normal;}
</style>
