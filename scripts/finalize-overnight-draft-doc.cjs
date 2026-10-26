const fs=require('node:fs');
function edit(file,fn){let s=fs.readFileSync(file,'utf8');const r=(a,b)=>{if(!s.includes(a))throw Error(file+': '+a);s=s.replace(a,b)};fn(r);fs.writeFileSync(file,s)}
for(const file of ['scripts/verify-overnight-care.cjs','scripts/verify-overnight-retention.cjs','scripts/verify-overnight-records.cjs','scripts/verify-overnight-read-errors.cjs','scripts/verify-overnight-care-drafts.cjs'])edit(file,r=>r(file.includes('care-drafts')?"||'round-11'":"||'round-10'","||'round-12'"));
edit('docs/overnight-20261023/READ-INTEGRITY.md',r=>r('../../../tests/','../../tests/'));
edit('docs/overnight-20261023/DELIVERY.md',r=>{
 const time=new Date().toLocaleString('sv-SE',{timeZone:'Asia/Shanghai'}).slice(0,16);r('2026-10-23 04:58',time);
 r('新增表单不会默认复制上次症状。','新增表单不会默认复制上次症状；有未完成本机草稿时可以继续。');
 r('\n模型参考说明：','\n10. **照护输入可以留到下次继续。** 本机草稿按账号、宠物和原咨询隔离；刷新后恢复，两页同时编辑不互相覆盖，正式保存与移除草稿一次完成，草稿不计入历史。[实际流程与证据](CARE-DRAFTS.md)。\n\n最新模型对照：追加独立渲染约束的V5未改善投影和透明残留，已保留为失败对照，未继续沿同方向抽样。[结果与官方能力复核](MODEL-V5.md)。\n\n模型参考说明：');
 r('[local-6/results.json](local-6/results.json)、[原始TAP](local-6/tests.tap) | 187/187','[local-7/results.json](local-7/results.json)、[原始TAP](local-7/tests.tap) | 194/194');r('local-6中的home哈希','local-7中的home哈希');
 r('[h5-5/results.json](h5-5/results.json)','[h5-6/results.json](h5-6/results.json)');r('[care-h5-5/results.json](care-h5-5/results.json)','[care-h5-7/results.json](care-h5-7/results.json)');r('[retention-h5-4/results.json](retention-h5-4/results.json) | round-10构建','[retention-h5-5/results.json](retention-h5-5/results.json) | round-12构建');r('[read-errors-h5-2/results.json](read-errors-h5-2/results.json)','[read-errors-h5-3/results.json](read-errors-h5-3/results.json)');
 r('| 模型报告审阅页 |','| 照护草稿H5 | [care-drafts-h5-2/results.json](care-drafts-h5-2/results.json) | 刷新、两页并发、按咨询隔离、宠物隔离、怀念只读、存储失败和重试、显式放弃不删历史 |\n| 模型报告审阅页 |');
 r('h5-5/directory-large-text-360.png','h5-6/directory-large-text-360.png');r('round-10/h5','round-12/h5');r('四个H5脚本均默认round-10','五个H5脚本均默认round-12');r('，默认round-10。','，默认round-12。');r('<新的证据目录名> round-10','<新的证据目录名> round-12');
 r('\n模型审阅页可直接打开HTML；','\n照护草稿H5：`node scripts/verify-overnight-care-drafts.cjs <新的证据目录名> round-12`。模型报告QA：`node scripts/verify-native-alpha-report-v2.cjs <新的证据目录名>`。\n\n模型审阅页可直接打开HTML；');
});
fs.appendFileSync('docs/overnight-20261023/PROGRESS.md','\n### 照护草稿与第6张透明对照\n\n- 本机草稿已接实际照护表单；刷新恢复、两页竞争、来源/宠物隔离、怀念只读、磁盘失败和显式放弃均有真实H5证据。见 CARE-DRAFTS.md。local-7为194/194。\n- 新增pro-alpha-v5-01一张，0.25元保守预留；同模型同种子同6输入，仅加强无接触阴影约束。目标缺陷未改善，已标记不优于原候选。累计保守占用2.75/20元、实际账单未核；报告6图QA通过。见 MODEL-V5.md。\n');
