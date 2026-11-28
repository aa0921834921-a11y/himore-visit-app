import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Header, Screen } from '../../../components/Screen';
import { Button, Card, Checkbox, Chip, EmptyState, IconButton, Notice, Row, Segmented, Txt } from '../../../components/ui';
import { confirmDialog } from '../../../components/Dialog';
import { ContactRow, ContactSheet } from '../../../components/ContactSheet';
import { CompanyForm } from '../../../components/CompanyForm';
import { C, R, SP, T } from '../../../theme';
import { useAppState } from '../../../store/store';
import {
  avoidItems,
  categoriesOf,
  confirmedVisitsOf,
  currentUser,
  customerById,
  customerVisitType,
  industriesOf,
  lastConfirmedVisit,
  openTodosOfCustomer,
  pendingFollowups,
  purposeOf,
  userById,
  visitKindOf,
} from '../../../store/selectors';
import { addressOf, machinesText, optionsOf } from '../../../store/options';
import { deletePreference, toggleTodo } from '../../../store/actions';
import { addDays, fmtDate, fmtShortDate, truncate, ymd } from '../../../lib/util';
import type { Contact, Customer, FieldSource } from '../../../types';

type Tab = 'overview' | 'company' | 'contacts' | 'visits' | 'prefs';

// S14 客戶檔案:五大頁籤(總覽/公司基本資料/聯絡人/拜訪紀錄/偏好與避免)。只顯示已確認入庫的資料
export default function CustomerDetail() {
  const { id, tab: tabParam } = useLocalSearchParams<{ id: string; tab?: Tab }>();
  const s = useAppState();
  const me = currentUser(s);
  const [tab, setTab] = useState<Tab>(tabParam || 'overview');
  const [contactEdit, setContactEdit] = useState<Contact | 'new' | null>(null);
  const [editCompany, setEditCompany] = useState(false);
  const c = customerById(s, id);
  if (!c) return null;
  if (me?.role === 'sales' && c.ownerId !== me.id) {
    return (
      <Screen header={<Header title="客戶檔案" />}>
        <Notice tone="red" text="只能查看自己負責的客戶。" />
      </Screen>
    );
  }
  const canEdit = me?.role === 'admin' || me?.id === c.ownerId;
  const type = customerVisitType(s, c.id);

  return (
    <Screen bg="base" header={<Header title="客戶檔案" />}>
      <View style={{ marginTop: SP.lg, marginBottom: SP.md }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Txt size={T.h2} weight="700">
              {c.name}
            </Txt>
            <Txt size={T.small} color={C.text2}>
              {[c.code, c.category, `負責業務:${userById(s, c.ownerId)?.name || '未指派'}`].filter(Boolean).join('|')}
            </Txt>
          </View>
          <Chip label={type} tone={type === '初次' ? 'teal' : 'orange'} />
        </Row>
      </View>

      <Segmented
        value={tab}
        onChange={setTab}
        style={{ marginBottom: SP.md }}
        options={[
          { value: 'overview', label: '總覽' },
          { value: 'company', label: '公司資料' },
          { value: 'contacts', label: '聯絡人' },
          { value: 'visits', label: '拜訪紀錄' },
          { value: 'prefs', label: '偏好避免' },
        ]}
      />

      {tab === 'overview' ? <Overview c={c} goto={setTab} /> : null}
      {tab === 'company' ? <Company c={c} canEdit={canEdit} onEdit={() => setEditCompany(true)} /> : null}

      {tab === 'contacts' ? (
        <>
          {c.contacts.length ? (
            c.contacts.map((ct) => (
              <ContactRow
                key={ct.id}
                ct={ct}
                extra={s.preferences.filter((p) => p.customerId === c.id && p.target === 'contact' && p.targetName === ct.name).map((p) => `${p.type === 'avoid' ? '避免' : '偏好'}:${p.content}`)}
                onPress={canEdit ? () => setContactEdit(ct) : undefined}
              />
            ))
          ) : (
            <EmptyState text="尚無聯絡人" />
          )}
          {canEdit ? <Button title="+新增聯絡人" variant="secondary" small onPress={() => setContactEdit('new')} /> : null}
          <Txt size={T.tiny + 1} color={C.text3} style={{ marginTop: SP.sm }}>
            同一客戶可新增多位聯絡人;拜訪中提到的新聯絡人,業務確認後會自動加入。
          </Txt>
        </>
      ) : null}

      {tab === 'visits' ? <Visits c={c} /> : null}
      {tab === 'prefs' ? <Prefs c={c} canDelete={me?.id === c.ownerId} /> : null}

      <ContactSheet customerId={c.id} visible={!!contactEdit} contact={contactEdit === 'new' ? null : contactEdit} onClose={() => setContactEdit(null)} />
      <CompanyForm visible={editCompany} customer={c} canEditOwner={me?.role === 'admin'} onClose={() => setEditCompany(false)} />
    </Screen>
  );
}

/** 總覽:拜訪前 30 秒掌握重點;每區最多三筆 */
function Overview({ c, goto }: { c: Customer; goto: (t: Tab) => void }) {
  const s = useAppState();
  const visits = confirmedVisitsOf(s, c.id);
  const last = lastConfirmedVisit(s, c.id);
  const lastEffective = visits.find((v) => visitKindOf(v) === 'effective');
  const todos = openTodosOfCustomer(s, c.id);
  const follow = pendingFollowups(s, c.id);
  const avoid = avoidItems(s, c.id);
  const prefs = s.preferences.filter((p) => p.customerId === c.id);
  const need = categoriesOf(lastEffective).c2?.[0];
  const soon = ymd(addDays(new Date(), 3));

  const summary = [
    { k: '產品/市場', v: [...(c.products || []), ...(c.markets || [])].join('、') || industriesOf(c).join('、') },
    { k: '工廠概況', v: [machinesText(c), c.automation?.level].filter(Boolean).join(';') },
    { k: '目前需求', v: need ? `${need.text}${need.status !== 'explicit' ? '(可能)' : ''}` : '' },
  ];
  const reminders: { tag: string; tone: 'red' | 'yellow' | 'orange'; text: string }[] = [];
  const due = todos.filter((t) => t.due && t.due <= soon).sort((a, b) => (a.due || '').localeCompare(b.due || ''))[0];
  if (due) reminders.push({ tag: '到期待辦', tone: 'red', text: `${due.content}・${userById(s, due.ownerId)?.name || ''}・${fmtShortDate(due.due!)}` });
  const promise = categoriesOf(last).c7?.[0];
  if (promise) reminders.push({ tag: '上次承諾', tone: 'yellow', text: promise.text });
  if (follow[0]) reminders.push({ tag: `待補問 ${follow[0].question?.code}`, tone: 'orange', text: follow[0].status === 'partial' ? `請補問:${follow[0].missing || follow[0].question?.text}` : `上次未問到:${follow[0].question?.text}` });
  const changes: string[] = [];
  if (last) changes.push(`最近拜訪:${fmtShortDate(last.visitAt)} ${purposeOf(last, s) || (visitKindOf(last) === 'general' ? '一般拜訪' : '')}`);
  const possible = visits.flatMap((v) => Object.values(categoriesOf(v)).flat()).find((x) => x && x.status === 'possible');
  if (possible) changes.push(`${possible.text}(可能)`);
  const src = Object.entries(c.fieldSources || {}).sort((a, b) => b[1].at.localeCompare(a[1].at))[0];
  if (src) changes.push(`${fieldName(src[0])}由 ${fmtShortDate(src[1].at)} 拜訪更新`);

  return (
    <>
      <Block title="客戶重點摘要" icon="◎" link="查看公司資料" onLink={() => goto('company')}>
        {summary.map((x) => (
          <Txt key={x.k} size={T.small} style={{ marginTop: 2 }}>
            ・{x.k}:{x.v || <Txt size={T.small} color={C.text3}>待補充</Txt>}
          </Txt>
        ))}
      </Block>

      <Block title="本次拜訪提醒" tone="orange">
        {reminders.length ? (
          reminders.slice(0, 3).map((r, i) => (
            <Row key={i} style={{ marginTop: 4, alignItems: 'flex-start' }} gap={8}>
              <Chip label={r.tag} tone={r.tone} />
              <Txt size={T.small} style={{ flex: 1 }}>
                {r.text}
              </Txt>
            </Row>
          ))
        ) : (
          <Txt size={T.small} color={C.text3}>
            沒有需要提醒的事項
          </Txt>
        )}
      </Block>

      <Row gap={SP.sm} style={{ alignItems: 'stretch', flexWrap: 'wrap' }}>
        <View style={{ flex: 1, minWidth: 260 }}>
          <Block title="主要聯絡人" link="查看聯絡人" onLink={() => goto('contacts')}>
            {c.contacts.length ? (
              c.contacts.slice(0, 3).map((ct) => (
                <Txt key={ct.id} size={T.small} style={{ marginTop: 2 }}>
                  ・{ct.name}|{ct.decisionRole || ct.title || '—'}
                  {ct.phone ? `  ☎ ${ct.phone}` : ''}
                </Txt>
              ))
            ) : (
              <Txt size={T.small} color={C.text3}>
                尚無聯絡人
              </Txt>
            )}
          </Block>
        </View>
        <View style={{ flex: 1, minWidth: 260 }}>
          <Block title="近期拜訪與變化" link="查看拜訪紀錄" onLink={() => goto('visits')}>
            {changes.length ? (
              changes.slice(0, 3).map((x, i) => (
                <Txt key={i} size={T.small} style={{ marginTop: 2 }}>
                  ・{x}
                </Txt>
              ))
            ) : (
              <Txt size={T.small} color={C.text3}>
                尚未拜訪
              </Txt>
            )}
          </Block>
        </View>
      </Row>

      <Block title="偏好與注意事項" tone={avoid.length ? 'red' : undefined} link="查看完整內容" onLink={() => goto('prefs')}>
        {prefs.length ? (
          [...avoid, ...prefs.filter((p) => p.type !== 'avoid')].slice(0, 3).map((p) => (
            <Txt key={p.id} size={T.small} color={p.type === 'avoid' ? '#FF8A86' : C.text} style={{ marginTop: 2 }}>
              ・{p.type === 'avoid' ? '避免:' : ''}
              {p.content}
            </Txt>
          ))
        ) : (
          <Txt size={T.small} color={C.text3}>
            尚無
          </Txt>
        )}
      </Block>

      {todos.length ? (
        <Card style={{ marginBottom: SP.md, paddingVertical: SP.md }}>
          <Txt size={T.small} weight="700" color={C.teal} style={{ marginBottom: 4 }}>
            待辦事項({todos.length})
          </Txt>
          {todos.slice(0, 3).map((t) => (
            <Checkbox key={t.id} checked={t.done} onPress={() => toggleTodo(t.id)} label={t.content} sub={t.due ? `期限 ${fmtShortDate(t.due)}・${userById(s, t.ownerId)?.name || ''}` : userById(s, t.ownerId)?.name} />
          ))}
        </Card>
      ) : null}

      <Row gap={SP.md}>
        <View style={{ flex: 1 }}>
          <Button title="查看拜訪簡報" variant="secondary" onPress={() => router.push({ pathname: '/customer/[id]/briefing', params: { id: c.id } })} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="開始記錄" onPress={() => router.push({ pathname: '/record/start', params: { customerId: c.id } })} />
        </View>
      </Row>
      <Txt size={T.tiny + 1} color={C.text3} style={{ marginTop: SP.sm }}>
        以上內容來自已確認入庫的拜訪;標示「可能」的內容尚未確認。
      </Txt>
    </>
  );
}

function fieldName(key: string): string {
  const map: Record<string, string> = { machines: '射出機', automation: '自動化程度', products: '射出產品', markets: '應用市場', industries: '所屬產業', phone: '公司電話', principal: '負責人', address: '地址', website: '網址', employeeScale: '員工規模', customerTypes: '客戶類型' };
  return key.startsWith('contact:') ? `聯絡人 ${key.slice(8)}` : map[key] || key;
}

function Block({ title, icon, link, onLink, tone, children }: { title: string; icon?: string; link?: string; onLink?: () => void; tone?: 'orange' | 'red'; children: React.ReactNode }) {
  return (
    <View style={[styles.block, tone === 'orange' && styles.blockOrange, tone === 'red' && styles.blockRed]}>
      <Row style={{ justifyContent: 'space-between', marginBottom: 4 }}>
        <Txt size={T.small} weight="700" color={tone === 'orange' ? C.orange : tone === 'red' ? '#FF8A86' : C.teal}>
          {icon ? `${icon} ` : ''}
          {title}
        </Txt>
        {link ? (
          <Pressable onPress={onLink} hitSlop={8}>
            <Txt size={T.tiny + 1} color={C.text2}>
              {link} ›
            </Txt>
          </Pressable>
        ) : null}
      </Row>
      {children}
    </View>
  );
}

/** 公司基本資料:基本資訊、分類與歸屬、工廠資訊、產線自動化程度 */
function Company({ c, canEdit, onEdit }: { c: Customer; canEdit: boolean; onEdit: () => void }) {
  const s = useAppState();
  const srcLine = (key: string) => {
    const f: FieldSource | undefined = c.fieldSources?.[key];
    return f ? `${fmtDate(f.at)} 拜訪取得${f.quote ? `:「${truncate(f.quote, 30)}」` : ''}` : undefined;
  };
  const kv = (k: string, v?: string, src?: string) => (
    <View key={k} style={styles.kv}>
      <Txt size={T.small} color={C.text2} style={{ width: 88 }}>
        {k}
      </Txt>
      <View style={{ flex: 1 }}>
        <Txt size={T.small} color={v ? C.text : C.text3}>
          {v || '待補充'}
        </Txt>
        {src ? (
          <Txt size={T.tiny} color={C.teal}>
            {src}
          </Txt>
        ) : null}
      </View>
    </View>
  );
  const procs = optionsOf(s, 'automationProcesses');
  const doneProcs = c.automation?.processes || [];
  return (
    <>
      <Sec no="01" title="基本資訊">
        {kv('公司名稱', c.name)}
        {kv('客戶編號', c.code)}
        {kv('統一編號', c.taxId)}
        {kv('公司負責人', c.principal, srcLine('principal'))}
        {kv('公司電話', c.phone, srcLine('phone'))}
        {kv('地址', addressOf(c), srcLine('address'))}
        {kv('網址', c.website)}
      </Sec>
      <Sec no="02" title="分類與歸屬">
        {kv('客戶類型', c.customerTypes?.join('、'))}
        {kv('所屬產業', industriesOf(c).join('、'), srcLine('industries'))}
        {kv('射出產品', c.products?.join('、'), srcLine('products'))}
        {kv('客戶身分', c.identities?.join('、'))}
        {kv('模具與射出', c.moldInjection?.join('、'))}
        {kv('產品應用市場', c.markets?.join('、'), srcLine('markets'))}
        {kv('負責業務', userById(s, c.ownerId)?.name)}
        {kv('員工規模', c.employeeScale, srcLine('employeeScale'))}
        {kv('評估系列', c.evaluatingSeries)}
      </Sec>
      <Sec no="03" title="工廠資訊">
        {(c.machines || []).length ? (
          (c.machines || []).map((m) => (
            <Txt key={m.id} size={T.small} style={{ marginTop: 2 }}>
              ● 射出機廠牌:{m.brand || '待補充'} / 噸數:{m.tonnage ? `${m.tonnage} 噸` : '待補充'} / 數量:{m.qty ? `${m.qty} 台` : '待補充'}
            </Txt>
          ))
        ) : (
          <Txt size={T.small} color={C.text3}>
            ● 射出機廠牌:待補充 / 噸數:待補充 / 數量:待補充
          </Txt>
        )}
        {srcLine('machines') ? (
          <Txt size={T.tiny} color={C.teal} style={{ marginTop: 2 }}>
            {srcLine('machines')}
          </Txt>
        ) : null}
        {c.mainEquipment && !(c.machines || []).length ? (
          <Txt size={T.small} color={C.text2} style={{ marginTop: 2 }}>
            舊資料:{c.mainEquipment}
          </Txt>
        ) : null}
      </Sec>
      <Sec no="04" title="產線自動化程度">
        <Row style={{ flexWrap: 'wrap' }} gap={6}>
          {['傳統人工', '半自動化', '全自動化'].map((l) => (
            <Chip key={l} label={c.automation?.level === l ? `● ${l}` : `○ ${l}`} tone={c.automation?.level === l ? 'teal' : 'gray'} />
          ))}
        </Row>
        <Txt size={T.small} color={C.text2} style={{ marginTop: SP.sm }}>
          已自動化製程
        </Txt>
        <Row style={{ flexWrap: 'wrap', marginTop: 4 }} gap={6}>
          {Array.from(new Set([...procs, ...doneProcs])).map((p) => (
            <Chip key={p} label={doneProcs.includes(p) ? `☑ ${p}` : `☐ ${p}`} tone={doneProcs.includes(p) ? 'orange' : 'gray'} />
          ))}
          {c.automation?.other ? <Chip label={`☑ 其他:${c.automation.other}`} tone="orange" /> : null}
        </Row>
        {srcLine('automation') ? (
          <Txt size={T.tiny} color={C.teal} style={{ marginTop: 4 }}>
            {srcLine('automation')}
          </Txt>
        ) : null}
      </Sec>
      {canEdit ? <Button title="編輯公司資料" variant="secondary" icon="edit" onPress={onEdit} /> : null}
      <Txt size={T.tiny + 1} color={C.text3} style={{ marginTop: SP.sm }}>
        拜訪中 AI 抓到的新資料,經業務在確認頁採用後才會寫入,並標示來源。
      </Txt>
    </>
  );
}

function Sec({ no, title, children }: { no: string; title: string; children: React.ReactNode }) {
  return (
    <Card style={{ marginBottom: SP.md }}>
      <Row style={{ justifyContent: 'space-between', marginBottom: SP.sm }}>
        <Txt weight="700" color={C.teal}>
          {title}
        </Txt>
        <View style={styles.no}>
          <Txt size={T.tiny} weight="700" color={C.teal}>
            {no}
          </Txt>
        </View>
      </Row>
      {children}
    </Card>
  );
}

/** 拜訪紀錄:有效與一般拜訪全部保留 */
function Visits({ c }: { c: Customer }) {
  const s = useAppState();
  const visits = confirmedVisitsOf(s, c.id);
  const eff = visits.filter((v) => visitKindOf(v) === 'effective').length;
  if (!visits.length) return <EmptyState text="尚無已入庫的拜訪紀錄。未確認的內容不會出現在這裡。" />;
  return (
    <>
      <Txt size={T.small} color={C.text2} style={{ marginBottom: SP.sm }}>
        共 {visits.length} 次:有效拜訪 {eff} 次、一般拜訪 {visits.length - eff} 次
      </Txt>
      {visits.map((v) => {
        const kind = visitKindOf(v);
        const cats = categoriesOf(v);
        const line = kind === 'general' ? (v.ai?.generalNotes || []).join('、') || '一般接洽' : cats.c2?.[0]?.text || cats.c1?.[0]?.text || '';
        return (
          <Pressable key={v.id} onPress={() => router.push(`/visit/${v.id}`)} style={({ pressed }) => [styles.visit, pressed && { opacity: 0.8 }]}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt weight="700">
                {fmtDate(v.visitAt)}・{v.visitType}
              </Txt>
              <Chip label={kind === 'effective' ? '有效拜訪' : '一般拜訪'} tone={kind === 'effective' ? 'teal' : 'yellow'} />
            </Row>
            <Txt size={T.small} color={C.text2}>
              {userById(s, v.salesId)?.name}
              {purposeOf(v, s) ? `|目的:${purposeOf(v, s)}` : ''}
            </Txt>
            {line ? (
              <Txt size={T.small} style={{ marginTop: 2 }} numberOfLines={2}>
                {line}
              </Txt>
            ) : null}
          </Pressable>
        );
      })}
    </>
  );
}

function Prefs({ c, canDelete }: { c: Customer; canDelete: boolean }) {
  const s = useAppState();
  const prefs = s.preferences.filter((p) => p.customerId === c.id);
  if (!prefs.length) return <EmptyState text="尚無偏好與避免事項" />;
  return (
    <>
      {prefs.map((p) => (
        <Card key={p.id} tone={p.type === 'avoid' ? 'danger' : 'default'} style={{ marginBottom: SP.sm }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row gap={6}>
              <Chip label={p.type === 'avoid' ? '避免事項' : '偏好'} tone={p.type === 'avoid' ? 'red' : 'teal'} />
              <Chip label={p.sensitivity === 'restricted' ? '限定' : '一般'} tone="gray" />
            </Row>
            {canDelete ? (
              <IconButton
                name="trash"
                size={18}
                color={C.text3}
                label="刪除"
                onPress={async () => {
                  if (await confirmDialog({ title: '刪除這筆資料?', message: p.content, ok: '刪除', danger: true })) deletePreference(p.id);
                }}
              />
            ) : null}
          </Row>
          <Txt weight="600" style={{ marginTop: 6 }}>
            {p.content}
          </Txt>
          <Txt size={T.tiny + 1} color={C.text3}>
            對象:{p.target === 'contact' ? '聯絡人' : '客戶'}({p.targetName})・{fmtDate(p.createdAt)}
            {p.sourceVisitId ? '・來源:拜訪紀錄' : ''}
          </Txt>
        </Card>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  block: { borderWidth: 1, borderColor: C.line, borderRadius: R.lg, padding: SP.md, marginBottom: SP.sm, backgroundColor: 'rgba(9,33,43,0.92)' },
  blockOrange: { borderColor: 'rgba(255,122,0,0.7)', backgroundColor: 'rgba(58,34,12,0.6)' },
  blockRed: { borderColor: 'rgba(255,90,90,0.5)' },
  kv: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.lineSoft },
  no: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: C.tealLine, alignItems: 'center', justifyContent: 'center' },
  visit: { borderWidth: 1, borderColor: C.line, borderRadius: R.md, padding: SP.md, marginBottom: SP.sm, backgroundColor: 'rgba(9,33,43,0.92)' },
});
