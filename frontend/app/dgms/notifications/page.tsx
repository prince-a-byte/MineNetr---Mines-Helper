/**
 * Page 9 — Notifications & Alerts. Read/acknowledge/resolve update the same
 * records the bell count and dashboard alerts derive from. Acknowledging
 * never resolves the underlying finding (separate explicit action).
 */
'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import Shell from '../../../components/Shell';
import { actions, useMockDb } from '../../../lib/dgms/mockDb';
import { exportCSV } from '../../../lib/dgms/export';
import { fmtDate, relTime } from '../../../lib/dgms/format';
import { NotificationCategory, NotificationStatus, Priority } from '../../../lib/dgms/types';
import type { Notification } from '../../../lib/dgms/types';
import { DataTable, DemoBadge, DetailDrawer, FilterBar, KpiCard, Kv, SearchInput, SectionCard, Toasts, type Column } from '../../../components/dgms/ui';
import { StatusPill } from '../../../components/dgms/ui';

const TABS = ['All', ...Object.values(NotificationCategory)];

export default function NotificationsPage() {
  const db = useMockDb();
  const router = useRouter();
  const [tab, setTab] = useState<string>('All');
  const [q, setQ] = useState(''); const [qq, setQq] = useState('');
  const [draft, setDraft] = useState({ state: 'All States', mine: 'All Mines', priority: 'All Priorities', status: 'All Statuses' });
  const [applied, setApplied] = useState(draft);
  const [sel, setSel] = useState<Notification | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  const states = useMemo(() => ['All States', ...[...new Set(db.mines.map((m) => m.state))].sort()], [db.mines]);
  const mineName = (id?: string) => {
    if (!id) return 'All Mines';
    const m = db.mines.find((x) => x.id === id);
    return m ? `${m.name} (${m.code})` : id;
  };
  const mineIdOf = (label: string) => db.mines.find((x) => `${x.name} (${x.code})` === label)?.id ?? null;

  const tabCounts = useMemo(() => {
    const c: Record<string, number> = { All: db.notifications.length };
    (Object.values(NotificationCategory) as string[]).forEach((t) => {
      c[t] = db.notifications.filter((n) => n.category === t).length;
    });
    return c;
  }, [db.notifications]);

  const rows = db.notifications.filter((n) => {
    if (tab !== 'All' && n.category !== tab) return false;
    const needle = qq.trim().toLowerCase();
    if (needle && !(n.title.toLowerCase().includes(needle) || n.description.toLowerCase().includes(needle) || mineName(n.mineId).toLowerCase().includes(needle))) return false;
    if (applied.state !== 'All States' && n.state !== applied.state && n.state) return false;
    const mid = mineIdOf(applied.mine); if (mid && n.mineId !== mid) return false;
    if (applied.priority !== 'All Priorities' && n.priority !== applied.priority) return false;
    if (applied.status !== 'All Statuses' && n.status !== applied.status) return false;
    return true;
  }).sort((a, b) => b.datetime.localeCompare(a.datetime));

  const dist = [
    { name: 'Critical', value: db.notifications.filter((n) => n.priority === Priority.Critical).length, color: '#ef4444' },
    { name: 'High', value: db.notifications.filter((n) => n.priority === Priority.High).length, color: '#f97316' },
    { name: 'Medium', value: db.notifications.filter((n) => n.priority === Priority.Medium).length, color: '#f59e0b' },
    { name: 'Low', value: db.notifications.filter((n) => n.priority === Priority.Low).length, color: '#2563eb' },
  ];
  const total = dist.reduce((a, d) => a + d.value, 0) || 1;

  const recentActions = db.audit
    .filter((a) => ['Notifications', 'Findings', 'Inspection', 'Reports'].includes(a.module))
    .slice(0, 4);

  const columns: Column<Notification>[] = [
    { key: 'dt', header: 'Date & Time', render: (n) => <span className="text-[12px]">{fmtDate(n.datetime)}</span>, sortValue: (n) => n.datetime },
    { key: 'type', header: 'Type', render: (n) => <span className="text-[12px] font-semibold">{n.category}</span>, sortValue: (n) => n.category },
    {
      key: 'title', header: 'Title / Description', render: (n) => (
        <div className="max-w-[260px]"><div className="font-bold text-navy truncate">{n.title}</div>
          <div className="text-[11px] text-slate-500 truncate">{n.description}</div></div>
      ), sortValue: (n) => n.title,
    },
    { key: 'mine', header: 'Mine Name', render: (n) => <span className="text-[12px]">{mineName(n.mineId)}</span>, sortValue: (n) => mineName(n.mineId) },
    { key: 'state', header: 'State', render: (n) => n.state ?? '—', sortValue: (n) => n.state ?? '' },
    { key: 'pri', header: 'Priority', render: (n) => <StatusPill v={n.priority} />, sortValue: (n) => n.priority },
    { key: 'status', header: 'Status', render: (n) => <StatusPill v={n.status} />, sortValue: (n) => n.status },
    {
      key: 'actions', header: 'Actions', render: (n) => (
        <div className="flex gap-1">
          <button className="text-blue-700 border border-blue-200 rounded-lg px-2 py-1 text-[12px] font-bold" onClick={(e) => { e.stopPropagation(); setSel(n); }}>View</button>
          {n.status === NotificationStatus.Unread && (
            <button className="text-[12px] font-bold text-green-700 border border-green-300 rounded-lg px-2 py-1" onClick={(e) => { e.stopPropagation(); actions.markRead(n.id); }}>Read</button>
          )}
        </div>
      ),
    },
  ];

  function takeAction(n: Notification) {
    if (n.relatedKind === 'finding' && n.relatedId) router.push(`/dgms/findings?focus=${n.relatedId}`);
    else if (n.relatedKind === 'inspection' && n.relatedId) router.push('/dgms/inspections');
    else if (n.relatedKind === 'alert') router.push('/dgms/safety');
    else if (n.relatedKind === 'report' || n.relatedKind === 'mine') router.push('/dgms/reports');
    else if (n.relatedKind === 'worker') router.push('/dgms/workforce');
    else setSel(n);
  }

  return (
    <Shell title="Notifications & Alerts" subtitle="Stay updated with critical alerts, inspection updates and compliance actions across all mines.">
      <div className="flex gap-2 mb-3 flex-wrap items-center"><span className="ml-auto"><DemoBadge /></span></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <KpiCard icon={<Bell size={22} />} label="Critical Alerts" value={db.notifications.filter((n) => n.priority === Priority.Critical && n.status !== NotificationStatus.Resolved).length} sub="open" />
        <KpiCard icon={<Bell size={22} />} label="High Priority" value={db.notifications.filter((n) => n.priority === Priority.High && n.status !== NotificationStatus.Resolved).length} />
        <KpiCard icon={<Bell size={22} />} label="Informational" value={db.notifications.filter((n) => n.priority === Priority.Low).length} />
        <KpiCard icon={<Bell size={22} />} label="Resolved" value={db.notifications.filter((n) => n.status === NotificationStatus.Resolved).length} />
      </div>

      <div className="flex gap-2 mb-3 flex-wrap">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-xl px-4 py-2 text-[13px] font-bold ${tab === t ? 'bg-blue-600 text-white' : 'bg-white border'}`}>
            {t === 'All' ? `All Notifications (${tabCounts.All})` : `${t} (${tabCounts[t] ?? 0})`}
          </button>
        ))}
      </div>

      <div className="grid xl:grid-cols-3 gap-3">
        <SectionCard className="xl:col-span-2" title={`Notifications (${rows.length})`} action={
          <div className="flex gap-2">
            {selected.length > 0 && <button className="text-green-700 border border-green-300 rounded-lg px-3 py-1.5 text-[12px] font-bold" onClick={() => { actions.markSelectedRead(selected); setSelected([]); }}>Mark Selected as Read ({selected.length})</button>}
            <button className="text-blue-700 border border-blue-200 rounded-lg px-3 py-1.5 text-[12px] font-bold" onClick={() => actions.markAllRead()}>Mark All as Read</button>
            <button className="text-blue-700 border border-blue-200 rounded-lg px-3 py-1.5 text-[12px] font-bold" onClick={() =>
              exportCSV('notifications', ['DateTime', 'Type', 'Title', 'Mine', 'State', 'Priority', 'Status'],
                rows.map((n) => [n.datetime, n.category, n.title, mineName(n.mineId), n.state ?? '', n.priority, n.status]))}>⤓ Export</button>
          </div>
        }>
          <SearchInput value={q} onChange={setQ} onSearch={() => setQq(q)} ph="Search by mine name, alert type or description…" />
          <FilterBar defs={[
            { key: 'state', label: 'State', options: states },
            { key: 'mine', label: 'Mine', options: ['All Mines', ...db.mines.map((m) => `${m.name} (${m.code})`)], width: '!w-56' },
            { key: 'priority', label: 'Priority', options: ['All Priorities', ...Object.values(Priority)] },
            { key: 'status', label: 'Status', options: ['All Statuses', ...Object.values(NotificationStatus)] },
          ]} values={draft}
            onChange={(k, v) => setDraft((d) => ({ ...d, [k]: v }))}
            onApply={() => setApplied(draft)}
            onReset={() => { const r = { state: 'All States', mine: 'All Mines', priority: 'All Priorities', status: 'All Statuses' }; setDraft(r); setApplied(r); setQ(''); setQq(''); }} />
          <div className="mt-3">
            <DataTable columns={columns} rows={rows} selectable onSelect={setSelected} onRowClick={(n) => setSel(n)} />
          </div>
        </SectionCard>

        <div className="space-y-3">
          <SectionCard title="Alert Distribution" action={<span className="text-[11px] text-slate-500 font-normal">Click a segment to filter</span>}>
            <div className="h-[170px] relative cursor-pointer">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={dist} dataKey="value" innerRadius={52} outerRadius={72} paddingAngle={2}
                    onClick={(d: { name?: string }) => {
                      if (d?.name && ['Critical', 'High', 'Medium', 'Low'].includes(d.name)) {
                        setDraft((x) => ({ ...x, priority: d.name as string }));
                        setApplied((x) => ({ ...x, priority: d.name as string }));
                      }
                    }}>
                    {dist.map((x) => <Cell key={x.name} fill={x.color} cursor="pointer" />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-extrabold text-navy">{db.notifications.length}</span>
                <span className="text-[11px] text-slate-500">Total Alerts</span>
              </div>
            </div>
            <div className="text-[12px] space-y-1">{dist.map((d) => (
              <div key={d.name} className="flex gap-2 items-center"><span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />{d.name}<b className="ml-auto">{d.value} ({Math.round((d.value / total) * 100)}%)</b></div>
            ))}</div>
          </SectionCard>
          <SectionCard title="Recent Actions" action={<span className="text-blue-600 text-xs font-bold">Live from audit log</span>}>
            <div className="space-y-2">
              {recentActions.map((a) => (
                <div key={a.id} className="border-b last:border-0 pb-2">
                  <div className="text-[13px] font-bold text-navy">{a.details.slice(0, 60)}{a.details.length > 60 ? '…' : ''}</div>
                  <div className="text-[11px] text-slate-500">{a.timestamp.slice(0, 16).replace('T', ', ')} · by {a.user}</div>
                </div>
              ))}
              {recentActions.length === 0 && <div className="text-[13px] text-slate-500">No recent actions yet — act on an alert to create one.</div>}
            </div>
          </SectionCard>
        </div>
      </div>

      {sel && (
        <DetailDrawer title="Alert Details" onClose={() => setSel(null)} wide>
          <div className="flex gap-2 items-center flex-wrap mb-2">
            <StatusPill v={sel.priority} /><StatusPill v={sel.status} />
            <span className="text-[11px] text-slate-500 ml-auto">{sel.id} · {relTime(sel.datetime)}</span>
          </div>
          <div className="font-extrabold text-navy">{sel.title}</div>
          <p className="text-[13px] text-slate-600 mt-1">{sel.description}</p>
          <div className="mt-2">
            <Kv k="Mine" v={mineName(sel.mineId)} />
            <Kv k="State" v={sel.state ?? 'All States'} />
            <Kv k="Detected" v={sel.datetime.slice(0, 16).replace('T', ', ')} />
            <Kv k="Source" v={sel.evidence ?? 'Demo record'} />
            {sel.recommendation && <Kv k="Recommended Action" v={sel.recommendation} />}
            {sel.relatedId && <Kv k="Related Record" v={`${sel.relatedKind} · ${sel.relatedId}`} />}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            <button className="btn-primary !bg-white !text-navy border border-slate-300" onClick={() => { actions.markRead(sel.id); setSel({ ...sel, status: NotificationStatus.Read }); }}>Mark as Read</button>
            <button className="btn-primary" onClick={() => { takeAction(sel); }}>Take Action</button>
          </div>
          <button className="text-[12px] font-bold text-amber-700 mt-2 underline" onClick={() => { actions.acknowledgeNotification(sel.id); setSel({ ...sel, status: NotificationStatus.Acknowledged }); }}>
            Acknowledge (does not resolve the underlying record)
          </button>
        </DetailDrawer>
      )}
      <Toasts />
    </Shell>
  );
}




