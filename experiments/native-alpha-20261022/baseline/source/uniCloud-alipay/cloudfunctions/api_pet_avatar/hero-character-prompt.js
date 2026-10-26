'use strict';

const HERO_CHARACTER_VERSION = 'hero-character-magenta-v3';
const HERO_KEY_COLOR = '#FF00CC';

function buildHeroCharacterPrompt() {
	// Hidden technical intermediate (隐藏的技术中间资产), never a display asset.
	// Real Wan validation: the long mixed generation/edit contract produced noisy
	// magenta texture. A single background replacement instruction preserved the
	// current pet and passed the unchanged pixel quality gate. Keep this operation
	// separate from the workbench composition contract; do not ask it to pose again.
	return '仅替换图1背景：将猫咪之外的整个背景变为均匀的纯洋红色 RGB(255,0,204)。保持猫咪本身每一处毛发、花纹、五官、姿势和身体比例不变。移除地面和阴影。输出干净的棚拍抠像技术图，背景只有一种纯色。'.replaceAll('猫咪', '宠物');
}

module.exports = { HERO_CHARACTER_VERSION, HERO_KEY_COLOR, buildHeroCharacterPrompt };
