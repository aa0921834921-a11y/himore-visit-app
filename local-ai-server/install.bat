@echo off
chcp 65001 >nul
cd /d "%~dp0"
call config.bat
echo.
echo ===== 哈鏌本機 AI 伺服器:安裝 =====
echo.

REM ---- 1. Python 3.11
set PY=
py -3.11 --version >nul 2>&1 && set PY=py -3.11
if "%PY%"=="" (
  py -3.12 --version >nul 2>&1 && set PY=py -3.12
)
if "%PY%"=="" (
  echo [1/6] 找不到 Python 3.11,嘗試用 winget 安裝...
  winget install -e --id Python.Python.3.11 --accept-package-agreements --accept-source-agreements
  py -3.11 --version >nul 2>&1 && set PY=py -3.11
)
if "%PY%"=="" (
  echo 安裝 Python 失敗。請到 https://www.python.org/downloads/ 安裝 Python 3.11 後再執行一次。
  pause & exit /b 1
)
echo [1/6] 使用 %PY%

REM ---- 2. 虛擬環境
if not exist .venv (
  %PY% -m venv .venv || (echo 建立虛擬環境失敗 & pause & exit /b 1)
)
set VPY=.venv\Scripts\python.exe
%VPY% -m pip install --upgrade pip -q

REM ---- 3. PyTorch(CUDA 版)
echo [2/6] 安裝 PyTorch(CUDA,檔案約 2.5GB,請耐心等候)...
%VPY% -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu124 || (echo 安裝 PyTorch 失敗 & pause & exit /b 1)
%VPY% -c "import torch;print('      CUDA 可用:',torch.cuda.is_available(),'|',torch.cuda.get_device_name(0) if torch.cuda.is_available() else '未偵測到顯示卡,請更新 NVIDIA 驅動程式')"

REM ---- 4. 其他套件
echo [3/6] 安裝其他套件...
%VPY% -m pip install -r requirements.txt -q || (echo 安裝套件失敗 & pause & exit /b 1)
if not "%HF_TOKEN%"=="" (
  echo       已設定 HF_TOKEN,安裝語者分離套件...
  %VPY% -m pip install "pyannote.audio>=3.1,<4" -q
)

REM ---- 5. 下載語音模型
echo [4/6] 下載語音模型 %ASR_MODEL%(約 3GB)...
%VPY% -c "from huggingface_hub import snapshot_download;snapshot_download('%ASR_MODEL%')" || echo       下載失敗,第一次轉寫時會再自動下載

REM ---- 6. Ollama 與語言模型
where ollama >nul 2>&1
if errorlevel 1 (
  echo [5/6] 安裝 Ollama...
  winget install -e --id Ollama.Ollama --accept-package-agreements --accept-source-agreements
  set "PATH=%PATH%;%LOCALAPPDATA%\Programs\Ollama"
)
where ollama >nul 2>&1
if errorlevel 1 (
  echo 找不到 Ollama。請到 https://ollama.com/download 安裝後,重新開啟視窗再執行一次。
  pause & exit /b 1
)
echo [5/6] 下載語言模型 %LLM_MODEL%(約 5GB)...
ollama pull %LLM_MODEL%
if not "%VISION_MODEL%"=="" (
  echo       下載視覺模型 %VISION_MODEL%...
  ollama pull %VISION_MODEL%
)

REM ---- 7. Cloudflare Tunnel(讓手機從外面連進來)
where cloudflared >nul 2>&1
if errorlevel 1 (
  echo [6/6] 安裝 Cloudflare Tunnel...
  winget install -e --id Cloudflare.cloudflared --accept-package-agreements --accept-source-agreements
) else (
  echo [6/6] Cloudflare Tunnel 已安裝
)

echo.
echo ===== 安裝完成 =====
echo 1. 執行 start.bat 啟動伺服器
echo 2. 另開一個視窗執行 tunnel.bat,取得 https://xxxx.trycloudflare.com 網址
echo 3. App「AI 伺服器設定」填入網址與金鑰(config.bat 的 API_KEY)
echo.
pause
