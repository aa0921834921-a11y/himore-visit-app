import React, { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Header, Screen } from '../../../components/Screen';
import { Button, Card, Checkbox, Chip, EmptyState, FactChip, IconButton, KeyValue, ListRow, Notice, Row, Segmented, Txt } from '../../../components/ui';
import { confirmDialog } from '../../../components/Dialog';
import { ContactRow, ContactSheet } from '../../../components/ContactSheet';
import { C, SP, T } from '../../../theme';
import { useAppState } from '../../../store/store';
import { avoidItems, confirmedVisitsOf, currentUser, customerById, customerVisitType, industriesOf, lastConfirmedVisit, openTodosOfCustomer, purposeOf, userById } from '../../../store/selectors';
import { deletePreference, toggleTodo } from '../../../store/actions';
import { fmtDate, fmtShortDate, truncate } from '../../../lib/util';

import type { Contact } from '../../../types';

type Tab = 'overview' | 'visits' | 'contacts' | 'prefs';

// S14 客戶檔案(T-S14-01~T-S14-09):避免事項紅色置頂;只顯示已確認入庫的資料
export default function CustomerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useAppState();
  const me = currentUser(s);
  const [tab, setTab] = useState<Tab>('overview');
  const [contactEdit, setContactEdit] = useState<Contact | 'new' | null>(null);
  const c = customerById(s, id);
  if (!c) return null;
  if (me?.role === 'sales' && c.ownerId !== me.id) {
    return (
      <Screen header={<Header title="客戶檔案" />}>
        <Notice tone="red" text="只能查看自己負責的客戶。" />
      </Screen>
    );
  }
  const avoid = avoidItems(s, c.id);
  const prefs = s.preferences.filter((p) => p.customerId === c.id);
  const visits = confirmedVisitsOf(s, c.id);
  const last = lastConfirmedVisit(s, c.id);
  const todos = openTodosOfCustomer(s, c.id);
  const facts = last?.ai?.facts.filter((f) => f.kind === 'quantity' || f.kind === 'date' || f.kind === 'model' || f.kind === 'tonnage') || [];
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
              客戶編號 {c.code}
              {c.taxId ? `・統編 ${c.taxId}` : ''}
            </Txt>
            {c.category ? (
              <Row style={{ marginTop: 4 }}>
                <Chip label={c.category} tone="teal" />
              </Row>
            ) : null}
          </View>
          <Chip label={type} tone={type === '初次' ? 'teal' : 'orange'} />
        </Row>
      </View>

      {avoid.length ? (
        <Card tone="danger" style={{ marginBottom: SP.md }}>
          <Txt size={T.small} weight="700" color="#FF6B66" style={{ marginBottom: 4 }}>
            避免事項
          </Txt>
          <Txt>{avoid.map((p) => p.content).join(';')}。</Txt>
        </Card>
      ) : null}

      <Segmented
        value={tab}
        onChange={setTab}
        style={{ marginBottom: SP.md }}
        options={[
          { value: 'overview', label: '總覽' },
          { value: 'visits', label: '拜訪紀錄' },
          { value: 'contacts', label: '聯絡人' },
          { value: 'prefs', label: '偏好與避免' },
        ]}
      />

      {tab === 'overview' ? (
        <>
          <Card style={{ marginBottom: SP.md }}>
            <KeyValue k="產業別" v={industriesOf(c).join('、') || undefined} />
            <KeyValue k="地址" v={c.address} />
            <KeyValue k="網站" v={c.website} />
            <KeyValue k="主要設備" v={c.mainEquipment} />
            <KeyValue k="評估系列" v={c.evaluatingSeries} />
            <KeyValue k="主要產品" v={c.mainProducts} />
            <KeyValue k="負責業務" v={userById(s, c.ownerId)?.name} />
            <KeyValue k="最近拜訪" v={last ? fmtDate(last.visitAt) : '尚未拜訪'} />
            {facts.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: SP.sm }}>
                {facts.slice(0, 5).map((f) => (
                  <FactChip key={f.id} label={f.text} />
                ))}
              </View>
            ) : null}
          </Card>
          <Card style={{ marginBottom: SP.md, paddingVertical: SP.md }}>
            <Txt size={T.small} weight="700" color={C.teal} style={{ marginBottom: 4 }}>
              待辦事項
            </Txt>
            {todos.length ? (
              todos.map((t) => <Checkbox key={t.id} checked={t.done} onPress={() => toggleTodo(t.id)} label={t.content} sub={t.due ? `期限 ${fmtShortDate(t.due)}・${userById(s, t.ownerId)?.name || ''}` : userById(s, t.ownerId)?.name} />)
            ) : (
              <Txt color={C.text3}>沒有未完成的待辦</Txt>
            )}
          </Card>
          <Row gap={SP.md}>
            <View style={{ flex: 1 }}>
              <Button title="查看拜訪簡報" variant="secondary" onPress={() => router.push({ pathname: '/customer/[id]/briefing', params: { id: c.id } })} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="開始記錄" onPress={() => router.push({ pathname: '/record/start', params: { customerId: c.id } })} />
            </View>
          </Row>
        </>
      ) : null}

      {tab === 'visits' ? (
        visits.length ? (
          visits.map((v) => (
            <ListRow
              key={v.id}
              title={`${fmtDate(v.visitAt)}・${userById(s, v.salesId)?.name || ''}・${v.visitType}`}
              sub={truncate(`${purposeOf(v, s) ? `目的:${purposeOf(v, s)}|` : ''}需求:${v.ai?.summary.needs.text || '—'}`, 70)}
              onPress={() => router.push(`/visit/${v.id}`)}
            />
          ))
        ) : (
          <EmptyState text="尚無已入庫的拜訪紀錄。未確認的內容不會出現在這裡。" />
        )
      ) : null}

      {tab === 'contacts' ? (
        <>
          {c.contacts.length ? (
            c.contacts.map((ct) => (
              <ContactRow
                key={ct.id}
                ct={ct}
                extra={prefs.filter((p) => p.target === 'contact' && p.targetName === ct.name).map((p) => `${p.type === 'avoid' ? '避免' : '偏好'}:${p.content}`)}
                onPress={() => setContactEdit(ct)}
              />
            ))
          ) : (
            <EmptyState text="尚無聯絡人" />
          )}
          <Button title="+新增聯絡人" variant="secondary" small onPress={() => setContactEdit('new')} />
          <ContactSheet customerId={c.id} visible={!!contactEdit} contact={contactEdit === 'new' ? null : contactEdit} onClose={() => setContactEdit(null)} />
        </>
      ) : null}

      {tab === 'prefs' ? (
        prefs.length ? (
          prefs.map((p) => (
            <Card key={p.id} tone={p.type === 'avoid' ? 'danger' : 'default'} style={{ marginBottom: SP.sm }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Row gap={6}>
                  <Chip label={p.type === 'avoid' ? '避免事項' : '偏好'} tone={p.type === 'avoid' ? 'red' : 'teal'} />
                  <Chip label={p.sensitivity === 'restricted' ? '限定' : '一般'} tone="gray" />
                </Row>
                {me?.id === c.ownerId ? (
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
              </Txt>
            </Card>
          ))
        ) : (
          <EmptyState text="尚無偏好與避免事項" />
        )
      ) : null}
    </Screen>
  );
}
