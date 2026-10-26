# 宠物形象生成停滞修复 — 2026-10-22

## 根因及修复

两个现有模型任务均已生成成功。实际结果域名 `dashscope-7c2c.oss-accelerate.aliyuncs.com` 不在云端下载允许列表内，导致下载返回 INVALID_RESULT_URL；状态接口将其保留为 RESULT_SAVE_PENDING，界面持续等待。另有页面返回前台只恢复轮询、未恢复进度定时器的问题。

- safe-download.js 只增加实测结果的精确域名，保留 HTTPS、DNS、公网地址、重定向和大小检查。
- 客户端区分生成与保存状态；保存重试 4 次后提示“检查已有结果”，保留原任务。成功状态优先于历史错误码。
- 页面回到前台恢复进度计时和状态轮询。

## 已授权部署与真实恢复

用户明确授权上传至既有 ali01 并恢复两项已有任务，不重新生成。

- 上传前远端备份：`unpackage/release-sprint-20261013/cloud-private/2026-10-22T07-13-14-714Z-api_pet_avatar`。
- 官方 HBuilderX CLI 上传 api_pet_avatar 成功；上传后回读：`unpackage/release-sprint-20261013/cloud-private/2026-10-22T07-19-59-129Z-api_pet_avatar`。
- 比较远端前后 30 个文件，唯一差异为 safe-download.js；线上与本地修复一致，配置内容未变化。
- 原手机任务 `fb44efd2-ee48-43f5-ab65-39c970909381` 和原 Web 任务 `8dc6a5ad-99f4-4517-af47-14b814d9f2d0` 的 active/candidate 记录均 SUCCEEDED，resultStoragePending=false，generatedFileId 已存在。
- 两张已有 PNG 均实测为 2048×2048。恢复过程中未调用 createJob 或新模型生成。
- Web 原页面真实显示“形象工作台”、猫咪图片及 1/3 次，见 web-restored.png。
- Android 真实手机曾显示形象工作台；随后本地宠物 avatarStatus=ready，文件对应原任务，首页图片 naturalWidth/naturalHeight 均 2048，见 android-home-restored.png。再次进入生成入口显示选图页，未点击再次生成。

## 回归验证

- 6 项客户端定向回归通过：来源校验、保存重试上限、前后台恢复、历史错误码成功优先、轮询网络恢复及失效响应保护。
- 安全下载、下载生命周期、额度恢复和 UI 语法共 23 项通过。
- 实际 localhost:5173 uni-app H5，隔离 TEST 宠物、禁止外部请求，注入保存失败状态。360/390/412 下保存提示、失败提示、点击恢复原任务、无横向溢出均通过，无 pageerror。证据 h5-1/results.json 及截图。
- 最终 H5 构建通过：unpackage/avatar-generation-recovery-20261022/build-final。
- 本轮没有重新触发付费模型生成，没有正式 App 安装包发布。Android 保存失败重试分支未另行真机故障注入，实际成功恢复已验证。

复验命令：
```
node scripts/verify-avatar-save-recovery-h5.cjs <新证据目录名>
node --test --test-name-pattern "result save|returning from background|poll outages|successful polls|source validation|successful saved" tests/rc-avatar-auth-recovery.test.cjs
node --test tests/release-safe-download.test.cjs tests/release-download-lifecycle.test.cjs tests/rc-avatar-quota-integration.test.cjs tests/ui-script-syntax-v1.test.cjs
```
