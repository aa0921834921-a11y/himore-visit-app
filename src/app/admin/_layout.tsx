import React from 'react';
import { Image, ImageBackground, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Redirect, Slot, router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BG, BRAND } from '../../assets';
import type { IconName } from '../../assets';
import { Button, Icon, Txt } from '../../components/ui';
import { useWide } from '../../components/admin';
import { confirmDialog } from '../../components/Dialog';
import { C, R, SP, T } from '../../theme';
import { useAppState } from '../../store/store';
import { currentUser } from '../../store/selectors';
import { logout } from '../../store/actions';

// 管理後台外框:頁首「業務管理平台|管理後台」+ 左側選單(F-005 一般 / F-006 選取);手機寬度時選單改為上方橫向捲動
const MENU: { href: string; label: string; icon: IconName }[] = [
  { href: '/admin', label: '首頁總覽', icon: 'home' },
  { href: '/admin/customers', label: '客戶管理', icon: 'customer' },
  { href: '/admin/questions', label: '題庫與題組', icon: 'bank' },
  { href: '/admin/schedule', label: '拜訪安排', icon: 'calendar' },
  { href: '/admin/visits', label: '拜訪紀錄與匯出', icon: 'csv' },
  { href: '/admin/usage', label: '使用狀況與帳號', icon: 'users' },
  { href: '/admin/settings', label: '系統設定', icon: 'gear' },
];

export default function AdminLayout() {
  const s = useAppState();
  const me = currentUser(s);
  const wide = useWide();
  const path = usePathname();
  const insets = useSafeAreaInsets();
  if (!me) return <Redirect href="/login" />;
  if (me.role !== 'admin') return <Redirect href="/home" />;

  const active = (href: string) =>
    href === '/admin' ? path === '/admin' || path === '/admin/' : path.startsWith(href) || (href === '/admin/visits' && (path.startsWith('/admin/review') || path.startsWith('/admin/followup')));
  const doLogout = async () => {
    if (await confirmDialog({ title: '登出管理後台?', ok: '登出' })) {
      logout();
      router.replace('/login');
    }
  };

  return (
    <ImageBackground source={BG.admin} style={{ flex: 1, backgroundColor: C.bg }} resizeMode="cover">
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Image source={BRAND.logo} style={{ width: 110, height: 110 / BRAND.logoRatio }} resizeMode="contain" />
        <Txt size={wide ? T.h3 : T.body} weight="700" style={{ marginLeft: SP.md, flex: 1 }} numberOfLines={1}>
          業務管理平台|管理後台
        </Txt>
        {wide ? (
          <Txt size={T.small} color={C.text2} style={{ marginRight: SP.sm }}>
            {me.name}(管理者)
          </Txt>
        ) : null}
        <Button title="登出" small full={false} variant="secondary" onPress={doLogout} />
      </View>
      <View style={{ flex: 1, flexDirection: wide ? 'row' : 'column' }}>
        {wide ? (
          <View style={styles.side}>
            {MENU.map((m) => {
              const on = active(m.href);
              return (
                <Pressable key={m.href} onPress={() => router.push(m.href as never)} style={[styles.menuItem, on && styles.menuOn]}>
                  {on ? <View style={styles.menuBar} /> : null}
                  <Icon name={m.icon} size={20} color={on ? C.teal : C.text2} />
                  <Txt weight={on ? '700' : '500'} color={on ? C.text : C.text2} style={{ marginLeft: SP.md }}>
                    {m.label}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.lineSoft }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: SP.sm, gap: SP.sm }}>
              {MENU.map((m) => {
                const on = active(m.href);
                return (
                  <Pressable key={m.href} onPress={() => router.push(m.href as never)} style={[styles.chip, on && styles.chipOn]}>
                    <Icon name={m.icon} size={16} color={on ? C.white : C.text2} />
                    <Txt size={T.small} weight={on ? '700' : '500'} color={on ? C.white : C.text2} style={{ marginLeft: 6 }}>
                      {m.label}
                    </Txt>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: wide ? SP.xxl : SP.lg, paddingBottom: SP.xxl + insets.bottom }} keyboardShouldPersistTaps="handled">
          <Slot />
        </ScrollView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SP.lg,
    paddingBottom: 8,
    backgroundColor: 'rgba(7,24,32,0.92)',
    borderBottomWidth: 1,
    borderBottomColor: C.lineSoft,
  },
  side: { width: 236, paddingVertical: SP.lg, paddingHorizontal: SP.md, borderRightWidth: 1, borderRightColor: C.lineSoft, backgroundColor: 'rgba(7,24,32,0.7)' },
  menuItem: { flexDirection: 'row', alignItems: 'center', height: 46, borderRadius: R.md, paddingHorizontal: SP.md, marginBottom: 4, overflow: 'hidden', backgroundColor: 'rgba(138,155,162,0.06)' },
  menuOn: { backgroundColor: 'rgba(0,214,198,0.16)' },
  menuBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: C.teal },
  chip: { flexDirection: 'row', alignItems: 'center', height: 34, borderRadius: R.pill, paddingHorizontal: 12, borderWidth: 1, borderColor: C.line },
  chipOn: { backgroundColor: C.orange, borderColor: C.orange },
});
