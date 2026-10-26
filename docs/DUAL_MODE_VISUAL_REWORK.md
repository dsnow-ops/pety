# 归爪 · 阶段 A 视觉返工

2026-09-28。本阶段已修改当前仓库并实际运行；以下是候选方向，等待用户视觉验收。**阶段 B 未开始**，其余四种模板保持 v1。

## 先看实际图片

[图片审阅页](dual-mode-visual-v2/index.html)汇集以下原始运行截图与导出 PNG，不是另做的界面原型。

| 实际界面 | 证据 |
| --- | --- |
| Android 编辑页／真实输入法 | [编辑首屏](dual-mode-visual-v2/native/after-editor.png) · [键盘打开](dual-mode-visual-v2/native/editor-keyboard.png) |
| H5 编辑、真实版式选择与预览 | [390 编辑](dual-mode-visual-v2/design/editor-390.png) · [预览](dual-mode-visual-v2/design/preview-390.png) · [缩略图](dual-mode-visual-v2/design/layout-picker-390.png) · [取景调整](dual-mode-visual-v2/design/crop-adjust-390.png) |
| 册页 | [空状态](dual-mode-visual-v2/design/album-empty-390.png) · [相同照片记录及作品](dual-mode-visual-v2/design/album-populated-390.png) · [多份自然内容](dual-mode-visual-v2/design/album-natural-390.png) |
| 同内容前后对照 | `before/` 与 `design/` 下的 `editor-390.png`、`preview-390.png`、`album-empty-390.png`、`album-populated-390.png`、`home-entries-390.png` |
| 照片页 1080×1440 | [H5 实际下载](dual-mode-visual-v2/design/photo-page-0.png) · [Android Canvas 实际文件](dual-mode-visual-v2/native/photo-page-native.png) |
| 信纸 1080×1440 | [一句话](dual-mode-visual-v2/design/letter-one-0.png) · [短信](dual-mode-visual-v2/design/letter-short-0.png) · [长信第 1 页](dual-mode-visual-v2/design/letter-long-0.png) · [长信第 2 页](dual-mode-visual-v2/design/letter-long-1.png) |

H5 前后对照均为编译后的应用、Edge、390×844 逻辑视口，同一虚构测试宠物“小禾”，相同照片和正文。`before/` 来自本轮开始前保留的上一轮编译产物，`design/` 来自本轮源码。另有 360、412 宽度编辑截图。Android 为连接手机的 HBuilder 开发基座，375×813 逻辑窗口；原生旧空白编辑页只作安全区参考，不冒充同内容对照。

样张中的名字、标题、称呼、署名和故事均为明确虚构。照片复用已提供的 `tests/fixtures/user-cat-reference.jpg`，仅裁去原相册界面区域（x=0、y=475、宽 1312、高 1900）；没有生成背景、姿态或假回忆。原照片保留，形象素材没有重新处理。

## 实际改动

- 编辑首屏保留身份、保存、正文、照片和日期。标题、标签、回看与名字开关收进“更多”；本机存储说明可点开。保存后才出现“做成一页”，润色作为可选展开项。
- 实际 PNG 为预览主体，六个缩略图调用同一渲染器。内容不适合时展示标记清楚的版式示例与原因，不改写原内容；“存入册页”和“导出图片”分开。多页增加逐页导出，以处理浏览器连续下载拦截。
- day v2 使用主照片、轻身份、短文、独立日期层级；完整显示、实时取景调整和电子形象肖像变体。letter v2 使用称呼、正文段落、署名、可选日期；真实测量分页，单页无页码，多页弱页码。空行按段间距处理，避免重复占一行形成多余末页。
- 册页展示真实作品封面，日期记录区区分照片与文字；空状态用标记清楚的渲染示例和一个开始动作。内容筛选、草稿和行管理分层；提案恢复入口放在册页菜单。
- 首页“今天记录”主动作直达轻记录，册页是次级入口；提案只保留主动作和轻量换题，其他操作进菜单。原宠物主视觉未重做。
- 编辑、预览、册页用实际窗口安全区；固定导航与滚动内容分开，底部操作考虑安全区。修复 H5 Canvas 初始尺寸过小导致信纸底部黑块的问题。

主要文件：`pages/narrative/narrative.vue`、`pages/album/album.vue`、`pages/home/home.vue`、`components/NarrativeCanvas.vue`、`components/companion-prompt/companion-prompt.vue`、`common/card-layout-v2.js`、`common/card-layout.js`、`common/card-renderer.js`、`common/creative-insets.js`、两份 locale 文件。新增行为测试及本地 H5／Android 证据脚本。

## 保护与基线

开工时的源码快照及 SHA-256 清单在 `unpackage/visual-v2-20260928/baseline/`，不含真实密钥；原生运行资源备份在同目录下 `native-baseline/www/`。没有 commit、push、reset、stash、清空应用、卸载应用或删除真实宠物。

`narrative-store`、`narrative-media`、`narrative-api`、会员生成权益、宠物 Hero 和原形象显示模块与本轮基线一致，见 [保护核对](dual-mode-visual-v2/protected-audit.json)。原文／候选、持久照片、来源追踪、独立快照、删除和收藏规则继续复用。v1 作品按原版本渲染；用户选择 v2 时另存作品，浏览器实测确认旧 ID 和旧版本仍保留。

工作区开工时已有大量未提交修改。本轮期间还观察到聊天、照护、相似案例及 `common/scoped-storage.js` 等文件发生本轮视觉修改之外的变化；没有回滚或覆盖它们，也不能把整个工作区差异都算作本轮成果。原生脚本只清理本次唯一 ID 的虚构草稿、作品与测试照片副本。

## 工程结果，独立于视觉认可

- 专项回归：37/37 通过，覆盖版本兼容、原文保留、照片比例／取景、段间距、分页、安全区，以及既有数据、异步隔离和形象返回测试。
- 最后一轮全仓回归：411 项中 409 通过、2 失败。两处为 `tests/p0-recovery-v1.test.cjs:53`、`tests/pet-avatar-v5.test.cjs:102`，都期望相似案例归一化保留 1 条链接，当前结果为 0。相关云函数在本轮之外有变化，本阶段不修改该服务或通过删断言掩盖失败。
- H5、App、mp-weixin 三端构建成功；微信构建仍有既有 `auth-capabilities.js` 鸿蒙 UA 兼容提示。日志在 `unpackage/visual-v2-20260928/`。
- H5 实测保存文字／照片、实际预览、下载、存作品、册页封面回看、v1→v2 另存、切宠隔离，页面错误为 0。空状态示例未成为记录。自然长信两页；11 页混排压力样本单列于 `engineering/`，逐页下载有真实文件回执，不用于设计展示。
- 压力回归曾发现 Chromium 限制连续自动下载；产品保留明确的“下载已发起”状态，并提供每页独立下载入口，不把发起下载等同于浏览器已保存。

| 平台 | 构建 | 实际运行 | 导出／保存证据 |
| --- | --- | --- | --- |
| H5 / Edge | 成功 | 编辑 360/390/412，主流程 390×844 | 实际 PNG 下载完成；本地记录、照片和作品回看完成 |
| App / Android HBuilder 基座 | 成功 | 编辑、键盘、预览实际运行；顶部 inset 40px、导航 top 41px；键盘窗口高度 531px 时保存按钮仍可达 | Canvas PNG 已拉取；存作品有页面提示；**系统相册保存未确认成功回执** |
| 微信小程序 | 成功 | 未运行 | 未保存；尚需微信开发者工具或真机授权环境 |

Android 图片记录的是本阶段已实测版本；后续逐页导出、长信段间距和取景调整已通过最新三端构建及 H5 运行，未逐项重跑手机。原生一次复测遇到基座 WebView 目标重建，未清数据绕过，也未推断原因。原生册页各状态、返回／切后台全路径、系统大字体、iOS 和不同底部安全区设备未完成矩阵验证。准确保留这些限制，不以构建或 H5 尺寸代替真机结论。

## 直接操作的验收路线

1. HBuilderX 打开当前仓库，运行 H5 或 Android 开发基座；从首页日期区域的记录动作进入。输入一句话，点右上“保存”。无需标题、标签或 AI。
2. 点“添加照片”选择已授权照片；点缩略图可调整顺序／移除。“更多”中检查回看和作品名字的开关，再点“存于本机”查看说明。
3. 保存后点“做成一页”：检查真实照片预览、下方可横滑的版式缩略图。点“调整这页”试完整显示、取景与日期开关；选择已有电子形象时应为完整肖像，不触发生图。
4. 分别点“存入册页”和“导出图片”。回到册页打开真实封面，确认内容与作品仍在。H5 多页下载被浏览器拦截时，使用每页下方的导出按钮。
5. 写一段信，不加照片；选择信纸，在调整面板填可选称呼／署名。先试一句话，再试分段长信，检查最后一页、页序及原文。
6. 在没有记录的测试宠物查看册页空状态；从菜单找收藏／草稿。切宠后不应显示上一只的记录或缩略图。真实数据不要为验收而删除。

图片审阅页可直接打开本地 HTML。重现自动证据：先运行 `node scripts/build-dual-mode.cjs h5 unpackage/visual-v2-20260928`，再运行 `node scripts/verify-visual-v2.cjs`。脚本在独立浏览器中使用虚构数据，拦截外部请求；不连接生产数据。

**部署状态：仅本地源码、构建和开发基座验证；没有云函数、Schema 或生产发布。图像模型与文字模型调用均为 0。用户尚未认可视觉方向，阶段 B 未开始。**
