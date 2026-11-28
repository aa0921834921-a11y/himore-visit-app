import type {
  AppState,
  AuditType,
  Contact,
  Customer,
  InputSource,
  AutomationLevel,
  OutboxItem,
  ProfileUpdate,
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
import { buildVisitReport } from '../services/report';

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
    purpose: sch?.purpose,
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

export function recordConsent(visitId: string, external = false) {
  const s = getState();
  const text = external ? `【外部錄音匯入】業務確認錄音前已依下列聲明取得客戶同意。\n${s.settings.consentText}` : s.settings.consentText;
  patchRaw(visitId, {
    consent: { at: nowIso(), byUserId: s.sessionUserId || '', version: s.settings.consentVersion, text },
  });
  audit('consent', `${external ? '匯入錄音,確認已取得同意' : '取得錄音同意'}(${s.settings.consentVersion})`, { visitId });
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
  const updates = (v.ai.profileUpdates || []).filter(isAcceptedUpdate);
  setState((st) => ({
    ...st,
    customers: v.customerId && updates.length ? st.customers.map((c) => (c.id === v.customerId ? applyProfileUpdates(c, updates, v, st.sessionUserId || '', at) : c)) : st.customers,
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
  audit('confirm', `確認入庫 ${v.code}${updates.length ? `,更新客戶資料 ${updates.length} 筆` : ''}`, { visitId, customerId: v.customerId });
  if (getState().settings.integration?.trigger === 'on_confirm') enqueueOutbox(visitId, 'visit.confirmed');
}

/** 客戶資料更新建議:業務採用的才寫入;未處理時「明確表示」預設採用,「可能/待確認」預設不採用 */
export function isAcceptedUpdate(u: ProfileUpdate): boolean {
  return u.decision === 'accepted' || (u.decision === 'pending' && u.status === 'explicit');
}

/** 把採用的更新寫進客戶檔案,並記錄來源(哪次拜訪、何時、誰確認、原句) */
export function applyProfileUpdates(c: Customer, updates: ProfileUpdate[], v: Visit, by: string, at: string): Customer {
  const x: Customer = { ...c, contacts: [...c.contacts], fieldSources: { ...(c.fieldSources || {}) } };
  const quote = (u: ProfileUpdate) => (v.raw.segments || []).find((sg) => u.sourceSegmentIds.includes(sg.id))?.text;
  const mark = (key: string, u: ProfileUpdate) => {
    x.fieldSources![key] = { visitId: v.id, at, by, quote: quote(u) };
  };
  const addTo = (arr: string[] | undefined, val: string) => (arr?.includes(val) ? arr : [...(arr || []), val]);
  updates.forEach((u) => {
    const val = u.value.trim();
    switch (u.field) {
      case 'principal':
      case 'phone':
      case 'website':
      case 'employeeScale':
        x[u.field] = val;
        mark(u.field, u);
        break;
      case 'address':
        x.address = val;
        x.addr = undefined;
        mark('address', u);
        break;
      case 'customerTypes':
      case 'industries':
      case 'products':
      case 'markets':
        x[u.field] = addTo(x[u.field], val);
        mark(u.field, u);
        break;
      case 'automationLevel':
        if (['傳統人工', '半自動化', '全自動化'].includes(val)) x.automation = { processes: [], ...x.automation, level: val as AutomationLevel };
        mark('automation', u);
        break;
      case 'automationProcess':
        x.automation = { ...x.automation, processes: addTo(x.automation?.processes, val) };
        mark('automation', u);
        break;
      case 'machine': {
        const m = u.machine || {};
        const list = [...(x.machines || [])];
        const i = list.findIndex((y) => y.tonnage && y.tonnage === m.tonnage && (!m.brand || !y.brand || y.brand === m.brand));
        if (i >= 0) list[i] = { ...list[i], brand: m.brand || list[i].brand, qty: m.qty ?? list[i].qty };
        else list.push({ id: uid('m'), brand: m.brand, tonnage: m.tonnage, qty: m.qty });
        x.machines = list;
        mark('machines', u);
        break;
      }
      case 'contact': {
        const ct = u.contact;
        if (!ct?.name) break;
        const i = x.contacts.findIndex((y) => y.name === ct.name);
        const merged = { title: ct.title, department: ct.department, phone: ct.phone, email: ct.email, decisionRole: ct.role };
        if (i >= 0) x.contacts[i] = { ...x.contacts[i], ...Object.fromEntries(Object.entries(merged).filter(([, val2]) => val2)) };
        else x.contacts.push({ id: uid('ct'), name: ct.name, ...merged });
        mark(`contact:${ct.name}`, u);
        break;
      }
    }
  });
  return x;
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
    ...input,
    id: uid('c'),
    code: input.code?.trim() || nextCustomerCode(s),
    name: input.name.trim(),
    ownerId: input.ownerId || s.sessionUserId || '',
    contacts: (input.contacts || []).map((x) => ({ ...x, id: x.id || uid('ct') })),
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

/** 聯絡人改到另一家客戶 */
export function moveContact(fromId: string, toId: string, contact: Contact) {
  setState((s) => ({
    ...s,
    customers: s.customers.map((c) =>
      c.id === fromId ? { ...c, contacts: c.contacts.filter((x) => x.id !== contact.id) } : c.id === toId ? { ...c, contacts: [...c.contacts, contact] } : c,
    ),
  }));
}

export function updateContact(customerId: string, contact: Contact) {
  setState((s) => ({
    ...s,
    customers: s.customers.map((c) => (c.id === customerId ? { ...c, contacts: c.contacts.map((x) => (x.id === contact.id ? contact : x)) } : c)),
  }));
}

export function removeContact(customerId: string, contactId: string) {
  setState((s) => ({
    ...s,
    customers: s.customers.map((c) => (c.id === customerId ? { ...c, contacts: c.contacts.filter((x) => x.id !== contactId) } : c)),
  }));
}

export interface CustomerImportRow {
  name: string;
  taxId?: string;
  address?: string;
  website?: string;
  category?: string;
  owner?: string;
  industries?: string[];
  principal?: string;
  phone?: string;
  addr?: { city?: string; district?: string; street?: string };
  customerTypes?: string[];
  products?: string[];
  contact?: Omit<Contact, 'id'>;
}

export function importCustomers(rows: CustomerImportRow[]): { added: number; skipped: number; contacts: number } {
  const s = getState();
  let added = 0;
  let skipped = 0;
  let contacts = 0;
  let seq = Number(nextCustomerCode(s).slice(1));
  const existing = new Set(s.customers.map((c) => c.name));
  const fresh = new Map<string, Customer>();
  rows.forEach((r) => {
    const name = r.name.trim();
    const ct = r.contact?.name?.trim() ? { ...r.contact, name: r.contact.name.trim(), id: uid('ct') } : undefined;
    // 同一公司多列:第一列建立公司,後面的列只加聯絡人
    const same = fresh.get(name);
    if (same) {
      if (ct) {
        same.contacts.push(ct);
        contacts++;
      }
      return;
    }
    if (!name || existing.has(name)) {
      skipped++;
      return;
    }
    const owner = s.users.find((u) => u.name === r.owner?.trim() || u.account === r.owner?.trim());
    fresh.set(name, {
      id: uid('c'),
      code: `C${seq++}`,
      name,
      taxId: r.taxId?.trim() || undefined,
      address: r.address?.trim() || undefined,
      website: r.website?.trim() || undefined,
      category: r.category?.trim() || undefined,
      industries: r.industries?.length ? r.industries : undefined,
      principal: r.principal?.trim() || undefined,
      phone: r.phone?.trim() || undefined,
      addr: r.addr && (r.addr.city || r.addr.district || r.addr.street) ? r.addr : undefined,
      customerTypes: r.customerTypes?.length ? r.customerTypes : undefined,
      products: r.products?.length ? r.products : undefined,
      ownerId: owner?.id || '',
      contacts: ct ? [ct] : [],
      createdAt: nowIso(),
    });
    if (ct) contacts++;
    added++;
  });
  setState((st) => ({ ...st, customers: [...Array.from(fresh.values()), ...st.customers] }));
  audit('import', `匯入客戶 ${added} 筆、聯絡人 ${contacts} 位,略過 ${skipped} 筆`);
  return { added, skipped, contacts };
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
    const nq: Question = { id: uid('q'), code: `Q${n}`, text: q.text, hint: q.hint, category: q.category || '其他', active: true };
    return { ...s, questions: [...s.questions, nq] };
  });
}

export function upsertQuestionSet(set: Partial<QuestionSet> & { name: string }) {
  setState((s) => {
    if (set.id && s.questionSets.some((x) => x.id === set.id)) {
      return { ...s, questionSets: s.questionSets.map((x) => (x.id === set.id ? { ...x, ...set } as QuestionSet : x)) };
    }
    const ns: QuestionSet = { scope: 'template', ...set, id: set.id || uid('qs'), name: set.name, items: set.items || [], active: true };
    return { ...s, questionSets: [...s.questionSets, ns] };
  });
}

/** 設定初次拜訪預設套用的共用模板(只會有一個) */
export function setDefaultFirstVisit(setId: string) {
  setState((s) => ({ ...s, questionSets: s.questionSets.map((x) => ({ ...x, defaultFirstVisit: x.id === setId })) }));
}

/** 主管審閱:寫下審閱意見;依設定排入串接佇列 */
export function reviewVisit(visitId: string, comment: string) {
  const at = nowIso();
  setState((s) => ({
    ...s,
    visits: s.visits.map((v) => (v.id === visitId ? { ...v, review: { ...v.review, by: s.sessionUserId || '', at, comment } } : v)),
  }));
  if (getState().settings.integration?.trigger === 'on_review') enqueueOutbox(visitId, 'visit.reviewed');
}

/**
 * 主管依這次拜訪設計下次訪談:新題目加入題庫(分類「客製追問」),
 * 建立客戶專屬題組,並可直接排入複訪行程。
 */
export function createFollowupPlan(opts: {
  visitId: string;
  name: string;
  note?: string;
  items: { questionId?: string; text?: string; required: boolean }[];
  schedule?: { date: string; time: string; salesId: string };
}): { setId: string; scheduleId?: string } {
  const s = getState();
  const v = s.visits.find((x) => x.id === opts.visitId);
  const at = nowIso();
  let n = s.questions.reduce((m, x) => Math.max(m, Number(x.code.replace(/\D/g, '')) || 0), 0);
  const newQs: Question[] = [];
  const items = opts.items.map((it) => {
    if (it.questionId) return { questionId: it.questionId, required: it.required };
    n += 1;
    const q: Question = { id: uid('q'), code: `Q${n}`, text: (it.text || '').trim(), category: '客製追問', active: true };
    newQs.push(q);
    return { questionId: q.id, required: it.required };
  });
  const setId = uid('qs');
  const set: QuestionSet = { id: setId, name: opts.name, items, active: true, scope: 'customer', customerId: v?.customerId, fromVisitId: opts.visitId, note: opts.note };
  const scheduleId = opts.schedule && v?.customerId ? uid('s') : undefined;
  setState((st) => ({
    ...st,
    questions: [...st.questions, ...newQs],
    questionSets: [...st.questionSets, set],
    schedules:
      scheduleId && opts.schedule && v?.customerId
        ? [...st.schedules, { id: scheduleId, ...opts.schedule, customerId: v.customerId, visitType: '複訪', questionSetId: setId, note: opts.note, createdBy: st.sessionUserId || '', createdAt: at }]
        : st.schedules,
    visits: st.visits.map((x) => (x.id === opts.visitId ? { ...x, review: { by: x.review?.by || st.sessionUserId || '', at: x.review?.at || at, comment: x.review?.comment || '', nextSetId: setId, nextScheduleId: scheduleId } } : x)),
  }));
  return { setId, scheduleId };
}

/** 串接佇列(預留):產生標準 JSON 報告;串接未啟用時狀態為「保留」 */
export function enqueueOutbox(visitId: string, event: OutboxItem['event']) {
  const s = getState();
  const v = s.visits.find((x) => x.id === visitId);
  if (!v) return;
  const cfg = s.settings.integration;
  const item: OutboxItem = {
    id: uid('ob'),
    visitId,
    target: cfg?.name || '未設定',
    event,
    status: 'held',
    payload: JSON.stringify(buildVisitReport(s, v), null, 2),
    createdAt: nowIso(),
  };
  setState((st) => ({ ...st, outbox: [item, ...(st.outbox || [])].slice(0, 200) }));
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
