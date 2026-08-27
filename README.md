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
├─ reference-data/             # 公开的机场与国内火车站基础数据
├─ data/                       # 浏览器端读取的生成统计结果
├─ map/                        # 生成的独立地图页面
├─ utils/                      # 地图与统计生成脚本
├─ pic/                        # 航司与联盟图标
└─ testing/                    # Notebook 和交互原型
```

原始记录不属于本仓库，而是放在并列的私人目录中：

```text
../
├─ travel-map/   # 本仓库
└─ database/     # 私人 Excel、CSV、GeoJSON 和活动轨迹
```

机场和国内火车站基础数据已放在仓库的 `reference-data/` 中；私人乘坐记录、大型 OSM 铁路数据及活动轨迹仍由生成脚本从 `../database` 读取。网页运行时只访问已经生成的 `data/*.json` 和 `map/*.html`。

## 本地运行

在 Windows 上运行 `localtest.bat`，或在项目根目录执行：

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

然后打开 <http://127.0.0.1:8000/index.html>。不要直接双击 `index.html`，浏览器可能阻止页面读取本地 JSON 文件。

## 路线图输入数据

仓库内的公共基础数据使用固定路径，脚本会根据自身位置查找，不依赖当前工作目录：

- `reference-data/airports_data.csv`：UTF-8；路线图实际使用 `iata`、`lat`、`lon`。
- `reference-data/stations_data.csv`：UTF-8；路线图与统计实际使用 `车站`、`经度`、`纬度`、`省`、`市`、`路局`。

私人行程文件仍放在与本仓库并列的 `../database/` 中。车站名称和 IATA 代码必须能在上述基础数据中匹配，否则对应路线会被跳过。

### 全球飞机/火车连线图

运行 `draw_connecting_lines.bat`，入口脚本为 `utils/draw_globe_routes.py`。需要以下文件和字段：

| 文件                                 | 工作表             | 必需列                | 可选列/说明                                     |
| ---------------------------------- | --------------- | ------------------ | ------------------------------------------ |
| `reference-data/airports_data.csv` | CSV             | `iata`、`lat`、`lon` | 提供机场坐标，项目已包含                               |
| `../database/飞机乘坐记录.xlsx`          | 第一个工作表          | `start`、`depart`   | `起飞`、`降落`用于显示名称；`航班号`或`航班`用于显示班次           |
| `reference-data/stations_data.csv` | CSV             | `车站`、`经度`、`纬度`     | 提供国内车站坐标                                   |
| `../database/火车乘坐记录.xlsx`          | 第一个工作表（当前为 `1`） | `上车站`、`下车站`        | `车次`用于路线提示                                 |
| `../database/境外铁路乘坐记录.xlsx`        | `乘坐列表`          | `上车站`、`下车站`        | `车次`（该表可选择性使用） |
| `../database/境外铁路乘坐记录.xlsx`        | `车站位置`          | `车站`、`lat`、`lon`   | 提供境外车站坐标（该表可选择性使用）                         |

脚本把航空路线绘制为球面最短路径，并将国内、境外铁路以站间连线加入同一张 `map/map_line.html`。

### OSM 真实铁路路线图

运行 `draw_railway_route.bat`。匹配阶段由 `utils/build_real_rail_routes.py` 完成，渲染阶段由 `utils/draw_real_railway_map.py` 完成。

| 文件                                           | 工作表/格式  | 必需字段                                                                 | 说明                                        |
| -------------------------------------------- | ------- | -------------------------------------------------------------------- | ----------------------------------------- |
| `reference-data/stations_data.csv`           | CSV     | `车站`、`经度`、`纬度`、`省`、`市`                                               | 车站坐标及地区归属                                 |
| `../database/火车乘坐记录.xlsx`                    | `1`     | 前 5 列依次为 `序号`、`日期`、`车次`、`上车站`、`下车站`；第 6 列起为按顺序排列的途经车站                | `序号`用于关联其他工作表                             |
| `../database/火车乘坐记录.xlsx`                    | `乘坐列表`  | `序号`、`日期`、`车次`、`上车站`、`下车站`                                           | 建议同时提供 `时长.1`、`里程`、`上车城市`、`下车城市`，供统计和筛选使用 |
| `../database/火车乘坐记录.xlsx`                    | `线路`    | `序号`、`线路`                                                            | `线路`作为匹配时的线路提示；留空时仍可匹配                    |
| `../database/railway_route/railways.geojson` | GeoJSON | `LineString`/`MultiLineString` 几何，属性 `railway`、`id`、`name`、`name_zh` | 仅处理 `railway=rail` 的要素                    |

首次运行会在 `../database/railway_route/rail_network_v3.pkl` 建立铁路网络缓存；仅当 `railways.geojson` 变化或使用 `--rebuild-network` 时才需要重建。输出包括：

- `data/rail_routes_real.geojson`：每次铁路行程匹配后的真实轨迹与质量标记。
- `data/rail_line_stats.json`：由实际经过的 OSM 轨道名称归纳的线路统计。
- `data/rail_area_stats.json`：城市与省份的车站覆盖统计。
- `map/map_rail.html`：可交互的真实铁路轨迹地图。

## 重新生成内容

确保 `travel-map` 与私人 `database` 位于同一父目录。仓库已经包含机场和国内火车站基础数据，然后可按需运行：

- `draw_connecting_lines.bat`：生成球面航空与铁路连接地图。
- `draw_railway_route.bat`：匹配 OSM 真实铁路轨迹、更新线路与地区统计并生成铁路地图。
- `draw_keep_route.bat`：生成公路与骑行轨迹地图。
- `draw_city_count.bat`：生成中国城市探索地图。
- `draw_shanghai_exploration.bat`：生成上海探索地图。
- `draw_conclusion.bat`：更新 `data/charts.json`、`data/stats.json` 和 `data/rail_area_stats.json`。

生成脚本会覆盖对应的地图或统计产物，运行前应确认私人数据表结构与脚本预期一致。

## 前端依赖

页面使用 Bootstrap、MapLibre GL JS、Leaflet/Folium、Chart.js、D3 和 ECharts。地图文件以 iframe 嵌入；铁路统计通过同源 `postMessage` 与铁路地图联动。

无法连通或出现明显绕行的局部铁路区段会使用同色站点直线补齐，不在地图中额外区分。质量警告、失败区段及直线补齐清单保存在 `data/rail_line_stats.json`。右侧火车统计中的“线路统计”根据实际经过的 OSM 同名轨道自动生成，包含估算覆盖度、涉及行程频率和最常乘坐的相邻车站区间。
