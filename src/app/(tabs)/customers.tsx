import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../components/Screen';
import { Chip, EmptyState, IconButton, ListRow, Row, SearchField, Segmented, Txt } from '../../components/ui';
import { QuickAddCustomer } from '../../components/Pickers';
import { C, SP, T } from '../../theme';
import { useAppState, useOnline } from '../../store/store';
import { avoidItems, currentUser, customerVisitType, lastConfirmedVisit } from '../../store/selectors';
import { fmtDate, fmtDateTime } from '../../lib/util';

// S13 客戶清單(文案 T-S13-01~T-S13-12):只列出自己負責的客戶
export default function Customers() {
  const s = useAppState();
  const online = useOnline();
  const me = currentUser(s);
  const [q, setQ] = useState('');
  const [mode, setMode] = useState<'mine' | 'recent'>('mine');
  const [adding, setAdding] = useState(false);

  const list = useMemo(() => {
    const mine = s.customers.filter((c) => c.ownerId === me?.id);
    const withLast = mine.map((c) => ({ c, last: lastConfirmedVisit(s, c.id) }));
    const filtered = withLast.filter(
      ({ c }) => !q || c.name.includes(q) || c.code.includes(q) || c.contacts.some((x) => x.name.includes(q)),
    );
    if (mode === 'recent') return filtered.filter((x) => x.last).sort((a, b) => (b.last?.visitAt || '').localeCompare(a.last?.visitAt || ''));
    return filtered.sort((a, b) => a.c.name.localeCompare(b.c.name, 'zh-Hant'));
  }, [s, me, q, mode]);

  return (
    <Screen bg="base" bottomInset={false}>
      <Row style={{ justifyContent: 'space-between', marginTop: SP.md, marginBottom: SP.md }}>
        <Txt size={T.h1} weight="700">
          客戶
        </Txt>
        <IconButton name="plus" label="快速新增客戶" color={C.teal} onPress={() => setAdding(true)} />
      </Row>
      <SearchField value={q} onChangeText={setQ} placeholder="搜尋公司名稱或聯絡人" style={{ marginBottom: SP.md }} />
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: 'mine', label: '我負責的' },
          { value: 'recent', label: '最近拜訪' },
        ]}
        style={{ marginBottom: SP.lg }}
      />

      {list.length === 0 ? (
        <EmptyState text="找不到符合的客戶,可改搜尋條件" />
      ) : (
        list.map(({ c, last }) => {
          const type = customerVisitType(s, c.id);
          const hasAvoid = avoidItems(s, c.id).length > 0;
          return (
            <ListRow
              key={c.id}
              title={c.name}
              sub={last ? `最近拜訪 ${fmtDate(last.visitAt)}` : '尚未拜訪'}
              onPress={() => router.push(`/customer/${c.id}`)}
              right={
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Chip label={type} tone={type === '初次' ? 'teal' : 'orange'} style={{ alignSelf: 'flex-end' }} />
                  {hasAvoid ? <Chip label="避免事項" tone="red" icon="dot" style={{ alignSelf: 'flex-end' }} /> : null}
                </View>
              }
            />
          );
        })
      )}

      <Txt size={T.tiny + 1} color={C.text3} center style={{ marginTop: SP.lg }}>
        {online ? `資料更新時間:${fmtDateTime(s.lastSyncAt)}` : `目前離線,顯示手機中的資料(更新時間 ${fmtDateTime(s.lastSyncAt)})`}
      </Txt>

      <QuickAddCustomer
        visible={adding}
        onClose={() => setAdding(false)}
        onAdded={(c) => {
          setAdding(false);
          router.push(`/customer/${c.id}`);
        }}
      />
    </Screen>
  );
}
