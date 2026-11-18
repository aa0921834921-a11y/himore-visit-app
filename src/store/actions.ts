import type {
  AppState,
  AuditType,
  Contact,
  Customer,
  InputSource,
  Question,
  QuestionSet,
  RawContent,
  Schedule,
  Settings,
  Todo,
  User,
  Visit,
} from '../types';
import { pad, uid } from '../lib/util';
import { getState, setState } from './store';
import { customerVisitType, scheduleById } from './selectors';

const nowIso = () => new Date().toISOString();

export function audit(type: AuditType, detail: string, extra: { visitId?: string; customerId?: string } = {}) {
  const s = getState();
  setState((st) => ({
    ...st,
    audit: [{ id: uid('a'), at: nowIso(), userId: s.sessionUserId || 'system', type, detail, ...extra }, ...st.audit].slice(0, 2000),
  }));
}

// ---------- 登入 ----------
export function login(account: string, password: string): { ok: true; user: User } | { ok: false } {
  const u = getState().users.find((x) => x.account.toLowerCase() === account.trim().toLowerCase() && x.password === password && x.active);
  if (!u) return { ok: false };
  setState((s) => ({ ...s, sessionUserId: u.id }));
  audit('login', `${u.name} 登入`);
  return { ok: true, user: u };
}

export function logout() {
  setState((s) => ({ ...s, sessionUserId: undefined }));
}

export function setOnboarded() {
  setState((s) => ({ ...s, onboarded: true }));
}

// ---------- 拜訪紀錄 ----------
function nextVisitCode(s: AppState, at: Date): string {
  const prefix = `V${String(at.getFullYear()).slice(2)}${pad(at.getMonth() + 1)}${pad(at.getDate())}-`;
  const seq = s.visits.filter((v) => v.code.startsWith(prefix)).length + 1;
  return `${prefix}${pad(seq, 3)}`;
}

export function createDraftVisit(opts: { scheduleId?: string; customerId?: string; questionSetId?: string; source: InputSource; visitAt?: string }): Visit {
  const s = getState();
  const sch = scheduleById(s, opts.scheduleId);
  const at = opts.visitAt ? new Date(opts.visitAt) : new Date();
  const customerId = sch?.customerId || opts.customerId;
  const v: Visit = {
    id: uid('v'),
    code: nextVisitCode(s, at),
    scheduleId: sch?.id,
    customerId,
    salesId: s.sessionUserId || '',
    visitAt: at.toISOString(),
    visitType: sch?.visitType || customerVisitType(s, customerId),
    questionSetId: sch?.questionSetId || opts.questionSetId,
    source: opts.source,
    status: 'draft',
    upload: 'pending',
    stage: 0,
    raw: {},
    editCount: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  setState((st) => ({
    ...st,
    visits: [v, ...st.visits],
    schedules: sch ? st.schedules.map((x) => (x.id === sch.id ? { ...x, visitId: v.id } : x)) : st.schedules,
  }));
  return v;
}

export function patchVisit(id: string, patch: Partial<Visit> | ((v: Visit) => Visit)) {
  setState((s) => ({
    ...s,
    visits: s.visits.map((v) => (v.id === id ? { ...(typeof patch === 'function' ? patch(v) : { ...v, ...patch }), updatedAt: nowIso() } : v)),
  }));
}

export function patchRaw(id: string, raw: Partial<RawContent>) {
  patchVisit(id, (v) => ({ ...v, raw: { ...v.raw, ...raw } }));
}

export function discardDraft(id: string) {
  setState((s) => ({
    ...s,
    visits: s.visits.filter((v) => v.id !== id),
    schedules: s.schedules.map((x) => (x.visitId === id ? { ...x, visitId: undefined } : x)),
  }));
}

export function recordConsent(visitId: string) {
  const s = getState();
  patchRaw(visitId, {
    consent: { at: nowIso(), byUserId: s.sessionUserId || '', version: s.settings.consentVersion, text: s.settings.consentText },
  });
  audit('consent', `取得錄音同意(${s.settings.consentVersion})`, { visitId });
}

/** 收集完成:轉為處理中,交給處理流程 */
export function markSubmitted(visitId: string) {
  patchVisit(visitId, { status: 'processing', stage: 1, upload: 'pending', error: undefined });
}

/** 確認並入庫:確認後才寫入客戶檔案(偏好與避免事項、待辦) */
export function confirmVisit(visitId: string) {
  const s = getState();
  const v = s.visits.find((x) => x.id === visitId);
  if (!v || !v.ai) return;
  const at = nowIso();
  const prefs = v.ai.prefs.filter((p) => p.decision === 'accepted' && v.customerId);
  const todos = v.ai.todos.filter((t) => t.keep && t.content.trim());
  setState((st) => ({
    ...st,
    visits: st.visits.map((x) => (x.id === visitId ? { ...x, status: 'confirmed', confirmedAt: at, confirmedBy: st.sessionUserId, updatedAt: at } : x)),
    preferences: [
      ...prefs.map((p) => ({
        id: uid('pref'),
        customerId: v.customerId as string,
        type: p.type,
        content: p.content,
        target: p.target,
        targetName: p.targetName,
        sensitivity: p.sensitivity,
        sourceVisitId: v.id,
        sourceText: p.sourceText,
        createdAt: at,
      })),
      ...st.preferences,
    ],
    todos: [
      ...todos.map(
        (t): Todo => ({ id: uid('todo'), customerId: v.customerId, visitId: v.id, content: t.content, ownerId: t.ownerId, due: t.due, done: false, createdAt: at }),
      ),
      ...st.todos,
    ],
  }));
  audit('confirm', `確認入庫 ${v.code}`, { visitId, customerId: v.customerId });
}

// ---------- 客戶 ----------
function nextCustomerCode(s: AppState): string {
  const max = s.customers.reduce((m, c) => {
    const n = Number(c.code.replace(/\D/g, ''));
    return isNaN(n) ? m : Math.max(m, n);
  }, 100000);
  return `C${max + 1}`;
}

export function addCustomer(input: Partial<Customer> & { name: string }): Customer {
  const s = getState();
  const c: Customer = {
    id: uid('c'),
    code: input.code?.trim() || nextCustomerCode(s),
    name: input.name.trim(),
    industry: input.industry,
    mainProducts: input.mainProducts,
    mainEquipment: input.mainEquipment,
    evaluatingSeries: input.evaluatingSeries,
    ownerId: input.ownerId || s.sessionUserId || '',
    contacts: input.contacts || [],
    note: input.note,
    createdAt: nowIso(),
  };
  setState((st) => ({ ...st, customers: [c, ...st.customers] }));
  return c;
}

export function updateCustomer(id: string, patch: Partial<Customer>) {
  setState((s) => ({ ...s, customers: s.customers.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
}

export function addContact(customerId: string, contact: Omit<Contact, 'id'>) {
  setState((s) => ({
    ...s,
    customers: s.customers.map((c) => (c.id === customerId ? { ...c, contacts: [...c.contacts, { ...contact, id: uid('ct') }] } : c)),
  }));
}

export function importCustomers(rows: { name: string; contact?: string; owner?: string }[]): { added: number; skipped: number } {
  const s = getState();
  let added = 0;
  let skipped = 0;
  let seq = Number(nextCustomerCode(s).slice(1));
  const existing = new Set(s.customers.map((c) => c.name));
  const fresh: Customer[] = [];
  rows.forEach((r) => {
    const name = r.name.trim();
    if (!name || existing.has(name)) {
      skipped++;
      return;
    }
    const owner = s.users.find((u) => u.name === r.owner?.trim() || u.account === r.owner?.trim());
    fresh.push({
      id: uid('c'),
      code: `C${seq++}`,
      name,
      ownerId: owner?.id || '',
      contacts: r.contact?.trim() ? [{ id: uid('ct'), name: r.contact.trim() }] : [],
      createdAt: nowIso(),
    });
    existing.add(name);
    added++;
  });
  setState((st) => ({ ...st, customers: [...fresh, ...st.customers] }));
  audit('import', `匯入客戶 ${added} 筆,略過 ${skipped} 筆`);
  return { added, skipped };
}

// ---------- 待辦與偏好 ----------
export function toggleTodo(id: string) {
  setState((s) => ({ ...s, todos: s.todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) }));
}

export function deletePreference(id: string) {
  setState((s) => ({ ...s, preferences: s.preferences.filter((p) => p.id !== id) }));
}

// ---------- 後台 ----------
export function upsertQuestion(q: Partial<Question> & { text: string }) {
  setState((s) => {
    if (q.id && s.questions.some((x) => x.id === q.id)) {
      return { ...s, questions: s.questions.map((x) => (x.id === q.id ? { ...x, ...q } as Question : x)) };
    }
    const n = s.questions.reduce((m, x) => Math.max(m, Number(x.code.replace(/\D/g, '')) || 0), 0) + 1;
    const nq: Question = { id: uid('q'), code: `Q${n}`, text: q.text, category: q.category || '其他', active: true };
    return { ...s, questions: [...s.questions, nq] };
  });
}

export function upsertQuestionSet(set: Partial<QuestionSet> & { name: string }) {
  setState((s) => {
    if (set.id && s.questionSets.some((x) => x.id === set.id)) {
      return { ...s, questionSets: s.questionSets.map((x) => (x.id === set.id ? { ...x, ...set } as QuestionSet : x)) };
    }
    const ns: QuestionSet = { id: uid('qs'), name: set.name, items: set.items || [], active: true };
    return { ...s, questionSets: [...s.questionSets, ns] };
  });
}

export function upsertSchedule(x: Omit<Schedule, 'id' | 'createdAt' | 'createdBy'> & { id?: string }) {
  setState((s) => {
    if (x.id && s.schedules.some((y) => y.id === x.id)) {
      return { ...s, schedules: s.schedules.map((y) => (y.id === x.id ? { ...y, ...x } as Schedule : y)) };
    }
    const ns: Schedule = { ...x, id: uid('s'), createdAt: nowIso(), createdBy: s.sessionUserId || '' };
    return { ...s, schedules: [...s.schedules, ns] };
  });
}

export function deleteSchedule(id: string) {
  setState((s) => ({ ...s, schedules: s.schedules.filter((x) => x.id !== id) }));
}

export function upsertUser(u: Partial<User> & { name: string; account: string }) {
  setState((s) => {
    if (u.id && s.users.some((x) => x.id === u.id)) {
      return { ...s, users: s.users.map((x) => (x.id === u.id ? { ...x, ...u } as User : x)) };
    }
    const nu: User = {
      id: uid('u'),
      account: u.account.trim(),
      password: u.password || '1234',
      name: u.name.trim(),
      team: u.team || '',
      role: u.role || 'sales',
      active: true,
      createdAt: nowIso(),
    };
    return { ...s, users: [...s.users, nu] };
  });
}

export function updateSettings(patch: Partial<Settings>) {
  setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
}
