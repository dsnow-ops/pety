# 本轮部署、恢复与续跑

状态：未部署。真实空间 alipay / ali01 / env-00jy6ft635sf 的开发/生产用途未知。不能覆盖，不能导出整库，不创建收费空间。

## 开始条件

先取得明确的测试环境用途、操作权限、授权短信号码和测试 A/B 身份。保存当前远端函数版本、schema、索引、ClientDB 与存储权限基线及取得日期。本轮 CLI 只保存了名称清单，尚不是远端源码备份。读取配置时只记开关/有无，不打印密钥、token 或个人信息。

## 非破坏性部署顺序

1. 保存当前部署版本与可恢复文件；对比本地 source-delta-manifest.json，保留此前已有改动，不整仓覆盖。
2. 先上传新增/增量 schema 和必需索引。尤其是 pety_active_sessions、pety_session_tickets、pety_avatar_quota_ledgers、pety_avatar_source_receipts、pety_provider_budgets、pety_sms_send_budgets、product_feedback_uploads；pet_avatar_jobs 的 receipt/fingerprint 字段必须先声明。相关 schema 全部有本地源文件。检查旧数据，遇唯一冲突记录 dry-run，不删数据。
3. 上传 common/pety-auth 及其明确依赖（uni-id-common；pngjs 7.0.0、jpeg-js 0.4.4）。使用本机 lock，不强制升级整个官方模块。上传本轮 api_deepseek、api_pet_avatar、submit_product_feedback 和 uni-id-co 修改；membership_get/user_get_profile 复用同一新版公共模块。函数与公共模块须统一版本，不能只更新一条入口。
4. 保持正式支付入口关闭；不要启用未知商户、demo SKU、自动付款或个人收款码。现有订单/通知/补偿模块需官方沙箱身份后单独接入。
5. 开发/测试环境先 staged 验证正式鉴权和兼容资料接口；staged 不代表单设备限制已启用。完成客户端 proof、所有函数、ClientDB/JQL、存储直连隔离后统一 enforce。旧客户端没有证明不能获得严格权限。严格环境回退只能 deny 暂停线上操作，不能回 staged 重新放行旧会话。
6. 存储权限：用新建的自有测试文件做匿名访问和 A/B SDK/JQL/REST 测试。仅服务端签名网关不足以证明 CDN 私有。历史原图没有回执时只能受控迁移，不能按客户端声明自动认领。未知历史图片可能无法续签，需保留原资料并记录逐项处理。
7. 可控开发权益仅服务端配置：PETY_CLOUD_ENV=development，PETY_DEV_MEMBER_BYPASS=true，PETY_DEV_MEMBER_UIDS 精确测试 UID，PETY_DEV_MEMBER_SCOPES=avatar-generation，PETY_DEV_MEMBER_EXPIRES_AT 为未来毫秒时间戳且距现在不超过 7 天。缺失/过期/范围不符均回正式池；鉴权、会话、来源校验和费用预算照常。正式环境关闭。
8. Provider 日预算可配置 PETY_COST_AI_ACCOUNT_DAY / PETY_COST_AI_GLOBAL_DAY、PETY_COST_AVATAR_ACCOUNT_DAY / PETY_COST_AVATAR_GLOBAL_DAY、PETY_COST_CUTOUT_ACCOUNT_DAY / PETY_COST_CUTOUT_GLOBAL_DAY。任一对应上限设 0 会在出站前拒绝，DB 故障也拒绝。默认是调用数限制，不是金额限制；设置前按真实价格核算。Hero/VIAPI 默认关闭，不为了验收自动多生图。
9. 按报告 A—J 在隔离云对象上复验。保存部署时间、实际函数 SHA、schema/权限版本、实际响应与 DB 状态摘要，不保存 OTP 或私密原文。核对真实事务 updated/updatedCount/affectedDocs 形式，不拿本地替身结果代替。
10. 恢复 worker 和定时：只有真实部署、平台调度信任与行为验收都成立才标“自动恢复已启用”。当前 uni-pay-co 的 _timing 是本地代码，不能据此声称云端已调度。普通客户端不能凭 internal=true 触发维护。

## 本机复验与构建

在项目根目录执行：

```powershell
node --test tests/*.test.cjs tests/*.test.mjs
node scripts/build-dual-mode.cjs h5 unpackage/release-sprint-20261010/build
node scripts/build-dual-mode.cjs app unpackage/release-sprint-20261010/build
node scripts/release-secret-audit.cjs --current-only
node scripts/release-preview.cjs
```

这套手工构建没有自动读取 HBuilderX 的关联凭据，只能用于本机 UI/存储验收。真实账号链路通过已核验的 HBuilderX 空间关联构建；不把服务端 API key 或登录加密秘密塞进客户端。发布 APK 还需要合法签名与核验 package/version/cert/debug/合并权限，App 资源不等于 APK。手机替换前检查签名；不卸载、不 clear data。

只读手机预检命令：node scripts/release-phone-readiness.cjs。结果只包含本 App 包/资源元数据与 SHA，不导出账号存储。必须分别比较“进入本轮的资源”“HBuilderX 当前开发输出”“本轮手工 production 资源”。当前手机匹配 HBuilderX 01:57:56 开发输出，含部分新反馈代码；不是最终客户端完整同步证明。基座仍有已从产品 manifest 移除的四项权限。不能用基座权限代表最终 release 权限，也不能用缺云关联的资源覆盖正在使用的真实账号来冒充验收。

本机 HBuilderX CLI 的 cloud functions --run 走安装插件的 runCloudFunction 本地运行路径，不能拿它的成功证明远端已部署。续轮已读安装插件源码确认，因此没有修改现有 .param.json 或执行该命令。CLI --info/--list 是只读版本定位证据；真实远端 handler 验收仍需明确目标、权限和受控调用渠道。

## 精确恢复

开始时完整脱敏源码在 unpackage/release-sprint-20261010/baseline/source。交付包 source-before 只含本轮改变的已有文件，source-after 是对应最终文件；新增文件按 delta 清单标记。恢复前逐个比较当前 SHA 与交付 SHA，若别人继续修改则停止覆盖，人工合并。只恢复失败的本轮局部改动，不恢复整个 baseline，不 reset/stash/clean。

恢复不包括云端真实数据。单设备/计次/回执与支付账本不可通过旧代码、清候选或删除集合重置。远端部署回退必须依据先保存的真实版本，严格鉴权安全门继续保持；没有远端基线则不能开始部署。源码/测试资料备份恢复实验已做，生产数据恢复未做。

## 下一轮第一件事

先读 docs/PETY_RELEASE_PROGRESS.md 与本报告，核对 Git 状态、真实空间和手机 app-service SHA。不能把此轮本地通过当下轮真实云通过。拿到环境/号码后做低频验收，持续记共享预算；真实消费不明时不能加大重试。没有这些外部条件时不再重复稳定本地用例或对未知生产做安全扫描。
