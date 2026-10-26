const fs=require('node:fs');
function edit(file,fn){let s=fs.readFileSync(file,'utf8');const r=(a,b)=>{if(!s.includes(a))throw Error(file+': '+a);s=s.replace(a,b)};fn(r);fs.writeFileSync(file,s)}
edit('scripts/verify-overnight-local.cjs',r=>r("['request-diagnostics',","['care-drafts','request-diagnostics',"));
edit('scripts/snapshot-overnight-changes.cjs',r=>r('local-6/results.json','local-7/results.json'));
edit('docs/overnight-20261023/DELIVERY.md',r=>{
 r('原生透明模型新增5张对照','原生透明模型新增6张对照');r('新增保守预留1.10元，连同旧实验共2.50/20元','新增保守预留1.35元，连同旧实验共2.75/20元');
 r('[model-report-qa-1/results.json](model-report-qa-1/results.json) | 5张原始图片加载','[model-report-qa-2/results.json](model-report-qa-2/results.json) | 6张原始图片加载');
 r('5次真实图片请求','6次真实图片请求');
});
