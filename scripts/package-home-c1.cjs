const fs=require('fs'),path=require('path');
const root=path.resolve('unpackage/home-c1'),out=path.join(root,'delivery');fs.mkdirSync(out,{recursive:true});
const files=fs.readdirSync(root).filter(n=>/^(native-(white|dog)-(C|C1)\.png|native-(return|switch)\.mp4|browser-.*\.png)$/.test(n));
for(const n of files)fs.copyFileSync(path.join(root,n),path.join(out,n));
const readme=`# Pety C1 · 2026-09-19

打开 index.html 查看全部对照和视频，所有引用均为包内相对路径。

保留 C 的完整主图、标题、轻聊天入口、记录行和日历。没有新增主题。

接缝定位：真机安全区为 40 CSS px，原图从 y=40 开始；旧顶部以取色渐变延展，缺少照片纹理。原图底部 y=415 后旧操作栏再次使用取色渐变。记录栏原先使用 surface，日历透出 page，形成第三次明度跳变。原生状态栏背景读取 API 未在当前渲染环境暴露，未将问题武断归因于原生状态栏。

C1：只在通过检查的上下 3% 空背景带复用同一图片纹理，交替镜像显示，不拉伸或重绘主体。取色仍直接使用显示 URL，按 pet/master/asset 缓存；已合格资源返回与 URL 续期只重算尺寸，不重复采样。记录、日历和列表共用明亮 page 底色，保留影像 → 内容的一处分区。

安全条件：方形源图、合格中性背景；窄边带全部采样像素 alpha≥245、最低通道≥105、通道差≤55、同列变化≤14、邻列变化≤18。标题区域与同列顶部差值不得超过22。检查只是一道保守显示门槛，不等于语义分割保证。拒绝时不延展，采用明确分区；长名字超过12字符、大字体或标题区不安全时预留独立标题区域，最多两行。

两轮：第一轮修正上下背景关系、统一下部底色；第二轮仅收口大字体记录行和聊天按钮行高。没有继续随机试色。

| 覆盖 | 证据 | 结果 / 限制 |
|---|---|---|
| 白猫、比格犬 | 同一 Android 1312×2848 真机 C / C1 | 完整耳、脚、尾巴；同一份2048主图 |
| 返回、切宠 | 两个真机 MP4 | 三次返回；比格→白猫→比格；已查看抽帧 |
| 白猫、比格、灰白猫 | 浏览器360/390/412 | 9场景，完整比例，无横向溢出 |
| 长中文 / 长英文名 | 浏览器360/390/412 | 6场景，预留标题区，不压宠物 |
| 150% / 200%字体 | 浏览器360 | 2场景，记录自然增高、按钮另起一行；不是 Android 系统字体实测 |
| deceased | 灰白猫浏览器390 | 保持想念、纪念文案，不混入健康入口 |
| 复杂原始照片 | 浏览器390 | 完整aspectFit，禁止纹理延展与标题覆盖；不声称融合 |
| 宽主体 / 近边尾巴 | 白猫现有主图 | 左侧尾巴接近边缘仍完整；没有新增极端超宽素材 |
| 深色毛发生成主图 | 缺口 | 只找到旧测试截图，未拿改色图或fixture冒充 |

工程：全量123项通过；最终App构建通过；git diff --check通过。Base Prompt length=1705，SHA256=d4bc2b10df557435b9386d9b015cde348b9a4ff9da90d80f06dc08b40fa3a378，测试校验通过。模型调用0次；未改Provider、Prompt、会员、真实config、uni_modules或Schema；未云端部署、commit、push、reset、stash，未导出数据库。

审美结论：平滑色带已换成与原图对应的细纹理，操作入口不再像独立拼接底栏。下半部保持明亮，不靠擦主体或白雾遮盖。放大检查仍可能看见窄带纹理重复，影像与内容的分区也刻意保留；不宣称逐像素无痕。超大系统字体、其他设备、深色和极端宽构图未实测。到此停止扩散，等待C1集中确认。

修改文件：pages/home/home.vue、components/PetPortraitStage.vue、common/pet-stage-palette.js、tests/pet-stage-palette.test.mjs、tests/stage-return-recovery.test.cjs、scripts/preview-home-directions.cjs、scripts/verify-home-c1.cjs、scripts/package-home-c1.cjs。
`;
fs.writeFileSync(path.join(out,'README.md'),readme);fs.writeFileSync('docs/HOME_C1_REVIEW_2026-09-19.md',readme);
const pair=(pet,cls='',id='')=>`<section class="pair ${cls}" id="${id}">${['C','C1'].map(v=>`<figure><figcaption>${pet==='white'?'白猫':'比格犬'} · ${v}</figcaption><div class="crop"><img src="native-${pet}-${v}.png"></div></figure>`).join('')}</section>`;
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pety C1 验收</title><style>*{box-sizing:border-box}body{margin:0;background:#f8f5ef;color:#302e29;font:16px/1.6 system-ui}main{max-width:1380px;margin:auto;padding:30px}h1{font-size:28px}h2{margin-top:40px;font-size:21px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}figure{margin:0}figcaption{padding:10px 0}img{display:block;width:100%}video{width:100%;max-height:700px;background:#222}.crop{overflow:hidden}.top .crop{height:180px}.bottom .crop{height:300px}.top img,.bottom img{width:656px;max-width:none}.bottom img{transform:translateY(-650px)}.detail{overflow:auto}.detail .pair{width:1328px}.gallery{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}a{color:inherit}p{max-width:900px}@media(max-width:700px){main{padding:16px}.gallery{grid-template-columns:1fr 1fr}}</style><main><h1>C → C1：保留结构，收好接缝</h1><p>以下是同一手机、同一视口、同一主图的原始截图。局部对照按同一比例和同一坐标显示，没有修图。<a href="README.md">完整覆盖表与边界说明</a></p><h2>白猫 · 真机</h2>${pair('white')}<h2>比格犬 · 真机</h2>${pair('dog')}<h2>顶部局部 · 同尺寸</h2><div class="detail">${pair('white','top','top-white')}${pair('dog','top','top-dog')}</div><h2>地面 / 操作区 / 记录栏 · 同尺寸</h2><div class="detail">${pair('white','bottom','bottom-white')}${pair('dog','bottom','bottom-dog')}</div><h2>最终版本 · 真机录屏</h2><div class="pair"><figure><video controls preload="metadata" src="native-return.mp4"></video><figcaption>返回首页</figcaption></figure><figure><video controls preload="metadata" src="native-switch.mp4"></video><figcaption>切换宠物</figcaption></figure></div><h2>边界场景 · 浏览器，非真机</h2><p>尺寸、长名字、字体放大、灰白猫和复杂照片；深色主图与 Android 系统大字体缺口见说明。</p><div class="gallery">${files.filter(n=>n.startsWith('browser-')).map(n=>`<figure><a href="${n}"><img loading="lazy" src="${n}"></a><figcaption>${n.replace('browser-','').replace('.png','')}</figcaption></figure>`).join('')}</div></main></html>`;
fs.writeFileSync(path.join(out,'index.html'),html);console.log('Packaged media:',files.length,'files');
