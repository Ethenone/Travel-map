# Travel Atlas

Travel Atlas 是一个个人交通与城市探索可视化档案。主页将航空、铁路、公路、骑行和城市探索地图整合在同一个静态界面中，并提供铁路与航空统计分析。

## 示例

[Travel Atlas](https://ethenone.github.io/Travel-map/)

<p align="center">
  <a href="./docs/images/travel-atlas-overview.png">
    <img src="./docs/images/travel-atlas-overview.png" width="49%" alt="Travel Atlas 页面截图 1">
  </a>
  <a href="./docs/images/travel-atlas-example-2.png">
    <img src="./docs/images/travel-atlas-example-2.png" width="49%" alt="Travel Atlas 页面截图 2">
  </a>
</p>
<p align="center">
  <a href="./docs/images/travel-atlas-example-3.png">
    <img src="./docs/images/travel-atlas-example-3.png" width="49%" alt="Travel Atlas 页面截图 3">
  </a>
  <a href="./docs/images/travel-atlas-example-4.png">
    <img src="./docs/images/travel-atlas-example-4.png" width="49%" alt="Travel Atlas 页面截图 4">
  </a>
</p>

<p align="center"><sub>点击截图可查看原图</sub></p>

## 项目结构

```text
travel-map/
├─ index.html                  # 页面语义结构与地图容器
├─ static/css/travel-map.css  # 页面专用视觉与响应式样式
├─ static/js/travel-map.js    # 地图切换、统计表格与图表交互
├─ data/                       # 浏览器端读取的统计结果
├─ map/                        # Folium 生成的独立地图页面
├─ utils/                      # 从私人数据源生成地图和统计结果
├─ pic/                        # 航司与联盟图标
└─ testing/                    # Notebook 和交互原型
```

原始记录不属于本仓库，而是放在并列的私人目录中：

```text
../
├─ travel-map/   # 本仓库
└─ database/     # 私人 Excel、CSV、GeoJSON 和活动轨迹
```

`utils/*.py` 和根目录的生成批处理通过 `../database` 读取这些数据。网页运行时只访问已经生成的 `data/*.json` 和 `map/*.html`。

## 本地运行

在 Windows 上运行 `localtest.bat`，或在项目根目录执行：

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

然后打开 <http://127.0.0.1:8000/index.html>。不要直接双击 `index.html`，浏览器可能阻止页面读取本地 JSON 文件。

## 重新生成内容

`draw_conclusion.bat` 与 `draw_railway_route.bat` 还会依据 `stations_data.csv` 生成铁路城市/省份覆盖统计。
确保 `travel-map` 与 `database` 位于同一父目录，然后按需运行：

- `draw_connecting_lines.bat`：球面航空与铁路连接地图
- `draw_railway_route.bat`：构建 OSM 真实铁路轨迹、线路统计并生成铁路地图
- `draw_keep_route.bat`：公路与骑行轨迹地图
- `draw_city_count.bat`：中国城市探索地图
- `data/rail_area_stats.json`：城市车站覆盖率及省份的城市、车站、到访次数汇总
- `draw_shanghai_exploration.bat`：上海探索地图
- `draw_conclusion.bat`：更新 `data/charts.json` 和 `data/stats.json`

生成脚本会覆盖对应的地图或统计产物，运行前应确认私人数据表结构与脚本预期一致。

## 前端依赖

页面使用 Bootstrap、MapLibre GL JS、Leaflet/Folium、Chart.js、D3 和 ECharts。地图文件以 iframe 嵌入；铁路统计通过同源 `postMessage` 与铁路地图联动。

铁路真实轨迹首次生成时会解析 `database/railway_route/railways.geojson`，并在私人数据库目录缓存 `rail_network_v3.pkl`。以后更新乘车工作簿时会直接复用缓存。生成结果包括：

- `data/rail_routes_real.geojson`：每次铁路行程匹配后的真实轨迹与质量标记
- `data/rail_line_stats.json`：从实际经过的 OSM 轨道名称自动归纳的线路访问统计
- `map/map_rail.html`：可交互的真实铁路轨迹地图

未完整填写的工作簿“线路”表不作为统计依据。无法连通或出现明显绕行的局部区段会使用同色站点直线补齐，不在地图中额外区分。质量警告、失败区段及直线补齐清单保存在 `rail_line_stats.json`。

右侧火车统计中的“线路统计”根据实际经过的 OSM 同名轨道自动生成，包含估算覆盖度、涉及行程频率和最常乘坐的相邻车站区间。
