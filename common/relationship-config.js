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
    secondaryActionText: '和它聊聊',
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
      { key: 'daily', label: '日常' },
      { key: 'health', label: '健康' },
      { key: 'weight', label: '体重' },
      { key: 'vaccine', label: '疫苗' },
      { key: 'deworm', label: '驱虫' },
      { key: 'abnormal', label: '异常观察' }
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
    chatSystemRole: '你是归爪的宠物陪伴与照护助手，基于宠物档案和近期记录提供观察建议、记录建议和就医提醒。',
    chatBoundaryRules: [
      '不做确定诊断。',
      '不承诺治疗效果。',
      '高风险症状必须建议及时就医。',
      '不推荐危险用药或人用药。',
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
        { key: 'chat', icon: 'chatbubble', title: '和它聊聊', desc: '温柔咨询' },
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
    chatRoleName: '回忆整理助手',
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
    chatPageTitle: '和回忆聊聊',
    chatPageSubtitle: '我会陪你整理和它有关的故事，而不是替代它',
    chatInputPlaceholder: '写下你今天想起它的一件小事',
    chatGreeting: '你可以慢慢说，我会陪你把和它有关的回忆温柔地整理下来。',
    chatPrimaryIntent: '回忆整理',
    chatQuickQuestions: [
      '帮我整理一段关于它的回忆',
      '我想写一封给它的话',
      '今天突然很想它怎么办？',
      '帮我做一张纪念卡片文案'
    ],
    chatSafetyHint: '这里不会假装它回来了，只会陪你保存、整理和纪念你们真实拥有过的陪伴。',
    chatSystemRole: '你是归爪的回忆整理助手，陪用户整理宠物离开后的真实回忆、纪念文字和情绪表达。',
    chatBoundaryRules: [
      '不假装自己就是已离开的宠物。',
      '不说“我回来了”“我一直在你身边”等制造复活感的话。',
      '如果未来要使用宠物口吻，必须先让用户确认边界并补充宠物性格、习惯和说话风格。',
      '不诱导用户沉溺悲伤。',
      '鼓励用户保存真实回忆、照顾自己。',
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
      title: '回声信笺',
      subtitle: name => `${name} 的想念慢慢放在这里`,
      aiAvatar: '归',
      placeholder: '写下今天想对它说的话',
      welcomeMsg: name => `这里是 ${name} 的回声信笺。想念涌上来的时候，可以把话慢慢放在这里，我陪你一起收好。`,
      promptTitle: '可以这样写下',
      collapsedText: '打开信笺提示',
      suggestions: name => [
        `我今天很想 ${name}，可以陪我整理一下思念吗？`,
        `帮我写一封给 ${name} 的信。`,
        '我总是自责，可以怎么慢慢放过自己？'
      ],
      serviceActions: [
        { key: 'letter', icon: 'email', title: '写信' },
        { key: 'memory', icon: 'heart', title: '回忆' },
        { key: 'anniversary', icon: 'calendar', title: '纪念日' },
        { key: 'comfort', icon: 'chatbubble', title: '陪聊' }
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
