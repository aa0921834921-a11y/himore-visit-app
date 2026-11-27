@echo off
chcp 65001 >nul
cd /d "%~dp0"
call config.bat
if not exist .venv\Scripts\python.exe (
  echo 尚未安裝,請先執行 install.bat
  pause & exit /b 1
)
set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1
.venv\Scripts\python.exe server.py
pause
