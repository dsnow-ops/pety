<template>
  <view :class="[petThemeClass, 'archive-page ui-v2', themeClass, reduceMotion ? 'reduce-motion' : '']" :style="appThemeStyle">
    <scroll-view scroll-y class="archive-scroll">
      <view class="top-bar">
        <button class="icon-button" hover-class="icon-button-hover" @click="goBack">
          <uni-icons type="left" size="22" color="currentColor"></uni-icons>
        </button>
        <view class="title-copy">
          <text class="title-kicker">PET ARCHIVE</text>
          <text class="title-main">宝贝档案</text>
        </view>
        <view class="icon-placeholder"></view>
      </view>

      <view v-if="activePet" class="pet-card">
        <PetAvatarImage :key="activePet.id" :pet="activePet" class="pet-photo" />
        <view class="pet-copy">
          <text class="pet-name">{{ activePet.name }}</text>
          <text class="pet-desc">档案越完整，问诊时越能少说重复的话</text>
          <view class="stage-row">
            <text class="stage-pill">{{ relationshipConfig.stageName }}</text>
            <text class="stage-desc">{{ relationshipConfig.coreTask }}</text>
          </view>
          <view class="avatar-state-row">
            <text class="avatar-state-pill">{{ avatarStatusText }}</text>
            <text class="avatar-style-text">{{ avatarStyleText }}</text>
          </view>
          <button class="avatar-regenerate-btn" hover-class="avatar-regenerate-btn-hover" @click="regenerateAvatarMock">
            重新生成形象
          </button>
        </view>
        <view class="completion-ring">
          <text>{{ completion }}%</text>
        </view>
      </view>

      <view v-else class="empty-panel">
        <text class="empty-title">还没有宝贝</text>
        <text class="empty-desc">先添加一只宝贝，再建立档案。</text>
      </view>

      <view v-if="archiveReadError" class="archive-error section-card">
        <text class="section-title">档案暂时无法读取</text>
        <text class="identity-help">原资料已保留，请重新读取后再编辑。</text>
        <button class="archive-retry" @click="loadArchive">重新读取档案</button>
      </view>
      <view v-if="activePet && !archiveReadError" class="form-section">
        <view class="section-card identity-settings"><text class="section-title">名字与首页展示</text><text class="identity-help">修改名字不改变记录归属，已保存的作品保留原来的名字。</text><view class="rename-row"><input class="rename-input" v-model="nameDraft" maxlength="24" placeholder="宠物名字" aria-label="宠物名字"/><AppButton @click="renamePet">保存名字</AppButton></view><text class="identity-label">首页主视觉</text><AppSegmented class="display-options" :model-value="activePet.heroDisplayMode||'auto'" :options="displayChoices.map(c=>({value:c.id,label:c.label}))" @change="setDisplayMode"/><text class="identity-help">自动优先使用 AI 形象，没有时显示原照片。只切换已有资源，不生成新图片。</text><text v-if="identityMessage" class="identity-feedback">{{identityMessage}}</text></view>
        <view class="section-card"><text class="section-title">专属印记</text><text class="identity-help">把已有形象或原照片收进一枚朱印或压印。本地处理，不消耗生图次数。</text><button class="seal-create" :disabled="sealBusy" @click="createSeal">{{sealBusy?'正在制作…':activePet.petSeal?'更新这枚印记':'制作专属印记'}}</button><text v-if="activePet.petSeal" class="identity-help">印记已保存。新作品可主动选择朱印或压印，旧作品保持原样。</text><text v-if="sealMessage" class="identity-feedback">{{sealMessage}}</text><view v-if="sealPreviews.length" class="seal-previews"><view v-for="(url,i) in sealPreviews" :key="i"><image :src="url" mode="aspectFit"/><text>{{i===0?'朱印':'压印'}}</text></view></view><PetSealMaker ref="sealMaker"/></view>
        <view class="section-card memorial-mode-card">
          <text class="section-title">关系模式</text>
          <text class="memorial-mode-desc">{{ memorialModeDesc }}</text>
          <view class="memorial-chat-setting">
            <text class="memorial-setting-title">你和 {{ activePet.name }} 的关系</text>
            <view
              class="memorial-setting-row"
              hover-class="memorial-setting-row-hover"
              @click="openOwnerCallSetup"
            >
              <view class="memorial-setting-copy">
                <text class="memorial-setting-label">关系称呼</text>
                <text class="memorial-setting-desc">{{ ownerRelationDesc }}</text>
              </view>
              <view class="memorial-setting-value">
                <text>{{ ownerCallDisplayText }}</text>
                <uni-icons type="right" size="16" color="#9995A1"></uni-icons>
              </view>
            </view>
            <view
              v-if="isMemorialArchive"
              class="memorial-setting-row persona-entry"
              hover-class="memorial-setting-row-hover"
              @click="openMemorialPersona"
            >
              <view class="memorial-setting-copy">
                <text class="memorial-setting-label">让归爪更像他/她</text>
                <text class="memorial-setting-desc">补充真实的小习惯、表达方式和边界</text>
              </view>
              <view class="memorial-setting-value">
                <text>{{ personaEntryStatus }}</text>
                <uni-icons type="right" size="16" color="#9995A1"></uni-icons>
              </view>
            </view>
          </view>
          <button
            class="mode-toggle-btn"
            hover-class="mode-toggle-btn-hover"
            @click="toggleMemorialMode"
          >
            {{ memorialModeButtonText }}
          </button>
          <button class="archive-calendar-link" hover-class="mode-toggle-btn-hover" @click="openCalendar">
            <uni-icons type="calendar" size="17" color="#77717B"></uni-icons>
            <text>查看完整记录日历</text>
          </button>
        </view>

        <view class="section-card">
          <text class="section-title">基础信息</text>

          <view class="field-group">
            <text class="field-label">物种</text>
            <view class="chip-row">
              <view
                v-for="item in speciesOptions"
                :key="item.key"
                :class="['choice-chip', form.species === item.key ? 'choice-chip-active' : '']"
                @click="form.species = item.key"
              >
                <text>{{ item.label }}</text>
              </view>
            </view>
          </view>

          <view class="field-group">
            <text class="field-label">品种</text>
            <input class="field-input" v-model="form.breed" placeholder="例如：布偶、田园猫、柯基" placeholder-style="color:#AAA195" />
          </view>

          <view class="field-group">
            <text class="field-label">性别</text>
            <view class="chip-row">
              <view
                v-for="item in genderOptions"
                :key="item.key"
                :class="['choice-chip', form.gender === item.key ? 'choice-chip-active' : '']"
                @click="form.gender = item.key"
              >
                <text>{{ item.label }}</text>
              </view>
            </view>
          </view>

          <view class="two-col">
            <view class="field-group">
              <text class="field-label">生日</text>
              <picker mode="date" :value="form.birthday" @change="setDate('birthday', $event)">
                <view class="picker-field">{{ form.birthday || '选择日期' }}</view>
              </picker>
            </view>
            <view class="field-group">
              <text class="field-label">体重</text>
              <input class="field-input" v-model="form.weight" placeholder="例如：4.5kg" placeholder-style="color:#AAA195" />
            </view>
          </view>

          <view class="field-group">
            <text class="field-label">绝育情况</text>
            <view class="chip-row">
              <view
                v-for="item in neuteredOptions"
                :key="item.key"
                :class="['choice-chip', form.neutered === item.key ? 'choice-chip-active' : '']"
                @click="form.neutered = item.key"
              >
                <text>{{ item.label }}</text>
              </view>
            </view>
          </view>
        </view>

        <view class="section-card">
          <text class="section-title">健康背景</text>

          <view class="two-col">
            <view class="field-group">
              <text class="field-label">最近疫苗</text>
              <picker mode="date" :value="form.vaccineDate" @change="setDate('vaccineDate', $event)">
                <view class="picker-field">{{ form.vaccineDate || '选择日期' }}</view>
              </picker>
            </view>
            <view class="field-group">
              <text class="field-label">最近驱虫</text>
              <picker mode="date" :value="form.dewormDate" @change="setDate('dewormDate', $event)">
                <view class="picker-field">{{ form.dewormDate || '选择日期' }}</view>
              </picker>
            </view>
          </view>

          <view class="field-group">
            <text class="field-label">过敏史</text>
            <textarea class="field-textarea small" v-model="form.allergies" placeholder="没有可留空，例如：鸡肉过敏、某种药物过敏" placeholder-style="color:#AAA195" maxlength="200" :show-confirm-bar="false"></textarea>
          </view>

          <view class="field-group">
            <text class="field-label">慢性病 / 既往病史</text>
            <textarea class="field-textarea small" v-model="form.chronicDiseases" placeholder="例如：肠胃敏感、皮肤病史、肾脏问题" placeholder-style="color:#AAA195" maxlength="240" :show-confirm-bar="false"></textarea>
          </view>

          <view class="field-group">
            <text class="field-label">常用药 / 保健品</text>
            <textarea class="field-textarea small" v-model="form.medicines" placeholder="例如：益生菌、处方粮、长期用药" placeholder-style="color:#AAA195" maxlength="240" :show-confirm-bar="false"></textarea>
          </view>
        </view>

        <view class="section-card">
          <text class="section-title">生活习惯</text>

          <view class="field-group">
            <text class="field-label">日常饮食</text>
            <textarea class="field-textarea" v-model="form.diet" placeholder="例如：主食罐 + 干粮，每日两餐，最近换粮中" placeholder-style="color:#AAA195" maxlength="300" :show-confirm-bar="false"></textarea>
          </view>

          <view class="field-group">
            <text class="field-label">性格与习惯</text>
            <textarea class="field-textarea" v-model="form.temperament" placeholder="例如：胆小、容易应激、喜欢晚上活动、挑食" placeholder-style="color:#AAA195" maxlength="300" :show-confirm-bar="false"></textarea>
          </view>

          <view class="field-group">
            <text class="field-label">给自己的备注</text>
            <textarea class="field-textarea" v-model="form.note" placeholder="首页会优先显示这段备注，可写下最想被记住的信息。" placeholder-style="color:#AAA195" maxlength="300" :show-confirm-bar="false"></textarea>
          </view>
        </view>

        <text v-if="archiveSaveMessage" class="archive-save-message">{{ archiveSaveMessage }}</text>
        <button class="save-btn" hover-class="save-btn-hover" @click="saveArchive">保存档案</button>
      </view>
    </scroll-view>

    <view v-if="showOwnerCallSetup" class="owner-call-mask" @click="closeOwnerCallSetup">
      <view class="owner-call-sheet" @click.stop>
        <text class="owner-call-title">你和 {{ activePet && activePet.name }} 的关系</text>
        <text class="owner-call-subtitle">{{ ownerRelationSheetSubtitle }}</text>
        <view class="owner-call-options">
          <button
            v-for="option in ownerCallOptions"
            :key="option.key"
            :class="['owner-call-option', selectedOwnerCallType === option.key ? 'owner-call-option-active' : '']"
            hover-class="owner-call-option-hover"
            @click="selectOwnerCallOption(option)"
          >
            {{ option.label }}
          </button>
        </view>
        <input
          v-if="selectedOwnerCallType === 'custom'"
          v-model="customOwnerCall"
          class="owner-call-input"
          maxlength="20"
          placeholder="输入自定义关系"
          placeholder-style="color:#9995A1"
        />
        <view class="owner-call-actions">
          <button class="owner-call-cancel" hover-class="owner-call-action-hover" @click="closeOwnerCallSetup">取消</button>
          <button class="owner-call-save" hover-class="owner-call-action-hover" @click="saveOwnerCall">保存</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import PetSealMaker from "../../components/PetSealMaker.vue";
import {hydrateHeroVisualAsset} from "../../common/home-hero-asset.js";
import {captureDataScope,isDataScopeCurrent} from "../../common/scoped-storage.js";
import {subscribeAccountScope} from "../../common/auth-store.js";
import PetAvatarImage from '../../components/PetAvatarImage.vue';
import { getActivePet, setActivePet, updatePet, notifyPetDataChanged } from '../../common/pet-store.js';
import { getPetProfile, getProfileCompletion, savePetProfile } from '../../common/profile-store.js';
import { getOwnerRelationLabel, getPetRelationshipStage, getRelationshipConfig, getRelationshipThemeClass, isMemorialMode, withRelationshipStage } from '../../common/relationship-config.js';
import { getAvatarStatusText, getAvatarStyleText } from '../../common/pet-avatar-generator.js';
import {
  getMemorialOwnerCallDraft,
  MEMORIAL_OWNER_CALL_OPTIONS,
  saveMemorialOwnerCall
} from '../../common/memorial-owner-call.js';
import { getMemorialPersona, openMemorialPersona as openMemorialPersonaPage, scheduleMemorialPersonaIntro } from '../../common/memorial-persona.js';
import { isReduceMotionEnabled, mediumHaptic } from '../../common/haptics.js';

export default {
  components: { PetSealMaker, PetAvatarImage },
  data() {
    return {
      nameDraft:"",identityMessage:"",sealBusy:false,sealMessage:"",sealPreviews:[],sealPreviewEpoch:0,displayChoices:[{id:"auto",label:"自动"},{id:"ai",label:"AI 形象"},{id:"original",label:"用户原照片"}],
      loadedDataScope:captureDataScope(),unsubscribeDataScope:null,activePet: null,
      archiveVisible:false,archiveVersion:0,archiveReadError:false,archiveSaveMessage:'',profileSnapshot:null,ownerCallContext:null,archiveContextError:false,
      routePetId: '',
      form: getPetProfile(),
      showOwnerCallSetup: false,
      selectedOwnerCallType: '',
      customOwnerCall: '',
      memorialPersona: getMemorialPersona(),
      reduceMotion: isReduceMotionEnabled(),
      personaIntroTimer: null,
      archiveSaveTimer: null,
      ownerCallOptions: MEMORIAL_OWNER_CALL_OPTIONS,
      speciesOptions: [
        { key: 'cat', label: '猫' },
        { key: 'dog', label: '狗' },
        { key: 'rabbit', label: '兔' },
        { key: 'bird', label: '鸟' },
        { key: 'other', label: '其他' }
      ],
      genderOptions: [
        { key: 'male', label: '男孩' },
        { key: 'female', label: '女孩' },
        { key: 'unknown', label: '未知' }
      ],
      neuteredOptions: [
        { key: 'yes', label: '已绝育' },
        { key: 'no', label: '未绝育' },
        { key: 'unknown', label: '未知' }
      ]
    };
  },
  computed: {
    relationshipStage() {
      return getPetRelationshipStage(this.activePet);
    },
    relationshipConfig() {
      return getRelationshipConfig(this.relationshipStage);
    },
    themeClass() {
      return getRelationshipThemeClass(this.relationshipStage);
    },
    avatarStatusText() {
      return getAvatarStatusText(this.activePet);
    },
    avatarStyleText() {
      return getAvatarStyleText(this.activePet && this.activePet.avatarStyle, this.relationshipStage);
    },
    memorialModeDesc() {
      return isMemorialMode(this.relationshipStage)
        ? '纪念模式已开启。首页、记录和聊天会保持原布局，并切换为纪念氛围。'
        : '如需要，可以主动开启温柔纪念模式；它不会删除任何档案和记录。';
    },
    memorialModeButtonText() {
      return isMemorialMode(this.relationshipStage)
        ? '恢复为陪伴模式'
        : (getRelationshipConfig('deceased').modeEntryLabel || '进入温柔纪念模式');
    },
    isMemorialArchive() {
      return isMemorialMode(this.relationshipStage);
    },
    ownerCallDisplayText() {
      return getOwnerRelationLabel(this.activePet) || '暂不设置';
    },
    ownerRelationDesc() {
      if (this.isMemorialArchive) {
        return '纪念对话中，他/她可以直接这样称呼你';
      }
      const relation = getOwnerRelationLabel(this.activePet);
      return relation
        ? `照护建议需要称呼时，会使用“${this.activePet.name}的${relation}”`
        : '用于档案关系；照护助手不会自行猜测称呼';
    },
    ownerRelationSheetSubtitle() {
      return this.isMemorialArchive
        ? '纪念对话中，他/她可以直接使用这个称呼。'
        : `照护助手需要称呼时，只会使用“${this.activePet && this.activePet.name}的关系称呼”。`;
    },
    completion() {
      return getProfileCompletion(this.form);
    },
    personaEntryStatus() {
      return this.memorialPersona.completed ? '已完成' : (this.memorialPersona.updatedAt ? '继续完善' : '开始');
    }
  },
  onLoad(options = {}) {
    this.loadedDataScope=captureDataScope();
    this.unsubscribeDataScope=subscribeAccountScope(()=>{if(this.archiveVisible)this.loadArchive();else{this.activePet=null;this.showOwnerCallSetup=false;this.archiveVersion++;}});
    this.routePetId = String(options.petId || '');
  },
  onShow() {
    this.archiveVisible=true;
    this.loadArchive();
  },
  onHide() {
    this.archiveVisible=false;this.archiveVersion++;this.showOwnerCallSetup=false;
    this.clearPageTimers();
  },
  onUnload() {
    this.archiveVisible=false;this.archiveVersion++;this.showOwnerCallSetup=false;
    this.unsubscribeDataScope?.();this.unsubscribeDataScope=null;
    this.clearPageTimers();
  },
  methods: {
    archiveContext(){return{scope:this.loadedDataScope,petId:this.activePet?.id,version:this.archiveVersion,stage:this.relationshipStage};},
    isArchiveCurrent(owner=this.archiveContext()) {
      this.archiveContextError=false;
      try{return Boolean(this.archiveVisible&&!this.archiveReadError&&isDataScopeCurrent(owner.scope)&&owner.version===this.archiveVersion&&owner.petId&&owner.petId===this.activePet?.id&&owner.petId===getActivePet()?.id);}catch(_){this.archiveContextError=true;return false;}
    },
    staleArchiveNotice(){uni.showToast({title:this.archiveContextError?'档案状态暂时无法确认，请重试':'宠物或账号状态已变化，请重新打开档案',icon:'none'});},
    async loadSealPreviews(){const epoch=++this.sealPreviewEpoch;this.sealPreviews=[];const pet=this.activePet,scope=this.loadedDataScope;if(!pet?.petSeal)return;const valid=()=>epoch===this.sealPreviewEpoch&&isDataScopeCurrent(scope)&&getActivePet()?.id===pet.id&&this.activePet?.petSeal?.createdAt===pet.petSeal.createdAt;await this.$nextTick();try{const previews=[];for(const style of ['vermilion','emboss'])previews.push(await this.$refs.sealMaker.preview(pet.petSeal,style,valid));if(valid())this.sealPreviews=previews;}catch(_){if(valid())this.sealMessage='印记已保存，预览暂未完成。';}},
    async createSeal(){if(this.sealBusy||!this.activePet)return;const pet=this.activePet,scope=this.loadedDataScope,valid=()=>isDataScopeCurrent(scope)&&getActivePet()?.id===pet.id;this.sealBusy=true;this.sealMessage='';try{const source=await hydrateHeroVisualAsset(pet);if(!source.imageUrl)throw Error('SEAL_SOURCE_MISSING');const asset=await this.$refs.sealMaker.create(source.imageUrl,source.displayFileId,valid);if(valid()&&this.saveIdentity({petSeal:asset})){this.sealMessage='专属印记已保存，可用于朱印与压印两种样式。';await this.loadSealPreviews();}}catch(e){if(valid())this.sealMessage=e.message==='SEAL_SOURCE_MISSING'?'没有可读取的已有照片或形象，请先选择可用的主视觉。':'未能读取照片像素，请确认照片已保存且允许本地读取。没有消耗生图次数。';}finally{this.sealBusy=false;}},
    saveIdentity(patch) {if(!this.isArchiveCurrent()){if(this.archiveContextError)this.identityMessage='修改未保存，请重试；输入已保留。';else this.staleArchiveNotice();return false;}try{const pet=updatePet(this.activePet.id,patch);if(!pet)throw Error('PET_UPDATE_UNCONFIRMED');this.activePet=pet;notifyPetDataChanged();return true;}catch(_){this.identityMessage='修改未保存，请重试；输入已保留。';return false;}},
    renamePet(){const name=this.nameDraft.trim();if(!name){this.identityMessage='请填写宠物名字';return;}if(this.saveIdentity({name}))this.identityMessage='名字已更新；旧作品保留原快照。';},
    setDisplayMode(mode){if(mode==='original'&&!this.activePet.originalPhotoUrl){this.identityMessage='尚无已保存的原照片，请先在宠物资料中上传照片。';return;}if(this.saveIdentity({heroDisplayMode:mode}))this.identityMessage='首页展示已更新';},
    clearPageTimers() {
      if (this.personaIntroTimer) clearTimeout(this.personaIntroTimer);
      if (this.archiveSaveTimer) clearTimeout(this.archiveSaveTimer);
      this.personaIntroTimer = null;
      this.archiveSaveTimer = null;
    },
    loadArchive() {
      this.archiveVersion++;this.clearPageTimers();this.showOwnerCallSetup=false;this.ownerCallContext=null;this.archiveReadError=false;this.archiveSaveMessage='';
      if(!isDataScopeCurrent(this.loadedDataScope)){this.routePetId="";this.clearPageTimers();}
      this.loadedDataScope=captureDataScope();
      try {
      const activePet = this.routePetId ? (setActivePet(this.routePetId) || getActivePet()) : getActivePet();
      this.activePet = activePet;
      this.nameDraft=activePet?.name||"";this.loadSealPreviews();
      this.form = activePet ? getPetProfile(activePet.id,{strict:true}) : getPetProfile();
      this.profileSnapshot=JSON.parse(JSON.stringify(this.form));
      this.memorialPersona = activePet ? getMemorialPersona(activePet.id) : getMemorialPersona();
      this.reduceMotion = isReduceMotionEnabled();
      this.showOwnerCallSetup = false;
      this.$nextTick(() => this.schedulePersonaIntro());
      } catch (_) {this.archiveReadError=true;this.profileSnapshot=null;this.clearPageTimers();}
    },
    setDate(key, event) {
      this.form[key] = event.detail.value;
    },
    saveArchive() {
      if(!this.isArchiveCurrent()){this.staleArchiveNotice();return;}
      if (!this.activePet) {
        uni.showToast({ title: '请先添加宝贝', icon: 'none' });
        return;
      }

      const owner=this.archiveContext();
      try {
        const saved=savePetProfile(this.activePet.id,this.form,{expected:this.profileSnapshot});
        if(!saved)throw Error('PROFILE_SAVE_UNCONFIRMED');
        this.form=saved;this.profileSnapshot=JSON.parse(JSON.stringify(saved));this.archiveSaveMessage='';
      } catch(error) {
        this.archiveSaveMessage=error.code==='PET_PROFILE_CHANGED'?'另一处已更新档案。本次输入已保留，请核对新资料后再修改。':'档案未保存，输入已保留，请重试。';
        uni.showToast({title:error.code==='PET_PROFILE_CHANGED'?'档案已有更新，本次未覆盖':'档案未保存，请重试',icon:'none'});return;
      }
      uni.showToast({ title: '档案已保存', icon: 'success' });
      if(this.archiveSaveTimer)clearTimeout(this.archiveSaveTimer);
      this.archiveSaveTimer = setTimeout(() => {
        this.archiveSaveTimer = null;
        if(this.isArchiveCurrent(owner))this.goBack();
      }, 650);
    },
    toggleMemorialMode() {
      if(!this.isArchiveCurrent()){this.staleArchiveNotice();return;}
      const owner=this.archiveContext();
      if (!this.activePet) return;

      if (isMemorialMode(this.relationshipStage)) {
        uni.showModal({
          title: '恢复为陪伴模式',
          content: '这会把 App 的文案、记录语义和聊天身份恢复为陪伴模式，不会删除任何档案和记录。',
          cancelText: '先不恢复',
          confirmText: '恢复陪伴',
          confirmColor: '#8C7557',
          success: (res) => {
            if (res.confirm) this.updateRelationshipMode('current', '已恢复为陪伴模式',owner);
          }
        });
        return;
      }

      const memorialConfig = getRelationshipConfig('deceased');
      uni.showModal({
        title: memorialConfig.modeConfirmTitle,
        content: memorialConfig.modeConfirmText,
        cancelText: '先不进入',
        confirmText: '进入纪念',
        confirmColor: '#8C7557',
        success: (res) => {
          if (res.confirm) this.updateRelationshipMode('deceased', '纪念模式已开启',owner);
        }
      });
    },
    updateRelationshipMode(stage, toastTitle, owner=this.archiveContext()) {
      if(!this.isArchiveCurrent(owner)){this.staleArchiveNotice();return;}
      try{if(getPetRelationshipStage(getActivePet())!==owner.stage){this.staleArchiveNotice();return;}const updatedPet=updatePet(owner.petId,withRelationshipStage({},stage));if(!updatedPet)throw Error('MODE_SAVE_UNCONFIRMED');this.activePet=updatedPet;}catch(_){uni.showToast({title:'模式修改未确认，请重新读取档案',icon:'none'});return;}
      mediumHaptic();
      uni.showToast({ title: toastTitle, icon: 'none' });
      if (stage === 'deceased') {
        this.schedulePersonaIntro();
      }
    },
    schedulePersonaIntro() {
      if (this.personaIntroTimer) clearTimeout(this.personaIntroTimer);
      if (!this.isArchiveCurrent()) return;
      const petId = this.activePet.id;
      const owner=this.archiveContext();
      const stage = this.relationshipStage;
      this.personaIntroTimer = scheduleMemorialPersonaIntro({
        petId,
        relationshipStage: stage,
        delay: 420,
        isStillCurrent: () => Boolean(
          this.isArchiveCurrent(owner) && this.activePet &&
          this.activePet.id === petId &&
          this.relationshipStage === stage
        ),
        onStart: () => this.openMemorialPersona()
      });
    },
    openMemorialPersona() {
      if (!this.activePet) return;
      openMemorialPersonaPage(this.activePet.id);
    },
    openCalendar() {
      uni.navigateTo({ url: '/pages/calendar/calendar' });
    },
    openOwnerCallSetup() {
      if (!this.isArchiveCurrent()){this.staleArchiveNotice();return;}
      this.ownerCallContext=this.archiveContext();
      const draft = getMemorialOwnerCallDraft(this.activePet);
      this.selectedOwnerCallType = draft.selectedType;
      this.customOwnerCall = draft.customValue;
      this.showOwnerCallSetup = true;
    },
    closeOwnerCallSetup() {
      this.showOwnerCallSetup = false;
      this.ownerCallContext=null;
    },
    selectOwnerCallOption(option) {
      this.selectedOwnerCallType = option.key;
      if (option.key !== 'custom') this.customOwnerCall = '';
    },
    saveOwnerCall() {
      if(!this.ownerCallContext||!this.isArchiveCurrent(this.ownerCallContext)){this.staleArchiveNotice();return;}
      let result;try{result = saveMemorialOwnerCall(
        this.activePet && this.activePet.id,
        this.selectedOwnerCallType,
        this.customOwnerCall
      );}catch(_){uni.showToast({title:'称呼保存未确认，输入已保留，请重试',icon:'none'});return;}
      if (!result.ok) {
        uni.showToast({ title: result.error, icon: 'none' });
        return;
      }

      this.activePet = result.pet;
      this.showOwnerCallSetup = false;
      uni.showToast({
        title: result.value ? '称呼已更新' : '已暂不设置称呼',
        icon: 'none'
      });
    },
    regenerateAvatarMock() {
      if (!this.activePet) return;
      uni.navigateTo({
        url: `/pages/avatar-generate/avatar-generate?petId=${encodeURIComponent(this.activePet.id)}`
      });
    },
    goBack() {
      const pages = getCurrentPages();
      if (pages.length > 1) {
        uni.navigateBack();
        return;
      }
      uni.switchTab({ url: '/pages/profile/profile' });
    }
  }
}
</script>

<style scoped>
.archive-page {
  min-height: 100vh;
  background: var(--ui-surface);
  color: var(--ui-ink);
}

.archive-scroll {
  height: 100vh;
  padding: calc(var(--status-bar-height, 0px) + 30rpx) 30rpx calc(42rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.top-bar,
.pet-card,
.chip-row,
.two-col {
  display: flex;
}

.top-bar {
  align-items: center;
  justify-content: space-between;
}

.icon-button,
.icon-placeholder {
  width: 72rpx;
  height: 72rpx;
}

.icon-button {
  padding: 0;
  margin: 0;
  border-radius: 50%;
  background: var(--ui-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 12rpx 30rpx rgba(58, 51, 43, 0.06);
}

.icon-button::after,
.save-btn::after {
  border: none;
}

.icon-button-hover,
.save-btn-hover {
  opacity: 0.78;
}

.title-copy {
  text-align: center;
}

.title-kicker {
  display: block;
  color: var(--ui-muted);
  font-size: 20rpx;
  line-height: 1.3;
}

.title-main {
  display: block;
  margin-top: 6rpx;
  color: var(--ui-ink);
  font-size: 38rpx;
  font-weight: 600;
  line-height: 1.15;
}

.pet-card,
.empty-panel,
.section-card {
  margin-top: 28rpx;
  border-radius: 16rpx;
  background: var(--ui-surface);
  border: 1rpx solid #EEE6DA;
  box-shadow: 0 14rpx 34rpx rgba(58, 51, 43, 0.05);
}

.pet-card {
  align-items: center;
  padding: 24rpx;
}

.pet-photo {
  width: 92rpx;
  height: 92rpx;
  border-radius: 50%;
  flex-shrink: 0;
}

.pet-copy {
  flex: 1;
  min-width: 0;
  margin-left: 20rpx;
}

.pet-name {
  display: block;
  color: var(--ui-ink);
  font-size: 32rpx;
  font-weight: 600;
  line-height: 1.25;
}

.pet-desc,
.empty-desc {
  display: block;
  margin-top: 8rpx;
  color: var(--ui-muted);
  font-size: 23rpx;
  line-height: 1.45;
}

.stage-row {
  margin-top: 12rpx;
  display: flex;
  align-items: center;
  gap: 10rpx;
  flex-wrap: wrap;
}

.stage-pill {
  padding: 7rpx 14rpx;
  border-radius: 999rpx;
  background: var(--ui-surface);
  color: var(--ui-muted);
  font-size: 20rpx;
  line-height: 1.2;
}

.stage-desc {
  color: var(--ui-muted);
  font-size: 21rpx;
  line-height: 1.3;
}

.avatar-state-row {
  margin-top: 10rpx;
  display: flex;
  align-items: center;
  gap: 10rpx;
  flex-wrap: wrap;
}

.avatar-state-pill {
  padding: 7rpx 14rpx;
  border-radius: 999rpx;
  background: var(--ui-surface);
  color: var(--ui-muted);
  font-size: 20rpx;
  line-height: 1.2;
}

.avatar-style-text {
  color: var(--ui-muted);
  font-size: 21rpx;
  line-height: 1.3;
}

.avatar-regenerate-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin: 12rpx 0 0;
  padding: 0 18rpx;
  height: 52rpx;
  border-radius: 999rpx;
  background: var(--ui-surface);
  color: var(--ui-muted);
  font-size: 21rpx;
  line-height: 52rpx;
}

.avatar-regenerate-btn::after {
  border: none;
}

.avatar-regenerate-btn-hover {
  opacity: 0.78;
}

.completion-ring {
  width: 82rpx;
  height: 82rpx;
  border-radius: 50%;
  border: 6rpx solid #D7C7B3;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ui-muted);
  font-size: 22rpx;
  font-weight: 600;
}

.empty-panel {
  padding: 34rpx;
}

.empty-title {
  display: block;
  color: var(--ui-ink);
  font-size: 32rpx;
  font-weight: 600;
}

.section-card {
  padding: 28rpx;
}

.memorial-mode-card {
  margin-top: 28rpx;
}

.memorial-mode-desc {
  display: block;
  margin-top: 12rpx;
  color: var(--ui-muted);
  font-size: 24rpx;
  line-height: 1.5;
}

.memorial-chat-setting {
  margin-top: 24rpx;
  padding-top: 22rpx;
  border-top: 1rpx solid rgba(140, 117, 87, 0.12);
}

.memorial-setting-title {
  display: block;
  color: var(--ui-text);
  font-size: 25rpx;
  font-weight: 600;
}

.memorial-setting-row {
  min-height: 96rpx;
  margin-top: 14rpx;
  padding: 18rpx 20rpx;
  border-radius: 20rpx;
  border: 1rpx solid var(--ui-border);
  background: var(--ui-surface);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  box-sizing: border-box;
  transition: transform 160ms ease, opacity 160ms ease;
}

.memorial-setting-row-hover {
  opacity: 0.84;
  transform: scale(0.985);
}

.memorial-setting-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.memorial-setting-label {
  color: var(--ui-text);
  font-size: 26rpx;
  line-height: 1.3;
}

.memorial-setting-desc {
  margin-top: 6rpx;
  color: var(--ui-muted);
  font-size: 21rpx;
  line-height: 1.35;
}

.memorial-setting-value {
  flex-shrink: 0;
  max-width: 210rpx;
  color: var(--ui-muted);
  font-size: 24rpx;
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.memorial-setting-value text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mode-toggle-btn {
  margin-top: 22rpx;
  width: 100%;
  height: 78rpx;
  border-radius: 16rpx;
  background: var(--ui-surface);
  color: var(--ui-muted);
  font-size: 26rpx;
  line-height: 78rpx;
}

.mode-toggle-btn::after {
  border: none;
}

.mode-toggle-btn-hover {
  opacity: 0.78;
}

.section-title {
  display: block;
  color: var(--ui-ink);
  font-size: 31rpx;
  font-weight: 600;
  line-height: 1.25;
}

.field-group {
  margin-top: 24rpx;
}

.field-label {
  display: block;
  color: var(--ui-muted);
  font-size: 22rpx;
  line-height: 1.3;
}

.chip-row {
  margin-top: 14rpx;
  flex-wrap: wrap;
  gap: 12rpx;
}

.choice-chip {
  padding: 15rpx 22rpx;
  border-radius: 999rpx;
  background: var(--ui-surface);
  border: 1rpx solid #EEE6DA;
  color: var(--ui-muted);
  font-size: 24rpx;
  line-height: 1.2;
}

.choice-chip-active {
  background: #302A23;
  border-color: var(--ui-line);
  color: var(--ui-ink);
}

.two-col {
  gap: 18rpx;
}

.two-col .field-group {
  flex: 1;
}

.field-input,
.picker-field,
.field-textarea {
  margin-top: 14rpx;
  width: 100%;
  border-radius: 16rpx;
  background: var(--ui-surface);
  border: 1rpx solid #EEE6DA;
  color: var(--ui-ink);
  font-size: 27rpx;
  box-sizing: border-box;
}

.field-input,
.picker-field {
  height: 78rpx;
  padding: 0 22rpx;
  line-height: 78rpx;
}

.field-textarea {
  min-height: 150rpx;
  padding: 20rpx 22rpx;
  line-height: 1.55;
}

.field-textarea.small {
  min-height: 116rpx;
}

.save-btn {
  margin-top: 30rpx;
  margin-bottom: 28rpx;
  width: 100%;
  height: 92rpx;
  border-radius: 16rpx;
  background: #8C7557;
  color: var(--ui-ink);
  font-size: 30rpx;
  font-weight: 600;
  line-height: 92rpx;
}

.owner-call-mask {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 30;
  padding: 32rpx;
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  display: flex;
  align-items: flex-end;
  background: rgba(37, 38, 44, 0.34);
}

.owner-call-sheet {
  width: 100%;
  padding: 34rpx;
  border-radius: 34rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.62);
  background: rgba(248, 247, 250, 0.96);
  box-shadow: 0 30rpx 80rpx rgba(49, 48, 60, 0.18);
  box-sizing: border-box;
}

.owner-call-title,
.owner-call-subtitle {
  display: block;
}

.owner-call-title {
  color: var(--ui-ink);
  font-size: 34rpx;
  font-weight: 600;
}

.owner-call-subtitle {
  margin-top: 10rpx;
  color: rgba(41, 43, 50, 0.58);
  font-size: 24rpx;
  line-height: 1.5;
}

.owner-call-options {
  margin-top: 26rpx;
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
}

.owner-call-option {
  min-width: 128rpx;
  height: 68rpx;
  margin: 0;
  padding: 0 20rpx;
  border-radius: 999rpx;
  border: 1rpx solid rgba(95, 100, 120, 0.16);
  background: var(--ui-surface);
  color: var(--ui-muted);
  font-size: 24rpx;
}

.owner-call-option-active {
  color: var(--ui-ink);
  background: #5F6478;
  border-color: var(--ui-line);
}

.owner-call-input {
  width: 100%;
  height: 82rpx;
  margin-top: 22rpx;
  padding: 0 24rpx;
  border-radius: 20rpx;
  border: 1rpx solid rgba(95, 100, 120, 0.18);
  background: var(--ui-surface);
  color: var(--ui-ink);
  font-size: 26rpx;
  box-sizing: border-box;
}

.owner-call-actions {
  margin-top: 30rpx;
  display: flex;
  gap: 16rpx;
}

.owner-call-cancel,
.owner-call-save {
  flex: 1;
  height: 78rpx;
  margin: 0;
  border-radius: 22rpx;
  font-size: 25rpx;
  transition: transform 160ms ease, opacity 160ms ease;
}

.owner-call-cancel {
  color: var(--ui-muted);
  background: var(--ui-surface);
}

.owner-call-save {
  color: var(--ui-ink);
  background: #5F6478;
}

.owner-call-option::after,
.owner-call-cancel::after,
.owner-call-save::after {
  border: none;
}

.owner-call-option-hover,
.owner-call-action-hover {
  opacity: 0.86;
  transform: scale(0.97);
}

.archive-page {
  background:
    var(--ui-surface);
}

.archive-page.theme-memorial {
}

.archive-scroll {
  animation: archiveFadeUp 360ms ease both;
}

.icon-button,
.pet-card,
.empty-panel,
.section-card,
.choice-chip,
.field-input,
.picker-field,
.field-textarea {
  border-color: var(--ui-border);
  background: var(--ui-card);
  box-shadow: 0 16rpx 42rpx rgba(72, 58, 43, 0.055);
}

.pet-card,
.empty-panel,
.section-card {
  border-radius: 30rpx;
}

.title-kicker,
.field-label,
.stage-pill,
.avatar-state-pill {
  color: var(--ui-muted);
}

.pet-desc,
.empty-desc,
.stage-desc,
.avatar-style-text,
.memorial-mode-desc {
  color: var(--ui-muted);
}

.stage-pill,
.avatar-state-pill,
.mode-toggle-btn,
.choice-chip,
.field-input,
.picker-field,
.field-textarea {
  background: var(--ui-surface);
}

.choice-chip-active,
.save-btn {
  background: var(--ui-accent);
  border-color: transparent;
}

.icon-button,
.avatar-regenerate-btn,
.mode-toggle-btn,
.choice-chip,
.save-btn {
  transition: transform 160ms ease, opacity 160ms ease;
}

.icon-button-hover {
  transform: scale(0.94);
  opacity: 0.82;
}

.avatar-regenerate-btn-hover,
.mode-toggle-btn-hover,
.save-btn-hover {
  transform: scale(0.98);
  opacity: 0.86;
}

@keyframes archiveFadeUp {
  from {
    opacity: 0;
    transform: translateY(16rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.persona-entry {
  margin-top: 12rpx;
  border-top: 1rpx solid var(--ui-border);
}

.archive-calendar-link {
  width: 100%;
  height: 80rpx;
  padding: 0 20rpx;
  margin: 14rpx 0 0;
  border-radius: 18rpx;
  background: var(--ui-surface);
  color: var(--ui-text);
  font-size: 24rpx;
  line-height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
}

.archive-calendar-link::after {
  border: none;
}

.reduce-motion .archive-scroll {
  animation: none;
}
.identity-help{display:block;color:var(--ui-muted);font-size:12px;line-height:1.8;margin:10px 0}.rename-row{display:flex;gap:12px;align-items:center;margin:18px 0}.rename-row input{flex:1;border-bottom:1px solid #cbd0c1;padding:12px 0;min-width:0}.rename-row button{background:#596650;color:#fff;font-size:13px;padding:8px 14px;line-height:1.5;border-radius:10px}.identity-label{display:block;font-size:14px;margin:24px 0 12px}.display-options{display:flex;gap:8px}.display-options button{flex:1;background:var(--ui-surface);color:var(--ui-muted);font-size:12px;line-height:1.5;padding:12px 3px;margin:0}.display-options button.selected{background:#596650;color:white}.identity-feedback{display:block;font-size:12px;color:var(--ui-ink);margin-top:14px}
.rename-input{display:block;flex:1;width:160px;height:44px;line-height:44px;min-width:0;color:var(--ui-ink);font-size:16px}
.seal-previews{display:flex;gap:18px;margin-top:18px}.seal-previews view{flex:1;text-align:center;color:var(--ui-muted);font-size:12px}.seal-previews image{display:block;width:100%;height:130px;border-radius:12px;margin-bottom:8px}.seal-create{background:var(--ui-surface);color:var(--ui-ink);font-size:14px;border-radius:12px}
.archive-error{padding:20px}.archive-save-message{display:block;margin:20px 0 12px;color:var(--ui-ink);font-size:calc(14px * var(--ui-font-scale,1));line-height:1.6}
.archive-retry{min-height:44px;margin:14px 0 0;padding:10px 16px;background:var(--ui-accent);color:var(--ui-ink);font-size:calc(15px * var(--ui-font-scale,1));line-height:1.5;border-radius:12px}
.archive-page .icon-button{width:44px;height:44px;flex-shrink:0}.archive-page .pet-name{overflow-wrap:anywhere}
.archive-page .field-label,.archive-page .identity-help,.archive-page .identity-feedback{font-size:calc(13px * var(--ui-font-scale,1));line-height:1.6}
.archive-page .field-input,.archive-page .picker-field,.archive-page .field-textarea{box-sizing:border-box;font-size:calc(16px * var(--ui-font-scale,1));line-height:1.5;color:var(--ui-ink)}
.archive-page .field-input,.archive-page .picker-field{height:auto;min-height:48px;padding:12px}.archive-page .field-input{height:48px}
.archive-page .field-textarea{min-height:120px;height:calc(120px * var(--ui-font-scale,1));padding:12px}
.archive-page .two-col .field-group{min-width:0}.archive-page.ui-large-text .two-col{flex-direction:column;gap:0}
.archive-page .choice-chip{box-sizing:border-box;min-height:44px;display:flex;align-items:center;font-size:calc(14px * var(--ui-font-scale,1));line-height:1.5}
.archive-page .choice-chip-active{color:var(--ui-ink)}
.archive-page .mode-toggle-btn,.archive-page .archive-calendar-link,.archive-page .save-btn{height:auto;min-height:48px;line-height:1.5;padding:12px;font-size:calc(15px * var(--ui-font-scale,1))}
.archive-page .owner-call-sheet{box-sizing:border-box;max-height:85vh;overflow-y:auto}
.archive-page .owner-call-title{font-size:calc(20px * var(--ui-font-scale,1));line-height:1.4;overflow-wrap:anywhere}
.archive-page .owner-call-subtitle{font-size:calc(13px * var(--ui-font-scale,1));line-height:1.6}
.archive-page .owner-call-option,.archive-page .owner-call-cancel,.archive-page .owner-call-save{height:auto;min-height:44px;line-height:1.5;padding:12px;font-size:calc(15px * var(--ui-font-scale,1))}
.archive-page .section-title{font-size:calc(18px * var(--ui-font-scale,1));line-height:1.5}
.archive-page .pet-name{font-size:calc(20px * var(--ui-font-scale,1));line-height:1.4}
.archive-page .pet-desc,.archive-page .stage-desc,.archive-page .avatar-style-text,.archive-page .memorial-mode-desc,.archive-page .memorial-setting-desc{font-size:calc(13px * var(--ui-font-scale,1));line-height:1.6}
.archive-page .memorial-setting-title,.archive-page .memorial-setting-label,.archive-page .memorial-setting-value{font-size:calc(14px * var(--ui-font-scale,1));line-height:1.5}
.archive-page .stage-pill,.archive-page .avatar-state-pill,.archive-page .avatar-regenerate-btn{font-size:calc(12px * var(--ui-font-scale,1));line-height:1.5}
.archive-page .owner-call-sheet{background:var(--ui-card);color:var(--ui-ink);border:1px solid var(--ui-line)}
.archive-page .owner-call-title{color:var(--ui-ink)}.archive-page .owner-call-subtitle{color:var(--ui-muted)}
.archive-page .owner-call-option,.archive-page .owner-call-cancel{background:var(--ui-surface);color:var(--ui-ink);border:1px solid var(--ui-line)}
.archive-page .owner-call-option-active,.archive-page .owner-call-save{background:var(--ui-accent);color:var(--ui-ink)}
.archive-page .owner-call-input{height:48px;box-sizing:border-box;font-size:calc(16px * var(--ui-font-scale,1));line-height:1.5;background:var(--ui-surface);color:var(--ui-ink);border:1px solid var(--ui-line)}
</style>
