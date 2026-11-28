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
  decisionRole?: string; // 角色(選項由後台維護,例:決策者、採購窗口)
  note?: string; // 備註
  preference?: string; // 舊版欄位,顯示時併入備註
}

/** 射出機(工廠資訊,可多筆) */
export interface Machine {
  id: string;
  brand?: string;
  tonnage?: string; // 例:350
  qty?: number;
  note?: string;
}

export type AutomationLevel = '傳統人工' | '半自動化' | '全自動化';

/** 欄位來源:由拜訪取得並經業務確認寫入 */
export interface FieldSource {
  visitId?: string;
  at: string;
  by: string;
  quote?: string;
}

export interface Customer {
  id: string;
  code: string; // 例:C100328
  name: string;
  taxId?: string; // 統一編號
  principal?: string; // 公司負責人
  phone?: string; // 公司電話(區碼-電話號碼)
  addr?: { city?: string; district?: string; street?: string }; // 地址:縣市/區域/街道門號
  address?: string; // 舊版單一地址欄位
  website?: string;
  category?: string; // 客戶狀態(潛在、新、既有、重點…)
  customerTypes?: string[]; // 客戶類型(直接客戶、經銷商…)
  industries?: string[]; // 所屬產業(複選)
  products?: string[]; // 射出產品(複選,選項由後台建檔)
  identities?: string[]; // 客戶身分(品牌廠、代工廠…)
  moldInjection?: string[]; // 模具與射出(自有模具、射出外包…)
  markets?: string[]; // 產品應用市場
  employeeScale?: string; // 員工規模
  machines?: Machine[]; // 射出機清單
  automation?: { level?: AutomationLevel; processes: string[]; other?: string };
  fieldSources?: Record<string, FieldSource>; // 由拜訪確認寫入的欄位來源
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
  hint?: string; // 希望帶回的資訊
  category: string;
  active: boolean;
}

export interface QuestionSetItem {
  questionId: string;
  required: boolean;
  tracked?: boolean; // 前次拜訪未取得/部分取得,自動帶入追蹤
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
  tracked?: boolean; // 自動帶入的追蹤題
  status: AnswerStatus;
  answer: string;
  reason?: string;
  missing?: string; // 部分取得時:還缺哪些資訊(下次拜訪自動提示補問)
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

/** 七大資訊分類 */
export type CategoryKey = 'c1' | 'c2' | 'c3' | 'c4' | 'c5' | 'c6' | 'c7';
export type InfoStatus = 'explicit' | 'possible' | 'pending'; // 明確表示/可能/待確認
export type UpdateTarget = 'company' | 'factory' | 'contact' | 'preference';

export interface CategoryItem {
  id: string;
  text: string;
  aspect?: string; // 子項目,例:數量、預算、時程
  status: InfoStatus;
  infoTime?: string; // 資訊時間,例:計畫明年 Q2
  target?: UpdateTarget; // 可更新到客戶檔案的位置
  mentionedBy?: string; // 提及者
  sourceSegmentIds: string[];
}

/** 一般拜訪資訊(未遇窗口、對方無暇訪談、暫無新增資訊、其他接洽情況) */
export type VisitKind = 'effective' | 'general';

/** AI 建議寫回客戶檔案的欄位(業務逐筆採用後才寫入) */
export type ProfileField =
  | 'principal'
  | 'phone'
  | 'address'
  | 'website'
  | 'customerTypes'
  | 'industries'
  | 'products'
  | 'markets'
  | 'employeeScale'
  | 'machine'
  | 'automationLevel'
  | 'automationProcess'
  | 'contact';

export interface ProfileUpdate {
  id: string;
  field: ProfileField;
  value: string; // 顯示用文字;陣列欄位為單一值
  machine?: { brand?: string; tonnage?: string; qty?: number };
  contact?: { name: string; title?: string; department?: string; phone?: string; email?: string; role?: string };
  status: InfoStatus;
  sourceSegmentIds: string[];
  decision: 'pending' | 'accepted' | 'rejected';
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
  visitKind?: VisitKind; // 有效拜訪/一般拜訪(業務可改)
  generalNotes?: string[]; // 一般拜訪資訊:未遇窗口、對方無暇…
  categories?: Partial<Record<CategoryKey, CategoryItem[]>>;
  profileUpdates?: ProfileUpdate[];
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
  industryOptions?: string[]; // 所屬產業選項
  customerCategories?: string[]; // 客戶狀態選項
  options?: Partial<Record<OptionKey, string[]>>; // 其他選項清單(後台維護)
}

export type OptionKey = 'customerTypes' | 'products' | 'identities' | 'moldInjection' | 'markets' | 'employeeScales' | 'contactRoles' | 'machineBrands' | 'automationProcesses';

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
