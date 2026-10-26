const test=require('node:test'),assert=require('node:assert/strict');
const {moduleFrom,dataRuntime}=require('../scripts/lib/health-recovery-runtime.cjs');
const api=moduleFrom('common/care-followup.js','careFollowupHistory,saveCareFollowup,saveCareFollowupDraft,discardCareFollowupDraft',{getConsultationRecords:()=>[{id:'TEST-source'}],localEventDate:()=> '2026-10-23'});
test('followup drafts survive reopening without manufacturing a completed observation',()=>{
 const h=dataRuntime(),store=h.creative('TEST-p');let draft=api.saveCareFollowupDraft(store,'TEST-source','none','TEST still writing','');
 assert.equal(api.careFollowupHistory(store.read().followups,'TEST-source').length,0);assert.equal(h.creative('TEST-p').read().followups['TEST-source'].draft.note,'TEST still writing');
 draft=api.saveCareFollowupDraft(store,'TEST-source','visited','TEST doctor visit',draft.token);const before=draft.token;
 api.saveCareFollowup(store,'TEST-source','visited',draft.note,undefined,{expectedDraftToken:before});const saved=store.read().followups['TEST-source'];assert.equal(saved.draft,undefined);assert.equal(saved.entries.length,1);assert.equal(saved.entries[0].note,'TEST doctor visit');
 api.saveCareFollowup(store,'TEST-source','visited',draft.note,undefined,{expectedDraftToken:before});assert.equal(store.read().followups['TEST-source'].entries.length,1);
});
test('stale editor tokens cannot replace, discard or commit a newer followup draft',()=>{
 const h=dataRuntime(),store=h.creative('TEST-p'),a=api.saveCareFollowupDraft(store,'TEST-source','none','TEST A',''),b=api.saveCareFollowupDraft(store,'TEST-source','none','TEST B',a.token),before=structuredClone([...h.disk]);
 for(const action of [()=>api.saveCareFollowupDraft(store,'TEST-source','none','TEST stale',a.token),()=>api.discardCareFollowupDraft(store,'TEST-source',a.token),()=>api.saveCareFollowup(store,'TEST-source','visited','TEST stale',undefined,{expectedDraftToken:a.token})]){assert.throws(action,/CARE_DRAFT_CHANGED/);assert.deepEqual([...h.disk],before);}
 assert.notEqual(a.token,b.token);
});
test('discard only removes the matching draft and preserves old formal history and other sources',()=>{
 const h=dataRuntime(),store=h.creative('TEST-p');api.saveCareFollowup(store,'TEST-source','changed','TEST old formal');const old=structuredClone(store.read().followups['TEST-source'].entries),d=api.saveCareFollowupDraft(store,'TEST-source','none','TEST discard','');api.discardCareFollowupDraft(store,'TEST-source',d.token);assert.deepEqual(store.read().followups['TEST-source'].entries,old);assert.equal(store.read().followups['TEST-source'].draft,undefined);
});
test('disk failure during commit preserves the draft and formal history for retry',()=>{
 const h=dataRuntime(),store=h.creative('TEST-p'),d=api.saveCareFollowupDraft(store,'TEST-source','visited','TEST retain',''),before=structuredClone([...h.disk]);h.fail(true);assert.throws(()=>api.saveCareFollowup(store,'TEST-source','visited',d.note,undefined,{expectedDraftToken:d.token}),/TEST_DISK_FULL/);assert.deepEqual([...h.disk],before);h.fail(false);api.saveCareFollowup(store,'TEST-source','visited',d.note,undefined,{expectedDraftToken:d.token});assert.equal(store.read().followups['TEST-source'].entries.length,1);
});
test('account and pet isolation, removed source and input limits guard draft writes',()=>{
 const h=dataRuntime(),store=h.creative('TEST-p');api.saveCareFollowupDraft(store,'TEST-source','none','TEST private','');assert.equal(h.creative('TEST-other').read().followups['TEST-source'],undefined);const before=structuredClone([...h.disk]);
 assert.throws(()=>api.saveCareFollowupDraft(store,'gone','none','TEST',''),/CARE_SOURCE_MISSING/);assert.throws(()=>api.saveCareFollowupDraft(store,'TEST-source','none','x'.repeat(2001),''),/CARE_FOLLOWUP_TOO_LONG/);assert.deepEqual([...h.disk],before);
 h.login('TEST-B');assert.equal(h.creative('TEST-p').read().followups['TEST-source'],undefined);assert.throws(()=>api.saveCareFollowupDraft(store,'TEST-source','none','TEST stale',''),/DATA_SCOPE_CHANGED/);assert.deepEqual([...h.disk],before);
});
test('uncertain commit confirmation cannot duplicate the same draft observation on retry',()=>{
 const h=dataRuntime(),store=h.creative('TEST-p'),d=api.saveCareFollowupDraft(store,'TEST-source','visited','TEST once','');let writes=0;
 const uncertain={...store,updateSection(...args){store.updateSection(...args);writes++;throw Error('TEST acknowledgement lost')}};
 assert.throws(()=>api.saveCareFollowup(uncertain,'TEST-source','visited',d.note,undefined,{expectedDraftToken:d.token}),/acknowledgement lost/);
 api.saveCareFollowup(uncertain,'TEST-source','visited',d.note,undefined,{expectedDraftToken:d.token});assert.equal(writes,1);assert.equal(store.read().followups['TEST-source'].entries.length,1);
});
test('malformed or newer draft structure cannot be overwritten or mistaken for formal history',()=>{
 for(const bad of [{draft:{version:2}},'TEST broken',{entries:'TEST broken'}]){
  const h=dataRuntime(),store=h.creative('TEST-p');store.updateSection('followups',{'TEST-source':bad});const before=structuredClone([...h.disk]);
  assert.throws(()=>api.saveCareFollowupDraft(store,'TEST-source','none','TEST new',''),/CARE_STORAGE_INVALID/);assert.deepEqual([...h.disk],before);
 }
});
