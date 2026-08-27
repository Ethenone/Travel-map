# -*- coding: utf-8 -*-
"""Generate the interactive globe used by the main travel archive page."""

import json
import math
import sys
from pathlib import Path

# Some Anaconda installations ship optional pandas accelerators built against
# NumPy 1.x. They are not needed here and can emit alarming import errors under
# NumPy 2.x, so keep the generator on pandas' pure-Python path.
sys.modules.setdefault("numexpr", None)
sys.modules.setdefault("bottleneck", None)

import pandas as pd


DATABASE = Path(sys.argv[1])
OUTPUT = Path(sys.argv[2])
REFERENCE_DATA = Path(__file__).resolve().parents[1] / "reference-data"


def clean(value, fallback=""):
    if pd.isna(value):
        return fallback
    return str(value)


def number(value):
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (TypeError, ValueError):
        return None


def great_circle(start, end):
    """Return sampled points along the shortest path on a sphere."""
    lon1, lat1 = map(math.radians, start)
    lon2, lat2 = map(math.radians, end)

    first = (
        math.cos(lat1) * math.cos(lon1),
        math.cos(lat1) * math.sin(lon1),
        math.sin(lat1),
    )
    second = (
        math.cos(lat2) * math.cos(lon2),
        math.cos(lat2) * math.sin(lon2),
        math.sin(lat2),
    )
    dot = max(-1.0, min(1.0, sum(a * b for a, b in zip(first, second))))
    angle = math.acos(dot)
    steps = max(24, min(120, int(math.degrees(angle) * 1.25)))

    if angle < 1e-8:
        return [list(start), list(end)]

    sin_angle = math.sin(angle)
    points = []
    for index in range(steps + 1):
        fraction = index / steps
        weight_a = math.sin((1 - fraction) * angle) / sin_angle
        weight_b = math.sin(fraction * angle) / sin_angle
        x = weight_a * first[0] + weight_b * second[0]
        y = weight_a * first[1] + weight_b * second[1]
        z = weight_a * first[2] + weight_b * second[2]
        lon = math.degrees(math.atan2(y, x))
        lat = math.degrees(math.atan2(z, math.sqrt(x * x + y * y)))
        points.append([round(lon, 6), round(lat, 6)])
    return points


def split_antimeridian(points):
    """Split a great-circle path where normalized longitude crosses ±180°."""
    segments = [[points[0]]]
    for previous, current in zip(points, points[1:]):
        delta = current[0] - previous[0]
        if abs(delta) <= 180:
            segments[-1].append(current)
            continue

        if previous[0] > 0 and current[0] < 0:
            adjusted_current = current[0] + 360
            fraction = (180 - previous[0]) / (adjusted_current - previous[0])
            crossing_lat = previous[1] + fraction * (current[1] - previous[1])
            segments[-1].append([180, round(crossing_lat, 6)])
            segments.append([[-180, round(crossing_lat, 6)], current])
        else:
            adjusted_current = current[0] - 360
            fraction = (-180 - previous[0]) / (adjusted_current - previous[0])
            crossing_lat = previous[1] + fraction * (current[1] - previous[1])
            segments[-1].append([-180, round(crossing_lat, 6)])
            segments.append([[180, round(crossing_lat, 6)], current])
    return [segment for segment in segments if len(segment) > 1]


route_features = []
point_features = {}
counts = {"air": 0, "train": 0}


def add_route(mode, start, end, origin, destination, service=""):
    lon1, lat1 = number(start[0]), number(start[1])
    lon2, lat2 = number(end[0]), number(end[1])
    if None in (lon1, lat1, lon2, lat2):
        return

    coordinates = split_antimeridian(great_circle([lon1, lat1], [lon2, lat2]))
    properties = {
        "mode": mode,
        "origin": clean(origin),
        "destination": clean(destination),
        "service": clean(service),
    }
    route_features.append({
        "type": "Feature",
        "properties": properties,
        "geometry": {"type": "MultiLineString", "coordinates": coordinates},
    })
    counts[mode] += 1

    for name, lon, lat, endpoint in (
        (origin, lon1, lat1, "origin"),
        (destination, lon2, lat2, "destination"),
    ):
        key = (mode, round(lon, 5), round(lat, 5), clean(name))
        point_features[key] = {
            "type": "Feature",
            "properties": {"mode": mode, "name": clean(name), "endpoint": endpoint},
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
        }


print("Reading airports and flight records")
airports = pd.read_csv(REFERENCE_DATA / "airports_data.csv", encoding="utf-8")
airport_geo = {
    clean(row["iata"]): [number(row["lon"]), number(row["lat"])]
    for _, row in airports.iterrows()
}
flights = pd.read_excel(DATABASE / "飞机乘坐记录.xlsx", sheet_name=0)
for _, row in flights.iterrows():
    start_code, end_code = clean(row.get("start")), clean(row.get("depart"))
    if start_code not in airport_geo or end_code not in airport_geo:
        continue
    add_route(
        "air",
        airport_geo[start_code],
        airport_geo[end_code],
        row.get("起飞", start_code),
        row.get("降落", end_code),
        row.get("航班号", row.get("航班", "")),
    )


print("Reading domestic railway records")
stations = pd.read_csv(REFERENCE_DATA / "stations_data.csv", encoding="utf-8")
station_geo = {
    clean(row["车站"]): [number(row["经度"]), number(row["纬度"])]
    for _, row in stations.iterrows()
}
trains = pd.read_excel(DATABASE / "火车乘坐记录.xlsx", sheet_name=0)
for _, row in trains.iterrows():
    start_name, end_name = clean(row.get("上车站")), clean(row.get("下车站"))
    if start_name not in station_geo or end_name not in station_geo:
        continue
    add_route("train", station_geo[start_name], station_geo[end_name], start_name, end_name, row.get("车次", ""))


print("Reading international railway records")
foreign_trains = pd.read_excel(DATABASE / "境外铁路乘坐记录.xlsx", sheet_name="乘坐列表")
foreign_stations = pd.read_excel(DATABASE / "境外铁路乘坐记录.xlsx", sheet_name="车站位置")
foreign_geo = {
    clean(row["车站"]): [number(row["lon"]), number(row["lat"])]
    for _, row in foreign_stations.iterrows()
}
for _, row in foreign_trains.iterrows():
    start_name, end_name = clean(row.get("上车站")), clean(row.get("下车站"))
    if start_name not in foreign_geo or end_name not in foreign_geo:
        continue
    add_route("train", foreign_geo[start_name], foreign_geo[end_name], start_name, end_name, row.get("车次", ""))


payload = {
    "routes": {"type": "FeatureCollection", "features": route_features},
    "points": {"type": "FeatureCollection", "features": list(point_features.values())},
    "counts": counts,
}

template = r'''<!doctype html>
<html lang="zh-CN">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Travel Atlas Globe</title>
    <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.css">
    <script src="https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.js"></script>
    <style>
        * { box-sizing: border-box; }
        html, body, #map { width: 100%; height: 100%; margin: 0; }
        body { overflow: hidden; color: #edf7ff; background: #030a12; font-family: Inter, "Segoe UI", sans-serif; }
        #map { background: radial-gradient(circle at 50% 42%, #112a40 0, #07111f 48%, #02060b 100%); }
        .maplibregl-canvas { outline: none; }
        .maplibregl-ctrl-group { overflow: hidden; background: rgba(7, 21, 37, .88); border: 1px solid rgba(148,184,218,.2); border-radius: 11px; box-shadow: 0 12px 30px rgba(0,0,0,.3); }
        .maplibregl-ctrl-group button { filter: invert(1) brightness(1.8); }
        .maplibregl-ctrl-attrib { color: #7890a7; background: rgba(3,10,18,.74) !important; }
        .maplibregl-ctrl-attrib a { color: #a8c4d8; }
        .maplibregl-popup-content { padding: 12px 14px; color: #dcecff; background: rgba(7,21,37,.96); border: 1px solid rgba(148,184,218,.22); border-radius: 12px; box-shadow: 0 14px 36px rgba(0,0,0,.34); }
        .maplibregl-popup-tip { border-top-color: rgba(7,21,37,.96) !important; border-bottom-color: rgba(7,21,37,.96) !important; }
        .route-popup strong { display:block; margin-bottom:4px; color:#fff; font-size:13px; }
        .route-popup span { color:#91a6bb; font-size:11px; }
        .globe-panel { position:absolute; top:18px; right:18px; z-index:5; width:190px; padding:14px; background:rgba(5,17,30,.84); border:1px solid rgba(148,184,218,.2); border-radius:15px; box-shadow:0 18px 42px rgba(0,0,0,.3); backdrop-filter:blur(15px); }
        .globe-panel-title { margin-bottom:11px; color:#8fa7ba; font-size:10px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; }
        .mode-toggle { display:flex; align-items:center; gap:9px; min-height:34px; cursor:pointer; font-size:12px; font-weight:700; }
        .mode-toggle input { position:absolute; opacity:0; }
        .toggle-dot { width:10px; height:10px; border-radius:50%; box-shadow:0 0 12px currentColor; }
        .mode-toggle input:not(:checked) + .toggle-dot { color:#56687a !important; box-shadow:none; }
        .mode-toggle input:not(:checked) ~ span:last-child { color:#64798d; }
        .mode-count { margin-left:auto; color:#6f879d; font-size:10px; font-variant-numeric:tabular-nums; }
        .view-switch { position:absolute; left:18px; bottom:18px; z-index:5; display:flex; gap:7px; padding:6px; background:rgba(5,17,30,.82); border:1px solid rgba(148,184,218,.18); border-radius:13px; backdrop-filter:blur(12px); }
        .view-switch button { padding:7px 10px; color:#9db2c5; background:transparent; border:0; border-radius:8px; cursor:pointer; font-size:11px; font-weight:700; }
        .view-switch button:hover { color:#04131e; background:#4dd7d0; }
        .loading { position:absolute; inset:0; z-index:10; display:grid; place-items:center; color:#91a6bb; background:#06101c; font-size:12px; letter-spacing:.1em; transition:opacity .35s ease; }
        .loading.hidden { opacity:0; pointer-events:none; }
        @media (max-width: 640px) {
            .globe-panel { top:12px; right:12px; width:154px; padding:11px; }
            .globe-panel-title { margin-bottom:6px; }
            .mode-toggle { min-height:29px; }
            .view-switch { left:12px; bottom:12px; }
        }
    </style>
</head>
<body>
    <div id="map"></div>
    <div class="loading" id="loading">BUILDING THE GLOBE</div>
    <div class="globe-panel" aria-label="交通方式筛选">
        <div class="globe-panel-title">Route layers</div>
        <label class="mode-toggle"><input type="checkbox" data-mode="air" checked><span class="toggle-dot" style="color:#ff6b7a;background:currentColor"></span><span>航空</span><span class="mode-count" data-count="air"></span></label>
        <label class="mode-toggle"><input type="checkbox" data-mode="train" checked><span class="toggle-dot" style="color:#4dd7d0;background:currentColor"></span><span>铁路</span><span class="mode-count" data-count="train"></span></label>
    </div>
    <div class="view-switch" aria-label="地球视角">
        <button type="button" data-view="asia">亚洲</button>
        <button type="button" data-view="pacific">太平洋</button>
        <button type="button" data-view="world">全球</button>
    </div>
    <script>
        const travelData = __TRAVEL_DATA__;
        const palette = { air: '#ff6b7a', train: '#4dd7d0' };
        const map = new maplibregl.Map({
            container: 'map',
            style: 'https://demotiles.maplibre.org/globe.json',
            center: [128, 28],
            zoom: 1.35,
            pitch: 0,
            bearing: 0,
            canvasContextAttributes: { antialias: true },
            attributionControl: true
        });
        map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');
        map.addControl(new maplibregl.GlobeControl(), 'bottom-right');

        function darkenBaseMap() {
            for (const layer of map.getStyle().layers || []) {
                try {
                    if (layer.type === 'background') map.setPaintProperty(layer.id, 'background-color', '#07111f');
                    if (layer.type === 'fill') {
                        map.setPaintProperty(layer.id, 'fill-color', '#14283a');
                        map.setPaintProperty(layer.id, 'fill-opacity', .92);
                    }
                    if (layer.type === 'line') {
                        map.setPaintProperty(layer.id, 'line-color', '#39566c');
                        map.setPaintProperty(layer.id, 'line-opacity', .58);
                    }
                    if (layer.type === 'symbol') {
                        map.setPaintProperty(layer.id, 'text-color', '#91a6bb');
                        map.setPaintProperty(layer.id, 'text-halo-color', '#07111f');
                    }
                } catch (_) { /* Some demo layers do not expose every paint property. */ }
            }
        }

        function addTravelLayers() {
            map.addSource('travel-routes', { type: 'geojson', data: travelData.routes });
            map.addSource('travel-points', { type: 'geojson', data: travelData.points });

            for (const mode of ['air', 'train']) {
                const filter = ['==', ['get', 'mode'], mode];
                map.addLayer({ id: `${mode}-route-glow`, type: 'line', source: 'travel-routes', filter, paint: { 'line-color': palette[mode], 'line-width': mode === 'air' ? 5 : 4, 'line-opacity': .12, 'line-blur': 3 } });
                map.addLayer({ id: `${mode}-routes`, type: 'line', source: 'travel-routes', filter, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': palette[mode], 'line-width': mode === 'air' ? 1.8 : 1.5, 'line-opacity': .62 } });
                map.addLayer({ id: `${mode}-points`, type: 'circle', source: 'travel-points', filter, paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 5, 5], 'circle-color': palette[mode], 'circle-stroke-color': '#07111f', 'circle-stroke-width': 1, 'circle-opacity': .88 } });
            }

            map.addLayer({
                id: 'air-direction',
                type: 'symbol',
                source: 'travel-routes',
                filter: ['==', ['get', 'mode'], 'air'],
                layout: { 'symbol-placement': 'line', 'symbol-spacing': 150, 'text-field': '›', 'text-size': 16, 'text-rotation-alignment': 'map', 'text-keep-upright': false },
                paint: { 'text-color': '#ffd3d8', 'text-opacity': .72, 'text-halo-color': '#8c2838', 'text-halo-width': .5 }
            });
        }

        function setModeVisible(mode, visible) {
            const visibility = visible ? 'visible' : 'none';
            for (const suffix of ['route-glow', 'routes', 'points']) {
                if (map.getLayer(`${mode}-${suffix}`)) map.setLayoutProperty(`${mode}-${suffix}`, 'visibility', visibility);
            }
            if (mode === 'air' && map.getLayer('air-direction')) map.setLayoutProperty('air-direction', 'visibility', visibility);
        }

        map.on('style.load', () => {
            map.setProjection({ type: 'globe' });
            darkenBaseMap();
            addTravelLayers();
            document.getElementById('loading').classList.add('hidden');
        });

        for (const [mode, count] of Object.entries(travelData.counts)) {
            document.querySelector(`[data-count="${mode}"]`).textContent = count;
        }
        document.querySelectorAll('[data-mode]').forEach(input => input.addEventListener('change', () => setModeVisible(input.dataset.mode, input.checked)));

        document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
            const views = {
                asia: { center: [112, 29], zoom: 1.65 },
                pacific: { center: [174, 25], zoom: 1.15 },
                world: { center: [80, 18], zoom: .65 }
            };
            map.flyTo({ ...views[button.dataset.view], duration: 1200, essential: true });
        }));

        map.on('click', 'air-routes', showRoutePopup);
        map.on('click', 'train-routes', showRoutePopup);
        function showRoutePopup(event) {
            const properties = event.features[0].properties;
            const service = properties.service ? `<span>${properties.service}</span>` : '';
            new maplibregl.Popup({ closeButton: false, maxWidth: '260px' })
                .setLngLat(event.lngLat)
                .setHTML(`<div class="route-popup"><strong>${properties.origin} → ${properties.destination}</strong>${service}</div>`)
                .addTo(map);
        }
        for (const layer of ['air-routes', 'train-routes']) {
            map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
            map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
        }
    </script>
</body>
</html>'''

html = template.replace("__TRAVEL_DATA__", json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
OUTPUT.mkdir(parents=True, exist_ok=True)
(OUTPUT / "map_line.html").write_text(html, encoding="utf-8")
print(f"Generated {OUTPUT / 'map_line.html'} with {len(route_features)} routes")
