import { useCallback, useEffect, useState } from 'react';
import {
  getRecordingPermissionsAsync,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { Platform } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

export type RecPhase = 'idle' | 'recording' | 'paused' | 'stopped';

/** 錄音:開始、暫停、繼續、停止;錄音中保持螢幕不休眠,可在背景繼續錄(需原生版) */
export function useRecorder() {
  // 錄音頁保持螢幕不休眠(網頁版瀏覽器多半不支援,略過)
  useEffect(() => {
    if (Platform.OS === 'web') return;
    activateKeepAwakeAsync('himore-recorder').catch(() => {});
    return () => {
      deactivateKeepAwake('himore-recorder').catch(() => {});
    };
  }, []);
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
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
