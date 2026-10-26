'use strict';

const MAX_REVISION_CHARS = 300;
const MAX_PROMPT_CHARS = 5000;

function normalizeRevisionText(value) {
	const text = String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
	if (!text || text.length > MAX_REVISION_CHARS) {
		const error = new Error('INVALID_REVISION_TEXT');
		error.code = 'INVALID_REVISION_TEXT';
		throw error;
	}
	return text;
}

const REVISION_INTENTS = [
	{ targetKey: 'face', revisionTarget: 'FACE', actionKey: 'slimmer', target: '脸部外轮廓', adjustment: '轻微收窄', patterns: [/脸.*(瘦|窄)/] },
	{ targetKey: 'face', revisionTarget: 'FACE', actionKey: 'rounder', target: '脸部外轮廓', adjustment: '轻微变圆', patterns: [/脸.*(圆|宽)/] },
	{ targetKey: 'face', revisionTarget: 'FACE', actionKey: 'smaller', target: '脸部整体', adjustment: '轻微缩小', patterns: [/脸.*(小|缩小)/] },
	{ targetKey: 'eyes', revisionTarget: 'EYES', actionKey: 'slightly_larger', target: '眼睛', adjustment: '轻微放大', patterns: [/眼睛.*(大|放大)/] },
	{ targetKey: 'eyes', revisionTarget: 'EYES', actionKey: 'rounder', target: '眼睛', adjustment: '轻微变圆', patterns: [/眼睛.*(圆|更圆)/] },
	{ targetKey: 'eyes', revisionTarget: 'EYES', actionKey: 'color_correction', target: '眼睛颜色', adjustment: '按用户说明校正颜色', patterns: [/眼睛.*(颜色|色).*(改|修正|应该|是)/] },
	{ targetKey: 'ears', revisionTarget: 'EARS', actionKey: 'sharper', target: '耳朵', adjustment: '轻微变尖', patterns: [/耳朵.*(尖|更尖)/] },
	{ targetKey: 'ears', revisionTarget: 'EARS', actionKey: 'smaller', target: '耳朵', adjustment: '轻微缩小', patterns: [/耳朵.*(小|缩小)/] },
	{ targetKey: 'ears', revisionTarget: 'EARS', actionKey: 'larger', target: '耳朵', adjustment: '轻微放大', patterns: [/耳朵.*(大|放大)/] },
	{ targetKey: 'tail', revisionTarget: 'TAIL', actionKey: 'thinner', target: '尾巴', adjustment: '轻微变细', patterns: [/尾巴.*(细|更细)/] },
	{ targetKey: 'tail', revisionTarget: 'TAIL', actionKey: 'thicker', target: '尾巴', adjustment: '轻微变粗', patterns: [/尾巴.*(粗|更粗)/] },
	{ targetKey: 'tail', revisionTarget: 'TAIL', actionKey: 'shorter', target: '尾巴', adjustment: '轻微缩短', patterns: [/尾巴.*(短|缩短)/] },
	{ targetKey: 'tail', revisionTarget: 'TAIL', actionKey: 'longer', target: '尾巴', adjustment: '轻微加长', patterns: [/尾巴.*(长|加长)/] },
	{ targetKey: 'tail', revisionTarget: 'TAIL', actionKey: 'white', target: '尾巴颜色', adjustment: '调整为白色且不增加其他颜色或花纹', patterns: [/尾巴.*(白|更白)/] },
	{ targetKey: 'tail_pattern', revisionTarget: 'TAIL', actionKey: 'remove_pattern', target: '尾巴花纹', adjustment: '移除花纹并保持尾巴原有形状与底色', patterns: [/尾巴.*(没有|不要|去掉|移除).*(花纹|斑纹|条纹)/, /尾巴.*(纯色|无花纹)/] },
	{ targetKey: 'left_paw', revisionTarget: 'PAW', actionKey: 'color_correction', target: '左前脚', adjustment: '按用户说明校正颜色并保持其余四肢不变', patterns: [/(左脚|左前脚|左爪|左前爪).*(白|颜色|花纹)/] },
	{ targetKey: 'paw', revisionTarget: 'PAW', actionKey: 'pattern_correction', target: '爪部花纹', adjustment: '按用户说明校正花纹', patterns: [/(脚|爪).*(花纹|斑纹|条纹).*(改|修正|应该|是|有|没有)/] },
	{ targetKey: 'coat', revisionTarget: 'BODY', actionKey: 'whiter', target: '整体毛色', adjustment: '轻微提白', patterns: [/毛色.*(白|更白)/] },
	{ targetKey: 'coat', revisionTarget: 'BODY', actionKey: 'lighter', target: '整体毛色', adjustment: '轻微变浅', patterns: [/毛色.*(浅|更浅)/] },
	{ targetKey: 'coat', revisionTarget: 'BODY', actionKey: 'darker', target: '整体毛色', adjustment: '轻微变深', patterns: [/毛色.*(深|更深)/] }
];

const IDENTITY_CORRECTION_PATTERN = /(和|跟).*(原图|原照片|照片).*(不一样|不同)|按.*(原图|原照片|照片).*(修正|调整)|原图.*(花纹|颜色|特征|左脚|右脚|尾巴|眼睛|耳朵)/;

function parseAvatarRevisionIntent(value) {
	const original = normalizeRevisionText(value);
	const compact = original.replace(/[，。！？,.!?\s]/g, '');
	const matched = REVISION_INTENTS.find(intent => intent.patterns.some(pattern => pattern.test(compact)));
	const identityCorrection = IDENTITY_CORRECTION_PATTERN.test(compact);
	return matched
		? { type: 'bounded', targetKey: matched.targetKey, actionKey: matched.actionKey, revisionTarget: matched.revisionTarget || 'OTHER', target: matched.target, adjustment: matched.adjustment, intensity: 'slight', identityCorrection, bboxConfidence: 0, bboxList: null, original }
		: { type: 'custom', targetKey: 'custom', actionKey: 'bounded_fallback', revisionTarget: 'OTHER', target: '用户指定的单一局部', adjustment: `按受限局部要求执行：${original}`, intensity: 'slight', identityCorrection, bboxConfidence: 0, bboxList: null, original };
}

function buildAvatarRevisionPrompt(sourceCount, revisionText) {
	const revision = parseAvatarRevisionIntent(revisionText);
	const finalPrompt = `【任务类型：局部编辑】

图1是已经确认身份与整体视觉正确的宠物形象，标记为 CURRENT_RESULT_TO_EDIT。

必须以图1作为唯一主体和唯一视觉基础。

本次不是重新设计、重新生成、重新解释或重画这只宠物，只是在图1基础上进行一次小范围局部编辑。

用户只要求修改以下一点：

「${revision.original}」

结构化执行约束：
- 修改目标：${revision.target}
- 修改动作：${revision.adjustment}
- 修改幅度：轻微
- 保持身份，仅修改指定局部；旧图姿势或构图不合规范时同时纠正为标准坐姿

除了上述指定修改之外，必须严格保持图1的其他内容不变，包括：

- 同一只宠物身份
- 物种
- 品种感
- 主毛色
- 其他未要求改变的花纹
- 眼睛颜色
- 耳朵
- 鼻子
- 五官身份特征
- 身体比例
- 毛发材质
- 符合标准坐姿规范的姿势、构图、主体大小、角度和纯净背景
- 光线
- 阴影
- 3D渲染质感
- 清晰度
- 整体风格

局部外观修改必须受限；旧图不符合标准坐姿时按交付构图规范纠正。

不要重新绘制整张图。
背景保持为柔和、干净、低对比的暖灰米色摄影棚背景，不得出现复杂场景、家具、墙角线或文字。
不要改变其他毛色。
不要增加纹理。
不要增加噪点、颗粒、马赛克、锐化边缘或异常笔触。
不要锐化整张图片。
不要风格迁移。
不要增加新的花纹。
不要改变未指定部位。
不要引入任何外部参考图、其他候选图或历史生成图的内容。

如果用户要求“尾巴是纯白色，没有其他颜色”，则只修改尾巴颜色；尾巴结构、长度、姿势、毛量保持不变，其他部位全部保持图1不变。

如果用户要求“脸再瘦一点”，则只轻微收窄脸部轮廓；必须保留眼睛、鼻子、耳朵、毛色、面部花纹和身份特征，不得改变身体、背景和整体画风。

如果无法可靠完成局部修改，宁可让结果接近图1，也不要扩大修改范围。

结果仍必须是一张清晰、稳定、高质量的2K宠物形象。`;
	if (finalPrompt.length > MAX_PROMPT_CHARS) {
		const error = new Error('PROMPT_TOO_LONG');
		error.code = 'PROMPT_TOO_LONG';
		throw error;
	}
	return finalPrompt;
}

module.exports = { MAX_REVISION_CHARS, buildAvatarRevisionPrompt, normalizeRevisionText, parseAvatarRevisionIntent };
