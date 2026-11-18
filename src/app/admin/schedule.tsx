import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AdminTable, PageTitle, Pager, Panel } from '../../components/admin';
import { Button, Chip, Field, IconButton, Row, SearchField, Segmented, Txt } from '../../components/ui';
import { Sheet } from '../../components/Sheet';
import { CustomerPicker } from '../../components/Pickers';
import { confirmDialog } from '../../components/Dialog';
import { C, R, SP, T } from '../../theme';
import { useAppState } from '../../store/store';
import { customerById, customerVisitType, salesUsers, setById, userById } from '../../store/selectors';
import { deleteSchedule, upsertSchedule } from '../../store/actions';
import { addDays, fmtDate, parseYmd, weekday, ymd } from '../../lib/util';
import type { Schedule, VisitType } from '../../types';

const PAGE = 12;

// B3 拜訪安排(T-B3-04~T-B3-15):管理者安排日期、業務、客戶、拜訪類型、題組與備註
export default function AdminSchedule() {
  const s = useAppState();
  const [view, setView] = useState<'list' | 'cal'>('list');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Schedule | 'new' | null>(null);
  const [pickCustomer, setPickCustomer] = useState(false);
  const [f, setF] = useState({ date: ymd(), time: '10:00', salesId: '', customerId: '', visitType: '初次' as VisitType, questionSetId: '', note: '' });
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    return addDays(d, -((d.getDay() + 6) % 7));
  });

  const list = useMemo(
    () =>
      [...s.schedules]
        .filter((x) => {
          if (!q) return true;
          const c = customerById(s, x.customerId)?.name || '';
          const u = userById(s, x.salesId)?.name || '';
          return c.includes(q) || u.includes(q) || x.date.includes(q) || fmtDate(x.date).includes(q);
        })
        .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)),
    [s, q],
  );
  const month = ymd().slice(0, 7);
  const pages = Math.max(1, Math.ceil(list.length / PAGE));

  const openForm = (x: Schedule | 'new') => {
    setOpen(x);
    if (x === 'new') setF({ date: ymd(), time: '10:00', salesId: salesUsers(s)[0]?.id || '', customerId: '', visitType: '初次', questionSetId: s.questionSets[0]?.id || '', note: '' });
    else setF({ date: x.date, time: x.time, salesId: x.salesId, customerId: x.customerId, visitType: x.visitType, questionSetId: x.questionSetId, note: x.note || '' });
  };

  const valid = /^\d{4}-\d{2}-\d{2}$/.test(f.date) && /^\d{1,2}:\d{2}$/.test(f.time) && f.salesId && f.customerId && f.questionSetId;

  const days = Array.from({ length: 7 }, (_, i) => ymd(addDays(weekStart, i)));

  return (
    <View>
      <PageTitle title="拜訪安排" right={<Button title="+安排拜訪" small full={false} onPress={() => openForm('new')} />} />
      <Row style={{ marginBottom: SP.md, flexWrap: 'wrap' }} gap={SP.md}>
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'list', label: '行程列表' },
            { value: 'cal', label: '行事曆' },
          ]}
          style={{ width: 240 }}
        />
        {view === 'list' ? (
          <SearchField
            value={q}
            onChangeText={(t) => {
              setQ(t);
              setPage(1);
            }}
            placeholder="搜尋客戶、業務或日期"
            style={{ flex: 1, minWidth: 220, maxWidth: 420 }}
          />
        ) : null}
      </Row>

      {view === 'list' ? (
        <>
          <AdminTable
            rows={list.slice((page - 1) * PAGE, page * PAGE)}
            keyOf={(r) => r.id}
            onRowPress={(r) => openForm(r)}
            minWidth={760}
            cols={[
              { key: 'd', title: '日期', width: 150, render: (r) => `${fmtDate(r.date)}(${weekday(r.date)})${r.time}` },
              { key: 'u', title: '業務', width: 90, render: (r) => userById(s, r.salesId)?.name || '—' },
              { key: 'c', title: '客戶', render: (r) => customerById(s, r.customerId)?.name || '—' },
              { key: 't', title: '拜訪類型', width: 90, render: (r) => <Chip label={r.visitType} tone={r.visitType === '初次' ? 'teal' : 'orange'} /> },
              { key: 'q', title: '題組', render: (r) => setById(s, r.questionSetId)?.name || '—' },
              { key: 'n', title: '備註', render: (r) => r.note || '—' },
              {
                key: 'x',
                title: '',
                width: 50,
                render: (r) => (
                  <IconButton
                    name="trash"
                    size={16}
                    color={C.text3}
                    label="刪除"
                    disabled={!!r.visitId}
                    onPress={async () => {
                      if (await confirmDialog({ title: '刪除這筆安排?', ok: '刪除', danger: true })) deleteSchedule(r.id);
                    }}
                  />
                ),
              },
            ]}
          />
          <Txt size={T.small} color={C.text2} style={{ marginTop: SP.sm }}>
            本月共安排 {s.schedules.filter((x) => x.date.startsWith(month)).length} 筆
          </Txt>
          <Pager page={page} pages={pages} onChange={setPage} />
        </>
      ) : (
        <Panel>
          <Row style={{ justifyContent: 'space-between', marginBottom: SP.md }}>
            <Button title="‹ 上週" small full={false} variant="ghost" onPress={() => setWeekStart(addDays(weekStart, -7))} />
            <Txt weight="700">
              {fmtDate(days[0])} – {fmtDate(days[6])}
            </Txt>
            <Button title="下週 ›" small full={false} variant="ghost" onPress={() => setWeekStart(addDays(weekStart, 7))} />
          </Row>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm }}>
            {days.map((d) => {
              const items = s.schedules.filter((x) => x.date === d).sort((a, b) => a.time.localeCompare(b.time));
              const isToday = d === ymd();
              return (
                <View key={d} style={[styles.day, isToday && { borderColor: C.teal }]}>
                  <Txt size={T.small} weight="700" color={isToday ? C.teal : C.text2}>
                    週{weekday(d)} {parseYmd(d).getDate()}
                  </Txt>
                  {items.map((x) => (
                    <Pressable key={x.id} onPress={() => openForm(x)} style={styles.event}>
                      <Txt size={T.tiny + 1} weight="700" color={x.visitType === '初次' ? C.teal : C.orange}>
                        {x.time} {userById(s, x.salesId)?.name}
                      </Txt>
                      <Txt size={T.tiny + 1} numberOfLines={1}>
                        {customerById(s, x.customerId)?.name.replace(/(股份)?有限公司$/, '')}
                      </Txt>
                    </Pressable>
                  ))}
                </View>
              );
            })}
          </View>
        </Panel>
      )}

      <Sheet
        visible={!!open && !pickCustomer}
        onClose={() => setOpen(null)}
        title={open === 'new' ? '安排拜訪' : '編輯拜訪安排'}
        footer={
          <Button
            title="儲存"
            disabled={!valid}
            onPress={() => {
              const t = f.time.padStart(5, '0');
              upsertSchedule({ id: open && open !== 'new' ? open.id : undefined, date: f.date, time: t, salesId: f.salesId, customerId: f.customerId, visitType: f.visitType, questionSetId: f.questionSetId, note: f.note.trim() || undefined, visitId: open && open !== 'new' ? open.visitId : undefined });
              setOpen(null);
            }}
          />
        }
      >
        <Field label="日期(YYYY-MM-DD)" value={f.date} onChangeText={(t) => setF({ ...f, date: t })} />
        <Row style={{ flexWrap: 'wrap', marginTop: -SP.sm, marginBottom: SP.md }}>
          {[0, 1, 2, 7].map((n) => (
            <Chip key={n} label={n === 0 ? '今天' : n === 1 ? '明天' : n === 2 ? '後天' : '下週'} tone="teal" selected={false} onPress={() => setF({ ...f, date: ymd(addDays(new Date(), n)) })} />
          ))}
        </Row>
        <Field label="時間(HH:mm)" value={f.time} onChangeText={(t) => setF({ ...f, time: t })} />
        <Txt size={T.small} color={C.text2} weight="600" style={{ marginBottom: 6 }}>
          業務
        </Txt>
        <Row style={{ flexWrap: 'wrap', marginBottom: SP.md }}>
          {salesUsers(s).filter((u) => u.active).map((u) => (
            <Chip key={u.id} label={u.name} tone={f.salesId === u.id ? 'orange' : 'gray'} onPress={() => setF({ ...f, salesId: u.id })} style={{ height: 32, paddingHorizontal: 12 }} />
          ))}
        </Row>
        <Txt size={T.small} color={C.text2} weight="600" style={{ marginBottom: 6 }}>
          客戶
        </Txt>
        <Pressable onPress={() => setPickCustomer(true)} style={styles.pick}>
          <Txt color={f.customerId ? C.text : C.text3}>{customerById(s, f.customerId)?.name || '選擇客戶'}</Txt>
        </Pressable>
        <Txt size={T.small} color={C.text2} weight="600" style={{ marginBottom: 6, marginTop: SP.md }}>
          拜訪類型
        </Txt>
        <Segmented
          value={f.visitType}
          onChange={(v) => setF({ ...f, visitType: v })}
          options={[
            { value: '初次', label: '初次' },
            { value: '複訪', label: '複訪' },
          ]}
          style={{ marginBottom: SP.md }}
        />
        <Txt size={T.small} color={C.text2} weight="600" style={{ marginBottom: 6 }}>
          題組
        </Txt>
        <Row style={{ flexWrap: 'wrap', marginBottom: SP.md }}>
          {s.questionSets.filter((x) => x.active).map((x) => (
            <Chip key={x.id} label={x.name} tone={f.questionSetId === x.id ? 'orange' : 'gray'} onPress={() => setF({ ...f, questionSetId: x.id })} style={{ height: 32, paddingHorizontal: 12 }} />
          ))}
        </Row>
        <Field label="備註" value={f.note} onChangeText={(t) => setF({ ...f, note: t })} placeholder="例:確認 8 台交期" />
      </Sheet>
      <CustomerPicker
        visible={pickCustomer}
        selectedId={f.customerId}
        onClose={() => setPickCustomer(false)}
        onPick={(c) => {
          setF({ ...f, customerId: c.id, visitType: customerVisitType(s, c.id), salesId: c.ownerId || f.salesId });
          setPickCustomer(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  day: { flexGrow: 1, flexBasis: 130, minHeight: 140, borderWidth: 1, borderColor: C.line, borderRadius: R.md, padding: SP.sm, gap: 6, backgroundColor: 'rgba(5,20,27,0.6)' },
  event: { borderRadius: R.sm, padding: 6, backgroundColor: C.surface2 },
  pick: { borderWidth: 1, borderColor: 'rgba(145,167,173,0.75)', borderRadius: R.pill, paddingHorizontal: SP.lg, height: 46, justifyContent: 'center', backgroundColor: 'rgba(5,20,27,0.92)' },
});
