// Assertion-checked follow-up to the initial read-protection patch.
const fs=require('node:fs');
const edit=(file,fn)=>{let s=fs.readFileSync(file,'utf8');const r=(a,b)=>{if(!s.includes(a))throw Error(file+': '+a);s=s.replace(a,b)};fn(r);fs.writeFileSync(file,s)};
for(const file of ['pages/album/album.vue','pages/calendar/calendar.vue','pages/narrative/narrative.vue','pages/card-compose/card-compose.vue'])edit(file,r=>{
 r('class="record-read-error" role="alert"','class="record-read-error" :style="{\'--ui-font-scale\':uiFontScale}" role="alert"');
 if(file.includes('/narrative/'))r('</style>','.narrative-page .record-read-error{margin:24px 20px;}\n</style>');
 if(file.includes('/card-compose/'))r('</style>','.composition-page .record-read-error{margin:24px 16px;}\n</style>');
});
edit('pages/album/album.vue',r=>r('class="new-page" :disabled="recordReadError"','v-if="!recordReadError" class="new-page"'));
edit('pages/calendar/calendar.vue',r=>r('getDiaryMap(this.activePetId) : {}','getDiaryMap(this.activePetId,this.loadedDataScope,{strict:true}) : {}'));
edit('common/card-studio-page.js',r=>r('getDiaryMap(this.pet.id,this.scope)','getDiaryMap(this.pet.id,this.scope,{strict:true})'));
edit('pages/insights/insights.vue',r=>{r('const diaryMap = getDiaryMap(this.activePet.id);','const diaryMap = getDiaryMap(this.activePet.id,undefined,{strict:true});');r('const diaryMap = getDiaryMap(this.activePet.id);','const diaryMap = getDiaryMap(this.activePet.id,undefined,{strict:true});');});
edit('pages/card-compose/card-compose.vue',r=>{
 r('<view v-if="panel||proposal"','<template v-if="!recordReadError">\n  <view v-if="panel||proposal"');
 r('<FreeSealEditor v-if="freeEditor" v-bind="freeEditor" @cancel="freeEpoch++;freeEditor=null" @complete="completeFreeSeal"/>','<FreeSealEditor v-if="freeEditor" v-bind="freeEditor" @cancel="freeEpoch++;freeEditor=null" @complete="completeFreeSeal"/></template>');
});
edit('scripts/verify-overnight-local.cjs',r=>r("['record-directory',","['record-storage-integrity','record-directory',"));
for(const file of ['scripts/verify-overnight-records.cjs','scripts/verify-overnight-care.cjs','scripts/verify-overnight-retention.cjs'])edit(file,r=>{
 const source=fs.readFileSync(file,'utf8'),match=source.match(/const root=path.resolve\('unpackage\/overnight-20261023\/round-\d+\/h5'\)/);if(!match)throw Error(file+' build anchor');
 r(match[0],"const root=path.resolve('unpackage/overnight-20261023',process.argv[3]||'round-10','h5')");
});
edit('scripts/verify-overnight-read-errors.cjs',r=>{
 r("await shot(kind+'-'+name+'-large-360');","assert.ok(await page.locator('.record-read-error .read-error-title').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=25),'large text must actually enlarge the title');await shot(kind+'-'+name+'-large-360');");
 r("||'round-9'","||'round-10'");
});
