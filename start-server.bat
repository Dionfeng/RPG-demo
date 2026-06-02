@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo  人生 RPG 本地服务
echo  浏览器打开: http://localhost:5173
echo  按 Ctrl+C 停止
echo.
python -m http.server 5173
pause
