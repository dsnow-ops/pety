# 私有存储适配准备合同（2026-10-14）

这是一份本地接线合同，不是已启用的存储系统。新增模块均没有被现有页面或云函数 handler 引入；实际配置没有创建、读取到云端或修改。现有认证、回执、缓存、生成模型和原图质量逻辑保持原样。

## 已准备的边界

| 文件 | 可复用内容 | 尚缺什么 |
|---|---|---|
| `uniCloud-alipay/cloudfunctions/common/pety-auth/private-storage.js` | 配置有无检查；私有对象描述；POST V4签名；受限上传、内容检查、下载授权的接口边界及错误码 | 真实权限检查与OSS SDK桥、现有回执查询接线、生成图服务端写入 |
| 同目录 `private-storage.example.json` | 空字段、`enabled:false`、明确私有要求、TTL示例 | 不是运行配置；不能用示例里的权限声明代替远端证据 |
| `common/private-storage-upload.js` | `uni.uploadFile`兼容的表单直传；仅返回稳定ID；传输后复核scope；V4与旧URL到期时间解析 | 页面接线、失败/409重试处理、业务complete及URL解析器接线 |
| `scripts/check-private-storage-config.cjs` | 只读取预定服务端配置，输出字段有无及状态 | 不连接云端；字段齐全仍为`REMOTE_UNVERIFIED`，不会输出READY |

预定配置位置：`uniCloud-alipay/cloudfunctions/common/uni-config-center/pety-storage/config.json`。当前不存在。模块不自动装载它，接线时通过既有配置中心从服务端读取。不要放入客户端、Git或交付包。没有增加依赖或另建账号、会员、缓存、集合。

## 服务端接线规则

1. 身份继续来自`pety-auth.verifyRequest`及其当前会话核验。回执owner仍为现有UID散列；头像仍核对pet及generationSessionId，反馈仍核对准确ticket。不接受event里的owner、bucket、endpoint、cloudPath。
2. 继续使用`pety_avatar_source_receipts`、`product_feedback_uploads`和`pet_avatar_jobs`。在其已有记录中准备`storage:{provider,bucket,key}`、`purpose`、`mime`等元数据；相关Schema字段声明需要随后准备和核验。本轮不改变Schema，也没有保存新业务记录。
3. `createPrivateObjectDescriptor`是服务端辅助函数。传入经认证的scope，随机对象路径由后端决定；新ID形式为`pety-private://oss/<随机ID>`。先写入原有回执，再签发授权。生成图只能走服务端原持久化流程，不能获取客户端上传授权。
4. `loadOwnedReceipt(event,auth,mode)`须从准确的已有记录查回owner、pet、session、用途、状态和存储定位；它不是接受客户端的对象描述。模块额外复核owner、目标Bucket和路径。迁移记录可保持旧fileId，凭可信记录中的storage定位新对象。
5. `checkTarget()`必须取得可核验的Bucket ACL、阻止公共访问、版本控制以及Bucket/Region证据，并另外检查RAM及Bucket Policy没有公共/越权授权。不得照抄本地配置返回“通过”。缺该桥时拒绝操作，匿名身份在调用该桥前被拒绝。
6. POST策略固定准确key、私有ACL、防覆盖、MIME、私有缓存头和大小：原图20MiB，反馈2MiB；默认授权300秒，且不超过回执剩余时间。不签宽目录、公开ACL或删除权。仅返回policy及单对象签名，长期Secret不返回客户端。AccessKeyId在V4 credential中出现，是协议所需标识，不等于泄露Secret。
7. OSS的`forbid-overwrite`在版本控制Enabled或Suspended时无效，因此选从未启用版本控制的专用Bucket；本模块对这两种状态都拒绝。网络中断但对象可能已写入时，先查回执/检查准确对象完成complete，不能因409改成覆盖；本轮没有接入该重试路径。[官方PostObject说明](https://help.aliyun.com/zh/oss/developer-reference/postobject)
8. `inspectObject(storage,maxBytes)`由真实SDK桥负责先限制读取字节，再复用现有PNG/JPEG解码、像素及原图质量门。返回实际bytes/mime/width/height/SHA256，不信任客户端MIME、大小或仅HEAD。`inspectUploaded`只检查及返回白名单指标；原有complete负责原子`issued→ready`、幂等与哈希记录，不另建回执系统。
9. `signGet(storage,ttl)`使用官方OSS SDK的GET V4签名，只准准确对象、HTTPS和受限有效期。模块拒绝无签名URL和签名错误/过期/跨目标响应。SDK失败返回通用错误，不返回原文或改为公开URL。[官方Node.js下载签名](https://help.aliyun.com/zh/oss/developer-reference/download-objects-using-a-presigned-url-generated-with-oss-sdk-for-node-js)
10. 模型读图保留当前`getProviderImageInputs`按已核验回执哈希读取原字节并转data URL的流程；不改变模型/Prompt。若以后需要URL，只有受认证任务的`authorizeModelJob`校验归属、用途和任务状态后才可用模型TTL（示例900秒，最大1800秒），任务排队后在实际读取前续签。授权URL在有效期内持有者均可用，不能声称绑定某个模型或能即时撤回。模型实际可读性仍待受控验证。

## 客户端与缓存接线规则

- 当前`uploadAvatarSourceImages`、反馈页仍用原`uniCloud.uploadFile`。下一轮按后端明确返回的transport选择新表单直传，失败直接报错；不得“私有失败→公开上传”。`uploadPrivateStorageFile`的204只代表对象传输成功，必须通过原complete才可提交任务或反馈。
- 调用前捕获原`captureDataScope`；注入`assertCurrent`检查账号、宠物、版本。授权、传输、complete每一步结束都复核scope，失效不持久化。
- 稳定fileId、masterId、来源关系、原图SHA/尺寸及本地缓存索引继续保留。临时URL、policy、signature只在内存用，不进入持久缓存或日志。
- `getOwnedMediaUrls`当前仍限制`cloud://`，storage.js仍调用内置存储，source/feedback回执仍校验旧路径，派生资产判断仍含旧目录假设。下一轮必须整体适配这些入口，不能仅改上传按钮。
- 新URL解析辅助支持`x-oss-date + x-oss-expires`；`avatar-display-asset.js`当前只识别旧Expires并保留旧刷新窗口，尚未接入辅助。页面沿用业务归属签名接口，不能回到平台通用`getTempFileURL`。
- 原`createAvatarFileCache`已经接受非HTTP稳定ID。本地合成PNG经原缓存写盘、重启、授权过期、离线、账号变更测试通过；不需要新增缓存。该证据不等于手机/真实OSS/2K视觉验收。

错误状态包括：DISABLED、CONFIG_INCOMPLETE、REMOTE_UNVERIFIED、TARGET_UNSAFE、LOGIN_REQUIRED、NOT_OWNED、UPLOAD_EXPIRED、INVALID_IMAGE、SIGNING_FAILED、PROVIDER_UNAVAILABLE、SCOPE_CHANGED。业务接线后显示可重试错误并保留本地照片/文字草稿，不打印签名、配置或Provider原文。

本地验证命令（不含网络复验脚本）：

```powershell
node scripts/check-private-storage-config.cjs
node --test tests/private-storage-preparation.test.cjs tests/rc-avatar-source-receipts.test.cjs tests/release-feedback-security.test.cjs tests/rc-avatar-file-cache.test.cjs
```

签名算法依据[官方POST V4说明](https://help.aliyun.com/zh/oss/developer-reference/signature-version-4-recommend)，使用本地虚构凭据与独立WebCrypto计算核对。真实OSS响应、上传协议兼容及RAM授权未验证，不能因本地签名成功宣称云端可用。
