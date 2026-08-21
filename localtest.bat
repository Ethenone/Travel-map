@echo off
echo Starting local server on port 8000...

:: 仅服务当前项目，并限制为本机访问，避免暴露相邻的私有 database 目录
cd /d "%~dp0"
start "Travel Map Server" /min cmd /c "python -m http.server 8000 --bind 127.0.0.1"

:: 等待服务器启动 1 秒
timeout /t 1 >nul

:: 自动打开网页
start "" "http://127.0.0.1:8000/index.html"

echo Server started. Browser opened!
