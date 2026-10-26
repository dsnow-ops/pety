'use strict';
const {fs,path,writeJson}=require('./lib.cjs');
const b=__dirname,read=f=>JSON.parse(fs.readFileSync(path.join(b,f),'utf8'));
const validation=read('evidence/output-validation.json').samples;
const groups=['qwen-image-2.1-pro','qwen-image-2.1-turbo'].map(model=>{
 const samples=validation.filter(s=>s.id.startsWith(model+'-'));
 const scores=samples.map(s=>read('outputs/'+s.id+'/score.json'));
 const list=samples.reduce((n,s)=>n+s.listPriceCny,0);
 return {model,successfulOutputs:samples.length,listPriceCny:list,actualChargeCny:null,freeQuotaUsed:null,
  endToEndMs:samples.map(s=>s.elapsedMs),meanEndToEndSeconds:samples.reduce((n,s)=>n+s.elapsedMs,0)/samples.length/1000,
  nativeRgbaPixelPass:samples.filter(s=>s.pixelAlphaPassed).length,
  strictZeroBackgroundPass:samples.filter(s=>s.strictBackgroundAllZero).length,
  preliminaryIdentityRejected:scores.filter(s=>s.criticalIdentityMismatch).length,
  blackPawPreservedCandidates:scores.filter(s=>!s.criticalIdentityMismatch).map(s=>s.sampleId),
  ownerRejectedCandidates:scores.filter(s=>s.ownerRecognition==='REJECTED_BY_OWNER').map(s=>s.sampleId),
  subjectiveScores:scores.map(s=>({id:s.sampleId,identity:s.identityScoreOutOf45,total:s.totalOutOf100,decision:s.decision})),
  productionAccepted:0,actualCostPerProductionAcceptedImage:null,
  assumedFullPriceCostPerBlackPawPreservedCandidate:list/(scores.filter(s=>!s.criticalIdentityMismatch).length||NaN),
  warning:'Black-paw retention is one necessary criterion, not overall acceptance. N=4; timing is one account/session and includes polling, download and analysis.'};
});
const total=groups.reduce((n,g)=>n+g.listPriceCny,0);
writeJson(path.join(b,'evidence/cost-summary.json'),{checkedAt:new Date().toISOString(),scope:'USER_APPROVED_IMAGE_TRIAL_ONLY',
 submitted:validation.length,successfulOutputs:validation.length,listPriceTotalCny:Number(total.toFixed(2)),authorizedCapCny:1.4,
 actualChargedCny:null,actualBillingStatus:'ACCOUNT_CONSOLE_NOT_READABLE_NO_BILLING_READBACK',
 postRetries:0,videoSubmissions:0,noMoreSubmissionsAuthorizedWithinThisExperiment:validation.length===8,
 pricesSource:'https://help.aliyun.com/zh/model-studio/model-pricing',models:groups});
const research=read('research.json');
research.billingAndExecution.status='USER_APPROVED_EIGHT_IMAGE_TRIAL_SUCCEEDED_ACCOUNT_BILLING_UNVERIFIED';
research.billingAndExecution.actualAccountChargeCny=null;
research.billingAndExecution.listPriceTotalCny=Number(total.toFixed(2));
for(const image of research.images){const g=groups.find(v=>v.model===image.model);if(g)image.actualTrial=g;}
writeJson(path.join(b,'research.json'),research);
console.log(JSON.stringify({outputs:validation.length,listPriceCny:total,actualCharge:'UNVERIFIED',models:groups.map(g=>({model:g.model,meanSeconds:g.meanEndToEndSeconds,strictBackgroundPass:g.strictZeroBackgroundPass,identityRejected:g.preliminaryIdentityRejected}))}));
