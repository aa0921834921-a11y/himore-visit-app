# -*- coding: utf-8 -*-
"""
哈鏌業務管理平台 — 本機 AI 伺服器(POC)

在一台有 NVIDIA 顯示卡的電腦上執行,提供 App 三種服務:
  1. 語音轉文字:MediaTek Breeze ASR 25(台灣華語+英文;可改 Breeze ASR 26 台語)
     語者分離(選配):pyannote,需 Hugging Face token
  2. 照片/檔案轉文字:PDF、Word、Excel、PowerPoint、純文字;照片與掃描 PDF 交給視覺模型(選配)
  3. 整合分析:Ollama 上的開源語言模型,依題組逐題比對、整理摘要、待辦、偏好與題外內容

所有工作排隊、依序在顯示卡上執行(8GB 顯示記憶體也能跑),App 以「建立工作 → 輪詢結果」方式呼叫,
避免長錄音超過通道(Cloudflare Tunnel)的請求時間限制。

設定都用環境變數(見 config.bat),全部免費、開源,資料不離開這台電腦。
"""
from __future__ import annotations

import io
import json
import os
import re
import threading
import time
import traceback
import uuid
from collections import OrderedDict
from datetime import date
from typing import Any, Callable

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ---------------------------------------------------------------- 設定

ASR_MODEL = os.environ.get("ASR_MODEL", "MediaTek-Research/Breeze-ASR-25")
LLM_MODEL = os.environ.get("LLM_MODEL", "qwen2.5:7b")
VISION_MODEL = os.environ.get("VISION_MODEL", "")  # 例:qwen2.5vl:7b;留空=照片不辨識
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
LLM_CTX = int(os.environ.get("LLM_CTX", "16384"))
CHUNK_CHARS = int(os.environ.get("CHUNK_CHARS", "6000"))  # 逐字稿超過這個字數就分段整理再彙整
ASR_WINDOW_MIN = int(os.environ.get("ASR_WINDOW_MIN", "10"))  # 長錄音每幾分鐘一段轉寫(用來回報進度)
HF_TOKEN = os.environ.get("HF_TOKEN", "")  # 有填才啟用語者分離
API_KEY = os.environ.get("API_KEY", "")  # App 呼叫時要帶 X-Api-Key;留空=不檢查(只建議在區網測試)
FAKE = os.environ.get("FAKE_MODELS", "") == "1"  # 不載入模型,回傳示範結果(測試 App 串接用)
VERSION = "0.2.0"

app = FastAPI(title="HI-MORE Local AI", version=VERSION)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def check_key(key: str | None):
    if API_KEY and key != API_KEY:
        raise HTTPException(status_code=401, detail="API 金鑰不正確")


# ---------------------------------------------------------------- 繁體轉換(模型偶爾輸出簡體)

try:
    from opencc import OpenCC  # opencc-python-reimplemented

    _cc = OpenCC("s2t")  # 只轉字形,不換用語(避免「數據」被改成「資料」)

    def to_tw(s: str) -> str:
        if not s:
            return s
        return _cc.convert(s).replace("臺", "台").replace("裏", "裡").replace("瞭解", "了解")
except Exception:  # pragma: no cover

    def to_tw(s: str) -> str:
        return s


def deep_tw(x: Any) -> Any:
    if isinstance(x, str):
        return to_tw(x)
    if isinstance(x, list):
        return [deep_tw(i) for i in x]
    if isinstance(x, dict):
        return {k: (v if k in ("id", "question_id", "segment_ids", "segment_id", "status", "type", "target", "kind", "due", "field", "visit_kind") else deep_tw(v)) for k, v in x.items()}
    return x


# ---------------------------------------------------------------- 工作佇列(單一顯示卡,依序執行)

class Jobs:
    def __init__(self):
        self.items: "OrderedDict[str, dict]" = OrderedDict()
        self.lock = threading.Lock()
        self.cv = threading.Condition(self.lock)
        threading.Thread(target=self._worker, daemon=True).start()

    def submit(self, kind: str, fn: Callable[[Callable[[str], None]], Any]) -> str:
        jid = uuid.uuid4().hex[:12]
        with self.cv:
            self.items[jid] = {"id": jid, "kind": kind, "status": "queued", "progress": "排隊中", "fn": fn, "created": time.time()}
            while len(self.items) > 200:
                self.items.popitem(last=False)
            self.cv.notify()
        return jid

    def get(self, jid: str) -> dict | None:
        with self.lock:
            j = self.items.get(jid)
            if not j:
                return None
            ahead = sum(1 for x in self.items.values() if x["status"] == "queued" and x["created"] < j["created"])
            return {k: v for k, v in j.items() if k != "fn"} | {"queue_ahead": ahead}

    def _worker(self):
        while True:
            with self.cv:
                job = next((j for j in self.items.values() if j["status"] == "queued"), None)
                if not job:
                    self.cv.wait()
                    continue
                job["status"] = "running"

            def progress(msg: str, _j=job):
                _j["progress"] = msg

            try:
                job["result"] = job["fn"](progress)
                job["status"] = "done"
                job["progress"] = "完成"
            except Exception as e:  # noqa: BLE001
                traceback.print_exc()
                job["status"] = "error"
                job["error"] = str(e) or e.__class__.__name__
            job.pop("fn", None)


jobs = Jobs()

# ---------------------------------------------------------------- 語音轉文字

_asr = {"pipe": None, "device": None}
_diar = {"pipe": None, "failed": False}


def gpu_name() -> str:
    if FAKE:
        return "FAKE"
    try:
        import torch

        return torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU(未偵測到 CUDA)"
    except Exception:
        return "未安裝 torch"


def ollama_unload(model: str):
    """把 Ollama 的模型移出顯示記憶體,讓出空間給語音模型"""
    try:
        import requests

        requests.post(f"{OLLAMA_URL}/api/generate", json={"model": model, "keep_alive": 0}, timeout=10)
    except Exception:
        pass


def asr_pipe():
    import torch
    from transformers import pipeline

    dev = "cuda:0" if torch.cuda.is_available() else "cpu"
    if _asr["pipe"] is None:
        _asr["pipe"] = pipeline(
            "automatic-speech-recognition",
            model=ASR_MODEL,
            torch_dtype=torch.float16 if dev != "cpu" else torch.float32,
            device=dev,
        )
        _asr["device"] = dev
    elif _asr["device"] != dev:
        _asr["pipe"].model.to(dev)
        _asr["device"] = dev
    return _asr["pipe"]


def asr_offload():
    """分析前把語音模型移到主記憶體,讓語言模型用顯示卡"""
    if _asr["pipe"] is not None and _asr["device"] != "cpu":
        import torch

        _asr["pipe"].model.to("cpu")
        _asr["device"] = "cpu"
        torch.cuda.empty_cache()


def decode_audio(data: bytes):
    """任何格式(m4a、webm、mp3、wav)→ 16kHz 單聲道 float32;用 PyAV,不需另外安裝 ffmpeg"""
    import av
    import numpy as np

    container = av.open(io.BytesIO(data))
    stream = next(s for s in container.streams if s.type == "audio")
    resampler = av.audio.resampler.AudioResampler(format="flt", layout="mono", rate=16000)
    chunks = []
    for frame in container.decode(stream):
        for f in resampler.resample(frame):
            chunks.append(f.to_ndarray().reshape(-1))
    for f in resampler.resample(None):
        chunks.append(f.to_ndarray().reshape(-1))
    container.close()
    return np.concatenate(chunks) if chunks else np.zeros(0, dtype="float32")


def diarize(audio, sr=16000):
    if not HF_TOKEN or _diar["failed"]:
        return None
    try:
        import torch
        from pyannote.audio import Pipeline

        if _diar["pipe"] is None:
            _diar["pipe"] = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1", use_auth_token=HF_TOKEN)
            if torch.cuda.is_available():
                _diar["pipe"].to(torch.device("cuda"))
        wav = torch.from_numpy(audio).unsqueeze(0)
        ann = _diar["pipe"]({"waveform": wav, "sample_rate": sr})
        return [(t.start, t.end, spk) for t, _, spk in ann.itertracks(yield_label=True)]
    except Exception:
        traceback.print_exc()
        _diar["failed"] = True
        return None


def speaker_at(turns, start, end):
    if not turns:
        return None
    best, score = None, 0.0
    for s, e, spk in turns:
        ov = min(e, end) - max(s, start)
        if ov > score:
            best, score = spk, ov
    return best


def fmt_dur(sec: float) -> str:
    sec = int(sec)
    return f"{sec // 3600} 小時 {sec % 3600 // 60} 分" if sec >= 3600 else f"{sec // 60} 分 {sec % 60} 秒"


def split_windows(audio, sr=16000):
    """長錄音切成約 ASR_WINDOW_MIN 分鐘一段,切點選在附近最安靜的地方,避免切斷句子"""
    import numpy as np

    n = len(audio)
    win = ASR_WINDOW_MIN * 60 * sr
    if n <= win * 1.2:
        return [(0, n)]
    out, start = [], 0
    while n - start > win * 1.2:
        target = start + win
        lo, hi = max(start + sr, target - 5 * sr), min(n - sr, target + 5 * sr)
        seg = np.abs(audio[lo:hi])
        frame = sr // 10  # 0.1 秒
        k = len(seg) // frame
        if k > 0:
            energy = seg[: k * frame].reshape(k, frame).mean(axis=1)
            cut = lo + int(energy.argmin()) * frame + frame // 2
        else:
            cut = target
        out.append((start, cut))
        start = cut
    out.append((start, n))
    return out


def transcribe_bytes(data: bytes, diarization: bool, progress) -> dict:
    if FAKE:
        time.sleep(1.5)
        return {
            "duration": 42.0,
            "segments": [
                {"start": 0, "end": 8, "speaker": "語者A", "text": "張經理您好,今天主要是來了解貴公司現有的射出機狀況。"},
                {"start": 8, "end": 20, "speaker": "語者B", "text": "我們現在有八台三百五十噸的機台,用了快十年,有兩台常常故障,維修費很高。"},
                {"start": 20, "end": 30, "speaker": "語者B", "text": "預算大概五百萬左右,老闆希望年底前完成評估,不想再被比價。"},
                {"start": 30, "end": 42, "speaker": "語者A", "text": "了解,我下週三前把 GT 系列的報價和節能數據寄給您。"},
            ],
        }
    progress("解碼音檔")
    audio = decode_audio(data)
    dur = len(audio) / 16000
    if dur < 0.3:
        return {"duration": dur, "segments": []}
    ollama_unload(LLM_MODEL)
    if VISION_MODEL:
        ollama_unload(VISION_MODEL)
    pipe = asr_pipe()
    windows = split_windows(audio)
    chunks = []
    for wi, (ws, we) in enumerate(windows):
        if len(windows) > 1:
            progress(f"語音轉文字 {wi + 1}/{len(windows)}(音檔共 {fmt_dur(dur)})")
        else:
            progress(f"語音轉文字中(音檔 {fmt_dur(dur)})")
        out = pipe(
            {"raw": audio[ws:we], "sampling_rate": 16000},
            chunk_length_s=30,
            batch_size=4,
            return_timestamps=True,
            generate_kwargs={"language": "zh", "task": "transcribe"},
        )
        off = ws / 16000
        part = out.get("chunks") or [{"timestamp": (0, (we - ws) / 16000), "text": out.get("text", "")}]
        for c in part:
            a, b = c.get("timestamp") or (0, None)
            chunks.append({"timestamp": (float(a or 0) + off, (float(b) + off) if b is not None else (we / 16000)), "text": c.get("text", "")})
    turns = None
    if diarization and HF_TOKEN:
        progress("分辨說話者")
        turns = diarize(audio)
    names: dict[str, str] = {}
    segs = []
    for c in chunks:
        text = to_tw((c.get("text") or "").strip())
        if not text:
            continue
        s, e = c.get("timestamp") or (0, None)
        s = float(s or 0)
        e = float(e if e is not None else dur)
        spk = speaker_at(turns, s, e)
        if spk is not None:
            spk = names.setdefault(spk, f"語者{chr(65 + len(names))}")
        # 同一位說話者的連續短句合併,逐字稿比較好讀
        if segs and segs[-1]["speaker"] == spk and len(segs[-1]["text"]) < 120 and s - segs[-1]["end"] < 2:
            segs[-1]["text"] += text if re.search(r"[,。!?,.!?]$", segs[-1]["text"]) else "," + text
            segs[-1]["end"] = e
        else:
            segs.append({"start": round(s, 1), "end": round(e, 1), "speaker": spk, "text": text})
    return {"duration": dur, "segments": segs}


# ---------------------------------------------------------------- 照片/檔案轉文字

def ollama_chat(model: str, messages: list, fmt: Any = None, temperature=0.2, ctx=LLM_CTX, timeout=900) -> str:
    import requests

    body: dict[str, Any] = {"model": model, "messages": messages, "stream": False, "options": {"temperature": temperature, "num_ctx": ctx}}
    if fmt is not None:
        body["format"] = fmt
    r = requests.post(f"{OLLAMA_URL}/api/chat", json=body, timeout=timeout)
    if r.status_code == 404:
        raise RuntimeError(f"Ollama 找不到模型 {model},請先執行:ollama pull {model}")
    r.raise_for_status()
    return r.json()["message"]["content"]


def vision_read(img_bytes: bytes, name: str) -> str:
    if not VISION_MODEL:
        return f"(照片「{name}」:未設定視覺模型,未辨識內容)"
    import base64

    asr_offload()
    ollama_unload(LLM_MODEL)
    prompt = (
        "這是一張業務拜訪時拍的照片(可能是名片、設備銘牌、手寫筆記、型錄、報價單或工廠現場)。"
        "請用繁體中文:1) 先判斷照片類型;2) 逐字抄出照片中所有看得清楚的文字(型號、數字、姓名、電話、E-mail 要完全照抄);"
        "3) 用一兩句描述照片內容。看不清楚的寫「無法辨識」,不要猜。"
    )
    out = ollama_chat(VISION_MODEL, [{"role": "user", "content": prompt, "images": [base64.b64encode(img_bytes).decode()]}], ctx=8192)
    ollama_unload(VISION_MODEL)
    return to_tw(out.strip())


def extract_file(data: bytes, name: str, mime: str, progress) -> dict:
    ext = os.path.splitext(name)[1].lower()
    if FAKE:
        time.sleep(0.5)
        return {"text": f"(示範)「{name}」的文字內容:GT 系列 350 噸,節能 30%。", "pages": 1, "method": "fake"}
    progress(f"讀取「{name}」")
    if mime.startswith("image/") or ext in (".jpg", ".jpeg", ".png", ".webp", ".heic", ".bmp"):
        return {"text": vision_read(data, name), "pages": 1, "method": "vision" if VISION_MODEL else "none"}
    if ext == ".pdf" or mime == "application/pdf":
        try:
            import pymupdf as fitz
        except ImportError:  # 舊版 PyMuPDF
            import fitz

        doc = fitz.open(stream=data, filetype="pdf")
        parts = []
        for i, page in enumerate(doc):
            if i >= 30:
                parts.append("(超過 30 頁,後面省略)")
                break
            t = page.get_text().strip()
            if len(t) < 20 and VISION_MODEL:  # 掃描頁:轉成圖片交給視覺模型
                progress(f"辨識掃描頁 {i + 1}")
                t = vision_read(page.get_pixmap(dpi=150).tobytes("png"), f"{name} 第 {i + 1} 頁")
            parts.append(f"[第 {i + 1} 頁]\n{t}")
        return {"text": to_tw("\n".join(parts)), "pages": len(doc), "method": "pdf"}
    if ext == ".docx":
        import docx

        d = docx.Document(io.BytesIO(data))
        lines = [p.text for p in d.paragraphs if p.text.strip()]
        for tb in d.tables:
            for row in tb.rows:
                lines.append(" | ".join(c.text.strip() for c in row.cells))
        return {"text": to_tw("\n".join(lines)), "method": "docx"}
    if ext in (".xlsx", ".xlsm"):
        import openpyxl

        wb = openpyxl.load_workbook(io.BytesIO(data), data_only=True, read_only=True)
        lines = []
        for ws in wb.worksheets:
            lines.append(f"[工作表 {ws.title}]")
            for n, row in enumerate(ws.iter_rows(values_only=True)):
                if n >= 300:
                    lines.append("(超過 300 列,後面省略)")
                    break
                vals = [str(v) for v in row if v is not None and str(v).strip()]
                if vals:
                    lines.append(" | ".join(vals))
        return {"text": to_tw("\n".join(lines)), "method": "xlsx"}
    if ext == ".pptx":
        from pptx import Presentation

        prs = Presentation(io.BytesIO(data))
        lines = []
        for i, slide in enumerate(prs.slides, 1):
            lines.append(f"[投影片 {i}]")
            for sh in slide.shapes:
                if getattr(sh, "has_text_frame", False) and sh.text_frame.text.strip():
                    lines.append(sh.text_frame.text.strip())
        return {"text": to_tw("\n".join(lines)), "method": "pptx"}
    if ext in (".txt", ".csv", ".md", ".json") or mime.startswith("text/"):
        for enc in ("utf-8-sig", "big5", "cp950", "utf-16"):
            try:
                return {"text": to_tw(data.decode(enc)), "method": "text"}
            except Exception:
                continue
    return {"text": f"(「{name}」格式不支援讀取內容)", "method": "none"}


CARD_SCHEMA = {
    "type": "object",
    "properties": {k: {"type": "string"} for k in (
        "company_name", "tax_id", "company_phone", "fax", "city", "district", "street", "website",
        "contact_name", "title", "department", "mobile", "email", "raw_text",
    )},
    "required": ["company_name", "contact_name", "raw_text"],
}


def read_card(img_bytes: bytes, progress) -> dict:
    """名片辨識:讀出公司與聯絡人欄位(新增客戶用)"""
    if FAKE:
        time.sleep(1.5)
        return {"company_name": "(示範)永群精密模具有限公司", "tax_id": "", "company_phone": "03-3811613", "fax": "", "city": "桃園市", "district": "龜山區", "street": "文化一路 100 號",
                "website": "www.yongqun.example", "contact_name": "陳志明", "title": "工程部主任", "department": "工程部", "mobile": "0912-345-678", "email": "chen@yongqun.example", "raw_text": "示範名片"}
    if not VISION_MODEL:
        raise RuntimeError("AI 伺服器尚未設定照片辨識模型(config.bat 的 VISION_MODEL),無法辨識名片")
    import base64

    asr_offload()
    ollama_unload(LLM_MODEL)
    progress("辨識名片中")
    prompt = (
        "這是一張台灣的名片照片。請逐字讀出名片上的資訊,依欄位輸出 JSON,看不到的欄位填空字串,不可猜測:"
        "company_name 公司全名、tax_id 統一編號(8 碼數字)、company_phone 公司電話(區碼-號碼)、fax 傳真、"
        "city 縣市、district 區域(鄉鎮市區)、street 街道門號、website 網址、"
        "contact_name 姓名、title 職稱、department 部門、mobile 手機、email、raw_text 名片上全部文字。"
        "電話、Email、網址要完全照抄。只用繁體中文。"
    )
    out = ollama_chat(VISION_MODEL, [{"role": "user", "content": prompt, "images": [base64.b64encode(img_bytes).decode()]}], fmt=CARD_SCHEMA, ctx=8192)
    ollama_unload(VISION_MODEL)
    return deep_tw(parse_json(out))


# ---------------------------------------------------------------- 整合分析

class Seg(BaseModel):
    id: str
    text: str
    source: str = "text"
    speaker: str | None = None
    question_id: str | None = None


class Q(BaseModel):
    id: str
    code: str = ""
    text: str
    hint: str = ""  # 希望帶回的資訊
    required: bool = False
    tracked: bool = False  # 前次未取得、本次追蹤


class AnalyzeReq(BaseModel):
    segments: list[Seg]
    questions: list[Q] = []
    customer_name: str | None = None
    contacts: list[str] = []
    glossary: list[str] = []
    visit_date: str | None = None  # YYYY-MM-DD
    profile: str = ""  # 客戶檔案目前已有的資料(避免重複建議)


_IDS = {"type": "array", "items": {"type": "string"}}
_CAT_ITEM = {
    "type": "object",
    "properties": {
        "text": {"type": "string"},
        "aspect": {"type": "string"},
        "status": {"type": "string", "enum": ["explicit", "possible", "pending"]},
        "info_time": {"type": "string"},
        "target": {"type": "string", "enum": ["", "company", "factory", "contact", "preference"]},
        "mentioned_by": {"type": "string"},
        "segment_ids": _IDS,
    },
    "required": ["text", "aspect", "status", "info_time", "target", "segment_ids"],
}
SCHEMA = {
    "type": "object",
    "properties": {
        "visit_kind": {"type": "string", "enum": ["effective", "general"]},
        "general_notes": {"type": "array", "items": {"type": "string", "enum": ["未遇窗口", "對方無暇訪談", "暫無新增資訊", "其他接洽情況"]}},
        "purpose": {"type": "string"},
        "answers": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "question_id": {"type": "string"},
                    "status": {"type": "string", "enum": ["answered", "partial", "uncovered"]},
                    "answer": {"type": "string"},
                    "missing": {"type": "string"},
                    "segment_ids": _IDS,
                },
                "required": ["question_id", "status", "answer", "missing", "segment_ids"],
            },
        },
        "categories": {
            "type": "object",
            "properties": {k: {"type": "array", "items": _CAT_ITEM} for k in ("c1", "c2", "c3", "c4", "c5", "c6", "c7")},
            "required": ["c1", "c2", "c3", "c4", "c5", "c6", "c7"],
        },
        "profile_updates": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "field": {"type": "string", "enum": ["principal", "phone", "address", "website", "customerTypes", "industries", "products", "markets", "employeeScale", "machine", "automationLevel", "automationProcess", "contact"]},
                    "value": {"type": "string"},
                    "brand": {"type": "string"},
                    "tonnage": {"type": "string"},
                    "qty": {"type": "integer"},
                    "contact_name": {"type": "string"},
                    "contact_title": {"type": "string"},
                    "contact_department": {"type": "string"},
                    "contact_phone": {"type": "string"},
                    "contact_email": {"type": "string"},
                    "contact_role": {"type": "string"},
                    "status": {"type": "string", "enum": ["explicit", "possible", "pending"]},
                    "segment_ids": _IDS,
                },
                "required": ["field", "value", "status", "segment_ids"],
            },
        },
        "todos": {
            "type": "array",
            "items": {"type": "object", "properties": {"content": {"type": "string"}, "due": {"type": "string"}, "segment_ids": _IDS}, "required": ["content", "due", "segment_ids"]},
        },
        "prefs": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "type": {"type": "string", "enum": ["preference", "avoid"]},
                    "target": {"type": "string", "enum": ["customer", "contact"]},
                    "target_name": {"type": "string"},
                    "content": {"type": "string"},
                    "segment_ids": _IDS,
                },
                "required": ["type", "target", "target_name", "content", "segment_ids"],
            },
        },
    },
    "required": ["visit_kind", "general_notes", "purpose", "answers", "categories", "profile_updates", "todos", "prefs"],
}

SYSTEM = """你是工業設備公司「哈鏌」(射出成型周邊設備:取出機等)的業務助理,負責把業務拜訪客戶的內容整理成拜訪紀錄。只用繁體中文(台灣用語)回答,只輸出 JSON。

共同規則:
1. 只能根據提供的「原文段落」整理,不可以推測或補充原文沒有的資訊。未提及就留空;不確定就不推定。
2. 每一筆都要在 segment_ids 填上依據的段落編號(例如 "S3"),只能填原文中出現的編號。
3. 標示「業務補充」的段落是業務事後補的,時間比較新。補充內容更正了前面的說法(「剛剛說錯了」「應該是」「更正」)時,一律以補充為準,舊的說法不要採用。
4. 標示「附件」的段落是照片或檔案抽出的文字(名片、規格書等),可以作為依據。
5. 數字、型號、廠牌、日期、金額、人名照原文寫,不可改動或換算。
6. status:explicit=客戶明確表示;possible=語氣不確定(大概、可能、考慮);pending=需要再確認。

各欄位:
A. visit_kind:有任何具體拜訪資訊(需求、設備、決策、競品、考量、後續行動等)就是 effective;只有接洽情況(未遇窗口、對方無暇、暫無新增資訊)就是 general,並在 general_notes 選擇符合的項目。有效與否和是否成交無關。
B. purpose:這次拜訪的目的,一句話;沒提到就填空字串。
C. answers:題組中每一題都要回覆一筆。
   - answered:題目「希望帶回的資訊」都取得了;answer 用一兩句話整理。
   - partial:只取得一部分;answer 寫已知的部分,missing 寫還缺什麼(例:「射出機數量」)。
   - uncovered:完全沒提到;answer、missing 空字串,segment_ids 空陣列。不確定時寧可判 uncovered。
   - 標示「追蹤」的題目是上次沒問到的,同樣判斷。
D. categories:把內容依關聯性歸入七大分類,每類 0~4 筆,每筆一句話;同一句話可以歸入不同分類的不同面向,但不要整句重複。
   c1 拜訪目的與結果(目的、方式、成果、新取得資訊、未成果原因)
   c2 採購需求與進展(產品/規格、數量、預算、時程、採購階段;使用情境、需求原因、採購條件)
   c3 工廠現況與計畫(射出機廠牌/噸數/數量、生產產品、擴廠/汰換;自動化現況、周邊設備、設備問題)
   c4 接洽人與決策資訊(姓名、職稱、部門、評估/採購/決策角色;對方案的態度、其他需參與的人)
   c5 競品與市場資訊(供應商、比較品牌、使用評價、市場消息;消息來源、涉及對象、發生時間)
   c6 客戶考量與偏好(價格、品質、交期、整合疑慮、服務期待;考量優先順序、具體接受條件)
   c7 後續行動與待確認(下一步、負責人、期限、待釐清內容;我方承諾、客戶承諾、預計回覆時間)
   每筆的 aspect 寫面向(例:數量、預算、射出機、決策角色);info_time 寫資訊時間(例:明年 Q2、下週三前),沒有就空字串;target 寫可更新到客戶檔案的位置:company 公司資料、factory 工廠設備、contact 聯絡人、preference 偏好,都不是就空字串;mentioned_by 寫提及者。
E. profile_updates:原文中可以寫進客戶檔案、而且「客戶檔案目前已有的資料」裡還沒有的事實。
   - machine:客戶「已經有」的射出機(打算買的不算),填 brand、tonnage(只寫數字)、qty;value 寫「海天 350 噸 × 6 台」。
   - products:客戶生產的射出產品,一筆一個(例:家電零件);markets、industries、customerTypes 同理。
   - automationProcess:已經自動化的製程,一筆一個(取件、剪料頭/修邊、檢測、秤重、雷射標記、搬運/供料、組裝、包裝/堆疊)。automationLevel:傳統人工/半自動化/全自動化。
   - contact:新出現的聯絡人,填 contact_name(稱呼,例:陳主任)、contact_title、contact_department、contact_phone、contact_email、contact_role(決策者/採購窗口/技術評估/使用單位/影響者)。
   - principal 公司負責人、phone 公司電話、address 地址、website 網址、employeeScale 員工規模。
   - 語氣不確定的標 possible;沒有就回空陣列。
F. todos:業務答應要做或需要追蹤的事;due 只有原文有明確日期或「下週三」這類說法時換算成 YYYY-MM-DD,否則空字串。
G. prefs:客戶或特定聯絡人的偏好(preference)與要避免的事(avoid),例如溝通方式、重視的點、不喜歡的做法。target 是 customer 或 contact(target_name 填稱呼)。"""


def build_prompt(req: AnalyzeReq) -> str:
    qmap = {q.id: q for q in req.questions}
    lines = []
    for s in req.segments:
        tag = []
        if s.speaker:
            tag.append(s.speaker)
        if s.question_id and s.question_id in qmap:
            tag.append(f"回答 {qmap[s.question_id].code or s.question_id}")
        lines.append(f"[{s.id}]{'(' + '/'.join(tag) + ')' if tag else ''} {s.text}")
    qs = "\n".join(
        f"- question_id={q.id}|{q.code} {q.text}{'(必答)' if q.required else ''}{'(追蹤:上次未取得)' if q.tracked else ''}{'|希望帶回:' + q.hint if q.hint else ''}" for q in req.questions
    ) or "(本次沒有題組,answers 請回空陣列)"
    ctx = []
    if req.customer_name:
        ctx.append(f"客戶:{req.customer_name}")
    if req.contacts:
        ctx.append(f"已知聯絡人:{'、'.join(req.contacts)}")
    if req.glossary:
        ctx.append(f"專有名詞(語音轉文字可能聽錯,請以這些寫法為準):{'、'.join(req.glossary)}")
    ctx.append(f"拜訪日期:{req.visit_date or date.today().isoformat()}(用來換算「下週三」這類日期)")
    if req.profile:
        ctx.append(f"客戶檔案目前已有的資料(profile_updates 不要重複):{req.profile}")
    return "\n".join(ctx) + f"\n\n【題組】\n{qs}\n\n【原文段落】\n" + "\n".join(lines) + "\n\n請依規則輸出 JSON。"


def parse_json(text: str) -> dict:
    text = text.strip()
    text = re.sub(r"^```(?:json)?|```$", "", text, flags=re.M).strip()
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.S).strip()
    try:
        return json.loads(text)
    except Exception:
        m = re.search(r"\{.*\}", text, flags=re.S)
        if m:
            return json.loads(m.group(0))
        raise


MERGE_SYSTEM = """你是工業設備公司「哈鏌」的業務助理。一場很長的拜訪被分成幾個部分分別整理過,現在要把各部分的結果彙整成一份完整的拜訪紀錄。只用繁體中文(台灣用語)回答,只輸出 JSON,格式與各部分相同。

規則:
1. 只能使用各部分結果與「業務補充」裡的內容,不可以新增。segment_ids 只能沿用其中出現過的編號。
2. visit_kind:任一部分是 effective 就是 effective。
3. answers:每一題輸出一筆。任一部分 answered 就是 answered;只有 partial 就是 partial,missing 寫所有部分合起來仍缺的資訊;全部 uncovered 才是 uncovered。
4. 前後說法矛盾時,以後面部分為準;「業務補充」的內容(附在最後)比所有部分都新,有更正時一律以補充為準。
5. categories 七大分類:合併各部分同類的內容,去除重複,每類最多 4 筆。
6. profile_updates、todos、prefs 合併重複的項目;同一台射出機只留一筆(以後面部分或補充為準)。
7. purpose 取最能代表整場拜訪的一句;都沒有就填空字串。"""


def split_segments(segs: list[Seg], limit: int) -> list[list[Seg]]:
    parts, cur, size = [], [], 0
    for sg in segs:
        n = len(sg.text) + 12
        if cur and size + n > limit:
            parts.append(cur)
            cur, size = [], 0
        cur.append(sg)
        size += n
    if cur:
        parts.append(cur)
    return parts


def llm_json(system: str, user: str, progress, label: str) -> dict:
    msgs = [{"role": "system", "content": system}, {"role": "user", "content": user}]
    last_err: Exception | None = None
    for attempt in range(2):
        try:
            out = ollama_chat(LLM_MODEL, msgs, fmt=SCHEMA, temperature=0.1 if attempt == 0 else 0.3)
            return parse_json(out)
        except Exception as e:  # noqa: BLE001
            last_err = e
            progress(f"{label}:結果格式有誤,重試一次")
    raise RuntimeError(f"AI 整理失敗:{last_err}")


def merge_fallback(req: AnalyzeReq, parts: list[dict]) -> dict:
    """彙整失敗時的保底:不靠模型,直接依規則合併"""
    rank = {"answered": 2, "partial": 1, "uncovered": 0}
    answers = []
    for q in req.questions:
        hits = [a for p in parts for a in p.get("answers", []) if a.get("question_id") == q.id]
        best = max((rank.get(a.get("status"), 0) for a in hits), default=0)
        st = {2: "answered", 1: "partial", 0: "uncovered"}[best]
        ans = ";".join(dict.fromkeys(a.get("answer", "") for a in hits if a.get("answer") and a.get("status") != "uncovered"))
        missing = next((a.get("missing", "") for a in reversed(hits) if a.get("status") == "partial"), "") if st == "partial" else ""
        ids = [i for a in hits for i in a.get("segment_ids", [])]
        answers.append({"question_id": q.id, "status": st, "answer": ans if st != "uncovered" else "", "missing": missing, "segment_ids": ids if st != "uncovered" else []})
    cats = {}
    for k in ("c1", "c2", "c3", "c4", "c5", "c6", "c7"):
        seen, items = set(), []
        for p in parts:
            for it in (p.get("categories") or {}).get(k, []):
                if it.get("text") and it["text"] not in seen:
                    seen.add(it["text"])
                    items.append(it)
        cats[k] = items[:4]

    def uniq(key, field):
        seen, out = set(), []
        for p in parts:
            for x in p.get(key, []):
                v = x.get(field, "")
                if v and v not in seen:
                    seen.add(v)
                    out.append(x)
        return out

    kind = "effective" if any(p.get("visit_kind") == "effective" for p in parts) else "general"
    notes = list(dict.fromkeys(n for p in parts for n in p.get("general_notes", []))) if kind == "general" else []
    purpose = next((p.get("purpose") for p in parts if p.get("purpose")), "")
    return {"visit_kind": kind, "general_notes": notes, "purpose": purpose, "answers": answers, "categories": cats, "profile_updates": uniq("profile_updates", "value"), "todos": uniq("todos", "content"), "prefs": uniq("prefs", "content")}


def analyze(req: AnalyzeReq, progress) -> dict:
    if FAKE:
        time.sleep(2)
        sid = [s.id for s in req.segments]
        first = sid[:1]
        it = lambda text, aspect, target="": {"text": text, "aspect": aspect, "status": "explicit", "info_time": "", "target": target, "mentioned_by": "", "segment_ids": first}  # noqa: E731
        return {
            "visit_kind": "effective",
            "general_notes": [],
            "purpose": "了解現有射出機狀況",
            "answers": [
                {"question_id": q.id, "status": "answered" if i < 2 else ("partial" if i == 2 else "uncovered"), "answer": "(示範)海天 350 噸射出機" if i < 3 else "", "missing": "射出機數量" if i == 2 else "", "segment_ids": first if i < 3 else []}
                for i, q in enumerate(req.questions)
            ],
            "categories": {
                "c1": [it("(示範)了解現有射出機狀況", "目的與成果")],
                "c2": [it("評估汰換老舊機台,預算約五百萬", "預算")],
                "c3": [it("八台三百五十噸機台,用了快十年,兩台常故障", "射出機", "factory")],
                "c4": [it("老闆希望年底前完成評估", "決策角色")],
                "c5": [],
                "c6": [it("不想再被比價", "考量重點", "preference")],
                "c7": [it("下週三前寄送 GT 系列報價", "我方承諾")],
            },
            "profile_updates": [{"field": "machine", "value": "350 噸 × 8 台", "tonnage": "350", "qty": 8, "status": "explicit", "segment_ids": first}],
            "todos": [{"content": "寄送 GT 系列報價與節能數據", "due": "", "segment_ids": first}],
            "prefs": [{"type": "avoid", "target": "customer", "target_name": req.customer_name or "客戶", "content": "不想再被比價", "segment_ids": first}],
        }
    asr_offload()
    if VISION_MODEL:
        ollama_unload(VISION_MODEL)
    total = sum(len(x.text) for x in req.segments)
    if total <= CHUNK_CHARS:
        progress(f"AI 整理中({LLM_MODEL})")
        return deep_tw(llm_json(SYSTEM, build_prompt(req), progress, "AI 整理"))

    # 長逐字稿:分段整理 → 彙整。避免超過模型可讀長度(超過時模型會默默丟掉前面的內容)
    main = [x for x in req.segments if x.speaker != "業務補充"]
    sups = [x for x in req.segments if x.speaker == "業務補充"]
    groups = split_segments(main, CHUNK_CHARS) or [[]]
    groups[-1] = groups[-1] + sups  # 補充內容跟最後一段一起整理(也會在彙整時再提供一次)
    parts = []
    for i, g in enumerate(groups):
        progress(f"AI 分段整理 {i + 1}/{len(groups)}(逐字稿共 {total:,} 字)")
        sub = AnalyzeReq(segments=g, questions=req.questions, customer_name=req.customer_name, contacts=req.contacts, glossary=req.glossary, visit_date=req.visit_date, profile=req.profile)
        note = f"\n\n(注意:這是一場長時間拜訪的第 {i + 1}/{len(groups)} 部分,只整理這部分的內容;這部分沒提到的題目標 uncovered,其他部分會另外整理。)"
        parts.append(llm_json(SYSTEM, build_prompt(sub) + note, progress, f"第 {i + 1} 段"))

    return deep_tw(merge_parts(req, parts, sups, progress))


def compact(p: dict) -> dict:
    """彙整前精簡各段結果:拿掉沒蒐集到的題目與空白分類,省長度"""
    return {
        "visit_kind": p.get("visit_kind", ""),
        "purpose": p.get("purpose", ""),
        "answers": [a for a in p.get("answers", []) if a.get("status") != "uncovered"],
        "categories": {k: v for k, v in (p.get("categories") or {}).items() if v},
        "profile_updates": p.get("profile_updates", []),
        "todos": p.get("todos", []),
        "prefs": p.get("prefs", []),
    }


def merge_parts(req: AnalyzeReq, parts: list[dict], sups: list[Seg], progress, depth: int = 0) -> dict:
    if len(parts) == 1:
        return parts[0]
    qs = "\n".join(f"- question_id={q.id}|{q.code} {q.text}{'(必答)' if q.required else ''}" for q in req.questions) or "(沒有題組)"
    body = [f"【題組】\n{qs}", f"拜訪日期:{req.visit_date or date.today().isoformat()}"]
    for i, p in enumerate(parts):
        body.append(f"【第 {i + 1} 部分整理結果】\n" + json.dumps(compact(p), ensure_ascii=False))
    if sups:
        body.append("【業務補充(最新,有更正以此為準)】\n" + "\n".join(f"[{x.id}] {x.text}" for x in sups))
    text = "\n\n".join(body)
    # 太長就兩兩分組先彙整,再彙整結果(拜訪好幾個小時也不會超過模型長度)
    if len(text) > CHUNK_CHARS * 2 and len(parts) > 2:
        mid = len(parts) // 2
        left = merge_parts(req, parts[:mid], [], progress, depth + 1)
        right = merge_parts(req, parts[mid:], sups, progress, depth + 1)
        return merge_parts(req, [left, right], sups, progress, depth + 1)
    progress("AI 彙整各段結果")
    try:
        return llm_json(MERGE_SYSTEM, text + "\n\n請依規則彙整成一份 JSON。", progress, "彙整")
    except Exception:  # noqa: BLE001
        traceback.print_exc()
        progress("彙整失敗,改用規則合併")
        return merge_fallback(req, parts)


# ---------------------------------------------------------------- API

@app.get("/health")
def health(x_api_key: str | None = Header(default=None), key: str | None = None):
    check_key(x_api_key or key)  # 瀏覽器測試可用 /health?key=金鑰
    llm_ok, models = False, []
    if FAKE:
        llm_ok, models = True, [LLM_MODEL]
    else:
        try:
            import requests

            models = [m["name"] for m in requests.get(f"{OLLAMA_URL}/api/tags", timeout=5).json().get("models", [])]
            llm_ok = any(m == LLM_MODEL or m.startswith(LLM_MODEL + ":") or m.split(":")[0] == LLM_MODEL for m in models)
        except Exception:
            pass
    return {
        "ok": True,
        "version": VERSION,
        "fake": FAKE,
        "gpu": gpu_name(),
        "asr_model": ASR_MODEL,
        "asr_loaded": _asr["pipe"] is not None or FAKE,
        "diarization": bool(HF_TOKEN) and not _diar["failed"],
        "llm_model": LLM_MODEL,
        "llm_ready": llm_ok,
        "vision_model": VISION_MODEL or None,
        "vision_ready": bool(VISION_MODEL) and (FAKE or any(m.split(":")[0] == VISION_MODEL.split(":")[0] for m in models)),
        "auth": bool(API_KEY),
        "queue": sum(1 for j in jobs.items.values() if j["status"] in ("queued", "running")),
    }


@app.post("/jobs/transcribe")
async def job_transcribe(file: UploadFile = File(...), diarization: str = Form("1"), x_api_key: str | None = Header(default=None)):
    check_key(x_api_key)
    data = await file.read()
    if not data:
        raise HTTPException(400, "音檔是空的")
    jid = jobs.submit("transcribe", lambda p: transcribe_bytes(data, diarization == "1", p))
    return {"job_id": jid}


@app.post("/jobs/extract")
async def job_extract(file: UploadFile = File(...), x_api_key: str | None = Header(default=None)):
    check_key(x_api_key)
    data = await file.read()
    name = file.filename or "file"
    mime = file.content_type or ""
    jid = jobs.submit("extract", lambda p: extract_file(data, name, mime, p))
    return {"job_id": jid}


@app.post("/jobs/card")
async def job_card(file: UploadFile = File(...), x_api_key: str | None = Header(default=None)):
    check_key(x_api_key)
    data = await file.read()
    if not data:
        raise HTTPException(400, "照片是空的")
    jid = jobs.submit("card", lambda p: read_card(data, p))
    return {"job_id": jid}


@app.post("/jobs/analyze")
def job_analyze(req: AnalyzeReq, x_api_key: str | None = Header(default=None)):
    check_key(x_api_key)
    jid = jobs.submit("analyze", lambda p: analyze(req, p))
    return {"job_id": jid}


@app.get("/jobs/{jid}")
def job_status(jid: str, x_api_key: str | None = Header(default=None)):
    check_key(x_api_key)
    j = jobs.get(jid)
    if not j:
        raise HTTPException(404, "找不到這個工作(伺服器可能重新啟動過)")
    return j


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8765"))
    print(f"\n  哈鏌本機 AI 伺服器 v{VERSION}")
    print(f"  語音模型:{ASR_MODEL}  語言模型:{LLM_MODEL}  視覺模型:{VISION_MODEL or '未設定'}")
    print(f"  語者分離:{'啟用' if HF_TOKEN else '未啟用(未設定 HF_TOKEN)'}  API 金鑰:{'已設定' if API_KEY else '未設定(任何人都能呼叫)'}")
    print(f"  網址:http://localhost:{port}/health\n")
    uvicorn.run(app, host="0.0.0.0", port=port)
