# Sentinel Fielddesk 公共测试版

这是一个用于独立判读样本点的静态网页测试版，当前公开的是 900 个带辅助预填类别的测试样本点。

在线地址：<https://13579x.github.io/sentinel-fielddesk-demo/sentinel_labeling_app/>

网页提供 2019–2025 年的同步影像判读界面，并支持：

- Sentinel-2 RGB、NIR-R-G 假彩色、同期高清参考影像和 NDVI 四联动查看；
- NDVI、NDWI、NDBI、NDMI 及 B03/B04/B08/B11 辅助参数；
- 林地、水田、旱地、建设用地、灌草地、水域、不确定 7 类标注；
- 已有类别直接显示并支持复核，空白人工年份可继续判读；浏览器本地保存修改，以及导出带判读结果的 CSV。

## 样本点更新

当前线上加载的是 `validation_reference_900_v1/points/interp_sheet_900_v3_assisted.csv`。辅助表的数字类别码为 `1 林地、2 灌草地、3 水田、4 旱地、5 建设用地、6 水域、0 不确定`；`src=auto` 可复核，`src=manual` 需要判读，`src=copy2021` 等待 2021 年结果复制。后续更新时，建议使用新的版本文件名或目录，同步修改 `sentinel_labeling_app/app.js` 中的 `DATA_URL`，保持字段结构不变，然后提交并推送到 `main` 分支，GitHub Pages 会自动重新发布。

当前样本点是公开测试数据；正式样本点发布前，请确认经纬度和属性信息可以公开。

## 本地运行

在仓库根目录启动任意静态 HTTP 服务，然后访问：

`sentinel_labeling_app/`
