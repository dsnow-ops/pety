const fs=require('node:fs');
let file='docs/overnight-20261023/DELIVERY.md',s=fs.readFileSync(file,'utf8');
s=s.replace('2026-10-23 04:53','2026-10-23 05:00');
s=s.replace('\n模型参考说明：','\n9. **AI入口有统一异常兜底和请求编号。** 搜索任务查询遇到数据库异常不再直接抛出内部错误；统一安全503与服务端traceId，每次调用产生一条限字段完成日志，日志失败不影响正常结果。没有增加自动重试或模型调用。[专项证据与限制](BACKEND-DIAGNOSTICS.md)。\n\n模型参考说明：');
s=s.replace('[local-5/results.json](local-5/results.json)、[原始TAP](local-5/tests.tap) | 181/181','[local-6/results.json](local-6/results.json)、[原始TAP](local-6/tests.tap) | 187/187');
s=s.replace('local-5中的home哈希','local-6中的home哈希');
fs.writeFileSync(file,s);
fs.appendFileSync('docs/overnight-20261023/PROGRESS.md','\n### 05:00 后端入口复验\n\n- 新增AI入口请求编号与一条限字段完成日志；未知分支异常统一安全503，公开健康响应和业务结果保持原义。复现并修复搜索任务读取数据库故障的未处理异常。\n- local-6：187/187通过；另4个已有AI模型配置/搜索解析/产品问答/怀念语气源码脚本通过。后端源码未部署，生产监控未宣称完成，详见 BACKEND-DIAGNOSTICS.md。\n- 下一批继续检查后端读写异常分类与临时故障后恢复，以及有明确改进假设的模型样本；仍不重复付费抽样。\n');
