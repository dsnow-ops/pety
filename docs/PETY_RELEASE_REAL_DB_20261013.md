# 10月13日真实测试数据库验收（持续记录）

19:43新增任务恢复实测：生产index中的领取/恢复/更新函数，在三个独立VM实例间共享真实测试DB。并发首次领取仅一个成功；丢失任务编号后从同归属候选回执修复；重建实例仍读回原编号；错误归属/会话拒绝恢复，旧状态更新不能覆盖已完成状态，另一归属的任务保持原状态。17次受限DB操作，3条隔离标记行，未删除。模型/图片存储依赖被测试夹具禁用，调用次数0；不是完整客户端生成或实际Provider回执验收。源码pety-release-job-recovery-db.itest.js，原始日志cloud-private/job-recovery-integration.log，脱敏结果job-recovery-db-summary.json。本段仅新增本地测试文件，未重新部署，之前远端业务修复仍按19:20回读记录。

19:45另发现真实存储私有访问失败：两张隔离测试图片去掉URL查询参数后均可匿名读取。该风险未修复，详见PETY_RELEASE_STORAGE_ACL_20261013.md；不要由本报告的DB通过结论推导存储权限已安全。

官方HBuilderX 5.26 CLI的集成测试可在本机官方运行时执行项目实际代码，并连接已授权的 ali01 / env-00jy6ft635sf 数据库。这不同于云函数已部署实例执行，也不是客户端完整登录。依据：[官方测试说明](https://doc.dcloud.net.cn/uniCloud/test.html)。未抽取平台登录凭据、未部署维护/测试后门。

所有写入限制在随机标记的测试行；没有清库、查询真实用户列表、删除记录、真实短信或模型请求。首次目标守卫发现CLI测试标签是test-space，在数据库访问前停止；改为检查官方运行时从实际空间设置的公开UNICLOUD_SPACE_INFO，仍严格要求同一授权空间，未移除目标检查。

## 已取得的行为证据

| 范围 | 实际结果 | 验证边界 |
|---|---|---|
| 免费头像账本 | 四个并发预占仅三个成功；重复结算不多扣，已结算不可释放返还；新实例保留待处理占用，A/B隔离池互不影响 | 实际账本代码+真实DB，31次受控DB操作，2条测试账本；无模型、无登录或生成请求 |
| 会话存储（修前） | 事务读取票据返回对象，代码按数组读取导致拒绝正常确认 | session-integration.log 与 session-integration-shape.log；两次各创建一套少量隔离夹具，未发令牌 |
| 会话存储（修后） | B接管后A被拒绝；A续期与迟到退出不能影响B；并发确认只一个成功，实际事务冲突有效 | 54次受控DB操作；1个无密码/手机号/角色/有效token的合成用户，1条会话、4票据。发token为不可登录的惰性替身；正式登录和strict模式未验、未启用 |
| 短信预算存储（修后） | 预占成功，重建实例仍受冷却限制，超过冷却可再次预占 | 47次DB操作，5条加测试命名空间的预算行；真实短信0、验证码0；不影响正常全局日预算 |

代码修复：事务doc读取按官方单对象合同处理；事务内更新改为doc单记录写，保留读取校验和提交冲突保护，不在事务内使用where更新。适用于pety-auth/sessions.js与sms-budget.js。官方文档明确上述限制：[事务接口](https://doc.dcloud.net.cn/uniCloud/cf-database?id=start-transaction)。本机MVCC夹具也已改为真实返回结构并禁止事务where，防止旧模拟继续假绿。

短信隔离测试初版采用过长的拼接测试ID，返回预算不可用；缩短为隔离输入的SHA256后通过。该夹具问题不冒充产品故障，首次日志保留，第一次是否部分创建测试行未进一步枚举；仍未访问正常短信预算。不要声称新增测试行总数恰好等于最终成功运行行数。

## 路径与未完成项

证据根目录 unpackage/release-sprint-20261013。原始官方日志仅cloud-private私下保留：quota-integration-runtime-target.log、session-integration-after.log、sms-integration-short-id.log。事务专项 transaction-contract-after.log 与修后全量 transaction-final-tests.log 通过。

19:20部署并回读完成：pety-auth、pety-membership-orders、api_pet_avatar的本轮事务修复与远端一致；云对象返回码修复此前已部署。最终回读 cloud-deployment-readback-1791890420066.json 全部一致。配置中心比较仍为之前同一份前后基线；本次没有上传或改写配置，不能把旧配置回读时间改成19:20实时配置查询。修补前远端恢复副本分别保存于19:12/19:16的cloud-private时间目录。

组合路径也已修复：头像计次明确区分普通数据库与事务，事务内使用单对象读和doc写；付费周期读取也能识别事务单对象，仍校验归属。新增 transaction-adapters-before.log / after.log 记录改前失败、改后正常与伪造归属拒绝。真实 admission-integration.log 证明事务内按隔离用户查询会员、验证会话、预占计次能提交；失效会话拒绝后没有新占用。两条额外合成行，无真实用户、令牌或Provider调用。

事务API探测仅开启和回滚空事务；实际支持where查询，但写入遵守doc限制。会话集成的发token替身不提供可登录凭据，不能当作官方token刷新与两台真机验收。严格模式仍未启用。最终本机回归 admission-final-tests.log 通过561项；不以数量代替上述真实DB和真机分项证据。

测试源码为api_pet_avatar目录下五份pety-release-*.itest.js，官方测试运行器按指定文件执行。它们不导出云函数入口，不由业务index加载；未部署额外可调用的维护云函数。当前部署源码已包含这些测试文件并纳入回读校验。

真实OTP、正常登录形成会话、完整A/B接口越权、严格模式客户端联动、Provider恢复、存储ACL、正式APK仍未全部验证，不能公开发布。
