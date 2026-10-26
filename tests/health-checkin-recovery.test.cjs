const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {dataRuntime}=require('../scripts/lib/health-recovery-runtime.cjs');
const {localServer}=require('./fixtures/authenticated-health-server.cjs');
const day='2026-09-28';
test('home health routes retain selected date and pet, handle an empty pet, and keep memorial writing',()=>{
 const source=fs.readFileSync('pages/home/home.vue','utf8');const main=source.slice(source.indexOf('    handleCoreAction(key)'),source.indexOf('    handleInfoCard('));
 const select=source.match(/    selectHomeDate\(item\) \{[\s\S]*?\n    \}/)[0];const routes=[],uni={navigateTo:o=>routes.push(o.url),reLaunch:o=>routes.push(o.url)};
 const methods=Function('uni','formatDateKey','return {'+main+select+'}')(uni,()=>day);const context={activePet:null,isMemorialMode:false,openLifeRecord:()=>routes.push('life')};
 assert.doesNotThrow(()=>methods.handleCoreAction.call(context,'journal'));assert.doesNotThrow(()=>methods.selectHomeDate.call(context,{dateKey:'2026-09-26'}));assert.deepEqual(routes,['/pages/welcome/welcome','/pages/welcome/welcome']);
 context.activePet={id:'pet A'};methods.handleCoreAction.call(context,'journal');methods.selectHomeDate.call(context,{dateKey:'2026-09-26'});assert.equal(routes.at(-2),'/pages/calendar/calendar?date='+day+'&petId=pet%20A');assert.equal(routes.at(-1),'/pages/calendar/calendar?date=2026-09-26&petId=pet%20A');context.isMemorialMode=true;methods.handleCoreAction.call(context,'journal');assert.equal(routes.at(-1),'life');
});
test('health patch preserves stable ID, unknown fields, zero/false, empty and omitted values',()=>{
 const s=dataRuntime(),d=s.diary;s.storage.setStorageSync('pet_diaries_p',{[day]:{id:'old',date:day,mood:'sick',events:['vomit'],note:'观察',weight:0,noVomiting:false,attachments:['own-file'],future:{x:1},createdAt:7,updatedAt:10}});
 d.saveDiaryRecord('p',day,{note:'',weight:undefined,noVomiting:false});const r=d.getDiaryRecord('p',day);assert.equal(r.id,'old');assert.equal(r.createdAt,7);assert.equal(r.weight,0);assert.equal(r.noVomiting,false);assert.equal(r.note,'');assert.deepEqual(r.events,['vomit']);assert.deepEqual(r.attachments,['own-file']);assert.deepEqual(r.future,{x:1});assert.equal(Object.keys(d.getDiaryMap('p')).length,1);
});
test('legacy note overlay is read-only, original-only and yields to newer health edit',()=>{
 const s=dataRuntime(),d=s.diary,raw={[day]:{note:'old',events:['food'],updatedAt:1},'2026-09-27':{note:'other',updatedAt:1}};
 s.storage.setStorageSync('pet_diaries_p',raw);s.storage.setStorageSync('pet_diaries_p_creative_v1',{records:{['legacy:'+day]:{id:'legacy:'+day,legacy:true,kind:'care',original:'用户更新',text:'AI润色并声称正常',updatedAt:20}}});
 assert.equal(d.getDiaryRecord('p',day).note,'用户更新');assert.deepEqual(s.storage.getStorageSync('pet_diaries_p'),raw);
 d.saveDiaryRecord('p',day,{note:'健康编辑新备注'});assert.equal(d.getDiaryRecord('p',day).note,'健康编辑新备注');assert.deepEqual(s.storage.getStorageSync('pet_diaries_p')['2026-09-27'],raw['2026-09-27']);
 d.saveDiaryRecord('p',day,{note:''});assert.equal(d.getDiaryRecord('p',day).note,'');assert.equal(s.storage.getStorageSync('pet_diaries_p_creative_v1').records['legacy:'+day].original,'用户更新');
});
test('three-date context labels original life as non-clinical and excludes other pet, memorial and future; edit is fresh',()=>{
 const s=dataRuntime(),d=s.diary;d.saveDiaryRecord('p','2026-09-26',{mood:'calm',events:['appetite_good'],note:'虚构正常样本'});d.saveDiaryRecord('p','2026-09-27',{mood:'sick',events:['appetite_low'],note:'虚构异常样本'});d.saveDiaryRecord('p',day,{events:['water'],note:'未填总体状态'});d.saveDiaryRecord('p','2026-09-29',{mood:'good',note:'未来'});d.saveDiaryRecord('p','2026-09-25',{relationshipStage:'deceased',memoryText:'私密怀念'});d.saveDiaryRecord('q',day,{note:'另一只宠物'});
 const store=s.creative('p'),life=store.create('current');life.original=life.text='生活文学：食欲完全恢复了，所有检查正常';life.localDate=day;store.save(life);
 const text=d.buildDiaryContext('p',{todayKey:day,maxDays:3,maxChars:260});for(const date of ['2026-09-26','2026-09-27',day])assert.ok(text.includes(date));assert.match(text,/状态:未填写/);assert.doesNotMatch(text,/另一只|私密怀念|未来/);
 d.saveDiaryRecord('p','2026-09-27',{events:['stool_soft'],note:'编辑后的新值'});const next=d.buildDiaryContext('p',{todayKey:day,maxDays:3,maxChars:260});assert.match(next,/编辑后的新值/);assert.doesNotMatch(next,/食欲下降/);
});
test('life-only saves never complete health; context explicitly marks original as non-clinical',()=>{const s=dataRuntime(),store=s.creative('p'),life=store.create('current');life.original='食欲正常的故事';store.save(life);assert.equal(s.diary.isHealthDiaryRecord(s.diary.getDiaryRecord('p',day)),false);assert.match(s.diary.buildDiaryContext('p'),/主人日常原文（非健康结论）/);assert.match(s.diary.buildDiaryContext('p'),/状态:未填写/);});

test('memorial persona context never turns previous health notes into memories',()=>{
 const source=fs.readFileSync('pages/chat/chat.vue','utf8');const method=source.slice(source.indexOf('    buildMemorialContext('),source.indexOf('    compactMemorialText('));
 const deps={getPetProfile:()=>({}),getMemorialOwnerCall:()=>'',getDiaryMap:()=>({'2026-09-28':{relationshipStage:'current',note:'不可进入角色聊天的病历'},'2026-09-27':{relationshipStage:'deceased',memoryText:'主人主动写下的回忆'}})};
 const methods=Function(...Object.keys(deps),'return {'+method+'}')(...Object.values(deps));const context={activePet:{id:'p'},activePetId:'p',activePetName:'测试禾禾',compactMemorialText:x=>String(x||'')};
 const text=methods.buildMemorialContext.call(context,260);assert.doesNotMatch(text,/病历/);assert.match(text,/主人主动写下的回忆/);
});
test('storage failure and optimistic conflict preserve original; repeat targets same date',()=>{const s=dataRuntime(),d=s.diary;const r=d.saveDiaryRecord('p',day,{note:'first'});s.fail(true);assert.throws(()=>d.saveDiaryRecord('p',day,{note:'lost'}),/TEST_DISK_FULL/);s.fail(false);assert.equal(d.getDiaryRecord('p',day).note,'first');d.saveDiaryRecord('p',day,{note:'next'},{expectedUpdatedAt:r.updatedAt});assert.throws(()=>d.saveDiaryRecord('p',day,{note:'stale'},{expectedUpdatedAt:r.updatedAt}),/DIARY_VERSION_CONFLICT/);assert.equal(Object.keys(d.getDiaryMap('p')).length,1);});
test('account, guest, pet and obsolete A-B-A leases isolate health patches',()=>{const s=dataRuntime(),d=s.diary;d.saveDiaryRecord('p',day,{note:'guest'});s.login('A');const lease=s.scope();d.saveDiaryRecord('p',day,{note:'A'},{scope:lease});s.login('B');assert.equal(d.getDiaryRecord('p',day).note,'');d.saveDiaryRecord('p',day,{note:'B'});s.login('A');assert.throws(()=>d.saveDiaryRecord('p',day,{note:'late'},{scope:lease}),/DATA_SCOPE_CHANGED/);assert.equal(d.getDiaryRecord('p',day).note,'A');assert.equal(d.getDiaryRecord('q',day).note,'');s.login(null);assert.equal(d.getDiaryRecord('p',day).note,'guest');});
test('real server main routes serialized diary context into final provider messages locally',async()=>{const s=dataRuntime();s.diary.saveDiaryRecord('p',day,{events:['water'],note:'虚构饮水观察'});const cloud=localServer();const data={relationshipStage:'current',petName:'测试禾禾',userMessage:s.diary.buildDiaryContext('p',{todayKey:day})+'\n\n用户当前问题：我的猫饮水变化要观察什么？'};const result=await cloud.request(data);assert.equal(result.result.code,0);assert.match(JSON.stringify(result.payload.messages),/虚构饮水观察/);assert.match(JSON.stringify(result.payload.messages),/状态:未填写/);});
