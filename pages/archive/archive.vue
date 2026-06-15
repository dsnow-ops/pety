<template>
  <view class="archive-page">
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
        <image :src="activePet.photo || activePet.avatar" class="pet-photo" mode="aspectFill"></image>
        <view class="pet-copy">
          <text class="pet-name">{{ activePet.name }}</text>
          <text class="pet-desc">档案越完整，问诊时越能少说重复的话</text>
          <view class="stage-row">
            <text class="stage-pill">{{ relationshipConfig.stageName }}</text>
            <text class="stage-desc">{{ relationshipConfig.coreTask }}</text>
          </view>
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
  </view>
</template>

<script>
import { getActivePet } from '../../common/pet-store.js';
import { getPetProfile, getProfileCompletion, savePetProfile } from '../../common/profile-store.js';
import { getPetRelationshipStage, getRelationshipConfig } from '../../common/relationship-config.js';

export default {
  data() {
    return {
      activePet: null,
      form: getPetProfile(),
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
    completion() {
      return getProfileCompletion(this.form);
    }
  },
  onShow() {
    this.loadArchive();
  },
  methods: {
    loadArchive() {
      const activePet = getActivePet();
      this.activePet = activePet;
      this.form = activePet ? getPetProfile(activePet.id) : getPetProfile();
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
      setTimeout(() => {
        this.goBack();
      }, 650);
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
</style>
