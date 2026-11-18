import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageStyle,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C, R, SP, T } from '../theme';
import { CTL, ICON, IconName, STATE } from '../assets';

// ---------- 文字 ----------
type TxtProps = React.ComponentProps<typeof Text> & {
  size?: number;
  color?: string;
  weight?: '400' | '500' | '600' | '700' | '800';
  center?: boolean;
};
export function Txt({ size = T.body, color = C.text, weight = '400', center, style, ...rest }: TxtProps) {
  return <Text {...rest} style={[{ fontSize: size, color, fontWeight: weight, lineHeight: Math.round(size * 1.45) }, center && { textAlign: 'center' }, style]} />;
}

// ---------- 圖示(B 類,單色可著色)----------
export function Icon({ name, size = 22, color = C.text, style }: { name: IconName; size?: number; color?: string; style?: StyleProp<ImageStyle> }) {
  return <Image source={ICON[name]} style={[{ width: size, height: size, tintColor: color }, style]} resizeMode="contain" />;
}

export function IconButton({ name, onPress, color = C.text, size = 22, label, style, disabled }: { name: IconName; onPress?: () => void; color?: string; size?: number; label?: string; style?: StyleProp<ViewStyle>; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }, disabled && { opacity: 0.35 }, style]}
    >
      <Icon name={name} size={size} color={color} />
    </Pressable>
  );
}

// ---------- 卡片(D-001~D-004)----------
type CardTone = 'default' | 'accent' | 'danger' | 'warn' | 'plain';
export function Card({ children, tone = 'default', style, onPress }: { children: React.ReactNode; tone?: CardTone; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const toneStyle: ViewStyle =
    tone === 'danger'
      ? { borderColor: C.red, backgroundColor: '#1B1A22' }
      : tone === 'warn'
        ? { borderColor: 'rgba(255,213,79,0.6)' }
        : tone === 'plain'
          ? { borderColor: 'transparent', backgroundColor: 'rgba(12,37,48,0.6)' }
          : {};
  const bar = tone === 'accent' ? C.teal : tone === 'danger' ? C.red : undefined;
  const content = (
    <>
      {bar ? <View style={[styles.cardBar, { backgroundColor: bar }]} /> : null}
      <View style={bar ? { paddingLeft: 6 } : undefined}>{children}</View>
    </>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, toneStyle, pressed && { opacity: 0.85 }, style]}>
        {content}
      </Pressable>
    );
  }
  return <View style={[styles.card, toneStyle, style]}>{content}</View>;
}

// ---------- 按鈕(C-001~C-006)----------
type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'locked';
export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
  small,
  style,
  full = true,
}: {
  title: string;
  onPress?: () => void;
  variant?: BtnVariant;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
  full?: boolean;
}) {
  const v: BtnVariant = disabled ? 'locked' : variant;
  const h = small ? 38 : 52;
  const textColor = v === 'secondary' ? C.teal : v === 'ghost' ? C.teal : v === 'locked' ? '#C9D3D6' : C.white;
  const inner = (
    <View style={[styles.btnInner, { height: h }]}>
      {loading ? <ActivityIndicator color={textColor} style={{ marginRight: 8 }} /> : null}
      {!loading && (v === 'locked' && disabled) ? <Icon name="lock" size={small ? 15 : 18} color={textColor} style={{ marginRight: 8 }} /> : null}
      {!loading && icon && !(v === 'locked' && disabled) ? <Icon name={icon} size={small ? 16 : 20} color={textColor} style={{ marginRight: 8 }} /> : null}
      <Txt size={small ? T.small : T.body + 1} weight="700" color={textColor} numberOfLines={1}>
        {title}
      </Txt>
    </View>
  );
  const base: StyleProp<ViewStyle> = [{ borderRadius: R.pill, overflow: 'hidden', alignSelf: full ? 'stretch' : 'flex-start' }, style];
  return (
    <Pressable onPress={onPress} disabled={disabled || loading} accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} style={({ pressed }) => [base, pressed && !disabled && { transform: [{ scale: 0.985 }], opacity: 0.92 }]}>
      {v === 'primary' || v === 'danger' || v === 'locked' ? (
        <LinearGradient
          colors={v === 'primary' ? ['#FF9C3A', '#FF7A00', '#D94C00'] : v === 'danger' ? ['#F2554F', '#E53935', '#A81412'] : ['#7D8E95', '#5E6F76', '#47575E']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ borderRadius: R.pill, borderWidth: v === 'locked' ? 1 : 0, borderColor: 'rgba(201,211,214,0.6)' }}
        >
          {inner}
        </LinearGradient>
      ) : (
        <View style={[{ borderRadius: R.pill }, v === 'secondary' ? styles.btnSecondary : null]}>{inner}</View>
      )}
    </Pressable>
  );
}

// ---------- 標籤晶片(F-001~F-004、C-017~C-021)----------
type ChipTone = 'teal' | 'orange' | 'yellow' | 'red' | 'gray';
const CHIP: Record<ChipTone, { fg: string; bg: string; bd: string }> = {
  teal: { fg: C.teal, bg: C.tealDim, bd: C.tealLine },
  orange: { fg: '#FF9A40', bg: C.orangeDim, bd: 'rgba(255,122,0,0.7)' },
  yellow: { fg: C.yellow, bg: C.yellowDim, bd: 'rgba(255,213,79,0.7)' },
  red: { fg: '#FF6B66', bg: C.redDim, bd: 'rgba(229,57,53,0.75)' },
  gray: { fg: '#B9C6CB', bg: C.metalDim, bd: 'rgba(138,155,162,0.6)' },
};
export function Chip({ label, tone = 'gray', icon, style, onPress, selected }: { label: string; tone?: ChipTone; icon?: IconName; style?: StyleProp<ViewStyle>; onPress?: () => void; selected?: boolean }) {
  const c = CHIP[tone];
  const body = (
    <View style={[styles.chip, { backgroundColor: selected === false ? 'transparent' : c.bg, borderColor: c.bd }, style]}>
      {icon ? <Icon name={icon} size={13} color={c.fg} style={{ marginRight: 4 }} /> : null}
      <Txt size={T.tiny + 1} weight="600" color={c.fg}>
        {label}
      </Txt>
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body;
}

/** 黃底晶片(D-006):金額、數量、日期、型號、承諾 */
export function FactChip({ label, viewed, onPress }: { label: string; viewed?: boolean; onPress?: () => void }) {
  return (
    <Pressable testID={onPress ? (viewed ? 'fact-chip-viewed' : 'fact-chip') : undefined} onPress={onPress} style={({ pressed }) => [styles.fact, pressed && { opacity: 0.8 }]}>
      <Txt size={T.small} weight="700" color="#2B2100">
        {label}
      </Txt>
      {viewed ? <Icon name="check" size={13} color="#2B2100" style={{ marginLeft: 4 }} /> : null}
    </Pressable>
  );
}

// ---------- 分段選擇器(C-029 底板 + C-022/C-023)----------
export function Segmented<T extends string>({ options, value, onChange, style }: { options: { value: T; label: string; badge?: number }[]; value: T; onChange: (v: T) => void; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.seg, style]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} style={[styles.segItem, on && styles.segOn]} accessibilityRole="tab" accessibilityState={{ selected: on }}>
            <Txt size={T.small} weight={on ? '700' : '500'} color={on ? C.white : C.text2} numberOfLines={1}>
              {o.label}
            </Txt>
            {o.badge ? (
              <View style={styles.segBadge}>
                <Txt size={10} weight="700" color={C.white}>
                  {o.badge}
                </Txt>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------- 輸入框(C-007~C-010、C-030)----------
export function Field({ label, error, hint, multiline, style, inputStyle, right, ...rest }: TextInputProps & { label?: string; error?: string; hint?: string; inputStyle?: StyleProp<TextStyle>; right?: React.ReactNode }) {
  const [focus, setFocus] = useState(false);
  const borderColor = error ? C.red : focus ? C.teal : 'rgba(145,167,173,0.75)';
  return (
    <View style={[{ marginBottom: SP.md }, style as StyleProp<ViewStyle>]}>
      {label ? (
        <Txt size={T.small} color={C.text2} weight="600" style={{ marginBottom: 6 }}>
          {label}
        </Txt>
      ) : null}
      <View style={[styles.field, multiline ? styles.fieldMulti : null, { borderColor }]}>
        <TextInput
          placeholderTextColor={C.text3}
          {...rest}
          multiline={multiline}
          onFocus={(e) => {
            setFocus(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocus(false);
            rest.onBlur?.(e);
          }}
          style={[styles.input, multiline ? { minHeight: 120, textAlignVertical: 'top', paddingTop: 12 } : null, inputStyle]}
        />
        {right}
      </View>
      {error ? (
        <Txt size={T.small} color="#FF6B66" style={{ marginTop: 6 }}>
          {error}
        </Txt>
      ) : hint ? (
        <Txt size={T.small} color={C.text3} style={{ marginTop: 6 }}>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

export function SearchField({ value, onChangeText, placeholder, style }: { value: string; onChangeText: (s: string) => void; placeholder: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.field, { borderColor: 'rgba(145,167,173,0.75)', paddingLeft: 14 }, style]}>
      <Icon name="search" size={18} color={C.text2} />
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={C.text3} style={[styles.input, { paddingLeft: 10 }]} returnKeyType="search" />
      {value ? <IconButton name="trash" size={16} color={C.text3} onPress={() => onChangeText('')} label="清除搜尋" /> : null}
    </View>
  );
}

// ---------- 勾選、單選、開關(C-011~C-016)----------
export function Checkbox({ checked, onPress, size = 24, label, sub, disabled }: { checked: boolean; onPress?: () => void; size?: number; label?: string; sub?: string; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.checkRow, pressed && { opacity: 0.7 }]} accessibilityRole="checkbox" accessibilityState={{ checked }}>
      <Image source={checked ? CTL.checkboxOn : CTL.checkboxOff} style={{ width: size, height: size }} />
      {label ? (
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Txt color={checked ? C.text : C.text} style={checked ? undefined : undefined}>
            {label}
          </Txt>
          {sub ? (
            <Txt size={T.small} color={C.text3}>
              {sub}
            </Txt>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

export function Radio({ selected, onPress, label }: { selected: boolean; onPress?: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} style={styles.checkRow} accessibilityRole="radio" accessibilityState={{ selected }}>
      <Image source={selected ? CTL.radioOn : CTL.radioOff} style={{ width: 22, height: 22 }} />
      <Txt style={{ marginLeft: 10, flex: 1 }}>{label}</Txt>
    </Pressable>
  );
}

export function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <Pressable onPress={() => onChange(!value)} disabled={disabled} accessibilityRole="switch" accessibilityState={{ checked: value }} hitSlop={8} style={disabled ? { opacity: 0.4 } : undefined}>
      <Image source={value ? CTL.toggleOn : CTL.toggleOff} style={{ width: 54, height: 20 }} resizeMode="contain" />
    </Pressable>
  );
}

// ---------- 版面小元件 ----------
export function SectionTitle({ title, right, style }: { title: string; right?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.sectionTitle, style]}>
      <Txt size={T.h3} weight="700">
        {title}
      </Txt>
      {right}
    </View>
  );
}

export function Row({ children, style, gap = SP.sm }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: C.lineSoft, marginVertical: SP.md }, style]} />;
}

export function ListRow({ title, sub, left, right, onPress, style }: { title: string; sub?: string; left?: React.ReactNode; right?: React.ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.listRow, pressed && { backgroundColor: 'rgba(20,50,60,0.9)' }, style]}>
      {left ? <View style={{ marginRight: 12 }}>{left}</View> : null}
      <View style={{ flex: 1 }}>
        <Txt weight="600" numberOfLines={1}>
          {title}
        </Txt>
        {sub ? (
          <Txt size={T.small} color={C.text2} numberOfLines={2}>
            {sub}
          </Txt>
        ) : null}
      </View>
      {right !== undefined ? right : onPress ? <Icon name="right" size={18} color={C.text3} /> : null}
    </Pressable>
  );
}

export function EmptyState({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: SP.xxl }}>
      <Image source={STATE.empty} style={{ width: 120, height: 120, opacity: 0.85 }} resizeMode="contain" />
      <Txt color={C.text2} center style={{ marginTop: SP.md, maxWidth: 280 }}>
        {text}
      </Txt>
      {action ? <View style={{ marginTop: SP.lg }}>{action}</View> : null}
    </View>
  );
}

export function Notice({ text, tone = 'teal', icon = 'warn' }: { text: string; tone?: 'teal' | 'yellow' | 'red' | 'gray'; icon?: IconName }) {
  const c = CHIP[tone];
  return (
    <View style={[styles.notice, { borderColor: c.bd, backgroundColor: c.bg }]}>
      <Icon name={icon} size={18} color={c.fg} style={{ marginRight: 8, marginTop: 1 }} />
      <Txt size={T.small} color={tone === 'gray' ? C.text2 : C.text} style={{ flex: 1 }}>
        {text}
      </Txt>
    </View>
  );
}

export function KeyValue({ k, v }: { k: string; v?: string }) {
  return (
    <View style={{ flexDirection: 'row', paddingVertical: 4 }}>
      <Txt size={T.small} color={C.text3} style={{ width: 88 }}>
        {k}
      </Txt>
      <Txt size={T.small} color={C.text} style={{ flex: 1 }}>
        {v || '—'}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: 'rgba(9,33,43,0.94)',
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: R.lg,
    padding: SP.lg,
    overflow: 'hidden',
  },
  cardBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  btnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  btnSecondary: { borderWidth: 1.5, borderColor: C.teal, backgroundColor: 'rgba(5,20,27,0.85)' },
  chip: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: R.pill, paddingHorizontal: 9, height: 24, alignSelf: 'flex-start' },
  fact: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.yellow, borderRadius: R.pill, paddingHorizontal: 12, height: 30, marginRight: 8, marginBottom: 8 },
  seg: { flexDirection: 'row', backgroundColor: 'rgba(5,20,27,0.9)', borderColor: 'rgba(138,155,162,0.6)', borderWidth: 1, borderRadius: R.pill, padding: 3 },
  segItem: { flex: 1, height: 36, borderRadius: R.pill, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', paddingHorizontal: 6 },
  segOn: { backgroundColor: C.orange },
  segBadge: { minWidth: 16, height: 16, borderRadius: 8, backgroundColor: C.red, marginLeft: 4, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  field: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(5,20,27,0.92)', borderWidth: 1, borderRadius: R.pill, minHeight: 48, paddingHorizontal: 6 },
  fieldMulti: { borderRadius: R.lg, alignItems: 'stretch' },
  // 網頁版:去掉瀏覽器預設的藍色焦點方框;字級 16 以上,iPhone 點輸入框時才不會自動放大畫面
  input: { flex: 1, color: C.text, fontSize: 16, paddingHorizontal: 12, paddingVertical: 10, minHeight: 46, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0 } as object) : {}) },
  checkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SP.xl, marginBottom: SP.md },
  listRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(9,33,43,0.94)', borderColor: C.line, borderWidth: 1, borderRadius: R.md, paddingHorizontal: SP.lg, paddingVertical: SP.md, marginBottom: SP.sm },
  notice: { flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1, borderRadius: R.md, padding: SP.md, marginBottom: SP.md },
});
