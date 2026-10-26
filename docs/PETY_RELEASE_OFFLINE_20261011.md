# 2026-10-11 不依赖真机的收口记录

用户本轮明确暂时不能真机验证，先做其他任务。本次没有连接手机、发短信、部署云端或调用收费业务接口。

## 发现与修复

图片 HTTPS 下载器的错误响应和重定向响应原来调用 `response.resume()`，继续消费不再需要的正文；错误返回后计时器也被清除，不能以返回失败证明传输已停止。DNS 和每次下载分别计时，重定向产生独立子请求，外层超时没有统一取消所有连接。

这会浪费流量和连接资源，削弱原来的下载超时保护。只涉及通过域名/IP校验的图片响应，不把它夸大为新增跨账号越权。

修改 `api_pet_avatar/safe-download.js` 和 `common/pety-auth/safe-image-download.js`，两份内容 SHA 一致：

- 非 200、无效重定向、错误类型和正文超限立即关闭响应和请求。
- 有效重定向关闭原响应，不读取其正文；继续校验下一跳域名、DNS和固定TLS地址。
- 整条下载共用一次20秒截止时间，包括 DNS、重定向和最终正文；超时停止全部已建立请求。
- 超时之后才返回的 DNS 结果不会发起迟到网络请求；正常最终图片保留原字节。

## 可重放证据与级别

新增 `tests/release-download-lifecycle.test.cjs`，实际执行生产下载器，使用隔离传输和本机回环 HTTP。没有公网、真实CDN或Provider请求，不是TLS/真云/真机验收。

| 验证项 | 结果 | 证据 |
|---|---|---|
| 修改前，错误正文关闭/总截止时间/重定向停止 | 4项失败，1项已有防御通过 | unpackage/release-sprint-20261011-offline/download-lifecycle-before.log |
| 正常图片、有效重定向、错误关闭、DNS迟到、超时子请求取消 | 通过；图片字节相同 | download-lifecycle-after.log、release-download-lifecycle.test.cjs |
| 真正的回环 HTTP 流式响应 | 错误和重定向连接均关闭；关闭后测试服务器没有新增正文写入 | 同上日志 actual loopback HTTP 测试；测试仅映射传输到127.0.0.1 |
| 原图片安全与反馈归属回归 | 通过；含2K解码、域名/DNS固定、正文上限及反馈自有票据 | 同上专项日志 |
| 全量本机回归 | 通过，正常和恶意输入用例保留 | final-tests.log；不等于真实支付宝云事务结果 |
| 富文本/桥源码复查 | 当前 pages/common/components 未发现 v-html、rich-text 或 web-view 使用；外链已有HTTPS与凭据限制 | 当前源码检查；不是完整WebView平台认证 |

运行命令：

```powershell
node --test tests/release-download-lifecycle.test.cjs tests/release-safe-download.test.cjs tests/release-feedback-security.test.cjs
node --test tests/*.test.cjs tests/*.test.mjs
```

## 回退与剩余门槛

本次改前两份源文件保存于 `unpackage/release-sprint-20261011-offline/source-before/`；上轮交付包与报告版本也保留历史。只在比较SHA确认没有后续他人修改后逐文件处理，不回滚整个项目。回退旧下载器会重新引入上述传输问题，应暂停相关下载路径而不是把旧版本当安全方案。

这次只改云函数/公共模块的下载实现，没有前端或UI改动，无需重复编译未变的H5/App资源。最近成功构建路径仍见主报告；APK、真机缓存、真实短信、云端双会话与隔离、匿名存储、恢复调度仍未验收。未知用途的ali01保持只读。当前不能公开发布。

费用计数沿用共享总账：本次真实短信、正式取号、AI/搜索、Wan/VIAPI、视频生成、付款退款均新增0次；回环HTTP不是业务CDN。此前手机图片的业务CDN字节与账单仍未知，没有把它重记为0。
