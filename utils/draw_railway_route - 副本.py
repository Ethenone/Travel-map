# -*- coding: GBK -*-
import json
import pandas as pd
import folium
from folium import plugins
import datetime
import sys

database = sys.argv[1]
output = sys.argv[2]

print("reading station data")
statdata = pd.read_csv(f'{database}//stations_data.csv',encoding='gbk')
#statdata.head()
statgeo = {}
for i in range(len(statdata)):
    lat = statdata['纬度'][i]
    lng = statdata['经度'][i]
    loc = [lat,lng]
#     loc = correct(loc)
    statgeo[statdata['车站'][i]]=loc
#print(statgeo)    

print("reading train travel record")
data = pd.read_excel(f'{database}//火车乘坐记录.xlsx', sheet_name = 0)
data = data.fillna('nan')


print("drawing map")
#绘制路径
# m = folium.Map(location=statgeo['上海'], zoom_start=5)
m = folium.Map(location=statgeo['上海'],
               zoom_start=5,
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
                 name='year'
                ).add_to(m)
polyline_set = []
point_set = []
heatmap_data = []

for i in range(len(data)):
    a = data.iloc[i]
    date = a.iloc[1]
    color = 'blue'
    if type(date) != pd._libs.tslibs.nattype.NaTType:
        dt = pd.to_datetime(date)
        if dt.year>2023:
            color = 'red'
    polyline = []
    
    for p in a[5:]:
        if p == 'nan':
            continue
        if p not in statgeo:
            continue
        loc = statgeo[p]
        name = p
        polyline.append(loc)
        heatmap_data.append(loc)
    
    polyline_set.append([polyline,color])
    point_set.append([loc,color,name])
    point_set.append([statgeo[a.iloc[5]],color,a.iloc[5]])

    
#after = folium.FeatureGroup(name='since 2024')
#before = folium.FeatureGroup(name='before 2024')
group = folium.FeatureGroup(name = 'all')
for polyline,color in polyline_set:
    op = 0.3
    #group  = after
    if color == 'blue':
        op = 0.1
        #group = before
    folium.PolyLine(
        locations = polyline,
        color=color,
        weight=6,
        opacity=op
    ).add_to(group)

for point,color,name in point_set:
    #group = after
    #if color == 'blue':
        #group = before
    folium.Circle(
        location=point,
        radius=9000,   # 圆的半径
        popup=folium.Popup(name,max_width=10),
        color=color, #'#FF1493',
        fill=True,
        fill_color='#FFD700'
    ).add_to(group)

group.add_to(m)
#after.add_to(m)
#before.add_to(m)
#folium.LayerControl(collapsed=False).add_to(m)
m.save(f'{output}/map_rail.html')