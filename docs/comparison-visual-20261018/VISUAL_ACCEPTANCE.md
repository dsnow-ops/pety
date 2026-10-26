# 两图对照视觉专项验收 · 2026-10-18

已在当前真实仓库完成必要界面修复和实际H5交互复验。最终运行使用本轮 final 构建；没有独立HTML样板、生成效果图、生产部署或付费API调用。没有改记录数据结构、来源ID、导出流程、账号/宠物/模式隔离、会员规则或原文/AI候选处理。

## 修复前问题与处理

| 问题 | 本轮处理 | 证据 |
|---|---|---|
| 上轮最终样例两图画面相同，不能验证比例与差异 | 真实文件选择器导入纵向室内猫照、横向橙色花照；都明确是TEST、拍摄日期未知 | [素材与授权](fixtures/ATTRIBUTION.md)；[前后图](SCREENSHOTS.md) |
| 固定1440高纸面、固定照片/说明起点造成下部意外空置 | 新建对照按实际文字行数、照片比例分配空间；同内容从1080×1440改为1080×1186。长说明时纸面扩展，最终样例1080×1234。保留自然留白与印记位置 | baseline-visual/initial-layout.json、final-acceptance/initial-layout.json、PNG |
| 长标题第二行只剩一个字 | 两行标题末行过短时均衡换行，不改文字和主动换行 | [长标题实测](final-acceptance/long-copy.png) |
| 自由印记盖住文字时无提示 | 用真实文字测量和旋转方形相交判断显示非阻断提示，允许继续盖在文字、照片、边缘；不吸附、不改坐标 | [修复前](baseline-visual/seal-over-text-before.png)、[修复后](final-acceptance/seal-over-text.png) |
| H5视口改变时印记编辑纸面未重新测量 | 增加H5 resize测量；四种宽度下坐标、角度、比例不变 | free-seal-360/375/390/412.png |
| 重开后顶部标题退回“几个片段”；编辑按钮称“设为封面” | 保持对照作品名称；编辑区用左右顺序文案 | [重开](final-acceptance/reopened.png) |

旧作品仍采用原算法。模板版本保持7，自由印记 transformVersion保持1；仅新建对照配方带 layoutRevision=2。未给已有冻结作品或旧草稿补写标记。已有“按最新资料制作新版”路径可新建新版，原作品不变。当前测试旧v7作品在新代码下导出PNG与修改前字节相同。

## 实际修改文件

| 业务文件 | 改动目的 |
|---|---|
| [common/card-layout-v7.js](../../common/card-layout-v7.js) | 新建对照的自适应纸高、完整照片比例、紧凑日期/说明间距、长标题均衡换行；未标记v7继续旧算法。 |
| [common/record-work-recipes.js](../../common/record-work-recipes.js) | 只透传新对照的排版修订标记到冻结渲染参数；保留来源ID、日期、模板版本7。 |
| [common/card-studio-page.js](../../common/card-studio-page.js) | 新建对照启用排版修订；将临时文字边界交给印记编辑器；重开后顶部保持“两张照片的对照”。 |
| [components/NarrativeCanvas.vue](../../components/NarrativeCanvas.vue) | 从真实Canvas测量文字边界，仅用于编辑提示，不写回作品/来源或改变绘制命令。 |
| [common/seal-transform.js](../../common/seal-transform.js) | 增加旋转印记与文字区域的轻量相交判断，仅读取坐标。 |
| [components/FreeSealEditor.vue](../../components/FreeSealEditor.vue) | 遮字提示不阻断完成；提示区保持稳定高度；H5窗口变化时重新测量纸面，保留规范化坐标。 |
| [pages/card-compose/card-compose.vue](../../pages/card-compose/card-compose.vue) | 对照编辑区使用“左右顺序、说明和日期”及“移到左/右边”，去除不适用的封面文案。 |

新增验证脚本 [verify-comparison-visual.cjs](../../scripts/verify-comparison-visual.cjs) 与 [comparison-visual-20261018.test.cjs](../../tests/comparison-visual-20261018.test.cjs)。没有引入测试框架。26个受保护基线文件中只变更上述7个，另外19个哈希不变；[基线](baseline/manifest.json)、[逐行真实差异](source-diff.patch)、[源码清单](final-source-manifest.json)、[空白检查](diff-check.log)均保留。Git原有未提交/未跟踪修改保留，未reset/clean/stash/commit/push。

## H5实测

环境：Windows本机 Edge 155.0.4283.62、已有Playwright、HBuilderX 5.26 Vue3。脚本访问真实构建的 http://127.0.0.1:53029，完成后关闭临时HTTP服务；这不是部署。全程使用全新隔离浏览器上下文，只有 TEST-VISUAL-P1，无真实账号数据。

| 操作 | 结果 |
|---|---|
| 真实选择两张差异照片→本地持久化→陪伴册照片视图→两图对照 | 通过；原图SHA不同，猫照1312×1900、花照640×427，未重新生成/修图 |
| 交换左右顺序，日期隐藏/恢复，编辑标题和说明 | 通过；来源ID只交换次序，原始记录深比较不变；日期是“时间未详”，未拿创建时间填充 |
| 长标题、较长说明、完整照片/填满取景/重置 | 通过；内容完整，文字未裁切；纸面真实重绘 |
| 左下/右下预设与自由盖字 | 通过；预设不遮正文；盖字有提示，仍能完成 |
| 实际鼠标拖动、角点旋转缩放、撤销、重置、纸边裁切 | 通过；无程序代填位置；返回编辑时维持同一规范化坐标 |
| 360/375/390/412宽工作台与自由印记编辑器 | 通过；真实截图与几何断言，导航/工具/按钮未越界，编辑纸面适配视口 |
| 预览→存入册页→实际下载PNG→重开→再次下载 | 通过；预览/下载/重开PNG字节一致；最终保留约-29.26°旋转、12.07%纸宽印记 |
| 原v7冻结作品在新代码下重开 | 通过；原始冻结payload和修改前PNG字节均一致 |

最终 final-acceptance/browser.json 的6组综合断言全部通过；[完整运行证据](final-acceptance/browser.json)、[汇总](verification-summary.json)。另有相关本地回归 **114/114通过**：[日志](regression.log)、[精确命令](regression-command.json)。旧版排版命令、比例/边界、预设不遮字、提示不改坐标、来源/账号隔离等均有回归覆盖。

H5编译通过：[最终编译日志](../../unpackage/comparison-visual-20261018/final/build-h5.log)。编译成功未替代上表实际交互。浏览器未捕获未处理异常；控制台保留1次ERR_FAILED，对应测试脚本主动阻断的 https://cdn.dcloud.net.cn 图片请求，未将其写作网络成功；测试两张照片均从本机真实字节读取。

## 前后画面与真实导出

以下均为浏览器完整截图；点击可看原始分辨率。全部截图、各宽度和原生PNG见 [截图索引](SCREENSHOTS.md)。

| 修复前，同一TEST内容 | 修复后，同一TEST内容 |
|---|---|
| ![修复前390宽](baseline-visual/studio-390.png) | ![修复后390宽](final-acceptance/studio-390.png) |

[最终交互后的工作台](final-acceptance/final-studio-390.png) · [真实下载PNG](final-acceptance/final-export.png) · [重开后PNG](final-acceptance/reopened-export.png) · [旧作品重开PNG](final-acceptance/legacy-reopened-export.png)。图片哈希/尺寸见 [screenshot-manifest.json](screenshot-manifest.json)。没有把缩略图或模型效果图当导出。

## 复现与待验收

本轮采用的入口：陪伴册→照片→选入两图对照→预览；内容→左右顺序/说明/日期；印记→自由放置→拖动角点→完成；存入册页→重开→保存图片。脚本会生成自己的隔离TEST资料，不使用真实用户资料。

```powershell
node scripts/build-dual-mode.cjs h5 unpackage/comparison-visual-20261018/final
node scripts/verify-comparison-visual.cjs <新的证据目录名> final
```

未发现本轮已测范围内尚未修复的H5问题。以下仍不在已通过范围内：Android模拟器未实测，Android真机未实测；原生双指手势、Canvas导出/相册权限、系统安全区/返回和前后台待集中验收；真实云鉴权/跨设备会话未实测。旧作品刻意保留原版式；极长内容仍沿用既有溢出保护，没有静默截断或扩展模板容量。

未部署，未调用付费API，未新增上传/视频服务，未清理真实资料。过程失败与复测见 [FAILURES_AND_RERUNS.md](FAILURES_AND_RERUNS.md)。
