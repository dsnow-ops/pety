<template>
  <view :class="[petThemeClass, 'persona-page', 'theme-memorial', reduceMotion ? 'reduce-motion' : '']" :style="appThemeStyle">
    <scroll-view scroll-y class="persona-scroll" :scroll-into-view="scrollIntoView" scroll-with-animation>
      <view class="persona-shell">
        <view class="persona-header">
          <button class="icon-button" hover-class="tap-icon" @click="goBack">
            <uni-icons type="left" size="22" color="#4F5363"></uni-icons>
          </button>
          <view class="pet-identity">
            <PetAvatarImage :pet="pet || {}" class="pet-avatar" />
            <view class="pet-identity-copy">
              <text class="pet-name">{{ petName }}</text>
              <text class="pet-mode">{{ headerStatusText }}</text>
            </view>
          </view>
          <button v-if="viewMode === 'edit'" class="text-button" hover-class="tap-soft" @click="saveCurrentSection">保存</button>
        </view>

        <template v-if="viewMode === 'overview'">
          <view class="portrait-intro">
            <text class="overview-title">你记得的 {{ petName }}</text>
            <text v-if="personaPortrait.text" class="portrait-copy">{{ personaPortrait.text }}</text>
            <text v-else class="portrait-empty">再留下一两件具体的小事，归爪会从你的原话里慢慢认识他/她。</text>
            <text v-if="personaPortrait.text" class="portrait-source-label">{{ personaPortrait.source === 'ai' ? '根据你写下的细节整理' : '来自你留下的真实内容' }}</text>
            <view class="overview-summary">
              <view class="overview-summary-chips">
                <text class="relation-chip">{{ ownerRelationText }}</text>
                <text class="status-chip">{{ personaStateLabel }}</text>
              </view>
              <text class="overview-updated">{{ updatedAtText }}</text>
            </view>
            <view class="detail-facts">
              <view><text class="detail-number">{{ detailStats.detailCount }}</text><text>个小细节</text></view>
              <view><text class="detail-number">{{ detailStats.memoryCount }}</text><text>段真实记忆</text></view>
              <view><text class="detail-number">{{ detailStats.habitCount }}</text><text>个熟悉习惯</text></view>
            </view>
          </view>

          <view v-if="personaState === 'DIRTY_COMPLETED'" class="dirty-notice">
            <view>
              <text class="dirty-title">有新的修改尚未整理</text>
              <text class="dirty-desc">旧人格卡仍然保留。只有你主动重新整理时，才会调用一次 AI。</text>
            </view>
          </view>

          <view class="persona-overview-list">
            <view class="overview-section" @click="startEdit(1)">
              <view class="overview-section-head"><text>你们的关系</text><text class="edit-link">编辑</text></view>
              <text class="overview-body">{{ ownerRelationText }}</text>
            </view>
            <view class="overview-section" @click="startEdit(2)">
              <view class="overview-section-head"><text>一眼就知道是他/她</text><text class="edit-link">编辑</text></view>
              <view v-if="overviewTraits.length" class="overview-tags">
                <text v-for="item in overviewTraits" :key="item" class="overview-tag">{{ item }}</text>
              </view>
              <view v-if="draft.personalityNotes.length" class="original-lines">
                <text v-for="item in draft.personalityNotes" :key="item">“{{ item }}”</text>
              </view>
              <text v-else-if="draft.temperament" class="original-copy">“{{ draft.temperament }}”</text>
              <text v-else class="overview-empty">再写一点他/她的小脾气，也许会更像。</text>
            </view>

            <view class="overview-section" @click="startEdit(3)">
              <view class="overview-section-head"><text>他/她回应你的方式</text><text class="edit-link">编辑</text></view>
              <view v-if="draft.petNicknames.length" class="overview-tags">
                <text v-for="item in draft.petNicknames" :key="item" class="overview-tag overview-tag-soft">{{ item }}</text>
              </view>
              <text class="overview-body">{{ overviewExpression }}</text>
              <view v-if="overviewResponses.length" class="original-lines">
                <text v-for="item in overviewResponses" :key="item">“{{ item }}”</text>
              </view>
            </view>

            <view class="overview-section" @click="startEdit(4)">
              <view class="overview-section-head"><text>家里那些很熟悉的小事</text><text class="edit-link">编辑</text></view>
              <view v-if="overviewHabits.length" class="detail-lines">
                <text v-for="item in overviewHabits" :key="item">{{ item }}</text>
              </view>
              <text v-else class="overview-empty">那些每天都习以为常的小动作，也可以写在这里。</text>
            </view>

            <view class="overview-section memory-section">
              <view class="overview-section-head"><text>只有你们知道</text><text class="edit-link" @click.stop="startMemoryEdit">补充一条</text></view>
              <view v-if="draft.memories.length" class="memory-list">
                <view v-for="item in visibleMemories" :key="item" class="memory-item" hover-class="memory-item-pressed"><view class="memory-dot"></view><text>{{ item }}</text></view>
              </view>
              <text v-else class="overview-empty">有些很普通的事情，过很久以后反而记得最清楚。</text>
              <button v-if="draft.memories.length > 3" class="memory-toggle" hover-class="tap-soft" @click="toggleAllMemories">{{ showAllMemories ? '收起' : '查看全部记忆' }}</button>
            </view>

            <view v-if="draft.coreTruth" class="core-truth-block" @click="startEdit(5)">
              <text class="core-truth-title">如果只记住一件事</text>
              <text class="core-truth-copy">“{{ draft.coreTruth }}”</text>
              <text class="core-truth-note">这是你的原话，归爪不会改写。</text>
            </view>

            <view v-if="draft.privatePhrase" class="overview-section" @click="startEdit(5)">
              <view class="overview-section-head"><text>只属于你们的一句话</text><text class="edit-link">编辑</text></view>
              <text class="private-phrase">“{{ draft.privatePhrase }}”</text>
              <text class="overview-preference">{{ draft.allowPrivatePhraseInChat ? '已允许在怀念对话中极少使用' : '仅在你允许时用于怀念对话' }}</text>
            </view>

            <view class="overview-section" @click="startEdit(5)">
              <view class="overview-section-head"><text>别让归爪记错这些</text><text class="edit-link">编辑</text></view>
              <view v-if="overviewBoundaries.length" class="overview-lines boundary-lines">
                <text v-for="item in overviewBoundaries" :key="item">{{ item }}</text>
              </view>
              <text v-else class="overview-empty">没有额外设置，归爪仍会遵守默认的真实与安全边界。</text>
              <text v-if="draft.responsePreferences" class="overview-preference">回应偏好：{{ draft.responsePreferences }}</text>
            </view>
          </view>

          <view class="overview-actions">
            <button class="step-primary" hover-class="tap-button" @click="startEdit(draft.lastStep || 1)">继续完善</button>
            <view class="overview-secondary-actions">
              <button class="step-secondary overview-secondary" hover-class="tap-soft" @click="startEdit(1)">编辑已有内容</button>
              <button class="step-secondary overview-secondary memory-action" hover-class="tap-soft" @click="startMemoryEdit">补充真实记忆</button>
            </view>
            <button class="reorganize-button" :disabled="organizing" hover-class="tap-soft" @click="confirmOrganize">
              {{ organizing ? '正在整理' : '重新整理人格卡 · 将调用一次 AI' }}
            </button>
          </view>
        </template>

        <template v-else>
          <view class="progress-track"><view class="progress-value" :style="{ width: `${step * 20}%` }"></view></view>
          <view v-if="personaState === 'DRAFT'" class="resume-note">继续上次完善 · 已回到第 {{ step }} 步</view>
          <view class="question-surface">
            <template v-if="step === 1">
              <text class="question-kicker">你们的关系</text><text class="question-title">他/她平时会怎么称呼你？</text><text class="question-desc">沿用档案里的关系，不需要再建立另一套称呼。</text>
              <view class="chip-grid"><button v-for="option in relationOptions" :key="option.key" :class="['choice-chip', draft.relation.ownerRelationKey === option.key ? 'choice-chip-active' : '']" hover-class="tap-soft" @click="selectRelation(option.key)">{{ option.label }}</button></view>
              <input v-if="draft.relation.ownerRelationKey === 'custom'" v-model="draft.relation.ownerRelationCustom" class="text-input" maxlength="20" placeholder="写下你们熟悉的关系称呼" />
              <button class="optional-toggle" hover-class="tap-soft" @click="toggleOptionalStep(1)">{{ expandedOptionalSteps[1] ? '先收起来' : '再写一点（可选）' }}</button>
              <view v-if="expandedOptionalSteps[1]" class="optional-block">
                <text class="optional-title">你平时最常怎么叫他/她？</text>
                <text class="optional-desc">有些称呼只有你们之间才会用。每行一个，最多 3 个。</text>
                <textarea v-model="petNicknamesText" class="text-area short" maxlength="120" placeholder="小白&#10;白白&#10;臭宝"></textarea>
              </view>
            </template>
            <template v-else-if="step === 2">
              <text class="question-kicker">熟悉的性格</text><text class="question-title">你记得的他/她，是什么样的？</text><text class="question-desc">选几项最贴近的就好，不需要全部填满。</text>
              <view class="chip-grid"><button v-for="trait in traitOptions" :key="trait" :class="['choice-chip', draft.traits.includes(trait) ? 'choice-chip-active' : '']" hover-class="tap-soft" @click="toggleListItem('traits', trait)">{{ trait }}</button></view>
              <textarea v-model="draft.temperament" class="text-area short" maxlength="240" placeholder="还有什么很像他/她的性格？可以留空。"></textarea>
              <button class="optional-toggle" hover-class="tap-soft" @click="toggleOptionalStep(2)">{{ expandedOptionalSteps[2] ? '先收起来' : '再写一点（可选）' }}</button>
              <view v-if="expandedOptionalSteps[2]" class="optional-block">
                <text class="optional-title">还有什么一说出来，你就会觉得“这就是他/她”？</text>
                <text class="optional-desc">不用总结性格，写一件很小的事也可以。每行一条，最多 3 条。</text>
                <textarea v-model="personalityNotesText" class="text-area" maxlength="520" placeholder="比如：嘴上不理人，但我去洗澡他/她一定会守在门口"></textarea>
              </view>
            </template>
            <template v-else-if="step === 3">
              <text class="question-kicker">熟悉的表达</text><text class="question-title">他/她会怎样回应你？</text><text class="question-desc">只写你真实记得的叫声、口癖和表达节奏。</text>
              <textarea v-model="draft.speechStyle" class="text-area" maxlength="600" placeholder="例如：句子很短，喜欢先哼一声；不会说太正式的话。"></textarea>
              <textarea v-model="commonPhrasesText" class="text-area short" maxlength="400" placeholder="记得的口癖，每行一条"></textarea>
              <textarea v-model="forbiddenPhrasesText" class="text-area short" maxlength="400" placeholder="他/她绝对不会说的词，每行一条"></textarea>
              <button class="optional-toggle" hover-class="tap-soft" @click="toggleOptionalStep(3)">{{ expandedOptionalSteps[3] ? '先收起来' : '再写一点（可选）' }}</button>
              <view v-if="expandedOptionalSteps[3]" class="optional-block optional-stack">
                <text class="optional-title">你一叫他/她，他/她通常会怎么回应？</text>
                <textarea v-model="responseHabitsText" class="text-area short" maxlength="500" placeholder="抬头看我一下，但不过来&#10;会叫一声"></textarea>
                <text class="optional-title">开心的时候，你最熟悉的样子是什么？</text>
                <textarea v-model="happyBehaviorsText" class="text-area short" maxlength="360" placeholder="尾巴翘起来&#10;绕着腿转"></textarea>
                <text class="optional-title">有哪句话或声音，一看到就会想到他/她？</text>
                <textarea v-model="signatureSoundsOrWordsText" class="text-area short" maxlength="360" placeholder="一句常说的话、拟声、特殊口令或昵称"></textarea>
              </view>
            </template>
            <template v-else-if="step === 4">
              <text class="question-kicker">真实的小习惯</text><text class="question-title">哪些动作，是你确实记得的？</text><text class="question-desc">只有你明确选择或写下的动作，才允许偶尔出现在怀念对话里。</text>
              <view class="chip-grid"><button v-for="action in actionOptions" :key="action" :class="['choice-chip', draft.allowedActions.includes(action) ? 'choice-chip-active' : '']" hover-class="tap-soft" @click="toggleListItem('allowedActions', action)">{{ action }}</button></view>
              <textarea v-model="habitsText" class="text-area" maxlength="800" placeholder="写下真实习惯，每行一条。例如：午后喜欢趴在窗边。"></textarea>
              <button class="optional-toggle" hover-class="tap-soft" @click="toggleOptionalStep(4)">{{ expandedOptionalSteps[4] ? '先收起来' : '再写一点（可选）' }}</button>
              <view v-if="expandedOptionalSteps[4]" class="optional-block optional-stack">
                <text class="optional-title">他/她最喜欢待在哪里？</text>
                <textarea v-model="favoritePlacesText" class="text-area short" maxlength="500" placeholder="窗台、我的枕头旁边、沙发靠背、门口……"></textarea>
                <text class="optional-title">你回家的时候，他/她通常会怎样？</text>
                <textarea v-model="draft.homecomingBehavior" class="text-area short" maxlength="180" placeholder="写下一件你确实记得的事"></textarea>
                <text class="optional-title">你最熟悉他/她怎么睡？</text>
                <textarea v-model="sleepHabitsText" class="text-area short" maxlength="500" placeholder="蜷成一团&#10;一定睡在我脚边"></textarea>
                <text class="optional-title">有没有一种东西，他/她一听见声音就知道？</text>
                <textarea v-model="foodRitualsText" class="text-area short" maxlength="500" placeholder="每行写一件真实的小仪式"></textarea>
                <text class="optional-title">有没有一个特别小、但你永远认得出的动作？</text>
                <textarea v-model="signatureActionsText" class="text-area" maxlength="720" placeholder="比如想喝水时会先看我，再看水碗"></textarea>
              </view>
            </template>
            <template v-else>
              <text class="question-kicker">真实记忆与边界</text><text class="question-title">还有一些只有你知道的事</text><text class="question-desc">不一定是什么大事。很多时候，真正留下来的反而是很普通的一天。</text>
              <view class="memory-prompts">
                <text>有没有一件特别普通，但你现在还记得很清楚的小事？</text>
                <text>有没有一个只有你们之间才懂的习惯？</text>
                <text>想到家里的某个地方时，会立刻想到他/她吗？</text>
                <text>有没有一个瞬间，一想到就觉得：这真的很像他/她。</text>
              </view>
              <textarea id="real-memory-input" v-model="memoriesText" class="text-area" maxlength="1000" placeholder="每行一条真实记忆，最多 5 条"></textarea>
              <view class="truth-field">
                <text class="optional-title">如果只能让归爪永远别记错一件事</text>
                <textarea v-model="draft.coreTruth" class="text-area short" maxlength="240" placeholder="直接写下你的原话，归爪不会让 AI 改写这一句"></textarea>
              </view>
              <view class="private-field">
                <text class="optional-title">只属于你们的一句话</text>
                <text class="optional-desc">可以是一句你经常对他/她说的话，也可以只是你们之间才懂的称呼。</text>
                <input v-model="draft.privatePhrase" class="text-input" maxlength="100" placeholder="完全可选" />
                <view class="private-switch-row"><text>允许归爪偶尔使用这句话</text><switch :checked="draft.allowPrivatePhraseInChat" color="#62677A" @change="setPrivatePhrasePermission" /></view>
                <text class="private-switch-note">默认关闭。开启后也只会作为低优先级提示，不能反复使用。</text>
              </view>
              <text class="optional-title boundary-title">别让归爪记错这些</text>
              <textarea v-model="forbiddenClaimsText" class="text-area" maxlength="800" placeholder="绝不能编造的内容或不希望出现的安慰方式，每行一条"></textarea>
              <textarea v-model="draft.responsePreferences" class="text-area short" maxlength="240" placeholder="希望回复更短、更安静，或少问问题等。"></textarea>
              <button class="ai-organize full-organize" :disabled="organizing" hover-class="tap-soft" @click="confirmOrganize">{{ organizing ? '正在整理' : '请归爪帮我整理 · 将调用一次 AI' }}</button>
            </template>
          </view>
          <view class="step-actions">
            <button v-if="draft.completed" class="step-secondary" hover-class="tap-soft" @click="saveCurrentSection">返回人格卡</button>
            <button v-else-if="step > 1" class="step-secondary" hover-class="tap-soft" @click="previousStep">上一步</button>
            <button class="step-primary" hover-class="tap-button" @click="nextStep">{{ draft.completed ? '保存这一部分' : (step === 5 ? '确认保存人格卡' : '继续') }}</button>
          </view>
        </template>
      </view>
    </scroll-view>
    <AiDataConsentSheet
      :visible="showAiConsent"
      initial-scope="deepseek_chat"
      @accepted="onAiConsentAccepted"
      @declined="showAiConsent = false"
      @close="showAiConsent = false"
    />
  </view>
</template>

<script>
import PetAvatarImage from '../../components/PetAvatarImage.vue';
import { getActivePet, setActivePet } from '../../common/pet-store.js';
import { getProfilePetAvatar } from '../../common/pet-avatar-generator.js';
import { getOwnerRelationLabel, getPetRelationshipStage, OWNER_RELATION_OPTIONS } from '../../common/relationship-config.js';
import { saveOwnerRelation } from '../../common/memorial-owner-call.js';
import {
  buildMemorialPersonaRequestInput,
  getMemorialPersonaDetailStats,
  getMemorialPersonaEditorState,
  getMemorialPersona,
  getMemorialPersonaPortrait,
  getMemorialPersonaSourceSignature,
  getMemorialPersonaState,
  MEMORIAL_ACTION_OPTIONS,
  MEMORIAL_PERSONA_STATES,
  MEMORIAL_TRAIT_OPTIONS,
  saveMemorialPersona
} from '../../common/memorial-persona.js';
import { isReduceMotionEnabled, successHaptic } from '../../common/haptics.js';
import AiDataConsentSheet from '../../components/AiDataConsentSheet.vue';
import { hasAiConsent } from '../../common/ai-consent.js';
import { getResponseLanguage } from '../../common/i18n.js';

function linesToList(value, maxItems) {
  return String(value || '').split(/\r?\n/).map(item => item.trim()).filter(Boolean).slice(0, maxItems);
}

export default {
  components: { AiDataConsentSheet, PetAvatarImage },
  data() {
    return {
      pet: null,
      petId: '',
      step: 1,
      requestedStep: 0,
      requestedView: '',
      viewMode: 'edit',
      personaState: MEMORIAL_PERSONA_STATES.EMPTY,
      savedSourceSignature: '',
      draft: getMemorialPersona(),
      relationOptions: OWNER_RELATION_OPTIONS,
      traitOptions: MEMORIAL_TRAIT_OPTIONS,
      actionOptions: MEMORIAL_ACTION_OPTIONS,
      petNicknamesText: '',
      personalityNotesText: '',
      commonPhrasesText: '',
      responseHabitsText: '',
      happyBehaviorsText: '',
      upsetBehaviorsText: '',
      seekingComfortBehaviorsText: '',
      signatureSoundsOrWordsText: '',
      forbiddenPhrasesText: '',
      habitsText: '',
      favoritePlacesText: '',
      sleepHabitsText: '',
      foodRitualsText: '',
      signatureActionsText: '',
      memoriesText: '',
      forbiddenClaimsText: '',
      expandedOptionalSteps: {},
      showAllMemories: false,
      scrollIntoView: '',
      savedMemoryCount: 0,
      organizing: false,
      showAiConsent: false,
      pendingOrganize: false,
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
    },
    headerStatusText() {
      return this.viewMode === 'overview'
        ? `温柔纪念 · ${this.personaStateLabel}`
        : `温柔纪念 · 第 ${this.step} / 5 步`;
    },
    personaStateLabel() {
      const labels = {
        [MEMORIAL_PERSONA_STATES.EMPTY]: '尚未开始',
        [MEMORIAL_PERSONA_STATES.DRAFT]: '继续完善',
        [MEMORIAL_PERSONA_STATES.COMPLETED]: '已完成',
        [MEMORIAL_PERSONA_STATES.DIRTY_COMPLETED]: '有新内容待整理'
      };
      return labels[this.personaState] || labels[MEMORIAL_PERSONA_STATES.EMPTY];
    },
    ownerRelationText() {
      const relation = this.draft.relation || {};
      return relation.ownerCall || relation.ownerRelationCustom || getOwnerRelationLabel(this.pet || {}) || '你们的关系';
    },
    updatedAtText() {
      const timestamp = Number(this.draft.updatedAt) || 0;
      if (!timestamp) return '还没有保存';
      const date = new Date(timestamp);
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `更新于 ${date.getFullYear()}.${month}.${day}`;
    },
    personaPortrait() {
      return getMemorialPersonaPortrait(this.draft);
    },
    detailStats() {
      return getMemorialPersonaDetailStats(this.draft);
    },
    overviewTraits() {
      const summary = this.draft.aiSummary || {};
      const source = Array.isArray(summary.traits) && summary.traits.length ? summary.traits : this.draft.traits;
      return (source || []).slice(0, 5);
    },
    overviewExpression() {
      const summary = this.draft.aiSummary || {};
      return summary.expression || this.draft.speechStyle || '还没有留下特别熟悉的声音或表达。';
    },
    overviewResponses() {
      return []
        .concat(this.draft.responseHabits || [])
        .concat(this.draft.signatureSoundsOrWords || [])
        .concat(this.draft.commonPhrases || [])
        .slice(0, 6);
    },
    overviewHabits() {
      const summary = this.draft.aiSummary || {};
      const summarized = Array.isArray(summary.habits) && summary.habits.length ? summary.habits : this.draft.habits;
      return []
        .concat(summarized || [])
        .concat(this.draft.favoritePlaces || [])
        .concat(this.draft.homecomingBehavior ? [this.draft.homecomingBehavior] : [])
        .concat(this.draft.sleepHabits || [])
        .concat(this.draft.foodRituals || [])
        .concat(this.draft.signatureActions || [])
        .slice(0, 8);
    },
    visibleMemories() {
      return this.showAllMemories ? this.draft.memories : this.draft.memories.slice(0, 3);
    },
    overviewBoundaries() {
      const summary = this.draft.aiSummary || {};
      const source = Array.isArray(summary.boundaries) && summary.boundaries.length
        ? summary.boundaries
        : (this.draft.forbiddenPhrases || []).concat(this.draft.forbiddenClaims || []);
      return source.slice(0, 5);
    }
  },
  onLoad(options = {}) {
    this.petId = String(options.petId || '');
    this.requestedView = ['edit', 'overview'].includes(options.view) ? options.view : '';
    this.requestedStep = Math.max(0, Math.min(5, Number(options.step) || 0));
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
      this.petNicknamesText = editorState.petNicknamesText;
      this.personalityNotesText = editorState.personalityNotesText;
      this.responseHabitsText = editorState.responseHabitsText;
      this.happyBehaviorsText = editorState.happyBehaviorsText;
      this.upsetBehaviorsText = editorState.upsetBehaviorsText;
      this.seekingComfortBehaviorsText = editorState.seekingComfortBehaviorsText;
      this.signatureSoundsOrWordsText = editorState.signatureSoundsOrWordsText;
      this.forbiddenPhrasesText = editorState.forbiddenPhrasesText;
      this.habitsText = editorState.habitsText;
      this.favoritePlacesText = editorState.favoritePlacesText;
      this.sleepHabitsText = editorState.sleepHabitsText;
      this.foodRitualsText = editorState.foodRitualsText;
      this.signatureActionsText = editorState.signatureActionsText;
      this.memoriesText = editorState.memoriesText;
      this.forbiddenClaimsText = editorState.forbiddenClaimsText;
      this.savedMemoryCount = this.draft.memories.length;
      this.personaState = getMemorialPersonaState(this.draft);
      this.step = this.requestedStep || this.draft.lastStep || 1;
      if (this.requestedView) {
        this.viewMode = this.requestedView;
      } else {
        this.viewMode = [MEMORIAL_PERSONA_STATES.COMPLETED, MEMORIAL_PERSONA_STATES.DIRTY_COMPLETED].includes(this.personaState)
          ? 'overview'
          : 'edit';
      }
      if (this.viewMode === 'overview' && !this.draft.completed) this.viewMode = 'edit';
      this.savedSourceSignature = getMemorialPersonaSourceSignature(this.draft);
    },
    syncTextLists() {
      this.draft.petNicknames = linesToList(this.petNicknamesText, 3);
      this.draft.personalityNotes = linesToList(this.personalityNotesText, 3);
      this.draft.commonPhrases = linesToList(this.commonPhrasesText, 10);
      this.draft.responseHabits = linesToList(this.responseHabitsText, 5);
      this.draft.emotionalBehaviors = {
        happy: linesToList(this.happyBehaviorsText, 3),
        upset: linesToList(this.upsetBehaviorsText, 3),
        seekingComfort: linesToList(this.seekingComfortBehaviorsText, 3)
      };
      this.draft.signatureSoundsOrWords = linesToList(this.signatureSoundsOrWordsText, 5);
      this.draft.forbiddenPhrases = linesToList(this.forbiddenPhrasesText, 12);
      this.draft.habits = linesToList(this.habitsText, 12);
      this.draft.favoritePlaces = linesToList(this.favoritePlacesText, 5);
      this.draft.sleepHabits = linesToList(this.sleepHabitsText, 5);
      this.draft.foodRituals = linesToList(this.foodRitualsText, 5);
      this.draft.signatureActions = linesToList(this.signatureActionsText, 5);
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
    toggleOptionalStep(step) {
      this.expandedOptionalSteps = {
        ...this.expandedOptionalSteps,
        [step]: !this.expandedOptionalSteps[step]
      };
    },
    setPrivatePhrasePermission(event) {
      this.draft.allowPrivatePhraseInChat = Boolean(event && event.detail && event.detail.value);
    },
    toggleAllMemories() {
      this.showAllMemories = !this.showAllMemories;
    },
    persistDraft(options = {}) {
      this.syncTextLists();
      const sourceSignature = getMemorialPersonaSourceSignature(this.draft);
      const contentChanged = sourceSignature !== this.savedSourceSignature;
      const nextRevision = contentChanged
        ? Math.max(1, Number(this.draft.contentRevision) + 1 || 1)
        : Number(this.draft.contentRevision) || 0;
      const completed = typeof options.completed === 'boolean' ? options.completed : this.draft.completed;
      const aiSummaryRevision = options.markSummaryCurrent
        ? nextRevision
        : Number(this.draft.aiSummaryRevision) || 0;
      this.draft = saveMemorialPersona(this.petId, {
        ...this.draft,
        completed,
        introShown: true,
        lastStep: this.step,
        contentRevision: nextRevision,
        aiSummaryRevision
      });
      this.savedSourceSignature = getMemorialPersonaSourceSignature(this.draft);
      this.personaState = getMemorialPersonaState(this.draft);
      return this.draft;
    },
    saveDraft(showToast = true) {
      this.persistDraft();
      if (showToast) uni.showToast({ title: '草稿已保存', icon: 'none' });
    },
    previousStep() {
      this.step = Math.max(1, this.step - 1);
      this.saveDraft(false);
    },
    nextStep() {
      if (this.draft.completed) {
        this.saveCurrentSection();
        return;
      }
      if (this.step < 5) {
        this.step += 1;
        this.saveDraft(false);
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
      this.persistDraft({ completed: true, markSummaryCurrent: true });
      this.savedMemoryCount = this.draft.memories.length;
      this.viewMode = 'overview';
      successHaptic();
      uni.showToast({ title: '人格卡已保存', icon: 'success' });
    },
    saveCurrentSection() {
      const hasNewMemory = linesToList(this.memoriesText, 5).length > this.savedMemoryCount;
      this.persistDraft();
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
      if (hasNewMemory) successHaptic();
      this.savedMemoryCount = this.draft.memories.length;
      this.viewMode = this.draft.completed ? 'overview' : 'edit';
      uni.showToast({ title: hasNewMemory ? '这段记忆已经留下了' : (this.draft.completed ? '这一部分已保存' : '草稿已保存'), icon: 'none' });
    },
    startEdit(step) {
      this.step = Math.max(1, Math.min(5, Number(step) || 1));
      this.viewMode = 'edit';
    },
    startMemoryEdit() {
      this.step = 5;
      this.viewMode = 'edit';
      this.expandedOptionalSteps = { ...this.expandedOptionalSteps, 5: true };
      this.scrollIntoView = '';
      this.$nextTick(() => {
        this.scrollIntoView = 'real-memory-input';
      });
    },
    confirmOrganize() {
      if (this.organizing) return;
      if (!hasAiConsent('deepseek_chat')) {
        this.pendingOrganize = true;
        this.showAiConsent = true;
        return;
      }
      uni.showModal({
        title: '重新整理人格卡',
        content: '这会调用一次 AI，把你已经写下的真实资料整理成更清晰的人格卡。原始资料会继续保留。',
        cancelText: '暂不整理',
        confirmText: '调用一次',
        confirmColor: '#62677A',
        success: result => {
          if (result.confirm) this.organizeWithAi();
        }
      });
    },
    onAiConsentAccepted() {
      this.showAiConsent = false;
      if (!this.pendingOrganize) return;
      this.pendingOrganize = false;
      this.confirmOrganize();
    },
    async organizeWithAi() {
      if (this.organizing) return;
      this.persistDraft();
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
            personaInput: buildMemorialPersonaRequestInput(this.draft),
            responseLanguage: getResponseLanguage()
          }
        });
        if (!this.pageActive || requestId !== this.organizeRequestId || requestPetId !== this.petId) return;
        if (!response.result || response.result.code !== 0 || !response.result.personaSummary) {
          throw new Error('PERSONA_SUMMARY_FAILED');
        }
        this.draft.aiSummary = response.result.personaSummary;
        this.draft.aiSummaryVersion = 2;
        this.draft.aiSummaryRevision = this.draft.contentRevision;
        this.draft = saveMemorialPersona(this.petId, this.draft);
        this.savedSourceSignature = getMemorialPersonaSourceSignature(this.draft);
        this.personaState = getMemorialPersonaState(this.draft);
        this.viewMode = 'overview';
        successHaptic();
        uni.showToast({ title: '人格卡已经整理好了', icon: 'success' });
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
    goBack() {
      if (this.viewMode === 'edit' && this.draft.completed) {
        this.persistDraft();
        this.viewMode = 'overview';
        return;
      }
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
.icon-button::after, .text-button::after, .choice-chip::after, .step-primary::after, .step-secondary::after, .ai-organize::after, .reorganize-button::after { border: none; }
.icon-button { width: 88rpx; height: 88rpx; display: flex; align-items: center; justify-content: center; border-radius: 50%; }
.pet-identity { flex: 1; min-width: 0; display: flex; align-items: center; }
.pet-avatar { width: 76rpx; height: 76rpx; border-radius: 50%; flex-shrink: 0; background: #E5E4E8; }
.pet-identity-copy { min-width: 0; margin-left: 16rpx; }
.pet-name, .pet-mode { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pet-name { font-size: 29rpx; font-weight: 600; }
.pet-mode { margin-top: 3rpx; color: var(--pety-text-secondary, #747680); font-size: 20rpx; }
.text-button { width: 84rpx; height: 72rpx; color: var(--pety-primary, #62677A); font-size: 24rpx; line-height: 72rpx; }
.portrait-intro { margin-top: 34rpx; padding: 8rpx 4rpx 32rpx; border-bottom: 1rpx solid var(--pety-rule, #DDDDE3); }
.overview-title, .portrait-copy, .portrait-empty, .portrait-source-label, .dirty-title, .dirty-desc, .overview-body, .overview-empty, .overview-preference, .core-truth-title, .core-truth-copy, .core-truth-note, .private-phrase, .optional-title, .optional-desc, .private-switch-note { display: block; }
.overview-title { font-size: 42rpx; font-weight: 650; line-height: 1.28; }
.portrait-copy { max-width: 650rpx; margin-top: 20rpx; color: var(--pety-text, #2D2E35); font-size: 27rpx; line-height: 1.75; }
.portrait-empty { max-width: 620rpx; margin-top: 18rpx; color: var(--pety-text-secondary, #737580); font-size: 24rpx; line-height: 1.65; }
.portrait-source-label { margin-top: 13rpx; color: var(--pety-text-secondary, #737580); font-size: 19rpx; line-height: 1.45; }
.overview-summary { margin-top: 26rpx; }
.overview-summary-chips { display: flex; flex-wrap: wrap; gap: 12rpx; }
.relation-chip, .status-chip { display: inline-flex; align-items: center; min-height: 54rpx; padding: 0 18rpx; border-radius: 999rpx; box-sizing: border-box; font-size: 21rpx; line-height: 1.3; }
.relation-chip { background: var(--pety-primary-soft, #E2E3EA); color: var(--pety-primary, #62677A); }
.status-chip { border: 1rpx solid var(--pety-rule, #DDDDE3); background: rgba(255,255,255,.38); color: var(--pety-text-secondary, #737580); }
.overview-updated { display: block; margin-top: 13rpx; color: var(--pety-text-secondary, #737580); font-size: 20rpx; line-height: 1.45; }
.detail-facts { display: flex; gap: 12rpx; margin-top: 24rpx; }
.detail-facts > view { flex: 1; min-width: 0; padding: 16rpx 10rpx; border: 1rpx solid var(--pety-rule, #DDDDE3); border-radius: 18rpx; color: var(--pety-text-secondary, #737580); font-size: 18rpx; line-height: 1.35; text-align: center; }
.detail-number { display: block; margin-bottom: 3rpx; color: var(--pety-text, #2D2E35); font-size: 27rpx; font-weight: 600; }
.dirty-notice { margin-top: 22rpx; padding: 24rpx 26rpx; border: 1rpx solid rgba(139, 89, 96, .18); border-radius: 22rpx; background: rgba(139, 89, 96, .06); }
.dirty-title { color: #795259; font-size: 24rpx; font-weight: 600; }
.dirty-desc { margin-top: 6rpx; color: var(--pety-text-secondary, #737580); font-size: 21rpx; line-height: 1.5; }
.persona-overview-list { margin-top: 26rpx; }
.overview-section { padding: 30rpx 4rpx; border-bottom: 1rpx solid var(--pety-rule, #DDDDE3); }
.overview-section:last-child { border-bottom: 0; }
.overview-section-head { display: flex; align-items: center; justify-content: space-between; gap: 20rpx; font-size: 27rpx; font-weight: 600; line-height: 1.4; }
.edit-link { flex-shrink: 0; color: var(--pety-primary, #62677A); font-size: 21rpx; font-weight: 400; }
.overview-tags { display: flex; flex-wrap: wrap; gap: 10rpx; margin-top: 18rpx; }
.overview-tag { padding: 9rpx 16rpx; border-radius: 999rpx; background: var(--pety-primary-soft, #E2E3EA); color: var(--pety-primary, #62677A); font-size: 21rpx; line-height: 1.4; }
.overview-tag-soft { background: rgba(98, 103, 122, .08); }
.overview-body { margin-top: 16rpx; color: var(--pety-text-secondary, #737580); font-size: 23rpx; line-height: 1.65; }
.overview-empty { margin-top: 16rpx; color: var(--pety-text-secondary, #737580); font-size: 22rpx; line-height: 1.65; }
.overview-lines { display: flex; flex-direction: column; gap: 9rpx; margin-top: 16rpx; color: var(--pety-text-secondary, #737580); font-size: 23rpx; line-height: 1.55; }
.original-lines, .detail-lines { display: flex; flex-direction: column; gap: 12rpx; margin-top: 18rpx; font-size: 24rpx; line-height: 1.65; }
.original-lines, .original-copy { color: var(--pety-text, #2D2E35); }
.original-copy { display: block; margin-top: 18rpx; font-size: 24rpx; line-height: 1.65; }
.detail-lines { color: var(--pety-text-secondary, #737580); }
.memory-list { display: flex; flex-direction: column; margin-top: 16rpx; overflow: hidden; transition: max-height 200ms ease; }
.memory-item { display: flex; align-items: flex-start; gap: 14rpx; padding: 14rpx 0; color: var(--pety-text, #2D2E35); font-size: 23rpx; line-height: 1.6; transition: transform 120ms ease, opacity 120ms ease; }
.memory-item text { flex: 1; min-width: 0; }
.memory-dot { width: 7rpx; height: 7rpx; margin-top: 15rpx; border-radius: 50%; background: var(--pety-primary, #62677A); flex-shrink: 0; opacity: .64; }
.memory-item-pressed { transform: scale(.99); opacity: .68; }
.memory-toggle { min-height: 72rpx; margin: 8rpx 0 0; padding: 0; background: transparent; color: var(--pety-primary, #62677A); font-size: 21rpx; line-height: 72rpx; }
.core-truth-block { margin: 34rpx 0 8rpx; padding: 30rpx 28rpx; border-left: 5rpx solid var(--pety-primary, #62677A); border-radius: 0 22rpx 22rpx 0; background: rgba(98, 103, 122, .07); }
.core-truth-title { color: var(--pety-primary, #62677A); font-size: 23rpx; font-weight: 600; }
.core-truth-copy { margin-top: 16rpx; color: var(--pety-text, #2D2E35); font-size: 27rpx; line-height: 1.72; }
.core-truth-note { margin-top: 14rpx; color: var(--pety-text-secondary, #737580); font-size: 19rpx; }
.private-phrase { margin-top: 18rpx; color: var(--pety-text, #2D2E35); font-size: 25rpx; line-height: 1.65; }
.boundary-lines { color: #665B67; }
.overview-preference { margin-top: 14rpx; color: var(--pety-text-secondary, #737580); font-size: 21rpx; line-height: 1.5; }
.overview-actions { margin-top: 26rpx; padding-bottom: 8rpx; }
.overview-secondary-actions { display: flex; gap: 14rpx; margin-top: 14rpx; }
.overview-secondary { flex: 1; width: auto; }
.reorganize-button { width: 100%; min-height: 78rpx; margin: 14rpx 0 0; padding: 0 22rpx; border-radius: 20rpx; background: transparent; color: var(--pety-primary, #62677A); font-size: 22rpx; line-height: 1.35; }
.reorganize-button[disabled] { opacity: .5; }
.progress-track { height: 6rpx; margin-top: 26rpx; border-radius: 999rpx; background: var(--pety-primary-soft, #E2E3EA); overflow: hidden; }
.progress-value { height: 100%; border-radius: inherit; background: var(--pety-primary, #62677A); transition: width 240ms ease; }
.resume-note { margin-top: 20rpx; color: var(--pety-primary, #62677A); font-size: 22rpx; }
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
.optional-toggle { min-height: 72rpx; margin: 22rpx 0 0; padding: 0 6rpx; background: transparent; color: var(--pety-primary, #62677A); font-size: 22rpx; line-height: 72rpx; text-align: left; }
.optional-block { margin-top: 10rpx; padding-top: 24rpx; border-top: 1rpx solid var(--pety-rule, #DDDDE3); }
.optional-stack { display: flex; flex-direction: column; }
.optional-stack .optional-title:not(:first-child) { margin-top: 28rpx; }
.optional-title { color: var(--pety-text, #2D2E35); font-size: 25rpx; font-weight: 600; line-height: 1.5; }
.optional-desc { margin-top: 8rpx; color: var(--pety-text-secondary, #737580); font-size: 21rpx; line-height: 1.55; }
.memory-prompts { display: flex; flex-direction: column; gap: 10rpx; margin-top: 24rpx; padding: 20rpx 22rpx; border-radius: 18rpx; background: rgba(98, 103, 122, .055); color: var(--pety-text-secondary, #737580); font-size: 21rpx; line-height: 1.55; }
.truth-field, .private-field { margin-top: 30rpx; padding-top: 28rpx; border-top: 1rpx solid var(--pety-rule, #DDDDE3); }
.private-switch-row { display: flex; align-items: center; justify-content: space-between; gap: 20rpx; min-height: 88rpx; margin-top: 16rpx; color: var(--pety-text, #2D2E35); font-size: 23rpx; }
.private-switch-row text { flex: 1; min-width: 0; }
.private-switch-note { color: var(--pety-text-secondary, #737580); font-size: 20rpx; line-height: 1.55; }
.boundary-title { margin-top: 32rpx; padding-top: 28rpx; border-top: 1rpx solid var(--pety-rule, #DDDDE3); }
.summary-block { margin-top: 28rpx; padding-top: 26rpx; border-top: 1rpx solid var(--pety-rule, #DDDDE3); }
.summary-head { display: flex; align-items: flex-start; gap: 18rpx; }
.summary-head > view { flex: 1; min-width: 0; }
.summary-title, .summary-desc, .summary-line { display: block; }
.summary-title { font-size: 28rpx; font-weight: 600; }
.summary-desc { margin-top: 6rpx; color: var(--pety-text-secondary, #737580); font-size: 21rpx; line-height: 1.45; }
.ai-organize { min-width: 190rpx; height: 72rpx; padding: 0 18rpx; margin: 0; border-radius: 999rpx; background: var(--pety-primary-soft, #E2E3EA); color: var(--pety-primary, #62677A); font-size: 22rpx; line-height: 72rpx; }
.ai-organize[disabled] { opacity: .5; }
.full-organize { width: 100%; margin-top: 24rpx; }
.summary-content { margin-top: 20rpx; padding: 22rpx; border-radius: 20rpx; background: rgba(226,227,234,.58); }
.summary-line { margin-top: 8rpx; font-size: 23rpx; line-height: 1.5; }
.summary-tags { display: flex; flex-wrap: wrap; gap: 10rpx; margin-top: 10rpx; }
.summary-tag { min-height: 58rpx; padding: 0 16rpx; margin: 0; border-radius: 999rpx; background: rgba(255,255,255,.62); color: var(--pety-primary, #62677A); font-size: 20rpx; line-height: 58rpx; }
.summary-empty { color: var(--pety-text-secondary, #737580); font-size: 21rpx; line-height: 58rpx; }
.summary-edit { min-height: 110rpx; margin-top: 12rpx; }
.clear-summary { height: 64rpx; padding: 0; margin: 14rpx 0 0; background: transparent; color: #8B5960; font-size: 21rpx; line-height: 64rpx; }
.step-actions { position: sticky; bottom: 0; z-index: 2; display: flex; gap: 16rpx; margin-top: 24rpx; padding: 14rpx 0 calc(8rpx + env(safe-area-inset-bottom)); background: var(--pety-page-bg, #F2F1F4); }
.step-primary, .step-secondary { height: 92rpx; padding: 0 24rpx; margin: 0; border-radius: 22rpx; font-size: 27rpx; line-height: 92rpx; }
.step-primary { flex: 1; background: var(--pety-primary, #62677A); color: #FFF; }
.step-secondary { width: 190rpx; background: var(--pety-primary-soft, #E2E3EA); color: var(--pety-primary, #62677A); }
.tap-button { transform: scale(.98); opacity: .9; }
.tap-icon { transform: scale(.96); opacity: .72; }
.tap-soft { transform: scale(.98); opacity: .76; }
.reduce-motion .persona-shell { animation: personaFade 100ms ease both; }
.reduce-motion .progress-value, .reduce-motion .memory-list, .reduce-motion .memory-item { transition: none; }
@media (max-width: 380px) {
  .persona-shell { padding-left: 24rpx; padding-right: 24rpx; }
  .question-surface { padding-left: 24rpx; padding-right: 24rpx; }
  .overview-secondary-actions { flex-direction: column; }
  .overview-secondary { width: 100%; }
}
@keyframes personaEnter { from { opacity: 0; transform: translateY(10rpx); } to { opacity: 1; transform: translateY(0); } }
@keyframes personaFade { from { opacity: 0; } to { opacity: 1; } }
</style>
