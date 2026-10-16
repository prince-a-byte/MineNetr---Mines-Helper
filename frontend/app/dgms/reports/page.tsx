/**
 * Page 8 — Reports & Analytics. Generated reports store real CSV payloads
 * built from the current filtered records; downloads re-emit that payload.
 */
'use client';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BarChart3 as BarChartIcon } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Shell from '../../../components/Shell';
import { actions, useMockDb } from '../../../lib/dgms/mockDb';
import { complianceOfMine } from '../../../lib/dgms/seed';
import { downloadJSON, exportCSV } from '../../../lib/dgms/export';
import { fmtDate } from '../../../lib/dgms/format';
import { FindingStatus, Severity } from '../../../lib/dgms/types';
import { ConfirmDialog, DataTable, DemoBadge, DetailDrawer, KpiCard, Kv, SearchInput, SectionCard, Toasts, type Column } from '../../../components/dgms/ui';
import { StatusPill } from '../../../components/dgms/ui';
import type { ComplianceReport, Mine, ScheduledReport } from '../../../lib/dgms/types';

const TYPES = ['Compliance Report', 'Inspection Report', 'Safety Report', 'Environmental Report', 'Production Report', 'Contractor Report'];

const MONTHS = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
const MLABEL: Record<string, string> = { '2026-01': 'Jan', '2026-02': 'Feb', '2026-03': 'Mar', '2026-04': 'Apr', '2026-05': 'May', '2026-06': 'Jun', '2026-07': 'Jul', '2026-08': 'Aug', '2026-09': 'Sep', '2026-10': 'Oct' };

export default function ReportsPage() {
  const db = useMockDb();
  const presetType = useSearchParams().get('type');
  const [gen, setGen] = useState({ type: presetType || 'Compliance Report', state: 'All States', mine: 'All Mines', operator: 'All Operators' });
  const [q, setQ] = useState(''); const [qq, setQq] = useState('');
  const [selMine, setSelMine] = useState<Mine | null>(null);
  const [schedEdit, setSchedEdit] = useState<ScheduledReport | null>(null);
  const [schedNew, setSchedNew] = useState(false);
  const [schedForm, setSchedForm] = useState({ name: '', frequency: 'Monthly' as ScheduledReport['frequency'], nextRun: '2026-11-01' });
  const [delSched, setDelSched] = useState<ScheduledReport | null>(null);

  const states = useMemo(() => ['All States', ...[...new Set(db.mines.map((m) => m.state))].sort()], [db.mines]);
  const mineName = (id: string) => { const m = db.mines.find((x) => x.id === id); return m ? `${m.name} (${m.code})` : id; };

  const inScope = (mineId: string) => {
    const m = db.mines.find((x) => x.id === mineId);
    if (!m) return false;
    if (gen.state !== 'All States' && m.state !== gen.state) return false;
    if (gen.mine !== 'All Mines' && mineId !== gen.mine) return false;
    if (gen.operator !== 'All Operators' && m.operator !== gen.operator) return false;
    return true;
  };

  const scopedMines = db.mines.filter((m) => inScope(m.id));
  const scopedFindings = db.findings.filter((f) => inScope(f.mineId));
  const compOf = (id: string) => complianceOfMine(id, db.findings);
  const compliant = scopedMines.filter((m) => compOf(m.id) === 'Compliant').length;
  const partial = scopedMines.filter((m) => compOf(m.id) === 'Partially Compliant').length;
  const nonComp = scopedMines.filter((m) => compOf(m.id) === 'Non-Compliant').length;

  // Monthly compliance trend. Demo approximation, footnoted: resolved findings
  // are treated as cleared in the month after detection (no resolvedAt kept).
  const trend = MONTHS.map((mo) => {
    const end = mo + '-31';
    let c = 0, p = 0, n = 0;
    scopedMines.forEach((m) => {
      const open = db.findings.filter((f) => f.mineId === m.id && f.detectedAt.slice(0, 7) <= mo && !(f.status === 'Resolved' && f.detectedAt.slice(0, 7) < mo));
      if (open.some((f) => f.severity === Severity.Critical)) n++;
      else if (open.length > 0) p++;
      else c++;
    });
    void end;
    return { m: MLABEL[mo], Compliant: c, Partial: p, NonCompliant: n };
  });

  const byState = states.slice(1).map((s) => {
    const ms = scopedMines.filter((m) => m.state === s);
    return {
      state: s,
      Compliant: ms.filter((m) => compOf(m.id) === 'Compliant').length,
      Partial: ms.filter((m) => compOf(m.id) === 'Partially Compliant').length,
      NonCompliant: ms.filter((m) => compOf(m.id) === 'Non-Compliant').length,
      total: ms.length,
    };
  }).filter((r) => r.total > 0);

  const catDonut = [
    { name: 'Safety (PPE, HSE)', value: scopedFindings.filter((f) => f.category === 'Safety').length, color: '#ef4444' },
    { name: 'Environment', value: scopedFindings.filter((f) => f.category === 'Environment').length, color: '#16a34a' },
    { name: 'Equipment Safety', value: scopedFindings.filter((f) => f.category === 'Equipment').length, color: '#2563eb' },
    { name: 'Documentation', value: scopedFindings.filter((f) => f.category === 'Documentation').length, color: '#f59e0b' },
    { name: 'Worker Welfare', value: scopedFindings.filter((f) => f.category === 'Worker Welfare').length, color: '#8b5cf6' },
    { name: 'Others', value: scopedFindings.filter((f) => f.category === 'Other').length, color: '#94a3b8' },
  ];

  const summaryRows = scopedMines.filter((m) => {
    const needle = qq.trim().toLowerCase();
    return !needle || m.name.toLowerCase().includes(needle) || m.code.toLowerCase().includes(needle) || m.operator.toLowerCase().includes(needle);
  });

  const columns: Column<Mine>[] = [
    { key: 'code', header: 'Mine Code', render: (m) => <span className="font-bold text-blue-700">{m.code}</span>, sortValue: (m) => m.code },
    { key: 'name', header: 'Mine Name', render: (m) => m.name, sortValue: (m) => m.name },
    { key: 'state', header: 'State', render: (m) => m.state, sortValue: (m) => m.state },
    { key: 'op', header: 'Operator', render: (m) => m.operator, sortValue: (m) => m.operator },
    { key: 'comp', header: 'Compliance', render: (m) => <StatusPill v={compOf(m.id)} />, sortValue: (m) => compOf(m.id) },
    { key: 'fnd', header: 'Findings', render: (m) => db.findings.filter((f) => f.mineId === m.id && f.status !== FindingStatus.Resolved).length, sortValue: (m) => db.findings.filter((f) => f.mineId === m.id && f.status !== FindingStatus.Resolved).length },
    { key: 'last', header: 'Last Inspection', render: (m) => fmtDate(m.lastInspection), sortValue: (m) => m.lastInspection },
    { key: 'actions', header: 'Actions', render: (m) => <button className="text-blue-700 border border-blue-200 rounded-lg px-2.5 py-1 text-[12px] font-bold" onClick={(e) => { e.stopPropagation(); setSelMine(m); }}>View</button> },
  ];

  function buildCSV(): string {
    const head = ['Mine Code', 'Mine Name', 'State', 'Operator', 'Compliance', 'Open Findings', 'Last Inspection'];
    const lines = scopedMines.map((m) => [m.code, m.name, m.state, m.operator, compOf(m.id), db.findings.filter((f) => f.mineId === m.id && f.status !== FindingStatus.Resolved).length, m.lastInspection].join(','));
    return [head.join(','), ...lines].join('\n');
  }

  function generate() {
    const name = `${gen.type} (${gen.state === 'All States' ? 'All Mines' : gen.state}, ${fmtDate('2026-10-03')})`;
    actions.generateReport(gen.type, name, { state: gen.state, mine: gen.mine, operator: gen.operator }, buildCSV());
  }

  function downloadReport(r: ComplianceReport) {
    // Seed reports predate this session: regenerate their payload from live
    // demo data so downloads are never stale fabrications.
    const csv = r.csv || buildCSV();
    downloadJSON(r.id, { report: r.name, type: r.type, generatedAt: r.generatedAt, generatedBy: r.generatedBy, filters: r.filters, csv });
  }

  return (
    <Shell title="Reports & Analytics" subtitle="Comprehensive reports and analytics for informed decision making and better governance.">
      <div className="flex gap-2 mb-3 flex-wrap items-center"><span className="ml-auto"><DemoBadge /></span></div>

      <div className="grid sm:grid-cols-3 xl:grid-cols-6 gap-2 mb-3">
        {TYPES.map((t) => (
          <button key={t} onClick={() => setGen((g) => ({ ...g, type: t }))}
            className={`border rounded-xl p-3 text-left transition ${gen.type === t ? 'border-blue-600 ring-1 ring-blue-600 bg-blue-50/50' : 'hover:border-blue-400'}`}>
            <div className="text-[12px] font-bold text-navy">{t} →</div>
            <div className="text-[11px] text-slate-500 mt-1">{gen.type === t ? '● Selected' : 'Select for generator'}</div>
          </button>
        ))}
      </div>

      <SectionCard title="Generate Report" action={
        <button className="btn-primary !py-2" onClick={generate}>🔍 Generate Report</button>
      }>
        <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-2">
          <label className="block text-xs font-semibold text-slate-600">Report Type
            <select className="input mt-1" value={gen.type} onChange={(e) => setGen({ ...gen, type: e.target.value })}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label className="block text-xs font-semibold text-slate-600">Duration
            <select className="input mt-1"><option>01 Sep 2026 – 03 Oct 2026</option></select></label>
          <label className="block text-xs font-semibold text-slate-600">State
            <select className="input mt-1" value={gen.state} onChange={(e) => setGen({ ...gen, state: e.target.value, mine: 'All Mines' })}>{states.map((s) => <option key={s}>{s}</option>)}</select></label>
          <label className="block text-xs font-semibold text-slate-600">Mine
            <select className="input mt-1" value={gen.mine} onChange={(e) => setGen({ ...gen, mine: e.target.value })}>
              <option>All Mines</option>
              {db.mines.filter((m) => gen.state === 'All States' || m.state === gen.state).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select></label>
          <label className="block text-xs font-semibold text-slate-600">Operator
            <select className="input mt-1" value={gen.operator} onChange={(e) => setGen({ ...gen, operator: e.target.value })}>
              <option>All Operators</option>
              {[...new Set(db.mines.map((m) => m.operator))].map((o) => <option key={o}>{o}</option>)}
            </select></label>
        </div>
      </SectionCard>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mt-3">
        <KpiCard icon={<BarChartIcon size={22} />} label="Total Mines" value={scopedMines.length} sub="in scope" />
        <KpiCard icon={<BarChartIcon size={22} />} label="Compliant Mines" value={compliant} />
        <KpiCard icon={<BarChartIcon size={22} />} label="Partially Compliant" value={partial} />
        <KpiCard icon={<BarChartIcon size={22} />} label="Non-Compliant" value={nonComp} />
        <KpiCard icon={<BarChartIcon size={22} />} label="Total Findings" value={scopedFindings.length} />
      </div>

      <div className="grid xl:grid-cols-3 gap-3 mt-3">
        <SectionCard title="Compliance Trend" action={<span className="text-[11px] text-slate-500 font-normal">Monthly</span>}>
          <div className="h-[210px]">
            <ResponsiveContainer>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis dataKey="m" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="Compliant" stroke="#16a34a" dot={false} />
                <Line type="monotone" dataKey="Partial" stroke="#f59e0b" dot={false} />
                <Line type="monotone" dataKey="NonCompliant" stroke="#ef4444" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Demo approximation: resolved findings count as cleared the month after detection.</div>
        </SectionCard>
        <SectionCard title="Compliance by State">
          <div className="h-[210px]">
            <ResponsiveContainer>
              <BarChart data={byState} layout="vertical" margin={{ left: 80 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="state" tick={{ fontSize: 11 }} width={75} />
                <Tooltip />
                <Bar dataKey="Compliant" stackId="c" fill="#16a34a" />
                <Bar dataKey="Partial" stackId="c" fill="#f59e0b" />
                <Bar dataKey="NonCompliant" stackId="c" fill="#ef4444" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
        <SectionCard title="Findings by Category">
          <div className="h-[170px] relative">
            <ResponsiveContainer>
              <PieChart><Pie data={catDonut} dataKey="value" innerRadius={48} outerRadius={68} paddingAngle={2}>
                {catDonut.map((d) => <Cell key={d.name} fill={d.color} />)}
              </Pie></PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-extrabold text-navy">{scopedFindings.length}</span>
              <span className="text-[11px] text-slate-500">findings</span>
            </div>
          </div>
          <div className="text-[12px] space-y-1">{catDonut.map((d) => (
            <div key={d.name} className="flex gap-2 items-center"><span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />{d.name}<b className="ml-auto">{d.value}</b></div>
          ))}</div>
        </SectionCard>
      </div>

      <div className="grid xl:grid-cols-3 gap-3 mt-3">
        <SectionCard className="xl:col-span-2" title={`Mine Compliance Summary (${summaryRows.length})`} action={
          <div className="flex gap-2">
            <SearchInput value={q} onChange={setQ} onSearch={() => setQq(q)} ph="Search by mine name, code or operator…" width="!w-64" />
            <button className="text-blue-700 border border-blue-200 rounded-lg px-3 py-1.5 text-[12px] font-bold" onClick={() =>
              exportCSV('mine-compliance-summary', ['Mine Code', 'Mine Name', 'State', 'Operator', 'Compliance', 'Open Findings', 'Last Inspection'],
                summaryRows.map((m) => [m.code, m.name, m.state, m.operator, compOf(m.id), db.findings.filter((f) => f.mineId === m.id && f.status !== 'Resolved').length, m.lastInspection]))}>⤓ Export</button>
          </div>
        }>
          <DataTable columns={columns} rows={summaryRows} onRowClick={(m) => setSelMine(m)} />
        </SectionCard>
        <div className="space-y-3">
          <SectionCard title="Recent Reports">
            <div className="space-y-2 max-h-[260px] overflow-y-auto">
              {db.reports.map((r) => (
                <div key={r.id} className="flex gap-2 items-center border-b last:border-0 pb-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-navy truncate">{r.name}</div>
                    <div className="text-[11px] text-slate-500">{r.type} · {fmtDate(r.generatedAt)} · {r.generatedBy}</div>
                  </div>
                  <button className="text-blue-700 border border-blue-200 rounded-lg px-2.5 py-1 text-[12px] font-bold" onClick={() => downloadReport(r)}>Download</button>
                </div>
              ))}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Downloads regenerate from current demo data (never a stale fabrication).</div>
          </SectionCard>
          <SectionCard title="Scheduled Reports" action={
            <button className="btn-primary !py-1.5 !text-[12px]" onClick={() => { setSchedForm({ name: '', frequency: 'Monthly', nextRun: '2026-11-01' }); setSchedNew(true); }}>+ New</button>
          }>
            <div className="space-y-2">
              {db.scheduled.map((s) => (
                <div key={s.id} className="flex gap-2 items-center border-b last:border-0 pb-2">
                  <div className="flex-1">
                    <div className="text-[13px] font-bold text-navy">{s.name}</div>
                    <div className="text-[11px] text-slate-500">{s.frequency} · Next run: {fmtDate(s.nextRun)}</div>
                  </div>
                  <button className="text-[11px] font-bold text-blue-700" onClick={() => setSchedEdit(s)}>Edit</button>
                  <button
                    role="switch" aria-checked={s.enabled} aria-label={`Enable ${s.name}`}
                    onClick={() => actions.toggleSchedule(s.id)}
                    className={`w-10 h-6 rounded-full relative transition ${s.enabled ? 'bg-blue-600' : 'bg-slate-300'}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${s.enabled ? 'left-[18px]' : 'left-0.5'}`} />
                  </button>
                  <button className="text-[11px] font-bold text-red-600" onClick={() => setDelSched(s)}>Delete</button>
                </div>
              ))}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Demo configuration only — no background scheduler or email service exists.</div>
          </SectionCard>
        </div>
      </div>

      {selMine && (
        <DetailDrawer title={`${selMine.name} (${selMine.code})`} onClose={() => setSelMine(null)}>
          <Kv k="Compliance" v={<StatusPill v={compOf(selMine.id)} />} />
          <Kv k="Operator" v={selMine.operator} />
          <Kv k="State" v={`${selMine.state} / ${selMine.district}`} />
          <Kv k="Open Findings" v={db.findings.filter((f) => f.mineId === selMine.id && f.status !== 'Resolved').length} />
          <Kv k="Last Inspection" v={fmtDate(selMine.lastInspection)} />
        </DetailDrawer>
      )}

      {(schedEdit || schedNew) && (
        <DetailDrawer title={schedEdit ? `Edit ${schedEdit.name}` : 'New Scheduled Report'} onClose={() => { setSchedEdit(null); setSchedNew(false); }}>
          <label className="block text-xs font-semibold text-slate-600 mb-2">Name
            <input className="input mt-1" value={schedEdit ? schedEdit.name : schedForm.name}
              onChange={(e) => schedEdit ? setSchedEdit({ ...schedEdit, name: e.target.value }) : setSchedForm({ ...schedForm, name: e.target.value })} /></label>
          <label className="block text-xs font-semibold text-slate-600 mb-2">Frequency
            <select className="input mt-1" value={schedEdit ? schedEdit.frequency : schedForm.frequency}
              onChange={(e) => schedEdit ? setSchedEdit({ ...schedEdit, frequency: e.target.value as ScheduledReport['frequency'] }) : setSchedForm({ ...schedForm, frequency: e.target.value as ScheduledReport['frequency'] })}>
              <option>Daily</option><option>Weekly</option><option>Monthly</option><option>Quarterly</option>
            </select></label>
          <label className="block text-xs font-semibold text-slate-600 mb-2">Next Run
            <input type="date" className="input mt-1" value={schedEdit ? schedEdit.nextRun : schedForm.nextRun}
              onChange={(e) => schedEdit ? setSchedEdit({ ...schedEdit, nextRun: e.target.value }) : setSchedForm({ ...schedForm, nextRun: e.target.value })} /></label>
          <button className="btn-primary w-full mt-2" onClick={() => {
            if (schedEdit) actions.updateSchedule(schedEdit.id, { name: schedEdit.name, frequency: schedEdit.frequency, nextRun: schedEdit.nextRun });
            else if (schedForm.name.trim()) actions.createSchedule({ name: schedForm.name.trim(), frequency: schedForm.frequency, nextRun: schedForm.nextRun, enabled: true });
            setSchedEdit(null); setSchedNew(false);
          }}>Save Schedule</button>
        </DetailDrawer>
      )}

      {delSched && (
        <ConfirmDialog title="Delete schedule?" body={`"${delSched.name}" will be removed from demo configuration.`}
          confirmLabel="Delete" onCancel={() => setDelSched(null)}
          onConfirm={() => { actions.deleteSchedule(delSched.id); setDelSched(null); }} />
      )}
      <Toasts />
    </Shell>
  );
}





