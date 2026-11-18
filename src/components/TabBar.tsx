import React from 'react';
import { Image, ImageSourcePropType, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { NAV } from '../assets';
import { C, T } from '../theme';
import { Txt } from './ui';

// 底部導覽(A-05 底板、A-06 未選取、A-07 選取、A-08/A-09 中央記錄按鈕):首頁|客戶|記錄|我的

type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigateToTab: (routeKey: string) => void;
};

const TABS: Record<string, { label: string; on: ImageSourcePropType; off: ImageSourcePropType }> = {
  home: { label: '首頁', on: NAV.homeOn, off: NAV.homeOff },
  customers: { label: '客戶', on: NAV.customersOn, off: NAV.customersOff },
  me: { label: '我的', on: NAV.meOn, off: NAV.meOff },
};

export function TabBar({ state, navigateToTab }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const current = state.routes[state.index]?.name;
  const item = (name: string) => {
    const t = TABS[name];
    const route = state.routes.find((r) => r.name === name);
    if (!t || !route) return null;
    const on = current === name;
    return (
      <Pressable key={name} style={styles.item} onPress={() => navigateToTab(route.key)} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={t.label}>
        <Image source={on ? t.on : t.off} style={{ width: 28, height: 28 }} />
        <Txt size={T.tiny} weight={on ? '700' : '500'} color={on ? C.orange : C.text2} style={{ marginTop: 2 }}>
          {t.label}
        </Txt>
      </Pressable>
    );
  };
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {item('home')}
      {item('customers')}
      <Pressable style={styles.item} onPress={() => router.push('/record/start')} accessibilityRole="button" accessibilityLabel="記錄">
        {({ pressed }) => (
          <>
            <Image source={pressed ? NAV.recordButtonPressed : NAV.recordButton} style={styles.center} />
            <Txt size={T.tiny} weight="600" color={C.text2} style={{ marginTop: 2 }}>
              記錄
            </Txt>
          </>
        )}
      </Pressable>
      {item('me')}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingTop: 8,
    backgroundColor: 'rgba(7,24,32,0.97)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(138,155,162,0.35)',
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  center: { width: 58, height: 58, marginTop: -26 },
});
