import React from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Header, Screen } from "../../components/Screen";
import { Button, Card, Chip, Icon, Row, Txt } from "../../components/ui";
import { C, SP, T } from "../../theme";
import { useAppState } from "../../store/store";
import { customerById, visitById } from "../../store/selectors";
import { discardDraft, patchVisit, recordConsent } from "../../store/actions";

// S04 錄音同意(T-S04-03、T-S04-05、T-S04-06):開始錄音前的必經關卡,紀錄時間、操作人與文字版本
export default function Consent() {
  const { visitId } = useLocalSearchParams<{ visitId: string }>();
  const s = useAppState();
  const v = visitById(s, visitId);
  const c = customerById(s, v?.customerId);
  if (!v) return null;

  return (
    <Screen
      bg="record"
      header={
        <Header
          title="錄音"
          onBack={() => {
            discardDraft(v.id);
            router.back();
          }}
        />
      }
      footer={
        <>
          <Button
            title="已取得客戶同意"
            icon="check"
            onPress={() => {
              recordConsent(v.id);
              router.replace({
                pathname: "/record/recording",
                params: { visitId: v.id },
              });
            }}
          />
          <Button
            title="客戶不同意,改用口述"
            variant="secondary"
            onPress={() => {
              patchVisit(v.id, { source: "dictation" });
              router.replace({
                pathname: "/record/dictate",
                params: { visitId: v.id },
              });
            }}
          />
        </>
      }
    >
      <View
        style={{ alignItems: "center", marginTop: SP.xxl, marginBottom: SP.xl }}
      >
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: 48,
            borderWidth: 1,
            borderColor: C.tealLine,
            backgroundColor: C.tealDim,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="mic" size={48} color={C.teal} />
        </View>
      </View>
      <Card tone="accent">
        <Row style={{ justifyContent: "space-between", marginBottom: SP.sm }}>
          <Txt size={T.h3} weight="700">
            錄音同意聲明
          </Txt>
          <Chip label={`版本 ${s.settings.consentVersion}`} tone="gray" />
        </Row>
        <Txt style={{ lineHeight: 24 }}>{s.settings.consentText}</Txt>
        {c ? (
          <Txt size={T.small} color={C.text2} style={{ marginTop: SP.md }}>
            客戶:{c.name}
          </Txt>
        ) : null}
      </Card>
      <Txt size={T.small} color={C.text3} style={{ marginTop: SP.lg }}>
        按下「已取得客戶同意」後,系統會記錄同意時間、操作人與聲明版本,才會開始錄音。
      </Txt>
    </Screen>
  );
}
