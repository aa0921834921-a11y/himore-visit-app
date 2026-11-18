import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Header, Screen } from '../../components/Screen';
import { Button, Card, Checkbox, Chip, Icon, Notice, Row, Txt } from '../../components/ui';
import { RecordButton, TimerFrame, Waveform } from '../../components/RecordingWidgets';
import { confirmDialog } from '../../components/Dialog';
import { C, R, SP, T } from '../../theme';
import { useAppState } from '../../store/store';
import { customerById, questionById, setById, visitById } from '../../store/selectors';
import { discardDraft, markSubmitted, patchRaw } from '../../store/actions';
import { useRecorder } from '../../services/recorder';
import { persistAudio } from '../../services/files';
import { runPipeline } from '../../services/processing';
import { fmtClock } from '../../lib/util';

// S04 錄音(T-S04-01、T-S04-09~T-S04-12):標記重點、題庫自評勾選、暫停/停止;錄完才批次轉文字
export default function Recording() {
  const { visitId } = useLocalSearchParams<{ visitId: string }>();
  const s = useAppState();
  const v = visitById(s, visitId);
  const rec = useRecorder();
  const [marks, setMarks] = useState<number[]>([]);
  const [checked, setChecked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [showQs, setShowQs] = useState(true);
  if (!v) return null;
  const c = customerById(s, v.customerId);
  const set = setById(s, v.questionSetId);

  const finish = async () => {
    setSaving(true);
    const { uri, durationMs } = await rec.stop();
    const audioUri = uri ? persistAudio(uri, v.id) : undefined;
    patchRaw(v.id, { audioUri, audioDurationMs: durationMs, marks, selfCheckedQuestionIds: checked });
    markSubmitted(v.id);
    runPipeline(v.id);
    router.replace(`/visit/${v.id}/processing`);
  };

  const onBack = async () => {
    if (rec.phase === 'recording' || rec.phase === 'paused') {
      const ok = await confirmDialog({ title: '要放棄這段錄音嗎?', message: '錄音尚未完成。放棄後錄音不會保存。', ok: '放棄錄音', cancel: '繼續錄音', danger: true });
      if (!ok) return;
      await rec.stop();
    }
    discardDraft(v.id);
    router.back();
  };

  const recording = rec.phase === 'recording';
  const started = rec.phase === 'recording' || rec.phase === 'paused';

  return (
    <Screen bg="record" header={<Header title="錄音" sub={c?.name} onBack={onBack} />}>
      <View style={{ alignItems: 'center', marginTop: SP.xl }}>
        <Chip label={v.raw.consent ? `已取得客戶同意・${v.raw.consent.version}` : '未取得同意'} tone={v.raw.consent ? 'teal' : 'red'} icon={v.raw.consent ? 'check' : 'warn'} />
        <View style={{ height: SP.lg }} />
        <TimerFrame ms={rec.durationMs} />
        <Waveform active={recording} level={rec.level} />
        <RecordButton
          state={!v.raw.consent || rec.permission === 'denied' ? 'locked' : recording ? 'recording' : 'idle'}
          onPress={() => {
            if (!started) rec.start();
            else if (recording) finish();
            else rec.resume();
          }}
        />
        <Txt size={T.small} color={C.text2} style={{ marginTop: SP.sm }}>
          {!started ? '點一下開始錄音' : recording ? '點一下停止並送出' : '已暫停,點一下繼續'}
        </Txt>
      </View>

      {rec.permission === 'denied' ? <Notice tone="red" text="麥克風權限已關閉,無法錄音。請到手機設定開啟,或返回改用文字輸入。" /> : null}
      {rec.error ? <Notice tone="red" text={rec.error} /> : null}

      <Row style={{ justifyContent: 'center', marginTop: SP.lg }} gap={SP.md}>
        <Pressable
          disabled={!recording}
          onPress={() => setMarks((m) => [...m, Math.round(rec.durationMs / 1000)])}
          style={({ pressed }) => [styles.ctl, !recording && { opacity: 0.4 }, pressed && { opacity: 0.7 }]}
        >
          <Icon name="flag" size={22} color={C.yellow} />
          <Txt size={T.small} weight="600" style={{ marginTop: 4 }}>
            標記重點{marks.length ? `(${marks.length})` : ''}
          </Txt>
        </Pressable>
        <Pressable disabled={!started} onPress={() => (recording ? rec.pause() : rec.resume())} style={({ pressed }) => [styles.ctl, !started && { opacity: 0.4 }, pressed && { opacity: 0.7 }]}>
          <Icon name={recording || !started ? 'pause' : 'play'} size={22} color={C.text} />
          <Txt size={T.small} weight="600" style={{ marginTop: 4 }}>
            {recording || !started ? '暫停' : '繼續'}
          </Txt>
        </Pressable>
        <Pressable disabled={!started || saving} onPress={finish} style={({ pressed }) => [styles.ctl, !started && { opacity: 0.4 }, pressed && { opacity: 0.7 }]}>
          <Icon name="stop" size={22} color={C.red} />
          <Txt size={T.small} weight="600" style={{ marginTop: 4 }}>
            停止
          </Txt>
        </Pressable>
      </Row>
      {marks.length ? (
        <Txt size={T.tiny + 1} color={C.text3} center style={{ marginTop: SP.sm }}>
          已標記:{marks.map((m) => fmtClock(m * 1000).slice(3)).join('、')}
        </Txt>
      ) : null}

      <Txt size={T.small} color={C.text2} center style={{ marginTop: SP.lg, marginBottom: SP.lg }}>
        錄音完成後才會轉成文字
      </Txt>

      {set ? (
        <Card>
          <Pressable onPress={() => setShowQs(!showQs)} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Txt weight="700" style={{ flex: 1 }}>
              題庫自評:已談到的題目({checked.length}/{set.items.length})
            </Txt>
            <Icon name="down" size={18} color={C.text2} style={{ transform: [{ rotate: showQs ? '180deg' : '0deg' }] }} />
          </Pressable>
          {showQs
            ? set.items.map((it) => {
                const q = questionById(s, it.questionId);
                const on = checked.includes(it.questionId);
                return (
                  <Checkbox
                    key={it.questionId}
                    checked={on}
                    onPress={() => setChecked((x) => (on ? x.filter((i) => i !== it.questionId) : [...x, it.questionId]))}
                    label={`${q?.code} ${q?.text}`}
                    sub={it.required ? '必答' : '選答'}
                  />
                );
              })
            : null}
        </Card>
      ) : null}
      <Button title="停止並送出整理" variant="secondary" disabled={!started || saving} loading={saving} onPress={finish} style={{ marginTop: SP.lg }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  ctl: { width: 96, height: 72, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, backgroundColor: 'rgba(9,33,43,0.9)', alignItems: 'center', justifyContent: 'center' },
});
