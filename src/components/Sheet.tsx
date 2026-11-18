import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, MAX_PHONE_WIDTH, R, SP, T } from '../theme';
import { IconButton, Txt } from './ui';

/** 底部彈出卡(D-007):上方圓角、頂部握把 */
export function Sheet({
  visible,
  onClose,
  title,
  children,
  footer,
  maxHeight = '86%',
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxHeight?: `${number}%`;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="關閉" />
        <View style={[styles.sheet, { maxHeight, paddingBottom: insets.bottom + SP.md }]}>
          <View style={styles.handle} />
          {title ? (
            <View style={styles.titleRow}>
              <Txt size={T.h3} weight="700" style={{ flex: 1 }}>
                {title}
              </Txt>
              <IconButton name="back" onPress={onClose} label="關閉" style={{ transform: [{ rotate: '-90deg' }] }} />
            </View>
          ) : null}
          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: SP.lg, paddingBottom: SP.md }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View style={{ paddingHorizontal: SP.lg, paddingTop: SP.sm, gap: SP.sm }}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: C.overlay },
  sheet: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? MAX_PHONE_WIDTH : undefined,
    backgroundColor: C.bg,
    borderTopLeftRadius: R.xl + 4,
    borderTopRightRadius: R.xl + 4,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: C.line,
    paddingTop: SP.sm,
  },
  handle: { alignSelf: 'center', width: 52, height: 5, borderRadius: 3, backgroundColor: C.metal, marginBottom: SP.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: SP.lg, paddingRight: SP.xs, marginBottom: SP.xs },
});
