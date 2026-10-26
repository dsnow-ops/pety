# Hero 真实链路修复记录 — 2026-09-17

## A. 根因与主路线

本轮检查的是当前手机真实宠物 `pet_1789635825894_1rwyr5`，已确认工作台任务 `11daafb8-0b72-4902-b61f-5f123ad07c8e`。没有用 fixture、演示猫图或 ImageGen 结果替代它。

1. **真实旧任务执行了，但没有产出合格透明资产。** 旧 Wan 任务 `489a30be-196c-467d-a5e9-e6f932e5da05` 返回成功，下载实际结果后发现洋红背景带密集黑色纹理。生产质量门槛拒绝它，错误为 `HERO_TECHNICAL_BACKGROUND_INVALID` / `ALPHA_BUILD_FAILED`。没有合格 Hero 文件时，selector 回退 final 是正确行为。之前本地透明图没有成为这个真实任务的已保存资产，所以不能解决真机问题。
2. **首页恢复链路存在中断。** `runPendingAvatarAssetRefresh` 对 `const pet` 再赋值，异常被捕获后没有继续；本地缓存 FAILED 后又不查询云端终态，云端修复无法被首页接收。现在按 petId、master、请求序号隔离异步结果，并重新同步终态。
3. **透明文件成功后仍可能卡在 URL 层。** 本次真实回归又出现 `URL_UNAVAILABLE`，原逻辑长期屏蔽加载失败 URL。新增校验归属的云端签发接口、30 秒负缓存和强制刷新重试，诊断明确显示 URL 来源及失败原因。

旧截图的 Mongo `CANNOT_CREATE_FIELD` 属于向 null 元数据写入嵌套字段的问题；不能笼统归因为缺少 DBSchema。对象替换写入修复继续保留。

采用**路线 A：Wan 工作台 + 独立 Hero 任务**。Hero 请求仅做已确认 master 的背景替换，保留宠物身份和姿势；随后生产代码移除技术底色、清理边缘污染、按 alpha 收紧边界，保存真正含透明像素的 PNG。不是仅在 prompt 里写“透明”，也不是把矩形图做羽化。VIAPI 当前未配置可用凭据，不作为本轮主路线。

## B. 本轮文件与职责

以下是本轮直接修改/新增的重点文件；工作区另外存在此前未提交改动，未清理或重置。

| 文件 | 作用 |
|---|---|
| `uniCloud-alipay/cloudfunctions/api_pet_avatar/hero-character-prompt.js` | Hero 改为单一背景编辑任务，避免混合重绘要求污染结果 |
| `uniCloud-alipay/cloudfunctions/api_pet_avatar/hero-recovery-policy.js` | 仅对已知旧底色质量失败补跑一次；不重提运行中、配额失败或结果不明的任务 |
| `uniCloud-alipay/cloudfunctions/api_pet_avatar/index.js` | 原子抢占与恢复、提交回执二次保存、同任务轮询恢复、终态回写、归属校验的显示 URL 接口 |
| `uniCloud-alipay/cloudfunctions/api_pet_avatar/avatar-display-derivatives.js` | 清理轮廓近旁洋红污染，保留 alpha 形状及内部鼻子/耳朵颜色 |
| `uniCloud-alipay/cloudfunctions/api_pet_avatar/storage.js` | 透明文件用内容哈希命名，避免修复后命中旧缓存 |
| `uniCloud-alipay/database/pet_avatar_jobs.schema.json` | 补充任务恢复、调用历史、prompt revision、轮询失败计数字段 |
| `common/avatar-display-asset.js` | 归属校验的云端 URL 解析、短期失败缓存、强制刷新恢复、URL 来源诊断 |
| `common/pet-avatar-generator.js`、`common/pet-store.js` | 不吞掉任务错误；传递、保存请求 ID 和 prompt revision |
| `pages/home/home.vue` | 修复异步中断和旧终态；记录真实 image load；增加云端 URL 来源诊断 |
| `components/PetAvatarHero.vue` | 仅在当前资源真实加载成功时发出回执，旧宠加载事件不能冒充成功 |
| `scripts/verify-hero-live-evidence.cjs` | 比较实际云记录、下载 PNG、真实手机 pet 与加载回执；不生成、不注入资源 |

测试修改：`tests/avatar-tight-hero-races.test.cjs`、`tests/autonomous-avatar-races.test.cjs`、`tests/avatar-display-consistency-v2.test.cjs`、`tests/hero-provider-submission-v2.test.cjs`、`tests/user-cat-hero-pipeline.test.cjs`、`tests/async-jobs-v3.test.cjs`；新增 `tests/hero-recovery-e2e.test.cjs`。

`vite.config.js` 在验证过程中遭到截断和误输入，已经恢复为原完整内容，最终无内容差异。没有修改真实 `config.json`、Base Prompt 或 `uni_modules`，没有 commit/push/reset/stash。

## C. 真实资产与验收条件

资源路径：已确认 `final.png` → 独立 Wan Hero 任务 → 生产透明处理函数 → 同一 pet/job 目录下 `hero-character-7c808f536757.png` → 云数据库 `heroFileId` / `heroMetrics` → 手机当前 pet → 首页独立 Hero selector → 实际 image load。

本轮对已有失败任务执行了一次受控修复：真实调用新 Wan 任务，将回执绑定回同一个已确认 master，再由生产处理函数保存云端资产。没有重放上传照片或重新生成 master，没有修改手机缓存来伪造展示成功。新任务自动提交的去重及异常恢复另有行为测试覆盖。

真实优先级：

`合格 hero-native-tight > 合格 cutout-tight > 合格 local-cutout-tight > 合格 viapi-cutout > 合格 local-cutout > 已确认高清 final > placeholder`

每份透明资源还必须满足相同 master 归属、尺寸、真实 alpha、主体连通性、边界与留白质量。thumbnail 和 feathered 方块图不参与首页角色优先级。`hero-native-tight` 是现有选择器名称；本次真实来源为 `wan_chroma_technical`，不宣称 Wan 原生输出了 alpha。

| 验收项 | 当前目标/已核验资产值 |
|---|---|
| HERO SOURCE / sourceType | `hero-native-tight` |
| CUTOUT / HERO JOB / phase | `SUCCEEDED` / `SUCCEEDED` / `COMPLETE` |
| fallbackReason | 空字符串，诊断显示 `NONE` |
| URL RUNTIME | `cloud`，由已部署云函数签发 |
| FILE hash | `19f38d69` |
| PNG 尺寸 / 字节 | `1493 × 2009` / `4,053,999` |
| 真实 alpha | 四角透明，alphaCoverage `0.49513058617333855`，qualified `true` |
| SHA256 | `7c808f53675781154a435ac76cb2dcbb9946e7ffa671e85ee3d40c27cfefe560` |
| 首页 | 猫的轮廓外透出页面背景，角色突出卡片上沿，不显示暖灰矩形底 |
| 工作台 | 保留高清 master，固定正方形舞台、aspectFit，不拿透明 Hero 替代审阅主图 |

标准坐姿由独立 `avatar-composition-contract.js` 覆盖首次、重新生成和 revision；参考图只提供身份，要求完整坐姿和安全留白。Base Prompt 不变。本轮复用了真实已确认坐姿 master，没有额外付费重新生成 master，因此不把“所有任意参考图都能百分之百服从坐姿”当作已验证事实。

## D. 验证状态

- 自动回归：`node --test tests/*.test.cjs tests/*.test.mjs`，**92/92 通过**。
- Android：HBuilderX 5.24 Vue3 最终编译通过（7397ms），手机同步、启动成功。
- `git diff --check`：通过。
- Base Prompt：length **1705**；SHA256 **d4bc2b10df557435b9386d9b015cde348b9a4ff9da90d80f06dc08b40fa3a378**。
- `api_pet_avatar` 已上传真实 alipay 云空间；临时本地维护函数从云函数目录删除，未部署公共维护接口。
- 本地证据存放于忽略目录 `unpackage/hero-e2e/`。其中 cloud-record、原始 provider 返回和临时 URL 不作为公开报告附件；公开引用仅使用截图及不含凭据的核验摘要。

**最后收口状态：成功。** 北京时间 19:17，最终版本已在当前真实 Android 宠物首页显示透明角色。五连点同时证明 `hero-native-tight`、`cloud`、`SUCCEEDED`、`COMPLETE`、`NONE`；实际加载回执的文件哈希为 `19f38d69`。云端文件下载的 SHA256、数据库记录、手机当前 pet、selector 输出及真实 image load 五者一致。

`node scripts/verify-hero-live-evidence.cjs` 于 `2026-09-17T11:17:37.790Z` 通过。证据为 `unpackage/hero-e2e/verified-evidence.json`、`device-home-final.png`、`device-debug-final.png`。最终残边修复复用了同一个已成功 provider 输出，仅重新做 CPU 处理和云存储保存，没有增加生图请求。已验证换成新内容哈希文件后手机也同步更新，而非继续展示旧缓存。

## E. 真实调用记录

| 类型 | 次数 | 目的与结果 |
|---|---:|---|
| Wan `wan2.7-image-pro` 新生成 | **1** | 当前真实 master 的独立背景替换；成功，输出 1 张，已处理保存并由手机加载 |
| VIAPI / 其他分割服务 | **0** | 当前无可用配置，本轮未调用 |
| 其他图片模型 / ImageGen | **0** | 没有使用演示生成替代真实链路 |

Wan 提交时间：`2026-09-17T10:31:17.877Z`；taskId：`8e02698d-c7e9-436c-970e-8b3098773fc7`；requestId：`f458e84b-a468-9dac-80a6-ee4be8efe09c`。这是**真实可计费请求**，image_count 为 1；实际扣余额还是免费额度、具体金额尚未核对账单，不能宣称零费用。其余 GET 状态查询、云存储读写和本地 CPU 处理不是新增生图调用。

剩余边界：生成式背景编辑仍存在身份细节漂移风险，质量门槛无法证明身份百分之百不变；本轮真实验证设备为已连接 Android，未验证 iOS。未来失败仍保留明确错误与高清 master 回退，不把回退显示标记为角色生成成功。
