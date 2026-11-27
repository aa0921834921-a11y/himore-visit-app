@echo off
chcp 65001 >nul
cd /d "%~dp0"
call config.bat
REM 不載入任何模型,回傳示範結果。用來先確認 App 與通道連得上
set FAKE_MODELS=1
set PYTHONIOENCODING=utf-8
if exist .venv\Scripts\python.exe (.venv\Scripts\python.exe server.py) else (python server.py)
pause
