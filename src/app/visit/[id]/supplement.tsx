import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Header, Screen } from '../../../components/Screen';
import { Button, Card, Chip, Field, Icon, IconButton, Notice, Row, SectionTitle, Txt } from '../../../components/ui';
import { RecordButton, TimerFrame } from '../../../components/RecordingWidgets';
import { AttachmentList } from '../../../components/Attachments';
import { Sheet } from '../../../components/Sheet';
import { alertDialog, confirmDialog } from '../../../components/Dialog';
import { C, R, SP, T } from '../../../theme';
import { useAppState } from '../../../store/store';
import { customerById, visitById } from '../../../store/selectors';
import { markSubmitted, patchRaw, patchVisit } from '../../../store/actions';
import { useRecorder } from '../../../services/recorder';
import { persistAttachment, persistAudio } from '../../../services/files';
import { runPipeline } from '../../../services/processing';
import { fmtClock, uid } from '../../../lib/util';
import type { Attachment, Supplement } from '../../../types';
import type { IconName } from '../../../assets';

const SRC = { recording: '現場錄音', dictation: '業務口述', text: '文字輸入' } as const;

// 補充資料:主要記錄(錄音/口述/文字)完成後,可再後補口述、文字、照片與檔案,一起交給 AI 整理。
// 待確認的紀錄也可回到這裡補充,再重新整理。
export default function SupplementScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useAppState();
  const v = visitById(s, id);
  const rec = useRecorder();
  const [mode, setMode] = useState<'dictation' | 'text' | null>(null);
  const [draft, setDraft] = useState('');
  const [audio, setAudio] = useState<{ uri?: string; durationMs?: number }>({});
  const [busy, setBusy] = useState(false);
  if (!v) return null;
  const c = customerById(s, v.customerId);
  const supplements = v.raw.supplements || [];
  const attachments = v.raw.attachments || [];
  const rerun = v.status === 'pending_confirm' || v.status === 'failed';
  const recording = rec.phase === 'recording' || rec.phase === 'paused';

  const main =
    v.source === 'recording'
      ? `現場錄音 ${fmtClock(v.raw.audioDurationMs || 0)}`
      : v.source === 'dictation'
        ? `業務口述 ${(v.raw.dictation || []).length} 題${v.raw.text ? '+自由補充' : ''}`
        : `文字 ${(v.raw.text || '').length} 字`;

  const addAttachments = (items: Attachment[]) => patchRaw(v.id, { attachments: [...attachments, ...items] });

  const pickPhotos = async (camera: boolean) => {
    try {
      if (camera) {
        const p = await ImagePicker.requestCameraPermissionsAsync();
        if (!p.granted) {
          alertDialog('相機權限已關閉', '請到手機設定開啟相機權限,或改從相簿選擇。');
          return;
        }
      }
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7, allowsMultipleSelection: !camera, selectionLimit: 10 };
      const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (r.canceled) return;
      addAttachments(
        r.assets.map((a, i) => {
          const name = a.fileName || `照片_${Date.now()}_${i + 1}.jpg`;
          return { id: uid('att'), kind: 'photo', name, uri: persistAttachment(a.uri, name), mimeType: a.mimeType || 'image/jpeg', size: a.fileSize, addedAt: new Date().toISOString() };
        }),
      );
    } catch {
      alertDialog('無法開啟', camera ? '這台裝置無法使用相機,請改從相簿選擇。' : '無法開啟相簿。');
    }
  };

  const pickFiles = async () => {
    try {
      const r = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
      if (r.canceled) return;
      addAttachments(
        r.assets.map((a) => ({
          id: uid('att'),
          kind: a.mimeType?.startsWith('image/') ? 'photo' : 'file',
          name: a.name,
          uri: persistAttachment(a.uri, a.name),
          mimeType: a.mimeType,
          size: a.size,
          addedAt: new Date().toISOString(),
        })),
      );
    } catch {
      alertDialog('無法開啟', '無法選擇檔案。');
    }
  };

  const saveSupplement = async () => {
    let a = audio;
    if (recording) {
      const r = await rec.stop();
      if (r.uri) a = { uri: persistAudio(r.uri, `${v.id}_${uid("sup")}`), durationMs: r.durationMs };
    }
    if (!draft.trim() && !a.uri) {
      setMode(null);
      return;
    }
    const sp: Supplement = { id: uid('sup'), kind: mode === 'text' ? 'text' : 'dictation', text: draft.trim(), audioUri: a.uri, durationMs: a.durationMs, addedAt: new Date().toISOString() };
    patchRaw(v.id, { supplements: [...supplements, sp] });
    setDraft('');
    setAudio({});
    setMode(null);
  };

  const submit = async () => {
    if (rerun) {
      const ok = await confirmDialog({
        title: '重新整理這筆紀錄?',
        message: 'AI 會把原本內容和補充資料一起重新整理。你在確認頁做過的修改會被新的整理結果取代。',
        ok: '重新整理',
      });
      if (!ok) return;
      patchVisit(v.id, { ai: undefined });
    }
    setBusy(true);
    markSubmitted(v.id);
    runPipeline(v.id);
    router.replace(`/visit/${v.id}/processing`);
  };

  const actions: { icon: IconName; label: string; onPress: () => void }[] = [
    { icon: 'dictate', label: '補充口述', onPress: () => setMode('dictation') },
    { icon: 'text', label: '補充文字', onPress: () => setMode('text') },
    { icon: 'photo', label: '拍照', onPress: () => pickPhotos(true) },
    { icon: 'photo', label: '相簿照片', onPress: () => pickPhotos(false) },
    { icon: 'attach', label: '上傳檔案', onPress: pickFiles },
  ];

  return (
    <Screen
      bg="base"
      header={<Header title="補充資料" sub={c?.name} onBack={rerun ? undefined : () => router.back()} />}
      footer={<Button title={rerun ? '重新整理' : '送出整理'} icon="ai" loading={busy} onPress={submit} />}
    >
      <Card style={{ marginTop: SP.lg }} tone="accent">
        <Txt size={T.small} color={C.text2}>
          主要內容
        </Txt>
        <Row style={{ marginTop: 4 }}>
          <Chip label={SRC[v.source]} tone="orange" icon={v.source === 'recording' ? 'mic' : v.source === 'dictation' ? 'dictate' : 'text'} />
          <Txt size={T.small}>{main}</Txt>
        </Row>
        <Txt size={T.tiny + 1} color={C.text3} style={{ marginTop: SP.sm }}>
          可再補充口述、文字、照片或檔案(例:名片、現場設備照片、客戶提供的規格書),會與主要內容一起交給 AI 整理。沒有要補充就直接送出。
        </Txt>
      </Card>

      <View style={styles.actions}>
        {actions.map((a) => (
          <Pressable key={a.label} onPress={a.onPress} style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }]}>
            <Icon name={a.icon} size={24} color={C.teal} />
            <Txt size={T.small} weight="600" style={{ marginTop: 4 }}>
              {a.label}
            </Txt>
          </Pressable>
        ))}
      </View>

      {supplements.length ? (
        <>
          <SectionTitle title={`後補內容(${supplements.length})`} />
          {supplements.map((sp) => (
            <Card key={sp.id} style={{ marginBottom: SP.sm }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Chip label={sp.kind === 'text' ? '補充文字' : `補充口述${sp.durationMs ? ` ${fmtClock(sp.durationMs).slice(3)}` : ''}`} tone="teal" />
                <IconButton name="trash" size={16} color={C.text3} label="刪除" onPress={() => patchRaw(v.id, { supplements: supplements.filter((x) => x.id !== sp.id) })} />
              </Row>
              {sp.text ? <Txt size={T.small} style={{ marginTop: 4 }}>{sp.text}</Txt> : <Txt size={T.small} color={C.text3} style={{ marginTop: 4 }}>(錄音,送出後轉成文字)</Txt>}
            </Card>
          ))}
        </>
      ) : null}

      {attachments.length ? (
        <>
          <SectionTitle title={`照片與檔案(${attachments.length})`} />
          <AttachmentList items={attachments} onRemove={(aid) => patchRaw(v.id, { attachments: attachments.filter((x) => x.id !== aid) })} />
          <Txt size={T.tiny + 1} color={C.text3}>
            模擬 AI 不會讀取照片與檔案內容;接上正式 AI 服務後,可辨識名片、文件與照片中的文字。
          </Txt>
        </>
      ) : null}

      {rerun ? <Notice tone="yellow" text="這筆紀錄已整理過。補充後按「重新整理」,AI 會產生新的整理結果。" /> : null}

      <Sheet
        visible={!!mode}
        onClose={() => setMode(null)}
        title={mode === 'text' ? '補充文字' : '補充口述'}
        footer={<Button title="加入" onPress={saveSupplement} disabled={!draft.trim() && !audio.uri && !recording} />}
      >
        {mode === 'dictation' ? (
          <View style={{ alignItems: 'center', marginBottom: SP.md }}>
            <TimerFrame ms={recording ? rec.durationMs : audio.durationMs || 0} width={200} />
            <View style={{ height: SP.sm }} />
            <RecordButton
              size={88}
              state={rec.permission === 'denied' ? 'locked' : recording ? 'recording' : 'idle'}
              onPress={async () => {
                if (recording) {
                  const r = await rec.stop();
                  if (r.uri) setAudio({ uri: persistAudio(r.uri, `${v.id}_${uid("sup")}`), durationMs: r.durationMs });
                } else rec.start();
              }}
            />
            <Txt size={T.small} color={C.text2} style={{ marginTop: SP.xs }}>
              {recording ? '口述中,點一下停止' : audio.uri ? '已錄好,可再補充文字' : '點一下開始口述'}
            </Txt>
          </View>
        ) : null}
        <Field
          label={mode === 'text' ? '內容' : '補充文字(選填,可用鍵盤語音輸入)'}
          multiline
          value={draft}
          onChangeText={setDraft}
          placeholder="例:客戶另外提到希望先試機一週"
        />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm, marginTop: SP.lg },
  action: { width: '31.5%', flexGrow: 1, height: 76, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, backgroundColor: 'rgba(9,33,43,0.94)', alignItems: 'center', justifyContent: 'center' },
});
