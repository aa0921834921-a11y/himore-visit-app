import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { PageTitle, Panel } from '../../../components/admin';
import { Button, Checkbox, Chip, Field, IconButton, ListRow, Notice, Row, Segmented, Txt } from '../../../components/ui';
import { Sheet } from '../../../components/Sheet';
import { C, R, SP, T } from '../../../theme';
import { showToast, useAppState } from '../../../store/store';
import { customerById, salesUsers, visitById } from '../../../store/selectors';
import { createFollowupPlan } from '../../../store/actions';
import { suggestFollowups } from '../../../services/report';
import { addDays, uid, ymd } from '../../../lib/util';

interface Item {
  key: string;
  questionId?: string;
  text: string;
  required: boolean;
  keep: boolean;
  why: string;
}

// B6 設計第二次訪談:依初訪結果帶出建議題目,主管可勾選、改寫、加題,存成客戶專屬題組並排入複訪
export default function FollowupDesign() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useAppState();
  const v = visitById(s, id);
  const c = customerById(s, v?.customerId);
  const [items, setItems] = useState<Item[]>(() => (v ? suggestFollowups(s, v).map((x) => ({ ...x, key: uid('fi'), keep: true })) : []));
  const [name, setName] = useState(`${(c?.name || '客戶').replace(/(股份)?有限公司$/, '')}・第二次訪談`);
  const [note, setNote] = useState('');
  const [newQ, setNewQ] = useState('');
  const [fromBank, setFromBank] = useState(false);
  const [doSchedule, setDoSchedule] = useState<'yes' | 'no'>('yes');
  const [date, setDate] = useState(ymd(addDays(new Date(), 7)));
  const [time, setTime] = useState('10:00');
  const [salesId, setSalesId] = useState(v?.salesId || '');
  if (!v || !c) return <Notice tone="gray" text="找不到這筆拜訪紀錄或尚未指定客戶。" />;

  const kept = items.filter((x) => x.keep && x.text.trim());
  const upd = (key: string, patch: Partial<Item>) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const move = (i: number, d: number) =>
    setItems((xs) => {
      const j = i + d;
      if (j < 0 || j >= xs.length) return xs;
      const n = [...xs];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  const save = () => {
    const okDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{1,2}:\d{2}$/.test(time);
    const r = createFollowupPlan({
      visitId: v.id,
      name: name.trim() || '第二次訪談',
      note: note.trim() || undefined,
      items: kept.map((x) => ({ questionId: x.questionId, text: x.text, required: x.required })),
      schedule: doSchedule === 'yes' && okDate && salesId ? { date, time, salesId } : undefined,
    });
    showToast(r.scheduleId ? '已建立專屬題組並排入複訪' : '已建立客戶專屬題組', 'success');
    router.replace(`/admin/review/${v.id}`);
  };

  return (
    <View>
      <PageTitle title="設計第二次訪談問題" right={<Button title="返回" small full={false} variant="ghost" onPress={() => router.back()} />} />
      <Panel>
        <Txt size={T.h3} weight="700">
          {c.name}
        </Txt>
        <Txt size={T.small} color={C.text2} style={{ marginTop: 4 }}>
          依 {v.code}({v.visitType})的結果帶出建議題目。勾選要問的、可直接改寫文字、調整順序與必答,也可以從題庫加題或新增自訂題目。存檔後成為這個客戶的專屬題組,不會影響共用模板。
        </Txt>
      </Panel>

      <Panel title={`題目(已選 ${kept.length} 題,必答 ${kept.filter((x) => x.required).length} 題)`}>
        {items.map((x, i) => (
          <View key={x.key} style={[styles.item, !x.keep && { opacity: 0.45 }]}>
            <Row style={{ alignItems: 'flex-start' }}>
              <Checkbox checked={x.keep} onPress={() => upd(x.key, { keep: !x.keep })} />
              <View style={{ flex: 1 }}>
                <Row style={{ flexWrap: 'wrap', marginBottom: 4 }}>
                  <Chip label={x.why} tone={x.why.includes('未蒐集') ? 'red' : x.questionId ? 'yellow' : 'teal'} />
                  {x.questionId ? <Chip label="沿用題庫" tone="gray" /> : <Chip label="新題目" tone="orange" />}
                </Row>
                {x.questionId ? (
                  <Txt weight="600">{x.text}</Txt>
                ) : (
                  <Field value={x.text} onChangeText={(t) => upd(x.key, { text: t })} style={{ marginBottom: 0 }} />
                )}
              </View>
            </Row>
            <Row style={{ justifyContent: 'flex-end', marginTop: SP.xs }}>
              <Segmented
                value={x.required ? 'r' : 'o'}
                onChange={(val) => upd(x.key, { required: val === 'r' })}
                options={[
                  { value: 'r', label: '必答' },
                  { value: 'o', label: '選答' },
                ]}
                style={{ width: 140 }}
              />
              <Pressable onPress={() => move(i, -1)} style={styles.arrow}>
                <Txt color={C.text2}>▲</Txt>
              </Pressable>
              <Pressable onPress={() => move(i, 1)} style={styles.arrow}>
                <Txt color={C.text2}>▼</Txt>
              </Pressable>
              <IconButton name="trash" size={18} color={C.text3} label="刪除" onPress={() => setItems((xs) => xs.filter((y) => y.key !== x.key))} />
            </Row>
          </View>
        ))}
        <Row style={{ alignItems: 'flex-end', marginTop: SP.md }}>
          <View style={{ flex: 1 }}>
            <Field label="新增自訂題目" value={newQ} onChangeText={setNewQ} placeholder="例:試機一週的評估標準是什麼?" style={{ marginBottom: 0 }} />
          </View>
          <Button
            title="加入"
            small
            full={false}
            disabled={!newQ.trim()}
            onPress={() => {
              setItems((xs) => [...xs, { key: uid('fi'), text: newQ.trim(), required: false, keep: true, why: '主管新增' }]);
              setNewQ('');
            }}
          />
        </Row>
        <Button title="+從題庫加入" small variant="secondary" style={{ marginTop: SP.md }} onPress={() => setFromBank(true)} />
      </Panel>

      <Panel title="題組設定">
        <Field label="題組名稱" value={name} onChangeText={setName} />
        <Field label="給業務的訪談重點(選填)" value={note} onChangeText={setNote} multiline placeholder="例:先回覆上次報價,再確認試機條件與決策時程" />
        <Txt size={T.small} weight="600" color={C.text2} style={{ marginBottom: 6 }}>
          同時排入複訪行程
        </Txt>
        <Segmented
          value={doSchedule}
          onChange={setDoSchedule}
          options={[
            { value: 'yes', label: '排入行程' },
            { value: 'no', label: '只建立題組' },
          ]}
          style={{ maxWidth: 320, marginBottom: SP.md }}
        />
        {doSchedule === 'yes' ? (
          <>
            <Row style={{ flexWrap: 'wrap' }} gap={SP.md}>
              <Field label="日期" value={date} onChangeText={setDate} style={{ minWidth: 150 }} />
              <Field label="時間" value={time} onChangeText={setTime} style={{ minWidth: 110 }} />
            </Row>
            <Txt size={T.small} weight="600" color={C.text2} style={{ marginBottom: 6 }}>
              業務
            </Txt>
            <Row style={{ flexWrap: 'wrap', marginBottom: SP.md }}>
              {salesUsers(s).map((u) => (
                <Chip key={u.id} label={u.name} tone={salesId === u.id ? 'orange' : 'gray'} onPress={() => setSalesId(u.id)} style={{ height: 30, paddingHorizontal: 12 }} />
              ))}
            </Row>
          </>
        ) : null}
        <Button title={`儲存題組(${kept.length} 題)`} disabled={!kept.length} onPress={save} />
      </Panel>

      <Sheet visible={fromBank} onClose={() => setFromBank(false)} title="從題庫加入">
        {s.questions
          .filter((q) => q.active && !items.some((x) => x.questionId === q.id))
          .map((q) => (
            <ListRow
              key={q.id}
              title={`${q.code} ${q.text}`}
              sub={q.category}
              onPress={() => setItems((xs) => [...xs, { key: uid('fi'), questionId: q.id, text: q.text, required: false, keep: true, why: '題庫加入' }])}
              right={<Chip label="加入" tone="teal" />}
            />
          ))}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  item: { borderWidth: 1, borderColor: C.line, borderRadius: R.md, padding: SP.md, marginBottom: SP.sm, backgroundColor: 'rgba(9,33,43,0.6)' },
  arrow: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
});
