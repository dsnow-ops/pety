'use strict';
const crypto = require('crypto');
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const fail = code => { throw Object.assign(new Error(code), { code }); };
const object = value => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const validKey = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value) && !['__proto__','constructor','prototype'].includes(value);
function confirmed(value) {
  if (!object(value) || value.error || ['errCode','code'].some(key => ![undefined,null,'',0,'0'].includes(value[key]))) fail('AVATAR_QUOTA_STATE_INVALID');
  return value;
}
function affected(value) {
  confirmed(value);
  const counts=['updated','updatedCount','affectedDocs','modifiedCount','affectedRows'].filter(key=>Object.prototype.hasOwnProperty.call(value,key)).map(key=>value[key]);
  if(!counts.length || counts.some(count=>!Number.isSafeInteger(count)||count<0||count>1||count!==counts[0]))fail('AVATAR_QUOTA_STATE_INVALID');
  return counts[0];
}
const clone = value => JSON.parse(JSON.stringify(value));
const legacyKey = row => `legacy_${digest(String(row.jobId || row.generationSessionId || row._id)).slice(0, 40)}`;
function ledgerId(scope) {
  if (!object(scope) || typeof scope.owner!=='string' || !scope.owner || !['free','member'].includes(scope.pool) || typeof scope.cycle!=='string' || !scope.cycle || (scope.pool==='free'&&(typeof scope.pet!=='string'||!scope.pet))) fail('AVATAR_QUOTA_STATE_INVALID');
  return `quota_${digest([scope.owner,scope.pool,scope.cycle,scope.pool==='free'?scope.pet:''].join(':'))}`;
}
function seedEntries(records) {
  if(!Array.isArray(records))fail('AVATAR_QUOTA_STATE_INVALID');
  const entries={};
  for(const row of records) {
    if(!object(row)||!['CREATING','PENDING','RUNNING','UNKNOWN','SUBMISSION_UNKNOWN','SUCCEEDED','FAILED','CANCELED'].includes(row.status)||['resultSaved','userQuotaConsumed'].some(key=>row[key]!==undefined&&typeof row[key]!=='boolean')||![row.jobId,row.generationSessionId,row._id].some(value=>typeof value==='string'&&value.length>0))fail('AVATAR_QUOTA_STATE_INVALID');
    const key=row.quotaReservationId || legacyKey(row);
    if(!validKey(key))fail('AVATAR_QUOTA_STATE_INVALID');
    if(row.status==='SUCCEEDED'&&row.resultSaved===true&&row.userQuotaConsumed!==false) entries[key]='consumed';
    else if(['CREATING','PENDING','RUNNING','UNKNOWN','SUBMISSION_UNKNOWN'].includes(row.status)&&entries[key]!=='consumed') entries[key]='reserved';
  }
  return entries;
}
function createQuotaLedger(collection, readHistory, replaceEntries = value => value, { transactional = false } = {}) {
  function readState(response) {
    confirmed(response);
    if(transactional) {
      if(!Object.prototype.hasOwnProperty.call(response,'data')||(response.data!==null&&!object(response.data)))fail('AVATAR_QUOTA_STATE_INVALID');
      return response.data;
    }
    if(!Array.isArray(response.data)||response.data.length>1||response.data.some(row=>!object(row)))fail('AVATAR_QUOTA_STATE_INVALID');
    return response.data[0];
  }
  async function load(scope) {
    const id=ledgerId(scope),response=await collection.doc(id).get();
    let state=readState(response);
    if(!state) {
      const rows=await readHistory(scope);
      if(!Array.isArray(rows)) fail('AVATAR_QUOTA_STATE_INVALID');
      const initial={_id:id,owner:scope.owner,pool:scope.pool,cycle:scope.cycle,pet:scope.pool==='free'?scope.pet:'',version:0,entries:seedEntries(rows),updatedAt:Date.now()};
      try {
        const receipt=confirmed(await collection.add(initial));
        if(receipt.id!==id)fail('AVATAR_QUOTA_STATE_INVALID');
        state=initial;
      }
      catch(error) {
        // A conflicting transaction must roll back, never continue on a stale
        // snapshot or retry an external operation from inside the transaction.
        if (transactional) throw error;
        if(!/duplicate|already exists|E11000/i.test(String(error?.code||error?.message||'')))throw error;
        state=readState(await collection.doc(id).get());
      }
    }
    if(!state||state._id!==id||state.owner!==scope.owner||state.pool!==scope.pool||state.cycle!==scope.cycle||state.pet!==(scope.pool==='free'?scope.pet:'')||!Number.isSafeInteger(state.version)||state.version<0||state.version>=Number.MAX_SAFE_INTEGER||!object(state.entries)||Object.entries(state.entries).some(([key,value])=>!validKey(key)||!['reserved','consumed'].includes(value)))fail('AVATAR_QUOTA_STATE_INVALID');
    return state;
  }
  async function change(scope, key, operation) {
    if(!validKey(key))fail('AVATAR_QUOTA_STATE_INVALID');
    for(let attempt=0;attempt<16;attempt++) {
      const state=await load(scope),entries=clone(state.entries),previous=entries[key];
      if(operation==='reserve') {
        if(previous)return{fresh:false,state:previous};
        if(Object.keys(entries).length>=(scope.pool==='member'?10:3))fail('AVATAR_QUOTA_EXCEEDED');
        entries[key]='reserved';
      } else if(operation==='consume') {
        if(previous==='consumed')return{fresh:false,state:previous};
        // A legacy success may first appear while the initial ledger is seeded.
        if(!previous)fail('AVATAR_QUOTA_RESERVATION_MISSING');
        entries[key]='consumed';
      } else {
        if(!previous||previous==='consumed')return{fresh:false,state:previous||'released'};
        delete entries[key];
      }
      const target=transactional ? collection.doc(state._id) : collection.where({_id:state._id,version:state.version,owner:scope.owner});
      const result=await target.update({entries:replaceEntries(entries),version:state.version+1,updatedAt:Date.now()});
      if(affected(result)===1)return{fresh:true,state:entries[key]||'released'};
    }
    fail('AVATAR_QUOTA_BUSY');
  }
  return {reserve:(scope,key)=>change(scope,key,'reserve'),consume:(scope,key)=>change(scope,key,'consume'),release:(scope,key)=>change(scope,key,'release'),
    async read(scope){const s=await load(scope),values=Object.values(s.entries);return{used:values.filter(v=>v==='consumed').length,reserved:values.filter(v=>v==='reserved').length};}};
}
module.exports={createQuotaLedger,ledgerId,legacyKey,seedEntries};
