const CONFIGURED_HOSPITALS = [
  {
    id: 'demo_24h',
    name: '24小时宠物急诊服务位',
    level: '急诊优先',
    tags: ['夜间急诊', '误食中毒', '呼吸异常'],
    address: '接入地图 POI 后显示附近真实医院地址',
    phone: '',
    openHours: '24小时服务位',
    distanceKm: null,
    isDemo: true
  },
  {
    id: 'demo_general',
    name: '综合宠物医院服务位',
    level: '综合问诊',
    tags: ['内科', '皮肤', '影像检查'],
    address: '可在 common/hospital-store.js 配置真实医院',
    phone: '',
    openHours: '09:00-21:00',
    distanceKm: null,
    isDemo: true
  },
  {
    id: 'demo_specialist',
    name: '专科转诊服务位',
    level: '专科建议',
    tags: ['眼科', '骨科', '肿瘤', '心超'],
    address: '后续接入腾讯地图/高德 POI 后自动更新',
    phone: '',
    openHours: '预约制',
    distanceKm: null,
    isDemo: true
  }
];

const EMERGENCY_SIGNS = [
  '呼吸困难、张口呼吸、舌头发紫',
  '抽搐、昏迷、突然站不稳',
  '持续呕吐、吐血、腹泻伴精神差',
  '误食药物、巧克力、洋葱、老鼠药等',
  '尿不出来、严重疼痛、大量出血'
];

export function getHospitalList() {
  return CONFIGURED_HOSPITALS.slice();
}

export function getEmergencySigns() {
  return EMERGENCY_SIGNS.slice();
}

export function hasCallablePhone(hospital) {
  return Boolean(hospital && /^[\d+\-\s]{6,}$/.test(hospital.phone || ''));
}
