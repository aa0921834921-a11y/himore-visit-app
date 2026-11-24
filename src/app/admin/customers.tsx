import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { AdminTable, PageTitle, Pager } from '../../components/admin';
import { Button, Chip, Field, Row, SearchField, Txt } from '../../components/ui';
import { Sheet } from '../../components/Sheet';
import { ContactRow, ContactSheet } from '../../components/ContactSheet';
import { alertDialog } from '../../components/Dialog';
import { C, SP, T } from '../../theme';
import { useAppState } from '../../store/store';
import { customerById, customerVisitType, DECISION_ROLES, industriesOf, lastConfirmedVisit, salesUsers, userById } from '../../store/selectors';
import { addCustomer, importCustomers, updateCustomer } from '../../store/actions';
import { DEFAULT_SETTINGS } from '../../store/seed';
import { readPickedText, saveCsv } from '../../services/export';
import { fmtDate, parseCsv, toCsv } from '../../lib/util';
import type { Contact, Customer, DecisionRole } from '../../types';

const PAGE = 10;
const EMPTY = { name: '', code: '', taxId: '', address: '', website: '', category: '', ownerId: '', industries: [] as string[], mainEquipment: '', evaluatingSeries: '', mainProducts: '' };

/** 匯入/匯出共用欄位(依哈鏌資料分類 1-1、1-2、1-3) */
const CSV_HEADER = ['公司名稱', '統編', '地址', '網站', '客戶分類', '負責業務', '產業別', '聯絡人', '職稱', '部門', '電話', 'E-MAIL', '決策角色', '聯絡人偏好'];

// B1 客戶管理:1-1 公司基本資料、1-2 聯絡人資料、1-3 產業別(複選);匯入/匯出 CSV
export default function AdminCustomers() {
  const s = useAppState();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('全部');
  const [page, setPage] = useState(1);
  const [editId, setEditId] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [newInd, setNewInd] = useState('');
  const [contactEdit, setContactEdit] = useState<Contact | 'new' | null>(null);

  const categories = s.settings.customerCategories || DEFAULT_SETTINGS.customerCategories || [];
  const indOptions = s.settings.industryOptions || DEFAULT_SETTINGS.industryOptions || [];
  const editing = editId && editId !== 'new' ? customerById(s, editId) : undefined;

  const list = useMemo(
    () =>
      s.customers
        .filter((c) => cat === '全部' || c.category === cat)
        .filter((c) => !q || c.name.includes(q) || c.code.includes(q) || (c.taxId || '').includes(q) || c.contacts.some((x) => x.name.includes(q)) || industriesOf(c).some((i) => i.includes(q))),
    [s.customers, q, cat],
  );
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const rows = list.slice((page - 1) * PAGE, page * PAGE);

  const open = (c: Customer | 'new') => {
    setEditId(c === 'new' ? 'new' : c.id);
    setNewInd('');
    if (c === 'new') setForm({ ...EMPTY, ownerId: salesUsers(s)[0]?.id || '' });
    else
      setForm({
        name: c.name,
        code: c.code,
        taxId: c.taxId || '',
        address: c.address || '',
        website: c.website || '',
        category: c.category || '',
        ownerId: c.ownerId,
        industries: industriesOf(c),
        mainEquipment: c.mainEquipment || '',
        evaluatingSeries: c.evaluatingSeries || '',
        mainProducts: c.mainProducts || '',
      });
  };

  const taxBad = !!form.taxId.trim() && !/^\d{8}$/.test(form.taxId.trim());

  const save = () => {
    const base: Partial<Customer> & { name: string } = {
      name: form.name.trim(),
      taxId: form.taxId.trim() || undefined,
      address: form.address.trim() || undefined,
      website: form.website.trim() || undefined,
      category: form.category || undefined,
      ownerId: form.ownerId,
      industries: form.industries.length ? form.industries : undefined,
      industry: undefined,
      mainEquipment: form.mainEquipment.trim() || undefined,
      evaluatingSeries: form.evaluatingSeries.trim() || undefined,
      mainProducts: form.mainProducts.trim() || undefined,
    };
    if (editId === 'new') {
      const c = addCustomer({ ...base, code: form.code.trim() || undefined, contacts: [] });
      setEditId(c.id); // 留在編輯畫面,接著新增聯絡人
      alertDialog('已新增客戶', '可以接著在下方新增聯絡人。');
    } else if (editId) {
      updateCustomer(editId, base);
      setEditId(null);
    }
  };

  const toggleInd = (i: string) => setForm({ ...form, industries: form.industries.includes(i) ? form.industries.filter((x) => x !== i) : [...form.industries, i] });

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
        address: col(/地址/),
        website: col(/網站|網址/),
        category: col(/客戶分類|分類/),
        owner: col(/負責業務/),
        industries: col(/產業/),
        contact: col(/^聯絡人$|聯絡人姓名|姓名/),
        title: col(/職稱/),
        dept: col(/部門/),
        phone: col(/電話/),
        email: col(/mail/i),
        role: col(/決策角色/),
        pref: col(/偏好/),
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
          address: g(row, ix.address),
          website: g(row, ix.website),
          category: g(row, ix.category),
          owner: g(row, ix.owner),
          industries: g(row, ix.industries).split(/[、,,/;;|]/).map((x) => x.trim()).filter(Boolean),
          contact: g(row, ix.contact)
            ? {
                name: g(row, ix.contact),
                title: g(row, ix.title) || undefined,
                department: g(row, ix.dept) || undefined,
                phone: g(row, ix.phone) || undefined,
                email: g(row, ix.email) || undefined,
                decisionRole: (DECISION_ROLES as readonly string[]).includes(g(row, ix.role)) ? (g(row, ix.role) as DecisionRole) : undefined,
                preference: g(row, ix.pref) || undefined,
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
      const base = [c.name, c.taxId || '', c.address || '', c.website || '', c.category || '', userById(s, c.ownerId)?.name || '', industriesOf(c).join('、')];
      if (!c.contacts.length) out.push([...base, '', '', '', '', '', '', '']);
      c.contacts.forEach((ct) => out.push([...base, ct.name, ct.title || '', ct.department || '', ct.phone || '', ct.email || '', ct.decisionRole || '', ct.preference || '']));
    });
    saveCsv('客戶資料.csv', toCsv([CSV_HEADER, ...out]));
  };

  return (
    <View>
      <PageTitle
        title="客戶管理"
        right={
          <>
            <Button title="+新增客戶" small full={false} onPress={() => open('new')} />
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
                    ['範例塑膠有限公司', '12345678', '台中市西屯區工業區一路 1 號', 'https://example.com', '潛在客戶', '王大明', '塑膠射出成型、家電零件', '陳志明', '採購經理', '採購部', '04-2350-0000', 'chen@example.com', '採購窗口', '偏好 Email 聯繫'],
                    ['範例塑膠有限公司', '', '', '', '', '', '', '林廠長', '廠長', '製造部', '', '', '決策者', ''],
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
          placeholder="搜尋名稱、編號、統編、聯絡人或產業"
          style={{ flex: 1, minWidth: 240, maxWidth: 420 }}
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
        onRowPress={open}
        minWidth={820}
        cols={[
          { key: 'name', title: '公司名稱', render: (r) => r.name },
          { key: 'code', title: '客戶編號', width: 110, render: (r) => <Chip label={r.code} tone="yellow" /> },
          { key: 'tax', title: '統編', width: 100, render: (r) => r.taxId || '—' },
          { key: 'cat', title: '分類', width: 100, render: (r) => (r.category ? <Chip label={r.category} tone="teal" /> : '—') },
          { key: 'ind', title: '產業別', render: (r) => industriesOf(r).join('、') || '—' },
          { key: 'owner', title: '負責業務', width: 90, render: (r) => userById(s, r.ownerId)?.name || '未指派' },
          { key: 'ct', title: '聯絡人', width: 70, render: (r) => `${r.contacts.length} 位` },
          {
            key: 'type',
            title: '拜訪',
            width: 110,
            render: (r) => {
              const l = lastConfirmedVisit(s, r.id);
              const t = customerVisitType(s, r.id);
              return l ? fmtDate(l.visitAt) : <Chip label={t} tone="teal" />;
            },
          },
        ]}
      />
      <Txt size={T.small} color={C.text2} style={{ marginTop: SP.sm }}>
        共 {list.length} 筆
      </Txt>
      <Pager page={page} pages={pages} onChange={setPage} />

      <Sheet
        visible={!!editId && !contactEdit}
        onClose={() => setEditId(null)}
        title={editId === 'new' ? '新增客戶' : '編輯客戶'}
        footer={
          <>
            <Button title="儲存" disabled={!form.name.trim() || taxBad} onPress={save} />
            {editing ? (
              <Button
                title="查看客戶檔案"
                variant="secondary"
                onPress={() => {
                  setEditId(null);
                  router.push(`/customer/${editing.id}`);
                }}
              />
            ) : null}
          </>
        }
      >
        <Txt weight="700" color={C.teal} style={{ marginBottom: SP.sm }}>
          公司基本資料
        </Txt>
        <Field label="公司名稱" value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} placeholder="例:宏昇塑膠有限公司" />
        <Row gap={SP.md}>
          <View style={{ flex: 1 }}>
            <Field label="統一編號" value={form.taxId} onChangeText={(t) => setForm({ ...form, taxId: t.replace(/\D/g, '').slice(0, 8) })} keyboardType="number-pad" placeholder="8 碼數字" error={taxBad ? '統編為 8 碼數字' : undefined} />
          </View>
          <View style={{ flex: 1 }}>
            {editId === 'new' ? (
              <Field label="客戶編號(可留空)" value={form.code} onChangeText={(t) => setForm({ ...form, code: t })} placeholder="自動產生" />
            ) : (
              <Field label="客戶編號" value={form.code} editable={false} />
            )}
          </View>
        </Row>
        <Field label="地址" value={form.address} onChangeText={(t) => setForm({ ...form, address: t })} placeholder="例:台中市西屯區工業區三十六路 12 號" />
        <Field label="網站" value={form.website} onChangeText={(t) => setForm({ ...form, website: t })} autoCapitalize="none" keyboardType="url" placeholder="https://" />
        <Txt size={T.small} color={C.text2} weight="600" style={{ marginBottom: 6 }}>
          客戶分類
        </Txt>
        <Row style={{ flexWrap: 'wrap', marginBottom: SP.md }}>
          {categories.map((x) => (
            <Chip key={x} label={x} tone={form.category === x ? 'orange' : 'gray'} onPress={() => setForm({ ...form, category: form.category === x ? '' : x })} style={{ height: 32, paddingHorizontal: 12 }} />
          ))}
        </Row>
        <Txt size={T.small} color={C.text2} weight="600" style={{ marginBottom: 6 }}>
          負責業務
        </Txt>
        <Row style={{ flexWrap: 'wrap', marginBottom: SP.md }}>
          {salesUsers(s).map((u) => (
            <Chip key={u.id} label={u.name} tone={form.ownerId === u.id ? 'orange' : 'gray'} onPress={() => setForm({ ...form, ownerId: u.id })} style={{ height: 32, paddingHorizontal: 12 }} />
          ))}
        </Row>

        <Txt weight="700" color={C.teal} style={{ marginTop: SP.sm, marginBottom: SP.sm }}>
          產業別(可複選)
        </Txt>
        <Row style={{ flexWrap: 'wrap', marginBottom: SP.sm }}>
          {Array.from(new Set([...indOptions, ...form.industries])).map((x) => (
            <Chip key={x} label={form.industries.includes(x) ? `✓ ${x}` : x} tone={form.industries.includes(x) ? 'orange' : 'gray'} onPress={() => toggleInd(x)} style={{ height: 32, paddingHorizontal: 12 }} />
          ))}
        </Row>
        <Row style={{ marginBottom: SP.md }}>
          <View style={{ flex: 1 }}>
            <Field value={newInd} onChangeText={setNewInd} placeholder="其他產業(只加到這個客戶)" style={{ marginBottom: 0 }} />
          </View>
          <Button
            title="加入"
            small
            full={false}
            variant="secondary"
            disabled={!newInd.trim()}
            onPress={() => {
              if (!form.industries.includes(newInd.trim())) setForm({ ...form, industries: [...form.industries, newInd.trim()] });
              setNewInd('');
            }}
          />
        </Row>

        <Txt weight="700" color={C.teal} style={{ marginTop: SP.sm, marginBottom: SP.sm }}>
          設備與產品
        </Txt>
        <Field label="主要設備" value={form.mainEquipment} onChangeText={(t) => setForm({ ...form, mainEquipment: t })} placeholder="例:350 噸射出機" />
        <Field label="評估系列" value={form.evaluatingSeries} onChangeText={(t) => setForm({ ...form, evaluatingSeries: t })} placeholder="例:GT 系列" />
        <Field label="主要產品" value={form.mainProducts} onChangeText={(t) => setForm({ ...form, mainProducts: t })} />

        <Row style={{ justifyContent: 'space-between', marginTop: SP.sm, marginBottom: SP.sm }}>
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
      </Sheet>

      {editing ? <ContactSheet customerId={editing.id} visible={!!contactEdit} contact={contactEdit === 'new' ? null : contactEdit} onClose={() => setContactEdit(null)} /> : null}
    </View>
  );
}
