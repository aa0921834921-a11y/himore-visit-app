import React, { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../components/Screen';
import { Button, Card, Field, Txt } from '../components/ui';
import { BRAND } from '../assets';
import { C, SP, T } from '../theme';
import { login } from '../store/actions';
import { useAppState } from '../store/store';

// S01 登入(文案 T-S01-02~T-S01-14)
export default function LoginScreen() {
  const s = useAppState();
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = () => {
    const r = login(account, password);
    if (!r.ok) {
      setError('帳號或密碼錯誤,請再試一次');
      return;
    }
    setError('');
    if (r.user.role === 'admin') router.replace('/admin');
    else router.replace(s.onboarded ? '/home' : '/onboarding');
  };

  return (
    <Screen bg="login" contentStyle={{ flexGrow: 1, justifyContent: 'center' }}>
      <View style={{ alignItems: 'center', marginTop: SP.xxl, marginBottom: SP.xxl }}>
        <Image source={BRAND.logo} style={{ width: 220, height: 220 / BRAND.logoRatio }} resizeMode="contain" accessibilityLabel="HI-MORE" />
        <Txt size={T.h2} weight="700" style={{ marginTop: SP.xl }}>
          登入哈鏌業務拜訪紀錄
        </Txt>
      </View>

      <Field label="企業帳號" placeholder="請輸入企業帳號" value={account} onChangeText={setAccount} autoCapitalize="none" autoCorrect={false} error={error ? ' ' : undefined} />
      <Field label="密碼" placeholder="請輸入密碼" value={password} onChangeText={setPassword} secureTextEntry onSubmitEditing={submit} error={error || undefined} />

      <Button title="登入" onPress={submit} disabled={!account || !password} style={{ marginTop: SP.sm }} />

      <Pressable onPress={() => router.push('/onboarding')} style={{ alignSelf: 'center', padding: SP.md, marginTop: SP.sm }}>
        <Txt color={C.teal} weight="600">
          首次使用?開始初始設定
        </Txt>
      </Pressable>

      {s.settings.demoMode ? (
        <Card tone="plain" style={{ marginTop: SP.lg }}>
          <Txt size={T.small} color={C.text2}>
            示範帳號(密碼皆為 1234)
          </Txt>
          <Txt size={T.small} color={C.text}>
            業務:wang(王大明)、lin(林志偉)|管理者:admin(陳美玲)
          </Txt>
        </Card>
      ) : null}

      <Txt size={T.tiny + 1} color={C.text3} center style={{ marginTop: SP.xl }}>
        僅限哈鏌授權人員使用
      </Txt>
    </Screen>
  );
}
