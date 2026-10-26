# 归爪发布安全收口续跑点

2026-10-10，北京时间。本轮本机修复、独立复审、回归、实际H5操作已完成；未部署云端，不能推荐公开发布。完整事实以 PETY_RELEASE_REPORT.md、ENTRYPOINTS、DEPLOYMENT 为准。

- 完整任务书原样保存 docs/PETY_RELEASE_SPRINT.md，SHA256 F79C32604FB4D42217B6A647E533D18ED5D345DD9934EED39A063FA951616ECC，保存前无同名旧文件。
- 分支 feature/calendar-persona-auth-polish-v1，HEAD aff95a5b530a264e0fe496d13e9af3c1ff03082e。进入时约100项既有跟踪改动。基线 unpackage/release-sprint-20261010/baseline/source+manifest。只逐文件恢复，不commit/push/reset/stash/clean或整仓覆盖。
- 已修：正式AI认证/固定UID额度、实时管理员角色、持久SMS号码/IP/全局限额、自有头像签名/随机上传、移除无归属签名fallback、Provider预算和0停止闸门、安全HTTPS/DNS固定/重定向/正文与像素限制、先持久成功回执后存图并继续预占、历史operation fingerprint、新任务清旧回执、普通响应与AI日志隐藏Provider原文。
- 追加修复：反馈图片正式身份/服务端票据/exact owned fileId/真实JPGPNG/可信IP和账号与全局限额；游客保留文字。开发权益要求server UID白名单、development、精确avatar-generation scope、最长7天有效期，仍有正式认证/会话/费用预算。示例Hero自动生图关闭。
- 独立ledger_session_review发现并协助复验本轮回执继承和历史重放回归，主代理已修复；最新恢复/计次/session22项和实际main开发旁路隔离复验通过。feedback专项只读复审无新严重项；security_review参与前轮权限检查。无真实业务调用。
- 最终全量 node --test tests/*.test.cjs tests/*.test.mjs：548通过，final-tests.log。都是本机/隔离数据库，不是真云。初始499中2旧失败为普通链接被误当真工具结果；保留目标改为NO_RESULTS。旧mock仅适配新正式认证/预算/下载/开发期限合同，2K质量阈值未降低。
- 最新H5/App资源构建成功：unpackage/release-sprint-20261010/build/h5、build/app，不是APK。手工构建没有UNI_CLOUD_SPACES关联；H5登录页store顶层无用DB初始化崩溃已复现修复，页面正常，仍提示发送状态查询不可用。store-before/after和h5-login截图可重放。
- 实际新H5：隔离游客虚构长名宠物，日历保存/刷新仍在，陪伴→纪念→恢复，问诊空态、我的、会员说明、设置、登录；390×844截图。语言/模式恢复中文/陪伴。英文仍有中文残留，不标通过；系统大字体/键盘/全部Android返回未验。原设计未改变。
- 缓存真实IO：cache-io-2026-10-09T17-41-25-952Z-c40cca/cache-io-report.json。生产缓存/原生适配器运行在隔离Node桥，真实磁盘+localhostHTTP：冷2请求150字节；20轮40次acquire、新实例、签名变化、离线均无新正文；A/B拒绝；3测试文件备份恢复SHA一致。不是手机/CDN/2K显示证明。
- 当前云CLI alipay/ali01/env-00jy6ft635sf：只列api_deepseek/api_pet_avatar/membership_get/uni-id-co/user_get_profile；保存schema清单未列新增安全集合。用途、远端源码/ACL/enforce/账单不明，控制台打开超时；未上传/下载覆盖。未列schema不等于无数据。
- 手机PGT_AN20，io.dcloud.HBuilder15.26/1526 DEBUGGABLE标准基座，9月21日更新。app-service SHA b3bc96880d038141f49fded9a58f710871f844f2ecf03d4dcd09a0b764fa9980匹配进入时旧资源。未同步新客户端/卸载/清数据。旧包数据说明MP4和安全截图可交付；真实账号截图排除ZIP。
- 密钥：secret-audit全历史708对象发现1历史Provider key，与当前配置摘要不同，撤销未知。当前构建93文件未匹配密钥模式；本地3配置秘密只记位置/摘要，不打印/修改。pety-auth新增解码锁文件registry audit无报告漏洞，不代表全项目认证。
- 共享外部账：SMS0/5、正式取号0/3、文本/视觉/联网业务0/12、Wan0/1默认0、VIAPI0、业务视频0、付款退款0。隔离缓存150字节是localhost；手机已有图片业务CDN正文没有计量，字节未知，不能说0或已实测预算通过；账单/新增金额未知。没有强制冷缓存或批量拉图。
- 外部阻塞：ali01用途/权限与远端恢复基线、授权手机号/A-B测试身份、SMS资质余额模板、真实存储私有性、商户/SKU/官方沙箱、签名APK、历史密钥撤销、法律备案。已一次性询问环境与号码，回复前不发码/不部署。
- 交付 docs/PETY_RELEASE_REVIEW_20261010.zip及HTML索引，只含脱敏源码delta/测试支持/日志/安全截图/实际录屏；排除配置、历史原始Git diff、真实账号截图。构建路径留工作区，不伪造APK。
- 下一动作：取得外部条件后先核对当前Git/空间/手机SHA，保存远端基线，再按DEPLOYMENT先schema后模块函数与配置；真实A/B、双会话、SMS与存储直连验收。无需重跑稳定全量或重做已有功能。
## 续轮核对（2026-10-10 只读）
- 前一目标轮属于实质进展：修复/构建/实际H5/交付产物；本轮也取得新增现场证据，不以重复状态代替进展。
- release-phone-readiness.cjs真实只读运行：PGT-AN20，Appid一致，新资源SHA与手机不同；标准基座DEBUGGABLE且仍有READ_LOGS/GET_ACCOUNTS/MOUNT_UNMOUNT_FILESYSTEMS/WRITE_SETTINGS。没有替换缺云关联的新资源，没有账号存储导出。
- HBuilderX CLI --info再次确认ali01/env-00jy6ft635sf，无关联其他项目；--list common有7个模块，包括pety-auth/pety-membership-orders；action/vf列表空。仍不能证明远端版本、用途或权限。
- 安装插件2.0.70-2026091812源码确认CLI --run调用本地runCloudFunction，不能当远端handler验收。未修改原.param.json、未执行run/upload/download；官方网页文档抓取超时后改用已安装源码核实。
- 外部条件未变化：没有明确测试空间用途与测试身份/号码，无法安全继续真实账号、私有存储、会话、短信、Provider与支付验收。本轮目标继续active，不标完成；下一轮重新审计同一阻塞，不能无限重复本地全量/重构。
- 包已补入新phone-readiness和云只读清单，保留前版ZIP历史；仍无公开发布资格。

## 第三轮阻塞审计与现场纠正（2026-10-10）
- 本节覆盖前文手机版本判断：再次读取手机 app-service SHA 为 f88edb948ba680b1b7ae44b3259facc08c9973ce58c1d23fee29fed86c7e98a4，已从进入时 b3bc... 变化，匹配 HBuilderX 当前开发输出。含反馈票据/格式/旧草稿提示；写入时间早于最终 store 修复。不能称手机完全没新代码，也不能称最终客户端/云后端已验收。
- phone-readiness.json 将手工 production 构建比较命名为 manualBuildResourcesInstalled，另列 hbuilderDevMatchesPhone；保留旧 JSON 为 phone-readiness-before-clarification.json。脚本只读，无主动资源推送、账号存储导出、清数据或卸载。
- 补扫匹配手机资源的13个开发客户端 JS/JSON 文件，总计106个客户端构建文件未命中密钥模式。全历史密钥报告独立保留，历史凭据是否撤销仍未知。
- 审查终态：账本/会话审查完成；安全审查的后续执行被系统网络安全风险提示终止，未重新包装重试，不记作完整审查通过。
- 同一外部阻塞已经历原始目标轮和两次自动续轮：缺明确测试环境用途/部署权限、远端恢复基线、隔离身份与授权号码，不能安全完成真云双会话、A/B隔离、短信与恢复验收。可完成的本机修复/构建/实际H5与缓存IO证据已保存；无新的独立本机任务可以解除这些缺口。
- 完整逐项阻塞审计见 PETY_RELEASE_BLOCKED_AUDIT.md。保存修订交付包后，将目标状态设为 blocked；目标未完成。收到外部条件后再恢复，不以重复全量测试或新增重构冒充进展。
