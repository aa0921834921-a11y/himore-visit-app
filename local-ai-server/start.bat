@echo off
cd /d "%~dp0"
call config.bat
if not exist .venv\Scripts\python.exe (
  echo Not installed yet. Run install.bat first.
  pause
  exit /b 1
)
set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1
.venv\Scripts\python.exe server.py
pause
