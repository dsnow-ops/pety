// Native developer-base acceptance build; same source with minification disabled.
const fs=require('fs'),vm=require('vm');
process.argv[2]='app';process.argv[3]='unpackage/health-recovery-20260928/native-build';
const source=fs.readFileSync(require.resolve('./build-dual-mode.cjs'),'utf8').replace("'build','-p',platform]","'build','-p',platform,'--mode','development','--minify','false']");
vm.runInNewContext(source,{require,process,console},{filename:require.resolve('./build-dual-mode.cjs')});
