import React, { useState } from 'react';
import { View } from 'react-native';
import { Panel } from './admin';
import { Button, Chip, Field, Notice, Row, Segmented, Toggle, Txt } from './ui';
import { Sheet } from './Sheet';
import { C, SP, T } from '../theme';
import { setState, showToast, useAppState } from '../store/store';
import { customerById, visitById } from '../store/selectors';
import { updateSettings } from '../store/actions';
import { DEFAULT_SETTINGS } from '../store/seed';
import { REPORT_SCHEMA } from '../services/report';
import { copyText } from '../services/export';
import { fmtDateTime } from '../lib/util';
import type { IntegrationSettings, OutboxItem } from '../types';

const EVENT: Record<OutboxItem['event'], string> = { 'visit.confirmed': '業務入庫', 'visit.reviewed': '主管審閱', 'visit.manual': '手動拋送' };

// 對外串接(預留):設定目標平台與觸發時機;資料以標準 JSON(himore.visit-report/v1)排入佇列。
// POC 不實際送出,正式版由伺服器端依佇列呼叫 Webhook / API。
export function IntegrationPanel() {
  const s = useAppState();
  const cur: IntegrationSettings = { ...(DEFAULT_SETTINGS.integration as IntegrationSettings), ...s.settings.integration };
  const [f, setF] = useState(cur);
  const [view, setView] = useState<OutboxItem | null>(null);
  const outbox = s.outbox || [];
  const dirty = JSON.stringify(f) !== JSON.stringify(cur);

  return (
    <Panel title="對外串接(預留)" right={<Chip label={cur.enabled ? '已啟用' : '保留中'} tone={cur.enabled ? 'teal' : 'gray'} icon="sync" />}>
      <Txt size={T.small} color={C.text2} style={{ marginBottom: SP.md }}>
        拜訪報告會整理成固定格式的 JSON({REPORT_SCHEMA}),之後可自動拋送到 ERP、CRM、Teams/LINE 群組或其他平台。POC 先保留在佇列,不實際送出。
      </Txt>
      <Row style={{ justifyContent: 'space-between', marginBottom: SP.md }}>
        <Txt weight="600">啟用串接</Txt>
        <Toggle value={f.enabled} onChange={(v) => setF({ ...f, enabled: v })} />
      </Row>
      <Segmented
        value={f.kind}
        onChange={(v) => setF({ ...f, kind: v })}
        options={[
          { value: 'webhook', label: 'Webhook' },
          { value: 'api', label: 'API 對接' },
        ]}
        style={{ maxWidth: 320, marginBottom: SP.md }}
      />
      <Field label="目標平台名稱" value={f.name} onChangeText={(t) => setF({ ...f, name: t })} placeholder="例:ERP、CRM、Teams" />
      <Field label={f.kind === 'webhook' ? 'Webhook 網址' : 'API 端點'} value={f.url} onChangeText={(t) => setF({ ...f, url: t })} placeholder="https://…" autoCapitalize="none" />
      <Field label="驗證標頭(選填)" value={f.authHeader} onChangeText={(t) => setF({ ...f, authHeader: t })} placeholder="例:Authorization: Bearer …" autoCapitalize="none" />
      <Txt size={T.small} weight="600" color={C.text2} style={{ marginBottom: 6 }}>
        何時拋送
      </Txt>
      <Segmented
        value={f.trigger}
        onChange={(v) => setF({ ...f, trigger: v })}
        options={[
          { value: 'on_confirm', label: '業務入庫時' },
          { value: 'on_review', label: '主管審閱後' },
          { value: 'manual', label: '僅手動' },
        ]}
        style={{ marginBottom: SP.md }}
      />
      <Button
        title="儲存串接設定"
        small
        variant="secondary"
        disabled={!dirty}
        onPress={() => {
          updateSettings({ integration: f });
          showToast('已儲存串接設定', 'success');
        }}
      />
      <Notice tone="gray" icon="warn" text="POC 沒有伺服器,啟用後也只會排入佇列。正式版會由後端送出並記錄成功/失敗與重送。" />

      <Row style={{ justifyContent: 'space-between', marginTop: SP.md, marginBottom: SP.sm }}>
        <Txt weight="700">拋送佇列({outbox.length})</Txt>
        {outbox.length ? <Button title="清空" small full={false} variant="ghost" onPress={() => setState((st) => ({ ...st, outbox: [] }))} /> : null}
      </Row>
      {outbox.length === 0 ? (
        <Txt size={T.small} color={C.text3}>
          尚無資料。可在拜訪報告頁按「拋送」,或依上方觸發時機自動排入。
        </Txt>
      ) : (
        outbox.slice(0, 8).map((o) => {
          const v = visitById(s, o.visitId);
          return (
            <View key={o.id} style={{ paddingVertical: SP.sm, borderBottomWidth: 1, borderBottomColor: C.lineSoft }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt size={T.small} weight="600" style={{ flex: 1 }} numberOfLines={1}>
                  {v?.code} {customerById(s, v?.customerId)?.name || ''}
                </Txt>
                <Chip label={o.status === 'held' ? '保留' : o.status === 'sent' ? '已送出' : '失敗'} tone={o.status === 'sent' ? 'teal' : o.status === 'failed' ? 'red' : 'gray'} />
              </Row>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt size={T.tiny + 1} color={C.text3}>
                  {EVENT[o.event]}→{o.target}・{fmtDateTime(o.createdAt)}
                </Txt>
                <Button title="查看資料" small full={false} variant="ghost" onPress={() => setView(o)} />
              </Row>
            </View>
          );
        })
      )}

      <Sheet
        visible={!!view}
        onClose={() => setView(null)}
        title="拋送資料(JSON)"
        footer={
          <Button
            title="複製 JSON"
            onPress={async () => {
              if (view) await copyText(view.payload);
              showToast('已複製', 'success');
            }}
          />
        }
      >
        <Txt size={T.tiny + 1} color={C.text2} style={{ fontFamily: 'monospace' }}>
          {view?.payload.slice(0, 4000)}
        </Txt>
      </Sheet>
    </Panel>
  );
}
