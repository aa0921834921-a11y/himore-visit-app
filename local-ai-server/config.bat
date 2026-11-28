@echo off
REM ===== HI-MORE Local AI Server settings =====
REM Edit and save, then restart start.bat

REM API key for the App (change it; enter the same key in the App)
set API_KEY=himore-poc-change-me

REM Speech model: Breeze-ASR-25 (Mandarin+English). For Taiwanese try MediaTek-Research/Breeze-ASR-26
set ASR_MODEL=MediaTek-Research/Breeze-ASR-25

REM Analysis model (Ollama model name). 7B-8B recommended for 8GB GPU
set LLM_MODEL=qwen2.5:7b

REM Photo model (optional, empty = photos not analyzed). Example: qwen2.5vl:7b
set VISION_MODEL=

REM Speaker separation (optional): Hugging Face token, see README
set HF_TOKEN=

REM Context length for analysis (16384 for 8GB GPU)
set LLM_CTX=16384

REM Long transcripts above this many characters are analyzed in parts
set CHUNK_CHARS=6000

REM Long recordings are transcribed in windows of N minutes (for progress)
set ASR_WINDOW_MIN=10

set PORT=8765
