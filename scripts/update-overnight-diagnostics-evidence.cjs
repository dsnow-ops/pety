const fs=require('node:fs');
function edit(file,fn){let s=fs.readFileSync(file,'utf8');const r=(a,b)=>{if(!s.includes(a))throw Error(file+': '+a);s=s.replace(a,b)};fn(r);fs.writeFileSync(file,s)}
edit('scripts/verify-overnight-local.cjs',r=>r("['record-storage-integrity',","['request-diagnostics','record-storage-integrity',"));
edit('scripts/snapshot-overnight-changes.cjs',r=>{
 r("additionalSchema:'", "addedFiles:['uniCloud-alipay/cloudfunctions/api_deepseek/request-diagnostics.js'].map(file=>({file,currentSha256:sha(file)})),additionalSchema:'");
 r('local-5/results.json','local-6/results.json');
});
