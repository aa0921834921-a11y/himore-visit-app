// POC 資料模型:對應「POC 範圍」文件第 7 節的六個物件,加上帳號、題組、拜訪安排、稽核與設定。

export type Role = 'sales' | 'admin';

export interface User {
  id: string;
  account: string;
  password: string; // POC 僅存在本機,正式版改由伺服器驗證
  name: string;
  team: string;
  role: Role;
  active: boolean;
  createdAt: string;
}

/** 聯絡人在採購決策中的角色 */
export type DecisionRole = '決策者' | '影響者' | '技術評估' | '採購窗口' | '使用者' | '未確認';

export interface Contact {
  id: string;
  name: string;
  title?: string; // 職稱
  department?: string; // 部門
  phone?: string;
  email?: string;
  decisionRole?: DecisionRole;
  preference?: string; // 聯絡人偏好(聯絡方式、溝通風格等,手動填寫;AI 抓到的偏好另存於偏好與避免事項)
}

export interface Customer {
  id: string;
  code: string; // 例:C100328
  name: string;
  taxId?: string; // 統一編號
  address?: string;
  website?: string;
  category?: string; // 客戶分類(選項由後台系統設定維護)
  industries?: string[]; // 產業別(複選)
  industry?: string; // 舊版單一產業欄位,僅相容舊資料
  mainProducts?: string;
  mainEquipment?: string;
  evaluatingSeries?: string;
  ownerId: string;
  contacts: Contact[];
  note?: string;
  createdAt: string;
  cachedAt?: string;
}

export interface Question {
  id: string;
  code: string; // Q1、Q2…
  text: string;
  category: string;
  active: boolean;
}

export interface QuestionSetItem {
  questionId: string;
  required: boolean;
}

export interface QuestionSet {
  id: string;
  name: string;
  items: QuestionSetItem[];
  active: boolean;
  /** template:共用模板(可套用到任何客戶);customer:某客戶專屬(例如主管依初訪結果設計的第二次訪談) */
  scope?: 'template' | 'customer';
  customerId?: string;
  /** 初次拜訪預設套用的共用模板(只會有一個) */
  defaultFirstVisit?: boolean;
  fromVisitId?: string; // 依哪一次拜訪設計
  note?: string; // 給業務的訪談重點
}

export type VisitType = '初次' | '複訪';

export interface Schedule {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  salesId: string;
  customerId: string;
  visitType: VisitType;
  questionSetId: string;
  purpose?: string; // 拜訪目的
  note?: string;
  visitId?: string; // 已開始記錄時連結的拜訪紀錄
  createdBy: string;
  createdAt: string;
}

export type InputSource = 'recording' | 'dictation' | 'text';
export type VisitStatus = 'draft' | 'processing' | 'pending_confirm' | 'confirmed' | 'failed';
export type UploadState = 'pending' | 'uploading' | 'done' | 'failed';

export interface Segment {
  id: string;
  text: string;
  source: InputSource;
  speaker?: string; // 業務、客戶、語者未確認、業務補充
  start?: number; // 秒,僅錄音
  end?: number;
  questionId?: string; // 逐題口述時對應的題目
}

export interface ConsentRecord {
  at: string;
  byUserId: string;
  version: string;
  text: string;
}

export interface DictationAnswer {
  questionId: string;
  text: string;
  audioUri?: string;
  durationMs?: number;
  status?: 'not_provided' | 'na';
  reason?: string;
}

export interface Attachment {
  id: string;
  kind: 'photo' | 'file';
  name: string;
  uri: string;
  mimeType?: string;
  size?: number;
  addedAt: string;
}

/** 主要記錄方式之外,後補的口述或文字 */
export interface Supplement {
  id: string;
  kind: 'dictation' | 'text';
  text: string;
  audioUri?: string;
  durationMs?: number;
  addedAt: string;
}

export interface RawContent {
  text?: string; // 文字輸入或口述自由補充的文字
  audioUri?: string; // 錄音或自由口述的錄音檔
  audioDurationMs?: number;
  /** 自動分段錄音:每段一個檔案(中途當機時已存的段落不會遺失)。有值時以此為準,audioUri 為第一段 */
  audioParts?: { uri: string; durationMs: number }[];
  /** 從手機內建錄音 App 匯入的錄音檔 */
  audioImported?: { name: string; size?: number };
  audioDeleted?: boolean;
  marks?: number[]; // 標記重點的秒數
  selfCheckedQuestionIds?: string[]; // 錄音中自評已談到的題目
  dictation?: DictationAnswer[];
  consent?: ConsentRecord;
  segments?: Segment[]; // 轉文字後的逐字稿
  supplements?: Supplement[]; // 後補口述/文字(可與錄音等主要方式並存)
  attachments?: Attachment[]; // 照片與檔案
}

export type AnswerStatus = 'answered' | 'partial' | 'uncovered' | 'not_provided' | 'na';

export interface AnswerItem {
  questionId: string;
  required: boolean;
  status: AnswerStatus;
  answer: string;
  reason?: string;
  sourceSegmentIds: string[];
}

export type SummaryKey = 'keyPoints' | 'needs' | 'competitors' | 'objections' | 'nextSteps';

export interface SummaryField {
  text: string;
  sourceSegmentIds: string[];
}

export type FactKind = 'amount' | 'quantity' | 'date' | 'model' | 'commitment' | 'tonnage';

export interface Fact {
  id: string;
  kind: FactKind;
  text: string;
  sourceSegmentId?: string;
  viewed: boolean;
}

export interface Uncertainty {
  id: string;
  text: string;
  sourceSegmentId?: string;
  resolved: boolean;
}

export interface PrefSuggestion {
  id: string;
  type: 'preference' | 'avoid';
  content: string;
  target: 'customer' | 'contact';
  targetName: string;
  sensitivity: 'normal' | 'restricted';
  sourceText: string;
  sourceLabel: string; // 現場錄音、業務口述、文字輸入
  decision: 'pending' | 'accepted' | 'skipped';
}

export interface TodoSuggestion {
  id: string;
  content: string;
  ownerId: string;
  due?: string; // YYYY-MM-DD,無明確日期就留空
  keep: boolean;
}

/** 題庫之外談到的內容,分類彙整到報告 */
export type InsightKind = 'reminder' | 'avoid' | 'opportunity' | 'other';

export interface Insight {
  id: string;
  kind: InsightKind;
  text: string;
  sourceSegmentId?: string;
}

export interface AnalysisResult {
  mock: boolean;
  suggestedCustomerId?: string;
  answers: AnswerItem[];
  summary: Record<SummaryKey, SummaryField>;
  facts: Fact[];
  uncertainties: Uncertainty[];
  prefs: PrefSuggestion[];
  todos: TodoSuggestion[];
  insights?: Insight[];
  purpose?: string; // AI 找出的拜訪目的
  generatedAt: string;
}

/** 主管審閱 */
export interface VisitReview {
  by: string;
  at: string;
  comment: string;
  nextSetId?: string; // 依這次拜訪設計的下次訪談題組
  nextScheduleId?: string;
}

export interface Visit {
  id: string;
  code: string; // V250121-001
  scheduleId?: string;
  customerId?: string;
  salesId: string;
  visitAt: string;
  visitType: VisitType;
  questionSetId?: string;
  purpose?: string; // 拜訪目的:安排時填寫,或由 AI 從內容找出
  source: InputSource;
  status: VisitStatus;
  upload: UploadState;
  stage: number; // 0 未開始、1 上傳、2 轉文字、3 整理、4 題庫比對、5 完成
  stageNote?: string; // 本機 AI 伺服器回報的處理進度
  error?: string;
  raw: RawContent;
  ai?: AnalysisResult; // AI 草稿,確認前不得出現在客戶檔案
  editCount: number;
  review?: VisitReview;
  confirmedAt?: string;
  confirmedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Preference {
  id: string;
  customerId: string;
  type: 'preference' | 'avoid';
  content: string;
  target: 'customer' | 'contact';
  targetName: string;
  sensitivity: 'normal' | 'restricted';
  sourceVisitId?: string;
  sourceText?: string;
  createdAt: string;
}

export interface Todo {
  id: string;
  customerId?: string;
  visitId?: string;
  content: string;
  ownerId: string;
  due?: string;
  done: boolean;
  createdAt: string;
}

export type AuditType = 'consent' | 'confirm' | 'export' | 'login' | 'briefing_view' | 'import';

export interface AuditEvent {
  id: string;
  at: string;
  userId: string;
  type: AuditType;
  detail: string;
  visitId?: string;
  customerId?: string;
}

export interface Settings {
  retentionDays: number;
  consentVersion: string;
  consentText: string;
  glossary: string[];
  aiTermsConfirmed: boolean;
  trialAccountCap: number;
  demoMode: boolean; // 顯示「填入示範內容」等測試捷徑
  simulateFailureNext: boolean; // 示範用:下一筆處理失敗
  notifyEnabled: boolean;
  uploadOnWifiOnly: boolean;
  integration?: IntegrationSettings;
  /** 本機 AI 伺服器(POC):有填網址就改用真實 AI,沒填用模擬 AI。設定存在各自的裝置 */
  aiServer?: { url: string; key: string; diarization: boolean };
  industryOptions?: string[]; // 產業別選項
  customerCategories?: string[]; // 客戶分類選項
}

/** 對外串接(預留):Webhook 或 API。POC 只產生標準格式的資料並排入佇列,不實際送出 */
export interface IntegrationSettings {
  enabled: boolean;
  kind: 'webhook' | 'api';
  name: string; // 目標平台名稱,例:ERP、CRM、Teams
  url: string;
  authHeader: string;
  trigger: 'manual' | 'on_confirm' | 'on_review';
}

export interface OutboxItem {
  id: string;
  visitId: string;
  target: string;
  event: 'visit.confirmed' | 'visit.reviewed' | 'visit.manual';
  status: 'held' | 'sent' | 'failed'; // held:串接未啟用,先保留
  payload: string; // JSON
  createdAt: string;
}

export interface AppState {
  version: number;
  sessionUserId?: string;
  onboarded: boolean;
  users: User[];
  customers: Customer[];
  questions: Question[];
  questionSets: QuestionSet[];
  schedules: Schedule[];
  visits: Visit[];
  preferences: Preference[];
  todos: Todo[];
  audit: AuditEvent[];
  outbox?: OutboxItem[];
  settings: Settings;
  lastSyncAt?: string;
}
