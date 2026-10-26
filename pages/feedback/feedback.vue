<template>
  <view class="feedback-page" :class="petThemeClass" :style="[appThemeStyle, {'--ui-font-scale': String(uiFontScale)}]">
    <scroll-view scroll-y class="feedback-scroll">
      <view class="feedback-shell">
        <view class="feedback-header">
          <button class="back-button" hover-class="icon-button-hover" @click="goBack">
            <uni-icons type="left" size="22" color="#302A23"></uni-icons>
          </button>
          <view class="header-copy">
            <text class="header-kicker">PRIVATE FEEDBACK</text>
            <text class="header-title">留言信箱</text>
            <text class="header-subtitle">你的每一条留言都会被认真看到。</text>
          </view>
          <view class="header-placeholder"></view>
        </view>

        <view class="form-card">
          <view class="field-head">
            <text class="field-label">想告诉我们什么</text>
            <text class="field-required">必选</text>
          </view>
          <view class="category-grid">
            <button
              v-for="item in categories"
              :key="item.key"
              :class="['category-chip', category === item.key ? 'category-chip-active' : '']"
              hover-class="category-chip-hover"
              @click="selectCategory(item.key)"
            >
              {{ item.label }}
            </button>
          </view>

          <view class="field-block">
            <view class="field-head">
              <text class="field-label">标题</text>
              <text class="field-meta">可选 · {{ title.length }}/{{ maxTitleLength }}</text>
            </view>
            <input
              v-model="title"
              class="title-input"
              :maxlength="maxTitleLength"
              placeholder="用一句话概括"
              placeholder-style="color:#AAA195"
            />
          </view>

          <view class="field-block">
            <view class="field-head">
              <text class="field-label">详细内容</text>
              <text class="field-meta">{{ content.length }}/{{ maxContentLength }}</text>
            </view>
            <textarea
              v-model="content"
              class="content-input"
              :maxlength="maxContentLength"
              :show-confirm-bar="false"
              placeholder="请描述发生了什么、你的期待，或任何想告诉归爪的话（至少 10 字）"
              placeholder-style="color:#AAA195"
            ></textarea>
          </view>
        </view>

        <view class="form-card image-card">
          <view class="field-head">
            <view>
              <text class="field-label">图片</text>
              <text class="image-hint">最多 3 张，上传前会压缩，每张不超过 2MB</text>
            </view>
            <text class="field-meta">{{ images.length }}/{{ maxImages }}</text>
          </view>

          <view class="image-grid">
            <view
              v-for="item in images"
              :key="item.id"
              :class="['image-item', item.status === 'failed' ? 'image-item-failed' : '']"
            >
              <image
                :src="item.localPath || item.fileId"
                class="feedback-image"
                mode="aspectFill"
                @click="previewImage(item)"
              ></image>
              <view v-if="item.status === 'uploading'" class="image-state">
                <text>{{ item.progress }}%</text>
                <view class="progress-track">
                  <view class="progress-value" :style="{ width: item.progress + '%' }"></view>
                </view>
              </view>
              <view v-if="item.status === 'failed'" class="image-state image-state-failed">
                <text>上传失败</text>
                <button class="image-retry" hover-class="small-button-hover" @click.stop="retryImage(item)">重试</button>
              </view>
              <button
                class="image-remove"
                hover-class="small-button-hover"
                :disabled="item.status === 'uploading'"
                @click.stop="removeImage(item)"
              >
                <uni-icons type="closeempty" size="15" color="#FFFFFF"></uni-icons>
              </button>
            </view>

            <button
              v-if="images.length < maxImages"
              class="image-add"
              hover-class="image-add-hover"
              :disabled="isBusy"
              @click="chooseImageSource"
            >
              <uni-icons type="camera" size="24" color="#7B6B5B"></uni-icons>
              <text>{{ isPreparingImages ? '处理中' : '添加图片' }}</text>
            </button>
          </view>
        </view>

        <view class="form-card diagnostic-card">
          <view class="diagnostic-row">
            <view class="diagnostic-copy">
              <text class="field-label">附带基本诊断信息</text>
              <text class="diagnostic-desc">仅包含 App 版本、平台、系统版本、当前页面和登录状态。</text>
            </view>
            <switch
              :checked="includeDiagnostics"
              color="#6D5945"
              @change="handleDiagnosticsChange"
            />
          </view>
        </view>

        <view class="privacy-note">
          <uni-icons type="locked" size="18" color="#7B6B5B"></uni-icons>
          <view class="privacy-copy">
            <text>这是写给归爪开发者的私下留言，不会公开展示。</text>
            <text>请不要填写密码、支付信息或其他不希望上传的隐私内容。</text>
          </view>
        </view>

        <button
          class="submit-button"
          hover-class="submit-button-hover"
          :disabled="isBusy"
          @click="submitFeedback"
        >
          <text>{{ submitButtonText }}</text>
        </button>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import {scopedStorage,captureDataScope,isDataScopeCurrent} from "../../common/scoped-storage.js";
import {subscribeAccountScope} from "../../common/auth-store.js";
import { getCurrentUser } from '../../common/auth-store.js';
import {
  PRODUCT_FEEDBACK_CATEGORIES,
  PRODUCT_FEEDBACK_DEVICE_KEY,
  PRODUCT_FEEDBACK_DRAFT_KEY,
  PRODUCT_FEEDBACK_MAX_CONTENT_LENGTH,
  PRODUCT_FEEDBACK_MAX_IMAGE_BYTES,
  PRODUCT_FEEDBACK_MAX_IMAGES,
  PRODUCT_FEEDBACK_MAX_TITLE_LENGTH,
  PRODUCT_FEEDBACK_MIN_CONTENT_LENGTH
} from '../../common/product-feedback.js';

const ALLOWED_IMAGE_TYPES = ['jpg', 'jpeg', 'png', 'webp'];

function createUuid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 8)}`;
}

function hashString(value) {
  let hash = 2166136261;
  const source = String(value || '');
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getPathExtension(path = '') {
  const cleanPath = String(path).split('?')[0].toLowerCase();
  const match = cleanPath.match(/\.([a-z0-9]+)$/);
  return match ? match[1] : '';
}

export default {
  data() {
    return {
      loadedDataScope:captureDataScope(),unsubscribeDataScope:null,categories: PRODUCT_FEEDBACK_CATEGORIES,
      category: '',
      title: '',
      content: '',
      images: [],
      includeDiagnostics: true,
      isPreparingImages: false,
      isUploadingImages: false,
      isSubmitting: false,
      submitted: false,
      maxImages: PRODUCT_FEEDBACK_MAX_IMAGES,
      maxTitleLength: PRODUCT_FEEDBACK_MAX_TITLE_LENGTH,
      maxContentLength: PRODUCT_FEEDBACK_MAX_CONTENT_LENGTH
    };
  },
  computed: {
    isBusy() {
      return this.isPreparingImages || this.isUploadingImages || this.isSubmitting;
    },
    submitButtonText() {
      if (this.isPreparingImages) return '正在处理图片';
      if (this.isUploadingImages) return '正在上传图片';
      if (this.isSubmitting) return '正在送达';
      return '提交留言';
    }
  },
  onLoad() {
    this.loadedDataScope=captureDataScope();
    this.unsubscribeDataScope=subscribeAccountScope(()=>{
      if(this.ownsDataScope())return;
      this.category='';this.title='';this.content='';this.images=[];this.includeDiagnostics=false;
    });
    this.restoreDraft();
  },
  onHide() {
    if (!this.submitted) this.saveDraft();
  },
  onShow() {if(!this.ownsDataScope())uni.switchTab({url:"/pages/home/home"});},
  onUnload() {
    this.unsubscribeDataScope?.();this.unsubscribeDataScope=null;
    if (!this.submitted) this.saveDraft();
  },
  methods: {
    ownsDataScope(){return isDataScopeCurrent(this.loadedDataScope);},
    goBack() {
      if (this.isBusy) {
        uni.showToast({ title: '正在处理留言，请稍等', icon: 'none' });
        return;
      }
      uni.navigateBack();
    },
    selectCategory(category) {
      this.category = category;
      this.saveDraft();
    },
    handleDiagnosticsChange(event) {
      this.includeDiagnostics = Boolean(event.detail.value);
      this.saveDraft();
    },
    chooseImageSource() {
      if(!this.ownsDataScope())return;
      if (this.isBusy) return;
      const remaining = this.maxImages - this.images.length;
      if (remaining <= 0) {
        uni.showToast({ title: '最多选择 3 张图片', icon: 'none' });
        return;
      }

      uni.showActionSheet({
        itemList: ['拍照', '从相册选择'],
        success: result => {
          this.chooseImages(result.tapIndex === 0 ? 'camera' : 'album', remaining);
        }
      });
    },
    chooseImages(sourceType, count) {
      if(!this.ownsDataScope())return;
      uni.chooseImage({
        count,
        sourceType: [sourceType],
        sizeType: ['compressed'],
        success: async result => {
          if(!this.ownsDataScope())return;
          const tempFiles = Array.isArray(result.tempFiles)
            ? result.tempFiles
            : (result.tempFilePaths || []).map(path => ({ path }));
          await this.prepareImages(tempFiles);
        },
        fail: error => {
          if (!error || !String(error.errMsg || '').includes('cancel')) {
            uni.showToast({ title: '暂时无法选择图片', icon: 'none' });
          }
        }
      });
    },
    async prepareImages(tempFiles) {
      if(!this.ownsDataScope())return;
      if (!tempFiles.length) return;
      this.isPreparingImages = true;

      try {
        for (const tempFile of tempFiles) {
          if (this.images.length >= this.maxImages) break;
          try {
            const prepared = await this.prepareSingleImage(tempFile);
            if(!this.ownsDataScope())return;
            this.images.push(prepared);
          } catch (error) {
            uni.showToast({
              title: this.getImagePreparationError(error),
              icon: 'none'
            });
          }
        }
        this.saveDraft();
      } finally {
        this.isPreparingImages = false;
      }
    },
    getImagePreparationError(error) {
      const safeMessages = new Set([
        '没有读取到图片',
        '仅支持 JPG、PNG 或 WebP 图片',
        '请改用 JPG 或 PNG 图片',
        '图片压缩后仍超过 2MB，请换一张',
        '请选择常见图片格式'
      ]);
      const message = String(error && error.message || '');
      return safeMessages.has(message) ? message : '这张图片无法使用';
    },
    async prepareSingleImage(tempFile = {}) {
      const originalPath = tempFile.path || tempFile.tempFilePath || '';
      if (!originalPath) throw new Error('没有读取到图片');

      const imageInfo = await this.getImageInfo(originalPath);
      const detectedType = String(imageInfo.type || getPathExtension(originalPath)).toLowerCase();
      if (!ALLOWED_IMAGE_TYPES.includes(detectedType)) {
        throw new Error('仅支持 JPG、PNG 或 WebP 图片');
      }

      let compressedPath = await this.compressImage(originalPath, 72);
      let fileSize = await this.getFileSize(compressedPath, tempFile.size);
      if (fileSize > PRODUCT_FEEDBACK_MAX_IMAGE_BYTES) {
        compressedPath = await this.compressImage(originalPath, 45);
        fileSize = await this.getFileSize(compressedPath, tempFile.size);
      }
      if (!fileSize || fileSize > PRODUCT_FEEDBACK_MAX_IMAGE_BYTES) {
        throw new Error('图片压缩后仍超过 2MB，请换一张');
      }

      const outputInfo = await this.getImageInfo(compressedPath);
      const outputType = String(outputInfo.type || getPathExtension(compressedPath)).toLowerCase();
      if (!['jpg', 'jpeg', 'png'].includes(outputType)) throw new Error('请改用 JPG 或 PNG 图片');

      const localPath = await this.persistLocalFile(compressedPath);
      return {
        id: createUuid(),
        localPath,
        extension: outputType === 'jpeg' ? 'jpg' : outputType,
        size: fileSize,
        status: 'ready',
        progress: 0,
        fileId: '',
        error: ''
      };
    },
    getImageInfo(path) {
      return new Promise((resolve, reject) => {
        uni.getImageInfo({
          src: path,
          success: resolve,
          fail: () => reject(new Error('请选择常见图片格式'))
        });
      });
    },
    compressImage(path, quality) {
      if (typeof uni.compressImage !== 'function') return Promise.resolve(path);
      return new Promise(resolve => {
        uni.compressImage({
          src: path,
          quality,
          success: result => resolve(result.tempFilePath || path),
          fail: () => resolve(path)
        });
      });
    },
    getFileSize(path, fallbackSize = 0) {
      if (typeof uni.getFileInfo !== 'function') return Promise.resolve(Number(fallbackSize) || 0);
      return new Promise(resolve => {
        uni.getFileInfo({
          filePath: path,
          success: result => resolve(Number(result.size) || Number(fallbackSize) || 0),
          fail: () => resolve(Number(fallbackSize) || 0)
        });
      });
    },
    persistLocalFile(path) {
      if (typeof uni.saveFile !== 'function') return Promise.resolve(path);
      return new Promise(resolve => {
        uni.saveFile({
          tempFilePath: path,
          success: result => resolve(result.savedFilePath || path),
          fail: () => resolve(path)
        });
      });
    },
    removeSavedFile(path) {
      if(!this.ownsDataScope())return;
      if (!path || typeof uni.removeSavedFile !== 'function') return;
      uni.removeSavedFile({ filePath: path, fail: () => {} });
    },
    removeImage(item) {
      if (!item || item.status === 'uploading') return;
      this.images = this.images.filter(image => image.id !== item.id);
      this.removeSavedFile(item.localPath);
      this.saveDraft();
    },
    previewImage(item) {
      const current = item && (item.localPath || item.fileId);
      if (!current) return;
      const urls = this.images.map(image => image.localPath || image.fileId).filter(Boolean);
      uni.previewImage({ current, urls });
    },
    async retryImage(item) {
      if(!this.ownsDataScope())return;
      if (!item || this.isBusy) return;
      this.isUploadingImages = true;
      try {
        await this.uploadImage(item);
        this.saveDraft();
      } finally {
        this.isUploadingImages = false;
      }
    },
    getFeedbackDeviceHash() {
      let seed = uni.getStorageSync(PRODUCT_FEEDBACK_DEVICE_KEY);
      if (!seed) {
        seed = createUuid();
        uni.setStorageSync(PRODUCT_FEEDBACK_DEVICE_KEY, seed);
      }
      return `${hashString(seed)}${hashString(`${seed}:feedback`)}`;
    },
    createCloudPath(item) {
      const extension = ALLOWED_IMAGE_TYPES.includes(item.extension) ? item.extension : 'jpg';
      return `product-feedback/${getLocalDateKey()}/${this.getFeedbackDeviceHash()}/${createUuid()}.${extension}`;
    },
    async uploadImage(item) {
      if(!this.ownsDataScope())return;
      if (!item || (item.status === 'uploaded' && item.ticketId)) return true;
      item.status = 'uploading';
      item.progress = 0;
      item.error = '';

      try {
        if (!item.localPath) { uni.showToast({ title: '旧图片需重新选择，文字草稿已保留', icon: 'none' }); throw new Error('local_image_missing'); }
        const token = uni.getStorageSync('uni_id_token') || '';
        if (!token) { uni.showToast({ title: '请先登录后附带图片，文字留言仍可提交', icon: 'none' }); throw new Error('login_required'); }
        const issued = await uniCloud.callFunction({ name: 'submit_product_feedback', data: { action: 'issueImageUpload', extension: item.extension, uniIdToken: token } });
        if(!this.ownsDataScope())return false;
        if (issued.result?.code !== 0 || !issued.result?.ticketId) throw new Error('upload_ticket_unavailable');
        item.ticketId = issued.result.ticketId;
        const result = await uniCloud.uploadFile({
          filePath: item.localPath,
          cloudPath: issued.result.cloudPath,
          onUploadProgress: progress => {
            if(!this.ownsDataScope())return;
            const directProgress = Number(progress && progress.progress);
            const loaded = Number(progress && progress.loaded);
            const total = Number(progress && progress.total);
            const calculatedProgress = Number.isFinite(directProgress)
              ? directProgress
              : (total > 0 ? (loaded / total) * 100 : 0);
            item.progress = Math.round(Math.min(100, Math.max(0, calculatedProgress)));
          }
        });
        if(!this.ownsDataScope())return false;
        const fileId = result && (result.fileID || result.fileId || result.url);
        if (!fileId) throw new Error('missing_file_id');
        const completed = await uniCloud.callFunction({ name: 'submit_product_feedback', data: { action: 'completeImageUpload', ticketId: item.ticketId, fileId, uniIdToken: token } });
        if(!this.ownsDataScope())return false;
        if (completed.result?.code !== 0) throw new Error('upload_not_verified');
        item.fileId = fileId;
        item.progress = 100;
        item.status = 'uploaded';
        return true;
      } catch (error) {
        if(!this.ownsDataScope())return false;
        console.warn('product_feedback_image_upload_failed');
        item.status = 'failed';
        item.error = 'upload_failed';
        item.progress = 0;
        return false;
      }
    },
    async uploadPendingImages() {
      if(!this.ownsDataScope())return;
      const pending = this.images.filter(image => image.status !== 'uploaded' || !image.ticketId);
      if (!pending.length) return;

      this.isUploadingImages = true;
      try {
        for (const item of pending) {
          if(!this.ownsDataScope())return;
          await this.uploadImage(item);
        }
        this.saveDraft();
      } finally {
        this.isUploadingImages = false;
      }
    },
    promptUploadFailureAction(failedCount) {
      return new Promise(resolve => {
        uni.showModal({
          title: '有图片没有上传成功',
          content: `${failedCount} 张图片上传失败。可以重试，或移除失败图片后再次确认提交。`,
          confirmText: '重试',
          cancelText: '移除失败',
          confirmColor: '#6D5945',
          success: result => resolve(result.confirm ? 'retry' : 'remove'),
          fail: () => resolve('cancel')
        });
      });
    },
    validateForm() {
      if (!this.categories.some(item => item.key === this.category)) {
        uni.showToast({ title: '请先选择留言分类', icon: 'none' });
        return false;
      }
      const title = this.title.trim();
      const content = this.content.trim();
      if (title.length > PRODUCT_FEEDBACK_MAX_TITLE_LENGTH) {
        uni.showToast({ title: '标题不能超过 60 字', icon: 'none' });
        return false;
      }
      if (content.length < PRODUCT_FEEDBACK_MIN_CONTENT_LENGTH) {
        uni.showToast({ title: '详细内容至少写 10 字', icon: 'none' });
        return false;
      }
      if (content.length > PRODUCT_FEEDBACK_MAX_CONTENT_LENGTH) {
        uni.showToast({ title: '详细内容不能超过 1000 字', icon: 'none' });
        return false;
      }
      if (this.images.length > PRODUCT_FEEDBACK_MAX_IMAGES) {
        uni.showToast({ title: '最多提交 3 张图片', icon: 'none' });
        return false;
      }
      return true;
    },
    buildDiagnostics() {
      if (!this.includeDiagnostics) return {};

      let systemInfo = {};
      let appInfo = {};
      try {
        systemInfo = uni.getSystemInfoSync() || {};
      } catch (error) {
        systemInfo = {};
      }
      try {
        appInfo = typeof uni.getAppBaseInfo === 'function' ? (uni.getAppBaseInfo() || {}) : {};
      } catch (error) {
        appInfo = {};
      }

      const pages = getCurrentPages();
      const currentPage = pages.length ? pages[pages.length - 1] : {};
      const user = getCurrentUser();
      return {
        appVersion: appInfo.appVersion || systemInfo.appVersion || '',
        platform: systemInfo.platform || '',
        systemVersion: systemInfo.system || systemInfo.osVersion || '',
        uniPlatform: systemInfo.uniPlatform || systemInfo.hostName || '',
        currentPage: currentPage.route || 'pages/feedback/feedback',
        isLoggedIn: user.loggedIn === true,
        isGuest: user.loggedIn !== true
      };
    },
    async submitFeedback() {
      if(!this.ownsDataScope())return;
      if (this.isBusy || !this.validateForm()) return;
      this.isSubmitting = true;

      try {
        const selectedImageCount = this.images.length;
        await this.uploadPendingImages();
        if(!this.ownsDataScope())return;
        let failedImages = this.images.filter(image => image.status === 'failed');

        if (failedImages.length) {
          const action = await this.promptUploadFailureAction(failedImages.length);
          if(!this.ownsDataScope())return;
          if (action === 'retry') {
            await this.uploadPendingImages();
        if(!this.ownsDataScope())return;
            failedImages = this.images.filter(image => image.status === 'failed');
            if (failedImages.length) {
              uni.showToast({ title: '仍有图片上传失败，请稍后重试', icon: 'none' });
              return;
            }
          } else if (action === 'remove') {
            failedImages.forEach(item => this.removeSavedFile(item.localPath));
            this.images = this.images.filter(image => image.status !== 'failed');
            this.saveDraft();
            uni.showToast({ title: '已移除失败图片，请确认后重新提交', icon: 'none' });
            return;
          } else {
            return;
          }
        }

        const imageFileIds = this.images
          .filter(image => image.status === 'uploaded' && image.fileId)
          .map(image => image.fileId);
        if (selectedImageCount > 0 && imageFileIds.length === 0) {
          uni.showToast({ title: '图片尚未上传成功，留言未提交', icon: 'none' });
          return;
        }

        const response = await uniCloud.callFunction({
          name: 'submit_product_feedback',
          data: {
            uniIdToken: uni.getStorageSync('uni_id_token') || '',
            category: this.category,
            title: this.title.trim(),
            content: this.content.trim(),
            imageFileIds,
            includeDiagnostics: this.includeDiagnostics,
            diagnostics: this.buildDiagnostics()
          }
        });
        if(!this.ownsDataScope())return;
        const result = response && response.result ? response.result : {};
        if (result.code !== 0) {
          this.showSubmitError(result);
          return;
        }

        this.submitted = true;
        this.images.forEach(item => this.removeSavedFile(item.localPath));
        scopedStorage.forScope(this.loadedDataScope).removeStorageSync(PRODUCT_FEEDBACK_DRAFT_KEY);
        uni.showModal({
          title: '留言已送达',
          content: '已经收到，谢谢你愿意告诉归爪。',
          showCancel: false,
          confirmText: '知道了',
          confirmColor: '#6D5945',
          success: () => {if(this.ownsDataScope())uni.navigateBack();}
        });
      } catch (error) {
        if(!this.ownsDataScope())return;
        console.warn('product_feedback_submit_failed');
        uni.showToast({ title: '暂时无法确认是否送达，请保留内容并重试', icon: 'none' });
      } finally {
        this.isSubmitting = false;
        if (!this.submitted) this.saveDraft();
      }
    },
    showSubmitError(result = {}) {
      const friendlyMessages = {
        FEEDBACK_RATE_LIMIT_HOUR: '这一小时留言有点多，请稍后再试',
        FEEDBACK_RATE_LIMIT_DAY: '今天的留言已达到上限，请明天再来',
        FEEDBACK_DUPLICATE: '这条留言已经收到，不需要重复提交',
        FEEDBACK_SUBMIT_UNCONFIRMED: '暂时无法确认是否送达，请保留内容并重试',
        FEEDBACK_INVALID_CATEGORY: '留言分类无效，请重新选择',
        FEEDBACK_INVALID_CONTENT: '请检查留言内容长度',
        FEEDBACK_INVALID_IMAGES: '图片信息不符合要求，请重新选择'
      };
      uni.showToast({
        title: friendlyMessages[result.errorCode] || '暂时无法确认是否送达，请保留内容并重试',
        icon: 'none'
      });
    },
    saveDraft() {
      if(!this.ownsDataScope())return;
      const hasDraft = Boolean(
        this.category ||
        this.title.trim() ||
        this.content.trim() ||
        this.images.length
      );
      if (!hasDraft) {
        scopedStorage.forScope(this.loadedDataScope).removeStorageSync(PRODUCT_FEEDBACK_DRAFT_KEY);
        return;
      }

      scopedStorage.forScope(this.loadedDataScope).setStorageSync(PRODUCT_FEEDBACK_DRAFT_KEY, {
        category: this.category,
        title: this.title.slice(0, PRODUCT_FEEDBACK_MAX_TITLE_LENGTH),
        content: this.content.slice(0, PRODUCT_FEEDBACK_MAX_CONTENT_LENGTH),
        includeDiagnostics: this.includeDiagnostics,
        images: this.images.slice(0, PRODUCT_FEEDBACK_MAX_IMAGES).map(item => ({
          id: item.id,
          localPath: item.localPath,
          extension: item.extension,
          size: item.size,
          status: item.status === 'uploaded' ? 'uploaded' : 'ready',
          progress: item.status === 'uploaded' ? 100 : 0,
          fileId: item.fileId || '',
          ticketId: item.ticketId || '',
          error: ''
        })),
        updatedAt: Date.now()
      });
    },
    restoreDraft() {
      if(!this.ownsDataScope())return;
      const draft = scopedStorage.forScope(this.loadedDataScope).getStorageSync(PRODUCT_FEEDBACK_DRAFT_KEY);
      if (!draft || typeof draft !== 'object') return;

      this.category = this.categories.some(item => item.key === draft.category) ? draft.category : '';
      this.title = String(draft.title || '').slice(0, PRODUCT_FEEDBACK_MAX_TITLE_LENGTH);
      this.content = String(draft.content || '').slice(0, PRODUCT_FEEDBACK_MAX_CONTENT_LENGTH);
      this.includeDiagnostics = draft.includeDiagnostics !== false;
      this.images = Array.isArray(draft.images)
        ? draft.images.slice(0, PRODUCT_FEEDBACK_MAX_IMAGES).map(item => ({
          id: item.id || createUuid(),
          localPath: String(item.localPath || ''),
          extension: ALLOWED_IMAGE_TYPES.includes(item.extension) ? item.extension : 'jpg',
          size: Number(item.size) || 0,
          status: item.status === 'uploaded' && item.fileId ? 'uploaded' : 'ready',
          progress: item.status === 'uploaded' && item.fileId ? 100 : 0,
          fileId: String(item.fileId || ''),
          ticketId: String(item.ticketId || ''),
          error: ''
        })).filter(item => item.localPath || item.fileId)
        : [];
    }
  }
};
</script>

<style scoped>
.feedback-page {
  min-height: 100vh;
  color: #302A23;
  background:
    radial-gradient(circle at 16% 5%, rgba(226, 190, 143, 0.3), transparent 32%),
    radial-gradient(circle at 88% 24%, rgba(176, 190, 164, 0.22), transparent 30%),
    linear-gradient(150deg, #F8F3EA 0%, #EEE6D9 55%, #E9ECE3 100%);
}

.feedback-scroll {
  height: 100vh;
}

.feedback-shell {
  padding: calc(54rpx + env(safe-area-inset-top)) 30rpx calc(64rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  animation: feedbackFadeUp 420ms ease both;
}

.feedback-header {
  display: flex;
  align-items: flex-start;
  gap: 20rpx;
}

.back-button,
.header-placeholder {
  width: 70rpx;
  height: 70rpx;
  flex-shrink: 0;
}

.back-button {
  margin: 0;
  padding: 0;
  border-radius: 50%;
  border: 1rpx solid rgba(255, 255, 255, 0.62);
  background: rgba(255, 255, 255, 0.48);
  box-shadow: 0 12rpx 30rpx rgba(65, 54, 44, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-button::after,
.category-chip::after,
.image-add::after,
.image-remove::after,
.image-retry::after,
.submit-button::after {
  border: none;
}

.header-copy {
  flex: 1;
  min-width: 0;
  text-align: center;
}

.header-kicker,
.header-title,
.header-subtitle,
.field-label,
.image-hint,
.diagnostic-desc,
.privacy-copy text {
  display: block;
}

.header-kicker {
  color: #8C7557;
  font-size: 19rpx;
}

.header-title {
  margin-top: 7rpx;
  font-size: 42rpx;
  font-weight: 600;
}

.header-subtitle {
  margin-top: 10rpx;
  color: #766D62;
  font-size: 24rpx;
  line-height: 1.45;
}

.form-card {
  margin-top: 28rpx;
  padding: 28rpx;
  border-radius: 30rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.6);
  background: rgba(255, 252, 247, 0.64);
  box-shadow: 0 18rpx 50rpx rgba(65, 54, 44, 0.07);
  backdrop-filter: blur(18rpx);
}

.field-head,
.diagnostic-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
}

.field-label {
  color: #302A23;
  font-size: 27rpx;
  font-weight: 600;
}

.field-required,
.field-meta {
  color: #94897C;
  font-size: 21rpx;
}

.field-required {
  color: #8C7557;
}

.category-grid {
  margin-top: 18rpx;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
}

.category-chip {
  width: 100%;
  height: 68rpx;
  margin: 0;
  padding: 0 14rpx;
  border-radius: 18rpx;
  border: 1rpx solid rgba(140, 117, 87, 0.14);
  background: rgba(255, 255, 255, 0.42);
  color: #6F6254;
  font-size: 23rpx;
  transition: transform 150ms ease, opacity 150ms ease;
}

.category-chip-active {
  color: #FFFFFF;
  background: #6D5945;
  border-color: #6D5945;
}

.category-chip-hover,
.image-add-hover,
.submit-button-hover {
  opacity: 0.86;
  transform: scale(0.98);
}

.field-block {
  margin-top: 30rpx;
}

.title-input,
.content-input {
  width: 100%;
  margin-top: 14rpx;
  border-radius: 20rpx;
  border: 1rpx solid rgba(140, 117, 87, 0.13);
  background: rgba(255, 255, 255, 0.48);
  color: #302A23;
  box-sizing: border-box;
}

.title-input {
  height: 82rpx;
  padding: 0 22rpx;
  font-size: 26rpx;
}

.content-input {
  min-height: 260rpx;
  padding: 20rpx 22rpx;
  font-size: 26rpx;
  line-height: 1.6;
}

.image-hint {
  margin-top: 7rpx;
  color: #8F8579;
  font-size: 21rpx;
  line-height: 1.4;
}

.image-grid {
  margin-top: 20rpx;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14rpx;
}

.image-item,
.image-add {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  border-radius: 20rpx;
  overflow: hidden;
  box-sizing: border-box;
}

.image-item {
  background: #E6DED3;
}

.feedback-image {
  width: 100%;
  height: 100%;
}

.image-add {
  margin: 0;
  border: 1rpx dashed rgba(109, 89, 69, 0.3);
  background: rgba(255, 255, 255, 0.34);
  color: #7B6B5B;
  font-size: 21rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
}

.image-remove {
  position: absolute;
  top: 8rpx;
  right: 8rpx;
  z-index: 3;
  width: 38rpx;
  height: 38rpx;
  margin: 0;
  padding: 0;
  border-radius: 50%;
  background: rgba(45, 40, 35, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-state {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  padding: 12rpx;
  color: #FFFFFF;
  font-size: 19rpx;
  background: rgba(42, 37, 33, 0.68);
  box-sizing: border-box;
}

.progress-track {
  height: 5rpx;
  margin-top: 7rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.28);
  overflow: hidden;
}

.progress-value {
  height: 100%;
  border-radius: inherit;
  background: #FFFFFF;
  transition: width 160ms linear;
}

.image-state-failed {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6rpx;
  background: rgba(118, 65, 62, 0.82);
}

.image-retry {
  height: 42rpx;
  margin: 0;
  padding: 0 12rpx;
  border-radius: 999rpx;
  color: #714442;
  background: rgba(255, 255, 255, 0.9);
  font-size: 18rpx;
  line-height: 42rpx;
}

.small-button-hover,
.icon-button-hover {
  opacity: 0.78;
  transform: scale(0.94);
}

.diagnostic-copy {
  flex: 1;
  min-width: 0;
}

.diagnostic-desc {
  margin-top: 8rpx;
  color: #8F8579;
  font-size: 22rpx;
  line-height: 1.45;
}

.privacy-note {
  margin-top: 24rpx;
  padding: 22rpx 24rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.34);
  color: #766D62;
  display: flex;
  align-items: flex-start;
  gap: 14rpx;
}

.privacy-copy {
  flex: 1;
  min-width: 0;
}

.privacy-copy text {
  font-size: 22rpx;
  line-height: 1.55;
}

.privacy-copy text + text {
  margin-top: 5rpx;
}

.submit-button {
  width: 100%;
  height: 92rpx;
  margin: 28rpx 0 0;
  border-radius: 24rpx;
  color: #FFFFFF;
  background: #6D5945;
  font-size: 29rpx;
  font-weight: 600;
  box-shadow: 0 18rpx 42rpx rgba(109, 89, 69, 0.2);
  transition: transform 150ms ease, opacity 150ms ease;
}

.submit-button[disabled],
.image-add[disabled] {
  opacity: 0.56;
}

.header-title { font-size: calc(24px * var(--ui-font-scale, 1)); }
.header-kicker { font-size: calc(11px * var(--ui-font-scale, 1)); }
.header-subtitle,
.field-required,
.field-meta,
.image-hint,
.diagnostic-desc,
.privacy-copy text { font-size: calc(12px * var(--ui-font-scale, 1)); overflow-wrap: anywhere; }
.field-label { font-size: calc(15px * var(--ui-font-scale, 1)); }
.field-head { flex-wrap: wrap; row-gap: 4px; }
.category-chip {
  height: auto;
  min-height: 44px;
  padding: 10px 6px;
  font-size: calc(14px * var(--ui-font-scale, 1));
  line-height: 1.5;
  white-space: normal;
  overflow-wrap: anywhere;
}
.title-input { min-height: 48px; font-size: calc(15px * var(--ui-font-scale, 1)); }
.content-input { font-size: calc(15px * var(--ui-font-scale, 1)); }
.submit-button { height: auto; min-height: 48px; padding: 12px; font-size: calc(16px * var(--ui-font-scale, 1)); line-height: 1.5; }
.back-button, .header-placeholder { width: 44px; height: 44px; }
.image-add { font-size: calc(12px * var(--ui-font-scale, 1)); }

@keyframes feedbackFadeUp {
  from {
    opacity: 0;
    transform: translateY(18rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
