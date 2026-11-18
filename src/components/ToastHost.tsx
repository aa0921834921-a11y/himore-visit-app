import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { dismissToast, useToasts } from '../store/store';
import { C, MAX_PHONE_WIDTH, R, SP, T } from '../theme';
import { Icon, Txt } from './ui';

/** 畫面上方的提示訊息(代替推播:處理完成、上傳狀態等) */
export function ToastHost() {
  const toasts = useToasts();
  const insets = useSafeAreaInsets();
  if (!toasts.length) return null;
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + 8 }]}>
      {toasts.map((t) => {
        const color = t.tone === 'success' ? C.teal : t.tone === 'error' ? C.red : t.tone === 'warn' ? C.yellow : C.metal;
        return (
          <Pressable
            key={t.id}
            onPress={() => {
              dismissToast(t.id);
              if (t.action) router.push(t.action.href as never);
            }}
            style={[styles.toast, { borderColor: color }]}
          >
            <Icon name={t.tone === 'success' ? 'check' : t.tone === 'error' ? 'warn' : 'bell'} size={18} color={color} style={{ marginRight: 10 }} />
            <Txt size={T.small} style={{ flex: 1 }}>
              {t.text}
            </Txt>
            {t.action ? (
              <Txt size={T.small} weight="700" color={color} style={{ marginLeft: 8 }}>
                {t.action.label}
              </Txt>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: SP.md, zIndex: 1000 },
  toast: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? MAX_PHONE_WIDTH - 24 : undefined,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(7,24,32,0.97)',
    borderWidth: 1,
    borderRadius: R.lg,
    paddingHorizontal: SP.lg,
    paddingVertical: SP.md,
    marginBottom: SP.sm,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
});
