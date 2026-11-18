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

export interface Contact {
  id: string;
  name: string;
  title?: string;
  phone?: string;
}

export interface Customer {
  id: string;
  code: string; // 例:C100328
  name: string;
  industry?: string;
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
  speaker?: string; // 業務、客戶、語者未確認
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

export interface RawContent {
  text?: string; // 文字輸入或口述自由補充的文字
  audioUri?: string; // 錄音或自由口述的錄音檔
  audioDurationMs?: number;
  audioDeleted?: boolean;
  marks?: number[]; // 標記重點的秒數
  selfCheckedQuestionIds?: string[]; // 錄音中自評已談到的題目
  dictation?: DictationAnswer[];
  consent?: ConsentRecord;
  segments?: Segment[]; // 轉文字後的逐字稿
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

export interface AnalysisResult {
  mock: boolean;
  suggestedCustomerId?: string;
  answers: AnswerItem[];
  summary: Record<SummaryKey, SummaryField>;
  facts: Fact[];
  uncertainties: Uncertainty[];
  prefs: PrefSuggestion[];
  todos: TodoSuggestion[];
  generatedAt: string;
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
  source: InputSource;
  status: VisitStatus;
  upload: UploadState;
  stage: number; // 0 未開始、1 上傳、2 轉文字、3 整理、4 題庫比對、5 完成
  error?: string;
  raw: RawContent;
  ai?: AnalysisResult; // AI 草稿,確認前不得出現在客戶檔案
  editCount: number;
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
  settings: Settings;
  lastSyncAt?: string;
}
