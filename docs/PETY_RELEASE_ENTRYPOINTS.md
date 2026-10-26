# 当前源码入口清单与验证矩阵

检查日期更新至2026-10-11；对应本轮 source-delta-manifest。11日后续增加登录核心控制的键盘操作和反馈函数45秒配置，最新H5/App构建在 release-sprint-20261011-desktop/build。它是源码入口清单，上次只读云列表有5个函数，不能推断所有下面入口已经上线。传统 DB API 不自动执行 schema 权限，服务端仍须逐入口鉴权和归属；ClientDB/JQL 另查真实部署权限。下载器全链路20秒截止的本机HTTP证据见 PETY_RELEASE_OFFLINE_20261011.md；桌面及部署预检见 PETY_RELEASE_DESKTOP_20261011.md。

| 入口 | 允许身份、对象与返回/写入边界 | 费用/限制/超时 | 依赖与审计 | 对应本地证据/远端状态 |
|---|---|---|---|---|
| api_deepseek action=healthCheck | 公开，仅 {ok:true}，不加载配置 | 无 Provider | 存活信息 | release-security-entry；远端响应未验 |
| chat，缺 requestType 的兼容 chat | 正式 token、有效账号；单设备模式下有效 proof；不信 event UID/OPENID/device/isMember；仅 reply/安全提示及自有额度 | 原业务限额 + UID/全局 Provider 日预算；输入/历史限长、服务端固定模型及输出参数；配置内请求超时 | pety-auth、membership、持久 rate limits；日志只留阶段/计数/状态，Provider 原始异常不写日志 | security-entry、provider-logs-before/after、AI 业务回归；本轮真实调用 0 |
| narrative_polish、memorial_persona_builder、memorial_daily_reflection | 正式身份；怀念路径验证 deceased、资料长度；日建议 UID/pet/date 范围；不把客户端内容当云端所有权凭据；原文草稿保留 | 限流 + 费用预算；narrative 受控 15–25s；日建议 claim 防重复 | narrative-polish、反思 claim、服务端脱敏错误 | narrative/人格/反思回归；无真实 Provider |
| carePhotoAnalyze、carePhotoStatus | 正式身份；claim/request 绑定 UID；照片字节/格式校验；返回自己的结果，失败留草稿 | 最多受控照片/报告输入、字节/像素限制、受控视觉配置超时；共享 AI 预算 | care-photo；官方认证与摘要，不暴露 URL/配置 | care-photo-*；无真实识图 |
| createSimilarCaseSearch、processSimilarCaseSearch、getSimilarCaseSearchStatus | 正式身份 + 自己的搜索 job；processor 不信 internal=true；未知类型拒绝 | 持久 claim/一次 Provider 调用、超时终态；必须真工具证据，空结果是 NO_RESULTS | search jobs、native search 来源归一化；普通链接不冒充工具成功 | p0-recovery-v1、pet-avatar-v5、搜索回归；无真实联网工具 |
| api_pet_avatar healthCheck | 公开，最小存活信息 | 无 Provider | 不读配置 | release-security-entry |
| createJob、getJobStatus、getEntitlement | 正式身份；UID+petHash 命名空间、源上传回执、自己 job/历史候选；operation fingerprint 绑定内容；不能选择别人的任务/文件；本机 petId 不是云宠物表的证明 | 免费 3 次、会员周期 10 次；原子 reserve/consume/release；Provider 费用另记；创建 n=1/2K 固定；服务端超时与不确定状态 | pety-auth/session/ledger/source receipt；Wan；先持久回执后存图；不重生已受理任务 | rc-avatar-quota-integration、history/renewal/storage-recovery；无真实 Wan/云事务 |
| issueSourceUpload、completeSourceUpload | 正式身份；服务端随机票据、固定自有路径、绑定 UID/pet/session/slot；实际文件检查；不能凭上传目录认领 | 限定数量、正文/像素、过期票据；下载最坏 20s/每图字节上限；不调用生成 Provider | source-receipts、storage/safe-download | rc-avatar-source-*、safe-download；云端票据/ACL 待验 |
| confirmAvatar、getGenerationSession | 自己的成功候选/生成会话；确认幂等，不再扣次；已丢弃候选不能复活 | 复用正式主图；不自动重新下载 Provider 输出 | jobs/candidate/final 归属与状态 | final-entry-after、rc-avatar-quota-integration |
| getOwnedMediaUrls、getAvatarDisplayUrls、getCandidateDisplayUrls | 正式身份 + 精确自有源回执/成功任务文件；限制批量；未知历史来源拒签；客户端没有直接无归属签名 fallback | 只续签，不改次数；实际公网源站是否私有仍需验证 | avatar-display-asset、pety-auth、server temp URL | account-files/rc-data-scope；真实匿名访问未验 |
| startAvatarCutout、getAvatarCutoutStatus、prepareHeroDisplay | 正式身份/自有已保存主图；服务器配置控制 paid cutout；默认不新生 Hero；优先已有合格资源 | 额外 Provider 费用预算；本轮 VIAPI/额外 Hero 0；受控 cutout 超时 | storage、质量 gate、cutout/hero 状态；原主图保留 | tight-cutout、hero submission；真实 VIAPI 未验 |
| retryAvatarCleanup、submitAvatarFeedback | 正式身份 + 自己的 job/session；只清受控临时候选，不删唯一原图/正式主图；反馈不直接赠送权益 | 限定操作/输入；不调用付费生成 | cleanup plan、头像 feedback schema | cleanup/feedback 状态回归；定时部署未证实 |
| membership_get、user_get_profile | 正式身份/会话，只读自己的会员与最小资料；不接受外人 UID 或本地会员声明 | 不买会员、不扣生成次数；paid period 仅明确服务端 gate 开启 | pety-auth、effective-membership；过期/撤销不授权 | rc-effective-paid-membership、membership-outage；远端版本未验 |
| submit_product_feedback（默认提交、issueImageUpload、completeImageUpload） | 游客只有文字；可信 IP，deviceId 不授权/重置。图片正式身份，服务端 ticket/hash UID 路径，exact fileId、未过期且内容真 PNG/JPEG；submit 只引用自有 ready receipt | 文字身份/IP 5/h、15/day，全局 100/h、1000/day；媒体账号 20/h、IP 60/h、全局 300/day；图片 2MB/16MP；3 张；上传票据 15min | 持久 CAS、SPACEINFO/getCloudInfos 官方上下文、safe-image-download、pngjs/jpeg-js；旧草稿文字保留，旧未证实图片需重选 | release-feedback-security；当前云函数清单未出现 |
| uni-id-co 登录/注册/找回/发码/验证码 | 未登录可达必要流程，但仍正规密码/OTP/第三方验证；OTP 绑定目的/一次消费；registerAdmin 已关闭；不能以 guest/deviceId 获取正式权限 | SMS 持久预占：号码 60s 冷却、5/h、10/day，可信 IP 50/h、全局 100/day（服务端可收紧）；验证码/Provider 官方限制 | uni-id-common/uni-captcha/uni-config-center、sms-budget；不输出 OTP | release-sms-budget、rc-sms-login-flow、account-security-facts；真短信收码未验 |
| uni-id-co 会话确认/取消/status/刷新/退出 | 确认一次短期票据、正式验证后的 UID；版本事务接管；旧 refresh/logout 不影响新会话；status 正式认证；账号证明非设备 ID | ticket 120s；随机 256 位 secret 摘要；staged/enforce/deny 由服务端配置 | pety-auth/sessions；客户端登录序号控制迟到响应 | single-session-v1、auth-session-races；云端 enforce 未验 |
| uni-id-co 私有资料/头像/绑定/密码/注销 | auth 中间件实时账号/token/角色和产品会话；updatePetyProfile 只允许 nickname<=40；签名 exact avatar_file+own UID path；随机 own 上传。短信/第三方绑定继续验证，不能凭同昵称合并 | 正式敏感操作验证；字段白名单；本轮未用真实账号做注销/改密码 | 官方 account/relate handlers，pety profile 方法 | account-files、live-authority、account-security-facts；账号真实恢复待验 |
| uni-id-co 管理 addUser/updateUser/多端授权 | 实时 admin/permission，不信 JWT 缓存角色；账户变更有官方校验 | 正式后台身份；非测试不操作 | middleware/auth/access-control | release-live-authority；真实云后台未操作 |
| uni-id-co externalRegister/externalLogin/updateUserInfoByExternal | 外部正规应用签名/配置验证，不信 internal 参数；不当普通用户管理旁路 | 官方参数/签名校验 | 外部模块安装源码及相关回归 | 不曾调用真实外部系统；签名配置未核实 |
| uni-pay-co 普通入口/通知 | _before 统一支付未开放；本地服务端订单价格/归属/商户/金额/币种验签查单与 inbox 模块不等于可用商户 | 真实付款/退款 0；重复/乱序不重复发放；不接受前端 success 发会员 | 现有 uni-pay/pety-membership-orders，需正式核准接入 | rc-payment-*、rc-membership-*；无官方沙箱/真实通知 |
| uni-pay-co _timing、恢复/补偿模块 | 本地平台调度代码；不是公开 maintenance action；需实际平台身份/部署证据；管理员赠送有来源与幂等 | 有限批量/lease/重试；不清生产账本 | payment recovery/inbox/grants/schedules | recovery-worker 回归；实际调度未部署/未证实 |
| ClientDB/JQL | 本地 uni-id-users 顶层私有读写关闭，资料改走认证云对象；pety 账本/回执/预算 schema CRUD=false；禁止 client 直写权益/所有者 | 必须验证实际远端规则；Mongo 传统 API 仍需服务端检查 | schemas/official middleware | 源码检查和隔离回归；真实 JQL/REST 未验 |
| URL化/HTTP/内部调用 | 云对象 universal 读取正式上下文；普通函数同 auth/own guard；不能把名称或 CORS 当权限；未知 actions 默认拒绝 | 公网不做压测/扫描；本地有限异常输入 | actual main/_before；信平台 metadata，不信 event 声明 | 本地 main 回归；HTTP URL是否实际启用未查清 |
| 宠物档案/日历/聊天/人设/作品/导出 | 主要本机 UID/guest+pet namespace；切账号保留并锁旧数据，迟到 async 不写新账号。没有实现完整云同步/云宠物 CRUD；本机导出是当前作用域 | 不批量拉全部图片；导出/制卡本机执行；离线不伪造会员 | scoped-storage、auth-scope、各现有 store、缓存 | rc-data-scope、chat isolation、实际 H5 本机记录；不是云 A/B 数据验收 |
| 深链/WebView/外链 | 登录回跳限受控内部路由；链接只允许 HTTPS，无 userinfo/敏感 query；noopener/noreferrer；不注入任意云权限 | 不接受 javascript/data/dangerous 链接；公开帮助/协议只是草案 | external-link、官方 WebView、现有 renderer | safe-link/安全回归；真实跨 App 深链未验 |

## uni-id-co 导出方法名（当前安装源码）

公开认证相关：registerUser、registerUserByEmail、login、loginBySms、loginByUniverify、loginByWeixin、loginByAlipay、loginByQQ、loginByApple、loginByWeixinMobile、loginByHuawei、loginByHuaweiMobile、createCaptcha、refreshCaptcha、sendSmsCode、sendEmailCode、resetPwdBySms、resetPwdByEmail、getSupportedLoginType、secureNetworkHandshakeByWeixin；这些不因“需要未登录”免除各自验证。

正式用户相关：logout、refreshToken、closeAccount、updatePwd、setPwd、getAccountInfo、bindMobileBySms、bindMobileByUniverify、bindMobileByMpWeixin、bindWeixin、bindQQ、bindAlipay、bindApple、bindHuawei、unbindHuawei、bindMobileByHuawei、unbindWeixin、unbindAlipay、unbindQQ、unbindApple、acceptInvite、getInvitedUser、setPushCid、getFrvCertifyId、getFrvAuthResult、getRealNameInfo、getTempFileURL、getUploadFileOptions、getPetyProfile、updatePetyProfile、getPetySessionStatus。

管理：addUser、updateUser、authorizeAppLogin、removeAuthorizedApp、setAuthorizedApp。关闭：registerAdmin。外部签名入口：externalRegister、externalLogin、updateUserInfoByExternal。短期票据入口：confirmPetySession、cancelPetySession。正式验收时也要核对远端是否残留旧方法/旧版本。

源码 reference 与审计不代表每个官方第三方渠道都已真实可用。未配置的一键、微信、Apple 等在 UI 显示未开通，不能用模拟成功代替。
