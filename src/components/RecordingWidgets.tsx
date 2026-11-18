import React, { useEffect, useState } from 'react';
import { Animated, Image, ImageBackground, Pressable, View } from 'react-native';
import { REC } from '../assets';
import { C, T } from '../theme';
import { Txt } from './ui';
import { fmtClock } from '../lib/util';

/** 計時器(E-006 底框,左側紅點) */
export function TimerFrame({ ms, width = 240 }: { ms: number; width?: number }) {
  return (
    <ImageBackground source={REC.timerFrame} style={{ width, height: width / 6, alignItems: 'center', justifyContent: 'center' }} resizeMode="contain">
      <Txt size={T.h2} weight="700" style={{ fontVariant: ['tabular-nums'], marginLeft: width * 0.08, letterSpacing: 1 }}>
        {fmtClock(ms)}
      </Txt>
    </ImageBackground>
  );
}

/** 聲波(E-004 錄音中、E-005 待機),依音量起伏 */
export function Waveform({ active, level, width = 300 }: { active: boolean; level: number; width?: number }) {
  const [scale] = useState(() => new Animated.Value(0.6));
  useEffect(() => {
    Animated.timing(scale, { toValue: active ? 0.45 + level * 0.75 : 0.6, duration: 180, useNativeDriver: true }).start();
  }, [active, level, scale]);
  return (
    <View style={{ width, height: width / 3, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.Image source={active ? REC.waveActive : REC.waveIdle} style={{ width, height: width / 3, transform: [{ scaleY: active ? scale : 1 }] }} resizeMode="contain" />
    </View>
  );
}

/** 錄音主按鈕(E-001 待機、E-002 錄音中、E-003 鎖定) */
export function RecordButton({ state, onPress, size = 120 }: { state: 'idle' | 'recording' | 'locked'; onPress?: () => void; size?: number }) {
  const src = state === 'recording' ? REC.recording : state === 'locked' ? REC.locked : REC.idle;
  return (
    <Pressable onPress={onPress} disabled={state === 'locked'} accessibilityRole="button" accessibilityLabel={state === 'recording' ? '停止錄音' : '開始錄音'} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
      <Image source={src} style={{ width: size, height: size }} />
    </Pressable>
  );
}

export const recColors = { mark: C.yellow };
