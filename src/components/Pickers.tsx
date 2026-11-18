import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Sheet } from './Sheet';
import { Button, Chip, Field, ListRow, Radio, SearchField, Txt } from './ui';
import { C, SP, T } from '../theme';
import { useAppState } from '../store/store';
import { addCustomer } from '../store/actions';
import { currentUser } from '../store/selectors';
import type { AnswerStatus, Customer } from '../types';

/** 快速新增客戶:只填公司名稱(S03、S13 呼叫) */
export function QuickAddCustomer({ visible, onClose, onAdded, initialName = '' }: { visible: boolean; onClose: () => void; onAdded: (c: Customer) => void; initialName?: string }) {
  const [name, setName] = useState(initialName);
  const s = useAppState();
  const me = currentUser(s);
  const exists = s.customers.some((c) => c.name === name.trim());
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="快速新增客戶"
      footer={
        <Button
          title="新增"
          disabled={!name.trim() || exists}
          onPress={() => {
            const c = addCustomer({ name, ownerId: me?.id });
            setName('');
            onAdded(c);
          }}
        />
      }
    >
      <Field label="公司名稱" placeholder="例:宏昇塑膠有限公司" value={name} onChangeText={setName} error={exists ? '已有同名客戶,請直接選擇' : undefined} />
      <Txt size={T.small} color={C.text3}>
        其他資料(聯絡人、產業)可之後在客戶檔案或後台補齊。客戶編號由系統自動產生。
      </Txt>
    </Sheet>
  );
}

/** 選擇客戶(只列出自己負責的客戶;管理者看全部) */
export function CustomerPicker({ visible, onClose, onPick, selectedId }: { visible: boolean; onClose: () => void; onPick: (c: Customer) => void; selectedId?: string }) {
  const s = useAppState();
  const me = currentUser(s);
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const list = useMemo(
    () =>
      s.customers
        .filter((c) => me?.role === 'admin' || c.ownerId === me?.id)
        .filter((c) => !q || c.name.includes(q) || c.code.includes(q) || c.contacts.some((x) => x.name.includes(q))),
    [s.customers, me, q],
  );
  return (
    <>
      <Sheet visible={visible && !adding} onClose={onClose} title="選擇客戶" footer={<Button title="找不到客戶?快速新增" variant="secondary" onPress={() => setAdding(true)} />}>
        <SearchField value={q} onChangeText={setQ} placeholder="搜尋公司名稱或聯絡人" style={{ marginBottom: SP.md }} />
        {list.length === 0 ? (
          <Txt color={C.text2} style={{ paddingVertical: SP.lg }}>
            找不到符合的客戶,可改搜尋條件
          </Txt>
        ) : (
          list.map((c) => (
            <ListRow key={c.id} title={c.name} sub={c.code} onPress={() => onPick(c)} right={c.id === selectedId ? <Chip label="已選" tone="teal" /> : undefined} />
          ))
        )}
      </Sheet>
      <QuickAddCustomer
        visible={visible && adding}
        initialName={q}
        onClose={() => setAdding(false)}
        onAdded={(c) => {
          setAdding(false);
          onPick(c);
        }}
      />
    </>
  );
}

const REASONS: Record<'not_provided' | 'na', string[]> = {
  not_provided: ['客戶不願透露', '客戶不清楚', '客戶尚未決定', '本次未談到'],
  na: ['與本次拜訪無關', '客戶無此需求', '先前已確認'],
};

/** 「客戶未提供/不適用」必選原因 */
export function ReasonSheet({
  visible,
  onClose,
  onSubmit,
  title,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (r: { status: Extract<AnswerStatus, 'not_provided' | 'na'>; reason: string }) => void;
  title?: string;
}) {
  const [status, setStatus] = useState<'not_provided' | 'na'>('not_provided');
  const [reason, setReason] = useState('');
  const [custom, setCustom] = useState('');
  const final = reason === '其他' ? custom.trim() : reason;
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={title || '客戶未提供/不適用'}
      footer={
        <Button
          title="確定"
          disabled={!final}
          onPress={() => {
            onSubmit({ status, reason: final });
            setReason('');
            setCustom('');
          }}
        />
      }
    >
      <Radio selected={status === 'not_provided'} onPress={() => { setStatus('not_provided'); setReason(''); }} label="客戶未提供" />
      <Radio selected={status === 'na'} onPress={() => { setStatus('na'); setReason(''); }} label="不適用" />
      <Txt size={T.small} color={C.text2} weight="600" style={{ marginTop: SP.md, marginBottom: SP.sm }}>
        請選擇原因(必選)
      </Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm }}>
        {[...REASONS[status], '其他'].map((r) => (
          <Chip key={r} label={r} tone={reason === r ? 'orange' : 'gray'} selected={reason === r ? true : false} onPress={() => setReason(r)} style={{ height: 32, paddingHorizontal: 12 }} />
        ))}
      </View>
      {reason === '其他' ? <Field placeholder="請輸入原因" value={custom} onChangeText={setCustom} style={{ marginTop: SP.md }} /> : null}
    </Sheet>
  );
}
