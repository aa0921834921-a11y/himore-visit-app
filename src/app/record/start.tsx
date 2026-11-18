import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync } from 'expo-audio';
import { Header, Screen } from '../../components/Screen';
import { Button, Card, Chip, Icon, KeyValue, ListRow, Notice, Row, SectionTitle, Txt } from '../../components/ui';
import { CustomerPicker } from '../../components/Pickers';
import { Sheet } from '../../components/Sheet';
import { confirmDialog } from '../../components/Dialog';
import { C, R, SP, T } from '../../theme';
import { useAppState } from '../../store/store';
import { currentUser, customerById, customerVisitType, scheduleById, setById, todaySchedules, visitById } from '../../store/selectors';
import { createDraftVisit } from '../../store/actions';
import type { InputSource } from '../../types';
import type { IconName } from '../../assets';

// S03 開始記錄(文案 T-S03-01~T-S03-11)。原 S07 補充資訊併入本頁:客戶與題組可略過。

const SOURCES: { key: InputSource; icon: IconName; title: string; sub: string }[] = [
  { key: 'recording', icon: 'mic', title: '錄音', sub: '需先取得客戶同意' },
  { key: 'dictation', icon: 'dictate', title: '業務口述', sub: '拜訪後由我口述(建議)' },
  { key: 'text', icon: 'text', title: '文字輸入', sub: '手動輸入拜訪內容' },
];

export default function StartRecord() {
  const params = useLocalSearchParams<{ scheduleId?: string; customerId?: string; questionSetId?: string; adhoc?: string }>();
  const s = useAppState();
  const me = currentUser(s);
  const [scheduleId, setScheduleId] = useState<string | undefined>(params.scheduleId);
  const [adhoc, setAdhoc] = useState(params.adhoc === '1' || !!params.customerId);
  const [customerId, setCustomerId] = useState<string | undefined>(params.customerId);
  const [questionSetId, setQuestionSetId] = useState<string | undefined>(params.questionSetId);
  const [source, setSource] = useState<InputSource>('dictation');
  const [pickCustomer, setPickCustomer] = useState(false);
  const [pickSet, setPickSet] = useState(false);

  const sch = scheduleById(s, scheduleId);
  const todays = useMemo(() => (me ? todaySchedules(s, me.id).filter((x) => !visitById(s, x.visitId) || visitById(s, x.visitId)?.status === 'draft') : []), [s, me]);
  const selecting = !sch && !adhoc && todays.length > 0;

  const cId = sch?.customerId || customerId;
  const qsId = sch?.questionSetId || questionSetId;
  const customer = customerById(s, cId);
  const set = setById(s, qsId);
  const requiredCount = set?.items.filter((i) => i.required).length || 0;
  const visitType = sch?.visitType || customerVisitType(s, cId);

  const start = async () => {
    if (source === 'recording' || source === 'dictation') {
      try {
        let p = await getRecordingPermissionsAsync();
        if (!p.granted && p.canAskAgain !== false) p = await requestRecordingPermissionsAsync();
        if (!p.granted) {
          if (source === 'recording') {
            const ok = await confirmDialog({
              title: '麥克風權限已關閉',
              message: '無法錄音。請到手機設定開啟麥克風權限,或先改用文字輸入。',
              ok: '改用文字輸入',
              cancel: '取消',
            });
            if (!ok) return;
            setSource('text');
            return;
          }
        }
      } catch {
        // 網頁或模擬器沒有麥克風時,口述仍可用打字
      }
    }
    // 若此行程已有未完成的草稿,沿用
    const existing = sch?.visitId ? visitById(s, sch.visitId) : undefined;
    const v = existing && existing.status === 'draft' && existing.source === source ? existing : createDraftVisit({ scheduleId: sch?.id, customerId: cId, questionSetId: qsId, source });
    if (source === 'recording') router.replace({ pathname: '/record/consent', params: { visitId: v.id } });
    else if (source === 'dictation') router.replace({ pathname: '/record/dictate', params: { visitId: v.id } });
    else router.replace({ pathname: '/record/text', params: { visitId: v.id } });
  };

  return (
    <Screen
      bg="base"
      header={<Header title="開始記錄" />}
      footer={selecting ? undefined : <Button title="開始記錄" icon={SOURCES.find((x) => x.key === source)?.icon} onPress={start} />}
    >
      {selecting ? (
        <>
          <SectionTitle title="選擇今日拜訪" />
          {todays.map((x) => {
            const c = customerById(s, x.customerId);
            return <ListRow key={x.id} title={`${x.time} ${c?.name || ''}`} sub={`題組:${setById(s, x.questionSetId)?.name || '未指定'}・${x.visitType}`} onPress={() => setScheduleId(x.id)} />;
          })}
          <Button title="這是臨時拜訪" variant="secondary" onPress={() => setAdhoc(true)} style={{ marginTop: SP.md }} />
        </>
      ) : (
        <>
          <Card style={{ marginTop: SP.lg }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt size={T.small} color={C.text2}>
                客戶
              </Txt>
              {sch ? <Chip label="已安排" tone="gray" icon="lock" /> : <Chip label="可略過" tone="gray" />}
            </Row>
            <Pressable disabled={!!sch} onPress={() => setPickCustomer(true)} style={styles.pick}>
              <Txt size={T.h3} weight="700" style={{ flex: 1 }} color={customer ? C.text : C.text3}>
                {customer?.name || '選擇客戶(可稍後由 AI 建議)'}
              </Txt>
              {!sch ? <Icon name="down" size={18} color={C.text2} /> : null}
            </Pressable>
            <KeyValue k="拜訪類型" v={visitType} />
            <Pressable disabled={!!sch} onPress={() => setPickSet(true)}>
              <KeyValue k="題組" v={set?.name || (sch ? '未指定' : '選擇題組(可略過)')} />
            </Pressable>
            {set ? (
              <Row style={{ marginTop: SP.xs }}>
                <Chip label={`必答題 ${requiredCount} 題`} tone="orange" />
                <Chip label={`共 ${set.items.length} 題`} tone="gray" />
              </Row>
            ) : null}
            {sch ? (
              <Txt size={T.tiny + 1} color={C.text3} style={{ marginTop: SP.md }}>
                客戶、類型與題組由管理者安排,無法修改
              </Txt>
            ) : null}
          </Card>

          <SectionTitle title="記錄方式" />
          {SOURCES.map((x) => {
            const on = source === x.key;
            return (
              <Pressable key={x.key} onPress={() => setSource(x.key)} style={[styles.source, on && styles.sourceOn]} accessibilityRole="radio" accessibilityState={{ selected: on }}>
                <View style={[styles.sourceIcon, on && { borderColor: C.orange, backgroundColor: C.orangeDim }]}>
                  <Icon name={x.icon} size={26} color={on ? C.orange : C.text2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt size={T.h3} weight="700">
                    {x.title}
                  </Txt>
                  <Txt size={T.small} color={C.text2}>
                    {x.sub}
                  </Txt>
                </View>
                {on ? <Icon name="check" size={22} color={C.orange} /> : null}
              </Pressable>
            );
          })}
          {source === 'recording' ? <Notice tone="yellow" text="選擇錄音後會先顯示錄音同意聲明;客戶不同意時可改用口述。" /> : null}
        </>
      )}

      <CustomerPicker
        visible={pickCustomer}
        selectedId={customerId}
        onClose={() => setPickCustomer(false)}
        onPick={(c) => {
          setCustomerId(c.id);
          setPickCustomer(false);
        }}
      />
      <Sheet visible={pickSet} onClose={() => setPickSet(false)} title="選擇題組">
        {s.questionSets
          .filter((x) => x.active)
          .map((x) => (
            <ListRow
              key={x.id}
              title={x.name}
              sub={`共 ${x.items.length} 題・必答 ${x.items.filter((i) => i.required).length} 題`}
              onPress={() => {
                setQuestionSetId(x.id);
                setPickSet(false);
              }}
              right={x.id === questionSetId ? <Chip label="已選" tone="teal" /> : undefined}
            />
          ))}
        <Button
          title="不使用題組"
          variant="ghost"
          onPress={() => {
            setQuestionSetId(undefined);
            setPickSet(false);
          }}
        />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pick: { flexDirection: 'row', alignItems: 'center', paddingVertical: SP.sm, marginBottom: SP.xs },
  source: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.md,
    padding: SP.lg,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: 'rgba(9,33,43,0.94)',
    marginBottom: SP.md,
  },
  sourceOn: { borderColor: C.orange, backgroundColor: 'rgba(40,24,12,0.6)' },
  sourceIcon: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
});
