import type { AppState, Visit } from '../types';
import { isAnswered, isHandled, salesUsers } from './selectors';

// 後台指標(POC 範圍文件第 4、8 節):回答覆蓋率與流程已處理率分開看;每位業務的拜訪數、確認率、平均確認時間

export function visitsInDays(s: AppState, days: number): Visit[] {
  const from = Date.now() - days * 86400000;
  return s.visits.filter((v) => v.status !== 'draft' && new Date(v.visitAt).getTime() >= from);
}

export function coverage(visits: Visit[]) {
  let total = 0;
  let answered = 0;
  let handled = 0;
  visits
    .filter((v) => v.status === 'confirmed')
    .forEach((v) =>
      v.ai?.answers
        .filter((a) => a.required)
        .forEach((a) => {
          total++;
          if (isAnswered(a)) answered++;
          if (isHandled(a)) handled++;
        }),
    );
  return { total, answered, handled };
}

export function perSales(s: AppState, visits: Visit[]) {
  return salesUsers(s).map((u) => {
    const mine = visits.filter((v) => v.salesId === u.id);
    const confirmed = mine.filter((v) => v.status === 'confirmed' && v.confirmedAt);
    const avgMs = confirmed.length ? confirmed.reduce((sum, v) => sum + (new Date(v.confirmedAt!).getTime() - new Date(v.createdAt).getTime()), 0) / confirmed.length : 0;
    const edits = confirmed.reduce((sum, v) => sum + v.editCount, 0);
    return { user: u, count: mine.length, confirmed: confirmed.length, avgMs, edits };
  });
}

export function perQuestion(s: AppState, visits: Visit[]) {
  const map = new Map<string, { asked: number; answered: number; handled: number }>();
  visits
    .filter((v) => v.status === 'confirmed')
    .forEach((v) =>
      v.ai?.answers.forEach((a) => {
        const m = map.get(a.questionId) || { asked: 0, answered: 0, handled: 0 };
        m.asked++;
        if (isAnswered(a)) m.answered++;
        if (isHandled(a)) m.handled++;
        map.set(a.questionId, m);
      }),
    );
  return s.questions.filter((q) => map.has(q.id)).map((q) => ({ q, ...map.get(q.id)! }));
}

export function prefStats(s: AppState, visits: Visit[]) {
  let suggested = 0;
  let accepted = 0;
  visits.forEach((v) =>
    v.ai?.prefs.forEach((p) => {
      suggested++;
      if (p.decision === 'accepted') accepted++;
    }),
  );
  const briefingViews = s.audit.filter((a) => a.type === 'briefing_view').length;
  return { suggested, accepted, briefingViews };
}
