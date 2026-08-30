# -*- coding: utf-8 -*-
"""Render recorded road/activity tracks with the railway map visual language."""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path

import polyline


CITY_CENTERS = [
    ("上海市", "Shanghai", 31.0100, 121.4737, 10),
    ("佛山市", "Foshan", 22.8919, 112.8690, 11),
    ("舟山市", "Zhoushan", 29.904443, 122.407543, 12),
    ("太原市", "Taiyuan", 37.809694, 112.568537, 12),
    ("六安市", "Luan", 31.883699, 116.521854, 11),
    ("香港", "HongKong", 22.302711, 114.177216, 11),
]


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("database", type=Path)
    parser.add_argument("output", type=Path)
    return parser.parse_args()


def activity_city(activity):
    raw = str(activity.get("location_country") or "")
    try:
        parsed = json.loads(raw.replace("'", '"').replace("None", '"None"'))
        city = str(parsed.get("city") or "").strip()
        if city:
            return city
    except (TypeError, ValueError, json.JSONDecodeError):
        pass
    for name, *_ in CITY_CENTERS:
        if name in raw:
            return name
    return ""


def main():
    args = parse_args()
    activities = json.loads((args.database / "activities.json").read_text(encoding="utf-8"))
    features = []
    city_distance = defaultdict(float)
    total_distance = 0.0

    for activity in activities:
        encoded = activity.get("summary_polyline")
        if not encoded:
            continue
        try:
            decoded = polyline.decode(encoded)
        except (TypeError, ValueError):
            continue
        if len(decoded) < 2:
            continue
        distance_km = float(activity.get("distance") or 0) / 1000
        city = activity_city(activity)
        if city:
            city_distance[city] += distance_km
        total_distance += distance_km
        features.append({
            "type": "Feature",
            "properties": {
                "id": str(activity.get("run_id") or len(features) + 1),
                "name": str(activity.get("name") or "未命名轨迹"),
                "activity_type": str(activity.get("type") or "Activity"),
                "date": str(activity.get("start_date_local") or "")[:10],
                "distance_km": round(distance_km, 2),
                "moving_time": str(activity.get("moving_time") or ""),
                "city": city,
            },
            "geometry": {
                "type": "LineString",
                "coordinates": [[lng, lat] for lat, lng in decoded],
            },
        })

    payload = json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    city_options = "".join(
        f'<option value="{key}">{name} · {city_distance[name]:,.0f} km</option>'
        for name, key, *_ in CITY_CENTERS
    )
    city_centers = json.dumps({key: [lng, lat, zoom] for _, key, lat, lng, zoom in CITY_CENTERS}, ensure_ascii=False, separators=(",", ":"))

    template = r'''<!doctype html>
<html lang="zh-CN"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Travel Atlas · Real Road Tracks</title>
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.css">
<script src="https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.js"></script>
<style>
*{box-sizing:border-box}html,body,#map{width:100%;height:100%;margin:0}body{overflow:hidden;color:#e9f8ff;background:#030a12;font-family:Inter,"Segoe UI",sans-serif}#map{background:#07111f}
.maplibregl-ctrl-group{overflow:hidden;background:rgba(7,21,37,.9);border:1px solid rgba(148,184,218,.2);border-radius:11px}.maplibregl-ctrl-group button{filter:invert(1) brightness(1.8)}.maplibregl-ctrl-attrib{color:#7890a7;background:rgba(3,10,18,.74)!important}.maplibregl-ctrl-attrib a{color:#a8c4d8}
.maplibregl-popup-content{padding:12px 14px;color:#dcecff;background:rgba(7,21,37,.97);border:1px solid rgba(148,184,218,.22);border-radius:12px}.maplibregl-popup-tip{border-top-color:rgba(7,21,37,.97)!important;border-bottom-color:rgba(7,21,37,.97)!important}.route-popup strong{display:block;margin-bottom:4px;color:#fff;font-size:13px}.route-popup span{display:block;color:#91a6bb;font-size:11px;line-height:1.55}
.road-panel{position:absolute;top:16px;right:16px;z-index:5;width:224px;padding:14px;background:rgba(5,17,30,.88);border:1px solid rgba(148,184,218,.2);border-radius:15px;box-shadow:0 18px 42px rgba(0,0,0,.3);backdrop-filter:blur(15px)}.eyebrow{color:#6fded8;font-size:9px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}.road-panel h1{margin:5px 0 4px;font-size:15px}.summary{margin-bottom:10px;color:#71899e;font-size:9px;line-height:1.5}.city-select,.reset-btn{width:100%;height:31px;color:#a7bece;background:rgba(255,255,255,.04);border:1px solid rgba(148,184,218,.14);border-radius:8px;font-size:10px}.city-select{margin-bottom:7px;padding:0 8px;outline:none}.city-select option{color:#dcecff;background:#0b1b2d}.city-select:focus{border-color:rgba(77,215,208,.45)}.reset-btn{cursor:pointer}.reset-btn:hover{color:#06131e;background:#4dd7d0}.loading{position:absolute;inset:0;z-index:10;display:grid;place-items:center;color:#91a6bb;background:#06101c;font-size:12px;letter-spacing:.1em;transition:opacity .35s}.loading.hidden{opacity:0;pointer-events:none}@media(max-width:640px){.road-panel{top:10px;right:10px;width:190px;padding:11px}}
</style></head><body>
<div id="map"></div><div class="loading" id="loading">LOADING REAL ROAD TRACKS</div>
<section class="road-panel" aria-label="公路真实轨迹控制"><div class="eyebrow">Road archive</div><h1>真实公路轨迹</h1><div class="summary">__TRACK_COUNT__ 条轨迹 · __TOTAL_DISTANCE__ km</div><select class="city-select" id="citySelect"><option value="">快速定位城市</option>__CITY_OPTIONS__</select><button class="reset-btn" id="resetButton" type="button">显示全部轨迹</button></section>
<script>
const roadData=__ROAD_DATA__,features=roadData.features,cityCenters=__CITY_CENTERS__;
const map=new maplibregl.Map({container:'map',style:'https://demotiles.maplibre.org/style.json',center:[121.431093,31.016832],zoom:5,canvasContextAttributes:{antialias:true},attributionControl:true});
map.addControl(new maplibregl.NavigationControl({visualizePitch:true}),'bottom-right');
function darkenBaseMap(){for(const layer of map.getStyle().layers||[]){try{if(layer.type==='background')map.setPaintProperty(layer.id,'background-color','#07111f');if(layer.type==='fill'){map.setPaintProperty(layer.id,'fill-color','#14283a');map.setPaintProperty(layer.id,'fill-opacity',.9)}if(layer.type==='line'){map.setPaintProperty(layer.id,'line-color','#38556b');map.setPaintProperty(layer.id,'line-opacity',.5)}if(layer.type==='symbol'){map.setPaintProperty(layer.id,'text-color','#8ca3b6');map.setPaintProperty(layer.id,'text-halo-color','#07111f')}}catch(_){}}}
function resetHighlight(){map.setFilter('road-highlight',['==',['get','id'],'']);map.setPaintProperty('road-tracks','line-opacity',.22)}
function highlightRoute(id){map.setFilter('road-highlight',['==',['get','id'],String(id)]);map.setPaintProperty('road-tracks','line-opacity',.07)}
function focusRequestedRoute(){const id=new URLSearchParams(location.search).get('route');if(!id)return;const feature=features.find(item=>item.properties.id===id);if(!feature)return;highlightRoute(id);const bounds=new maplibregl.LngLatBounds();feature.geometry.coordinates.forEach(coord=>bounds.extend(coord));map.fitBounds(bounds,{padding:60,duration:0,maxZoom:13})}
map.on('style.load',()=>{darkenBaseMap();map.addSource('road-journeys',{type:'geojson',data:roadData});map.addLayer({id:'road-glow',type:'line',source:'road-journeys',paint:{'line-color':'#4dd7d0','line-width':5,'line-opacity':.08,'line-blur':3}});map.addLayer({id:'road-tracks',type:'line',source:'road-journeys',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#4dd7d0','line-width':['interpolate',['linear'],['zoom'],2,.7,13,2.8],'line-opacity':.22}});map.addLayer({id:'road-highlight',type:'line',source:'road-journeys',filter:['==',['get','id'],''],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#ff6678','line-width':['interpolate',['linear'],['zoom'],2,2.4,13,6],'line-opacity':.95}});document.getElementById('loading').classList.add('hidden');focusRequestedRoute()});
map.on('click','road-tracks',event=>{const p=event.features[0].properties;highlightRoute(p.id);new maplibregl.Popup({closeButton:false,maxWidth:'280px'}).setLngLat(event.lngLat).setHTML(`<div class="route-popup"><strong>${p.name}</strong><span>${p.activity_type} · ${p.date||'日期未知'}</span><span>${Number(p.distance_km).toLocaleString('en-US')} km · ${p.moving_time||'时长未知'}</span></div>`).addTo(map)});map.on('mouseenter','road-tracks',()=>map.getCanvas().style.cursor='pointer');map.on('mouseleave','road-tracks',()=>map.getCanvas().style.cursor='');
document.getElementById('citySelect').addEventListener('change',event=>{const target=cityCenters[event.target.value];if(!target)return;map.easeTo({center:[target[0],target[1]],zoom:target[2],duration:900})});document.getElementById('resetButton').addEventListener('click',()=>{resetHighlight();document.getElementById('citySelect').value='';map.easeTo({center:[121.431093,31.016832],zoom:5,duration:700})});
</script></body></html>'''

    html = (template
        .replace("__ROAD_DATA__", payload)
        .replace("__CITY_OPTIONS__", city_options)
        .replace("__CITY_CENTERS__", city_centers)
        .replace("__TRACK_COUNT__", f"{len(features):,}")
        .replace("__TOTAL_DISTANCE__", f"{total_distance:,.0f}"))
    args.output.mkdir(parents=True, exist_ok=True)
    target = args.output / "map_with_polyline_cityselect.html"
    target.write_text(html, encoding="utf-8")
    print(f"Generated {target} with {len(features)} road tracks")


if __name__ == "__main__":
    main()
