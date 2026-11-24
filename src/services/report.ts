import type { AppState, Insight, InsightKind, Visit } from '../types';
import { customerById, industriesOf, purposeOf, questionById, setById, userById } from '../store/selectors';
import { fmtDate, fmtDateTime } from '../lib/util';

// 拜訪報告:把題庫比對結果與「題庫之外」談到的內容分類彙整。
// 同一份結構用在:畫面顯示、匯出文字/JSON、以及未來串接(Webhook / API)拋送的 payload。

export const REPORT_SCHEMA = 'himore.visit-report/v1';

export const INSIGHT_LABEL: Record<InsightKind | 'todo', string> = {
  todo: '額外待辦',
  reminder: '特別提醒',
  avoid: '需規避',
  opportunity: '商機線索',
  other: '其他資訊',
};

const STATUS: Record<string, string> = { answered: '已蒐集', partial: '部分蒐集', uncovered: '未蒐集', not_provided: '客戶未提供', na: '不適用' };

export interface VisitReport {
  schema: string;
  generatedAt: string;
  visit: { id: string; code: string; type: string; at: string; source: string; status: string; confirmedAt?: string };
  customer: {
    id?: string;
    code?: string;
    name?: string;
    taxId?: string;
    address?: string;
    website?: string;
    category?: string;
    owner?: string;
    industries: string[];
    contacts: { name: string; title?: string; department?: string; phone?: string; email?: string; decisionRole?: string; preference?: string }[];
  };
  /** 拜訪互動:拜訪日期/拜訪人員/目的/需求/追蹤事項 */
  interaction: { date: string; staff?: string; purpose?: string; needs?: string; followUps: string[] };
  sales: { id: string; name?: string };
  questionSet?: { id: string; name: string; scope: string };
  coverage: { total: number; collected: number; missing: number; missingRequired: number };
  questions: { code?: string; text?: string; required: boolean; status: string; statusLabel: string; answer: string; reason?: string }[];
  summary: Record<string, string>;
  outOfScope: { todos: { content: string; due?: string; owner?: string }[]; reminders: string[]; avoid: string[]; opportunities: string[]; others: string[] };
  attachments: { name: string; kind: string }[];
  supplements: { kind: string; text: string }[];
  review?: { by?: string; at: string; comment: string; nextQuestionSet?: string };
}

/** 題外內容:新版 AI 結果有 insights;舊資料以偏好/避免事項補上 */
export function insightsOf(v: Visit): Insight[] {
  const a = v.ai;
  if (!a) return [];
  if (a.insights) return a.insights;
  return a.prefs.map((p) => ({ id: p.id, kind: p.type === 'avoid' ? 'avoid' : 'reminder', text: p.content }));
}

export function buildVisitReport(s: AppState, v: Visit): VisitReport {
  const c = customerById(s, v.customerId);
  const set = setById(s, v.questionSetId);
  const a = v.ai;
  const answers = a?.answers || [];
  const collected = answers.filter((x) => x.status === 'answered' || x.status === 'partial').length;
  const missing = answers.filter((x) => x.status === 'uncovered');
  const ins = insightsOf(v);
  const pick = (k: InsightKind) => ins.filter((i) => i.kind === k).map((i) => i.text);
  const avoid = Array.from(new Set([...pick('avoid'), ...(a?.prefs || []).filter((p) => p.type === 'avoid' && p.decision !== 'skipped').map((p) => p.content)]));
  const todos = v.status === 'confirmed' ? s.todos.filter((t) => t.visitId === v.id) : (a?.todos || []).filter((t) => t.keep);
  return {
    schema: REPORT_SCHEMA,
    generatedAt: new Date().toISOString(),
    visit: { id: v.id, code: v.code, type: v.visitType, at: v.visitAt, source: v.source, status: v.status, confirmedAt: v.confirmedAt },
    customer: {
      id: c?.id,
      code: c?.code,
      name: c?.name,
      taxId: c?.taxId,
      address: c?.address,
      website: c?.website,
      category: c?.category,
      owner: userById(s, c?.ownerId)?.name,
      industries: industriesOf(c),
      contacts: (c?.contacts || []).map(({ id: _id, ...rest }) => rest),
    },
    interaction: {
      date: v.visitAt,
      staff: userById(s, v.salesId)?.name,
      purpose: purposeOf(v, s),
      needs: a && a.summary.needs.text !== '未知' ? a.summary.needs.text : undefined,
      followUps: [
        ...todos.map((t) => `${t.content}${t.due ? `(${fmtDate(t.due)})` : ''}`),
        ...(a && a.summary.nextSteps.text !== '未知' && !todos.length ? [a.summary.nextSteps.text] : []),
      ],
    },
    sales: { id: v.salesId, name: userById(s, v.salesId)?.name },
    questionSet: set ? { id: set.id, name: set.name, scope: set.scope || 'template' } : undefined,
    coverage: { total: answers.length, collected, missing: missing.length, missingRequired: missing.filter((x) => x.required).length },
    questions: answers.map((x) => {
      const q = questionById(s, x.questionId);
      return { code: q?.code, text: q?.text, required: x.required, status: x.status, statusLabel: STATUS[x.status] || x.status, answer: x.answer, reason: x.reason };
    }),
    summary: a ? { 摘要: a.summary.keyPoints.text, 需求: a.summary.needs.text, 競品: a.summary.competitors.text, 異議: a.summary.objections.text, 下一步: a.summary.nextSteps.text } : {},
    outOfScope: {
      todos: todos.map((t) => ({ content: t.content, due: t.due, owner: userById(s, t.ownerId)?.name })),
      reminders: pick('reminder'),
      avoid,
      opportunities: pick('opportunity'),
      others: pick('other'),
    },
    attachments: (v.raw.attachments || []).map((x) => ({ name: x.name, kind: x.kind })),
    supplements: (v.raw.supplements || []).map((x) => ({ kind: x.kind, text: x.text || '(口述錄音)' })),
    review: v.review ? { by: userById(s, v.review.by)?.name, at: v.review.at, comment: v.review.comment, nextQuestionSet: setById(s, v.review.nextSetId)?.name } : undefined,
  };
}

export function reportToText(r: VisitReport): string {
  const L: string[] = [];
  const kv = (k: string, val?: string) => L.push(`  ${k}:${val || '—'}`);
  L.push(`【拜訪報告】${r.customer.name || '未指定客戶'}(${r.customer.code || '—'})`);
  L.push(`${r.visit.code}|${r.visit.type}${r.questionSet ? `|題組:${r.questionSet.name}` : ''}`);
  L.push('');
  L.push('1-1 公司基本資料');
  kv('公司名稱', r.customer.name);
  kv('統編', r.customer.taxId);
  kv('地址', r.customer.address);
  kv('網站', r.customer.website);
  kv('客戶分類', r.customer.category);
  kv('負責業務', r.customer.owner);
  L.push('');
  L.push('1-2 聯絡人資料');
  if (!r.customer.contacts.length) L.push('  (無)');
  r.customer.contacts.forEach((c) =>
    L.push(`  ・${c.name}|${[c.title, c.department].filter(Boolean).join('/') || '—'}|${c.phone || '—'}|${c.email || '—'}|決策角色:${c.decisionRole || '—'}${c.preference ? `|偏好:${c.preference}` : ''}`),
  );
  L.push('');
  L.push(`1-3 產業別:${r.customer.industries.join('、') || '—'}`);
  L.push('');
  L.push('拜訪互動');
  kv('拜訪日期', fmtDateTime(r.interaction.date));
  kv('拜訪人員', r.interaction.staff);
  kv('目的', r.interaction.purpose);
  kv('需求', r.interaction.needs);
  L.push(`  追蹤事項:${r.interaction.followUps.length ? '' : '—'}`);
  r.interaction.followUps.forEach((x) => L.push(`    ・${x}`));
  L.push('');
  L.push(`問題蒐集狀況:已蒐集 ${r.coverage.collected} / ${r.coverage.total},未蒐集 ${r.coverage.missing}(必答 ${r.coverage.missingRequired})`);
  r.questions.forEach((q) => L.push(`  ${q.status === 'uncovered' ? '✗' : '✓'} ${q.code} ${q.text}${q.required ? '[必答]' : ''}:${q.answer || q.statusLabel}${q.reason ? `(${q.reason})` : ''}`));
  L.push('');
  L.push('重點摘要');
  Object.entries(r.summary).forEach(([k, val]) => L.push(`  ${k}:${val}`));
  L.push('');
  L.push('題庫之外的內容');
  const sec = (title: string, items: string[]) => {
    L.push(`  ◆ ${title}`);
    if (!items.length) L.push('    (無)');
    items.forEach((x) => L.push(`    ・${x}`));
  };
  sec(INSIGHT_LABEL.todo, r.outOfScope.todos.map((t) => `${t.content}${t.due ? `(${fmtDate(t.due)})` : ''}${t.owner ? `/${t.owner}` : ''}`));
  sec(INSIGHT_LABEL.reminder, r.outOfScope.reminders);
  sec(INSIGHT_LABEL.avoid, r.outOfScope.avoid);
  sec(INSIGHT_LABEL.opportunity, r.outOfScope.opportunities);
  sec(INSIGHT_LABEL.other, r.outOfScope.others);
  if (r.attachments.length || r.supplements.length) {
    L.push('');
    L.push('附件與補充');
    r.supplements.forEach((x) => L.push(`  ・${x.kind === 'text' ? '補充文字' : '補充口述'}:${x.text}`));
    r.attachments.forEach((x) => L.push(`  ・${x.kind === 'photo' ? '照片' : '檔案'}:${x.name}`));
  }
  if (r.review) {
    L.push('');
    L.push(`主管審閱(${r.review.by || '—'} ${fmtDateTime(r.review.at)})`);
    L.push(`  ${r.review.comment || '(無意見)'}`);
    if (r.review.nextQuestionSet) L.push(`  下次訪談題組:${r.review.nextQuestionSet}`);
  }
  return L.join('\n');
}

/** 依這次結果建議下次訪談題目:未蒐集的題目沿用;需求、異議、待辦、提醒轉成追問 */
export function suggestFollowups(s: AppState, v: Visit): { questionId?: string; text: string; required: boolean; why: string }[] {
  const a = v.ai;
  if (!a) return [];
  const out: { questionId?: string; text: string; required: boolean; why: string }[] = [];
  a.answers
    .filter((x) => x.status === 'uncovered' || x.status === 'partial')
    .forEach((x) => {
      const q = questionById(s, x.questionId);
      if (q) out.push({ questionId: q.id, text: q.text, required: x.required, why: x.status === 'uncovered' ? '上次未蒐集' : '上次只部分回覆' });
    });
  const clip = (t: string) => t.replace(/[。.]$/, '').slice(0, 24);
  if (a.summary.objections.text !== '未知') out.push({ text: `上次提到「${clip(a.summary.objections.text)}」,目前是否有解決方向?`, required: true, why: '異議追蹤' });
  if (a.summary.competitors.text !== '未知') out.push({ text: `與競品比較後,目前評估的重點與進度?`, required: false, why: '競品追蹤' });
  if (a.summary.needs.text !== '未知') out.push({ text: `針對「${clip(a.summary.needs.text)}」,希望的改善目標與時程?`, required: true, why: '需求深化' });
  a.todos.filter((t) => t.keep).slice(0, 2).forEach((t) => out.push({ text: `上次承諾:${clip(t.content)},客戶回饋如何?`, required: false, why: '待辦回覆' }));
  insightsOf(v)
    .filter((i) => i.kind === 'reminder')
    .slice(0, 1)
    .forEach((i) => out.push({ text: `確認:${clip(i.text)}`, required: false, why: '特別提醒' }));
  out.push({ text: '預算核准與決策時程是否有更新?', required: true, why: '複訪必問' });
  return out;
}
