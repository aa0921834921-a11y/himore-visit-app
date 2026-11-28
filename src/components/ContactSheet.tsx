import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Chip, Field, Icon, Row, Txt } from './ui';
import { Sheet } from './Sheet';
import { confirmDialog } from './Dialog';
import { CustomerPicker } from './Pickers';
import { C, R, SP, T } from '../theme';
import { useAppState } from '../store/store';
import { customerById } from '../store/selectors';
import { optionsOf } from '../store/options';
import { addContact, moveContact, removeContact, updateContact } from '../store/actions';
import type { Contact } from '../types';

const EMPTY: Omit<Contact, 'id'> = { name: '', title: '', department: '', phone: '', email: '', decisionRole: undefined, note: '' };

/** 聯絡人:姓名(必填)、職稱、部門、角色、所屬公司、電話、Email、備註 */
export function ContactSheet({ customerId, contact, visible, onClose }: { customerId: string; contact?: Contact | null; visible: boolean; onClose: () => void }) {
  return visible ? <Inner key={contact?.id || 'new'} customerId={customerId} contact={contact} onClose={onClose} /> : null;
}

function Inner({ customerId, contact, onClose }: { customerId: string; contact?: Contact | null; onClose: () => void }) {
  const s = useAppState();
  const [f, setF] = useState<Omit<Contact, 'id'>>(() => ({ ...EMPTY, ...contact, note: contact?.note || contact?.preference || '' }));
  const [companyId, setCompanyId] = useState(customerId);
  const [pick, setPick] = useState(false);
  const set = (k: keyof Omit<Contact, 'id'>) => (t: string) => setF({ ...f, [k]: t });
  const emailBad = !!f.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim());
  const roles = optionsOf(s, 'contactRoles');
  const clean = (): Omit<Contact, 'id'> => ({
    name: f.name.trim(),
    title: f.title?.trim() || undefined,
    department: f.department?.trim() || undefined,
    phone: f.phone?.trim() || undefined,
    email: f.email?.trim() || undefined,
    decisionRole: f.decisionRole || undefined,
    note: f.note?.trim() || undefined,
    preference: undefined,
  });
  const save = () => {
    if (contact) {
      updateContact(customerId, { ...clean(), id: contact.id });
      if (companyId !== customerId) moveContact(customerId, companyId, { ...clean(), id: contact.id });
    } else addContact(companyId, clean());
    onClose();
  };
  return (
    <>
      <Sheet
        visible={!pick}
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
        <Field label="姓名 *" value={f.name} onChangeText={set('name')} placeholder="請輸入姓名" />
        <Row gap={SP.md}>
          <View style={{ flex: 1 }}>
            <Field label="職稱" value={f.title} onChangeText={set('title')} placeholder="例:工程部主任" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="部門" value={f.department} onChangeText={set('department')} placeholder="例:製造部" />
          </View>
        </Row>
        <Txt size={T.small} color={C.text2} weight="600" style={{ marginBottom: 6 }}>
          角色
        </Txt>
        <Row style={{ flexWrap: 'wrap', marginBottom: SP.md }} gap={6}>
          {Array.from(new Set([...roles, ...(f.decisionRole ? [f.decisionRole] : [])])).map((r) => (
            <Chip key={r} label={r} tone={f.decisionRole === r ? 'orange' : 'gray'} onPress={() => setF({ ...f, decisionRole: f.decisionRole === r ? undefined : r })} style={{ height: 32, paddingHorizontal: 12 }} />
          ))}
        </Row>
        <Txt size={T.small} color={C.text2} weight="600" style={{ marginBottom: 6 }}>
          所屬公司
        </Txt>
        <Pressable onPress={() => setPick(true)} style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.line, borderRadius: R.pill, paddingHorizontal: SP.lg, height: 48, marginBottom: SP.md }}>
          <Txt style={{ flex: 1 }}>{customerById(s, companyId)?.name || '選擇公司'}</Txt>
          <Icon name="down" size={16} color={C.text2} />
        </Pressable>
        <Row gap={SP.md}>
          <View style={{ flex: 1 }}>
            <Field label="電話" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" placeholder="0912-345-678" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Email" value={f.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" placeholder="name@company.com" error={emailBad ? '格式不正確' : undefined} />
          </View>
        </Row>
        <Field label="備註" value={f.note} onChangeText={set('note')} multiline placeholder="請輸入補充說明,例:偏好 LINE 聯繫、上午較好約" />
      </Sheet>
      <CustomerPicker
        visible={pick}
        selectedId={companyId}
        onClose={() => setPick(false)}
        onPick={(cu) => {
          setCompanyId(cu.id);
          setPick(false);
        }}
      />
    </>
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
      {ct.note || ct.preference ? (
        <Txt size={T.small} color={C.yellow} style={{ marginTop: 2 }}>
          備註:{ct.note || ct.preference}
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
