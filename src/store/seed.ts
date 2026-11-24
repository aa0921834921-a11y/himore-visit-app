import type {
  AppState,
  Customer,
  Preference,
  Question,
  QuestionSet,
  Schedule,
  Settings,
  Todo,
  User,
  Visit,
} from '../types';
import { addDays, ymd } from '../lib/util';

// 示範資料:依「介面文案表」的統一範例(王大明、宏昇/聯貿/明耀),日期改為相對今天,畫面上的「今日拜訪」才會是今天。
// 所有公司、人名與數字均為虛構,正式導入時由管理者在後台匯入真實資料。

export const DEFAULT_CONSENT_TEXT =
  '為確保拜訪紀錄完整,本次拜訪將進行錄音,內容僅供公司內部整理與記錄使用。請先向客戶說明並取得同意。';

export const DEFAULT_SETTINGS: Settings = {
  retentionDays: 90,
  consentVersion: 'v1',
  consentText: DEFAULT_CONSENT_TEXT,
  glossary: ['GT 系列', 'AT 系列', 'ST 系列', '取出機', '射出機', '噸數', '模具'],
  aiTermsConfirmed: false,
  trialAccountCap: 12,
  demoMode: true,
  simulateFailureNext: false,
  notifyEnabled: true,
  uploadOnWifiOnly: false,
  industryOptions: ['塑膠射出成型', '精密射出', '汽車零件', '家電零件', '3C 電子', '醫療器材', '包裝容器', '模具製造', '其他'],
  customerCategories: ['潛在客戶', '新客戶', '既有客戶', '重點客戶', '經銷商'],
  integration: { enabled: false, kind: 'webhook', name: 'ERP / CRM(待決定)', url: '', authHeader: '', trigger: 'on_review' },
};

function iso(d: Date, hh: number, mm: number): string {
  const x = new Date(d);
  x.setHours(hh, mm, 0, 0);
  return x.toISOString();
}

function visitCode(d: Date, seq: number): string {
  const y = String(d.getFullYear()).slice(2);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `V${y}${m}${day}-${String(seq).padStart(3, '0')}`;
}

export function buildSeed(): AppState {
  const now = new Date();
  const today = ymd(now);
  const created = addDays(now, -60).toISOString();

  const users: User[] = [
    { id: 'u_wang', account: 'wang', password: '1234', name: '王大明', team: '業務一組', role: 'sales', active: true, createdAt: created },
    { id: 'u_lin', account: 'lin', password: '1234', name: '林志偉', team: '業務二組', role: 'sales', active: true, createdAt: created },
    { id: 'u_chen', account: 'admin', password: '1234', name: '陳美玲', team: '業務管理', role: 'admin', active: true, createdAt: created },
  ];

  const customers: Customer[] = [
    {
      id: 'c_hs', code: 'C100328', name: '宏昇塑膠有限公司', industries: ['塑膠射出成型', '家電零件'], category: '重點客戶', taxId: '24561238', address: '台中市西屯區工業區三十六路 12 號', website: 'https://www.hs-plastic.example', mainEquipment: '350 噸射出機', evaluatingSeries: 'GT 系列',
      ownerId: 'u_wang', contacts: [{ id: 'ct_1', name: '張經理', title: '採購經理', department: '採購部', phone: '04-2350-1234', email: 'chang@hs-plastic.example', decisionRole: '採購窗口', preference: '偏好 Email 聯繫,上午較好約' }, { id: 'ct_2', name: '李廠長', title: '廠長', department: '製造部', decisionRole: '決策者' }], createdAt: created,
    },
    {
      id: 'c_lm', code: 'C100456', name: '聯貿工業有限公司', industries: ['塑膠射出成型'], category: '潛在客戶', address: '桃園市楊梅區民族路五段 88 號', mainProducts: '待了解',
      ownerId: 'u_wang', contacts: [{ id: 'ct_3', name: '黃課長', title: '生管課長', department: '生管課', decisionRole: '影響者' }], createdAt: created,
    },
    {
      id: 'c_my', code: 'C100789', name: '明耀精密有限公司', industries: ['精密射出', '3C 電子'], category: '既有客戶', taxId: '53880126', mainEquipment: '180 噸射出機', evaluatingSeries: 'AT 系列',
      ownerId: 'u_wang', contacts: [{ id: 'ct_4', name: '吳協理', title: '製造協理', department: '製造處', decisionRole: '決策者' }], createdAt: created,
    },
    {
      id: 'c_ds', code: 'C100512', name: '鼎盛塑膠工業有限公司', industries: ['家電零件'], category: '新客戶', mainEquipment: '450 噸射出機',
      ownerId: 'u_lin', contacts: [{ id: 'ct_5', name: '周經理', title: '工程經理', department: '工程部', decisionRole: '技術評估' }], createdAt: created,
    },
    {
      id: 'c_yq', code: 'C100603', name: '永群精密模具有限公司', industries: ['模具製造', '塑膠射出成型'], category: '潛在客戶', evaluatingSeries: 'ST 系列',
      ownerId: 'u_wang', contacts: [], createdAt: created,
    },
    {
      id: 'c_tz', code: 'C100671', name: '台展科技股份有限公司', industries: ['汽車零件'], category: '既有客戶', mainEquipment: '650 噸射出機',
      ownerId: 'u_lin', contacts: [{ id: 'ct_6', name: '蔡副理', title: '設備副理', department: '設備課', decisionRole: '技術評估' }], createdAt: created,
    },
  ];

  const qs: [string, string, string][] = [
    ['Q1', '本次拜訪的主要目的為何?', '基本資訊'],
    ['Q2', '目前使用的射出機噸數與台數?', '設備現況'],
    ['Q3', '評估導入的取出機系列(GT／AT／ST)?', '產品需求'],
    ['Q4', '預計導入的台數?', '產品需求'],
    ['Q5', '預計導入的時程?', '時程與預算'],
    ['Q6', '客戶目前最想改善的問題?', '需求與痛點'],
    ['Q7', '正在比較的其他廠牌或方案?', '競爭狀況'],
    ['Q8', '預算範圍?', '時程與預算'],
    ['Q9', '其他補充事項', '其他'],
    ['Q10', '決策流程與主要窗口?', '基本資訊'],
    ['Q11', '現有設備的保養維修方式?', '設備現況'],
    ['Q12', '工廠自動化程度與人力配置?', '設備現況'],
  ];
  const questions: Question[] = qs.map(([code, text, category]) => ({ id: `q_${code.toLowerCase()}`, code, text, category, active: true }));
  const q = (code: string) => `q_${code.toLowerCase()}`;

  const questionSets: QuestionSet[] = [
    {
      id: 'qs_track', name: '射出成型設備追蹤', active: true, scope: 'template',
      items: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8'].map((c) => ({ questionId: q(c), required: true }))
        .concat(['Q9', 'Q10'].map((c) => ({ questionId: q(c), required: false }))),
    },
    {
      id: 'qs_new', name: '初訪標準模板(新客戶需求探索)', active: true, scope: 'template', defaultFirstVisit: true,
      note: '第一次拜訪:先了解設備現況、產能痛點與決策流程,不急著報價。',
      items: ['Q1', 'Q2', 'Q3', 'Q11'].map((c) => ({ questionId: q(c), required: true }))
        .concat(['Q6', 'Q10', 'Q12', 'Q9'].map((c) => ({ questionId: q(c), required: false }))),
    },
    {
      id: 'qs_expand', name: '設備擴充需求', active: true, scope: 'template',
      items: ['Q1', 'Q2', 'Q4', 'Q5', 'Q8'].map((c) => ({ questionId: q(c), required: true }))
        .concat(['Q9'].map((c) => ({ questionId: q(c), required: false }))),
    },
  ];

  const schedules: Schedule[] = [
    { id: 's_1', date: today, time: '09:30', salesId: 'u_wang', customerId: 'c_hs', visitType: '複訪', questionSetId: 'qs_track', purpose: '回覆 GT 系列報價並確認交期', note: '確認 8 台交期', createdBy: 'u_chen', createdAt: created },
    { id: 's_2', date: today, time: '11:00', salesId: 'u_wang', customerId: 'c_lm', visitType: '初次', questionSetId: 'qs_new', purpose: '初次拜訪,了解現有設備與擴線計畫', note: '了解現有設備', createdBy: 'u_chen', createdAt: created },
    { id: 's_3', date: today, time: '14:30', salesId: 'u_wang', customerId: 'c_my', visitType: '複訪', questionSetId: 'qs_expand', createdBy: 'u_chen', createdAt: created },
    { id: 's_4', date: today, time: '10:00', salesId: 'u_lin', customerId: 'c_ds', visitType: '初次', questionSetId: 'qs_new', createdBy: 'u_chen', createdAt: created },
    { id: 's_5', date: ymd(addDays(now, 1)), time: '15:00', salesId: 'u_wang', customerId: 'c_yq', visitType: '初次', questionSetId: 'qs_new', createdBy: 'u_chen', createdAt: created },
  ];

  // 宏昇:7 天前已入庫的拜訪(必答 7/8,未處理 Q8 預算範圍)
  const d1 = addDays(now, -7);
  const hsVisit: Visit = {
    id: 'v_hs_1', code: visitCode(d1, 1), customerId: 'c_hs', salesId: 'u_wang', visitAt: iso(d1, 14, 30), visitType: '初次', questionSetId: 'qs_track',
    source: 'dictation', status: 'confirmed', upload: 'done', stage: 5, editCount: 2,
    raw: {
      segments: [
        { id: 'sg1', source: 'dictation', text: '這次拜訪主要是了解宏昇的設備現況與擴線計畫。' },
        { id: 'sg2', source: 'dictation', text: '目前使用 350 噸射出機,共 6 台。' },
        { id: 'sg3', source: 'dictation', text: '客戶在評估 GT 系列取出機,預計導入 8 台,希望 12 月前完成。' },
        { id: 'sg4', source: 'dictation', text: '客戶希望縮短取出時間,擔心與既有機台整合的問題。' },
        { id: 'sg5', source: 'dictation', text: '客戶也有在比較日系廠牌的方案。採購由張經理與李廠長共同決定。' },
        { id: 'sg6', source: 'dictation', text: '客戶表示不想再比價,重視穩定品質與售後支援。' },
      ],
    },
    ai: {
      mock: true,
      answers: [
        { questionId: q('Q1'), required: true, status: 'answered', answer: '了解設備現況與擴線計畫', sourceSegmentIds: ['sg1'] },
        { questionId: q('Q2'), required: true, status: 'answered', answer: '350 噸射出機,共 6 台', sourceSegmentIds: ['sg2'] },
        { questionId: q('Q3'), required: true, status: 'answered', answer: 'GT 系列', sourceSegmentIds: ['sg3'] },
        { questionId: q('Q4'), required: true, status: 'answered', answer: '8 台', sourceSegmentIds: ['sg3'] },
        { questionId: q('Q5'), required: true, status: 'answered', answer: '12 月前完成', sourceSegmentIds: ['sg3'] },
        { questionId: q('Q6'), required: true, status: 'answered', answer: '縮短取出時間', sourceSegmentIds: ['sg4'] },
        { questionId: q('Q7'), required: true, status: 'answered', answer: '日系廠牌方案', sourceSegmentIds: ['sg5'] },
        { questionId: q('Q8'), required: true, status: 'not_provided', answer: '', reason: '客戶尚未決定', sourceSegmentIds: [] },
        { questionId: q('Q9'), required: false, status: 'uncovered', answer: '', sourceSegmentIds: [] },
        { questionId: q('Q10'), required: false, status: 'answered', answer: '張經理與李廠長共同決定', sourceSegmentIds: ['sg5'] },
      ],
      summary: {
        keyPoints: { text: '評估導入 GT 系列,目前使用 350 噸射出機,預計導入 8 台,希望 12 月前完成。', sourceSegmentIds: ['sg2', 'sg3'] },
        needs: { text: '縮短取出時間。', sourceSegmentIds: ['sg4'] },
        competitors: { text: '同時比較日系廠牌方案。', sourceSegmentIds: ['sg5'] },
        objections: { text: '擔心與既有機台整合。', sourceSegmentIds: ['sg4'] },
        nextSteps: { text: '提供 GT 系列 350 噸報價;確認 8 台交期;回覆模具搭配方案。', sourceSegmentIds: [] },
      },
      facts: [
        { id: 'f1', kind: 'model', text: 'GT 系列', sourceSegmentId: 'sg3', viewed: true },
        { id: 'f2', kind: 'tonnage', text: '350 噸', sourceSegmentId: 'sg2', viewed: true },
        { id: 'f3', kind: 'quantity', text: '8 台', sourceSegmentId: 'sg3', viewed: true },
        { id: 'f4', kind: 'date', text: '12 月前', sourceSegmentId: 'sg3', viewed: true },
      ],
      uncertainties: [],
      prefs: [],
      todos: [],
      generatedAt: iso(d1, 15, 0),
    },
    confirmedAt: iso(d1, 18, 40), confirmedBy: 'u_wang', createdAt: iso(d1, 14, 30), updatedAt: iso(d1, 18, 40),
  };

  // 明耀:13 天前已入庫
  const d2 = addDays(now, -13);
  const myVisit: Visit = {
    id: 'v_my_1', code: visitCode(d2, 1), customerId: 'c_my', salesId: 'u_wang', visitAt: iso(d2, 10, 0), visitType: '初次', questionSetId: 'qs_expand',
    source: 'text', status: 'confirmed', upload: 'done', stage: 5, editCount: 0,
    raw: {
      text: '明耀計畫擴充一條產線,目前有 180 噸射出機 4 台,考慮增加 2 台 AT 系列取出機,希望下半年導入。預算尚在內部簽核。',
      segments: [
        { id: 'm1', source: 'text', text: '明耀計畫擴充一條產線,目前有 180 噸射出機 4 台。' },
        { id: 'm2', source: 'text', text: '考慮增加 2 台 AT 系列取出機,希望下半年導入。' },
        { id: 'm3', source: 'text', text: '預算尚在內部簽核。' },
      ],
    },
    ai: {
      mock: true,
      answers: [
        { questionId: q('Q1'), required: true, status: 'answered', answer: '了解擴線計畫', sourceSegmentIds: ['m1'] },
        { questionId: q('Q2'), required: true, status: 'answered', answer: '180 噸射出機 4 台', sourceSegmentIds: ['m1'] },
        { questionId: q('Q4'), required: true, status: 'answered', answer: '2 台', sourceSegmentIds: ['m2'] },
        { questionId: q('Q5'), required: true, status: 'answered', answer: '下半年', sourceSegmentIds: ['m2'] },
        { questionId: q('Q8'), required: true, status: 'partial', answer: '尚在內部簽核', sourceSegmentIds: ['m3'] },
        { questionId: q('Q9'), required: false, status: 'uncovered', answer: '', sourceSegmentIds: [] },
      ],
      summary: {
        keyPoints: { text: '計畫擴充一條產線,考慮增加 2 台 AT 系列取出機,希望下半年導入。', sourceSegmentIds: ['m1', 'm2'] },
        needs: { text: '擴充產線產能。', sourceSegmentIds: ['m1'] },
        competitors: { text: '未知', sourceSegmentIds: [] },
        objections: { text: '未知', sourceSegmentIds: [] },
        nextSteps: { text: '待客戶預算簽核後再約二次拜訪。', sourceSegmentIds: ['m3'] },
      },
      facts: [
        { id: 'mf1', kind: 'model', text: 'AT 系列', sourceSegmentId: 'm2', viewed: true },
        { id: 'mf2', kind: 'quantity', text: '2 台', sourceSegmentId: 'm2', viewed: true },
      ],
      uncertainties: [],
      prefs: [],
      todos: [],
      generatedAt: iso(d2, 11, 0),
    },
    confirmedAt: iso(d2, 16, 10), confirmedBy: 'u_wang', createdAt: iso(d2, 10, 0), updatedAt: iso(d2, 16, 10),
  };

  const preferences: Preference[] = [
    { id: 'p1', customerId: 'c_hs', type: 'avoid', content: '避免以低價作為主要說明', target: 'customer', targetName: '宏昇塑膠', sensitivity: 'normal', sourceVisitId: 'v_hs_1', sourceText: '客戶表示不想再比價,重視穩定品質與售後支援。', createdAt: iso(d1, 18, 40) },
    { id: 'p2', customerId: 'c_hs', type: 'avoid', content: '對交期與變更需求較敏感', target: 'customer', targetName: '宏昇塑膠', sensitivity: 'normal', sourceVisitId: 'v_hs_1', createdAt: iso(d1, 18, 40) },
    { id: 'p3', customerId: 'c_hs', type: 'preference', content: '重視穩定品質與售後支援', target: 'customer', targetName: '宏昇塑膠', sensitivity: 'normal', sourceVisitId: 'v_hs_1', createdAt: iso(d1, 18, 40) },
  ];

  const todos: Todo[] = [
    { id: 't1', customerId: 'c_hs', visitId: 'v_hs_1', content: '提供 GT 系列 350 噸報價', ownerId: 'u_wang', due: ymd(addDays(now, 6)), done: false, createdAt: iso(d1, 18, 40) },
    { id: 't2', customerId: 'c_hs', visitId: 'v_hs_1', content: '確認 8 台交期', ownerId: 'u_wang', due: today, done: false, createdAt: iso(d1, 18, 40) },
    { id: 't3', customerId: 'c_hs', visitId: 'v_hs_1', content: '回覆模具搭配方案', ownerId: 'u_wang', due: ymd(addDays(now, 3)), done: false, createdAt: iso(d1, 18, 40) },
    { id: 't4', customerId: 'c_my', visitId: 'v_my_1', content: '追蹤明耀預算簽核進度', ownerId: 'u_wang', due: today, done: false, createdAt: iso(d2, 16, 10) },
  ];

  // 一筆待確認的拜訪(昨天,業務口述),讓 S09 確認頁一開始就有內容可看
  const d3 = addDays(now, -1);
  const pending: Visit = {
    id: 'v_yq_1', code: visitCode(d3, 1), customerId: 'c_yq', salesId: 'u_wang', visitAt: iso(d3, 16, 0), visitType: '初次', questionSetId: 'qs_new',
    source: 'dictation', status: 'pending_confirm', upload: 'done', stage: 5, editCount: 0,
    raw: {
      segments: [
        { id: 'y1', source: 'dictation', questionId: q('Q1'), text: '這次主要是介紹 ST 系列,並了解永群的模具與射出狀況。' },
        { id: 'y2', source: 'dictation', questionId: q('Q2'), text: '目前大概有 220 噸射出機 5 台。' },
        { id: 'y3', source: 'dictation', questionId: q('Q3'), text: '客戶對 ST 有興趣,想先看 2 台的報價。' },
        { id: 'y4', source: 'dictation', questionId: q('Q6'), text: '希望減少換模時的人工調整時間。' },
        { id: 'y5', source: 'dictation', text: '客戶說不喜歡業務一直打電話催,有事用 LINE 留言就好。下週三前提供 ST 系列報價。' },
      ],
    },
    ai: {
      mock: true,
      answers: [
        { questionId: q('Q1'), required: true, status: 'answered', answer: '介紹 ST 系列,了解模具與射出狀況', sourceSegmentIds: ['y1'] },
        { questionId: q('Q2'), required: true, status: 'answered', answer: '220 噸射出機 5 台', sourceSegmentIds: ['y2'] },
        { questionId: q('Q3'), required: true, status: 'uncovered', answer: '', sourceSegmentIds: ['y3'] },
        { questionId: q('Q6'), required: false, status: 'answered', answer: '減少換模人工調整時間', sourceSegmentIds: ['y4'] },
        { questionId: q('Q10'), required: false, status: 'uncovered', answer: '', sourceSegmentIds: [] },
        { questionId: q('Q9'), required: false, status: 'uncovered', answer: '', sourceSegmentIds: [] },
      ],
      summary: {
        keyPoints: { text: '介紹 ST 系列,客戶目前約有 220 噸射出機 5 台,想先看 2 台的報價。', sourceSegmentIds: ['y1', 'y2', 'y3'] },
        needs: { text: '減少換模時的人工調整時間。', sourceSegmentIds: ['y4'] },
        competitors: { text: '未知', sourceSegmentIds: [] },
        objections: { text: '未知', sourceSegmentIds: [] },
        nextSteps: { text: '下週三前提供 ST 系列報價。', sourceSegmentIds: ['y5'] },
      },
      facts: [
        { id: 'yf1', kind: 'tonnage', text: '220 噸', sourceSegmentId: 'y2', viewed: false },
        { id: 'yf2', kind: 'quantity', text: '5 台', sourceSegmentId: 'y2', viewed: false },
        { id: 'yf3', kind: 'quantity', text: '2 台', sourceSegmentId: 'y3', viewed: false },
        { id: 'yf4', kind: 'date', text: '下週三前', sourceSegmentId: 'y5', viewed: false },
      ],
      uncertainties: [
        { id: 'yu1', text: '「ST」是否指 ST 系列?請點開原文確認', sourceSegmentId: 'y3', resolved: false },
        { id: 'yu2', text: '「大概有 220 噸射出機 5 台」為約略數字,請確認', sourceSegmentId: 'y2', resolved: false },
      ],
      prefs: [
        { id: 'yp1', type: 'avoid', content: '避免頻繁電話催促,改用 LINE 留言聯繫', target: 'customer', targetName: '永群精密', sensitivity: 'normal', sourceText: '客戶說不喜歡業務一直打電話催,有事用 LINE 留言就好。', sourceLabel: '業務口述', decision: 'pending' },
        { id: 'yp2', type: 'preference', content: '偏好以 LINE 文字溝通', target: 'customer', targetName: '永群精密', sensitivity: 'normal', sourceText: '有事用 LINE 留言就好。', sourceLabel: '業務口述', decision: 'pending' },
      ],
      todos: [
        { id: 'yt1', content: '提供 ST 系列 2 台報價', ownerId: 'u_wang', due: undefined, keep: true },
      ],
      generatedAt: iso(d3, 16, 30),
    },
    createdAt: iso(d3, 16, 0), updatedAt: iso(d3, 16, 30),
  };

  return {
    version: 1,
    sessionUserId: undefined,
    onboarded: false,
    users,
    customers,
    questions,
    questionSets,
    schedules,
    visits: [hsVisit, myVisit, pending],
    preferences,
    todos,
    audit: [],
    settings: { ...DEFAULT_SETTINGS },
    lastSyncAt: now.toISOString(),
  };
}
