# -*- coding: GBK -*-
import folium
import geopandas as gpd
import pandas as pd
from folium import Element
import sys
import numpy as np

database = sys.argv[1]
output = sys.argv[2]

print("reading geojson data")
data = gpd.read_file(f'{database}\\中国_市.geojson')
print("reading citycount")
citydata = pd.read_excel(f'{database}\\途径市.xlsx',sheet_name=0,index_col = 0)


print("drawing map")
# 创建底图
base_map = folium.Map(
    location=[35.0, 105.0],
    tiles='https://webrd04.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}',#'http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attr="&copy; <a href='https://stadiamaps.com/' target='_blank'>Stadia Maps</a> &copy; <a href='https://openmaptiles.org/' target='_blank'>OpenMapTiles</a> &copy; <a href='https://www.openstreetmap.org/copyright' target='_blank'>OpenStreetMap</a>&copy; <a href='https://stamen.com/' target='_blank'>Stamen Design</a>",
    zoom_start=5
)

# 自定义样式函数（根据字段修改颜色等）
count = np.zeros(6)
def style_function(feature):
    name = feature['properties'].get('name', '')
    try:
        citydata.loc[name]
    except:
        return {
            'fillColor': '#dddddd',
            'color': 'gray',
            'weight': 0.5,
            'fillOpacity': 0.2
        }
    if citydata.loc[name,'住居']==1:
        count[5]+=1
        return {
            'fillColor': '#E57373',
            'color': 'gray',
            'weight': 1,
            'fillOpacity': 0.6
        }
    elif citydata.loc[name,'宿泊']==1:
        count[4]+=1
        return {
            'fillColor': '#FFF176',
            'color': 'gray',
            'weight': 1,
            'fillOpacity': 0.6
        }
    elif citydata.loc[name,'访问']==1:
        count[3]+=1
        return {
            'fillColor': '#81C784',
            'color': 'gray',
            'weight': 1,
            'fillOpacity': 0.6
        }
    elif citydata.loc[name,'接地']==1:
        count[2]+=1
        return {
            'fillColor': '#4FC3F7',
            'color': 'gray',
            'weight': 1,
            'fillOpacity': 0.6
        }
    elif citydata.loc[name,'途径']==1:
        count[1]+=1
        return {
            'fillColor': '#BAA6D0',
            'color': 'gray',
            'weight': 1,
            'fillOpacity': 0.6
        }
    else:
        return {
            'fillColor': '#dddddd',
            'color': 'gray',
            'weight': 0.5,
            'fillOpacity': 0.2
        }

# 可选：添加 tooltip 显示字段（如县名）
tooltip = folium.GeoJsonTooltip(
    fields=['name'],       # 替换为你的 GeoJSON 中的字段名，如 '县名'
    aliases=['city:'],      # 显示中文别名
    localize=True
)

# 添加 GeoJson 图层
folium.GeoJson(
    data,
    name='地级区域',
    style_function=style_function,
    tooltip=tooltip
).add_to(base_map)

base_map.save(f"{output}\\map_city.html")
total = 0
for i in range(6):
    total += count[i]*i
# 保存地图
legend_html = f"""
<div style="
    position: fixed;
    bottom: 30px;
    right: 30px;
    z-index: 9999;
    background-color: white;
    padding: 10px;
    border: 2px solid grey;
    border-radius: 6px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    font-size:14px;
">
    <b>Legend</b><br>
    <i style="background:#E57373; width:10px;height:10px;display:inline-block;"></i> 居住 Lived ({int(count[5])})<br>
    <i style="background:#FFF176; width:10px;height:10px;display:inline-block;"></i> 住宿 Stayed ({int(count[4])})<br>
    <i style="background:#81C784; width:10px;height:10px;display:inline-block;"></i> 到访 Visited ({int(count[3])})<br>
    <i style="background:#4FC3F7; width:10px;height:10px;display:inline-block;"></i> 换乘 Alighted ({int(count[2])})<br>
    <i style="background:#BAA6D0; width:10px;height:10px;display:inline-block;"></i> 途径 Passed ({int(count[1])})<br
    <i style="background:#dddddd; width:10px;height:10px;display:inline-block;"></i> 未途径 Never been<br>
    <b>Total city:{int(sum(count))}</b><br>
    <b>Total level:{int(total)}</b>
</div>
"""

base_map.get_root().html.add_child(Element(legend_html))

# 保存地图
base_map.save(f"{output}\\map_city.html")

