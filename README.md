# Travel Atlas

Travel Atlas 是一个个人交通与城市探索可视化档案。主页将航空、铁路、公路、骑行和城市探索地图整合在同一个静态界面中，并提供铁路与航空统计分析。

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

确保 `travel-map` 与 `database` 位于同一父目录，然后按需运行：

- `draw_connecting_lines.bat`：球面航空与铁路连接地图
- `draw_railway_route.bat`：铁路路线地图
- `draw_keep_route.bat`：公路与骑行轨迹地图
- `draw_city_count.bat`：中国城市探索地图
- `draw_shanghai_exploration.bat`：上海探索地图
- `draw_conclusion.bat`：更新 `data/charts.json` 和 `data/stats.json`

生成脚本会覆盖对应的地图或统计产物，运行前应确认私人数据表结构与脚本预期一致。

## 前端依赖

页面使用 Bootstrap、Leaflet/Folium、Chart.js、D3 和 ECharts。地图文件由 Folium 生成并以 iframe 嵌入；铁路统计通过同源 `postMessage` 与铁路地图联动。
