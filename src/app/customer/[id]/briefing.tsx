import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Header, Screen } from '../../../components/Screen';
import { Button, Card, Chip, FactChip, Icon, KeyValue, Notice, Row, Txt } from '../../../components/ui';
import { C, SP, T } from '../../../theme';
import { useAppState } from '../../../store/store';
import { avoidItems, customerById, knownAndPending, lastConfirmedVisit, openTodosOfCustomer, questionById, scheduleById, setById, suggestedSetId, userById } from '../../../store/selectors';
import { audit } from '../../../store/actions';
import { fmtDate } from '../../../lib/util';

// S16 拜訪前簡報(A:初次 T-S16A-*;B:複訪 T-S16B-*):只引用已確認入庫的資料;「開始記錄」預帶客戶與題組
export default function Briefing() {
  const { id, scheduleId } = useLocalSearchParams<{ id: string; scheduleId?: string }>();
  const s = useAppState();
  const c = customerById(s, id);
  const sch = scheduleById(s, scheduleId);
  const [showKnown, setShowKnown] = useState(false);

  useEffect(() => {
    if (c) audit('briefing_view', `查看拜訪簡報 ${c.name}`, { customerId: c.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c?.id]);

  if (!c) return null;
  const last = lastConfirmedVisit(s, c.id);
  const first = !last;
  const set = setById(s, sch?.questionSetId) || setById(s, suggestedSetId(s, c.id, first ? '初次' : '複訪')) || setById(s, last?.questionSetId) || s.questionSets[0];
  const avoid = avoidItems(s, c.id);
  const todos = openTodosOfCustomer(s, c.id);
  const kp = knownAndPending(s, c.id, set?.id);
  const facts = last?.ai?.facts.filter((f) => f.kind !== 'commitment') || [];

  const start = () =>
    router.push({
      pathname: '/record/start',
      params: sch ? { scheduleId: sch.id } : { customerId: c.id, questionSetId: set?.id },
    });

  return (
    <Screen bg="base" header={<Header title="拜訪前簡報" />} footer={<Button title="開始記錄" icon="dictate" onPress={start} />}>
      <Row style={{ marginTop: SP.lg, marginBottom: SP.md, justifyContent: 'space-between' }}>
        <Chip label={first ? '初次拜訪' : '複訪'} tone={first ? 'teal' : 'orange'} />
        {sch ? (
          <Txt size={T.small} color={C.text2}>
            今日 {sch.time}
            {sch.note ? `・${sch.note}` : ''}
          </Txt>
        ) : null}
      </Row>

      <Card style={{ marginBottom: SP.md }}>
        <Txt size={T.h2} weight="700">
          {c.name}
        </Txt>
        {first ? (
          <>
            <KeyValue k="產業" v={c.industry} />
            <KeyValue k="主要產品" v={c.mainProducts || '待了解'} />
            <KeyValue k="負責業務" v={userById(s, c.ownerId)?.name} />
          </>
        ) : (
          <Txt size={T.small} color={C.text2}>
            上次拜訪:{fmtDate(last?.visitAt)}
          </Txt>
        )}
      </Card>

      {last?.review?.comment || set?.note ? (
        <Card tone="accent" style={{ marginBottom: SP.md }}>
          <Txt size={T.small} weight="700" color={C.teal} style={{ marginBottom: 4 }}>
            主管提醒
          </Txt>
          {set?.note ? <Txt>{set.note}</Txt> : null}
          {last?.review?.comment ? (
            <Txt size={T.small} color={C.text2} style={{ marginTop: 4 }}>
              上次審閱意見:{last.review.comment}
            </Txt>
          ) : null}
          {set ? (
            <Txt size={T.tiny + 1} color={C.text3} style={{ marginTop: 4 }}>
              本次題組:{set.scope === 'customer' ? '專屬・' : ''}
              {set.name}
            </Txt>
          ) : null}
        </Card>
      ) : null}

      {avoid.length ? (
        <Card tone="danger" style={{ marginBottom: SP.md }}>
          <Txt size={T.small} weight="700" color="#FF6B66" style={{ marginBottom: 4 }}>
            避免事項
          </Txt>
          <Txt>{avoid.map((p) => p.content).join(';')}。</Txt>
        </Card>
      ) : null}

      {first ? (
        <>
          <Card tone="accent" style={{ marginBottom: SP.md }}>
            <Txt weight="700" style={{ marginBottom: SP.sm }}>
              本次題組:{set?.name || '未指定'}
            </Txt>
            {set?.items.map((it) => {
              const q = questionById(s, it.questionId);
              return (
                <Row key={it.questionId} style={{ paddingVertical: 6, alignItems: 'flex-start' }}>
                  <Txt size={T.small} style={{ flex: 1 }}>
                    {q?.code} {q?.text}
                  </Txt>
                  {it.required ? <Chip label="必答" tone="orange" /> : null}
                </Row>
              );
            })}
          </Card>
          <Notice tone="yellow" icon="warn" text="首次拜訪,尚無歷史紀錄;請先確認窗口與決策流程。" />
        </>
      ) : (
        <>
          <Card style={{ marginBottom: SP.md }}>
            <Txt size={T.small} weight="700" color={C.teal} style={{ marginBottom: 4 }}>
              上次拜訪概要
            </Txt>
            <Txt>{last?.ai?.summary.keyPoints.text || '未知'}</Txt>
            {facts.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: SP.sm }}>
                {facts.slice(0, 5).map((f) => (
                  <FactChip key={f.id} label={f.text} />
                ))}
              </View>
            ) : null}
          </Card>
          <Card style={{ marginBottom: SP.md }}>
            <Txt size={T.small} weight="700" color={C.teal} style={{ marginBottom: 4 }}>
              未完成承諾
            </Txt>
            {todos.length ? <Txt>{todos.map((t) => t.content).join(';')}。</Txt> : <Txt color={C.text3}>沒有未完成的承諾</Txt>}
          </Card>
          <Card tone="accent" style={{ marginBottom: SP.md }}>
            <Pressable onPress={() => setShowKnown(!showKnown)} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Txt size={T.small} weight="700" color={C.teal} style={{ marginBottom: 4 }}>
                  已知與待問({set?.name})
                </Txt>
                <Txt>
                  已知 {kp.known.length} 題;待問:
                  {kp.pending.length
                    ? kp.pending
                        .map((p) => {
                          const q = questionById(s, p.questionId);
                          return `${q?.code} ${q?.text.replace(/[??]$/, '')}`;
                        })
                        .join('、')
                    : '無'}
                </Txt>
              </View>
              <Icon name="down" size={18} color={C.text2} style={{ transform: [{ rotate: showKnown ? '180deg' : '0deg' }] }} />
            </Pressable>
            {showKnown
              ? kp.known.map((k) => {
                  const q = questionById(s, k.questionId);
                  return (
                    <View key={k.questionId} style={{ marginTop: SP.sm }}>
                      <Txt size={T.small} color={C.text2}>
                        {q?.code} {q?.text}
                      </Txt>
                      <Txt size={T.small}>{kp.answered.get(k.questionId)}</Txt>
                    </View>
                  );
                })
              : null}
          </Card>
        </>
      )}
      <Txt size={T.tiny + 1} color={C.text3} center>
        僅引用已確認入庫的紀錄
      </Txt>
    </Screen>
  );
}
