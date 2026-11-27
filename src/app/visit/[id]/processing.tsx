import React, { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams, useIsFocused } from 'expo-router';
import { Header, Screen } from '../../../components/Screen';
import { Button, Card, Icon, Notice, Txt } from '../../../components/ui';
import { STATE } from '../../../assets';
import { C, SP, T } from '../../../theme';
import { useAppState, useOnline } from '../../../store/store';
import { customerById, visitById } from '../../../store/selectors';
import { retryVisit, runPipeline } from '../../../services/processing';

// S08 處理中(T-S08-01~T-S08-14):四階段依實際狀態更新;可離開,完成後提示
const STAGES = [
  { n: 1, done: '上傳完成', active: '上傳中', wait: '上傳(等待中)' },
  { n: 2, done: '轉文字完成', active: '轉文字中', wait: '轉文字(等待中)' },
  { n: 3, done: '整理重點完成', active: '整理重點中', wait: '整理重點(等待中)' },
  { n: 4, done: '題庫比對完成', active: '題庫比對中', wait: '題庫比對(等待中)' },
];

export default function Processing() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useAppState();
  const online = useOnline();
  const focused = useIsFocused();
  const v = visitById(s, id);

  useEffect(() => {
    if (v?.status === 'processing') runPipeline(v.id);
  }, [v?.id, v?.status]);

  useEffect(() => {
    if (focused && v?.status === 'pending_confirm') router.replace(`/visit/${v.id}/confirm`);
  }, [focused, v?.status, v?.id]);

  if (!v) return null;
  const c = customerById(s, v.customerId);
  const failed = v.status === 'failed';
  const waitingNet = v.stage === 1 && v.upload === 'pending';

  return (
    <Screen bg="process" header={<Header title="處理中" onBack={() => router.replace('/home')} />}>
      <View style={{ alignItems: 'center', marginTop: SP.xxl, marginBottom: SP.xl }}>
        <View style={styles.halo}>
          <Icon name={failed ? 'warn' : 'ai'} size={56} color={failed ? C.red : C.teal} />
        </View>
        <Txt size={T.h2} weight="700" style={{ marginTop: SP.lg }}>
          {failed ? '處理失敗' : '拜訪紀錄處理中'}
        </Txt>
        <Txt color={C.text2} center style={{ marginTop: SP.xs }}>
          {failed ? '內容已保存在手機中,可以重試' : '可離開此頁,完成後會通知您'}
        </Txt>
        {c ? (
          <Txt size={T.small} color={C.text3} style={{ marginTop: SP.xs }}>
            {c.name}・{v.code}
          </Txt>
        ) : null}
      </View>

      <Card>
        {STAGES.map((st, i) => {
          const isDone = v.stage > st.n || v.status === 'pending_confirm';
          const isActive = !isDone && v.stage === st.n && !failed;
          const isFailed = failed && v.stage === st.n;
          const label = isDone ? st.done : isFailed ? `${st.active.replace('中', '')}失敗` : isActive ? (st.n === 1 && waitingNet ? '等待網路連線' : st.active) : st.wait;
          return (
            <View key={st.n} style={[styles.stage, i > 0 && styles.stageBorder]}>
              <Image source={isDone ? STATE.done : isActive ? STATE.active : STATE.waiting} style={{ width: 28, height: 28, opacity: isFailed ? 0.5 : 1 }} />
              <View style={{ flex: 1, marginLeft: SP.md }}>
                <Txt weight={isActive ? '700' : '500'} color={isFailed ? '#FF6B66' : isDone || isActive ? C.text : C.text3}>
                  {label}
                </Txt>
                {isActive && v.stageNote ? (
                  <Txt size={T.small} color={C.teal}>
                    {v.stageNote}
                  </Txt>
                ) : null}
              </View>
              {isActive ? <Icon name="spinner" size={18} color={C.teal} /> : null}
            </View>
          );
        })}
      </Card>

      {waitingNet ? <Notice tone="yellow" icon="offline" text={online ? '準備上傳…' : '目前離線。紀錄已存在手機,恢復連線後會自動上傳並繼續處理。'} /> : null}
      {failed ? (
        <>
          <Notice tone="red" text={`處理失敗,請重試。內容已保存在手機中。${v.error ? `(${v.error})` : ''}`} />
          <Button title="重試" onPress={() => retryVisit(v.id)} />
        </>
      ) : null}
      <View style={{ height: SP.lg }} />
      <Button title="離開此頁,背景處理" variant="secondary" onPress={() => router.replace('/home')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  halo: { width: 120, height: 120, borderRadius: 60, borderWidth: 1, borderColor: C.tealLine, backgroundColor: 'rgba(0,214,198,0.08)', alignItems: 'center', justifyContent: 'center' },
  stage: { flexDirection: 'row', alignItems: 'center', paddingVertical: SP.md },
  stageBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.lineSoft },
});
