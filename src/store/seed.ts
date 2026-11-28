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
      id: 'c_hs', code: 'C100328', name: '宏昇塑膠有限公司', category: '重點客戶', taxId: '24561238', principal: '林宏昇', phone: '04-2350-1234',
      addr: { city: '台中市', district: '西屯區', street: '工業區三十六路 12 號' }, website: 'https://www.hs-plastic.example',
      customerTypes: ['直接客戶'], industries: ['塑膠射出成型', '家電零件'], products: ['家電零件'], identities: ['代工廠(OEM/ODM)'], moldInjection: ['模具外包', '自行射出'],
      markets: ['家電'], employeeScale: '200–499 人', evaluatingSeries: 'GT 系列',
      machines: [{ id: 'm_hs1', brand: '海天', tonnage: '350', qty: 6 }],
      automation: { level: '半自動化', processes: ['取件', '剪料頭/修邊'] },
      fieldSources: { machines: { visitId: 'v_hs_1', at: addDays(now, -7).toISOString(), by: 'u_wang', quote: '目前使用 350 噸射出機,共 6 台。' } },
      ownerId: 'u_wang',
      contacts: [
        { id: 'ct_1', name: '張經理', title: '採購經理', department: '採購部', phone: '04-2350-1234 #21', email: 'chang@hs-plastic.example', decisionRole: '採購窗口', note: '偏好 Email 聯繫,上午較好約' },
        { id: 'ct_2', name: '李廠長', title: '廠長', department: '製造部', decisionRole: '決策者' },
      ],
      createdAt: created,
    },
    {
      id: 'c_lm', code: 'C100456', name: '聯貿工業有限公司', category: '潛在客戶', addr: { city: '桃園市', district: '楊梅區', street: '民族路五段 88 號' },
      customerTypes: ['直接客戶'], industries: ['塑膠射出成型'],
      ownerId: 'u_wang', contacts: [{ id: 'ct_3', name: '黃課長', title: '生管課長', department: '生管課', decisionRole: '影響者' }], createdAt: created,
    },
    {
      id: 'c_my', code: 'C100789', name: '明耀精密有限公司', category: '既有客戶', taxId: '53880126', phone: '03-4567-890',
      customerTypes: ['直接客戶'], industries: ['精密射出', '3C 電子'], products: ['3C 電子零件'], markets: ['3C 電子'], evaluatingSeries: 'AT 系列',
      machines: [{ id: 'm_my1', brand: '住友', tonnage: '180', qty: 4 }],
      automation: { level: '半自動化', processes: ['取件', '檢測(含模內監視)'] },
      ownerId: 'u_wang', contacts: [{ id: 'ct_4', name: '吳協理', title: '製造協理', department: '製造處', decisionRole: '決策者' }], createdAt: created,
    },
    {
      id: 'c_ds', code: 'C100512', name: '鼎盛塑膠工業有限公司', category: '新客戶', customerTypes: ['經銷商'], industries: ['家電零件'],
      machines: [{ id: 'm_ds1', tonnage: '450', qty: 3 }],
      ownerId: 'u_lin', contacts: [{ id: 'ct_5', name: '周經理', title: '工程經理', department: '工程部', decisionRole: '技術評估' }], createdAt: created,
    },
    {
      id: 'c_yq', code: 'C100603', name: '永群精密模具有限公司', category: '潛在客戶', phone: '03-3811613',
      customerTypes: ['直接客戶'], industries: ['模具製造', '塑膠射出成型'], products: ['家電零件', '汽車零件'], evaluatingSeries: 'ST 系列',
      automation: { level: '半自動化', processes: ['取件', '剪料頭/修邊'] },
      ownerId: 'u_wang', contacts: [], createdAt: created,
    },
    {
      id: 'c_tz', code: 'C100671', name: '台展科技股份有限公司', category: '既有客戶', customerTypes: ['直接客戶'], industries: ['汽車零件'], products: ['汽車零件'],
      machines: [{ id: 'm_tz1', brand: 'ENGEL', tonnage: '650', qty: 2 }],
      ownerId: 'u_lin', contacts: [{ id: 'ct_6', name: '蔡副理', title: '設備副理', department: '設備課', decisionRole: '技術評估' }], createdAt: created,
    },
  ];

  // 題庫:Q1–Q6 為哈鏌「初次拜訪公版題庫」,Q7 以後為其他模板使用
  const qs: [string, string, string, string][] = [
    ['Q1', '今天與誰見面?主要談了什麼?', '拜訪概況', '姓名、職稱、角色、拜訪目的與結果'],
    ['Q2', '客戶主要做什麼產品?', '客戶背景', '生產產品、所屬產業、應用市場'],
    ['Q3', '工廠目前有哪些設備?', '設備現況', '射出機廠牌/噸數/數量,以及周邊、自動化現況'],
    ['Q4', '現在有什麼困擾或未來計畫?', '需求與計畫', '生產問題、增購、汰換、擴廠;有需求再追規格、數量、時程'],
    ['Q5', '設備由誰評估與決定?最在意什麼?', '決策與考量', '採購決策流程,以及價格、品質、交期、服務等考量'],
    ['Q6', '這次談完,下一步是什麼?', '後續行動', '雙方承諾、負責人、預計回覆時間;沒有安排也可記錄'],
    ['Q7', '評估導入的取出機系列(GT/AT/ST)?', '產品需求', '系列、規格'],
    ['Q8', '預計導入的台數?', '產品需求', '台數、搭配的射出機'],
    ['Q9', '預計導入的時程?', '時程與預算', '希望完成的時間'],
    ['Q10', '正在比較的其他廠牌或方案?', '競爭狀況', '廠牌、比較重點'],
    ['Q11', '預算範圍?', '時程與預算', '金額或範圍、簽核狀況'],
    ['Q12', '現有設備的保養維修方式?', '設備現況', '自行保養或外包、常見問題'],
    ['Q13', '其他補充事項', '其他', ''],
  ];
  const questions: Question[] = qs.map(([code, text, category, hint]) => ({ id: `q_${code.toLowerCase()}`, code, text, category, hint: hint || undefined, active: true }));
  const q = (code: string) => `q_${code.toLowerCase()}`;

  const questionSets: QuestionSet[] = [
    {
      id: 'qs_new', name: '初次拜訪公版題庫(Q1–Q6)', active: true, scope: 'template', defaultFirstVisit: true,
      note: '第一次拜訪:先了解見面對象、產品、設備、困擾與決策方式,談完確認下一步。未問到或只取得部分的題目,第二次拜訪前會自動提示補問。',
      items: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6'].map((c) => ({ questionId: q(c), required: true })),
    },
    {
      id: 'qs_track', name: '射出成型設備追蹤', active: true, scope: 'template',
      items: ['Q1', 'Q3', 'Q7', 'Q8', 'Q9', 'Q10', 'Q11'].map((c) => ({ questionId: q(c), required: true }))
        .concat(['Q5', 'Q13'].map((c) => ({ questionId: q(c), required: false }))),
    },
    {
      id: 'qs_expand', name: '設備擴充需求', active: true, scope: 'template',
      items: ['Q1', 'Q3', 'Q8', 'Q9', 'Q11'].map((c) => ({ questionId: q(c), required: true }))
        .concat(['Q13'].map((c) => ({ questionId: q(c), required: false }))),
    },
  ];

  const schedules: Schedule[] = [
    { id: 's_1', date: today, time: '09:30', salesId: 'u_wang', customerId: 'c_hs', visitType: '複訪', questionSetId: 'qs_track', purpose: '回覆 GT 系列報價並確認交期', note: '確認 8 台交期', createdBy: 'u_chen', createdAt: created },
    { id: 's_2', date: today, time: '11:00', salesId: 'u_wang', customerId: 'c_lm', visitType: '初次', questionSetId: 'qs_new', purpose: '初次拜訪,了解現有設備與擴線計畫', note: '了解現有設備', createdBy: 'u_chen', createdAt: created },
    { id: 's_3', date: today, time: '14:30', salesId: 'u_wang', customerId: 'c_my', visitType: '複訪', questionSetId: 'qs_expand', createdBy: 'u_chen', createdAt: created },
    { id: 's_4', date: today, time: '10:00', salesId: 'u_lin', customerId: 'c_ds', visitType: '初次', questionSetId: 'qs_new', createdBy: 'u_chen', createdAt: created },
    { id: 's_5', date: ymd(addDays(now, 1)), time: '15:00', salesId: 'u_wang', customerId: 'c_yq', visitType: '複訪', questionSetId: 'qs_new', purpose: '回覆 ST 系列報價,補問設備台數與決策流程', createdBy: 'u_chen', createdAt: created },
  ];

  const sum = (keyPoints: string, needs: string, competitors: string, objections: string, nextSteps: string, ids: Record<string, string[]> = {}) => ({
    keyPoints: { text: keyPoints, sourceSegmentIds: ids.k || [] },
    needs: { text: needs, sourceSegmentIds: ids.n || [] },
    competitors: { text: competitors, sourceSegmentIds: ids.c || [] },
    objections: { text: objections, sourceSegmentIds: ids.o || [] },
    nextSteps: { text: nextSteps, sourceSegmentIds: ids.x || [] },
  });
  const ci = (id: string, text: string, ids: string[], extra: Partial<{ aspect: string; status: 'explicit' | 'possible' | 'pending'; infoTime: string; target: 'company' | 'factory' | 'contact' | 'preference'; mentionedBy: string }> = {}) => ({
    id, text, sourceSegmentIds: ids, status: extra.status || ('explicit' as const), aspect: extra.aspect, infoTime: extra.infoTime, target: extra.target, mentionedBy: extra.mentionedBy,
  });

  // 宏昇:7 天前已入庫的有效拜訪
  const d1 = addDays(now, -7);
  const hsVisit: Visit = {
    id: 'v_hs_1', code: visitCode(d1, 1), customerId: 'c_hs', salesId: 'u_wang', visitAt: iso(d1, 14, 30), visitType: '初次', questionSetId: 'qs_new',
    source: 'dictation', status: 'confirmed', upload: 'done', stage: 5, editCount: 2,
    raw: {
      segments: [
        { id: 'sg1', source: 'dictation', text: '這次拜訪見了張經理和李廠長,主要是了解宏昇的設備現況與擴線計畫。' },
        { id: 'sg2', source: 'dictation', text: '宏昇主要做家電零件,目前使用海天 350 噸射出機,共 6 台,取件和剪料頭已經自動化。' },
        { id: 'sg3', source: 'dictation', text: '客戶在評估 GT 系列取出機,預計導入 8 台,希望 12 月前完成。' },
        { id: 'sg4', source: 'dictation', text: '客戶希望縮短取出時間,擔心與既有機台整合的問題。' },
        { id: 'sg5', source: 'dictation', text: '客戶也有在比較日系廠牌的方案。採購由張經理與李廠長共同決定。' },
        { id: 'sg6', source: 'dictation', text: '客戶表示不想再比價,重視穩定品質與售後支援。下週提供 GT 系列報價。' },
      ],
    },
    ai: {
      mock: true,
      visitKind: 'effective',
      purpose: '了解設備現況與擴線計畫',
      answers: [
        { questionId: q('Q1'), required: true, status: 'answered', answer: '張經理、李廠長;了解設備現況與擴線計畫', sourceSegmentIds: ['sg1'] },
        { questionId: q('Q2'), required: true, status: 'partial', answer: '家電零件', missing: '應用市場', sourceSegmentIds: ['sg2'] },
        { questionId: q('Q3'), required: true, status: 'answered', answer: '海天 350 噸射出機 6 台;取件、剪料頭已自動化', sourceSegmentIds: ['sg2'] },
        { questionId: q('Q4'), required: true, status: 'answered', answer: '縮短取出時間;評估導入 GT 系列 8 台,12 月前', sourceSegmentIds: ['sg3', 'sg4'] },
        { questionId: q('Q5'), required: true, status: 'answered', answer: '張經理與李廠長共同決定;重視穩定品質與售後', sourceSegmentIds: ['sg5', 'sg6'] },
        { questionId: q('Q6'), required: true, status: 'answered', answer: '下週提供 GT 系列報價', sourceSegmentIds: ['sg6'] },
      ],
      summary: sum('評估導入 GT 系列,目前使用 350 噸射出機,預計導入 8 台,希望 12 月前完成。', '縮短取出時間。', '同時比較日系廠牌方案。', '擔心與既有機台整合。', '提供 GT 系列 350 噸報價;確認 8 台交期;回覆模具搭配方案。', { k: ['sg2', 'sg3'], n: ['sg4'], c: ['sg5'], o: ['sg4'] }),
      categories: {
        c1: [ci('h11', '了解設備現況與擴線計畫;取得設備清單與導入需求', ['sg1'], { aspect: '目的與成果' })],
        c2: [ci('h21', '評估 GT 系列取出機 8 台,希望 12 月前完成', ['sg3'], { aspect: '產品/數量/時程', infoTime: '12 月前' }), ci('h22', '希望縮短取出時間', ['sg4'], { aspect: '需求原因' })],
        c3: [ci('h31', '海天 350 噸射出機 6 台;主要生產家電零件', ['sg2'], { aspect: '射出機/生產產品', target: 'factory' }), ci('h32', '取件、剪料頭已自動化', ['sg2'], { aspect: '自動化現況', target: 'factory' })],
        c4: [ci('h41', '張經理(採購)與李廠長共同決定', ['sg5'], { aspect: '決策角色', target: 'contact' })],
        c5: [ci('h51', '同時比較日系廠牌方案', ['sg5'], { aspect: '比較品牌' })],
        c6: [ci('h61', '不想再比價,重視穩定品質與售後支援', ['sg6'], { aspect: '考量優先順序', target: 'preference' }), ci('h62', '擔心與既有機台整合', ['sg4'], { aspect: '整合疑慮' })],
        c7: [ci('h71', '下週提供 GT 系列報價', ['sg6'], { aspect: '我方承諾', infoTime: '下週' })],
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
      text: '明耀計畫擴充一條產線,目前有住友 180 噸射出機 4 台,考慮增加 2 台 AT 系列取出機,希望下半年導入。預算尚在內部簽核。',
      segments: [
        { id: 'm1', source: 'text', text: '明耀計畫擴充一條產線,目前有住友 180 噸射出機 4 台。' },
        { id: 'm2', source: 'text', text: '考慮增加 2 台 AT 系列取出機,希望下半年導入。' },
        { id: 'm3', source: 'text', text: '預算尚在內部簽核。' },
      ],
    },
    ai: {
      mock: true,
      visitKind: 'effective',
      answers: [
        { questionId: q('Q1'), required: true, status: 'answered', answer: '了解擴線計畫', sourceSegmentIds: ['m1'] },
        { questionId: q('Q3'), required: true, status: 'answered', answer: '住友 180 噸射出機 4 台', sourceSegmentIds: ['m1'] },
        { questionId: q('Q8'), required: true, status: 'answered', answer: '2 台', sourceSegmentIds: ['m2'] },
        { questionId: q('Q9'), required: true, status: 'answered', answer: '下半年', sourceSegmentIds: ['m2'] },
        { questionId: q('Q11'), required: true, status: 'partial', answer: '尚在內部簽核', missing: '預算金額', sourceSegmentIds: ['m3'] },
        { questionId: q('Q13'), required: false, status: 'uncovered', answer: '', sourceSegmentIds: [] },
      ],
      summary: sum('計畫擴充一條產線,考慮增加 2 台 AT 系列取出機,希望下半年導入。', '擴充產線產能。', '未知', '未知', '待客戶預算簽核後再約二次拜訪。', { k: ['m1', 'm2'], n: ['m1'], x: ['m3'] }),
      categories: {
        c1: [ci('m11', '了解擴線計畫', ['m1'])],
        c2: [ci('m21', '考慮增加 2 台 AT 系列取出機,希望下半年導入', ['m2'], { aspect: '產品/數量/時程', infoTime: '下半年' }), ci('m22', '預算尚在內部簽核', ['m3'], { aspect: '預算', status: 'pending' })],
        c3: [ci('m31', '住友 180 噸射出機 4 台;計畫擴充一條產線', ['m1'], { aspect: '射出機/擴廠', target: 'factory' })],
        c7: [ci('m71', '待預算簽核後再約二次拜訪', ['m3'], { aspect: '下一步' })],
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

  // 聯貿:4 天前的一般拜訪(未遇窗口),保留在拜訪履歷
  const d4 = addDays(now, -4);
  const lmVisit: Visit = {
    id: 'v_lm_0', code: visitCode(d4, 1), customerId: 'c_lm', salesId: 'u_wang', visitAt: iso(d4, 15, 0), visitType: '初次',
    source: 'text', status: 'confirmed', upload: 'done', stage: 5, editCount: 0,
    raw: {
      text: '到聯貿拜訪,黃課長臨時開會,未遇窗口。留下型錄,約下週再訪。',
      segments: [
        { id: 'l1', source: 'text', text: '到聯貿拜訪,黃課長臨時開會,未遇窗口。' },
        { id: 'l2', source: 'text', text: '留下型錄,約下週再訪。' },
      ],
    },
    ai: {
      mock: true,
      visitKind: 'general',
      generalNotes: ['未遇窗口'],
      answers: [],
      summary: sum('黃課長臨時開會,未遇窗口。', '未知', '未知', '未知', '約下週再訪。', { k: ['l1'], x: ['l2'] }),
      categories: {
        c1: [ci('l11', '未遇窗口(黃課長臨時開會);留下型錄', ['l1'], { aspect: '未成果原因' })],
        c7: [ci('l71', '約下週再訪', ['l2'], { aspect: '下一步', infoTime: '下週' })],
      },
      facts: [],
      uncertainties: [],
      prefs: [],
      todos: [],
      generatedAt: iso(d4, 15, 30),
    },
    confirmedAt: iso(d4, 17, 0), confirmedBy: 'u_wang', createdAt: iso(d4, 15, 0), updatedAt: iso(d4, 17, 0),
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

  // 一筆待確認的拜訪(昨天,業務口述),確認頁一開始就有內容可看:含部分取得題目與客戶資料更新建議
  const d3 = addDays(now, -1);
  const pending: Visit = {
    id: 'v_yq_1', code: visitCode(d3, 1), customerId: 'c_yq', salesId: 'u_wang', visitAt: iso(d3, 16, 0), visitType: '初次', questionSetId: 'qs_new',
    source: 'dictation', status: 'pending_confirm', upload: 'done', stage: 5, editCount: 0,
    raw: {
      segments: [
        { id: 'y1', source: 'dictation', questionId: q('Q1'), text: '今天見到工程部陳主任,主要介紹 ST 系列,並了解永群的模具與射出狀況。' },
        { id: 'y2', source: 'dictation', questionId: q('Q2'), text: '永群做家電和汽車零件的模具,也有自己射出。' },
        { id: 'y3', source: 'dictation', questionId: q('Q3'), text: '目前大概有 220 噸射出機,廠牌是震雄,數量沒問到。' },
        { id: 'y4', source: 'dictation', questionId: q('Q4'), text: '希望減少換模時的人工調整時間,明年可能擴廠。' },
        { id: 'y5', source: 'dictation', text: '客戶說不喜歡業務一直打電話催,有事用 LINE 留言就好。下週三前提供 ST 系列 2 台報價。' },
      ],
    },
    ai: {
      mock: true,
      visitKind: 'effective',
      purpose: '介紹 ST 系列,了解模具與射出狀況',
      answers: [
        { questionId: q('Q1'), required: true, status: 'answered', answer: '工程部陳主任;介紹 ST 系列,了解模具與射出狀況', sourceSegmentIds: ['y1'] },
        { questionId: q('Q2'), required: true, status: 'answered', answer: '家電與汽車零件的模具,也自行射出', sourceSegmentIds: ['y2'] },
        { questionId: q('Q3'), required: true, status: 'partial', answer: '震雄 220 噸射出機', missing: '射出機數量', sourceSegmentIds: ['y3'] },
        { questionId: q('Q4'), required: true, status: 'answered', answer: '減少換模人工調整時間;明年可能擴廠', sourceSegmentIds: ['y4'] },
        { questionId: q('Q5'), required: true, status: 'uncovered', answer: '', sourceSegmentIds: [] },
        { questionId: q('Q6'), required: true, status: 'answered', answer: '下週三前提供 ST 系列 2 台報價', sourceSegmentIds: ['y5'] },
      ],
      summary: sum('介紹 ST 系列,客戶有震雄 220 噸射出機,想先看 2 台的報價。', '減少換模時的人工調整時間。', '未知', '未知', '下週三前提供 ST 系列報價。', { k: ['y1', 'y3'], n: ['y4'], x: ['y5'] }),
      categories: {
        c1: [ci('y11', '介紹 ST 系列;了解模具與射出狀況', ['y1'], { aspect: '目的與成果' })],
        c2: [ci('y21', 'ST 系列 2 台報價', ['y5'], { aspect: '產品/數量' })],
        c3: [
          ci('y31', '震雄 220 噸射出機(數量未取得)', ['y3'], { aspect: '射出機', target: 'factory' }),
          ci('y32', '做家電與汽車零件的模具,也自行射出', ['y2'], { aspect: '生產產品', target: 'company' }),
          ci('y33', '明年可能擴廠', ['y4'], { aspect: '擴廠', status: 'possible', infoTime: '明年' }),
        ],
        c4: [ci('y41', '工程部陳主任', ['y1'], { aspect: '接洽人', target: 'contact' })],
        c6: [ci('y61', '希望減少換模人工調整時間', ['y4'], { aspect: '服務期待' }), ci('y62', '不喜歡電話催促,偏好 LINE 留言', ['y5'], { aspect: '溝通方式', target: 'preference' })],
        c7: [ci('y71', '下週三前提供 ST 系列 2 台報價', ['y5'], { aspect: '我方承諾', infoTime: '下週三前' })],
      },
      profileUpdates: [
        { id: 'yu_m', field: 'machine', value: '震雄 220 噸(數量待補)', machine: { brand: '震雄', tonnage: '220' }, status: 'explicit', sourceSegmentIds: ['y3'], decision: 'pending' },
        { id: 'yu_p', field: 'products', value: '家電零件', status: 'explicit', sourceSegmentIds: ['y2'], decision: 'pending' },
        { id: 'yu_p2', field: 'products', value: '汽車零件', status: 'explicit', sourceSegmentIds: ['y2'], decision: 'pending' },
        { id: 'yu_c', field: 'contact', value: '陳主任(工程部)', contact: { name: '陳主任', department: '工程部', title: '主任', role: '技術評估' }, status: 'explicit', sourceSegmentIds: ['y1'], decision: 'pending' },
      ],
      facts: [
        { id: 'yf1', kind: 'tonnage', text: '220 噸', sourceSegmentId: 'y3', viewed: false },
        { id: 'yf3', kind: 'quantity', text: '2 台', sourceSegmentId: 'y5', viewed: false },
        { id: 'yf4', kind: 'date', text: '下週三前', sourceSegmentId: 'y5', viewed: false },
      ],
      uncertainties: [{ id: 'yu1', text: '「大概有 220 噸射出機」為約略描述,請確認', sourceSegmentId: 'y3', resolved: false }],
      prefs: [
        { id: 'yp1', type: 'avoid', content: '避免頻繁電話催促,改用 LINE 留言聯繫', target: 'customer', targetName: '永群精密', sensitivity: 'normal', sourceText: '客戶說不喜歡業務一直打電話催,有事用 LINE 留言就好。', sourceLabel: '業務口述', decision: 'pending' },
      ],
      todos: [{ id: 'yt1', content: '提供 ST 系列 2 台報價', ownerId: 'u_wang', due: undefined, keep: true }],
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
    visits: [hsVisit, myVisit, lmVisit, pending],
    preferences,
    todos,
    audit: [],
    settings: { ...DEFAULT_SETTINGS },
    lastSyncAt: now.toISOString(),
  };
}
