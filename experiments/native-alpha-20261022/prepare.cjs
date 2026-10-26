'use strict';
const {fs,path,sha,writeJson}=require('./lib.cjs');
const base=__dirname, manifest=JSON.parse(fs.readFileSync(path.join(base,'inputs/manifest.json'),'utf8'));
if(fs.existsSync(path.join(base,'outputs'))&&fs.readdirSync(path.join(base,'outputs')).some(d=>fs.existsSync(path.join(base,'outputs',d,'receipt.json'))))throw new Error('EXPERIMENT_ALREADY_STARTED_PRESERVE_PLAN_AND_PROMPT');
const reviewPath=path.join(base,'evidence/input-review.json');
const review=fs.existsSync(reviewPath)?JSON.parse(fs.readFileSync(reviewPath,'utf8')):null;
const selected=review&&review.selectedIds?review.selectedIds.map(id=>{const item=manifest.inputs.find(x=>x.id===id);if(!item)throw new Error('UNKNOWN_SELECTED_INPUT');return item;}):manifest.inputs;
if(manifest.inputs.length<4 || manifest.inputs.length>6)throw new Error('EXPECTED_4_TO_6_DISTINCT_IDENTITY_PHOTOS');
if(manifest.duplicates)throw new Error('DUPLICATE_IDENTITY_PHOTOS');
const prompt=[
 '根据输入照片生成用户真实宠物“酱酱”的专属长期数字角色。全部输入图片均为同一只真实宠物的身份参考，不是其他宠物的风格模板。',
 '首要目标是让主人一眼认出自己的宠物。保留真实脸型、眼鼻比例、眼睛颜色、耳形、体态、毛长以及黑白橘三色花纹的具体位置和不对称特征。综合各张照片；看不清的特征不要凭空添加。',
 '画风为高质量软3D电子宠物，柔和细腻毛发、自然克制的轻微角色化，保持原宠物身体比例。不要大头Q版、超大眼睛、塑料玩具、二维插画或完全写实摄影。',
 '仅一只宠物，标准自然坐姿，正面偏轻微3/4，脸朝向用户；全身完整，保留耳尖、胡须、四肢脚爪和尾巴。2048×2048方形画幅，主体最长边约70%，四周至少12%留白。照片只定义身份，不继承照片中的动作或背景。',
 '必须由模型直接生成真实RGBA透明背景，主体之外透明度为0，毛发边缘有自然连续透明度。This is an RGBA image with a genuine alpha channel and transparent background.',
 '没有地面、棚拍背景、接地阴影、白底、灰底、棋盘格图案、场景、项圈、饰品、道具、文字、水印或其他动物。不要把透明棋盘格画进图片。'
].join('\n\n');
fs.mkdirSync(path.join(base,'prompts'),{recursive:true});
fs.writeFileSync(path.join(base,'prompts/native-character-v1.txt'),prompt);
const plan={
 schemaVersion:1,createdAt:new Date().toISOString(),pet:'酱酱',stage:'FIRST_NATIVE_ALPHA_COMPARISON',
 productionChange:false,postGenerationBackgroundRemoval:false,referenceManifestSha256:sha(Buffer.from(JSON.stringify(manifest))),
 identityFiles:selected.map(x=>({file:x.file,sha256:x.sha256,role:'identity'})),
 styleReference:{mode:'text-only',reason:'Original official style-reference bytes and a same-pet approved Wan master have not been found; do not borrow another cats identity',baseline:'baseline/assets/historical-wan-master.png',baselineUse:'CROSS_PET_STYLE_ONLY_NOT_SAME_PET_IDENTITY_BASELINE'},
 promptFile:'prompts/native-character-v1.txt',promptSha256:sha(Buffer.from(prompt)),
 models:['qwen-image-2.1-pro','qwen-image-2.1-turbo'],samplesPerModel:4,seeds:[1733695647,1733695648,1733695649,1733695650],
 parameters:{size:'2048*2048',n:1,watermark:false,prompt_extend:false},
 endpointPath:'/api/v1/services/aigc/image-generation/generation',region:'cn-beijing',
 transport:{mode:'async',requestTimeoutMs:45000,pollEveryMs:10000,maxPollMs:1200000,maxConcurrentSubmissions:1,postRetries:0},
 costs:{currency:'CNY',listPricePerOutput:{'qwen-image-2.1-pro':.25,'qwen-image-2.1-turbo':.1},maxOutputs:8,maxListPriceCny:1.4,paidBudgetCny:0},
 limitations:['Not yet a same-pet old-vs-new comparison','Fixed seeds do not align latent samples between different models','Pixel transparency alone cannot prove model-native generation'],
 status:'PREPARED_NOT_SUBMITTED'
};
writeJson(path.join(base,'plan.json'),plan);
writeJson(path.join(base,'account-attestation.template.json'),{
 status:'UNVERIFIED_TEMPLATE_DO_NOT_RENAME_WITHOUT_EVIDENCE',verifiedAt:null,region:'cn-beijing',workspaceSha256:null,
 evidenceFile:null,evidenceSha256:null,source:'OWNER_OR_CONSOLE_VERIFIED',
 models:{'qwen-image-2.1-pro':{enabled:null,remainingFreeImages:null,freeTierOnly:null,expiresAt:null},'qwen-image-2.1-turbo':{enabled:null,remainingFreeImages:null,freeTierOnly:null,expiresAt:null}}
});
console.log(JSON.stringify({prepared:true,photos:selected.length,outputsPlanned:8,paidBudgetCny:0,maxListPriceCny:1.4,generationCalls:0}));
