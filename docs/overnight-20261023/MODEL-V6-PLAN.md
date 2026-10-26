# V6：已获授权执行，结果淘汰

2026-10-23。用户回复“同意”后，已按下列三张输入执行唯一一次Qwen 2.1 Pro请求，成功取得原始PNG。

新增保守预留0.25元，累计3.00/20元，实际账单未核实。结果为 **淘汰，不替换V3**：毛发变硬、轮廓发白、软3D体积退步，眼睛和下巴身份校正没有明确改善。没有继续生成其他样本。

[原始RGBA](../../experiments/native-alpha-20261023/outputs/pro-identity-v6-01/provider-original.png) · [逐张审阅](../../experiments/native-alpha-20261023/outputs/pro-identity-v6-01/review.json) · [像素指标对照](../../experiments/native-alpha-20261023/v6-comparison.json) · [七张对照报告](../../experiments/native-alpha-20261023/report.html) · [明确上传授权记录](../../experiments/native-alpha-20261023/samples/pro-identity-v6-01.upload-approval.json)。

以下保留原计划和先前拦截的历史经过；其中未提交、2.75元等描述仅代表当时状态。

## 为什么值得试这一张

重新对照V3原始图与真实照片后，软3D身体和毛发可保留，但眼睛张开程度偏圆、下巴黑色标记偏大。此前从风格截图和真实照片重新生成时，换种子及减少照片没有稳定改善。V6改为直接编辑V3的原始RGBA，以两张真实照片核对面部，验证能否在保留身体的同时校正局部身份。这是流程比较，不宣称单变量实验。

唯一计划调用：Qwen 2.1 Pro，2048×2048，1张，固定种子1733695649，计划保守预留0.25元。本次执行未启动，因此没有新占用；累计仍2.75/20元，实际账单未核实。后续若请求结果不明，按已有预算机制保留占用，不能擅自当作免费或重发。

输入均为既有本地实验材料，不处理或改变原始字节：

| 输入 | 用途 | SHA256 |
|---|---|---|
| [V3原始RGBA](../../experiments/native-alpha-20261023/outputs/pro-style-v3-01/provider-original.png) | 编辑底图，保留身体、坐姿、材质和爪部花纹 | `0f9882db251a9b15e09a09c42ff99416b9764ea35a443268d991041ddefc1dc0` |
| [真实照片04](../../experiments/native-alpha-20261022/inputs/jiangjiang/04.jpg) | 正面面部身份 | `0b8a280841ac1678c3c8e2ce4e926046d2a2a559a9aa1824d2a0b9235ec25060` |
| [真实照片02](../../experiments/native-alpha-20261022/inputs/jiangjiang/02.jpg) | 另一角度面部身份 | `44a8e532c6c0070149e36291491b1c3e3600c20c5cde3bd4805775a05f6680a8` |

[完整提示词](../../experiments/native-alpha-20261023/prompts/identity-edit-v6.txt)、[参数与输入清单](../../experiments/native-alpha-20261023/samples/pro-identity-v6-01.json)、[检验假设与停止条件](../../experiments/native-alpha-20261023/samples/pro-identity-v6-01.hypothesis.json)均已保存。

原始RGBA、无抠图/分割/阈值清理的约束保持；输出仍须重新检查透明残留。若姿态、身体、身份或材质退步，保留V3候选，不连续抽图。

## 先前未提交的原因，现已获得明确授权

自动审批拒绝执行付费命令，理由为：用户已授权额度内测试，但未明确授权这几张具体私有图片上传到指定Qwen第三方服务。请求进程没有启动，没有新任务ID、输出目录或新增费用。未换工具、通道、模型、账号或上传地址绕过限制。

白天需要确认的具体动作：允许把上表这3张图发送至阿里云百炼的Qwen 2.1 Pro，单次生成1张，最多0.25元、计入原20元预算。上传会把图片交由第三方处理；未获确认前只保留本地计划。

阿里云官方说明该模型支持图像编辑和最多10张参考图，并可按提示词产生透明输出，但不保证局部修改完全不影响其他区域：[官方API说明](https://help.aliyun.com/zh/model-studio/qwen-image-generation-and-editing-api-reference)。本轮只核实能力，没有据此声称实验已经成功。
