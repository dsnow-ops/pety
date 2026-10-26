# 会员查询：故障不降级，损坏数据不授权

2026-10-23 07:56。本地源码修复，未部署；没有真实订单、会员写入、短信或支付。

## 已修复

会员与资料接口此前对一部分异常做了保护，但仍可能接受带错误码的有效/空data、多条或错误归属记录；NaN等失效时间可能被当作“无期限”。本轮把共同的读取与归一化整理到 `pety-membership-orders/membership-state.js`，两个接口使用同一逻辑，防止后续规则分叉。

数据库错误响应、非唯一记录、归属不符、非法计划/状态/时间和损坏的已知权益字段均返回会员服务不可用，不发布免费或付费身份。用户资料的错误响应、错误归属以及昵称/头像字段损坏不再覆盖正常缓存。

已启用付费周期的读取同样检查错误码、事务/普通查询形状、唯一排期、订单标识、正向时间区间和归属。现有付费功能开关没有开启；价格、会员权益、免费次数、付费10次形象池和到期策略没有调整。

## 验证与恢复

- [修复前](membership-state-before/tests.tap)：8项中7项失败，包括真实资料接口→客户端缓存被误降为免费。
- [最终相关回归](local-24/results.json)：323/323；[TAP](local-24/tests.tap)。正常无记录、到期、退款、有效覆盖和已启用/未启用付费周期均通过。
- [原规则等价核对](membership-normalization-equivalence.json)：16种合法输入，和修改前normalizeMembership的JSON输出逐字节等价。损坏状态新增拒绝不计入规则等价。
- 实际profile入口与客户端auth-store联动：错误响应保留令牌、原昵称和plus缓存；恢复正常数据后刷新成功。
- [本地部署依赖预检](deployment-preflight-2/results.json)：13个包、19条本地依赖、下载超时契约通过。新公共文件已被真实本地测试加载；不证明线上包更新。结果的createdAt为本轮时间，reportDate是旧脚本字段。

既有VM测试改为加载新的真实共享模块，未用“始终成功”替身替代它。复现：`node --test tests/membership-state-integrity.test.cjs tests/rc-membership-outage.test.cjs tests/rc-effective-paid-membership.test.cjs tests/auth-response-integrity.test.cjs`。

## 限制

本轮覆盖会员/资料查询及共享付费周期读取，没有宣称所有历史AI限流和头像额度账本都已采用这份契约。它们的独立读取仍需继续核查。坏记录会要求人工核对，不自动修补、删除或改套餐。云端部署、真实支付回调和跨设备恢复尚未验证。
