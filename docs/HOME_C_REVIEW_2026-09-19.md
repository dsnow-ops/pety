# 首页候选 C · 交付记录

采用「无框宠物影像 + 明亮同色系」。A / B 保留在设置的外观选项，C 名称为「明亮影像」。新偏好默认 C，已有 A / B 偏好不强制覆盖。

- A：圆角横向卡片、35% 信息区与大按钮仍构成 banner；优点是合格背景延展与完整主图。
- B：背景直接混入 30% 白色、按钮将原色乘 0.43，整页明度仍被照片带低；同色不等于分层。
- C：完整主图成为首页上部，标题落在留白中，陪伴入口缩为轻按钮，今日记录收成一行。色温来自图片，页面 / 表面 / 正文各自控制明度。

两轮视觉修正：第一轮去掉横幅结构；第二轮消除独立标题色带、继承圆角与主体遮罩，让完整影像承接标题。没有第三轮随机试色。

## 本轮文件

| 文件 | 作用 |
| --- | --- |
| `pages/home/home.vue` | C 结构、轻 CTA、精简文案、返回恢复、晚到切宠事件保护 |
| `components/PetPortraitStage.vue` | C 无主体遮罩、取色完成再揭示、直接采样正在显示的 URL |
| `common/pet-stage-palette.js` | 四边背景延展、按 pet/master/asset 缓存、v3 隔离旧采样结果 |
| `common/pet-app-theme.js` | 明度独立的 C 色彩角色，A / B 保留 |
| `common/pet-app-theme-mixin.js` | C 主题类与原有页面主题连接 |
| `common/pet-store.js` | 当前宠物提交后的订阅通知 |
| `common/home-hero-asset.js` | 缺 URL 时保留真实失败原因 |
| `pages/settings/settings.vue` | A / B / C 切换入口 |
| `tests/pet-app-theme.test.cjs` | 明度、隔离、A / B 偏好回归 |
| `tests/pet-stage-palette.test.mjs` | 四边取色、冷启动缓存与身份隔离 |
| `tests/stage-return-recovery.test.cjs` | 晚到事件、有限恢复、native 临时路径复用保护 |
| `scripts/preview-home-directions.cjs` | 真实组件模板 / 样式的浏览器预览，不冒充真机 |
| `scripts/verify-home-directions.cjs` | A / B / C 场景、窄屏、CTA 与快速切换检查 |

## 验证与证据

- 真实 Android：白猫和比格犬各 A / B / C，1312×2848，同设备、同主图。
- 真实录屏：三次首页 → 我的 / 问诊 → 首页；比格 → 白猫 → 比格。已检查录屏抽帧。
- 收口时发现 native 取色与显示资源错拍：改用显示 URL 绘制画布，避免将 getImageInfo 的临时路径当作资源身份；修复后两宠的上下延展与明亮主题稳定对应，延迟检查不再跳色。
- 121 项自动测试通过；最终 App 构建通过；git diff --check 通过（仓库已有换行提示）。
- 浏览器：白猫 / 比格 / 灰白猫 A / B / C，另覆盖 360 / 412 宽度。灰白猫不是第三只真实宠物的真机结果。
- 对照入口：`unpackage/home-c/compare.html`；真机截图 `native-{white,dog}-{A,B,C}.png`；录屏 `native-return.mp4`、`native-switch.mp4`。
- 本轮模型 / 分割调用 0 次；未修改 Provider、Base Prompt、会员或真实 config；未 commit / push / reset / stash / 云端部署。

## 审美判断与边界

宠物成为第一视觉中心，毛发、耳朵、脚与尾巴完整，照片原有地面让它站稳；信息与操作退到第二层。否掉大模糊、厚羽化、重阴影和全页灰褐铺色。

影像区到浅色内容区仍有明确交界，没有宣称所有背景都能无痕融合。顶部延展与照片的纹理也不是逐像素连续。深色宠物、复杂背景、超大字体、其他设备尚未覆盖；下一步只应补这些构图与可读性验收，不再新增图像生成或抠图路线。
