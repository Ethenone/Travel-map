python utils//build_real_rail_routes.py ..//database data
if errorlevel 1 pause & exit /b 1
python utils//build_rail_area_stats.py data
if errorlevel 1 pause & exit /b 1
python utils//draw_real_railway_map.py data map
pause
