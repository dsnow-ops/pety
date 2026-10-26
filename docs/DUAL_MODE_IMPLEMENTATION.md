# 双模式实现说明 · 2026-09-28

本轮在当前仓库真实落地了共享写作、册页、六模板导出与两种模式机制。H5 闭环已经运行；App/微信构建通过，但原生导出尚未验收通过，文字模型尚未部署/实测。验收边界以 [验收报告](DUAL_MODE_ACCEPTANCE.md) 为准。

任务原文完整读取自 `D:/downloads/GUIZHUA_DUAL_MODE_CODEX_PROMPT_2026-09-28.md`；根目录没有同名文件。没有把任务文件改写成产物。当前工作区原先已有大量未提交改动，本轮未提交、重置、暂存或覆盖这些工作。

## 实际改动与复用

| 文件 | 本轮职责 |
| --- | --- |
| `common/narrative-store.js` | 账号/宠物隔离的原文、候选、草稿、正式记录、作品、规则回执；旧日历兼容 |
| `common/narrative-media.js` | 原图字节持久化、素材解析/释放、引用检查与删除重试 |
| `common/card-layout.js` | 六模板注册、测量排版、分页、照片 contain/cover |
| `common/card-renderer.js`、`components/NarrativeCanvas.vue` | uni Canvas 生命周期、真实预览/导出、逐页保存与失败重试 |
| `pages/narrative/narrative.vue`、`pages/album/album.vue` | 共用编辑器、候选对照、存原文/存作品、列表/筛选/收藏/隐藏/删除 |
| `common/companion-collection.js` | 1/3/7 个有效日、当前月册、来源图鉴 |
| `common/companion-proposals.js`、`components/companion-prompt/companion-prompt.vue` | 24 个配置提案，首页最多一个轻入口 |
| `common/care-followup.js` | 原照护事件接续，完全不计入生活收藏 |
| `common/narrative-api.js`、`api_deepseek/narrative-polish.js` | 四种可选文字处理、原文版本校验、正式鉴权、共享限流和请求回执 |
| `pety_narrative_requests.schema.json` | 私有请求元数据集合，无原文/候选正文 |
| `pages/home/home.vue` | 主入口按模式写作，保留形象、聊天、档案入口；怀念隐藏周活动/提案 |
| `pages/calendar/calendar.vue`、`common/diary-store.js` | 新记录日期入口、旧记录编辑覆盖层 |
| `pages/care/care.vue`、`pages/profile/profile.vue` | 接续选择、删除宠物时媒体清理与失败重试 |
| `common/pet-store.js`、`common/scoped-storage.js` | 删除本人宠物时清理新内容，允许账号级媒体删除队列 |
| `pages.json`、`locale/zh-Hans.js`、`locale/en.js` | 二级路由与完整新增中英文文案 |
| `scripts/*dual-mode*.cjs`、`tests/dual-mode-*.test.cjs` | 实际构建、隔离浏览器/设备验收、边界行为测试与基线核查 |

复用现有 scoped-storage、账号作用域租约、pet-store、关系阶段、diary-store、consultation-store、i18n、主题 mixin、形象资产解析以及 DeepSeek model-config/checkRateLimit/pety-auth。没有替换全局 tabBar、升级模型或新增图像服务。对本轮开始时的文件哈希核查见 `dual-mode-evidence/local-verification.json`；不是把整个 dirty diff 都归为本轮成果。

## 数据、媒体与删除

每个账号/宠物一个 `pet_diaries_<petId>_creative_v1` 文档，内含 drafts/records/works/receipts/proposals/followups/mediaGarbage。复用已有账号命名空间，游客独立，不自动导入其他账号。正式保存记录与移除草稿在同一次文档写入完成。稳定 ID、revision/baseRevision 阻止旧编辑覆盖；账号 A→B→A 的旧租约仍失效。

输入即同步持久化，离页/返回再 flush。选择同步写入是为了尽量缩短切账号前的丢失窗口；不是宣称写入磁盘失败时仍能保存。失败显示保留页面重试状态。原文独立于已采用候选，编辑原文不会被迟到结果覆盖；旧版本候选可以查看，不能直接采用。

历史日历不批量迁移；无法可靠判定的旧陪伴数据按 care 处理，不冒充有效生活记录。旧怀念内容可查看，旧数据编辑通过覆盖层保留来源。模式切换不重建存储、不复制宠物、不重置回执。

H5 将照片实际 Blob 保存到 IndexedDB，持久引用包含 namespace/petId；临时 blob URL 只用于显示并释放。App 复制原字节到 PRIVATE_DOC 的 `pety-narrative-media` 子目录，不移动、重压缩形象缓存。微信使用 uni.saveFile。主动选既有电子形象走原有资产解析，不生成新图。

删除源记录会移除自动聚合里的来源，未确认的整理草稿也失效；独立作品快照仍在，界面明确提示，需单独删除。删除素材前检查其他记录/作品引用；失败保留 mediaGarbage 可重试。删宠物在现有确认流程中增加账号级清理队列，不召回用户已导出的系统相册文件。本轮没有执行真实资料删除。

限制：新内容无云同步、跨设备恢复或新媒体上传。原项目的显式游客导入流程尚未扩展到 creative 文档/IndexedDB，因此新创作仍留在游客本机作用域；不会伪称已随登录导入。照片写入过程被系统强杀时的孤立文件扫描、已丢失原生文件的清理重试仍需完善/实测。

## 模板与导出

六个 ID：quote、letter、day、collage、date、habit；version=1。方形 1080×1080，竖版 1080×1440。版式含短句小图、信纸、主照片、2–4 图网格、日期横线、习惯侧线等结构区别。默认 contain 保全照片，cover 中心裁剪并在真实成品中可见；无自动主体识别。字体为系统字体，无网络字体/第三方模板。

正文用 Canvas measureText 实测换行，初始 44/48 px、70 px 行高；长文顺序分页，不缩成小字、不造巨型画布。一句话超量提示换信纸；长标题/名字/日期显式报错而不静默裁字，页数上限 100。预览直接展示同一次 Canvas 生成的 PNG，与导出共用布局。作品保存文本/原文快照、模板版本、素材/裁剪引用、来源 ID 与版本，不依赖临时预览路径。

状态机 idle→preparing→rendering→ready→saving→saved；failed/cancelled 独立。等待 ctx.draw 回调后再 canvasToTempFilePath，带组件实例；20 秒是超时保护，不是绘制固定等待。逐页解码/释放照片，重复未修改预览复用结果；保存失败保留已成功页号，仅重试剩余页。H5 明示“已发起浏览器下载”，不冒充写入手机相册。

构建采用本机 HBuilderX uniapp-cli-vite 5.26（实际编译器包 5.26.2026091411.1611）。微信插件须配套 HBuilderX Node v22.22.2，否则 bytenode cachedDataRejected；脚本已经分别选用。API 依据：[CanvasContext](https://en.uniapp.dcloud.io/api/canvas/CanvasContext)、[canvasToTempFilePath](https://en.uniapp.dcloud.io/api/canvas/canvasToTempFilePath.html)。

## 模式机制

陪伴有效日只统计正式保存、用户原文或持久照片、life/current、本地合法日期且不晚于今天的记录。同日多条只算一天，不要求连续；空草稿/照护/问诊/示例/自动整理不计数。回执 `v1:first/three/seven/month:YYYY-MM` 独立于源内容，修改/删后重建不重复发放。自动页只保存来源引用，打开时按最新内容整理，不缓存删除过的私人原文。月册在七日里程碑后、当月至少三个有效日且用户进入册页时准备，不做通知。

提案猫/狗各 8 条、通用 8 条；换一个/收藏/不适合/关闭/册页恢复，不写假经历。图鉴只来自用户确认的 habit/favoriteThing/first/ordinary 标签，显示来源条数，能回原记录。照护接续绑定原咨询事件，没更新不等于恢复；紧急指导保留原路径。

怀念共用编辑器和册页，可未知日期、一句话、无照片、无 AI；信与片段分类型。没有新增签到、死亡倒计时、纪念推送、奖励进度、自动回信。既有怀念聊天入口及原有说明不被删掉；怀念册也能看到该宠物陪伴期内容。

## DeepSeek 与准确部署清单

`api_deepseek` 对 `narrative_polish` 单独分流，复用现有模型配置和 checkRateLimit，总限流不按 scene 开新桶。服务端使用 `pety-auth.verifyRequest` 的正式身份，拒绝客户端 uid/isMember/model/baseURL/systemPrompt/token 控制字段。600 字符或既有更低上限、700 tokens 或既有更低预算，15–25 秒受限超时，无自动重试。四风格 preserve/diary/brief/letter；只有主动点润色才请求，原文保存/选模板/导出均零请求。参数与结束状态核对依据：[DeepSeek chat completion](https://api-docs.deepseek.com/api/create-chat-completion/)。

当前仓库没有通用云宠物归属表，因此仅使用已有 `pet_avatar_jobs` 的 quotaOwnerHash+petHash 验证归属。**只有本地宠物、没有本人云任务凭据时，会返回 403；不会为启用润色而调用图像生成。** 此限制在界面有专门提示。需后续独立设计受验证的云宠物注册后，才能开放这类宠物的 AI 写作，不能直接删除归属校验。

首次写作单独提示数据处理并取得确认，只发本次文本/风格/宠物 ID/版本，不发照片、病历和全册。候选可编辑/拒绝，校验空/截断/异常结构；不显示推理或内部提示词。高风险关键词有支持性分流，但这不是完整风险识别或心理诊断。没有真实模型抽检，因此不声称“零幻觉”或提示注入绝不会影响语义。

私有 `pety_narrative_requests` 通过唯一 _id 内容指纹认领，按主人/宠物/草稿版本/风格/提示词版本隔离。只存状态、调用尝试数和时间，不存正文；done/failed 有 10 分钟防重窗口，running/unknown 不自动重试。providerCalls 表示应用发起尝试，不是供应商确认处理或扣费证据。旧回执没有 TTL 自动清理，也没有本轮新增的供应商对账入口。

**本轮云部署为 0，目标空间未确认，真实 DeepSeek 调用 0，图像调用 0。** 未触碰真实 config.json/config.local.json/.env。部署必须先核实当前项目的开发空间标识与权限，不能沿用历史 ali01 字样推断。

确认开发环境后，依次操作：

1. 在 HBuilderX 记录所选 uniCloud 开发空间名称/ID，备份云端现有 api_deepseek 版本、其依赖与配置；不要覆盖真实密钥文件。保留本地源码基线 `unpackage/dual-mode-20260928/baseline` 供逐文件对照。
2. 先部署 `uniCloud-alipay/database/pety_narrative_requests.schema.json`，集合权限保持全部 false，仅云函数访问。唯一 _id 复用数据库默认索引；本轮没有新增其他索引文件。
3. 核对 `uniCloud-alipay/cloudfunctions/common/pety-auth` 与当前正式身份通道一致，再上传 api_deepseek 及依赖。该 common 模块原本已有未提交实现，不应未经核查盲目覆盖生产版本。
4. 仅用已确认开发身份与本人既有测试宠物凭据检查 401/403/429 和一条虚构润色。真实请求总预算仍最多 3 次；模型结果需人工逐句检查否定、日期、病因、未知事实及不是宠物回信。失败不自动重发。
5. 回退时恢复备份的云函数/依赖版本；新增私有回执集合先保留，不删除真实数据。客户端原文/模板不依赖该函数，可继续本地使用。

本地恢复也应逐文件比较本轮前快照，禁止 git reset 或把当前所有 dirty 文件回滚。Android 开发基座原资源已经恢复；没有发布 APK、微信版本、网页或云函数。
