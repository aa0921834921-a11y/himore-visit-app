@echo off
cd /d "%~dp0"
call config.bat
set CF=
for %%P in (cloudflared.exe) do if not "%%~$PATH:P"=="" set "CF=%%~$PATH:P"
if "%CF%"=="" if exist "%ProgramFiles(x86)%\cloudflared\cloudflared.exe" set "CF=%ProgramFiles(x86)%\cloudflared\cloudflared.exe"
if "%CF%"=="" if exist "%ProgramFiles%\cloudflared\cloudflared.exe" set "CF=%ProgramFiles%\cloudflared\cloudflared.exe"
if "%CF%"=="" if exist "%LOCALAPPDATA%\Microsoft\WinGet\Links\cloudflared.exe" set "CF=%LOCALAPPDATA%\Microsoft\WinGet\Links\cloudflared.exe"
if "%CF%"=="" if exist "%~dp0cloudflared.exe" set "CF=%~dp0cloudflared.exe"
if "%CF%"=="" (
  echo cloudflared not found. Installing with winget...
  winget install -e --id Cloudflare.cloudflared --accept-package-agreements --accept-source-agreements
  if exist "%ProgramFiles(x86)%\cloudflared\cloudflared.exe" set "CF=%ProgramFiles(x86)%\cloudflared\cloudflared.exe"
  if exist "%ProgramFiles%\cloudflared\cloudflared.exe" set "CF=%ProgramFiles%\cloudflared\cloudflared.exe"
)
if "%CF%"=="" (
  echo.
  echo cloudflared still not found.
  echo Download cloudflared-windows-amd64.exe from
  echo   https://github.com/cloudflare/cloudflared/releases/latest
  echo rename it to cloudflared.exe and put it in this folder, then run tunnel.bat again.
  pause
  exit /b 1
)
echo.
echo Starting Cloudflare quick tunnel. Look for a line like:
echo     https://xxxx-xxxx.trycloudflare.com
echo Enter that address in the App (AI server settings).
echo NOTE: the address changes every time. Closing this window disconnects the App.
echo.
"%CF%" tunnel --url http://localhost:%PORT%
pause
