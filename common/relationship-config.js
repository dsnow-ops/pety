const DEFAULT_STATUS = 'current';

const RELATIONSHIP_CONFIG = {
  current: {
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
      quickActions: [
        { key: 'archive', icon: 'folder-add', title: '档案', desc: '身体与习惯' },
        { key: 'journal', icon: 'compose', title: '日记', desc: '今日片段' },
        { key: 'chat', icon: 'chatbubble', title: '问诊', desc: '温柔咨询' },
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
      quickActions: [
        { key: 'chat', icon: 'chatbubble', title: '评估', desc: '适养判断' },
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
      quickActions: [
        { key: 'letter', icon: 'email', title: '信笺', desc: '写给它' },
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

export function getRelationshipConfig(status) {
  return RELATIONSHIP_CONFIG[normalizeRelationshipStatus(status)];
}

export function getRelationshipOptions() {
  return ['current', 'future', 'deceased'].map(status => RELATIONSHIP_CONFIG[status]);
}

export function setRelationshipTabBar(status) {
  const config = getRelationshipConfig(status);
  uni.setTabBarItem({ index: 1, text: config.tabText });
}
