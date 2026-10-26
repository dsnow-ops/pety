# 头像图片读取授权与临时链接回执

2026-10-23 09:30。本轮只改本地后端源码；数据库、签名服务和模型都是测试替身，没有签发真实云链接、上传真实图片、收费调用或部署。

## 修复

候选图和已确认主图入口原先直接取data[0]；通用图片入口只检查data.length。带错误标记的数据、数组形状异常或返回记录与请求归属不符时，部分路径仍可能继续签名。现在先确认成功响应和数组结构，再检查记录自身的账号、宠物、任务/文件与状态。查询失败立即停止，不能继续从其他来源寻找授权。一个请求里的所有文件都确认归属后才签名。主图的confirmed必须是布尔true。

临时链接原来按数组位置返回，没有确认对应文件。现在对输入文件去重，按响应fileID逐项匹配，再恢复调用者顺序；缺ID、重复ID、外来ID、错误回执、无效HTTPS地址、带账号密码的URL或相互矛盾的URL字段均拒绝。没有永久链接兜底。

这是按官方返回契约收紧确认：[DCloud云存储文档](https://doc.dcloud.net.cn/uniCloud/storage/dev.html#cloudgettempfileurl)列出的云函数返回项包括fileID与tempFileURL。官方文档不等于当前远端SDK行为实测，正式部署前仍需核验实际回执。

## 证据与兼容

- [修复前TAP](avatar-media-before-2.tap)：首批9组测试中7失败、2通过。更早avatar-media-before.tap包含测试脚本语法错误，不作为产品问题复现证据。
- [最终相关回归](local-38/results.json)、[原始TAP](local-38/tests.tap)：421/421。新增11组；其他增长来自把已有头像相关测试纳入回归，不全是新增测试。
- 异常读取、错误标记、假确认状态、跨账号/宠物/任务返回、失败后继续找授权的情况，都在签名替身调用前停止。
- 完整批次中包含一张无归属图片时，整个批次没有任何签名调用。
- 正常候选、确认主图及ready原图凭据仍可读取。返回顺序颠倒时正确配对；重复输入仅请求一次且结果顺序保持。
- 原有Hero恢复、主文件字节保持、透明派生图像几何和图片摘要校验通过。部分旧签名替身缺fileID，已按官方契约补齐，没有降低产品检查条件。

本轮没有前端修改，未重复编译H5或App；客户端近期实际H5证据仍按交付文档各自版本记录。首页三个锁定文件指纹一致。

## 仍然不代表什么

这不证明内置云存储的其他SDK入口、匿名访问、旧链接/CDN或历史签名URL已撤销；仓库历史报告里的远端访问旁路仍是发布门槛，不能靠本轮本地测试消除。签发的HTTPS地址是否为预期服务端实际返回、有效期和访问撤销，需要隔离身份与合成文件的云端实测。

复现：`node --test tests/avatar-media-authorization.test.cjs tests/avatar-temp-url-integrity.test.cjs tests/rc-candidate-display-endpoint.test.cjs tests/hero-recovery-e2e.test.cjs tests/rc-avatar-server-auth.test.cjs`。完整相关回归：`node scripts/verify-overnight-local.cjs <新证据目录名>`。
