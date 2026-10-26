# AI入口异常兜底与请求定位：2026-10-23 04:58 阶段

## 实际缺口与修复

本地故障注入复现：已登录用户查询一个格式合法的搜索任务ID，数据库查询抛错时，`api_deepseek` 原先直接以未处理的Promise异常结束。现在入口统一等待各分支，未知异常返回安全的503响应和服务端生成的 `traceId`。内部异常正文、堆栈和数据库错误不进入该响应。

新增 `request-diagnostics.js`，每次入口调用记录一条 `pety_api_completed`。字段限定为服务名、服务器生成的请求编号、预定义场景、结果码、结果分类与耗时；不会把本次请求正文、令牌、用户ID、宠物ID、图片URL或原始异常对象放进这条日志。客户端提交的请求编号不能指定服务端编号，未知场景统一记为 `unsupported`。

正常业务结果、会员/额度判定和已有错误码保持原义，只增加 `traceId`；公开健康检查仍严格返回 `{ok:true}`。日志写入本身失败不会把业务成功改成失败。入口兜底没有重发或自动重试，故障测试确认没有新增模型调用。

## 验证

- [完整187项本地回归](local-6/results.json)、[原始TAP](local-6/tests.tap)，全部通过。
- 其中 `request-diagnostics.test.cjs` 5项：12路并发编号与日志对应、未知异常和错误返回结构、业务拒绝码不变、日志故障不影响成功、时钟倒退/无效值下耗时边界。
- `release-security-entry.test.cjs` 新增真实入口测试：搜索状态读取故障从未处理异常变为503，客户端编号与唯一完成日志对应，身份校验执行一次，模型调用为0。
- 另执行并通过四个已有源码测试脚本：`deepseek-web-search-v2.test.cjs`、`api-deepseek-product-support-v1.test.cjs`、`api-deepseek-persona-builder.test.cjs`、`api-deepseek-model-config.test.cjs`。这些使用本地导出的纯函数及合成数据，不调用服务商。

复现：`node --test tests/request-diagnostics.test.cjs tests/release-security-entry.test.cjs`。广泛回归：`node scripts/verify-overnight-local.cjs <新证据目录名>`。

## 范围与剩余工作

仅本地源码和故障测试，本轮没有部署或调用真实云函数。新增文件必须与入口一起部署，不能只替换index.js。这不是完整监控系统，也没有为全部历史日志作出脱敏保证；还没有日志聚合面板、报警触达、生产请求成功率或恢复时长证据。请求编号不等于幂等账本，不能据此声称所有聊天重试都能避免重复收费。前端用户可复制的诊断入口也尚未接入。
