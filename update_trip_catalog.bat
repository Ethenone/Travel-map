@echo off
setlocal
cd /d "%~dp0"
python utils\build_trip_catalog.py
if errorlevel 1 (
  echo Trip catalog update failed. Check Python, required packages, and source workbooks.
  pause
  exit /b 1
)
echo Trip catalog updated. Refresh TravelAtlasTrips.html to see the latest records.
pause
