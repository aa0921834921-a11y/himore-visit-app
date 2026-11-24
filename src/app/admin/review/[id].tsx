import React, { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { PageTitle, Panel, useWide } from '../../../components/admin';
import { Button, Chip, Field, KeyValue, Notice, Row, Txt } from '../../../components/ui';
import { CoverageList, OutOfScope } from '../../../components/Report';
import { AttachmentList } from '../../../components/Attachments';
import { C, SP, T } from '../../../theme';
import { showToast, useAppState } from '../../../store/store';
import { customerById, setById, userById, visitById } from '../../../store/selectors';
import { audit, enqueueOutbox, reviewVisit } from '../../../store/actions';
import { buildVisitReport, reportToText } from '../../../services/report';
import { copyText, saveTextFile, VISIT_STATUS_LABEL } from '../../../services/export';
import { fmtDateTime } from '../../../lib/util';

// B5 主管審閱:看拜訪報告(問題蒐集狀況、題外內容分類)→ 寫審閱意見 → 匯出/串接 → 設計下次訪談
export default function AdminReview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useAppState();
  const wide = useWide();
  const v = visitById(s, id);
  const [comment, setComment] = useState(v?.review?.comment || '');
  if (!v) return <Notice tone="gray" text="找不到這筆拜訪紀錄。" />;
  const c = customerById(s, v.customerId);
  const r = buildVisitReport(s, v);
  const nextSet = setById(s, v.review?.nextSetId);
  const integ = s.settings.integration;
  const fname = `拜訪報告_${c?.name || v.code}_${v.code}`;

  const left = (
    <View style={wide ? { flex: 1.2 } : undefined}>
      <Panel title="一、問題蒐集狀況">
        <CoverageList r={r} />
      </Panel>
      <Panel title="二、重點摘要">
        {Object.entries(r.summary).map(([k, val]) => (
          <View key={k} style={{ marginBottom: SP.sm }}>
            <Txt size={T.small} weight="700" color={C.teal}>
              {k}
            </Txt>
            <Txt color={val === '未知' ? C.text3 : C.text}>{val}</Txt>
          </View>
        ))}
        {!Object.keys(r.summary).length ? <Txt color={C.text3}>尚未整理完成。</Txt> : null}
      </Panel>
    </View>
  );

  const right = (
    <View style={wide ? { flex: 1 } : undefined}>
      <Panel title="三、題庫之外的內容">
        <OutOfScope r={r} />
      </Panel>
      {v.raw.attachments?.length || v.raw.supplements?.length ? (
        <Panel title="四、附件與補充">
          {(v.raw.supplements || []).map((x) => (
            <Txt key={x.id} size={T.small} color={C.text2} style={{ marginBottom: 4 }}>
              ・{x.kind === 'text' ? '補充文字' : '補充口述'}:{x.text || '(錄音)'}
            </Txt>
          ))}
          {v.raw.attachments?.length ? <AttachmentList items={v.raw.attachments} /> : null}
        </Panel>
      ) : null}
      <Panel title="五、主管審閱">
        {v.status !== 'confirmed' ? <Notice tone="yellow" text="業務尚未確認入庫,目前是 AI 草稿,內容可能還會修改。" /> : null}
        <Field label="審閱意見(業務端會看到)" multiline value={comment} onChangeText={setComment} placeholder="例:預算與決策流程要再釐清;下次請帶 GT 系列實績案例" />
        <Button
          title={v.review?.comment ? '更新審閱意見' : '完成審閱'}
          small
          disabled={!comment.trim()}
          onPress={() => {
            reviewVisit(v.id, comment.trim());
            showToast('已儲存審閱意見', 'success');
          }}
        />
        {v.review?.at ? (
          <Txt size={T.tiny + 1} color={C.text3} style={{ marginTop: SP.xs }}>
            上次審閱:{userById(s, v.review.by)?.name}・{fmtDateTime(v.review.at)}
          </Txt>
        ) : null}
        <View style={{ height: SP.lg }} />
        <Txt weight="700">下一次訪談</Txt>
        {nextSet ? (
          <>
            <Txt size={T.small} color={C.text2} style={{ marginTop: 4 }}>
              已設計題組「{nextSet.name}」,共 {nextSet.items.length} 題
            </Txt>
            <Button title="查看/調整題組" small variant="secondary" style={{ marginTop: SP.sm }} onPress={() => router.push('/admin/questions')} />
          </>
        ) : (
          <>
            <Txt size={T.small} color={C.text2} style={{ marginTop: 4, marginBottom: SP.sm }}>
              初訪的共用題目不一定適合複訪。系統會依未蒐集題目、需求、異議與待辦先帶出建議題目,你可以自由增刪。
            </Txt>
            <Button title="設計第二次訪談問題" small icon="bank" disabled={!v.customerId || !v.ai} onPress={() => router.push(`/admin/followup/${v.id}`)} />
          </>
        )}
      </Panel>
    </View>
  );

  return (
    <View>
      <PageTitle
        title="拜訪報告與審閱"
        right={
          <Row style={{ flexWrap: 'wrap' }}>
            <Button title="返回" small full={false} variant="ghost" onPress={() => (router.canGoBack() ? router.back() : router.replace('/admin/visits'))} />
            <Button
              title="複製文字"
              small
              full={false}
              variant="secondary"
              onPress={async () => {
                await copyText(reportToText(r));
                showToast('已複製報告', 'success');
              }}
            />
            <Button
              title="匯出 .txt"
              small
              full={false}
              variant="secondary"
              icon="download"
              onPress={async () => {
                await saveTextFile(`${fname}.txt`, reportToText(r), 'text/plain');
                audit('export', `匯出報告 ${v.code}(txt)`, { visitId: v.id });
              }}
            />
            <Button
              title="匯出 JSON"
              small
              full={false}
              variant="secondary"
              icon="download"
              onPress={async () => {
                await saveTextFile(`${fname}.json`, JSON.stringify(r, null, 2), 'application/json');
                audit('export', `匯出報告 ${v.code}(json)`, { visitId: v.id });
              }}
            />
            <Button
              title={`拋送到 ${integ?.name || '串接平台'}`}
              small
              full={false}
              icon="sync"
              onPress={() => {
                enqueueOutbox(v.id, 'visit.manual');
                showToast(integ?.enabled ? '已排入串接佇列' : '串接尚未啟用,已先保留在佇列', 'success');
              }}
            />
          </Row>
        }
      />
      <Panel>
        <Txt size={T.h3} weight="700">
          {c?.name || '未指定客戶'}
        </Txt>
        <Row style={{ flexWrap: 'wrap', marginVertical: SP.sm }}>
          <Chip label={v.visitType} tone="orange" />
          <Chip label={VISIT_STATUS_LABEL[v.status]} tone={v.status === 'confirmed' ? 'teal' : 'yellow'} />
          {r.questionSet ? <Chip label={`${r.questionSet.scope === 'customer' ? '專屬' : '模板'}:${r.questionSet.name}`} tone="gray" icon="bank" /> : null}
        </Row>
        <KeyValue k="拜訪編號" v={v.code} />
        <KeyValue k="拜訪時間" v={fmtDateTime(v.visitAt)} />
        <KeyValue k="業務" v={userById(s, v.salesId)?.name} />
      </Panel>
      {wide ? (
        <Row style={{ alignItems: 'flex-start' }} gap={SP.lg}>
          {left}
          {right}
        </Row>
      ) : (
        <>
          {left}
          {right}
        </>
      )}
    </View>
  );
}
