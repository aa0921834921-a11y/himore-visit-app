import React from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { C, T } from '../theme';
import { Txt } from './ui';

/** 環形進度(D-012~D-014 的樣式,依實際比例繪製):從正上方順時針 */
export function Ring({ value, total, size = 64, stroke = 6, color = C.teal, label }: { value: number; total: number; size?: number; stroke?: number; color?: string; label?: string }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const p = total ? Math.min(1, value / total) : 0;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.metal} strokeOpacity={0.55} strokeWidth={stroke} fill="none" />
        {p > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${circ * p} ${circ}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>
      <Txt size={label ? T.tiny + 1 : T.small} weight="700">
        {label ?? `${value}/${total}`}
      </Txt>
    </View>
  );
}

/** 細進度條(C-024 軌道 + C-025 填滿) */
export function ProgressBar({ value, total, color = C.teal }: { value: number; total: number; color?: string }) {
  const p = total ? Math.min(1, value / total) : 0;
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: '#182D35', overflow: 'hidden' }}>
      <View style={{ width: `${p * 100}%`, height: 6, borderRadius: 3, backgroundColor: color }} />
    </View>
  );
}
