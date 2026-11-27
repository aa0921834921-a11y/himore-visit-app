import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Header, Screen } from "../../components/Screen";
import {
  Button,
  Card,
  Checkbox,
  Chip,
  Icon,
  Notice,
  Row,
  Txt,
} from "../../components/ui";
import {
  RecordButton,
  TimerFrame,
  Waveform,
} from "../../components/RecordingWidgets";
import { confirmDialog } from "../../components/Dialog";
import { C, R, SP, T } from "../../theme";
import { useAppState } from "../../store/store";
import {
  customerById,
  questionById,
  setById,
  visitById,
} from "../../store/selectors";
import { discardDraft, patchRaw } from "../../store/actions";
import { useRecorder } from "../../services/recorder";
import { persistAudio } from "../../services/files";
import { fmtClock } from "../../lib/util";

/** 每 20 分鐘自動存一段,再接著錄下一段;中途當機或沒電時,已存的段落不會遺失 */
const SEGMENT_MS = 20 * 60 * 1000;
type Part = { uri: string; durationMs: number };

// S04 錄音(T-S04-01、T-S04-09~T-S04-12):標記重點、題庫自評勾選、暫停/停止;錄完才批次轉文字
export default function Recording() {
  const { visitId } = useLocalSearchParams<{ visitId: string }>();
  const s = useAppState();
  const v = visitById(s, visitId);
  const rec = useRecorder();
  const [marks, setMarks] = useState<number[]>(() => v?.raw.marks || []);
  const [checked, setChecked] = useState<string[]>(
    () => v?.raw.selfCheckedQuestionIds || [],
  );
  const [saving, setSaving] = useState(false);
  const [showQs, setShowQs] = useState(true);
  // 已存好的段落(包含上次中斷前存下的)
  const [parts, setParts] = useState<Part[]>(() => v?.raw.audioParts || []);
  const rotating = useRef<"idle" | "busy" | "cooldown">("idle");
  const savedMs = parts.reduce((n, p) => n + p.durationMs, 0);
  const totalMs = savedMs + rec.durationMs;

  const savePart = async (): Promise<Part[]> => {
    const { uri, durationMs } = await rec.stop();
    if (!uri || !v) return parts;
    const next = [
      ...parts,
      { uri: persistAudio(uri, `${v.id}_p${parts.length + 1}`), durationMs },
    ];
    setParts(next);
    patchRaw(v.id, {
      audioParts: next,
      audioUri: next[0].uri,
      audioDurationMs: next.reduce((n, p) => n + p.durationMs, 0),
      marks,
      selfCheckedQuestionIds: checked,
    });
    return next;
  };

  // 錄滿一段就自動存檔並接續錄音(中間只停頓不到一秒)
  useEffect(() => {
    // 新的一段開始計時後才解除(避免計時器尚未歸零時重複切段)
    if (rotating.current === "cooldown" && rec.durationMs < SEGMENT_MS)
      rotating.current = "idle";
    if (
      rec.phase !== "recording" ||
      rec.durationMs < SEGMENT_MS ||
      rotating.current !== "idle"
    )
      return;
    rotating.current = "busy";
    (async () => {
      await savePart();
      await rec.start();
      rotating.current = "cooldown";
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.durationMs, rec.phase]);

  if (!v) return null;
  const c = customerById(s, v.customerId);
  const set = setById(s, v.questionSetId);

  const finish = async () => {
    setSaving(true);
    const all =
      rec.phase === "recording" || rec.phase === "paused"
        ? await savePart()
        : parts;
    const total = all.reduce((n, p) => n + p.durationMs, 0);
    patchRaw(v.id, {
      audioParts: all,
      audioUri: all[0]?.uri,
      audioDurationMs: total,
      marks,
      selfCheckedQuestionIds: checked,
    });
    router.replace(`/visit/${v.id}/supplement`);
  };

  const onBack = async () => {
    const active = rec.phase === "recording" || rec.phase === "paused";
    if (active || parts.length) {
      const ok = await confirmDialog({
        title: "要放棄這段錄音嗎?",
        message: parts.length
          ? `已錄 ${fmtClock(totalMs)}。放棄後所有錄音都會刪除。`
          : "錄音尚未完成。放棄後錄音不會保存。",
        ok: "放棄錄音",
        cancel: "繼續錄音",
        danger: true,
      });
      if (!ok) return;
      if (active) await rec.stop();
    }
    discardDraft(v.id);
    router.back();
  };

  const recording = rec.phase === "recording";
  const started = rec.phase === "recording" || rec.phase === "paused";
  const resumable = !started && parts.length > 0; // 上次中斷,已有存好的段落

  return (
    <Screen
      bg="record"
      header={<Header title="錄音" sub={c?.name} onBack={onBack} />}
    >
      <View style={{ alignItems: "center", marginTop: SP.xl }}>
        <Chip
          label={
            v.raw.consent
              ? `已取得客戶同意・${v.raw.consent.version}`
              : "未取得同意"
          }
          tone={v.raw.consent ? "teal" : "red"}
          icon={v.raw.consent ? "check" : "warn"}
        />
        <View style={{ height: SP.lg }} />
        <TimerFrame ms={totalMs} />
        <Waveform active={recording} level={rec.level} />
        <RecordButton
          state={
            !v.raw.consent || rec.permission === "denied"
              ? "locked"
              : recording
                ? "recording"
                : "idle"
          }
          onPress={() => {
            if (!started) rec.start();
            else if (recording) finish();
            else rec.resume();
          }}
        />
        <Txt size={T.small} color={C.text2} style={{ marginTop: SP.sm }}>
          {resumable
            ? "點一下接續錄音"
            : !started
              ? "點一下開始錄音"
              : recording
                ? "點一下停止,下一步可補充資料"
                : "已暫停,點一下繼續"}
        </Txt>
        {parts.length ? (
          <Txt size={T.tiny + 1} color={C.text3} style={{ marginTop: 2 }}>
            已自動保存 {parts.length} 段(每 20 分鐘存一次)
          </Txt>
        ) : null}
      </View>
      {resumable ? (
        <Notice
          tone="yellow"
          text={`上次錄音中斷,已保存 ${fmtClock(savedMs)}。可以接續錄音,或直接按下方「停止錄音,下一步」用已保存的內容。`}
        />
      ) : null}

      {rec.permission === "denied" ? (
        <Notice
          tone="red"
          text="麥克風權限已關閉,無法錄音。請到手機設定開啟,或返回改用文字輸入。"
        />
      ) : null}
      {rec.error ? <Notice tone="red" text={rec.error} /> : null}

      <Row style={{ justifyContent: "center", marginTop: SP.lg }} gap={SP.md}>
        <Pressable
          disabled={!recording}
          onPress={() => setMarks((m) => [...m, Math.round(totalMs / 1000)])}
          style={({ pressed }) => [
            styles.ctl,
            !recording && { opacity: 0.4 },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Icon name="flag" size={22} color={C.yellow} />
          <Txt size={T.small} weight="600" style={{ marginTop: 4 }}>
            標記重點{marks.length ? `(${marks.length})` : ""}
          </Txt>
        </Pressable>
        <Pressable
          disabled={!started}
          onPress={() => (recording ? rec.pause() : rec.resume())}
          style={({ pressed }) => [
            styles.ctl,
            !started && { opacity: 0.4 },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Icon
            name={recording || !started ? "pause" : "play"}
            size={22}
            color={C.text}
          />
          <Txt size={T.small} weight="600" style={{ marginTop: 4 }}>
            {recording || !started ? "暫停" : "繼續"}
          </Txt>
        </Pressable>
        <Pressable
          disabled={(!started && !resumable) || saving}
          onPress={finish}
          style={({ pressed }) => [
            styles.ctl,
            !started && !resumable && { opacity: 0.4 },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Icon name="stop" size={22} color={C.red} />
          <Txt size={T.small} weight="600" style={{ marginTop: 4 }}>
            停止
          </Txt>
        </Pressable>
      </Row>
      {marks.length ? (
        <Txt
          size={T.tiny + 1}
          color={C.text3}
          center
          style={{ marginTop: SP.sm }}
        >
          已標記:{marks.map((m) => fmtClock(m * 1000).slice(3)).join("、")}
        </Txt>
      ) : null}

      <Txt
        size={T.small}
        color={C.text2}
        center
        style={{ marginTop: SP.lg, marginBottom: SP.lg }}
      >
        錄音完成後才會轉成文字。錄音中可以關掉螢幕省電(App 版)
      </Txt>

      {set ? (
        <Card>
          <Pressable
            onPress={() => setShowQs(!showQs)}
            style={{ flexDirection: "row", alignItems: "center" }}
          >
            <Txt weight="700" style={{ flex: 1 }}>
              題庫自評:已談到的題目({checked.length}/{set.items.length})
            </Txt>
            <Icon
              name="down"
              size={18}
              color={C.text2}
              style={{ transform: [{ rotate: showQs ? "180deg" : "0deg" }] }}
            />
          </Pressable>
          {showQs
            ? set.items.map((it) => {
                const q = questionById(s, it.questionId);
                const on = checked.includes(it.questionId);
                return (
                  <Checkbox
                    key={it.questionId}
                    checked={on}
                    onPress={() =>
                      setChecked((x) =>
                        on
                          ? x.filter((i) => i !== it.questionId)
                          : [...x, it.questionId],
                      )
                    }
                    label={`${q?.code} ${q?.text}`}
                    sub={it.required ? "必答" : "選答"}
                  />
                );
              })
            : null}
        </Card>
      ) : null}
      <Button
        title="停止錄音,下一步"
        variant="secondary"
        disabled={(!started && !resumable) || saving}
        loading={saving}
        onPress={finish}
        style={{ marginTop: SP.lg }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  ctl: {
    width: 96,
    height: 72,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: "rgba(9,33,43,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
});
