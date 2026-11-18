import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { AdminTable, PageTitle, Pager, Panel } from '../../components/admin';
import { Button, Checkbox, Chip, Field, Notice, Row, Segmented, Txt } from '../../components/ui';
import { CustomerPicker } from '../../components/Pickers';
import { C, SP, T } from '../../theme';
import { showToast, useAppState } from '../../store/store';
import { customerById, salesUsers, userById } from '../../store/selectors';
import { audit } from '../../store/actions';
import { buildVisitsCsv, saveCsv, VISIT_STATUS_LABEL } from '../../services/export';
import { fmtShortDate, ymd } from '../../lib/util';

const PAGE = 12;

// B4 拜訪紀錄與匯出(T-B4-04~T-B4-17):篩選業務、客戶、日期、狀態;下載 CSV;ERP 自動拋送待決定
export default function AdminVisits() {
  const s = useAppState();
  const now = new Date();
  const [sales, setSales] = useState<string>('all');
  const [customerId, setCustomerId] = useState<string | undefined>();
  const [from, setFrom] = useState(ymd(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
  const [status, setStatus] = useState<'all' | 'processing' | 'pending_confirm' | 'confirmed'>('all');
  const [restricted, setRestricted] = useState(false);
  const [pick, setPick] = useState(false);
  const [page, setPage] = useState(1);

  const list = useMemo(
    () =>
      s.visits
        .filter((v) => v.status !== 'draft')
        .filter((v) => sales === 'all' || v.salesId === sales)
        .filter((v) => !customerId || v.customerId === customerId)
        .filter((v) => {
          const d = ymd(new Date(v.visitAt));
          return (!from || d >= from) && (!to || d <= to);
        })
        .filter((v) => status === 'all' || (status === 'processing' ? v.status === 'processing' || v.status === 'failed' : v.status === status))
        .sort((a, b) => b.visitAt.localeCompare(a.visitAt)),
    [s.visits, sales, customerId, from, to, status],
  );
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const month = ymd().slice(0, 7);
  const monthCount = s.visits.filter((v) => v.status !== 'draft' && ymd(new Date(v.visitAt)).startsWith(month)).length;

  const download = async () => {
    const csv = buildVisitsCsv(s, list, restricted);
    await saveCsv(`拜訪紀錄_${from}_${to}.csv`, csv);
    audit('export', `下載 CSV ${list.length} 筆${restricted ? '(含限定)' : ''}`);
    showToast(`已匯出 ${list.length} 筆`, 'success');
  };

  return (
    <View>
      <PageTitle title="拜訪紀錄與匯出" right={<Button title="下載 CSV" small full={false} icon="download" disabled={!list.length} onPress={download} />} />
      <Panel>
        <Txt size={T.small} color={C.text2} weight="600" style={{ marginBottom: 6 }}>
          業務
        </Txt>
        <Row style={{ flexWrap: 'wrap', marginBottom: SP.md }}>
          <Chip label="全部業務" tone={sales === 'all' ? 'orange' : 'gray'} onPress={() => setSales('all')} style={{ height: 30, paddingHorizontal: 12 }} />
          {salesUsers(s).map((u) => (
            <Chip key={u.id} label={u.name} tone={sales === u.id ? 'orange' : 'gray'} onPress={() => setSales(u.id)} style={{ height: 30, paddingHorizontal: 12 }} />
          ))}
        </Row>
        <Row style={{ flexWrap: 'wrap', alignItems: 'flex-end' }} gap={SP.md}>
          <View style={{ minWidth: 200 }}>
            <Txt size={T.small} color={C.text2} weight="600" style={{ marginBottom: 6 }}>
              客戶
            </Txt>
            <Pressable onPress={() => setPick(true)} style={{ height: 46, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(145,167,173,0.75)', justifyContent: 'center', paddingHorizontal: 16, marginBottom: SP.md, backgroundColor: 'rgba(5,20,27,0.92)' }}>
              <Txt>{customerById(s, customerId)?.name || '全部客戶'}</Txt>
            </Pressable>
          </View>
          {customerId ? <Button title="清除" small full={false} variant="ghost" onPress={() => setCustomerId(undefined)} style={{ marginBottom: SP.md }} /> : null}
          <Field label="起日" value={from} onChangeText={setFrom} style={{ minWidth: 150 }} />
          <Field label="迄日" value={to} onChangeText={setTo} style={{ minWidth: 150 }} />
        </Row>
        <Segmented
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          options={[
            { value: 'all', label: '全部' },
            { value: 'processing', label: '處理中' },
            { value: 'pending_confirm', label: '待確認' },
            { value: 'confirmed', label: '已入庫' },
          ]}
          style={{ maxWidth: 480 }}
        />
      </Panel>

      <AdminTable
        rows={list.slice((page - 1) * PAGE, page * PAGE)}
        keyOf={(r) => r.id}
        onRowPress={(r) => router.push(`/visit/${r.id}`)}
        cols={[
          { key: 'code', title: '拜訪編號', width: 130, render: (r) => r.code },
          { key: 'c', title: '客戶', render: (r) => customerById(s, r.customerId)?.name || '未指定' },
          { key: 'u', title: '業務', width: 90, render: (r) => userById(s, r.salesId)?.name || '—' },
          { key: 'd', title: '日期', width: 80, render: (r) => fmtShortDate(r.visitAt) },
          { key: 's', title: '狀態', width: 110, render: (r) => <Chip label={VISIT_STATUS_LABEL[r.status]} tone={r.status === 'confirmed' ? 'teal' : r.status === 'failed' ? 'red' : 'yellow'} /> },
        ]}
      />
      <Txt size={T.small} color={C.text2} style={{ marginTop: SP.sm }}>
        篩選結果 {list.length} 筆・本月拜訪紀錄共 {monthCount} 筆
      </Txt>
      <Pager page={page} pages={pages} onChange={setPage} />

      <Panel style={{ marginTop: SP.lg }} title="CSV 匯出說明">
        <Txt size={T.small} color={C.text2} style={{ marginBottom: SP.sm }}>
          CSV 欄位:拜訪編號、客戶編號、業務、日期、拜訪類型、題目與回覆、摘要、待辦、確認時間(另附客戶名稱、輸入來源、狀態、偏好與避免事項)。檔案為 UTF-8,可直接用 Excel 開啟。
        </Txt>
        <Checkbox checked={restricted} onPress={() => setRestricted(!restricted)} label="包含「限定」敏感度的偏好與避免事項" sub="標為「限定」敏感度的偏好與避免事項,預設不匯出" />
        <Notice tone="gray" icon="sync" text="ERP 自動拋送(串接方式尚待決定)" />
      </Panel>

      <CustomerPicker
        visible={pick}
        selectedId={customerId}
        onClose={() => setPick(false)}
        onPick={(c) => {
          setCustomerId(c.id);
          setPick(false);
        }}
      />
    </View>
  );
}
