const fs=require('node:fs'),test=require('node:test'),assert=require('node:assert/strict');
const {moduleFrom}=require('../scripts/lib/health-recovery-runtime.cjs');
const api=moduleFrom('common/care-followup.js','careFollowupHistory,saveCareFollowup,getCareFollowupDraft,saveCareFollowupDraft,discardCareFollowupDraft',{getConsultationRecords:()=>[{id:'consult-1'}],localEventDate:()=> '2026-10-23'});
test('followup history preserves earlier notes, old single-entry format and source binding',()=>{
 const state={followups:{}};const store={petId:'TEST-P1',read:()=>structuredClone(state),updateSection:(k,v)=>state[k]=v};
 api.saveCareFollowup(store,'consult-1','changed','TEST 昨天未呕吐');api.saveCareFollowup(store,'consult-1','visited','TEST 今天就医，未开始用药');
 const before=JSON.stringify(state);assert.equal(api.careFollowupHistory(state.followups,'consult-1').length,2);assert.equal(JSON.stringify(state),before);
 assert.equal(api.careFollowupHistory({old:{note:'TEST 旧观察',at:1}},'old')[0].note,'TEST 旧观察');
 assert.deepEqual(api.careFollowupHistory({old:{entries:[{sourceId:'other',note:'FOREIGN'}]}},'old'),[]);
 assert.deepEqual(api.careFollowupHistory({old:{entries:[{id:'first',at:1,note:'first'},{id:'second',at:1,note:'second'}]}},'old').map(e=>e.note),['second','first']);
 assert.throws(()=>api.saveCareFollowup(store,'deleted','changed','TEST'),/CARE_SOURCE_MISSING/);
});
test('blank unchanged observation and excessive text cannot manufacture history entries',()=>{
 let writes=0;const store={petId:'TEST-P1',read:()=>({followups:{}}),updateSection:()=>writes++};
 assert.throws(()=>api.saveCareFollowup(store,'consult-1','none','   '),/CARE_FOLLOWUP_EMPTY/);
 assert.throws(()=>api.saveCareFollowup(store,'consult-1','changed','a'.repeat(2001)),/CARE_FOLLOWUP_TOO_LONG/);assert.equal(writes,0);
 api.saveCareFollowup(store,'consult-1','visited','');assert.equal(writes,1);
});
function pageFixture(){
 let pet={id:'TEST-P1',status:'current'},version=1,writes=0;
 const store={petId:pet.id,scope:{version},read:()=>({followups:{'consult-1':{status:'changed',note:'TEST old note',entries:[{id:'entry',sourceId:'consult-1',note:'TEST old note'}]}}})};
 const deps={scopedStorage:{},getEmergencySigns:()=>[],getConsultationRecords:()=>[{id:'consult-1',question:'TEST original'}],getActivePet:()=>pet,subscribePetSelection:()=>()=>{},subscribeAccountScope:()=>()=>{},getNarrativeStore:()=>store,narrativeMode:m=>m==='deceased'?'deceased':'current',saveCareFollowup:()=>writes++,careFollowupHistory:api.careFollowupHistory,isDataScopeCurrent:s=>s.version===version,t:k=>k};
 const src=fs.readFileSync('pages/care/care.vue','utf8').match(/<script>([\s\S]*?)<\/script>/)[1].replace(/^import[\s\S]*?from\s+['"][^'"]+['"];?\s*/gm,'').replace('export default','return');
 Object.assign(deps,{getCareFollowupDraft:api.getCareFollowupDraft,saveCareFollowupDraft:api.saveCareFollowupDraft,discardCareFollowupDraft:api.discardCareFollowupDraft});
 const page=Function(...Object.keys(deps),src)(...Object.values(deps)),state=page.data();for(const[k,fn]of Object.entries(page.methods))state[k]=fn.bind(state);page.onShow.call(state);assert.equal(state.careLoadError,false);assert.equal(state.consultations.length,1);
 return{page,state,writes:()=>writes,switchPet:()=>pet={id:'TEST-P2',status:'current'},switchAccount:()=>version++,noPet:()=>pet=null};
}
test('new followup starts empty; account/pet changes cannot persist stale observations',()=>{
 for(const change of ['switchPet','switchAccount']){const h=pageFixture();h.state.startFollowup('consult-1');assert.equal(h.state.followupNote,'');h.state.followupNote='TEST stale';h[change]();h.state.commitFollowup();assert.equal(h.writes(),0);}
});
test('hidden page and missing active pet erase private view state and editor references',()=>{
 const h=pageFixture();h.state.startFollowup('consult-1');h.page.onHide.call(h.state);assert.equal(h.state.followupStore,null);assert.equal(h.state.consultations.length,0);h.state.commitFollowup();assert.equal(h.writes(),0);
 const k=pageFixture();k.noPet();k.state.loadCare();assert.equal(k.state.consultations.length,0);assert.deepEqual(k.state.follows,{});
});
