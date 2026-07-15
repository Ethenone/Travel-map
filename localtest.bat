@echo off
echo Starting local server on port 8000...

:: 启动服务器（后台运行）
start cmd /c "python -m http.server 8000"

:: 等待服务器启动 1 秒
timeout /t 1 >nul

:: 自动打开网页
start "" "http://localhost:8000/index.html"

echo Server started. Browser opened!
