@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo  上传 earth-online-rpg 到 GitHub
echo  首次请先运行: gh auth login
echo.
gh auth status >nul 2>&1
if errorlevel 1 (
  echo [错误] 尚未登录 GitHub，请先执行: gh auth login
  pause
  exit /b 1
)
gh repo create earth-online-rpg --public --source=. --remote=origin --push
if errorlevel 1 (
  echo.
  echo 若仓库已存在，可改用手动推送，见 GITHUB_SETUP.md
  pause
  exit /b 1
)
echo.
echo  推送完成。可在 GitHub 仓库 Settings - Pages 开启静态站点。
pause
