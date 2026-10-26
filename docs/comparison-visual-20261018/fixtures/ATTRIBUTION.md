# 隔离 TEST 照片

- 室内猫照：复用用户已授权的 unpackage/visual-v2-20260928/fixtures/authorized-photo.png。来源是 tests/fixtures/user-cat-reference.jpg 的既有相册界面裁除版（见 docs/DUAL_MODE_VISUAL_REWORK.md）；本轮未改图。
- 花园花照：scikit-learn 官方仓库 [flower.jpg](https://github.com/scikit-learn/scikit-learn/blob/main/sklearn/datasets/images/flower.jpg)，原摄影账号 [vultilion](https://www.flickr.com/photos/vultilion/6056698931/)，按仓库 [README](https://github.com/scikit-learn/scikit-learn/blob/main/sklearn/datasets/images/README.txt) 的 CC BY 2.0 授权使用。README 的 attribution 行写 danielbuechele、对应链接指向 vultilion；这里同时保留仓库原文 LICENSE-sample-images.txt 和原链接，未改动下载图像。
- 两张为视觉差异明显的测试场景：室内纵向猫照、花园横向花照。两张拍摄时间均标为未知；不以下载时间、文件时间或记录创建时间代替事件时间。TEST 图文不声称同一宠物真实经历。
- 仅通过独立浏览器 TEST 宠物/IndexedDB 使用；不写入真实用户资料，不打包进正式 static 资源。
- 曾尝试获取 Wikimedia CC0 狗照，服务限流，未取得或使用该照片。最终采用上面的已授权花照。
