import type { AppState, CategoryKey, Customer, InfoStatus, OptionKey, ProfileField, UpdateTarget } from '../types';
import { DEFAULT_SETTINGS } from './seed';

// 選項清單與分類定義。哈鏌提供正式清單前先用暫定值,主管可在後台「系統設定 → 客戶資料選項」修改。

export const OPTION_META: Record<OptionKey | 'industries' | 'categories', { label: string; hint: string; defaults: string[] }> = {
  categories: { label: '客戶狀態', hint: '客戶管理用來篩選的狀態', defaults: DEFAULT_SETTINGS.customerCategories || [] },
  customerTypes: { label: '客戶類型', hint: '可複選', defaults: ['直接客戶', '經銷商', '代理商', '系統整合商', '同業'] },
  industries: { label: '所屬產業', hint: '可複選;哈鏌提供正式分類後替換', defaults: DEFAULT_SETTINGS.industryOptions || [] },
  products: { label: '射出產品', hint: '後台建檔,客戶資料可複選,也可加入其他產品', defaults: ['家電零件', '汽車零件', '3C 電子零件', '醫療耗材', '包裝容器', '日用品', '工業零件', '光學零件', '玩具'] },
  identities: { label: '客戶身分', hint: '可複選', defaults: ['品牌廠', '代工廠(OEM/ODM)', '模具廠', '貿易商', '終端使用者'] },
  moldInjection: { label: '模具與射出', hint: '可複選', defaults: ['自有模具廠', '模具外包', '自行射出', '射出外包'] },
  markets: { label: '產品應用市場', hint: '可複選', defaults: ['家電', '汽車', '3C 電子', '醫療', '包裝', '建材', '工業設備', '消費品'] },
  employeeScales: { label: '員工規模', hint: '單選', defaults: ['未知', '50 人以下', '50–199 人', '200–499 人', '500 人以上'] },
  contactRoles: { label: '聯絡人角色', hint: '聯絡人在採購決策中的角色', defaults: ['決策者', '採購窗口', '技術評估', '使用單位', '影響者', '未確認'] },
  machineBrands: { label: '射出機廠牌', hint: '新增射出機時可直接點選', defaults: ['海天', '震雄', '住友', 'FANUC', '日精', '東芝', 'ENGEL', '阿博格', '全立發', '富強鑫'] },
  automationProcesses: { label: '已自動化製程', hint: '產線自動化程度的勾選項目', defaults: ['取件', '剪料頭/修邊', '檢測(含模內監視)', '秤重', '雷射標記', '搬運/供料', '組裝', '包裝/堆疊'] },
};

export function optionsOf(s: AppState, key: OptionKey | 'industries' | 'categories'): string[] {
  if (key === 'industries') return s.settings.industryOptions || OPTION_META.industries.defaults;
  if (key === 'categories') return s.settings.customerCategories || OPTION_META.categories.defaults;
  return s.settings.options?.[key] || OPTION_META[key].defaults;
}

export const AUTOMATION_LEVELS = ['傳統人工', '半自動化', '全自動化'] as const;

/** 七大資訊分類(哈鏌「拜訪摘要」) */
export const CATEGORIES: { key: CategoryKey; title: string; aspects: string; extra: string }[] = [
  { key: 'c1', title: '拜訪目的與結果', aspects: '拜訪目的、方式、成果、新取得資訊、未成果原因', extra: '' },
  { key: 'c2', title: '採購需求與進展', aspects: '產品/規格、數量、預算、時程、採購階段', extra: '使用情境、需求原因、採購條件' },
  { key: 'c3', title: '工廠現況與計畫', aspects: '射出機廠牌/噸數/數量、生產產品、擴廠/汰換', extra: '自動化現況、周邊設備、設備問題' },
  { key: 'c4', title: '接洽人與決策資訊', aspects: '姓名、職稱、部門、評估/採購/決策角色', extra: '對方案的態度、其他需參與的人' },
  { key: 'c5', title: '競品與市場資訊', aspects: '供應商、比較品牌、使用評價、市場消息', extra: '消息來源、涉及對象、發生時間' },
  { key: 'c6', title: '客戶考量與偏好', aspects: '價格、品質、交期、整合疑慮、服務期待', extra: '考量優先順序、具體接受條件' },
  { key: 'c7', title: '後續行動與待確認', aspects: '下一步、負責人、期限、待釐清內容', extra: '我方承諾、客戶承諾、預計回覆時間' },
];

export const INFO_STATUS_LABEL: Record<InfoStatus, string> = { explicit: '明確表示', possible: '可能', pending: '待確認' };
export const TARGET_LABEL: Record<UpdateTarget, string> = { company: '公司', factory: '工廠', contact: '聯絡人', preference: '偏好' };

/** 一般拜訪資訊的類型 */
export const GENERAL_NOTES = ['未遇窗口', '對方無暇訪談', '暫無新增資訊', '其他接洽情況'];

export const FIELD_LABEL: Record<ProfileField, string> = {
  principal: '公司負責人',
  phone: '公司電話',
  address: '地址',
  website: '網址',
  customerTypes: '客戶類型',
  industries: '所屬產業',
  products: '射出產品',
  markets: '產品應用市場',
  employeeScale: '員工規模',
  machine: '射出機',
  automationLevel: '產線自動化程度',
  automationProcess: '已自動化製程',
  contact: '聯絡人',
};

export function addressOf(c?: Customer): string {
  if (!c) return '';
  const a = c.addr;
  const joined = a ? [a.city, a.district, a.street].filter(Boolean).join('') : '';
  return joined || c.address || '';
}

export function machinesText(c?: Customer): string {
  const ms = c?.machines || [];
  return ms.map((m) => [m.brand, m.tonnage ? `${m.tonnage} 噸` : '', m.qty ? `${m.qty} 台` : ''].filter(Boolean).join(' ')).join('、');
}

export function machineCount(c?: Customer): number {
  return (c?.machines || []).reduce((n, m) => n + (m.qty || 0), 0);
}
