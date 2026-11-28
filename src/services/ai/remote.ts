import { Platform } from "react-native";
import { getState } from "../../store/store";
import { truncate, uid } from "../../lib/util";
import {
  extractFacts,
  extractUncertainties,
  shortName,
  splitSentences,
  suggestCustomer,
} from "./mock";
import type {
  CategoryItem,
  CategoryKey,
  Customer,
  InfoStatus,
  ProfileField,
  ProfileUpdate,
  UpdateTarget,
  VisitKind,
  AnalysisResult,
  Attachment,
  PrefSuggestion,
  Segment,
} from "../../types";
import type { AiService, AnalyzeInput, TranscribeInput } from "./types";
import { GENERAL_NOTES, machinesText } from "../../store/options";

// 本機 AI 伺服器(local-ai-server/server.py):
//   語音轉文字 Breeze ASR、照片/檔案抽字、Ollama 開源語言模型分析。
// 長錄音可能要幾分鐘,採「建立工作 → 每幾秒查詢一次」的方式,避免超過通道的請求時間限制。

export interface ServerConfig {
  url: string;
  key: string;
  diarization: boolean;
}

/** 本機設定優先;沒有的話用打包時的環境變數(GitHub Actions 的 EXPO_PUBLIC_AI_SERVER_URL) */
export function serverConfig(): ServerConfig | null {
  const s = getState().settings.aiServer;
  const url = (s?.url || process.env.EXPO_PUBLIC_AI_SERVER_URL || "")
    .trim()
    .replace(/\/+$/, "");
  if (!url) return null;
  return {
    url,
    key: (s?.key ?? process.env.EXPO_PUBLIC_AI_SERVER_KEY ?? "").trim(),
    diarization: s?.diarization ?? true,
  };
}

export interface ServerHealth {
  ok: boolean;
  version: string;
  fake: boolean;
  gpu: string;
  asr_model: string;
  diarization: boolean;
  llm_model: string;
  llm_ready: boolean;
  vision_model: string | null;
  vision_ready: boolean;
  auth: boolean;
  queue: number;
}

async function req<T>(
  cfg: ServerConfig,
  path: string,
  init?: RequestInit,
  timeoutMs = 60000,
): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${cfg.url}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: {
        ...(init?.headers || {}),
        ...(cfg.key ? { "X-Api-Key": cfg.key } : {}),
      },
    });
    if (!r.ok) {
      let msg = `HTTP ${r.status}`;
      try {
        const j = await r.json();
        if (j?.detail)
          msg =
            typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
      } catch {
        // 不是 JSON
      }
      if (r.status === 530 || r.status === 502 || r.status === 1033)
        msg = "連不到 AI 伺服器(電腦或通道可能已關閉)";
      throw new Error(msg);
    }
    return (await r.json()) as T;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError")
      throw new Error("連線逾時,請確認 AI 伺服器有開啟");
    if (e instanceof TypeError)
      throw new Error("連不到 AI 伺服器,請確認網址正確、電腦與通道有開啟");
    throw e;
  } finally {
    clearTimeout(t);
  }
}

export async function checkServer(cfg: ServerConfig): Promise<ServerHealth> {
  return req<ServerHealth>(cfg, "/health", undefined, 15000);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 建立工作後輪詢結果,最長等 3 小時(長錄音轉寫+分段分析) */
async function runJob<T>(
  cfg: ServerConfig,
  path: string,
  body: FormData | object,
  onProgress?: (m: string) => void,
): Promise<T> {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const { job_id } = await req<{ job_id: string }>(
    cfg,
    path,
    {
      method: "POST",
      body: isForm ? (body as FormData) : JSON.stringify(body),
      headers: isForm ? {} : { "Content-Type": "application/json" },
    },
    10 * 60 * 1000, // 上傳長錄音(行動網路可能較慢)
  );
  const until = Date.now() + 3 * 60 * 60 * 1000;
  let errors = 0;
  while (Date.now() < until) {
    await sleep(2500);
    try {
      const j = await req<{
        status: string;
        progress?: string;
        result?: T;
        error?: string;
        queue_ahead?: number;
      }>(cfg, `/jobs/${job_id}`, undefined, 20000);
      errors = 0;
      if (j.status === "done") return j.result as T;
      if (j.status === "error") throw new Error(j.error || "AI 伺服器處理失敗");
      onProgress?.(
        j.status === "queued" && j.queue_ahead
          ? `排隊中(前面還有 ${j.queue_ahead} 件)`
          : j.progress || "處理中",
      );
    } catch (e) {
      // 短暫斷線再試幾次;伺服器明確回報錯誤就直接失敗
      if (e instanceof Error && !/連不到|逾時/.test(e.message)) throw e;
      if (++errors >= 6) throw e;
    }
  }
  throw new Error("等待 AI 伺服器逾時");
}

async function fileForm(
  uri: string,
  name: string,
  mime: string,
  extra?: Record<string, string>,
): Promise<FormData> {
  const fd = new FormData();
  if (Platform.OS === "web") {
    const blob = await (await fetch(uri)).blob();
    // 網頁錄音的副檔名依實際格式(iPhone Safari 是 mp4,Chrome 是 webm)
    const real = blob.type.includes("mp4")
      ? "m4a"
      : blob.type.includes("webm")
        ? "webm"
        : blob.type.includes("ogg")
          ? "ogg"
          : "";
    fd.append(
      "file",
      blob,
      real && /^audio\./.test(name) ? `audio.${real}` : name,
    );
  } else {
    // React Native 的 FormData 接受 { uri, name, type }
    fd.append("file", { uri, name, type: mime } as unknown as Blob);
  }
  Object.entries(extra || {}).forEach(([k, v]) => fd.append(k, v));
  return fd;
}

function audioName(uri: string) {
  const ext = (
    uri.split("?")[0].match(/\.(\w{2,4})$/)?.[1] ||
    (Platform.OS === "web" ? "webm" : "m4a")
  ).toLowerCase();
  return {
    name: `audio.${ext}`,
    mime:
      ext === "webm"
        ? "audio/webm"
        : ext === "wav"
          ? "audio/wav"
          : ext === "mp3"
            ? "audio/mpeg"
            : "audio/mp4",
  };
}

interface TSeg {
  start: number;
  end: number;
  speaker: string | null;
  text: string;
}

async function transcribeAudio(
  cfg: ServerConfig,
  uri: string,
  onProgress?: (m: string) => void,
): Promise<TSeg[]> {
  const { name, mime } = audioName(uri);
  const fd = await fileForm(uri, name, mime, {
    diarization: cfg.diarization ? "1" : "0",
  });
  const r = await runJob<{ segments: TSeg[] }>(
    cfg,
    "/jobs/transcribe",
    fd,
    onProgress,
  );
  return r.segments || [];
}

async function extractAttachment(
  cfg: ServerConfig,
  a: Attachment,
  onProgress?: (m: string) => void,
): Promise<string> {
  const fd = await fileForm(
    a.uri,
    a.name,
    a.mimeType ||
      (a.kind === "photo" ? "image/jpeg" : "application/octet-stream"),
  );
  const r = await runJob<{ text: string }>(
    cfg,
    "/jobs/extract",
    fd,
    onProgress,
  );
  return (r.text || "").trim();
}

interface RawItem {
  text: string;
  aspect?: string;
  status?: string;
  info_time?: string;
  target?: string;
  mentioned_by?: string;
  segment_ids: string[];
}
interface RawResult {
  visit_kind?: string;
  general_notes?: string[];
  purpose?: string;
  answers?: { question_id: string; status: string; answer: string; missing?: string; segment_ids: string[] }[];
  categories?: Partial<Record<CategoryKey, RawItem[]>>;
  profile_updates?: {
    field: string;
    value: string;
    brand?: string;
    tonnage?: string;
    qty?: number;
    contact_name?: string;
    contact_title?: string;
    contact_department?: string;
    contact_phone?: string;
    contact_email?: string;
    contact_role?: string;
    status?: string;
    segment_ids: string[];
  }[];
  todos?: { content: string; due: string; segment_ids: string[] }[];
  prefs?: { type: string; target: string; target_name: string; content: string; segment_ids: string[] }[];
}

const CAT_KEYS: CategoryKey[] = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7'];
const FIELDS = ['principal', 'phone', 'address', 'website', 'customerTypes', 'industries', 'products', 'markets', 'employeeScale', 'machine', 'automationLevel', 'automationProcess', 'contact'];
const statusOf = (x?: string): InfoStatus => (x === 'possible' || x === 'pending' ? x : 'explicit');

/** 給模型參考的客戶檔案現況(避免重複建議) */
function profileText(c?: Customer): string {
  if (!c) return '';
  const parts = [
    c.machines?.length ? `射出機:${machinesText(c)}` : '',
    c.products?.length ? `射出產品:${c.products.join('、')}` : '',
    c.automation?.processes?.length ? `已自動化製程:${c.automation.processes.join('、')}` : '',
    c.automation?.level ? `自動化程度:${c.automation.level}` : '',
    c.contacts.length ? `聯絡人:${c.contacts.map((x) => x.name).join('、')}` : '',
    c.principal ? `負責人:${c.principal}` : '',
    c.phone ? `電話:${c.phone}` : '',
    c.employeeScale ? `員工規模:${c.employeeScale}` : '',
  ];
  return parts.filter(Boolean).join(';');
}

const SRC_LABEL = {
  recording: "現場錄音",
  dictation: "業務口述",
  text: "文字輸入",
} as const;

export function createRemoteAi(): AiService {
  const need = () => {
    const c = serverConfig();
    if (!c) throw new Error("尚未設定 AI 伺服器");
    return c;
  };
  return {
    get name() {
      return `本機 AI 伺服器(${serverConfig()?.url.replace(/^https?:\/\//, "") || "未設定"})`;
    },
    isMock: false,

    async transcribe(input: TranscribeInput): Promise<Segment[]> {
      const cfg = need();
      const p = input.onProgress;
      const segs: Segment[] = [];

      if (
        input.source === "recording" &&
        (input.audioParts?.length || input.audioUri)
      ) {
        // 自動分段錄音:逐段轉寫,時間軸接續
        const parts = input.audioParts?.length
          ? input.audioParts
          : [
              {
                uri: input.audioUri as string,
                durationMs: input.audioDurationMs || 0,
              },
            ];
        let offset = 0;
        for (let i = 0; i < parts.length; i++) {
          const tag = parts.length > 1 ? `第 ${i + 1}/${parts.length} 段` : "";
          p?.(`上傳錄音${tag}`);
          const out = await transcribeAudio(cfg, parts[i].uri, (m) =>
            p?.(tag ? `${tag}:${m}` : m),
          );
          out.forEach((x) =>
            segs.push({
              id: uid("sg"),
              source: "recording",
              speaker: x.speaker || undefined,
              text: x.text,
              start: Math.round(x.start + offset),
              end: Math.round(x.end + offset),
            }),
          );
          offset +=
            parts[i].durationMs / 1000 ||
            (out.length ? out[out.length - 1].end : 0);
        }
      }
      if (input.source === "dictation") {
        const items = (input.dictation || []).filter((d) => !d.status);
        for (let i = 0; i < items.length; i++) {
          const d = items[i];
          let text = d.text.trim();
          if (d.audioUri) {
            p?.(`轉寫口述 ${i + 1}/${items.length}`);
            const spoken = (await transcribeAudio(cfg, d.audioUri, p))
              .map((x) => x.text)
              .join("");
            text = [spoken, text].filter(Boolean).join(" ");
          }
          if (text)
            segs.push({
              id: uid("sg"),
              source: "dictation",
              text,
              questionId: d.questionId,
            });
        }
        if (input.audioUri && !(input.dictation || []).length) {
          (await transcribeAudio(cfg, input.audioUri, p)).forEach((x) =>
            segs.push({ id: uid("sg"), source: "dictation", text: x.text }),
          );
        }
      }
      const free = (input.text || "").trim();
      if (free) {
        free
          .split(/\n+/)
          .map((t) => t.trim())
          .filter(Boolean)
          .forEach((t) =>
            segs.push({
              id: uid("sg"),
              source: input.source === "text" ? "text" : "dictation",
              text: t,
            }),
          );
      }
      const sups = input.supplements || [];
      for (let i = 0; i < sups.length; i++) {
        const sp = sups[i];
        let text = sp.text.trim();
        if (sp.audioUri) {
          p?.(`轉寫補充口述 ${i + 1}/${sups.length}`);
          const spoken = (await transcribeAudio(cfg, sp.audioUri, p))
            .map((x) => x.text)
            .join("");
          text = [spoken, text].filter(Boolean).join(" ");
        }
        if (text)
          segs.push({
            id: uid("sg"),
            source: sp.kind === "text" ? "text" : "dictation",
            speaker: "業務補充",
            text,
          });
      }
      const atts = input.attachments || [];
      for (let i = 0; i < atts.length; i++) {
        p?.(`讀取附件 ${i + 1}/${atts.length}`);
        const text = await extractAttachment(cfg, atts[i], p);
        if (text)
          segs.push({
            id: uid("sg"),
            source: "text",
            speaker: `附件:${atts[i].name}`,
            text: truncate(text, 4000),
          });
      }
      return segs;
    },

    async analyze(input: AnalyzeInput): Promise<AnalysisResult> {
      const cfg = need();
      // 段落用短編號 S1、S2…,省 token 也方便模型引用
      const short = new Map<string, string>();
      const real = new Map<string, Segment>();
      input.segments.forEach((sg, i) => {
        short.set(sg.id, `S${i + 1}`);
        real.set(`S${i + 1}`, sg);
      });
      const ids = (xs?: string[]) =>
        Array.from(
          new Set(
            (xs || [])
              .map((x) => real.get(String(x).trim())?.id)
              .filter((x): x is string => !!x),
          ),
        );
      const items = input.questionSet?.items || [];
      const qOf = (id: string) => input.questions.find((q) => q.id === id);
      const visitDate = input.visitAt.slice(0, 10);

      const raw = await runJob<RawResult>(
        cfg,
        "/jobs/analyze",
        {
          segments: input.segments.map((sg) => ({
            id: short.get(sg.id),
            text: sg.text,
            source: sg.source,
            speaker: sg.speaker || null,
            question_id: sg.questionId || null,
          })),
          questions: items.map((it) => ({
            id: it.questionId,
            code: qOf(it.questionId)?.code || "",
            text: qOf(it.questionId)?.text || "",
            hint: qOf(it.questionId)?.hint || "",
            required: it.required,
            tracked: !!it.tracked,
          })),
          profile: profileText(input.customer),
          customer_name: input.customer?.name || null,
          contacts: (input.customer?.contacts || []).map((c) =>
            [c.name, c.title].filter(Boolean).join(" "),
          ),
          glossary: input.glossary,
          visit_date: visitDate,
        },
        input.onProgress,
      );

      const sents = splitSentences(input.segments);
      const customer =
        input.customer ||
        input.customers.find(
          (c) => c.id === suggestCustomer(sents, input.customers),
        );
      // 七大分類
      const categories: Partial<Record<CategoryKey, CategoryItem[]>> = {};
      CAT_KEYS.forEach((k) => {
        const list = (raw.categories?.[k] || []).filter((x) => x.text?.trim()).slice(0, 4);
        if (list.length)
          categories[k] = list.map((x) => ({
            id: uid('ci'),
            text: x.text.trim(),
            aspect: x.aspect?.trim() || undefined,
            status: statusOf(x.status),
            infoTime: x.info_time?.trim() || undefined,
            target: (['company', 'factory', 'contact', 'preference'].includes(x.target || '') ? x.target : undefined) as UpdateTarget | undefined,
            mentionedBy: x.mentioned_by?.trim() || undefined,
            sourceSegmentIds: ids(x.segment_ids),
          }));
      });
      // 舊版五欄摘要由七大分類產生(報告與匯出相容)
      const sum = (k: CategoryKey) => {
        const list = categories[k] || [];
        return list.length ? { text: list.map((x) => x.text).join(';'), sourceSegmentIds: Array.from(new Set(list.flatMap((x) => x.sourceSegmentIds))) } : { text: '未知', sourceSegmentIds: [] };
      };
      const visitKind: VisitKind = raw.visit_kind === 'general' ? 'general' : 'effective';
      const firstSeg = (xs?: string[]) =>
        real.get(String((xs || [])[0] || "").trim());

      return {
        mock: false,
        suggestedCustomerId: input.customer ? undefined : customer?.id,
        answers: items.map((it) => {
          const a = (raw.answers || []).find(
            (x) => x.question_id === it.questionId,
          );
          const status =
            a && ["answered", "partial", "uncovered"].includes(a.status)
              ? (a.status as "answered" | "partial" | "uncovered")
              : "uncovered";
          return {
            questionId: it.questionId,
            required: it.required,
            tracked: it.tracked,
            status,
            answer: status === "uncovered" ? "" : (a?.answer || "").trim(),
            missing: status === "partial" ? a?.missing?.trim() || undefined : undefined,
            sourceSegmentIds: status === "uncovered" ? [] : ids(a?.segment_ids),
          };
        }),
        summary: { keyPoints: sum('c1'), needs: sum('c2'), competitors: sum('c5'), objections: sum('c6'), nextSteps: sum('c7') },
        categories,
        visitKind,
        generalNotes: visitKind === 'general' ? (raw.general_notes || []).filter((x) => GENERAL_NOTES.includes(x)) : [],
        profileUpdates: (raw.profile_updates || [])
          .filter((u) => FIELDS.includes(u.field) && (u.value?.trim() || u.contact_name))
          .slice(0, 12)
          .map(
            (u): ProfileUpdate => ({
              id: uid('pu'),
              field: u.field as ProfileField,
              value: (u.value || u.contact_name || '').trim(),
              machine: u.field === 'machine' ? { brand: u.brand || undefined, tonnage: (u.tonnage || '').replace(/[^\d.]/g, '') || undefined, qty: u.qty || undefined } : undefined,
              contact:
                u.field === 'contact' && u.contact_name
                  ? { name: u.contact_name, title: u.contact_title || undefined, department: u.contact_department || undefined, phone: u.contact_phone || undefined, email: u.contact_email || undefined, role: u.contact_role || undefined }
                  : undefined,
              status: statusOf(u.status),
              sourceSegmentIds: ids(u.segment_ids),
              decision: 'pending',
            }),
          ),
        facts: extractFacts(sents),
        uncertainties: extractUncertainties(sents, input.segments),
        prefs: (raw.prefs || [])
          .filter((x) => x.content?.trim())
          .slice(0, 6)
          .map((x): PrefSuggestion => {
            const src = firstSeg(x.segment_ids);
            return {
              id: uid("p"),
              type: x.type === "avoid" ? "avoid" : "preference",
              content: x.content.trim(),
              target: x.target === "contact" ? "contact" : "customer",
              targetName: (x.target_name || "").trim() || shortName(customer),
              sensitivity: "normal",
              sourceText: src?.text ? truncate(src.text, 80) : x.content,
              sourceLabel: SRC_LABEL[src?.source || "text"],
              decision: "pending",
            };
          }),
        todos: (raw.todos || [])
          .filter((t) => t.content?.trim())
          .slice(0, 8)
          .map((t) => ({
            id: uid("t"),
            content: t.content.trim(),
            ownerId: input.salesId,
            due: /^\d{4}-\d{2}-\d{2}$/.test(t.due || "") ? t.due : undefined,
            keep: true,
          })),
        insights: [],
        purpose: raw.purpose?.trim() || undefined,
        generatedAt: new Date().toISOString(),
      };
    },
  };
}

export interface CardResult {
  company_name?: string;
  tax_id?: string;
  company_phone?: string;
  fax?: string;
  city?: string;
  district?: string;
  street?: string;
  website?: string;
  contact_name?: string;
  title?: string;
  department?: string;
  mobile?: string;
  email?: string;
  raw_text?: string;
}

/** 名片辨識(本機 AI 伺服器的視覺模型) */
export async function remoteReadCard(uri: string, name: string, mime: string, onProgress?: (m: string) => void): Promise<CardResult> {
  const cfg = serverConfig();
  if (!cfg) throw new Error('尚未設定 AI 伺服器');
  const fd = await fileForm(uri, name, mime);
  return runJob<CardResult>(cfg, '/jobs/card', fd, onProgress);
}
