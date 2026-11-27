import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, Field, Notice, Row, Toggle, Txt } from './ui';
import { C, SP, T } from '../theme';
import { showToast, useAppState } from '../store/store';
import { updateSettings } from '../store/actions';
import { checkServer, type ServerHealth } from '../services/ai/remote';

/**
 * 本機 AI 伺服器設定(POC):填入通道網址與金鑰。
 * 設定存在這台裝置;業務手機與後台各自設定一次。
 */
export function AiServerForm({ onSaved }: { onSaved?: () => void }) {
  const s = useAppState();
  const cur = s.settings.aiServer;
  const [url, setUrl] = useState(cur?.url || '');
  const [key, setKey] = useState(cur?.key || '');
  const [diar, setDiar] = useState(cur?.diarization ?? true);
  const [busy, setBusy] = useState(false);
  const [health, setHealth] = useState<ServerHealth | null>(null);
  const [err, setErr] = useState('');
  const clean = url.trim().replace(/\/+$/, '');
  const urlBad = !!clean && !/^https?:\/\/[^\s]+$/.test(clean);

  const test = async () => {
    setBusy(true);
    setErr('');
    setHealth(null);
    try {
      setHealth(await checkServer({ url: clean, key: key.trim(), diarization: diar }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : '連線失敗');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <Txt size={T.small} color={C.text2} style={{ marginBottom: SP.md }}>
        填入本機 AI 伺服器的網址(執行 tunnel.bat 後出現的 https://….trycloudflare.com)與 config.bat 裡的 API_KEY。填了就改用真實 AI;清除就回到模擬 AI。設定只存在這台裝置。
      </Txt>
      <Field label="AI 伺服器網址" value={url} onChangeText={setUrl} autoCapitalize="none" keyboardType="url" placeholder="https://xxxx-xxxx.trycloudflare.com" error={urlBad ? '網址要以 https:// 開頭' : undefined} />
      <Field label="API 金鑰" value={key} onChangeText={setKey} autoCapitalize="none" secureTextEntry placeholder="config.bat 的 API_KEY" />
      <Row style={{ justifyContent: 'space-between', marginBottom: SP.md }}>
        <View style={{ flex: 1 }}>
          <Txt weight="600">分辨說話者</Txt>
          <Txt size={T.tiny + 1} color={C.text3}>
            伺服器需設定 HF_TOKEN 才有作用
          </Txt>
        </View>
        <Toggle value={diar} onChange={setDiar} />
      </Row>

      {health ? (
        <Notice
          tone={health.llm_ready ? 'teal' : 'yellow'}
          icon={health.llm_ready ? 'check' : 'warn'}
          text={[
            `已連線 v${health.version}${health.fake ? '(示範模式,未載入模型)' : ''}`,
            `顯示卡:${health.gpu}`,
            `語音:${health.asr_model.split('/').pop()}${health.diarization ? '+語者分離' : ''}`,
            `分析:${health.llm_model}${health.llm_ready ? '' : '(尚未下載,請在電腦執行 ollama pull)'}`,
            `照片:${health.vision_model ? `${health.vision_model}${health.vision_ready ? '' : '(尚未下載)'}` : '未設定(照片不辨識)'}`,
            health.auth ? '' : '⚠ 伺服器沒有設定 API 金鑰,任何知道網址的人都能使用',
          ]
            .filter(Boolean)
            .join('\n')}
        />
      ) : null}
      {err ? <Notice tone="red" text={err} /> : null}

      <Row style={{ flexWrap: 'wrap' }} gap={SP.sm}>
        <Button title="測試連線" small full={false} variant="secondary" loading={busy} disabled={!clean || urlBad} onPress={test} />
        <Button
          title="儲存"
          small
          full={false}
          disabled={urlBad}
          onPress={() => {
            updateSettings({ aiServer: clean ? { url: clean, key: key.trim(), diarization: diar } : undefined });
            showToast(clean ? '已改用本機 AI 伺服器' : '已改回模擬 AI', 'success');
            onSaved?.();
          }}
        />
        {cur?.url ? (
          <Button
            title="清除,改回模擬 AI"
            small
            full={false}
            variant="ghost"
            onPress={() => {
              updateSettings({ aiServer: undefined });
              setUrl('');
              setKey('');
              setHealth(null);
              showToast('已改回模擬 AI', 'success');
              onSaved?.();
            }}
          />
        ) : null}
      </Row>
    </View>
  );
}
