'use strict';
const {fs,path,writeJson}=require('./lib.cjs');
(async()=>{
 const html=fs.readFileSync(path.join(__dirname,'report.html'),'utf8');
 const refs=[...html.matchAll(/(?:href|src)="([^"]+)"/g)].map(m=>m[1]).filter(v=>!/^https?:/.test(v));
 const rows=[];
 for(const ref of new Set(refs)){const r=await fetch('http://127.0.0.1:5076/'+ref);rows.push({ref,status:r.status});}
 for(const ref of ['private/account-attestation.json','inputs/%2e%2e%2fprivate/account-attestation.json','baseline/source/AGENTS.md']){
  const r=await fetch('http://127.0.0.1:5076/'+ref);rows.push({ref,status:r.status,expected:404});
 }
 const passed=rows.every(x=>x.expected?x.status===x.expected:x.status===200);
 writeJson(path.join(__dirname,'evidence/report-link-check.json'),{checkedAt:new Date().toISOString(),passed,checks:rows});
 console.log(JSON.stringify({passed,checks:rows.length}));if(!passed)process.exitCode=1;
})().catch(()=>{console.error('LOCAL_REPORT_VERIFICATION_FAILED');process.exitCode=1;});
