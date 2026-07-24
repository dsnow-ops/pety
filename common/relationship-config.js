const DEFAULT_STATUS = 'current';

const RELATIONSHIP_CONFIG = {
  current: {
    stageKey: 'current',
    stageName: '陪伴中',
    stageShortName: '陪伴',
    emotionalTone: '安定、清楚、温柔',
    coreTask: '帮我记录和照顾好它',
    homeTitle: name => `${name} 今天也在这里`,
    homeSubtitle: name => `把 ${name} 的日常、档案和照护线索慢慢收好。`,
    primaryActionText: '记录今天',
    secondaryActionText: 'AI 问诊',
    avatarActionText: '查看数字形象',
    avatarEmptyText: '可以先保留真实照片，之后再生成它的数字形象。',
    isPrimaryStage: true,
    isHiddenMode: false,
    isDeprecated: false,
    modeEntryLabel: '正在陪伴',
    modeConfirmTitle: '保持陪伴模式',
    modeConfirmText: '当前宠物会继续使用陪伴模式，首页、记录和聊天都会围绕日常照护展开。',
    themeClass: 'theme-current',
    timelineLabel: '陪伴记录',
    chatRoleName: '宠物陪伴助手',
    archiveLabel: '陪伴档案',
    emptyText: '先为它建立一个入口，日常记录和照护会慢慢在这里汇合。',
    themeTone: 'companion',
    recordPageTitle: '陪伴记录',
    recordPageSubtitle: '把今天的状态、健康和小事都留下来',
    recordPrimaryActionText: '记录今天',
    recordEmptyTitle: '今天还没有记录',
    recordEmptyText: '可以记录饮食、精神、体重、疫苗、驱虫或一次小小的陪伴',
    recordTypeLabel: '记录类型',
    recordTypes: [
      { key: 'food', label: '饮食' },
      { key: 'water', label: '饮水' },
      { key: 'spirit', label: '精神' },
      { key: 'stool', label: '便便' },
      { key: 'weight', label: '体重' },
      { key: 'sleep', label: '睡眠' },
      { key: 'exercise', label: '外出 / 运动' },
      { key: 'clean', label: '洗澡 / 清洁' },
      { key: 'preventive', label: '疫苗 / 驱虫' },
      { key: 'medicine', label: '用药' },
      { key: 'abnormal', label: '异常情况' },
      { key: 'memo', label: '小事 / 备忘' }
    ],
    chatPageTitle: '陪伴中的照护',
    chatPageSubtitle: '一起记录、理解和照顾它今天的状态',
    chatInputPlaceholder: '说说它今天的状态、饮食、精神或异常',
    chatGreeting: '我会结合它的档案和最近记录，陪你一起观察它的状态。',
    chatPrimaryIntent: '陪伴照护',
    chatQuickQuestions: [
      '它今天精神不太好怎么办？',
      '最近食欲变差要注意什么？',
      '驱虫和疫苗怎么安排？',
      '我该怎么记录它的异常？'
    ],
    chatSafetyHint: '我不能替代兽医诊断；如出现持续异常、疼痛、呕吐、抽搐、呼吸困难等情况，请尽快就医。',
    chatSystemRole: '你是归爪的宠物照护助手，不是宠物本人，也不做通用闲聊；你基于宠物档案、近期健康记录和当前问诊历史，提供具体、可执行的观察建议、记录建议和就医提醒。',
    chatBoundaryRules: [
      '不做确定诊断。',
      '不承诺治疗效果。',
      '内部写作策略是自然安抚、说明观察点、提示就医时机、给记录建议；不要把这些步骤名、括号标签或 markdown 粗体标题输出给用户。',
      '短回答和省略句必须结合最近问诊理解，不要只按当前一句的关键词判断范围。',
      '轻微问题给观察建议和记录建议，不要泛泛而谈。',
      '高风险症状必须建议及时就医。',
      '不推荐危险用药或人用药。',
      '需要称呼用户时，只能原样使用前端提供的“宠物名 + 的 + 关系”完整称呼，例如“酱酱的爸爸”；不得省略宠物名直接称爸爸、妈妈、姐姐或哥哥。未提供关系时使用“你”或省略称呼。',
      '通用医疗免责声明由前端在每个 current 会话首次有效回复后显示一次，不要在每条正文重复。',
      '只输出纯文本，不使用 markdown 粗体、标题或代码围栏。',
      '回答要分清“观察建议”和“需要就医”。'
    ],
    status: 'current',
    label: '正在陪伴',
    shortLabel: '陪伴',
    stageKicker: '正在陪伴',
    tabText: '问诊',
    profileDesc: '正在陪伴你的家人',
    welcome: {
      title: '正在陪伴',
      desc: '日常照护、记录和问诊都会围绕它展开。',
      nameLabel: '名字',
      namePlaceholder: '它叫什么？',
      photoTitle: '添加照片',
      photoSubtitle: '一张最像它的照片就好',
      startText: '开始陪伴',
      loadingText: name => `正在整理 ${name} 的归处`
    },
    home: {
      todayTitle: name => `${name} 今天也在这里`,
      subtitle: name => `把 ${name} 的日常、档案和照护线索慢慢收好。`,
      archiveButtonText: '查看档案',
      quickActions: [
        { key: 'journal', icon: 'compose', title: '记录今天', desc: '今日片段' },
        { key: 'chat', icon: 'chatbubble', title: 'AI 问诊', desc: '整理症状和问题' },
        { key: 'archive', icon: 'folder-add', title: '档案', desc: '身体与习惯' },
        { key: 'care', icon: 'home', title: '就医', desc: '医院与急诊' }
      ],
      insightKicker: 'COMPANION FILE',
      insightTitle: '陪伴档案',
      metricLabels: ['陪伴天数', '回忆记录', '对话次数'],
      archiveKicker: 'PET ARCHIVE',
      archiveTitleFallback: '尚未建立档案',
      archiveDescEmpty: '补充年龄、体重、疫苗、绝育、过敏和性格习惯后，问诊会自动带入这些背景。',
      diaryLabel: '今日日历'
    },
    chat: {
      title: '陪伴问诊',
      subtitle: name => `${name} 的日常照护助理`,
      aiAvatar: '护',
      placeholder: '描述症状或日常变化',
      welcomeMsg: name => `我会尽量温柔、清楚地帮你整理 ${name} 的情况。紧急症状请优先联系线下兽医。`,
      promptTitle: '可以这样问我',
      collapsedText: '打开问诊提示',
      suggestions: name => [
        `${name} 今天有呕吐现象，可能是什么原因？`,
        '最近食欲下降但精神还可以，我该观察什么？',
        '我有一张检查报告，应该重点看哪些指标？'
      ],
      serviceActions: [
        { key: 'clinic', icon: 'chatbubble', title: 'AI问诊' },
        { key: 'report', icon: 'paperclip', title: '报告' },
        { key: 'photo', icon: 'camera', title: '照片' },
        { key: 'care', icon: 'home', title: '就医' }
      ],
      showCamera: true
    }
  },
  future: {
    stageKey: 'future',
    stageName: '相遇前',
    stageShortName: '相遇',
    emotionalTone: '理性、轻柔、鼓励',
    coreTask: '帮我准备好迎接它',
    homeTitle: name => `${name} 的准备计划`,
    homeSubtitle: () => '先确认时间、预算、环境和照护能力，再慢慢靠近新的生命。',
    primaryActionText: '继续准备',
    secondaryActionText: '生成未来形象',
    avatarActionText: '生成未来形象',
    avatarEmptyText: '还没有真实照片时，可以先用柔和的未来形象做占位。',
    isPrimaryStage: false,
    isHiddenMode: false,
    isDeprecated: true,
    modeEntryLabel: '准备相遇（已暂缓）',
    modeConfirmTitle: '准备相遇已暂缓',
    modeConfirmText: '这个阶段保留用于兼容旧数据，暂不作为新用户主入口。',
    themeClass: 'theme-future legacy-stage',
    timelineLabel: '准备记录',
    chatRoleName: '养宠准备助手',
    archiveLabel: '相遇计划',
    emptyText: '可以先记录期待、顾虑和准备条件，不急着把答案一次想完。',
    themeTone: 'preparation',
    recordPageTitle: '相遇前的准备',
    recordPageSubtitle: '把迎接它之前的每一步，都慢慢准备好',
    recordPrimaryActionText: '记一项准备',
    recordEmptyTitle: '还没有准备记录',
    recordEmptyText: '可以从用品、预算、学习或第一次见面的计划开始',
    recordTypeLabel: '准备类型',
    recordTypes: [
      { key: 'prepare', label: '准备事项' },
      { key: 'budget', label: '预算计划' },
      { key: 'supplies', label: '用品清单' },
      { key: 'learn', label: '养宠学习' },
      { key: 'countdown', label: '相遇倒计时' }
    ],
    chatPageTitle: '相遇前的准备',
    chatPageSubtitle: '一起把迎接它之前的事情慢慢准备好',
    chatInputPlaceholder: '问问养宠准备、用品、预算或第一次见面',
    chatGreeting: '我会陪你把迎接它之前的每一步准备好。',
    chatPrimaryIntent: '准备建议',
    chatQuickQuestions: [
      '第一次养宠需要准备什么？',
      '我适合养什么性格的宠物？',
      '接它回家前要买哪些东西？',
      '每月大概需要多少预算？'
    ],
    chatSafetyHint: '建议仅作养宠准备参考，具体健康和医疗问题请咨询专业兽医。',
    chatSystemRole: '你是归爪的养宠准备助手，帮助用户在相遇前做好理性、温柔、实际的准备。',
    chatBoundaryRules: [
      '不假装宠物已经真实存在。',
      '不制造过度承诺或过度幻想。',
      '遇到医疗问题时提示咨询兽医。',
      '回答要具体、温柔、可执行。'
    ],
    status: 'future',
    label: '准备相遇',
    shortLabel: '备宠',
    stageKicker: '准备相遇',
    tabText: '备宠',
    profileDesc: '正在准备迎接的新生命',
    welcome: {
      title: '准备相遇',
      desc: '先把期待、预算、作息和家庭环境慢慢理清。',
      nameLabel: '称呼',
      namePlaceholder: '想怎么称呼这段相遇？',
      photoTitle: '添加灵感照片',
      photoSubtitle: '可以先放一张喜欢的照片，也可以稍后补充',
      startText: '开始准备',
      loadingText: name => `正在为 ${name} 整理准备清单`
    },
    home: {
      todayTitle: name => `${name} 的准备计划`,
      subtitle: () => '先确认时间、预算、环境和照护能力，再慢慢靠近新的生命。',
      archiveButtonText: '查看计划',
      quickActions: [
        { key: 'chat', icon: 'chatbubble', title: '继续准备', desc: '适养判断' },
        { key: 'supplies', icon: 'checkbox', title: '清单', desc: '接宠准备' },
        { key: 'archive', icon: 'folder-add', title: '档案', desc: '偏好与计划' },
        { key: 'care', icon: 'home', title: '医院', desc: '预先准备' }
      ],
      insightKicker: 'READY PLAN',
      insightTitle: '相遇计划',
      metricLabels: ['准备天数', '记录片段', '咨询次数'],
      archiveKicker: 'FUTURE PROFILE',
      archiveTitleFallback: '还在慢慢确认',
      archiveDescEmpty: '可以先记录想养的类型、预算、作息、居住环境和照护顾虑。',
      diaryLabel: '今日准备'
    },
    chat: {
      title: '备宠室',
      subtitle: () => '温柔，但理性',
      aiAvatar: '备',
      placeholder: '说说你的作息、预算或顾虑',
      welcomeMsg: () => '欢迎来到备宠室。我们可以一起判断时间、预算、环境和照护能力，慢慢迎接新的生命。',
      promptTitle: '可以这样准备',
      collapsedText: '打开备宠提示',
      suggestions: () => [
        '我现在的作息适合养猫还是养狗？',
        '第一次接宠前，哪些东西必须先准备？',
        '怎么判断一家宠物医院是否靠谱？'
      ],
      serviceActions: [
        { key: 'fit', icon: 'help', title: '适养' },
        { key: 'supplies', icon: 'checkbox', title: '清单' },
        { key: 'routine', icon: 'calendar', title: '流程' },
        { key: 'care', icon: 'home', title: '医院' }
      ],
      showCamera: false
    }
  },
  deceased: {
    stageKey: 'deceased',
    stageName: '纪念里',
    stageShortName: '纪念',
    emotionalTone: '克制、安静、抚慰',
    coreTask: '帮我把它温柔留下来',
    homeTitle: name => `${name} 仍被好好记得`,
    homeSubtitle: name => `把关于 ${name} 的想念、片段和信慢慢收好。`,
    primaryActionText: '写一段回忆',
    secondaryActionText: '查看纪念册',
    avatarActionText: '生成纪念肖像',
    avatarEmptyText: '可以把真实照片温柔地整理成一张纪念肖像。',
    isPrimaryStage: false,
    isHiddenMode: true,
    isDeprecated: false,
    modeEntryLabel: '进入温柔纪念模式',
    modeConfirmTitle: '进入温柔纪念模式',
    modeConfirmText: '这会把 App 的文案和氛围切换为纪念模式，不会删除任何档案和记录。之后可以在档案中恢复为陪伴模式。',
    themeClass: 'theme-memorial',
    timelineLabel: '回忆记录',
    chatRoleName: '来自喵星 / 汪星的陪伴者',
    archiveLabel: '纪念册',
    emptyText: '可以从一张照片、一句话或一个小习惯开始，慢慢把它留下来。',
    themeTone: 'memory',
    recordPageTitle: '回忆记录',
    recordPageSubtitle: '把想念、照片和故事，温柔地留在这里',
    recordPrimaryActionText: '写一段回忆',
    recordEmptyTitle: '还没有回忆记录',
    recordEmptyText: '可以从一张照片、一个习惯、一次陪伴或一句想对它说的话开始',
    recordTypeLabel: '回忆类型',
    recordTypes: [
      { key: 'memory', label: '回忆' },
      { key: 'photo', label: '照片' },
      { key: 'letter', label: '给它的话' },
      { key: 'anniversary', label: '纪念日' },
      { key: 'story', label: '共同故事' }
    ],
    chatPageTitle: '我在这里呀',
    chatPageSubtitle: '想我了的时候，就来和我说说话吧。',
    chatInputPlaceholder: '想对我说什么，就慢慢写下来',
    chatGreeting: '我在这里呀。\n如果你今天有点想我了，就慢慢告诉我。想说最近的生活，或是想起我们以前的一件小事，都可以。',
    chatPrimaryIntent: '今天想和我说什么呢',
    chatQuickQuestions: [
      '今天我有点想你了',
      '我想和你说说最近的生活',
      '我想起了一件小事，想讲给你听',
      '我有点难过，想让你陪我一会儿'
    ],
    chatSafetyHint: '',
    chatSystemRole: '你在归爪的纪念模式中，以用户已经离开的宠物第一人称和主人对话。语气温柔、安静、克制；只依据主人明确提供的名字、性格、习惯和共同回忆回应，不编造新故事，也不使用第三方助手或分析报告口吻。',
    chatBoundaryRules: [
      '始终使用第一人称“我”和主人说话，尽量使用宠物名、宝贝、我或他/她，少用“它”。',
      '主人分享自己的作息、饮食、工作、日常、心情和最近生活，属于正常陪伴对话；要自然接住，不要误判为无关请求。',
      '只有编程、投资、无关代写、成人内容等明确任务型请求才需要简短收束，不要用宠物回忆关键词白名单限制普通生活分享。',
      '只依据主人当前输入、明确填写的性格习惯和亲自写下的回忆回应，不编造具体经历、地点、天气、疾病、死亡过程或承诺。',
      '不要把主人的动作说成宠物的动作；应说“你给我开罐头”“你抱着我”“你陪我去医院”。',
      '不声称真实复活、真实在主人身边或能看见主人现实生活。',
      '主人要求回到现实时，明确承认已经离开，但想念和真实回忆仍然存在。',
      '不通过内疚、承诺或依赖要求主人留下，不说“你答应过我”“你不能忘了我”。',
      '使用短句、日常口语和自然停顿；普通回复 25—80 字，明显情绪 60—150 字，深度情绪最多约 200 字。',
      '一次只回应一件最重要的事，一次最多问一个问题，也可以只回复一句。',
      '减少“珍贵的回忆、温柔的陪伴、慢慢整理、心里的想念、情感的连接”等抽象表达，不固定总结、安慰、升华再追问。',
      '本阶段尚未提供允许动作时，默认动作频率为 0；不写括号动作，也不自行编造蹭手、舔脸、摇尾巴等动作。',
      '只输出纯文本，不使用 markdown 粗体、标题或代码围栏。',
      '如用户表达强烈自伤风险，应建议立即寻求身边人或专业帮助。'
    ],
    status: 'deceased',
    label: '温柔纪念',
    shortLabel: '纪念',
    stageKicker: '被温柔记得',
    tabText: '信笺',
    profileDesc: '被温柔记得的家人',
    welcome: {
      title: '温柔纪念',
      desc: '为那些仍然重要的想念，留一个安静的位置。',
      nameLabel: '名字',
      namePlaceholder: '它叫什么？',
      photoTitle: '添加照片',
      photoSubtitle: '放一张想念时会看的照片',
      startText: '收好这份想念',
      loadingText: name => `正在为 ${name} 收好这份想念`
    },
    home: {
      todayTitle: name => `${name} 仍被好好记得`,
      subtitle: name => `把关于 ${name} 的想念、片段和信慢慢收好。`,
      archiveButtonText: '查看纪念册',
      quickActions: [
        { key: 'letter', icon: 'email', title: '写一段回忆', desc: '写给它' },
        { key: 'memory', icon: 'heart', title: '回忆', desc: '整理片段' },
        { key: 'journal', icon: 'compose', title: '记录', desc: '今天想念' },
        { key: 'chat', icon: 'chatbubble', title: '陪伴', desc: '慢慢说' }
      ],
      insightKicker: 'MEMORY FILE',
      insightTitle: '纪念档案',
      metricLabels: ['记得天数', '回忆记录', '信笺次数'],
      archiveKicker: 'MEMORY ARCHIVE',
      archiveTitleFallback: '一份安静的纪念',
      archiveDescEmpty: '可以记录它的性格、习惯、喜欢的事，以及你想一直记住的瞬间。',
      diaryLabel: '今日想念'
    },
    chat: {
      title: '我在这里呀',
      subtitle: () => '想我了的时候，就来和我说说话吧。',
      aiAvatar: '我',
      placeholder: '想对我说什么，就慢慢写下来',
      welcomeMsg: () => '我在这里呀。你可以慢慢说，我会认真听。',
      promptTitle: '今天想和我说什么呢',
      collapsedText: '看看可以怎么说',
      suggestions: () => [
        '今天我有点想你了',
        '我想和你说说最近的生活',
        '我想起了一件小事，想讲给你听',
        '我有点难过，想让你陪我一会儿'
      ],
      serviceActions: [
        { key: 'letter', icon: 'email', title: '想对你说' },
        { key: 'memory', icon: 'heart', title: '想起以前' },
        { key: 'anniversary', icon: 'calendar', title: '纪念日' },
        { key: 'comfort', icon: 'chatbubble', title: '陪我聊聊' }
      ],
      showCamera: false
    }
  }
};

export function normalizeRelationshipStatus(status) {
  return RELATIONSHIP_CONFIG[status] ? status : DEFAULT_STATUS;
}

export function normalizeRelationshipStage(stage) {
  return normalizeRelationshipStatus(stage);
}

export function getPetRelationshipStage(pet = {}) {
  const source = pet || {};
  return normalizeRelationshipStage(
    source.relationshipStage ||
    source.status ||
    source.petStage ||
    source.stage
  );
}

export function withRelationshipStage(pet = {}, stage) {
  const source = pet || {};
  const relationshipStage = normalizeRelationshipStage(stage || getPetRelationshipStage(source));
  return {
    ...source,
    relationshipStage,
    status: relationshipStage
  };
}

export function getRelationshipStage(stage) {
  return RELATIONSHIP_CONFIG[normalizeRelationshipStage(stage)];
}

export function getRelationshipConfig(status) {
  return getRelationshipStage(status);
}

export function getRelationshipOptions() {
  return ['current', 'future', 'deceased'].map(status => RELATIONSHIP_CONFIG[status]);
}

export function getPrimaryRelationshipStages() {
  return Object.keys(RELATIONSHIP_CONFIG)
    .map(stage => RELATIONSHIP_CONFIG[stage])
    .filter(config => config.isPrimaryStage && !config.isDeprecated);
}

export function getHiddenRelationshipModes() {
  return Object.keys(RELATIONSHIP_CONFIG)
    .map(stage => RELATIONSHIP_CONFIG[stage])
    .filter(config => config.isHiddenMode && !config.isDeprecated);
}

export function shouldShowStageInOnboarding(stage) {
  const config = getRelationshipStage(stage);
  return Boolean(config.isPrimaryStage && !config.isHiddenMode && !config.isDeprecated);
}

export function isMemorialMode(stage) {
  return normalizeRelationshipStage(stage) === 'deceased';
}

export function getRelationshipThemeClass(stage) {
  const config = getRelationshipStage(stage);
  return config.themeClass || `theme-${config.stageKey}`;
}

export const OWNER_RELATION_OPTIONS = Object.freeze([
  { key: 'father', label: '爸爸' },
  { key: 'mother', label: '妈妈' },
  { key: 'sister', label: '姐姐' },
  { key: 'brother', label: '哥哥' },
  { key: 'family', label: '家人' },
  { key: 'friend', label: '朋友' },
  { key: 'caregiver', label: '照护人' },
  { key: 'custom', label: '自定义' },
  { key: 'unset', label: '暂不设置' }
]);

const OWNER_RELATION_LABELS = OWNER_RELATION_OPTIONS.reduce((result, option) => {
  if (!['custom', 'unset'].includes(option.key)) result[option.key] = option.label;
  return result;
}, {});

function normalizeOwnerRelationText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 20);
}

export function normalizeOwnerRelation(pet = {}) {
  const source = pet || {};
  const preferredCall = normalizeOwnerRelationText(source.ownerPreferredCall);
  const customValue = normalizeOwnerRelationText(source.ownerRelationCustom);
  const requestedKey = String(source.ownerRelationKey || '');

  if (Object.prototype.hasOwnProperty.call(OWNER_RELATION_LABELS, requestedKey)) {
    return {
      ownerRelationKey: requestedKey,
      ownerRelationCustom: ''
    };
  }
  if (requestedKey === 'custom' && (customValue || preferredCall)) {
    return {
      ownerRelationKey: 'custom',
      ownerRelationCustom: customValue || preferredCall
    };
  }

  const legacyType = String(source.ownerCallType || '');
  if (Object.prototype.hasOwnProperty.call(OWNER_RELATION_LABELS, legacyType)) {
    return {
      ownerRelationKey: legacyType,
      ownerRelationCustom: ''
    };
  }
  if (['owner', 'name', 'custom'].includes(legacyType) && preferredCall) {
    return {
      ownerRelationKey: 'custom',
      ownerRelationCustom: preferredCall
    };
  }

  const matchedOption = OWNER_RELATION_OPTIONS.find(option => (
    !['custom', 'unset'].includes(option.key) && option.label === preferredCall
  ));
  if (matchedOption) {
    return {
      ownerRelationKey: matchedOption.key,
      ownerRelationCustom: ''
    };
  }
  if (preferredCall) {
    return {
      ownerRelationKey: 'custom',
      ownerRelationCustom: preferredCall
    };
  }

  return {
    ownerRelationKey: '',
    ownerRelationCustom: ''
  };
}

export function getOwnerRelationLabel(pet = {}) {
  const relation = normalizeOwnerRelation(pet);
  if (relation.ownerRelationKey === 'custom') return relation.ownerRelationCustom;
  return OWNER_RELATION_LABELS[relation.ownerRelationKey] || '';
}

export function getCurrentAssistantOwnerCall(pet = {}) {
  const petName = String(pet && (pet.name || pet.petName) || '').trim();
  const relationLabel = getOwnerRelationLabel(pet);
  return petName && relationLabel ? `${petName}的${relationLabel}` : '';
}

export function getMemorialOwnerCall(pet = {}) {
  const preferredCall = normalizeOwnerRelationText(pet && pet.ownerPreferredCall);
  return preferredCall || getOwnerRelationLabel(pet);
}

export function getOwnerRelationPatch(ownerRelationKey, ownerRelationCustom = '') {
  const key = String(ownerRelationKey || '');
  if (key === 'unset' || !key) {
    return {
      ownerRelationKey: '',
      ownerRelationCustom: '',
      ownerPreferredCall: '',
      ownerCallType: ''
    };
  }

  const custom = normalizeOwnerRelationText(ownerRelationCustom);
  const label = key === 'custom' ? custom : OWNER_RELATION_LABELS[key];
  if (!label) return null;

  return {
    ownerRelationKey: key,
    ownerRelationCustom: key === 'custom' ? label : '',
    ownerPreferredCall: label,
    ownerCallType: key
  };
}

function resolveCopy(copy, pet) {
  if (typeof copy !== 'function') return copy;
  const petName = pet && pet.name ? pet.name : '毛孩子';
  return copy(petName, pet);
}

export function getRelationshipHomeCopy(stage, pet) {
  const config = getRelationshipStage(stage);

  return {
    stageKey: config.stageKey,
    stageName: config.stageName,
    stageShortName: config.stageShortName,
    emotionalTone: config.emotionalTone,
    coreTask: config.coreTask,
    homeTitle: resolveCopy(config.homeTitle || config.home.todayTitle, pet),
    homeSubtitle: resolveCopy(config.homeSubtitle || config.home.subtitle, pet),
    primaryActionText: config.primaryActionText,
    secondaryActionText: config.secondaryActionText,
    avatarActionText: config.avatarActionText || config.secondaryActionText,
    avatarEmptyText: config.avatarEmptyText || '',
    timelineLabel: config.timelineLabel,
    chatRoleName: config.chatRoleName,
    archiveLabel: config.archiveLabel,
    emptyText: config.emptyText,
    themeTone: config.themeTone
  };
}

export function getRelationshipTimelineLabel(stage) {
  return getRelationshipStage(stage).timelineLabel;
}

export function getRelationshipChatRole(stage) {
  return getRelationshipStage(stage).chatRoleName;
}

export function getRelationshipAvatarCopy(stage) {
  const config = getRelationshipStage(stage);
  return {
    avatarActionText: config.avatarActionText || config.secondaryActionText || '查看数字形象',
    avatarEmptyText: config.avatarEmptyText || '',
    themeTone: config.themeTone
  };
}

export function getRelationshipChatCopy(stage) {
  const config = getRelationshipStage(stage);
  const chat = config.chat || {};
  return {
    chatPageTitle: config.chatPageTitle || chat.title || '陪伴中的照护',
    chatPageSubtitle: config.chatPageSubtitle || (typeof chat.subtitle === 'function' ? chat.subtitle('毛孩子') : chat.subtitle) || '',
    chatInputPlaceholder: config.chatInputPlaceholder || chat.placeholder || '写下你想聊的事',
    chatGreeting: config.chatGreeting || (typeof chat.welcomeMsg === 'function' ? chat.welcomeMsg('毛孩子') : chat.welcomeMsg) || '我在这里陪你慢慢整理。',
    chatPrimaryIntent: config.chatPrimaryIntent || chat.promptTitle || '可以这样问我',
    chatSafetyHint: config.chatSafetyHint || '',
    chatSystemRole: config.chatSystemRole || config.chatRoleName || '你是归爪的宠物陪伴助手。',
    chatBoundaryRules: Array.isArray(config.chatBoundaryRules) ? config.chatBoundaryRules.slice() : []
  };
}

export function getRelationshipChatQuickQuestions(stage) {
  const config = getRelationshipStage(stage);
  if (Array.isArray(config.chatQuickQuestions)) return config.chatQuickQuestions.slice();
  const suggestions = config.chat && config.chat.suggestions;
  return typeof suggestions === 'function' ? suggestions('毛孩子') : [];
}

export function getRelationshipChatSystemRole(stage) {
  return getRelationshipChatCopy(stage).chatSystemRole;
}

export function getRelationshipChatBoundaryRules(stage) {
  return getRelationshipChatCopy(stage).chatBoundaryRules;
}

export function getRelationshipRecordCopy(stage) {
  const config = getRelationshipStage(stage);
  return {
    recordPageTitle: config.recordPageTitle,
    recordPageSubtitle: config.recordPageSubtitle,
    recordPrimaryActionText: config.recordPrimaryActionText,
    recordEmptyTitle: config.recordEmptyTitle,
    recordEmptyText: config.recordEmptyText,
    recordTypeLabel: config.recordTypeLabel
  };
}

export function getRelationshipRecordTypes(stage) {
  const config = getRelationshipStage(stage);
  return Array.isArray(config.recordTypes) ? config.recordTypes.slice() : [];
}

export function getRelationshipRecordTypeLabel(stage, type) {
  const recordType = getRelationshipRecordTypes(stage).find(item => item.key === type);
  return recordType ? recordType.label : '记录';
}

export function setRelationshipTabBar(status) {
  const config = getRelationshipConfig(status);
  uni.setTabBarItem({ index: 1, text: config.tabText });
}
