import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { AdminTable, PageTitle, Panel, StatCard } from '../../components/admin';
import { Chip, Notice, Txt } from '../../components/ui';
import { C, SP, T } from '../../theme';
import { useAppState } from '../../store/store';
import { customerById, setById, userById, visitsToReview } from '../../store/selectors';
import { coverage, visitsInDays } from '../../store/metrics';
import { VISIT_STATUS_LABEL } from '../../services/export';
import { fmtDateTime, pct, ymd } from '../../lib/util';

// 後台首頁總覽
export default function AdminHome() {
  const s = useAppState();
  const today = ymd();
  const month = today.slice(0, 7);
  const monthSchedules = s.schedules.filter((x) => x.date.startsWith(month));
  const monthVisits = s.visits.filter((v) => v.status !== 'draft' && ymd(new Date(v.visitAt)).startsWith(month));
  const pending = s.visits.filter((v) => v.status === 'pending_confirm');
  const failed = s.visits.filter((v) => v.status === 'failed');
  const cov = coverage(visitsInDays(s, 30));
  const sales = s.users.filter((u) => u.role === 'sales' && u.active).length;
  const admins = s.users.filter((u) => u.role === 'admin' && u.active).length;
  const todays = s.schedules.filter((x) => x.date === today).sort((a, b) => a.time.localeCompare(b.time));
  const toReview = visitsToReview(s);
  const recent = [...s.visits].filter((v) => v.status !== 'draft').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6);

  return (
    <View>
      <PageTitle title="首頁總覽" />
      {!s.settings.aiTermsConfirmed ? <Notice tone="yellow" text="尚未確認 AI 服務的資料使用條款。目前使用模擬 AI,正式導入前請在「系統設定」確認。" /> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.md, marginBottom: SP.lg }}>
        <StatCard label="客戶" value={`${s.customers.length} 筆`} />
        <StatCard label="本月安排拜訪" value={`${monthSchedules.length} 筆`} tone="orange" />
        <StatCard label="本月拜訪紀錄" value={`${monthVisits.length} 筆`} />
        <StatCard label="待業務確認" value={`${pending.length} 筆`} tone="yellow" sub={failed.length ? `處理失敗 ${failed.length} 筆` : undefined} />
        <StatCard label="回答覆蓋率(近 30 天)" value={pct(cov.answered, cov.total)} sub={`流程已處理率 ${pct(cov.handled, cov.total)}`} />
        <StatCard label="帳號" value={`${sales + admins} 人`} sub={`業務 ${sales}+管理者 ${admins}`} tone="orange" />
      </View>

      <Panel title={`待主管審閱(${toReview.length})`}>
        <Txt size={T.small} color={C.text2} style={{ marginBottom: SP.sm }}>
          業務確認入庫後,在這裡看報告、寫審閱意見,並依結果設計下一次訪談的題目。
        </Txt>
        <AdminTable
          rows={toReview.slice(0, 6)}
          keyOf={(r) => r.id}
          onRowPress={(r) => router.push(`/admin/review/${r.id}`)}
          empty="目前沒有待審閱的拜訪"
          cols={[
            { key: 'code', title: '拜訪編號', width: 130, render: (r) => r.code },
            { key: 'c', title: '客戶', render: (r) => customerById(s, r.customerId)?.name || '未指定' },
            { key: 'u', title: '業務', width: 90, render: (r) => userById(s, r.salesId)?.name || '—' },
            { key: 't', title: '類型', width: 70, render: (r) => r.visitType },
            {
              key: 'm',
              title: '未蒐集',
              width: 80,
              render: (r) => {
                const n = (r.ai?.answers || []).filter((x) => x.status === 'uncovered').length;
                return <Txt size={T.small} weight="700" color={n ? '#FF6B66' : C.teal}>{n ? `${n} 題` : '齊全'}</Txt>;
              },
            },
          ]}
        />
      </Panel>

      <Panel title={`今日行程(${todays.length})`}>
        <AdminTable
          rows={todays}
          keyOf={(r) => r.id}
          onRowPress={() => router.push('/admin/schedule')}
          empty="今天沒有安排拜訪"
          cols={[
            { key: 't', title: '時間', width: 80, render: (r) => r.time },
            { key: 'u', title: '業務', width: 100, render: (r) => userById(s, r.salesId)?.name || '—' },
            { key: 'c', title: '客戶', render: (r) => customerById(s, r.customerId)?.name || '—' },
            { key: 'q', title: '題組', render: (r) => setById(s, r.questionSetId)?.name || '—' },
            { key: 'st', title: '狀態', width: 110, render: (r) => (r.visitId ? <Chip label={VISIT_STATUS_LABEL[s.visits.find((v) => v.id === r.visitId)?.status || 'draft']} tone="teal" /> : <Txt size={T.small} color={C.text3}>尚未記錄</Txt>) },
          ]}
        />
      </Panel>

      <Panel title="最近更新的拜訪紀錄">
        <AdminTable
          rows={recent}
          keyOf={(r) => r.id}
          onRowPress={(r) => router.push(`/admin/review/${r.id}`)}
          cols={[
            { key: 'code', title: '拜訪編號', width: 130, render: (r) => r.code },
            { key: 'c', title: '客戶', render: (r) => customerById(s, r.customerId)?.name || '未指定' },
            { key: 'u', title: '業務', width: 90, render: (r) => userById(s, r.salesId)?.name || '—' },
            { key: 'at', title: '更新時間', width: 150, render: (r) => fmtDateTime(r.updatedAt) },
            { key: 'st', title: '狀態', width: 100, render: (r) => <Chip label={VISIT_STATUS_LABEL[r.status]} tone={r.status === 'confirmed' ? 'teal' : r.status === 'failed' ? 'red' : 'yellow'} /> },
          ]}
        />
      </Panel>
      <Txt size={T.tiny + 1} color={C.text3}>
        POC 版資料只存在目前這台裝置;業務在手機上的紀錄,需在同一台裝置登入管理者帳號才看得到。正式版接上伺服器後即可共用。
      </Txt>
    </View>
  );
}
