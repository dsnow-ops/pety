# 首页、身份与卡片印记：本地交付记录

日期：2026-09-28。当前仓库已实际修改；视觉方向仍待用户验收，不视为已认可。

## 先看运行页面与真实导出

全部 UI 图片来自本轮源码编译的 H5，在 Edge 的 390 × 844 视口运行；不是设计稿、不是 Android 真机截图。照片沿用仓库中用户已提供的猫照片裁切资源，文字为自然内容样张；健康工程数据另放 engineering/health。

| 首页首屏 | 下滑后 | Hero 过渡态 |
|---|---|---|
| ![首页首屏](C:/Users/杜冲/Documents/Codex/2026-05-12/files-mentioned-by-the-user-pety/pety/docs/home-identity-20260928/01-home-first.png) | ![下滑后](C:/Users/杜冲/Documents/Codex/2026-05-12/files-mentioned-by-the-user-pety/pety/docs/home-identity-20260928/03-home-lower.png) | ![Hero 过渡态](C:/Users/杜冲/Documents/Codex/2026-05-12/files-mentioned-by-the-user-pety/pety/docs/home-identity-20260928/02-hero-transition.png) |

| 健康与生活各自保存 | 整理文字的真实阻断状态 | 改名与展示方式入口 |
|---|---|---|
| ![健康与生活](C:/Users/杜冲/Documents/Codex/2026-05-12/files-mentioned-by-the-user-pety/pety/docs/home-identity-20260928/08-health-life-separate.png) | ![整理状态](C:/Users/杜冲/Documents/Codex/2026-05-12/files-mentioned-by-the-user-pety/pety/docs/home-identity-20260928/09-polish-status.png) | ![档案设置](C:/Users/杜冲/Documents/Codex/2026-05-12/files-mentioned-by-the-user-pety/pety/docs/home-identity-20260928/04-archive-settings.png) |

| 本地朱印资产 | 本地压印资产 |
|---|---|
| ![朱印](C:/Users/杜冲/Documents/Codex/2026-05-12/files-mentioned-by-the-user-pety/pety/docs/home-identity-20260928/seal-vermilion.png) | ![压印](C:/Users/杜冲/Documents/Codex/2026-05-12/files-mentioned-by-the-user-pety/pety/docs/home-identity-20260928/seal-emboss.png) |

印记图片为实际 Canvas 导出的 384 × 384 PNG；成品为实际导出按钮保存的 1080 × 1440 PNG。

| 照片明信片 · 朱印 | 照片明信片 · 压印 | 信纸 · 朱印 |
|---|---|---|
| ![照片朱印](C:/Users/杜冲/Documents/Codex/2026-05-12/files-mentioned-by-the-user-pety/pety/docs/home-identity-20260928/11-postcard-vermilion.png) | ![照片压印](C:/Users/杜冲/Documents/Codex/2026-05-12/files-mentioned-by-the-user-pety/pety/docs/home-identity-20260928/12-postcard-emboss.png) | ![信纸](C:/Users/杜冲/Documents/Codex/2026-05-12/files-mentioned-by-the-user-pety/pety/docs/home-identity-20260928/13-letter-vermilion.png) |

[印记调整界面](C:/Users/杜冲/Documents/Codex/2026-05-12/files-mentioned-by-the-user-pety/pety/docs/home-identity-20260928/15-seal-controls.png) · [档案内印记预览](C:/Users/杜冲/Documents/Codex/2026-05-12/files-mentioned-by-the-user-pety/pety/docs/home-identity-20260928/05-seal-created.png) · [完整健康字段](C:/Users/杜冲/Documents/Codex/2026-05-12/files-mentioned-by-the-user-pety/pety/docs/home-identity-20260928/07-health-fields.png)

## 本轮真实改动

- 首页顺序：宠物 Hero → 今日照护（唯一健康主按钮 + AI 问诊）→ 健康周历/整月入口 → 独立生活区 → 档案等低权重工具 → 默认收起的小事提案。移除 Hero 大按钮、宫格对健康动作的重复竞争。怀念模式不显示健康打卡主动作，保留历史健康资料入口。
- Hero 采用上下渐隐、淡背景取色/模糊、磨砂浮栏和有上限的轻度滚动视差。减少动态效果设置会关闭该视差。没有重编码、缩小或改动原 AI 形象资源。
- 健康表单原字段和保存逻辑保留。生活区独立分隔，明确显示“生活片段与健康打卡分别保存”，没有保存健康后自动进入卡片的动作。
- 档案可保存名字，按同一 petId 更新并通知现有页面。新编辑器与册页使用新名字；已保存作品继续使用其 petName 与内容快照。
- 每只宠物独立保存 auto / ai / original 主视觉偏好。原照片使用已有持久资源；临时 blob 不能作为首页持久照片。未完成云归属绑定的导入资料不能借此续取原账户云照片。AI 模式不以原照片冒充 AI 形象。
- 本地读取已有图像像素，生成有版本的 64 × 64 单色印记资产，保存在对应账户/宠物资料；朱印与压印由同一资产绘制。新照片页/信纸默认右下角，可关闭、左右切换、三档尺寸、两种样式。印记内容复制入作品快照，不依赖未来宠物改名或更新印记。
- 照片页/信纸新增 V3 渲染，旧 V1/V2 渲染保留。册页封面使用作品快照内印记。照片调整视窗比例与 V3 输出一致。

主要实现文件：common/home-hero-asset.js、common/pet-store.js、common/narrative-api.js、common/pet-seal.js、common/card-layout-v3.js、common/card-renderer.js；pages/home、archive、calendar、narrative、album；PetSealMaker、NarrativeCanvas、companion-prompt。

开工前保存了 351 个源码文件的 SHA-256 基线及副本，目录为 unpackage/home-identity-20260928/baseline。[相对开工基线发生改变的既有文件](C:/Users/杜冲/Documents/Codex/2026-05-12/files-mentioned-by-the-user-pety/pety/docs/home-identity-20260928/engineering/changed-from-baseline.json)。新文件包括印记工具/组件、V3 布局、运行验收脚本与新增测试。没有整体回滚、提交、推送、清空真实数据，未改生成额度、会员规则、图像提示词或云端函数。

## 整理文字：根因与验证边界

1. 访客被客户端账户范围检查拦截，尚未发请求。实际截图准确显示 NARRATIVE_LOGIN_REQUIRED。
2. 在可发送情况下，函数名为 api_deepseek；requestType 与 action 均为 narrative_polish（服务端分支不靠 scene 分派），传入 petId、draftId、revision、四种风格之一、clientRequestId、uniIdToken 和明确的 AI/文字整理同意字段。
3. 现有服务端验证身份后，还要求 pet_avatar_jobs 内存在该 UID 哈希 + petId 哈希的形象任务归属凭据。缺失时返回 403 / NARRATIVE_PET_UNVERIFIED；这意味着未生成过形象的宠物可能被拒绝。当前仓库没有独立云宠物注册表，本轮没有绕过归属验证或擅自部署改变此策略。
4. 旧前端将多种返回合并为笼统失败；自动保存还会把整理提示覆盖成“草稿已保存在本机”。现在独立保存整理状态，分别提示登录、归属、空候选、接口版本不匹配、版本过期、限流及连接问题；不展示任意原始服务错误文本或令牌。
5. 采用候选后，写作框改为编辑候选正文，原文保留。候选失败不改草稿正文。

[真实客户端构造 + 本地真实服务端模块的接口证据](C:/Users/杜冲/Documents/Codex/2026-05-12/files-mentioned-by-the-user-pety/pety/docs/home-identity-20260928/engineering/polish-chain.json) 使用虚构身份、模拟数据库和提供方，验证四种风格、返回候选与精确 403；**不是线上整理成功证明**。UI 中采用/继续编辑使用明确的候选夹具。真实云服务版本、真实登录用户的宠物凭据、真实文字提供方尚未联调。没有获得可验证的线上调用条件，因此真实文字模型调用 0，图像模型调用 0。

后续真实联调所需条件：明确选定云空间和已部署 api_deepseek 版本；用有该宠物有效归属凭据的登录测试账号；提交一次虚构短文并记录脱敏的响应码和候选。若缺少凭据或函数分支/数据库集合未部署，须单独解决对应后端条件，本轮没有部署这些变化。

## 模板方向与本轮范围

| 方向 | 当前处理 |
|---|---|
| 照片明信片 | V3 已实现，大照片、独立文字区、日期与专属印记 |
| 信纸 | V3 已实现，信头/称呼/段落/落款与印记，保留分页 |
| 四宫格日常 | 保留现有可用拼图，后续优先处理节奏与照片间关系 |
| 一句话卡 | 保留现有版式；后续方向为短句主导、安静留白 |
| 时间标签卡 | 保留现有版式；后续方向为明确日期标签与事件层级 |
| 小习惯卡 | 保留现有版式；后续方向为简短观察与小照片配对 |

没有将尚未验收的 V3 风格铺到其余四种模板。印记调整暂只在 V3 照片页/信纸展示，旧作品不会被自动盖章。蜡封、额外模型和额外模板数量均未扩展。

## 实测结果与未验证项

- 单元/回归：426 项，424 通过；新增 6 项全部通过。2 项与开工前相同：tests/p0-recovery-v1.test.cjs:53、tests/pet-avatar-v5.test.cjs:102，旧相似案例链接解析断言预期 1 实际 0；不属于本轮新增回归，未为通过测试改动问诊业务。
- 本轮编译 H5 运行验收：8 组场景通过，页面 JS 错误 0。含改名后首页/册页同步、旧作品名字不变、展示偏好持久化、印记生成/调整/导出、整理失败状态及候选继续编辑。[运行结果](C:/Users/杜冲/Documents/Codex/2026-05-12/files-mentioned-by-the-user-pety/pety/docs/home-identity-20260928/runtime-evidence.json)。
- 健康链路：6 组运行场景通过，页面 JS 错误 0。完整 5 状态/12 事件/手写记录；生活保存不打卡；日期回看与修改；历史编辑跳回健康页；怀念历史与切回陪伴；宠物隔离。[健康运行结果](C:/Users/杜冲/Documents/Codex/2026-05-12/files-mentioned-by-the-user-pety/pety/docs/home-identity-20260928/engineering/health/runtime.json)。
- [健康编辑前后进入问诊的真实参数](C:/Users/杜冲/Documents/Codex/2026-05-12/files-mentioned-by-the-user-pety/pety/docs/home-identity-20260928/engineering/health/consultation-inputs.json)：实际聊天发送 → 序列化 callFunction 参数 → 在本地执行真实 exports.main → 捕获最终提供方 payload。网络被替换，不能据此声称真实云问诊已联调。
- H5 与 App 本地构建通过；App 仅编译，本轮未在 Android/iOS 真机重跑。小程序本轮未构建/真机验证。玻璃效果、滚动帧率、相册权限和原生 Canvas 仍须真机验收。
- 原照片显示已在 H5 实测；AI 模式的选择与不冒用照片、自动回退已测；真实账户私有云 AI/照片资源切换尚未实测。既有 AI 资产选择与画质保护由现有回归覆盖。
- 未部署云端，未发布生产。视觉质量等待用户判断。

## 可以直接照着验收

1. 用 HBuilderX 打开当前项目，运行到浏览器；选已有宠物。首屏应只有一个“健康打卡”主按钮，旁边是“AI 问诊”。向上滑，检查宠物过渡、日历和独立生活区。
2. 进入健康打卡，选日期，填写状态、事件与手写记录并保存。返回日历重开并修改；生活记录单独保存后，未填健康的日期不得显示已健康打卡。
3. 首页“宠物档案与展示设置” → 修改名字并保存。返回首页、陪伴册、新建生活片段核对新名字；重开旧作品核对旧名字仍保留。
4. 在档案切换“用户原照片 / AI 形象 / 自动”。原照片必须是已保存资源；没有 AI 资源时选择 AI 会显示缺少形象，自动会回退原照片。切换不生成图片。
5. 同页点击“制作专属印记”，核对朱印/压印两张预览。新建生活片段，写自然短文、选一张照片，保存 → 制作成品；选照片页或信纸 → 调整 → 切换印记样式、位置、大小、关闭 → 完成 → 导出图片。
6. 在写作页点“整理文字”。访客必须明确显示尚未发送；已登录环境遇到归属 403、空返回等应显示准确原因，原文与草稿不变。真实成功候选仍需上述线上条件实测。

复现脚本：scripts/verify-home-identity.cjs、scripts/verify-polish-local.cjs；健康脚本 scripts/verify-health-recovery.cjs 可通过 PETY_HEALTH_BUILD 与 PETY_HEALTH_EVIDENCE 指定本轮构建和工程证据路径。
