import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { Header, Screen } from "../../components/Screen";
import { Button, Card, Chip, Field, Icon, Row, Txt } from "../../components/ui";
import { confirmDialog } from "../../components/Dialog";
import { C, SP, T } from "../../theme";
import { showToast, useAppState } from "../../store/store";
import {
  customerById,
  questionById,
  setById,
  visitById,
} from "../../store/selectors";
import { discardDraft, patchRaw } from "../../store/actions";
import { DEMO_TEXT } from "../../services/ai";

const LIMIT = 2000;

// S06 文字輸入(T-S06-01~T-S06-10):支援貼上、題庫輔助可展開;照片與附件在 POC 先隱藏
export default function TextInputScreen() {
  const { visitId } = useLocalSearchParams<{ visitId: string }>();
  const s = useAppState();
  const v = visitById(s, visitId);
  const [text, setText] = useState(v?.raw.text || "");
  const [assist, setAssist] = useState(false);
  if (!v) return null;
  const c = customerById(s, v.customerId);
  const set = setById(s, v.questionSetId);

  const paste = async () => {
    try {
      const t = await Clipboard.getStringAsync();
      if (!t) {
        showToast("剪貼簿沒有文字", "warn");
        return;
      }
      setText((x) => (x ? `${x}\n${t}` : t).slice(0, LIMIT));
    } catch {
      showToast("無法讀取剪貼簿", "warn");
    }
  };

  const clear = async () => {
    if (!text) return;
    if (
      await confirmDialog({ title: "清除全部內容?", ok: "清除", danger: true })
    )
      setText("");
  };

  const done = () => {
    patchRaw(v.id, { text: text.trim() });
    router.replace(`/visit/${v.id}/supplement`);
  };

  const onBack = async () => {
    if (text.trim()) {
      const ok = await confirmDialog({
        title: "要放棄這段內容嗎?",
        message: "尚未送出的文字不會保存。",
        ok: "放棄",
        cancel: "繼續編輯",
        danger: true,
      });
      if (!ok) return;
    }
    discardDraft(v.id);
    router.back();
  };

  return (
    <Screen
      bg="base"
      header={<Header title="文字輸入" sub={c?.name} onBack={onBack} />}
      footer={
        <Button
          title="完成"
          icon="check"
          disabled={!text.trim()}
          onPress={done}
        />
      }
    >
      <Row
        style={{
          justifyContent: "space-between",
          marginTop: SP.lg,
          marginBottom: SP.md,
        }}
      >
        <Chip label="業務口述" tone="orange" icon="text" />
        {s.settings.demoMode ? (
          <Pressable onPress={() => setText(DEMO_TEXT)}>
            <Txt size={T.small} color={C.teal}>
              填入示範內容
            </Txt>
          </Pressable>
        ) : null}
      </Row>
      <Field
        placeholder="請輸入本次拜訪內容、重點或補充說明…"
        multiline
        value={text}
        onChangeText={(t) => setText(t.slice(0, LIMIT))}
        inputStyle={{ minHeight: 260 }}
        style={{ marginBottom: SP.xs }}
      />
      <Row style={{ justifyContent: "space-between", marginBottom: SP.lg }}>
        <Row gap={SP.lg}>
          <Pressable
            onPress={paste}
            style={{ flexDirection: "row", alignItems: "center" }}
            accessibilityRole="button"
          >
            <Icon name="paste" size={18} color={C.teal} />
            <Txt size={T.small} color={C.teal} style={{ marginLeft: 4 }}>
              貼上
            </Txt>
          </Pressable>
          <Pressable
            onPress={clear}
            style={{ flexDirection: "row", alignItems: "center" }}
            accessibilityRole="button"
          >
            <Icon name="trash" size={18} color={C.text2} />
            <Txt size={T.small} color={C.text2} style={{ marginLeft: 4 }}>
              清除
            </Txt>
          </Pressable>
        </Row>
        <Txt
          size={T.small}
          color={text.length > LIMIT * 0.9 ? C.yellow : C.text3}
        >
          {text.length.toLocaleString()} / {LIMIT.toLocaleString()}
        </Txt>
      </Row>

      {set ? (
        <Card>
          <Pressable
            onPress={() => setAssist(!assist)}
            style={{ flexDirection: "row", alignItems: "center" }}
          >
            <Icon
              name="bank"
              size={20}
              color={C.teal}
              style={{ marginRight: 8 }}
            />
            <Txt weight="700" style={{ flex: 1 }}>
              題庫輔助:{set.name}
            </Txt>
            <Icon
              name="down"
              size={18}
              color={C.text2}
              style={{ transform: [{ rotate: assist ? "180deg" : "0deg" }] }}
            />
          </Pressable>
          {assist ? (
            <View style={{ marginTop: SP.sm }}>
              <Txt
                size={T.tiny + 1}
                color={C.text3}
                style={{ marginBottom: SP.xs }}
              >
                點題目可插入到內容中,方便逐題填寫
              </Txt>
              {set.items.map((it) => {
                const q = questionById(s, it.questionId);
                return (
                  <Pressable
                    key={it.questionId}
                    onPress={() =>
                      setText((x) =>
                        `${x}${x && !x.endsWith("\n") ? "\n" : ""}${q?.text}:`.slice(
                          0,
                          LIMIT,
                        ),
                      )
                    }
                    style={{
                      paddingVertical: 8,
                      flexDirection: "row",
                      alignItems: "center",
                    }}
                  >
                    <Txt size={T.small} color={C.text} style={{ flex: 1 }}>
                      {q?.code} {q?.text}
                    </Txt>
                    {it.required ? <Chip label="必答" tone="orange" /> : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </Card>
      ) : null}
    </Screen>
  );
}
