# 21:52 客户端直连数据库与上传授权复验

本轮修正了用户表未同步到云端的读取规则。没有删除或修改用户记录，没有改账号令牌、会员权益或单设备运行模式。当前可继续受控开发验收，仍不能公开发布。

| 检查 | 实际结果 | 验证边界 |
|---|---|---|
| 未登录 ClientDB 读取计次账本、任务表 | 官方客户端 SDK 的真实云端请求均返回 `TOKEN_INVALID_ANONYMOUS_USER` | 仅匿名读取，不代表 A/B、写/删/计数/导出矩阵全部通过 |
| 未登录 ClientDB 读取用户表，修前 | 对唯一、未创建的合成 ID 返回空数组；没有返回用户数据 | 不是已证实的越权读取。远端规则仍为 `doc._id == auth.uid`，本地则为 `false` |
| 用户表规则部署 | 前后结构比较仅 `/permission/read` 一项改变；远端备份后上传，重新下载与本地语义一致 | 仅该 Schema 在21:49核验，不能把其他旧回读时间更新到本次 |
| 未登录 ClientDB 读取用户表，修后 | 明确返回 `TOKEN_INVALID_ANONYMOUS_USER`；另外两表仍拒绝 | 关闭了普通客户端直接读取用户表这条路径；正常资料查询走认证云对象 |
| 正常手机账号查询 | 21:51“账号与安全”从正在读取到成功显示原账号绑定状态；返回后四只已有宠物保留 | 未做新登录、短信、密码修改、资料编辑或两设备接管 |
| 内置存储直接上传授权 | 未登录且不调用业务回执接口，官方 SDK 仍取得上传 URL 与表单授权；签发 HTTP 200 | 在上传传输前主动停止，没有上传文件，未证明实际写入/覆盖成功 |
| 现有扩展存储 | 官方控制台明确显示尚未开通，页面要求接受服务协议后开通 | 未接受协议、开通服务、充值或改变计费设置 |

ClientDB 查询严格限定三张表、一个随机未创建的测试 ID、仅 `_id` 字段和 limit=1；不查询真实账号列表。修前和修后各三次真实请求，共六次，响应正文合计2468字节，数据库写入0。对应 SDK 请求中没有 uni-id token 或 Cookie，但有应用级平台签名。

上传授权检查仅一次签发请求，响应2277字节；实际上传0、创建对象0、删除0。该授权可绕过业务回执，说明应用自己的上传限流没有覆盖平台直传入口，不能用合法用户当前用量很低推导此入口不存在费用风险。

## 证据与复验入口

- `unpackage/release-sprint-20261013/anonymous-clientdb-1791899018417.json`：修前。
- `unpackage/release-sprint-20261013/anonymous-clientdb-1791899393506.json`：修后，三表明确拒绝。
- `unpackage/release-sprint-20261013/user-schema-readback-2149.json`：远端与本地语义一致，CRUD权限均false。
- `unpackage/release-sprint-20261013/client-upload-authority-e6cef7a6-88d0-4ea1-91bf-d16dd14e4475.json`：只验证授权签发，上传传输禁用。
- 远端修前备份：`cloud-private/2026-10-13T13-44-31-032Z-uni-id-users`；修后回读：`cloud-private/2026-10-13T13-49-51-982Z-uni-id-users`。
- 手机截图 `cloud-private/phone-private-clientdb-*.png` 含真实账号信息，只在私下保存；报告不附原图。
- `scripts/release-anonymous-clientdb.cjs --validate-only` 和 `scripts/release-client-upload-authority.cjs --validate-only` 为无网络预检。去掉参数才请求云端，不在没有新变化时重复探测。

官方 CLI 首次未带替换选项时返回“跳过”，不是成功部署；随后不带后缀的资源名被拒绝，也没有部署。核对安装源码后采用准确文件名与 `--force`，它只选择替换已备份的指定 Schema：

```powershell
& 'D:/HBuilderX/cli.exe' cloud functions --upload db --prj pety --provider alipay --name uni-id-users.schema.json --unimod uni-id-pages --force
```

本地 `rc-official-profile-races` 回归确认晚到的旧账号资料/退出不污染新账号、非关键实名服务失败保留基本身份。手机正常云端查询是另一份实际证据，不能互相替代。

## 仍需处理

文件读取旁路仍按[存储报告](PETY_RELEASE_CLIENT_STORAGE_BYPASS_20261013.md)阻塞发布。需要仅服务端签名、从首次上传起即私有的存储目标；[扩展存储官方文档](https://doc.dcloud.net.cn/uniCloud/ext-storage/dev.html)说明默认上传公共，不能以“上传后再设私有”留下暴露窗口。现有内置存储直传入口的限制与旧公开文件撤销仍需一并解决，仅将新业务路径换到别处不能宣称旧入口已关闭。

已询问是否有现成私有存储及配置位置，不索取聊天明文密钥。任务书禁止购买服务和代签协议，因此没有擅自开通。严格会话、正常 A/B 登录与支付等其他门槛保持未完成，短信继续按用户要求暂缓。
