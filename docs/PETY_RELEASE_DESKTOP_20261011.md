# 无需手机的后续收口（2026-10-11）

用户暂时无法测试手机，本轮实际完成浏览器交互修复和本地部署前检查。没有把手机或真云项改成通过。

## 本轮改动与证据

| 问题 | 已改到项目里 | 实际验证及限制 |
|---|---|---|
| 登录方式、登录按钮等控制无法用键盘到达 | 登录方式、显示密码、协议勾选控件与链接、登录、注册/游客入口和其他登录方式增加适用的角色、Tab焦点、键盘操作和可见焦点边框；禁用按钮不进入正常Tab顺序 | 新H5中真实Tab到密码登录、Enter切换模式、Space切换空密码框可见状态；未勾选协议时Enter登录仍被拦截；Enter打开隐私政策，返回后协议仍未勾选。没有接受协议、输入账号/密码/号码或发送验证码 |
| 反馈云函数超时15秒，图片下载允许20秒 | submit_product_feedback/package.json改为45秒，给签名、下载、图片检查和数据库落库留余量 | 本地预检执行真实下载器的计时合同，网络替身禁止出站；修改前查出15秒短于20秒，修改后通过。云端实际超时和延迟未验证 |
| 部署依赖和配置检查缺少可重复入口 | 新增 scripts/release-deployment-preflight.cjs，递归检查必要云函数的本地file依赖，记录package SHA并核对下载时限与函数时限 | 当前file依赖可解析，预检无问题；不读取运行时秘密或调用云SDK，不证明远端已同步 |

浏览器验证使用当前源码重新构建的H5，真实检查320、390、768像素宽度：没有横向溢出；320宽下焦点边框可见。截图是同一页面的修改前后记录，不是假图。该结果不代表手机软键盘、系统大字体、Android返回键或完整屏幕阅读器测试。

本轮相关账号回归与全量本机回归通过；H5和App资源编译通过。App资源仍不等于正式签名APK。UI大体布局、字体、配色保持原有设计。

## 证据与可运行路径

目录：`unpackage/release-sprint-20261011-desktop/`。

- `evidence/login-before-320.png`、`login-after-320.png`、`login-after-390.png`、`login-after-768.png`：真实浏览器截图。
- `evidence/browser-checks.json`：键盘、协议未勾选与宽度测量记录。
- `preflight-before.json`、`preflight-after.json`：部署检查前后结果。
- `auth-regression.log`、`final-tests.log`：本地回归日志。
- `source-before/`、`source-changes.json`：本轮改前源码及SHA；后续若有新修改，先比较再逐文件处理。
- `build/h5/index.html`、`build/app/`：最新构建；各自build日志在build目录。

```powershell
node scripts/release-deployment-preflight.cjs
node scripts/release-preview.cjs unpackage/release-sprint-20261011-desktop/build/h5
```

预览只监听127.0.0.1:5187，未关联云空间，适合本机UI验收。原预览命令不带参数仍兼容原构建目录。

## 后续工作边界

仍可在电脑上继续核对新发现的后端问题、隔离并发/恢复场景、H5交互、依赖与部署包。已有稳定测试无需反复运行；新增问题先留失败证据再修复。

仍待条件：明确测试云空间及恢复基线后才能部署和做真实A/B、双会话、存储权限验收；授权测试号码才能发真实短信；手机软键盘、原生返回、真机缓存和正式签名APK另行验证。无需为本轮工作拿出手机。

本轮没有手机操作、云端部署、真实短信、模型/搜索/生图、付款或公开发布；共享收费业务计数未增加。此前业务CDN字节与账单未知的状态保持不变。当前仍不能公开发布。
