import React, { useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { Header, Screen } from "../../components/Screen";
import {
  Button,
  Card,
  Checkbox,
  Icon,
  Notice,
  Row,
  Txt,
} from "../../components/ui";
import { alertDialog } from "../../components/Dialog";
import { C, SP, T } from "../../theme";
import { useAppState } from "../../store/store";
import { customerById, visitById } from "../../store/selectors";
import { discardDraft, patchRaw, recordConsent } from "../../store/actions";
import { audioDurationMs, fmtBytes, persistAudio } from "../../services/files";
import { fmtClock } from "../../lib/util";

const AUDIO_EXT = /\.(m4a|mp3|wav|aac|amr|3gp|ogg|opus|webm|caf|flac|mp4)$/i;
const MAX_BYTES = 95 * 1024 * 1024; // 通道單檔上限約 100MB

// 匯入錄音檔:業務用手機內建錄音 App(iPhone 語音備忘錄、Android 錄音機)錄好後匯入。
// 螢幕關閉也能長時間錄音,收音也有手機原廠處理;匯入後流程與現場錄音相同。
export default function ImportRecording() {
  const { visitId } = useLocalSearchParams<{ visitId: string }>();
  const s = useAppState();
  const v = visitById(s, visitId);
  const [file, setFile] = useState<{
    uri: string;
    name: string;
    size?: number;
    durationMs?: number;
  } | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!v) return null;
  const c = customerById(s, v.customerId);
  const tooBig = !!file?.size && file.size > MAX_BYTES;

  const pick = async () => {
    try {
      const r = await DocumentPicker.getDocumentAsync({
        type: ["audio/*", "video/mp4"],
        copyToCacheDirectory: true,
      });
      if (r.canceled || !r.assets?.[0]) return;
      const a = r.assets[0];
      if (!(a.mimeType?.startsWith("audio/") || AUDIO_EXT.test(a.name))) {
        alertDialog("不是錄音檔", "請選擇 m4a、mp3、wav 等錄音檔。");
        return;
      }
      setBusy(true);
      const durationMs = await audioDurationMs(a.uri);
      setFile({ uri: a.uri, name: a.name, size: a.size, durationMs });
    } catch {
      alertDialog("無法開啟", "無法選擇檔案。");
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    if (!file) return;
    recordConsent(v.id, true);
    const uri = persistAudio(file.uri, v.id);
    patchRaw(v.id, {
      audioUri: uri,
      audioDurationMs: file.durationMs,
      audioParts: undefined,
      audioImported: { name: file.name, size: file.size },
    });
    router.replace(`/visit/${v.id}/supplement`);
  };

  return (
    <Screen
      bg="record"
      header={
        <Header
          title="匯入錄音檔"
          sub={c?.name}
          onBack={() => {
            discardDraft(v.id);
            router.back();
          }}
        />
      }
      footer={
        <Button
          title="下一步"
          icon="check"
          disabled={!file || !consent || tooBig}
          onPress={next}
        />
      }
    >
      <Card tone="accent" style={{ marginTop: SP.lg }}>
        <Txt weight="700" style={{ marginBottom: SP.xs }}>
          用手機內建錄音 App 錄,再匯入
        </Txt>
        <Txt size={T.small} color={C.text2}>
          iPhone:「語音備忘錄」錄完後,點該筆錄音的「…」→「儲存到檔案」,再回來這裡選擇。
          {"\n"}
          Android:用「錄音機」錄完,直接在這裡選擇錄音檔。{"\n"}
          內建錄音 App 螢幕關閉也能長時間錄音,適合一兩個小時的拜訪。
        </Txt>
      </Card>

      <View style={{ height: SP.lg }} />
      {file ? (
        <Card>
          <Row>
            <Icon name="mic" size={24} color={C.teal} />
            <View style={{ flex: 1 }}>
              <Txt weight="700" numberOfLines={1}>
                {file.name}
              </Txt>
              <Txt size={T.small} color={C.text2}>
                {[
                  file.durationMs
                    ? `長度 ${fmtClock(file.durationMs)}`
                    : "長度讀取不到(不影響轉寫)",
                  file.size ? fmtBytes(file.size) : "",
                ]
                  .filter(Boolean)
                  .join("・")}
              </Txt>
            </View>
          </Row>
          <Button
            title="重新選擇"
            small
            variant="ghost"
            onPress={pick}
            style={{ marginTop: SP.sm }}
          />
        </Card>
      ) : (
        <Button
          title="選擇錄音檔"
          icon="attach"
          loading={busy}
          onPress={pick}
        />
      )}
      {tooBig ? (
        <Notice
          tone="red"
          text="檔案超過 95MB,目前的連線方式傳不上去。請在錄音 App 裡改用較低音質,或把錄音拆成兩段分別匯入(第二段用「補充資料」上傳)。"
        />
      ) : null}

      <View style={{ height: SP.lg }} />
      <Card>
        <Checkbox
          checked={consent}
          onPress={() => setConsent(!consent)}
          label="錄音前已取得客戶同意"
          sub={`依錄音同意聲明(${s.settings.consentVersion})取得同意;系統會記錄確認時間與操作人`}
        />
      </Card>
    </Screen>
  );
}
