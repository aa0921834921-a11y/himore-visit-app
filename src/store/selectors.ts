import type { AnswerItem, AppState, CategoryItem, CategoryKey, Customer, Question, QuestionSet, QuestionSetItem, Schedule, Todo, User, Visit, VisitKind, VisitType } from '../types';
import { ymd } from '../lib/util';

export const currentUser = (s: AppState): User | undefined => s.users.find((u) => u.id === s.sessionUserId);
export const userById = (s: AppState, id?: string) => s.users.find((u) => u.id === id);
export const customerById = (s: AppState, id?: string): Customer | undefined => s.customers.find((c) => c.id === id);
export const questionById = (s: AppState, id?: string): Question | undefined => s.questions.find((q) => q.id === id);
export const setById = (s: AppState, id?: string): QuestionSet | undefined => s.questionSets.find((q) => q.id === id);
export const visitById = (s: AppState, id?: string): Visit | undefined => s.visits.find((v) => v.id === id);
export const scheduleById = (s: AppState, id?: string): Schedule | undefined => s.schedules.find((x) => x.id === id);

export function confirmedVisitsOf(s: AppState, customerId: string): Visit[] {
  return s.visits
    .filter((v) => v.customerId === customerId && v.status === 'confirmed')
    .sort((a, b) => b.visitAt.localeCompare(a.visitAt));
}

export function lastConfirmedVisit(s: AppState, customerId: string): Visit | undefined {
  return confirmedVisitsOf(s, customerId)[0];
}

export function customerVisitType(s: AppState, customerId?: string): VisitType {
  if (!customerId) return '初次';
  return confirmedVisitsOf(s, customerId).length ? '複訪' : '初次';
}

export function todaySchedules(s: AppState, userId: string): Schedule[] {
  const t = ymd();
  return s.schedules.filter((x) => x.date === t && x.salesId === userId).sort((a, b) => a.time.localeCompare(b.time));
}

export function pendingConfirmVisits(s: AppState, userId: string): Visit[] {
  return s.visits.filter((v) => v.salesId === userId && v.status === 'pending_confirm').sort((a, b) => b.visitAt.localeCompare(a.visitAt));
}

export function processingVisits(s: AppState, userId: string): Visit[] {
  return s.visits.filter((v) => v.salesId === userId && (v.status === 'processing' || v.status === 'failed'));
}

export function pendingUploads(s: AppState, userId?: string): Visit[] {
  return s.visits.filter((v) => (!userId || v.salesId === userId) && v.status !== 'draft' && v.upload !== 'done');
}

export function todosDue(s: AppState, userId: string): Todo[] {
  const t = ymd();
  return s.todos
    .filter((x) => x.ownerId === userId && !x.done && x.due && x.due <= t)
    .sort((a, b) => (a.due || '').localeCompare(b.due || ''));
}

export function openTodosOfCustomer(s: AppState, customerId: string): Todo[] {
  return s.todos.filter((t) => t.customerId === customerId && !t.done).sort((a, b) => (a.due || '9').localeCompare(b.due || '9'));
}

export const isHandled = (a: AnswerItem) => a.status === 'answered' || a.status === 'partial' || a.status === 'not_provided' || a.status === 'na';
export const isAnswered = (a: AnswerItem) => a.status === 'answered' || a.status === 'partial';

export function requiredProgress(v?: Visit) {
  const answers = v?.ai?.answers || [];
  const req = answers.filter((a) => a.required);
  const handled = req.filter(isHandled);
  return { total: req.length, handled: handled.length, unhandled: req.filter((a) => !isHandled(a)) };
}

export function avoidItems(s: AppState, customerId: string) {
  return s.preferences.filter((p) => p.customerId === customerId && p.type === 'avoid');
}

/** 已知與待問:依所有已入庫拜訪,題組中已回覆的題目算已知 */
export function knownAndPending(s: AppState, customerId: string, questionSetId?: string) {
  const set = setById(s, questionSetId);
  const visits = confirmedVisitsOf(s, customerId);
  const answered = new Map<string, string>();
  visits.forEach((v) =>
    v.ai?.answers.forEach((a) => {
      if (isAnswered(a) && a.answer && !answered.has(a.questionId)) answered.set(a.questionId, a.answer);
    }),
  );
  const items = set?.items || [];
  const known = items.filter((i) => answered.has(i.questionId));
  const pending = items.filter((i) => !answered.has(i.questionId));
  return { known, pending, answered };
}

export function salesUsers(s: AppState) {
  return s.users.filter((u) => u.role === 'sales');
}

/** 初次拜訪預設套用的共用模板 */
export function defaultFirstSet(s: AppState): QuestionSet | undefined {
  const active = s.questionSets.filter((x) => x.active && (x.scope || 'template') === 'template');
  return active.find((x) => x.defaultFirstVisit) || active[0];
}

/** 安排拜訪時可選的題組:共用模板+該客戶專屬題組 */
export function setsForCustomer(s: AppState, customerId?: string): QuestionSet[] {
  return s.questionSets.filter((x) => x.active && ((x.scope || 'template') === 'template' || (customerId && x.customerId === customerId)));
}

/** 依拜訪類型建議題組:初次→預設初訪模板;複訪→該客戶最新的專屬題組 */
export function suggestedSetId(s: AppState, customerId: string | undefined, visitType: VisitType): string | undefined {
  if (visitType === '複訪' && customerId) {
    const own = s.questionSets.filter((x) => x.active && x.scope === 'customer' && x.customerId === customerId);
    if (own.length) return own[own.length - 1].id;
  }
  return defaultFirstSet(s)?.id;
}

/** 已入庫、主管尚未審閱的拜訪 */
export function visitsToReview(s: AppState): Visit[] {
  return s.visits.filter((v) => v.status === 'confirmed' && !v.review?.comment && !v.review?.nextSetId).sort((a, b) => b.visitAt.localeCompare(a.visitAt));
}

/** 產業別(複選);相容舊資料的單一產業欄位 */
export function industriesOf(c?: Customer): string[] {
  if (!c) return [];
  return c.industries?.length ? c.industries : c.industry ? [c.industry] : [];
}

export const DECISION_ROLES = ['決策者', '影響者', '技術評估', '採購窗口', '使用者', '未確認'] as const;

/** 拜訪目的:業務/主管填寫的優先,其次 AI 找出的,再其次題庫中「目的」那一題的回覆 */
export function purposeOf(v?: Visit, s?: AppState): string | undefined {
  if (!v) return undefined;
  if (v.purpose || v.ai?.purpose) return v.purpose || v.ai?.purpose;
  if (!s) return undefined;
  const a = v.ai?.answers.find((x) => x.answer && questionById(s, x.questionId)?.text.includes('目的'));
  return a?.answer;
}

// ---------- 七大分類(舊資料由五欄摘要轉換) ----------

const LEGACY_MAP: [CategoryKey, 'keyPoints' | 'needs' | 'competitors' | 'objections' | 'nextSteps'][] = [
  ['c1', 'keyPoints'],
  ['c2', 'needs'],
  ['c5', 'competitors'],
  ['c6', 'objections'],
  ['c7', 'nextSteps'],
];

export function categoriesOf(v?: Visit): Partial<Record<CategoryKey, CategoryItem[]>> {
  const a = v?.ai;
  if (!a) return {};
  if (a.categories) return a.categories;
  const out: Partial<Record<CategoryKey, CategoryItem[]>> = {};
  LEGACY_MAP.forEach(([k, f]) => {
    const t = a.summary[f]?.text;
    if (t && t !== '未知') out[k] = [{ id: `${k}_legacy`, text: t, status: 'explicit', sourceSegmentIds: a.summary[f].sourceSegmentIds }];
  });
  return out;
}

export function visitKindOf(v?: Visit): VisitKind {
  return v?.ai?.visitKind || 'effective';
}

// ---------- 題目自動追蹤 ----------

export interface TrackedQuestion {
  questionId: string;
  status: 'collected' | 'partial' | 'missing' | 'paused';
  answer?: string;
  missing?: string;
  reason?: string;
  visitId: string;
  at: string;
}

/** 客戶的題目追蹤狀態(依已入庫拜訪,由舊到新;已取得不再追蹤,客戶拒答或不適用暫停追蹤) */
export function questionTracking(s: AppState, customerId?: string, excludeVisitId?: string): Record<string, TrackedQuestion> {
  const out: Record<string, TrackedQuestion> = {};
  if (!customerId) return out;
  s.visits
    .filter((v) => v.customerId === customerId && v.status === 'confirmed' && v.id !== excludeVisitId && v.ai)
    .sort((a, b) => a.visitAt.localeCompare(b.visitAt))
    .forEach((v) => {
      v.ai!.answers.forEach((a) => {
        const prev = out[a.questionId];
        const base = { questionId: a.questionId, visitId: v.id, at: v.visitAt };
        if (a.status === 'answered') out[a.questionId] = { ...base, status: 'collected', answer: a.answer };
        else if (a.status === 'not_provided' || a.status === 'na') out[a.questionId] = { ...base, status: 'paused', reason: a.reason };
        else if (prev?.status === 'collected' || prev?.status === 'paused') return;
        else if (a.status === 'partial') out[a.questionId] = { ...base, status: 'partial', answer: a.answer, missing: a.missing };
        else if (a.status === 'uncovered' && prev?.status !== 'partial') out[a.questionId] = { ...base, status: 'missing' };
      });
    });
  return out;
}

/** 需要在下次拜訪補問的題目 */
export function pendingFollowups(s: AppState, customerId?: string, excludeVisitId?: string): (TrackedQuestion & { question?: Question })[] {
  return Object.values(questionTracking(s, customerId, excludeVisitId))
    .filter((t) => t.status === 'partial' || t.status === 'missing')
    .map((t) => ({ ...t, question: questionById(s, t.questionId) }))
    .filter((t) => t.question?.active !== false)
    .sort((a, b) => (a.question?.code || '').localeCompare(b.question?.code || '', undefined, { numeric: true }));
}

/** 這次拜訪要問的題目:題組 + 自動帶入的追蹤題 */
export function visitQuestionItems(s: AppState, v?: Visit): QuestionSetItem[] {
  if (!v) return [];
  const set = setById(s, v.questionSetId);
  const items: QuestionSetItem[] = [...(set?.items || [])];
  const have = new Set(items.map((i) => i.questionId));
  pendingFollowups(s, v.customerId, v.id).forEach((t) => {
    if (!have.has(t.questionId)) items.push({ questionId: t.questionId, required: false, tracked: true });
  });
  return items;
}
