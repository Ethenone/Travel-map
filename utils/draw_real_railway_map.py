# -*- coding: utf-8 -*-
"""Render matched railway journeys as an interactive MapLibre map."""

import argparse
import json
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("data", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    routes = json.loads((args.data / "rail_routes_real.geojson").read_text(encoding="utf-8"))
    stats = json.loads((args.data / "rail_line_stats.json").read_text(encoding="utf-8"))
    payload = json.dumps({"routes": routes, "stats": stats}, ensure_ascii=False, separators=(",", ":"))

    template = r'''<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Travel Atlas · Real Railway Routes</title>
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.css">
<script src="https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.js"></script>
<style>
*{box-sizing:border-box}html,body,#map{width:100%;height:100%;margin:0}body{overflow:hidden;color:#e9f8ff;background:#030a12;font-family:Inter,"Segoe UI",sans-serif}#map{background:#07111f}
.maplibregl-ctrl-group{overflow:hidden;background:rgba(7,21,37,.9);border:1px solid rgba(148,184,218,.2);border-radius:11px}.maplibregl-ctrl-group button{filter:invert(1) brightness(1.8)}.maplibregl-ctrl-attrib{color:#7890a7;background:rgba(3,10,18,.74)!important}.maplibregl-ctrl-attrib a{color:#a8c4d8}
.maplibregl-popup-content{padding:12px 14px;color:#dcecff;background:rgba(7,21,37,.97);border:1px solid rgba(148,184,218,.22);border-radius:12px}.maplibregl-popup-tip{border-top-color:rgba(7,21,37,.97)!important;border-bottom-color:rgba(7,21,37,.97)!important}.route-popup strong{display:block;margin-bottom:4px;color:#fff;font-size:13px}.route-popup span{display:block;color:#91a6bb;font-size:11px;line-height:1.55}
.rail-panel{position:absolute;top:16px;right:16px;z-index:5;width:224px;padding:14px;background:rgba(5,17,30,.88);border:1px solid rgba(148,184,218,.2);border-radius:15px;box-shadow:0 18px 42px rgba(0,0,0,.3);backdrop-filter:blur(15px)}.eyebrow{color:#6fded8;font-size:9px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}.rail-panel h1{margin:5px 0 11px;font-size:15px}.quality-row{display:flex;align-items:center;gap:7px;min-height:25px;color:#8fa7ba;font-size:10px}.dot{width:8px;height:8px;border-radius:50%}.dot.real{background:#4dd7d0;box-shadow:0 0 10px #4dd7d0}.dot.fallback{background:#f5b84b}.quality-row b{margin-left:auto;color:#dcecff;font-size:11px}.line-list{margin-top:11px;padding-top:10px;border-top:1px solid rgba(148,184,218,.13)}.line-title{margin-bottom:7px;color:#70899f;font-size:9px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.line-row{display:grid;grid-template-columns:1fr auto;gap:8px;padding:4px 0;color:#b9ccda;font-size:10px}.line-row span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.line-row strong{color:#ff8c99;font-variant-numeric:tabular-nums}.reset-btn{width:100%;margin-top:10px;padding:7px;color:#a7bece;background:rgba(255,255,255,.04);border:1px solid rgba(148,184,218,.14);border-radius:8px;cursor:pointer;font-size:10px}.reset-btn:hover{color:#06131e;background:#4dd7d0}.loading{position:absolute;inset:0;z-index:10;display:grid;place-items:center;color:#91a6bb;background:#06101c;font-size:12px;letter-spacing:.1em;transition:opacity .35s}.loading.hidden{opacity:0;pointer-events:none}@media(max-width:640px){.rail-panel{top:10px;right:10px;width:190px;padding:11px}.line-row{padding:3px 0}}
</style>
</head>
<body>
<div id="map"></div><div class="loading" id="loading">MATCHING REAL RAIL TRACKS</div>
<section class="rail-panel" aria-label="铁路真实轨迹控制"><div class="eyebrow">Railway network</div><h1>OSM 真实轨迹</h1><button class="reset-btn" id="resetButton" type="button">显示全部行程</button></section>
<script>
const railwayData=__RAILWAY_DATA__,features=railwayData.routes.features;
const map=new maplibregl.Map({container:'map',style:'https://demotiles.maplibre.org/style.json',center:[111,31],zoom:3.25,canvasContextAttributes:{antialias:true},attributionControl:true});
map.addControl(new maplibregl.NavigationControl({visualizePitch:true}),'bottom-right');
function darkenBaseMap(){for(const layer of map.getStyle().layers||[]){try{if(layer.type==='background')map.setPaintProperty(layer.id,'background-color','#07111f');if(layer.type==='fill'){map.setPaintProperty(layer.id,'fill-color','#14283a');map.setPaintProperty(layer.id,'fill-opacity',.9)}if(layer.type==='line'){map.setPaintProperty(layer.id,'line-color','#38556b');map.setPaintProperty(layer.id,'line-opacity',.5)}if(layer.type==='symbol'){map.setPaintProperty(layer.id,'text-color','#8ca3b6');map.setPaintProperty(layer.id,'text-halo-color','#07111f')}}catch(_){}}}
function resetHighlight(){map.setFilter('rail-highlight',['==',['get','trip_id'],-1]);map.setPaintProperty('rail-routes','line-opacity',.22)}
function highlight(filter){map.setFilter('rail-highlight',filter);map.setPaintProperty('rail-routes','line-opacity',.07)}
function focusRequestedTrain(){const train=new URLSearchParams(location.search).get('train');if(!train)return;const feature=features.find(item=>item.properties.id===train);if(!feature)return;highlight(['==',['get','id'],train]);const segments=feature.geometry.type==='MultiLineString'?feature.geometry.coordinates:[feature.geometry.coordinates],bounds=new maplibregl.LngLatBounds();segments.forEach(segment=>segment.forEach(coord=>bounds.extend(coord)));map.fitBounds(bounds,{padding:60,duration:0,maxZoom:7})}
map.on('style.load',()=>{darkenBaseMap();map.addSource('rail-journeys',{type:'geojson',data:railwayData.routes});map.addLayer({id:'rail-glow',type:'line',source:'rail-journeys',paint:{'line-color':'#4dd7d0','line-width':5,'line-opacity':.08,'line-blur':3}});map.addLayer({id:'rail-routes',type:'line',source:'rail-journeys',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#4dd7d0','line-width':['interpolate',['linear'],['zoom'],2,.7,7,2.2],'line-opacity':.22}});map.addLayer({id:'rail-highlight',type:'line',source:'rail-journeys',filter:['==',['get','trip_id'],-1],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#ff6678','line-width':['interpolate',['linear'],['zoom'],2,2.4,7,6],'line-opacity':.95}});document.getElementById('loading').classList.add('hidden');focusRequestedTrain()});
map.on('click','rail-routes',event=>{const p=event.features[0].properties,lines=Array.isArray(p.lines)?p.lines.join(' / '):p.lines||'未分类';new maplibregl.Popup({closeButton:false,maxWidth:'280px'}).setLngLat(event.lngLat).setHTML(`<div class="route-popup"><strong>${p.id} · ${p.from} → ${p.to}</strong><span>${lines}</span><span>${p.distance||'-'} km · OSM 轨迹</span></div>`).addTo(map)});map.on('mouseenter','rail-routes',()=>map.getCanvas().style.cursor='pointer');map.on('mouseleave','rail-routes',()=>map.getCanvas().style.cursor='');document.getElementById('resetButton').addEventListener('click',resetHighlight);
window.addEventListener('message',event=>{if(event.source!==window.parent||event.origin!==window.location.origin)return;const msg=event.data||{};if(msg.type==='highlight_train')highlight(['==',['get','id'],String(msg.train)]);else if(msg.type==='highlight_line')highlight(['in',msg.line,['get','lines']]);else if(msg.type==='highlight_station')highlight(['any',['==',['get','from'],msg.station],['==',['get','to'],msg.station]]);else if(msg.type==='highlight_city')highlight(['any',['==',['get','fromcity'],msg.city],['==',['get','tocity'],msg.city]]);else if(msg.type==='highlight_prov')highlight(['any',['==',['get','fromprov'],msg.prov],['==',['get','toprov'],msg.prov]]);else if(msg.type==='highlight_train_type')highlight(['==',['slice',['get','id'],0,1],msg.train_type]);else if(msg.type==='Travel Duration')highlight(['all',['>=',['get','duration'],msg.start],['<',['get','duration'],msg.end]]);else if(msg.type==='Travel Distance')highlight(['all',['>=',['get','distance'],msg.start],['<',['get','distance'],msg.end]])});
</script>
</body></html>'''
    args.output.mkdir(parents=True, exist_ok=True)
    target = args.output / "map_rail.html"
    target.write_text(template.replace("__RAILWAY_DATA__", payload), encoding="utf-8")
    print(f"Generated {target} with {len(routes['features'])} railway journeys")


if __name__ == "__main__":
    main()
