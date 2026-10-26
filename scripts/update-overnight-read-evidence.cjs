const fs=require('node:fs');
function edit(file,fn){let s=fs.readFileSync(file,'utf8');const r=(a,b)=>{if(!s.includes(a))throw Error(file+': '+a);s=s.replace(a,b)};fn(r);fs.writeFileSync(file,s)}
edit('scripts/snapshot-overnight-changes.cjs',r=>{
 r("const pairs=[[", "const pairs=[['diary-store-before.js','common/diary-store.js'],['calendar-before.vue','pages/calendar/calendar.vue'],['narrative-before.vue','pages/narrative/narrative.vue'],['card-studio-page-before.js','common/card-studio-page.js'],['card-compose-before.vue','pages/card-compose/card-compose.vue'],[");
 r('local-3/results.json','local-5/results.json');
});
edit('docs/overnight-20261023/DELIVERY.md',r=>{
 r('2026-10-23 04:28','2026-10-23 04:53');
 r('\n模型参考说明：','\n8. **损坏资料不会再被空白记录覆盖。** 创作容器、版本与旧日历保存增加严格检查；册页、日历、文字编辑器和制卡页有明确读取失败与重试状态。日历保存中途出错保留输入，制卡重试保留未保存版式。[专项证据与边界](READ-INTEGRITY.md)。\n\n模型参考说明：');
 r('[local-3/results.json](local-3/results.json)、[原始TAP](local-3/tests.tap) | 175/175','[local-5/results.json](local-5/results.json)、[原始TAP](local-5/tests.tap) | 181/181');
 r('[h5-4/results.json](h5-4/results.json)','[h5-5/results.json](h5-5/results.json)');
 r('[care-h5-4/results.json](care-h5-4/results.json)','[care-h5-5/results.json](care-h5-5/results.json)');
 r('[retention-h5-3/results.json](retention-h5-3/results.json) | round-7构建','[retention-h5-4/results.json](retention-h5-4/results.json) | round-10构建');
 r('| 模型报告审阅页 |','| 资料读取异常H5 | [read-errors-h5-2/results.json](read-errors-h5-2/results.json) | 四页、两类错误容器、原始字节保护、实际重试、保存中途失败保留输入；三宽度和1.3倍字体 |\n| 模型报告审阅页 |');
 r('local-3中的home哈希','local-5中的home哈希');
 r('h5-4/directory-large-text-360.png','h5-5/directory-large-text-360.png');
 r('当前H5验证构建为 `unpackage/overnight-20261023/round-7/h5`。复建命令：`node scripts/build-dual-mode.cjs h5 <新的隔离输出目录>`。已有证据不要覆盖。最后加入的同毫秒照护历史排序只做了本地测试，后续统一新构建时再次带入。','当前统一H5验证构建为 `unpackage/overnight-20261023/round-10/h5`。复建命令：`node scripts/build-dual-mode.cjs h5 <新的隔离输出目录>`。已有证据不要覆盖。同毫秒照护历史排序已带入本轮构建，照护流程重新通过。');
 r('册页脚本当前指向round-4，照护脚本指向round-7。','四个H5脚本均默认round-10，也可通过第二个位置参数指定新的round目录。');
 r('，指向round-7。单独回归：','，默认round-10。读取故障：`node scripts/verify-overnight-read-errors.cjs <新的证据目录名> round-10`。单独回归：');
});
edit('docs/overnight-20261023/PROGRESS.md',r=>{
 r('1. 检查创作资料读取异常时是否会被空对象覆盖，并补可恢复的页面反馈；需要联查册页、日历、编辑器，不只修单页。','1. 已完成创作/旧日历读取覆盖保护与四页错误状态，见 READ-INTEGRITY.md；181项本地回归及round-10四套真实H5复验通过。继续检查后端可诊断性与异常恢复边界。');
});
edit('docs/overnight-20261023/READ-INTEGRITY.md',r=>r('../../..//tests/','../../../tests/'));
