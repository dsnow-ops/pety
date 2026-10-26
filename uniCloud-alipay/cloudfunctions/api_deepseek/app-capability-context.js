'use strict';

const APP_CAPABILITIES = [
	'首页可查看当前宠物、今日关系文案与今日记录状态，并进入记录、AI 对话和宠物档案。',
	'记录页可按日期新增和回看陪伴记录；current 模式用于日常、健康和异常观察，deceased 模式用于回忆与纪念记录。',
	'宠物档案页可查看和编辑宠物基础资料、主人关系及电子形象状态；温柔纪念模式由档案中的入口主动开启或恢复。',
	'AI 对话在 current 模式提供宠物照护观察、健康信息整理和就医前准备；deceased 模式提供纪念陪伴。',
	'current 模式的 AI 对话支持发起公开网络相似案例搜索；搜索结果仅供参考，不能替代兽医。',
	'用户可选择一至三张宠物照片生成电子宠物形象，也可重新生成、进行局部微调，并在形象工作台反馈生成问题。',
	'形象生成失败时，可留在形象工作台重试；工作台也提供结果问题反馈入口。设置或“我的”页面提供产品反馈入口。',
	'deceased 模式可在宠物档案进入纪念人格页，修改已记录的性格、口吻、习惯和共同回忆；current 模式不会读取纪念人格。',
	'以前写下的日常、异常或纪念内容，可从记录日历选择对应日期回看；宠物档案也提供档案入口。',
	'设置页提供简体中文和英文切换，并提供 AI 数据授权管理。',
	'账号与会员能力以页面当前实际显示为准；不要承诺未显示的套餐、同步、支付或跨设备能力。'
];

const APP_CAPABILITIES_EN = [
	'The Home page shows the active pet, daily relationship copy and today record status, with entries to Records, AI Chat and Pet Archive.',
	'The Records page supports adding and reviewing entries by date. Current mode is for daily care, health and anomaly observations; deceased mode is for memories and memorial records.',
	'The Pet Archive shows and edits basic pet information, owner relationship and avatar status. Gentle Memorial Mode is entered or restored from the Archive.',
	'AI Chat provides care observation, health-information organization and pre-vet preparation in current mode, and memorial companionship in deceased mode.',
	'Current-mode AI Chat can start a public-web similar-case search. Results are reference only and do not replace a veterinarian.',
	'Users can select one to three pet photos to generate an electronic pet avatar, regenerate it, request a local revision and report avatar issues from the workbench.',
	'If avatar generation fails, users can retry in the avatar workbench. The workbench has an avatar-result report entry, and Settings or Me has the product-feedback entry.',
	'Deceased mode can open the Memorial Persona page from the Pet Archive to edit remembered traits, voice, habits and shared memories. Current mode does not read memorial persona data.',
	'Past daily, anomaly and memorial entries can be reviewed by choosing their date in the Records calendar; the Pet Archive also provides an archive entry.',
	'Settings supports Simplified Chinese and English, plus AI data-consent management.',
	'Account and membership capabilities must follow what the current UI actually shows. Do not promise unlisted plans, sync, payment or cross-device features.'
];

const PRODUCT_SUPPORT_PATTERNS = [
	/(归爪|Lumi[eè]re\s*Pet|这个\s*App|应用里|软件里).*(怎么|如何|哪里|在哪|为什么|能不能|是否|是什么|功能|使用|记录|日历|档案|形象|设置|语言|授权|账号|登录|会员|反馈)/i,
	/(怎么|如何|哪里|在哪|为什么|能不能|是否).*(记录|日历|档案|宠物资料|生日|照片|形象|重新生成|微调|生成次数|怀念|纪念模式|人格卡|设置|语言|英文|中文|授权|账号|登录|会员|反馈|相似案例|similar\s*case)/i,
	/(记录|日历|档案|宠物资料|生日|照片|形象|重新生成|微调|生成次数|怀念|纪念模式|人格卡|设置|语言|英文|中文|授权|账号|登录|会员|反馈|相似案例|similar\s*case).*(怎么|如何|哪里|在哪|为什么|是什么|怎么办|查看|修改|更换|换|切换|上传|使用|入口)/i,
	/(怎么|如何).*(修改|编辑).*(记住的)?性格/i,
	/(为什么|怎么|如何).*(这里|页面).*(显示|出现).*(回忆)/i,
	/(怎么|如何).*(查看|找到).*(以前|之前).*(写下|记录)/i,
	/(record|calendar|archive|birthday|avatar|regenerate|revision|memorial mode|persona|settings|language|consent|account|membership|log in|login).*(where|how|change|edit|view|use|explain)/i,
	/(where|how|can i|why|explain).*(record|calendar|archive|birthday|avatar|regenerate|memorial|persona|language|settings|consent|account|membership|log in|login)/i
];

function isProductSupportQuestion(question) {
	const text = String(question || '').trim();
	return Boolean(text && PRODUCT_SUPPORT_PATTERNS.some(pattern => pattern.test(text)));
}

function getAppCapabilityContext(responseLanguage = 'zh-Hans') {
	if (String(responseLanguage).toLowerCase().startsWith('en')) {
		return 'Lumiere Pet product capabilities (answer only from these verified facts):\n' + APP_CAPABILITIES_EN.map((item, index) => `${index + 1}. ${item}`).join('\n');
	}
	return '《归爪》真实产品能力（只能依据以下已存在功能回答，不得编造按钮、路径或服务）：\n' + APP_CAPABILITIES.map((item, index) => `${index + 1}. ${item}`).join('\n');
}

module.exports = { APP_CAPABILITIES, APP_CAPABILITIES_EN, getAppCapabilityContext, isProductSupportQuestion };
