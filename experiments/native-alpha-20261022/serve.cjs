'use strict';
const http=require('node:http');
const {fs,path,inside}=require('./lib.cjs');
const allowed=new Set(['report.html','status.json','research.json','plan.json','style-control-plan.json','scorecard.template.json','baseline/prompt-base.txt','baseline/prompt-with-composition.txt','baseline/historical-provenance.json','baseline/source-manifest.json']);
for(const name of ['model-comparison-warm.jpg','background-qa-pro.jpg','background-qa-turbo.jpg','output-validation.json','cost-summary.json'])allowed.add('evidence/'+name);
http.createServer((req,res)=>{
 let rel;try{rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,'')||'report.html';}catch{res.writeHead(400).end();return;}
 if(rel.includes('\\')||rel.split('/').some(p=>p==='.'||p==='..')){res.writeHead(404).end();return;}
 if(!['GET','HEAD'].includes(req.method)||(!allowed.has(rel)&&!['inputs/','outputs/','baseline/assets/','prompts/'].some(p=>rel.startsWith(p))&&!['evidence/input-contact-sheet.jpg','evidence/input-review.json','evidence/preflight.json','evidence/baseline-alpha.json'].includes(rel))){res.writeHead(404).end();return;}
 let file;try{file=inside(rel);}catch{res.writeHead(404).end();return;}
 if(!/\.(html|json|txt|png|jpe?g)$/i.test(file)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
 res.writeHead(200,{'Content-Type':{'.html':'text/html; charset=utf-8','.json':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg'}[path.extname(file)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
 if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);
}).listen(5076,'127.0.0.1',()=>console.log('Experiment report: http://127.0.0.1:5076/report.html (private/account files not served)'));
