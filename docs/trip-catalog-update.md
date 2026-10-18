# 更新行程档案

`TravelAtlasTrips.html` 是固定的页面模板；页面显示的记录来自 `data/trip_catalog.json`。修改 Excel 后，重新生成这个 JSON，再刷新页面即可，无须重新生成 HTML。

1. 更新 `../database/飞机乘坐记录.xlsx` 的 `Sheet1`、`../database/火车乘坐记录.xlsx` 的 `乘坐列表`，或 `../database/境外铁路乘坐记录.xlsx` 的 `乘坐列表`。火车车型稀有度优先读取 `火车乘坐记录.xlsx` 的 `车型列表` 工作表 D 列；仅在该表没有车型时，使用 `车型` 汇总表的数据。
2. 在 Windows 上双击项目根目录的 `update_trip_catalog.bat`。也可以在终端运行 `python utils/build_trip_catalog.py`。
3. 看到 `Wrote ... trips` 后，刷新 `TravelAtlasTrips.html`。如果网站部署在远端，还需要部署更新后的 `data/trip_catalog.json`。

首次运行若提示缺少 Python 包，执行 `python -m pip install -r requirements-trip-catalog.txt`。生成脚本会同时读取 `reference-data/airports_data.csv`、`reference-data/stations_data.csv` 与 `pic/` 下的航空公司标志。源表中没有的字段仍显示“未记录”。

页面底部的旅行成就从完整的 `data/trip_catalog.json` 自动按行程时间累计，筛选日期或类型不会重置次数。同一行程内同一车站、城市或机场只计一次；国家仅统计跨国航班的到达国家，中国的计数起点为 1，其他国家为 0。
国内火车的城市使用 `乘坐列表` 中的“上车城市”和“下车城市”列；香港的火车和飞机记录按同一座城市累计。
没有日期的行程排在列表最前面，并按源表的“序号”排列；旅行成就也将它们视为早于有日期的行程。上车、下车、起飞和到达时刻各自按源表记录显示，与是否填写日期无关。
刷新记录成就分别比较火车和飞机的历史最高值，仅在新值严格超过旧值时显示。火车速度取自 `火车乘坐记录.xlsx` 的 `速度` 列，为该段行程的平均速度。
首次打卡的序号按类别统计不同地点、公司或车型；中国作为已打卡的第一个国家预置。机型与车型的已打卡数按行程记录中的具体型号计算；飞机机型只显示已打卡数。火车车型的总数来自 `车型列表` 中各稀有度的完整车型清单，并包含仅在 `车型` 汇总表中出现的车型。

国内铁路地图使用 `data/rail_routes_real.geojson` 中已有的实际轨迹。新增或改动的行程若没有匹配轨迹，地图会绘制两端之间的示意线；需要更新实际轨迹时，再运行项目现有的 `draw_railway_route.bat`。
