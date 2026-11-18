import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../components/Screen';
import { Button, Card, Checkbox, Chip, Icon, Row, SectionTitle, Txt } from '../../components/ui';
import { NetworkBanner } from '../../components/Banners';
import { BRAND } from '../../assets';
import { C, R, SP, T } from '../../theme';
import { useAppState } from '../../store/store';
import {
  currentUser,
  customerById,
  pendingConfirmVisits,
  pendingUploads,
  processingVisits,
  setById,
  todaySchedules,
  todosDue,
  visitById,
} from '../../store/selectors';
import { toggleTodo } from '../../store/actions';
import { fmtDate, fmtShortDate, weekday, ymd } from '../../lib/util';

// S02 首頁(文案 T-S02-01~T-S02-11)
export default function Home() {
  const s = useAppState();
  const me = currentUser(s);
  if (!me) return null;
  const schedules = todaySchedules(s, me.id);
  const pending = pendingConfirmVisits(s, me.id);
  const proc = processingVisits(s, me.id);
  const uploads = pendingUploads(s, me.id);
  const todos = todosDue(s, me.id);
  const hour = new Date().getHours();
  const greet = hour < 11 ? '早安' : hour < 18 ? '午安' : '晚安';
  const today = ymd();

  return (
    <Screen bg="home" bottomInset={false}>
      <Row style={{ justifyContent: 'space-between', marginTop: SP.md, marginBottom: SP.lg }}>
        <View>
          <Txt size={T.h2} weight="700">
            {me.name},{greet}
          </Txt>
          <Txt size={T.small} color={C.text2}>
            {fmtDate(today)}(週{weekday(today)})・{me.team}
          </Txt>
        </View>
        <Image source={BRAND.logo} style={{ width: 96, height: 96 / BRAND.logoRatio, opacity: 0.9 }} resizeMode="contain" />
      </Row>

      <NetworkBanner />

      <Card>
        <Row style={{ justifyContent: 'space-between', marginBottom: SP.sm }}>
          <Txt size={T.h3} weight="700">
            今日拜訪({schedules.length} 場)
          </Txt>
          <Chip label="由管理者安排" tone="gray" icon="calendar" />
        </Row>
        {schedules.length === 0 ? (
          <Txt color={C.text2} style={{ paddingVertical: SP.md }}>
            今天沒有安排拜訪。臨時拜訪可按下方新增。
          </Txt>
        ) : (
          schedules.map((x, i) => {
            const c = customerById(s, x.customerId);
            const set = setById(s, x.questionSetId);
            const v = visitById(s, x.visitId);
            const status = v ? (v.status === 'confirmed' ? '已入庫' : v.status === 'pending_confirm' ? '待確認' : v.status === 'draft' ? '記錄中' : '處理中') : undefined;
            return (
              <Pressable
                key={x.id}
                onPress={() => router.push({ pathname: '/customer/[id]/briefing', params: { id: x.customerId, scheduleId: x.id } })}
                style={({ pressed }) => [styles.visitRow, i > 0 && styles.visitRowBorder, pressed && { opacity: 0.7 }]}
              >
                <Txt size={T.h3} weight="700" color={C.teal} style={{ width: 58 }}>
                  {x.time}
                </Txt>
                <View style={{ flex: 1 }}>
                  <Txt weight="600" numberOfLines={1}>
                    {c?.name || '未知客戶'}
                  </Txt>
                  <Txt size={T.small} color={C.text2} numberOfLines={1}>
                    題組:{set?.name || '未指定'}
                  </Txt>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Chip label={x.visitType} tone={x.visitType === '初次' ? 'teal' : 'orange'} />
                  {status ? (
                    <Txt size={T.tiny} color={status === '已入庫' ? C.teal : C.yellow}>
                      {status}
                    </Txt>
                  ) : null}
                </View>
              </Pressable>
            );
          })
        )}
        <Button title="+新增臨時拜訪" variant="secondary" small onPress={() => router.push({ pathname: '/record/start', params: { adhoc: '1' } })} style={{ marginTop: SP.md }} />
      </Card>

      <Row style={{ marginTop: SP.md, alignItems: 'stretch' }} gap={SP.md}>
        <Card style={{ flex: 1 }} tone={pending.length ? 'warn' : 'default'} onPress={() => router.push('/pending')}>
          <Icon name="edit" size={22} color={pending.length ? C.yellow : C.text2} />
          <Txt size={T.h3} weight="700" style={{ marginTop: SP.sm }}>
            待確認 {pending.length} 筆
          </Txt>
          <Txt size={T.tiny + 1} color={C.text2}>
            {proc.length ? `另有 ${proc.length} 筆處理中` : '確認後才會入庫'}
          </Txt>
        </Card>
        <Card style={{ flex: 1 }} onPress={() => router.push('/me')}>
          <Icon name={uploads.length ? 'upload' : 'uploaded'} size={22} color={uploads.length ? C.teal : C.text2} />
          <Txt size={T.h3} weight="700" style={{ marginTop: SP.sm }}>
            上傳狀態
          </Txt>
          <Txt size={T.tiny + 1} color={C.text2}>
            {uploads.length ? `${uploads.length} 筆上傳中,其餘已完成` : '全部已完成'}
          </Txt>
        </Card>
      </Row>

      {proc.length ? (
        <>
          <SectionTitle title={`處理中(${proc.length})`} />
          {proc.map((v) => (
            <Card key={v.id} style={{ marginBottom: SP.sm }} onPress={() => router.push(`/visit/${v.id}/processing`)}>
              <Row>
                <Icon name={v.status === 'failed' ? 'warn' : 'spinner'} size={20} color={v.status === 'failed' ? C.red : C.teal} />
                <Txt style={{ flex: 1 }} numberOfLines={1}>
                  {customerById(s, v.customerId)?.name || '未指定客戶'}
                </Txt>
                <Txt size={T.small} color={v.status === 'failed' ? '#FF6B66' : C.text2}>
                  {v.status === 'failed' ? '處理失敗' : v.upload === 'pending' ? '等待上傳' : '處理中'}
                </Txt>
              </Row>
            </Card>
          ))}
        </>
      ) : null}

      <SectionTitle title={`今日待辦(${todos.length})`} />
      {todos.length === 0 ? (
        <Txt color={C.text2}>今天沒有到期的待辦。</Txt>
      ) : (
        <Card style={{ paddingVertical: SP.sm }}>
          {todos.map((t) => (
            <Checkbox
              key={t.id}
              checked={t.done}
              onPress={() => toggleTodo(t.id)}
              label={t.content}
              sub={`${customerById(s, t.customerId)?.name || ''}${t.due ? `・${t.due < today ? '已逾期 ' : ''}${fmtShortDate(t.due)}` : ''}`}
            />
          ))}
        </Card>
      )}
      <View style={{ height: SP.xl }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  visitRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SP.md, gap: SP.sm },
  visitRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.lineSoft },
  dot: { width: 8, height: 8, borderRadius: R.pill },
});
