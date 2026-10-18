"""Build the cycling density map without touching the road or railway maps."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from string import Template

import polyline


CITY_VIEWS = [
    ("上海", 31.0800, 121.4300, 10),
    ("佛山", 22.8919, 112.8690, 11),
    ("舟山", 29.9044, 122.4075, 12),
    ("太原", 37.8097, 112.5685, 12),
    ("六安", 31.8837, 116.5219, 11),
    ("香港", 22.3027, 114.1772, 11),
]


def distance_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lon1 = map(math.radians, a)
    lat2, lon2 = map(math.radians, b)
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    value = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 6371.0088 * 2 * math.asin(min(1.0, math.sqrt(value)))


def sample_route(points: list[tuple[float, float]], spacing_km: float = 0.65) -> list[list[float]]:
    """Use equal-distance samples so polyline encoding density does not skew heat."""
    if not points:
        return []
    samples = [[round(points[0][0], 5), round(points[0][1], 5)]]
    traveled = 0.0
    next_sample = spacing_km
    for start, end in zip(points, points[1:]):
        length = distance_km(start, end)
        if length < 0.00001:
            continue
        while next_sample <= traveled + length:
            fraction = (next_sample - traveled) / length
            samples.append([
                round(start[0] + (end[0] - start[0]) * fraction, 5),
                round(start[1] + (end[1] - start[1]) * fraction, 5),
            ])
            next_sample += spacing_km
        traveled += length
    final_point = [round(points[-1][0], 5), round(points[-1][1], 5)]
    if samples[-1] != final_point:
        samples.append(final_point)
    return samples


def build_data(activities: list[dict]) -> dict:
    routes: list[list[float]] = []
    paths: list[list[list[float]]] = []
    starts: list[list[float]] = []
    ends: list[list[float]] = []
    connections: list[list[list[float]]] = []
    count = 0
    for activity in activities:
        encoded = activity.get("summary_polyline")
        if not encoded:
            continue
        points = polyline.decode(encoded)
        if len(points) < 2:
            continue
        count += 1
        sampled = sample_route(points)
        routes.extend(sampled)
        paths.append(sampled)
        starts.append([round(value, 5) for value in points[0]])
        ends.append([round(value, 5) for value in points[-1]])
        connections.append([starts[-1], ends[-1]])
    return {
        "routes": routes,
        "paths": paths,
        "starts": starts,
        "ends": ends,
        "connections": connections,
        "count": count,
        "cities": CITY_VIEWS,
    }


PAGE = Template(r"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Travel Atlas · 骑行热力图</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@1.9.3/dist/leaflet.css">
  <style>
    html,body,#map{margin:0;width:100%;height:100%}
    body{font-family:Inter,"Microsoft YaHei",system-ui,sans-serif;background:#f1f4f3}
    #map{background:#f1f4f3}
    .leaflet-tile-pane{filter:grayscale(.85) saturate(.48) contrast(.88);opacity:.66}
    .leaflet-heatmap-layer{opacity:.82}
    .leaflet-control-attribution{font-size:10px!important;background:rgba(255,255,255,.75)!important}
    .leaflet-control-zoom{border:1px solid #b8c9c8!important;box-shadow:0 4px 16px #173c4030!important}
    .leaflet-control-zoom a{color:#31545a!important;background:#fff!important}
    .panel{position:absolute;z-index:1000;top:18px;right:18px;width:238px;padding:18px;
      color:#eaf6f4;background:#152a34ed;border:1px solid #ffffff24;border-radius:16px;
      box-shadow:0 12px 30px #1b373747;backdrop-filter:blur(12px)}
    .eyebrow{color:#8ce2cc;font-size:10px;font-weight:800;letter-spacing:.18em}
    h1{font-size:19px;margin:8px 0 5px;font-weight:700}
    .sub{font-size:11px;color:#acc7c9;margin:0 0 17px;line-height:1.5}
    label{display:block;color:#bed6d5;font-size:11px;margin:13px 0 6px}
    select,button{width:100%;box-sizing:border-box;background:#213946;color:#ecf8f5;border:1px solid #ffffff28;
      padding:9px 10px;border-radius:8px;font:12px inherit}
    select:focus,button:focus-visible{outline:2px solid #8ce2cc;outline-offset:2px}
    button{cursor:pointer;margin-top:14px}
    button:hover{background:#2c4a55}
    .check{display:flex;align-items:center;gap:8px;margin-top:14px;cursor:pointer}
    .check input{accent-color:#76cabc;margin:0}
    .legend{margin-top:20px;border-top:1px solid #ffffff27;padding-top:14px}
    .legend-title{font-size:10px;color:#c4dbd8;margin-bottom:8px}
    .bar{height:7px;border-radius:6px;background:linear-gradient(90deg,#83d4cd,#359fa9,#ecc174,#ed8b61,#d97759)}
    .legend-labels{display:flex;justify-content:space-between;color:#9dbbbb;font-size:10px;margin-top:6px}
    .note{margin-top:12px;color:#8cacae;font-size:10px;line-height:1.5}
    @media(max-width:600px){.panel{top:10px;right:10px;width:175px;padding:12px}h1{font-size:16px}.sub,.note{display:none}}
  </style>
</head>
<body>
  <div id="map" aria-label="骑行热力地图"></div>
  <aside class="panel" aria-label="骑行热力图控制">
    <div class="eyebrow">RIDE DENSITY</div>
    <h1>骑行热力图</h1>
    <p class="sub">$count 条骑行记录 · 颜色表示相对活动密度</p>
    <label for="heatMode">热力内容</label>
    <select id="heatMode">
      <option value="routes">路线热度</option>
      <option value="starts">起点热度</option>
      <option value="ends">终点热度</option>
    </select>
    <label for="citySelect">快速定位</label>
    <select id="citySelect">
      <option value="">选择城市或范围</option>
      <option value="china">中国范围</option>
      <option value="world">全球范围</option>
    </select>
    <label class="check"><input id="showPaths" type="checkbox" checked>显示轨迹轮廓</label>
    <label class="check"><input id="showConnections" type="checkbox">显示起终点连线</label>
    <div class="legend" aria-label="热度图例">
      <div class="legend-title">活动密度</div>
      <div class="bar"></div>
      <div class="legend-labels"><span>较少</span><span>较多</span></div>
    </div>
    <div class="note">路线按固定距离取样；颜色按当前视野的活动量调整。</div>
    <button id="fitAll" type="button">显示主要活动区域</button>
  </aside>
  <script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.3/dist/leaflet.js"></script>
  <script src="https://cdn.jsdelivr.net/gh/python-visualization/folium@main/folium/templates/leaflet_heat.min.js"></script>
  <script>window.CYCLING_HEAT_DATA=$data;</script>
  <script src="../static/js/cycling-heatmap.js?v=6"></script>
</body>
</html>
""")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("database", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    with (args.database / "activities.json").open(encoding="utf-8") as source:
        activities = json.load(source)
    data = build_data(activities)
    args.output.mkdir(parents=True, exist_ok=True)
    target = args.output / "straight-line.html"
    target.write_text(PAGE.substitute(count=f"{data['count']:,}", data=json.dumps(data, ensure_ascii=False, separators=(",", ":"))), encoding="utf-8")
    print(f"Wrote {target}: {data['count']} activities, {len(data['routes'])} route samples")


if __name__ == "__main__":
    main()
