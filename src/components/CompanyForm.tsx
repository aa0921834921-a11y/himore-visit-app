import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Chip, Field, IconButton, Row, Txt } from './ui';
import { Sheet } from './Sheet';
import { C, R, SP, T } from '../theme';
import { useAppState } from '../store/store';
import { salesUsers } from '../store/selectors';
import { AUTOMATION_LEVELS, OPTION_META, optionsOf } from '../store/options';
import { addCustomer, updateCustomer } from '../store/actions';
import { uid } from '../lib/util';
import type { AutomationLevel, Customer, Machine, OptionKey } from '../types';

/** 選項晶片:多選或單選,可加入清單外的值 */
export function ChipSelect({
  label,
  hint,
  options,
  value,
  onChange,
  single,
  allowCustom,
}: {
  label: string;
  hint?: string;
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  single?: boolean;
  allowCustom?: boolean;
}) {
  const [custom, setCustom] = useState('');
  const all = Array.from(new Set([...options, ...value]));
  return (
    <View style={{ marginBottom: SP.md }}>
      <Txt size={T.small} weight="600" color={C.text2} style={{ marginBottom: 6 }}>
        {label}
        {hint ? (
          <Txt size={T.tiny + 1} color={C.text3}>
            {'  '}
            {hint}
          </Txt>
        ) : null}
      </Txt>
      <Row style={{ flexWrap: 'wrap' }} gap={6}>
        {all.map((o) => {
          const on = value.includes(o);
          return (
            <Chip
              key={o}
              label={on && !single ? `✓ ${o}` : o}
              tone={on ? 'orange' : 'gray'}
              onPress={() => onChange(single ? (on ? [] : [o]) : on ? value.filter((x) => x !== o) : [...value, o])}
              style={{ height: 32, paddingHorizontal: 12 }}
            />
          );
        })}
      </Row>
      {allowCustom ? (
        <Row style={{ marginTop: SP.sm }} gap={SP.sm}>
          <View style={{ flex: 1 }}>
            <Field value={custom} onChangeText={setCustom} placeholder="清單沒有的,在這裡輸入" style={{ marginBottom: 0 }} />
          </View>
          <Button
            title="加入"
            small
            full={false}
            variant="secondary"
            disabled={!custom.trim()}
            onPress={() => {
              const t = custom.trim();
              if (!value.includes(t)) onChange(single ? [t] : [...value, t]);
              setCustom('');
            }}
          />
        </Row>
      ) : null}
    </View>
  );
}

type Form = {
  name: string;
  code: string;
  taxId: string;
  principal: string;
  phone: string;
  city: string;
  district: string;
  street: string;
  website: string;
  category: string[];
  customerTypes: string[];
  industries: string[];
  products: string[];
  identities: string[];
  moldInjection: string[];
  markets: string[];
  employeeScale: string[];
  evaluatingSeries: string;
  ownerId: string;
  machines: Machine[];
  level: string[];
  processes: string[];
  processOther: string;
};

function toForm(c: Partial<Customer> | undefined, defaultOwner: string): Form {
  const legacyAddr = c?.addr ? undefined : c?.address;
  return {
    name: c?.name || '',
    code: c?.code || '',
    taxId: c?.taxId || '',
    principal: c?.principal || '',
    phone: c?.phone || '',
    city: c?.addr?.city || '',
    district: c?.addr?.district || '',
    street: c?.addr?.street || legacyAddr || '',
    website: c?.website || '',
    category: c?.category ? [c.category] : [],
    customerTypes: c?.customerTypes || [],
    industries: c?.industries?.length ? c.industries : c?.industry ? [c.industry] : [],
    products: c?.products || [],
    identities: c?.identities || [],
    moldInjection: c?.moldInjection || [],
    markets: c?.markets || [],
    employeeScale: c?.employeeScale ? [c.employeeScale] : [],
    evaluatingSeries: c?.evaluatingSeries || '',
    ownerId: c?.ownerId || defaultOwner,
    machines: c?.machines?.length ? c.machines : [],
    level: c?.automation?.level ? [c.automation.level] : [],
    processes: c?.automation?.processes || [],
    processOther: c?.automation?.other || '',
  };
}

/**
 * 公司基本資料編輯(前台業務與後台主管共用):基本資訊、分類與歸屬、工廠資訊(射出機可多筆)、產線自動化程度。
 * customer 為空時新增客戶;initial 可帶入預填值(例:名片辨識結果)。
 */
export function CompanyForm({
  visible,
  customer,
  initial,
  onClose,
  onSaved,
  canEditOwner,
  title,
  children,
}: {
  visible: boolean;
  customer?: Customer;
  initial?: Partial<Customer>;
  onClose: () => void;
  onSaved?: (c: Customer) => void;
  canEditOwner?: boolean;
  title?: string;
  children?: React.ReactNode;
}) {
  if (!visible) return null;
  return <Inner key={customer?.id || 'new'} customer={customer} initial={initial} onClose={onClose} onSaved={onSaved} canEditOwner={canEditOwner} title={title}>{children}</Inner>;
}

function Inner({ customer, initial, onClose, onSaved, canEditOwner, title, children }: { customer?: Customer; initial?: Partial<Customer>; onClose: () => void; onSaved?: (c: Customer) => void; canEditOwner?: boolean; title?: string; children?: React.ReactNode }) {
  const s = useAppState();
  const [f, setF] = useState<Form>(() => toForm(customer || initial, initial?.ownerId || salesUsers(s)[0]?.id || ''));
  const set = <K extends keyof Form>(k: K) => (v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const taxBad = !!f.taxId.trim() && !/^\d{8}$/.test(f.taxId.trim());
  const phoneBad = !!f.phone.trim() && !/^[\d()\-+#\s]{6,}$/.test(f.phone.trim());
  const opt = (k: OptionKey) => optionsOf(s, k);

  const save = () => {
    const data: Partial<Customer> & { name: string } = {
      name: f.name.trim(),
      taxId: f.taxId.trim() || undefined,
      principal: f.principal.trim() || undefined,
      phone: f.phone.trim() || undefined,
      addr: f.city || f.district || f.street ? { city: f.city.trim() || undefined, district: f.district.trim() || undefined, street: f.street.trim() || undefined } : undefined,
      address: undefined,
      website: f.website.trim() || undefined,
      category: f.category[0],
      customerTypes: f.customerTypes,
      industries: f.industries,
      industry: undefined,
      products: f.products,
      identities: f.identities,
      moldInjection: f.moldInjection,
      markets: f.markets,
      employeeScale: f.employeeScale[0],
      evaluatingSeries: f.evaluatingSeries.trim() || undefined,
      ownerId: f.ownerId,
      machines: f.machines.filter((m) => m.brand || m.tonnage || m.qty),
      automation: f.level.length || f.processes.length || f.processOther ? { level: f.level[0] as AutomationLevel | undefined, processes: f.processes, other: f.processOther.trim() || undefined } : undefined,
    };
    if (customer) {
      updateCustomer(customer.id, data);
      onSaved?.({ ...customer, ...data });
    } else {
      const c = addCustomer({ ...data, code: f.code.trim() || undefined, contacts: initial?.contacts || [] });
      onSaved?.(c);
    }
    onClose();
  };

  const setMachine = (id: string, patch: Partial<Machine>) => set('machines')(f.machines.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  return (
    <Sheet visible onClose={onClose} title={title || (customer ? '編輯公司資料' : '新增客戶')} footer={<Button title="儲存" disabled={!f.name.trim() || taxBad || phoneBad} onPress={save} />}>
      <Section no="01" title="基本資訊" />
      <Field label="公司名稱 *" value={f.name} onChangeText={set('name')} placeholder="例:永群精密模具有限公司" />
      <Row gap={SP.md}>
        <View style={{ flex: 1 }}>
          <Field label="統一編號" value={f.taxId} onChangeText={(t) => set('taxId')(t.replace(/\D/g, '').slice(0, 8))} keyboardType="number-pad" placeholder="8 碼" error={taxBad ? '統編為 8 碼數字' : undefined} />
        </View>
        <View style={{ flex: 1 }}>
          {customer ? <Field label="客戶編號" value={customer.code} editable={false} /> : <Field label="客戶編號" value={f.code} onChangeText={set('code')} placeholder="留空自動產生" />}
        </View>
      </Row>
      <Row gap={SP.md}>
        <View style={{ flex: 1 }}>
          <Field label="公司負責人" value={f.principal} onChangeText={set('principal')} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="公司電話" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" placeholder="03-3811613" hint="格式:區碼-電話號碼" error={phoneBad ? '電話格式不正確' : undefined} />
        </View>
      </Row>
      <Txt size={T.small} weight="600" color={C.text2} style={{ marginBottom: 6 }}>
        地址
      </Txt>
      <Row gap={SP.sm}>
        <View style={{ flex: 1 }}>
          <Field value={f.city} onChangeText={set('city')} placeholder="縣市" />
        </View>
        <View style={{ flex: 1 }}>
          <Field value={f.district} onChangeText={set('district')} placeholder="區域" />
        </View>
      </Row>
      <Field value={f.street} onChangeText={set('street')} placeholder="街道門號" />
      <Field label="網址" value={f.website} onChangeText={set('website')} autoCapitalize="none" keyboardType="url" placeholder="https://" />

      <Section no="02" title="分類與歸屬" />
      <ChipSelect label="客戶狀態" options={optionsOf(s, 'categories')} value={f.category} onChange={set('category')} single />
      <ChipSelect label="客戶類型" options={opt('customerTypes')} value={f.customerTypes} onChange={set('customerTypes')} />
      <ChipSelect label="所屬產業" hint="可複選" options={optionsOf(s, 'industries')} value={f.industries} onChange={set('industries')} allowCustom />
      <ChipSelect label="射出產品" hint="可複選" options={opt('products')} value={f.products} onChange={set('products')} allowCustom />
      <ChipSelect label={OPTION_META.identities.label} options={opt('identities')} value={f.identities} onChange={set('identities')} />
      <ChipSelect label={OPTION_META.moldInjection.label} options={opt('moldInjection')} value={f.moldInjection} onChange={set('moldInjection')} />
      <ChipSelect label="產品應用市場" options={opt('markets')} value={f.markets} onChange={set('markets')} allowCustom />
      <ChipSelect label="員工規模" options={opt('employeeScales')} value={f.employeeScale} onChange={set('employeeScale')} single />
      <Field label="評估系列" value={f.evaluatingSeries} onChangeText={set('evaluatingSeries')} placeholder="例:GT 系列" />
      {canEditOwner ? (
        <ChipSelect
          label="負責業務"
          options={salesUsers(s).map((u) => u.name)}
          value={[salesUsers(s).find((u) => u.id === f.ownerId)?.name || ''].filter(Boolean)}
          onChange={(v) => set('ownerId')(salesUsers(s).find((u) => u.name === v[0])?.id || f.ownerId)}
          single
        />
      ) : null}

      <Section no="03" title="工廠資訊" />
      <Txt size={T.tiny + 1} color={C.text3} style={{ marginBottom: SP.sm }}>
        每筆依廠牌、噸數與數量記錄,可新增多筆
      </Txt>
      {f.machines.map((m, i) => (
        <View key={m.id} style={styles.machine}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt size={T.small} weight="700">
              射出機 {i + 1}
            </Txt>
            <IconButton name="trash" size={16} color={C.text3} label="刪除" onPress={() => set('machines')(f.machines.filter((x) => x.id !== m.id))} />
          </Row>
          <Row style={{ flexWrap: 'wrap', marginBottom: SP.sm }} gap={6}>
            {opt('machineBrands').map((b) => (
              <Chip key={b} label={b} tone={m.brand === b ? 'orange' : 'gray'} onPress={() => setMachine(m.id, { brand: m.brand === b ? undefined : b })} />
            ))}
          </Row>
          <Row gap={SP.sm}>
            <View style={{ flex: 1.3 }}>
              <Field label="廠牌" value={m.brand || ''} onChangeText={(t) => setMachine(m.id, { brand: t || undefined })} style={{ marginBottom: 0 }} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="噸數" value={m.tonnage || ''} onChangeText={(t) => setMachine(m.id, { tonnage: t.replace(/[^\d.]/g, '') || undefined })} keyboardType="number-pad" style={{ marginBottom: 0 }} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="數量" value={m.qty ? String(m.qty) : ''} onChangeText={(t) => setMachine(m.id, { qty: Number(t.replace(/\D/g, '')) || undefined })} keyboardType="number-pad" style={{ marginBottom: 0 }} />
            </View>
          </Row>
        </View>
      ))}
      <Button title="+新增射出機" small variant="secondary" onPress={() => set('machines')([...f.machines, { id: uid('m') }])} style={{ marginBottom: SP.md }} />

      <Section no="04" title="產線自動化程度" />
      <ChipSelect label="自動化程度" options={[...AUTOMATION_LEVELS]} value={f.level} onChange={set('level')} single />
      <ChipSelect label="已自動化製程" hint="可複選" options={opt('automationProcesses')} value={f.processes} onChange={set('processes')} />
      <Field label="其他製程" value={f.processOther} onChangeText={set('processOther')} placeholder="請輸入" />

      {children}
    </Sheet>
  );
}

function Section({ no, title }: { no: string; title: string }) {
  return (
    <Row style={{ marginTop: SP.md, marginBottom: SP.sm }} gap={8}>
      <View style={styles.no}>
        <Txt size={T.tiny + 1} weight="700" color={C.teal}>
          {no}
        </Txt>
      </View>
      <Txt weight="700" color={C.teal}>
        {title}
      </Txt>
    </Row>
  );
}

const styles = StyleSheet.create({
  no: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: C.tealLine, alignItems: 'center', justifyContent: 'center' },
  machine: { borderWidth: 1, borderColor: C.line, borderRadius: R.md, padding: SP.md, marginBottom: SP.sm },
});
