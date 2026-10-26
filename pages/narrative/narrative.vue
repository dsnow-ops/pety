<template>
 <view :class="['narrative-page',petThemeClass,{'keyboard-open':keyboardOpen}]" :style="[appThemeStyle,insets]">
  <view class="creative-header">
   <button class="icon-button" :aria-label="tr('back')" @click="back"><uni-icons type="left" size="21" color="#45513F" /></button>
   <view class="identity"><text class="identity-name">{{petName}}</text><text class="identity-caption">{{stage==='write' ? v('writingHint') : v('pagePreview')}}</text></view>
   <button v-if="stage==='write'" class="nav-save save-record" :disabled="busy || !canSave" @click="saveRecord">{{v('save')}}</button>
   <button v-else class="icon-button" :aria-label="v('adjust')" @click="panel='adjust'"><uni-icons type="settings" size="21" color="#45513F" /></button>
  </view>
  <scroll-view class="creative-scroll" scroll-y :scroll-into-view="focusAnchor" :scroll-with-animation="false">
   <view v-if="recordReadError" class="record-read-error" :style="{'--ui-font-scale':uiFontScale}" role="alert"><text class="read-error-title">资料暂时没能读取</text><text>为保护已有内容，暂不开放编辑。请重试读取。</text><button @click="loadRecord">重新读取</button></view>
   <view v-if="!recordReadError && draft && stage==='write'" class="writing-body">
    <view class="writing-heading"><text>{{v(draft.mode==='current'?'writeMoment':'writeLetter')}}</text><button class="local-status" @click="showLocal"><view class="status-point"/>{{v('local')}}</button></view>
    <view class="writing-paper"><text v-if="draft.adoptedCandidate" class="sheet-note">正在编辑整理稿 · 原文仍保留</text>
     <text v-if="draft.title" class="optional-heading" @click="panel='details'">{{draft.title}}</text>
     <textarea :key="draft.id+':'+editorEpoch" id="writing-input" class="original" :value="draft.adoptedCandidate ? draft.text : draft.original" :maxlength="-1" :placeholder="tr('placeholder')" auto-height :cursor-spacing="28" @input="editText($event.detail.value)" @focus="inputFocus" @blur="inputBlur" />
     <view v-if="draft.media.length" class="photos"><view v-for="(asset,i) in draft.media" :key="asset.id" class="photo-tile"><image :src="photoUrls[i]" mode="aspectFit" @click="panel='photos'"/><button class="photo-remove" :aria-label="v('remove')" @click="removePhoto(i)">×</button></view></view>
     <view class="writing-toolbar"><button class="add-photo" :disabled="busy" @click="panel='sources'"><uni-icons type="image" size="20" color="#596650"/><text>{{v('photoAdd')}}</text><text v-if="draft.media.length" class="photo-count">{{draft.media.length}}/4</text></button><button class="more-button" @click="panel='details'">{{v('more')}} <uni-icons type="more-filled" size="18" color="#596650"/></button></view>
    </view>
    <view class="date-row"><button @click="panel='details'"><uni-icons type="calendar" size="16" color="#818776"/><text>{{draft.dateText || draft.localDate || v('dateUnknown')}}</text></button><text v-if="draft.hidden">{{tr('hide')}}</text></view>
    <view v-if="writeConflict" class="record-conflict" :style="{'--ui-font-scale':uiFontScale}" role="alert">
     <text class="conflict-title">这条记录在别处有变化</text>
     <text>当前输入仅保留在此页，没有覆盖已保存内容。可另存为新记录，或确认后重新读取。</text>
     <text v-if="conflictCopyError">{{conflictCopyError}}</text>
     <button class="conflict-copy" :disabled="busy || !canSave" @click="saveConflictCopy">另存为新记录</button>
     <button class="conflict-reload" :disabled="busy" @click="reloadLatestRecord">重新读取</button>
    </view>
    <view v-else-if="writeFailed" class="operation-error">{{v('storageFailed')}}</view>
    <text v-else-if="message" class="status" role="status">{{message}}</text>
    <view v-if="recordSaved" class="saved-note"><text>{{v('savedHint')}}</text><button class="preview-card make-page" :disabled="busy" @click="makePage">{{v('makePage')}} <uni-icons type="arrowright" size="20" color="#FFFDF8"/></button><button class="quiet-button" @click="openBook">{{v('seeBook')}}</button></view>
    <button class="polish-disclosure" @click="panel='polish'"><uni-icons type="compose" size="18" color="#79836C"/>{{v('polishEntry')}}<uni-icons type="right" size="14" color="#79836C"/></button>
   </view>
   <view v-if="draft && stage==='preview'" class="preview-body">
    <view class="preview-topline"><button @click="returnToWriting">{{v('editWords')}}</button><text>{{v('layoutHint')}}</text></view>
    <view class="previews"><view v-for="(url,i) in session.pages" :key="i" class="preview-page"><image :src="url" mode="widthFix" @click="zoomPreview(i)"/><button v-if="session.pages.length>1" class="download-page" :disabled="busy" @click="exportPage(i)">{{tr('export')}} · {{i+1}} / {{session.pages.length}}</button></view></view>
    <!-- #ifdef H5 -->
    <text v-if="session.pages.length>1" class="status">{{v('downloadHint')}}</text>
    <!-- #endif -->
    <view v-if="busy" class="render-status">{{v('inProgress')}}<button @click="cancel">{{tr('cancel')}}</button></view>
    <view v-if="session.state==='failed' || operationNotice" class="operation-error"><text>{{operationNotice || message}}</text><button v-if="!busy" @click="preview">{{tr('preview')}}</button><button v-if="session.state==='cancelled'" @click="operationNotice=''">{{v('dismiss')}}</button></view>
    <view class="layout-heading"><text>{{v('layout')}}</text><text v-if="templateVersion===1 && ['day','letter'].includes(templateId)">{{v('currentVersion')}}</text></view>
    <scroll-view scroll-x class="layout-strip"><view class="layout-track"><button v-for="item in layoutChoices" :key="item.id" :class="['layout-choice',{selected:templateId===item.id && templateVersion===item.version}]" @click="chooseLayout(item)"><view class="layout-picture"><image v-if="thumbs[item.id]?.url" :src="thumbs[item.id].url" mode="aspectFit"/><text v-else class="thumbnail-loading">…</text><text v-if="thumbs[item.id]?.example" class="example-label">{{v('example')}}</text><view v-if="templateId===item.id && templateVersion===item.version" class="selection-mark">✓</view></view><text class="layout-name">{{item.id==='day'?v('layoutDay'):item.id==='letter'?v('layoutLetter'):tr('template_'+item.id)}}</text><text v-if="thumbs[item.id]?.error" class="layout-reason">{{thumbs[item.id].error}}</text></button></view></scroll-view>
    <button class="adjust-link" @click="panel='adjust'">{{v('adjust')}} <uni-icons type="right" size="14" color="#596650"/></button>
    <text v-if="message && session.state!=='failed'" class="status">{{message}}</text>
   </view>
  </scroll-view>
  <view v-if="stage==='preview' && !panel" class="preview-actions"><button :disabled="busy || !session.pages.length" class="save-work" @click="saveWork">{{tr('saveWork')}}</button><button :disabled="busy || !session.pages.length" class="export-card" @click="exportImages">{{tr('export')}}</button></view>
  <view v-if="panel && draft" class="sheet-backdrop" @click="closePanel"><view class="creative-sheet" @click.stop><view class="sheet-head"><text>{{panelTitle}}</text><button @click="closePanel">{{v('done')}}</button></view><scroll-view scroll-y class="sheet-scroll">
   <template v-if="panel==='sources'"><button class="source-option" @click="panel='';choosePhoto()"><uni-icons type="image" size="24" color="#596650"/>{{v('fromAlbum')}}</button><button v-if="hasExistingAvatar" class="source-option" @click="panel='';chooseAvatar()"><uni-icons type="person" size="24" color="#596650"/>{{v('fromAvatar')}}</button></template>
   <template v-if="panel==='details'">
    <input class="field" :value="draft.title" :maxlength="200" :placeholder="tr('optionalTitle')" @input="setField('title',$event.detail.value)"/>
    <input class="field" :value="draft.mode==='current'?draft.localDate:draft.dateText" :maxlength="120" :placeholder="tr(draft.mode==='current'?'dateHint':'fuzzyDate')" @input="setField(draft.mode==='current'?'localDate':'dateText',$event.detail.value)"/>
    <view v-if="draft.mode==='deceased'" class="options"><button v-for="kind in ['letter','memory']" :key="kind" :class="{selected:draft.kind===kind}" @click="setField('kind',kind)">{{tr(kind)}}</button></view>
    <text class="field-label">{{v('tags')}}</text><view class="options"><button v-for="tag in ['habit','favoriteThing','first','ordinary']" :key="tag" :class="{selected:draft.tags.includes(tag)}" @click="toggleTag(tag)">{{draft.tags.includes(tag)?'✓ ':''}}{{tr(tag)}}</button></view>
    <view class="switch-row"><view><text>{{v('showAgain')}}</text><text class="switch-help">{{v('showAgainHint')}}</text></view><switch color="#596650" :checked="!draft.hidden" @change="setField('hidden',!$event.detail.value)"/></view>
    <view class="switch-row"><text>{{v('showName')}}</text><switch color="#596650" :checked="!draft.hidePetName" @change="setField('hidePetName',!$event.detail.value)"/></view>
   </template>
   <template v-if="panel==='photos' || panel==='adjust'">
    <template v-if="panel==='adjust'"><view v-if="draft.seal && templateVersion>=3" class="seal-settings"><text class="field-label">宠物专属印记</text><view class="options"><button @click="setSeal('enabled',!draft.seal.enabled)">{{draft.seal.enabled?'显示中 · 点击关闭':'已关闭 · 点击显示'}}</button><button :class="{selected:draft.seal.style==='vermilion'}" @click="setSeal('style','vermilion')">朱印</button><button :class="{selected:draft.seal.style==='emboss'}" @click="setSeal('style','emboss')">压印</button></view><view class="options"><button @click="setSeal('position',draft.seal.position==='right'?'left':'right')">{{draft.seal.position==='right'?'右下角':'左下角'}}</button><button v-for="(label,size) in {small:'小',medium:'中',large:'大'}" :key="size" :class="{selected:draft.seal.size===size}" @click="setSeal('size',size)">{{label}}</button></view></view><view class="switch-row"><text>{{v('showName')}}</text><switch color="#596650" :checked="!draft.hidePetName" @change="setField('hidePetName',!$event.detail.value)"/></view><view class="switch-row"><text>{{v('showDate')}}</text><switch color="#596650" :checked="!draft.hideDate" @change="setField('hideDate',!$event.detail.value)"/></view>
     <template v-if="templateId==='letter' && templateVersion>=2"><input class="field" :value="draft.salutation || ''" :maxlength="100" :placeholder="v('salutation')" @input="setField('salutation',$event.detail.value)"/><input class="field" :value="draft.signature || ''" :maxlength="100" :placeholder="v('signature')" @input="setField('signature',$event.detail.value)"/><input class="field" :value="draft.dateText || draft.localDate" :maxlength="120" :placeholder="v('dateOptional')" @input="setField('dateText',$event.detail.value)"/></template>
    </template>
    <view v-for="(asset,i) in draft.media" :key="asset.id" class="photo-settings"><view v-if="templateId==='day' && templateVersion>=2" class="photo-crop-frame" :style="{paddingTop:photoBox(asset)[3]/photoBox(asset)[2]*100+'%'}"><image :src="photoUrls[i]" mode="scaleToFill" :style="photoPreviewStyle(asset)"/></view><image v-else :src="photoUrls[i]" mode="aspectFit"/><view class="options"><button :class="{selected:asset.fit==='contain' || isPortrait(asset)}" @click="setFit(i,'contain')">{{tr('contain')}}</button><button :disabled="isPortrait(asset)" :class="{selected:asset.fit==='cover' && !isPortrait(asset)}" @click="setFit(i,'cover')">{{tr('cover')}}</button><button v-if="i>0" @click="movePhoto(i)">{{v('move')}}</button><button @click="removePhoto(i)">{{v('remove')}}</button></view><template v-if="asset.fit==='cover' && !isPortrait(asset)"><text class="field-label">{{v('cropHorizontal')}}</text><slider :value="(asset.cropX ?? .5)*100" activeColor="#596650" @change="setCrop(i,'cropX',$event.detail.value/100)"/><text class="field-label">{{v('cropVertical')}}</text><slider :value="(asset.cropY ?? .5)*100" activeColor="#596650" @change="setCrop(i,'cropY',$event.detail.value/100)"/></template></view>
   </template>
   <template v-if="panel==='polish'"><text class="sheet-note">{{tr('polishOptional')}}</text><view class="options"><button v-for="style in ['preserve','diary','brief','letter']" :key="style" :class="{selected:polishStyle===style}" @click="polishStyle=style">{{tr('style_'+style)}}</button></view><button class="make-page" :disabled="polishing" @click="polish">{{tr(polishing?'polishing':'polish')}}</button><text class="status">{{polishStatus || message}}</text><view v-if="draft.candidate" class="candidate"><text class="field-label">{{tr('candidateHint')}}</text><textarea :value="draft.candidate.text" :maxlength="-1" auto-height @input="editCandidate($event.detail.value)"/><view class="options"><button @click="useCandidate">{{tr('useCandidate')}}</button><button @click="keepOriginal">{{tr('keepOriginal')}}</button></view></view></template>
  </scroll-view></view></view>
  <NarrativeCanvas ref="canvas"/><NarrativeCanvas ref="thumbnailCanvas"/>
 </view>
</template>
<script>
import { creativeInsets } from '../../common/creative-insets.js';
import NarrativeCanvas from '../../components/NarrativeCanvas.vue';
import { getNarrativeStore, narrativeMode } from '../../common/narrative-store.js';
import { persistNarrativePhoto, resolveNarrativePhoto, releaseNarrativePhoto, narrativeMediaRefs,removeUnusedNarrativeMedia } from '../../common/narrative-media.js';
import { createCardExportSession, canvasCallback } from '../../common/card-renderer.js';
import { getActivePet, subscribePetSelection } from '../../common/pet-store.js';
import { captureDataScope, isDataScopeCurrent } from '../../common/scoped-storage.js';
import { t } from '../../common/i18n.js';
import { CARD_TEMPLATES, photoRect } from '../../common/card-layout.js';
import {hydratePetHeroAsset} from '../../common/avatar-display-asset.js';
import { createNarrativePolisher, narrativeFailureMessage } from '../../common/narrative-api.js';
import {syncCollections,collectionRecipes} from '../../common/companion-collection.js';
export default {
  components: { NarrativeCanvas },
  data: () => ({ recordReadError:false,loadOptions:{},draft: null, petName: '', scope: null, store: null, photoUrls: [], message: '', timer: null, unsubscribe: null,
    session: createCardExportSession(), templates:CARD_TEMPLATES, templateId: 'letter', workId: '', editingWorkId:'', visible: true, mediaBusy: false, mediaErrorCode: '',
    insets:creativeInsets(),stage:'write',panel:'',recordSaved:false,writeFailed:false,writeConflict:false,conflictCopyError:'',editorEpoch:0,keyboardOpen:false,focusAnchor:'',templateVersion:3,thumbs:{},thumbEpoch:0,operationNotice:'',polisher:createNarrativePolisher(),polishStyle:'preserve',polishStatus:'',polishing:false,polishEpoch:0 }),
  computed: { canSave(){return Boolean(this.draft && (this.draft.original.trim() || this.draft.media.length));},layoutChoices(){return [...this.templates].sort((a,b)=>['day','letter','quote','collage','date','habit'].indexOf(a.id)-['day','letter','quote','collage','date','habit'].indexOf(b.id));},panelTitle(){return this.v(({sources:'photoSources',details:'details',photos:'photoOrder',adjust:'adjust',polish:'polishEntry'})[this.panel]);},busy() { return this.mediaBusy || ['preparing','rendering','saving'].includes(this.session.state); },hasExistingAvatar(){return Boolean(this.draft && getActivePet()?.generatedAvatarFileId);} },
  onLoad(options = {}) { this.loadOptions=options;this.loadRecord(); },
  onShow() { this.visible = true;this.insets=creativeInsets(); },
  onHide() { this.flush(); this.visible = false; this.polishEpoch++;this.thumbEpoch++;this.session.cancel(); },
  onUnload() { this.flush(); this.visible = false; this.polishEpoch++;this.thumbEpoch++;this.session.cancel(); this.unsubscribe?.(); this.clearPhotos(); },
  onBackPress() { if(this.panel){this.closePanel();return true;}if(this.stage==='preview'){this.returnToWriting();return true;}return !this.flush(); },
  methods: {
    loadRecord(){this.recordReadError=false;this.unsubscribe?.();this.unsubscribe=null;try{this.loadRecordData(this.loadOptions);}catch(_){this.recordReadError=true;this.draft=null;this.clearPhotos();this.session.cancel();}},
    loadRecordData(options){
    const pet = getActivePet(); if (!pet) { uni.reLaunch({url:'/pages/home/home'}); return; }
    this.scope = captureDataScope(); this.petName = pet.name; this.store = getNarrativeStore(pet.id, this.scope);
    this.store.list();
    const work = options.work ? this.store.read().works[options.work] : null;
    this.draft = work ? {...work.snapshot, id:this.store.create(work.snapshot.mode).id,baseRevision:0,draftVersion:0} : options.id ? this.store.open(options.id) : this.store.create(narrativeMode(pet.relationshipStage || pet.status));
    if(!work&&!options.id&&pet.petSeal)this.draft.seal={asset:JSON.parse(JSON.stringify(pet.petSeal)),enabled:true,style:'vermilion',position:'right',size:'medium'};
    if (work) { this.templateId = work.templateId;this.templateVersion=work.templateVersion||1; this.workId = work.id; this.editingWorkId=work.id;this.draft.sourceRefs=work.sources;this.petName=work.petName||this.petName; }
    if (options.recipe) {
      const recipe=collectionRecipes(this.store).find(r=>r.key===options.recipe);
      if(recipe?.available){const records=this.store.list();this.draft.generatedRecipe=true;this.draft.sourceRefs=recipe.sources;this.draft.original=recipe.sources.map(s=>records.find(r=>r.id===s.id)).filter(Boolean).map(r=>[r.localDate,r.original].filter(Boolean).join('\n')).join('\n\n');this.draft.text=this.draft.original;this.draft.title=this.tr('collection_'+recipe.rule);this.templateId='letter';}
    }
    if(options.id && this.draft?.legacy && this.draft.kind==='care'){const date=this.draft.localDate;this.draft=null;uni.redirectTo({url:'/pages/calendar/calendar?date='+date+'&petId='+encodeURIComponent(pet.id)});return;}
    if(this.draft && options.date && !options.id && !work)this.draft.localDate=options.date;
    if (this.draft && options.tag) this.draft.tags = [options.tag].filter(tag=>['habit','favoriteThing','first','ordinary'].includes(tag));
    if (!this.draft) { this.message = this.tr('missing'); return; }
    this.unsubscribe = subscribePetSelection(() => {
      if(this.current()&&!this.editingWorkId)this.petName=getActivePet()?.name||this.petName;
      if (!this.current()) { this.flush(); this.session.cancel(); this.draft = null; this.clearPhotos(); this.message = this.tr('contextChanged'); }
    });
    this.recordSaved=Boolean(this.draft.baseRevision);this.loadPhotos();if(work){this.stage='preview';this.$nextTick(()=>this.preview().then(()=>this.loadThumbnails()));}
    },
    setSeal(key,value){this.draft.seal[key]=value;this.changed();},
    v(key){return t('creative.'+key);},
    inputFocus(){this.keyboardOpen=true;this.focusAnchor='writing-input';},inputBlur(){this.keyboardOpen=false;this.focusAnchor='';},
    showLocal(){uni.showModal({title:this.v('local'),content:this.v('localDetail'),showCancel:false});},
    closePanel(){const regenerate=this.panel==='adjust' && this.stage==='preview';this.panel='';if(regenerate)this.preview().then(()=>this.loadThumbnails());},
    returnToWriting(){this.thumbEpoch++;this.session.cancel();this.stage='write';this.operationNotice='';this.message=this.recordSaved?this.v('saved'):this.tr('draftHint');},
    setCrop(i,key,value){this.draft.media[i][key]=value;this.changed();},
    photoBox(asset){return this.templateVersion>=3?(this.isPortrait(asset)?[0,0,776,730]:[0,0,936,820]):(this.isPortrait(asset)?[0,0,776,700]:[0,0,904,776]);},
    photoPreviewStyle(asset){const box=this.photoBox(asset),rect=photoRect(asset,box,this.isPortrait(asset)?'contain':asset.fit);return {left:rect.dest[0]/box[2]*100+'%',top:rect.dest[1]/box[3]*100+'%',width:rect.dest[2]/box[2]*100+'%',height:rect.dest[3]/box[3]*100+'%'};},
    isPortrait(asset){return this.templateId==='day'&&this.templateVersion>=2&&Boolean(asset.sourceFileId||asset.sourceKind==='portrait');},
    async makePage(){if(!this.flush())return;if(!this.editingWorkId){uni.navigateTo({url:'/pages/card-compose/card-compose?recordId='+encodeURIComponent(this.draft.id)});return;}this.stage='preview';this.panel='';if(!this.editingWorkId){const id=this.draft.media.length===1?'day':this.draft.media.length>1?'collage':'letter';this.selectTemplate(id);}await this.preview();await this.loadThumbnails();},
    cardInput(id=this.templateId,version=this.templateVersion){return {seal:this.draft.seal,templateId:id,templateVersion:version,text:this.draft.text||this.draft.original,media:this.draft.media,petName:this.draft.hidePetName?'':this.petName,title:this.draft.title,dateText:this.draft.dateText||this.draft.localDate,hideDate:this.draft.hideDate,salutation:this.draft.salutation||'',signature:this.draft.signature||'',mode:this.draft.mode};},
    layoutError(code){return code==='CARD_DAY_LONG'?this.v('dayLong'):this.tr(({CARD_USE_LETTER:'useLetter',CARD_PHOTO_COUNT:'photoCount',CARD_TITLE_LONG:'titleLong',NARRATIVE_EMPTY:'empty'})[code]||'renderFailed');},
    async loadThumbnails(){const epoch=++this.thumbEpoch,revision=this.draft?.revision;this.thumbs={};const valid=()=>epoch===this.thumbEpoch&&this.current()&&this.visible&&this.draft.revision===revision;
      for(const item of this.layoutChoices){if(!valid())return;let url='',error='',example=false;try{[url]=await this.$refs.thumbnailCanvas.render(this.cardInput(item.id,item.version),this.scope,this.draft.petId,valid,{firstPageOnly:true});}catch(e){if(!valid())return;error=this.layoutError(e.code||e.message);example=true;const sample={templateId:item.id,templateVersion:item.version,text:this.v('writingHint'),petName:'',mode:this.draft.mode,media:Array.from({length:item.minPhotos},()=>({width:900,height:700,fit:'contain'}))};try{[url]=await this.$refs.thumbnailCanvas.render(sample,this.scope,this.draft.petId,valid,{firstPageOnly:true,example:true});}catch(_){}}
        if(valid())this.thumbs={...this.thumbs,[item.id]:{url,error,example}};
      }
    },
    async chooseLayout(item){if(this.busy)return;if(this.thumbs[item.id]?.error){this.operationNotice=this.thumbs[item.id].error;return;}this.selectTemplate(item.id,item.version);await this.preview();},
    zoomPreview(index){uni.previewImage({urls:this.session.pages,current:this.session.pages[index]});},
    async exportPage(index){if(!this.current()||this.busy)return;const epoch=this.session.epoch,draft=this.draft;this.mediaBusy=true;const valid=()=>this.current()&&this.visible&&this.draft===draft&&this.session.epoch===epoch;try{await this.savePageFile(this.session.pages[index],index);if(!valid())return;this.message=this.tr('exported');
      // #ifdef H5
      this.message=this.tr('downloadStarted');
      // #endif
    }catch(_){if(valid())this.message=this.tr('saveFailed');}finally{this.mediaBusy=false;}},
    async savePageFile(path,index){if(!this.current()||!this.visible)throw new Error('CARD_CANCELLED');
      // #ifdef H5
      const link=document.createElement('a');link.href=path;link.download=`Lumiere-${this.draft.id}-${index+1}.png`;link.click();
      // #endif
      // #ifndef H5
      await canvasCallback((success,fail)=>uni.saveImageToPhotosAlbum({filePath:path,success,fail}));
      // #endif
    },
    tr(key) { return t(`narrative.${key}`); },
    current() { return Boolean(this.draft && isDataScopeCurrent(this.scope) && getActivePet()?.id === this.draft.petId); },
    back() { if(this.panel){this.closePanel();return;}if(this.stage==='preview'){this.returnToWriting();return;}if(this.flush())uni.navigateBack(); },
    openBook() { if (this.flush()) uni.navigateTo({url:'/pages/album/album'}); },
    clearPhotos() { this.photoUrls.forEach(releaseNarrativePhoto); this.photoUrls = []; },
    async loadPhotos() {
      this.clearPhotos(); const revision = this.draft?.revision; const urls = [];
      try { for (const asset of this.draft?.media || []) { const p = await resolveNarrativePhoto(asset,this.scope,this.draft.petId); urls.push(p.path); }
        if (!this.current() || this.draft.revision !== revision) { urls.forEach(releaseNarrativePhoto); return; } this.photoUrls = urls;
      } catch (_) { urls.forEach(releaseNarrativePhoto); this.message = this.tr('mediaError'); }
    },
    changed() { this.recordSaved=false;this.thumbEpoch++;this.draft.revision++; this.session.invalidate(); this.workId = this.editingWorkId; clearTimeout(this.timer); this.flush(); },
    setField(key,value) { this.draft[key]=value;this.changed(); },
    toggleTag(tag) { this.draft.tags=this.draft.tags.includes(tag)?this.draft.tags.filter(t=>t!==tag):[...this.draft.tags,tag];this.changed(); },
    selectTemplate(id,version) {const next=version||this.templates.find(t=>t.id===id)?.version||1;if(this.editingWorkId && (id!==this.templateId||next!==this.templateVersion)){this.editingWorkId='';this.workId='';this.petName=getActivePet()?.name||this.petName;this.message=this.v('newVersion');}this.templateId=id;this.templateVersion=next;this.session.invalidate();this.workId=this.editingWorkId;this.operationNotice=''; },
    setFit(i,fit) { this.draft.media[i].fit=fit;this.changed(); },
    movePhoto(i) { const media=this.draft.media.splice(i,1)[0];this.draft.media.splice(i-1,0,media);this.changed();this.loadPhotos(); },
    editText(value) { if(!this.draft.adoptedCandidate)this.draft.original = value; this.draft.text = value; this.changed(); },
    async polish() {
      this.polishStatus="";
      if(!this.current()||this.polishing)return;
      if(!this.draft.original.trim()){this.polishStatus=this.tr('empty');return;}
      if(this.draft.original.length>600){this.polishStatus=this.tr('tooLong');return;}
      if(!this.scope.namespace.startsWith('account:')){this.polishStatus=narrativeFailureMessage(new Error('NARRATIVE_LOGIN_REQUIRED'));return;}
      if(!this.flush())return;
      const context=this.draft.id,revision=this.draft.revision,epoch=++this.polishEpoch,style=this.polishStyle;
      this.polishing=true;
      try {
        if(!this.store.read().proposals.writingConsent){
          const consent=await new Promise(resolve=>uni.showModal({title:this.tr('polish'),content:this.tr('writingConsent'),success:resolve,fail:()=>resolve({confirm:false})}));
          if(!consent.confirm)return;
          if(!this.current()||this.polishEpoch!==epoch)return;
          this.store.updateSection('proposals',{...this.store.read().proposals,writingConsent:true});
        }
        const candidate=await this.polisher.request(JSON.parse(JSON.stringify(this.draft)),style,this.scope);
        if(!this.current()||this.draft.id!==context||this.polishEpoch!==epoch)return;
        this.draft.candidate=candidate;this.flush();
        this.polishStatus=this.tr(this.draft.revision===revision?'candidateHint':'staleCandidate');
      }catch(error){if(this.current()&&this.polishEpoch===epoch)this.polishStatus=narrativeFailureMessage(error);}
      finally{this.polishing=false;}
    },
    editCandidate(text){this.draft.candidate.text=text;this.flush();},
    useCandidate(){if(this.draft.candidate.revision!==this.draft.revision){this.message=this.tr('staleCandidate');return;}this.draft.text=this.draft.candidate.text;this.draft.adoptedCandidate=true;this.changed();this.panel="";},
    keepOriginal(){this.draft.adoptedCandidate=false;this.draft.text=this.draft.original;this.draft.candidate=null;this.changed();},
    handleWriteError(error){this.writeFailed=true;this.writeConflict=['NARRATIVE_VERSION_CONFLICT','NARRATIVE_SOURCE_MISSING'].includes(error?.code);this.message=this.tr(error?.code==='NARRATIVE_EMPTY'?'empty':'draftFailed');},
    saveConflictCopy(){
      if(!this.writeConflict||!this.current()||!this.visible||this.busy)return;
      const fresh=this.store.create(this.draft.mode,this.draft.kind);
      const copy={...JSON.parse(JSON.stringify(this.draft)),id:fresh.id,baseRevision:0,draftVersion:0,revision:0,legacy:false,createdAt:fresh.createdAt,updatedAt:fresh.updatedAt};
      let saved;
      try{saved=this.store.save(copy);}
      catch(error){this.handleWriteError(error);this.writeConflict=true;this.conflictCopyError='新记录尚未保存，请保留此页并重试。';return;}
      this.draft=saved;this.recordSaved=true;this.writeFailed=false;this.writeConflict=false;this.conflictCopyError='';this.editingWorkId='';this.workId='';this.message='已另存为新记录，原内容保持不变';
      try{uni.redirectTo({url:'/pages/narrative/narrative?id='+encodeURIComponent(saved.id)});}catch(_){/* The new record is already persisted and remains visible here. */}
    },
    reloadLatestRecord(){
      if(!this.writeConflict||!this.current()||!this.visible||this.busy)return;
      const draft=this.draft,epoch=this.polishEpoch;
      uni.showModal({title:'重新读取已保存内容',content:'这会替换此页尚未保存的输入。要保留当前输入，请先取消并另存为新记录。',confirmText:'重新读取',success:result=>{
        if(!result.confirm||!this.visible||this.draft!==draft||this.polishEpoch!==epoch||!this.current())return;
        try{const latest=this.store.open(draft.id);if(!latest){this.conflictCopyError='原记录已不存在，当前输入仍保留在此页';return;}this.draft=latest;this.editorEpoch++;this.writeFailed=false;this.writeConflict=false;this.conflictCopyError='';this.recordSaved=Boolean(latest.baseRevision);this.session.invalidate();this.loadPhotos();this.message='已重新读取，请核对内容';}
        catch(error){this.handleWriteError(error);}
      }});
    },
    flush() {
      clearTimeout(this.timer); if (!this.draft) return true;
      if(!this.draft.revision&&!this.draft.original&&!this.draft.media.length&&!this.draft.title)return true;
      try { this.store.saveDraft(this.draft); this.writeFailed=false;this.writeConflict=false;this.message = this.tr('draftSaved'); return true; }
      catch (error) { this.handleWriteError(error); return false; }
    },
    async choosePhoto() {
      if (!this.current() || this.busy) return;
      if (this.draft.media.length >= 4) { this.message = this.tr('photoLimit'); return; }
      this.mediaBusy = true; const draft = this.draft;
      try {
        const selected = await canvasCallback((success,fail) => uni.chooseImage({count:4-draft.media.length,sizeType:['original'],success,fail}));
        for (const path of selected.tempFilePaths) {
          if (!this.current() || this.draft !== draft) return;
          const asset = await persistNarrativePhoto(path,this.scope,draft.petId);
          if (!this.current() || this.draft !== draft) return;
          draft.media.push(asset); this.changed(); this.flush();
        } await this.loadPhotos();
      } catch (error) { this.mediaErrorCode = error.code || error.errMsg || error.message || 'MEDIA_FAILED'; this.message = this.tr('mediaError'); }
      finally { this.mediaBusy = false; }
    },
    async chooseAvatar(){
      if(!this.current()||this.busy)return;if(this.draft.media.length>=4){this.message=this.tr('photoLimit');return;}
      const pet=getActivePet(),draftId=this.draft.id;this.mediaBusy=true;
      try{const resolved=await hydratePetHeroAsset(pet,{preferFinal:true,accept:asset=>asset.fileId===pet.generatedAvatarFileId});
        if(!this.current()||this.draft.id!==draftId)return;if(!resolved.imageUrl)throw new Error('MEDIA_SOURCE_MISSING');
        const asset=await persistNarrativePhoto(resolved.imageUrl,this.scope,pet.id);if(!this.current()||this.draft.id!==draftId)return;
        asset.sourceFileId=pet.generatedAvatarFileId;this.draft.media.push(asset);this.changed();await this.loadPhotos();
      }catch(_){this.message=this.tr('mediaError');}finally{this.mediaBusy=false;}
    },
    async removePhoto(i) { const refs=narrativeMediaRefs(this.store.read());this.draft.media.splice(i,1); this.changed(); this.loadPhotos();try{await removeUnusedNarrativeMedia(this.store,refs);}catch(_){this.message=this.tr('mediaCleanupFailed');} },
    saveRecord() {
      if (!this.current()) return;
      try { clearTimeout(this.timer); this.draft = this.store.save(this.draft);this.recordSaved=true;this.writeFailed=false;this.writeConflict=false; this.message = this.tr('recordSaved'); }
      catch (error) { this.handleWriteError(error);return false; }
      // Collection preparation cannot invalidate a successful raw record save.
      try { if(narrativeMode(getActivePet()?.relationshipStage||getActivePet()?.status)==='current')syncCollections(this.store,'current'); } catch (_) { /* Recomputed when album opens. */ }
    },
    async preview() {
      if (!this.current() || !this.flush()) return;
      const revision = this.draft.revision;
      const input=this.cardInput();this.operationNotice='';
      await this.session.prepare(JSON.stringify(input), valid => this.$refs.canvas.render(input,this.scope,this.draft.petId,() => valid() && this.current() && this.visible && this.draft.revision === revision));
      if(this.session.error)this.message=this.layoutError(this.session.error);
    },
    saveWork() {
      if (!this.current() || !this.session.pages.length) return;
      try {
        const w = this.store.saveWork({id:this.workId,namespace:this.scope.namespace,petId:this.draft.petId,petName:this.petName,templateId:this.templateId,templateVersion:this.templateVersion,
          sources:this.draft.sourceRefs||[{id:this.draft.id,revision:this.draft.revision}],snapshot:JSON.parse(JSON.stringify(this.draft))});
        this.workId = w.id; this.message = this.tr('workSaved');
      } catch (_) { this.message = this.tr('draftFailed'); }
    },
    async exportImages() {
      if (!this.current() || this.busy) return;
      await this.session.save((path,index)=>this.savePageFile(path,index));
      this.message = this.tr(this.session.state === 'saved' ? 'exported' : 'saveFailed');
      // #ifdef H5
      if (this.session.state === 'saved') this.message = this.tr('downloadStarted');
      // #endif
    },
    cancel() { this.polishEpoch++;this.thumbEpoch++;this.session.cancel();this.operationNotice=this.v('cancelled'); }
  }
};
</script>
<style scoped>
.narrative-page{height:100vh;height:100dvh;display:flex;flex-direction:column;overflow:hidden;box-sizing:border-box;background:#F4F3ED;color:#343C32;padding-top:max(var(--creative-top,0px),env(safe-area-inset-top));font-size:16px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Microsoft YaHei,sans-serif;}
button{font:inherit;line-height:1.5;margin:0;background:transparent;color:inherit;padding:0;box-sizing:border-box;}button::after{border:0;}button[disabled]{opacity:.4;}button:active{opacity:.65;}.creative-header{display:flex;align-items:center;gap:12px;padding:10px 20px 14px;flex-shrink:0;background:#F4F3ED;z-index:5;}.icon-button{width:40px;min-height:44px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}.identity{min-width:0;flex:1;}.identity-name{display:block;font-size:16px;line-height:1.4;font-weight:500;overflow-wrap:anywhere;}.identity-caption{display:block;font-size:12px;color:#7B8171;margin-top:3px;}.nav-save{padding:9px 18px;background:#596650;border-radius:24px;color:#FFFDF8;font-size:15px;flex-shrink:0;min-height:42px;}.creative-scroll{flex:1;height:0;min-height:0;}.writing-body{max-width:620px;margin:auto;padding:20px 22px calc(30px + max(var(--creative-bottom,0px),env(safe-area-inset-bottom)));}.writing-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:8px 0 22px;flex-wrap:wrap;}.writing-heading>text{font-size:28px;line-height:1.5;font-weight:500;}.local-status{display:flex;align-items:center;gap:6px;font-size:12px;color:#7C8371;padding:8px 0;}.status-point{width:5px;height:5px;border-radius:50%;background:#7E8A70;}.writing-paper{background:#FFFEFA;border-radius:18px;padding:22px 20px 12px;}.optional-heading{display:block;font-size:20px;font-weight:500;margin:0 0 18px;}.original{width:100%;min-height:150px;font-size:17px;line-height:1.9;box-sizing:border-box;color:#36402F;}.writing-toolbar{display:flex;align-items:center;justify-content:space-between;border-top:1px solid #EBEBE3;margin-top:20px;padding-top:10px;}.add-photo,.more-button{display:flex;align-items:center;gap:8px;min-height:44px;font-size:14px;color:#596650;}.photo-count{color:#8B907F;font-size:12px;}.photos{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0 8px;}.photo-tile{position:relative;width:calc(50% - 5px);}.photo-tile image{width:100%;height:104px;border-radius:8px;background:#F0F0E8;}.photo-remove{position:absolute;top:4px;right:4px;background:#FFFEFA;color:#596650;width:28px;height:28px;line-height:28px;border-radius:50%;font-size:20px;}.date-row{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;color:#818776;padding:14px 2px;}.date-row button{display:flex;gap:7px;align-items:center;padding:6px 0;}.polish-disclosure{display:flex;align-items:center;gap:9px;font-size:13px;color:#7A846E;padding:16px 0;}.polish-disclosure>uni-icons:last-child{margin-left:auto;}.saved-note{border-top:1px solid #DEDFD4;padding-top:22px;margin-top:14px;}.saved-note>text{display:block;font-size:13px;color:#77806C;line-height:1.6;}.make-page{display:flex;align-items:center;justify-content:center;gap:16px;margin:16px 0 8px;padding:14px 18px;border-radius:14px;background:#596650;color:#FFFDF8;font-size:16px;min-height:50px;}.quiet-button{width:100%;font-size:14px;color:#768068;padding:12px;}.status{display:block;font-size:13px;color:#727C68;line-height:1.7;margin:6px 0;overflow-wrap:anywhere;}.operation-error{margin:14px 0;padding:14px 16px;background:#F3E8DE;color:#79553E;border-radius:12px;font-size:14px;line-height:1.6;}.operation-error button{font-size:14px;text-decoration:underline;margin-top:8px;}.preview-body{padding:4px 22px 24px;max-width:620px;margin:auto;}.preview-topline{display:flex;align-items:center;justify-content:space-between;gap:8px;color:#7B816F;font-size:12px;padding:10px 0 20px;}.preview-topline button{color:#596650;font-size:14px;padding:6px 0;}.previews{padding:18px;background:#E6E7DE;border-radius:12px;}.previews image{display:block;width:100%;margin:0 auto 16px;box-shadow:0 2px 8px #555D4110;}.previews image:last-child{margin-bottom:0;}.render-status{padding:26px 0;font-size:14px;text-align:center;color:#727C68;}.render-status button{font-size:13px;padding:10px;}.layout-heading{display:flex;justify-content:space-between;gap:8px;align-items:baseline;margin:24px 0 14px;font-size:16px;}.layout-heading>text+text{font-size:12px;color:#828875;}.layout-strip{white-space:nowrap;width:100%;}.layout-track{display:flex;gap:12px;align-items:flex-start;padding:0 2px 10px;}.layout-choice{width:96px;flex:0 0 96px;text-align:left;white-space:normal;}.layout-picture{height:128px;position:relative;border:2px solid transparent;background:#EAECE2;border-radius:6px;overflow:hidden;}.layout-picture image{width:100%;height:100%;}.selected .layout-picture{border-color:#596650;}.selection-mark{position:absolute;right:5px;top:5px;color:#fff;background:#596650;border-radius:50%;width:19px;height:19px;text-align:center;font-size:13px;}.layout-name{display:block;font-size:13px;margin:8px 0 0;}.layout-reason{display:block;font-size:11px;color:#8B785F;line-height:1.4;margin-top:4px;}.example-label{position:absolute;bottom:2px;left:0;right:0;background:#FFFDF8E8;color:#7C816F;font-size:10px;text-align:center;}.thumbnail-loading{display:block;text-align:center;padding:42px 0;color:#9DA18F;}.adjust-link{display:flex;align-items:center;justify-content:space-between;border-top:1px solid #DCDED2;margin-top:12px;padding:18px 0;width:100%;font-size:14px;color:#596650;}.preview-actions{display:flex;gap:12px;padding:12px 22px calc(12px + max(var(--creative-bottom,0px),env(safe-area-inset-bottom)));background:#F8F7F1;border-top:1px solid #E1E3D8;flex-shrink:0;}.preview-actions button{flex:1;border:1px solid #CCD2C1;border-radius:14px;padding:13px 8px;font-size:15px;color:#596650;}.preview-actions .export-card{background:#596650;color:#FFFDF8;border-color:#596650;}.sheet-backdrop{position:fixed;z-index:30;inset:0;background:#222B2540;display:flex;align-items:flex-end;}.creative-sheet{width:100%;max-height:82%;display:flex;flex-direction:column;border-radius:24px 24px 0 0;background:#FAF9F3;padding:0 22px max(var(--creative-bottom,0px),env(safe-area-inset-bottom));box-sizing:border-box;}.sheet-head{display:flex;align-items:center;justify-content:space-between;padding:24px 0 18px;gap:14px;flex-shrink:0;}.sheet-head>text{font-size:19px;font-weight:500;}.sheet-head button{font-size:14px;color:#596650;padding:8px;}.sheet-scroll{min-height:0;max-height:65vh;padding-bottom:22px;box-sizing:border-box;}.source-option{display:flex;align-items:center;gap:16px;padding:18px 6px;width:100%;border-top:1px solid #E5E6DA;font-size:16px;}.field{font-size:16px;min-height:48px;padding:8px 0;border-bottom:1px solid #D9DDD1;margin:10px 0;}.field-label{display:block;font-size:13px;color:#7F8774;margin:22px 0 10px;}.options{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0;}.options button{border:1px solid #D4D9CB;border-radius:20px;font-size:14px;padding:9px 13px;color:#596650;}.options .selected{background:#596650;border-color:#596650;color:#FFFDF8;}.switch-row{display:flex;justify-content:space-between;gap:16px;align-items:center;margin:22px 0;line-height:1.6;font-size:15px;}.switch-help{display:block;font-size:12px;color:#7F8774;max-width:240px;}.switch-row switch{flex-shrink:0;}.sheet-note{font-size:13px;color:#78816C;line-height:1.7;}.photo-settings{border-top:1px solid #E1E3D7;padding:18px 0;}.photo-settings image{display:block;width:100%;height:160px;}.candidate textarea{width:100%;font-size:17px;line-height:1.8;min-height:180px;}.keyboard-open .writing-heading{margin-top:0;}.keyboard-open .writing-body{padding-top:8px;}
.preview-page+.preview-page{margin-top:18px;}.download-page{width:100%;padding:12px 0;font-size:13px;color:#596650;}
.photo-crop-frame{position:relative;width:100%;height:0;overflow:hidden;background:#EDEBE3;}.photo-crop-frame image{position:absolute;max-width:none;}

.record-read-error{margin:24px 0;padding:24px 20px;border-radius:20px;background:#f5efe3;color:#403a32;display:flex;flex-direction:column;gap:14px;line-height:1.7;overflow-wrap:anywhere;font-size:calc(14px * var(--ui-font-scale,1));}.record-read-error .read-error-title{font-size:calc(20px * var(--ui-font-scale,1));font-weight:600;}.record-read-error button{margin:6px 0 0;min-height:44px;padding:10px 16px;line-height:1.5;white-space:normal;background:#596650;color:#fffdf8;border-radius:12px;font-size:inherit;}
.narrative-page .record-read-error{margin:24px 20px;}
.record-conflict{display:flex;flex-direction:column;gap:12px;padding:18px;margin:14px 0;border:1px solid #c5b599;border-radius:16px;background:#f5efe3;color:#403a32;font-size:calc(14px * var(--ui-font-scale,1));line-height:1.65;overflow-wrap:anywhere}
.conflict-title{font-weight:600;font-size:calc(17px * var(--ui-font-scale,1))}
.record-conflict button{box-sizing:border-box;width:100%;min-height:48px;margin:0;padding:12px 16px;line-height:1.5;white-space:normal;font-size:inherit;border-radius:10px;background:#596650;color:#fffdf8}
.record-conflict .conflict-reload{background:#e6decf;color:#403a32}
</style>
