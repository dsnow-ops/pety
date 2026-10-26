import {recipeCandidates} from './record-work-recipes.js';
import {lifePhotos,lifeText} from './record-views.js';
import {eventTimeLabel,narrativeId} from './narrative-store.js';
import {collectionRecipes} from './companion-collection.js';
import {CARD_MATRIX,CARD_FIELDS,adaptCardSource,combineCardSources,createComposition,resolveComposition} from './card-composition.js';
import {copyComposition as copy,proposeTemplate,textVariant,selectedContentKey,sourceWasRemoved,studioVersion,examplePayload} from './card-studio.js';
import {studioTrace,studioBack,subscribeStudioRoutes,isStudioRootTransition} from './card-studio-navigation.js';
import {DAILY_HEALTH} from './daily-record-fields.js';
import {getDiaryMap,formatDateKey} from './diary-store.js';
import {getNarrativeStore} from './narrative-store.js';
import {subscribeAccountScope} from './auth-store.js';
import {captureDataScope,isDataScopeCurrent} from './scoped-storage.js';
import {getActivePet,subscribePetSelection} from './pet-store.js';
import {resolveNarrativePhoto,releaseNarrativePhoto} from './narrative-media.js';
import {createCardExportSession} from './card-renderer.js';
import {creativeInsets} from './creative-insets.js';
import {isReduceMotionEnabled} from './haptics.js';
import FreeSealEditor from '../components/FreeSealEditor.vue';
import {presetToFree} from './seal-transform.js';
import {sealBox} from './pet-seal.js';
import NarrativeCanvas from '../components/NarrativeCanvas.vue';
import PetSealMaker from '../components/PetSealMaker.vue';
export default {
 components:{NarrativeCanvas,PetSealMaker,FreeSealEditor},
 data:()=>({recordReadError:false,insets:creativeInsets(),scope:null,loadedMode:'current',pet:null,store:null,source:null,config:null,resolved:null,
 session:createCardExportSession(),templates:CARD_MATRIX,labels:CARD_FIELDS,healthFields:DAILY_HEALTH,panel:false,panelDraft:null,panelNotice:'',proposal:null,variantText:'',previousVariant:null,transactionBusy:false,
 freeEditor:null,freeEpoch:0,notice:'',photoUrls:{},sealThumbs:[],thumbs:{},exampleThumbs:{},showEmpty:false,savedWork:'',pendingWork:null,compositionSnapshot:null,compositionConflict:false,sourceChanged:false,frozen:false,frozenPayload:null,query:{},draftKey:'',previewTicket:0,thumbEpoch:0,transactionEpoch:0,timer:null,stampLanding:false,unsubscribe:null,visible:true,canvasReady:false,rootPage:true,needsSource:false,waitingScope:false,waitScope:null,recovery:false,
 groups:[{name:'内容',keys:['text.life','text.observation','text.notes','text.letter','text.quote','text.habit','media.photos','media.petPortrait','media.photoCaptions']},{name:'健康与状态 · 主动选入',keys:['health.overall','state.petObserved','state.ownerMood','health.items','health.eventTags']},{name:'名字与日期',keys:['identity.petName','identity.title','date.display','identity.salutation','identity.signature','identity.topicTags']}]}),
 computed:{
  editConfig(){return this.panelDraft||this.config;},panelResolved(){return this.source&&this.editConfig?resolveComposition(this.source,this.editConfig):null;},
  healthDisclosureSelected(){return ['text.observation','health.overall','health.items','health.eventTags'].some(k=>this.editConfig?.requested[k]==='show');},
  conflicts(){return this.resolved?.conflicts||[];},
  canFinish(){return this.current()&&!this.sourceChanged&&!this.conflicts.length&&!this.transactionBusy&&!this.panelDraft&&!this.proposal&&['ready','saved','failed'].includes(this.session.state)&&this.session.pages.length>0;},
  availablePhotos(){return [...(this.source?.fields['media.photos']||[]),...(this.source?.fields['media.petPortrait']||[])];},healthRows(){return this.source?.fields['health.items']||[];},
  proposalSummary(){if(!this.proposal)return '';const labels=[...new Set(this.proposal.result.conflicts.map(r=>CARD_FIELDS[r.key]).filter(Boolean))];return labels.length?'新版本需要调整：'+labels.join('、')+'。请确认取材后再制作。':this.config?.presentation.seal.placement==='free'?'自由印记会按新纸面比例映射，边缘可能裁切。当前作品保留，确认后查看新版。':'请确认这一版使用的原话。';}
 },
 onLoad(q={}){this.unsubscribeRoute=subscribeStudioRoutes(()=>{this.rootPage=getCurrentPages().length<2;});this.initialize(q);},
 onReady(){this.canvasReady=true;if(this.config)this.loadAssets().then(()=>this.update());},
 onShow(){this.visible=true;if(this.canvasReady&&this.config){this.checkSource();this.update();}},
 onHide(){this.freeEpoch++;this.freeEditor=null;this.visible=false;this.transactionEpoch++;this.transactionBusy=false;this.flushDraft();this.session.cancel();},
 onUnload(){this.unsubscribeRoute?.();this.waitScope?.();this.visible=false;this.transactionEpoch++;this.previewTicket++;this.thumbEpoch++;clearTimeout(this.timer);this.unsubscribe?.();this.session.cancel();Object.values(this.photoUrls).forEach(releaseNarrativePhoto);},
 onBackPress(options){return this.back(options);},
 methods:{
  recipeLabel(item){const r=this.source?.recipeRecords?.find(r=>r.id===item.recordId);return r?eventTimeLabel(r)+' · '+(r.title||lifeText(r).slice(0,24)||'照片'):'来源已不可用';},
  recipeText(item){const r=this.source?.recipeRecords?.find(r=>r.id===item.recordId);return item.text===undefined?(item.textVersion==='accepted'?(r?.lifeEditedText||r?.adoptedCandidate&&r?.text||lifeText(r)):lifeText(r)):item.text;},
  recipePhotos(item){return lifePhotos(this.source?.recipeRecords?.find(r=>r.id===item.recordId)||{});},
  editRecipeItem(i,key,value){this.editConfig.recipe.items[i]={...this.editConfig.recipe.items[i],[key]:value};this.editChanged();},
  moveRecipeItem(i,direction){const items=this.editConfig.recipe.items,j=i+direction;if(j<0||j>=items.length)return;const item=items.splice(i,1)[0];items.splice(j,0,item);this.editChanged();},
  removeRecipeItem(i){this.editConfig.recipe.items.splice(i,1);this.editChanged();},
  addRecipeSource(id){if(this.editConfig.recipe.type==='comparison')return;const r=this.source.recipeRecords.find(r=>r.id===id);if(!r)return;this.editConfig.recipe.items.push({recordId:id,assetId:lifePhotos(r)[0]?.id||'',showDate:true,fit:'contain'});this.editChanged();},

  readFailed(preserveDraft=false){if(!preserveDraft)this.revoke();this.recordReadError=true;this.needsSource=false;},
  retryRead(){if(!this.config){this.initialize(this.query);return;}this.recordReadError=false;this.checkSource();if(!this.recordReadError)this.update();},
  initialize(q={}){this.recordReadError=false;this.needsSource=false;this.unsubscribe?.();this.unsubscribe=null;try{this.initializeData(q);}catch(_){this.readFailed();}},
  initializeData(q={}){
  this.rootPage=getCurrentPages().length<2||isStudioRootTransition();this.query=q;studioTrace('compose:load',{parameterKeys:Object.keys(q)});
  this.scope=captureDataScope();if(!this.scope.ready){this.waitingScope=true;this.waitScope=subscribeAccountScope(scope=>{if(scope.ready){this.waitScope?.();this.waitingScope=false;this.initialize(q);}});return;}this.pet=getActivePet();
  if(!this.pet||(this.rootPage&&!q.petId&&!q.work)||q.petId&&q.petId!==this.pet.id||!q.work&&!q.recordId&&!q.booklet&&!q.compare&&!/^\d{4}-\d{2}-\d{2}$/.test(q.date||'')){this.needsSource=true;studioTrace('compose:needsSource',{petReady:!!this.pet});return;}
  this.loadedMode=(this.pet.relationshipStage||this.pet.status)==='deceased'?'deceased':'current';this.store=getNarrativeStore(this.pet.id,this.scope);this.source=this.readSource();this.draftKey=this.loadedMode+':'+(q.compare?'compare:'+q.compare:q.booklet?'booklet:'+q.booklet:q.recordId||q.date||'new');
  const work=q.work&&this.store.read().works[q.work],envelope=work?.snapshot?.renderPayload?{draft:null,snapshot:'null'}:this.store.readCompositionDraft(this.draftKey),draft=envelope.draft;this.compositionSnapshot=envelope.snapshot;this.compositionConflict=false;
  if(work?.snapshot?.renderPayload){this.config=copy(work.snapshot.composition);this.frozenPayload=copy(work.snapshot.renderPayload);this.frozen=true;this.savedWork=work.id;}
  else if(!this.source.refs.length){this.needsSource=true;return;}
  else if(draft?.config){this.config=copy(draft.config);this.frozenPayload=draft.payload?copy(draft.payload):null;this.recovery=resolveComposition(this.source,this.config).conflicts.length>0;this.checkSource();}
  else this.config=this.initialConfig();
  this.unsubscribe=subscribePetSelection(()=>{if(!this.current())this.revoke();});
  studioTrace('compose:ready',{hasSource:!!this.source.refs.length,hasDraft:!!draft,hasWork:!!work,sourceChanged:this.sourceChanged});
  if(this.canvasReady)this.loadAssets().then(()=>{if(this.current())this.update();});
 },

  current(){return !this.recordReadError&&!!this.scope&&isDataScopeCurrent(this.scope)&&getActivePet()?.id===this.pet?.id&&((getActivePet()?.relationshipStage||getActivePet()?.status)==='deceased'?'deceased':'current')===this.loadedMode;},
  readSource(){if(this.query.compare||this.query.booklet){const records=recipeCandidates(this.store.list().filter(r=>this.loadedMode==='deceased'||r.mode==='current'));const source=combineCardSources(records.map(r=>adaptCardSource({...r,original:lifeText(r),media:lifePhotos(r)},{kind:'narrative',petId:this.pet.id,namespace:this.scope.namespace,id:r.id,date:eventTimeLabel(r)})),getActivePet(),this.scope,this.loadedMode);source.recipeRecords=records;return source;}const sources=[],diary=getDiaryMap(this.pet.id,this.scope,{strict:true}),date=this.query.date;if(date&&diary[date])sources.push(adaptCardSource(diary[date],{petId:this.pet.id,namespace:this.scope.namespace,id:'health:'+date,date}));Object.values(this.store.read().records).filter(r=>!r.legacy&&(this.query.recordId||date)&&(this.query.recordId?r.id===this.query.recordId:r.localDate===date)).forEach(r=>sources.push(adaptCardSource(r,{kind:r.dailyVersion?'health':'narrative',petId:this.pet.id,namespace:this.scope.namespace,date:r.dateText||r.localDate,id:r.id})));return combineCardSources(sources,getActivePet(),this.scope,this.loadedMode);},
  initialConfig(source=this.source){if(this.query.compare||this.query.booklet){const comparison=!!this.query.compare,c=createComposition(source,comparison?'collage':'letter');c.template.version=7;let selected=[];if(comparison){try{selected=JSON.parse(this.query.compare);}catch(_){}}else{const recipe=collectionRecipes(this.store).find(r=>r.key===this.query.booklet&&r.available);selected=(recipe?.sources||source.recipeRecords.slice(0,7)).map(ref=>({recordId:ref.id,assetId:lifePhotos(source.recipeRecords.find(r=>r.id===ref.id)||{})[0]?.id||''}));}c.recipe={type:comparison?'comparison':'booklet',...(comparison?{layoutRevision:2}:{}),title:comparison?'两个日子':'几个普通日子',items:selected.map(i=>({recordId:i.recordId,assetId:i.assetId||'',showDate:true,fit:'contain'}))};return c;}const id=source.fields['text.letter']?.length?'letter':!source.fields['text.life']?.length&&source.fields['media.photos']?.length?'day':'daily_record',c=createComposition(source,id);c.template.version=studioVersion(id);return c;},
  recoverDraft(){if(!this.current())return;try{if(this.store.readCompositionDraft(this.draftKey).snapshot!==this.compositionSnapshot){this.compositionConflict=true;this.notice='草稿已有变化，请先处理冲突。';return;}const all=this.store.read().compositions;all[this.draftKey+':retained:'+Date.now()]={config:copy(this.config),payload:copy(this.frozenPayload)};this.store.updateSection('compositions',all);}catch(_){this.notice='原草稿尚未保存，请重试。';return;}this.config=this.initialConfig();this.sourceChanged=false;this.recovery=false;this.changed();},
  revoke(){this.freeEpoch++;this.freeEditor=null;this.invalidate();Object.values(this.photoUrls).forEach(releaseNarrativePhoto);this.photoUrls={};this.sealThumbs=[];this.previousVariant=null;this.panelDraft=null;this.proposal=null;this.source=null;this.config=null;this.resolved=null;this.frozenPayload=null;this.savedWork='';this.pendingWork=null;this.compositionSnapshot=null;this.compositionConflict=false;this.store=null;this.scope=null;this.panel=false;this.needsSource=true;this.notice='资料已不可用，请重新选择记录。';},
  checkSource(){try{this.checkSourceData();}catch(_){this.readFailed(true);}},
  checkSourceData(){if(!this.current()||this.savedWork||this.frozen||!this.config)return;const next=this.readSource();if(sourceWasRemoved(this.source,next)){this.revoke();return;}const latest=resolveComposition(next,this.config).payload,selected=this.resolved?.payload||this.frozenPayload;this.sourceChanged=!!selected&&selectedContentKey(latest)!==selectedContentKey(selected);if(!this.sourceChanged){this.source=next;this.config.sourceRefs=copy(next.refs);}},
  async loadAssets(){for(const row of this.availablePhotos){try{const photo=await resolveNarrativePhoto(row.value,this.scope,this.pet.id);if(!this.current()){releaseNarrativePhoto(photo.path);return;}this.photoUrls={...this.photoUrls,[row.value.id]:photo.path};}catch(_){this.notice='有照片尚未能读取，请重新选择。';}}if(this.source?.seal){const a=[];try{for(const style of ['vermilion','emboss'])a.push(await this.$refs.sealMaker.preview(this.source.seal,style,()=>this.current()));if(this.current())this.sealThumbs=a;}catch(_){}}},
  hasSource(k){return !!this.source?.fields[k]?.length||!!this.editConfig?.custom[k]?.text;},isSelected(k){return this.editConfig.requested[k]==='show'||(!this.editConfig.requested[k]||this.editConfig.requested[k]==='auto')&&this.panelResolved?.states[k]==='visible';},
  stateLabel(k){return ({visible:'已选入',hidden:'不显示',empty:'没有来源',unsupported:'此版式需调整',needsReview:'请选择具体观察',included:'已在正文中显示'})[this.panelResolved?.states[k]]||'';},
  openPanel(kind='content'){studioTrace('panel:open',{kind,busy:this.transactionBusy});if(this.transactionBusy)return;if(this.frozen){this.notice='这是已保存作品；修改请从更多菜单制作新版。';return;}this.panelDraft=copy(this.config);this.panelNotice='';this.panel=kind;},
  cancelPanel(){if(this.freeEditor){this.freeEpoch++;this.freeEditor=null;return;}if(this.proposal){this.cancelProposal();return;}this.transactionEpoch++;this.transactionBusy=false;this.panelDraft=null;this.panel=false;this.panelNotice='';},
  async applyPanel(){studioTrace('panel:apply',{hasDraft:!!this.panelDraft,busy:this.transactionBusy,current:this.current(),frozen:this.frozen});if(!this.panelDraft)return;const candidate=copy(this.panelDraft);const okay=await this.commitCandidate(candidate,false);if(okay){this.panelDraft=null;this.panel=false;}},
  async commitCandidate(candidate,variant){
   if(!this.current()||this.transactionBusy||this.frozen)return false;
   const resolved=resolveComposition(this.source,candidate);if(resolved.conflicts.length){this.panelNotice=resolved.conflicts[0].message;return false;}
   const epoch=++this.transactionEpoch;this.transactionBusy=true;studioTrace('variant:render',{template:candidate.template.id,seal:!!resolved.payload.seal});const oldConfig=copy(this.config),oldPayload=this.resolved?.payload&&copy(this.resolved.payload),oldPages=[...this.session.pages];
   try{const prior=this.renderQueue||Promise.resolve();const task=prior.catch(()=>{}).then(()=>this.$refs.canvas.render(resolved.payload,this.scope,this.pet.id,()=>this.current()&&this.visible&&epoch===this.transactionEpoch));this.renderQueue=task;const pages=await task;studioTrace('variant:rendered',{current:this.current(),sameEpoch:epoch===this.transactionEpoch,visible:this.visible});if(!this.current()||epoch!==this.transactionEpoch)return false;
    if(variant&&oldPages.length){this.previousVariant={config:oldConfig,payload:oldPayload};const all=this.store.read().compositions;all[this.draftKey+':variant:'+Date.now()]={config:oldConfig,payload:oldPayload};this.store.updateSection('compositions',all);}
    candidate.revision++;this.config=candidate;this.resolved=resolved;this.frozenPayload=copy(resolved.payload);this.savedWork='';this.recovery=false;this.notice='';this.invalidate();this.session.pages=pages;this.session.key=JSON.stringify([this.scope.namespace,this.pet.id,resolved.payload]);this.session.state='ready';this.flushDraft();this.loadThumbs();return true;
   }catch(e){if(epoch!==this.transactionEpoch||!this.current())return false;studioTrace('variant:failed',{code:String(e.message).slice(0,120)});this.panelNotice=e.message==='CARD_COMPOSITION_OVERFLOW'?'这段内容需要更多空间。可保留全部改用今日记录卡，或亲手节选。':'这一版尚未绘制完成，请重试。';return false;}finally{if(epoch===this.transactionEpoch)this.transactionBusy=false;}
  },
  async chooseTemplate(id){if(this.frozen){this.notice='修改请先制作新版。';return;}if(this.transactionBusy)return;const proposal=proposeTemplate(this.source,this.config,id);this.notice='';this.panelNotice='';
   if(proposal.requiresConfirmation){this.proposal=proposal;this.panel=false;this.panelDraft=null;this.variantText=this.source.fields['text.life']?.[0]?.value||this.source.fields['text.letter']?.[0]?.value||this.config.custom['text.quote']?.text||'';return;}
   if(await this.commitCandidate(proposal.config,true))this.cancelProposal();else {this.proposal=proposal;this.panel=false;}
  },
  cancelProposal(){this.transactionEpoch++;this.transactionBusy=false;this.proposal=null;this.panelNotice='';},
  async confirmVariant(){if(!this.proposal)return;const id=this.proposal.config.template.id;let candidate;
   try{candidate=['quote','letter','habit'].includes(id)?textVariant(this.source,this.config,id,this.variantText):copy(this.proposal.config);}catch(_){this.panelNotice='请选择要放上卡片的原话。';return;}
   if(await this.commitCandidate(candidate,true))this.cancelProposal();
  },
  async restoreVariant(){if(!this.previousVariant)return;const candidate=copy(this.previousVariant.config);await this.commitCandidate(candidate,true);},
  // Privacy reductions commit immediately, even inside a cancellable panel. Cancel never resurrects them.
  privacyReduction(mutate){this.freeEpoch++;this.freeEditor=null;mutate(this.config);if(this.panelDraft)mutate(this.panelDraft);this.previousVariant=null;this.proposal=null;if(this.sourceChanged)this.frozenPayload=null;this.changed();},
  toggle(k,on){if(!on&&(['identity.petName','media.photos','media.petPortrait','text.observation','text.notes','health.overall','health.items','health.eventTags'].includes(k))){this.privacyReduction(c=>{c.requested[k]='hide';if(k==='identity.petName'&&this.source.seal?.containsName!==false)c.presentation.seal.enabled=false;});return;}this.editConfig.requested[k]=on?'show':'hide';this.editChanged();},
  editChanged(){this.panelNotice='';if(!this.panelDraft)this.changed();},
  selectFieldSource(key,ref){const id=JSON.stringify(ref),a=this.editConfig.selections.fields[key]||this.source.fields[key].map(r=>JSON.stringify(r.ref));if(a.includes(id)&&this.source.fields[key].some(r=>r.health)){this.privacyReduction(c=>{c.selections.fields[key]=a.filter(r=>r!==id);});return;}this.editConfig.selections.fields[key]=a.includes(id)?a.filter(r=>r!==id):[...a,id];this.editChanged();},
  textVersion(k,value){this.editConfig.selections.textVersions[k]=value;this.editChanged();},
  healthSelect(k){const a=this.editConfig.selections.healthKeys;if(a.includes(k)){this.privacyReduction(c=>{c.selections.healthKeys=c.selections.healthKeys.filter(v=>v!==k);});return;}this.editConfig.selections.healthKeys=[...a,k];this.editChanged();},
  basicHealth(){this.editConfig.selections.healthKeys=[...new Set([...this.editConfig.selections.healthKeys,...this.healthRows.filter(r=>['food','water','energy','stool','sleep'].includes(r.key)).map(r=>r.key)])];this.editChanged();},
  photoSelect(id){const a=this.editConfig.selections.photoIds;if(a.includes(id)){this.privacyReduction(c=>{c.selections.photoIds=c.selections.photoIds.filter(v=>v!==id);});return;}this.editConfig.selections.photoIds=[...a,id];this.editConfig.requested['media.photos']='show';if(this.source.fields['media.petPortrait']?.some(r=>r.value.id===id))this.editConfig.requested['media.petPortrait']='show';this.editChanged();},
  writeWork(k,text){this.editConfig.custom[k]={text,ref:{recordId:'work-text',revision:this.editConfig.revision+1,fieldPath:k}};this.editConfig.requested[k]='show';this.editChanged();},
  useLifeBody(){const row=this.source.fields['text.life']?.[0];if(!row)return;const key='text.'+this.editConfig.template.id;this.editConfig.custom[key]={text:row.value,ref:row.ref};this.editConfig.requested[key]='show';this.editChanged();},
  setDateKind(kind){this.editConfig.dateKind=kind;this.editConfig.writtenDate=formatDateKey();this.editChanged();},paper(k,value){this.editConfig.presentation[k]=value;this.editChanged();},setSeal(k,value){if(k==='placement'&&value==='free'){this.openFreeSeal();return;}this.editConfig.presentation.seal[k]=value;if(k==='placement'){for(const key of ['placementMode','transformVersion','centerX','centerY','widthRatio','rotationDeg','pageIndex','zOrder'])delete this.editConfig.presentation.seal[key];}this.editChanged();},
  async openFreeSeal(){
   if(!this.current()||!this.source?.seal||this.transactionBusy)return;
   const c=copy(this.editConfig);c.presentation.seal.enabled=true;const resolved=resolveComposition(this.source,c);if(resolved.conflicts.length){this.panelNotice=resolved.conflicts[0].message;return;}
   const epoch=++this.freeEpoch;this.transactionBusy=true;const valid=()=>this.current()&&this.visible&&epoch===this.freeEpoch;
   try{const prior=this.renderQueue||Promise.resolve();const task=prior.catch(()=>{}).then(async()=>{const payload=copy(resolved.payload),seal=payload.seal;delete payload.seal;payload.presentation.seal.enabled=false;const pages=await this.$refs.canvas.render(payload,this.scope,this.pet.id,valid);const layouts=this.$refs.canvas.lastLayout;const index=seal?.placementMode==='free'?seal.pageIndex:0;if(index>=pages.length)throw Error('SEAL_PAGE_MISSING');const layout=layouts[index],initial=seal?.placementMode==='free'?copy(seal):presetToFree(layout,layout.sealBox||sealBox(layout,seal),index);const sealUrl=await this.$refs.sealMaker.preview(this.source.seal,c.presentation.seal.style,valid,true);if(valid())this.freeEditor={pages,sealUrl,initial,pageSizes:layouts.map(p=>({width:p.width,height:p.height})),textBounds:this.$refs.canvas.lastTextBounds};});this.renderQueue=task;await task;}catch(e){if(valid())this.panelNotice=e.message==='SEAL_PAGE_MISSING'?'印记页已变化，请先切回预设，再选择盖章页。':'编辑预览尚未就绪，请重试。';}finally{if(epoch===this.freeEpoch)this.transactionBusy=false;}
  },
  completeFreeSeal(transform){if(!this.current()||!this.panelDraft)return;this.panelDraft.presentation.seal={...this.panelDraft.presentation.seal,...transform,placement:'free',enabled:true};this.freeEditor=null;this.freeEpoch++;this.applyPanel();},
  stamp(){if(this.editConfig.presentation.seal.enabled){this.privacyReduction(c=>c.presentation.seal.enabled=false);return;}this.editConfig.presentation.seal.enabled=true;this.stampLanding=!isReduceMotionEnabled()&&this.editConfig.presentation.seal.enabled;setTimeout(()=>{this.stampLanding=false;},350);this.editChanged();},
  invalidate(){this.previewTicket++;this.thumbEpoch++;clearTimeout(this.timer);this.thumbs={};this.exampleThumbs={};this.session.invalidate();},
  changed(){if(!this.current()||this.frozen)return;this.transactionEpoch++;this.transactionBusy=false;this.invalidate();this.config.revision++;this.savedWork='';this.notice='';this.update();},
  update(){if(!this.current()||!this.config||!this.canvasReady)return;if(this.sourceChanged){this.loadThumbs();if(this.frozenPayload&&!this.session.pages.length)this.preview(this.frozenPayload);return;}this.resolved=this.frozen?{payload:this.frozenPayload,conflicts:[],states:{},template:this.config.recipe?.type==='comparison'?{id:this.config.template.id,name:'两张照片的对照'}:CARD_MATRIX.find(t=>t.id===this.config.template.id)}:resolveComposition(this.source,this.config);this.frozenPayload=copy(this.resolved.payload);this.flushDraft();clearTimeout(this.timer);this.timer=setTimeout(()=>{this.preview();this.loadThumbs();},120);},
  async preview(retained=null){if((this.conflicts.length||this.sourceChanged)&&!retained)return;const ticket=++this.previewTicket,payload=copy(retained||this.resolved.payload);this.session.invalidate();const previous=this.renderQueue||Promise.resolve();const task=previous.catch(()=>{}).then(async()=>{if(ticket!==this.previewTicket||!this.current()||!this.visible)return;await this.session.prepare(JSON.stringify([this.scope.namespace,this.pet.id,payload]),valid=>this.$refs.canvas.render(payload,this.scope,this.pet.id,()=>valid()&&ticket===this.previewTicket&&this.current()&&this.visible));if(this.session.state==='failed')studioTrace('render:failed',{code:String(this.session.error).replace(/https?:[^ ]+/g,'[resource]').slice(0,160)});if(this.session.state==='failed')this.notice=this.session.error==='CARD_COMPOSITION_OVERFLOW'?'内容需要更多空间，请用今日记录卡或在内容中选择节选。':'图片尚未绘制完成，请重试。';});this.renderQueue=task;await task;},
  async loadThumbs(){if(!this.current()||this.config?.recipe)return;if(this.session.pages.length&&!this.sourceChanged){this.thumbs={...this.thumbs,[this.config.template.id]:this.session.pages[0]};this.exampleThumbs={...this.exampleThumbs,[this.config.template.id]:false};}const epoch=++this.thumbEpoch,prior=this.thumbQueue||Promise.resolve();const task=prior.catch(()=>{}).then(async()=>{for(const t of this.templates){if(t.id===this.config.template.id&&this.thumbs[t.id]&&!this.sourceChanged)continue;if(epoch!==this.thumbEpoch||!this.current()||!this.visible)return;const c=copy(this.config);c.template={id:t.id,version:studioVersion(t.id)};const r=resolveComposition(this.source,c);let example=this.frozen||this.sourceChanged||r.conflicts.length>0,payload=example?examplePayload(t.id):r.payload;try{let urls;try{urls=await this.$refs.thumbnailCanvas.render(payload,this.scope,this.pet.id,()=>epoch===this.thumbEpoch&&this.current()&&this.visible,{firstPageOnly:true,example});}catch(e){if(!example&&epoch===this.thumbEpoch){example=true;urls=await this.$refs.thumbnailCanvas.render(examplePayload(t.id),this.scope,this.pet.id,()=>epoch===this.thumbEpoch&&this.current()&&this.visible,{firstPageOnly:true,example:true});}else throw e;}if(epoch===this.thumbEpoch&&this.current()){this.thumbs={...this.thumbs,[t.id]:urls[0]};this.exampleThumbs={...this.exampleThumbs,[t.id]:example};}}catch(_){}}});this.thumbQueue=task;await task;},
  keepSnapshot(){if(!this.frozenPayload)return;this.frozen=true;this.sourceChanged=false;this.update();},
  refreshSource(){try{this.refreshSourceData();}catch(_){this.readFailed(true);}},
  refreshSourceData(){this.source=this.readSource();this.config.sourceRefs=copy(this.source.refs);this.sourceChanged=false;this.frozen=false;this.loadAssets();this.changed();},
  saveWork(){
   this.checkSource();if(!this.canFinish||this.savedWork)return;
   try{
    const expectedDraft={config:copy(this.config),payload:copy(this.resolved.payload)},config=copy(this.config);
    if(this.resolved.payload.sourceRefs)config.sourceRefs=copy(this.resolved.payload.sourceRefs);
    Object.keys(config.custom).forEach(k=>{if(!this.frozen&&this.resolved.states[k]!=='visible')delete config.custom[k];});
    const body={namespace:this.scope.namespace,petId:this.pet.id,petName:this.resolved.payload.petName||'',templateId:config.template.id,templateVersion:config.template.version,sources:(this.resolved.payload.sourceRefs||config.sourceRefs).map(r=>({id:r.recordId,revision:r.revision})),snapshot:{renderPayload:copy(this.resolved.payload),composition:config}};
    const fingerprint=JSON.stringify(body);
    if(!this.pendingWork||this.pendingWork.fingerprint!==fingerprint)this.pendingWork={fingerprint,work:{...body,id:narrativeId()}};
    const result=this.store.saveCompositionWork(this.pendingWork.work,this.draftKey,expectedDraft);
    this.savedWork=result.work.id;this.pendingWork=null;this.compositionConflict=false;
    this.notice=result.draftRetained?'作品已存入册页，内容不同的草稿仍保留。':'已存入册页。';
   }catch(_){this.notice='保存结果尚未确认，请重试；重试会核对同一件作品。';}
  },
  async exportImages(){this.checkSource();if(!this.canFinish)return;if(this.session.state==='saved')this.session.saved=[];await this.session.save(async(path,i)=>{
   // #ifdef H5
   const a=document.createElement('a');a.href=path;a.download='lumiere-work-'+(i+1)+'.png';a.click();
   // #endif
   // #ifndef H5
   await new Promise((success,fail)=>uni.saveImageToPhotosAlbum({filePath:path,success,fail}));
   // #endif
  });
  // #ifdef H5
  this.notice=this.session.state==='saved'?'下载已发起，请检查浏览器下载列表。':'下载未完成，可重试。';
  // #endif
  // #ifndef H5
  this.notice=this.session.state==='saved'?'图片已保存到系统相册。':`已保存 ${this.session.saved.length} / ${this.session.pages.length} 张，请检查相册权限后重试。`;
  // #endif
  },
  newVersion(){if(this.config.recipe){const c=copy(this.config),query=c.recipe.type==='comparison'?'compare='+encodeURIComponent(JSON.stringify(c.recipe.items.map(i=>({recordId:i.recordId,assetId:i.assetId})))):'booklet=manual';uni.redirectTo({url:'/pages/card-compose/card-compose?petId='+encodeURIComponent(this.pet.id)+'&'+query});return;}const ref=this.config.sourceRefs.find(r=>!r.recordId.startsWith('health:')),date=this.query.date||this.config.sourceRefs[0]?.eventDateLabel||'';uni.redirectTo({url:'/pages/card-compose/card-compose?petId='+encodeURIComponent(this.pet.id)+'&'+(ref&&!/^\d{4}-\d{2}-\d{2}$/.test(date)?'recordId='+encodeURIComponent(ref.recordId):'date='+encodeURIComponent(date))});},
  flushDraft(){
   if(!this.config||!this.store||this.frozen||this.savedWork||!this.current())return true;
   try{this.compositionSnapshot=this.store.saveCompositionDraft(this.draftKey,{config:copy(this.config),payload:copy(this.resolved?.payload||this.frozenPayload)},this.compositionSnapshot);this.compositionConflict=false;return true;}
   catch(e){if(e.code==='NARRATIVE_VERSION_CONFLICT')this.compositionConflict=true;this.notice=this.compositionConflict?'草稿已有变化，当前版式仅保留在此页。':'草稿未能保存，请重试后再离开。';return false;}
  },
  reloadCompositionDraft(){
   if(!this.compositionConflict||!this.current()||!this.visible)return;
   const epoch=this.transactionEpoch;
   uni.showModal({title:'重新读取草稿',content:'读取已保存的草稿会替换当前未保存版式。你也可以先把当前画面存入册页。',confirmText:'重新读取',success:r=>{
    if(!r.confirm||!this.current()||!this.visible||epoch!==this.transactionEpoch)return;
    try{
     const envelope=this.store.readCompositionDraft(this.draftKey),source=this.readSource(),config=envelope.draft?copy(envelope.draft.config):this.initialConfig(source);
     if(!source.refs.length)throw Error('NARRATIVE_SOURCE_MISSING');
     const resolved=resolveComposition(source,config);
     this.transactionEpoch++;this.freeEpoch++;this.freeEditor=null;this.panelDraft=null;this.panel=false;this.proposal=null;this.previousVariant=null;this.pendingWork=null;this.savedWork='';
     this.source=source;this.config=config;this.resolved=resolved;this.frozenPayload=envelope.draft?.payload?copy(envelope.draft.payload):copy(resolved.payload);this.frozen=false;this.sourceChanged=false;this.recovery=resolved.conflicts.length>0;this.compositionSnapshot=envelope.snapshot;this.compositionConflict=false;this.notice='';this.invalidate();this.checkSource();this.loadAssets();this.update();
    }catch(_){this.notice='草稿暂时没能读取，当前版式仍保留。';}
   }});
  },
  selectRecord(){uni.navigateTo({url:'/pages/album/album'});},goHome(){uni.switchTab({url:'/pages/home/home'});},
  back(options={}){studioTrace('compose:back',{from:options.from||'button'});return studioBack({from:options.from,closeLayer:()=>{if(this.freeEditor||this.panel||this.proposal){this.cancelPanel();return true;}return false;},flush:()=>this.flushDraft(),pages:getCurrentPages(),navigateBack:()=>uni.navigateBack({fail:()=>this.goHome()}),home:()=>this.goHome()});}
 }
};
