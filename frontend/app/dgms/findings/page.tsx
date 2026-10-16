/**
 * Page 4 — Findings & Violations. Corrective actions live in the same store,
 * so resolving here updates dashboard alerts, compliance and reports.
 */
'use client';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { TriangleAlert } from 'lucide-react';
import { Cell, Line, LineChart, CartesianGrid, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Shell from '../../../components/Shell';
import { actions, useMockDb } from '../../../lib/dgms/mockDb';
import { exportCSV } from '../../../lib/dgms/export';
import { fmtDate, relTime } from '../../../lib/dgms/format';
import { CorrectiveActionStatus, FindingCategory, FindingStatus, Severity } from '../../../lib/dgms/types';
import type { CorrectiveAction, Finding } from '../../../lib/dgms/types';
import { ConfirmDialog, DataTable, DemoBadge, DetailDrawer, FilterBar, KpiCard, Kv, SearchInput, SectionCard, Toasts, type Column } from '../../../components/dgms/ui';
import { StatusPill } from '../../../components/dgms/ui';

const SEV_ORDER = [Severity.Critical, Severity.High, Severity.Medium, Severity.Low];

export default function FindingsPage() {
  const db = useMockDb();
  const preset = useSearchParams().get('category');
  const focus = useSearchParams().get('focus');
  const [q, setQ] = useState(''); const [qq, setQq] = useState('');
  const [draft, setDraft] = useState({ state: 'All States', mine: 'All Mines', category: preset || 'All Categories', severity: 'All Severities', status: 'All Statuses' });
  const [applied, setApplied] = useState(draft);
  const [trendMode, setTrendMode] = useState<'Weekly' | 'Monthly'>('Weekly');
  const [sel, setSel] = useState<Finding | null>(() => db.findings.find((f) => f.id === focus) ?? null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assign, setAssign] = useState({ officer: '', dueDate: '2026-10-10', note: '' });
  const [caEdit, setCaEdit] = useState<CorrectiveAction | null>(null);
  const [caPatch, setCaPatch] = useState({ status: CorrectiveActionStatus.InProgress as CorrectiveActionStatus, resolution: '' });
  const [confirmResolve, setConfirmResolve] = useState(false);
  const [err, setErr] = useState('');

  const states = useMemo(() => ['All States', ...[...new Set(db.mines.map((m) => m.state))].sort()], [db.mines]);
  const mineOpts = useMemo(() => ['All Mines', ...db.mines.filter((m) => applied.state === 'All States' || m.state === applied.state).map((m) => `${m.name} (${m.code})`)], [db.mines, applied.state]);
  const mineName = (id: string) => { const m = db.mines.find((x) => x.id === id); return m ? `${m.name} (${m.code})` : id; };
  const mineIdOf = (label: string) => db.mines.find((x) => `${x.name} (${x.code})` === label)?.id ?? null;
  const inspName = (id: string) => db.inspectors.find((x) => x.id === id)?.name ?? id;

  const rows = db.findings.filter((f) => {
    const m = db.mines.find((x) => x.id === f.mineId);
    const needle = qq.trim().toLowerCase();
    if (needle && !(f.id.toLowerCase().includes(needle) || f.description.toLowerCase().includes(needle))) return false;
    if (applied.state !== 'All States' && m?.state !== applied.state) return false;
    const mid = mineIdOf(applied.mine); if (mid && f.mineId !== mid) return false;
    if (applied.category !== 'All Categories' && f.category !== applied.category) return false;
    if (applied.severity !== 'All Severities' && f.severity !== applied.severity) return false;
    if (applied.status !== 'All Statuses' && f.status !== applied.status) return false;
    return true;
  });

  const catDonut = Object.values(FindingCategory).map((c, i) => ({
    name: c, value: rows.filter((f) => f.category === c).length,
    color: ['#ef4444', '#16a34a', '#2563eb', '#f59e0b', '#8b5cf6', '#94a3b8'][i % 6],
  }));
  const sevBars = SEV_ORDER.map((s, i) => ({
    sev: s, n: rows.filter((f) => f.severity === s).length,
    color: ['#ef4444', '#f97316', '#f59e0b', '#16a34a'][i],
  }));

  const trend = useMemo(() => {
    const buckets = new Map<string, number>();
    rows.forEach((f) => {
      const d = new Date(f.detectedAt);
      let k: string;
      if (trendMode === 'Monthly') k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      else { const mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay() + 6) % 7)); k = mon.toISOString().slice(0, 10); }
      buckets.set(k, (buckets.get(k) ?? 0) + 1);
    });
    return [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-8).map(([k, n]) => ({ label: k.slice(5), findings: n }));
  }, [rows, trendMode]);

  const columns: Column<Finding>[] = [
    { key: 'id', header: 'Finding ID', render: (f) => <span className="font-bold text-navy">{f.id}</span>, sortValue: (f) => f.id },
    { key: 'mine', header: 'Mine', render: (f) => mineName(f.mineId), sortValue: (f) => mineName(f.mineId) },
    { key: 'state', header: 'State', render: (f) => db.mines.find((m) => m.id === f.mineId)?.state ?? '—', sortValue: (f) => db.mines.find((m) => m.id === f.mineId)?.state ?? '' },
    { key: 'insp', header: 'Inspector', render: (f) => inspName(f.inspectorId), sortValue: (f) => inspName(f.inspectorId) },
    { key: 'cat', header: 'Category', render: (f) => f.category, sortValue: (f) => f.category },
    { key: 'sev', header: 'Severity', render: (f) => <StatusPill v={f.severity} />, sortValue: (f) => SEV_ORDER.indexOf(f.severity) },
    { key: 'status', header: 'Status', render: (f) => <StatusPill v={f.status} />, sortValue: (f) => f.status },
    { key: 'ca', header: 'Corrective Action', render: (f) => { const c = db.correctiveActions.find((x) => x.findingId === f.id); return c ? <StatusPill v={c.status} /> : <span className="text-slate-400 text-[12px]">—</span>; } },
    { key: 'actions', header: 'Actions', render: (f) => <button className="text-blue-700 border border-blue-200 rounded-lg px-2.5 py-1 text-[12px] font-bold" onClick={(e) => { e.stopPropagation(); setSel(f); setErr(''); }}>View</button> },
  ];

  const selMine = sel ? db.mines.find((m) => m.id === sel.mineId) : null;
  const selCAs = sel ? db.correctiveActions.filter((c) => c.findingId === sel.id) : [];

  function doResolve() {
    if (!sel) return;
    setErr('');
    try {
      actions.updateFinding(sel.id, { status: FindingStatus.Resolved });
      setSel({ ...sel, status: FindingStatus.Resolved });
    } catch (e) { setErr(e instanceof Error ? e.message : 'Resolve failed.'); }
    setConfirmResolve(false);
  }

  return (
    <Shell title="Findings & Violations" subtitle="Monitor inspection findings, AI-detected observations and violations across all mines.">
      <div className="flex gap-2 mb-3 flex-wrap items-center"><span className="ml-auto"><DemoBadge /></span></div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-3">
        <KpiCard icon={<TriangleAlert size={22} />} label="Total Findings" value={rows.length} />
        <KpiCard icon={<TriangleAlert size={22} />} label="Critical" value={rows.filter((f) => f.severity === Severity.Critical).length} />
        <KpiCard icon={<TriangleAlert size={22} />} label="High Priority" value={rows.filter((f) => f.severity === Severity.High).length} />
        <KpiCard icon={<TriangleAlert size={22} />} label="In Progress" value={rows.filter((f) => f.status === FindingStatus.InProgress || f.status === FindingStatus.Assigned).length} />
        <KpiCard icon={<TriangleAlert size={22} />} label="Resolved" value={rows.filter((f) => f.status === FindingStatus.Resolved).length} />
      </div>

      <SectionCard title={`Findings & Violations Register (${rows.length})`} action={
        <button className="text-blue-700 border border-blue-200 rounded-lg px-3 py-1.5 text-[12px] font-bold" onClick={() =>
          exportCSV('findings-register', ['Finding ID', 'Mine', 'State', 'Inspector', 'Category', 'Severity', 'Status', 'Detected', 'Due'],
            rows.map((f) => [f.id, mineName(f.mineId), db.mines.find((m) => m.id === f.mineId)?.state ?? '', inspName(f.inspectorId), f.category, f.severity, f.status, f.detectedAt.slice(0, 10), f.dueDate]))}>⤓ Export</button>
      }>
        <SearchInput value={q} onChange={setQ} onSearch={() => setQq(q)} ph="Search by finding ID, mine, category…" />
        <FilterBar defs={[
          { key: 'state', label: 'State', options: states },
          { key: 'mine', label: 'Mine', options: mineOpts, width: '!w-56' },
          { key: 'category', label: 'Category', options: ['All Categories', ...Object.values(FindingCategory)] },
          { key: 'severity', label: 'Severity', options: ['All Severities', ...Object.values(Severity)] },
          { key: 'status', label: 'Status', options: ['All Statuses', ...Object.values(FindingStatus)] },
        ]} values={draft}
          onChange={(k, v) => setDraft((d) => ({ ...d, [k]: v, ...(k === 'state' ? { mine: 'All Mines' } : {}) }))}
          onApply={() => setApplied(draft)}
          onReset={() => { const r = { state: 'All States', mine: 'All Mines', category: 'All Categories', severity: 'All Severities', status: 'All Statuses' }; setDraft(r); setApplied(r); setQ(''); setQq(''); }} />
        <div className="mt-3"><DataTable columns={columns} rows={rows} onRowClick={(f) => { setSel(f); setErr(''); }} /></div>
      </SectionCard>

      <div className="grid xl:grid-cols-3 gap-3 mt-3">
        <SectionCard title="Findings by Category">
          <div className="h-[190px] relative">
            <ResponsiveContainer>
              <PieChart><Pie data={catDonut} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={2}>
                {catDonut.map((d) => <Cell key={d.name} fill={d.color} />)}
              </Pie></PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-extrabold text-navy">{rows.length}</span>
              <span className="text-[11px] text-slate-500">findings</span>
            </div>
          </div>
          <div className="text-[12px] space-y-1">{catDonut.map((d) => (
            <button key={d.name} className="w-full flex gap-2 items-center hover:bg-blue-50 rounded px-1"
              onClick={() => { setDraft((x) => ({ ...x, category: d.name })); setApplied((x) => ({ ...x, category: d.name })); }}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />{d.name}<b className="ml-auto">{d.value}</b>
            </button>
          ))}</div>
        </SectionCard>
        <SectionCard title="Findings by Severity">
          <div className="space-y-2 text-[12px]">
            {sevBars.map((r) => (
              <button key={r.sev} className="w-full flex items-center gap-2 hover:bg-blue-50 rounded px-1 py-0.5"
                onClick={() => { setDraft((x) => ({ ...x, severity: r.sev })); setApplied((x) => ({ ...x, severity: r.sev })); }}>
                <span className="w-20 text-slate-600 text-left">{r.sev}</span>
                <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${rows.length ? Math.round((r.n / rows.length) * 100) : 0}%`, background: r.color }} /></div>
                <b>{r.n}</b>
              </button>
            ))}
          </div>
          <div className="text-[11px] text-slate-500 mt-2">Click a row to filter the register.</div>
        </SectionCard>
        <SectionCard title="Findings Trend" action={
          <select className="input !w-auto !py-1.5 text-[12px]" value={trendMode} onChange={(e) => setTrendMode(e.target.value as 'Weekly' | 'Monthly')}>
            <option>Weekly</option><option>Monthly</option>
          </select>
        }>
          <div className="h-[190px]">
            <ResponsiveContainer>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="findings" stroke="#2563eb" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Derived from detection dates in the current filter scope.</div>
        </SectionCard>
      </div>

      {sel && (
        <DetailDrawer title={`Finding ${sel.id}`} onClose={() => setSel(null)} wide>
          {err && <div className="text-[13px] bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 mb-3">{err}</div>}
          <div className="flex gap-2 flex-wrap mb-2">
            <StatusPill v={sel.category} /><StatusPill v={sel.severity} /><StatusPill v={sel.status} />
            <span className="text-[11px] text-slate-500 ml-auto">Source: {sel.source}{sel.source === 'AI Detection' && !sel.verifiedHuman ? ' · unverified prediction' : ''}</span>
          </div>
          <Kv k="Mine" v={selMine ? `${selMine.name} (${selMine.code}) · ${selMine.state}` : sel.mineId} />
          <Kv k="Inspector" v={inspName(sel.inspectorId)} />
          <Kv k="Inspection Ref" v={sel.inspectionId} />
          <Kv k="Location" v={sel.location} />
          <Kv k="Description" v={sel.description} />
          <Kv k="Detected" v={`${fmtDate(sel.detectedAt)} (${relTime(sel.detectedAt)})`} />
          <Kv k="Due Date" v={fmtDate(sel.dueDate)} />
          <Kv k="Assigned To" v={sel.assignee} />
          <Kv k="Recommendation" v={sel.recommendation} />
          <Kv k="Evidence" v={sel.evidence.join(' · ') + ' (demo placeholders — stored as metadata, no real files)'} />

          <div className="font-bold text-navy mt-4 mb-1 text-sm">Corrective Actions ({selCAs.length})</div>
          {selCAs.length === 0 && <div className="text-[13px] text-slate-500">No corrective action assigned yet.</div>}
          {selCAs.map((c) => (
            <div key={c.id} className="border rounded-xl p-3 mb-2 text-[13px]">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold">{c.id}</span><StatusPill v={c.status} />
                <span className="text-slate-500 text-[12px] ml-auto">Due {fmtDate(c.dueDate)}</span>
              </div>
              <div className="text-slate-600 mt-1">Officer: {c.officer}</div>
              <div className="text-slate-600">Note: {c.note}</div>
              {c.resolution && <div className="text-green-700 font-semibold mt-1">Resolution: {c.resolution}</div>}
              <button className="text-blue-700 font-bold text-[12px] mt-1 underline" onClick={() => { setCaEdit(c); setCaPatch({ status: c.status, resolution: c.resolution ?? '' }); }}>
                Update status / record resolution
              </button>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button className="btn-primary !bg-white !text-navy border border-slate-300" onClick={() => setAssignOpen(true)}>Assign Action</button>
            <button className="btn-primary !bg-green-600 hover:!bg-green-700" onClick={() => setConfirmResolve(true)}>Mark Resolved</button>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Resolution requires a resolved/verified corrective action. All transitions are audited.</p>
        </DetailDrawer>
      )}

      {assignOpen && sel && (
        <DetailDrawer title={`Assign corrective action — ${sel.id}`} onClose={() => setAssignOpen(false)}>
          <label className="block text-xs font-semibold text-slate-600 mb-2">Responsible Officer *
            <input className="input mt-1" value={assign.officer} onChange={(e) => setAssign({ ...assign, officer: e.target.value })} placeholder="e.g. Safety Officer, BCM-03" />
          </label>
          <label className="block text-xs font-semibold text-slate-600 mb-2">Due Date *
            <input type="date" className="input mt-1" value={assign.dueDate} min="2026-10-03" onChange={(e) => setAssign({ ...assign, dueDate: e.target.value })} />
          </label>
          <label className="block text-xs font-semibold text-slate-600 mb-2">Note *
            <textarea className="input mt-1" rows={3} value={assign.note} onChange={(e) => setAssign({ ...assign, note: e.target.value })} />
          </label>
          <button className="btn-primary w-full mt-2" disabled={!assign.officer.trim() || !assign.note.trim()} onClick={() => {
            actions.assignCorrectiveAction(sel.id, assign);
            setAssignOpen(false); setAssign({ officer: '', dueDate: '2026-10-10', note: '' });
            const f = db.findings.find((x) => x.id === sel.id); if (f) setSel({ ...f });
          }}>Assign</button>
        </DetailDrawer>
      )}

      {caEdit && (
        <DetailDrawer title={`Update ${caEdit.id}`} onClose={() => setCaEdit(null)}>
          <label className="block text-xs font-semibold text-slate-600 mb-2">Status
            <select className="input mt-1" value={caPatch.status} onChange={(e) => setCaPatch({ ...caPatch, status: e.target.value as CorrectiveActionStatus })}>
              {Object.values(CorrectiveActionStatus).map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-600 mb-2">Resolution / verification evidence
            <textarea className="input mt-1" rows={3} value={caPatch.resolution} onChange={(e) => setCaPatch({ ...caPatch, resolution: e.target.value })} placeholder="Describe the fix and verification…" />
          </label>
          <button className="btn-primary w-full mt-2" onClick={() => {
            actions.updateCorrectiveAction(caEdit.id, caPatch);
            setCaEdit(null);
            if (sel) { const f = db.findings.find((x) => x.id === sel.id); if (f) setSel({ ...f }); }
          }}>Save</button>
        </DetailDrawer>
      )}

      {confirmResolve && (
        <ConfirmDialog title="Mark finding resolved?" body="The linked corrective action must be resolved or verified. This decision is audited."
          confirmLabel="Resolve" onCancel={() => setConfirmResolve(false)} onConfirm={doResolve} />
      )}
      <Toasts />
    </Shell>
  );
}




