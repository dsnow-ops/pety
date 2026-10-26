const test=require('node:test'),assert=require('node:assert/strict');
const rows=new Map();
const collection={doc:id=>({get:async()=>({data:rows.has(id)?[{_id:id,...rows.get(id)}]:[]})}),where:q=>({update:async patch=>{const row=rows.get(q._id);if(!row||!Object.entries(q).every(([k,v])=>(k==='_id'?q._id:row[k])===v))return{updated:0};Object.assign(row,patch);return{updated:1};}})};
global.uniCloud={database:()=>({collection:()=>collection})};
const api=require('../uniCloud-alipay/cloudfunctions/api_pet_avatar/index.js').__test;
test('same pet id has distinct account locks and foreign legacy locks are never consumed',async()=>{
 rows.clear();rows.set('active_pet',{petHash:'pet',quotaOwnerHash:'B',jobId:'B-job'});
 assert.equal(await api.getJobDocument('pet','A'),null);
 const key=api.getAvatarJobLockId('pet','A');assert.notEqual(key,api.getAvatarJobLockId('pet','B'));
 rows.set(key,{petHash:'pet',quotaOwnerHash:'A',jobId:'A-job'});
 assert.equal((await api.getJobDocument('pet','A')).jobId,'A-job');
 assert.equal((await api.getJobDocument('pet','B')).jobId,'B-job');
 await assert.rejects(api.getJobDocument('pet',''),e=>e.code==='AVATAR_LOGIN_REQUIRED');
});
test('own legacy job remains recoverable; delayed poll cannot overwrite replacement job',async()=>{
 rows.clear();rows.set('active_pet',{petHash:'pet',quotaOwnerHash:'A',jobId:'old',status:'PENDING',updatedAt:1});
 const old=await api.getJobDocument('pet','A');assert.equal(old._id,'active_pet');
 assert.equal(await api.updateActiveAvatarJob(old,{status:'RUNNING',updatedAt:2}),true);
 rows.get('active_pet').jobId='new';rows.get('active_pet').status='PENDING';
 assert.equal(await api.updateActiveAvatarJob(old,{status:'SUCCEEDED',generatedFileId:'old-file'}),false);
 assert.equal(rows.get('active_pet').jobId,'new');assert.equal(rows.get('active_pet').generatedFileId,undefined);
});
