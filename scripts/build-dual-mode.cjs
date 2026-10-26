// Uses the project's installed HBuilderX Vue3 toolchain, never downloads packages.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const platform=process.argv[2]||'h5';if(!['h5','app','mp-weixin'].includes(platform))throw Error('Unsupported build target');
const hx='D:/HBuilderX',cli=path.join(hx,'plugins/uniapp-cli-vite');
const outputBase=process.argv[3]||'unpackage/dual-mode-20260928';
const out=path.resolve(outputBase,platform);fs.mkdirSync(out,{recursive:true});
const env={...process.env,UNI_INPUT_DIR:process.cwd(),UNI_OUTPUT_DIR:out,UNI_PLATFORM:platform,UNI_CLI_CONTEXT:cli,RUN_BY_HBUILDERX:'true',UNI_HBUILDERX_PLUGINS:path.join(hx,'plugins'),NODE_PATH:path.join(cli,'node_modules')};
env.HX_APP_ROOT=hx;
const node=platform==='mp-weixin'?path.join(hx,'plugins/node/node.exe'):process.execPath;
const result=cp.spawnSync(node,[path.join(cli,'node_modules/@dcloudio/vite-plugin-uni/bin/uni.js'),'build','-p',platform],{env,encoding:'utf8',maxBuffer:30*1024*1024});
fs.writeFileSync(path.resolve(outputBase,`build-${platform}.log`),(result.stdout||'')+(result.stderr||''));
console.log((result.stdout||'').slice(-1800),(result.stderr||'').slice(-1800));process.exitCode=result.status??1;
