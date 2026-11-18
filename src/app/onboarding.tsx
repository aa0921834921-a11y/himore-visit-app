import React, { useState } from 'react';
import { Image, Platform, View } from 'react-native';
import { router } from 'expo-router';
import { requestRecordingPermissionsAsync } from 'expo-audio';
import { Screen } from '../components/Screen';
import { Button, Card, Icon, Row, Toggle, Txt } from '../components/ui';
import { BRAND } from '../assets';
import { C, SP, T } from '../theme';
import { setOnboarded, updateSettings } from '../store/actions';
import { useAppState } from '../store/store';
import { currentUser } from '../store/selectors';
import type { IconName } from '../assets';

// S01 首次設定:3 張可略過的導覽卡片 + 先說明用途再詢問麥克風與通知權限

const CARDS: { icon: IconName; title: string; body: string }[] = [
  { icon: 'folder', title: '拜訪前,先看簡報', body: '避免事項、上次重點、未完成承諾與待問題目,出發前一頁看完。' },
  { icon: 'dictate', title: '拜訪後,兩次點擊開始記錄', body: '可以現場錄音(需客戶同意)、拜訪後口述,或直接打字。' },
  { icon: 'ai', title: 'AI 整理,由你確認後入庫', body: 'AI 整理重點、比對題庫;你確認過的內容才會寫入客戶檔案。' },
];

export default function Onboarding() {
  const s = useAppState();
  const me = currentUser(s);
  const [step, setStep] = useState(0);
  const [mic, setMic] = useState<'unknown' | 'granted' | 'denied'>('unknown');

  const finish = () => {
    setOnboarded();
    router.replace(me ? (me.role === 'admin' ? '/admin' : '/home') : '/login');
  };

  const askMic = async () => {
    try {
      const r = await requestRecordingPermissionsAsync();
      setMic(r.granted ? 'granted' : 'denied');
    } catch {
      setMic('denied');
    }
  };

  if (step < CARDS.length) {
    const c = CARDS[step];
    return (
      <Screen bg="login" contentStyle={{ flexGrow: 1 }}>
        <Row style={{ justifyContent: 'space-between', marginTop: SP.lg }}>
          <Image source={BRAND.logo} style={{ width: 120, height: 120 / BRAND.logoRatio }} resizeMode="contain" />
          <Button title="略過" variant="ghost" small full={false} onPress={() => setStep(CARDS.length)} />
        </Row>
        <View style={{ flex: 1, justifyContent: 'center', paddingVertical: SP.xxl }}>
          <View style={{ alignItems: 'center', marginBottom: SP.xl }}>
            <View style={{ width: 120, height: 120, borderRadius: 60, borderWidth: 1, borderColor: C.tealLine, backgroundColor: C.tealDim, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={c.icon} size={60} color={C.teal} />
            </View>
          </View>
          <Txt size={T.h1} weight="700" center>
            {c.title}
          </Txt>
          <Txt color={C.text2} center style={{ marginTop: SP.md, paddingHorizontal: SP.lg }}>
            {c.body}
          </Txt>
        </View>
        <Row style={{ justifyContent: 'center', marginBottom: SP.lg }}>
          {CARDS.map((_, i) => (
            <View key={i} style={{ width: i === step ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: i === step ? C.orange : C.metal }} />
          ))}
        </Row>
        <Button title={step === CARDS.length - 1 ? '下一步:權限設定' : '下一張'} onPress={() => setStep(step + 1)} />
      </Screen>
    );
  }

  return (
    <Screen bg="login">
      <Txt size={T.h1} weight="700" style={{ marginTop: SP.xxl, marginBottom: SP.sm }}>
        初始設定
      </Txt>
      <Txt color={C.text2} style={{ marginBottom: SP.xl }}>
        先說明用途,再請你授權。之後都可以在手機設定中調整。
      </Txt>

      <Card style={{ marginBottom: SP.md }}>
        <Row style={{ alignItems: 'flex-start' }}>
          <Icon name="mic" size={28} color={C.teal} />
          <View style={{ flex: 1 }}>
            <Txt weight="700">麥克風</Txt>
            <Txt size={T.small} color={C.text2}>
              麥克風:用於錄音與口述記錄。拒絕後仍可用文字記錄。
            </Txt>
          </View>
        </Row>
        <View style={{ marginTop: SP.md }}>
          {mic === 'granted' ? (
            <Txt color={C.teal} weight="600">
              已允許
            </Txt>
          ) : mic === 'denied' ? (
            <Txt size={T.small} color={C.yellow}>
              未允許。仍可使用文字記錄;如需錄音,請到手機設定開啟麥克風權限。
            </Txt>
          ) : (
            <Button title="允許使用麥克風" variant="secondary" small onPress={askMic} />
          )}
        </View>
      </Card>

      <Card style={{ marginBottom: SP.xl }}>
        <Row style={{ alignItems: 'flex-start' }}>
          <Icon name="bell" size={28} color={C.teal} />
          <View style={{ flex: 1 }}>
            <Txt weight="700">通知</Txt>
            <Txt size={T.small} color={C.text2}>
              通知:處理完成與待確認提醒。可稍後在設定調整。
            </Txt>
          </View>
          <Toggle value={s.settings.notifyEnabled} onChange={(v) => updateSettings({ notifyEnabled: v })} />
        </Row>
        {Platform.OS !== 'web' ? (
          <Txt size={T.tiny + 1} color={C.text3} style={{ marginTop: SP.sm }}>
            POC 版以 App 內提示通知;系統推播待正式版接上伺服器後開啟。
          </Txt>
        ) : null}
      </Card>

      <Button title="開始使用" onPress={finish} />
    </Screen>
  );
}
