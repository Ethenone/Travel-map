python utils//railway_conclusion.py ..//database data
if errorlevel 1 pause & exit /b 1
python utils//build_travel_totals.py ..//database data
if errorlevel 1 pause & exit /b 1
python utils//build_rail_area_stats.py data
if errorlevel 1 pause & exit /b 1
pause