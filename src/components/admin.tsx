import React from 'react';
import { Pressable, ScrollView, StyleProp, StyleSheet, View, ViewStyle, useWindowDimensions } from 'react-native';
import { C, R, SP, T } from '../theme';
import { Txt } from './ui';

export function useWide() {
  const { width } = useWindowDimensions();
  return width >= 900;
}

export interface Col<Rw> {
  key: string;
  title: string;
  width?: number; // 固定寬度;未給則平分
  render: (r: Rw) => React.ReactNode;
}

/** 後台表格:表頭列(D-009)+資料列(D-010);窄螢幕可左右捲動 */
export function AdminTable<Rw>({ cols, rows, keyOf, onRowPress, empty = '沒有資料', minWidth = 640 }: { cols: Col<Rw>[]; rows: Rw[]; keyOf: (r: Rw) => string; onRowPress?: (r: Rw) => void; empty?: string; minWidth?: number }) {
  const wide = useWide();
  const table = (
    <View style={[styles.table, !wide && { minWidth }]}>
      <View style={styles.head}>
        {cols.map((c) => (
          <View key={c.key} style={[styles.cell, c.width ? { width: c.width } : { flex: 1 }]}>
            <Txt size={T.small} weight="700" color={C.text2}>
              {c.title}
            </Txt>
          </View>
        ))}
      </View>
      {rows.length === 0 ? (
        <View style={{ padding: SP.lg }}>
          <Txt color={C.text3}>{empty}</Txt>
        </View>
      ) : (
        rows.map((r) => (
          <Pressable key={keyOf(r)} disabled={!onRowPress} onPress={() => onRowPress?.(r)} style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [styles.row, (pressed || hovered) && onRowPress ? { backgroundColor: 'rgba(20,50,60,0.7)' } : null]}>
            {cols.map((c) => (
              <View key={c.key} style={[styles.cell, c.width ? { width: c.width } : { flex: 1 }]}>
                {(() => {
                  const v = c.render(r);
                  return typeof v === 'string' || typeof v === 'number' ? (
                    <Txt size={T.small} numberOfLines={2}>
                      {v}
                    </Txt>
                  ) : (
                    v
                  );
                })()}
              </View>
            ))}
          </Pressable>
        ))
      )}
    </View>
  );
  return wide ? table : <ScrollView horizontal showsHorizontalScrollIndicator>{table}</ScrollView>;
}

export function StatCard({ label, value, sub, tone = 'teal', style }: { label: string; value: string | number; sub?: string; tone?: 'teal' | 'orange' | 'yellow' | 'red'; style?: StyleProp<ViewStyle> }) {
  const color = tone === 'orange' ? C.orange : tone === 'yellow' ? C.yellow : tone === 'red' ? '#FF6B66' : C.teal;
  return (
    <View style={[styles.stat, style]}>
      <Txt size={T.small} color={C.text2}>
        {label}
      </Txt>
      <Txt size={28} weight="800" color={color} style={{ marginTop: 4 }}>
        {value}
      </Txt>
      {sub ? (
        <Txt size={T.tiny + 1} color={C.text3}>
          {sub}
        </Txt>
      ) : null}
    </View>
  );
}

/** 分頁器(C-032 一般 / C-033 選取) */
export function Pager({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  if (pages <= 1) return null;
  const nums = Array.from({ length: pages }, (_, i) => i + 1).slice(Math.max(0, page - 3), Math.max(0, page - 3) + 5);
  const btn = (label: string, p: number, on = false, disabled = false) => (
    <Pressable key={label} disabled={disabled} onPress={() => onChange(p)} style={[styles.pageBtn, on && styles.pageOn, disabled && { opacity: 0.35 }]}>
      <Txt size={T.small} weight="700" color={on ? '#04201E' : C.text}>
        {label}
      </Txt>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center', marginTop: SP.md }}>
      {btn('‹', page - 1, false, page <= 1)}
      {nums.map((n) => btn(String(n), n, n === page))}
      {btn('›', page + 1, false, page >= pages)}
    </View>
  );
}

export function PageTitle({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SP.lg, flexWrap: 'wrap', gap: SP.sm }}>
      <Txt size={T.h1} weight="700">
        {title}
      </Txt>
      {right ? <View style={{ flexDirection: 'row', gap: SP.sm, flexWrap: 'wrap' }}>{right}</View> : null}
    </View>
  );
}

export function Panel({ children, style, title, right }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; title?: string; right?: React.ReactNode }) {
  return (
    <View style={[styles.panel, style]}>
      {title ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SP.md }}>
          <Txt size={T.h3} weight="700">
            {title}
          </Txt>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  table: { borderWidth: 1, borderColor: C.line, borderRadius: R.md, overflow: 'hidden', backgroundColor: 'rgba(9,33,43,0.92)' },
  head: { flexDirection: 'row', backgroundColor: C.surface2, borderBottomWidth: 1, borderBottomColor: C.metal },
  row: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#3C4D55', minHeight: 46, alignItems: 'center' },
  cell: { paddingHorizontal: SP.md, paddingVertical: 10, justifyContent: 'center' },
  stat: { flex: 1, minWidth: 150, borderWidth: 1, borderColor: C.line, borderRadius: R.lg, padding: SP.lg, backgroundColor: 'rgba(9,33,43,0.92)' },
  pageBtn: { minWidth: 34, height: 34, borderRadius: 9, borderWidth: 1, borderColor: C.metal, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(7,27,37,0.95)', paddingHorizontal: 8 },
  pageOn: { backgroundColor: C.teal, borderColor: C.teal },
  panel: { borderWidth: 1, borderColor: C.line, borderRadius: R.lg, padding: SP.lg, backgroundColor: 'rgba(9,33,43,0.85)', marginBottom: SP.lg },
});
