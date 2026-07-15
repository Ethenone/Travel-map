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
stat_affiliation = {}
for i,row in statdata.iterrows():
    lat = row['纬度']
    lng = row['经度']
    loc = [lat,lng]
#     loc = correct(loc)
    statgeo[row['车站']]=loc
    stat_affiliation[row['车站']]={'lat':lat,'lng':lng,
                                 'bureau':row['路局'],
                                 'city':row['市'],
                                 'province':row['省']}
#print(statgeo)    

print("reading train travel record")
data = pd.read_excel(f'{database}//火车乘坐记录.xlsx', sheet_name = 0)
data = data.fillna('nan')
data2 = pd.read_excel(f'{database}//火车乘坐记录.xlsx', sheet_name = '乘坐列表')
data2 = data2.fillna('nan')
print(data2)

print("drawing map")
#绘制路径
# m = folium.Map(location=statgeo['上海'], zoom_start=5)
m = folium.Map(location=statgeo['上海'],
               zoom_start=5,
               control_scale=True,
               control=False,
               tiles=None
              )

folium.TileLayer(tiles='https://webrd04.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}',#'http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
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
    train = a['车次']
    date = a.iloc[1]
    color = 'blue'
    #if type(date) != pd._libs.tslibs.nattype.NaTType:
    #    dt = pd.to_datetime(date)
    #    if dt.year>2024:
    #        color = 'red'
    b = data2.iloc[i]
    #if b['上车站'] == '大同南' or b['下车站'] == '大同南':
    #    color = 'blue'
    duration = int(b['时长.1'])
    distance = int(b['里程'])
    From = b['上车站']
    To = b['下车站']
    Fromcity = stat_affiliation[From]['city']
    Tocity = stat_affiliation[To]['city']
    Fromprov = stat_affiliation[From]['province']
    Toprov = stat_affiliation[To]['province']
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
    
    polyline_set.append([polyline,color,train,duration,distance,From,To,Fromcity,Tocity,Fromprov,Toprov])
    point_set.append([loc,color,name,train,duration,distance,From,To,Fromcity,Tocity,Fromprov,Toprov])
    point_set.append([statgeo[a.iloc[5]],color,a.iloc[5],train,duration,distance,From,To,Fromcity,Tocity,Fromprov,Toprov])

    
#after = folium.FeatureGroup(name='since 2024')
#before = folium.FeatureGroup(name='before 2024')
group = folium.FeatureGroup(name = 'all')
group1 = folium.FeatureGroup(name = 'discard')
for polyline,color,train,duration,distance,From,To,Fromcity,Tocity,Fromprov,Toprov in polyline_set:
    op = 0.3
    #group  = after
    if color == 'blue':
        op = 0.1
        #group = before
    geojson = {
        "type":"Feature",
        "properties":{"id":str(train),
                      "duration":duration,
                      "distance":distance,
                      "from":From,
                      "to":To,
                      "fromcity":Fromcity,
                      "tocity":Tocity,
                      "fromprov":Fromprov,
                      "toprov":Toprov},
        "geometry":{
            "type":"LineString",
            "coordinates":[[lng,lat] for lat, lng in polyline]}
    }
    #print(geojson)
    folium.GeoJson(
        geojson,
        name = train,
        color=color,
        weight=6,
        opacity=op
    ).add_to(group)

for point,color,name,train,duration,distance,From,To,Fromcity,Tocity,Fromprov,Toprov in point_set:
    #group = after
    #if color == 'blue':
        #group = before
    geojson = {
        "type":"Feature",
        "properties":{"id":str(train),
                      "duration":duration,
                      "distance":distance,
                      "from":From,
                      "to":To,
                      "fromcity":Fromcity,
                      "tocity":Tocity,
                      "fromprov":Fromprov,
                      "toprov":Toprov},
        "geometry":{
            "type":"Point",
            "coordinates":[point[1],point[0]]}
    }
    folium.GeoJson(
        geojson,
        name = train,
        popup=folium.Popup(name,max_width=10),
        marker=folium.CircleMarker(
        radius=3,  # 默认半径，会被style_function覆盖
        fill=True,
        fill_color='#FFD700',
        color=color #'#FF1493',
        )
    ).add_to(group1)

group.add_to(m)
#after.add_to(m)
#before.add_to(m)
#folium.LayerControl(collapsed=False).add_to(m)
from folium import Element
map_var = m.get_name()
custom_html = f"""
<script>

    window.addEventListener("message", function (event) {{
        const msg = event.data;
        if (msg.type === "highlight_train") {{
            highlightRoute(msg.train);
        }}
        else if (msg.type === "Travel Duration") {{
            highlightDuration(msg.start, msg.end);
        }}
        else if (msg.type === "Travel Distance") {{
            highlightDistance(msg.start, msg.end);
        }}
        else if (msg.type === "highlight_station") {{
            highlightStation(msg.station);
        }}
        else if (msg.type === "highlight_city"){{
            highlightCity(msg.city);
        }}
        else if (msg.type === "highlight_prov"){{
            highlightProv(msg.prov);
        }}
        else if (msg.type === "highlight_train_type"){{
            highlightTrainType(msg.train_type);
        }}
    }});
    function highlightTrainType(train_type) {{
        {map_var}.eachLayer(function (layer) {{
            if (layer.feature) {{
                let train = layer.feature.properties.id;
                let flag = false;
                if (/^[A-Za-z]/.test(train)) flag = ( train[0] === train_type);
                else flag = (train_type === "数字车次");
                if (flag) {{
                    layer.setStyle({{
                        color: "red",
                        weight: 6,
                        opacity: 0.7
                    }});
                }}
                else {{
                    layer.setStyle({{
                        color: "blue",
                        weight: 3,
                        opacity: 0.2
                    }});
                }};
            }}
        }});
    }}
    function highlightProv(prov) {{
        {map_var}.eachLayer(function (layer) {{
            if (layer.feature) {{
                if (layer.feature.properties.fromprov === prov || layer.feature.properties.toprov === prov) {{
                    layer.setStyle({{
                        color: "red",
                        weight: 6,
                        opacity: 0.7
                    }});
                }}
                else {{
                    layer.setStyle({{
                        color: "blue",
                        weight: 3,
                        opacity: 0.2
                    }});
                }};
            }}
        }});
    }}
    function highlightCity(city) {{
        {map_var}.eachLayer(function (layer) {{
            if (layer.feature) {{
                if (layer.feature.properties.fromcity === city || layer.feature.properties.tocity === city) {{
                    layer.setStyle({{
                        color: "red",
                        weight: 6,
                        opacity: 0.7
                    }});
                }}
                else {{
                    layer.setStyle({{
                        color: "blue",
                        weight: 3,
                        opacity: 0.2
                    }});
                }};
            }}
        }});
    }}
    function highlightStation(station) {{
        {map_var}.eachLayer(function (layer) {{
            if (layer.feature) {{
                if (layer.feature.properties.from === station || layer.feature.properties.to === station) {{
                    layer.setStyle({{
                        color: "red",
                        weight: 6,
                        opacity: 0.7
                    }});
                }}
                else {{
                    layer.setStyle({{
                        color: "blue",
                        weight: 3,
                        opacity: 0.2
                    }});
                }};
            }}
        }});
    }}
    function highlightDistance(start, end) {{
        {map_var}.eachLayer(function (layer) {{
            if (layer.feature) {{
                if (layer.feature.properties.distance >= start && layer.feature.properties.distance < end) {{
                    layer.setStyle({{
                        color: "red",
                        weight: 6,
                        opacity: 0.7
                    }});
                }}
                else {{
                    layer.setStyle({{
                        color: "blue",
                        weight: 3,
                        opacity: 0.2
                    }});
                }};
            }}
        }});
    }}
    function highlightDuration(start, end) {{
        {map_var}.eachLayer(function (layer) {{
            if (layer.feature) {{
                if (layer.feature.properties.duration >= start && layer.feature.properties.duration < end) {{
                    layer.setStyle({{
                        color: "red",
                        weight: 6,
                        opacity: 0.7
                    }});
                }}
                else {{
                    layer.setStyle({{
                        color: "blue",
                        weight: 3,
                        opacity: 0.2
                    }});
                }};
            }}
        }});
    }}
    function highlightRoute(train) {{

        {map_var}.eachLayer(function (layer) {{
            if (layer.feature) {{
                if (layer.feature.properties.id === train) {{
                    layer.setStyle({{
                        color: "red",
                        weight: 6,
                        opacity: 1
                    }});
                }}
                else {{
                    layer.setStyle({{
                        color: "blue",
                        weight: 3,
                        opacity: 0.2
                    }});
                }};
            }} 
        }});
    }}
    

</script>
"""
m.get_root().html.add_child(Element(custom_html))
m.save(f'{output}/map_rail.html')
