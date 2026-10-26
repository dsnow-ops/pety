# 原生透明素材V5对照：目标缺陷未改善

在 `pro-style-v3-01` 上只追加“独立角色渲染层、无地面接收器和接触阴影”约束，模型、种子、六张输入及其原始字节不变。提交前完成预算预留与上一张审图；仅提交一张，不自动重发。

结果 `pro-alpha-v5-01`：白底仍能看到脚下投影，姿势略有变化，未比原候选更好。原图外部低透明像素没有减少，暂不沿此提示词方向继续抽样。

| 原始PNG检查 | V3优先候选 | V5对照 |
|---|---:|---:|
| alpha>8包围框外非零alpha像素 | 1,118,779 | 1,119,384 |
| 该区域最大alpha | 5 | 7 |
| 完全无外部残留 | 否 | 否 |

这些包围框统计不是宠物语义分割，也不单独代表视觉质量；结论同时参考原始像素和白/深暖背景审图。没有阈值清理、抠图、分割或背景移除。该张保留为失败对照，不替换生产图。

本轮累计新增6张，新增保守预留1.35元；包含上轮1.40元合计 **2.75/20元**。实际账单未核实。原始PNG、输入/提示词哈希、服务商回执和审图结果均在 [样本目录](../../experiments/native-alpha-20261023/outputs/pro-alpha-v5-01/)，[比较报告](../../experiments/native-alpha-20261023/report.html)已更新并通过6图加载、背景切换和390宽度检查。

## 官方能力边界复核

阿里云官方API文档说明2.1系列会按提示词选择普通或透明图；本次查阅的参数列表没有列出独立`background`或严格外部alpha归零开关。不能因此把其他托管服务的同名参数直接套到当前接口。[阿里云官方API说明](https://help.aliyun.com/zh/model-studio/qwen-image-generation-and-editing-api-reference)。

Qwen官方示例同样建议在提示词中表达RGBA透明输出，并保留RGBA输入的透明通道；这不构成“每个外部像素都精确为零”的保证。本次没有向公开演示站上传用户照片。[Qwen官方示例源码](https://huggingface.co/spaces/Qwen/Qwen-Image-2.1/blob/main/app.py)。

原生透明视频仍未生成，原始风格母版仍未找到，不能以这6张静态图声称完整达到抖音随变式效果。

## 06点时段追加托管通道核实

[fal官方Wan-Alpha模型页](https://fal.ai/models/fal-ai/wan-alpha)与[API页](https://fal.ai/models/fal-ai/wan-alpha/api)均明确标记端点已弃用、不再支持。页面是文生视频接口，不构成当前可用的同宠物图生透明视频通道。未创建账号、未上传照片、未提交请求，不能沿用第三方旧模型清单的价格作为可调用依据。

[阿里云万相3.0官方API](https://help.aliyun.com/zh/model-studio/wan3-video-generation-api-reference)列出的输入PNG不支持透明通道，未把该接口当作原生RGBA视频替代品付费测试。
