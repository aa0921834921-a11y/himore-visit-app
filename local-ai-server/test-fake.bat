@echo off
cd /d "%~dp0"
call config.bat
REM Demo mode: no models loaded, returns sample results (to test App connection)
set FAKE_MODELS=1
set PYTHONIOENCODING=utf-8
if exist .venv\Scripts\python.exe (
  .venv\Scripts\python.exe server.py
) else (
  echo Not installed yet. Run install.bat first.
)
pause
