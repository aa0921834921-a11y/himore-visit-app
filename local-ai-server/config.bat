@echo off
REM ===== 哈鏌本機 AI 伺服器設定 =====
REM 改完存檔,重新執行 start.bat 生效

REM App 連線用的金鑰(請改成自己的,App 設定要填一樣的)
set API_KEY=himore-poc-change-me

REM 語音模型:台灣華語+英文用 Breeze-ASR-25;想試台語改成 MediaTek-Research/Breeze-ASR-26
set ASR_MODEL=MediaTek-Research/Breeze-ASR-25

REM 分析用的語言模型(Ollama 模型名稱)。8GB 顯示卡建議 7B~8B 等級
set LLM_MODEL=qwen2.5:7b

REM 照片辨識用的視覺模型(選配,留空=不辨識照片)。例:qwen2.5vl:7b
set VISION_MODEL=

REM 語者分離(選配):填入 Hugging Face token 才啟用,詳見 README
set HF_TOKEN=

REM 分析時可讀的長度(越大越吃顯示記憶體;8GB 建議 16384)
set LLM_CTX=16384

REM 長錄音:逐字稿超過這個字數就分段整理再彙整(約一小時對話 = 1 萬多字)
set CHUNK_CHARS=6000

REM 長錄音每幾分鐘一段轉寫(用來回報進度)
set ASR_WINDOW_MIN=10

set PORT=8765
