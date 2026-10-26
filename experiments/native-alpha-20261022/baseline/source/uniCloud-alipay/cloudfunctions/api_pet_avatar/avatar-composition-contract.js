const COMPOSITION_VERSION = 'seated-full-body-v2';
const MASTER_SIZE = '2048*2048';

// This product contract is separate from the immutable Base Avatar Prompt.
function applyCompositionContract(basePrompt, jobKind) {
  const contract = `【最终交付构图规范：${COMPOSITION_VERSION}】
以下规范优先于前文中允许半身、保留旧姿势或保留旧构图的表述。
参考照片只用于识别宠物身份、毛色、花纹、五官和体型；绝不继承参考照片的动作、姿态、拍摄角度或构图。
仅一只宠物，标准电子宠物坐姿，正面偏轻微3/4，面部朝向用户，居中，全身完整入镜。
四肢及爪子完整自然可见，尾巴自然可见；保留真实物种与身体结构，不增添肢体。
耳朵、脸、毛尖、尾巴和爪子均不得裁切。禁止背身、回头、俯拍、仰拍、半身特写和贴脸构图。
2048×2048正方形画布，主体最长边占画布约70%，四周至少12%的安全留白。
背景为柔和、干净、低对比的暖灰米色摄影棚背景。禁止复杂场景、家具、墙角线、文字和抢眼装饰；允许很轻的自然接地阴影，但不得遮挡爪子或尾巴，除此之外无投影。
${jobKind === 'revision' ? '本次在保持宠物身份及用户指定局部修改的前提下遵守同一坐姿规范；原结果已合规则保持构图，旧结果不合规则纠正姿势与留白。用户局部要求不能取消此构图规范。' : '不要模仿任何身份参考照片中的姿势；风格参考仅提供材质与画风。'}
这是供用户在形象工作台审阅的主图，不承担首页透明角色职责。
输出清晰高质量主图；不要用白色棋盘格模拟透明，不要在图像中添加文字。`;
  const prompt = `${basePrompt}\n\n${contract}`;
  if (prompt.length > 5000) throw Object.assign(new Error('PROMPT_TOO_LONG'), { code: 'PROMPT_TOO_LONG' });
  return prompt;
}

module.exports = { COMPOSITION_VERSION, MASTER_SIZE, applyCompositionContract };
