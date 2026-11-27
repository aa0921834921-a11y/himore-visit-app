@echo off
chcp 65001 >nul
cd /d "%~dp0"
call config.bat
echo.
echo 啟動 Cloudflare 臨時通道。等一下畫面會出現一行
echo     https://xxxx-xxxx.trycloudflare.com
echo 把這個網址填到 App 的「AI 伺服器設定」。
echo 注意:每次重新執行網址都會不同;關掉這個視窗手機就連不到。
echo.
cloudflared tunnel --url http://localhost:%PORT%
pause
