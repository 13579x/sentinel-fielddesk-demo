# Sentinel Fielddesk 公共测试版

这是一个用于独立判读样本点的静态网页测试版，当前公开的是 900 个测试样本点。

在线地址：<https://13579x.github.io/sentinel-fielddesk-demo/sentinel_labeling_app/>

网页提供 2019–2025 年的同步影像判读界面，并支持：

- Sentinel-2 RGB、NIR-R-G 假彩色、同期高清参考影像和 NDVI 四联动查看；
- NDVI、NDWI、NDBI、NDMI 及 B03/B04/B08/B11 辅助参数；
- 林地、水田、旱地、建设用地、灌草地、水域、不确定 7 类标注；
- 浏览器本地保存判读进度，以及导出带判读结果的 CSV。

## 样本点更新

后续更新时，替换 `validation_reference_900_v1/points/interp_sheet_900.csv`，保持字段结构不变，然后提交并推送到 `main` 分支，GitHub Pages 会自动重新发布。若点位批次发生变化，建议把数据目录改成新的版本目录（例如 `validation_reference_900_v2`），并同步修改 `sentinel_labeling_app/app.js` 中的 `DATA_URL`；这样可以避免浏览器沿用上一批样本的本地标注缓存。也可以在网页底部点击“清除本机标注缓存”。

当前样本点是公开测试数据；正式样本点发布前，请确认经纬度和属性信息可以公开。

## 本地运行

在仓库根目录启动任意静态 HTTP 服务，然后访问：

`sentinel_labeling_app/`
