// One-time, assertion-checked source edit; retained for an auditable patch recipe.
const fs=require('node:fs');
function edit(file,fn){let source=fs.readFileSync(file,'utf8');const replace=(a,b)=>{if(!source.includes(a))throw Error(file+' missing anchor: '+a.slice(0,90));source=source.replace(a,b);};fn(replace);fs.writeFileSync(file,source);}
const panel=retry=>'<view v-if="recordReadError" class="record-read-error" role="alert"><text class="read-error-title">资料暂时没能读取</text><text>为保护已有内容，暂不开放编辑。请重试读取。</text><button @click="'+retry+'">重新读取</button></view>';
const css='\n.record-read-error{margin:24px 0;padding:24px 20px;border-radius:20px;background:#f5efe3;color:#403a32;display:flex;flex-direction:column;gap:14px;line-height:1.7;overflow-wrap:anywhere;font-size:calc(14px * var(--ui-font-scale,1));}.record-read-error .read-error-title{font-size:calc(20px * var(--ui-font-scale,1));font-weight:600;}.record-read-error button{margin:6px 0 0;min-height:44px;padding:10px 16px;line-height:1.5;white-space:normal;background:#596650;color:#fffdf8;border-radius:12px;font-size:inherit;}\n';
edit('pages/album/album.vue',r=>{
 r('data:()=>({directoryOpen:','data:()=>({recordReadError:false,directoryOpen:');
 r('class="new-page" :aria-label=','class="new-page" :disabled="recordReadError" :aria-label=');
 r('  load(){const key=',"  readFailed(){this.recordReadError=true;this.clearCovers();this.rows=[];this.recipes=[];this.atlas=[];this.savedProposals=[];this.recall=null;this.metadataRow=null;this.comparison=[];this.cleanupPending=false;},\n  load(){this.recordReadError=false;try{this.loadRecords();}catch(_){this.readFailed();}},\n  loadRecords(){const key=");
 r('  refresh(){if(!this.current())return;',"  refresh(){if(this.recordReadError)return;try{this.refreshRecords();}catch(_){this.readFailed();}},\n  refreshRecords(){if(!this.current())return;");
 r('</style>',css+'</style>');
});
edit('pages/calendar/calendar.vue',r=>{
 r('return {visualContractOpen:false,','return {recordReadError:false,visualContractOpen:false,');
 r('    followupRecords(){this.diaryMap;if(!this.activePetId)return [];',"    narrativeRows(){this.diaryMap;if(this.recordReadError||!this.activePetId)return [];try{return this.dailyStore().list();}catch(_){return [];}},\n    followupRecords(){this.diaryMap;if(!this.activePetId)return [];");
 r('return this.dailyStore().list().filter(r=>r.careSourceId===id)','return this.narrativeRows.filter(r=>r.careSourceId===id)');
 r("return getNarrativeStore(this.activePetId).list().filter(r=>!r.legacy&&r.localDate===this.selectedDateKey);","return this.narrativeRows.filter(r=>!r.legacy&&r.localDate===this.selectedDateKey);");
 r('getNarrativeStore(this.activePetId).list().some(r=>!r.legacy && r.localDate===dateKey)','this.narrativeRows.some(r=>!r.legacy && r.localDate===dateKey)');
 r('    loadCalendar() {',"    recordReadFailed(){this.recordReadError=true;this.dailyLoading=true;this.dailyEditorEpoch++;this.diaryMap={};this.momentRecord=null;this.doctorOpen=false;this.doctorPreview='';this.careRows=[];this.form={healthValues:{},media:[],lifeText:'',type:'',mood:'',events:[],note:'',memoryText:'',privateNote:'',source:'manual',sourceChatIds:[]};},\n    loadCalendar(){this.recordReadError=false;try{this.loadCalendarData();}catch(_){this.recordReadFailed();}},\n    loadCalendarData() {");
 r('    loadSelectedRecord() {',"    loadSelectedRecord(){this.recordReadError=false;try{if(this.activePetId)this.dailyStore().list();this.loadSelectedRecordData();}catch(_){this.recordReadFailed();}},\n    loadSelectedRecordData() {");
 r('saveDailyDraft(){if(this.sourceMissing','saveDailyDraft(){if(this.recordReadError||this.sourceMissing');
 r('      if(this.saving)return false;','      if(this.saving||this.recordReadError)return false;');
 r('        const input=JSON.stringify([this.form,','        this.dailyStore().list();\n        const input=JSON.stringify([this.form,');
 r('    </view>\n\n', '    </view>\n    '+panel('loadCalendar')+'\n    <template v-else>\n');
 r('    <VisualLockContract v-if=', '    </template>\n    <VisualLockContract v-if=');
 // The template lives inside the animated content; close it before that view.
 r('    </view>\n\n    </template>\n    <VisualLockContract','    </template>\n    </view>\n\n    <VisualLockContract');
 r('</style>',css+'</style>');
});
edit('pages/narrative/narrative.vue',r=>{
 r('data: () => ({ draft:', 'data: () => ({ recordReadError:false,loadOptions:{},draft:');
 const start='  onLoad(options) {',end='  onShow() { this.visible';
 // Move initial data access behind the same retryable boundary used by the page.
 const source=fs.readFileSync('pages/narrative/narrative.vue','utf8'),body=source.slice(source.indexOf(start)+start.length,source.indexOf(end)).replace(/\s*},\s*$/,'');
 r(start+body+'\n  },\n', '  onLoad(options = {}) { this.loadOptions=options;this.loadRecord(); },\n');
 r('  methods: {',"  methods: {\n    loadRecord(){this.recordReadError=false;this.unsubscribe?.();this.unsubscribe=null;try{this.loadRecordData(this.loadOptions);}catch(_){this.recordReadError=true;this.draft=null;this.clearPhotos();this.session.cancel();}},\n    loadRecordData(options){"+body.replace('    const work =','    this.store.list();\n    const work =')+'\n    },');
 r('   <view v-if="draft && stage=', '   '+panel('loadRecord')+'\n   <view v-if="!recordReadError && draft && stage=');
 r('</style>',css+'</style>');
});
edit('common/card-studio-page.js',r=>{
 r('data:()=>({insets:', 'data:()=>({recordReadError:false,insets:');
 r('  initialize(q={}){',"  readFailed(){this.revoke();this.recordReadError=true;this.needsSource=false;},\n  initialize(q={}){this.recordReadError=false;this.needsSource=false;this.unsubscribe?.();this.unsubscribe=null;try{this.initializeData(q);}catch(_){this.readFailed();}},\n  initializeData(q={}){");
 r('  checkSource(){if(!this.current()', '  checkSource(){try{this.checkSourceData();}catch(_){this.readFailed();}},\n  checkSourceData(){if(!this.current()');
 r('  refreshSource(){this.source=this.readSource();',"  refreshSource(){try{this.refreshSourceData();}catch(_){this.readFailed();}},\n  refreshSourceData(){this.source=this.readSource();");
});
edit('pages/card-compose/card-compose.vue',r=>{
 r('  <view v-if="needsSource"','  '+panel('initialize(query)')+'\n  <view v-else-if="needsSource"');
 r('</style>',css+'</style>');
});
