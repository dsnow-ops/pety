'use strict';
// Read-only cloud entry checks with synthetic claims. Never obtains a real token.
const fs=require('node:fs'),path=require('node:path');
const base=path.resolve('unpackage/release-sprint-20261013');
const cfg=JSON.parse(fs.readFileSync(path.join(base,'cloud-private/client-app-init.json')))[0];
if(cfg.provider!=='alipay'||cfg.spaceId!=='env-00jy6ft635sf')throw Error('Wrong environment');
const claims={uid:'pety-release-claimed-user-not-created',userId:'pety-release-claimed-user-not-created',ownerId:'pety-release-claimed-user-not-created',role:'admin',isMember:true,plan:'pro',dev:true,env:'development'};
const cases=['user_get_profile','membership_get'].flatMap(name=>[{name,data:{...claims},kind:'anonymous-claims'},{name,data:{...claims,uniIdToken:'invalid-release-probe-not-a-credential'},kind:'invalid-token'}]);
const report={createdAt:new Date().toISOString(),spaceId:cfg.spaceId,requests:0,responseBytes:0,realTokensUsed:0,providerCallsRequested:0,paymentCallsRequested:0,results:[],limits:'Two read-only function entrypoints. Synthetic claims and invalid token only; no normal A/B login, mutations or strict-session acceptance.'};
let current;
global.uni={getStorageSync:()=>undefined,setStorageSync(){},removeStorageSync(){},getSystemInfoSync:()=>({platform:'web',uniPlatform:'web',appId:'__UNI__A23A379'}),getLocale:()=> 'zh-Hans',request(options){
 (async()=>{const u=new URL(options.url),body=JSON.parse(options.data);const {clientInfo,...business}=body;
 if(process.argv.includes('--validate-only')||report.requests>=4||u.protocol!=='https:'||u.hostname!==`${cfg.spaceId}.api-hz.cloudbasefunction.cn`||u.pathname!=='/functions/invokeFunction'||options.method!=='POST'||options.header['x-to-function-name']!==current.name||JSON.stringify(business)!==JSON.stringify(current.data)||/cookie/i.test(JSON.stringify(options.header)))throw Error('Request outside allowlist');
 report.requests++;const response=await fetch(u,{method:'POST',headers:options.header,body:options.data,credentials:'omit',redirect:'error',signal:AbortSignal.timeout(15000)});const parts=[];let size=0;for await(const p of response.body){size+=p.length;report.responseBytes+=p.length;if(size>65536)throw Error('Body limit');parts.push(p);}options.complete({statusCode:response.status,data:JSON.parse(Buffer.concat(parts).toString()),header:Object.fromEntries(response.headers)});
 })().catch(()=>options.complete({statusCode:0,data:{message:'Transport blocked or failed'}}));return{abort(){}};
},uploadFile(){throw Error('Upload disabled');},connectSocket(){throw Error('Socket disabled');}};
process.env.NODE_ENV='production';process.env.UNI_PLATFORM='h5';process.env.UNI_CLOUD_PROVIDER='[]';process.env.UNI_APP_ID='__UNI__A23A379';delete process.env.RUN_BY_HBUILDERX;
(async()=>{const sdk=require('D:/HBuilderX/plugins/uniapp-cli-vite/node_modules/@dcloudio/uni-cloud/dist/uni-cloud.cjs.js');const client=(sdk.uniCloud||sdk.default).init(cfg);
 if(process.argv.includes('--validate-only')){console.log(JSON.stringify({sdkLoaded:true,cases:cases.map(x=>({name:x.name,kind:x.kind})),requests:0}));return;}
 for(const item of cases){current=item;const row={name:item.name,kind:item.kind};try{const {result}=await client.callFunction({name:item.name,data:item.data});row.errorCode=result?.errCode??null;row.loggedIn=result?.loggedIn??null;row.plan=result?.plan??null;row.privateIdentityReturned=Boolean(result?.userId||result?.uid||result?.nickname||result?.avatar);row.pass=item.kind==='anonymous-claims'?result?.loggedIn===false&&result?.plan==='free'&&!row.privateIdentityReturned:/^uni-id-(check-token-failed|token-expired)$/.test(String(result?.errCode));}catch(error){row.errorCode=String(error.errCode||error.code||'UNKNOWN').slice(0,100);row.pass=false;}report.results.push(row);}
 report.pass=report.results.length===4&&report.results.every(x=>x.pass);const output=path.join(base,`account-entry-auth-${Date.now()}.json`);fs.writeFileSync(output,JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify({output,...report}));
})().catch(()=>{console.error('Probe initialization failed');process.exitCode=1;});
