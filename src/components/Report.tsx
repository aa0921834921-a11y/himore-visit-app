import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { IconName } from '../assets';
import { Card, Chip, Icon, Row, Txt } from './ui';
import { C, R, SP, T } from '../theme';
import { INSIGHT_LABEL, type VisitReport } from '../services/report';
import { fmtShortDate } from '../lib/util';

// 拜訪報告顯示:問題蒐集狀況(未蒐集標紅)+題庫之外內容分類彙整。業務詳情與主管審閱共用。

const CAT: { key: keyof VisitReport['outOfScope']; label: string; icon: IconName; color: string }[] = [
  { key: 'todos', label: INSIGHT_LABEL.todo, icon: 'check', color: C.teal },
  { key: 'reminders', label: INSIGHT_LABEL.reminder, icon: 'bell', color: C.yellow },
  { key: 'avoid', label: INSIGHT_LABEL.avoid, icon: 'warn', color: '#FF6B66' },
  { key: 'opportunities', label: INSIGHT_LABEL.opportunity, icon: 'star', color: '#FF9A40' },
  { key: 'others', label: INSIGHT_LABEL.other, icon: 'more', color: C.text2 },
];

export function CoverageList({ r }: { r: VisitReport }) {
  if (!r.questions.length) return <Txt color={C.text3}>這次拜訪沒有使用題組。</Txt>;
  return (
    <View>
      <Row style={{ marginBottom: SP.sm, flexWrap: 'wrap' }}>
        <Chip label={`已蒐集 ${r.coverage.collected}/${r.coverage.total}`} tone="teal" />
        {r.coverage.missing ? <Chip label={`未蒐集 ${r.coverage.missing}`} tone="red" /> : null}
        {r.coverage.missingRequired ? <Chip label={`必答缺 ${r.coverage.missingRequired}`} tone="red" /> : null}
      </Row>
      {r.questions.map((q, i) => {
        const miss = q.status === 'uncovered';
        return (
          <View key={`${q.code}_${i}`} style={[styles.q, miss && styles.qRed]}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt size={T.small} weight="700" color={miss ? '#FF6B66' : C.text2}>
                {q.code}・{q.required ? '必答' : '選答'}
              </Txt>
              <Chip label={q.statusLabel} tone={miss ? 'red' : q.status === 'answered' ? 'teal' : 'yellow'} />
            </Row>
            <Txt weight="600" style={{ marginTop: 2 }}>
              {q.text}
            </Txt>
            <Txt size={T.small} color={miss ? '#FF9C99' : C.text2} style={{ marginTop: 2 }}>
              {q.answer || (miss ? '內容中沒有提到,需要補充' : q.reason ? `${q.statusLabel}:${q.reason}` : q.statusLabel)}
            </Txt>
          </View>
        );
      })}
    </View>
  );
}

export function OutOfScope({ r, compact }: { r: VisitReport; compact?: boolean }) {
  const o = r.outOfScope;
  const total = o.todos.length + o.reminders.length + o.avoid.length + o.opportunities.length + o.others.length;
  return (
    <View>
      {!compact ? (
        <Txt size={T.small} color={C.text2} style={{ marginBottom: SP.sm }}>
          AI 從內容中找出題庫以外談到的事項,分類彙整({total} 項)
        </Txt>
      ) : null}
      {CAT.map((c) => {
        const items: string[] = c.key === 'todos' ? o.todos.map((t) => `${t.content}${t.due ? `(${fmtShortDate(t.due)})` : ''}`) : (o[c.key] as string[]);
        if (compact && !items.length) return null;
        return (
          <View key={c.key} style={styles.cat}>
            <Row>
              <Icon name={c.icon} size={16} color={c.color} />
              <Txt size={T.small} weight="700" color={c.color}>
                {c.label}({items.length})
              </Txt>
            </Row>
            {items.length ? (
              items.map((x, i) => (
                <Txt key={i} size={T.small} style={{ marginTop: 4, marginLeft: 24 }}>
                  ・{x}
                </Txt>
              ))
            ) : (
              <Txt size={T.small} color={C.text3} style={{ marginTop: 4, marginLeft: 24 }}>
                無
              </Txt>
            )}
          </View>
        );
      })}
    </View>
  );
}

export function ReportSection({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <Card style={{ marginBottom: SP.md }}>
      <Row style={{ justifyContent: 'space-between', marginBottom: SP.sm }}>
        <Txt weight="700" color={C.teal}>
          {title}
        </Txt>
        {right}
      </Row>
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  q: { borderWidth: 1, borderColor: C.line, borderRadius: R.md, padding: SP.md, marginBottom: SP.sm },
  qRed: { borderColor: C.red, backgroundColor: 'rgba(58,18,24,0.55)' },
  cat: { paddingVertical: SP.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.lineSoft },
});
