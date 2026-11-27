import { useCallback, useEffect, useState } from 'react';
import {
  getRecordingPermissionsAsync,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';

export type RecPhase = 'idle' | 'recording' | 'paused' | 'stopped';

/**
 * 語音專用錄音設定:單聲道 22kHz、48kbps AAC。
 * 語音辨識模型只用 16kHz 單聲道,高音質沒有幫助;這樣一小時約 21MB(原本約 58MB),
 * 長時間拜訪也能透過通道上傳(單檔上限約 100MB ≒ 4 小時以上)。
 */
const SPEECH_PRESET = {
  ...RecordingPresets.HIGH_QUALITY,
  sampleRate: 22050,
  numberOfChannels: 1,
  bitRate: 48000,
  web: { mimeType: 'audio/webm', bitsPerSecond: 48000 },
  isMeteringEnabled: true,
};

/**
 * 錄音:開始、暫停、繼續、停止。
 * 不保持螢幕常亮(又熱又耗電):App 版關掉螢幕或切到其他 App 會以前景服務繼續錄,通知列顯示錄音中。
 * 網頁版(尤其 iPhone Safari)螢幕關閉就會中斷,長時間拜訪請用手機內建錄音 App 錄好再匯入。
 */
export function useRecorder() {  const recorder = useAudioRecorder(SPEECH_PRESET);
  const state = useAudioRecorderState(recorder, 200);
  const [phase, setPhase] = useState<RecPhase>('idle');
  const [permission, setPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    getRecordingPermissionsAsync()
      .then((p) => setPermission(p.granted ? 'granted' : p.canAskAgain === false ? 'denied' : 'unknown'))
      .catch(() => setPermission('unknown'));
    setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, allowsBackgroundRecording: true, shouldPlayInBackground: true }).catch(() => {});
    return () => {
      setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    };
  }, []);

  const ensurePermission = useCallback(async () => {
    try {
      let p = await getRecordingPermissionsAsync();
      if (!p.granted) p = await requestRecordingPermissionsAsync();
      setPermission(p.granted ? 'granted' : 'denied');
      return p.granted;
    } catch {
      setPermission('denied');
      return false;
    }
  }, []);

  const start = useCallback(async () => {
    setError(undefined);
    if (!(await ensurePermission())) return false;
    try {
      await recorder.prepareToRecordAsync();
      recorder.record();
      setPhase('recording');
      return true;
    } catch {
      setError('無法開始錄音,請確認麥克風沒有被其他 App 使用');
      return false;
    }
  }, [recorder, ensurePermission]);

  const pause = useCallback(() => {
    try {
      recorder.pause();
      setPhase('paused');
    } catch {
      // 忽略
    }
  }, [recorder]);

  const resume = useCallback(() => {
    try {
      recorder.record();
      setPhase('recording');
    } catch {
      // 忽略
    }
  }, [recorder]);

  /** 停止並回傳暫存檔位置與長度 */
  const stop = useCallback(async (): Promise<{ uri: string | null; durationMs: number }> => {
    const durationMs = state.durationMillis || 0;
    try {
      await recorder.stop();
    } catch {
      // 已停止
    }
    setPhase('stopped');
    return { uri: recorder.uri, durationMs };
  }, [recorder, state.durationMillis]);

  // 音量(dB,約 -60~0)轉成 0~1
  const level = state.metering !== undefined ? Math.max(0, Math.min(1, (state.metering + 60) / 60)) : phase === 'recording' ? 0.5 : 0;

  return { phase, durationMs: state.durationMillis || 0, level, permission, error, start, pause, resume, stop, ensurePermission };
}
