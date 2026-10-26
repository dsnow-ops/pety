# 日常记录与卡片字段映射（2026-09-29）

本表依据当前代码核查。此次增量保留 `pet_diaries_<petId>` 和 `_creative_v1`，不迁移或重命名历史健康字段。此前“两个竞争的健康/生活入口”安排由本轮统一记录要求覆盖。

| 逻辑字段 | 实际来源 | 使用规则 |
|---|---|---|
| text.life | 新日历记录 `lifeText`；旧 creative life 的 `original` | 保留原文，候选需在卡片再次明确选择；旧生活记录仍可编辑 |
| text.observation | 日历 `note` | 仅作为手写观察来源，默认关闭；不再复制为心情和备注 |
| text.notes | 现有旧日历没有独立公开备注来源 | 不以 note/privateNote 代填；无来源时留空 |
| text.letter | `memoryText`、creative letter/memory 的 `original` 或本作品手写正文 | 不取健康原文自动拼信 |
| text.quote / text.habit | 本作品明确输入或用户明确取用生活正文 | 不自动摘要，不调用模型 |
| health.overall | 原有 `mood`：good/calm/tired/uneasy/sick | 显示为“当日所选状态”，默认关闭；不冒充主人心情或诊断 |
| state.petObserved / state.ownerMood | 独立 `petObserved` / `ownerMood`（有真实独立来源才展示） | 不从旧 mood/note 推断；当前旧记录通常没有这两项 |
| health.items | 增量 `healthValues[key]={text,date}` | 原分类 type/events 保留，分类本身不是结果；逐项选择后才展示 |
| health.eventTags | 旧 `type`、`events` 去重后的类别 | 明确标为“记录类别”，默认关闭，不改成正常值 |
| media.photos / media.petPortrait | 持久化 media，portrait 以 sourceKind 区分 | 账号/宠物/持久性检查；明确选择照片与顺序，不补重复图片 |
| media.photoCaptions | 已选 media 的独立 caption（若存在） | 不伪造说明，不从健康备注复制 |
| identity.petName | 当前 pet.name | 新作品读取新名字；旧作品冻结；关闭同时约束印记 |
| identity.title / salutation / signature | 原 title / salutation / signature 或本作品手写 | 称呼、署名不自动补系统名字 |
| date.display | 原记录 localDate / 日历键；明确选书写日期后使用 writtenDate | 怀念新作默认关闭；不能将事件日期冒称书写日期 |
| identity.topicTags | 原 creative tags | 不从健康项目自动造标签 |
| 印记 | 既有 petSeal 像素资产，朱印/压印 | 新作品默认关闭；新资产 containsName:false；旧资产未确认且名字关闭时阻止使用 |
| 私人补充 | 原 privateNote | 永远不进入卡片 RenderPayload、文字整理或问诊 |

## 健康子项映射

| 逻辑键 | 原类别键 | 结果存储 |
|---|---|---|
| food | food | healthValues.food |
| water | water | healthValues.water |
| energy | spirit | healthValues.energy |
| stool | stool | healthValues.stool |
| weight | weight | healthValues.weight（原文单位不改） |
| sleep | sleep | healthValues.sleep |
| activity | exercise | healthValues.activity |
| grooming | clean | healthValues.grooming |
| preventiveCare | preventive | healthValues.preventiveCare |
| medication | medicine | healthValues.medication |
| symptoms | abnormal | healthValues.symptoms |
| misc | memo | healthValues.misc |

旧 appetite_low、vomit 等选项继续以原标签显示与编辑。未知扩展字段、0、false 和历史归属仍按原存储合并策略保留，未迁移为新的结果字段。

## 实现和边界

- 统一日历编辑器：健康观察 / 日常与照片共用一次保存。旧 creative 原文保留来源 ID；不会整体合并或覆盖旧记录。
- `common/card-composition.js` 负责适配、来源引用、显式选择、模板能力和展示白名单；`card-layout-v4.js` 仅接收选中快照。
- V4 为新增版本，旧 V1/V2/V3 渲染不变。新版作品存储 `snapshot.renderPayload + composition + sources`，不另存未选择的整份健康或私人原文。
- 未支持的内容不自动关掉；超出短版式容量不截字。可主动移除、选正文或切换可分页版式。
- 作品草稿以模式与来源分别保存。原记录修订时，必须保留选中快照或刷新后预览。册页旧作品只按旧快照恢复。
- 健康上下文读取原健康值和原手写观察；生活原文标为“主人日常原文（非健康结论）”。不读卡片开关、润色候选、privateNote。
- 健康是否完成仍独立判断：只有生活文字/照片的新记录不算健康已打卡。既有奖励阈值和收据键不变，新明确日常记录可以计入，同日去重；不把全部历史健康自动追溯计奖。
- 本轮没有迁移数据库、部署云函数或调用模型。文字整理仍真实校验身份，访客显示“尚未发送”，不会伪装已联通。
