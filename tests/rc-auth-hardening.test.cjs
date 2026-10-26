const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const root='uni_modules/uni-id-pages/uniCloud/cloudfunctions/uni-id-co/';
function load(file,deps={},logs=[]){const module={exports:{}};vm.runInNewContext(fs.readFileSync(root+file,'utf8'),{module,exports:module.exports,require:name=>{if(name in deps)return deps[name];throw Error('Unexpected dependency '+name)},console:{log:(...v)=>logs.push(v),error:(...v)=>logs.push(v)},Date,Buffer},{filename:file});return module.exports;}
const ERROR=new Proxy({}, {get:(_,key)=>key});
test('unconfigured SMS rejects without creating any code; captcha remains mandatory',async()=>{
 let writes=0,sends=0,captchas=0;
 const fn=load('module/verify/send-sms-code.js',{'../../lib/utils/sms':{sendSmsCode:async()=>{sends++;return{errCode:0}}},'../../lib/utils/captcha':{verifyCaptcha:async()=>captchas++},'../../common/constants':{SMS_SCENE:{LOGIN:'login-by-sms'}},'../../common/error':{ERROR},'../../lib/utils/verify-code':{setMobileVerifyCode:async()=>writes++}});
 const ctx={config:{},middleware:{validate(){}}};
 const result=await fn.call(ctx,{mobile:'synthetic-mobile',captcha:'synthetic-captcha',scene:'login-by-sms'});
 assert.notEqual(result.errCode,0);assert.equal(writes,0);assert.equal(sends,0);assert.equal(captchas,1);
 ctx.config={service:{sms:{scene:{'login-by-sms':{templateId:'uni_sms_test'}}}}};
 assert.equal((await fn.call(ctx,{mobile:'synthetic-mobile',captcha:'synthetic-captcha',scene:'login-by-sms'})).errCode,0);assert.equal(sends,1);
});
test('unconfigured email rejects without creating a universal code',async()=>{
 let writes=0;
 const fn=load('module/verify/send-email-code.js',{'../../lib/utils/captcha':{verifyCaptcha:async()=>{}},'../../common/constants':{EMAIL_SCENE:{LOGIN:'login-by-email'}},'../../common/error':{ERROR},'../../lib/utils/verify-code':{setEmailVerifyCode:async()=>writes++}});
 const r=await fn.call({middleware:{validate(){}}},{email:'synthetic@example.invalid',captcha:'synthetic',scene:'login-by-email'});
 assert.notEqual(r.errCode,0);assert.equal(writes,0);
});
for(const type of ['Mobile','Email'])test(type+' code can be consumed once under concurrency, rejects expiry/scene/replay',async()=>{
 const field=type==='Mobile'?'mobile':'email';let row={_id:'r',state:0,[field]:'synthetic',scene:'login',code:'synthetic-code',expired_date:Date.now()+60000};
 const match=q=>Object.entries(q).every(([k,v])=>v&&typeof v==='object'?('gt'in v?row[k]>v.gt:'exists'in v?(row[k]!==undefined)===v.exists:false):row[k]===v);
 const col={where(q){return{orderBy(){return this},limit(){return this},async get(){return{data:match(q)?[{...row}]:[]}},async update(p){if(!match(q))return{updated:0};Object.assign(row,p);return{updated:1}}}},doc(){return{async update(p){Object.assign(row,p);return{updated:1}}}}};
 const api=load('lib/utils/verify-code.js',{'../../common/constants':{verifyCollection:col,dbCmd:{gt:n=>({gt:n}),exists:n=>({exists:n})}},'../../common/error':{ERROR},'../../common/utils':{getVerifyCode:()=>{throw Error('not generating')}}});
 const fn=api['verify'+type+'Code'],input={[field]:'synthetic',scene:'login',code:'synthetic-code'};
 const results=await Promise.allSettled([fn(input),fn(input)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 await assert.rejects(fn(input));row.state=0;await assert.rejects(fn({...input,scene:'reset'}));row.expired_date=Date.now()-1000;await assert.rejects(fn(input));
});
test('SMS failure never logs submitted code or raw contact',async()=>{
 const logs=[];const fn=load('module/login/login-by-sms.js',{'../../lib/utils/captcha':{getNeedCaptcha:async()=>false},'../../lib/utils/verify-code':{verifyMobileCode:async()=>{throw{errCode:'WRONG_CODE'}}},'../../lib/utils/unified-login':{},'../../common/constants':{CAPTCHA_SCENE:{},SMS_SCENE:{LOGIN_BY_SMS:'login'},LOG_TYPE:{LOGIN:'login'}}},logs);
 await assert.rejects(fn.call({middleware:{validate(){},uniIdLog:async()=>{}}},{mobile:'synthetic-private-contact',code:'synthetic-secret-code'}));
 assert.ok(!JSON.stringify(logs).includes('synthetic-private-contact'));assert.ok(!JSON.stringify(logs).includes('synthetic-secret-code'));
});
test('public administrator bootstrap is disabled before database access',async()=>{
 let touched=0;const fn=load('module/register/register-admin.js',{'../../common/constants':{userCollection:{where(){touched++;throw Error('must not query')}}},'../../common/error':{ERROR},'../../lib/utils/register':{}});
 const result=await fn.call({middleware:{validate(){}}},{username:'synthetic',password:'synthetic'});
 assert.notEqual(result.errCode,0);assert.equal(touched,0);
});
test('invalid external signature reveals neither signing secret nor signatures',()=>{
 const logs=[];const fn=load('middleware/verify-request-sign.js',{'crypto':require('node:crypto'),'uni-config-center':()=>({hasFile:()=>false}),'uni-cloud-s2s':{},'../common/error':{ERROR}},logs);
 assert.throws(()=>fn.call({getMethodName:()=> 'externalLogin',getUniversalClientInfo:()=>({source:'http'}),config:{requestAuthSecret:'synthetic-signing-secret'},getHttpInfo:()=>({headers:{'uni-id-nonce':'synthetic','uni-id-timestamp':String(Date.now()),'uni-id-signature':'synthetic-signature'},body:'{"params":{}}'})}));
 assert.ok(!JSON.stringify(logs).includes('synthetic-signing-secret'));assert.ok(!JSON.stringify(logs).includes('synthetic-signature'));
});
