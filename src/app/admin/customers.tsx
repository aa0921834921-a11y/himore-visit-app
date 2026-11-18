import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { AdminTable, PageTitle, Pager } from '../../components/admin';
import { Button, Chip, Field, Row, SearchField, Txt } from '../../components/ui';
import { Sheet } from '../../components/Sheet';
import { alertDialog } from '../../components/Dialog';
import { C, SP, T } from '../../theme';
import { useAppState } from '../../store/store';
import { customerVisitType, lastConfirmedVisit, salesUsers, userById } from '../../store/selectors';
import { addCustomer, importCustomers, updateCustomer } from '../../store/actions';
import { readPickedText, saveCsv } from '../../services/export';
import { fmtDate, parseCsv, toCsv } from '../../lib/util';
import type { Customer } from '../../types';

const PAGE = 10;
const EMPTY = { name: '', code: '', ownerId: '', industry: '', mainEquipment: '', evaluatingSeries: '', mainProducts: '', contact: '', contactTitle: '' };

// B1 客戶管理(T-B1-04~T-B1-15):新增、匯入 CSV(公司名稱、聯絡人、負責業務)
export default function AdminCustomers() {
  const s = useAppState();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [edit, setEdit] = useState<Customer | 'new' | null>(null);
  const [form, setForm] = useState(EMPTY);

  const list = useMemo(() => s.customers.filter((c) => !q || c.name.includes(q) || c.code.includes(q)), [s.customers, q]);
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const rows = list.slice((page - 1) * PAGE, page * PAGE);

  const open = (c: Customer | 'new') => {
    setEdit(c);
    if (c === 'new') setForm({ ...EMPTY, ownerId: salesUsers(s)[0]?.id || '' });
    else
      setForm({
        name: c.name,
        code: c.code,
        ownerId: c.ownerId,
        industry: c.industry || '',
        mainEquipment: c.mainEquipment || '',
        evaluatingSeries: c.evaluatingSeries || '',
        mainProducts: c.mainProducts || '',
        contact: '',
        contactTitle: '',
      });
  };

  const save = () => {
    const base = {
      name: form.name.trim(),
      ownerId: form.ownerId,
      industry: form.industry.trim() || undefined,
      mainEquipment: form.mainEquipment.trim() || undefined,
      evaluatingSeries: form.evaluatingSeries.trim() || undefined,
      mainProducts: form.mainProducts.trim() || undefined,
    };
    if (edit === 'new') {
      addCustomer({ ...base, code: form.code.trim() || undefined, contacts: form.contact.trim() ? [{ id: `ct_${Date.now()}`, name: form.contact.trim(), title: form.contactTitle.trim() || undefined }] : [] });
    } else if (edit) {
      updateCustomer(edit.id, base);
    }
    setEdit(null);
  };

  const doImport = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', 'text/plain'], copyToCacheDirectory: true });
    if (r.canceled || !r.assets?.[0]) return;
    try {
      const asset = r.assets[0] as DocumentPicker.DocumentPickerAsset & { file?: Blob };
      const text = await readPickedText(asset.uri, asset.file);
      const rows = parseCsv(text);
      if (rows.length < 2) {
        alertDialog('匯入失敗', '檔案沒有資料列。請使用範本格式:公司名稱、聯絡人、負責業務。');
        return;
      }
      const header = rows[0].map((h) => h.trim());
      const iName = header.findIndex((h) => /公司名稱|客戶名稱|名稱/.test(h));
      const iContact = header.findIndex((h) => /聯絡人/.test(h));
      const iOwner = header.findIndex((h) => /負責業務|業務/.test(h));
      if (iName < 0) {
        alertDialog('匯入失敗', '找不到「公司名稱」欄位。請使用範本格式:公司名稱、聯絡人、負責業務。');
        return;
      }
      const res = importCustomers(rows.slice(1).map((r2) => ({ name: r2[iName] || '', contact: iContact >= 0 ? r2[iContact] : undefined, owner: iOwner >= 0 ? r2[iOwner] : undefined })));
      alertDialog('匯入完成', `新增 ${res.added} 筆,略過 ${res.skipped} 筆(空白或同名)。負責業務需與帳號姓名或帳號相同,否則留空待指派。`);
    } catch {
      alertDialog('匯入失敗', '無法讀取檔案,請確認為 UTF-8 編碼的 CSV。');
    }
  };

  return (
    <View>
      <PageTitle
        title="客戶管理"
        right={
          <>
            <Button title="+新增客戶" small full={false} onPress={() => open('new')} />
            <Button title="匯入 CSV" small full={false} variant="secondary" icon="upload" onPress={doImport} />
            <Button title="下載匯入範本" small full={false} variant="ghost" onPress={() => saveCsv('客戶匯入範本.csv', toCsv([['公司名稱', '聯絡人', '負責業務'], ['範例塑膠有限公司', '陳經理', '王大明']]))} />
          </>
        }
      />
      <SearchField
        value={q}
        onChangeText={(t) => {
          setQ(t);
          setPage(1);
        }}
        placeholder="搜尋客戶名稱或客戶編號"
        style={{ marginBottom: SP.md, maxWidth: 420 }}
      />
      <AdminTable
        rows={rows}
        keyOf={(r) => r.id}
        onRowPress={open}
        cols={[
          { key: 'name', title: '客戶名稱', render: (r) => r.name },
          { key: 'code', title: '客戶編號', width: 130, render: (r) => <Chip label={r.code} tone="yellow" /> },
          { key: 'owner', title: '負責業務', width: 110, render: (r) => userById(s, r.ownerId)?.name || '未指派' },
          { key: 'type', title: '拜訪類型', width: 100, render: (r) => { const t = customerVisitType(s, r.id); return <Chip label={t} tone={t === '初次' ? 'teal' : 'orange'} />; } },
          { key: 'last', title: '最近拜訪日', width: 130, render: (r) => { const l = lastConfirmedVisit(s, r.id); return l ? fmtDate(l.visitAt) : '—'; } },
        ]}
      />
      <Row style={{ justifyContent: 'space-between', marginTop: SP.sm }}>
        <Txt size={T.small} color={C.text2}>
          共 {list.length} 筆
        </Txt>
      </Row>
      <Pager page={page} pages={pages} onChange={setPage} />

      <Sheet
        visible={!!edit}
        onClose={() => setEdit(null)}
        title={edit === 'new' ? '新增客戶' : '編輯客戶'}
        footer={
          <>
            <Button title="儲存" disabled={!form.name.trim()} onPress={save} />
            {edit && edit !== 'new' ? (
              <Button
                title="查看客戶檔案"
                variant="secondary"
                onPress={() => {
                  const id = edit.id;
                  setEdit(null);
                  router.push(`/customer/${id}`);
                }}
              />
            ) : null}
          </>
        }
      >
        <Field label="客戶名稱" value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} placeholder="例:宏昇塑膠有限公司" />
        {edit === 'new' ? <Field label="客戶編號(可留空自動產生)" value={form.code} onChangeText={(t) => setForm({ ...form, code: t })} placeholder="例:C100900" /> : null}
        <Txt size={T.small} color={C.text2} weight="600" style={{ marginBottom: 6 }}>
          負責業務
        </Txt>
        <Row style={{ flexWrap: 'wrap', marginBottom: SP.md }}>
          {salesUsers(s).map((u) => (
            <Chip key={u.id} label={u.name} tone={form.ownerId === u.id ? 'orange' : 'gray'} onPress={() => setForm({ ...form, ownerId: u.id })} style={{ height: 32, paddingHorizontal: 12 }} />
          ))}
        </Row>
        <Field label="產業" value={form.industry} onChangeText={(t) => setForm({ ...form, industry: t })} placeholder="例:塑膠射出成型" />
        <Field label="主要設備" value={form.mainEquipment} onChangeText={(t) => setForm({ ...form, mainEquipment: t })} placeholder="例:350 噸射出機" />
        <Field label="評估系列" value={form.evaluatingSeries} onChangeText={(t) => setForm({ ...form, evaluatingSeries: t })} placeholder="例:GT 系列" />
        <Field label="主要產品" value={form.mainProducts} onChangeText={(t) => setForm({ ...form, mainProducts: t })} />
        {edit === 'new' ? (
          <Row gap={SP.md}>
            <View style={{ flex: 1 }}>
              <Field label="聯絡人" value={form.contact} onChangeText={(t) => setForm({ ...form, contact: t })} placeholder="例:張經理" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="職稱" value={form.contactTitle} onChangeText={(t) => setForm({ ...form, contactTitle: t })} placeholder="例:採購經理" />
            </View>
          </Row>
        ) : null}
      </Sheet>
    </View>
  );
}
