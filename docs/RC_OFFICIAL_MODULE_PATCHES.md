# 官方模块兼容补丁

基线：uni-id-pages / uni-id-co 1.1.28，uni-id-common 1.0.19，uni-captcha 0.8.2，uni-config-center 0.0.3。没有升级到 uni-app x，也没有替代官方 token/密码算法。

本轮必须保留的六处 uni-id-co 安全补丁（均在其云函数目录）：
- module/verify/send-sms-code.js：缺模板直接拒绝，仍执行官方 captcha；不创建测试码。
- module/verify/send-email-code.js：未接邮件服务直接拒绝，不创建测试码。
- module/login/login-by-sms.js：移除手机号/验证码控制台输出；官方登录安全审计保留。
- middleware/verify-request-sign.js：保留验签，错误日志不含秘密和签名。
- lib/utils/verify-code.js：短信与邮箱通过 state=0、未过期条件更新消费，updated 必须为1；并发只成功一次。
- module/register/register-admin.js：公开管理员 bootstrap 在所有构建关闭，既有管理员不受影响。

原文件备份：unpackage/rc-20260921/baseline/vendor/。上述六处云对象补丁已于本轮部署至现有 ali01；短信发送成功受理，完整收码登录仍待验证。

升级流程：先对比上游是否已修同类问题；保留或重应用必要补丁；运行 tests/rc-auth-hardening.test.cjs，随后完整回归。不得直接覆盖定制后只检查版本号。缺短信配置不使用模拟成功填补。

客户端额外补丁（同一 uni-id-pages 1.1.28）：`common/store.js` 的资料刷新/退出捕获当前 token，晚到的旧账号响应不得改写新账号；实名服务失败保留已成功读取的基本身份。原文件在 `baseline/vendor/common/store.js`。升级时另跑 `tests/rc-official-profile-races.test.cjs`；4 个用例对原文件均因实际状态断言失败，对补丁版本通过。没有替代官方 token 或用户查询权限。

官方依据：[uni-id-pages 普通 uni-app](https://doc.dcloud.net.cn/uniCloud/uni-id/app.html)、[短信开发接口](https://doc.dcloud.net.cn/uniCloud/sms/dev.html)。uni_sms_test 是开发环境真实短信模板，不代表生产签名审核完成；本轮仍受5条预算和指定测试号码授权限制。

2026-09-22 补充：lib/utils/verify-code.js 的短信校验按 mobile+scene 选择最新记录，每条最多5次、CAS原子预约尝试后比较，旧记录无attempts按0兼容；新码消费后旧码不会复活。官方生成/图形验证码/token机制不变。Schema增量添加created_date及attempts，仍禁止客户端读写。备份attempt-cloud-co / attempt-cloud-schema.json留在私有忽略目录。先Schema后uni-id-co均已部署；新增tests/rc-sms-attempt-budget.test.cjs，升级时必须保留这些行为。

2026-09-22：本地安装uni-pay 2.4.2，来自此前下载的官方示例。pety-upstream-lock.json记录47个上游文件SHA256；未覆盖其他已装模块，未复制商户配置、未部署。index.obj.js的_before暂时无条件拒绝公开调用，防止示例客户端传价接口在业务订单接入前开放；此关闭不能通过客户端或环境变量绕过。后续仅在服务器订单入口、渠道审批与真实沙箱验收后移除此临时门禁。私有uni-pay-adapter.js要求官方SDK重验签持久通知并核对签名内商户/币种；缺失信息拒绝，支付宝缺币种通知尚未形成可上线映射。

同版本追加：index.obj.js的createOrder/getOrder委托pety-entry.js，package.json添加私有pety-membership-orders依赖。客户端不再提供金额、账号、渠道配置路径；价格由服务器目录及持久订单确定。升级时保留委托入口并运行rc-payment-entry/rc-membership-orders回归。公开总门禁仍关闭，notify运行时与状态投影未完成，禁止部署开放。

后续同版本扩展：新增官方notify目录的pety_membership.js，type固定pety_membership；只传out_trade_no给私有runtime，忽略调用参数的verified字段，重读官方持久原始通知并用官方SDK重验签。入账未完成返回false；显式恢复复用相同settle。升级需运行rc-payment-runtime（包含实际hook执行），保留该扩展文件。线上恢复触发器、订单投影和沙箱未完成，公开总门禁仍保留。

恢复扩展：index.obj.js._timing调用pety-recovery.js，必须保留独立enabled/recoveryEnabled默认关闭检查（官方定时调用绕过_before）。worker以私有pety_payment_recovery集合保存进度和租约。triggers目前空，未部署；升级时跑rc-payment-recovery-worker、rc-payment-recovery-pages、rc-payment-runtime。官方机制依据 https://doc.dcloud.net.cn/uniCloud/trigger.html 。订单状态投影已在后续payment-status接线完成，仍未开放支付。
