import React from 'react';
import { router } from 'expo-router';
import { Header, Screen } from '../components/Screen';
import { Chip, EmptyState, ListRow, SectionTitle } from '../components/ui';
import { SP } from '../theme';
import { useAppState } from '../store/store';
import { currentUser, customerById, pendingConfirmVisits, processingVisits, requiredProgress } from '../store/selectors';
import { fmtDateTime } from '../lib/util';

// 待確認清單(由首頁進入):未確認的內容不會出現在客戶檔案與拜訪前簡報
export default function Pending() {
  const s = useAppState();
  const me = currentUser(s);
  if (!me) return null;
  const pending = pendingConfirmVisits(s, me.id);
  const proc = processingVisits(s, me.id);
  return (
    <Screen header={<Header title="待確認" />}>
      <SectionTitle title={`待確認(${pending.length})`} style={{ marginTop: SP.lg }} />
      {pending.length === 0 ? <EmptyState text="目前沒有待確認的紀錄" /> : null}
      {pending.map((v) => {
        const p = requiredProgress(v);
        return (
          <ListRow
            key={v.id}
            title={customerById(s, v.customerId)?.name || '未指定客戶'}
            sub={`${fmtDateTime(v.visitAt)}・${v.code}`}
            onPress={() => router.push(`/visit/${v.id}/confirm`)}
            right={p.total ? <Chip label={`必答 ${p.handled}/${p.total}`} tone={p.unhandled.length ? 'red' : 'teal'} /> : undefined}
          />
        );
      })}
      {proc.length ? (
        <>
          <SectionTitle title={`處理中(${proc.length})`} />
          {proc.map((v) => (
            <ListRow
              key={v.id}
              title={customerById(s, v.customerId)?.name || '未指定客戶'}
              sub={fmtDateTime(v.visitAt)}
              onPress={() => router.push(`/visit/${v.id}/processing`)}
              right={<Chip label={v.status === 'failed' ? '處理失敗' : '處理中'} tone={v.status === 'failed' ? 'red' : 'teal'} />}
            />
          ))}
        </>
      ) : null}
    </Screen>
  );
}
