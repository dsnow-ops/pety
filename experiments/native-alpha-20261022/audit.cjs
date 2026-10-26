'use strict';
const {fs,path,ROOT,sha,writeJson,readImage,inspect,composites,configPresence}=require('./lib.cjs');
const base=__dirname;
const files=[
 'uniCloud-alipay/cloudfunctions/api_pet_avatar/index.js','uniCloud-alipay/cloudfunctions/api_pet_avatar/wan-client.js',
 'uniCloud-alipay/cloudfunctions/api_pet_avatar/avatar-prompt.js','uniCloud-alipay/cloudfunctions/api_pet_avatar/avatar-composition-contract.js',
 'uniCloud-alipay/cloudfunctions/api_pet_avatar/avatar-revision-prompt.js','uniCloud-alipay/cloudfunctions/api_pet_avatar/storage.js',
 'uniCloud-alipay/cloudfunctions/api_pet_avatar/avatar-display-derivatives.js','uniCloud-alipay/cloudfunctions/api_pet_avatar/avatar-cutout-provider.js',
 'uniCloud-alipay/cloudfunctions/api_pet_avatar/hero-character-prompt.js','uniCloud-alipay/cloudfunctions/api_pet_avatar/hero-edge-quality.js',
 'components/PetAvatarHero.vue','components/PetPortraitStage.vue','common/home-hero-asset.js',
 'common/avatar-display-asset.js','common/pet-avatar-generator.js','pages/home/home.vue','AGENTS.md'
];
const entries=files.map(relative=>{
 const bytes=fs.readFileSync(path.join(ROOT,relative));
 const dst=path.join(base,'baseline/source',relative);
 fs.mkdirSync(path.dirname(dst),{recursive:true});
 if(!fs.existsSync(dst))fs.writeFileSync(dst,bytes,{flag:'wx'});
 if(sha(fs.readFileSync(dst))!==sha(bytes))throw new Error('SNAPSHOT_SOURCE_CHANGED: '+relative);
 return {path:relative,sha256:sha(bytes),bytes:bytes.length};
});
writeJson(path.join(base,'baseline/source-manifest.json'),{capturedAt:new Date().toISOString(),files:entries});
const {buildAvatarPrompt}=require(path.join(ROOT,files[2]));
const {applyCompositionContract}=require(path.join(ROOT,files[3]));
const prompt=buildAvatarPrompt(1),full=applyCompositionContract(prompt,'initial');
fs.writeFileSync(path.join(base,'baseline/prompt-base.txt'),prompt);
fs.writeFileSync(path.join(base,'baseline/prompt-with-composition.txt'),full);
const record=JSON.parse(fs.readFileSync(path.join(ROOT,'unpackage/hero-e2e/cloud-record-final.json'),'utf8'));
const safeKeys=['jobKind','seed','sourceCount','providerInputCount','compositionVersion','requestedSize','promptVersion','provider','model','providerSize','providerN','providerWatermark','createdAt','generatedCandidateSha256','styleReferenceSha256','confirmed'];
const historical=Object.fromEntries(safeKeys.filter(k=>record[k]!==undefined).map(k=>[k,record[k]]));
const original=fs.readFileSync(path.join(ROOT,'unpackage/hero-e2e/master.png'));
const masterDest=path.join(base,'baseline/assets/historical-wan-master.png');
fs.mkdirSync(path.dirname(masterDest),{recursive:true});
if(!fs.existsSync(masterDest))fs.writeFileSync(masterDest,original,{flag:'wx'});
historical.masterHashMatchesArchivedJob=sha(original)===record.generatedCandidateSha256;
historical.masterInspection=inspect(original);
historical.basePromptSha256=sha(Buffer.from(prompt));
historical.reconstructedFullPromptSha256=sha(Buffer.from(full));
historical.promptReconstruction='CURRENT_SOURCE_RECONSTRUCTION_NOT_ORIGINAL_REQUEST_RECEIPT';
historical.approval='CONFIRMED_JOB_FOUND; EXPLICIT_SATISFACTION_NOT_IN_THIS_RECORD';
historical.reproducibilityGaps=['Original historical style image bytes not yet located','Historical raw request not archived here','Original uploaded source byte binding not independently verified','Gray-white historical cat differs from current Jiangjiang calico inputs'];
writeJson(path.join(base,'baseline/historical-provenance.json'),historical);
writeJson(path.join(base,'evidence/config-presence.json'),configPresence());
writeJson(path.join(base,'evidence/baseline-alpha.json'),inspect(original));
composites(original,path.join(base,'baseline/assets'),'historical-wan-master');
const src=process.argv[2];
if(src){
 const names=fs.readdirSync(src).filter(n=>/\.(png|jpe?g)$/i.test(n)).sort();
 const inputDir=path.join(base,'inputs/jiangjiang');fs.mkdirSync(inputDir,{recursive:true});
 const inputs=names.map((name,i)=>{
  const bytes=fs.readFileSync(path.join(src,name)),im=readImage(bytes);
  const target=path.join(inputDir,String(i+1).padStart(2,'0')+path.extname(name).toLowerCase());
  if(!fs.existsSync(target))fs.writeFileSync(target,bytes,{flag:'wx'});
  if(sha(fs.readFileSync(target))!==sha(bytes))throw new Error('INPUT_COPY_HASH_MISMATCH');
  return {id:'jiangjiang-'+String(i+1).padStart(2,'0'),originalName:name,file:path.relative(base,target).replaceAll('\\','/'),sha256:sha(bytes),bytes:bytes.length,width:im.width,height:im.height,mime:im.mime,role:'identity',visualReview:'PENDING'};
 });
 writeJson(path.join(base,'inputs/manifest.json'),{sourceDirectory:src,pet:'酱酱',inputs,sourceCount:inputs.length,duplicates:inputs.length-new Set(inputs.map(x=>x.sha256)).size});
}
console.log(JSON.stringify({sourceFilesFrozen:entries.length,historicalMasterHashMatched:historical.masterHashMatchesArchivedJob,config:configPresence(),inputManifestCreated:Boolean(src),generationCalls:0}));
