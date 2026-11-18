import React, { useMemo } from 'react';
import { Image, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { Screen } from '../../components/Screen';
import { Button, Card, Icon, ListRow, Row, SectionTitle, Toggle, Txt } from '../../components/ui';
import { alertDialog, confirmDialog, promptDialog } from '../../components/Dialog';
import { BRAND } from '../../assets';
import { C, SP, T } from '../../theme';
import { showToast, useAppState, useOnline } from '../../store/store';
import { currentUser, pendingUploads } from '../../store/selectors';
import { logout, updateSettings, upsertUser } from '../../store/actions';
import { audioUsageBytes, fmtBytes } from '../../services/files';
import { resumeAll } from '../../services/processing';
import { ai } from '../../services/ai';

// S18 我的與設定(文案 T-S18-01~T-S18-11)
export default function Me() {
  const s = useAppState();
  const online = useOnline();
  const me = currentUser(s);
  const visitCount = s.visits.length;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const usage = useMemo(() => audioUsageBytes(), [visitCount]);
  if (!me) return null;
  const pend = pendingUploads(s, me.id);
  const drafts = s.visits.filter((v) => v.salesId === me.id && (v.status === 'draft' || v.status === 'processing'));

  const doLogout = async () => {
    if (pend.length || drafts.length) {
      const ok = await confirmDialog({
        title: '還有未上傳的內容',
        message: `有 ${pend.length + drafts.length} 筆紀錄尚未上傳或處理完成。登出後仍會保留在這支手機,但要重新登入才能繼續。確定登出?`,
        ok: '仍要登出',
        danger: true,
      });
      if (!ok) return;
    }
    logout();
    router.replace('/login');
  };

  const changePassword = async () => {
    const pw = await promptDialog({ title: '變更密碼', message: '請輸入新密碼(至少 4 碼)', placeholder: '新密碼' });
    if (pw === null) return;
    if (pw.length < 4) {
      alertDialog('密碼太短', '請至少輸入 4 碼。');
      return;
    }
    upsertUser({ ...me, password: pw });
    showToast('密碼已更新', 'success');
  };

  return (
    <Screen bg="base" bottomInset={false}>
      <Txt size={T.h1} weight="700" style={{ marginTop: SP.md, marginBottom: SP.md }}>
        我的
      </Txt>
      <Card>
        <Row>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.tealDim, borderColor: C.tealLine, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="user" size={28} color={C.teal} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt size={T.h3} weight="700">
              {me.name}
            </Txt>
            <Txt size={T.small} color={C.text2}>
              {me.team}・{me.account}
            </Txt>
          </View>
        </Row>
      </Card>

      <SectionTitle title="設定" />
      <ListRow title="個人設定" sub="變更密碼" left={<Icon name="user" size={20} color={C.text2} />} onPress={changePassword} />
      <ListRow
        title="通知設定"
        sub="處理完成與待確認提醒"
        left={<Icon name="bell" size={20} color={C.text2} />}
        right={<Toggle value={s.settings.notifyEnabled} onChange={(v) => updateSettings({ notifyEnabled: v })} />}
      />
      <ListRow
        title="資料同步設定"
        sub={s.settings.uploadOnWifiOnly ? '僅在 Wi-Fi 時上傳' : '有網路就上傳'}
        left={<Icon name="sync" size={20} color={C.text2} />}
        right={<Toggle value={s.settings.uploadOnWifiOnly} onChange={(v) => updateSettings({ uploadOnWifiOnly: v })} />}
      />

      <SectionTitle title="上傳與儲存" />
      <ListRow
        title={`離線紀錄:${pend.length} 筆待補傳`}
        sub={online ? (pend.length ? '有網路時會自動補傳' : '全部已上傳') : '目前離線,恢復連線後自動補傳'}
        left={<Icon name={pend.length ? 'upload' : 'uploaded'} size={20} color={pend.length ? C.teal : C.text2} />}
        right={
          pend.length ? (
            <Button
              title="立即補傳"
              small
              full={false}
              variant="secondary"
              disabled={!online}
              onPress={() => {
                resumeAll();
                showToast('開始補傳', 'info');
              }}
            />
          ) : null
        }
      />
      <ListRow title={`儲存空間:已使用 ${fmtBytes(usage)}`} sub={`錄音保存 ${s.settings.retentionDays} 天後自動刪除`} left={<Icon name="folder" size={20} color={C.text2} />} right={null} />

      <SectionTitle title="其他" />
      <ListRow
        title="關於哈鏌 App"
        left={<Icon name="robot" size={20} color={C.text2} />}
        onPress={() =>
          alertDialog(
            '哈鏌業務拜訪紀錄 POC',
            `版本 ${Constants.expoConfig?.version || '0.1.0'}\nAI 服務:${ai.name}\n資料存放:僅這支手機(POC 無伺服器)\n標誌為暫用版本,正式版將換成官方檔案。`,
          )
        }
      />
      <Button title="登出" variant="danger" onPress={doLogout} style={{ marginTop: SP.lg }} />
      <View style={{ alignItems: 'center', marginTop: SP.xl }}>
        <Image source={BRAND.logo} style={{ width: 110, height: 110 / BRAND.logoRatio, opacity: 0.5 }} resizeMode="contain" />
      </View>
      <View style={{ height: SP.xl }} />
    </Screen>
  );
}
