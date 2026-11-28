@echo off
cd /d "%~dp0"
call config.bat
echo.
echo ===== HI-MORE Local AI Server : INSTALL =====
echo.

REM ---- 1. Python 3.11
set PY=
py -3.11 --version >nul 2>&1 && set PY=py -3.11
if "%PY%"=="" py -3.12 --version >nul 2>&1 && set PY=py -3.12
if "%PY%"=="" (
  echo [1/6] Python 3.11 not found. Installing with winget...
  winget install -e --id Python.Python.3.11 --accept-package-agreements --accept-source-agreements
  py -3.11 --version >nul 2>&1 && set PY=py -3.11
)
if "%PY%"=="" (
  echo Python install failed. Install Python 3.11 from https://www.python.org/downloads/
  echo then CLOSE this window and run install.bat again.
  pause
  exit /b 1
)
echo [1/6] Using %PY%

REM ---- 2. Virtual environment
if not exist .venv\Scripts\python.exe (
  %PY% -m venv .venv
)
if not exist .venv\Scripts\python.exe (
  echo Failed to create virtual environment.
  pause
  exit /b 1
)
set VPY=.venv\Scripts\python.exe
%VPY% -m pip install --upgrade pip -q

REM ---- 3. PyTorch (CUDA)
echo [2/6] Installing PyTorch with CUDA (about 2.5GB, please wait)...
%VPY% -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu124
if errorlevel 1 (
  echo PyTorch install failed.
  pause
  exit /b 1
)
%VPY% -c "import torch;print('      CUDA available:',torch.cuda.is_available(),'|',torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'NO GPU - update NVIDIA driver')"

REM ---- 4. Other packages
echo [3/6] Installing other packages...
%VPY% -m pip install -r requirements.txt -q
if errorlevel 1 (
  echo Package install failed.
  pause
  exit /b 1
)
if not "%HF_TOKEN%"=="" (
  echo       HF_TOKEN set - installing speaker separation...
  %VPY% -m pip install "pyannote.audio>=3.1,<4" -q
)

REM ---- 5. Speech model
echo [4/6] Downloading speech model %ASR_MODEL% (about 3GB)...
%VPY% -c "from huggingface_hub import snapshot_download;snapshot_download('%ASR_MODEL%')"
if errorlevel 1 echo       Download failed - it will retry on first transcription.

REM ---- 6. Ollama + analysis model
call :find_ollama
if "%OLLAMA%"=="" (
  echo [5/6] Installing Ollama...
  winget install -e --id Ollama.Ollama --accept-package-agreements --accept-source-agreements
  call :find_ollama
)
if "%OLLAMA%"=="" (
  echo Ollama not found. Install from https://ollama.com/download
  echo then CLOSE this window and run install.bat again.
  pause
  exit /b 1
)
echo [5/6] Downloading analysis model %LLM_MODEL% (about 5GB)...
"%OLLAMA%" pull %LLM_MODEL%
if not "%VISION_MODEL%"=="" (
  echo       Downloading photo model %VISION_MODEL%...
  "%OLLAMA%" pull %VISION_MODEL%
)

REM ---- 7. Cloudflare Tunnel
call :find_cf
if "%CF%"=="" (
  echo [6/6] Installing Cloudflare Tunnel...
  winget install -e --id Cloudflare.cloudflared --accept-package-agreements --accept-source-agreements
  call :find_cf
)
if "%CF%"=="" (
  echo [6/6] cloudflared NOT found. Download cloudflared-windows-amd64.msi from
  echo       https://github.com/cloudflare/cloudflared/releases/latest and install it.
) else (
  echo [6/6] Cloudflare Tunnel OK: %CF%
)

echo.
echo ===== INSTALL FINISHED =====
echo 1. Run start.bat  (keep the window open)
echo 2. Run tunnel.bat (copy the https://xxxx.trycloudflare.com address)
echo 3. In the App: enter the address and the API_KEY from config.bat
echo.
pause
exit /b 0

:find_ollama
set OLLAMA=
for %%P in (ollama.exe) do if not "%%~$PATH:P"=="" set "OLLAMA=%%~$PATH:P"
if "%OLLAMA%"=="" if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" set "OLLAMA=%LOCALAPPDATA%\Programs\Ollama\ollama.exe"
exit /b 0

:find_cf
set CF=
for %%P in (cloudflared.exe) do if not "%%~$PATH:P"=="" set "CF=%%~$PATH:P"
if "%CF%"=="" if exist "%ProgramFiles(x86)%\cloudflared\cloudflared.exe" set "CF=%ProgramFiles(x86)%\cloudflared\cloudflared.exe"
if "%CF%"=="" if exist "%ProgramFiles%\cloudflared\cloudflared.exe" set "CF=%ProgramFiles%\cloudflared\cloudflared.exe"
if "%CF%"=="" if exist "%LOCALAPPDATA%\Microsoft\WinGet\Links\cloudflared.exe" set "CF=%LOCALAPPDATA%\Microsoft\WinGet\Links\cloudflared.exe"
if "%CF%"=="" if exist "%~dp0cloudflared.exe" set "CF=%~dp0cloudflared.exe"
exit /b 0
