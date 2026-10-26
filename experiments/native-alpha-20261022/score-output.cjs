'use strict';
const {fs,path,writeJson}=require('./lib.cjs');
const read=f=>JSON.parse(fs.readFileSync(path.join(__dirname,f),'utf8'));
const review=read('sample-review-data.json');
const ownerPath=path.join(__dirname,'evidence/owner-review.json');
const owner=fs.existsSync(ownerPath)?read('evidence/owner-review.json'):null;
for(const [id,r] of Object.entries(review.samples)){
 const dir=path.join(__dirname,'outputs',id);
 if(!fs.existsSync(path.join(dir,'provider-original.png')))continue;
 const provenance=read('outputs/'+id+'/provenance-check.json');
 const alpha=read('outputs/'+id+'/alpha.json');
 const ownerRejected=owner&&owner.verdict==='REJECT_BOTH'&&owner.reviewedSampleIds.includes(id);
 writeJson(path.join(dir,'score.json'),{sampleId:id,reviewedAt:new Date().toISOString(),reviewer:review.reviewer,scoringMethod:review.method,
  status:'PRELIMINARY_VISUAL_REVIEW_NOT_PRODUCTION_ACCEPTANCE',
  nativeServiceOriginalVerified:provenance.serviceOriginalProvenancePassed,pixelAlphaPassed:alpha.pixelTransparencyPassed,
  strictAllZeroBackgroundPassed:alpha.outsideAlpha8BoundingBox.strictAllZero,
  identityScoreOutOf45:r.identity,soft3dStyleScoreOutOf25:r.style,anatomyAndCompletenessOutOf20:r.anatomy,crossBackgroundEdgesOutOf10:r.edges,
  totalOutOf100:r.identity+r.style+r.anatomy+r.edges,
  samePetWanBaselineAvailable:false,ownerRecognition:ownerRejected?'REJECTED_BY_OWNER':'NOT_OWNER_ACCEPTED',ownerFeedback:ownerRejected?owner.answer:null,ownerReason:ownerRejected?owner.reasonDirectQuote:null,criticalIdentityMismatch:r.criticalIdentityMismatch===true,
  observations:r.notes,sharedLimitations:['主体外有低Alpha残留，未修改原透明度。','没有酱酱同宠旧Wan图，不能证明达到旧版身份和风格标准。','数字评分为单次主观观察，须由主人辨认，不能视作统计准确率。'],
  decision:ownerRejected?'REJECT_OWNER_QUALITY':r.criticalIdentityMismatch?'REJECT_IDENTITY_BLACK_PAW_CHANGED_TO_WHITE':'HOLD_NO_PRODUCTION_MODEL_REPLACEMENT',evidenceReferences:['provider-original.png','alpha.json','provenance-check.json','display-white.png','display-black.png','display-guizhuaWarm.png']});
}
console.log(JSON.stringify({reviewed:Object.keys(review.samples).length,status:owner?'OWNER_REJECTED_BOTH_CANDIDATES':'PRELIMINARY_OWNER_ACCEPTANCE_PENDING'}));
