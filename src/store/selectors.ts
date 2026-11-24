import type { AnswerItem, AppState, Customer, Question, QuestionSet, Schedule, Todo, User, Visit, VisitType } from '../types';
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
