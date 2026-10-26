'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createCostBudget,COLLECTION}=require('../uniCloud-alipay/cloudfunctions/common/pety-auth/cost-budget');
function fixture(config){let down=false,time=Date.UTC(2026,9,10);const rows=new Map(),db={command:{lt:n=>({lt:n}),inc:n=>({inc:n})},collection(name){assert.equal(name,COLLECTION);return{doc:id=>({get:async()=>{if(down)throw Error('outage');return{data:rows.has(id)?[{...rows.get(id)}]:[]};}}),add:async r=>{if(rows.has(r._id))throw Error('duplicate');rows.set(r._id,{...r});return{id:r._id};},where:q=>({update:async p=>{const row=rows.get(q._id);if(!row||row.count>=q.count.lt)return{updated:0};row.count+=p.count.inc;return{updated:1};}})};}};return{budget:createCostBudget(db,config,()=>time),outage:()=>down=true,advance:ms=>time+=ms,rows};}
test('cross-pet and developer generation attempts share a persistent account ceiling',async()=>{
 const h=fixture({avatarAccountDay:3,avatarGlobalDay:5}),results=await Promise.allSettled(Array.from({length:8},()=>h.budget.reserve({uid:'synthetic-A',feature:'avatar'})));assert.equal(results.filter(r=>r.status==='fulfilled').length,3);assert.ok(results.filter(r=>r.status==='rejected').every(r=>r.reason.code==='PROVIDER_BUDGET_EXCEEDED'));
});
test('global ceilings survive new users and preserve conservative spent attempts on failure',async()=>{
 const h=fixture({aiAccountDay:5,aiGlobalDay:2});await h.budget.reserve({uid:'synthetic-A',feature:'ai'});await h.budget.reserve({uid:'synthetic-B',feature:'ai'});await assert.rejects(h.budget.reserve({uid:'synthetic-C',feature:'ai'}),e=>e.code==='PROVIDER_BUDGET_EXCEEDED');assert.equal([...h.rows.values()].find(r=>r._id.includes('_global_')).count,2);
 h.advance(86400000);assert.equal((await h.budget.reserve({uid:'synthetic-C',feature:'ai'})).reserved,true);
});
test('budget outages, guest claims and unknown features cannot authorize a paid attempt',async()=>{
 const h=fixture();await assert.rejects(h.budget.reserve({uid:'',feature:'avatar'}));await assert.rejects(h.budget.reserve({uid:'A',feature:'arbitrary'}));h.outage();await assert.rejects(h.budget.reserve({uid:'A',feature:'ai'}),e=>e.code==='PROVIDER_BUDGET_UNAVAILABLE');
});

test('an explicit zero server ceiling stops the feature before a counter or paid dispatch',async()=>{
 const h=fixture({aiGlobalDay:0});await assert.rejects(h.budget.reserve({uid:'A',feature:'ai'}),e=>e.code==='PROVIDER_BUDGET_EXCEEDED');assert.equal(h.rows.size,0);
});
