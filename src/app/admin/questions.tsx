import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { PageTitle, Panel, useWide } from '../../components/admin';
import { Button, Chip, Field, IconButton, ListRow, Row, Segmented, Toggle, Txt } from '../../components/ui';
import { Sheet } from '../../components/Sheet';
import { confirmDialog, promptDialog } from '../../components/Dialog';
import { C, R, SP, T } from '../../theme';
import { useAppState } from '../../store/store';
import { customerById, questionById } from '../../store/selectors';
import { setDefaultFirstVisit, upsertQuestion, upsertQuestionSet } from '../../store/actions';
import type { Question } from '../../types';

// B2 題庫與題組(T-B2-04~T-B2-16):新增、編輯、停用題目;設定必答或選答;題目分類最多一層
export default function AdminQuestions() {
  const s = useAppState();
  const wide = useWide();
  const [cat, setCat] = useState('全部分類');
  const [editQ, setEditQ] = useState<Question | 'new' | null>(null);
  const [qText, setQText] = useState('');
  const [qCat, setQCat] = useState('');
  const [setId, setSetId] = useState(s.questionSets[0]?.id);
  const [adding, setAdding] = useState(false);

  const cats = useMemo(() => ['全部分類', ...Array.from(new Set(s.questions.map((q) => q.category)))], [s.questions]);
  const qs = s.questions.filter((q) => cat === '全部分類' || q.category === cat);
  const set = s.questionSets.find((x) => x.id === setId);

  const openQ = (q: Question | 'new') => {
    setEditQ(q);
    setQText(q === 'new' ? '' : q.text);
    setQCat(q === 'new' ? (cat === '全部分類' ? '' : cat) : q.category);
  };

  const bank = (
    <Panel title="題庫" right={<Button title="+新增題目" small full={false} onPress={() => openQ('new')} />} style={wide ? { flex: 1 } : undefined}>
      <Row style={{ flexWrap: 'wrap', marginBottom: SP.md }}>
        {cats.map((c) => (
          <Chip key={c} label={c} tone={cat === c ? 'orange' : 'gray'} onPress={() => setCat(c)} style={{ height: 30, paddingHorizontal: 12 }} />
        ))}
      </Row>
      {qs.map((q) => (
        <View key={q.id} style={[styles.qRow, !q.active && { opacity: 0.5 }]}>
          <Pressable style={{ flex: 1 }} onPress={() => openQ(q)}>
            <Txt weight="600">
              {q.code} {q.text}
            </Txt>
            <Txt size={T.small} color={C.text2}>
              分類:{q.category}
              {q.active ? '' : '・已停用'}
            </Txt>
          </Pressable>
          <Toggle value={q.active} onChange={(v) => upsertQuestion({ ...q, active: v })} />
        </View>
      ))}
    </Panel>
  );

  const sets = (
    <Panel
      title="題組"
      right={
        <Button
          title="+新增共用模板"
          small
          full={false}
          variant="secondary"
          onPress={async () => {
            const name = await promptDialog({ title: '新增題組', placeholder: '例:射出成型設備追蹤' });
            if (name?.trim()) upsertQuestionSet({ name: name.trim(), items: [], scope: 'template' });
          }}
        />
      }
      style={wide ? { flex: 1 } : undefined}
    >
      <Txt size={T.small} weight="700" color={C.text2} style={{ marginBottom: 6 }}>
        共用模板(可套用到任何客戶)
      </Txt>
      <Row style={{ flexWrap: 'wrap', marginBottom: SP.md }}>
        {s.questionSets
          .filter((x) => (x.scope || 'template') === 'template')
          .map((x) => (
            <Chip key={x.id} label={`${x.defaultFirstVisit ? '★ ' : ''}${x.name}`} tone={x.id === setId ? 'orange' : 'gray'} onPress={() => setSetId(x.id)} style={{ height: 30, paddingHorizontal: 12 }} />
          ))}
      </Row>
      <Txt size={T.small} weight="700" color={C.text2} style={{ marginBottom: 6 }}>
        客戶專屬(主管依前次拜訪設計)
      </Txt>
      <Row style={{ flexWrap: 'wrap', marginBottom: SP.md }}>
        {s.questionSets.filter((x) => x.scope === 'customer').length === 0 ? (
          <Txt size={T.small} color={C.text3}>
            尚無。到「拜訪紀錄與匯出」打開一筆拜訪,按「設計第二次訪談問題」建立。
          </Txt>
        ) : (
          s.questionSets
            .filter((x) => x.scope === 'customer')
            .map((x) => (
              <Chip key={x.id} label={x.name} tone={x.id === setId ? 'orange' : 'teal'} onPress={() => setSetId(x.id)} style={{ height: 30, paddingHorizontal: 12 }} />
            ))
        )}
      </Row>
      {set ? (
        <>
          <Row style={{ justifyContent: 'space-between', marginBottom: SP.sm }}>
            <View>
              <Txt size={T.h3} weight="700">
                題組:{set.name}
              </Txt>
              <Txt size={T.small} color={C.text2}>
                共 {set.items.length} 題|必答 {set.items.filter((i) => i.required).length} 題
              </Txt>
            </View>
            <Row>
              <Txt size={T.small} color={C.text2}>
                啟用
              </Txt>
              <Toggle value={set.active} onChange={(v) => upsertQuestionSet({ ...set, active: v })} />
            </Row>
          </Row>
          <Row style={{ flexWrap: 'wrap', marginBottom: SP.sm }}>
            {set.scope === 'customer' ? (
              <Chip label={`客戶專屬:${customerById(s, set.customerId)?.name || '—'}`} tone="teal" icon="customer" />
            ) : set.defaultFirstVisit ? (
              <Chip label="★ 初次拜訪預設模板" tone="orange" />
            ) : (
              <Chip label="設為初次拜訪預設模板" tone="gray" icon="star" onPress={() => setDefaultFirstVisit(set.id)} />
            )}
            <Chip
              label={set.note ? `訪談重點:${set.note}` : '+訪談重點'}
              tone="gray"
              icon="edit"
              onPress={async () => {
                const t = await promptDialog({ title: '給業務的訪談重點', initial: set.note, multiline: true, placeholder: '例:第一次拜訪先了解設備現況,不急著報價' });
                if (t !== null) upsertQuestionSet({ ...set, note: t.trim() || undefined });
              }}
            />
          </Row>
          {set.items.map((it, i) => {
            const q = questionById(s, it.questionId);
            return (
              <View key={it.questionId} style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <Txt size={T.small} weight="600">
                    {q?.code} {q?.text}({it.required ? '必答' : '選答'})
                  </Txt>
                </View>
                <Segmented
                  value={it.required ? 'r' : 'o'}
                  onChange={(v) => upsertQuestionSet({ ...set, items: set.items.map((x, j) => (j === i ? { ...x, required: v === 'r' } : x)) })}
                  options={[
                    { value: 'r', label: '必答' },
                    { value: 'o', label: '選答' },
                  ]}
                  style={{ width: 140 }}
                />
                <IconButton
                  name="trash"
                  size={18}
                  color={C.text3}
                  label="移除"
                  onPress={async () => {
                    if (await confirmDialog({ title: '從題組移除這題?', message: q?.text, ok: '移除', danger: true })) upsertQuestionSet({ ...set, items: set.items.filter((_, j) => j !== i) });
                  }}
                />
              </View>
            );
          })}
          <Button title="+加入題目" small variant="secondary" onPress={() => setAdding(true)} style={{ marginTop: SP.md }} />
          <Txt size={T.tiny + 1} color={C.text3} style={{ marginTop: SP.sm }}>
            建議 8 至 10 題,必答 5 題以內;必答題應是需要客戶回覆的問題。
          </Txt>
        </>
      ) : null}
    </Panel>
  );

  return (
    <View>
      <PageTitle title="題庫與題組" />
      {wide ? (
        <Row style={{ alignItems: 'flex-start' }} gap={SP.lg}>
          {bank}
          {sets}
        </Row>
      ) : (
        <>
          {bank}
          {sets}
        </>
      )}

      <Sheet
        visible={!!editQ}
        onClose={() => setEditQ(null)}
        title={editQ === 'new' ? '新增題目' : `編輯 ${editQ ? (editQ as Question).code : ''}`}
        footer={
          <Button
            title="儲存"
            disabled={!qText.trim()}
            onPress={() => {
              upsertQuestion(editQ === 'new' ? { text: qText.trim(), category: qCat.trim() || '其他' } : { ...(editQ as Question), text: qText.trim(), category: qCat.trim() || '其他' });
              setEditQ(null);
            }}
          />
        }
      >
        <Field label="題目" value={qText} onChangeText={setQText} placeholder="例:目前使用的射出機噸數與台數?" multiline />
        <Field label="分類(一層)" value={qCat} onChangeText={setQCat} placeholder="例:設備現況" />
        <Row style={{ flexWrap: 'wrap' }}>
          {cats.filter((c) => c !== '全部分類').map((c) => (
            <Chip key={c} label={c} tone={qCat === c ? 'orange' : 'gray'} onPress={() => setQCat(c)} />
          ))}
        </Row>
      </Sheet>

      <Sheet visible={adding} onClose={() => setAdding(false)} title="加入題目">
        {set
          ? s.questions
              .filter((q) => q.active && !set.items.some((i) => i.questionId === q.id))
              .map((q) => (
                <ListRow
                  key={q.id}
                  title={`${q.code} ${q.text}`}
                  sub={q.category}
                  onPress={() => {
                    upsertQuestionSet({ ...set, items: [...set.items, { questionId: q.id, required: false }] });
                  }}
                  right={<Chip label="加入" tone="teal" />}
                />
              ))
          : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  qRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SP.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.lineSoft, gap: SP.md },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: SP.sm, paddingVertical: SP.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.lineSoft, borderRadius: R.sm },
});
