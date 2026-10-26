# 归爪视觉母版锁定包

## 文件用途

- `00_EXECUTE_VISUAL_LOCK.md`：给Codex的完整执行规格。
- `reference/USER_APPROVED_SCREENSHOT.png`：用户此次明确认可的深暖色参考截图，未修改。
- `reference/APPROVED_EXPLICIT_REFERENCE.html`：把该深暖方向写成显式CSS后的可运行旧母版；仍含独立自由印记演示，不是App源码。
- `reference/COMPONENT_CONTRACT_GALLERY.html`：圈选控件的统一几何验收板，可点选，仅本地演示，不保存业务数据。
- `code/reference-dark-theme.css`：从默认浅色参考转为明确深暖色的样式差异。
- `code/visual-lock.roles.css`：用于合并到现有uni-app组件的角色合同；不是直接全局覆盖的补丁。
- `code/visual-lock.manifest.json`：原HTML哈希、原浅色变量、目标颜色和尺寸及能力边界。
- `evidence/`：本次本地浏览器截图和检查，非Android或真实仓库验证。

## 已确认的重要差异

旧HTML默认浅色，用户认可截图为深暖色；本包消除此歧义。导致旧截图变色的环境原因未确认。
只在用户认可的方向内固定色彩；并未批准新功能或所有演示数据。

## 使用

解压到项目根目录的 `design/visual-lock/`，保留相对目录结构。让Codex完整读取 `design/visual-lock/00_EXECUTE_VISUAL_LOCK.md`，并实际运行两个reference HTML。
用户正常浏览可双击HTML；若工具阻止file URL，由Codex使用127.0.0.1本机静态服务访问，不对外发布。

## 验证边界

此包由助手在独立浏览器中制作和检查，没有访问用户Windows仓库、没有修改真实App、没有Android验证、没有模型调用或云部署。不含字体文件、登录凭证或第三方模板。
