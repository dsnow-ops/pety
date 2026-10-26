# 宠物形象资产分离审计（2026-09-15）

本轮仅处理生成构图、工作台、Hero 资产、相关头像入口与文案。保留工作区原有未提交成果；未 commit、push、reset、stash，未修改真实 config.json、uni_modules 或锁定 Base Prompt。真实 Wan / VIAPI / 其他付费 Provider 调用均为 0。

## 结论与验证边界

- 已实现工作台主图与首页角色资产的独立选择策略、明确资源角色和派生文件。首页不再读取工作台 handoff 预览 URL。
- 首次、再次生成、微调都发送独立的标准坐姿构图约束，并明确请求 2048×2048。输出尺寸不符合要求时拒绝保存为新候选，不缩放原图冒充合格结果。
- **坐姿、单只宠物、完整四肢等语义要求尚未通过真实模型输出验证。** 本轮没有调用生成模型；不能把提示词约束或尺寸闸门说成已经证明姿势恢复。诊断中的 `poseVerification` 始终如实标记 `NOT_VISUALLY_VERIFIED`。
- 透明角色、alpha 裁切、资源选择、失效回退与浏览器像素检查已用本地猫/狗 PNG fixture 验证。用户这只真实宠物的透明资产仍需部署云函数后检查；未伪称真实 cutout 已生成。
- Wan 2.7 官方接口仅保证输出文件格式为 PNG，没有透明背景或 alpha 输出参数；PNG 扩展名不能替代透明像素验证。因此未用提示词伪造“原生透明保证”，仍以真实 alpha 检查和语义分割作为可信边界。

## 根因与修改

### 姿势与构图

实际 Provider 请求曾只传 `size: '2K'`。官方文档明确：编辑模式中的 2K 档位继承最后一张输入图片的长宽比，不代表正方形。用户诊断的 1390×3017 与此路径吻合；它支持这个解释，但不能单独证明该次请求的完整参数。

Base Prompt 允许“全身或 3/4 全身”、自然姿态，没有强制坐姿；revision 则要求保留旧姿势、构图、主体大小和角度。工作台再以 aspectFill 放入方形容器，造成二次裁切。

修复文件：

- `uniCloud-alipay/cloudfunctions/api_pet_avatar/avatar-composition-contract.js`：工作台主图使用 `seated-full-body-v2`，身份参考不继承动作；单只、全身坐姿、正面轻微 3/4、四肢尾巴、居中、至少 12% 安全留白与暖灰摄影棚背景。
- `uniCloud-alipay/cloudfunctions/api_pet_avatar/hero-character-prompt.js`：用户确认主图后，独立生成一次 `hero-character-magenta-v1` 技术源图。技术源图不进入工作台或任何页面；只有高饱和洋红背景、Alpha、边缘污染与主体几何全部过门槛，才保存为 `hero-character.png`。
- 仅在没有可用 VIAPI 语义抠图时启用一次 Wan Hero 转换任务；不自动重试。任何失败均保留高清工作台 final 作为首页回退。
- `avatar-revision-prompt.js`：保留身份和局部修改约束，允许纠正不符合标准的旧构图。
- `index.js`：三个生成类型均应用构图约束；实际请求 `2048*2048`，记录请求尺寸和构图版本。
- `storage.js`：版本化新请求的输出必须实际为 2048×2048；合格 PNG 原字节保存。

文档依据：[阿里云 Wan 图像编辑说明](https://www.alibabacloud.com/help/en/model-studio/wan-image-edit)。当前文档未列出专用透明背景输出参数；PNG 输出格式并不保证有效透明角色。没有新增未经文档支持的参数，也没有反复调用模型试透明。

### 工作台

- `common/workbench-master-asset.js`：只接受带候选 jobId、主图 fileId 的资源；拒绝缩略图、cutout、显示衍生图、降采样主图和仅 URL 的旧缓存。
- `pages/avatar-generate/avatar-generate.vue`：固定方形舞台，实际 aspectFit/contain；去掉模糊背景复制层和结果图上的色彩遮罩。原图无拉伸、无展示层裁切。
- 旧长图完整放入舞台，会保留舞台底色边区；这是保留主体的兼容方案。新请求的方形主图不再因长宽比不匹配产生两侧空带。未通过裁切或模糊复制掩盖旧图比例问题。
- 图片 preload 完成后再切换；历史缩略图节点不重建。已显示 URL 失败有有界刷新；诊断区分当前可见候选与正在选择的候选。
- 确认异步完成后通过明确 petId 写回发起宠物；若当前宠物已改变，不继续旧宠导航或覆盖当前宠物。
- `locale/zh-Hans.js`、`locale/en.js`：首轮查看与微调说明分开，清除工作台“他/她”占位式文案。`common/home-daily-copy.js` 清理空名、零宽字符、空白 HTML 实体和 replacement 特殊字符问题。

### 首页 Hero 与统一头像

- `common/home-hero-asset.js`：独立首页策略，只接受已确认的 canonical master 及其合格角色资产；拒绝未确认候选别名和预览 URL。显式角色 `home_hero / master_fallback / placeholder`。
- `common/avatar-display-asset.js`：保留共享 petId/fileId URL 生命周期、来源绑定、质量闸门；增加原生透明 Hero 候选。顶部摘要、宠物卡片等共享同一资源与失效事件。
- `storage.js`、`index.js`：原生透明 master 通过真实像素质量门槛后另存 `hero-native-tight.png`，不覆盖 `final.png`。失败才沿用干净背景的本地分割和现有远端 cutout 链路。
- `common/pet-store.js`、`common/pet-avatar-generator.js`：持久化独立 Hero 字段、来源元数据、准备版本；换 master 时清理旧派生资产。无数据库 schema 变更。
- `pages/home/home.vue`：版本化 storage-only 准备，旧异步回写校验；合格原生角色不再额外提交远端抠图。五连点增加角色、策略及 CHARACTER QUALIFIED，防止将高清 final 的 qualified 误解为透明合格。
- `pages/home/home.vue`、`components/PetAvatarHero.vue`：Hero 使用两种明确的渲染模式。合格透明资源采用“信息卡背景 + 独立角色前景”，角色从卡片顶部跨层站立，并由 UI 绘制接地阴影和微光；final 回退采用卡片右半区的 `interactive-portrait`，以渐变融合左边缘，保持清晰原图，并提供轻微呼吸、触摸视差、点击回弹和扫光。它不再以独立方块悬在卡片上，也不伪装成透明角色。
- `storage.js`、`index.js`：Provider 返回文件只有通过完整 alpha 质量门才允许落盘并标记成功；历史 `NOT_CONFIGURED` 或调用前失败状态会在语义分割配置真正可用后一次性恢复为 `PENDING`，`prepareHeroDisplay` 本身不触发付费 Provider。
- `pages/chat/chat.vue` 中纪念消息头像、`pages/memorial-persona/memorial-persona.vue` 改用现有共享头像组件，去掉旧 URL 绕路；未修改对话或人格逻辑。
- 现有 `PetAvatarHero.vue` 的透明角色布局、独立接地阴影、呼吸、点击反馈、APP touch / H5 pointer 轻视差及 reduce-motion 降级在本轮回归。保持同宠同 master cross-fade；换宠/换 master 清空旧帧。

### 可替换的透明 Hero 生成器

工作台仍由 Wan 负责身份还原和标准构图；首页角色允许接入独立生成器。[OpenAI GPT Image 当前官方接口](https://developers.openai.com/api/docs/guides/image-generation#customize-image-output)支持 `background: "transparent"`，并要求使用 PNG 或 WebP 输出，适合作为单独的 Hero 资产来源。项目本轮没有写入密钥、没有修改真实配置，也没有触发付费调用；接入后仍必须经过现有 alpha、主体边界和紧裁质量门，不能因为 Provider 声称透明就直接替换 master。

推荐上线链路是：确认 workbench master 后，异步请求一次专用透明 Hero；生成期间继续显示 `interactive-portrait`；透明结果合格后 cross-fade 到 `transparent-character`；失败时永久保留清晰 master，避免循环付费重试。

## 真实优先级与质量门槛

`qualified hero-native-tight > qualified remote cutout-tight > qualified local cutout-tight > qualified remote raw cutout > qualified local raw cutout > final master > placeholder`

每一层还必须有可用 URL；更高优先级不可用时回退同一 master 的资源。候选图、thumbnail、768 display、feathered-final 均不能进入首页正常选择链路。

透明候选必须通过真实 PNG alpha、像素尺寸、透明四角、边缘软化、主体连通性、边界安全及矩形伪 alpha 检查。tight 文件依据 alpha > 8 的边界，四周约 7% padding，不降采样；记录原尺寸、裁后尺寸、bytes、bbox、coverage 与 sourceFileId。低质透明资产不能覆盖高清 final。

这些是图像工程质量门槛，不是动物语义分割评估器；不能证明每根胡须、每只脚都分割正确。浅色毛发与相近背景、复杂背景、旧图近景仍可能拒绝或分割不足。拒绝后展示清晰的设计图像区，不使用模糊方块假装透明。

## 用户真机证据

此前诊断：`sourceType: final`、`CUTOUT: FAILED`、remote/local 均 `NOT GENERATED`，1390×3017、5,887,025 bytes、PNG。明确证明当时首页吃的是 final；`hasAlpha: true` 与 master 的 `qualified: true` 不代表有合格 cutout。此前纵向模糊矩形属于 final 展示处理，不能归因于已合格的透明角色。新链路去掉 feather 正常入口，但这只真实宠物的新准备结果尚未获得。

## 自动验证

- Node 完整测试：**70/70 通过**。
- 新增 `tests/avatar-asset-architecture.test.cjs`：8 项，覆盖 Base 锁、构图及 payload、工作台拒绝衍生图、独立原生 Hero 保存、旧 master 排除、URL 回退、空变量、跨宠确认回写、错误尺寸拒收（其中首项含三个请求类型）。
- 更新旧静态断言以验证新契约；原有 alpha 像素、cache hydration、store 和 Hero race 回归保留通过。
- `tests/avatar-tight-visual.cjs`：11 个视觉场景，包括 6 组透明猫/狗、3 组工作台、1 组生成等待动画和 1 组 final 互动肖像。Hero 实际主体宽度约 72%，校验角色跨越卡片顶部、主体边界未碰屏幕或舞台边缘、无函数源码/空变量、透明区无矩形背景；final 肖像校验卡片内嵌布局、呼吸动画和 2px/1.5px 视差上限；工作台正方形、contain、加载/结果尺寸圆角阴影一致、缩略图 DOM 节点保留；扫描网格在 620ms 内推进 11 帧且有 6,405 个明显变化像素。
- 生成等待视觉默认改为 `scan-grid`：深色规则点阵、移动扫描波、点阵纵向扰动和百分比胶囊；APP/H5 共用单一 48ms 定时循环，避开 APP 服务层帧回调只绘首帧的问题。`PetGenerationParticlesLegacy.vue` 完整保留此前轨道粒子实现，将 `PetGenerationParticles.vue` 中的 `DEFAULT_GENERATION_EFFECT` 改为 `legacy-orbit` 即可恢复。两种实现共用同一生命周期包装器，不因 GENERATING / LOADING / REVEALING 切换而重建。
- `tests/reduce-motion-storage.test.cjs` 验证只有明确的 `true/1` 会停用动画，字符串 `false/0` 不再被误判为开启“减少动态效果”。
- App 与 H5 本地编译通过。App 结果是 uni-app 编译产物，不是安装包或真机运行证明。
- `git diff --check` 通过。
- Base Prompt：length **1705**，SHA256 **d4bc2b10df557435b9386d9b015cde348b9a4ff9da90d80f06dc08b40fa3a378**。
- 构建、测试日志与截图：`unpackage/hero-architecture-*.log`、`unpackage/avatar-tight-qa/receipt.json`、`unpackage/avatar-tight-qa/workbench-*.png` 和 `*-hero.png`。

## 上线前真机步骤（仍需人工）

1. 部署 `api_pet_avatar` 更新代码并安装/运行新 App 包；保持真实配置不变。本轮没有远端部署。
2. 用后续正常生成的候选检查标准坐姿、单只、完整耳尾爪；再做一次实际需要的局部微调确认姿势保持。旧图不会被静默付费重画。
3. 对现有宠物返回首页，五连点查看原生 / 本地 / 远端准备结果及 fallbackReason，确认真实 cutout 能否通过质量门槛。
4. 观察真实毛发边缘、眼睛、尾巴、脚底阴影、主体大小；自动 fixture 不能替代真实照片的分割验收。
5. 快速切宠、冷启动、返回、断网恢复和 URL 更新，确认没有串宠，final→cutout 过渡平稳。
6. 真机触摸/轻触觉、视差、系统减少动态效果及工作台连续切图；核对 APP-PLUS 与 H5 的平台差异。
