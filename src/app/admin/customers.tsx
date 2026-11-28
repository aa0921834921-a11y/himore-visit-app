import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { AdminTable, PageTitle, Pager } from '../../components/admin';
import { Button, Chip, Row, SearchField, Txt } from '../../components/ui';
import { ContactRow, ContactSheet } from '../../components/ContactSheet';
import { CompanyForm } from '../../components/CompanyForm';
import { BusinessCardFlow } from '../../components/BusinessCard';
import { alertDialog } from '../../components/Dialog';
import { C, SP, T } from '../../theme';
import { useAppState } from '../../store/store';
import { customerById, customerVisitType, industriesOf, lastConfirmedVisit, userById } from '../../store/selectors';
import { addressOf, machinesText, optionsOf } from '../../store/options';
import { importCustomers } from '../../store/actions';
import { readPickedText, saveCsv } from '../../services/export';
import { fmtDate, parseCsv, toCsv } from '../../lib/util';
import type { Contact, Customer } from '../../types';

const PAGE = 10;

/** 匯入/匯出共用欄位(公司基本資料、分類與歸屬、聯絡人) */
const CSV_HEADER = ['公司名稱', '統編', '公司負責人', '公司電話', '縣市', '區域', '街道門號', '網址', '客戶狀態', '客戶類型', '所屬產業', '射出產品', '負責業務', '聯絡人', '職稱', '部門', '角色', '電話', 'E-MAIL', '備註'];
const split = (x: string) => x.split(/[、,,/;;|]/).map((y) => y.trim()).filter(Boolean);

// B1 客戶管理:公司基本資料、分類與歸屬、工廠資訊、自動化程度、聯絡人;拍名片建立;匯入/匯出 CSV
export default function AdminCustomers() {
  const s = useAppState();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('全部');
  const [page, setPage] = useState(1);
  const [editId, setEditId] = useState<string | 'new' | null>(null);
  const [contactEdit, setContactEdit] = useState<Contact | 'new' | null>(null);
  const [card, setCard] = useState(false);

  const categories = optionsOf(s, 'categories');
  const editing = editId && editId !== 'new' ? customerById(s, editId) : undefined;

  const list = useMemo(
    () =>
      s.customers
        .filter((c) => cat === '全部' || c.category === cat)
        .filter(
          (c) =>
            !q ||
            c.name.includes(q) ||
            c.code.includes(q) ||
            (c.taxId || '').includes(q) ||
            (c.phone || '').includes(q) ||
            c.contacts.some((x) => x.name.includes(q)) ||
            industriesOf(c).some((i) => i.includes(q)) ||
            (c.products || []).some((i) => i.includes(q)),
        ),
    [s.customers, q, cat],
  );
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const rows = list.slice((page - 1) * PAGE, page * PAGE);

  const doImport = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', 'text/plain'], copyToCacheDirectory: true });
    if (r.canceled || !r.assets?.[0]) return;
    try {
      const asset = r.assets[0] as DocumentPicker.DocumentPickerAsset & { file?: Blob };
      const text = await readPickedText(asset.uri, asset.file);
      const data = parseCsv(text);
      if (data.length < 2) {
        alertDialog('匯入失敗', '檔案沒有資料列。請先下載匯入範本。');
        return;
      }
      const header = data[0].map((h) => h.trim().replace(/^﻿/, ''));
      const col = (re: RegExp) => header.findIndex((h) => re.test(h));
      const ix = {
        name: col(/公司名稱|客戶名稱|^名稱$/),
        taxId: col(/統編|統一編號/),
        principal: col(/負責人/),
        phone: col(/公司電話/),
        city: col(/縣市/),
        district: col(/區域|鄉鎮/),
        street: col(/街道|門號|^地址$/),
        website: col(/網站|網址/),
        category: col(/客戶狀態|客戶分類/),
        types: col(/客戶類型/),
        industries: col(/產業/),
        products: col(/射出產品/),
        owner: col(/負責業務/),
        contact: col(/^聯絡人$|聯絡人姓名|^姓名$/),
        title: col(/職稱/),
        dept: col(/部門/),
        role: col(/角色/),
        cphone: header.findIndex((h, i) => /電話|手機/.test(h) && !/公司/.test(h) && i !== col(/公司電話/)),
        email: col(/mail/i),
        note: col(/備註|偏好/),
      };
      if (ix.name < 0) {
        alertDialog('匯入失敗', '找不到「公司名稱」欄位。請使用匯入範本。');
        return;
      }
      const g = (row: string[], i: number) => (i >= 0 ? (row[i] || '').trim() : '');
      const res = importCustomers(
        data.slice(1).map((row) => ({
          name: g(row, ix.name),
          taxId: g(row, ix.taxId),
          principal: g(row, ix.principal),
          phone: g(row, ix.phone),
          addr: { city: g(row, ix.city) || undefined, district: g(row, ix.district) || undefined, street: g(row, ix.street) || undefined },
          website: g(row, ix.website),
          category: g(row, ix.category),
          customerTypes: split(g(row, ix.types)),
          industries: split(g(row, ix.industries)),
          products: split(g(row, ix.products)),
          owner: g(row, ix.owner),
          contact: g(row, ix.contact)
            ? {
                name: g(row, ix.contact),
                title: g(row, ix.title) || undefined,
                department: g(row, ix.dept) || undefined,
                decisionRole: g(row, ix.role) || undefined,
                phone: g(row, ix.cphone) || undefined,
                email: g(row, ix.email) || undefined,
                note: g(row, ix.note) || undefined,
              }
            : undefined,
        })),
      );
      alertDialog('匯入完成', `新增客戶 ${res.added} 筆、聯絡人 ${res.contacts} 位,略過 ${res.skipped} 筆(空白或已存在的公司)。\n同一公司有多位聯絡人時,公司名稱重複填寫即可。負責業務需與帳號姓名相同,否則留空待指派。`);
    } catch {
      alertDialog('匯入失敗', '無法讀取檔案,請確認為 UTF-8 編碼的 CSV。');
    }
  };

  const doExport = () => {
    const out: string[][] = [];
    list.forEach((c) => {
      const base = [
        c.name,
        c.taxId || '',
        c.principal || '',
        c.phone || '',
        c.addr?.city || '',
        c.addr?.district || '',
        c.addr?.street || (c.addr ? '' : c.address || ''),
        c.website || '',
        c.category || '',
        (c.customerTypes || []).join('、'),
        industriesOf(c).join('、'),
        (c.products || []).join('、'),
        userById(s, c.ownerId)?.name || '',
      ];
      if (!c.contacts.length) out.push([...base, '', '', '', '', '', '', '']);
      c.contacts.forEach((ct) => out.push([...base, ct.name, ct.title || '', ct.department || '', ct.decisionRole || '', ct.phone || '', ct.email || '', ct.note || ct.preference || '']));
    });
    saveCsv('客戶資料.csv', toCsv([CSV_HEADER, ...out]));
  };

  return (
    <View>
      <PageTitle
        title="客戶管理"
        right={
          <>
            <Button title="+新增客戶" small full={false} onPress={() => setEditId('new')} />
            <Button title="拍名片建立" small full={false} variant="secondary" icon="photo" onPress={() => setCard(true)} />
            <Button title="匯入 CSV" small full={false} variant="secondary" icon="upload" onPress={doImport} />
            <Button title="匯出 CSV" small full={false} variant="secondary" icon="download" onPress={doExport} />
            <Button
              title="下載匯入範本"
              small
              full={false}
              variant="ghost"
              onPress={() =>
                saveCsv(
                  '客戶匯入範本.csv',
                  toCsv([
                    CSV_HEADER,
                    ['範例塑膠有限公司', '12345678', '王大同', '04-2350-0000', '台中市', '西屯區', '工業一路 1 號', 'https://example.com', '潛在客戶', '直接客戶', '塑膠射出成型、家電零件', '家電零件', '王大明', '陳志明', '採購經理', '採購部', '採購窗口', '0912-345-678', 'chen@example.com', '偏好 Email 聯繫'],
                    ['範例塑膠有限公司', '', '', '', '', '', '', '', '', '', '', '', '', '林廠長', '廠長', '製造部', '決策者', '', '', ''],
                  ]),
                )
              }
            />
          </>
        }
      />
      <Row style={{ flexWrap: 'wrap', marginBottom: SP.md }} gap={SP.md}>
        <SearchField
          value={q}
          onChangeText={(t) => {
            setQ(t);
            setPage(1);
          }}
          placeholder="搜尋名稱、編號、統編、電話、聯絡人、產業或產品"
          style={{ flex: 1, minWidth: 240, maxWidth: 460 }}
        />
      </Row>
      <Row style={{ flexWrap: 'wrap', marginBottom: SP.md }}>
        {['全部', ...categories].map((x) => (
          <Chip
            key={x}
            label={x}
            tone={cat === x ? 'orange' : 'gray'}
            onPress={() => {
              setCat(x);
              setPage(1);
            }}
            style={{ height: 30, paddingHorizontal: 12 }}
          />
        ))}
      </Row>
      <AdminTable
        rows={rows}
        keyOf={(r) => r.id}
        onRowPress={(r: Customer) => setEditId(r.id)}
        minWidth={900}
        cols={[
          { key: 'name', title: '公司名稱', render: (r) => r.name },
          { key: 'code', title: '客戶編號', width: 100, render: (r) => <Chip label={r.code} tone="yellow" /> },
          { key: 'cat', title: '狀態/類型', width: 130, render: (r) => [r.category, ...(r.customerTypes || [])].filter(Boolean).join('・') || '—' },
          { key: 'ind', title: '產業/射出產品', render: (r) => [...industriesOf(r), ...(r.products || [])].join('、') || '—' },
          { key: 'mc', title: '射出機', width: 150, render: (r) => machinesText(r) || '—' },
          { key: 'owner', title: '負責業務', width: 84, render: (r) => userById(s, r.ownerId)?.name || '未指派' },
          { key: 'ct', title: '聯絡人', width: 64, render: (r) => `${r.contacts.length} 位` },
          {
            key: 'type',
            title: '最近拜訪',
            width: 100,
            render: (r) => {
              const l = lastConfirmedVisit(s, r.id);
              return l ? fmtDate(l.visitAt) : <Chip label={customerVisitType(s, r.id)} tone="teal" />;
            },
          },
        ]}
      />
      <Txt size={T.small} color={C.text2} style={{ marginTop: SP.sm }}>
        共 {list.length} 筆。選項清單(客戶類型、所屬產業、射出產品等)在「系統設定 → 客戶資料選項」維護。
      </Txt>
      <Pager page={page} pages={pages} onChange={setPage} />

      <CompanyForm
        visible={!!editId && !contactEdit}
        customer={editing}
        canEditOwner
        onClose={() => setEditId(null)}
        onSaved={(c) => {
          if (editId === 'new') setTimeout(() => setEditId(c.id), 50); // 新增後留在編輯,接著加聯絡人
        }}
      >
        <Row style={{ justifyContent: 'space-between', marginTop: SP.md, marginBottom: SP.sm }}>
          <Txt weight="700" color={C.teal}>
            聯絡人({editing?.contacts.length || 0})
          </Txt>
          {editing ? <Button title="+新增聯絡人" small full={false} variant="secondary" onPress={() => setContactEdit('new')} /> : null}
        </Row>
        {!editing ? (
          <Txt size={T.small} color={C.text3}>
            先儲存公司資料,再新增聯絡人。
          </Txt>
        ) : editing.contacts.length === 0 ? (
          <Txt size={T.small} color={C.text3}>
            尚無聯絡人
          </Txt>
        ) : (
          editing.contacts.map((ct) => <ContactRow key={ct.id} ct={ct} onPress={() => setContactEdit(ct)} />)
        )}
        {editing ? (
          <>
            <Txt size={T.tiny + 1} color={C.text3} style={{ marginTop: SP.sm }}>
              地址:{addressOf(editing) || '—'}
            </Txt>
            <Button
              title="查看客戶檔案(五大頁籤)"
              variant="ghost"
              small
              onPress={() => {
                setEditId(null);
                router.push(`/customer/${editing.id}`);
              }}
            />
          </>
        ) : null}
      </CompanyForm>

      {editing ? <ContactSheet customerId={editing.id} visible={!!contactEdit} contact={contactEdit === 'new' ? null : contactEdit} onClose={() => setContactEdit(null)} /> : null}
      <BusinessCardFlow visible={card} canEditOwner onClose={() => setCard(false)} onDone={(c) => setTimeout(() => setEditId(c.id), 50)} />
    </View>
  );
}
