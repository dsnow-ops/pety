const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs');
const {createSessionService,COLLECTION}=require('../uniCloud-alipay/cloudfunctions/common/pety-auth/sessions');
// Local MVCC database double. Production service and conditional writes run
// unchanged. This does NOT certify uniCloud transaction semantics/deployment.
function fixture(faults={}){let rows=new Map([['uni-id-users',new Map([['u',{_id:'u',status:0,token:[],valid_token_date:0}]])]]),rev=0,time=100000,down=false;
 const clone=v=>structuredClone(v);
 function adapter(data,mutate,transaction=false){return{collection(name){if(!data.has(name))data.set(name,new Map());const table=data.get(name);function query(filter){return{doc(id){return query({_id:id})},field(){return this},where:f=>{if(transaction)throw Error("transaction where not supported");return query(f);},async get(){if(down)throw Error('DB_UNAVAILABLE');const rows=[...table.values()].filter(r=>Object.entries(filter).every(([k,v])=>r[k]===v)).map(clone);const result={data:transaction?rows[0]||null:rows};return faults.read?faults.read(result,{name,transaction}):result},async update(patch){if(down)throw Error('DB_UNAVAILABLE');let updated=0;for(const [id,r]of table)if(Object.entries(filter).every(([k,v])=>r[k]===v)){table.set(id,{...r,...clone(patch)});updated++;}if(updated)mutate();return faults.update?faults.update({updated},{name,transaction,patch}):{updated};},async add(r){if(down)throw Error('DB_UNAVAILABLE');if(table.has(r._id))throw Error('duplicate');table.set(r._id,clone(r));mutate();return faults.add?faults.add({id:r._id},{name,transaction}):{id:r._id}}}}return query({})}}}
 const db={collection:n=>adapter(rows,()=>rev++).collection(n),async startTransaction(){if(down)throw Error('DB_UNAVAILABLE');const base=rev,snapshot=clone(rows);return{...adapter(snapshot,()=>{},true),async commit(){if(rev!==base)throw Error('TRANSACTION_CONFLICT');rows=snapshot;rev++},async rollback(){}}}};
 const service=createSessionService(db,()=>time),issue=async uid=>({token:'local-'+uid,tokenExpired:time+10000});
 const login=async()=>service.confirm((await service.beginVerified('u')).petySessionChallenge.ticket,issue);
 return{service,db,login,issue,expire:()=>time+=121000,down:()=>down=true,rows:()=>rows};
}
test('verified login creates confirmation ticket; cancel leaves A effective',async()=>{const f=fixture(),a=await f.login(),t=(await f.service.beginVerified('u')).petySessionChallenge;assert.equal(t.takeoverRequired,true);await f.service.cancel(t.ticket);await assert.rejects(f.service.confirm(t.ticket,f.issue));await f.service.validate('u',a.petySession);});
test('confirmed B revokes A server-side; A refresh and delayed logout cannot reclaim B',async()=>{const f=fixture(),a=await f.login(),b=await f.login();await assert.rejects(f.service.validate('u',a.petySession),e=>e.errCode==='pety-session-revoked');await assert.rejects(f.service.renew('u',a.petySession));await f.service.logout('u',a.petySession);await f.service.validate('u',b.petySession);assert.equal(b.petySession.version,2);});
test('parallel confirmations yield one effective version; stale ticket cannot take back identity',async()=>{const f=fixture();await f.login();const t1=await f.service.beginVerified('u'),t2=await f.service.beginVerified('u');const result=await Promise.allSettled([t1,t2].map(t=>f.service.confirm(t.petySessionChallenge.ticket,f.issue)));assert.equal(result.filter(x=>x.status==='fulfilled').length,1);const winner=result.find(x=>x.status==='fulfilled').value;await f.service.validate('u',winner.petySession);});
test('tickets expire and cannot be replayed; missing or forged proof fails closed',async()=>{const f=fixture(),t=await f.service.beginVerified('u');f.expire();await assert.rejects(f.service.confirm(t.petySessionChallenge.ticket,f.issue));const a=await f.login();await assert.rejects(f.service.validate('other',a.petySession));await assert.rejects(f.service.validate('u',{}));await assert.rejects(f.service.validate('u',{...a.petySession,secret:'a'.repeat(64)}));});
test('quota admission and takeover conflict atomically; no unaccepted quota write survives',async()=>{const f=fixture(),a=await f.login(),t=await f.service.beginVerified('u');let release,entered;const gate=new Promise(r=>release=r),inside=new Promise(r=>entered=r);const admission=f.service.admit('u',a.petySession,async tx=>{await tx.collection('quota').add({_id:'same-uid',used:1});entered();await gate;});await inside;const b=await f.service.confirm(t.petySessionChallenge.ticket,f.issue);release();await assert.rejects(admission);assert.equal((await f.db.collection('quota').doc('same-uid').get()).data.length,0);await f.service.validate('u',b.petySession);});
test('admitted work keeps UID quota across a later takeover',async()=>{const f=fixture(),a=await f.login();await f.service.admit('u',a.petySession,tx=>tx.collection('quota').add({_id:'same-uid',used:2}));await f.login();assert.equal((await f.db.collection('quota').doc('same-uid').get()).data[0].used,2);});
test('database outage never falls back to client uid or new session',async()=>{const f=fixture(),a=await f.login();f.down();await assert.rejects(f.service.validate('u',a.petySession));await assert.rejects(f.service.beginVerified('u'));});
test('shared production auth rejects old proof even when its signed identity and token ledger are still valid',async()=>{
 const f=fixture(),a=await f.login(),b=await f.login();await f.db.collection('uni-id-users').doc('u').update({token:['token-A','token-B']});
 const module={exports:{}},source=fs.readFileSync('uniCloud-alipay/cloudfunctions/common/pety-auth/index.js','utf8');
 require('vm').runInNewContext(source,{module,uniCloud:{database:()=>f.db},require:name=>name==='uni-id-common'?{createInstance:()=>({checkToken:async token=>({uid:'u',iat:100,errCode:0})})}:{assertCurrent:(uid,proof)=>f.service.validate(uid,proof)}});
 await assert.rejects(module.exports.verifyRequest({uniIdToken:'token-A',petySession:a.petySession}),e=>e.errCode==='pety-session-revoked');
 assert.equal((await module.exports.verifyRequest({uniIdToken:'token-B',petySession:b.petySession})).uid,'u');
 await assert.rejects(module.exports.verifyRequest({uniIdToken:'token-A',uid:'forged'}),e=>e.errCode==='pety-session-required');
});
test('tokens/secrets are not stored plaintext in active-session rows',async()=>{const f=fixture(),a=await f.login();assert.doesNotMatch(JSON.stringify([...f.rows().get(COLLECTION).values()]),new RegExp(a.petySession.secret));assert.ok(a.petyIssuedToken);assert.equal(a.newToken,undefined,'SDK must not accept late confirm tokens automatically');});
test('revocation flushes before lease lock, keeps owner data and rejects late A error after B login',()=>{const disk=new Map([['uni_id_token','A'],['pety_current_session_v1',{uid:'u',version:1,secret:'a'}],['pety_owner_v1:account%3Au:draft','original']]),events=[];
 const uni={getStorageSync:k=>disk.get(k),setStorageSync:(k,v)=>disk.set(k,v),removeStorageSync:k=>disk.delete(k),$emit:()=>{assert.equal(disk.has('pety_session_lock_v1'),false);events.push('flush')},reLaunch:()=>events.push('login'),showToast(){}};
 const code=fs.readFileSync('common/single-session-client.js','utf8').replace(/^import.*$/gm,'').replace(/export /g,'');const client=Function('uni','uniCloud','getAccountScope','getCurrentUser',code+';return{observeSessionError,acceptSession}')(uni,{},()=>events.push('lock'),()=>({userId:'u'}));
 client.observeSessionError({errCode:'pety-session-revoked',sessionVersion:1},{secret:'a',version:1});assert.deepEqual(events,['flush','lock','login']);assert.equal(disk.get('pety_owner_v1:account%3Au:draft'),'original');assert.equal(disk.get('pety_session_lock_v1').uid,'u');client.acceptSession({secret:'b',version:2},'u');client.observeSessionError({errCode:'pety-session-revoked',sessionVersion:1},{secret:'a',version:1});assert.equal(disk.has('pety_session_lock_v1'),false);
});

const sessionUnavailable=e=>e.errCode==='pety-session-service-unavailable';
test('invalid active-session expiry never becomes an indefinitely valid session',async()=>{
 for(const expiresAt of [undefined,NaN,'', '9999999999999',-1]){
  const f=fixture(),a=await f.login(),row=[...f.rows().get(COLLECTION).values()][0];await f.db.collection(COLLECTION).doc(row._id).update({expiresAt});
  await assert.rejects(f.service.validate('u',a.petySession),sessionUnavailable);
 }
});
test('error-bearing normal and transactional session reads reject before admission work',async()=>{
 let fault=false,transactional=false;
 const f=fixture({read:(normal,ctx)=>fault&&ctx.name===COLLECTION&&ctx.transaction===transactional?{...normal,errCode:'TEST_PRIVATE_DB_ERROR'}:normal}),a=await f.login();
 fault=true;await assert.rejects(f.service.validate('u',a.petySession),sessionUnavailable);
 transactional=true;let admitted=0;await assert.rejects(f.service.admit('u',a.petySession,async()=>admitted++),sessionUnavailable);assert.equal(admitted,0);
});
test('unconfirmed session or ticket creation never releases a login challenge',async()=>{
 for(const name of [COLLECTION,'pety_session_tickets']){
  const f=fixture({add:(normal,ctx)=>ctx.name===name?{}:normal});await assert.rejects(f.service.beginVerified('u'),sessionUnavailable);
 }
});
test('malformed ticket expiry, flags and version cannot authorize a takeover',async()=>{
 for(const patch of [{expiresAt:undefined},{expiresAt:NaN},{used:undefined},{expectedVersion:-1},{validTokenDate:'0'}]){
  const f=fixture(),t=await f.service.beginVerified('u'),row=[...f.rows().get('pety_session_tickets').values()][0];await f.db.collection('pety_session_tickets').doc(row._id).update(patch);let issued=0;
  await assert.rejects(f.service.confirm(t.petySessionChallenge.ticket,async uid=>{issued++;return f.issue(uid)}));assert.equal(issued,0);
 }
});
test('unconfirmed ticket consumption rolls back takeover and leaves the prior proof effective',async()=>{
 let fault=false;const f=fixture({update:(normal,ctx)=>fault&&ctx.name==='pety_session_tickets'&&ctx.transaction?{updated:0}:normal}),a=await f.login(),t=await f.service.beginVerified('u');
 fault=true;let issued=0;await assert.rejects(f.service.confirm(t.petySessionChallenge.ticket,async uid=>{issued++;return f.issue(uid)}),sessionUnavailable);
 assert.equal(issued,0);await f.service.validate('u',a.petySession);
});
test('unconfirmed renewal rolls back its fence and expiry rather than reporting renewed',async()=>{
 let fault=false;const f=fixture({update:(normal,ctx)=>fault&&ctx.name===COLLECTION&&'expiresAt'in ctx.patch?{updated:1,errCode:'TEST_PRIVATE_DB_ERROR'}:normal}),a=await f.login();
 const before=structuredClone([...f.rows().get(COLLECTION).values()][0]);f.expire();fault=true;
 await assert.rejects(f.service.renew('u',a.petySession),sessionUnavailable);assert.deepEqual([...f.rows().get(COLLECTION).values()][0],before);
});
test('unconfirmed logout or cancel is not reported successful and is not automatically retried',async()=>{
 let fault=false,writes=0;const f=fixture({update:(normal,ctx)=>{if(fault&&!ctx.transaction){writes++;return{updated:'1'}}return normal}}),a=await f.login(),t=await f.service.beginVerified('u');
 fault=true;await assert.rejects(f.service.cancel(t.petySessionChallenge.ticket),sessionUnavailable);await assert.rejects(f.service.logout('u',a.petySession),sessionUnavailable);assert.equal(writes,2);
});
test('a malformed official issuance result never releases successful session credentials',async()=>{
 for(const result of [{token:'',tokenExpired:999999},{token:'token',tokenExpired:undefined},{token:'token',tokenExpired:'999999'},{token:'token',tokenExpired:1}]){
  const f=fixture(),t=await f.service.beginVerified('u');await assert.rejects(f.service.confirm(t.petySessionChallenge.ticket,async()=>result),sessionUnavailable);
 }
});
