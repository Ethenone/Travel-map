# -*- coding: utf-8 -*-
"""Generate a Shanghai exploration map from recorded and route-passed regions."""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import folium
import geopandas as gpd
import pandas as pd
import polyline
from folium import Element, plugins
from shapely.geometry import LineString
from shapely.ops import unary_union

AREA_COLORS = {"manual": "#0f766e", "route": "#f59e0b", "none": "#dbe5e8"}


def make_valid(geometry):
    """Repair occasional invalid rings in the street boundary files."""
    if geometry is None or geometry.is_empty or geometry.is_valid:
        return geometry
    try:
        from shapely.validation import make_valid as shapely_make_valid
        return shapely_make_valid(geometry)
    except (ImportError, AttributeError):
        return geometry.buffer(0)


def load_streets(street_dir: Path) -> gpd.GeoDataFrame:
    frames = []
    for path in sorted(street_dir.iterdir(), key=lambda item: item.name):
        if path.suffix.lower() not in {".json", ".geojson"}:
            continue
        frame = gpd.read_file(path)[["name", "geometry"]].to_crs(epsg=4326)
        frame["district"] = path.stem
        frames.append(frame)
    if not frames:
        raise FileNotFoundError(f"No street boundary files found in {street_dir}")
    streets = gpd.GeoDataFrame(pd.concat(frames, ignore_index=True), crs="EPSG:4326")
    streets["geometry"] = streets.geometry.map(make_valid)
    return streets[~streets.geometry.is_empty & streets.geometry.notna()].copy()


def load_manual_visited(csv_path: Path) -> set[str]:
    exploration = pd.read_csv(csv_path, index_col=0, encoding="gbk")
    if "到访" not in exploration.columns:
        raise KeyError(f"{csv_path} is missing the 到访 column")
    visited = pd.to_numeric(exploration["到访"], errors="coerce").fillna(0).gt(0)
    return set(exploration.index[visited].astype(str))


def decode_activity(activity: dict):
    encoded = activity.get("summary_polyline")
    if not encoded:
        return None
    points = polyline.decode(encoded)
    if len(points) < 2:
        return None
    return LineString([(longitude, latitude) for latitude, longitude in points])


def format_duration(value) -> str:
    if value is None or value == "":
        return "未知"
    if isinstance(value, (int, float)) and math.isfinite(value):
        hours, remainder = divmod(int(value), 3600)
        minutes, _ = divmod(remainder, 60)
        return f"{hours:d} 小时 {minutes:02d} 分"
    return str(value).split(".")[0]


def route_popup(activity: dict) -> str:
    date = str(activity.get("start_date_local") or activity.get("start_date") or "日期未知")[:10]
    try:
        distance = f"{float(activity.get('distance')) / 1000:.1f} km"
    except (TypeError, ValueError):
        distance = "里程未知"
    name = "公路轨迹"
    return f"""<div class="route-card"><strong>{name}</strong>
      <span>{date}</span>
      <span>{distance} · {format_duration(activity.get('moving_time'))}</span></div>"""


def add_page_chrome(base_map, route_count, explored_count, passed_count):
    map_name = base_map.get_name()
    html = f"""
    <style>
      :root {{ --ink:#102a2e; --muted:#587177; --panel:rgba(249,252,251,.93); }}
      .leaflet-container {{ background:#dbe7e8; font-family:Inter,"PingFang SC","Microsoft YaHei",sans-serif; }}
      .leaflet-control-zoom a {{ color:var(--ink)!important; border:0!important; }}
      .leaflet-control-zoom,.leaflet-control-layers,.leaflet-control-scale-line {{
        border:0!important; border-radius:12px!important; box-shadow:0 8px 24px rgba(15,45,48,.16)!important; }}
      .leaflet-control-layers {{ padding:8px 10px; color:var(--ink); background:var(--panel); }}
      .leaflet-popup-content-wrapper {{ border-radius:14px; box-shadow:0 12px 32px rgba(12,38,43,.22); }}
      .leaflet-popup-content {{ margin:12px 14px; }}
      .route-card {{ display:grid; gap:4px; min-width:175px; color:var(--ink); }}
      .route-card strong {{ font-size:14px; }} .route-card span {{ color:var(--muted); font-size:12px; }}
      .shanghai-panel {{ position:fixed; z-index:9999; top:18px; right:78px; left:auto;
        width:min(360px,calc(100vw - 156px)); padding:16px 18px; color:var(--ink);
        background:var(--panel); backdrop-filter:blur(14px); border:1px solid rgba(255,255,255,.74);
        border-radius:18px; box-shadow:0 14px 38px rgba(18,51,54,.17); }}
      .shanghai-panel h1 {{ margin:0 0 5px; font-size:20px; letter-spacing:-.02em; }}
      .shanghai-panel p {{ margin:0; color:var(--muted); font-size:12px; line-height:1.55; }}
      .shanghai-stats {{ display:flex; gap:18px; margin-top:11px; }}
      .shanghai-stat {{ display:grid; gap:1px; }} .shanghai-stat b {{ font-size:18px; color:#0f766e; }}
      .shanghai-stat span {{ color:var(--muted); font-size:11px; }}
      .shanghai-legend {{ position:fixed; z-index:9999; right:12px; bottom:24px; padding:11px 13px;
        color:var(--ink); background:var(--panel); border:1px solid rgba(255,255,255,.74);
        border-radius:14px; box-shadow:0 10px 28px rgba(18,51,54,.15); font-size:11px; line-height:1.65; }}
      .legend-title {{ margin-bottom:3px; font-weight:700; font-size:12px; }}
      .legend-row {{ display:flex; align-items:center; gap:7px; white-space:nowrap; }}
      .legend-swatch {{ width:18px; height:7px; border-radius:99px; }}
      .legend-route {{ height:3px; background:#e11d48; box-shadow:0 0 0 1px rgba(255,255,255,.9); }}
      @media(max-width:820px) {{ .shanghai-panel {{ top:164px; right:10px; left:auto;
        width:min(340px,calc(100vw - 20px)); padding:12px 14px; border-radius:14px; }}
        .shanghai-panel h1 {{ font-size:17px; }} .shanghai-panel p,.shanghai-stat span {{ font-size:10px; }}
        .shanghai-stat b {{ font-size:16px; }} .shanghai-legend {{ right:8px; bottom:18px; }} }}
    </style>
    <section class="shanghai-panel" aria-label="上海探索概览">
      <h1>上海探索 · 城市轨迹</h1>
      <p>探索为我的上海探索记录；途径为记录之外、被其他轨迹穿过的街镇。</p>
      <div class="shanghai-stats">
        <div class="shanghai-stat"><b>{route_count:,}</b><span>条途经轨迹</span></div>
        <div class="shanghai-stat"><b>{explored_count}</b><span>探索街镇</span></div>
        <div class="shanghai-stat"><b>{passed_count}</b><span>途径街镇</span></div>
      </div>
    </section>
    <aside class="shanghai-legend" aria-label="地图图例">
      <div class="legend-title">区域状态</div>
      <div class="legend-row"><i class="legend-swatch" style="background:{AREA_COLORS['manual']}"></i>探索（我的记录）</div>
      <div class="legend-row"><i class="legend-swatch" style="background:{AREA_COLORS['route']}"></i>途径（其他轨迹）</div>
      <div class="legend-row"><i class="legend-swatch legend-route"></i>途经上海轨迹</div>
    </aside>
    <script>document.addEventListener('keydown',function(event){{if(event.key.toLowerCase()==='r')
      {map_name}.fitBounds([[30.67,120.85],[31.88,122.20]]);}});</script>
    """
    base_map.get_root().html.add_child(Element(html))


def main(database: str, output: str) -> None:
    database_dir = Path(database).resolve()
    output_dir = Path(output).resolve()
    shanghai_dir = database_dir / "上海市"

    print("Reading Shanghai street boundaries and exploration records")
    streets = load_streets(shanghai_dir / "上海市分街道")
    manual_visited = load_manual_visited(shanghai_dir / "上海市.csv")
    shanghai_boundary = unary_union(list(streets.geometry))

    print("Selecting road activities whose geometry intersects Shanghai")
    with (database_dir / "activities.json").open("r", encoding="utf-8") as handle:
        activities = json.load(handle)
    shanghai_routes = []
    for activity in activities:
        line = decode_activity(activity)
        if line is not None and line.intersects(shanghai_boundary):
            shanghai_routes.append((activity, line))

    print("Calculating the union of recorded and route-passed regions")
    route_visited = {
        row["name"] for _, row in streets.iterrows()
        if any(line.intersects(row.geometry) for _, line in shanghai_routes)
    }
    union_visited = manual_visited | route_visited
    passed_only = route_visited - manual_visited

    def source_for(name):
        return "manual" if name in manual_visited else "route" if name in passed_only else "none"

    labels = {"manual":"探索", "route":"途径", "none":"未覆盖"}
    streets["source_key"] = streets["name"].map(source_for)
    streets["status"] = streets["source_key"].map(labels)

    base_map = folium.Map(location=[31.23,121.47], zoom_start=10, control_scale=True,
                          control=False, tiles=None, prefer_canvas=True)
    folium.TileLayer(
        tiles=("https://server.arcgisonline.com/ArcGIS/rest/services/"
               "Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"),
        attr="Tiles &copy; Esri &mdash; Esri, HERE, Garmin, USGS, NGA",
        name="浅灰底图", max_zoom=16, overlay=False, show=True).add_to(base_map)

    area_layer = folium.FeatureGroup(name=f"探索与途径区域 ({len(union_visited)})", show=True)
    def area_style(feature):
        source = feature["properties"].get("source_key", "none")
        explored = source != "none"
        return {"fillColor":AREA_COLORS[source], "color":"#ffffff" if explored else "#9fb2b7",
                "weight":.9 if explored else .45, "fillOpacity":.58 if explored else .12}
    folium.GeoJson(
        streets.to_json(drop_id=True), name="街镇探索状态", style_function=area_style,
        highlight_function=lambda _feature:{"weight":2.2,"color":"#102a2e","fillOpacity":.72},
        tooltip=folium.GeoJsonTooltip(fields=["district","name","status"],
            aliases=["行政区","街道 / 镇","状态"], sticky=False, localize=True, labels=True)
    ).add_to(area_layer)
    area_layer.add_to(base_map)

    route_layer = folium.FeatureGroup(name=f"途经上海的公路轨迹 ({len(shanghai_routes)})", show=True)
    for activity, line in shanghai_routes:
        locations = [(latitude, longitude) for longitude, latitude in line.coords]
        date = str(activity.get("start_date_local") or "")[:10]
        folium.PolyLine(locations, color="#e11d48", weight=2.6, opacity=.82,
            tooltip=f"轨迹 · {date}", popup=folium.Popup(route_popup(activity), max_width=280)
        ).add_to(route_layer)
    route_layer.add_to(base_map)

    bounds = streets.total_bounds
    base_map.fit_bounds([[bounds[1],bounds[0]],[bounds[3],bounds[2]]], padding=(24,24))
    plugins.Fullscreen(position="topleft", title="全屏", title_cancel="退出全屏").add_to(base_map)
    folium.LayerControl(collapsed=True, position="topright").add_to(base_map)
    add_page_chrome(base_map, len(shanghai_routes), len(manual_visited), len(passed_only))

    output_dir.mkdir(parents=True, exist_ok=True)
    target = output_dir / "map_shanghai.html"
    base_map.save(str(target))
    print(f"Saved {target}: {len(shanghai_routes)} routes; {len(manual_visited)} recorded regions + "
          f"{len(route_visited)} route regions = {len(union_visited)} union regions")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Usage: draw_shanghai_exploration.py <database_dir> <output_dir>")
    main(sys.argv[1], sys.argv[2])
