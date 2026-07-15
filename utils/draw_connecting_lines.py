# -*- coding: GBK -*-
import json
import pandas as pd
import folium
import sys

database = sys.argv[1]
output = sys.argv[2]
print("reading airports data")
airportdata = pd.read_csv(f'{database}//airports_data.csv',encoding='gb18030')
#airportdata.head()
airportgeo = {}
for i in range(len(airportdata)):
    airportgeo[airportdata['iata'][i]]=[airportdata['lat'][i],airportdata['lon'][i]]
#print(airportgeo)


print("reading flight travel record")
data = pd.read_excel(f'{database}//飞机乘坐记录.xlsx', sheet_name = 0)
#data.head()

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
data2 = pd.read_excel(f'{database}//火车乘坐记录.xlsx', sheet_name = 0)
#data2.head()


print("drawing map")
m = folium.Map(location=airportgeo['SHA'],
               zoom_start=5,
               control_scale=True,
               control=False,
               tiles=None
              )

folium.TileLayer(tiles='http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',#'https://webrd04.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}',
                 attr="&copy; <a href='https://stadiamaps.com/' target='_blank'>Stadia Maps</a> &copy; <a href='https://openmaptiles.org/' target='_blank'>OpenMapTiles</a> &copy; <a href='https://www.openstreetmap.org/copyright' target='_blank'>OpenStreetMap</a>&copy; <a href='https://stamen.com/' target='_blank'>Stamen Design</a>",
                 min_zoom=0,
                 max_zoom=19,
                 control=True,
                 show=True,
                 overlay=False,
                 name='transportation'
                ).add_to(m)

group_air = folium.FeatureGroup(name='air')
for i in range(len(data)):
    start = airportgeo[data['start'][i]]
    end = airportgeo[data['depart'][i]]
    if start[1] < 0:
        start[1] += 360
    if end[1] < 0:
        end[1] += 360
    # 将西半球经度换算
    folium.PolyLine(
        locations = [start,end],
        color='red',
        weight=3,
        opacity=0.3
    ).add_to(group_air)
    
    
    folium.Circle(
        location=start,
        radius=9000,   # 圆的半径
        popup=folium.Popup(data['起飞'][i],max_width=10),
        color='red', #'#FF1493',
        fill=True,
        fill_color='#FFD700'
    ).add_to(group_air)
    
    folium.Circle(
        location=end,
        radius=9000,   # 圆的半径
        popup=folium.Popup(data['降落'][i],max_width=10),
        color='red', #'#FF1493',
        fill=True,
        fill_color='#FFD700'
    ).add_to(group_air)

group_air.add_to(m)

group_train = folium.FeatureGroup(name='train')
for i in range(len(data2)):
    folium.PolyLine(
        locations = [
            statgeo[data2['上车站'][i]],statgeo[data2['下车站'][i]]
        ],
        color='blue',
        weight=3,
        opacity=0.3
    ).add_to(group_train)
    folium.Circle(
        location=statgeo[data2['上车站'][i]],
        radius=9000,   # 圆的半径
        popup=folium.Popup(data2['上车站'][i],max_width=10),
        color='blue', #'#FF1493',
        fill=True,
        fill_color='#FFD700'
    ).add_to(group_train)
    folium.Circle(
        location=statgeo[data2['下车站'][i]],
        radius=9000,   # 圆的半径
        popup=folium.Popup(data2['下车站'][i],max_width=10),
        color='blue', #'#FF1493',
        fill=True,
        fill_color='#FFD700'
    ).add_to(group_train)



print("reading foreign train travel record")
dataf = pd.read_excel(f'{database}//境外铁路乘坐记录.xlsx', sheet_name = "乘坐列表")
statdataf = pd.read_excel(f'{database}//境外铁路乘坐记录.xlsx',sheet_name='车站位置')

statgeof = {}
for i in range(len(statdataf)):
    lat = statdataf['lat'][i]
    lng = statdataf['lon'][i]
    loc = [lat,lng]
#     loc = correct(loc)
    statgeof[statdataf['车站'][i]]=loc

for i in range(len(dataf)):
    start = statgeof[dataf['上车站'][i]]
    end = statgeof[dataf['下车站'][i]]
    if start[1] < 0:
        start[1] += 360
    if end[1] < 0:
        end[1] += 360
    # 将西半球经度换算
    folium.PolyLine(
        locations = [
            start,end
        ],
        color='blue',
        weight=3,
        opacity=0.3
    ).add_to(group_train)
    folium.Circle(
        location=start,
        radius=9000,   # 圆的半径
        popup=folium.Popup(dataf['上车站'][i],max_width=10),
        color='blue', #'#FF1493',
        fill=True,
        fill_color='#FFD700'
    ).add_to(group_train)
    folium.Circle(
        location=end,
        radius=9000,   # 圆的半径
        popup=folium.Popup(dataf['下车站'][i],max_width=10),
        color='blue', #'#FF1493',
        fill=True,
        fill_color='#FFD700'
    ).add_to(group_train)


group_train.add_to(m)

print("reading car travel record")
datac = pd.read_excel(f'{database}//车行轨迹.xlsx', sheet_name = 0)
group_car = folium.FeatureGroup(name='car',show = False)
for i in range(len(datac)):

    start = [datac['depart_lat'][i],datac['depart_lon'][i]]
    end = [datac['arrive_lat'][i],datac['arrive_lon'][i]]
    if start[1] < 0:
        start[1] += 360
    if end[1] < 0:
        end[1] += 360

    folium.PolyLine(
        locations = [
            start,
            end
        ],
        color='green',
        weight=3,
        opacity=0.3
    ).add_to(group_car)
    folium.Circle(
        location=start,
        radius=9000,   # 圆的半径
        popup=folium.Popup(datac['出发地'][i],max_width=10),
        color='green', #'#FF1493',
        fill=True,
        fill_color='#FFD700'
    ).add_to(group_car)
    folium.Circle(
        location=end,
        radius=9000,   # 圆的半径
        popup=folium.Popup(datac['到达地'][i],max_width=10),
        color='green', #'#FF1493',
        fill=True,
        fill_color='#FFD700'
    ).add_to(group_car)

group_car.add_to(m)


folium.LayerControl(collapsed=False).add_to(m)
m.save(f'{output}//map_line.html')