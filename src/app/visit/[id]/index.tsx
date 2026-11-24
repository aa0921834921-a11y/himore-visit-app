import React, { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Header, Screen } from '../../../components/Screen';
import { Button, Card, Chip, FactChip, KeyValue, Notice, Row, SectionTitle, Segmented, Txt } from '../../../components/ui';
import { SegmentList } from '../../../components/SourceSheet';
import { AttachmentList } from '../../../components/Attachments';
import { OutOfScope } from '../../../components/Report';
import { buildVisitReport } from '../../../services/report';
import { C, SP, T } from '../../../theme';
import { showToast, useAppState } from '../../../store/store';
import { currentUser, customerById, isHandled, questionById, setById, userById, visitById } from '../../../store/selectors';
import { audit } from '../../../store/actions';
import { answerStatusLabel, copyText, VISIT_STATUS_LABEL, visitToText } from '../../../services/export';
import { fmtDateTime, fmtShortDate } from '../../../lib/util';

const SRC = { recording: '現場錄音', dictation: '業務口述', text: '文字輸入' } as const;
const SUMMARY = [
  ['keyPoints', '拜訪摘要'],
  ['needs', '客戶需求'],
  ['competitors', '競品'],
  ['objections', '異議'],
  ['nextSteps', '下一步'],
] as const;

// 拜訪詳情:已確認摘要、題庫回覆、逐字稿與錄音回放(放在 S14 拜訪紀錄下)
export default function VisitDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useAppState();
  const me = currentUser(s);
  const v = visitById(s, id);
  const [tab, setTab] = useState<'summary' | 'bank' | 'raw'>('summary');
  if (!v) return null;
  const c = customerById(s, v.customerId);
  const a = v.ai;
  const todos = s.todos.filter((t) => t.visitId === v.id);

  return (
    <Screen bg="base" header={<Header title="拜訪紀錄" sub={v.code} />}>
      <Card style={{ marginTop: SP.md }}>
        <Txt size={T.h3} weight="700">
          {c?.name || '未指定客戶'}
        </Txt>
        <KeyValue k="拜訪時間" v={fmtDateTime(v.visitAt)} />
        <KeyValue k="業務" v={userById(s, v.salesId)?.name} />
        <KeyValue k="題組" v={setById(s, v.questionSetId)?.name} />
        <KeyValue k="確認時間" v={v.confirmedAt ? fmtDateTime(v.confirmedAt) : undefined} />
        <Row style={{ marginTop: SP.sm }}>
          <Chip label={SRC[v.source]} tone="orange" />
          <Chip label={VISIT_STATUS_LABEL[v.status]} tone={v.status === 'confirmed' ? 'teal' : 'yellow'} />
          <Chip label={v.visitType} tone="gray" />
        </Row>
      </Card>

      {v.review?.comment || v.review?.nextSetId ? (
        <Card tone="accent" style={{ marginTop: SP.md }}>
          <Txt size={T.small} weight="700" color={C.teal}>
            主管審閱({userById(s, v.review.by)?.name || '管理者'}・{fmtShortDate(v.review.at)})
          </Txt>
          {v.review.comment ? <Txt style={{ marginTop: 4 }}>{v.review.comment}</Txt> : null}
          {v.review.nextSetId ? (
            <Txt size={T.small} color={C.text2} style={{ marginTop: 4 }}>
              下次訪談題組:{setById(s, v.review.nextSetId)?.name}
            </Txt>
          ) : null}
        </Card>
      ) : null}

      {v.status === 'pending_confirm' && me?.id === v.salesId ? (
        <Button title="前往確認" style={{ marginTop: SP.md }} onPress={() => router.push(`/visit/${v.id}/confirm`)} />
      ) : null}

      <Segmented
        value={tab}
        onChange={setTab}
        style={{ marginTop: SP.lg, marginBottom: SP.md }}
        options={[
          { value: 'summary', label: '摘要' },
          { value: 'bank', label: '題庫回覆' },
          { value: 'raw', label: '逐字稿' },
        ]}
      />

      {tab === 'summary' && a ? (
        <>
          {a.facts.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: SP.sm }}>
              {a.facts.map((f) => (
                <FactChip key={f.id} label={f.text} />
              ))}
            </View>
          ) : null}
          {SUMMARY.map(([k, title]) => (
            <Card key={k} style={{ marginBottom: SP.sm }}>
              <Txt size={T.small} weight="700" color={C.teal}>
                {title}
              </Txt>
              <Txt color={a.summary[k].text === '未知' ? C.text3 : C.text}>{a.summary[k].text}</Txt>
            </Card>
          ))}
          <SectionTitle title="題庫之外的內容" />
          <Card style={{ marginBottom: SP.sm }}>
            <OutOfScope r={buildVisitReport(s, v)} compact />
          </Card>
          {v.raw.supplements?.length || v.raw.attachments?.length ? (
            <>
              <SectionTitle title="附件與補充" />
              {(v.raw.supplements || []).map((x) => (
                <Txt key={x.id} size={T.small} color={C.text2} style={{ marginBottom: 4 }}>
                  ・{x.kind === 'text' ? '補充文字' : '補充口述'}:{x.text || '(錄音)'}
                </Txt>
              ))}
              {v.raw.attachments?.length ? <AttachmentList items={v.raw.attachments} /> : null}
            </>
          ) : null}
          {todos.length ? (
            <>
              <SectionTitle title="待辦" />
              {todos.map((t) => (
                <Txt key={t.id} style={{ marginBottom: 4 }} color={t.done ? C.text3 : C.text}>
                  ・{t.content}
                  {t.due ? `(${fmtShortDate(t.due)})` : ''}
                  {t.done ? '(已完成)' : ''}
                </Txt>
              ))}
            </>
          ) : null}
        </>
      ) : null}

      {tab === 'bank' && a ? (
        a.answers.length ? (
          a.answers.map((x) => {
            const q = questionById(s, x.questionId);
            return (
              <Card key={x.questionId} style={{ marginBottom: SP.sm }}>
                <Row style={{ justifyContent: 'space-between', marginBottom: 4 }}>
                  <Txt size={T.small} weight="700" color={C.text2}>
                    {q?.code}・{x.required ? '必答' : '選答'}
                  </Txt>
                  <Chip label={answerStatusLabel(x.status)} tone={isHandled(x) ? 'teal' : 'gray'} />
                </Row>
                <Txt weight="600">{q?.text}</Txt>
                <Txt size={T.small} color={C.text2} style={{ marginTop: 4 }}>
                  {x.answer || x.reason || '—'}
                </Txt>
              </Card>
            );
          })
        ) : (
          <Notice tone="gray" icon="bank" text="這次拜訪沒有使用題組。" />
        )
      ) : null}

      {tab === 'raw' ? (
        <>
          {v.raw.consent ? (
            <Notice tone="teal" icon="check" text={`錄音同意:${fmtDateTime(v.raw.consent.at)},操作人 ${userById(s, v.raw.consent.byUserId)?.name || '—'},聲明 ${v.raw.consent.version}`} />
          ) : null}
          <SegmentList visit={v} />
        </>
      ) : null}

      <Button
        title="複製文字"
        icon="paste"
        variant="secondary"
        style={{ marginTop: SP.lg }}
        onPress={async () => {
          await copyText(visitToText(s, v));
          audit('export', `複製文字 ${v.code}`, { visitId: v.id, customerId: v.customerId });
          showToast('已複製到剪貼簿', 'success');
        }}
      />
    </Screen>
  );
}
