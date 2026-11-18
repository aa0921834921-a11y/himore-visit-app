import type {
  AnalysisResult,
  AnswerItem,
  Customer,
  Fact,
  FactKind,
  PrefSuggestion,
  Question,
  Segment,
  SummaryField,
  SummaryKey,
  TodoSuggestion,
  Uncertainty,
} from '../../types';
import { addDays, sleep, truncate, uid, ymd } from '../../lib/util';
import type { AiService, AnalyzeInput, TranscribeInput } from './types';

// 模擬 AI:以規則比對產生「看起來像 AI」的整理結果,讓流程可以完整試用。
// 不是真的語音辨識:錄音的逐字稿是固定的示範內容;文字輸入與口述打字則會依實際內容整理。

interface Topic {
  match: RegExp;
  keys: RegExp;
  canned: string;
}

const TOPICS: Topic[] = [
  { match: /目的/, keys: /目的|這次|本次|主要是|主要想|來訪/, canned: '這次主要是了解客戶的設備現況與導入需求。' },
  { match: /噸/, keys: /\d+\s*噸|射出機/, canned: '目前使用 350 噸射出機,共 6 台。' },
  { match: /系列|取出機/, keys: /\b(GT|AT|ST)\b|系列|取出機/i, canned: '客戶在評估 GT 系列取出機。' },
  { match: /台數|幾台|導入的台/, keys: /\d+\s*台(?!灣|中|南|北)/, canned: '預計導入 8 台。' },
  { match: /時程|何時|交期/, keys: /\d+\s*月|下半年|上半年|年底|月底|第.季|交期|時程|\d+\/\d+/, canned: '希望 12 月前完成導入。' },
  { match: /改善|問題|痛點/, keys: /改善|縮短|減少|提升|困擾|痛點|太長|太慢/, canned: '客戶希望縮短取出時間。' },
  { match: /廠牌|比較|競|方案/, keys: /比較|其他廠牌|競品|對手|日系|德系|國產|比價/, canned: '客戶也在比較其他廠牌的方案。' },
  { match: /預算|價格|費用/, keys: /預算|\d+\s*萬|價格|費用|成本|簽核/, canned: '預算尚在內部討論。' },
  { match: /決策|窗口|採購/, keys: /決策|窗口|採購|經理|廠長|老闆|協理|主管/, canned: '由採購經理與廠長共同決定。' },
  { match: /補充|其他/, keys: /補充|另外/, canned: '' },
];

const STOP = new Set(['目前', '客戶', '是否', '本次', '使用', '主要', '哪些', '為何', '多少']);

function topicOf(q: Question): Topic | undefined {
  return TOPICS.find((t) => t.match.test(q.text));
}

function fallbackKeys(q: Question): RegExp | undefined {
  const words = q.text
    .replace(/[??(()),、/／]/g, ' ')
    .split(/\s+/)
    .flatMap((w) => (w.length >= 2 ? [w.slice(0, 2), w.slice(-2)] : []))
    .filter((w) => !STOP.has(w));
  if (!words.length) return undefined;
  return new RegExp(Array.from(new Set(words)).join('|'));
}

interface Sentence {
  text: string;
  segId: string;
  questionId?: string;
}

function splitSentences(segments: Segment[]): Sentence[] {
  const out: Sentence[] = [];
  segments.forEach((sg) => {
    sg.text
      .replace(/([。!?!?;;\n])/g, '$1\u0001')
      .split('\u0001')
      .map((t) => t.trim())
      .filter((t) => t.length > 1)
      .forEach((t) => out.push({ text: t.replace(/[。;;]$/, ''), segId: sg.id, questionId: sg.questionId }));
  });
  return out;
}

const RE = {
  digits: /\d/,
  series: /\b(GT|AT|ST)\s*系列/,
  bareSeries: /\b(GT|AT|ST)\b(?!\s*系列)/,
  keyPoint: /評估|導入|預計|計畫|擴充|擴線|需求|報價/,
  needs: /需求|想要|改善|縮短|減少|提升|要求|困擾|希望(能|可以|縮短|改善|提升|減少)/,
  competitors: /競品|其他廠牌|對手|日系|德系|國產|比較.{0,6}(方案|廠牌|報價)/,
  objections: /擔心|顧慮|疑慮|太貴|不放心|風險|整合|困難/,
  nextSteps: /下週|本週|明天|報價|提供|確認|回覆|安排|寄|試機|再約|追蹤/,
  hedge: /大概|大約|可能|好像|應該|也許|不確定|左右/,
  avoid: /不喜歡|不太喜歡|不想|避免|不要|討厭|忌諱|反感|別再|不希望/,
  prefer: /重視|喜歡|偏好|在意|比較希望|習慣/,
  restricted: /個人|家庭|健康|身體|私下|宗教|政治|小孩/,
  todo: /提供|準備|寄送|寄|確認|回覆|安排|聯絡|追蹤|報價|試機|送樣/,
};

function pickSentences(sents: Sentence[], re: RegExp, max = 2, exclude?: RegExp): SummaryField {
  const hits = sents.filter((s) => re.test(s.text) && !(exclude && exclude.test(s.text))).slice(0, max);
  if (!hits.length) return { text: '未知', sourceSegmentIds: [] };
  return { text: hits.map((h) => h.text).join(';') + '。', sourceSegmentIds: Array.from(new Set(hits.map((h) => h.segId))) };
}

function keyPoints(sents: Sentence[]): SummaryField {
  if (!sents.length) return { text: '未知', sourceSegmentIds: [] };
  const scored = sents.map((s, i) => ({
    s,
    i,
    score: (RE.digits.test(s.text) ? 2 : 0) + (RE.series.test(s.text) ? 2 : 0) + (RE.keyPoint.test(s.text) ? 1 : 0),
  }));
  const top = scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.s);
  const chosen = top.length ? top : [sents[0]];
  return { text: chosen.map((c) => c.text).join(';') + '。', sourceSegmentIds: Array.from(new Set(chosen.map((c) => c.segId))) };
}

function extractFacts(sents: Sentence[]): Fact[] {
  const facts: Fact[] = [];
  const seen = new Set<string>();
  const add = (kind: FactKind, text: string, segId: string) => {
    const k = `${kind}:${text}`;
    if (seen.has(k)) return;
    seen.add(k);
    facts.push({ id: uid('f'), kind, text, sourceSegmentId: segId, viewed: false });
  };
  sents.forEach((s) => {
    for (const m of s.text.matchAll(/(GT|AT|ST)\s*系列/g)) add('model', `${m[1]} 系列`, s.segId);
    for (const m of s.text.matchAll(/(\d{2,4})\s*噸/g)) add('tonnage', `${m[1]} 噸`, s.segId);
    for (const m of s.text.matchAll(/(\d{1,3})\s*台(?!灣|中|南|北)/g)) add('quantity', `${m[1]} 台`, s.segId);
    for (const m of s.text.matchAll(/(\d+(?:\.\d+)?)\s*(萬|億|千元|元)/g)) add('amount', `${m[1]} ${m[2]}`, s.segId);
    for (const m of s.text.matchAll(/(\d{1,2})\s*月\s*(底|前|初|中)?/g)) add('date', `${m[1]} 月${m[2] || ''}`.trim(), s.segId);
    for (const m of s.text.matchAll(/(\d{1,2}\/\d{1,2})/g)) add('date', m[1], s.segId);
    for (const m of s.text.matchAll(/(下週[一二三四五六日天]?前?|年底前?|月底前?|下半年|上半年)/g)) add('date', m[1], s.segId);
    if (/承諾|保證|答應/.test(s.text)) add('commitment', truncate(s.text, 16), s.segId);
  });
  return facts.slice(0, 8);
}

function extractUncertainties(sents: Sentence[], segments: Segment[]): Uncertainty[] {
  const out: Uncertainty[] = [];
  sents.forEach((s) => {
    const m = s.text.match(RE.bareSeries);
    if (m && !out.some((u) => u.text.includes(`「${m[1]}」`))) {
      out.push({ id: uid('u'), text: `「${m[1]}」是否指 ${m[1]} 系列?請點開原文確認`, sourceSegmentId: s.segId, resolved: false });
    }
  });
  sents.forEach((s) => {
    if (RE.hedge.test(s.text)) out.push({ id: uid('u'), text: `「${truncate(s.text, 18)}」為推測或約略內容,請確認`, sourceSegmentId: s.segId, resolved: false });
  });
  const unknownSpeaker = segments.find((sg) => sg.speaker === '語者未確認');
  if (unknownSpeaker) out.push({ id: uid('u'), text: '部分逐字稿的說話者未確認,請點開原文確認', sourceSegmentId: unknownSpeaker.id, resolved: false });
  return out.slice(0, 3);
}

function shortName(c?: Customer) {
  return c ? c.name.replace(/(股份)?有限公司$/, '') : '客戶';
}

function extractPrefs(sents: Sentence[], segments: Segment[], customer?: Customer): PrefSuggestion[] {
  const out: PrefSuggestion[] = [];
  const label = (segId: string) => {
    const src = segments.find((s) => s.id === segId)?.source;
    return src === 'recording' ? '現場錄音' : src === 'text' ? '文字輸入' : '業務口述';
  };
  sents.forEach((s) => {
    const contact = customer?.contacts.find((c) => s.text.includes(c.name));
    const target = contact ? 'contact' : 'customer';
    const targetName = contact ? contact.name : shortName(customer);
    const sensitivity = RE.restricted.test(s.text) ? 'restricted' : 'normal';
    const am = s.text.match(RE.avoid);
    if (am && am.index !== undefined) {
      const rest = s.text.slice(am.index + am[0].length).replace(/^(再|被|一直)/, '').split(/[,,。]/)[0];
      out.push({ id: uid('p'), type: 'avoid', content: truncate(`避免${rest || s.text}`, 30), target, targetName, sensitivity, sourceText: s.text, sourceLabel: label(s.segId), decision: 'pending' });
      return;
    }
    const pm = s.text.match(RE.prefer);
    if (pm && pm.index !== undefined) {
      const rest = s.text.slice(pm.index).split(/[,,。]/)[0];
      out.push({ id: uid('p'), type: 'preference', content: truncate(rest, 30), target, targetName, sensitivity, sourceText: s.text, sourceLabel: label(s.segId), decision: 'pending' });
    }
  });
  return out.slice(0, 4);
}

const WD: Record<string, number> = { 日: 0, 天: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6 };

function dueFrom(text: string, base: Date): string | undefined {
  let m = text.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*[日號]/);
  if (m) return normYear(base, Number(m[1]), Number(m[2]));
  m = text.match(/(\d{1,2})\/(\d{1,2})/);
  if (m) return normYear(base, Number(m[1]), Number(m[2]));
  m = text.match(/下週([一二三四五六日天])/);
  if (m) {
    const target = WD[m[1]];
    const d = new Date(base);
    const toNextMon = ((8 - d.getDay()) % 7) || 7;
    const mon = addDays(d, toNextMon);
    return ymd(addDays(mon, (target + 6) % 7));
  }
  m = text.match(/(本週|這週)([一二三四五六日天])/);
  if (m) {
    const d = new Date(base);
    const diff = (WD[m[2]] - d.getDay() + 7) % 7;
    return ymd(addDays(d, diff));
  }
  if (/明天/.test(text)) return ymd(addDays(base, 1));
  if (/後天/.test(text)) return ymd(addDays(base, 2));
  if (/月底/.test(text)) return ymd(new Date(base.getFullYear(), base.getMonth() + 1, 0));
  return undefined;
}

function normYear(base: Date, m: number, d: number): string {
  let y = base.getFullYear();
  const cand = new Date(y, m - 1, d);
  if (cand.getTime() < addDays(base, -30).getTime()) y += 1;
  return ymd(new Date(y, m - 1, d));
}

function extractTodos(sents: Sentence[], salesId: string, visitAt: string): TodoSuggestion[] {
  const base = new Date(visitAt);
  const out: TodoSuggestion[] = [];
  sents.forEach((s) => {
    if (!RE.todo.test(s.text) || RE.avoid.test(s.text)) return;
    if (/^(這次|本次|今天|今日)|主要是|主要想/.test(s.text)) return; // 拜訪目的,不是待辦
    if (!/會|將|下週|本週|明天|後天|前|再|我/.test(s.text)) return;
    const clauses = s.text.split(/[,,、]|並且|並/).filter((c) => RE.todo.test(c));
    const due = dueFrom(s.text, base);
    clauses.forEach((c) => {
      const content = c
        .replace(/^(好的|我們|我|會|將|再|要)+/, '')
        .replace(/(下週[一二三四五六日天]?|本週[一二三四五六日天]?|明天|後天|月底|\d{1,2}\/\d{1,2}|\d{1,2}\s*月\s*\d{1,2}\s*[日號])前?/g, '')
        .replace(/^(會|將|再|要)/, '')
        .trim();
      if (content.length >= 4) out.push({ id: uid('t'), content: truncate(content, 30), ownerId: salesId, due, keep: true });
    });
  });
  return out.slice(0, 4);
}

function answerQuestions(input: AnalyzeInput, sents: Sentence[]): AnswerItem[] {
  const set = input.questionSet;
  if (!set) return [];
  return set.items.map((item) => {
    const q = input.questions.find((x) => x.id === item.questionId);
    const base: AnswerItem = { questionId: item.questionId, required: item.required, status: 'uncovered', answer: '', sourceSegmentIds: [] };
    if (!q) return base;
    // 逐題口述:直接對應
    const direct = input.segments.filter((sg) => sg.questionId === q.id);
    if (direct.length) {
      const txt = direct.map((d) => d.text).join(' ').trim();
      if (txt) return { ...base, status: txt.length >= 4 ? 'answered' : 'partial', answer: truncate(txt, 80), sourceSegmentIds: direct.map((d) => d.id) };
    }
    const topic = topicOf(q);
    const keys = topic?.keys || fallbackKeys(q);
    if (!keys) return base;
    const hits = sents.filter((s) => !s.questionId && keys.test(s.text));
    if (!hits.length) return base;
    const best = hits.find((h) => RE.digits.test(h.text)) || hits[0];
    return {
      ...base,
      status: best.text.length >= 6 ? 'answered' : 'partial',
      answer: truncate(best.text, 80),
      sourceSegmentIds: [best.segId],
    };
  });
}

function suggestCustomer(sents: Sentence[], customers: Customer[]): string | undefined {
  const all = sents.map((s) => s.text).join(' ');
  const hit = customers.find((c) => {
    const short = c.name.replace(/(股份)?有限公司$/, '').replace(/(塑膠|工業|精密|科技|模具)+$/, '');
    return short.length >= 2 && all.includes(short);
  });
  return hit?.id;
}

const CANNED_RECORDING: { speaker: string; text: string }[] = [
  { speaker: '業務', text: '今天主要想了解貴公司目前的設備狀況和擴線計畫。' },
  { speaker: '客戶', text: '我們現在用的是 350 噸的射出機,總共 6 台。' },
  { speaker: '客戶', text: '有在評估 GT 系列,預計導入 8 台,希望 12 月前完成。' },
  { speaker: '業務', text: '目前在生產上最想改善的是哪個部分?' },
  { speaker: '客戶', text: '取出時間太長,希望可以縮短,另外擔心跟既有機台的整合。' },
  { speaker: '語者未確認', text: '預算的部分還要再跟老闆討論。' },
  { speaker: '客戶', text: '我們不太喜歡一直被比價,比較重視穩定品質跟售後。' },
  { speaker: '業務', text: '好的,我下週二前提供 GT 系列的報價,並確認 8 台的交期。' },
];

export const mockAi: AiService = {
  name: '模擬 AI(示範用)',
  isMock: true,

  async transcribe(input: TranscribeInput): Promise<Segment[]> {
    await sleep(200);
    const segs: Segment[] = [];
    if (input.source === 'recording') {
      const dur = Math.max(30, (input.audioDurationMs || 60000) / 1000);
      const step = dur / CANNED_RECORDING.length;
      CANNED_RECORDING.forEach((c, i) =>
        segs.push({ id: uid('sg'), source: 'recording', speaker: c.speaker, text: c.text, start: Math.round(i * step), end: Math.round((i + 1) * step) }),
      );
    }
    if (input.source === 'dictation') {
      (input.dictation || []).forEach((d) => {
        if (d.status) return; // 客戶未提供/不適用不產生逐字稿
        const q = input.questions.find((x) => x.id === d.questionId);
        let text = d.text.trim();
        if (!text && d.audioUri) text = (q && topicOf(q)?.canned) || '(模擬轉寫)業務口述內容。';
        if (text) segs.push({ id: uid('sg'), source: 'dictation', text, questionId: d.questionId });
      });
    }
    const free = (input.text || '').trim();
    if (free) {
      free
        .split(/\n+/)
        .map((t) => t.trim())
        .filter(Boolean)
        .forEach((t) => segs.push({ id: uid('sg'), source: input.source === 'text' ? 'text' : 'dictation', text: t }));
    } else if (input.source === 'dictation' && input.audioUri && !segs.length) {
      CANNED_RECORDING.filter((c) => c.speaker !== '業務').forEach((c) =>
        segs.push({ id: uid('sg'), source: 'dictation', text: c.text.replace(/^我們/, '客戶') }),
      );
    }
    return segs;
  },

  async analyze(input: AnalyzeInput): Promise<AnalysisResult> {
    await sleep(200);
    const sents = splitSentences(input.segments);
    const customer = input.customer || input.customers.find((c) => c.id === suggestCustomer(sents, input.customers));
    const summary: Record<SummaryKey, SummaryField> = {
      keyPoints: keyPoints(sents),
      needs: pickSentences(sents, RE.needs),
      competitors: pickSentences(sents, RE.competitors, 2, RE.avoid),
      objections: pickSentences(sents, RE.objections),
      nextSteps: pickSentences(sents, RE.nextSteps),
    };
    return {
      mock: true,
      suggestedCustomerId: input.customer ? undefined : customer?.id,
      answers: answerQuestions(input, sents),
      summary,
      facts: extractFacts(sents),
      uncertainties: extractUncertainties(sents, input.segments),
      prefs: extractPrefs(sents, input.segments, customer),
      todos: extractTodos(sents, input.salesId, input.visitAt),
      generatedAt: new Date().toISOString(),
    };
  },
};

export const DEMO_TEXT =
  '這次拜訪主要是確認導入規格與交期。\n客戶目前使用 350 噸射出機,共 6 台,正在評估 GT 系列取出機,預計導入 8 台,希望 12 月前完成。\n客戶希望縮短取出時間,但擔心與既有機台的整合。\n也有在比較日系廠牌的方案,預算大概 300 萬左右,還要老闆簽核。\n張經理表示不想再被比價,重視穩定品質與售後支援。\n我下週二前提供 GT 系列報價,並確認 8 台交期。';
