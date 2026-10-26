'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=__dirname,old=JSON.parse(fs.readFileSync(path.join(root,'samples/pro-style-v3-01.json')));
// Controlled input ablation: keep the same model, seed and style instruction,
// but remove three less direct identity views. No image bytes are edited.
const prompt=fs.readFileSync(path.join(root,old.promptFile),'utf8').replaceAll('第2至第6张','第2至第3张').replaceAll('第2至6张','第2至3张').replaceAll('五张真实照片','两张真实照片');
const name='style-two-identity-v4.txt';fs.writeFileSync(path.join(root,'prompts',name),prompt,{flag:'wx'});
const spec={...old,id:'pro-style-v4-01',promptFile:'prompts/'+name,promptSha256:crypto.createHash('sha256').update(prompt).digest('hex'),images:old.images.slice(0,3),change:'Identity reference ablation: only frontal 04 and side 02 plus unchanged approved style screenshot; same seed/model/style text, only reference numbers adapted.'};
fs.writeFileSync(path.join(root,'samples',spec.id+'.json'),JSON.stringify(spec,null,2),{flag:'wx'});
