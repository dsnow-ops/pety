# api_deepseek 成本与安全控制

更新日期：2026-06-15

## 配置读取优先级

`api_deepseek` 的有效配置由 `getConfig()` 归一化后使用。

优先级从高到低：

1. 环境变量：`DEEPSEEK_API_KEY`、`AI_API_KEY`、`DEEPSEEK_MODEL`、`DEEPSEEK_MAX_TOKENS` 等。
2. `uniCloud-alipay/cloudfunctions/api_deepseek/config.json`。
3. `uniCloud-alipay/cloudfunctions/common/uni-config-center/api_deepseek/config.json`。
4. `DEFAULT_CONFIG`。

部署到支付宝云后，如果云函数目录里的 `config.json` 被上传并存在，通常会优先覆盖 uni-config-center 中的同名配置。真实密钥必须只放在云端或本地被忽略的 `config.json` 中，不要提交到仓库。

## 开发期低成本建议

建议开发和联调阶段使用：

```json
{
  "deepseek": {
    "model": "deepseek-v4-flash",
    "thinking": {
      "type": "disabled"
    },
    "temperature": 0.7,
    "maxTokens": 300,
    "requestTimeoutMs": 15000
  },
  "security": {
    "maxUserMessageChars": 600
  },
  "rateLimit": {
    "enabled": true,
    "freeDailyLimit": 10,
    "plusMonthlyLimit": 100,
    "membershipLookupEnabled": false
  }
}
```

如果需要更完整的回答，可以把 `maxTokens` 提高到 500-600。上线前再根据真实成本、用户量和会员策略提高 `freeDailyLimit`、`plusMonthlyLimit`。

## 模型兼容与思考模式

实时短对话默认使用 `deepseek-v4-flash`，并设置 `thinking.type=disabled`。旧配置会在所有配置来源合并后归一化：

- `deepseek-chat` → `deepseek-v4-flash` + `disabled`
- `deepseek-reasoner` → `deepseek-v4-flash` + `enabled`
- `deepseek-v4-flash`、`deepseek-v4-pro` 保持原模型名，并使用配置的思考模式

其他未知模型名会在请求供应商前被阻止，不会无限重试。生产环境修改模型配置后，应重新上传部署 `api_deepseek` 云函数并检查脱敏的 `deepseek_model_resolved` 日志。

## 当前计费控制点

- `maxTokens` 控制单次模型最大输出。
- `maxUserMessageChars` 控制前端传入云函数的最大字符数。
- `requestTimeoutMs` 避免长时间挂起。
- `temperature` 控制输出稳定性。
- `rateLimit.collection` 按身份 hash 和日期/月度窗口记录调用次数。

当前限流在真正请求 DeepSeek 前执行，所以通过校验并进入模型请求流程的失败请求也会消耗一次额度；参数校验失败和被判定为无关范围的请求不会消耗额度。

## 日志安全

日志中不要输出：

- DeepSeek API Key。
- 完整 Authorization header。
- 过长用户输入、宠物隐私、完整上下文。
- 完整 provider 响应体。

建议只记录：错误类型、HTTP 状态码、是否存在响应结构、限流失败原因和脱敏身份 hash。

## Prompt 控制

前端会把阶段角色、档案摘要、近期记录和用户问题合并传入云函数。云函数应继续把系统角色、上下文和最终用户问题拆开，并确保最终用户问题是最后一条 `user` message。

如果用户只是做连通性测试，例如“请只回复：PETY-CLOUD-0615”，在不违反安全边界时应允许模型按格式回复，不要强行转成宠物照护话术。
