const test=require('node:test'),assert=require('node:assert/strict');
const {moduleFrom,dataRuntime}=require('../scripts/lib/health-recovery-runtime.cjs');
function fixture(){const runtime=dataRuntime();const api=moduleFrom('common/consultation-store.js','getConsultationRecords,saveConsultationRecord',{scopedStorage:runtime.storage,captureDataScope:runtime.scope});return{...runtime,...api};}
test('more than 80 consultation summaries preserve earlier source IDs and isolate pets/accounts',()=>{
 const h=fixture();for(let i=0;i<125;i++)h.saveConsultationRecord('TEST-P1',{id:'TEST-'+i,question:'TEST question '+i,answer:'TEST answer',createdAt:1000+i});
 const records=h.getConsultationRecords('TEST-P1');assert.equal(records.length,125);assert.equal(records.at(-1).id,'TEST-0');assert.equal(records[0].id,'TEST-124');assert.deepEqual(h.getConsultationRecords('TEST-P2'),[]);h.login('TEST-A');assert.deepEqual(h.getConsultationRecords('TEST-P1'),[]);
});
test('repeated explicit ID is idempotent; conflicting retry cannot replace original text',()=>{
 const h=fixture(),input={id:'TEST-id',question:'TEST first',answer:'TEST answer',createdAt:1};h.saveConsultationRecord('TEST-P1',input);h.saveConsultationRecord('TEST-P1',input);assert.equal(h.getConsultationRecords('TEST-P1').length,1);
 assert.throws(()=>h.saveConsultationRecord('TEST-P1',{...input,question:'TEST changed'}),{code:'CONSULTATION_ID_CONFLICT'});assert.equal(h.getConsultationRecords('TEST-P1')[0].question,'TEST first');
});
test('same millisecond summaries get distinct IDs and failed writes preserve all saved bytes',()=>{
 const h=fixture();const ids=new Set();for(let i=0;i<60;i++)ids.add(h.saveConsultationRecord('TEST-P1',{question:'TEST '+i}).id);assert.equal(ids.size,60);
 const before=structuredClone([...h.disk]);h.fail(true);assert.throws(()=>h.saveConsultationRecord('TEST-P1',{question:'TEST failed'}),/TEST_DISK_FULL/);assert.deepEqual([...h.disk],before);
});
test('unreadable stored container never becomes a successful empty history or gets overwritten',()=>{
 const h=fixture();h.storage.setStorageSync('consultation_records_TEST-P1',{unexpected:'TEST raw recovery material'});const before=structuredClone([...h.disk]);
 assert.throws(()=>h.getConsultationRecords('TEST-P1'),{code:'CONSULTATION_STORAGE_INVALID'});assert.throws(()=>h.saveConsultationRecord('TEST-P1',{question:'TEST'}),{code:'CONSULTATION_STORAGE_INVALID'});assert.deepEqual([...h.disk],before);
});
