// Presence only. No credentials, mobile numbers, token values or signed URLs leave this script.
const fs=require('node:fs');
const {inspectSmsReadiness}=require('./lib/sms-readiness.cjs');
const file='uniCloud-alipay/cloudfunctions/common/uni-config-center/uni-id/config.json';
const raw=JSON.parse(fs.readFileSync(file,'utf8'));const configs=Array.isArray(raw)?raw:[raw];
const present=x=>Boolean(x&&(typeof x!=='string'||x.trim()));
const rows=configs.map(c=>({appConfigured:present(c.dcloudAppid),tokenSecret:present(c.tokenSecret),passwordSecret:present(c.passwordSecret),sms: {configured:!!c.service?.sms,legacyKey:present(c.service?.sms?.smsKey),legacySecret:present(c.service?.sms?.smsSecret),scenes:Object.fromEntries(Object.entries(c.service?.sms?.scene||{}).map(([k,v])=>[k,{templateConfigured:present(v.templateId),officialTestTemplate:v.templateId==='uni_sms_test'}]))},univerify:present(c.service?.univerify),oauthProviders:Object.keys(c.oauth||{})}));
const versions=Object.fromEntries(['uni-id-pages','uni-id-common','uni-captcha','uni-config-center','uni-pay'].map(n=>{const p=`uni_modules/${n}/package.json`;return[n,fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf8')).version:'NOT_INSTALLED']}));
const manifest=fs.readFileSync('manifest.json','utf8');
const info={localOnly:true,configs:rows,versions,appid:manifest.match(/"appid"\s*:\s*"([^"]+)"/)?.[1],cloudMode:JSON.parse(fs.readFileSync('.hbuilderx/launch.json','utf8')).configurations.find(c=>c.type==='uniCloud')};
info.smsReadiness=configs.map(inspectSmsReadiness);
fs.writeFileSync('unpackage/rc-20260921/preflight-presence.json',JSON.stringify(info,null,2));console.log(JSON.stringify(info,null,2));
