'use strict';
const {fs,path,ROOT,sha,writeJson}=require('./lib.cjs');
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'inputs/manifest.json'),'utf8'));
const rows=manifest.inputs.map(i=>({id:i.id,copyMatches:sha(fs.readFileSync(path.join(__dirname,i.file)))===i.sha256,originalUnchanged:sha(fs.readFileSync(path.join(manifest.sourceDirectory,i.originalName)))===i.sha256}));
const snapshots=JSON.parse(fs.readFileSync(path.join(__dirname,'baseline/source-manifest.json'),'utf8')).files.map(i=>({path:i.path,unchanged:sha(fs.readFileSync(path.join(ROOT,i.path)))===i.sha256}));
const config=JSON.parse(fs.readFileSync(path.join(ROOT,'uniCloud-alipay/cloudfunctions/api_pet_avatar/config.json'),'utf8'));
let secretLeaks=0,filesChecked=0;
function walk(dir){for(const name of fs.readdirSync(dir)){const file=path.join(dir,name),s=fs.statSync(file);if(s.isDirectory())walk(file);else if(/\.(json|cjs|txt|html|py|log)$/i.test(file)){filesChecked++;if(config.apiKey&&fs.readFileSync(file).includes(Buffer.from(config.apiKey)))secretLeaks++;}}}
walk(__dirname);
const result={checkedAt:new Date().toISOString(),inputByteChecks:rows,productionByteChecks:snapshots,filesCheckedForActualKey:filesChecked,actualKeyOccurrences:secretLeaks,passed:!secretLeaks&&rows.every(x=>x.copyMatches&&x.originalUnchanged)&&snapshots.every(x=>x.unchanged)};
writeJson(path.join(__dirname,'evidence/integrity-and-secret-check.json'),result);
console.log(JSON.stringify({passed:result.passed,inputs:rows.length,productionFiles:snapshots.length,actualKeyOccurrences:secretLeaks}));
if(!result.passed)process.exitCode=1;
