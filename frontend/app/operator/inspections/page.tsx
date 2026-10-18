'use client';
/** Page 10 — Inspection & Audit. Schedule/start/complete inspections, log findings, assign and resolve corrective actions — all through the central store. */
import { useMemo, useState } from 'react';
import { AlertOctagon, CalendarPlus, CheckCircle2, ClipboardList, FileText, Plus, ShieldAlert, Upload } from 'lucide-react';
import OperationsShell from '../../../components/operations/OperationsShell';
import { operatorNav } from '../nav';
import { Column, ConfirmDialog, DataTable, DetailDrawer, EmptyState, Field, KpiCard, Kv, LinkBtn, Modal, OpsBanner, QuickActions, SearchInput, SectionCard, StatusPill, Tabs, Toasts } from '../../../components/operations/ui';
import { Donut, StackedBars } from '../../../components/operations/charts';
import { TODAY, byMine, hrefWithTab, useMineScope, usePageReady, useTab } from '../../../components/operations/hooks';
import { actions, getMine, useMockOps } from '../../../lib/ops/store';
import { daysUntil, fmtDate, num, pct } from '../../../lib/ops/format';
import { exportCsv } from '../../../lib/ops/export';
import { CorrectiveActionStatus, FindingSeverity, FindingStatusNew, InspectionStatusNew, InspectionType, type CorrectiveAction, type Inspection, type InspectionFinding } from '../../../lib/ops/types';

const TABS = ['Inspection Overview', 'Inspection Schedule', 'Audit Findings', 'Corrective Actions', 'Compliance Status', 'Inspection Reports'];
const INSP_TONE: Record<string, string> = { [InspectionStatusNew.Scheduled]: 'bg-blue-100 text-blue-700', [InspectionStatusNew.InProgress]: 'bg-amber-100 text-amber-700', [InspectionStatusNew.Completed]: 'bg-green-100 text-green-700', [InspectionStatusNew.Cancelled]: 'bg-slate-100 text-slate-600' };
const FIND_TONE: Record<string, string> = { [FindingStatusNew.Open]: 'bg-red-100 text-red-600', [FindingStatusNew.ActionAssigned]: 'bg-amber-100 text-amber-700', [FindingStatusNew.Resolved]: 'bg-blue-100 text-blue-700', [FindingStatusNew.Closed]: 'bg-green-100 text-green-700' };
const CA_TONE: Record<string, string> = { [CorrectiveActionStatus.Open]: 'bg-red-100 text-red-600', [CorrectiveActionStatus.InProgress]: 'bg-amber-100 text-amber-700', [CorrectiveActionStatus.Resolved]: 'bg-green-100 text-green-700', [CorrectiveActionStatus.Overdue]: 'bg-red-100 text-red-600' };
const SEV_TONE: Record<string, string> = { [FindingSeverity.Low]: 'bg-slate-100 text-slate-600', [FindingSeverity.Medium]: 'bg-blue-100 text-blue-700', [FindingSeverity.High]: 'bg-amber-100 text-amber-700', [FindingSeverity.Critical]: 'bg-red-100 text-red-600' };

export default function InspectionsPage() {
  const ready = usePageReady();
  const db = useMockOps();
  const mineId = useMineScope();
  const [tab, setTab] = useTab(TABS[0]);
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  const [fType, setFType] = useState('All Types');
  const [fStatus, setFStatus] = useState('All Status');
  const [detail, setDetail] = useState<Inspection | null>(null);
  const [schedOpen, setSchedOpen] = useState(false);
  const [uploadFor, setUploadFor] = useState<Inspection | null>(null);
  const [findingFor, setFindingFor] = useState<Inspection | null>(null);
  const [caFor, setCaFor] = useState<InspectionFinding | null>(null);
  const [resolveFor, setResolveFor] = useState<CorrectiveAction | null>(null);

  const scopedInsp = useMemo(() => byMine(db.inspections, mineId), [db.inspections, mineId]);
  const scopedFindings = useMemo(() => byMine(db.findings, mineId), [db.findings, mineId]);
  const scopedCa = useMemo(() => scopedFindings.flatMap((f) => db.correctiveActions.filter((ca) => ca.findingId === f.id)), [db.correctiveActions, scopedFindings]);

  const k = useMemo(() => {
    const total = scopedInsp.length;
    const c = (s: InspectionStatusNew) => scopedInsp.filter((i) => i.status === s).length;
    return { total, completed: c(InspectionStatusNew.Completed), inProgress: c(InspectionStatusNew.InProgress), scheduled: c(InspectionStatusNew.Scheduled), findings: scopedFindings.length, openFindings: scopedFindings.filter((f) => f.status === FindingStatusNew.Open || f.status === FindingStatusNew.ActionAssigned).length, completedPct: pct(c(InspectionStatusNew.Completed), total) };
  }, [scopedInsp, scopedFindings]);

  const trend = useMemo(() => {
    const out: { label: string; completed: number; inProgress: number; scheduled: number }[] = [];
    const now = new Date('2026-10-01T00:00:00+05:30');
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now); d.setMonth(d.getMonth() - i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const rows = scopedInsp.filter((x) => x.date.startsWith(iso));
      out.push({ label: d.toLocaleString('en', { month: 'short' }), completed: rows.filter((x) => x.status === InspectionStatusNew.Completed).length, inProgress: rows.filter((x) => x.status === InspectionStatusNew.InProgress).length, scheduled: rows.filter((x) => x.status === InspectionStatusNew.Scheduled).length });
    }
    return out;
  }, [scopedInsp]);

  const typeDonut = useMemo(() => {
    const m = new Map<string, number>();
    scopedInsp.forEach((i) => m.set(i.type, (m.get(i.type) ?? 0) + 1));
    const colors = ['#1463D9', '#159B72', '#E8A02B', '#DC4C58', '#7C5CFC', '#68788D'];
    return [...m.entries()].map(([name, value], i) => ({ name, value, color: colors[i % colors.length] })).sort((a, b) => b.value - a.value);
  }, [scopedInsp]);

  const mineStatus = useMemo(() => db.mines.map((m) => {
    const rows = scopedInsp.filter((i) => i.mineId === m.id);
    return { code: m.code, completed: rows.filter((i) => i.status === InspectionStatusNew.Completed).length, inProgress: rows.filter((i) => i.status === InspectionStatusNew.InProgress).length, scheduled: rows.filter((i) => i.status === InspectionStatusNew.Scheduled).length, total: rows.length };
  }).filter((r) => r.total > 0), [db.mines, scopedInsp]);

  const filtered = useMemo(() => {
    const term = dq.trim().toLowerCase();
    return scopedInsp.filter((i) => (!term || `${i.id} ${i.inspector} ${i.type} ${getMine(i.mineId)?.code}`.toLowerCase().includes(term)) && (fType === 'All Types' || i.type === fType) && (fStatus === 'All Status' || i.status === fStatus));
  }, [scopedInsp, dq, fType, fStatus]);
  const upcoming = useMemo(() => scopedInsp.filter((i) => i.status === InspectionStatusNew.Scheduled).sort((a, b) => a.date.localeCompare(b.date)), [scopedInsp]);

  function exportInsp() { exportCsv(`inspections-${mineId === 'ALL' ? 'all-mines' : getMine(mineId)?.code ?? mineId}-${TODAY}`, filtered, [['ID', (i: Inspection) => i.id], ['Date', (i) => i.date], ['Type', (i) => i.type], ['Mine', (i) => getMine(i.mineId)?.code], ['Inspector', (i) => i.inspector], ['Org', (i) => i.inspectorOrg], ['Status', (i) => i.status]]); }

  const inspCols: Column<Inspection>[] = [
    { key: 'id', header: 'Report No.', render: (i) => <span className="font-mono font-bold text-blue-700">{i.id}</span>, sortValue: (i) => i.id },
    { key: 'date', header: 'Date', render: (i) => <span className="text-[12px]">{fmtDate(i.date)}</span>, sortValue: (i) => i.date },
    { key: 'type', header: 'Type', render: (i) => <span className="text-slate-600">{i.type}</span>, sortValue: (i) => i.type },
    { key: 'mine', header: 'Mine', render: (i) => <span className="font-semibold">{getMine(i.mineId)?.code}</span>, sortValue: (i) => i.mineId },
    { key: 'officer', header: 'Inspecting Officer', render: (i) => <span>{i.inspector} <span className="text-slate-400">({i.inspectorOrg})</span></span>, sortValue: (i) => i.inspector },
    { key: 'findings', header: 'Findings', render: (i) => <span className="font-bold">{scopedFindings.filter((f) => f.inspectionId === i.id).length}</span>, sortValue: (i) => scopedFindings.filter((f) => f.inspectionId === i.id).length },
    { key: 'status', header: 'Status', render: (i) => <span className={`badge ${INSP_TONE[i.status]}`}>● {i.status}</span>, sortValue: (i) => i.status },
  ];

  return (
    <OperationsShell nav={operatorNav} title="Inspection & Audit" sub="Inspections, findings and corrective actions">
      <OpsBanner title="Inspection & Audit" sub="Track inspections, manage audit findings, monitor compliances, and ensure corrective actions are completed on time." />
      <div className="px-4 space-y-4">
        {!ready ? (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">{[...Array(5)].map((_, i) => <div key={i} className="card !p-4 animate-pulse"><div className="h-16 bg-slate-100 rounded-xl" /></div>)}</div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <KpiCard icon={<ClipboardList size={22} />} label="Total Inspections" value={num(k.total)} trend="+12%" context="This year" tileClass="bg-blue-50 text-blue-600" />
              <KpiCard icon={<CheckCircle2 size={22} />} label="Completed" value={num(k.completed)} context={`${k.completedPct}% of total`} dotColor="#159B72" tileClass="bg-green-50 text-green-600" />
              <KpiCard icon={<AlertOctagon size={22} />} label="In Progress" value={num(k.inProgress)} context={`${pct(k.inProgress, k.total)}% of total`} dotColor="#E8A02B" tileClass="bg-amber-50 text-amber-600" />
              <KpiCard icon={<CalendarPlus size={22} />} label="Scheduled" value={num(k.scheduled)} context={`${pct(k.scheduled, k.total)}% of total`} dotColor="#DC4C58" tileClass="bg-red-50 text-red-500" />
              <KpiCard icon={<ShieldAlert size={22} />} label="Audit Findings" value={num(k.findings)} trend="+8%" context={`${num(k.openFindings)} open`} dotColor="#7C5CFC" tileClass="bg-purple-50 text-purple-600" />
            </div>

            <SectionCard className="!p-0 !pb-4" title="" action={null}>
              <div className="px-4 -mt-1"><Tabs tabs={TABS} active={tab} onChange={setTab} /></div>
            </SectionCard>

            {tab === 'Inspection Overview' && (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <SectionCard className="xl:col-span-2" title="Inspections Trend (Last 6 Months)">
                  <StackedBars data={trend} xKey="label" height={230} series={[{ key: 'completed', name: 'Completed', fill: '#159B72' }, { key: 'inProgress', name: 'In Progress', fill: '#1463D9' }, { key: 'scheduled', name: 'Scheduled', fill: '#DC4C58' }]} />
                </SectionCard>
                <SectionCard title="Inspection Type Distribution">
                  <Donut data={typeDonut} centerValue={num(k.total)} centerLabel="Total Inspections" height={200} />
                </SectionCard>

                <SectionCard className="xl:col-span-2" title="Inspection Status (Mine-wise)">
                  {mineStatus.length === 0 ? <EmptyState title="No inspections" /> : (
                    <div className="space-y-2.5">
                      {mineStatus.map((r) => (
                        <div key={r.code} className="flex items-center gap-3">
                          <span className="font-bold text-navy w-16 shrink-0">{r.code}</span>
                          <div className="flex-1 h-5 rounded-full bg-slate-100 overflow-hidden flex">
                            {r.completed > 0 && <div className="h-full bg-green-500" style={{ width: `${pct(r.completed, r.total)}%` }} title={`Completed: ${r.completed}`} />}
                            {r.inProgress > 0 && <div className="h-full bg-blue-500" style={{ width: `${pct(r.inProgress, r.total)}%` }} title={`In Progress: ${r.inProgress}`} />}
                            {r.scheduled > 0 && <div className="h-full bg-red-400" style={{ width: `${pct(r.scheduled, r.total)}%` }} title={`Scheduled: ${r.scheduled}`} />}
                          </div>
                          <span className="font-extrabold text-navy w-8 text-right">{r.total}</span>
                        </div>
                      ))}
                      <div className="flex gap-3 text-[11px] text-slate-500 pt-1">
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500" /> Completed</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500" /> In Progress</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-400" /> Scheduled</span>
                      </div>
                    </div>
                  )}
                </SectionCard>

                <div className="space-y-4">
                  <SectionCard title="Upcoming Inspections" action={<LinkBtn onClick={() => setTab('Inspection Schedule')}>View All</LinkBtn>}>
                    {upcoming.length === 0 ? <EmptyState title="No upcoming inspections" /> : upcoming.slice(0, 4).map((i) => (
                      <div key={i.id} className="flex items-center gap-2 py-2 border-b border-slate-50 last:border-0">
                        <div className="text-center bg-blue-50 rounded-lg px-2 py-1 min-w-[48px]">
                          <div className="text-[10px] font-bold text-blue-600 uppercase">{new Date(`${i.date}T00:00:00+05:30`).toLocaleString('en', { month: 'short' })}</div>
                          <div className="text-[15px] font-extrabold text-navy leading-none">{new Date(`${i.date}T00:00:00+05:30`).getDate()}</div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-navy text-[13px] truncate">{i.type} — {getMine(i.mineId)?.code}</div>
                          <div className="text-[11px] text-slate-400 truncate">{i.inspector} ({i.inspectorOrg})</div>
                        </div>
                        <button className="text-xs font-bold text-blue-600 hover:underline" onClick={() => setDetail(i)}>View</button>
                      </div>
                    ))}
                  </SectionCard>
                  <SectionCard title="Quick Actions">
                    <QuickActions items={[
                      { label: 'Schedule Inspection', icon: <Plus size={15} />, tileClass: 'bg-blue-100 text-blue-600', onClick: () => setSchedOpen(true) },
                      { label: 'Upload Report', icon: <Upload size={15} />, tileClass: 'bg-green-100 text-green-700', onClick: () => setUploadFor(upcoming[0] ?? scopedInsp[0] ?? null) },
                      { label: 'View Audit Findings', icon: <ShieldAlert size={15} />, tileClass: 'bg-purple-100 text-purple-600', onClick: () => setTab('Audit Findings') },
                      { label: 'Track Corrective Actions', icon: <ClipboardList size={15} />, tileClass: 'bg-amber-100 text-amber-700', onClick: () => setTab('Corrective Actions') },
                      { label: 'Export Inspection Data', icon: <FileText size={15} />, tileClass: 'bg-red-100 text-red-600', onClick: exportInsp },
                    ]} />
                  </SectionCard>
                </div>

                <div className="xl:col-span-3">
                  <SectionCard title={`Recent Inspection Reports (${filtered.length})`} action={
                    <div className="flex gap-2 flex-wrap items-center">
                      <SearchInput value={q} onChange={setQ} onSearch={() => setDq(q)} ph="Search by report no., mine, officer..." width="!w-52" />
                      <select className="input !w-36 !py-2 !text-[13px]" value={fType} onChange={(e) => setFType(e.target.value)} aria-label="Type filter">{['All Types', ...Object.values(InspectionType)].map((t) => <option key={t}>{t}</option>)}</select>
                      <select className="input !w-36 !py-2 !text-[13px]" value={fStatus} onChange={(e) => setFStatus(e.target.value)} aria-label="Status filter">{['All Status', ...Object.values(InspectionStatusNew)].map((s) => <option key={s}>{s}</option>)}</select>
                      <button className="btn-primary !py-2" onClick={exportInsp}>Export</button>
                      <button className="btn-primary !py-2" onClick={() => setSchedOpen(true)}><span className="inline-flex items-center gap-1"><Plus size={14} /> Schedule</span></button>
                    </div>}>
                    <DataTable<Inspection> columns={inspCols} rows={filtered} onRowClick={setDetail} emptyTitle="No inspections" emptyText="No inspections match the current filters." actions={(i) => (
                      <span className="space-x-2">
                        {i.status === InspectionStatusNew.Scheduled && <button className="text-xs font-bold text-blue-600 hover:underline" onClick={() => actions.startInspection(i.id)}>Start</button>}
                        {i.status === InspectionStatusNew.InProgress && <button className="text-xs font-bold text-green-600 hover:underline" onClick={() => setUploadFor(i)}>Complete</button>}
                        <button className="text-xs font-bold text-slate-500" onClick={() => setDetail(i)}>View</button>
                      </span>
                    )} />
                  </SectionCard>
                </div>
              </div>
            )}

            {tab === 'Inspection Schedule' && (
              <SectionCard title={`Inspection Schedule (${upcoming.length})`} action={<button className="btn-primary !py-2" onClick={() => setSchedOpen(true)}><span className="inline-flex items-center gap-1"><Plus size={14} /> Schedule Inspection</span></button>}>
                {upcoming.length === 0 ? <EmptyState title="No scheduled inspections" sub="Schedule an inspection to populate the queue." /> : <DataTable<Inspection> columns={inspCols} rows={upcoming} onRowClick={setDetail} actions={(i) => <button className="text-xs font-bold text-blue-600 hover:underline" onClick={() => actions.startInspection(i.id)}>Start Inspection</button>} />}
              </SectionCard>
            )}

            {tab === 'Audit Findings' && (
              <SectionCard title={`Audit Findings (${scopedFindings.length})`} action={<button className="btn-primary !py-2" onClick={() => exportCsv(`findings-${TODAY}`, scopedFindings, [['ID', (f: InspectionFinding) => f.id], ['Inspection', (f) => f.inspectionId], ['Category', (f) => f.category], ['Severity', (f) => f.severity], ['Status', (f) => f.status], ['Description', (f) => f.description], ['Location', (f) => f.location]])}>Export Findings</button>}>
                {scopedFindings.length === 0 ? <EmptyState title="No findings" sub="Findings appear after an inspection logs issues." /> : (
                  <DataTable<InspectionFinding> columns={[
                    { key: 'id', header: 'Finding', render: (f) => <span className="font-mono font-bold">{f.id}</span>, sortValue: (f) => f.id },
                    { key: 'insp', header: 'Inspection', render: (f) => <span className="font-mono text-[12px] text-blue-600">{f.inspectionId}</span> },
                    { key: 'cat', header: 'Category', render: (f) => f.category, sortValue: (f) => f.category },
                    { key: 'sev', header: 'Severity', render: (f) => <span className={`badge ${SEV_TONE[f.severity]}`}>● {f.severity}</span>, sortValue: (f) => f.severity },
                    { key: 'desc', header: 'Description', render: (f) => <span className="text-[12px]">{f.description}</span> },
                    { key: 'loc', header: 'Location', render: (f) => <span className="text-slate-600">{f.location}</span> },
                    { key: 'st', header: 'Status', render: (f) => <span className={`badge ${FIND_TONE[f.status]}`}>● {f.status}</span>, sortValue: (f) => f.status },
                    { key: 'a', header: '', render: (f) => <button className="text-xs font-bold text-purple-600 hover:underline" onClick={() => setCaFor(f)}>Assign Action</button> },
                  ]} rows={scopedFindings} initialSize={10} />
                )}
              </SectionCard>
            )}

            {tab === 'Corrective Actions' && (
              <SectionCard title={`Corrective Actions (${scopedCa.length})`} subtitle="Actions assigned to resolve audit findings">
                {scopedCa.length === 0 ? <EmptyState title="No corrective actions" sub="Assign an action from the Audit Findings tab." /> : (
                  <DataTable<CorrectiveAction> columns={[
                    { key: 'id', header: 'Action', render: (ca) => <span className="font-mono font-bold">{ca.id}</span>, sortValue: (ca) => ca.id },
                    { key: 'finding', header: 'Finding', render: (ca) => <span className="font-mono text-[12px] text-blue-600">{ca.findingId}</span> },
                    { key: 'action', header: 'Action', render: (ca) => <span className="text-[12px]">{ca.action}</span> },
                    { key: 'owner', header: 'Owner', render: (ca) => <span className="font-semibold">{ca.owner}</span>, sortValue: (ca) => ca.owner },
                    { key: 'due', header: 'Due Date', render: (ca) => { const d = daysUntil(ca.dueDate); return <span className={`text-[12px] ${d !== null && d < 0 && ca.status !== CorrectiveActionStatus.Resolved ? 'font-bold text-red-500' : ''}`}>{fmtDate(ca.dueDate)}</span>; }, sortValue: (ca) => ca.dueDate },
                    { key: 'st', header: 'Status', render: (ca) => <span className={`badge ${CA_TONE[ca.status]}`}>● {ca.status}</span>, sortValue: (ca) => ca.status },
                    { key: 'a', header: '', render: (ca) => ca.status !== CorrectiveActionStatus.Resolved ? <button className="text-xs font-bold text-green-600 hover:underline" onClick={() => setResolveFor(ca)}>Resolve</button> : <span className="text-slate-400 text-xs">—</span> },
                  ]} rows={scopedCa} initialSize={10} />
                )}
              </SectionCard>
            )}

            {tab === 'Compliance Status' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <SectionCard title="Compliance by Mine" subtitle="Inspection completion rate per mine">
                  <DataTable<{ id: string; code: string; total: number; completed: number; rate: number }> columns={[
                    { key: 'c', header: 'Mine', render: (r) => <span className="font-semibold">{r.code}</span>, sortValue: (r) => r.code },
                    { key: 't', header: 'Inspections', render: (r) => r.total, sortValue: (r) => r.total },
                    { key: 'cm', header: 'Completed', render: (r) => <span className="font-bold text-green-600">{r.completed}</span>, sortValue: (r) => r.completed },
                    { key: 'r', header: 'Rate', render: (r) => <span className={`font-extrabold ${r.rate >= 75 ? 'text-green-600' : r.rate >= 50 ? 'text-amber-600' : 'text-red-500'}`}>{r.rate}%</span>, sortValue: (r) => r.rate },
                  ]} rows={mineStatus.map((r) => ({ id: r.code, code: r.code, total: r.total, completed: r.completed, rate: pct(r.completed, r.total) }))} />
                </SectionCard>
                <SectionCard title="Open Findings by Severity">
                  {(() => {
                    const m = new Map<string, number>();
                    scopedFindings.filter((f) => f.status !== FindingStatusNew.Closed && f.status !== FindingStatusNew.Resolved).forEach((f) => m.set(f.severity, (m.get(f.severity) ?? 0) + 1));
                    const data = [...m.entries()].map(([name, value]) => ({ name, value }));
                    return data.length === 0 ? <EmptyState title="No open findings" /> : <Donut data={data} centerValue={num(data.reduce((s, d) => s + d.value, 0))} centerLabel="Open" height={180} />;
                  })()}
                </SectionCard>
              </div>
            )}

            {tab === 'Inspection Reports' && (
              <SectionCard title="Inspection Reports" subtitle="Completed inspections with uploaded reports" action={<button className="btn-primary !py-2" onClick={exportInsp}>Export All</button>}>
                {(() => {
                  const rows = scopedInsp.filter((i) => i.reportFile);
                  return rows.length === 0 ? <EmptyState title="No reports uploaded" sub="Complete an inspection to upload its report." /> : <DataTable<Inspection> columns={[...inspCols, { key: 'file', header: 'Report File', render: (i) => <span className="font-mono text-[12px] text-blue-600">{i.reportFile}</span> }]} rows={rows} initialSize={10} onRowClick={setDetail} />;
                })()}
              </SectionCard>
            )}
          </>
        )}
      </div>

      {detail && (
        <DetailDrawer title={`${detail.id} — ${detail.type}`} onClose={() => setDetail(null)}>
          <Kv k="Status" v={<span className={`badge ${INSP_TONE[detail.status]}`}>● {detail.status}</span>} />
          <Kv k="Date" v={fmtDate(detail.date)} />
          <Kv k="Mine" v={`${getMine(detail.mineId)?.name} (${getMine(detail.mineId)?.code})`} />
          <Kv k="Inspector" v={`${detail.inspector} (${detail.inspectorOrg})`} />
          <Kv k="Remarks" v={detail.remarks || '—'} />
          <Kv k="Report File" v={detail.reportFile ?? <span className="text-slate-400">Not uploaded</span>} />
          <h4 className="font-extrabold text-navy mt-4 mb-1 text-sm">Findings ({scopedFindings.filter((f) => f.inspectionId === detail.id).length})</h4>
          {scopedFindings.filter((f) => f.inspectionId === detail.id).map((f) => (
            <div key={f.id} className="text-[12px] border border-slate-100 rounded-lg p-2 mb-1.5">
              <div className="flex items-center gap-2"><span className={`badge ${SEV_TONE[f.severity]}`}>{f.severity}</span><span className={`badge ${FIND_TONE[f.status]}`}>{f.status}</span><span className="text-slate-400">{f.location}</span></div>
              <div className="mt-1">{f.description}</div>
            </div>
          ))}
          <div className="flex gap-2 mt-4 flex-wrap">
            {detail.status === InspectionStatusNew.Scheduled && <button className="btn-primary !py-2 !text-xs" onClick={() => { actions.startInspection(detail.id); setDetail(null); }}>Start Inspection</button>}
            {detail.status === InspectionStatusNew.InProgress && <button className="btn-primary !py-2 !text-xs" onClick={() => setUploadFor(detail)}>Complete & Upload Report</button>}
            <button className="btn-primary !py-2 !text-xs !bg-white !text-blue-700 border border-blue-600" onClick={() => setFindingFor(detail)}>Add Finding</button>
          </div>
        </DetailDrawer>
      )}

      {schedOpen && <ScheduleModal mineId={mineId} onClose={() => setSchedOpen(false)} />}
      {uploadFor && <CompleteModal inspection={uploadFor} onClose={() => setUploadFor(null)} />}
      {findingFor && <FindingModal inspection={findingFor} onClose={() => setFindingFor(null)} />}
      {caFor && <CaModal finding={caFor} onClose={() => setCaFor(null)} />}
      {resolveFor && <ResolveCaModal ca={resolveFor} onClose={() => setResolveFor(null)} />}
      <Toasts />
    </OperationsShell>
  );
}

function ScheduleModal({ mineId, onClose }: { mineId: string; onClose: () => void }) {
  const db = useMockOps();
  const scope = mineId === 'ALL' ? 'M-01' : mineId;
  const [f, setF] = useState({ mineId: scope, type: InspectionType.Safety as string, date: '2026-10-20', inspector: '', inspectorOrg: 'DGMS', priority: 'High', remarks: '' });
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  function submit() {
    const e: Record<string, string> = {};
    if (!f.inspector.trim()) e.inspector = 'Inspecting officer is required.';
    if (!f.date) e.date = 'Inspection date is required.';
    setErr(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try { actions.createInspection(f as never); onClose(); } catch (ex: any) { setErr({ form: ex.message }); } finally { setBusy(false); }
  }
  return (
    <Modal title="Schedule Inspection" onClose={onClose}>
      {err.form && <div className="text-[12px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-2" role="alert">{err.form}</div>}
      <div className="grid sm:grid-cols-2 gap-x-3">
        <Field label="Mine"><select className="input" value={f.mineId} onChange={(e) => setF({ ...f, mineId: e.target.value })}>{db.mines.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.code})</option>)}</select></Field>
        <Field label="Inspection type"><select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{Object.values(InspectionType).map((t) => <option key={t} value={t}>{t}</option>)}</select></Field>
        <Field label="Date *" error={err.date}><input type="date" className="input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Inspecting officer *" error={err.inspector}><input className="input" value={f.inspector} onChange={(e) => setF({ ...f, inspector: e.target.value })} placeholder="e.g. R. K. Sharma" /></Field>
        <Field label="Organization"><select className="input" value={f.inspectorOrg} onChange={(e) => setF({ ...f, inspectorOrg: e.target.value })}>{['DGMS', 'State Dept.', 'Internal', 'CIL Safety'].map((o) => <option key={o}>{o}</option>)}</select></Field>
        <Field label="Priority"><select className="input" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>{['Low', 'Medium', 'High', 'Critical'].map((p) => <option key={p}>{p}</option>)}</select></Field>
      </div>
      <Field label="Remarks"><textarea className="input" rows={2} value={f.remarks} onChange={(e) => setF({ ...f, remarks: e.target.value })} /></Field>
      <div className="flex gap-2 justify-end">
        <button className="btn-primary !bg-white !text-navy border border-slate-300" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? 'Scheduling…' : 'Schedule Inspection'}</button>
      </div>
    </Modal>
  );
}

function CompleteModal({ inspection, onClose }: { inspection: Inspection; onClose: () => void }) {
  const [file, setFile] = useState(`${inspection.id}-report.pdf`);
  const [err, setErr] = useState('');
  return (
    <Modal title={`Complete ${inspection.id}`} onClose={onClose}>
      <p className="text-[11px] text-slate-400 mb-3">Simulated upload — the report file name is recorded but no file is sent to a server.</p>
      <Field label="Report file name *" error={err}>
        <input className="input" value={file} onChange={(e) => setFile(e.target.value)} />
      </Field>
      <div className="flex gap-2 justify-end">
        <button className="btn-primary !bg-white !text-navy border border-slate-300" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={() => { if (!file.trim()) { setErr('A file name is required.'); return; } try { actions.completeInspection(inspection.id, file.trim()); onClose(); } catch (e: any) { setErr(e.message); } }}>Complete Inspection</button>
      </div>
    </Modal>
  );
}

function FindingModal({ inspection, onClose }: { inspection: Inspection; onClose: () => void }) {
  const [f, setF] = useState({ category: 'Safety', severity: FindingSeverity.Medium as string, description: '', location: '' });
  const [err, setErr] = useState('');
  return (
    <Modal title={`Add Finding — ${inspection.id}`} onClose={onClose}>
      <div className="grid sm:grid-cols-2 gap-x-3">
        <Field label="Category"><select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{['Safety', 'Environment', 'Statutory', 'Mechanical', 'Electrical', 'Other'].map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Severity"><select className="input" value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value })}>{Object.values(FindingSeverity).map((s) => <option key={s} value={s}>{s}</option>)}</select></Field>
      </div>
      <Field label="Description *" error={err}>
        <textarea className="input" rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="e.g. Missing handrails on conveyor walkway" />
      </Field>
      <Field label="Location">
        <input className="input" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="e.g. Pit I, Level 3" />
      </Field>
      <div className="flex gap-2 justify-end">
        <button className="btn-primary !bg-white !text-navy border border-slate-300" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={() => { if (!f.description.trim()) { setErr('A description is required.'); return; } try { actions.addFinding({ inspectionId: inspection.id, mineId: inspection.mineId, ...f, severity: f.severity as never }); onClose(); } catch (e: any) { setErr(e.message); } }}>Add Finding</button>
      </div>
    </Modal>
  );
}

function CaModal({ finding, onClose }: { finding: InspectionFinding; onClose: () => void }) {
  const [f, setF] = useState({ action: '', owner: '', dueDate: '2026-11-03' });
  const [err, setErr] = useState('');
  return (
    <Modal title={`Assign Corrective Action — ${finding.id}`} onClose={onClose}>
      <p className="text-[11px] text-slate-400 mb-3">{finding.description}</p>
      <Field label="Corrective action *" error={err}>
        <textarea className="input" rows={2} value={f.action} onChange={(e) => setF({ ...f, action: e.target.value })} placeholder="e.g. Install handrails and certify" />
      </Field>
      <div className="grid sm:grid-cols-2 gap-x-3">
        <Field label="Owner"><input className="input" value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} placeholder="e.g. Safety Officer" /></Field>
        <Field label="Due date"><input type="date" className="input" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} /></Field>
      </div>
      <div className="flex gap-2 justify-end">
        <button className="btn-primary !bg-white !text-navy border border-slate-300" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={() => { if (!f.action.trim()) { setErr('An action description is required.'); return; } try { actions.assignCorrectiveAction(finding.id, f); onClose(); } catch (e: any) { setErr(e.message); } }}>Assign Action</button>
      </div>
    </Modal>
  );
}

function ResolveCaModal({ ca, onClose }: { ca: CorrectiveAction; onClose: () => void }) {
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  return (
    <Modal title={`Resolve ${ca.id}`} onClose={onClose}>
      <p className="text-[12px] text-slate-600 mb-3">{ca.action}</p>
      <Field label="Resolution note *" error={err}>
        <textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Handrails installed and certified on 12 Oct" />
      </Field>
      <div className="flex gap-2 justify-end">
        <button className="btn-primary !bg-white !text-navy border border-slate-300" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={() => { if (!note.trim()) { setErr('A resolution note is required.'); return; } try { actions.updateCorrectiveAction(ca.id, CorrectiveActionStatus.Resolved, note.trim()); onClose(); } catch (e: any) { setErr(e.message); } }}>Mark Resolved</button>
      </div>
    </Modal>
  );
}
