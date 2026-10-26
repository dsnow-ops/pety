// Local recoverable source snapshot. Never includes runtime configuration or user assets.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=process.cwd(),out=path.join(root,'unpackage/rc-20260921/baseline');
if(fs.existsSync(path.join(out,'manifest.json')))throw Error('Baseline already exists; preserve it.');
const git=(...args)=>cp.execFileSync('git',args,{encoding:'utf8'});
const files=[...new Set([...git('diff','--name-only','HEAD','-z').split('\0'),...git('ls-files','--others','--exclude-standard','-z').split('\0')])].filter(Boolean);
const rows=[],skipped=[];
for(const file of files){
 if(!/\.(vue|js|cjs|mjs|ts|css|scss|json|md)$/.test(file)||/(^|\/)(node_modules|unpackage|deliverables|\.git|fixtures)(\/|$)|(^|\/)(config(?:\.local)?\.json|\.env[^/]*|.*\.pem|.*\.key)$/.test(file)){skipped.push(file);continue;}
 const src=path.join(root,file);if(!fs.existsSync(src)){rows.push({path:file,deleted:true});continue;}
 const content=fs.readFileSync(src);if(content.length>2*1024*1024){skipped.push(file);continue;}
 if(/\bsk-[A-Za-z0-9_-]{24,}|-----BEGIN .*PRIVATE KEY-----|\bLTAI[A-Za-z0-9]{16,}/.test(content.toString())){skipped.push(file);continue;}
 const dest=path.join(out,'source',file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,content);
 rows.push({path:file,sha256:crypto.createHash('sha256').update(content).digest('hex'),bytes:content.length});
}
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({createdAt:new Date().toISOString(),branch:git('branch','--show-current').trim(),head:git('rev-parse','HEAD').trim(),files:rows,excluded:skipped},null,2));
fs.writeFileSync(path.join(out,'README.txt'),'Local pre-RC source baseline; no automatic restore. Compare source files with the working tree before selectively restoring. Deleted paths are recorded, not recreated. Runtime configurations and user data are intentionally excluded. Existing HEAD supplies unchanged tracked files. Cloud deployed versions must be captured separately before deployment.\n');
console.log(JSON.stringify({files:rows.length,excluded:skipped.length,output:'unpackage/rc-20260921/baseline'}));
