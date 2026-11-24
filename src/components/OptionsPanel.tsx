import React, { useState } from 'react';
import { View } from 'react-native';
import { Panel } from './admin';
import { Button, Chip, Field, Row, Txt } from './ui';
import { C, SP, T } from '../theme';
import { useAppState } from '../store/store';
import { updateSettings } from '../store/actions';
import { DEFAULT_SETTINGS } from '../store/seed';

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

/** 客戶資料選項:產業別(複選用)、客戶分類 */
export function CustomerOptionsPanel() {
  const s = useAppState();
  return (
    <Panel title="客戶資料選項">
      <OptionList
        title="產業別"
        hint="客戶資料「產業別」可複選的選項。移除選項不會影響已填寫的客戶。"
        items={s.settings.industryOptions || DEFAULT_SETTINGS.industryOptions || []}
        onChange={(x) => updateSettings({ industryOptions: x })}
        placeholder="新增產業,例:光電"
      />
      <OptionList
        title="客戶分類"
        hint="客戶管理可用來篩選的分類。"
        items={s.settings.customerCategories || DEFAULT_SETTINGS.customerCategories || []}
        onChange={(x) => updateSettings({ customerCategories: x })}
        placeholder="新增分類,例:VIP"
      />
    </Panel>
  );
}
