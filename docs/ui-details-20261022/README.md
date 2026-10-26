# 首页下半页与我的：UI 细节统一

日期：2026-10-22。本轮在当前真实 uni-app 项目增量修改，保留既有未提交成果。未修改真实用户资料，未提交、推送、部署或调用付费服务。

## 实际修改

- 首页滚动顶栏：品牌与陪伴/怀念状态分开，不再重复拼接宠物名；不透明背景防止后方文字透出。真实宠物名仍在主视觉和档案中保留。
- 陪伴册：统一标题和辅助入口，空态采用克制的册页边线、图标和短文案；有记录时使用相同深暖色表面，保留原记录跳转。
- 日历：单行月份/查看整月入口，柔和分隔线与选中态；“今天”占用独立星期标签位置，不再叠加“今”字。
- 首页工具区与陪伴建议：统一图标底、圆角、内缩分隔线、字级和触控区域。移除旧浅色按钮、亮色横线及深色背景上的暗文字；建议关闭后不残留空容器。
- 我的：账号入口与本机保存说明分层，概要不再展示 UID；账号详情功能保留。备份未接入、刷新中和云端状态待确认均如实显示。宠物功能、设置帮助列表同步统一；当前宠物选中边框更明确。
- H5：首页/我的滚动高度扣除真实底栏高度，页尾留白放在内容内部，展开操作和页尾可以完整滚到可见区域。H5 专用高度规则不改变 App 原生窗口计算。

## 首页锁定区

对照 `../home-visual-lock-20261022/user-approved-reference.jpg` 复核；本轮前后逐字比较确认：宠物大图区域及其文字模板、构图 CSS、图片底部过渡和今日记录卡模板/CSS未改动。没有缩小宠物、替换图片或改成独立照片卡。

## 复现

```powershell
node scripts/build-dual-mode.cjs h5 unpackage/ui-details-20261022/after
node scripts/verify-ui-details.cjs after rerun-<新目录名>
node scripts/build-dual-mode.cjs app unpackage/ui-details-20261022/after
```

验证脚本从本轮编译目录启动实际 localhost H5，使用独立浏览器上下文、TEST 宠物与本地测试记录，阻断所有非 localhost 请求。账号登录/离线/刷新中仅通过页面状态注入检查视觉分支，不代表真实鉴权实测。每轮截图目录不覆盖。

业务代码仅涉及 `pages/home/home.vue`、`pages/profile/profile.vue`、`components/HomeLifePreview.vue`、`components/companion-prompt/companion-prompt.vue`、`components/AppSettingsRow.vue`。本轮前源码保存在 `unpackage/ui-details-20261022/source-before/`；本轮增量补丁见 `changes.patch`。

## 验证边界

- 自动化：20/20 通过。命令为 `node --test tests/home-life-preview.test.cjs tests/home-identity-rework.test.cjs tests/release-account-refresh-state.test.cjs tests/rc-account-page-races.test.cjs tests/ui-script-syntax-v1.test.cjs tests/dual-mode-mechanisms.test.cjs`。
- H5：最终 7 组交互检查及 33 张截图见 `verified/results.json` 和 `verified/`。360、390、412 宽度实际点击、输入、保存并重新打开原记录；陪伴建议展开/换一个/记下来；前后周切换、整月、档案和游客登录导航；长名称、1.3 倍字体、怀念模式及底栏遮挡检查。
- 日志：无页面 JavaScript 异常。保留的控制台提示为未关联服务空间，以及离线规则阻断的 DCloud `shadow-grey.png` 图片请求；未伪造云端成功。
- H5 / App：最终源码本地编译均通过；日志位于 `unpackage/ui-details-20261022/after/build-h5.log`、`build-app.log`。
- Android 模拟器：本轮未运行。Android 真机：本轮未连接、未部署；不能把 H5 截图或 App 编译视为真机验收。

## 集中真机验收清单

1. 状态栏和底栏安全区；滚动后的品牌栏遮挡与切页返回。
2. 首页下半页及我的，在默认与系统大字体下的图标、内边距、换行和底部可见性。
3. 陪伴建议展开/收起/更多菜单；记录保存后返回首页，原记录重开。
4. 账号刷新中/离线时文案；既有宠物切换、退出再进入。

本轮没有改动相机、相册、Canvas 导出、支付、会员权益和云鉴权流程，也未据此声称这些功能通过验收。中间目录保留排查过程；最终截图以 `verified/` 为准。
