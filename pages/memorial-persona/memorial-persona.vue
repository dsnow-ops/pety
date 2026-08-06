<template>
  <view :class="['persona-page', 'theme-memorial', reduceMotion ? 'reduce-motion' : '']">
    <scroll-view scroll-y class="persona-scroll">
      <view class="persona-shell">
        <view class="persona-header">
          <button class="icon-button" hover-class="tap-icon" @click="goBack">
            <uni-icons type="left" size="22" color="#4F5363"></uni-icons>
          </button>
          <view class="pet-identity">
            <image :src="petAvatar" class="pet-avatar" mode="aspectFill"></image>
            <view class="pet-identity-copy">
              <text class="pet-name">{{ petName }}</text>
              <text class="pet-mode">温柔纪念 · 第 {{ step }} / 5 步</text>
            </view>
          </view>
          <button class="text-button" hover-class="tap-soft" @click="saveDraft(false)">保存</button>
        </view>

        <view class="progress-track">
          <view class="progress-value" :style="{ width: `${step * 20}%` }"></view>
        </view>

        <view class="question-surface">
          <template v-if="step === 1">
            <text class="question-kicker">你们的关系</text>
            <text class="question-title">他/她平时会怎么称呼你？</text>
            <text class="question-desc">沿用档案里的关系，不需要再建立另一套称呼。</text>
            <view class="chip-grid">
              <button
                v-for="option in relationOptions"
                :key="option.key"
                :class="['choice-chip', draft.relation.ownerRelationKey === option.key ? 'choice-chip-active' : '']"
                hover-class="tap-soft"
                @click="selectRelation(option.key)"
              >{{ option.label }}</button>
            </view>
            <input
              v-if="draft.relation.ownerRelationKey === 'custom'"
              v-model="draft.relation.ownerRelationCustom"
              class="text-input"
              maxlength="20"
              placeholder="写下你们熟悉的关系称呼"
            />
          </template>

          <template v-else-if="step === 2">
            <text class="question-kicker">熟悉的性格</text>
            <text class="question-title">你记得的他/她，是什么样的？</text>
            <text class="question-desc">选几项最贴近的就好，不需要全部填满。</text>
            <view class="chip-grid">
              <button
                v-for="trait in traitOptions"
                :key="trait"
                :class="['choice-chip', draft.traits.includes(trait) ? 'choice-chip-active' : '']"
                hover-class="tap-soft"
                @click="toggleListItem('traits', trait)"
              >{{ trait }}</button>
            </view>
            <textarea v-model="draft.temperament" class="text-area short" maxlength="240" placeholder="还有什么很像他/她的性格？可以留空。"></textarea>
          </template>

          <template v-else-if="step === 3">
            <text class="question-kicker">熟悉的表达</text>
            <text class="question-title">他/她会怎样回应你？</text>
            <text class="question-desc">只写你真实记得的叫声、口癖和表达节奏。</text>
            <textarea v-model="draft.speechStyle" class="text-area" maxlength="600" placeholder="例如：句子很短，喜欢先哼一声；不会说太正式的话。"></textarea>
            <textarea v-model="commonPhrasesText" class="text-area short" maxlength="400" placeholder="记得的口癖，每行一条"></textarea>
            <textarea v-model="forbiddenPhrasesText" class="text-area short" maxlength="400" placeholder="他/她绝对不会说的词，每行一条"></textarea>
          </template>

          <template v-else-if="step === 4">
            <text class="question-kicker">真实的小习惯</text>
            <text class="question-title">哪些动作，是你确实记得的？</text>
            <text class="question-desc">只有你明确选择或写下的动作，才允许偶尔出现在怀念对话里。</text>
            <view class="chip-grid">
              <button
                v-for="action in actionOptions"
                :key="action"
                :class="['choice-chip', draft.allowedActions.includes(action) ? 'choice-chip-active' : '']"
                hover-class="tap-soft"
                @click="toggleListItem('allowedActions', action)"
              >{{ action }}</button>
            </view>
            <textarea v-model="habitsText" class="text-area" maxlength="800" placeholder="写下真实习惯，每行一条。例如：午后喜欢趴在窗边。"></textarea>
          </template>

          <template v-else>
            <text class="question-kicker">记忆与边界</text>
            <text class="question-title">哪些真实片段和边界，希望归爪记住？</text>
            <text class="question-desc">最多写 5 条记忆。没有写过的事，归爪不应替你补出来。</text>
            <textarea v-model="memoriesText" class="text-area" maxlength="1000" placeholder="每行一条真实记忆，最多 5 条"></textarea>
            <textarea v-model="forbiddenClaimsText" class="text-area" maxlength="800" placeholder="绝不能编造的内容或不希望出现的安慰方式，每行一条"></textarea>
            <textarea v-model="draft.responsePreferences" class="text-area short" maxlength="240" placeholder="希望回复更短、更安静，或少问问题等。"></textarea>

            <view class="summary-block">
              <view class="summary-head">
                <view>
                  <text class="summary-title">性格卡预览</text>
                  <text class="summary-desc">可以手动保存，也可以主动请归爪整理一次。</text>
                </view>
                <button class="ai-organize" :disabled="organizing" hover-class="tap-soft" @click="organizeWithAi">
                  {{ organizing ? '正在整理' : '请归爪帮我整理' }}
                </button>
              </view>
              <view v-if="draft.aiSummary" class="summary-content">
                <text class="summary-line">给人的感觉</text>
                <view class="summary-tags">
                  <button v-for="item in draft.aiSummary.traits" :key="'trait-' + item" class="summary-tag" @click="removeSummaryItem('traits', item)">{{ item }} ×</button>
                  <text v-if="!draft.aiSummary.traits.length" class="summary-empty">尚未填写</text>
                </view>
                <textarea v-model="draft.aiSummary.expression" class="summary-edit" maxlength="240"></textarea>
                <text class="summary-line">熟悉的小习惯</text>
                <view class="summary-tags">
                  <button v-for="item in draft.aiSummary.habits" :key="'habit-' + item" class="summary-tag" @click="removeSummaryItem('habits', item)">{{ item }} ×</button>
                  <text v-if="!draft.aiSummary.habits.length" class="summary-empty">尚未填写</text>
                </view>
                <text class="summary-line">允许偶尔出现的动作</text>
                <view class="summary-tags">
                  <button v-for="item in draft.aiSummary.allowedActions" :key="'action-' + item" class="summary-tag" @click="removeSummaryItem('allowedActions', item)">{{ item }} ×</button>
                  <text v-if="!draft.aiSummary.allowedActions.length" class="summary-empty">无</text>
                </view>
                <button class="clear-summary" hover-class="tap-soft" @click="clearAiSummary">删除这次整理</button>
              </view>
            </view>
          </template>
        </view>

        <view class="step-actions">
          <button v-if="step > 1" class="step-secondary" hover-class="tap-soft" @click="previousStep">上一步</button>
          <button class="step-primary" hover-class="tap-button" @click="nextStep">
            {{ step === 5 ? '确认保存性格卡' : '继续' }}
          </button>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import { getActivePet, setActivePet } from '../../common/pet-store.js';
import { getProfilePetAvatar } from '../../common/pet-avatar-generator.js';
import { getOwnerRelationLabel, getPetRelationshipStage, OWNER_RELATION_OPTIONS } from '../../common/relationship-config.js';
import { saveOwnerRelation } from '../../common/memorial-owner-call.js';
import {
  buildMemorialPersonaRequestInput,
  getMemorialPersonaEditorState,
  getMemorialPersona,
  MEMORIAL_ACTION_OPTIONS,
  MEMORIAL_TRAIT_OPTIONS,
  saveMemorialPersona
} from '../../common/memorial-persona.js';
import { isReduceMotionEnabled, successHaptic } from '../../common/haptics.js';

function linesToList(value, maxItems) {
  return String(value || '').split(/\r?\n/).map(item => item.trim()).filter(Boolean).slice(0, maxItems);
}

export default {
  data() {
    return {
      pet: null,
      petId: '',
      step: 1,
      draft: getMemorialPersona(),
      relationOptions: OWNER_RELATION_OPTIONS,
      traitOptions: MEMORIAL_TRAIT_OPTIONS,
      actionOptions: MEMORIAL_ACTION_OPTIONS,
      commonPhrasesText: '',
      forbiddenPhrasesText: '',
      habitsText: '',
      memoriesText: '',
      forbiddenClaimsText: '',
      organizing: false,
      pageActive: false,
      navigationTimer: null,
      organizeRequestId: 0,
      reduceMotion: isReduceMotionEnabled()
    };
  },
  computed: {
    petName() {
      return (this.pet && this.pet.name) || '宝贝';
    },
    petAvatar() {
      return getProfilePetAvatar(this.pet || {});
    }
  },
  onLoad(options = {}) {
    this.petId = String(options.petId || '');
  },
  onShow() {
    this.pageActive = true;
    this.loadPersona();
  },
  onHide() {
    this.stopPendingWork();
  },
  onUnload() {
    this.stopPendingWork();
  },
  methods: {
    loadPersona() {
      this.organizing = false;
      this.pet = this.petId ? (setActivePet(this.petId) || getActivePet()) : getActivePet();
      if (!this.pet) return;
      if (getPetRelationshipStage(this.pet) !== 'deceased') {
        uni.showToast({ title: '请先为当前宠物开启温柔纪念模式', icon: 'none' });
        this.scheduleGoBack(300);
        return;
      }
      this.petId = this.pet.id;
      const editorState = getMemorialPersonaEditorState(this.petId);
      this.draft = editorState.draft;
      if (!this.draft.relation.ownerRelationKey) {
        this.draft.relation = {
          ownerRelationKey: this.pet.ownerRelationKey || '',
          ownerRelationCustom: this.pet.ownerRelationCustom || '',
          ownerCall: getOwnerRelationLabel(this.pet)
        };
      }
      this.commonPhrasesText = editorState.commonPhrasesText;
      this.forbiddenPhrasesText = editorState.forbiddenPhrasesText;
      this.habitsText = editorState.habitsText;
      this.memoriesText = editorState.memoriesText;
      this.forbiddenClaimsText = editorState.forbiddenClaimsText;
    },
    syncTextLists() {
      this.draft.commonPhrases = linesToList(this.commonPhrasesText, 10);
      this.draft.forbiddenPhrases = linesToList(this.forbiddenPhrasesText, 12);
      this.draft.habits = linesToList(this.habitsText, 12);
      this.draft.memories = linesToList(this.memoriesText, 5);
      this.draft.forbiddenClaims = linesToList(this.forbiddenClaimsText, 12);
      this.draft.relation.ownerCall = this.draft.relation.ownerRelationKey === 'custom'
        ? this.draft.relation.ownerRelationCustom
        : (this.relationOptions.find(item => item.key === this.draft.relation.ownerRelationKey) || {}).label || '';
    },
    selectRelation(key) {
      this.draft.relation.ownerRelationKey = key;
      if (key !== 'custom') this.draft.relation.ownerRelationCustom = '';
    },
    toggleListItem(field, value) {
      const list = this.draft[field];
      this.draft[field] = list.includes(value)
        ? list.filter(item => item !== value)
        : list.concat(value);
    },
    saveDraft(showToast = true) {
      this.syncTextLists();
      this.draft = saveMemorialPersona(this.petId, {
        ...this.draft,
        completed: this.draft.completed,
        introShown: true
      });
      if (showToast) uni.showToast({ title: '草稿已保存', icon: 'none' });
    },
    previousStep() {
      this.saveDraft(false);
      this.step = Math.max(1, this.step - 1);
    },
    nextStep() {
      if (this.step < 5) {
        this.saveDraft(false);
        this.step += 1;
        return;
      }
      this.finishPersona();
    },
    finishPersona() {
      this.syncTextLists();
      if (this.draft.relation.ownerRelationKey) {
        const relationResult = saveOwnerRelation(
          this.petId,
          this.draft.relation.ownerRelationKey,
          this.draft.relation.ownerRelationCustom
        );
        if (!relationResult.ok) {
          uni.showToast({ title: relationResult.error, icon: 'none' });
          return;
        }
      }
      this.draft = saveMemorialPersona(this.petId, {
        ...this.draft,
        completed: true,
        introShown: true
      });
      successHaptic();
      uni.showToast({ title: '性格卡已保存', icon: 'success' });
      this.scheduleGoBack(500);
    },
    async organizeWithAi() {
      if (this.organizing) return;
      this.syncTextLists();
      const requestPetId = this.petId;
      const requestId = this.organizeRequestId + 1;
      this.organizeRequestId = requestId;
      this.organizing = true;
      try {
        const response = await uniCloud.callFunction({
          name: 'api_deepseek',
          data: {
            requestType: 'memorial_persona_builder',
            relationshipStage: 'deceased',
            petId: requestPetId,
            personaInput: buildMemorialPersonaRequestInput(this.draft)
          }
        });
        if (!this.pageActive || requestId !== this.organizeRequestId || requestPetId !== this.petId) return;
        if (!response.result || response.result.code !== 0 || !response.result.personaSummary) {
          throw new Error('PERSONA_SUMMARY_FAILED');
        }
        this.draft.aiSummary = response.result.personaSummary;
        this.draft.aiSummaryVersion = 1;
        this.saveDraft(false);
        uni.showToast({ title: '已整理，可继续修改', icon: 'none' });
      } catch (error) {
        if (!this.pageActive || requestId !== this.organizeRequestId || requestPetId !== this.petId) return;
        uni.showToast({ title: '暂时没整理成功，仍可手动保存', icon: 'none' });
      } finally {
        if (requestId === this.organizeRequestId) this.organizing = false;
      }
    },
    scheduleGoBack(delay) {
      if (this.navigationTimer) clearTimeout(this.navigationTimer);
      this.navigationTimer = setTimeout(() => {
        this.navigationTimer = null;
        if (this.pageActive) this.goBack();
      }, delay);
    },
    stopPendingWork() {
      this.pageActive = false;
      this.organizeRequestId += 1;
      this.organizing = false;
      if (this.navigationTimer) {
        clearTimeout(this.navigationTimer);
        this.navigationTimer = null;
      }
    },
    clearAiSummary() {
      this.draft.aiSummary = null;
      this.draft.aiSummaryVersion = 0;
      this.saveDraft(false);
    },
    removeSummaryItem(field, value) {
      if (!this.draft.aiSummary || !Array.isArray(this.draft.aiSummary[field])) return;
      this.draft.aiSummary[field] = this.draft.aiSummary[field].filter(item => item !== value);
      this.saveDraft(false);
    },
    goBack() {
      const pages = getCurrentPages();
      if (pages.length > 1) {
        uni.navigateBack();
        return;
      }
      uni.navigateTo({ url: `/pages/archive/archive?petId=${encodeURIComponent(this.petId)}` });
    }
  }
};
</script>

<style scoped>
.persona-page {
  min-height: 100vh;
  background: var(--pety-page-bg, #F2F1F4);
  color: var(--pety-text, #2D2E35);
}
.persona-scroll { height: 100vh; }
.persona-shell {
  min-height: 100vh;
  padding: calc(var(--status-bar-height, 0px) + 34rpx) 30rpx calc(42rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  animation: personaEnter 360ms ease both;
}
.persona-header { display: flex; align-items: center; gap: 18rpx; }
.icon-button, .text-button { padding: 0; margin: 0; background: transparent; }
.icon-button::after, .text-button::after, .choice-chip::after, .step-primary::after, .step-secondary::after, .ai-organize::after, .clear-summary::after, .summary-tag::after { border: none; }
.icon-button { width: 88rpx; height: 88rpx; display: flex; align-items: center; justify-content: center; border-radius: 50%; }
.pet-identity { flex: 1; min-width: 0; display: flex; align-items: center; }
.pet-avatar { width: 76rpx; height: 76rpx; border-radius: 50%; flex-shrink: 0; background: #E5E4E8; }
.pet-identity-copy { min-width: 0; margin-left: 16rpx; }
.pet-name, .pet-mode { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pet-name { font-size: 29rpx; font-weight: 600; }
.pet-mode { margin-top: 3rpx; color: var(--pety-text-secondary, #747680); font-size: 20rpx; }
.text-button { width: 84rpx; height: 72rpx; color: var(--pety-primary, #62677A); font-size: 24rpx; line-height: 72rpx; }
.progress-track { height: 6rpx; margin-top: 26rpx; border-radius: 999rpx; background: var(--pety-primary-soft, #E2E3EA); overflow: hidden; }
.progress-value { height: 100%; border-radius: inherit; background: var(--pety-primary, #62677A); transition: width 240ms ease; }
.question-surface { margin-top: 28rpx; padding: 34rpx 30rpx; border: 1rpx solid var(--pety-rule, #DDDDE3); border-radius: 30rpx; background: var(--pety-surface, #FAF9FB); }
.question-kicker, .question-title, .question-desc { display: block; }
.question-kicker { color: var(--pety-primary, #62677A); font-size: 21rpx; }
.question-title { margin-top: 10rpx; font-size: 38rpx; font-weight: 650; line-height: 1.3; }
.question-desc { margin-top: 12rpx; color: var(--pety-text-secondary, #737580); font-size: 23rpx; line-height: 1.55; }
.chip-grid { display: flex; flex-wrap: wrap; gap: 14rpx; margin-top: 28rpx; }
.choice-chip { min-height: 76rpx; padding: 0 24rpx; margin: 0; border: 1rpx solid var(--pety-rule, #DDDDE3); border-radius: 999rpx; background: transparent; color: var(--pety-text, #2D2E35); font-size: 24rpx; line-height: 76rpx; }
.choice-chip-active { border-color: var(--pety-primary, #62677A); background: var(--pety-primary-soft, #E2E3EA); color: var(--pety-primary, #62677A); }
.text-input, .text-area, .summary-edit { width: 100%; margin-top: 22rpx; padding: 22rpx; border: 1rpx solid var(--pety-rule, #DDDDE3); border-radius: 20rpx; background: rgba(255,255,255,.58); box-sizing: border-box; color: var(--pety-text, #2D2E35); font-size: 25rpx; line-height: 1.55; }
.text-input { height: 88rpx; }
.text-area { min-height: 190rpx; }
.text-area.short { min-height: 130rpx; }
.summary-block { margin-top: 28rpx; padding-top: 26rpx; border-top: 1rpx solid var(--pety-rule, #DDDDE3); }
.summary-head { display: flex; align-items: flex-start; gap: 18rpx; }
.summary-head > view { flex: 1; min-width: 0; }
.summary-title, .summary-desc, .summary-line { display: block; }
.summary-title { font-size: 28rpx; font-weight: 600; }
.summary-desc { margin-top: 6rpx; color: var(--pety-text-secondary, #737580); font-size: 21rpx; line-height: 1.45; }
.ai-organize { min-width: 190rpx; height: 72rpx; padding: 0 18rpx; margin: 0; border-radius: 999rpx; background: var(--pety-primary-soft, #E2E3EA); color: var(--pety-primary, #62677A); font-size: 22rpx; line-height: 72rpx; }
.ai-organize[disabled] { opacity: .5; }
.summary-content { margin-top: 20rpx; padding: 22rpx; border-radius: 20rpx; background: rgba(226,227,234,.58); }
.summary-line { margin-top: 8rpx; font-size: 23rpx; line-height: 1.5; }
.summary-tags { display: flex; flex-wrap: wrap; gap: 10rpx; margin-top: 10rpx; }
.summary-tag { min-height: 58rpx; padding: 0 16rpx; margin: 0; border-radius: 999rpx; background: rgba(255,255,255,.62); color: var(--pety-primary, #62677A); font-size: 20rpx; line-height: 58rpx; }
.summary-empty { color: var(--pety-text-secondary, #737580); font-size: 21rpx; line-height: 58rpx; }
.summary-edit { min-height: 110rpx; margin-top: 12rpx; }
.clear-summary { height: 64rpx; padding: 0; margin: 14rpx 0 0; background: transparent; color: #8B5960; font-size: 21rpx; line-height: 64rpx; }
.step-actions { display: flex; gap: 16rpx; margin-top: 24rpx; }
.step-primary, .step-secondary { height: 92rpx; padding: 0 24rpx; margin: 0; border-radius: 22rpx; font-size: 27rpx; line-height: 92rpx; }
.step-primary { flex: 1; background: var(--pety-primary, #62677A); color: #FFF; }
.step-secondary { width: 190rpx; background: var(--pety-primary-soft, #E2E3EA); color: var(--pety-primary, #62677A); }
.tap-button { transform: scale(.98); opacity: .9; }
.tap-icon { transform: scale(.96); opacity: .72; }
.tap-soft { transform: scale(.98); opacity: .76; }
.reduce-motion .persona-shell { animation: personaFade 100ms ease both; }
.reduce-motion .progress-value { transition: none; }
@keyframes personaEnter { from { opacity: 0; transform: translateY(10rpx); } to { opacity: 1; transform: translateY(0); } }
@keyframes personaFade { from { opacity: 0; } to { opacity: 1; } }
</style>
