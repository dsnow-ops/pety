'use strict';
// Official CLI only. Validates the local synthetic-file manifest before running.
// --validate-only performs no network/cloud calls. Normal invocation makes at
// most four HTTPS GETs plus two official signing calls; never uploads or deletes.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),base=path.join(root,'unpackage/release-sprint-20261013');
const args=process.argv.slice(2),dry=args.includes('--validate-only');
const name=args.find(a=>a!=='--validate-only');
if(args.length!==(dry?2:1)||!/^pety-release-acl-[a-f0-9-]{36}\.json$/.test(name||''))throw Error('Provide one synthetic ACL manifest basename and optional --validate-only');
const marker=name.slice(0,-5),rows=JSON.parse(fs.readFileSync(path.join(base,'cloud-private',name),'utf8'));
const folders=['pet-avatar/input-v2','product-feedback/v2'];
if(!Array.isArray(rows)||rows.length!==2||rows.some((r,i)=>r.cloudPath!==folders[i]+'/'+marker+'/probe.png'||r.fileID!=='cloud://env-00jy6ft635sf/'+r.cloudPath))throw Error('TEST_MANIFEST_SCOPE');
if(dry){console.log(JSON.stringify({validated:true,files:2,cloudCalls:0,uploads:0,deletes:0}));process.exit(0);}
const stamp=Date.now()+'-'+crypto.randomBytes(4).toString('hex');
const log=path.join(base,'cloud-private','storage-acl-recheck-'+stamp+'.log');
// HBuilderX dispatches via its existing process, so arbitrary CLI environment
// variables do not reach the runner. This local, non-secret selector is the only
// handoff; exclusive creation prevents concurrent runs from changing its target.
const selector=path.join(base,'cloud-private','acl-recheck-selection.json');
fs.writeFileSync(selector,JSON.stringify({manifest:name}),{flag:'wx'});
let fd,result;
try{fd=fs.openSync(log,'wx');result=cp.spawnSync('D:/HBuilderX/cli.exe',['unicloud','test','--prj','pety','--provider','alipay','--functionName','api_pet_avatar','--file','pety-release-storage-acl-recheck.itest.js','--mode','integration','--space','env-00jy6ft635sf'],{cwd:root,stdio:['ignore',fd,fd],windowsHide:true,timeout:90000});}finally{if(fd!==undefined)fs.closeSync(fd);fs.unlinkSync(selector);}
const text=fs.readFileSync(log,'utf8').replace(/\x1b\[[0-9;]*m/g,'');
const match=text.match(/PETY_RELEASE_STORAGE_ACL_RECHECK_RESULT (\{[^\r\n]+\})/);
const report=match?JSON.parse(match[1]):null;
const pass=!result.error&&result.status===0&&report?.pass===true&&/Test Files\s+1 passed/.test(text);
console.log(JSON.stringify({pass,report,privateLog:path.relative(root,log),cliStatus:result.status,runnerError:result.error?.code||null}));
process.exitCode=pass?0:2;
