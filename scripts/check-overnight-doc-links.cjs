const fs=require('node:fs'),path=require('node:path');
const root='docs/overnight-20261023',files=fs.readdirSync(root).filter(n=>n.endsWith('.md')),missing=[];let checked=0;
for(const name of files){const file=path.join(root,name),s=fs.readFileSync(file,'utf8');for(const match of s.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)){const target=match[1];if(/^[a-z]+:\/\//i.test(target)||target.startsWith('#'))continue;const resolved=path.resolve(path.dirname(file),target.split('#')[0]);checked++;if(!fs.existsSync(resolved))missing.push({file,target});}}
console.log(JSON.stringify({files:files.length,checked,missing}));if(missing.length)process.exitCode=1;
