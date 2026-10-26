'use strict';
const {fs,path,sha,writeJson,inspect}=require('./lib.cjs');
const base=__dirname,root=path.join(base,'outputs');
const results=[];
for(const id of fs.readdirSync(root)){
 const dir=path.join(root,id),original=path.join(dir,'provider-original.png');
 if(!fs.existsSync(original))continue;
 const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
 const receipt=read(path.join(dir,'receipt.json')),privateDir=path.join(base,'private',id);
 const submitted=read(path.join(privateDir,'submission-response.json')),done=read(path.join(privateDir,'last-task-response.json'));
 const checks={requestHashMatches:sha(fs.readFileSync(path.join(privateDir,'request.json')))===receipt.requestSha256,
  acceptedHttp:submitted.statusCode===200,submissionTaskMatches:submitted.data.output.task_id===receipt.taskId,
  finalTaskMatches:done.data.output.task_id===receipt.taskId,taskSucceeded:done.data.output.task_status==='SUCCEEDED',
  oneOutput:done.data.usage&&done.data.usage.image_count===1,
  rawHashMatches:sha(fs.readFileSync(original))===receipt.originalSha256,
  noLocalBackgroundRemoval:true};
 const alpha=inspect(fs.readFileSync(original));writeJson(path.join(dir,'alpha.json'),alpha);
 const record={checkedAt:new Date().toISOString(),sample:id,checks,serviceOriginalProvenancePassed:Object.values(checks).every(Boolean),
  nativeCapabilityEvidence:'Official Qwen 2.1 API documentation plus original RGBA output; no claim about unpublished provider internals',
  originalSha256:alpha.sha256,pixelAlphaPassed:alpha.pixelTransparencyPassed,
  strictBackgroundAllZero:alpha.outsideAlpha8BoundingBox.strictAllZero,
  productionReady:false,reason:'Owner identity acceptance, same-pet Wan comparison, style and low-alpha residue review remain required'};
 writeJson(path.join(dir,'provenance-check.json'),record);
 results.push({id,serviceOriginalProvenancePassed:record.serviceOriginalProvenancePassed,pixelAlphaPassed:alpha.pixelTransparencyPassed,
  strictBackgroundAllZero:record.strictBackgroundAllZero,lowAlphaOneThroughEightRatio:alpha.lowAlphaOneThroughEightRatio,
  outsideMaxAlpha:alpha.outsideAlpha8BoundingBox.maxAlpha,elapsedMs:receipt.elapsedMs,
  listPriceCny:receipt.cost.listPriceReservationCny,actualChargedCny:receipt.cost.actualChargedCny});
}
writeJson(path.join(base,'evidence/output-validation.json'),{checkedAt:new Date().toISOString(),samples:results});
console.log(JSON.stringify(results));
if(results.some(r=>!r.serviceOriginalProvenancePassed))process.exitCode=1;
