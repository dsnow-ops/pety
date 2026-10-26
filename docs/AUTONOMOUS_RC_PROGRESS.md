# 发布候选自主交付续跑点

## 短信部署条件重新核验（PARTIAL，2026-09-21）
- 上一回合progress。本回合真实CLI重查：`cloud functions --list space --prj pety --provider alipay`为ali01；`--list cloudfunction --prj pety --provider alipay --cloud --unimod uni-id-pages`为空，官方登录对象尚未部署。没有假定本地源码等于线上可用。
- 当前配置只输出存在性：service.sms/name/codeExpiresIn和login/reset/bind模板均缺失。新增scripts/lib/sms-readiness.cjs供现有presence脚本使用，按已安装sms helper实际必需字段判断；配置存在不再等于可发短信，不输出密钥/号码/验证码。两项隔离回归通过（sms-readiness.log）；无客户端改动，沿用build-avatar-auth-recovery.log。
- 官方文档 https://doc.dcloud.net.cn/uniCloud/sms/dev.html 确认uni_sms_test仍支持开发测试、正常收费，模板文本5分钟。本机浏览器getState再次nodeRepl.fetch失败，不能核验控制台开通/余额/空间授权。已向用户请求明确授权测试手机号及开通/余额确认，尚未收到；没有读取私人应用或推断号码。
- 下一动作：拿到测试号码与服务可用证据后，补最小service.sms配置（name、codeExpiresIn=300、scene.login-by-sms.templateId等），保留原token/passwordSecret；核对cloud common与Schema基线后逐项发布官方登录对象，实际收码登录。当前尚不能发码/报告READY。0真实短信/模型/支付/CDN、0部署/同步。

## 游客归属证据与登录恢复入口（PARTIAL，2026-09-21）
- 上一回合progress：候选→final复用已落地。本回合读取HEAD旧getQuotaIdentity，确认游客只由deviceId/IP（以及未验证context身份）派生ownerHash；当前官方模块无匿名登录接口。未发现可用于自动云认领的既有凭据，不能以本机petId/图片地址证明云所有权。当前本机可逆导入保留，云端归属与历史额度仍待可信迁移方案；没有开放弱校验claim。
- 修复实际工作台恢复入口：ensureEntitlement过去吞掉AVATAR_LOGIN_REQUIRED，统一toast；失败页始终重试且可能继续轮询旧job。现在区分登录必需/过期、账号服务不可用和本机导入待关联，中英提示及对应明确入口；这些错误不改已保存pet.avatarStatus，不清token，不重建任务。回跳到账号资料而非跨账号自动恢复旧游客pet任务。
- 新增实际组件方法行为回归，红灯avatar-auth-recovery-before.log；全量297/297，App构建build-avatar-auth-recovery.log成功，diff检查通过。无真实模型/SMS/支付/CDN、无部署/同步手机。
- 仍未完成：可验证旧游客云所有权的迁移、正式短信号码/服务状态、支付渠道适配及当前RC设备统一验收。购买保持关闭。不得把新增错误入口称为这些主链路已完成。

## 候选确认后复用主图字节（PARTIAL，2026-09-21）
- 上一回合只有状态整理，按no progress处理。本回合修复一个实质流量缺口：服务端persistFinalImage原字节复制到新fileId，客户端过去因此再下载一次。
- confirmAvatar现在在已核验owner/session后返回masterCopy凭据；仅候选已保存SHA与实际final SHA一致才签发。final metadata增加contentSha256并同步声明Schema；重复确认使用持久metadata，旧记录无凭据安全走原路径。
- confirmGeneratedAvatar在写入首页pet之前尝试复用。同账号/同pet/同job/准确source与target/摘要和尺寸匹配才映射到同一App私有文件；异常不撤销已成功云保存。缓存按物理路径计容量、最后引用删除文件，保留ownerVersion/失效代次保护。
- 红灯cache-alias-before.log；实际客户端确认函数→缓存→首页selector→离线重启的隔离集成通过；真实persistFinalImage以本地已有PNG+隔离存储证明上传原字节及receipt。全量294/294后新增单项并做相关42/42；App构建build-cache-alias.log成功，diff检查通过。不是云端/真机证明。
- 0真实模型/SMS/支付/CDN，0部署/手机同步。部署前需先增量contentSha256 Schema，再函数；仍不能单独发布半套来源/鉴权迁移协议。游客云端claim、短信外部条件、正式支付adapter与统一native验收继续未完成。下一步不再重复扩展缓存基础，优先解决兼容游客身份与部署基线。

## 激活恢复与撤销竞态（PARTIAL，2026-09-21）
- 上一回合 progress。本回合 payment-inbox.activate 显式串起唯一入账凭据→schedule.activate→可供有效会员读取的周期；任一步失败可按原订单重试，不在return后启动后台任务。
- membership-schedule.revoke 只接受服务端读取的已核验全额退款/拒付凭据；按账号版本CAS写撤销标记，保留原周期和额度历史。撤销早于付款激活时也留下标记，迟到付款不能恢复权益。部分退款未制定产品规则，仍拒绝自动推定为全额撤销。
- 真实模块组合隔离回归：入账后schedule写入故障、重启恢复、8并发重试只有一周期、effective-membership读回、撤销重复执行及撤销先到。相关8/8通过，diff检查通过；无客户端变化不重复App构建。真实Provider/SMS/支付/CDN/部署/手机同步0。
- 尚未形成公开支付闭环：readRefund可信凭据来源及官方渠道notify映射/安装、调用activate的线上恢复入口仍未接；服务端付费会员开关继续关闭。不可把隔离凭据视为渠道沙箱证明。

## 订单周期接入会员查询与生图计次（PARTIAL，2026-09-21）
- 上一回合 progress。本回合新增 effective-membership.js，真实 membership_get/user_get_profile/api_pet_avatar 在服务端 PETY_PAID_MEMBERSHIP_ENABLED=true 时读取同一 schedule；默认关闭，未修改真实环境。已到期/撤销周期不授权，账号/结构错误与旧会员人工延长造成的重叠均拒绝，不任意吞掉任一周期。
- 生图真实createJob函数使用订单cycleKey作为原子quota ledger周期，保留原有旧会员hash周期不变。隔离数据库+Provider替身证明11只宠并发仅10个请求获预占，全部属于同一付费订单周期，未借免费池。两个真实资料endpoint也验证开关前后；不是线上真实付款证明。
- 三个云函数声明公共模块file依赖，api_pet_avatar lockfile通过离线npm同步。未安装/部署官方uni-pay，未改客户端，沿用之前App构建；全量286/286（paid-membership-full.log）及diff检查通过。真实短信/模型/支付/CDN、部署/手机同步均0。
- 剩余：官方notify事实映射与接入、持久任务驱动schedule激活、退款撤销处理、游客迁移与真实验收。支付仍关闭，不能仅开启上述环境开关就认为整套支付已完成；须先发布新增Schema/公共模块，完成回调与修复任务并验证后再考虑启用。

## 订单周期调度基础（PARTIAL，2026-09-21）
- 上一回合 progress。本回合新增 membership-schedule.js 和server-only schedule Schema：每订单独立cycleKey/10次池，CAS防并发重复，续费接在旧周期后，不修改原quota ledger；原有永久会员需人工规则确认，查询失败不当作免费。
- 两项行为回归覆盖并发两次续费、相同订单重复激活、重启后稳定周期、周期边界、跨账号、永久权益和DB故障。源码仍为私有服务端基础，未接实际会员读取/生图消费，也未实现退款处理入口；不能称正式权益已激活。尤其旧会员后续人工延期与新周期之间的冲突仍需集成解决。
- 无客户端改动，不重复构建；无真实Provider/SMS/支付/CDN、无部署/同步。下一断点仍是渠道映射+官方通知连接、调度读取/额度消费集成和退款撤销，不新增UI/售价。

## 支付入账持久记录与故障重试（PARTIAL，2026-09-21）
- 上一回合 progress。本回合新增 payment-inbox.js 与两个server-only Schema：通过严格证据契约的付款先持久记录，再显式await写入每订单唯一的权益来源凭据；重复并发通知不会增加10次池来源，写完凭据但确认失败时可按订单恢复。
- 两项行为回归覆盖10并发、重启重试和冲突交易号；最新全量281/281（payment-inbox-full.log），diff通过。无客户端变化，沿用build-dev-entitlement.log成功构建。0真实支付/SMS/Provider/CDN，0部署。
- 凭据状态明确 pending_activation，返回 membershipActivated=false；不伪报正式会员生效。当前模块仍为私有服务端基础，未接公网API/官方notify/现有membership与生图额度消费。缺口为渠道验签事实映射、权益池激活/顺序消费/退款撤销，以及完整部署与真实验证。

## 支付尝试绑定与证据契约（PARTIAL，2026-09-21）
- 上一回合 progress。本回合读取官方2.4.2 service/pay.js：verifyPaymentNotify后将官方订单置status=1，再调用notify扩展；扩展仅首次回调执行，故权益失败必须另有恢复流程，不能靠等待相同回调自动再发权益。
- 业务订单新增 preparePayment：服务端批准渠道/商户/应用绑定在调用Provider前CAS写入；并发只产生一个outTradeNo，后续配置变更不改变已准备订单，跨账号/跨渠道拒绝。只准备业务事实，不调用支付渠道。
- 新增私有 payment-evidence.js，比对业务订单、官方记录及验签结果的账号/金额/交易号/应用/渠道/币种/商户；returnCode单独成功不能视为付款，退款中/缺商户与币种事实拒绝。尚未绑定真实notify；facts必须由官方渠道适配器从验签结果提供，禁止来自公网event。缺失映射不能用客户端配置补成成功。
- 五项隔离回归通过（payment-contract.log），diff检查通过。未修改客户端，沿用上一构建。真实支付/短信/Provider/CDN/部署0。
- 仍需：官方渠道字段映射和扩展安装、唯一支付入账事件与可恢复权益发放、退款撤销消费池；当前并未完成支付闭环或正式购买入口。正式SKU/渠道继续未确定，购买关闭。

## 支付官方源码与业务订单基础（PARTIAL，2026-09-21）
- 上一目标回合为 progress。本回合下载官方仓库到 unpackage/rc-unipay-upstream，HEAD 557b51a436475cc2d89544a24d0c0df96b345199，uni-pay 2.4.2，MIT；源码声明支持 Vue3/Android/支付宝云，现有四项组件依赖均存在。尚未复制到正式 uni_modules 或部署；不带入上游 init_data 演示账号/订单，不覆盖真实配置。
- 新增 common/pety-membership-orders 服务端公共模块、pety_membership_orders server-only Schema 和三项行为测试：服务端批准的 SKU 才能锁定金额/周期/10次规则；唯一订单身份防并发重复与丢响应重建；同账号请求冲突拒绝，跨账号不可读取。默认关闭，无正式SKU，无付款或发权益入口，不能称正式支付适配完成。
- 用户对价格/周期/渠道问题回答“好的”，仅按继续关闭购买处理，未推定价格或渠道批准。订单测试金额1234分仅隔离 fixture，不是产品报价。
- 下一步准确断点：官方 uni-pay-co/service/pay.js 验签后的支付记录字段与 notify 扩展 -> 可信业务订单核验 -> 幂等权益发放/撤销及恢复。商户资格/正式SKU与真机支付仍未验证，真实扣款始终禁止。
- 本单元真实Provider/SMS/支付/CDN0、部署0；公开官方依赖下载单列，不属于业务图片CDN。本地业务模块回归3/3通过；无客户端变动，不重跑App构建。

## 开发额度客户端与支付现状核对（PARTIAL，2026-09-21）
- 上一回合 progress：会员数据库故障不再覆盖真实账号显示。本回合重新读取总目标的支付/权益约束，核对当前源码：没有 uni-pay 模块，profile/settings 会员入口仍是旧规则说明弹窗，尚无业务订单实现；不把这些称为商户配置阻塞下的完整支付适配。
- 官方 uni-pay 2 文档确认应先创建业务订单，并在回调校验金额；官方文档入口 https://doc.dcloud.net.cn/uniCloud/uni-pay/uni-app.html 。全文抓取超时，搜索索引可读取官方内容；不能据此假定本项目渠道可用或已安装模块。
- 发现客户端 getAvatarGenerationEntitlement 直接以编译开关返回无限额度，与服务端白名单决策不一致。先把回归改为真实服务端拒绝结果并得到失败证据，再移除本地伪造的允许结果；开发构建现在只发送请求标志，服务端仍核验正式身份/环境/白名单。原开发授权能力保留，未知配置不会得到客户端无限额度。
- 274/274全量通过（dev-entitlement-client-full.log）；未产生真实模型/短信/支付/CDN读取，未部署或同步手机。实际支付适配、游客云端claim及统一真机验收仍是剩余工作，未标完成。

## 会员查询故障一致性（PARTIAL，2026-09-21）
- 上一目标回合为 progress：完成最终全量回归及实际本地交付包；本回合重读完整目标后发现两个正式资料接口仍把会员 DB 错误转换为成功的 free 结果。
- 先用真实 endpoint 源码 + 隔离数据库复现，并由真实 auth-store 读回证明 plus 被覆盖为 free（membership-outage-before.log）。membership_get / user_get_profile 现在返回独立服务不可用错误，不泄露原始 DB 错误；客户端已有错误路径保持正式 token 与正确账号的最后显示快照。成功空记录仍正确返回 free；服务端生成权益仍独立查验，不靠缓存授权。
- 新增 tests/rc-membership-outage.test.cjs 三项行为回归，最终274/274通过（membership-outage-full.log）；diff检查通过。本回合无客户端改动，复用上一单元成功 App 构建，无必要重复构建。
- 本回合0真实模型/短信/支付/业务图片下载，0部署/设备同步。完整RC仍未完成；下一步优先正式支付适配与游客云端迁移，未解锁这些条件前不推送半迁移包。既有外部条件和真机边界见 RC_CLOSEOUT_2026-09-21.md。

## 最新收口：任务锁、额度账本与来源登记（PARTIAL，2026-09-21）
- 按 verified owner/pet 隔离 active lock，并以 CAS 拒绝迟到写回；开发旁路要求服务端白名单。额度预占/结算/释放具备幂等性，未知受理结果不重发；操作身份跨重试保留。
- 服务端签发绑定账号/pet/session 的上传票据；来源精确 fileID、内容摘要、下载体积与解码前尺寸校验已落地。新增两项 server-only Schema，尚未部署。
- 最终271/271通过，App构建成功，git diff --check通过。实际业务函数使用隔离数据库和 Provider 替身验证，不是真实云端验收。
- 真实模型/SMS/支付0，部署0，手机同步0。完整缺口及文件作用见 RC_CLOSEOUT_2026-09-21.md；游客云端claim、支付闭环、正式短信与新版真机验收仍未完成，不能标完整目标成功。

## 最新工作单元：草稿保留、历史候选地址与正式会话撤销（PARTIAL，2026-09-21）
- 本轮用户回复解锁后，ADB 实测 Awake；只读 Home 为狗狗、ready=true、已解码宽度2048。与上一单元 Yyuy 恢复中的状态不同，但本次没有切宠/重录，不能推论缓存写入故障永久修复。未新增业务图片请求；不再要求重复解锁。手机仍保留此前 C1 包，未同步当前半迁移构建。
- 缓存草稿保护已落地：只读资产所属 namespace/pet 的会话候选元数据，跨重启保护未保存 master/thumbnail；读失败或结构异常中止淘汰/清理。候选移除后副本可按既有 LRU 清理。新增 common/avatar-cache-retention.js 与行为回归，未读聊天或扫描整库。
- 修正上一单元历史候选恢复仍借 active job 查询的问题：新增只读 getCandidateDisplayUrls，按已验证账号、pet/job、预期 master/thumbnail 校验，仅签发已成功候选地址；不轮询 Provider、不改当前 job/session。客户端所有 avatar 请求显式携带官方 token，不依赖 context.uid/device/IP 确立归属。云函数尚未部署。
- pety-auth 发现正式 checkToken 快捷路径跳过账号查库：真实安装的 uni-id-common 1.0.19 在含 role/permission 的 token 下可直接返回。先用官方 createToken/checkToken + 完全隔离账号/配置复现3个失败，再补最小 status/token/valid_token_date 检查；退出撤销、封禁、审核、注销、改密及账号不存在拒绝，查询故障保持服务不可用而不是误判撤销。未重写签名算法，未修改官方模块。客户端同步识别非正常账号状态且保留业务资料。
- api_pet_avatar/package-lock.json 已使用本地 npm --package-lock-only --offline --ignore-scripts 同步 pety-auth 文件依赖；无安装网络、无真实配置变更。源码守卫与测试不代表服务端已发布。
- 红灯证据：cache-retention-before.log、candidate-history-before.log、avatar-auth-before.log、session-revocation-before.log；分别对应草稿保护、历史候选、官方身份入口、真实官方模块会话撤销。官方模块测试不使用真实密钥/账号/短信/数据库。
- 当前仍需完成：上传来源文件所有权、跨账号 active job 锁、游客云端凭据/保留旧额度的 claim、原子权益账本与开发旁路隔离、支付/短信外部条件；不能部署半套鉴权造成现有游客生图直接中断。候选确认后同字节 final 本地复用尚未实现；真实 native 文件路径、20次/重启/断网与真实纪念底栏仍未验收。
- 模型/SMS/支付调用0，云部署0，开发包同步0。既有CDN累计计量不完整且接近200MB上限，停止新增真实图片下载，继续零调用代码工作。完整目标仍 active。
- 验证收口：257/257全量通过（session-revocation-full.log）；App本地构建成功（build-session-auth.log，首次因沙箱父目录读取失败，获准后本地重跑）；git diff --check通过。不是新构建真机验收。下一单元优先完成来源上传的服务端归属登记与跨账号任务锁，继续维持0真实模型调用。

## 最新工作单元：统一持久缓存接入与失败恢复（PARTIAL，2026-09-21）
- 本机 App.vue 安装懒初始化 native 缓存；avatar-display-asset 及工作台预加载共享 namespace / ownerVersion / pet / master / file 身份，发布经过验证的私有本地文件地址。H5 仍保留原路径。不是云端或手机版已上线证明。
- 修复缓存目录盘点暂时失败后的恢复、LRU索引写入失败误删有效图、临时IO错误误删文件；原生CSS和image共用受路径约束的file URL。相关回归先失败后通过。
- 候选图改用 readAvatarCandidateTransport，只读取已有任务响应，不回写当前job/session；人工“重试”单独透传userRetry，自动返回/URL续期不能解除重试限次；真实预加载解码错误需requestId及URL同时匹配，20秒超时不删除有效文件。
- 缩略图错误需pet/master/file及实际URL匹配；至多一次自动替换，再失败回退到已有master。修复迟到错误删新图和连续解码失败重复下载；没有模型调用。新增 tests/rc-candidate-transport.test.cjs，扩展 tests/rc-avatar-cache-integration.test.cjs；未改C1视觉。
- 用户解锁后只读核验：Honor Awake，Pety前台，Home为Yyuy、ready=false、无已解码图，提示“正在恢复形象”。已有两宠均为陪伴；纪念真机样本仍缺。记录 current-image-state.json 和 rc-20260921/unlocked-pet-coverage.json。本单元未切宠、未重录、未下载业务图片，没有把历史成功MP4当成本次结果。
- 先前真实CDN记录存在未计量部分且接近200MB硬上限：停止新增真实图片下载，后续先推进零调用工作。不能把总流量写成精确200MB或声称预算尚有可用余额。
- 验证：245/245全量通过，App本地构建完成，git diff --check通过；日志 cache-final-full.log、build-cache-final.log。缓存恢复红灯 cache-recovery-before.log、thumbnail-recovery-before.log。仅本地模拟字节/所有权行为，不是真机缓存验收。
- 没有同步当前包含未完成账号迁移的整个开发包，手机仍为此前C1包；没有部署、短信、Provider、模型、支付、config/Schema/uni_modules更改或Git提交。本单元停止点不是完成RC。
- 剩余缓存边界：真实native文件路径、20次切换/重启/断网未验证；候选复制为final后的别名复用未实现；草稿跨重启pin尚未实现。下一步只推进这些零网络代码边界及账号云端归属前置，暂不执行verify-c1-native-runtime.cjs、不重复要求用户解锁。

## 最新工作单元：游客资料明确选择与可逆本机导入（PARTIAL，2026-09-21）
- 上一目标回合只复核C1连接/旧证据，对完整RC主链路属于no-progress。本单元重新读取总目标并修改正式代码，不以C1局部交付替代总目标。
- 账号页现在提供保留游客资料/导入此账号，聊天单独勾选且默认不选；“我的”对未选择账号显示入口。保留后可改选；游客原件、petId、会员/额度历史、任务和AI授权不自动迁移。不存在云同步/所有权转移的伪成功。
- common/guest-data-import.js + scoped-storage.js：按精确key快照、源/目标变化检查、冲突不覆盖；账号私有同步事务日志。任一中断在下次业务读取前恢复，提交后才通知；撤回拒绝覆盖后续编辑，移除导入副本不会删除游客原件。新增账号纪念建议也纳入撤回保护；空聊天读取产生的兼容标记不阻塞撤回。
- 原本账号页A的迟到资料可覆盖B，A打开的退出确认也能登出B；已先复现两项行为失败（account-page-before.log），加scope/version与页面生命周期守卫后通过。
- 导入来源保留localImportPending；仅允许本机现有主图/原照显示，不续签旧游客云URL、不复制任务、不允许借新账号重置生成次数。云端文件与额度claim尚未实现，因此导入与完整账号闭环仍PARTIAL，不能把目前构建交给用户当正式版本。后续应以服务端凭据验证关联，不能删掉这一保护来让测试通过。
- 只读审查发现新纪念建议可能被撤回成孤儿、本机原照未显示；真实红灯import-review-before.log。修复后增加实际normalizePet/getPetList与chat-store读回测试，原始资料保持。
- 当前全量227项通过，tests-import-final.log；本地App build-import.log成功，输出rc-20260921-import-app；git diff --check通过。账号真实SFC隔离浏览器前后预览account-preview：360/390/412与1.3倍字号无横溢出；不是手机或真实账号导入验收。
- 本单元不读取真实游客聊天、不迁移开发者实际资料、不同步手机、不部署、不发短信/模型/支付、不新增业务CDN下载。手机继续保持已验证C1包。
- 下一可执行项：把已有avatar-file-cache接入现有avatar-display-asset及工作台同一事实来源，先零网络行为验证；补剩余页面账号守卫，服务端guest凭据/文件归属/保留历史额度claim及官方登录部署基线。短信仍等待明确授权测试号码与控制台开通条件，不能阻塞其他P0/P1。完整目标active。

## 最新接续：2026-09-21 账号隔离集成与短信客户端（PARTIAL）
- 前一目标回合只复核C1现有证据，未推进发布候选剩余主链路，按 no-progress 对待；本单元恢复原目标并实际改代码，未把C1验收代替整体验收。
- 账号命名空间已接入本地宠物/记录/聊天/反馈/生图会话/主题与色板；原游客key原地保留，不自动导入账号。身份未恢复时禁止读游客数据；Home引导也延后，避免DATA_SCOPE_UNRESOLVED。账号变化同步清展示快照与URL缓存，迟到旧回调不能写入新账号。游客导入/保留选择、其余页面及云端归属仍需完成，未宣称迁移闭环。
- 实际修复的竞争：旧生图失败回写B、旧反馈上传后以B提交/删除B草稿、旧纪念确认修改B、旧日历表单保存、旧URL失败拉黑新账号图片、旧色板写入B。同账号确认仍将结果写回发起宠物，未因切宠丢确认结果。回归失败证据位于 unpackage/rc-20260921/*scope-before.log。
- 短信页面默认验证码入口，保留密码/游客。按已安装uni-id-co源码区分send-sms-code、login-by-sms和login-by-pwd图形挑战；修复原未传发送captcha和短信登录误用密码场景。验证码/密码仅内存，错误就地显示，取消旧challenge响应。发送前仍检查协议与真实能力门，未开放未配置服务。
- common/sms-send-gate.js：设备本地只持久deadline/status，不保存手机号、OTP、captcha。发送前持久冷却，处理中single-flight；后台/重进按截止时间恢复；未知响应等待，不自动重发；已受理不等于已收到。仅确定的发送前拒绝允许立即修正。此为UX防重，不替代官方服务器限流与鉴权。
- 最新全量203/203通过，App本地build-sms.log成功，git diff --check通过。短信9条行为回归；SMS场景与默认入口有修复前断言失败，缺失onShow的红灯只证明缺少恢复hook，不当成真实后台实验。尚未真机同步此未完成迁移；手机保留已验证C1包。
- 当前真实短信/取号/Wan/VIAPI/DeepSeek/支付均0，云端部署0。CDN沿用先前真实录屏累计未知且接近上限的记录，禁止再宣称业务下载0；本单元不新增图片下载。
- 外部条件：本地仍未配置短信，云端当前余额/模板及明确授权测试号码尚未获得；不能标READY。官方接口依据为已安装1.1.28源码；服务开通要求另核对 https://doc.dcloud.net.cn/uniCloud/sms/service.html 。本地能力门尚未改成真实云端状态检查。
- 下一步：登录取消与内部目标回跳→账号迁移选择/剩余页面守卫→统一持久文件缓存接入主资产层；并继续完成短信控制台条件/必要云对象部署基线。不得把当前半迁移构建推送真机。全目标 active。

### 同单元收口：登录提交、取消、回跳已修复
- 已完成上述登录取消与回跳项。`auth-redirect.js` 仅允许已有业务路由及各页面实际读取的query；禁止认证自循环、官方webview/admin入口、未知/重复参数。tab直接switchTab，已有目标页复用；注册返回复用原login，默认成功回跳跳过重复auth页。
- 只读审查发现并修复“token已落盘但等待profile期间仍可取消”的矛盾：官方登录响应通过后同步完成会话提交并返回，非关键资料后台刷新；原token归属检查保留。`auth-commit-before.log` 是实际修复前断言失败；未把模拟会话当真实收码成功。
- 修复隐藏登录页的迟到短信回执重建interval、注册验证码乱序/卸载回写、错误分支等待captcha后继续跳页。再审查未发现新增P0/P1，仍需原生/真实服务验证。
- 最终全量212/212通过；`unpackage/rc-20260921/tests-sms-final.log`；App构建 `build-sms-final.log` 成功，输出rc-20260921-sms-app；git diff --check通过。
- 登录真实SFC的本地浏览器前后图：`unpackage/rc-20260921/login-preview/`。360/390/412、短信挑战及1.3倍字体无横向溢出；已查看390默认及360大字截图。仅浏览器隔离预览，短信available模拟分支不代表云端可用，验证码不会请求云端。当前英文文案/原生键盘与自动填充仍未验收。
- 预览初次启动缺Playwright bundled Chromium，已停止该进程并改用本机既有Edge，无额外浏览器下载。预览脚本自身会关闭server/browser。
- 已向用户请求明确授权测试手机号（最多5条）；待回复，不从历史图片或手机私有资料推断。仍未发短信、未取号/模型/支付、未部署、未同步半迁移包。
- 精确下一工作单元：补可逆游客导入/保留选择及剩余页面归属守卫；随后在avatar-display-asset统一接入avatar-file-cache，用同一namespace/version贯通工作台/首页/头像/取色。真实CDN累计接近预算且有未计量部分，先零网络验证，不重复录屏下载。短信真实控制台资格及官方对象部署基线同步推进；未完成前不得宣布RC交付。

目标：按用户 2026-09-21 pasted-text-1.txt 完成可实际使用的缓存、官方登录、账号隔离与服务端会员闭环。未完成，不声明 READY。

## Preflight / 基线
- 分支 feature/calendar-persona-auth-polish-v1，保留全部已有未提交成果。
- 本地源码基线：unpackage/rc-20260921/baseline，111 文件及 SHA256 清单；排除真实 config、密钥、fixtures、图片及构建产物。按清单逐文件比较恢复，禁止整仓回滚。
- HBuilderX 当前 5.26.2026091802（历史 5.24 已过期）；Android PGT_AN20 已通过 ADB 检出。当前包/云空间/已部署版本仍需重新验证。
- HBuilderX UI 读取授权超时；浏览器连接 nodeRepl.fetch failed。未获得控制台当前服务状态，不能把本地 NOT_CONFIGURED 当作云端事实。
- 两个只读子审查完成：认证/数据；会员/支付。主代理单点修改公共模块。

## 队列（按序持续，不等单项确认）
1. P0 安全：本地完成六处官方安全补丁，6条行为回归先全部失败再通过；另补秘密日志回归，共7条通过。详见 RC_OFFICIAL_MODULE_PATCHES.md；云端未部署，仍需核对版本。
2. P0 外部条件：确认 ali01 目标、云版本、短信余额/测试模板、授权测试号码；只做健康/配置检查，禁止付费模型探活。待确认。
3. P0 图片/数据：已有仅 URL 内存缓存，没有持久字节缓存；设计账号/游客隔离与可逆本地旧数据兼容，然后集成同一资产层。待做。
4. P1 官方 token、验证码主登录、倒计时、回跳、资料失败保留会话；账号闭环。待做。
5. P1 正式身份/文件归属、权益池/原子预占、受理未知、开发白名单、uni-pay 官方适配。待做。
6. P2 核心流程/反馈/双语/UI/证据包，在 P0/P1 可执行部分完成后开始。

## 已确认源码风险（不是云端漏洞利用结果）
- uni-id-co 1.1.28 未配置短信/邮箱会写入通用测试码；短信错码日志含提交码；签名错日志含 requestAuthSecret；registerAdmin 允许首管理员 bootstrap。
- verify-code 先 get 后无条件 update，可并发重复消费。
- user_get_profile / membership_get 缺官方 checkToken；前端资料网络失败会清正式 token。
- 本地宠物/聊天无账户命名空间；客户端会员与服务端是两个来源。
- 生图免费3次按整个 owner统计，未按宠物；会员无原子预占；开发旁路仅客户端请求+config开关；受理未知被当作失败。
- 没有 uni-pay、正式SKU/订单实现；不代表商户控制台已核查。
- 本地 presence-only：uni-id 有既有 token/password secrets（没有输出或旋转），无短信service/scenes、一键登录及OAuth配置。Appid=__UNI__A23A379；launch App remote / default local / provider alipay。不能据此断言云端未配置。

## 费用 / 部署
本轮至今：短信0、取号0、Wan0、VIAPI0、DeepSeek0、支付0；业务图片下载0（尚未开始字节验证）。官方文档读取不属于业务图片CDN预算。
尚未部署。本轮修改函数/Schema必须先记录云端当前版本与恢复途径，逐项部署；不上传全部Schema，不旋转既有secret。

## 2026-09-21 已完成工作单元：正式校验与会话顺序
- 官方 CLI 当前核实 ali01 / env-00jy6ft635sf；云端函数清单只有 api_deepseek、api_pet_avatar；uni-id-pages 所属云对象清单为空。公共模块清单含 uni-config-center、uni-id-common、uni-open-bridge-common。这是本轮只读云端查询，尚未改动部署。
- 新增 `common/pety-auth` 云公共模块，使用 `uniID.createInstance({context}).checkToken(...,{autoRefresh:false})`；user_get_profile / membership_get 接入正式验证。拒绝客户端 uid、context 伪身份回退，缺 token 为游客；服务不可达与 token 撤销分开。仍待部署与云端集成验证。
- auth-store：旧 token 的资料响应不能覆盖新会话；有效官方登录可先建立 free 身份，非关键资料网络失败不清 token。服务错误与明确撤销分开。
- auth-session / 登录注册页：请求版本覆盖登录、取消、退出；迟到的旧登录/退出不得覆盖新会话；无效登录响应不清既有有效会话。离页取消仅失效本页拥有的请求。
- 官方客户端 store 增加 token 所有权守卫；基本资料成功而实名服务失败时保留基本身份；原模块备份及升级规则已记录。
- 证据：`rc-auth-operation-order` 5 条、`rc-auth-session-races` 3 条、`rc-official-profile-races` 4 条通过；原行为失败日志在 unpackage/rc-20260921。官方资料测试最初有加载器语法问题，已修正加载器，并重新对备份原文件取得真实状态断言失败，未把加载器失败算作回归证据。
- 设备接续：已通过 HBuilderX 5.26 同步开发包；随后 AOD 锁屏，尚无最终切宠录屏。同步时显示本地调试网络失败后回落云函数及 URL_UNAVAILABLE:SYS_ERR，解锁后必须核验恢复。上一轮全量136通过和 App 构建通过在会话顺序新改动之前，不能当作本单元的最终全量结果。
- 当前单元未调用短信/模型/支付，未部署云端。接下来 P0 持久图片字节缓存和账户数据命名空间；全目标仍未完成。

## 2026-09-21 已完成工作单元：持久字节缓存核心（PARTIAL，未接入主路径）
- `common/avatar-file-cache.js`：显式 namespace/pet/master/revision/file/purpose 身份；签名 URL 不入索引；同身份并发合并；取消单消费者不终止共享下载；账号退出再进入以 ownerVersion 拒绝旧请求；校验大小/解码格式/尺寸/可读性，声明 2K 的资产不能接受1K替代；持久化后一次索引提交；150MB默认LRU保护最近两份master及被pin的草稿；重试退避且最多3次自动尝试。
- `common/avatar-file-cache-native.js`：App私有 `_doc/pety-avatar-cache-v1/` 目录；uni.downloadFile 25秒超时与超大响应中止；uni.saveFile 后只使用其返回路径，再移到独立缓存目录；删除只允许该目录副本或本次下载产生的临时文件，不扫描相册或业务原图。
- 字节指标分别为完成文件正文大小和平台进度累计值，不将 load 事件当下载。统计目前仅隔离模拟，**真实App仍使用原资产层，不能宣称已改善真实流量**。
- 测试：核心12条 + 原生适配4条行为通过；包括20次复用、重启/断网、签名变化、文件丢失、并发、取消、账号切换、坏数据/小图拒收、提交失败回收、路径限制、LRU与有限重试。不是设备上的真实20次验收。
- 接入前必须完成：账号/游客namespace与ownerVersion来源；在现有avatar-display-asset中安装同一cache实例；工作台/头像/取色/纹理共用本地路径；本地文件失效与URL失效分开；账号业务数据可逆隔离。不能在App中先启用另一套互不相认缓存。未修改主路径，手机继续保留此前C1构建。
- 仍需补：异常删除后的孤儿副本盘点/回收策略（限自建目录）、进程崩溃窗口回收、文件失效时的并发invalidate保护、真实磁盘/网络字节和热切换时延。现有缓存核心不能替代这些终验。
- 官方接口依据：[uni文件API](https://uniapp.dcloud.net.cn/api/file/file.html)、[下载API](https://uniapp.dcloud.net.cn/api/request/network-file.html)、[图片元信息](https://uniapp.dcloud.net.cn/api/media/image.html#getimageinfo)、[HTML5+ IO](https://www.html5plus.org/doc/zh_cn/io.html)。没有改Provider、图片尺寸或生成Prompt。
- 最新本地全量161/161通过，App构建 `unpackage/rc-20260921-app` 成功，git diff --check通过。旧 auth-ui 中依赖具体if语句的断言改为6类无效登录响应都不得写入/删除既有会话的行为断言，没有放宽鉴权要求。
- 手机再次查询仍AOD/Dozing。没有真实短信、取号、模型、支付调用；没有本单元真实图片CDN下载；没有云端部署。不设置未授权/未实现的后台任务。

## 接续命令
- node scripts/rc-baseline.cjs 已执行，禁止重复覆盖基线。
- 已完成：认证硬化、官方token适配、会话时序、持久缓存核心和App文件适配（主路径尚未启用）。接续优先：可逆账户本地隔离及ownerVersion；接入统一资产入口；短信真实外部条件与官方云对象部署基线。
- 最新全量：`node --test tests/*.test.cjs tests/*.test.mjs`（PowerShell先枚举文件）；日志 `unpackage/rc-20260921/tests-current.log`。App日志 `build-current.log`。
- ADB: D:/HBuilderX/plugins/launcher-tools/tools/adbs/adb.exe devices -l
- 当前全局目标保持 active；本记录不代表终验通过。

## 2026-09-21 接续：真实设备恢复、同 master 空窗与缓存生命周期
- 本单元属于 progress：实际修改组件/缓存并取得新的真机证据；没有完成全目标，不应标记 complete。
- 手机已 Awake 且 Pety 前台。首次真实切白猫：隐藏首页身份已更新，但图片持续恢复，脚本超时。随后狗图也出现“先加载成功，displayFileId 暂时变空，stage identity 改变并清掉已解码图”的序列。读取了原生截图和 DOM 状态，没有用 fixture 替代。该失败截图保留 `unpackage/home-c1-runtime-device/recovery-current.png`；首次通用 trace 被后续恢复检查覆盖，因此不能把当前通用 trace 当作首次失败原始记录，首次时间序列在本轮工具输出。
- `PetPortraitStage.vue`：final 的传输地址空窗不改变 pet/master 身份；保持已加载 current 节点与路径，不另建 previous 节点去请求同 URL；跨宠、换 master、换真实衍生资产仍清空。`home.vue` 保存仅当前 pet/master 的已加载纹理地址，避免主体保留但背景纹理消失。没有改 C1 样式/配色。新增行为回归先实际失败再通过，`stage-gap-before.log`。
- HBuilderX 原有运行会话82207仍真实存活并自动差量同步，未重复启动或部署云端。修复后真实录制完整白猫→狗→白猫→狗，及“我的/问诊/我的→首页”。最终证据目录 `unpackage/home-c1-runtime-device/run-1789975257186/`：native-switch.mp4、native-return.mp4、native-white.png、native-dog.png、native-events.json、native-render-trace.json、image-transfers.json、3张 first-frames*.png。脚本现在每次新建run目录，避免后续覆盖证据。
- 已逐张查看实际MP4按30fps提取的3组首屏接触表：新视频约0.883s、2.083s、3.317s首页首次可见时分别狗/白猫/狗，姓名一致，未看到原来三个切换位置的旧宠画面。原视频2.63–2.73 / 6.80–6.88 / 11.04–11.12对应操作的时间已改变，不能机械比较同一秒。3次隐藏首页断言均在点击首页前正确；DOM ready相对select-tap约180/177/186ms，属于DOM事件时延，不冒充精确首帧时延。返回录像生成成功；全20次、正常重启和断网仍未做。
- 设备只有两只current宠物，没有纪念宠物样本；未修改真实宠物关系阶段。纪念底栏只有先前预览/配置证据，真实纪念模式仍未验证。
- 真实下载首次取得CDP测量：3次有网络传输的图片响应合计17,434,057 encoded bytes（含协议开销），另2个图像响应encoded=0。decoded字节包含缓存解码，不能当流量相加。覆盖WebView，不覆盖native getImageInfo等；首次失败尝试未计量，**当前总CDN量未知，不能继续写本轮下载0**。后续先接统一字节计量和预算，再做20次，不继续无计量重复录屏。Wan/VIAPI/DeepSeek/短信/取号/支付均0；未部署云端。
- `avatar-file-cache.js`：同步失效代际屏障，拒绝晚到旧读/旧下载，快照输入描述避免响应期被改成另一宠；坏索引单行隔离；App启动只盘点专用副本目录并回收无索引孤儿，删除失败仍计入容量。`avatar-file-cache-native.js`：目录分页枚举、只识别平层缓存文件、路径别名归一，不递归/扫描其他资料。24条核心/适配行为通过。**仍未接入主路径**，账号namespace隔离是下一个必要前置；不能据此声称持久缓存真实验收成功。
- 缓存新增竞争用例第一次对旧实现运行挂起，已终止，不把该次运行当作有效红灯证据。当前用例均完成并通过；同master舞台回归有明确修复前断言失败证据。
- 最新全量171/171通过，App构建 `unpackage/rc-20260921-app` 成功；完整H5仍未验证。后续优先：账户/游客可逆隔离与ownerVersion→接入统一缓存→真实20次/重启/断网字节验收；随后官方短信外部条件/部署基线、账本与支付。保留当前真机可用C1构建。

## 2026-09-21 短信真实发送推进

- 用户授权测试号码最多5条并确认服务开通；不记录号码、OTP、密钥。备份位于已忽略的 unpackage/rc-private-auth-baseline，禁止进入交付ZIP。
- 现有ali01部署：根公共模块uni-config-center（保留原认证secret，仅补短信测试场景），uni-captcha、uni-cloud-s2s、uni-id-co；新增uni-id-users/opendb-verify-codes/uni-id-device/uni-id-log。用户表仅本人读，其余客户端权限关闭。未上传当前api_pet_avatar业务改动、未初始化或导出数据库。
- 原生手机仍旧包；通过官方CLI launch web运行当前登录页，真实云端验证码可用。直接Vite缺云空间关联，已改用官方启动入口；并非当前仍缺Sass插件。
- SMS入口原来硬编码NOT_CONFIGURED，改为PARTIAL/callable，发送和登录使用callable判定；不宣称认证全链路READY。保留图形验证码、协议勾选、持久冷却与账号隔离。新增脱敏errCode日志，纠正没有实际刷新却说“已换图”的提示。
- 发送接口4次：1—3验证码校验拒绝，无发送受理；4成功受理，UI显示倒计时和查看短信提示。可能计费1条，账单未查。没有模型/支付/业务图下载。等待用户OTP完成登录；不读取短信收件箱、不查询验证码库。
- 全量299/299，日志sms-live-full.log；diff检查通过。App构建build-sms-live.log成功，未同步手机。

## 2026-09-22 登录后资料链路补齐

- 上次仅重复收码说明没有新进展；本轮核验实际部署，确认云端缺两个资料读取函数。注意 CLI 必须带 --cloud，本地列表不代表部署。
- 新增部署 user_get_profile / membership_get 及私有公共模块 pety-auth / pety-membership-orders。之前真实云端均不存在，未替换已有函数。无Schema修改，无生图后端部署，购买和付费权益开关仍关闭。相关8项部署前回归通过。
- 真实云端只读4次：两接口游客未登录/free；无效token均拒绝 uni-id-check-token-failed。没有读取任何真实账号记录、没有增加短信或模型调用。证据 profile-live-readonly.json；源码SHA在profile-deployment.json。
- 恢复边界：本轮新增资源没有旧版本可恢复。若部署异常先停用新增接口，不回退官方短信对象、不轮换认证secret；已确认旧C1手机未同步。正式token下资料/退出仍待用户收码，不能以游客检查代替。

## 2026-09-22 短信校验次数闭环

- 前一轮为有效进展（补部署资料查询并真实验证），本轮继续认证P1。原验证码消费仅按正确code查询，无单条尝试预算，且旧码可用；3项隔离回归先真实失败，日志sms-attempt-before.log。
- 增加每条短信验证码5次原子校验预算、只接受最新mobile/scene记录、保留并发一次消费；新码用完不复活旧码。旧记录兼容，邮箱/图形验证码不改。相关11项、全量303项通过，sms-attempt-full.log；diff检查通过。本轮仅服务端/测试/Schema变化，客户端App构建沿用上一轮已通过版本。
- 部署前保存实际云端uni-id-co与验证码Schema到私有基线目录。Schema默认上传曾跳过，明确force后成功；随后uni-id-co成功部署。发布后真实createCaptcha返回0和有效图片，证据sms-attempt-deploy-smoke.json；不是OTP登录通过。
- 本轮短信发送0、模型0、支付0、图片CDN0；总短信成功受理仍1条，未确认手机送达/登录。完整登录等待用户收码信息；不自动重发、不查验证码库。

## 2026-09-22 官方支付适配推进（非支付闭环）

- 核对uni-pay 2.4.2源码及官方文档，首次业务回调失败后重复通知不会重跑，因此需要独立恢复。新增私有uni-pay-adapter：从服务端订单查原始通知，调用官方SDK重新验签，核对订单/身份/金额/渠道/商户/币种，持久入账后显式等待恢复激活。批量最多20条，不在return后继续工作。
- 官方模块本地安装并保留上游文件校验锁；支付对象公开入口无条件关闭，无商户配置改动，无云端支付部署。不能将私有适配器描述成已接通正式回调入口。
- 合成商户密钥+签名XML通过实际官方SDK离线验签，篡改金额被拒。错误金额/缺商户币种/退款/仅传输SUCCESS拒收，激活失败下次可恢复。4项适配回归、全量307通过。不是实际渠道沙箱或付款。
- 剩余：服务器业务订单入口与官方notify挂接、部署后的定时恢复驱动、真实退款凭据来源、正式SKU/价格/周期/商户渠道及沙箱。支付宝无签名币种事实时保持拒收，不从本地订单伪造。真实短信/模型/支付新增均0。

## 2026-09-22 服务开通确认与入口验证
- 用户再次确认DCloud短信服务已开通；此前已受理1条，尚无真实收码登录证据，旧码已过期。已询问是否方便接收下一条并在登录页输入；本单元没有重发、不查验证码库。
- 收口上一单元支付入口：payment-entry.js与uni-pay-co/pety-entry.js连接服务器订单、金额和归属；官方公开总门禁仍关闭。3项行为回归验证客户端金额/身份注入拒绝、先保存attempt再调用、跨账号读取拒绝。当前仅本地源码，不开放购买。
- 全量310/310、App构建成功、git diff --check通过。初次构建被沙箱父目录权限阻止，授权重跑成功。没有同步手机、部署支付、调用模型或付款。
- 下一步：用户可收码时做真实SMS登录；支付notify/恢复运行时与状态投影尚未接线，不能声明支付闭环。旧游客云端归属迁移与RC真机统一验收仍未完成。

## 2026-09-22 支付业务通知接线（本地，未开放）
- 上一工作单元有实质进展：服务器订单入口完成行为验证。本单元核对官方service/pay：支付记录先置成功，再执行业务notify；重复通知不会自动重做失败业务回调，因此必须保留可恢复路径。
- 新增payment-runtime.js，装配真实收据、grant、会员schedule和官方SDK适配；notify/pety_membership.js已挂接官方type目录，重读数据库原始通知并重验签，await持久入账后才返回true。失败只记固定脱敏标签，不泄露回调内容。
- 复用settle统一通知和恢复逻辑；隔离测试以实际模块验证中途写失败、重建runtime补跑、重复通知只形成一个10次池。另执行实际notify文件验证失败返回false、恢复后true、未配置拒绝。没有真实支付或沙箱交易。
- 全量313通过(payment-runtime-full.log)，随后新增实际hook验收单测，相关4项通过；客户端未变，App构建沿用build-payment-entry.log。diff检查通过。新增短信/模型/业务CDN/支付/部署均0。
- 仍缺：线上恢复任务驱动与坏记录分页、订单状态投影、可信退款凭据来源、正式SKU/渠道/沙箱。公开_before门禁保持关闭，禁止把本地接线当上线完成。短信仍等用户方便收码，未自动重发。

## 2026-09-22 订单状态读取闭环（本地）
- 前一工作单元有进展：notify实际接线及失败恢复证据。本单元修复getOrder一直读取prepared/not_granted陈旧字段的问题；payment-status.js依据私有已验签收据和会员schedule派生待确认、已支付待激活、待生效、生效、过期、撤销。
- 先执行orders.read归属检查，再查私有收据；商户/交易标识不返回客户端。数据库错误不伪装未支付，未见收据不认定付款失败。查询不调用Provider、不发权益、不修改账本；当前时钟仅由服务端传入。
- pety-entry.js已接该投影，官方service/pay改为创建支付时懒加载，单纯查业务订单不要求加载商户SDK。公开支付总门禁仍关闭。
- 新增3项投影行为回归，实际runtime故障→补跑测试也验证pending_activation→active；全量317/317及diff通过。仅服务端与测试变动，App构建沿用build-payment-entry.log。本单元短信/模型/支付/CDN/部署均0。
- 下一步：恢复任务的公平分页与服务器触发入口；仍缺正式SKU、商户配置/沙箱、可信退款来源。短信收码登录、旧游客云端迁移和RC真机整体验收仍未完成，不标READY。

## 2026-09-22 恢复队列公平分页
- 上一单元完成订单状态投影，有实际进展。本单元检查reconcile原来每次取最早固定批次，异常记录会一直占住名额。
- 增加私有reconcilePage，按_id稳定键集分页，游标越过失败行；成功记录移出队列不使后续偏移跳项。每页最多20，游标格式受控，扫尾返回null以便下一轮重新检查之前失败项。保留reconcile兼容接口。
- 2项分页契约先失败（缺少方法，非原运行时重现），实现后通过；用5条记录验证前2条失败仍处理后3条且不误标失败行为成功。相关10项通过，全量日志recovery-pages-full.log；diff通过。
- 未接定时触发/持久游标，尚不能声称线上自动补跑。没有客户端变化、部署、短信或支付调用。下一步需要把这一私有分页契约接到有持久进度的服务器恢复任务；商户与SKU未配置前仍不开支付。

## 2026-09-22 持久恢复任务与官方定时入口（未部署）
- 上一单元完成公平分页，是有效进展。本单元新增payment-recovery-worker：一轮最多10条，私有集合保存cursor/version/90秒租约；CAS避免同时处理，超时接管后旧owner不能覆盖checkpoint，正常错误释放租约保留进度，崩溃依赖租约到期与幂等重放。
- uni-pay-co._timing→pety-recovery.js已接runtime和worker。官方文档确认_timing不执行_before/_after，故定时入口另检查enabled和recoveryEnabled均true；本地配置未添加，triggers仍为空，没有部署或真正定时任务。依据 https://doc.dcloud.net.cn/uniCloud/trigger.html 。
- 新增pety_payment_recovery.schema.json（客户端权限全关闭，未部署）；4项测试覆盖重建worker续跑、并发跳过、失败保留进度、过期owner写入拒绝、默认关闭不接触SDK/DB。全量日志recovery-worker-full.log，diff通过。客户端未改，App构建沿用build-payment-entry.log。
- 支付本地订单→回调→状态查询→有持久进度的恢复入口已接线，但真实沙箱、支付宝币种映射、可信退款来源及部署仍未完成。不能开放商户或宣称支付真实可用。短信收码登录/游客云端归属/统一RC真机验证仍未完成。
- 本单元短信、模型、支付、业务CDN、云部署均0。下一步优先收口账号与游客兼容阻塞；支付正式产品参数和商户未明确前不继续盲目扩展渠道。

## 2026-09-27 恢复执行与真实登录准备
- 用户额度恢复后续跑；原手机重新连接成功。HBuilderX原进程不存在，官方CLI open/launch web经权限恢复后启动localhost:5173的pages/auth/login，确认关联原ali01并编译成功。当前CLI session 76087。浏览器控制工具getState失败（无浏览器可用），因此请用户在已打开的HBuilderX页面手动完成captcha、发送和OTP登录，不读取短信收件箱、不绕过挑战。
- 找到并修复账号摘要实际错误：getAccountSecurityInfo使用旧本地资料推断绑定状态，甚至可返回其他uid的脱敏联系方式；异步服务层未拒绝切号后的旧结果。3项回归先失败，改为官方绑定事实、缓存_id匹配、返回时token/操作版本/uid检查后通过。无云端修改。
- 全量326/326，App build-account-security.log成功，diff通过。随后仅修正auth-capabilities过时的“待部署”文案，相关4项通过；不将能力提升为READY。手机旧C1不覆盖，未部署半迁移RC。
- 已请用户只在登录页输入验证码；用户已确认现在方便接收。代理本单元发送0；用户页面是否发送/收码/登录等待实际反馈，不把历史受理1条当本次成功。模型/付款/云部署0。
- 游客审计结论保持：本地导入可逆且明确选择，云端旧device/IP身份不能安全自动认领；已有缓存跨命名空间复用和旧云文件归属仍未闭环，不能宣称登录后所有宠物操作已恢复。

## 2026-09-27 用户反馈：短信登录交互
- pages/auth/login.vue：合法11位手机号自动请求send-sms-code图形挑战；请求中去重，有加载/失败状态，换号码使旧挑战回调失效。只自动加载图片，不自动发送短信。
- 获取短信后保留图形及输入，错误也保留并就地提示；仅成功手动换图或更换号码时清空。已提交挑战标记不可复用，再次发送明确要求换一张；验证码不持久保存，卸载仍清除。
- 换手机号清短信码，旧号码发送回执不显示为新号码发送成功；区分图形/短信标签、倒计时显示重发含义；加载和发送中防重复点击。
- 新增4项行为回归，全量330/330，App构建build-sms-ux.log成功，diff通过；随后补空手机号不展示历史受理文案，短信相关13项通过。本轮未发送真实短信、未部署、未覆盖手机。真实登录仍待当前用户操作与实际回执验证。
- App构建build-pay-adapter.log成功，未同步手机；git diff --check通过。
