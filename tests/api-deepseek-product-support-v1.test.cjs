'use strict';

const assert = require('node:assert/strict');

global.uniCloud = { database() { return { collection() { return {}; } }; } };
const api = require('../uniCloud-alipay/cloudfunctions/api_deepseek/index.js').__test;

for (const question of [
  '怎么记录异常？',
  '怎么修改宠物资料？',
  '怎么换宠物形象？',
  '形象生成失败怎么办？',
  '怎么看日历？',
  'Similar Case 是什么？',
  '如何反馈？',
  '纪念模式是什么？',
  '怎么记录今天的状态？',
  '归爪怎么切换英文？',
  'Where can I edit my pet birthday?',
  'How do I regenerate the pet avatar?'
  ,'How do I log in?'
  ,'How do I change my account?'
  ,'Can you explain membership?'
]) {
  const scope = api.getScopeCheck(question, 'current', []);
  assert.equal(scope.outOfScope, false, question);
  assert.equal(scope.intent, 'PRODUCT_SUPPORT', question);
}

assert.equal(api.getScopeCheck('帮我写一个 Python 贪吃蛇游戏', 'current', []).outOfScope, true);
for (const question of ['驱虫和疫苗怎么安排？', '我的宠物今天不喝水怎么办？', '猫吐毛球要观察什么？']) {
  const scope = api.getScopeCheck(question, 'current', []);
  assert.equal(scope.outOfScope, false, question);
  assert.notEqual(scope.intent, 'PRODUCT_SUPPORT', question);
}
for (const question of [
  'How should I feed my dog?',
  'My cat keeps scratching its ears',
  'Why is my pet losing weight?',
  '它老是咬沙发怎么办？',
  '每天遛多久比较合适？',
  '怎样让它不害怕洗澡？'
]) assert.equal(api.getScopeCheck(question, 'current', []).outOfScope, false, question);
assert.equal(api.getScopeCheck('归爪，帮我写一个 Python 游戏', 'current', []).outOfScope, true);
const memorialSupport = api.getScopeCheck('怎么修改语言？', 'deceased', []);
assert.equal(memorialSupport.intent, 'PRODUCT_SUPPORT');
for (const question of [
  '如何记录今天的想念？',
  '怎么修改你记住的性格？',
  '为什么这里会显示回忆？',
  '怎么查看以前写下的东西？'
]) {
  const scope = api.getScopeCheck(question, 'deceased', []);
  assert.equal(scope.outOfScope, false, question);
  assert.equal(scope.intent, 'PRODUCT_SUPPORT', question);
}
for (const question of ['我今天又想起你了', '你还记得我吗？', '我昨晚梦见你了']) {
  const scope = api.getScopeCheck(question, 'deceased', []);
  assert.equal(scope.outOfScope, false, question);
  assert.notEqual(scope.intent, 'PRODUCT_SUPPORT', question);
}
const prompt = api.buildSystemPrompt('deceased', '', null, 'zh-Hans', true);
assert.match(prompt, /产品使用助手/);
assert.match(prompt, /不要进入宠物第一人称/);
assert.match(prompt, /真实产品能力/);

console.log('api_deepseek PRODUCT_SUPPORT scope tests passed');
