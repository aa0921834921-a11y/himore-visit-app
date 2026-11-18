import React from 'react';
import { Image, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import * as Sharing from 'expo-sharing';
import { Icon, IconButton, Txt } from './ui';
import { C, R, SP, T } from '../theme';
import type { Attachment } from '../types';
import { fmtBytes } from '../services/files';

export async function openAttachment(a: Attachment) {
  try {
    if (Platform.OS === 'web') {
      await Linking.openURL(a.uri);
      return;
    }
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(a.uri, { mimeType: a.mimeType, dialogTitle: a.name });
  } catch {
    // 檔案已不存在
  }
}

/** 照片縮圖+檔案清單 */
export function AttachmentList({ items, onRemove }: { items: Attachment[]; onRemove?: (id: string) => void }) {
  const photos = items.filter((a) => a.kind === 'photo');
  const files = items.filter((a) => a.kind === 'file');
  if (!items.length) return null;
  return (
    <View>
      {photos.length ? (
        <View style={styles.grid}>
          {photos.map((p) => (
            <Pressable key={p.id} onPress={() => openAttachment(p)} style={styles.thumb}>
              <Image source={{ uri: p.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              {onRemove ? (
                <Pressable onPress={() => onRemove(p.id)} style={styles.remove} hitSlop={6} accessibilityLabel="移除照片">
                  <Txt size={12} weight="700" color={C.white}>
                    ✕
                  </Txt>
                </Pressable>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}
      {files.map((f) => (
        <Pressable key={f.id} onPress={() => openAttachment(f)} style={styles.file}>
          <Icon name="attach" size={20} color={C.teal} />
          <View style={{ flex: 1, marginLeft: SP.sm }}>
            <Txt size={T.small} weight="600" numberOfLines={1}>
              {f.name}
            </Txt>
            {f.size ? (
              <Txt size={T.tiny + 1} color={C.text3}>
                {fmtBytes(f.size)}
              </Txt>
            ) : null}
          </View>
          {onRemove ? <IconButton name="trash" size={16} color={C.text3} label="移除檔案" onPress={() => onRemove(f.id)} /> : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm, marginBottom: SP.sm },
  thumb: { width: 92, height: 92, borderRadius: R.md, overflow: 'hidden', backgroundColor: C.surface2, borderWidth: 1, borderColor: C.line },
  remove: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' },
  file: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.line, borderRadius: R.md, paddingHorizontal: SP.md, paddingVertical: SP.sm, marginBottom: SP.sm, backgroundColor: 'rgba(9,33,43,0.9)' },
});
