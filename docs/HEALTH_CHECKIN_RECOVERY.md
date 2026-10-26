# 健康打卡核心链路恢复 · 2026-09-28

本轮按 `D:/downloads/GUIZHUA_HEALTH_CHECKIN_RECOVERY_P0.md` 执行（项目根目录未发现同名文件，完整读取了用户提供的文件）。卡片阶段 B 及视觉扩展继续暂停。恢复健康功能不代表用户认可现有卡片视觉。

## 先看实际运行

以下全部是虚构宠物和虚构观察记录。Android 图片来自连接的 HBuilder 开发基座截图，不是 H5 仿手机图。默认猫图是应用原有兜底图，本轮没有生成或更改宠物形象。

| 原健康入口 | 完整原健康字段 |
| --- | --- |
| ![Android 首页健康入口](health-recovery-evidence/native/home-health-entry.png) | ![Android 健康表单](health-recovery-evidence/native/health-fields.png) |

| 日历回看 | 修改后保存 |
| --- | --- |
| ![Android 日历回看](health-recovery-evidence/native/calendar-history.png) | ![Android 编辑健康记录](health-recovery-evidence/native/health-edit.png) |

[Android 保存后的首页](health-recovery-evidence/native/home-health-saved.png) · [H5 历史日期](health-recovery-evidence/h5/calendar-history.png) · [H5 未填状态与同日生活记录](health-recovery-evidence/h5/health-fields.png) · [怀念模式查看健康历史](health-recovery-evidence/h5/memorial-health-history.png)

## 问诊真正收到的输入

实际路径为：`calendar.saveRecord` → `saveDiaryRecord` → 当前账号作用域的 `pet_diaries_<petId>[YYYY-MM-DD]` → `getDiaryMap` → `buildDiaryContext` → `chat.buildUserMessage` / `sendMessage` → `api_deepseek` 的 `exports.main` → 模型 HTTP 请求体 `messages`。

客户端负责读取本地健康记录并发送必要摘要；服务端没有重新读取另一份健康数据库。本轮没有改架构或上传整份日历。聊天历史仍由 `chat-context-builder` 按 petId / relationshipStage 筛选，健康摘要是在聊天页面通过 diary-store 构建，并非凭该模块的文件名推测读取路径。

真实 H5 页面操作了三个日期，然后从实际发送方法截获参数，运行仓库服务端主函数，在 HTTP 出口保存最终序列化请求体。编辑后该请求体中的健康部分如下（原样摘录）：

```text
用户近期健康日历记录（未填写不代表正常；仅供背景参考）：
2026-09-28 状态:未填写；事件:饮水；备注:虚构样本：记录饮水，精神未观察。
2026-09-27 状态:平稳；事件:便便；备注:虚构编辑：软便一次，无呕吐。
2026-09-26 状态:平稳；事件:饮食；备注:虚构样本：按平日进食，无呕吐。
```

编辑前 9 月 27 日为“不适 / 异常情况 / 食欲下降”。编辑后的下一次请求替换了该值。9 月 28 日的状态仍是“未填写”。同日生活文案中的“食欲恢复正常，检查全部正常”和另一只宠物的病历都没有进入健康摘要。

Android 又独立经过真实健康表单、原生存储、返回重进、编辑、聊天输入和发送按钮，截获的客户端请求及本地服务端最终请求体均包含：

```text
2026-09-28 状态:平稳；事件:饮食；备注:虚构实机新值：软便一次，无呕吐。
```

没有再出现该次实机编辑前的“虚构实机样本：食欲下降，无呕吐”。

证据文件：[H5 两次完整输入及虚构持久化记录](health-recovery-evidence/h5/consultation-inputs.json)、[Android 客户端及最终模型请求体](health-recovery-evidence/native/consultation-input.json)、[H5 运行断言](health-recovery-evidence/h5/runtime.json)、[Android 运行断言](health-recovery-evidence/native/runtime.json)。

**验证层次：**页面、健康读写、上下文选择、请求序列化均使用真实业务代码；服务端执行了当前仓库 `api_deepseek/index.js` 的真实主函数和最终请求构建。只替换本地测试 I/O、限流数据库和模型 HTTP 出口，响应是明确的测试替身。没有调用云端已部署函数，没有验证真实模型回答。请求证据不含真实身份令牌、密钥或用户病历。

## 恢复参照与已证实根因

核查了当前代码、Git `aff95a5b530a264e0fe496d13e9af3c1ff03082e`（2026-09-06）和 `unpackage/dual-mode-20260928/baseline/source/` 的健康源码。后者是双模式改造前的候选快照，已核对实际内容；`visual-v2` 基线已有入口替换，未把它当原健康实现。没有整体回滚任何版本。

1. `home.handleCoreAction('journal')` 已改为一律进入 narrative；首页健康主动作、原快捷入口失去原路由。首页完成状态还把 `todayCreative` 算作健康记录，周历只允许已有记录的日期打开。
2. 原日历表单仍在，未证实原健康数据被删除。问题是入口、健康/生活状态混淆以及编辑读取的优先级，不是“重新做一个简版表单”。
3. `diary-store.getDiaryMap` 无条件让创作旧记录覆盖层的 `text || original` 覆盖健康 note，较新的健康修改仍可能被旧覆盖层遮住，采用的润色文本也可能进入问诊。
4. `normalizeDiaryRecord` 原来重建固定字段对象，保存时可能丢未知兼容字段；默认 `calm` 把未填写变成平稳。
5. 日历按宠物**当前模式**决定表单和保存结构，怀念模式查看陪伴期记录时隐藏健康字段，并可能重写记录阶段。原保存还清掉另一类字段及来源信息。
6. `chat.buildMemorialContext` 原来不筛阶段，直接把 diary.note 当回忆。已限制为怀念记录的公开回忆，避免健康病历进入宠物口吻聊天；`privateNote` 仍不消费。

## 原能力逐项对照

| 原有内容 / 契约 | 当前修复及结果 |
| --- | --- |
| `mood`：`good` 轻松、`calm` 平稳、`tired` 疲惫、`uneasy` 不安、`sick` 不适 | 5 项全部复用。未选为 `''`，再次点已选状态可取消；不补“正常”。H5 / Android 实测。 |
| `events` 多选：`food` 饮食、`water` 饮水、`spirit` 精神、`stool` 便便、`weight` 体重、`sleep` 睡眠、`exercise` 外出/运动、`clean` 洗澡/清洁、`preventive` 疫苗/驱虫、`medicine` 用药、`abnormal` 异常情况、`memo` 小事/备忘 | 原 `relationship-config` 的 12 类不变，实际页面断言全部存在。 |
| 旧 `type` 单值及历史事件：`appetite_good`、`appetite_low`、`water_more`、`stool_normal`、`stool_soft`、`diarrhea`、`vomit`、`cough`、`itch`、`lethargy`、`medicine`、`vaccine` | 原记录中存在时动态显示原选项，原 key 和显示标签保留。修复取消旧 type 后仍显示选中的问题；上下文包含 type 与 events，去重后摘要。 |
| `note`，原输入上限 500 字 | 原 textarea 保留。单位和数值按用户原话记录，不更换量纲。已确认原日历没有独立体重数值/单位输入框，也没有日历附件上传控件；档案体重是另一项既有能力，不冒充本轮恢复的字段。 |
| 已存 ID、`date`、`createdAt`、`updatedAt`、`source`、`sourceChatIds`、未知字段/既有附件属性 | 以原记录为底局部合并，只忽略未提交的 undefined；明确空字符串、false、0 保留。稳定 ID、创建时间及未知对象、附件数组的保留有行为测试。没有新增附件功能或迁移附件文件。 |
| `relationshipStage`；怀念用 `reflectionTags`、`memoryText`、`privateNote` | 按记录创建阶段加载与保存，不因宠物当前模式重写陪伴期健康资料。健康编辑不再清掉其他原字段。 |
| 账号、petId、日期归属 | 继续用现有 scoped-storage；绑定保存作用域，校验当前宠物及模式，乐观版本阻止过时覆盖。A→B→A 旧租约测试通过。 |
| 一天一条，日期 key 为 `YYYY-MM-DD` | 仍是原日期 map，不新增第二份健康权威数据源。重复提交更新同一天，不追加重复事件；保存失败保留原值和界面输入。 |
| 月份前后翻、年月选择（1901–2100）、回今天、日格、`date` / `selectedDate` 路由 | 复用原实现；首页所有日期可直达对应宠物/日期的健康表单。原补记规则不收窄。未增加“补签”奖励。 |
| 日历标记、历史查看、编辑 | 首页健康标记只消费健康记录；日历健康表单置于独立生活片段列表之前。旧 care 编辑链接返回原日历。H5 两类内容同日分别编辑，不互相覆盖。 |
| 最近有效健康记录摘要 | 保持聊天端最近 3 个已记录日期、最多 260 字的原预算及每条备注 70 字摘要；不是上传全部历史，也不是强行限为最近 3 个自然日。先筛未来/怀念/空记录，再取健康日期，未填明确未知。长问题仍受原总请求预算限制。 |
| 原持久化 / 同步 | 确认原健康实现是本地同步写入 storage；未找到该链路已有健康云同步实现，未谎报云同步。未删除任何云端或本地真实记录。 |
| 档案、记录明细、问诊摘要、照护接续 | 档案及 insights 仍消费原数据；consultation-store / care-followup / chat-session-store 未改，问诊回复摘要仍走原保存路径。已有回归测试保留；真实在线服务和两项相似案例链接失败单列如下。 |

覆盖层只读时不迁移。较新的 legacy.original 可提供已经存在的用户编辑；润色 `text` 不再作为健康事实。健康保存只合并当前一天，更新时间严格晚于生效覆盖层，防止旧层复活；创作文档和历史作品仍保留。

## 12 项验收落点

| 场景 | 证据 / 层次 |
| --- | --- |
| 1 首页原健康入口 | H5、Android 直接进入原表单。 |
| 2 历史日期 | H5 9/26、9/27、9/28；Android 当前日保存后重进回看。 |
| 3 保存重进、保留字段 | 两端操作；ID/未知字段/附件/来源等单元测试。 |
| 4 部分填写、空/否/零 | H5 未填状态；单元测试显式空、false、0、undefined 区别。 |
| 5 只有生活片段 | H5 先保存健康措辞的生活文案，首页仍显示健康未记录，健康上下文为空。 |
| 6 同日健康与生活 | H5 从日历进入生活编辑并保存，逐字段比较健康 map 完全不变。 |
| 7 健康入问诊 | H5、Android 实际客户端请求 + 本地真实服务端最终 HTTP 请求体。 |
| 8 修改后新值 | H5 编辑前后两次问诊；Android 改后发送，新备注出现而旧备注消失。 |
| 9 切宠/切账号/异步 | H5 第二宠物独立数据；存储和现有请求竞态测试含 A→B→A 失效租约。未进行真实账号登录联调。 |
| 10 陪伴→怀念→陪伴 | H5 不显示健康催促、原健康字段仍可查、切回入口和健康状态恢复；角色聊天排除病历有行为测试。 |
| 11 失败/离线/重复 | 本地存储失败后原记录不变、重试成功、版本冲突不覆盖、同日不重复；Android 原生本地写入重进。未模拟物理磁盘耗尽。 |
| 12 创作及旧业务 | 原文、草稿、照片、作品、形象、会员和聊天隔离相关既有测试运行；本轮前后受保护源码哈希一致，见下节。未逐个重跑全部实机创作路径。 |

## 修改范围、基线与测试

本轮开始已有大量未提交修改。先保存 `unpackage/health-recovery-20260928/baseline/`：340 个源码文件及 SHA-256 清单，排除密钥、真实配置和用户素材。相对于这份本轮基线，实际变化仅：

- `common/diary-store.js`：合并保存、覆盖层优先级、未知状态、健康摘要。
- `pages/home/home.vue`：健康路由、独立完成状态和生活次级入口；没有当前宠物时返回原建档流程，避免访问空 petId。
- `pages/calendar/calendar.vue`：原表单保留、历史阶段、保存保护与错误反馈、日期和独立生活入口、安全区读取。
- `pages/narrative/narrative.vue`：旧 care 路由回原健康表单、新生活记录接收日历选中日期。
- `pages/chat/chat.vue`：只为宠物口吻上下文筛除健康记录，读取原怀念 memoryText。没有改问诊权限、提示人设或模型配置。
- `tests/rc-data-scope.test.cjs`：更新测试依赖注入以覆盖新增保存校验，原跨账号断言保留。

新增 `tests/health-checkin-recovery.test.cjs`、`scripts/lib/health-recovery-runtime.cjs`、两端 verify-health 脚本、开发构建辅助脚本及本报告/虚构证据。`changed-since-baseline.json` 保存上述 6 项差异清单。narrative-store、媒体持久化、卡片渲染、奖励计数/发放、scoped-storage、形象生成/会员、云函数、`uni_modules` 源码均与本轮基线一致。

不使用整体快照回滚。若需撤回本轮某处，逐文件对照基线并只撤对应差异；先检查其后是否有新的修改，不覆盖并行工作。没有 commit / push / reset / stash。

已执行：

```text
node --test tests/*.test.cjs tests/*.test.mjs
node --test tests/health-checkin-recovery.test.cjs
node scripts/build-dual-mode.cjs h5 unpackage/health-recovery-20260928
node scripts/build-dual-mode.cjs app unpackage/health-recovery-20260928
node scripts/build-dual-mode.cjs mp-weixin unpackage/health-recovery-20260928
node scripts/verify-health-recovery.cjs
node scripts/verify-health-native.cjs
git diff --check
```

开工基线 411 项、409 通过、2 失败；本轮最终 420 项、418 通过、2 失败；新增健康专项 9/9 通过。两项失败与基线相同：`tests/p0-recovery-v1.test.cjs:53`、`tests/pet-avatar-v5.test.cjs:102` 的相似案例 links.length 实际 0、预期 1。没有删断言或屏蔽测试，不把这些失败标成已修。日志在 `unpackage/health-recovery-20260928/`。

## 平台与部署边界

| 平台 | 本轮已验证 | 未验证 / 限制 |
| --- | --- | --- |
| H5 / Edge 390×844 | 真页面输入、保存、3 日期、编辑、同日两链路、旧链接、切宠/切模式、两次实际问诊序列化及本地服务端出口；运行异常 0 | 真实云网络/模型、其他浏览器和全设备矩阵未验证。 |
| Android HBuilder 开发基座 | 真设备 1312×2848 截图；真实表单、本地写入、回看编辑、真实聊天发送与序列化、本地服务端输入核对 | 使用隔离编译测试出口和数据库初始化替身；不是生产签名安装包或真实云联调。 |
| App 发行资源 | 当前源码编译成功 | 命令行构建不带当前 HBuilder 服务空间关联，直接放进这台基座会在原账号模块数据库初始化处白屏；实机验收使用 HBuilder 当前自动编译资源。未改服务空间或发布。 |
| 微信小程序 | 构建成功 | 未在微信开发者工具/真机运行；仍有既有鸿蒙 UA 兼容提示。 |
| iOS | 未运行 | 不以 App 通用编译结果代替 iOS 实测。 |

实机验收遇到编译资源混用，已对齐当前 HBuilder 脚本和样式；也处理了键盘关闭和 WebView 重建时的测试定位。没有为此改账号、数据库权限或删除应用数据。测试临时添加唯一虚构宠物，保留原宠物列表，结束后按回执只清理该虚构宠物/记录、恢复原当前宠物与授权值；最终恢复同一 HBuilder 正常编译脚本，测试云出口不留在设备或正式源码中。[只读清理与脚本哈希核验](health-recovery-evidence/native/cleanup.json)确认测试 key、测试宠物、测试当前宠物均为 0。最终补充的空宠物入口保护已通过行为测试及三端构建，实机截图使用有宠物的完整健康链路，未另测空宠物实机场景。

文字模型 0 次、图像模型 0 次、云部署 0 次、生产发布 0 次。当前修复是本地源码和开发设备验收结果，不能称线上已修复。

本轮没有必要的云端代码改动。若后续要求验证已部署版本，需要先明确目标开发空间并授权最小真实问诊联调；再核对该空间的服务端版本、请求日志和响应，不能把本地服务端证据称为真实云入模。

## 用户操作路线

1. 选择陪伴中的宠物，首页点 **健康打卡**；应直接看到 5 种状态、12 类事件和手写记录，不出现写作、选模板或制卡步骤。
2. 选择真正观察到的几项并保存。可以不选总体状态；未选应显示“未填写”，不能自动变平稳。
3. 返回首页点日期，或进入健康日历选历史日期，回看并修改一项后保存；退出重进确认新值和其他字段仍在。
4. 打开 **AI 问诊**。真实在线发送会使用现有模型服务和额度；本轮仅用隔离出口完成了上述输入证明。需要在线复核时在确认的开发环境执行，不把 AI 回答措辞当唯一证据。
5. 返回首页点次级 **记生活片段**，保存一条生活记录。重新进入原日期健康页，健康选择和备注应仍在；日历下方的生活片段应进入自己的写作编辑器。
6. 切到另一只宠物核对记录独立；再将测试宠物切怀念，首页应不催健康打卡，档案/日历仍能查看其陪伴期健康历史；切回陪伴后健康入口恢复。

卡片视觉验收仍由用户决定，本轮不延伸到其余模板或阶段 B。
