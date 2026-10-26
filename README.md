# 米其林全球名录

全球约 2 万家米其林餐厅的中文名录：三星、二星、一星、必比登推介和入选餐厅。

网址：https://sparrowcinema.github.io/michelin-guide/

| 三星 | 二星 | 一星 | 必比登 | 入选 | 合计 |
|---|---|---|---|---|---|
| 161 | 544 | 3,175 | 3,744 | 12,097 | 19,721 |

## 能做什么

- **手机 App 版**：手机上底部有“名录 / 地图 / 附近 / 我的”四个标签，筛选条件收进底部弹出的面板。可以“添加到主屏幕”，从桌面图标全屏打开；页面和数据会缓存，没网也能查名录（地图除外）。
- **我的**：想去、去过两份清单，按最近标记或按地区排列；统计去过的国家、城市和星级；可以导出、导入清单备份，切换浅色/深色主题。

- **筛选**：按等级、大洲、国家、城市逐级筛选，也可以搜店名、城市或菜系。“更多筛选”里还有菜系、价位、绿星、本版新上榜、今年升级、也上了黑珍珠，以及自己标记的“我想去”“我去过”。
- **地图**：切到“地图”查看当前筛选结果的分布，地图下方列出当前范围内的餐厅。中国境内用高德底图，其他地区用 OpenStreetMap / CARTO 底图。
- **离我最近**：允许定位后，按离你的距离排序。
- **分享筛选结果**：筛选条件会写进网址，点“复制筛选链接”发给别人，对方打开看到的是同样的结果。
- **每家店**：中文店名、菜系、价位，以及米其林介绍页、地图（中国内地用高德，其他地区用谷歌地图）、餐厅官网的链接，还有“想去”“去过”和“纠错”按钮。
- **标签**：新上榜、新摘星、升星、连续 N 年同一等级、绿星、黑珍珠钻级。
- **说明页**：讲清各等级的含义、米其林怎么评，以及黑珍珠是什么。

## 数据来源

- 餐厅名单、等级、地址、坐标、官网：米其林指南官网的公开数据，经开源项目 [michelin-my-maps](https://github.com/ngshiheng/michelin-my-maps) 汇总，这一版取自 2026 年 10 月 3 日的快照。
- 官方中文名：米其林指南中文官网（简体、香港繁体、台湾繁体版）。其他国家星级餐厅的“译名”是参考译名。
- 历年记录：michelin-my-maps 每年一份的历史快照（2022 至 2025 年，各取一份完整的），和当前名单逐家对比。
- 黑珍珠：2026 黑珍珠餐厅指南的公开报道和名单，只对照了中国内地、而且必须是同一家分店。二钻、三钻是完整的；一钻没有公开的完整名单，目前只覆盖了杭州、深圳的完整名单、全国新上榜的店和报道里提到的店。
- 各国指南发布时间不同，米其林也会随时撤下歇业的店，去之前请在米其林指南 App 核对。

## 文件

- `index.html`：页面。需要和 `data.json` 放在同一目录，经网页服务器打开（例如 GitHub Pages）。地图组件 Leaflet 在第一次打开地图时从 cdnjs 载入，失败时依次改用 jsDelivr、unpkg。
- `data.json`：全部餐厅数据。
- `og.png`、`icon.svg`、`icon-192.png`、`icon-512.png`、`icon-maskable.png`、`apple-touch-icon.png`：分享卡片图和图标。
- `manifest.webmanifest`、`sw.js`：添加到主屏幕所需的应用信息，以及离线缓存。
- `tools/build.py`：从 michelin-my-maps 的 CSV 生成 `data.json`，用法见文件开头。
- `tools/history.py`：从历年快照生成 `tools/history.json`（每家店每年的等级）。
- `tools/zh_official_names.json`：米其林中文官网的官方中文名（按米其林网址里的餐厅标识对应）。
- `tools/reference_translations.tsv`：星级餐厅的参考译名。
- `tools/cn_mainland_curated.json`：中国内地各指南发布时的中文名单，用来标出本版新上榜的餐厅。
- `tools/black_pearl_2026.json`：能对上米其林的 2026 黑珍珠餐厅（米其林网址 → 钻级）。

## 更新数据

```sh
# 1. 取最新的 michelin_my_maps.csv，以及一年前的快照（用 git 历史）
# 2. 生成历年记录
python3 tools/history.py michelin_my_maps.csv tools/history.json snap2022.csv snap2023.csv snap2024.csv snap2025.csv
# 3. 生成 data.json
python3 tools/build.py michelin_my_maps.csv tools/cn_mainland_curated.json data.json \
    tools/zh_official_names.json tools/reference_translations.tsv \
    tools/history.json tools/black_pearl_2026.json 2026-10-03
```

本项目与米其林、黑珍珠官方无关，仅供个人查阅。
