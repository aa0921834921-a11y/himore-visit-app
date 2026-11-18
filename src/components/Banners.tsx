import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppState, useOnline } from '../store/store';
import { currentUser, pendingUploads } from '../store/selectors';
import { C, R, SP, T } from '../theme';
import { Icon, Txt } from './ui';
import { ProgressBar } from './Ring';

/** 離線提示(A-12)與自動補傳提示(A-13) */
export function NetworkBanner() {
  const online = useOnline();
  const s = useAppState();
  const me = currentUser(s);
  const pend = pendingUploads(s, me?.id);
  const uploading = pend.filter((v) => v.upload === 'uploading').length;
  if (!online) {
    return (
      <View style={[styles.banner, { borderColor: C.red, backgroundColor: 'rgba(38,16,20,0.92)' }]}>
        <Icon name="offline" size={20} color="#FF6B66" style={{ marginRight: 10 }} />
        <View style={{ flex: 1 }}>
          <Txt size={T.small} weight="700">
            目前離線
          </Txt>
          <Txt size={T.tiny + 1} color={C.text2}>
            紀錄會先存在手機,恢復連線後自動補傳{pend.length ? `(${pend.length} 筆待補傳)` : ''}
          </Txt>
        </View>
      </View>
    );
  }
  if (uploading || pend.some((v) => v.upload === 'pending')) {
    return (
      <View style={[styles.banner, { borderColor: C.teal, backgroundColor: 'rgba(6,34,40,0.92)' }]}>
        <Icon name="upload" size={20} color={C.teal} style={{ marginRight: 10 }} />
        <View style={{ flex: 1 }}>
          <Txt size={T.small} weight="700">
            自動補傳中
          </Txt>
          <Txt size={T.tiny + 1} color={C.text2} style={{ marginBottom: 6 }}>
            {pend.length} 筆紀錄上傳中,請勿刪除 App
          </Txt>
          <ProgressBar value={1} total={Math.max(2, pend.length + 1)} />
        </View>
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: R.lg, padding: SP.md, marginBottom: SP.md },
});
