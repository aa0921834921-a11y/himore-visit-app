import React, { useState } from 'react';
import { View } from 'react-native';
import { AdminTable, PageTitle, Panel, StatCard, useWide } from '../../components/admin';
import { Button, Chip, Field, Notice, Row, Segmented, Toggle, Txt } from '../../components/ui';
import { Sheet } from '../../components/Sheet';
import { alertDialog } from '../../components/Dialog';
import { C, SP, T } from '../../theme';
import { useAppState } from '../../store/store';
import { coverage, perQuestion, perSales, prefStats, visitsInDays } from '../../store/metrics';
import { upsertUser } from '../../store/actions';
import { fmtDate, fmtHours, pct } from '../../lib/util';
import type { Role, User } from '../../types';

// B5 使用狀況與帳號(T-B5-04~T-B5-16):回答覆蓋率與流程已處理率分開;每位業務的拜訪數、確認率、平均確認時間
export default function AdminUsage() {
  const s = useAppState();
  const wide = useWide();
  const [days, setDays] = useState<'30' | '7' | '90'>('30');
  const [edit, setEdit] = useState<User | 'new' | null>(null);
  const [f, setF] = useState({ name: '', account: '', team: '', role: 'sales' as Role, password: '1234' });

  const vs = visitsInDays(s, Number(days));
  const cov = coverage(vs);
  const rows = perSales(s, vs);
  const qrows = perQuestion(s, vs);
  const ps = prefStats(s, vs);
  const total = rows.reduce((a, r) => a + r.count, 0);
  const totalConfirmed = rows.reduce((a, r) => a + r.confirmed, 0);
  const sales = s.users.filter((u) => u.role === 'sales');
  const admins = s.users.filter((u) => u.role === 'admin');
  const activeCount = s.users.filter((u) => u.active).length;

  const openUser = (u: User | 'new') => {
    setEdit(u);
    setF(u === 'new' ? { name: '', account: '', team: '', role: 'sales', password: '1234' } : { name: u.name, account: u.account, team: u.team, role: u.role, password: u.password });
  };

  const saveUser = () => {
    if (edit === 'new' && activeCount >= s.settings.trialAccountCap) {
      alertDialog('已達試用帳號上限', `目前上限為 ${s.settings.trialAccountCap} 人,可在系統設定調整。`);
      return;
    }
    if (s.users.some((u) => u.account === f.account.trim() && (edit === 'new' || u.id !== edit?.id))) {
      alertDialog('帳號重複', '這個帳號已被使用。');
      return;
    }
    upsertUser({ ...(edit && edit !== 'new' ? edit : {}), name: f.name, account: f.account, team: f.team, role: f.role, password: f.password });
    setEdit(null);
  };

  return (
    <View>
      <PageTitle
        title="使用狀況與帳號"
        right={
          <Segmented
            value={days}
            onChange={setDays}
            options={[
              { value: '7', label: '近 7 天' },
              { value: '30', label: '近 30 天' },
              { value: '90', label: '近 90 天' },
            ]}
            style={{ width: 300 }}
          />
        }
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.md, marginBottom: SP.lg }}>
        <StatCard label="回答覆蓋率" value={pct(cov.answered, cov.total)} sub="必答題中客戶有回覆的比例" />
        <StatCard label="流程已處理率" value={pct(cov.handled, cov.total)} sub="含標記「客戶未提供/不適用」" tone="orange" />
        <StatCard label="偏好與避免事項接受率" value={pct(ps.accepted, ps.suggested)} sub={`AI 建議 ${ps.suggested} 項`} tone="yellow" />
        <StatCard label="拜訪前簡報瀏覽" value={`${ps.briefingViews} 次`} sub="判斷是否真的有看" />
      </View>

      <View style={{ flexDirection: wide ? 'row' : 'column', gap: SP.lg, alignItems: 'flex-start' }}>
        <Panel title="分業務" style={wide ? { flex: 1 } : { alignSelf: 'stretch' }}>
          <AdminTable
            rows={[...rows, { user: { id: '_sum', name: `合計(${rows.length} 位業務)` } as User, count: total, confirmed: totalConfirmed, avgMs: 0, edits: 0 }]}
            keyOf={(r) => r.user.id}
            minWidth={520}
            cols={[
              { key: 'n', title: '業務', render: (r) => r.user.name },
              { key: 'c', title: '拜訪數', width: 80, render: (r) => `${r.count}` },
              { key: 'r', title: '確認率', width: 90, render: (r) => pct(r.confirmed, r.count) },
              { key: 'a', title: '平均確認時間', width: 120, render: (r) => (r.user.id === '_sum' ? '—' : r.confirmed ? fmtHours(r.avgMs) : '—') },
              { key: 'e', title: '確認頁修改', width: 100, render: (r) => (r.user.id === '_sum' ? '—' : `${r.edits} 次`) },
            ]}
          />
          <Txt size={T.tiny + 1} color={C.text3} style={{ marginTop: SP.sm }}>
            統計期間:近 {days} 天。平均確認時間為建立紀錄到確認入庫的時間。
          </Txt>
        </Panel>
        <Panel title="分題目" style={wide ? { flex: 1 } : { alignSelf: 'stretch' }}>
          <AdminTable
            rows={qrows}
            keyOf={(r) => r.q.id}
            minWidth={520}
            empty="期間內沒有已入庫的拜訪"
            cols={[
              { key: 'q', title: '題目', render: (r) => `${r.q.code} ${r.q.text}` },
              { key: 'n', title: '出現', width: 60, render: (r) => `${r.asked}` },
              { key: 'a', title: '回答覆蓋', width: 90, render: (r) => pct(r.answered, r.asked) },
              { key: 'h', title: '已處理', width: 80, render: (r) => pct(r.handled, r.asked) },
            ]}
          />
        </Panel>
      </View>

      <Panel title="帳號" right={<Button title="管理帳號:新增" small full={false} onPress={() => openUser('new')} />}>
        <Txt size={T.small} color={C.text2} style={{ marginBottom: SP.xs }}>
          帳號角色:業務:填寫、查詢個人紀錄;管理者:題庫、安排、匯出、帳號
        </Txt>
        <Txt size={T.small} color={C.text} style={{ marginBottom: SP.md }}>
          業務 {sales.length} 人+管理者 {admins.length} 人=共 {s.users.length} 人(試用上限 {s.settings.trialAccountCap} 人)
        </Txt>
        <AdminTable
          rows={s.users}
          keyOf={(r) => r.id}
          onRowPress={openUser}
          minWidth={560}
          cols={[
            { key: 'n', title: '姓名', render: (r) => r.name },
            { key: 'a', title: '帳號', width: 100, render: (r) => r.account },
            { key: 't', title: '組別', width: 110, render: (r) => r.team || '—' },
            { key: 'r', title: '角色', width: 90, render: (r) => <Chip label={r.role === 'admin' ? '管理者' : '業務'} tone={r.role === 'admin' ? 'orange' : 'teal'} /> },
            { key: 's', title: '啟用', width: 80, render: (r) => <Toggle value={r.active} onChange={(v) => upsertUser({ ...r, active: v })} disabled={r.id === s.sessionUserId} /> },
            { key: 'd', title: '建立日', width: 110, render: (r) => fmtDate(r.createdAt) },
          ]}
        />
      </Panel>

      <Sheet visible={!!edit} onClose={() => setEdit(null)} title={edit === 'new' ? '新增帳號' : '編輯帳號'} footer={<Button title="儲存" disabled={!f.name.trim() || !f.account.trim() || f.password.length < 4} onPress={saveUser} />}>
        <Field label="姓名" value={f.name} onChangeText={(t) => setF({ ...f, name: t })} />
        <Field label="帳號" value={f.account} onChangeText={(t) => setF({ ...f, account: t })} autoCapitalize="none" />
        <Field label="組別" value={f.team} onChangeText={(t) => setF({ ...f, team: t })} placeholder="例:業務一組" />
        <Field label="密碼" value={f.password} onChangeText={(t) => setF({ ...f, password: t })} hint="POC 預設 1234,請業務登入後自行變更" />
        <Txt size={T.small} color={C.text2} weight="600" style={{ marginBottom: 6 }}>
          角色
        </Txt>
        <Segmented
          value={f.role}
          onChange={(v) => setF({ ...f, role: v })}
          options={[
            { value: 'sales', label: '業務' },
            { value: 'admin', label: '管理者' },
          ]}
        />
        <Row style={{ marginTop: SP.md }}>
          <Notice tone="gray" text="POC 不做細部權限:業務只看自己的客戶與紀錄;管理者可維護題庫、安排、匯出與帳號。" />
        </Row>
      </Sheet>
    </View>
  );
}
