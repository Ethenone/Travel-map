# -*- coding: UTF-8 -*-
import json
import pandas as pd
import folium
import polyline
from folium import plugins
import datetime
import sys

database = sys.argv[1]
output = sys.argv[2]

print("reading activities data")
with open(f'{database}//activities.json','r') as file:
    data = json.load(file)

def transfer(loc):
    iloc = []
    for i in loc:
        iloc.append([i[0],i[1]])
    return iloc

m = folium.Map(location=[31.016832, 121.431093],
               zoom_start=5,
               control_scale=True,
               control=False,
               tiles=None
              )
print("drawing map")
folium.TileLayer(tiles='http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',# 'https://webrd04.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}',
                 attr="&copy; <a href='https://stadiamaps.com/' target='_blank'>Stadia Maps</a> &copy; <a href='https://openmaptiles.org/' target='_blank'>OpenMapTiles</a> &copy; <a href='https://www.openstreetmap.org/copyright' target='_blank'>OpenStreetMap</a>&copy; <a href='https://stamen.com/' target='_blank'>Stamen Design</a>",
                 min_zoom=0,
                 max_zoom=19,
                 control=True,
                 show=True,
                 overlay=False,
                 name='ss'
                ).add_to(m)
from collections import defaultdict
citysum = defaultdict(int)
for i in data:
    try:
        if '156' not in i['location_country']:
            print(i)
    except:
        print(i)
    if not i['summary_polyline']:
        continue
    try:
        citystr = i['location_country'].replace("\'","\"").replace("None","\"None\"")
        #print(citystr)
        j = json.loads(citystr)
        citysum[j['city']] += i['distance']
    except:
        do_nothing = 1
    #date = i['start_date_local']
    #dt = datetime.datetime.strptime(date,'%Y-%m-%d %H:%M:%S')
    if False:#dt.year>=2026 and dt.month>=5 and dt.day>=2:
        color = 'red'
        op = 1
    else:
        color = 'blue'
        op = 0.5
    pl = polyline.decode(i['summary_polyline'])
    folium.PolyLine(
        locations = transfer(pl),
        color = color,
        weight=3,
        opacity=op
    ).add_to(m)
print(citysum)

from folium import Element
map_var = m.get_name()
citylist = [
    ["上海市","Shanghai",31.0100,121.4737,10],
    ["佛山市","Foshan",22.8919,112.8690,11],
    ["舟山市","Zhoushan", 29.904443,122.407543,12],
    ["太原市","Taiyuan",37.809694,112.568537,12],
    ["六安市","Luan",31.883699,116.521854,11],
    ["香港","HongKong",22.302711,114.177216,11]
]

selectlist = """"""
locationlist = """initial: [0,0,1]"""
for name,en,lat,lon,zoom in citylist:
    selectlist = selectlist + f"""
    <option value="{en}">{name}({en}):{round(citysum[name]/1000,2)}km</option>"""
    
    locationlist = locationlist + f""",
    {en}:[{lat},{lon},{zoom}]"""
    
custom_html = f"""
<style>
    #city-select {{
        position: absolute;
        top: 10px;
        left: 50px;
        z-index: 1000;
        padding: 6px;
        font-size: 16px;
        background: white;
        border-radius: 5px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.2);
    }}
</style>

<select id="city-select">
    <option value="">🌍 I have left traces in these cities.</option>
    {selectlist}  
</select>

<script>
    const cityCenters = {{
        {locationlist}
    }};

    const select = document.getElementById('city-select');

    select.addEventListener('change', function () {{
        const val = this.value;
        if (val && cityCenters[val]) {{
            const [lat, lon, zoom] = cityCenters[val];
            {map_var}.setView([lat, lon], zoom);  // 使用 folium 真实地图变量名
        }}
    }});
</script>
"""
m.get_root().html.add_child(Element(custom_html))
m.save(f'{output}//map_with_polyline_cityselect.html')


#起点-终点连线
m = folium.Map(location=[31.03003, 121.44],
               zoom_start=15,
               control_scale=True,
               control=False,
               tiles=None
              )

folium.TileLayer(tiles='http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
                 attr="&copy; <a href='https://stadiamaps.com/' target='_blank'>Stadia Maps</a> &copy; <a href='https://openmaptiles.org/' target='_blank'>OpenMapTiles</a> &copy; <a href='https://www.openstreetmap.org/copyright' target='_blank'>OpenStreetMap</a>&copy; <a href='https://stamen.com/' target='_blank'>Stamen Design</a>",
                 min_zoom=0,
                 max_zoom=19,
                 control=True,
                 show=True,
                 overlay=False,
                 name='Heatmap'
                ).add_to(m)

group_conn = folium.FeatureGroup(name = 'connecting line',show=False)
group_start = folium.FeatureGroup(name = 'origin',show=False)
group_start_heatmap = folium.FeatureGroup(name = 'origin heatmap')
group_end = folium.FeatureGroup(name = 'destination',show=False)
group_end_heatmap = folium.FeatureGroup(name = 'destination heatmap')
group_route_heatmap = folium.FeatureGroup(name = 'route heatmap',show = False)

start = []
end = []
point_list = []
for i in data:
    if not i['summary_polyline']:
        continue
    pl = polyline.decode(i['summary_polyline'])
    pl = transfer(pl)
    folium.PolyLine(
        locations = [pl[0],pl[-1]],
        color = 'blue',
        weight=3,
        opacity=0.2
    ).add_to(group_conn)
    folium.Circle(
        location=pl[0],
        radius=30,   # 圆的半径
        color='red', #'#FF1493',
        fill=True,
        fill_color='red'
    ).add_to(group_start)
    folium.Circle(
        location=pl[-1],
        radius=30,   # 圆的半径
        color='green', #'#FF1493',
        fill=True,
        fill_color='green'
    ).add_to(group_end)
    start.append(pl[0])
    end.append(pl[-1])
    point_list.extend(pl)


plugins.HeatMap(start,radius=15).add_to(group_start_heatmap)
plugins.HeatMap(end,radius=15).add_to(group_end_heatmap)
plugins.HeatMap(point_list,radius=10).add_to(group_route_heatmap)
group_end.add_to(m)
group_start.add_to(m)
group_end_heatmap.add_to(m)
group_start_heatmap.add_to(m)
group_route_heatmap.add_to(m)
group_conn.add_to(m)
folium.LayerControl(collapsed=False).add_to(m)
m.save(f'{output}//straight-line.html')