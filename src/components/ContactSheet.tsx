import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Chip, Field, Row, Txt } from './ui';
import { Sheet } from './Sheet';
import { confirmDialog } from './Dialog';
import { C, R, SP, T } from '../theme';
import { DECISION_ROLES } from '../store/selectors';
import { addContact, removeContact, updateContact } from '../store/actions';
import type { Contact, DecisionRole } from '../types';

const EMPTY: Omit<Contact, 'id'> = { name: '', title: '', department: '', phone: '', email: '', decisionRole: undefined, preference: '' };

/** 1-2 聯絡人資料:姓名/職稱/部門/電話/E-mail/決策角色/聯絡人偏好 */
export function ContactSheet({ customerId, contact, visible, onClose }: { customerId: string; contact?: Contact | null; visible: boolean; onClose: () => void }) {
  return visible ? <Inner key={contact?.id || 'new'} customerId={customerId} contact={contact} onClose={onClose} /> : null;
}

function Inner({ customerId, contact, onClose }: { customerId: string; contact?: Contact | null; onClose: () => void }) {
  const [f, setF] = useState<Omit<Contact, 'id'>>(() => ({ ...EMPTY, ...contact }));
  const set = (k: keyof Omit<Contact, 'id'>) => (t: string) => setF({ ...f, [k]: t });
  const emailBad = !!f.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim());
  const clean = (): Omit<Contact, 'id'> => ({
    name: f.name.trim(),
    title: f.title?.trim() || undefined,
    department: f.department?.trim() || undefined,
    phone: f.phone?.trim() || undefined,
    email: f.email?.trim() || undefined,
    decisionRole: f.decisionRole,
    preference: f.preference?.trim() || undefined,
  });
  const save = () => {
    if (contact) updateContact(customerId, { ...clean(), id: contact.id });
    else addContact(customerId, clean());
    onClose();
  };
  return (
    <Sheet
      visible
      onClose={onClose}
      title={contact ? '編輯聯絡人' : '新增聯絡人'}
      footer={
        <>
          <Button title="儲存" disabled={!f.name.trim() || emailBad} onPress={save} />
          {contact ? (
            <Button
              title="刪除聯絡人"
              variant="ghost"
              onPress={async () => {
                if (await confirmDialog({ title: '刪除這位聯絡人?', message: contact.name, ok: '刪除', danger: true })) {
                  removeContact(customerId, contact.id);
                  onClose();
                }
              }}
            />
          ) : null}
        </>
      }
    >
      <Field label="姓名" value={f.name} onChangeText={set('name')} placeholder="例:張志明(張經理)" />
      <Row gap={SP.md}>
        <View style={{ flex: 1 }}>
          <Field label="職稱" value={f.title} onChangeText={set('title')} placeholder="例:採購經理" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="部門" value={f.department} onChangeText={set('department')} placeholder="例:採購部" />
        </View>
      </Row>
      <Field label="電話" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" placeholder="例:04-2350-1234 #12" />
      <Field label="E-mail" value={f.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" placeholder="name@company.com" error={emailBad ? 'E-mail 格式不正確' : undefined} />
      <Txt size={T.small} color={C.text2} weight="600" style={{ marginBottom: 6 }}>
        決策角色
      </Txt>
      <Row style={{ flexWrap: 'wrap', marginBottom: SP.md }}>
        {DECISION_ROLES.map((r) => (
          <Chip key={r} label={r} tone={f.decisionRole === r ? 'orange' : 'gray'} onPress={() => setF({ ...f, decisionRole: f.decisionRole === r ? undefined : (r as DecisionRole) })} style={{ height: 32, paddingHorizontal: 12 }} />
        ))}
      </Row>
      <Field label="聯絡人偏好" value={f.preference} onChangeText={set('preference')} multiline placeholder="例:偏好 Email 聯繫;上午較好約;重視數據佐證" hint="拜訪中 AI 抓到的偏好/避免事項,確認後也會顯示在這位聯絡人底下" />
    </Sheet>
  );
}

/** 聯絡人卡片:顯示完整欄位與 AI 確認過的偏好 */
export function contactLine(c: Contact): string {
  return [c.title, c.department].filter(Boolean).join('・');
}

export function ContactRow({ ct, onPress, extra }: { ct: Contact; onPress?: () => void; extra?: string[] }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [{ borderWidth: 1, borderColor: C.line, borderRadius: R.md, padding: SP.md, marginBottom: SP.sm }, pressed && { opacity: 0.8 }]}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt weight="700">{ct.name}</Txt>
        {ct.decisionRole ? <Chip label={ct.decisionRole} tone={ct.decisionRole === '決策者' ? 'orange' : 'teal'} /> : null}
      </Row>
      {contactLine(ct) ? (
        <Txt size={T.small} color={C.text2}>
          {contactLine(ct)}
        </Txt>
      ) : null}
      {ct.phone || ct.email ? (
        <Txt size={T.small} color={C.text2}>
          {[ct.phone, ct.email].filter(Boolean).join('|')}
        </Txt>
      ) : null}
      {ct.preference ? (
        <Txt size={T.small} color={C.yellow} style={{ marginTop: 2 }}>
          偏好:{ct.preference}
        </Txt>
      ) : null}
      {(extra || []).map((x, i) => (
        <Txt key={i} size={T.small} color={x.startsWith('避免') ? '#FF6B66' : C.teal} style={{ marginTop: 2 }}>
          AI:{x}
        </Txt>
      ))}
    </Pressable>
  );
}
