# 云端配置快照核对（2026-10-13 18:05）

本次只读取17:53保存的远端配置快照和17:52登录云对象回读，不发送验证码、不读取OTP、不修改密钥。它不能证明之后的控制台配置或服务资质状态。

| 项目 | 已看到的事实 | 结论与下一步 |
|---|---|---|
| uni-id认证配置 | tokenSecret、passwordSecret存在，未输出值或摘要 | 不能仅凭存在认定强度、历史保密性或轮换已完成；保持原配置，避免损伤真实账号 |
| 短信基础配置 | name和正数过期时间存在；登录、找回密码、绑定手机均有非空模板项 | 模板项存在不等于通过审核或当前可发送；仍需服务开通/审核/余额与授权号码 |
| smsKey / smsSecret | 远端配置未显式填写 | 不能列为必填阻塞：官方文档允许HBuilderX 3.91及以后省略；当前HBuilderX为5.26，回读uni-id-co为1.1.28，实际发送工具没有强制检查这两个字段 |
| 短信扩展 | 回读package.json包含uni-cloud-sms声明 | 部署声明已存在；并未因此宣称平台运行成功或手机收到验证码 |
| 问诊配置中心 | 仅有api_deepseek/config.example.json，没有同目录的config.json | 不能据此判定模型凭据缺失：已部署代码还读取函数自身配置及DEEPSEEK_API_KEY / AI_API_KEY环境变量，实际环境尚未核对 |

官方依据：[uniCloud短信云函数API](https://doc.dcloud.net.cn/uniCloud/sms/dev.html)说明新版可省略smsKey/smsSecret，并要求关联短信扩展；[业务开通说明](https://doc.dcloud.net.cn/uniCloud/sms/service.html)区分服务开通、签名和模板流程。本次没有替用户接受服务协议、充值或申请资质。

脱敏证据：`unpackage/release-sprint-20261013/cloud-config-presence-1791885890197.json`。只记录字段有无，不含密钥、手机号、模板编号或验证码。该文件尚未加入18:00生成的增补ZIP；原ZIP保持不变。

连接条件仍未解除：本轮重新读取ADB为空，当前无线调试IP:端口或USB连接信息尚未收到。已获得的ali01开发空间部署/隔离测试授权持续有效，无需再次询问。真实OTP、隔离账号A/B、服务端双会话、计次和恢复验收均保持未完成；不能公开发布。
