import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { AdminTable, PageTitle, Panel, useWide } from '../../components/admin';
import { Button, Checkbox, Chip, Field, Row, Toggle, Txt } from '../../components/ui';
import { confirmDialog } from '../../components/Dialog';
import { C, SP, T } from '../../theme';
import { resetDemoData, showToast, useAppState } from '../../store/store';
import { userById } from '../../store/selectors';
import { updateSettings } from '../../store/actions';
import { ai } from '../../services/ai';
import { fmtDateTime } from '../../lib/util';
import type { AuditType } from '../../types';

const AUDIT_LABEL: Record<AuditType, string> = {
  consent: '錄音同意',
  confirm: '確認入庫',
  export: '匯出',
  login: '登入',
  briefing_view: '查看簡報',
  import: '匯入',
};

// 系統設定:錄音保存天數、錄音同意文字版本、專有名詞詞庫、AI 服務條款、試用帳號上限;稽核紀錄
export default function AdminSettings() {
  const s = useAppState();
  const wide = useWide();
  const st = s.settings;
  const [days, setDays] = useState(String(st.retentionDays));
  const [cap, setCap] = useState(String(st.trialAccountCap));
  const [consent, setConsent] = useState(st.consentText);
  const [term, setTerm] = useState('');
  const [filter, setFilter] = useState<AuditType | 'core'>('core');

  const audit = s.audit.filter((a) => (filter === 'core' ? a.type === 'consent' || a.type === 'confirm' || a.type === 'export' : a.type === filter)).slice(0, 100);

  const saveConsent = () => {
    if (consent.trim() === st.consentText) return;
    const n = Number(st.consentVersion.replace(/\D/g, '')) || 1;
    updateSettings({ consentText: consent.trim(), consentVersion: `v${n + 1}` });
    showToast(`錄音同意聲明已更新為 v${n + 1}`, 'success');
  };

  const col = (children: React.ReactNode) => <View style={wide ? { flex: 1 } : undefined}>{children}</View>;

  return (
    <View>
      <PageTitle title="系統設定" />
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: SP.lg }}>
        {col(
          <>
            <Panel title="錄音">
              <Field label="錄音保存天數" value={days} onChangeText={setDays} keyboardType="number-pad" hint="已入庫的錄音超過天數後自動刪除(由哈鏌決定)" />
              <Button
                title="儲存天數"
                small
                variant="secondary"
                disabled={!Number(days) || Number(days) === st.retentionDays}
                onPress={() => {
                  updateSettings({ retentionDays: Math.max(1, Math.round(Number(days))) });
                  showToast('已更新保存天數', 'success');
                }}
              />
              <View style={{ height: SP.lg }} />
              <Row style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                <Txt size={T.small} color={C.text2} weight="600">
                  錄音同意聲明
                </Txt>
                <Chip label={`目前版本 ${st.consentVersion}`} tone="gray" />
              </Row>
              <Field value={consent} onChangeText={setConsent} multiline hint="修改後版本號自動加一;同意紀錄會保存當時的版本與文字。內容需先經哈鏌法務確認。" />
              <Button title="儲存並更新版本" small variant="secondary" disabled={!consent.trim() || consent.trim() === st.consentText} onPress={saveConsent} />
            </Panel>
            <Panel title="專有名詞詞庫">
              <Txt size={T.small} color={C.text2} style={{ marginBottom: SP.sm }}>
                供 AI 轉文字與整理時參考(例:GT、AT、ST 系列名稱)
              </Txt>
              <Row style={{ flexWrap: 'wrap', marginBottom: SP.md }}>
                {st.glossary.map((g) => (
                  <Chip key={g} label={`${g} ✕`} tone="teal" onPress={() => updateSettings({ glossary: st.glossary.filter((x) => x !== g) })} />
                ))}
              </Row>
              <Row gap={SP.sm}>
                <View style={{ flex: 1 }}>
                  <Field value={term} onChangeText={setTerm} placeholder="新增名詞" style={{ marginBottom: 0 }} />
                </View>
                <Button
                  title="加入"
                  small
                  full={false}
                  disabled={!term.trim() || st.glossary.includes(term.trim())}
                  onPress={() => {
                    updateSettings({ glossary: [...st.glossary, term.trim()] });
                    setTerm('');
                  }}
                />
              </Row>
            </Panel>
          </>,
        )}
        {col(
          <>
            <Panel title="AI 服務與帳號">
              <Txt size={T.small} color={C.text2}>
                目前使用:{ai.name}
              </Txt>
              <Txt size={T.tiny + 1} color={C.text3} style={{ marginBottom: SP.sm }}>
                正式導入時改接哈鏌選定的 AI 服務(語音轉文字+整理)。
              </Txt>
              <Checkbox checked={st.aiTermsConfirmed} onPress={() => updateSettings({ aiTermsConfirmed: !st.aiTermsConfirmed })} label="已確認 AI 服務的資料使用條款允許處理客戶拜訪內容" />
              <Field label="試用帳號上限" value={cap} onChangeText={setCap} keyboardType="number-pad" style={{ marginTop: SP.md }} />
              <Button
                title="儲存上限"
                small
                variant="secondary"
                disabled={!Number(cap) || Number(cap) === st.trialAccountCap}
                onPress={() => {
                  updateSettings({ trialAccountCap: Math.max(1, Math.round(Number(cap))) });
                  showToast('已更新帳號上限', 'success');
                }}
              />
            </Panel>
            <Panel title="示範與測試">
              <Row style={{ justifyContent: 'space-between', marginBottom: SP.md }}>
                <View style={{ flex: 1 }}>
                  <Txt>示範模式</Txt>
                  <Txt size={T.small} color={C.text3}>
                    登入頁顯示示範帳號、文字輸入顯示「填入示範內容」
                  </Txt>
                </View>
                <Toggle value={st.demoMode} onChange={(v) => updateSettings({ demoMode: v })} />
              </Row>
              <Row style={{ justifyContent: 'space-between', marginBottom: SP.md }}>
                <View style={{ flex: 1 }}>
                  <Txt>模擬下一筆處理失敗</Txt>
                  <Txt size={T.small} color={C.text3}>
                    用來測試「處理失敗,請重試」的流程
                  </Txt>
                </View>
                <Toggle value={st.simulateFailureNext} onChange={(v) => updateSettings({ simulateFailureNext: v })} />
              </Row>
              <Button
                title="重設為示範資料"
                variant="danger"
                small
                onPress={async () => {
                  if (await confirmDialog({ title: '重設所有資料?', message: '這台裝置上的客戶、拜訪紀錄、題庫與帳號都會回到示範狀態,無法復原。', ok: '重設', danger: true })) {
                    await resetDemoData();
                    router.replace('/login');
                  }
                }}
              />
            </Panel>
          </>,
        )}
      </View>

      <Panel title="稽核紀錄">
        <Row style={{ flexWrap: 'wrap', marginBottom: SP.md }}>
          <Chip label="錄音同意+確認入庫+匯出" tone={filter === 'core' ? 'orange' : 'gray'} onPress={() => setFilter('core')} style={{ height: 30, paddingHorizontal: 12 }} />
          {(Object.keys(AUDIT_LABEL) as AuditType[]).map((k) => (
            <Chip key={k} label={AUDIT_LABEL[k]} tone={filter === k ? 'orange' : 'gray'} onPress={() => setFilter(k)} style={{ height: 30, paddingHorizontal: 12 }} />
          ))}
        </Row>
        <AdminTable
          rows={audit}
          keyOf={(r) => r.id}
          empty="尚無紀錄"
          cols={[
            { key: 't', title: '時間', width: 150, render: (r) => fmtDateTime(r.at) },
            { key: 'u', title: '人員', width: 90, render: (r) => userById(s, r.userId)?.name || '系統' },
            { key: 'k', title: '類型', width: 100, render: (r) => <Chip label={AUDIT_LABEL[r.type]} tone={r.type === 'consent' ? 'teal' : r.type === 'confirm' ? 'orange' : 'gray'} /> },
            { key: 'd', title: '內容', render: (r) => r.detail },
          ]}
        />
      </Panel>
    </View>
  );
}
