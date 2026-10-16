/**
 * Page 10 — Audit Logs. Append-only: every consequential mock action in the
 * portal lands here automatically (see actions in lib/dgms/mockDb.ts).
 * No delete/modify UI is exposed.
 */
'use client';
import { useMemo, useState } from 'react';
import { ScrollText } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Shell from '../../../components/Shell';
import { useMockDb } from '../../../lib/dgms/mockDb';
import { exportCSV } from '../../../lib/dgms/export';
import { fmtDate } from '../../../lib/dgms/format';
import { AuditSeverity } from '../../../lib/dgms/types';
import type { AuditLog } from '../../../lib/dgms/types';
import { DataTable, DemoBadge, DetailDrawer, FilterBar, KpiCard, Kv, SearchInput, SectionCard, Toasts, type Column } from '../../../components/dgms/ui';
import { StatusPill } from '../../../components/dgms/ui';

function typeOf(a: AuditLog): string {
  if (a.module === 'Login' || a.action === 'Login') return 'Login / Logout';
  if (['Created', 'Updated', 'Deleted'].includes(a.action) || a.module === 'Inspection' && a.action !== 'Approved') return a.action === 'Updated' || a.action === 'Created' ? 'Data Modification' : a.action;
  if (a.module === 'Reports') return 'Report Access';
  if (a.module === 'User Management' || a.module === 'Settings') return a.module === 'Settings' ? 'System Settings' : 'User Management';
  return 'Other';
}

export default function AuditPage() {
  const db = useMockDb();
  const [q, setQ] = useState(''); const [qq, setQq] = useState('');
  const [draft, setDraft] = useState({ user: 'All Users', module: 'All Modules', action: 'All Actions', severity: 'All Severities' });
  const [applied, setApplied] = useState(draft);
  const [period, setPeriod] = useState('Daily');
  const [sel, setSel] = useState<AuditLog | null>(null);
  void period;

  const users = useMemo(() => ['All Users', ...[...new Set(db.audit.map((a) => a.user))].sort()], [db.audit]);
  const modules = useMemo(() => ['All Modules', ...[...new Set(db.audit.map((a) => a.module))].sort()], [db.audit]);
  const actionsList = useMemo(() => ['All Actions', ...[...new Set(db.audit.map((a) => a.action))].sort()], [db.audit]);

  const rows = db.audit.filter((a) => {
    const needle = qq.trim().toLowerCase();
    if (needle && !(a.user.toLowerCase().includes(needle) || a.action.toLowerCase().includes(needle) || a.module.toLowerCase().includes(needle) || a.resource.toLowerCase().includes(needle))) return false;
    if (applied.user !== 'All Users' && a.user !== applied.user) return false;
    if (applied.module !== 'All Modules' && a.module !== applied.module) return false;
    if (applied.action !== 'All Actions' && a.action !== applied.action) return false;
    if (applied.severity !== 'All Severities' && a.severity !== applied.severity) return false;
    return true;
  });

  const byDay = useMemo(() => {
    const map = new Map<string, number>();
    db.audit.forEach((a) => {
      const d = a.timestamp.slice(0, 10);
      map.set(d, (map.get(d) ?? 0) + 1);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-7).map(([d, n]) => ({ d: d.slice(5), n }));
  }, [db.audit]);

  const byType = useMemo(() => {
    const cats = ['Login / Logout', 'Data Modification', 'Report Access', 'User Management', 'System Settings', 'Other'];
    const colors = ['#2563eb', '#16a34a', '#f59e0b', '#ef4444', '#8b5cf6', '#94a3b8'];
    return cats.map((c, i) => ({ name: c, value: db.audit.filter((a) => typeOf(a) === c).length, color: colors[i] }));
  }, [db.audit]);
  const total = byType.reduce((a, d) => a + d.value, 0) || 1;

  const last7 = useMemo(() => {
    const days: { d: string; n: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dt = new Date('2026-10-03T00:00:00+05:30');
      dt.setDate(dt.getDate() - i);
      const key = dt.toISOString().slice(0, 10);
      days.push({ d: `${dt.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][dt.getMonth()]}`, n: db.audit.filter((a) => a.timestamp.slice(0, 10) === key).length });
    }
    return days;
  }, [db.audit]);

  const byModule = useMemo(() => {
    const map = new Map<string, number>();
    db.audit.forEach((a) => map.set(a.module, (map.get(a.module) ?? 0) + 1));
    return [...map.entries()].map(([m, n]) => ({ m, n })).sort((a, b) => b.n - a.n).slice(0, 7);
  }, [db.audit]);
  const modMax = Math.max(1, ...byModule.map((r) => r.n));

  const columns: Column<AuditLog>[] = [
    { key: 'ts', header: 'Date & Time', render: (a) => <span className="text-[12px]">{a.timestamp.slice(0, 16).replace('T', ', ')}</span>, sortValue: (a) => a.timestamp },
    { key: 'user', header: 'User', render: (a) => a.user, sortValue: (a) => a.user },
    { key: 'role', header: 'Role', render: (a) => <span className="text-[12px]">{a.role}</span>, sortValue: (a) => a.role },
    { key: 'module', header: 'Module', render: (a) => a.module, sortValue: (a) => a.module },
    { key: 'action', header: 'Action', render: (a) => <span className="font-semibold text-green-700">{a.action}</span>, sortValue: (a) => a.action },
    { key: 'details', header: 'Details / Description', render: (a) => <span className="text-[12px] block max-w-[260px] truncate">{a.details}</span>, sortValue: (a) => a.details },
    { key: 'ip', header: 'IP Address', render: (a) => <span className="text-[12px]">{a.ip}</span>, sortValue: (a) => a.ip },
    { key: 'sev', header: 'Severity', render: (a) => <StatusPill v={a.severity} />, sortValue: (a) => a.severity },
    { key: 'actions', header: 'Actions', render: (a) => <button className="text-blue-700 border border-blue-200 rounded-lg px-2.5 py-1 text-[12px] font-bold" onClick={(e) => { e.stopPropagation(); setSel(a); }}>View</button> },
  ];

  return (
    <Shell title="Audit Logs" subtitle="Track all system activities, data changes and user actions for transparency and accountability.">
      <div className="flex gap-2 mb-3 flex-wrap items-center"><span className="ml-auto"><DemoBadge /></span></div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-3">
        <KpiCard icon={<ScrollText size={22} />} label="Total Activities" value={db.audit.length} sub="this session scope" />
        <KpiCard icon={<ScrollText size={22} />} label="Unique Users" value={new Set(db.audit.map((a) => a.user)).size} />
        <KpiCard icon={<ScrollText size={22} />} label="Data Modifications" value={db.audit.filter((a) => ['Created', 'Updated', 'Deleted'].includes(a.action)).length} />
        <KpiCard icon={<ScrollText size={22} />} label="Login Activities" value={db.audit.filter((a) => a.action === 'Login').length} />
        <KpiCard icon={<ScrollText size={22} />} label="Critical Actions" value={db.audit.filter((a) => a.severity === AuditSeverity.Critical || a.severity === AuditSeverity.High).length} />
      </div>

      <div className="grid xl:grid-cols-3 gap-3">
        <SectionCard title="Audit Log Activity Trend" action={
          <select className="input !w-auto !py-1.5 text-[12px]" value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option>Daily</option><option>Weekly</option>
          </select>
        }>
          <div className="h-[200px]">
            <ResponsiveContainer>
              <LineChart data={byDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis dataKey="d" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="n" name="Activities" stroke="#2563eb" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Live counts — every action you take in this demo appears here.</div>
        </SectionCard>
        <SectionCard title="Activities by Type">
          <div className="h-[160px] relative">
            <ResponsiveContainer>
              <PieChart><Pie data={byType} dataKey="value" innerRadius={44} outerRadius={64} paddingAngle={2}>
                {byType.map((d) => <Cell key={d.name} fill={d.color} />)}
              </Pie></PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-extrabold text-navy">{db.audit.length}</span>
              <span className="text-[11px] text-slate-500">activities</span>
            </div>
          </div>
          <div className="text-[12px] space-y-1">{byType.map((d) => (
            <div key={d.name} className="flex gap-2 items-center"><span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />{d.name}<b className="ml-auto">{Math.round((d.value / total) * 100)}% ({d.value})</b></div>
          ))}</div>
        </SectionCard>
        <div className="space-y-3">
          <SectionCard title="Recent Activity (Last 7 Days)">
            <div className="h-[150px]">
              <ResponsiveContainer>
                <BarChart data={last7}>
                  <XAxis dataKey="d" tick={{ fontSize: 9 }} />
                  <Tooltip />
                  <Bar dataKey="n" fill="#2563eb" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
          <SectionCard title="Activity by Module">
            <div className="text-[12px] space-y-1.5">
              {byModule.map((r) => (
                <div key={r.m} className="flex items-center gap-2">
                  <span className="w-32 text-slate-600 truncate">{r.m}</span>
                  <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-blue-600 rounded-full" style={{ width: `${Math.round((r.n / modMax) * 100)}%` }} /></div>
                  <b>{r.n}</b>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>

      <SectionCard className="mt-3" title={`Audit Log Records (${rows.length})`} action={
        <button className="text-blue-700 border border-blue-200 rounded-lg px-3 py-1.5 text-[12px] font-bold" onClick={() =>
          exportCSV('audit-logs', ['Timestamp', 'User', 'Role', 'Module', 'Action', 'Resource', 'Details', 'IP', 'Severity'],
            rows.map((a) => [a.timestamp, a.user, a.role, a.module, a.action, a.resource, a.details, a.ip, a.severity]))}>⤓ Export</button>
      }>
        <div className="font-bold text-navy text-sm mb-2">Filter Audit Logs</div>
        <FilterBar defs={[
          { key: 'user', label: 'User', options: users },
          { key: 'module', label: 'Module', options: modules },
          { key: 'action', label: 'Action', options: actionsList },
          { key: 'severity', label: 'Severity', options: ['All Severities', ...Object.values(AuditSeverity)] },
        ]} values={draft} onChange={(k, v) => setDraft((d) => ({ ...d, [k]: v }))}
          onApply={() => setApplied(draft)}
          onReset={() => { const r = { user: 'All Users', module: 'All Modules', action: 'All Actions', severity: 'All Severities' }; setDraft(r); setApplied(r); setQ(''); setQq(''); }} />
        <div className="mt-3">
          <SearchInput value={q} onChange={setQ} onSearch={() => setQq(q)} ph="Search by user name, action, module, mine name or record ID…" />
        </div>
        <div className="mt-3"><DataTable columns={columns} rows={rows} onRowClick={(a) => setSel(a)} /></div>
        <div className="text-[11px] text-slate-500 mt-2">Append-only demo log. IPs are synthetic. No delete/modify actions exist.</div>
      </SectionCard>

      {sel && (
        <DetailDrawer title="Log Details" onClose={() => setSel(null)}>
          <div className="font-extrabold text-navy">{sel.details}</div>
          <div className="text-[12px] text-slate-500 mb-2">{fmtDate(sel.timestamp)}</div>
          <Kv k="User" v={`${sel.user} (${sel.role})`} />
          <Kv k="Module" v={sel.module} />
          <Kv k="Action" v={sel.action} />
          <Kv k="Resource" v={sel.resource} />
          <Kv k="IP Address" v={`${sel.ip} (synthetic demo value)`} />
          <Kv k="Severity" v={<StatusPill v={sel.severity} />} />
          {sel.relatedId && <Kv k="Related Record" v={sel.relatedId} />}
          {sel.before !== undefined && <Kv k="Previous Value" v={sel.before} />}
          {sel.after !== undefined && <Kv k="New Value" v={sel.after} />}
        </DetailDrawer>
      )}
      <Toasts />
    </Shell>
  );
}




