# 本轮基线与复用映射

2026-10-16；真实仓库，分支 `feature/calendar-persona-auth-polish-v1`，HEAD `aff95a5b530a264e0fe496d13e9af3c1ff03082e`。大量既有已跟踪修改和未跟踪模块均保留。基线状态、客户端哈希和本轮拟修改文件原副本位于 `baseline/`，未备份凭证或真实业务数据。

| 功能 | 真实文件/来源 | 本轮起点状态 | 验证与动作 |
|---|---|---|---|
| 深暖母版/首页 | `design/visual-lock/reference/USER_APPROVED_SCREENSHOT.png`、显式母版；`home.vue`、UI 角色样式 | 已验证（H5 基线） | 本轮 before/home.png；保留宠物资产与首页层级 |
| 统一记录 | `calendar.vue`、`diary-store.js`、原 `pet_diaries_*` | 已验证（H5 文字）；独立事件待补 | before/record.png；补记复用编辑器，保留旧日记录 |
| 作品与自由印记 | `card-compose.vue`、`card-studio-page.js`、v1–v6 渲染器 | 已验证（H5 基线预览）；原生未实测 | before/work.png；保留冻结快照与旧版本 |
| 草稿/照片 | `narrative-store.js`、`narrative-media.js` | 代码存在未验证（任务开始时） | 复用账号作用域、App 沙箱、H5 IndexedDB；无新上传 |
| 查找/照片视图/日期精度 | `album.vue`、现有记录投影 | 未实现（任务开始时） | B 增量选择器；不另建内容库 |
| 收藏/图鉴/小册 | `companion-collection.js`、既有作品库 | 代码存在未验证 | C 核对真实生活日和来源/敏感过滤 |
| 照护/问诊参考 | `care-followup.js`、`chat.vue`、原 diary context | 代码存在未验证 | D 接续与显式选择；不调用真实模型 |
| 账号/会员/单会话 | 原 auth、entitlement、single-session 模块 | 代码存在未验证（云端状态） | 不改登录/支付/额度，不部署，不宣称已生效 |
| Android 入口/返回 | welcome 首路由、既有返回恢复模块 | 受外部条件阻塞（设备） | ADB 列表为空；源码/隔离回归通过不等于真机通过 |

构建工具：本机 HBuilderX `5.26.2026091411.1611` 工具链，Vue `3.4.21`、Vite `5.2.8`。根目录无 package.json；使用已有 `scripts/build-dual-mode.cjs`，独立输出到 `unpackage/life-records-20261016/`。

A 验证：修改前 H5 构建退出 0；真实编译页面在独立浏览器 TEST P1/P2 环境运行并截图，外网请求全部阻断；106 项原有相关测试通过。证据 `before/browser.json`、`baseline/tests.log`。本轮截图非 Android，旧报告不作为通过证据。

已找到最新已认可截图、显式深暖 HTML、20260929 会话/印记规格、卡片字段矩阵、双模式实现文档。未找到根目录 `GUIZHUA_VISUAL_LOCK_CODEX_PROMPT.md`、`GUIZHUA_HOME_AND_FREE_SEAL_REFERENCE.html`、`GUIZHUA_DUAL_MODE_CODEX_PROMPT_2026-09-28.md`；对应深暖设计文件以当前 `design/visual-lock/` 为依据，不自造参考。

测试策略按本轮新增用户要求写入根 `AGENTS.md`：电脑 H5 优先，重要原生节点集中验收。服务器、存储服务、新上传、视频管线延期；模型调用 0、云部署 0。测试仅操作隔离浏览器和内存存储，未触及真实用户资料。
