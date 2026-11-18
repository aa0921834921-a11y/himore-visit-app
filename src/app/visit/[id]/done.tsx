import React from 'react';
import { Image, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Header, Screen } from '../../../components/Screen';
import { Button, Card, Notice, Txt } from '../../../components/ui';
import { STATE } from '../../../assets';
import { C, SP, T } from '../../../theme';
import { showToast, useAppState } from '../../../store/store';
import { confirmedVisitsOf, customerById, visitById } from '../../../store/selectors';
import { audit } from '../../../store/actions';
import { copyText, visitToText } from '../../../services/export';

// S10 完成與匯出(T-S10-01~T-S10-08):手機端只提供「複製文字」;CSV 由管理者在後台下載
export default function Done() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useAppState();
  const v = visitById(s, id);
  if (!v) return null;
  const c = customerById(s, v.customerId);
  const becameRepeat = v.visitType === '初次' && c && confirmedVisitsOf(s, c.id).length >= 1;

  return (
    <Screen bg="base" header={<Header title="完成" back={false} />}>
      <View style={{ alignItems: 'center', marginTop: SP.xxl }}>
        <Image source={STATE.badge} style={{ width: 120, height: 120 }} />
        <Txt size={T.h2} weight="700" style={{ marginTop: SP.lg }}>
          紀錄已確認並入庫
        </Txt>
        <Txt color={C.text2} center style={{ marginTop: SP.sm, paddingHorizontal: SP.lg }}>
          本次拜訪紀錄已寫入客戶檔案,下次拜訪簡報將引用此內容。
        </Txt>
      </View>
      <Card style={{ marginTop: SP.xl }}>
        <Txt weight="700">{c?.name || '—'}</Txt>
        <Txt size={T.small} color={C.text2}>
          {v.code}
        </Txt>
        {becameRepeat ? (
          <Txt size={T.small} color={C.teal} style={{ marginTop: SP.sm }}>
            客戶類型已更新為「複訪」
          </Txt>
        ) : null}
      </Card>
      <View style={{ gap: SP.md, marginTop: SP.xl }}>
        <Button
          title="複製文字"
          icon="paste"
          variant="secondary"
          onPress={async () => {
            await copyText(visitToText(s, v));
            audit('export', `複製文字 ${v.code}`, { visitId: v.id, customerId: v.customerId });
            showToast('已複製到剪貼簿', 'success');
          }}
        />
        <Notice tone="gray" icon="csv" text="CSV 由管理者在後台下載" />
        {c ? <Button title="前往客戶檔案" onPress={() => router.replace(`/customer/${c.id}`)} /> : null}
        <Button title="回首頁" variant="ghost" onPress={() => router.replace('/home')} />
      </View>
    </Screen>
  );
}
