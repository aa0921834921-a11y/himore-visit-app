import { remoteReadCard, serverConfig, type CardResult } from './ai/remote';
import { getState } from '../store/store';
import type { Customer } from '../types';

// 名片拍照建立客戶:有 AI 伺服器時用視覺模型辨識;沒有時回傳示範結果,讓流程可以完整試用。

export interface CardPrefill {
  demo: boolean;
  customer: Partial<Customer> & { name: string };
  contact?: { name: string; title?: string; department?: string; phone?: string; email?: string };
  raw?: string;
  duplicates: Customer[];
}

const DEMO: CardResult = {
  company_name: '晟豐精密塑膠股份有限公司',
  company_phone: '03-4567-1234',
  city: '桃園市',
  district: '中壢區',
  street: '民族路六段 216 號',
  website: 'www.chengfeng.example',
  contact_name: '何建宏',
  title: '生產部經理',
  department: '生產部',
  mobile: '0933-123-456',
  email: 'jhho@chengfeng.example',
};

const norm = (x?: string) => (x || '').replace(/(股份)?有限公司|企業社|工業社|\s|\(|\)|(|)/g, '').trim();

export async function readBusinessCard(uri: string, name: string, mime: string, onProgress?: (m: string) => void): Promise<CardPrefill> {
  let r: CardResult;
  let demo = false;
  if (serverConfig()) r = await remoteReadCard(uri, name, mime, onProgress);
  else {
    onProgress?.('示範模式:沒有設定 AI 伺服器,使用示範名片資料');
    await new Promise((res) => setTimeout(res, 1200));
    r = DEMO;
    demo = true;
  }
  const s = getState();
  const company = (r.company_name || '').trim();
  const phone = (r.company_phone || '').trim();
  const duplicates = s.customers.filter(
    (c) => (company && norm(c.name) && norm(c.name) === norm(company)) || (r.tax_id && c.taxId === r.tax_id) || (phone && c.phone && c.phone.replace(/\D/g, '') === phone.replace(/\D/g, '')),
  );
  const contact = r.contact_name?.trim()
    ? { name: r.contact_name.trim(), title: r.title?.trim() || undefined, department: r.department?.trim() || undefined, phone: (r.mobile || '').trim() || undefined, email: r.email?.trim() || undefined }
    : undefined;
  return {
    demo,
    raw: r.raw_text,
    duplicates,
    contact,
    customer: {
      name: company,
      taxId: /^\d{8}$/.test(r.tax_id || '') ? r.tax_id : undefined,
      phone: phone || undefined,
      addr: r.city || r.district || r.street ? { city: r.city || undefined, district: r.district || undefined, street: r.street || undefined } : undefined,
      website: r.website?.trim() ? (/^https?:\/\//.test(r.website) ? r.website.trim() : `https://${r.website.trim()}`) : undefined,
      category: '潛在客戶',
      ownerId: s.sessionUserId,
      contacts: contact ? [{ id: '', ...contact }] : [],
    },
  };
}
