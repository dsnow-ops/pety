# 归爪聊天会话隔离与连续问诊测试

> 覆盖范围：宠物 × 模式会话隔离、异步防串、current 连续问诊、一次性医疗提示、纯文本输出、memorial Phase 1 语言规则。

## 1. 会话存储约定

- current：`chat_history_${petId}_current`
- deceased：`chat_history_${petId}_deceased`
- 上下文 ID：`${petId}:${relationshipStage}`
- 旧 key：`chat_history_${petId}`
- 旧 key 备份：`chat_history_legacy_${petId}`

旧消息只有明确带 `relationshipStage` 时才分流。无 stage 消息不复制到任何新会话，旧 key 和备份均保留。

## 2. 固定测试矩阵

### 2.1 同宠物切换模式

前置：

- 宠物 A 当前为 `deceased`。

步骤：

1. 在 deceased 发送“今天我有点想你。”
2. 从档案切换宠物 A 为 `current`。
3. 返回聊天页。
4. current 发送“今天吐了两次。”
5. 再切换为 `deceased` 并返回聊天。
6. 再切换为 `current`。

期望：

- current 不显示 deceased 历史。
- deceased 恢复“今天我有点想你。”。
- current 恢复“今天吐了两次。”。
- 两个 storage key 均存在且内容不互相复制。

### 2.2 多宠物不同模式

前置：

- 宠物 A：`deceased`。
- 宠物 B：`current`。

步骤：

1. 在宠物 A 聊天页。
2. 切换 activePet 为宠物 B。
3. 返回聊天页。
4. 再切回宠物 A。

期望：

- 宠物 B 自动显示 current 标题、头像、快捷项和历史。
- 不显示宠物 A 的消息、主人称呼或 memorial Prompt。
- 切回宠物 A 后自动恢复 deceased 和自己的历史。

### 2.3 多宠物相同模式

前置：

- 宠物 A、宠物 B 均为 `current`。

步骤：

1. 宠物 A 发送“今天吐了两次。”
2. 切换宠物 B。

期望：

- 宠物 B 不显示宠物 A 问诊。
- 两个 current storage key 不同。

### 2.4 主人称呼隔离

前置：

- 宠物 A memorial 的 `ownerPreferredCall = 爸爸`。

步骤：

1. 在 deceased 对话，确认可以偶尔使用“爸爸”。
2. 切换同宠物为 current。
3. 发送一个普通照护问题。

期望：

- current 请求不传 `ownerPreferredCall`。
- current Prompt 明确只使用“你”或省略称呼。
- current 历史不包含 deceased 消息。
- current 回复不得称呼用户为爸爸。

### 2.5 请求中切换宠物或模式

步骤：

1. 宠物 A 发送消息。
2. “正在输入”期间切换到宠物 B，或切换宠物 A 的模式。
3. 等待原请求完成。

期望：

- 原请求记录的 `petId`、`relationshipStage`、`chatContextId`、`requestToken` 与当前上下文不一致。
- 原回复不插入当前页面，也不保存到当前会话。
- 定时器、输入状态、爪印临时状态已清理。
- V1 采用安全丢弃迟到回复；原用户消息已在发送时保存在原会话。

### 2.6 current 连续问诊

对话：

```text
用户：猫咪今天吐了两次。
AI：第一次和第二次分别吐了什么？
用户：第一次有食物，第二次是黄水。
```

期望：

- scope 为 `in_scope`。
- 原因为 `current_consultation_follow_up`。
- 最新用户补充位于模型 `messages` 最后一项。
- 最近 assistant 问题仍在 `conversationHistory`。
- 回复继续询问或说明呕吐物、精神、食欲、饮水和后续呕吐情况。
- 不返回无关请求收束。

还需分别测试：

- 今天没有吃东西。
- 精神还可以。
- 是黄色的。
- 两次。
- 从昨天开始。
- 没有拉肚子。

### 2.7 医疗免责声明

步骤：

1. 新 current 会话连续完成 3 轮有效问诊。

期望：

- 第一条有效 AI 问诊回复下方显示一次：
  `AI 建议仅供日常照护参考，不能替代兽医诊断。`
- 后续消息不重复。
- 提示作为 UI 小字，不拼入聊天正文。
- 清空 current 会话后可以再次显示。
- deceased 永不显示。
- 高风险症状仍在当次正文明确建议尽快就医。

### 2.8 Markdown 清理

输入模型模拟回复：

```text
**先观察几个要点：**
### 饮水
记录今天的饮水量。
```

期望：

```text
先观察几个要点：
饮水
记录今天的饮水量。
```

不得出现 `**`、Markdown 标题或代码围栏。

### 2.9 memorial 动作频率

步骤：

1. 没有任何 `allowedActions`。
2. 连续进行 10 条普通聊天。

期望：

- 动作为 0 条。
- Prompt 明确本次没有允许动作。
- 输出守卫移除行首括号动作。
- 不出现蹭手、舔脸、摇尾巴、钻怀里等臆造动作。

未来有明确 `allowedActions` 后再实现 `actionFrequency = 0.10`；本期无来源时按 0 处理。

### 2.10 memorial 语言风格

连续输入：

- 今天下雨了。
- 我没怎么出门。
- 中午随便吃了点。
- 下午一直在工作。

期望：

- 普通回复优先 25—80 字。
- 一次最多一个问题，允许不问。
- 不固定总结、安慰、升华再追问。
- 不频繁使用“珍贵回忆、温柔陪伴、慢慢整理、情感连接”。
- 不默认分成三四个完整段落。

## 3. 纯逻辑自动检查

本地自动检查至少覆盖：

1. `getChatSessionKey('pet-a', 'current')` 与 deceased 不同。
2. 宠物 A 与宠物 B 的 key 不同。
3. 无 stage 的旧消息不进入新会话。
4. 带 stage 的旧消息只进入对应会话。
5. 上下文构造过滤错误宠物、错误模式、greeting、fallback 和 error。
6. current 短补充结合最近问诊判定为 in scope。
7. current Prompt 不包含 memorial 称呼。
8. Markdown 清理不破坏普通中文标点。
9. memorial 普通回复受 80 字上限保护。
10. 无动作来源时括号动作被移除。

## 4. 手工端侧检查

由于 activePet 切换、页面 `onShow`、爪印和 `uniCloud.callFunction` 依赖 uni-app 运行时，以下项目必须在支付宝小程序或 HBuilderX 真机调试中确认：

- 页面切换后标题、头像、快捷项是否立即更新。
- 请求中切换宠物是否没有串回复。
- 医疗提示是否只显示一次且样式正常。
- 爪印和正在输入定时器是否被正确清理。
- 新 storage key 是否按宠物与模式写入。
- 原旧 key 是否仍保留。

## 5. 回归边界

- 不增加第二次模型调用。
- 不修改 current 的紧急风险提示。
- 不把 owner call、memorial 历史或动作人格传给 current。
- 不把 current 问诊、医疗提示或健康分析模板传给 deceased。
- 不自动删除任何旧聊天 key。
- 不修改 `pages.json`、`uni_modules` 或真实 `config.json`。

## 6. 本轮本地执行结果

已通过：

- JavaScript / Vue `<script>` 语法解析。
- 新 storage key 和上下文 ID 隔离。
- 无 stage 旧历史不迁移、原 key 与 legacy 备份保留。
- 有 stage 旧历史只迁移到对应模式。
- 错误宠物、错误模式、greeting、fallback、error 不进入模型历史。
- “第一次有食物，第二次是黄水”判定为 `current_consultation_follow_up`。
- “今天没有吃东西、精神还可以、是黄色的、两次、从昨天开始、没有拉肚子”均判定为 current 问诊补充。
- current 的历史角色顺序和最新 user 位置正确。
- current 不注入 memorial 的 `owner_call` 指令。
- Markdown 粗体、标题和通用医疗免责声明清理。
- memorial 无来源括号动作清理和普通回复长度守卫。

仍需端侧手工验证：

- `onShow` 切换 activePet 与 stage 后的真实页面表现。
- 请求中切换宠物时支付宝云返回是否被页面安全丢弃。
- 爪印、输入状态和一次性医疗提示的视觉表现。
- 真机 storage 中旧 key、新 key 与 legacy 备份结果。
