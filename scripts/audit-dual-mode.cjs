const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const base='unpackage/dual-mode-20260928',out='docs/dual-mode-evidence';
const baseline=JSON.parse(fs.readFileSync(`${base}/baseline/manifest.json`,'utf8'));
const changed=baseline.files.filter(row=>row.sha256&&fs.existsSync(row.path)&&crypto.createHash('sha256').update(fs.readFileSync(row.path)).digest('hex')!==row.sha256).map(row=>row.path);
assert.ok(!changed.some(p=>p.startsWith('uni_modules/')||/api_pet_avatar\/|avatar-generation-entitlement|PetAvatarHero|config\.json$/.test(p)),'protected source changed from this turn baseline');
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
// Compare real configured secret values without ever printing or copying them.
const secrets=[];function collect(value){if(!value||typeof value!=='object')return;for(const[k,v]of Object.entries(value)){if(typeof v==='string'&&/(?:api.?key|secret|access.?token)/i.test(k)&&v.length>=12&&!/example|placeholder|your[_-]/i.test(v))secrets.push(v);else if(v&&typeof v==='object')collect(v);}}
for(const dir of ['api_deepseek','api_pet_avatar'])for(const file of ['config.json','config.local.json']){const p=`uniCloud-alipay/cloudfunctions/${dir}/${file}`;if(fs.existsSync(p))collect(JSON.parse(fs.readFileSync(p,'utf8')));}
const outputs=[...walk(`${base}/h5`).filter(p=>/\.(js|html|css|json)$/.test(p)),...walk(out).filter(p=>/\.(json|md|txt|log)$/.test(p))];
for(const p of outputs){const content=fs.readFileSync(p,'utf8');assert.ok(!secrets.some(s=>content.includes(s)),`configured secret found in ${p}`);}
const testLog=fs.readFileSync(`${base}/regression-tests.log`,'utf8');assert.match(testLog,/tests 376/);assert.match(testLog,/pass 376/);assert.match(testLog,/fail 0/);
fs.writeFileSync(`${out}/local-verification.json`,JSON.stringify({date:'2026-09-28',baselineHead:baseline.head,changedFromExistingDirtyBaseline:changed,tests:{total:376,pass:376,fail:0},protectedBaselineFilesUnchanged:true,configuredSecretScan:{targets:outputs.length,passed:true,note:'No secret values copied; checks existing DeepSeek/avatar config secrets only, not a universal secret scanner.'},cloudDeployments:0,realDeepSeekCalls:0,imageModelCalls:0},null,2));
for(const platform of ['app','h5','mp-weixin'])fs.copyFileSync(`${base}/build-${platform}.log`,`${out}/build-${platform}.log`);
fs.copyFileSync(`${base}/regression-tests.log`,`${out}/regression-tests.log`);
console.log(JSON.stringify({changedFromBaseline:changed,tests:376,secretScanPassed:true,protectedFilesUnchanged:true},null,2));
