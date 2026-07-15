# -*- coding: GBK -*-
import folium
import geopandas as gpd
import pandas as pd
import json
import polyline
import os
import sys

database = sys.argv[1]
output = sys.argv[2]

print("reading visited region")
countrydata = pd.read_csv(f'{database}\\上海市\\上海市.csv',index_col = 0, encoding='GBK')
files = os.listdir(f'{database}\\上海市\\上海市分街道')
def count(group):
    return pd.Series({
        'visited': group['到访'].sum(),
        'total': group['市辖区'].count()
    })
group = countrydata.groupby('市辖区').apply(count)

print("drawing map")
# 创建底图
base_map = folium.Map(
    location=[31.0100,121.4737],
    zoom_start=10,
    control_scale=True,
    control=False,
    tiles=None
)
folium.TileLayer(tiles='http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
                 name='degree of exploration',
                 attr="&copy; <a href='https://stadiamaps.com/' target='_blank'>Stadia Maps</a> &copy; <a href='https://openmaptiles.org/' target='_blank'>OpenMapTiles</a> &copy; <a href='https://www.openstreetmap.org/copyright' target='_blank'>OpenStreetMap</a>&copy; <a href='https://stamen.com/' target='_blank'>Stamen Design</a>",
                 min_zoom=0,
                 max_zoom=19,
                 control=True,
                 show=True,
                 overlay=False,
                ).add_to(base_map)


# 自定义样式函数（根据字段修改颜色等）
def style_function(feature):
    name = feature['properties'].get('name', '')
    try:
        countrydata.loc[name]
    except:
        return {
            'fillColor': '#4FC3F7',
            'color': 'gray',
            'weight': 0.5,
            'fillOpacity': 0.2
        }
    if countrydata.loc[name,'到访']==1:
        return {
            'fillColor': '#E57373',
            'color': 'gray',
            'weight': 1,
            'fillOpacity': 0.4
        }
    else:
        return {
            'fillColor': '#4FC3F7',
            'color': 'gray',
            'weight': 0.5,
            'fillOpacity': 0.4
        }

for file in files:
    country = gpd.read_file(f'{database}\\上海市\\上海市分街道\\{file}')
    name = file[:-5]
    visited = int(group.loc[name,'visited'])
    total = int(group.loc[name,'total'])
    tooltip = folium.GeoJsonTooltip(
        fields=['name'],       # 替换为你的 GeoJSON 中的字段名，如 '县名'
        aliases=[f'{name}:'],
        localize=True
    )
    district = folium.FeatureGroup(name=f'{name}:{visited}/{total}')
    folium.GeoJson(country,
                   tooltip = tooltip,
                   style_function=style_function,
                  ).add_to(district)
    district.add_to(base_map)
folium.LayerControl(collapsed=False).add_to(base_map)


#绘制上海骑行路径
print("drawing route map")
with open(f'{database}\\activities.json','r') as file:
    data = json.load(file)

def transfer(loc):
    iloc = []
    for i in loc:
        iloc.append([i[0],i[1]])
    return iloc

for i in data:
    if not i['summary_polyline']:
        continue
    citystr = i['location_country'].replace("\'","\"").replace("None","\"None\"")
    #print(citystr)
    j = json.loads(citystr)
    if j['city'] != '上海市':
        continue
    pl = polyline.decode(i['summary_polyline'])
    folium.PolyLine(
        locations = transfer(pl),
        color = 'red',
        weight=3,
        opacity=0.5
    ).add_to(base_map)

# 保存地图
base_map.save(f"{output}\\map_shanghai.html")

