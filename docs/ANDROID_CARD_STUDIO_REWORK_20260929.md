# Android 启动与制卡工作台返工验收

2026-09-29 · 当前仓库实际修改 · 视觉待用户确认

## 先看实际画面

- [Android 启动与返回](android-card-studio-20260929/android-routing-overview.png)
- [真机首屏、内容面板、切换确认前后](android-card-studio-20260929/android-studio-overview.png)
- [Android 三款实际导出](android-card-studio-20260929/native-cards-overview.png)
- [完整展示册](android-card-studio-20260929/review.html)

展示册中的小禾、文字和健康值均为虚构测试资料。照片、朱印与压印沿用已有授权验收素材，没有调用图像模型或下载字体。

独立参考 HTML 已读取源文件，并结合用户附图比对；工具的文件 URL 安全策略阻止了它在受控浏览器中打开。本报告的运行画面来自实际 App／H5，未把该参考页当成交付实现。

## Android 根因与修复

1. **启动入口顺序错误。** 修改前源码 `pages.json` 首项为 `pages/card-compose/card-compose`。从 HBuilderX 标准项目运行入口启动、没有传入直达参数，设备仍加载该页。设备配置同时显示 `entryPagePath=pages/card-compose/card-compose`、空 query；可见 WebView 为制卡根页。已恢复项目原有 `pages/welcome/welcome` 作为首项，由原引导逻辑进入已有宠物首页。
2. **无来源根页错误使用草稿。** 原页面缺来源时仍可能读取 `current:new` 组合，落到“一句话”冲突状态。现在先等待账号作用域，校验来源和宠物归属；缺源显示“选择一条记录／回到首页”，不恢复无来源的假作品。原草稿没有删除，错误组合可另存后继续。
3. **根页返回没有兜底。** 原 `back()` 直接调用 `uni.navigateBack()`。现在页内按钮与同步 `onBackPress` 共用策略：先关最上层面板，flush 草稿，有前页返回，无前页 `switchTab` 回真实首页，并处理 `from=navigateBack` 重入。没有全局吞掉首页返回。
4. **原生导航完成时序。** 真机日志显示 `reLaunch` 新页 `onLoad` 时旧栈尚在，随后 `reLaunch:success` 才变为深度 1。现在跟踪导航意图和完成事件，更新“回首页”状态；没有用固定延时反复跳转。
5. **Android JavaScript 兼容。** 真机出现 `chars.at is not a function`，使 Canvas 排版失败。将旧公共排版中的三处 `.at(-1)` 换为等价数组索引；不改变旧模板的排版算法。

没有发现 `pages.json.condition` 或 `.hbuilderx/launch.json` 中的制卡直达配置。本轮没有添加猜测性的 manifest 启动字段。旧 `verify-health-native.cjs` 确有替换设备调试资源的验证逻辑；本轮没有运行它，使用 HBuilderX 当前源码完整编译、同步，再比较本地与设备哈希。

修改前一次返回取证中，进程仍在、Activity 仍在前台、未捕获 FATAL。因此本报告确认“错误启动根页与返回策略缺失”，**不把它写成已证实的原生崩溃**。

证据：[修改前根页](android-card-studio-20260929/before-runtime.json)、[返回前后进程证据](android-card-studio-20260929/root-return-before.json)、[修改前标准启动截图](android-card-studio-20260929/standard-before.png)、[本轮路由日志](android-card-studio-20260929/android/route-trace.log)、[最终标准运行与哈希](android-card-studio-20260929/android/final-standard-launch.json)。

## 实际实现

工作台以真实 Canvas 成品为首屏主体，内容／纸面／印记分别打开底部工具；模板条使用同一渲染器生成缩略图，不兼容者显示独立“版式示例”。当前成品可立即复用为缩略图，其他版式逐张绘制。

模板切换先在候选组合中验证、绘制，成功后才提交。冲突面板保留原图，短句／信纸正文直接提供已有原话，用户确认才生成变体；取消不改当前作品，上一版仍可恢复。普通内容调整采用暂存／应用。

应用已经开始绘制时再取消，也会作废该任务；迟到的图像与错误不再提交到新面板。已用真机实际选照片→应用→绘制中取消→等待任务结束验证原图不变，并增加独立行为测试。

隐私减少是立即生效的例外：关闭姓名、健康或照片，立即清理旧预览、缩略图和导出缓存，同时撤销旧变体入口；取消面板不会重新显示它们。来源更新待确认时也不能借旧快照恢复刚关闭的敏感内容。开关不回写日常记录。

只对 `day`、`daily_record`、`letter` 增加 V5 排版。旧 V1–V4 和已保存作品继续按原版本渲染。新版分别采用主照片与文字分区、日期与观察层级、随信长安排的信纸落款；保留朱印、压印和正文横线，长信分页保留完整文字。

主要改动：`pages.json`、`App.vue`、`pages/card-compose/card-compose.vue`、`common/card-studio-page.js`、`common/card-studio-navigation.js`、`common/card-studio.js`、`common/card-layout-v5.js`、`components/NarrativeCanvas.vue`。另有日历进入制卡时携带 petId、册页识别 V5、渲染器支持信纸印记位置，以及旧排版 API 兼容修正。

没有重做首页大图、健康存储、问诊取材、会员或生成逻辑；继承的其他未提交修改保持原状。没有提交、推送或部署。

## 原尺寸导出与新旧对照

以下 Android 图片来自设备原生 Canvas 临时导出文件，尺寸均为 1080 × 1440；日常卡另执行了系统相册保存，不能将临时文件和相册回调混为一项证据。

导出元数据中的账号 namespace 已脱敏；图片和 App 内资料没有因此改写。

| 作品 | Android 原图 | 同素材 H5 新旧对照 |
|---|---|---|
| 照片明信片，朱印，不含健康 | [PNG](android-card-studio-20260929/android/postcard-native.png) | [V4 / V5](android-card-studio-20260929/compare-postcard.png) |
| 今日记录卡，主动选入饮食与体重 | [PNG](android-card-studio-20260929/android/daily-native.png) | [V4 / V5](android-card-studio-20260929/compare-daily.png) |
| 怀念信纸，压印与横线，无默认健康和日期 | [PNG](android-card-studio-20260929/android/letter-native.png) | [V4 / V5](android-card-studio-20260929/compare-letter.png) |
| 关闭系统姓名后的信纸 | [PNG](android-card-studio-20260929/android/letter-private-native.png) | [实际关闭后画面](android-card-studio-20260929/android/20-privacy-name-hidden.png) |

同素材对照使用 H5 对 H5，避免将平台字体差别当成设计改动。沿用同张原照片和相同自然正文；新版的落款、称呼和显示设置也在成品中直接可见。Android 和 H5 都用生产组件渲染，没有用参考 HTML 的绘制替身。

每种模板另有短篇／中篇 H5 实际导出：[明信片短篇](android-card-studio-20260929/h5/postcard-short.png)、[中篇](android-card-studio-20260929/h5/postcard-medium.png)，[记录卡短篇](android-card-studio-20260929/h5/daily-short.png)、[中篇](android-card-studio-20260929/h5/daily-medium.png)，[信纸短篇](android-card-studio-20260929/h5/letter-short.png)、[中篇](android-card-studio-20260929/h5/letter-medium.png)。压力测试文本没有作为设计样张。

## 本轮验证与边界

项目：`C:/Users/杜冲/Documents/Codex/2026-05-12/files-mentioned-by-the-user-pety/pety`。基线 Git HEAD：`aff95a5b530a264e0fe496d13e9af3c1ff03082e`，工作区原本有大量未提交修改。AppID：`__UNI__A23A379`。HBuilderX 5.26，Vue3 编译器 5.26；物理设备 PGT-AN20、Android 16、1312 × 2848，标准基座 `io.dcloud.HBuilder`。构建标记 `studio-20260929-v5`；具体哈希见 [build.json](android-card-studio-20260929/android/build.json)。

| 场景 | 本轮证据与状态 |
|---|---|
| 普通冷启动→首页→记录→制卡→原记录→首页 | Android 真机通过 |
| 无上一页的合法来源／缺少来源 | Android 真机通过；真实 `uni.reLaunch` 建立测试根页，没有更改默认启动配置 |
| 物理返回先关内容面板；根页回首页 | Android 真机通过，日志记录栈深和返回来源 |
| 重启后仍进首页；从原记录恢复草稿 | Android 真机通过，文字与照片从独立测试宠物的持久化资料恢复 |
| 不兼容模板取消、确认、恢复上一版 | Android 真机 + H5 实测；H5 另检查取消前后 config 和 PNG 地址完全一致 |
| 内容应用开始绘制后取消 | Android 真机通过；[实际取消后画面](android-card-studio-20260929/android/04b-cancel-during-render.png)；行为测试同时检查迟到任务不能提交 |
| 系统相册保存 | Android 实际成功回调；[截图](android-card-studio-20260929/android/12-album-save-result.png) |
| 姓名／健康／照片关闭后的隐私缓存 | H5 与行为测试通过；Android 实测姓名关闭和新导出 |
| 4.2 kg 修改成 4.3 kg → 问诊输入 | 实际 H5 保存与发送代码、真实服务主函数在本地执行；供应商 I/O 用测试替身。最终 messages 有 4.3 kg、没有旧 4.2 kg。[输入证据](android-card-studio-20260929/h5/consultation-input.json) |
| 无宠物首次引导 | 独立空白 H5 上下文验证，不创建宠物；未清空真机资料模拟此场景 |
| 320 × 568 小屏 | H5 底部按钮与面板头可达；[截图](android-card-studio-20260929/h5/29-small-screen.png) |
| 仅健康／只有标题／仅照片 | 独立 H5 资料实测：健康需主动选择真实结果；只有标题不能导出；照片持久化后明确选入即可制卡。[健康](android-card-studio-20260929/h5/31-health-only-explicit.png)、[标题](android-card-studio-20260929/h5/32-title-only-selection.png)、[照片](android-card-studio-20260929/h5/33-photo-only-explicit.png) |
| 原文／候选、同日健康生活、私密字段、隔离、旧作品 | 原有数据与边界测试本轮重跑；不等同于所有平台端到端实测 |

全量测试修改前 **468 项：466 通过、2 失败**；修改后 **484 项：482 通过、2 失败**。新增工作台测试 **16/16 通过**。两项失败在本轮前后都是 `tests/p0-recovery-v1.test.cjs:53`、`tests/pet-avatar-v5.test.cjs:102` 的相似病例解析断言，均为 `0 !== 1`，未删断言或掩盖失败。[基线日志](android-card-studio-20260929/baseline-tests.log)、[最终日志](android-card-studio-20260929/final-tests.log)。

H5 实测无 pageerror。原生运行与导出详见 [runtime.json](android-card-studio-20260929/android/runtime.json)；H5 详见 [runtime.json](android-card-studio-20260929/h5/runtime.json) 和 [小屏／空白引导检查](android-card-studio-20260929/h5/extra-runtime.json)。

最终实际测试的 Android `app-service.js` SHA-256 为 `f6e1844cdcc67e4632c04dc594e8199865963d0520ee582e3ff92c4737a7952d`，本地与设备完全一致。原生截图、导出和路由回归均在这份当前构建重跑；QA 清理后继续以相同资源冷启动回原首页，没有再次替换运行资源。

本轮执行的回归命令：

```text
node --test tests/*.test.cjs tests/*.test.mjs
node scripts/build-dual-mode.cjs h5 unpackage/android-card-studio-20260929
node scripts/verify-card-studio.cjs
node scripts/verify-card-studio-extra.cjs
node scripts/verify-card-studio-native.cjs
node scripts/check-card-studio-final.cjs
```

Android 构建由 HBuilderX `cli.exe launch app-android --project <当前项目绝对路径> --deviceId <连接设备> --playground standard --native-log false` 完成，没有 `pagePath/pageQuery` 启动覆盖。原生验证脚本仅适用于已获准连接的标准开发基座，会暂时追加独立虚构宠物并在 finally 清理自己的数据。

未验证：Android 相册权限拒绝分支、原生系统大字体和不同输入法／手势组合、其他 Android 型号、iOS、微信真机、发行包签名安装；Android 多页保存的逐页系统回调尚未实测。长文分页与部分保存逻辑有本地测试，不能替代这些设备检查。线上文字整理仍未完成真实云端联调，本轮没有文字或图像模型调用、没有云端部署。正常 App 启动仍会请求既有账号资料服务，不宣称完全离线运行。

本轮只新增隔离的 `studio_qa_...` 虚构宠物和它自己的文档／照片；脚本结束清理这些专属数据并恢复原活动宠物。没有清 App 数据或卸载。最早一次中断的确切 QA receipt 也已单独清理，不扫描删除用户资料。相册中主动保存的测试图片作为验收成果保留。

## 你可以直接操作的验收路线

1. HBuilderX 打开上述项目，以普通“运行到 Android 基座”启动，不指定制卡页面。已有宠物应进入原首页。
2. 点“记录今天”，在同一天填写生活原话、照片和需要的健康观察，保存后点“按这份记录制卡”。健康仍需在卡片内容面板中主动选入。
3. 内容中选择照片，应用后切到“照片明信片”；在印记中盖朱印，在纸面中开关正文横线，检查实际预览与保存图片。
4. 点击“一句话”。确认前应仍看见原作品；点“继续用当前版式”原图不变。再次选择并确认已有原话，新版生成后可点“返回上一版”。
5. 切“今日记录卡”，内容中主动选择“健康项目摘要”及实际有结果的项目；保存原记录的健康数据不受卡片开关影响。
6. 关闭姓名、健康或照片时，旧敏感图应立即撤下重绘；取消面板也不会恢复刚关闭的内容。保存图片应对应新版本。
7. 内容面板打开时按手机返回，应只关面板；再返回制卡前的记录。重启 App 仍进首页，重新从原记录进入后草稿可继续。
8. 怀念模式选择已有记录做信纸，明确采用原话，设置称呼、压印与横线。它不会自动带出健康或死亡日期。

视觉是否认可由用户验收决定，本轮没有把该方向扩展为更多新模板。
