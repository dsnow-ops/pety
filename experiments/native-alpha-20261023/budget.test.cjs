const test=require('node:test'),assert=require('node:assert/strict');
const {budgetGate}=require('./run.cjs');
const auth={userApproved:true,totalCapFen:2000,previousReservationFen:140,pricesFen:{'qwen-image-2.1-pro':25,'qwen-image-2.1-turbo':10}};
const sample={id:'next',model:'qwen-image-2.1-pro'};
test('budget includes previous experiment and reserves worst case for every attempt',()=>{
 assert.equal(budgetGate(auth,[],sample).afterFen,165);
 const receipts=Array.from({length:74},(_,i)=>({id:'old-'+i,model:sample.model,status:'READY_FOR_VISUAL_REVIEW'}));
 assert.throws(()=>budgetGate(auth,receipts,sample),/TOTAL_BUDGET_EXCEEDED/);
 assert.equal(budgetGate(auth,receipts,{...sample,model:'qwen-image-2.1-turbo'}).afterFen,2000);
});
test('uncertain calls, reused IDs, changed prices and unknown models cannot be submitted',()=>{
 for(const status of ['SUBMISSION_STARTED','SUBMISSION_UNCERTAIN','ACCEPTED','POLL_TIMEOUT'])assert.throws(()=>budgetGate(auth,[{id:'prior',model:sample.model,status}],sample),/UNRESOLVED/);
 assert.throws(()=>budgetGate(auth,[{...sample,status:'READY_FOR_VISUAL_REVIEW'}],sample),/NEVER_REPOST/);
 assert.throws(()=>budgetGate(auth,[],{...sample,model:'other'}),/PRICE_NOT_VERIFIED/);
 assert.throws(()=>budgetGate({...auth,totalCapFen:2001},[],sample),/AUTHORIZATION/);
});
