# 视觉锁定：母版、真实组件与规则来源

2026-09-29。最高视觉方向是 `design/visual-lock/reference/USER_APPROVED_SCREENSHOT.png`，显式母版为同目录 `APPROVED_EXPLICIT_REFERENCE.html`。旧浅色 HTML 和旧 UI_SYSTEM_V2 的浅色值不再作为本轮实现依据。没有证据证明过去截图的颜色差异由某个插件造成。

## 母版映射

|母版职责/选择器|真实实现|最终规则|
|---|---|---|
|深暖页面、内容面、输入轨道|common/ui-system-v2.css|#25241E、#2E2E25、#24261F；正文 #E2E8DC、次文 #BCC4AE|
|.hero / .brandline / .home-scroll|pages/home/home.vue、现有 PetPortraitStage / PetAvatarHero|生产高清资产不变；品牌融入场景，完整宠物；背景层过渡到深暖底，不染暗宠物|
|.daily-panel / .gz-panel|AppSurface primary|24 圆角、20 内边；深暖渐变，非浅奶油面|
|.btn / .gz-btn|既有 AppButton|48 高、14 圆角、15 字、22 行高、flex 双向居中、20 图标|
|.segments / .gz-segmented|既有 AppSegmented|外框 44、内边 4；真实 button 触控区 44，内部标签面 36/10 圆角|
|.gz-event-grid / .gz-choice-hit|日常记录原 eventOptions / event-chip|原 12 键不变，flex 三列四行；触控 44、面 38、圆角 10、字 14/20|
|.gz-mood-grid|日常记录原 moodOptions / mood-chip|原五状态一行等分；触控 44、面 38、字 13/20|
|.gz-day|首页原 home-week-day|七列等宽、高 74、圆角 16，日期 20/22、辅助 11/14，今标在内部|
|.cover-card|HomeAlbumCover、首页 life-section|作用域内冻结作品真实封面；有内容标题行查看全部，无内容深色紧凑空状态|
|.gz-settings-row|既有 AppSettingsRow|最小高 64，padding 14/16，标题 15/22、说明 12/18；不是主按钮|
|.studio / .tools / .studio-footer|card-compose 外壳、FreeSealEditor|深暖外壳，存册/导出复用 AppButton；位置分段独占一行，大小选项另行排列|
|.paper|既有 NarrativeCanvas 与 V1–V6 作品渲染器|不改任何纸面绘制代码，不改变冻结快照或媒体像素|
|.home-tabs|现有 pages.json tabBar、applyNativePetTheme|现有三条路由不变；深色实底、本地 PNG 线性图标，无 custom tabBar 重构|

未另建第二套按钮/分段/表面组件。`VisualLockContract.vue` 是组合现有组件的开发验收面板，不承担业务存储；仅开发构建通过 `pages/calendar/calendar?visualContract=1` 打开，不加入路由表和 tabBar，也不改变默认入口。

## 实际冲突与修复

历史规则副本保留在 `unpackage/visual-lock-20260929/baseline`。修改前 computed 来源是上一版已编译 H5 真实 App，在 375 逻辑宽重新运行读取，不是参考页的尺寸；完整规则链见 `visual-lock-20260929/measure-before/computed.json`。Android 中途热更新截屏另存 intermediate-hmr，不能当作修改前。

|用户圈选|修改前实际生效|原因与本轮处理|
|---|---|---|
|A 首页主次按钮|高 48、字 16/24；主面 #FCF9F1|旧 token 浅色；petThemeVariables 又以内联颜色注入。指定页面锁定显式 token，主次统一 15/22 和低饱和深暖材质|
|B 事件标签|“饮食”宽 42、高 44、圆角 499.5、字 11/13.2、display:block、padding 6.5/9|原 calendar.vue 963–971 的 scoped 999rpx 圆角优先于公共 14px；1003–1006 的内容宽与内边距配合公共 min-height:44，形成竖椭圆；无 flex 垂直居中。删除旧角色分支，统一三列定宽与 44/38 双层几何|
|C 保存|高 48、圆角 8、字 14.5、行高 44、上下 padding 12|原 calendar.vue 1029–1039 的 88rpx 高/行高与公共 min-height/padding 混用；改用原 AppButton，只留下整行宽和 18px 上间距|
|D 分段|外高 54、内高 44、内边 8、字 15/24|公共子项 min-height44，加轨道 padding4 和两侧边框；旧 daily-tabs 另改间距。删除页面分段覆盖，外 44、触控 44、面 36；润色风格区单独命名，不再共用 daily-tabs|
|E 周历|高 90，今标 top:-7|home.vue 直接设 min-height90；改为 74，日期/辅助行高明确，今标收回单元内部|
|F 陪伴册|标题、解释、整条浅色按钮与封面入口重复|用既有封面组件发出内容可用状态；真实作品与空状态互斥，标题行只留查看全部|
|G 账号入口|74×44 的绿色按钮，圆角 499.5|profile.vue 多次叠加 account-action 胶囊样式；移除该实例，使用现有 AppSettingsRow。状态和游客资料说明保留|

原生 button 的默认样式确实参与级联，但健康事件原来是 view，不能把事件变形归咎于 button 默认样式。before JSON 保存了 button 默认 line-height:2.55556、伪元素与最终匹配规则；保存动作的问题是自定义规则叠加。没有新增全局 button !important、全局 active 或页面缩放补丁。

## 等价处理与功能边界

- 参考 grid 的事件区在 App 使用 flex 三等分；最终宽高按实际 computed 测量。
- 系统 tabBar 使用深色实底，不强求参考网页的半透明模糊；图标来自本地代码绘制，非截图素材。
- 首页生产 2048 母图与参考的演示裁切不同；只比较构图与同逻辑宽度，不冒称逐像素相同。
- 大字布局允许事件变为两列、状态三列、动作增高；普通字号按合同固定几何。
- 首页和指定页面锁定主题，问诊等冻结页面继续沿用原主题注入，避免未经适配就把旧文字染到深背景上。
- 普通账号已有超过 1 只宠物时说明“已保留 N 只、上限 1 只、暂不能新增”；canCreateAnotherPet 规则不变，不删历史宠物、不放宽额度。
- 我的页原“纪念册未接入”改为连接已有册页，说明本地记录/制卡/导出可用、云同步未接入。单设备会话仍是未部署/未验证状态。

## 本轮补充的原生大字适配

此 Android 基座的 uni 系统信息未提供字体倍率，旧判断不触发。保留 H5/其他平台系统信息读取，Android 服务层通过 Native.js 读取 Settings.System.font_scale，仅用于本轮指定页面 CSS 字体倍率和大字重排。没有修改系统字体设置的产品逻辑。测试脚本暂设1.3后恢复原1.0。API依据：[DCloud Native.js](https://www.html5plus.org/doc/zh_cn/android.html)。

制卡旧 scoped 细边颜色改为同一 ui-line；缩略图“版式示例”标签使用深轨道和浅文字，避免浅底浅字。档案返回图标与真实文字色一致；设置页同职责行在原规则中改为 min64、padding14/16、标题15/22、说明12/18。
