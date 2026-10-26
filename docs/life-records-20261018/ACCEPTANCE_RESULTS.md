# 剩余25项 H5 复验 · 2026-10-18

25项的电脑 H5 可执行部分全部跑完：23组浏览器场景覆盖25个矩阵编号，全通过，未捕获 pageerror。按原条目完整条件，21项由 NOT_RUN 更新为 PASS，4项为 BLOCKED（H5 部分已通过，仍需对应平台）。没有把这25项写成全平台完成。

- 实际修复：新补记在 H5 以稳定 recordId 重开，刷新不会创建另一空草稿；照片读取中和失败分开提示，加载中点击不会误报失败或重复读取。
- 业务源码只改 pages/calendar/calendar.vue、pages/album/album.vue。21个既有基线文件核对中19个未变，详见 [源码对照](source-comparison.json)、[本轮差异](source-diff.patch)、[最终哈希](final-source-manifest.json)。AGENTS.md 已包含电脑优先策略，本轮未重复覆盖。
- 当前全表：PASS 85、BLOCKED 13、NOT_RUN 0、DEFERRED 8。这是含历史证据的106行状态分布，不是本轮106项重测，也不是产品完成率。原64项通过仍属于10月16日证据。

## 本轮运行与端别

| 检查 | 状态 | 依据和限制 |
|---|---|---|
| H5真实项目交互 | 23/23组通过，覆盖25项电脑部分 | [完整结果](final-confirmed/results.json)、[运行摘要](final-confirmed/summary.json)、[截图索引](SCREENSHOTS.md) |
| 本地自动化回归 | 104/104通过 | [日志](local-tests.log)、[精确命令](local-test-command.json)；包括记录/隔离/作品/旧资料/日历路由/主视觉恢复；不冒充真实云/原生 |
| H5编译 | 通过 | [编译日志](../../unpackage/life-records-20261018/build-h5.log) |
| Android App目标编译 | 通过 | [编译日志](../../unpackage/life-records-20261018/build-app.log)；没有安装、打正式签名包或连接设备 |
| Android模拟器 | 未实测 | 本轮没有启动模拟器 |
| Android真机 | 未实测，待集中验收 | H5截图均不标为真机截图 |
| 真实云鉴权/单设备登录/会话撤销 | 未实测 | 离线 TEST 所有权/锁定仅验证生产前端隔离行为 |
| 部署/付费API | 未部署/未调用 | 浏览器外部请求统一阻断；本轮记录阻断2次，未发送付费模型或上传请求 |

环境：Windows 10.0.26200，Edge 155.0.4283.62，已有 Playwright 和 HBuilderX 5.26 Vue3。脚本启动真实编译产物的本机 HTTP 服务，实际访问 http://127.0.0.1:51417 并完成交互；该端口运行后已关闭，并非永久服务或部署。独立 browser context 只含 TEST 资料，无真实账号、真实用户存储或真实清理。

## 逐项验收

“整项状态”保留原条目的平台要求；H5列的通过只覆盖下述明确操作。除表中四项外，其余 PASS 也只在实测端与样本范围内成立。

| ID | H5部分 | 整项状态 | 本轮操作与结果 | 边界/待验收 | 真实画面 |
|---|---|---|---|---|---|
| V-02 | PASS | PASS | 日历与月份弹层在浏览器 light/dark 偏好下 computed style 一致。 | 浏览器媒体偏好；Android 系统外观未实测。 | [截图](final-confirmed/V-02-dark.png) |
| V-04 | PASS | PASS | 首页同组按钮齐高；保存与作品按钮的默认/加载/禁用状态尺寸不跳动，360/390/412。 | 加载/禁用为生产组件状态注入，仅验几何；不计作业务成功。 | [截图](final-confirmed/V-04-busy-360.png) |
| V-05 | PASS | PASS | 12 事件、5 状态和分段控件在三种宽度齐高、无水平裁切；状态可选择和取消。 | H5 鼠标交互，原生触控反馈未验。 | [截图](final-confirmed/V-05-390.png) |
| V-07 | PASS | BLOCKED | 真实保存长名，输入中英混排，生产字号状态 1.5 倍；三种宽度不溢出。 | H5 通过；Android 系统大字体待真机验收。 | [截图](final-confirmed/V-07-name-360.png) |
| V-08 | PASS | BLOCKED | 390×480 可视区实际聚焦、输入80行、保存、开关底部面板、返回保留内容。 | H5 通过；真实软键盘/安全区待真机验收。 | [截图](final-confirmed/V-08-short-viewport.png) |
| V-10 | PASS | PASS | 空册、有内容、延迟读照片、缺失 TEST 照片分别检查；加载/错误提示已分开，三宽复验。 | 延迟真实 IndexedDB 回调制造加载态；缺失仅删除隔离 TEST Blob。 | [截图](final-confirmed/V-10-loading-390.png) |
| R-02 | PASS | PASS | 实际文件选择、照片单独保存、刷新读取真实持久化字节；健康字段为空。 | H5 IndexedDB；原生持久化路径未验。 | [截图](final-confirmed/R-02-photo-only.png) |
| R-04 | PASS | PASS | 生活文字与体重/用药原始观察跨分段切换、保存重载，否定词和单位保留。 | 使用虚构观察资料，无医疗推断、模型调用。 | [截图](final-confirmed/R-04-unified.png) |
| R-07 | PASS | BLOCKED | 补记草稿实际返回/重开/刷新，切 P2 后为空，再回 P1 原草稿；正式记录数为0。 | H5 通过；Android 前后台生命周期待真机验收。 | [截图](final-confirmed/R-07-draft-restored.png) |
| R-09 | PASS | PASS | 注入 QuotaExceededError，保存失败且正式记录数0；解除故障后实际保存并刷新恢复。 | 浏览器存储错误注入，不是物理磁盘填满或真机空间不足。 | [截图](final-confirmed/R-09-failed-save.png) |
| R-10 | PASS | PASS | 正常图+真实损坏 PNG，附件失败阻止直接保存，刷新保留标记/文字，明确部分保存后恢复正常图。 | H5 实际字节流程；无上传/云成功替身。 | [截图](final-confirmed/R-10-partial-recovered.png) |
| R-14 | PASS | PASS | 无拍摄元数据 PNG，经实际 H5 选择器选择时间未知，保存重开无虚构日期。 | 没有按文件修改时间填充拍摄时间。 | [截图](final-confirmed/R-14-unknown-date.png) |
| R-15 | PASS | PASS | 上海午夜前保存，同一存储切洛杉矶次日读取，事件当地日期与 createdAt 不漂移。 | 浏览器固定时钟与真实 timezoneId 上下文；非 Android 时区设置。 | [截图](final-confirmed/R-15-timezone.png) |
| L-01 | PASS | PASS | 首页周历→同日日历保存→月历同日→陪伴册原记录，日期和原文一致。 | H5 实际点击及同一来源。 | [截图](final-confirmed/L-01-same-source.png) |
| L-02 | PASS | PASS | 实际月份选择器点击2025年，2025-10第11条打开详情/浏览器返回，筛选与滚动位置恢复。 | 电脑 H5 返回；不代表 Android 系统返回。 | [截图](final-confirmed/L-02-return-position.png) |
| L-10 | PASS | BLOCKED | 离线 A/B/游客与 P1/P2 所有权夹具驱动生产 scope；切换后查询、行与预览清空。 | H5 隔离机制通过；真实登录 UI/云 token/单会话链待真实环境验收。 | [截图](final-confirmed/L-10-isolated.png) |
| W-01 | PASS | PASS | 第一条有效文字先保存，作品建议可选；由用户打开小册。 | 没有强制制作作品或改变会员。 | [截图](final-confirmed/W-04-historical-booklet.png) |
| W-04 | PASS | PASS | 从2025-10-03历史记录生成小册、保存、重开，冻结 payload 和收据不变。 | 实际 H5 Canvas 和本地作品；原生系统相册另验。 | [截图](final-confirmed/W-04-historical-booklet.png) |
| W-06 | PASS | PASS | 实际更多菜单→整理标签与节点→保存自定义里程碑→清除名称取消。 | 只改隔离 TEST 来源元数据。 | [截图](final-confirmed/W-07-atlas.png) |
| W-07 | PASS | PASS | 两个来源明确标记 habit，图鉴显示“你记录过的2条”，点入原记录。 | 未推断真实发生频率。 | [截图](final-confirmed/W-07-atlas.png) |
| W-11 | PASS | PASS | 同日两张真实图片选入对照，预览并下载1080×1440 PNG；两日期相等，无健康/年龄推断。 | 电脑浏览器真实下载；Android 相册权限未验。 | [截图](final-confirmed/W-11-preview.png) |
| P-05 | PASS | PASS | 实际确认 P1 进入纪念，旧生活记录仍在，生活收集建议隐藏；P2 保持当前状态。 | H5 实际归档页面切换，夹具宠物。 | [截图](final-confirmed/P-05-memorial.png) |
| P-10 | PASS | PASS | 模拟本地会话锁定，编辑器撤下 A 私有内容，A 草稿保留；解除锁定重开内容一致。 | 原矩阵要求模拟撤销；此项仅 H5 模拟通过，真实云撤销仍待验收。 | [截图](final-confirmed/P-10-locked.png) |
| P-12 | PASS | PASS | 只删除本轮命名 TEST 临时记录，原有 TEST 基线记录深比较不变；真实用户存储未打开/清理。 | 仓库保护另见源码差异与任务前后 Git 状态；不冒称读取验证了用户全部资料。 | [截图](final-confirmed/P-12-retained-baseline.png) |
| E-03 | PASS | PASS | 0/1/30/1000条实际册页，首屏30条，点继续查看60条；记录 IndexedDB 读取数与计时。 | 1000不同记录共享一份真实持久化照片；不是1000张独立高清原图性能认证。 | [截图](final-confirmed/E-03-1000-pagination.png) |

## 性能样本

真实浏览器中的1000个不同 TEST 记录共享一份实际持久化照片。各规模依次使用同一 context，图片已预热；计时从替换规模夹具到 resultCount 更新，包含夹具构造和元数据投影，**不是冷启动、照片全部解码或首屏呈现时间**。IndexedDB读取累计包括记录封面、照片视图以及翻页，照片首批30条、点继续查看后等待60个预览来源均完成读取，未一次读1000份。不能推断1000张独立高清原图的内存/低端机表现。

| 记录数 | 元数据转换毫秒 | IndexedDB get次数 | 最终照片DOM条数 |
|---|---|---|---|
| 0 | 58.07 | 0 | 0 |
| 1 | 11.27 | 2 | 1 |
| 30 | 22.69 | 35 | 30 |
| 1000 | 51.76 | 95 | 60 |

## 可复现入口和命令

1. 陪伴册→补记一刻→输入→保存或返回→重开/刷新：仍为同一草稿或记录。切宠后回原宠物才能恢复对应资料。
2. 陪伴册→照片：真实照片读取中显示读取提示；实际读取失败保留原记录和查看原记录入口。延迟/损坏场景由隔离脚本复现，不在产品里新增故障按钮。
3. 陪伴册→筛选→跳到月份→点年份→完成→打开记录→浏览器返回：保留月份与滚动位置。
4. 记录→可选陪伴册建议→保存作品→重开；照片→选择两图对照→保存图片：浏览器产生真实PNG下载。

```powershell
node scripts/build-dual-mode.cjs h5 unpackage/life-records-20261018
node scripts/verify-life-remaining.cjs <新的证据目录名>
node scripts/build-dual-mode.cjs app unpackage/life-records-20261018
```

自动化运行命令完整参数见 local-test-command.json。重复运行须用新目录，避免覆盖本轮截图。H5脚本无需单独维持开发服务器，复用项目编译产物和原运行依赖。所有截图都是当前项目真实运行，无独立HTML效果样张。

## 集中待验收清单

- V-07/V-08：Android系统大字体、软键盘、长文、底部面板与安全区组合。
- R-07及原E-01：Android前后台/持久化路径/冷启动恢复；原V-09/V-11的页面栈、系统返回、图标触控与降低动画。
- 文字照片与作品：plus路径、相册权限、原生Canvas、多指手势、系统相册导出。浏览器下载不等于相册保存。
- L-10及原A-06/P相关条目：真实A/B登录、退出/撤销/单设备会话，旧账号草稿不迁入游客。P-10的模拟锁定已过，服务器真实撤销未验。

本轮未连接真机或真实云环境，因此这些项保留待验收。服务器、存储、新上传与视频管线继续延期。未修改会员、支付、额度、原文/AI候选分离或默认启动路由。

失败与修复经过见 [FAILURES_AND_RERUNS.md](FAILURES_AND_RERUNS.md)。探查目录和早期run仅为过程证据，最终结论统一引用final-confirmed。未清理真实数据，未commit/push/reset/clean/stash。
