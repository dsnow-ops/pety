<template>
  <view :class="['archive-page', themeClass, reduceMotion ? 'reduce-motion' : '']">
    <scroll-view scroll-y class="archive-scroll">
      <view class="top-bar">
        <button class="icon-button" hover-class="icon-button-hover" @click="goBack">
          <uni-icons type="left" size="22" color="#302A23"></uni-icons>
        </button>
        <view class="title-copy">
          <text class="title-kicker">PET ARCHIVE</text>
          <text class="title-main">宝贝档案</text>
        </view>
        <view class="icon-placeholder"></view>
      </view>

      <view v-if="activePet" class="pet-card">
        <image :src="petAvatarImage" class="pet-photo" mode="aspectFill"></image>
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
            重新生成形象（占位）
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

      <view v-if="activePet" class="form-section">
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
import { getActivePet, setActivePet, updateActivePet } from '../../common/pet-store.js';
import { getPetProfile, getProfileCompletion, savePetProfile } from '../../common/profile-store.js';
import { getOwnerRelationLabel, getPetRelationshipStage, getRelationshipConfig, getRelationshipThemeClass, isMemorialMode, withRelationshipStage } from '../../common/relationship-config.js';
import { createAvatarJob, getAvatarDisplayImage, getAvatarStatusText, getAvatarStyleText, saveGeneratedAvatar } from '../../common/pet-avatar-generator.js';
import {
  getMemorialOwnerCallDraft,
  MEMORIAL_OWNER_CALL_OPTIONS,
  saveMemorialOwnerCall
} from '../../common/memorial-owner-call.js';
import { getMemorialPersona, scheduleMemorialPersonaIntro } from '../../common/memorial-persona.js';
import { isReduceMotionEnabled, mediumHaptic } from '../../common/haptics.js';

export default {
  data() {
    return {
      activePet: null,
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
    petAvatarImage() {
      return getAvatarDisplayImage(this.activePet);
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
    this.routePetId = String(options.petId || '');
  },
  onShow() {
    this.loadArchive();
  },
  onHide() {
    this.clearPageTimers();
  },
  onUnload() {
    this.clearPageTimers();
  },
  methods: {
    clearPageTimers() {
      if (this.personaIntroTimer) clearTimeout(this.personaIntroTimer);
      if (this.archiveSaveTimer) clearTimeout(this.archiveSaveTimer);
      this.personaIntroTimer = null;
      this.archiveSaveTimer = null;
    },
    loadArchive() {
      const activePet = this.routePetId ? (setActivePet(this.routePetId) || getActivePet()) : getActivePet();
      this.activePet = activePet;
      this.form = activePet ? getPetProfile(activePet.id) : getPetProfile();
      this.memorialPersona = activePet ? getMemorialPersona(activePet.id) : getMemorialPersona();
      this.reduceMotion = isReduceMotionEnabled();
      this.showOwnerCallSetup = false;
      this.$nextTick(() => this.schedulePersonaIntro());
    },
    setDate(key, event) {
      this.form[key] = event.detail.value;
    },
    saveArchive() {
      if (!this.activePet) {
        uni.showToast({ title: '请先添加宝贝', icon: 'none' });
        return;
      }

      this.form = savePetProfile(this.activePet.id, this.form);
      uni.showToast({ title: '档案已保存', icon: 'success' });
      this.archiveSaveTimer = setTimeout(() => {
        this.archiveSaveTimer = null;
        this.goBack();
      }, 650);
    },
    toggleMemorialMode() {
      if (!this.activePet) return;

      if (isMemorialMode(this.relationshipStage)) {
        uni.showModal({
          title: '恢复为陪伴模式',
          content: '这会把 App 的文案、记录语义和聊天身份恢复为陪伴模式，不会删除任何档案和记录。',
          cancelText: '先不恢复',
          confirmText: '恢复陪伴',
          confirmColor: '#8C7557',
          success: (res) => {
            if (res.confirm) this.updateRelationshipMode('current', '已恢复为陪伴模式');
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
          if (res.confirm) this.updateRelationshipMode('deceased', '纪念模式已开启');
        }
      });
    },
    updateRelationshipMode(stage, toastTitle) {
      const updatedPet = updateActivePet(withRelationshipStage({}, stage));
      if (updatedPet) this.activePet = updatedPet;
      mediumHaptic();
      uni.showToast({ title: toastTitle, icon: 'none' });
      if (stage === 'deceased') {
        this.schedulePersonaIntro();
      }
    },
    schedulePersonaIntro() {
      if (this.personaIntroTimer) clearTimeout(this.personaIntroTimer);
      if (!this.activePet) return;
      const petId = this.activePet.id;
      const stage = this.relationshipStage;
      this.personaIntroTimer = scheduleMemorialPersonaIntro({
        petId,
        relationshipStage: stage,
        delay: 420,
        isStillCurrent: () => Boolean(
          this.activePet &&
          this.activePet.id === petId &&
          this.relationshipStage === stage
        ),
        onStart: () => this.openMemorialPersona()
      });
    },
    openMemorialPersona() {
      if (!this.activePet) return;
      uni.navigateTo({ url: `/pages/memorial-persona/memorial-persona?petId=${encodeURIComponent(this.activePet.id)}` });
    },
    openCalendar() {
      uni.navigateTo({ url: '/pages/calendar/calendar' });
    },
    openOwnerCallSetup() {
      if (!this.activePet) return;
      const draft = getMemorialOwnerCallDraft(this.activePet);
      this.selectedOwnerCallType = draft.selectedType;
      this.customOwnerCall = draft.customValue;
      this.showOwnerCallSetup = true;
    },
    closeOwnerCallSetup() {
      this.showOwnerCallSetup = false;
    },
    selectOwnerCallOption(option) {
      this.selectedOwnerCallType = option.key;
      if (option.key !== 'custom') this.customOwnerCall = '';
    },
    saveOwnerCall() {
      const result = saveMemorialOwnerCall(
        this.activePet && this.activePet.id,
        this.selectedOwnerCallType,
        this.customOwnerCall
      );
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

      const job = createAvatarJob(this.activePet, { avatarStyle: this.activePet.avatarStyle });
      const patch = saveGeneratedAvatar(this.activePet, job.result);
      const updatedPet = updateActivePet(patch);
      if (updatedPet) this.activePet = updatedPet;
      uni.showToast({ title: '已生成 mock 形象', icon: 'none' });
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
  background: #F4F1EA;
  color: #302A23;
}

.archive-scroll {
  height: 100vh;
  padding: 78rpx 30rpx calc(42rpx + env(safe-area-inset-bottom));
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
  background: #FFFFFF;
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

.pet-card,
.empty-panel,
.section-card {
  margin-top: 28rpx;
  border-radius: 16rpx;
  background: #FFFFFF;
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
  color: #302A23;
  font-size: 32rpx;
  font-weight: 600;
  line-height: 1.25;
}

.pet-desc,
.empty-desc {
  display: block;
  margin-top: 8rpx;
  color: #8F877A;
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
  background: #F1ECE3;
  color: #8C7557;
  font-size: 20rpx;
  line-height: 1.2;
}

.stage-desc {
  color: #8F877A;
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
  background: #F7F3EA;
  color: #6B5D4D;
  font-size: 20rpx;
  line-height: 1.2;
}

.avatar-style-text {
  color: #8F877A;
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
  background: #F7F3EA;
  color: #8C7557;
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
  color: #8C7557;
  font-size: 22rpx;
  font-weight: 600;
}

.empty-panel {
  padding: 34rpx;
}

.empty-title {
  display: block;
  color: #302A23;
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
  color: #8F877A;
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
  background: rgba(255, 255, 255, 0.38);
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
  color: var(--ui-accent);
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
  background: #F7F3EA;
  color: #6B5D4D;
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
  color: #302A23;
  font-size: 31rpx;
  font-weight: 600;
  line-height: 1.25;
}

.field-group {
  margin-top: 24rpx;
}

.field-label {
  display: block;
  color: #8C7557;
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
  background: #F7F3EA;
  border: 1rpx solid #EEE6DA;
  color: #6B5D4D;
  font-size: 24rpx;
  line-height: 1.2;
}

.choice-chip-active {
  background: #302A23;
  border-color: #302A23;
  color: #FBFAF6;
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
  background: #FBFAF6;
  border: 1rpx solid #EEE6DA;
  color: #302A23;
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
  color: #FBFAF6;
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
  color: #292B32;
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
  background: rgba(255, 255, 255, 0.72);
  color: #5F6478;
  font-size: 24rpx;
}

.owner-call-option-active {
  color: #FFFFFF;
  background: #5F6478;
  border-color: #5F6478;
}

.owner-call-input {
  width: 100%;
  height: 82rpx;
  margin-top: 22rpx;
  padding: 0 24rpx;
  border-radius: 20rpx;
  border: 1rpx solid rgba(95, 100, 120, 0.18);
  background: rgba(255, 255, 255, 0.72);
  color: #292B32;
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
  color: #686A73;
  background: rgba(255, 255, 255, 0.66);
}

.owner-call-save {
  color: #FFFFFF;
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
  --ui-bg-1: #F8F2E8;
  --ui-bg-2: #EFE5D5;
  --ui-bg-3: #E7EADF;
  --ui-card: rgba(255, 252, 246, 0.66);
  --ui-border: rgba(255, 255, 255, 0.58);
  --ui-text: #2F2A24;
  --ui-muted: rgba(47, 42, 36, 0.58);
  --ui-accent: #6D5945;
  background:
    radial-gradient(circle at 18% 8%, rgba(232, 188, 128, 0.24) 0%, rgba(255, 255, 255, 0) 34%),
    linear-gradient(145deg, var(--ui-bg-1) 0%, var(--ui-bg-2) 54%, var(--ui-bg-3) 100%);
}

.archive-page.theme-memorial {
  --ui-bg-1: #F3F1ED;
  --ui-bg-2: #E5E7EE;
  --ui-bg-3: #DDD8E8;
  --ui-card: rgba(255, 255, 255, 0.58);
  --ui-border: rgba(255, 255, 255, 0.54);
  --ui-text: #292B32;
  --ui-muted: rgba(41, 43, 50, 0.56);
  --ui-accent: #5F6478;
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
  color: var(--ui-accent);
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
  background: rgba(255, 255, 255, 0.42);
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
  background: rgba(255, 255, 255, 0.36);
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
</style>
