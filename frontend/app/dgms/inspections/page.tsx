/**
 * Page 3 — Inspection Oversight. Scheduling creates records that update the
 * table, inspector workload and KPIs through the same store.
 */
'use client';
import { useMemo, useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { Bar, BarChart, Cell, Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Shell from '../../../components/Shell';
import { actions, useMockDb } from '../../../lib/dgms/mockDb';
import { exportCSV } from '../../../lib/dgms/export';
import { fmtDate } from '../../../lib/dgms/format';
import { InspectionStatus, InspectionType, Priority, ReportStatus } from '../../../lib/dgms/types';
import type { Inspection } from '../../../lib/dgms/types';
import { ConfirmDialog, DataTable, DemoBadge, DetailDrawer, FilterBar, KpiCard, Kv, SearchInput, SectionCard, Toasts, type Column } from '../../../components/dgms/ui';
import { StatusPill } from '../../../components/dgms/ui';

const TYPES = ['All Types', ...Object.values(InspectionType)];
const STATUS = ['All Statuses', ...Object.values(InspectionStatus)];

export default function InspectionsPage() {
  const db = useMockDb();
  const [q, setQ] = useState(''); const [qq, setQq] = useState('');
  const [draft, setDraft] = useState({ state: 'All States', mine: 'All Mines', inspector: 'All Inspectors', status: 'All Statuses' });
  const [applied, setApplied] = useState(draft);
  const [period, setPeriod] = useState<'Daily' | 'Weekly' | 'Monthly'>('Daily');
  const [sel, setSel] = useState<Inspection | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [form, setForm] = useState({ mineId: '', inspectorId: '', type: InspectionType.Routine as InspectionType, date: '2026-10-06', priority: Priority.Medium as Priority, remarks: '' });
  const [formErr, setFormErr] = useState('');
  const [confirm, setConfirm] = useState<{ title: string; body: string; run: () => void } | null>(null);

  const states = useMemo(() => ['All States', ...[...new Set(db.mines.map((m) => m.state))].sort()], [db.mines]);
  const mineOpts = useMemo(() => ['All Mines', ...db.mines.filter((m) => applied.state === 'All States' || m.state === applied.state).map((m) => `${m.name} (${m.code})`)], [db.mines, applied.state]);
  const inspOpts = useMemo(() => ['All Inspectors', ...db.inspectors.map((i) => i.name)], [db.inspectors]);
  const mineName = (id: string) => { const m = db.mines.find((x) => x.id === id); return m ? `${m.name} (${m.code})` : id; };
  const mineIdOf = (label: string) => db.mines.find((x) => `${x.name} (${x.code})` === label)?.id ?? null;
  const inspName = (id: string) => db.inspectors.find((x) => x.id === id)?.name ?? id;
  const inspIdOf = (label: string) => db.inspectors.find((x) => x.name === label)?.id ?? null;

  const rows = db.inspections.filter((i) => {
    const m = db.mines.find((x) => x.id === i.mineId);
    const needle = qq.trim().toLowerCase();
    if (needle && !(i.id.toLowerCase().includes(needle) || (m?.name.toLowerCase().includes(needle)) || inspName(i.inspectorId).toLowerCase().includes(needle))) return false;
    if (applied.state !== 'All States' && m?.state !== applied.state) return false;
    const mid = mineIdOf(applied.mine); if (mid && i.mineId !== mid) return false;
    const iid = inspIdOf(applied.inspector); if (iid && i.inspectorId !== iid) return false;
    if (applied.status !== 'All Statuses' && i.status !== applied.status) return false;
    return true;
  });

  // Trend buckets derived from the filtered records (scheduled dates).
  const trend = useMemo(() => {
    const buckets = new Map<string, { label: string; Completed: number; Scheduled: number; Overdue: number }>();
    const key = (iso: string) => {
      const d = new Date(iso);
      if (period === 'Monthly') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (period === 'Weekly') { const monday = new Date(d); monday.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return monday.toISOString().slice(0, 10); }
      return iso.slice(0, 10);
    };
    rows.forEach((i) => {
      const k = key(i.scheduledDate);
      if (!buckets.has(k)) buckets.set(k, { label: k.slice(5), Completed: 0, Scheduled: 0, Overdue: 0 });
      const b = buckets.get(k)!;
      if (i.status === InspectionStatus.Completed) b.Completed++;
      else if (i.status === InspectionStatus.Overdue) b.Overdue++;
      else b.Scheduled++;
    });
    return [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-8).map(([, v]) => v);
  }, [rows, period]);

  const byState = states.slice(1).map((s) => ({
    state: s,
    n: db.inspections.filter((i) => db.mines.find((m) => m.id === i.mineId)?.state === s).length,
  })).filter((r) => r.n > 0);

  const workload = db.inspectors.map((ins) => {
    const mine = db.inspections.filter((i) => i.inspectorId === ins.id);
    return { ...ins, done: mine.filter((i) => i.status === InspectionStatus.Completed).length, total: mine.length };
  });

  const columns: Column<Inspection>[] = [
    { key: 'id', header: 'Inspection ID', render: (r) => <span className="font-bold text-navy">{r.id}</span>, sortValue: (r) => r.id },
    { key: 'mine', header: 'Mine Name', render: (r) => mineName(r.mineId), sortValue: (r) => mineName(r.mineId) },
    { key: 'state', header: 'State', render: (r) => db.mines.find((m) => m.id === r.mineId)?.state ?? '—', sortValue: (r) => db.mines.find((m) => m.id === r.mineId)?.state ?? '' },
    { key: 'insp', header: 'Inspector', render: (r) => inspName(r.inspectorId), sortValue: (r) => inspName(r.inspectorId) },
    { key: 'date', header: 'Scheduled Date', render: (r) => fmtDate(r.scheduledDate), sortValue: (r) => r.scheduledDate },
    { key: 'type', header: 'Type', render: (r) => r.type, sortValue: (r) => r.type },
    { key: 'status', header: 'Status', render: (r) => <StatusPill v={r.status} />, sortValue: (r) => r.status },
    { key: 'report', header: 'Report', render: (r) => <StatusPill v={r.reportStatus} />, sortValue: (r) => r.reportStatus },
    { key: 'actions', header: 'Actions', render: (r) => <button className="text-blue-700 border border-blue-200 rounded-lg px-2.5 py-1 text-[12px] font-bold" onClick={(e) => { e.stopPropagation(); setSel(r); }}>View</button> },
  ];

  function doExport() {
    exportCSV('inspection-schedule', ['Inspection ID', 'Mine', 'State', 'Inspector', 'Scheduled', 'Type', 'Status', 'Report'],
      rows.map((r) => [r.id, mineName(r.mineId), db.mines.find((m) => m.id === r.mineId)?.state ?? '', inspName(r.inspectorId), r.scheduledDate, r.type, r.status, r.reportStatus]));
  }

  function submitSchedule() {
    setFormErr('');
    if (!form.mineId || !form.inspectorId || !form.date) { setFormErr('Mine, inspector and scheduled date are required.'); return; }
    if (form.date < '2026-10-03') { setFormErr('Scheduled date cannot be in the past (demo today is 03 Oct 2026).'); return; }
    actions.createInspection({ mineId: form.mineId, inspectorId: form.inspectorId, type: form.type, status: InspectionStatus.Scheduled, priority: form.priority, scheduledDate: form.date, actualDate: undefined, remarks: form.remarks });
    setScheduling(false);
    setForm({ mineId: '', inspectorId: '', type: InspectionType.Routine, date: '2026-10-06', priority: Priority.Medium, remarks: '' });
  }

  const selMine = sel ? db.mines.find((m) => m.id === sel.mineId) : null;
  const selFindings = sel ? db.findings.filter((f) => f.inspectionId === sel.id) : [];

  return (
    <Shell title="Inspection Oversight" subtitle="Monitor inspection planning, progress, reports and compliance across all mines.">
      <div className="flex gap-2 mb-3 flex-wrap items-center"><span className="ml-auto"><DemoBadge /></span></div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-3">
        <KpiCard icon={<ClipboardCheck size={22} />} label="Total Inspections" value={rows.length} sub="in scope" />
        <KpiCard icon={<ClipboardCheck size={22} />} label="Completed" value={rows.filter((i) => i.status === InspectionStatus.Completed).length} />
        <KpiCard icon={<ClipboardCheck size={22} />} label="In Progress" value={rows.filter((i) => i.status === InspectionStatus.InProgress).length} />
        <KpiCard icon={<ClipboardCheck size={22} />} label="Overdue" value={rows.filter((i) => i.status === InspectionStatus.Overdue).length} />
        <KpiCard icon={<ClipboardCheck size={22} />} label="Reports Pending Review" value={rows.filter((i) => i.reportStatus === ReportStatus.PendingReview).length} />
      </div>

      <SectionCard title="Inspection Schedule & Reports" action={
        <div className="flex gap-2">
          <button className="text-blue-700 border border-blue-200 rounded-lg px-3 py-1.5 text-[12px] font-bold" onClick={doExport}>⤓ Export</button>
          <button className="btn-primary !py-1.5" onClick={() => { setFormErr(''); setScheduling(true); }}>+ Schedule Inspection</button>
        </div>
      }>
        <SearchInput value={q} onChange={setQ} onSearch={() => setQq(q)} ph="Search by mine, inspector or report ID…" />
        <FilterBar defs={[
          { key: 'state', label: 'State', options: states },
          { key: 'mine', label: 'Mine', options: mineOpts, width: '!w-56' },
          { key: 'inspector', label: 'Inspector', options: inspOpts },
          { key: 'status', label: 'Status', options: STATUS },
        ]} values={draft}
          onChange={(k, v) => setDraft((d) => ({ ...d, [k]: v, ...(k === 'state' ? { mine: 'All Mines' } : {}) }))}
          onApply={() => setApplied(draft)}
          onReset={() => { const r = { state: 'All States', mine: 'All Mines', inspector: 'All Inspectors', status: 'All Statuses' }; setDraft(r); setApplied(r); setQ(''); setQq(''); }} />
        <div className="mt-3"><DataTable columns={columns} rows={rows} onRowClick={(r) => setSel(r)} /></div>
      </SectionCard>

      <div className="grid xl:grid-cols-3 gap-3 mt-3">
        <SectionCard title="Inspection Status Trend" action={
          <select className="input !w-auto !py-1.5 text-[12px]" value={period} onChange={(e) => setPeriod(e.target.value as typeof period)}>
            <option>Daily</option><option>Weekly</option><option>Monthly</option>
          </select>
        }>
          <div className="h-[210px]">
            <ResponsiveContainer>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="Completed" stroke="#16a34a" dot={false} />
                <Line type="monotone" dataKey="Scheduled" stroke="#2563eb" dot={false} />
                <Line type="monotone" dataKey="Overdue" stroke="#ef4444" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
        <SectionCard title="Inspections by State" action={<span className="text-[11px] text-slate-500 font-normal">Click a state to filter</span>}>
          <div className="h-[210px]">
            <ResponsiveContainer>
              <BarChart data={byState} layout="vertical" margin={{ left: 80 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="state" tick={{ fontSize: 11 }} width={75} />
                <Tooltip />
                <Bar dataKey="n" radius={[0, 6, 6, 0]} onClick={(d: { state?: string }) => {
                  if (d?.state) { setDraft((x) => ({ ...x, state: d.state as string, mine: 'All Mines' })); setApplied((x) => ({ ...x, state: d.state as string, mine: 'All Mines' })); }
                }}>
                  {byState.map((r, i) => <Cell key={r.state} fill={['#2563eb', '#16a34a', '#f59e0b', '#8b5cf6'][i % 4]} cursor="pointer" />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
        <SectionCard title="Inspector Activity">
          <div className="text-[12px] space-y-2">
            {workload.map((w) => (
              <div key={w.id} className="flex items-center gap-2 border-b last:border-0 pb-2">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-navy truncate">{w.name} <span className="font-normal text-slate-500">· {w.designation}</span></div>
                  <div className="h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full" style={{ width: w.total ? `${Math.round((w.done / w.total) * 100)}%` : '0%' }} />
                  </div>
                </div>
                <span className="text-[11px] text-slate-500 whitespace-nowrap">{w.done}/{w.total}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {scheduling && (
        <DetailDrawer title="Schedule Inspection" onClose={() => setScheduling(false)}>
          {formErr && <div className="text-[13px] bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 mb-3">{formErr}</div>}
          <label className="block text-xs font-semibold text-slate-600 mb-2">Mine (active only) *
            <select className="input mt-1" value={form.mineId} onChange={(e) => setForm({ ...form, mineId: e.target.value })}>
              <option value="">Select mine…</option>
              {db.mines.filter((m) => m.status !== 'Inactive' && m.status !== 'Closed').map((m) => <option key={m.id} value={m.id}>{m.name} ({m.code})</option>)}
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-600 mb-2">Inspector *
            <select className="input mt-1" value={form.inspectorId} onChange={(e) => setForm({ ...form, inspectorId: e.target.value })}>
              <option value="">Select inspector…</option>
              {db.inspectors.map((i) => <option key={i.id} value={i.id}>{i.name} — {i.designation}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <label className="block text-xs font-semibold text-slate-600">Type
              <select className="input mt-1" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as InspectionType })}>{Object.values(InspectionType).map((t) => <option key={t}>{t}</option>)}</select>
            </label>
            <label className="block text-xs font-semibold text-slate-600">Priority
              <select className="input mt-1" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}>{Object.values(Priority).map((t) => <option key={t}>{t}</option>)}</select>
            </label>
          </div>
          <label className="block text-xs font-semibold text-slate-600 mb-2">Scheduled Date *
            <input type="date" className="input mt-1" value={form.date} min="2026-10-03" onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </label>
          <label className="block text-xs font-semibold text-slate-600 mb-2">Remarks
            <textarea className="input mt-1" rows={3} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
          </label>
          <button className="btn-primary w-full mt-2" onClick={submitSchedule}>Create Inspection</button>
        </DetailDrawer>
      )}

      {sel && (
        <DetailDrawer title={`Inspection ${sel.id}`} onClose={() => setSel(null)} wide>
          <Kv k="Mine" v={selMine ? `${selMine.name} (${selMine.code}) · ${selMine.state}` : sel.mineId} />
          <Kv k="Inspector" v={inspName(sel.inspectorId)} />
          <Kv k="Type / Priority" v={`${sel.type} · ${sel.priority}`} />
          <Kv k="Scheduled" v={fmtDate(sel.scheduledDate)} />
          <Kv k="Actual Date" v={sel.actualDate ? fmtDate(sel.actualDate) : '—'} />
          <Kv k="Status" v={<StatusPill v={sel.status} />} />
          <Kv k="Report" v={<StatusPill v={sel.reportStatus} />} />
          <Kv k="Remarks" v={sel.remarks} />
          {selFindings.length > 0 && (
            <div className="mt-2 text-[13px]">
              <div className="font-bold text-navy mb-1">Linked findings ({selFindings.length})</div>
              {selFindings.map((f) => <div key={f.id} className="flex gap-2 py-1 border-b last:border-0"><span className="font-bold">{f.id}</span><StatusPill v={f.severity} /><StatusPill v={f.status} /></div>)}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 mt-4">
            {sel.status === InspectionStatus.Scheduled && (
              <button className="btn-primary" onClick={() => setConfirm({ title: 'Start inspection?', body: `${sel.id} will move to In Progress.`, run: () => { actions.updateInspection(sel.id, { status: InspectionStatus.InProgress }); setSel({ ...sel, status: InspectionStatus.InProgress }); } })}>Mark In Progress</button>
            )}
            {sel.status !== InspectionStatus.Completed && (
              <button className="btn-primary !bg-green-600 hover:!bg-green-700" onClick={() => setConfirm({ title: 'Complete inspection?', body: 'Completing submits the report and refreshes the mine record. This is audited.', run: () => { actions.updateInspection(sel.id, { status: InspectionStatus.Completed, actualDate: '2026-10-03' }); const u = { ...sel, status: InspectionStatus.Completed } as Inspection; setSel(u); } })}>Complete Inspection</button>
            )}
            {sel.reportStatus === ReportStatus.PendingReview && (
              <>
                <button className="btn-primary !bg-green-600 hover:!bg-green-700" onClick={() => setConfirm({ title: 'Approve report?', body: `Approve the submitted report for ${sel.id}?`, run: () => { actions.updateInspection(sel.id, { reportStatus: ReportStatus.Approved }); setSel({ ...sel, reportStatus: ReportStatus.Approved }); } })}>Approve Report</button>
                <button className="btn-primary !bg-red-600 hover:!bg-red-700" onClick={() => setConfirm({ title: 'Reject report?', body: 'The inspector must resubmit with strata logs and corrections.', run: () => { actions.updateInspection(sel.id, { reportStatus: ReportStatus.Rejected, rejectionReason: 'Missing strata logs — resubmit.' }); setSel({ ...sel, reportStatus: ReportStatus.Rejected }); } })}>Reject Report</button>
              </>
            )}
          </div>
          {sel.reportStatus === ReportStatus.Rejected && sel.rejectionReason && (
            <div className="text-[12px] bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 mt-3">Rejection reason: {sel.rejectionReason}</div>
          )}
        </DetailDrawer>
      )}

      {confirm && <ConfirmDialog title={confirm.title} body={confirm.body} onCancel={() => setConfirm(null)} onConfirm={() => { confirm.run(); setConfirm(null); }} />}
      <Toasts />
    </Shell>
  );
}




