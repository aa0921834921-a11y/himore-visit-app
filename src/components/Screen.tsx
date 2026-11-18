import React from 'react';
import { ImageBackground, KeyboardAvoidingView, Platform, ScrollView, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BG } from '../assets';
import { C, MAX_PHONE_WIDTH, SP, T } from '../theme';
import { IconButton, Txt } from './ui';

type BgKey = keyof typeof BG;

/** 手機畫面外框:背景圖(G 類)、安全區域、網頁版置中為手機寬度 */
export function Screen({
  children,
  bg = 'base',
  scroll = true,
  header,
  footer,
  contentStyle,
  padded = true,
  bottomInset = true,
}: {
  children: React.ReactNode;
  bg?: BgKey;
  scroll?: boolean;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  padded?: boolean;
  bottomInset?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const pad: ViewStyle = padded ? { paddingHorizontal: SP.lg } : {};
  return (
    <View style={styles.root}>
      <ImageBackground source={BG[bg]} style={styles.frame} resizeMode="cover">
        <View style={{ height: insets.top }} />
        {header}
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {scroll ? (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={[pad, { paddingBottom: footer ? SP.lg : SP.xxl + (bottomInset ? insets.bottom : 0) }, contentStyle]}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
          ) : (
            <View style={[{ flex: 1 }, pad, contentStyle]}>{children}</View>
          )}
          {footer ? <View style={[styles.footer, { paddingBottom: (bottomInset ? insets.bottom : 0) + SP.md }]}>{footer}</View> : null}
        </KeyboardAvoidingView>
      </ImageBackground>
    </View>
  );
}

/** 頁首列(A-10):左返回、中標題、右側動作 */
export function Header({ title, onBack, right, back = true, sub }: { title: string; onBack?: () => void; right?: React.ReactNode; back?: boolean; sub?: string }) {
  return (
    <View style={styles.header}>
      <View style={styles.side}>
        {back ? <IconButton name="back" label="返回" onPress={onBack || (() => (router.canGoBack() ? router.back() : router.replace('/')))} /> : null}
      </View>
      <View style={{ flex: 1, alignItems: 'center' }}>
        <Txt size={T.h3} weight="700" numberOfLines={1}>
          {title}
        </Txt>
        {sub ? (
          <Txt size={T.tiny} color={C.text2} numberOfLines={1}>
            {sub}
          </Txt>
        ) : null}
      </View>
      <View style={[styles.side, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#03090C', alignItems: 'center' },
  frame: { flex: 1, width: '100%', maxWidth: Platform.OS === 'web' ? MAX_PHONE_WIDTH : undefined, backgroundColor: C.bg, overflow: 'hidden' },
  header: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    backgroundColor: 'rgba(7,24,32,0.82)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.lineSoft,
  },
  side: { width: 64, justifyContent: 'center' },
  footer: {
    paddingHorizontal: SP.lg,
    paddingTop: SP.md,
    backgroundColor: 'rgba(7,24,32,0.94)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.lineSoft,
    gap: SP.sm,
  },
});
