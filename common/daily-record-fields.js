// Canonical labels adapt legacy category keys; they are not observations.
export const DAILY_HEALTH = [
 ['food','饮食','food'],['water','饮水','water'],['energy','精神','spirit'],['stool','排便','stool'],['weight','体重','weight'],['sleep','睡眠','sleep'],['activity','外出 / 运动','exercise'],['grooming','洗澡 / 清洁','clean'],['preventiveCare','疫苗 / 驱虫','preventive'],['medication','用药','medicine'],['symptoms','异常情况','abnormal'],['misc','小事 / 备注','memo']
].map(([key,label,legacy])=>({key,label,legacy}));
export function hasDailyContent(r={}) {return Boolean(r.mood||r.type||r.note?.trim()||r.memoryText?.trim()||r.lifeText?.trim()||r.events?.length||r.media?.length||Object.values(r.healthValues||{}).some(v=>v?.text?.trim()));}
export function hasExplicitHealth(r={}){return Boolean(r.mood||r.type||r.note?.trim()||r.events?.length||Object.values(r.healthValues||{}).some(v=>v?.text?.trim()));}
export function healthValueLines(r){return DAILY_HEALTH.filter(h=>r.healthValues?.[h.key]?.text?.trim()).map(h=>({key:h.key,label:h.label,text:r.healthValues[h.key].text,date:r.healthValues[h.key].date||r.date||''}));}
