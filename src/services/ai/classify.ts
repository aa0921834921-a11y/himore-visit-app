import type { AnswerItem, CategoryItem, CategoryKey, Customer, ProfileUpdate, Question, Segment, VisitKind } from '../../types';
import { truncate, uid } from '../../lib/util';
import type { Sentence } from './mock';

// 模擬 AI 的規則:七大分類、有效/一般拜訪、題目缺漏、客戶資料更新建議。
// 正式 AI(本機伺服器)由語言模型判斷;這裡讓沒有伺服器時也能完整示範流程。

const HEDGE = /大概|大約|可能|好像|應該|也許|不確定|左右|考慮/;
const BRAND = /(海天|震雄|住友|FANUC|發那科|日精|東芝|ENGEL|恩格爾|阿博格|ARBURG|全立發|富強鑫|克勞斯|KraussMaffei)/i;
const SURNAME = '王李張劉陳楊黃趙吳周徐孫馬朱胡郭何高林羅鄭梁謝宋唐許韓馮鄧曹彭曾蕭田董袁潘蔡蔣余杜葉程蘇魏呂丁任沈姚盧姜崔鍾譚陸汪范金石廖賈夏韋方白鄒孟熊秦邱江尹薛段雷侯龍史陶黎賀顧毛郝龔邵萬錢嚴武戴莫孔向湯';
const PERSON = new RegExp(`([${SURNAME}])(總經理|董事長|副總|經理|副理|協理|廠長|主任|課長|處長|組長|老闆|工程師)`, 'g');
const DATE = /(下週[一二三四五六日天]?前?|下個月|月底前?|年底前?|明年(?:Q[1-4]|上半年|下半年)?|下半年|上半年|\d{1,2}\s*月(?:底|前|初|中)?|\d{1,2}\/\d{1,2})/;

/** 每個題目需要帶回的要點(依題目文字判斷;用於「部分取得,還缺什麼」) */
const ASPECTS: { match: RegExp; aspects: [string, RegExp][] }[] = [
  { match: /與誰見面/, aspects: [['見面對象', PERSON], ['拜訪目的', /主要|目的|介紹|了解|確認|談/]] },
  { match: /做什麼產品/, aspects: [['生產產品', /零件|產品|模具|生產|做/], ['應用市場', /家電|汽車|3C|電子|醫療|包裝|市場|應用/]] },
  { match: /哪些設備/, aspects: [['射出機廠牌', BRAND], ['噸數', /\d+\s*噸/], ['數量', /\d+\s*台(?!灣|中|南|北)|共\s*[一二三四五六七八九十]+\s*台/]] },
  { match: /困擾|未來計畫/, aspects: [['問題或計畫', /改善|困擾|故障|太慢|太長|減少|縮短|擴廠|擴線|汰換|增購|計畫|導入/]] },
  { match: /評估與決定|由誰評估/, aspects: [['決策者', /決定|決策|簽核|老闆|廠長|共同|評估/], ['最在意的事', /重視|在意|價格|品質|交期|服務|售後/]] },
  { match: /下一步/, aspects: [['下一步', /下週|下次|報價|提供|回覆|再約|安排|寄|試機/]] },
];

export function aspectsOf(q: Question) {
  return ASPECTS.find((a) => a.match.test(q.text))?.aspects;
}

/** 依要點判斷題目:全部取得=已回覆,部分取得=部分回覆並列出缺少的要點 */
export function answerByAspects(q: Question, item: { questionId: string; required: boolean; tracked?: boolean }, sents: Sentence[], segments: Segment[]): AnswerItem | undefined {
  const aspects = aspectsOf(q);
  if (!aspects) return undefined;
  const direct = segments.filter((sg) => sg.questionId === q.id).map((sg) => ({ text: sg.text, segId: sg.id }));
  const pool = direct.length ? direct : sents.filter((s) => !s.questionId);
  const hits = pool.filter((s) => aspects.some(([, re]) => new RegExp(re.source, re.flags.replace('g', '')).test(s.text)));
  const base: AnswerItem = { questionId: item.questionId, required: item.required, tracked: item.tracked, status: 'uncovered', answer: '', sourceSegmentIds: [] };
  if (!hits.length) return base;
  const all = hits.map((h) => h.text).join(' ');
  const missing = aspects.filter(([, re]) => !new RegExp(re.source, re.flags.replace('g', '')).test(all)).map(([n]) => n);
  return {
    ...base,
    status: missing.length ? 'partial' : 'answered',
    answer: truncate(hits.slice(0, 2).map((h) => h.text).join(';'), 90),
    missing: missing.length ? missing.join('、') : undefined,
    sourceSegmentIds: Array.from(new Set(hits.slice(0, 3).map((h) => h.segId))),
  };
}

const CAT_RULES: { key: CategoryKey; re: RegExp; aspect: (t: string) => string | undefined }[] = [
  { key: 'c1', re: /這次|本次|今天|主要是|主要想|目的|見了|見到|未遇|介紹|拜訪/, aspect: (t) => (/未遇|開會|沒空|不在/.test(t) ? '未成果原因' : '目的與成果') },
  {
    key: 'c2',
    re: /導入|採購|報價|預算|\d+\s*萬|規格|預計|評估|試機|議價|訂單|增購|汰換/,
    aspect: (t) => (/預算|萬/.test(t) ? '預算' : /試機/.test(t) ? '試機' : /報價|議價/.test(t) ? '報價' : /台/.test(t) ? '產品/數量' : '採購需求'),
  },
  { key: 'c3', re: /射出機|\d+\s*噸|設備|產線|擴廠|擴線|新廠|自動化|取件|周邊|故障|機台/, aspect: (t) => (/擴廠|擴線|新廠/.test(t) ? '擴廠計畫' : /自動化|取件/.test(t) ? '自動化現況' : /故障|問題/.test(t) ? '設備問題' : '射出機') },
  { key: 'c4', re: /經理|廠長|主任|課長|協理|副理|老闆|決定|決策|窗口|簽核/, aspect: (t) => (/決定|決策|簽核/.test(t) ? '決策角色' : '接洽人') },
  { key: 'c5', re: /競品|比較|日系|德系|其他廠牌|對手|同業|供應商|市場/, aspect: () => '比較品牌/市場' },
  { key: 'c6', re: /重視|在意|擔心|顧慮|不想|不喜歡|偏好|價格|品質|交期|售後|整合|比價/, aspect: (t) => (/擔心|顧慮|整合/.test(t) ? '整合疑慮' : /不想|不喜歡|偏好|LINE|電話/.test(t) ? '溝通與偏好' : '考量重點') },
  { key: 'c7', re: /下週|下次|明天|提供|回覆|寄|安排|再約|追蹤/, aspect: (t) => (/我|提供|寄|報價/.test(t) ? '我方承諾' : '下一步') },
];

export function classifyCategories(sents: Sentence[], segments: Segment[]): Partial<Record<CategoryKey, CategoryItem[]>> {
  const out: Partial<Record<CategoryKey, CategoryItem[]>> = {};
  const spk = new Map(segments.map((s) => [s.id, s.speaker]));
  sents.forEach((s) => {
    CAT_RULES.forEach((r) => {
      if (!r.re.test(s.text)) return;
      const list = (out[r.key] = out[r.key] || []);
      if (list.length >= 3 || list.some((x) => x.text === s.text)) return;
      const speaker = spk.get(s.segId);
      list.push({
        id: uid('ci'),
        text: truncate(s.text, 70),
        aspect: r.aspect(s.text),
        status: HEDGE.test(s.text) ? 'possible' : 'explicit',
        infoTime: s.text.match(DATE)?.[1],
        target: r.key === 'c3' ? 'factory' : r.key === 'c4' ? 'contact' : r.key === 'c6' && /不想|不喜歡|偏好|重視/.test(s.text) ? 'preference' : undefined,
        mentionedBy: speaker && !/業務/.test(speaker) ? speaker : undefined,
        sourceSegmentIds: [s.segId],
      });
    });
  });
  return out;
}

const GENERAL: [string, RegExp][] = [
  ['未遇窗口', /未遇|不在|沒見到|臨時開會|出差/],
  ['對方無暇訪談', /沒空|無暇|很忙|趕時間|沒時間/],
  ['暫無新增資訊', /暫無|沒有新|沒什麼變|維持原狀/],
];

/** 有效拜訪:有任何具體拜訪資訊;一般拜訪:只有未遇窗口、無暇訪談等接洽情況 */
export function detectVisitKind(sents: Sentence[], cats: Partial<Record<CategoryKey, CategoryItem[]>>): { kind: VisitKind; notes: string[] } {
  const notes = GENERAL.filter(([, re]) => sents.some((s) => re.test(s.text))).map(([n]) => n);
  const concrete = (['c2', 'c3', 'c5', 'c6'] as CategoryKey[]).some((k) => (cats[k] || []).length) || sents.some((s) => /\d+\s*(噸|台|萬)/.test(s.text));
  if (notes.length && !concrete) return { kind: 'general', notes };
  if (!concrete && sents.length <= 2) return { kind: 'general', notes: notes.length ? notes : ['其他接洽情況'] };
  return { kind: 'effective', notes: [] };
}

const PRODUCT_WORDS: [RegExp, string][] = [
  [/家電/, '家電零件'],
  [/汽車|車用/, '汽車零件'],
  [/3C|電子/, '3C 電子零件'],
  [/醫療/, '醫療耗材'],
  [/包裝|容器/, '包裝容器'],
  [/光學/, '光學零件'],
];
const PROCESS_WORDS: [RegExp, string][] = [
  [/取件/, '取件'],
  [/剪料頭|修邊/, '剪料頭/修邊'],
  [/檢測|模內監視|視覺/, '檢測(含模內監視)'],
  [/秤重/, '秤重'],
  [/雷射/, '雷射標記'],
  [/搬運|供料/, '搬運/供料'],
  [/組裝/, '組裝'],
  [/包裝|堆疊/, '包裝/堆疊'],
];

/** 從內容找出可以寫回客戶檔案的資料(業務逐筆採用後才寫入) */
export function extractProfileUpdates(sents: Sentence[], customer?: Customer): ProfileUpdate[] {
  const out: ProfileUpdate[] = [];
  const add = (u: Omit<ProfileUpdate, 'id' | 'decision'>) => {
    if (out.some((x) => x.field === u.field && x.value === u.value)) return;
    out.push({ ...u, id: uid('pu'), decision: 'pending' });
  };
  const status = (t: string) => (HEDGE.test(t) ? 'possible' : 'explicit') as 'possible' | 'explicit';
  sents.forEach((s) => {
    const t = s.text;
    // 射出機
    const ton = t.match(/(\d{2,4})\s*噸/);
    if (ton && /射出機|機台|台/.test(t)) {
      const brand = t.match(BRAND)?.[1];
      const qty = Number(t.match(/(?:共|總共|有)?\s*(\d{1,3})\s*台(?!灣|中|南|北)/)?.[1]) || undefined;
      const exists = (customer?.machines || []).some((m) => m.tonnage === ton[1] && (!brand || m.brand === brand) && (!qty || m.qty === qty));
      if (!exists && !/導入|預計|評估|考慮增加|報價/.test(t.slice(0, t.indexOf(ton[0]) + 4))) {
        add({ field: 'machine', value: [brand, `${ton[1]} 噸`, qty ? `× ${qty} 台` : '(數量待補)'].filter(Boolean).join(' '), machine: { brand, tonnage: ton[1], qty }, status: status(t), sourceSegmentIds: [s.segId] });
      }
    }
    // 射出產品
    if (/做|生產|產品|零件|主要/.test(t)) {
      PRODUCT_WORDS.forEach(([re, v]) => {
        if (re.test(t) && !(customer?.products || []).includes(v)) add({ field: 'products', value: v, status: status(t), sourceSegmentIds: [s.segId] });
      });
    }
    // 已自動化製程
    t.split(/[,,、]/).forEach((clause) => {
      if (!/自動化|已經|機械手|手臂/.test(clause) || /想|希望|評估|考慮/.test(clause)) return;
      PROCESS_WORDS.forEach(([re, v]) => {
        if (re.test(clause) && !(customer?.automation?.processes || []).includes(v)) add({ field: 'automationProcess', value: v, status: status(clause), sourceSegmentIds: [s.segId] });
      });
    });
    // 聯絡人
    for (const m of t.matchAll(PERSON)) {
      const name = `${m[1]}${m[2]}`;
      if ((customer?.contacts || []).some((c) => c.name === name || c.name.startsWith(m[1]))) continue;
      const before = t.slice(0, m.index);
      const dept = before.match(/([一-龥]{2}(?:部|課|處))$/)?.[1];
      if (out.some((x) => x.field === 'contact' && x.contact?.name === name)) continue;
      const role = /廠長|老闆|總經理|董事長|副總/.test(m[2]) ? '決策者' : /採購/.test(t) ? '採購窗口' : /工程|技術|設備/.test(dept || t) ? '技術評估' : undefined;
      add({ field: 'contact', value: `${name}${dept ? `(${dept})` : ''}`, contact: { name, title: m[2], department: dept, role }, status: 'explicit', sourceSegmentIds: [s.segId] });
    }
    // 員工規模
    const emp = t.match(/(\d{2,5})\s*(?:個人|名員工|位員工|人左右|員工)/);
    if (emp && !customer?.employeeScale) {
      const n = Number(emp[1]);
      const v = n < 50 ? '50 人以下' : n < 200 ? '50–199 人' : n < 500 ? '200–499 人' : '500 人以上';
      add({ field: 'employeeScale', value: v, status: status(t), sourceSegmentIds: [s.segId] });
    }
  });
  return out.slice(0, 10);
}
