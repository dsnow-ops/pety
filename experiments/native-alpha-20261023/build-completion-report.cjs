'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ids = ['pro-master-newcat-v8-retry-01', 'pro-master-newcat-v9-01', 'pro-master-newcat-v9b-01'];
const titles = ['修改前：尾巴混入master黑橘花纹', '长规则版：失败，生成说明海报', '精简执行版：按真实照片补全'];
const cards = ids.map((id, i) => {
  const review = read(`outputs/${id}/review.json`);
  return `<article><h2>${titles[i]}</h2><a href="outputs/${id}/provider-original.png"><img src="outputs/${id}/provider-original.png" alt="${titles[i]}"></a><p>${esc(review.chineseAssessment || review.reason || review.identity)}</p><p><a href="outputs/${id}/review.json">评价</a> · <a href="outputs/${id}/receipt.json">回执</a> · <a href="samples/${id}.json">输入与参数</a></p></article>`;
}).join('');
const summary = read('summary.json');
const prompt = fs.readFileSync(path.join(root, 'prompts/compact-v9b-identity-completion.txt'), 'utf8');
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>真实宠物补全规则 · 对照</title><style>*{box-sizing:border-box}body{margin:0;background:#f4f0e8;color:#302820;font:16px/1.8 system-ui,"Microsoft YaHei",sans-serif}main{max-width:1400px;margin:auto;padding:32px 20px}h1,h2{line-height:1.4}h2{font-size:20px}a{color:#526342}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}article{min-width:0;background:#fffaf2;padding:16px;border-radius:16px}img{width:100%;display:block}.refs{display:flex;gap:20px}.refs figure{flex:1;margin:0}.refs img{height:320px;object-fit:contain}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#eae1d1;padding:20px;font:inherit}.notice{background:#eae1d1;padding:18px}@media(max-width:700px){.grid{grid-template-columns:1fr}.refs{flex-direction:column}h1{font-size:28px}}</style><main><h1>看不见的地方，按真实宠物合理补全</h1><p>master仅提供画风、材质和灯光。局部可见证据优先；不可见处按该宠物自身相邻毛色、既有花纹、毛长与体型保守补全，不借用master的身体特征，也不把所有宠物强行变成纯色。</p><div class="notice">本轮新增2次生成，保守预留¥0.50；累计¥${(summary.totalIncludingPreviousFen / 100).toFixed(2)} / ¥20，含此前拒绝请求预留，实际账单未核实。仅为测试提示词，未部署或替换正式模型。</div><h2>两张输入</h2><section class="refs"><figure><img src="inputs/master-style-v1-original.jpg" alt="master风格参考"><figcaption>master：风格参考</figcaption></figure><figure><img src="inputs/newcat-20261024.jpg" alt="真实宠物身份照片"><figcaption>身份照片：身体右后方已露出浅色蓬松尾巴</figcaption></figure></section><section class="grid">${cards}</section><h2>实际执行的精简提示词</h2><pre>${esc(prompt)}</pre><p>三个样本使用相同输入、模型、种子与输出参数。长规则版只增加通用补全规则；精简版同时调整了指令形式并加入照片可见特征，不能据此声称单独证明通用规则有效，更不能证明其他宠物或其他种子稳定。</p><p><a href="prompts/identity-completion-v9-rule.txt">可复用补全规则</a> · <a href="prompts/compact-v9b-identity-completion.txt">精简提示词原文</a> · <a href="report.html">全部记录</a></p></main></html>`;
fs.writeFileSync(path.join(root, 'identity-completion-report.html'), html);
console.log('Built identity-completion-report.html');
