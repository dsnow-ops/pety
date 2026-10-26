'use strict';
// Read-only evidence audit; writes only its own fresh report. No service calls.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const base='docs/overnight-20261023',file=base+'/FINAL-AUDIT.json';
if(fs.existsSync(file))throw Error('Preserve existing audit');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const manifest=read(base+'/CHANGE-MANIFEST.json'),local=read(manifest.testsEvidence),tap=fs.readFileSync(base+'/local-49/tests.tap','utf8');
const sources=[...manifest.files,...manifest.addedFiles];
for(const r of sources){assert.equal(sha(r.file),r.currentSha256,r.file);if(r.before)assert.equal(sha(r.before),r.beforeSha256,r.before);assert.ok(fs.statSync(r.file).mtimeMs<=Date.parse(local.startedAt),'Source changed after local suite: '+r.file);}
assert.equal(sha(manifest.additionalSchema),manifest.schemaSha256);
for(const [key,value]of [['tests',537],['pass',537],['fail',0],['skipped',0]])assert.equal(Number(new RegExp('^# '+key+' (\\d+)$','m').exec(tap)?.[1]),value);
assert.equal(local.exitCode,0);assert.equal(local.passed,537);
const home=read(base+'/baseline/home-hashes.json').map(r=>({file:path.relative(process.cwd(),r.Path).replaceAll('\\','/'),sha256:sha(r.Path),unchanged:sha(r.Path).toUpperCase()===r.Hash}));assert.ok(home.every(r=>r.unchanged));
const labels=['records','care','photos','retention-2','read-errors','composition','work-save','record-delete','daily-conflict','draft-conflict','care-drafts','pet-removal','archive','settings','album-pages','insights','pet-storage','feedback'];
const h5=labels.map(label=>{const dir=base+'/acceptance-'+label,r=read(dir+'/results.json');assert.equal(r.failure,undefined,label);assert.deepEqual(r.errors,[],label);assert.ok(r.checks.length>0,label);assert.ok(Date.parse(r.at)>Date.parse('2026-10-23T03:43:00Z'));for(const image of r.screenshots)assert.ok(fs.existsSync(dir+'/'+image),image);return {label,build:'round-51',evidence:dir+'/results.json',sha256:sha(dir+'/results.json'),checks:r.checks.length,screenshots:r.screenshots.length};});
const root='unpackage/overnight-20261023/round-51/h5';
function inventory(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(r=>r.isDirectory()?inventory(path.join(dir,r.name)):[path.join(dir,r.name)]);}
const buildFiles=inventory(root).sort().map(p=>({file:path.relative(root,p).replaceAll('\\','/'),sha256:sha(p)}));
const models=read('experiments/native-alpha-20261023/summary.json'),modelRoot='experiments/native-alpha-20261023/outputs';
const samples=fs.readdirSync(modelRoot,{withFileTypes:true}).filter(x=>x.isDirectory()).map(x=>{const p=modelRoot+'/'+x.name,r=read(p+'/review.json');assert.equal(sha(p+'/provider-original.png'),r.originalSha256,x.name);assert.equal(r.reviewed,true);assert.ok(fs.existsSync(p+'/receipt.json'));assert.ok(fs.existsSync(p+'/alpha.json'));return {id:x.name,originalSha256:r.originalSha256,verdict:r.verdict};});
assert.equal(samples.length,models.sampleCount);assert.equal(models.totalIncludingPreviousFen,275);assert.ok(models.totalIncludingPreviousFen<=models.capFen);assert.equal(models.actualBill,null);assert.equal(models.nativeVideoGenerated,false);
assert.equal(fs.existsSync(modelRoot+'/pro-identity-v6-01'),false);
const modelQA=read(base+'/acceptance-model-report/results.json');assert.equal(modelQA.sampleCards,6);assert.equal(modelQA.imagesLoaded,true);assert.equal(modelQA.mobileNoOverflow,true);assert.deepEqual(modelQA.errors,[]);
const diff=spawnSync('git',['diff','--check','--',...sources.map(r=>r.file),manifest.additionalSchema],{encoding:'utf8',maxBuffer:1024*1024});assert.equal(diff.status,0,diff.stdout+diff.stderr);
const result={at:new Date().toISOString(),scope:'Local source and evidence integrity only; no cloud, real device or production certification',sourcePairs:manifest.files.length,addedSourceFiles:manifest.addedFiles.length,schema:manifest.additionalSchema,manifestSha256:sha(base+'/CHANGE-MANIFEST.json'),sourceFingerprintsMatched:true,sourceFilesUnchangedSinceLocalSuite:true,local:{evidence:manifest.testsEvidence,tapSha256:sha(base+'/local-49/tests.tap'),tests:537,passed:537,failed:0},home,h5:{build:root,fileCount:buildFiles.length,inventorySha256:crypto.createHash('sha256').update(JSON.stringify(buildFiles)).digest('hex'),suites:h5,checkGroups:h5.reduce((n,r)=>n+r.checks,0),screenshots:h5.reduce((n,r)=>n+r.screenshots,0),initialFailure:{evidence:base+'/acceptance-retention/results.json',cause:'Old test expected load-more; current history uses pagination. Script updated to verify all 125 unique rows through five real pages; application source unchanged.'}},models:{...models,samples,reportQA:base+'/acceptance-model-report/results.json',v6:'BLOCKED_BEFORE_SUBMISSION'},diffCheck:'passed for manifest tracked source paths',productionDeployed:false,cloudVerified:false,androidEmulatorVerified:false,androidDeviceVerified:false,formalSignedPackageVerified:false};
fs.writeFileSync(file,JSON.stringify(result,null,2));console.log(JSON.stringify({file,sourcePairs:result.sourcePairs,addedSourceFiles:result.addedSourceFiles,h5Suites:h5.length,checkGroups:result.h5.checkGroups,screenshots:result.h5.screenshots,models:samples.length}));
