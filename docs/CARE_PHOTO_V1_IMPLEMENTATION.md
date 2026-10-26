# 归爪问诊照片 V1 实施与验收记录

日期：2026-09-28。此文记录本地修改与实际验证，**不是云端部署或医疗效果验收证明**。

## 当前结论

- 已在现有问诊链路实现照片选择、用途纠正、真实图像请求、结构化结果、失败保留和有上限的重试；文字咨询仍走原分支。报告入口现在也可发送真实图片，而非假定旧版已经实现 OCR。
- **云端未部署，正式部署配置未核实，真机未测试。**默认 `visionEnabled: false`，需在测试空间配置后启用。
- 本次共 3 次真实 Provider 请求：2 次图片模型 + 1 次已有案例接口。没有上传私人照片，全部图片测试使用程序生成的红绿蓝色块图。
- 图片接口确实收到 `image_url` 图片块，返回 `deepseek-flash`、图中颜色描述与 usage。首次/第二次返回均被当时过严的“不可用图片不能描述任何可见内容”规则拒绝；规则已修正为允许非宠物图片说明可见内容，保存的第二次真实响应通过本地重新校验。**修复后未再发新的真实调用；完整客户端→云函数→模型→UI 仍未真实验收。**
- 旧案例 API 返回 200，但没有 `web_search_call`。已查明根因：官方 `/responses` 明确忽略内置 `web_search`。本地已修正为同一 DeepSeek 的 `/anthropic/v1/messages` 原生 `web_search_20250305`，复用 Key、任务、额度和 UI，并校验匹配的 `server_tool_use`/`web_search_tool_result`。**新搜索协议未真实调用、真实检索仍未验收**；缺少有效工具结果时返回 `WEB_SEARCH_NOT_EXECUTED`，不展示编造案例。未超过本次 3 次真实请求额度。

## 审计发现

- 根目录不存在 `GUIZHUA_CARE_PHOTO_V1_CODEX.md`；读取的是用户附件 `D:/downloads/GUIZHUA_CARE_PHOTO_V1_CODEX.md`。按用户明确范围实施，没有执行额外产品扩展。
- 当前分支 `feature/calendar-persona-auth-polish-v1`。开始时已有大量未提交修改。本次未 reset/stash/切分支/commit/push，也没有修改 `uni_modules`、首页、日历、会员或纪念功能。
- 原 `pages/chat/chat.vue` 选图后直接发送手机临时路径，只用于本地显示；模型收到的是“请补充症状或报告文字，不要声称看到图片”。没有真实图片块、上传或 OCR。
- `api_deepseek` 原文字请求通过 Chat Completions；案例复用 `/responses` + `web_search`、既有 `similar_case_search_jobs` 创建/处理/轮询任务。原结果清洗允许没有可信来源的模型案例，现已移除这一通路。
- 本地私有 `api_deepseek/config.json` 存在 Key，域名为官方 `https://api.deepseek.com`，配置模型是 `deepseek-chat`。**没有改动/输出该 Key 或私有配置。**原 `model-config.js` 将旧名字映射为 `deepseek-v4-flash`；官方当前说明旧 Flash 别名仍路由新 Flash，因此没有擅自更改普通聊天参数。新视觉分支独立使用 `deepseek-flash`。
- 仓库的宠物档案是账号隔离的本地数据，没有可供云端验证的完整宠物登记库。新分支校验真实登录，并将本地宠物 ID、会话、附件和请求绑定到该账号的命名空间；跨账号读取请求、同会话换宠物、附件宠物不符均拒绝。**这不是独立的宠物身份/实际所有权证明。**

## 文件清单（仅本次实际编辑）

| 文件 | 用途 |
| --- | --- |
| `pages/chat/chat.vue` | 原相机/报告入口连接照片草稿；结构化结果、独立案例卡、重试/状态、抑制案例抢走主结果滚动位置 |
| `pages/care/care.vue` | 就医服务里的报告/拍照入口携带用途进入原问诊页 |
| `components/CarePhotoComposer.vue` | 1–3 张选择、预览、删除、用途纠正、真实格式检查、画布重编码与大小限制 |
| `components/CarePhotoResult.vue` | 分开显示可见信息、用户描述、可能原因及缺口、就医提示、问题和局限 |
| `common/care-photo-client.js` | 登录数据作用域、照片告知、传输、草稿保存恢复、请求去重、最多一次手动重试 |
| `common/scoped-storage.js` | 在既有白名单增量登记照片草稿/用途键，保持账号隔离 |
| `uniCloud-alipay/cloudfunctions/api_deepseek/care-photo.js` | 鉴权、会话绑定、解码校验、去元数据、视觉请求、输出校验、急症优先、脱敏诊断、幂等凭据 |
| `uniCloud-alipay/cloudfunctions/api_deepseek/care-search.js` | 修复官方原生搜索协议；症状词脱敏、可信兽医来源过滤、真实来源 ID/时间/摘要范围映射 |
| `uniCloud-alipay/cloudfunctions/api_deepseek/index.js` | 新视觉/状态分支；复用现有限流；案例仅采纳检索元数据并验证工具实际执行 |
| `uniCloud-alipay/cloudfunctions/api_deepseek/config.example.json` | 独立视觉配置示例，不含 Key |
| `uniCloud-alipay/cloudfunctions/api_deepseek/package.json` | 加入 `jpeg-js`、`pngjs` 解码/重编码依赖 |
| `uniCloud-alipay/database/care_photo_requests.schema.json` | 仅服务端读写的归属/去重凭据，不存原图、描述或模型正文 |
| `tests/care-photo-v1.test.cjs` | 服务端图片、协议、安全、失败类别、额度去重、真实来源映射测试 |
| `tests/care-photo-client-v1.test.cjs` | 连点、草稿保留/恢复、旧账号/宠物响应、选择回调、独立搜索测试 |
| `tests/autonomous-chat-races.test.cjs` | 原聊天测试装载新组件依赖，保持原断言 |
| `tests/rc-data-scope.test.cjs` | 原账号隔离测试适配照片组件委托入口 |
| `tests/deepseek-web-search-v2.test.cjs` | 将旧“无链接也展示模型案例”断言改为拒绝，保留检索回归 |
| `tests/ai-i18n-reflection-v1.test.cjs` | 同步新案例清洗接口，保留纪念整理原断言 |
| `scripts/care-photo-smoke.cjs` | 显式开关控制的真实 Provider 冒烟：非敏感合成图 + 既有搜索；可仅跑图片 |
| `scripts/build-care-photo.cjs` | 使用本机 HBuilderX 工具链独立输出三端编译结果 |
| `scripts/verify-care-photo-h5.cjs` | 实际编译 H5 的文件选择和布局检查，云响应明确模拟，阻止外网 |
| 本文 | 验证边界、证据、部署与真机步骤 |

工作区其余 Git diff 不应归因于本任务。起始状态及相关旧文件备份在 `unpackage/care-photo-v1/baseline`、`status-before.txt`。

## 图片、输出与失败约定

1. 使用真实本地 JPEG/PNG。HEIC/GIF/WebP 等本版明确拒绝，不改扩展名伪装。H5 的 `getImageInfo` 不提供 `type`，已根据实际浏览器失败修复为检查原文件字节及解码。
2. 画布按平台解码后的画面重编码 JPEG，最长边 1800，质量 0.9；没有美颜、生成或补细节。平台拍摄方向，尤其 iOS/微信 EXIF 组合，**仍需真机检查**。
3. 项目每张上限 2 MiB、整组原始二进制上限 1350 KiB，为 Base64 包装后的云函数参数留余量；超过时提示分次发送，不继续压糊。云端实际解码、限制尺寸 2000，重新编码去掉 EXIF/GPS/注释。
4. 采用**鉴权请求内的 Base64 直传**，没有云桶上传、URL 下载或签名链接。由服务端接收、校验后产生标准 `image_url` data URL；不接受客户端远程 URL / fileID，因此没有任意 URL 下载和过期签名重取路径。不会把电子宠物头像发给模型。
5. 原图只在调用过程中位于内存；本地账号隔离草稿在失败后保留，成功/删除附件时清除。云端仅保存哈希、会话绑定、调用状态和扣额授权。客户端历史保留观察文字和本地图片引用；平台清理临时文件后历史大图可能不可用，观察结果仍保留。草稿保存了重编码数据，H5 刷新已验证可恢复；App/小程序恢复未真机验证。
6. 结果严格区分每张图用途/质量、可见信息、用户输入、最多三项可能原因及证据缺口、紧急程度、最多三个问题、局限。缺字段/截断/空内容/错误 JSON 不补写低风险。
7. 后端固定就医文案；当前危险描述优先于模糊照片。规则区分否定与历史句，但只是有限警示规则，需兽医审核，不能宣称完整分诊或医疗准确性。输出校验拒绝处方剂量、概率、确诊保证等，不能保证覆盖所有自然语言变体。
8. 现有问诊额度复用；不会动形象生成额度。一个明确失败可手动再请求一次，复用扣额授权；超时/未知结果不自动重放。Provider 失败也可能产生用量。成功正文不在云端缓存：若响应丢失，状态只能确认已完成，不能从云端恢复该正文。
9. 案例独立加载，只发送固定词表提取的种类/部位/症状，不传图片、地址、姓名电话或完整聊天。当前严格筛选 Cornell/VCA/MSD/Merck/AVMA 等公开兽医资料，统一标为兽医科普；不冒充确诊个体病例。标题、URL、sourceId 与时间由真实检索元数据构建，不接收模型编写的案例正文/URL。未核实个体、日期、结果明确写未知；不抓取正文或病例图片。

## 真实调用证据

| 调用 | 实际结果 |
| --- | --- |
| 图片 1 | `deepseek-flash`，1 张色块 PNG，finish=stop，prompt 583 / completion 192 / total 775；当时校验拒绝 |
| 图片 2 | `deepseek-flash`，1 张色块 PNG，finish=stop，prompt 583 / completion 156 / total 739；识别红绿蓝色块且没有宠物画面 |
| 图片 2 Provider ID | `8b59d492-2e56-490b-a4a4-79077b8caec3`；保存响应在修正校验后本地通过，没有第四次调用 |
| 案例接口 | `/responses` + `web_search`，HTTP 200，requestId `d7b8f70b-6df3-4f6e-a31c-8a7464da3121`，input 39 / output 650 / total 689；**webSearchExecuted=false，没有可靠案例** |

证据在 `unpackage/care-photo-v1/`：`real-smoke.log`、`real-smoke.json`、`real-smoke-recheck.log`、`synthetic-provider-response.json`、`real-response-revalidated.json`。最初 smoke 记录中的搜索 `ok=true` 只代表旧脚本 HTTP 判定；必须结合 `webSearchExecuted=false` 看，不能作为检索成功。脚本已修正成功判据。

## 自动验证与界面验证

相关 11 个测试文件共 **66 项通过**，覆盖原文字/纪念提示词、模型配置、任务状态、账号竞态、新原生搜索协议及新增照片链路。没有将这些 mock 单测当成服务接通。

```powershell
node --test tests/care-photo-client-v1.test.cjs tests/care-photo-v1.test.cjs tests/ui-script-syntax-v1.test.cjs tests/api-deepseek-model-config.test.cjs tests/api-deepseek-persona-builder.test.cjs tests/api-deepseek-product-support-v1.test.cjs tests/autonomous-chat-races.test.cjs tests/deepseek-web-search-v2.test.cjs tests/async-jobs-v3.test.cjs tests/rc-data-scope.test.cjs tests/ai-i18n-reflection-v1.test.cjs
git diff --check
```

`git diff --check` 实际返回 0。HBuilderX 本机版本编译器 5.26（Vue3），H5、App、微信小程序构建通过。微信构建仍提示既有 `auth-capabilities.js` 的鸿蒙平台检测兼容警告，本次未扩展修改。

H5 采用实际编译页面、本地 Edge 390×844，并检查 320/390/430 宽度：真实选本地测试图片、Canvas 重编码、选图不自动发送、用途纠正、失败留图留文字、刷新恢复同一宠物草稿、重试、结果分区、案例失败独立、输入区不遮挡底部导航。**该 UI 检查模拟云响应、阻止外网；不是 H5 的真实云端端到端验证。**

- `unpackage/care-photo-v1/h5-ui-evidence.json`：界面检查记录。
- `h5-draft-mocked.png` / `h5-error-mocked.png` / `h5-result-mocked.png`：截图，其中结果是已保存真实模型响应经模拟传输展示。
- Android/iOS 真机、微信真机的相机权限、拍摄方向、长图报告清晰度、后台恢复、网络上传超时：**未验证**。
- 医疗样本准确性、兽医审核：**未验证/未完成**。

## HBuilderX 部署与真机步骤

1. 打开当前项目路径 `C:/Users/杜冲/Documents/Codex/2026-05-12/files-mentioned-by-the-user-pety/pety`。保留其他工作区改动。将 `uniCloud-alipay` 关联到你要测试的**测试空间**；本次没有创建或部署任何空间。
2. 在 `uniCloud-alipay/database` 右键上传新增 `care_photo_requests.schema.json`。确认测试空间已有 `deepseek_rate_limits`、`similar_case_search_jobs` 以及官方登录所需集合；本次没有修改已有案例 schema。新凭据集合客户端读/写均禁止，不需要公开任何云存储桶。
3. 在私有 `api_deepseek/config.json` 的 `deepseek` 对象中增量加入下面四项，保留 Key、域名、文字模型和原额度。不要整份覆盖配置，也不要把 Key 粘贴到聊天或提交 Git。

   ```json
   "visionEnabled": true,
   "visionModel": "deepseek-flash",
   "visionMaxTokens": 1800,
   "visionRequestTimeoutMs": 40000
   ```

4. 需要重新部署的是 **`api_deepseek` 云函数及其依赖**。HBuilderX 右键该函数上传部署，按工具界面安装依赖，确保 `jpeg-js@0.4.4`、`pngjs@7` 与原 `pety-auth` 可用；如果测试空间没有当前公共 `pety-auth`/官方 `uni-id-common`，先上传所需公共模块。本地离线 npm 缓存缺包，本次测试复用了仓库已有相同解码依赖；云端安装必须实际成功。函数声明已有 150 秒上限，本次视觉 Provider 超时封顶 45 秒，客户端调用设置 60 秒；平台实际执行限制仍需部署后核实。
5. 当前 `.hbuilderx/launch.json` 为支付宝云，App/H5 配置调用云端，默认配置调用本地。真机前在 HBuilderX 确认选中的是刚部署的**测试空间云函数**，避免以为本地编辑已经上传。
6. Android/iOS：连接手机，开启相应调试并授权，在“运行 → 运行到手机或模拟器”选择设备，安装/运行基座。使用真实测试账号登录，选择一只在世宠物，进入“问诊 → 相机/照片”；也可从“就医服务 → 拍照问诊/报告解读”进入。H5 可先“运行 → 运行到浏览器”复查。
7. 微信：先确认项目 AppID 和开发者工具环境可用；“运行 → 运行到小程序模拟器 → 微信开发者工具”，再从开发者工具进入“真机调试”。**小程序编译成功不代表手机图片权限、网络或云函数已接通。**
8. 首先同意照片处理告知，用获得许可、无个人信息的真实照片测试：一张直接发送；再测试两/三张、预览删除重选、相册/相机、报告用途改回患处。检查报告前遮去姓名、手机号等；用清楚可核对的数值验证没有臆造。不要使用电子宠物形象替代患处图。
9. 检查返回是否按图编号区分可见情况/可能原因/不确定性/就医提示。再试模糊、非宠物和混合图；输入“现在呼吸困难”应先看到急诊提示，照片不清楚不能覆盖它；“以前……已经恢复”“没有……”不应等同于当前急症。后台/切宠物/切账号后检查无串图，补文字不应被当成本次新图。
10. 断网或关闭视觉配置测试失败：图和文字保留，连点只发一个请求。未知结果先“检查状态”，不要反复新建请求。案例区当前可能提示未执行搜索；这不会吞掉已显示的照片结果。要核实搜索接通，必须在云日志中看到 `webSearchExecuted: true`，来源卡有真实 sourceId、URL 与检索时间。
11. 云控制台用页面请求编号定位 `care_photo_provider` / `care_photo_error`。查看 requestedModel、returnedModel、imageCount、finishReason、usage、Provider requestId；不要记录请求 event、Base64 或完整私人描述。搜索看 `similar_case_provider_normalized` 和 `similar_case_final_decision`，不能仅凭 HTTP 200 判断。
12. 关闭功能：将私有配置 `visionEnabled` 设为 `false` 后重新部署 `api_deepseek`。页面会明确提示照片分析未开启；删除附件后原文字咨询照常使用，报告可继续手工补充文字。关闭不伪装成已看过照片。

真实 Provider 脚本（从项目根目录 PowerShell 运行，有真实用量，默认最多两次请求）：

```powershell
$env:PETY_RUN_CARE_PHOTO_SMOKE = 'true'
node scripts/care-photo-smoke.cjs --vision-only  # 1 次图片；省略参数会再测一次现有案例 API
Remove-Item Env:PETY_RUN_CARE_PHOTO_SMOKE
```

它从本地私有配置读取 Key，生成无私人信息的色块图，搜索部分已更新为修正后的 Messages 协议，**不验证 uniCloud 登录、数据库部署或患处医疗判断**。不要在未看清返回类别前循环重试。本次保存的搜索实测证据属于修复前的 Responses 请求，新协议只有本地测试，不能混为一谈。

## 一手依据

- [DeepSeek Vision](https://api-docs.deepseek.com/guides/vision/)：图像块、支持格式、原始细节。
- [模型能力及旧别名](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/)；[更新日志](https://api-docs.deepseek.com/updates/)。
- [思考模式](https://api-docs.deepseek.com/zh-cn/guides/thinking_mode/)；[JSON 输出限制](https://api-docs.deepseek.com/zh-cn/guides/json_mode/)。
- [Responses API 忽略内置搜索工具](https://api-docs.deepseek.com/guides/responses_api/)；[官方原生搜索说明](https://api-docs.deepseek.com/quick_start/agent_integrations/claude_code/#using-web-search-in-claude-code)；[DeepSeek 官方搜索 Provider 参考实现](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/web/web-search-deepseek/src/provider.ts)。
- [uniCloud 调用参数大小](https://doc.dcloud.net.cn/uniCloud/cf-callfunction)。
- [Cornell：呼吸困难](https://www.vet.cornell.edu/departments-centers-and-institutes/cornell-feline-health-center/health-information/feline-health-topics/dyspnea-difficulty-breathing)、[猫下泌尿道疾病](https://www.vet.cornell.edu/departments-centers-and-institutes/cornell-feline-health-center/health-information/feline-health-topics/feline-lower-urinary-tract-disease)、[猫癣需鉴别检查](https://www.vet.cornell.edu/departments-centers-and-institutes/cornell-feline-health-center/health-information/feline-health-topics/ringworm-serious-readily-treatable-affliction)。
- [Merck：犬猫急症](https://www.merckvetmanual.com/special-pet-topics/emergencies/what-to-do-in-a-dog-or-cat-emergency?mredirectid=5124)。
