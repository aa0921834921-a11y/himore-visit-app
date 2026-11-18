import React, { useState } from 'react';
import { View } from 'react-native';
import { Sheet } from './Sheet';
import { Button, Card, Chip, Field, Row, Segmented, Txt } from './ui';
import { C, SP, T } from '../theme';
import type { PrefSuggestion } from '../types';

// S12 偏好與避免事項(T-S12-04~T-S12-12):S09 內的底部彈出卡,一次一張;接受、編輯、略過;接受後才寫入客戶檔案
export function PrefSheet({
  visible,
  onClose,
  prefs,
  onDecide,
}: {
  visible: boolean;
  onClose: () => void;
  prefs: PrefSuggestion[];
  onDecide: (id: string, patch: Partial<PrefSuggestion>) => void;
}) {
  const queue = prefs.filter((p) => p.decision === 'pending');
  const cur = queue[0];
  if (!cur) return null;
  return (
    <Sheet visible={visible} onClose={onClose} title="偏好與避免事項">
      <PrefCard key={cur.id} pref={cur} index={prefs.length - queue.length + 1} total={prefs.length} onDecide={onDecide} />
    </Sheet>
  );
}

function PrefCard({ pref, index, total, onDecide }: { pref: PrefSuggestion; index: number; total: number; onDecide: (id: string, patch: Partial<PrefSuggestion>) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(pref.content);
  const typeLabel = `${pref.type === 'avoid' ? '避免事項' : '偏好'}${pref.sensitivity === 'restricted' ? '(敏感)' : ''}`;
  return (
    <View>
      <Row style={{ justifyContent: 'space-between', marginBottom: SP.md }}>
        <Chip label={typeLabel} tone={pref.type === 'avoid' ? 'red' : 'teal'} />
        <Txt size={T.small} color={C.text2} weight="700">
          {index} / {total}
        </Txt>
      </Row>
      {editing ? (
        <Field value={draft} onChangeText={setDraft} multiline placeholder="請輸入內容" />
      ) : (
        <Txt size={T.h3} weight="700" style={{ marginBottom: SP.md }}>
          {pref.content}
        </Txt>
      )}
      <Card tone="plain" style={{ marginBottom: SP.md }}>
        <Txt size={T.small} color={C.text3} style={{ marginBottom: 4 }}>
          原文片段
        </Txt>
        <Txt size={T.small}>
          {pref.sourceLabel}:{pref.sourceText}
        </Txt>
        <Txt size={T.tiny + 1} color={C.text3} style={{ marginTop: 4 }}>
          來源:{pref.sourceLabel}
        </Txt>
      </Card>
      <Txt size={T.small} color={C.text2} style={{ marginBottom: SP.md }}>
        對象:{pref.target === 'contact' ? '聯絡人' : '客戶'}({pref.targetName})
      </Txt>
      <Txt size={T.small} color={C.text2} style={{ marginBottom: SP.xs }}>
        敏感度
      </Txt>
      <Segmented
        value={pref.sensitivity}
        onChange={(v) => onDecide(pref.id, { sensitivity: v })}
        options={[
          { value: 'normal', label: '一般' },
          { value: 'restricted', label: '限定' },
        ]}
      />
      <Txt size={T.tiny + 1} color={C.text3} style={{ marginTop: SP.sm, marginBottom: SP.lg }}>
        「限定」的內容只在客戶檔案中顯示,後台匯出 CSV 時預設不包含。
      </Txt>
      {editing ? (
        <View style={{ gap: SP.sm }}>
          <Button title="儲存並接受" disabled={!draft.trim()} onPress={() => onDecide(pref.id, { content: draft.trim(), decision: 'accepted' })} />
          <Button title="取消編輯" variant="secondary" onPress={() => setEditing(false)} />
        </View>
      ) : (
        <View style={{ gap: SP.sm }}>
          <Button title="接受" icon="check" onPress={() => onDecide(pref.id, { decision: 'accepted' })} />
          <Row gap={SP.md}>
            <View style={{ flex: 1 }}>
              <Button title="編輯" variant="secondary" onPress={() => setEditing(true)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="略過" variant="secondary" onPress={() => onDecide(pref.id, { decision: 'skipped' })} />
            </View>
          </Row>
        </View>
      )}
    </View>
  );
}
