import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Field, IconButton, Row, Segmented, Txt } from './ui';
import { Sheet } from './Sheet';
import { C, R, SP, T } from '../theme';
import { CATEGORIES, FIELD_LABEL, GENERAL_NOTES, INFO_STATUS_LABEL, TARGET_LABEL } from '../store/options';
import { categoriesOf, visitKindOf } from '../store/selectors';
import { isAcceptedUpdate } from '../store/actions';
import { uid } from '../lib/util';
import type { AnalysisResult, CategoryItem, CategoryKey, InfoStatus, ProfileUpdate, UpdateTarget, Visit } from '../types';

// 確認頁「摘要」用的三個區塊:有效/一般拜訪、七大資訊分類、客戶資料更新建議。拜訪詳情與主管審閱以唯讀方式共用。

type Update = (fn: (a: AnalysisResult) => AnalysisResult) => void;
type OpenSource = (ids: string[], title: string) => void;

const STATUS_TONE: Record<InfoStatus, 'teal' | 'yellow' | 'gray'> = { explicit: 'teal', possible: 'yellow', pending: 'gray' };

/** 有效拜訪/一般拜訪 */
export function VisitKindCard({ v, editable, update }: { v: Visit; editable: boolean; update?: Update }) {
  const kind = visitKindOf(v);
  const notes = v.ai?.generalNotes || [];
  return (
    <Card style={{ marginBottom: SP.md }} tone={kind === 'general' ? 'warn' : 'default'}>
      <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <View style={{ flex: 1, minWidth: 160 }}>
          <Txt size={T.small} weight="700" color={C.teal}>
            拜訪類別
          </Txt>
          <Txt size={T.tiny + 1} color={C.text3}>
            有具體資訊就是有效拜訪;只有未遇窗口等接洽情況為一般拜訪。與是否成交無關。
          </Txt>
        </View>
        {editable && update ? (
          <Segmented
            value={kind}
            onChange={(k) => update((a) => ({ ...a, visitKind: k, generalNotes: k === 'general' ? a.generalNotes?.length ? a.generalNotes : ['其他接洽情況'] : [] }))}
            options={[
              { value: 'effective', label: '有效拜訪' },
              { value: 'general', label: '一般拜訪' },
            ]}
            style={{ width: 200 }}
          />
        ) : (
          <Chip label={kind === 'effective' ? '有效拜訪' : '一般拜訪'} tone={kind === 'effective' ? 'teal' : 'yellow'} />
        )}
      </Row>
      {kind === 'general' ? (
        <Row style={{ flexWrap: 'wrap', marginTop: SP.sm }}>
          {(editable ? GENERAL_NOTES : notes).map((n) => {
            const on = notes.includes(n);
            return (
              <Chip
                key={n}
                label={on ? `✓ ${n}` : n}
                tone={on ? 'orange' : 'gray'}
                onPress={editable && update ? () => update((a) => ({ ...a, generalNotes: on ? notes.filter((x) => x !== n) : [...notes, n] })) : undefined}
              />
            );
          })}
        </Row>
      ) : null}
      {kind === 'general' ? (
        <Txt size={T.tiny + 1} color={C.text3} style={{ marginTop: SP.xs }}>
          一般拜訪也會保留在拜訪履歷,作為日後分析客戶的依據。
        </Txt>
      ) : null}
    </Card>
  );
}

/** 七大資訊分類;每筆可展開看來源、確認狀態、資訊時間、更新位置 */
export function CategoryList({ v, editable, update, onSource, compact }: { v: Visit; editable: boolean; update?: Update; onSource?: OpenSource; compact?: boolean }) {
  const cats = categoriesOf(v);
  const [edit, setEdit] = useState<{ key: CategoryKey; item: CategoryItem; isNew?: boolean } | null>(null);
  const segText = (ids: string[]) => (v.raw.segments || []).filter((sg) => ids.includes(sg.id));
  const save = (key: CategoryKey, item: CategoryItem, remove = false) =>
    update?.((a) => {
      const cur = categoriesOf({ ...v, ai: a });
      const list = cur[key] || [];
      const next = remove ? list.filter((x) => x.id !== item.id) : list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];
      return { ...a, categories: { ...cur, [key]: next } };
    });

  return (
    <View>
      {CATEGORIES.map((cat, idx) => {
        const items = cats[cat.key] || [];
        if (compact && !items.length) return null;
        return (
          <Card key={cat.key} style={{ marginBottom: SP.sm }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row gap={8} style={{ flex: 1 }}>
                <View style={styles.no}>
                  <Txt size={T.tiny + 1} weight="700" color={C.teal}>
                    {String(idx + 1).padStart(2, '0')}
                  </Txt>
                </View>
                <View style={{ flex: 1 }}>
                  <Txt weight="700">{cat.title}</Txt>
                  {!compact ? (
                    <Txt size={T.tiny + 1} color={C.text3} numberOfLines={1}>
                      {cat.aspects}
                    </Txt>
                  ) : null}
                </View>
              </Row>
              {editable ? (
                <IconButton
                  name="edit"
                  size={16}
                  color={C.text2}
                  label="新增"
                  onPress={() => setEdit({ key: cat.key, isNew: true, item: { id: uid('ci'), text: '', status: 'explicit', sourceSegmentIds: [] } })}
                />
              ) : null}
            </Row>
            {items.length ? (
              items.map((it) => (
                <Pressable key={it.id} onPress={() => setEdit({ key: cat.key, item: it })} style={({ pressed }) => [styles.item, pressed && { opacity: 0.8 }]}>
                  <Txt size={T.small}>{it.text}</Txt>
                  <Row style={{ flexWrap: 'wrap', marginTop: 4 }} gap={4}>
                    {it.aspect ? <Chip label={it.aspect} tone="gray" /> : null}
                    <Chip label={INFO_STATUS_LABEL[it.status]} tone={STATUS_TONE[it.status]} />
                    {it.infoTime ? <Chip label={it.infoTime} tone="gray" icon="calendar" /> : null}
                    {it.target ? <Chip label={`→ ${TARGET_LABEL[it.target]}`} tone="orange" /> : null}
                  </Row>
                </Pressable>
              ))
            ) : (
              <Txt size={T.small} color={C.text3} style={{ marginTop: 6 }}>
                未提及
              </Txt>
            )}
          </Card>
        );
      })}
      {!compact ? (
        <Txt size={T.tiny + 1} color={C.text3} style={{ marginBottom: SP.md }}>
          未提及可留空;不確定不推定。點任一筆可查看來源、確認狀態、資訊時間與更新位置。
        </Txt>
      ) : null}

      {edit ? (
        <ItemSheet
          key={edit.item.id}
          title={CATEGORIES.find((x) => x.key === edit.key)?.title || ''}
          item={edit.item}
          isNew={edit.isNew}
          editable={editable}
          quotes={segText(edit.item.sourceSegmentIds)}
          onClose={() => setEdit(null)}
          onSave={(it) => {
            save(edit.key, it);
            setEdit(null);
          }}
          onDelete={() => {
            save(edit.key, edit.item, true);
            setEdit(null);
          }}
          onSource={onSource ? () => onSource(edit.item.sourceSegmentIds, '原文') : undefined}
        />
      ) : null}
    </View>
  );
}

function ItemSheet({
  title,
  item,
  isNew,
  editable,
  quotes,
  onClose,
  onSave,
  onDelete,
  onSource,
}: {
  title: string;
  item: CategoryItem;
  isNew?: boolean;
  editable: boolean;
  quotes: { id: string; text: string; speaker?: string }[];
  onClose: () => void;
  onSave: (it: CategoryItem) => void;
  onDelete: () => void;
  onSource?: () => void;
}) {
  const [f, setF] = useState(item);
  return (
    <Sheet
      visible
      onClose={onClose}
      title={isNew ? `新增:${title}` : title}
      footer={
        editable ? (
          <>
            <Button title="儲存" disabled={!f.text.trim()} onPress={() => onSave({ ...f, text: f.text.trim(), aspect: f.aspect?.trim() || undefined, infoTime: f.infoTime?.trim() || undefined })} />
            {!isNew ? <Button title="刪除這筆" variant="ghost" onPress={onDelete} /> : null}
          </>
        ) : undefined
      }
    >
      <Field label="內容" value={f.text} onChangeText={(t) => setF({ ...f, text: t })} multiline editable={editable} />
      <Txt size={T.small} weight="600" color={C.text2} style={{ marginBottom: 6 }}>
        確認狀態
      </Txt>
      {editable ? (
        <Segmented
          value={f.status}
          onChange={(st) => setF({ ...f, status: st })}
          options={(['explicit', 'possible', 'pending'] as InfoStatus[]).map((st) => ({ value: st, label: INFO_STATUS_LABEL[st] }))}
          style={{ marginBottom: SP.md }}
        />
      ) : (
        <Chip label={INFO_STATUS_LABEL[f.status]} tone={STATUS_TONE[f.status]} style={{ marginBottom: SP.md }} />
      )}
      <Row gap={SP.md}>
        <View style={{ flex: 1 }}>
          <Field label="面向" value={f.aspect || ''} onChangeText={(t) => setF({ ...f, aspect: t })} placeholder="例:數量、預算" editable={editable} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="資訊時間" value={f.infoTime || ''} onChangeText={(t) => setF({ ...f, infoTime: t })} placeholder="例:明年 Q2" editable={editable} />
        </View>
      </Row>
      <Txt size={T.small} weight="600" color={C.text2} style={{ marginBottom: 6 }}>
        更新位置
      </Txt>
      <Row style={{ flexWrap: 'wrap', marginBottom: SP.md }}>
        {(['company', 'factory', 'contact', 'preference'] as UpdateTarget[]).map((t) => (
          <Chip key={t} label={TARGET_LABEL[t]} tone={f.target === t ? 'orange' : 'gray'} onPress={editable ? () => setF({ ...f, target: f.target === t ? undefined : t }) : undefined} />
        ))}
      </Row>
      <Txt size={T.small} weight="600" color={C.text2} style={{ marginBottom: 6 }}>
        來源{item.mentionedBy ? `(提及者:${item.mentionedBy})` : ''}
      </Txt>
      {quotes.length ? (
        quotes.map((q) => (
          <View key={q.id} style={styles.quote}>
            <Txt size={T.small} color={C.text2}>
              {q.speaker ? `${q.speaker}:` : ''}「{q.text}」
            </Txt>
          </View>
        ))
      ) : (
        <Txt size={T.small} color={C.text3}>
          {isNew ? '業務手動新增' : '沒有對應的原文'}
        </Txt>
      )}
      {onSource && quotes.length ? <Button title="開啟原文(可播放錄音)" variant="ghost" small icon="folder" onPress={onSource} /> : null}
    </Sheet>
  );
}

/** 客戶資料更新建議:逐筆採用/修改/不採用,入庫時寫進客戶檔案並記錄來源 */
export function ProfileUpdatesCard({ v, editable, update, onSource }: { v: Visit; editable: boolean; update?: Update; onSource?: OpenSource }) {
  const list = v.ai?.profileUpdates || [];
  const [edit, setEdit] = useState<ProfileUpdate | null>(null);
  const [draft, setDraft] = useState('');
  if (!list.length) return null;
  const set = (id: string, patch: Partial<ProfileUpdate>) => update?.((a) => ({ ...a, profileUpdates: (a.profileUpdates || []).map((u) => (u.id === id ? { ...u, ...patch } : u)) }));
  const done = v.status === 'confirmed';
  return (
    <Card style={{ marginBottom: SP.md }} tone="accent">
      <Txt size={T.small} weight="700" color={C.teal}>
        客戶資料更新建議({list.length})
      </Txt>
      <Txt size={T.tiny + 1} color={C.text3} style={{ marginBottom: SP.sm }}>
        {done ? '已採用的項目已寫入客戶檔案,並記錄來源。' : '採用的項目會在確認入庫時寫進客戶檔案。「明確表示」預設採用,「可能/待確認」預設不採用。'}
      </Txt>
      {list.map((u) => {
        const on = isAcceptedUpdate(u);
        return (
          <View key={u.id} style={[styles.upd, !on && { opacity: 0.6 }]}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Txt size={T.tiny + 1} color={C.text3}>
                  {FIELD_LABEL[u.field]}
                </Txt>
                <Txt weight="600">{u.value}</Txt>
              </View>
              <Chip label={INFO_STATUS_LABEL[u.status]} tone={STATUS_TONE[u.status]} />
            </Row>
            <Row style={{ flexWrap: 'wrap', marginTop: 6 }} gap={6}>
              {editable ? (
                <>
                  <Chip label={on ? '✓ 採用' : '採用'} tone={on ? 'teal' : 'gray'} onPress={() => set(u.id, { decision: 'accepted' })} />
                  <Chip label={!on ? '✓ 不採用' : '不採用'} tone={!on ? 'red' : 'gray'} onPress={() => set(u.id, { decision: 'rejected' })} />
                  {u.field !== 'machine' && u.field !== 'contact' ? (
                    <Chip
                      label="修改"
                      tone="gray"
                      icon="edit"
                      onPress={() => {
                        setEdit(u);
                        setDraft(u.value);
                      }}
                    />
                  ) : null}
                </>
              ) : (
                <Chip label={on ? '已採用' : '未採用'} tone={on ? 'teal' : 'gray'} />
              )}
              {onSource && u.sourceSegmentIds.length ? <Chip label="原文" tone="gray" icon="folder" onPress={() => onSource(u.sourceSegmentIds, `原文:${FIELD_LABEL[u.field]}`)} /> : null}
            </Row>
          </View>
        );
      })}
      <Sheet
        visible={!!edit}
        onClose={() => setEdit(null)}
        title={edit ? `修改:${FIELD_LABEL[edit.field]}` : ''}
        footer={
          <Button
            title="修改後採用"
            disabled={!draft.trim()}
            onPress={() => {
              if (edit) set(edit.id, { value: draft.trim(), decision: 'accepted' });
              setEdit(null);
            }}
          />
        }
      >
        <Field label="內容" value={draft} onChangeText={setDraft} />
      </Sheet>
    </Card>
  );
}

const styles = StyleSheet.create({
  no: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: C.tealLine, alignItems: 'center', justifyContent: 'center' },
  item: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.lineSoft, paddingVertical: SP.sm, marginTop: SP.xs },
  quote: { borderLeftWidth: 2, borderLeftColor: C.tealLine, paddingLeft: SP.sm, marginBottom: SP.xs },
  upd: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.lineSoft, paddingVertical: SP.sm, borderRadius: R.sm },
});
