// Explicit allowlist: no source configs, signed URLs, account storage or database exports.
const fs=require('node:fs'),path=require('node:path');
const run='unpackage/home-c1-runtime-device/run-1789976354003';
const out='unpackage/C1-runtime-20260921';fs.mkdirSync(out,{recursive:true});
const copy=(source,name)=>fs.copyFileSync(source,path.join(out,name||path.basename(source)));
for(const name of ['native-switch.mp4','native-return.mp4','native-white.png','native-dog.png','native-events.json','native-render-trace.json','image-transfers.json',
 ...[1,2,3].flatMap(n=>[`first-frames-native-switch-${n}.png`,`first-frames-native-return-${n}.png`])])copy(path.join(run,name));
for(const time of ['2.67','6.84','11.08'])copy(`unpackage/home-c1-runtime/before-${time}.png`);
copy('unpackage/home-c1-runtime/browser-memorial-fixed.png');
copy('unpackage/home-c1-runtime-device/image-failure-summary.json');
copy('unpackage/home-c1-runtime-device/tests-final.log');copy('unpackage/home-c1-runtime-device/build-final.log');
fs.writeFileSync(path.join(out,'README.md'),`# C1 切宠运行时验收

真机：Honor PGT_AN20，1312×2848；录屏656×1424。C1视觉保持。

- [切宠录屏](native-switch.mp4)：白猫→狗→白猫→狗。三个首屏采样帧约1.154、2.491、3.623秒，名字/图片正确，未观察到上一宠物首页。
- [同宠返回](native-return.mp4)：我的／问诊／我的→首页。未观察到丢图和默认色闪现。
- index.html 含原2.67、6.84、11.08秒失败帧及新录像对应操作的连续帧表。每组24帧、30fps采样；不是仅截图最终状态。
- 根因：隐藏Home取消切宠订阅。修复为仅卸载时取消；pet/master相同的已加载图在URL空窗继续保留，跨身份清除。旧异步响应守卫保留。
- 纪念：预览硬编码问诊已修正为既有信笺。手机只有两只陪伴宠物，真实纪念入口未验证，未修改关系状态造样本。
- 171项全量测试通过，相关回归11项，App构建及git diff --check通过。工作树含其他已有改动，不归入此次最小修复。
- 本次首次重录遭遇HTTP200后的WebView ERR_CACHE_WRITE_FAILURE（错误摘要已附），剩余磁盘156GB。重启开发基座后恢复，未清数据/缓存；最终录像录于恢复之后。缓存写失败的永久修复未证明。
- 模型调用0，云端部署0。CDN有真实下载，不能当零流量验收。未附签名URL、配置、账号或数据库。

业务文件：pages/home/home.vue、components/PetPortraitStage.vue；回归tests/stage-return-recovery.test.cjs；预览scripts/preview-home-directions.cjs。此次接续更新真机录制/逐帧验收脚本与报告，不再变更视觉。
`, 'utf8');
const pairs=['2.67','6.84','11.08'].map((t,i)=>`<section><h2>操作 ${i+1}：原 ${t}s → 新录像对应操作</h2><div class="pair"><figure><img src="before-${t}.png"><figcaption>修复前原录像帧</figcaption></figure><figure><img src="first-frames-native-switch-${i+1}.png"><figcaption>修复后：切宠操作到首次首页，30fps连续采样</figcaption></figure></div></section>`).join('');
fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><meta charset="utf-8"><title>C1运行时验收</title><style>body{margin:32px auto;max-width:1200px;font-family:system-ui;color:#292929;background:#faf9f6}video{width:290px;max-width:100%}.pair{display:grid;grid-template-columns:1fr 3fr;gap:16px}figure{margin:0}img{max-width:100%}section{margin:32px 0}p{line-height:1.7}</style><h1>C1 运行时验收</h1><p>切宠旧首页问题已通过本次真机复验。纪念模式仍缺真实样本。首次录制发生 WebView 缓存写入失败，重启开发基座后恢复；不宣称该环境错误永久消失。详见 <a href="README.md">简短说明</a>。</p><video controls src="native-switch.mp4"></video> <video controls src="native-return.mp4"></video>${pairs}<h2>同宠返回帧表</h2>${[1,2,3].map(n=>`<img src="first-frames-native-return-${n}.png">`).join('')}<h2>纪念预览（不是纪念真机验收）</h2><img width="390" src="browser-memorial-fixed.png">`);
console.log(out);
