# 问诊底部操作区细节修复 · 2026-10-22

用户指出入口图标看不清、空间处理不当。本轮仅增量修改 `pages/chat/chat.vue` 的模板和样式；script 与本轮前逐字一致。此前首页视觉锁定和其他未提交工作均保留。

## 原因与修改

- 旧图标写死为 `#302A23`，在深暖背景上几乎不可见；改为浅灰绿，并验证图标/文字与操作区背景对比度均高于 4.5:1。页头辅助文字同时修正旧主题变量带来的暗色。
- 横向滚动胶囊总宽超出屏幕，360 宽度的最后一项右边界达到约 383px。改为五个等宽的图标＋文字入口；桌面较宽区域改用横向图文，保留全部操作。
- 工具栏、资料选择与输入框归为同一深暖操作区，去掉亮色胶囊轮廓和资料入口默认边框。
- 资料入口显示“未选记录”或已选数量，保留实际选择弹层与引用行为。
- 修正 auto-height 文本框重复计算内边距的问题，输入框和拍照/发送按钮对齐；390 宽度下底部总高度由 204.7px 降至 179.5px。
- 大字体减少工具栏两侧内边距，“相似案例”在 360 宽度、1.3 倍字体下保持一行。照片/报告草稿区继承同一配色，媒体字节和选图逻辑不变。

## 实测证据

- 最终实际编译 H5：`final/results.json`，包含 360、390、412、720 宽度；1.3 倍字号、560px 较矮视口、怀念模式。
- 实际操作：AI 问诊展开提示、空问题的相似案例保护、参考资料打开/关闭、输入文字、报告/照片本地文件选择与删除、就医页跳转。
- 使用独立 TEST 浏览器数据和三色色块测试图片，未发送问诊或模型请求；无页面 JS 异常、无 console error。
- 13 项既有回归通过：`node --test tests/care-photo-client-v1.test.cjs tests/autonomous-chat-races.test.cjs tests/ui-script-syntax-v1.test.cjs`。
- H5 与 App 本地编译通过，日志位于 `unpackage/chat-toolbar-20261022/after/`；`git diff --check` 通过。
- 对照截图：`baseline/`；最终截图：`final/`；本轮增量：`changes.patch`；源码备份：`unpackage/chat-toolbar-20261022/source-before/`。

## 复现入口

```powershell
node scripts/build-dual-mode.cjs h5 unpackage/chat-toolbar-20261022/after
node scripts/verify-chat-toolbar.cjs after rerun-<新目录名>
```

验证脚本实际启动 localhost 编译产物，并阻断所有外部请求。短视口不等于真实软键盘；Android 模拟器、Android 真机本轮均未运行，未部署。集中真机待验：系统大字体、软键盘弹出/收回、相册权限和取消返回、底栏安全区。真实问诊、搜索、上传、云鉴权不属于本轮验证范围。
