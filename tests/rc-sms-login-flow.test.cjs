const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
function page(extra={}){
 const calls=[],captchas=[];
 const deps={uni:{showToast(){}},uniCloud:{importObject:()=>({createCaptcha:async p=>{captchas.push(p);return{captchaBase64:'image'}}})},
 getAuthCapabilities:()=>({smsLogin:{available:false,callable:true},appleLogin:{status:'UNSUPPORTED_PLATFORM'}}),getAppLocale:()=> 'zh-Hans',
 normalizeCaptchaSource:s=>s,writeSafeCaptchaLog(){},friendlyAuthError:()=> 'friendly',setInterval:()=>1,clearInterval(){},
 sendSmsLoginCode:async (...args)=>{calls.push(args);return{errCode:0}},getSmsSendState:()=>({remaining:0,status:'idle',pending:false}),
 requestSmsLoginCode:async (...args)=>{calls.push(args);return{errCode:0}},...extra};
 const src=fs.readFileSync('pages/auth/login.vue','utf8').match(/<script>([\s\S]*?)<\/script>/)[1].replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g,'').replace('export default','return');
 const p=Function(...Object.keys(deps),src)(...Object.values(deps));const vm=Object.assign(p.data(),p.methods,{smsReady:true});
 return{p,vm,calls,captchas};
}
test('SMS is the primary mode; sending requires consent and the official send captcha',async()=>{
 const s=page();assert.equal(s.p.computed.smsReady.call(s.vm),true);assert.equal(s.vm.mode,'sms');s.vm.mobile='13800000000';
 await s.vm.sendCode();assert.equal(s.calls.length,0,'no send before agreement');
 s.vm.agreed=true;await s.vm.sendCode();assert.equal(s.calls.length,0,'no send before captcha');
 s.vm.smsCaptcha='abcd';await s.vm.sendCode();assert.deepEqual(s.calls,[['13800000000',{captcha:'abcd'}]]);
 assert.ok(s.captchas.every(p=>p.scene==='send-sms-code'));
});

test('complete phone auto-loads one challenge without sending SMS; incomplete and duplicate input do not load', async () => {
 const s=page();
 await s.vm.onMobileChanged({detail:{value:'1380000000'}});assert.equal(s.captchas.length,0);
 await s.vm.onMobileChanged({detail:{value:'13800000000'}});assert.equal(s.captchas.length,1);
 await s.vm.onMobileChanged({detail:{value:'13800000000'}});assert.equal(s.captchas.length,1);
 assert.equal(s.vm.smsCaptchaSrc,'image');assert.equal(s.calls.length,0);
});

test('send keeps captcha and typed answer, prevents consumed reuse, and manual refresh clears only on success', async () => {
 const s=page();Object.assign(s.vm,{mobile:'13800000000',agreed:true,smsCaptcha:'abcd',smsCaptchaSrc:'original'});
 await s.vm.sendCode();assert.equal(s.vm.smsCaptcha,'abcd');assert.equal(s.vm.smsCaptchaSrc,'original');assert.equal(s.vm.smsCaptchaUsed,true);
 await s.vm.sendCode();assert.equal(s.calls.length,1);
 await s.vm.loadSmsCaptcha();assert.equal(s.vm.smsCaptcha,'');assert.equal(s.vm.smsCaptchaUsed,false);assert.equal(s.vm.smsCaptchaSrc,'image');
});

test('captcha rejection and refresh failure keep visible content with explicit retry feedback', async () => {
 const s=page({requestSmsLoginCode:async()=>{throw {errCode:'uni-id-captcha-error'};},
 uniCloud:{importObject:()=>({createCaptcha:async()=>{throw Error('offline');}})}});
 Object.assign(s.vm,{mobile:'13800000000',agreed:true,smsCaptcha:'wrong',smsCaptchaSrc:'original'});
 await s.vm.sendCode();assert.match(s.vm.smsCaptchaError,/换一张/);assert.equal(s.vm.smsCaptcha,'wrong');assert.equal(s.vm.smsCaptchaSrc,'original');
 await s.vm.loadSmsCaptcha();assert.equal(s.vm.smsCaptchaSrc,'original');assert.equal(s.vm.smsCaptcha,'wrong');assert.equal(s.vm.smsCaptchaLoading,false);
});

test('changing phone invalidates the old captcha request and SMS code without leaking a stale accepted status', async () => {
 const pending=[];const s=page({uniCloud:{importObject:()=>({createCaptcha:()=>new Promise(resolve=>pending.push(resolve))})}});
 const first=s.vm.onMobileChanged({detail:{value:'13800000000'}});
 s.vm.smsCode='123456';s.vm.smsStatus='accepted';s.vm.lastSmsMobile='13800000000';
 const second=s.vm.onMobileChanged({detail:{value:'13900000000'}});
 pending[1]({captchaBase64:'new'});await second;pending[0]({captchaBase64:'old'});await first;
 assert.equal(s.vm.smsCaptchaSrc,'new');assert.equal(s.vm.smsCode,'');assert.equal(s.p.computed.smsStatusText.call(s.vm),'');
});
test('SMS login challenge uses login-by-sms and forwards its own captcha rather than the send captcha',async()=>{
 const logins=[];const s=page({beginAuthAttempt:()=>1,loginWithSms:async (...args)=>logins.push(args),successHaptic(){}});
 Object.assign(s.vm,{mode:'sms',mobile:'13800000000',smsCode:'943718',agreed:true,needCaptcha:true,captcha:'login',smsCaptcha:'send',navigateAfterLogin(){}});
 await s.vm.loadCaptcha();assert.equal(s.captchas[0].scene,'login-by-sms');s.vm.captcha='login';
 await s.vm.submitLogin();assert.equal(logins[0][2].captcha,'login');
});
test('foreground countdown reads the deadline rather than decrementing paused interval ticks',()=>{
 const s=page({getSmsSendState:()=>({remaining:17,status:'unknown',pending:false})});
 s.vm.countdown=60;s.p.onShow.call(s.vm);assert.equal(s.vm.countdown,17);assert.equal(s.vm.smsStatus,'unknown');
});
test('old captcha response cannot replace a newer challenge after changing login mode',async()=>{
 const pending=[];const s=page({uniCloud:{importObject:()=>({createCaptcha:p=>new Promise(resolve=>pending.push({p,resolve}))})}});
 s.vm.mode='password';const old=s.vm.loadCaptcha();s.vm.setMode('sms');s.vm.needCaptcha=true;const fresh=s.vm.loadCaptcha();
 pending[1].resolve({captchaBase64:'new'});await fresh;pending[0].resolve({captchaBase64:'old'});await old;assert.equal(s.vm.captchaSrc,'new');
});

test('guest cancellation invalidates the login immediately, before unload or delayed navigation',async()=>{
 let resolve,cancelled=0,navigated=0;const s=page({beginAuthAttempt:()=>9,cancelPendingAuth:a=>{assert.equal(a,9);cancelled++},
 loginWithSms:()=>new Promise(r=>resolve=r),successHaptic(){},uni:{showToast(){},navigateBack(){}}});
 Object.assign(s.vm,{agreed:true,mobile:'13800000000',smsCode:'943718',navigateAfterLogin(){navigated++}});
 const work=s.vm.submitLogin();s.vm.continueAsGuest();assert.equal(cancelled,1);resolve({});await work;assert.equal(navigated,0);
});
test('a late send acknowledgement after unload cannot create a new page interval or message',async()=>{
 let resolve,timers=0;const s=page({requestSmsLoginCode:()=>new Promise(r=>resolve=r),setInterval:()=>timers++});
 Object.assign(s.vm,{agreed:true,mobile:'13800000000',smsCaptcha:'abcd'});const work=s.vm.sendCode();s.p.onUnload.call(s.vm);resolve({errCode:0});await work;
 assert.equal(timers,0);assert.equal(s.vm.smsCaptcha,'');
});
test('a hidden login page does not restart its interval when a send completes',async()=>{
 let resolve,timers=0;const s=page({requestSmsLoginCode:()=>new Promise(r=>resolve=r),setInterval:()=>timers++});
 Object.assign(s.vm,{agreed:true,mobile:'13800000000',smsCaptcha:'abcd'});const work=s.vm.sendCode();s.p.onHide.call(s.vm);resolve({errCode:0});await work;
 assert.equal(timers,0);s.p.onShow.call(s.vm);assert.equal(timers,1);
});
test('default successful login skips duplicate auth pages instead of returning to another login screen',()=>{
 let back;const s=page({getCurrentPages:()=>[{route:'pages/settings/settings'},{route:'pages/auth/login'},{route:'pages/auth/login'}],
 normalizeAuthRedirect:route=>route==='/pages/settings/settings'?route:'',uni:{navigateBack:o=>back=o}});
 s.vm.navigateAfterLogin();assert.equal(back.delta,2);
});

test('registration captcha ignores out-of-order and post-unload results; returning to login reuses the existing page',async()=>{
 const pending=[];let back=0,toasts=0;
 const deps={uni:{showToast:()=>toasts++,navigateBack:()=>back++},uniCloud:{importObject:()=>({createCaptcha:()=>new Promise((resolve,reject)=>pending.push({resolve,reject}))})},
 normalizeCaptchaSource:s=>s,writeSafeCaptchaLog(){},getCurrentPages:()=>[{route:'pages/auth/login'},{route:'pages/auth/register'}]};
 const src=fs.readFileSync('pages/auth/register.vue','utf8').match(/<script>([\s\S]*?)<\/script>/)[1].replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g,'').replace('export default','return');
 const p=Function(...Object.keys(deps),src)(...Object.values(deps)),vm=Object.assign(p.data(),p.methods);
 const old=vm.loadCaptcha(),fresh=vm.loadCaptcha();pending[1].resolve({captchaBase64:'new'});await fresh;pending[0].resolve({captchaBase64:'old'});await old;assert.equal(vm.captchaSrc,'new');
 vm.goLogin();assert.equal(back,1);const late=vm.loadCaptcha();p.onUnload.call(vm);pending[2].reject(Error('offline'));await late;assert.equal(toasts,0);
});
