import React, { useState } from 'react';
import { View } from 'react-native';
import { Panel } from './admin';
import { Button, Chip, Field, Row, Txt } from './ui';
import { C, SP, T } from '../theme';
import { useAppState } from '../store/store';
import { updateSettings } from '../store/actions';
import { OPTION_META, optionsOf } from '../store/options';
import type { OptionKey } from '../types';

function OptionList({ title, hint, items, onChange, placeholder }: { title: string; hint: string; items: string[]; onChange: (x: string[]) => void; placeholder: string }) {
  const [t, setT] = useState('');
  return (
    <View style={{ marginBottom: SP.lg }}>
      <Txt weight="700">{title}</Txt>
      <Txt size={T.small} color={C.text2} style={{ marginBottom: SP.sm }}>
        {hint}
      </Txt>
      <Row style={{ flexWrap: 'wrap', marginBottom: SP.sm }}>
        {items.map((x) => (
          <Chip key={x} label={`${x} ✕`} tone="teal" onPress={() => onChange(items.filter((y) => y !== x))} />
        ))}
      </Row>
      <Row gap={SP.sm}>
        <View style={{ flex: 1 }}>
          <Field value={t} onChangeText={setT} placeholder={placeholder} style={{ marginBottom: 0 }} />
        </View>
        <Button
          title="加入"
          small
          full={false}
          disabled={!t.trim() || items.includes(t.trim())}
          onPress={() => {
            onChange([...items, t.trim()]);
            setT('');
          }}
        />
      </Row>
    </View>
  );
}

/** 客戶資料選項:哈鏌提供正式清單前先用暫定值,主管可在這裡增刪 */
export function CustomerOptionsPanel() {
  const s = useAppState();
  const keys: (OptionKey | 'industries' | 'categories')[] = ['industries', 'customerTypes', 'products', 'categories', 'identities', 'moldInjection', 'markets', 'employeeScales', 'contactRoles', 'machineBrands', 'automationProcesses'];
  const change = (k: OptionKey | 'industries' | 'categories', x: string[]) => {
    if (k === 'industries') updateSettings({ industryOptions: x });
    else if (k === 'categories') updateSettings({ customerCategories: x });
    else updateSettings({ options: { ...s.settings.options, [k]: x } });
  };
  return (
    <Panel title="客戶資料選項">
      <Txt size={T.small} color={C.text2} style={{ marginBottom: SP.md }}>
        客戶檔案與聯絡人表單的下拉選項。移除選項不會影響已填寫的客戶;所屬產業清單請依哈鏌正式分類替換。
      </Txt>
      {keys.map((k) => (
        <OptionList key={k} title={OPTION_META[k].label} hint={OPTION_META[k].hint} items={optionsOf(s, k)} onChange={(x) => change(k, x)} placeholder={`新增${OPTION_META[k].label}`} />
      ))}
    </Panel>
  );
}
