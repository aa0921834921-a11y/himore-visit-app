import React, { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Header, Screen } from '../../components/Screen';
import { Button, Card, Chip, Field, Notice, Row, Segmented, Txt } from '../../components/ui';
import { RecordButton, TimerFrame } from '../../components/RecordingWidgets';
import { ReasonSheet } from '../../components/Pickers';
import { confirmDialog } from '../../components/Dialog';
import { ProgressBar } from '../../components/Ring';
import { C, SP, T } from '../../theme';
import { useAppState } from '../../store/store';
import { customerById, questionById, setById, visitById } from '../../store/selectors';
import { discardDraft, markSubmitted, patchRaw } from '../../store/actions';
import { useRecorder } from '../../services/recorder';
import { persistAudio } from '../../services/files';
import { runPipeline } from '../../services/processing';
import type { DictationAnswer } from '../../types';

// S05 業務口述(T-S05-01~T-S05-12):逐題引導與自由補充可切換;「客戶未提供/不適用」必選原因;全程標示「業務口述」
export default function Dictate() {
  const { visitId } = useLocalSearchParams<{ visitId: string }>();
  const s = useAppState();
  const v = visitById(s, visitId);
  const set = setById(s, v?.questionSetId);
  const items = set?.items || [];
  const rec = useRecorder();
  const [mode, setMode] = useState<'guided' | 'free'>(items.length ? 'guided' : 'free');
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, DictationAnswer>>({});
  const [freeText, setFreeText] = useState('');
  const [freeAudio, setFreeAudio] = useState<{ uri?: string; durationMs?: number }>({});
  const [reasonOpen, setReasonOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!v) return null;
  const c = customerById(s, v.customerId);
  const item = items[idx];
  const q = questionById(s, item?.questionId);
  const cur = item ? answers[item.questionId] : undefined;
  const recording = rec.phase === 'recording' || rec.phase === 'paused';

  const setAnswer = (qid: string, patch: Partial<DictationAnswer>) => setAnswers((a) => ({ ...a, [qid]: { ...(a[qid] || { questionId: qid, text: '' }), ...patch } }));

  /** 停止目前錄音,存到目前的題目或自由補充;回傳存了什麼,讓「結束口述」可以立即合併 */
  const stopAndSave = async (): Promise<{ qid?: string; uri: string; durationMs: number } | undefined> => {
    if (!recording) return undefined;
    const r = await rec.stop();
    if (!r.uri) return undefined;
    if (mode === 'guided' && item) {
      const uri = persistAudio(r.uri, `${v.id}_${item.questionId}`);
      setAnswer(item.questionId, { audioUri: uri, durationMs: r.durationMs, status: undefined, reason: undefined });
      return { qid: item.questionId, uri, durationMs: r.durationMs };
    }
    const uri = persistAudio(r.uri, `${v.id}_free`);
    setFreeAudio({ uri, durationMs: r.durationMs });
    return { uri, durationMs: r.durationMs };
  };

  const go = async (n: number) => {
    await stopAndSave();
    setIdx(Math.max(0, Math.min(items.length - 1, n)));
  };

  const switchMode = async (m: 'guided' | 'free') => {
    await stopAndSave();
    setMode(m);
  };

  const finish = async () => {
    setBusy(true);
    const saved = await stopAndSave();
    const all: Record<string, DictationAnswer> = { ...answers };
    let free = { ...freeAudio };
    if (saved?.qid) all[saved.qid] = { ...(all[saved.qid] || { questionId: saved.qid, text: '' }), audioUri: saved.uri, durationMs: saved.durationMs, status: undefined, reason: undefined };
    else if (saved) free = { uri: saved.uri, durationMs: saved.durationMs };
    const dictation = Object.values(all).filter((a) => a.text.trim() || a.audioUri || a.status);
    patchRaw(v.id, { dictation, text: freeText.trim() || undefined, audioUri: free.uri, audioDurationMs: free.durationMs });
    markSubmitted(v.id);
    runPipeline(v.id);
    router.replace(`/visit/${v.id}/processing`);
  };

  const hasContent = Object.values(answers).some((a) => a.text.trim() || a.audioUri || a.status) || freeText.trim() || freeAudio.uri || recording;

  const onBack = async () => {
    if (hasContent) {
      const ok = await confirmDialog({ title: '要放棄這次口述嗎?', message: '已口述或輸入的內容不會保存。', ok: '放棄', cancel: '繼續口述', danger: true });
      if (!ok) return;
    }
    if (recording) await rec.stop();
    discardDraft(v.id);
    router.back();
  };

  const answeredCount = items.filter((it) => {
    const a = answers[it.questionId];
    return a && (a.text.trim() || a.audioUri || a.status);
  }).length;

  return (
    <Screen
      bg="record"
      header={<Header title="業務口述" sub={c?.name} onBack={onBack} />}
      footer={<Button title="結束口述" icon="check" onPress={finish} loading={busy} disabled={!hasContent} />}
    >
      <Row style={{ justifyContent: 'space-between', marginTop: SP.lg, marginBottom: SP.md }}>
        <Chip label="業務口述" tone="orange" icon="dictate" />
        {items.length ? (
          <Txt size={T.small} color={C.text2}>
            已處理 {answeredCount}/{items.length} 題
          </Txt>
        ) : null}
      </Row>
      <Segmented
        value={mode}
        onChange={switchMode}
        options={[
          { value: 'guided', label: '逐題引導' },
          { value: 'free', label: '自由補充' },
        ]}
        style={{ marginBottom: SP.lg, opacity: items.length ? 1 : 0.5 }}
      />
      {!items.length && mode === 'free' ? <Notice tone="gray" icon="bank" text="這次拜訪沒有題組,直接自由口述即可。" /> : null}

      {mode === 'guided' && item && q ? (
        <>
          <ProgressBar value={idx + 1} total={items.length} />
          <Card style={{ marginTop: SP.md }} tone={item.required ? 'accent' : 'default'}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt size={T.small} color={item.required ? C.teal : C.text2} weight="700">
                第 {idx + 1} 題({item.required ? '必答' : '選答'})
              </Txt>
              {cur?.status ? <Chip label={`${cur.status === 'na' ? '不適用' : '客戶未提供'}:${cur.reason}`} tone="yellow" /> : cur?.audioUri ? <Chip label="已錄音" tone="teal" icon="check" /> : null}
            </Row>
            <Txt size={T.h2} weight="700" style={{ marginTop: SP.sm }}>
              {q.text}
            </Txt>
          </Card>
        </>
      ) : null}

      <View style={{ alignItems: 'center', marginVertical: SP.lg }}>
        <TimerFrame ms={rec.phase === 'stopped' || rec.phase === 'idle' ? (mode === 'guided' ? cur?.durationMs || 0 : freeAudio.durationMs || 0) : rec.durationMs} width={210} />
        <View style={{ height: SP.md }} />
        <RecordButton
          size={96}
          state={rec.permission === 'denied' ? 'locked' : recording ? 'recording' : 'idle'}
          onPress={() => (recording ? stopAndSave() : rec.start())}
        />
        <Txt size={T.small} color={C.text2} style={{ marginTop: SP.sm }}>
          {recording ? '口述中,點一下停止' : (mode === 'guided' ? cur?.audioUri : freeAudio.uri) ? '已錄好,點一下重錄' : '點一下開始口述'}
        </Txt>
      </View>
      {rec.permission === 'denied' ? <Notice tone="yellow" text="麥克風權限已關閉,可直接在下方打字(也可用鍵盤的語音輸入)。" /> : null}
      {rec.error ? <Notice tone="red" text={rec.error} /> : null}

      {mode === 'guided' && item ? (
        <>
          <Field
            label="補充文字(可用鍵盤語音輸入)"
            placeholder="例:目前有 350 噸射出機 6 台"
            multiline
            value={cur?.text || ''}
            onChangeText={(t) => setAnswer(item.questionId, { text: t, status: t ? undefined : cur?.status })}
          />
          <Button title="客戶未提供/不適用" variant="secondary" small onPress={() => setReasonOpen(true)} />
          <Row style={{ marginTop: SP.md }} gap={SP.md}>
            <View style={{ flex: 1 }}>
              <Button title="上一題" variant="secondary" disabled={idx === 0} onPress={() => go(idx - 1)} />
            </View>
            <View style={{ flex: 1 }}>{idx < items.length - 1 ? <Button title="下一題" onPress={() => go(idx + 1)} /> : <Button title="自由補充" onPress={() => switchMode('free')} />}</View>
          </Row>
        </>
      ) : (
        <Field label="自由補充" placeholder="口述沒提到的內容可以在這裡補充…" multiline value={freeText} onChangeText={setFreeText} />
      )}

      <ReasonSheet
        visible={reasonOpen}
        onClose={() => setReasonOpen(false)}
        onSubmit={(r) => {
          if (item) setAnswer(item.questionId, { status: r.status, reason: r.reason, text: '' });
          setReasonOpen(false);
          if (idx < items.length - 1) go(idx + 1);
        }}
      />
    </Screen>
  );
}
