# 当前构建集中验收

2026-10-23，HBuilderX真实项目H5，构建round-51。18组流程、101项检查通过，135张截图；各组使用独立Edge上下文、合成TEST记录并阻断外部请求。此处的101是检查组数量，不与537项Node测试相加冒充同一种指标。

| 流程 | 检查组 | 截图 | 证据 |
|---|---:|---:|---|
| records | 7 | 14 | [实际结果](acceptance-records/results.json) |
| care | 4 | 9 | [实际结果](acceptance-care/results.json) |
| photos | 6 | 7 | [实际结果](acceptance-photos/results.json) |
| retention-2 | 5 | 8 | [实际结果](acceptance-retention-2/results.json) |
| read-errors | 10 | 9 | [实际结果](acceptance-read-errors/results.json) |
| composition | 3 | 5 | [实际结果](acceptance-composition/results.json) |
| work-save | 4 | 5 | [实际结果](acceptance-work-save/results.json) |
| record-delete | 4 | 5 | [实际结果](acceptance-record-delete/results.json) |
| daily-conflict | 4 | 5 | [实际结果](acceptance-daily-conflict/results.json) |
| draft-conflict | 3 | 5 | [实际结果](acceptance-draft-conflict/results.json) |
| care-drafts | 6 | 5 | [实际结果](acceptance-care-drafts/results.json) |
| pet-removal | 6 | 7 | [实际结果](acceptance-pet-removal/results.json) |
| archive | 7 | 13 | [实际结果](acceptance-archive/results.json) |
| settings | 6 | 7 | [实际结果](acceptance-settings/results.json) |
| album-pages | 10 | 10 | [实际结果](acceptance-album-pages/results.json) |
| insights | 6 | 10 | [实际结果](acceptance-insights/results.json) |
| pet-storage | 6 | 4 | [实际结果](acceptance-pet-storage/results.json) |
| feedback | 4 | 7 | [实际结果](acceptance-feedback/results.json) |

当前构建同时覆盖早期功能和后续共享存储修改。月份目录、照护历史、制卡冲突、照片导出等360宽度大字体截图已人工查看；自动化另检查390、412宽度及实际交互。没有把135张全部说成人工逐图审阅。

![月份目录](acceptance-records/directory-large-text-360.png)

![照护经过](acceptance-care/care-history-large-text-360.png)

![制卡冲突与保留输入](acceptance-composition/composition-conflict-360.png)

![原图部分失败后重试](acceptance-photos/export-panel-large-360.png)

## 失败记录与修正

首次[长期历史验收](acceptance-retention/results.json)在旧的“加载更多”定位上超时。当前历史页已采用分页；只更新测试脚本，通过实际下一页遍历五页，断言125个唯一来源、每页最多30条，最终[重新通过](acceptance-retention-2/results.json)。没有修改产品以迁就测试，没有覆盖失败证据。

## 指纹与边界

[最终审计JSON](FINAL-AUDIT.json)核对39组原始/当前源码指纹、7个新增源码和1份Schema；源码在[537/537本地回归](local-49/results.json)之后没有变化。首页三个锁定文件与开工基线相同。当前H5全文件清单摘要已保存，清单内被跟踪源码的git diff --check通过。

模型报告另经本地检查，六张原始图片加载、背景切换及390宽度均通过；这不代表模型质量已达标。后端未部署，真实云、Android模拟器/真机、正式签名包均未验证。App资源编译证据仍为record-delete-app-1，不等同于APK安装。后端最后两批没有前端改动。

[总交付](DELIVERY.md) · [白天集中验收](NEXT-DAY.md)
