'use strict';
// Source-only recovery baseline. Runtime credentials and user evidence are never copied.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=process.cwd(),out=path.resolve(process.argv[2]||'unpackage/release-sprint-20261010/baseline');
if(fs.existsSync(path.join(out,'manifest.json')))throw Error('Preserve existing baseline.');
const git=(...args)=>cp.execFileSync('git',args,{encoding:'utf8',maxBuffer:20*1024*1024,stdio:['ignore','pipe','ignore']});
const files=[...new Set([...git('ls-files','-z').split('\0'),...git('ls-files','--others','--exclude-standard','-z').split('\0')])].filter(Boolean);
const rows=[],excluded=[];
for(const file of files){
 if(!/\.(vue|js|cjs|mjs|ts|css|scss|json|md|html)$/.test(file)||/(^|\/)(node_modules|unpackage|deliverables|tmp|\.git|fixtures)(\/|$)|(^|\/)(config(?:\.local)?\.json|\.env[^/]*|.*\.pem|.*\.key|.*\.param\.json|.*payload\.json|runtime.*\.json)$/.test(file)||file.startsWith('docs/')&&!/^docs\/[^/]+\.md$/.test(file)){excluded.push(file);continue;}
 const src=path.join(root,file);if(!fs.existsSync(src))continue;
 const content=fs.readFileSync(src);if(content.length>2*1024*1024||/\bsk-[A-Za-z0-9_-]{24,}|-----BEGIN .*PRIVATE KEY-----|\bLTAI[A-Za-z0-9]{16,}/.test(content.toString())){excluded.push(file);continue;}
 const dest=path.join(out,'source',file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,content);
 rows.push({path:file,sha256:crypto.createHash('sha256').update(content).digest('hex'),bytes:content.length});
}
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({createdAt:new Date().toISOString(),node:process.version,branch:git('branch','--show-current').trim(),head:git('rev-parse','HEAD').trim(),files:rows,excluded},null,2));
fs.writeFileSync(path.join(out,'git-status.txt'),git('status','--short'));
// Build the baseline diff only from screened source paths, never a whole-tree secret-bearing diff.
let patch='';for(let offset=0;offset<rows.length;offset+=25)patch+=git('diff','HEAD','--',...rows.slice(offset,offset+25).map(r=>r.path));
fs.writeFileSync(path.join(out,'working-tree.patch'),patch);
fs.writeFileSync(path.join(out,'README.txt'),'Restore selectively after comparison with manifest; never overwrite the repository. source/ includes untracked code. Secrets, runtime configs, images and private evidence excluded. No cloud backup is implied.\n');
console.log(JSON.stringify({files:rows.length,excluded:excluded.length,out}));
