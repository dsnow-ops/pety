'use strict';
// Findings contain only paths, line numbers and hashes, never matching text.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=process.cwd(),out=path.resolve('unpackage/release-sprint-20261010/secret-audit.json');
const git=(...args)=>cp.execFileSync('git',args,{encoding:'utf8',maxBuffer:40*1024*1024,stdio:['ignore','pipe','ignore']});
const hash=x=>crypto.createHash('sha256').update(x).digest('hex').slice(0,16);
const findings=[],patterns=[['provider-key',/\b(?:sk-[a-zA-Z0-9_-]{24,}|LTAI[a-zA-Z0-9]{16,})\b/g],['private-key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],['auth-secret',/["'](?:tokenSecret|passwordSecret)["']\s*:\s*["']([^"'\r\n]{8,})["']/g]];
function scan(text,location,scope){for(const [kind,re] of patterns){re.lastIndex=0;let m;while((m=re.exec(text))){const value=m[1]||m[0];if(/example|placeholder|your_|replace|synthetic|test[_-]|fixture|isolated|tokenSecret.*change|passwordSecret.*change/i.test(value))continue;findings.push({scope,location,line:1+text.slice(0,m.index).split('\n').length-1,kind,fingerprint:hash(value)});}}}
const files=new Set([...git('ls-files','-z').split('\0'),...git('ls-files','--others','--exclude-standard','-z').split('\0')].filter(Boolean));
const extra=cp.execFileSync('rg',['--files','--hidden','--no-ignore','uniCloud-alipay/cloudfunctions/common/uni-config-center','uniCloud-alipay/cloudfunctions/api_deepseek','uniCloud-alipay/cloudfunctions/api_pet_avatar'],{encoding:'utf8',maxBuffer:5e6}).split(/\r?\n/);
for(const file of extra)if(file&&!file.includes('node_modules')&&/(config.*\.json|\.env)$/.test(file))files.add(file.replaceAll('\\','/'));
let checked=0;for(const file of files){if(!/\.(js|cjs|mjs|ts|vue|json|md|txt|env|pem|key)$/.test(file)||/(^|\/)(node_modules|tmp|cache|output|unpackage|\.git)(\/|$)/.test(file))continue;const full=path.join(root,file);if(!fs.existsSync(full)||fs.statSync(full).size>3e6)continue;checked++;scan(fs.readFileSync(full,'utf8'),file,'worktree');}
const buildFiles=[];function walk(dir){if(!fs.existsSync(dir))return;for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(/\.(js|json|map)$/.test(p)&&fs.statSync(p).size<10e6)buildFiles.push(p);}}
walk(path.join(root,'unpackage/release-sprint-20261010/build'));
const manualBuildFiles=buildFiles.length;
if(process.argv.includes('--phone-linked-dev'))walk(path.join(root,'unpackage/dist/dev/app-plus'));
for(const file of buildFiles)scan(fs.readFileSync(file,'utf8'),path.relative(root,file).replaceAll('\\','/'),file.includes(path.join('dist','dev','app-plus'))?'phone-linked-dev-build':'current-build');
const objects=process.argv.includes('--current-only')?[]:git('rev-list','--objects','--all').split(/\r?\n/);let historyChecked=0;
for(const row of objects){const split=row.indexOf(' ');if(split<0)continue;const oid=row.slice(0,split),file=row.slice(split+1);if(!/\.(json|js|vue|env|pem|key|txt|md)$/.test(file)||/(node_modules|unpackage|\.png|\.jpg)/.test(file))continue;try{if(Number(git('cat-file','-s',oid))>3e6)continue;scan(git('cat-file','blob',oid),`${oid.slice(0,12)}:${file}`,'git-history');historyChecked++;}catch(_){}}
const auditOut=process.argv.includes('--current-only')?out.replace('.json','-current.json'):out;
fs.mkdirSync(path.dirname(auditOut),{recursive:true});fs.writeFileSync(auditOut,JSON.stringify({createdAt:new Date().toISOString(),checked,buildFiles:buildFiles.length,manualBuildFiles,phoneLinkedDevFiles:buildFiles.length-manualBuildFiles,historyChecked,findings,limits:'Pattern audit only; no entropy scanner or remote secret validity checks. Configuration findings are not automatically public leaks. No values printed, no credentials rotated.'},null,2));
console.log(JSON.stringify({checked,buildFiles:buildFiles.length,historyChecked,findings:findings.length,out:auditOut}));
