'use client';
/**
 * Contractor — Reports (page 7 of the design reference).
 *
 * Everything derives from the centralized workforce repository
 * (lib/workforce/store) plus the contracts repository for the Active Contracts
 * KPI and contract exports:
 *  - KPI cards read computeKpis(db) — never local counters,
 *  - the Overview charts (deployment by mine, attendance + document donuts)
 *    read the same collections and are clickable (mine scope / deep links),
 *  - the Recent Reports table and every category tab read db.reports,
 *  - every Download runs a REAL CSV export built from the store records that
 *    back that report type (workers, attendance trend, bills, documents, …),
 *  - "Generate New Report" and "Re-generate" go through actions.generateReport
 *    (permission-checked; the store flips the row to Ready after ~1.2s).
 *
 * All data is synthetic (fixed demo clock 03 Oct 2026).
 */
import { useMemo, useState } from 'react';
import {
  AlertTriangle, BarChart3, Download, ExternalLink, FileCheck, FileText, GraduationCap,
  Receipt, RotateCcw, ShieldCheck, TrendingUp, UserCheck, Users,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ContractorShell } from './shell';
import {
  DataTable, Field, KpiCard, KpiGrid, Modal, PageToolbar, PermBtn, PermIconBtn,
  PeriodSelect, Pill, QuickActions, SearchInput, SectionCard, SoftPill,
  Donut, VBars, type Column,
} from './ui';
import { Tabs } from '../operations/ui';
import { CHART } from '../operations/hooks';
import {
  actions, attendanceTrend, computeKpis, contractorName, mineLabel,
  toast, useMockWorkforce, type WorkforceDbState,
} from '../../lib/workforce/store';
import { getContractsDb } from '../../lib/contracts/store';
import { ContractStatus } from '../../lib/contracts/types';
import { DEMO_TODAY, type ReportRow } from '../../lib/workforce/types';
import { addDays, fmtDate, fmtSize, periodLabel, trainingStatusOf } from '../../lib/workforce/format';
import { exportCsv } from '../../lib/workforce/export';
import { mines } from '../../lib/workforce/seed';

// ---------- Constants ----------
const TABS = [
  'Overview', 'Worker Reports', 'Attendance Reports', 'Contract Reports',
  'Financial Reports', 'Compliance Reports',
];

const PERIOD_OPTIONS = ['Last 7 Days', 'Last 30 Days', 'This Month', 'Last 6 Months'];

const CATEGORY_OPTIONS = [
  'Worker Reports', 'Attendance Reports', 'Contract Reports',
  'Financial Reports', 'Compliance Reports',
];

/** Toolbar period → number of days of attendance history in scope. */
function periodDays(p: string): number {
  switch (p) {
    case 'Last 7 Days': return 7;
    case 'This Month': return Math.max(1, Number(DEMO_TODAY.slice(8, 10)));
    case 'Last 6 Months': return 90;
    default: return 30;
  }
}

/** Where the "Open" action lands for each report category / title. */
const HREF_BY_CATEGORY: Record<string, string> = {
  'Worker Reports': '/contractor/workers',
  'Attendance Reports': '/contractor/attendance',
  'Contract Reports': '/contractor/contracts',
  'Financial Reports': '/contractor/bills?tab=All%20Bills',
  'Compliance Reports': '/contractor/documents?tab=Statutory%20Compliance',
};

function hrefFor(r: ReportRow): string {
  if (r.href) return r.href;
  const t = r.title.toLowerCase();
  if (t.includes('attendance') || t.includes('gate')) return '/contractor/attendance';
  if (t.includes('bill') || t.includes('financial') || t.includes('payment')) return '/contractor/bills?tab=All%20Bills';
  if (t.includes('training') || t.includes('compliance') || t.includes('document') || t.includes('statutory')) return '/contractor/documents?tab=Statutory%20Compliance';
  if (t.includes('contract')) return '/contractor/contracts';
  if (t.includes('worker') || t.includes('manpower') || t.includes('transfer') || t.includes('leave')) return '/contractor/workers';
  return HREF_BY_CATEGORY[r.category] ?? '/contractor/reports';
}

function msg(e: unknown): string { return e instanceof Error ? e.message : String(e); }

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'report';
}

// ---------- CSV export builders (real files from the store, per report type) ----------
type AnyCols = [string, (r: any) => unknown][];
interface ExportSpec { name: string; rows: any[]; cols: AnyCols }

function scoped<T extends { mineId: string }>(rows: T[], mineId: string): T[] {
  return mineId === 'ALL' ? rows : rows.filter((r) => r.mineId === mineId);
}

function workerSpec(db: WorkforceDbState): ExportSpec {
  return {
    name: 'minenetr-worker-roster',
    rows: scoped(db.workers, db.selectedMineId),
    cols: [
      ['Worker ID', (r) => r.id],
      ['Name', (r) => r.name],
      ['Contractor', (r) => contractorName(r.contractorId)],
      ['Designation', (r) => r.designation],
      ['Department', (r) => r.department],
      ['Mine', (r) => mineLabel(r.mineId)],
      ['Shift', (r) => r.shift],
      ['Work Zone', (r) => r.workZone],
      ['Supervisor', (r) => r.supervisor],
      ['Joining Date', (r) => r.joiningDate],
      ['Status', (r) => r.status],
    ],
  };
}

function attendanceTrendSpec(db: WorkforceDbState, days: number): ExportSpec {
  return {
    name: 'minenetr-attendance-trend',
    rows: attendanceTrend(db, days, db.selectedMineId),
    cols: [
      ['Date', (r) => r.label],
      ['Present', (r) => r.present],
      ['Absent', (r) => r.absent],
      ['On Leave', (r) => r.leave],
      ['Not Marked', (r) => r.notMarked],
      ['Total Workers', (r) => r.total],
      ['Attendance %', (r) => (r.total ? Math.round((r.present / r.total) * 100) : 0)],
    ],
  };
}

function billsSpec(db: WorkforceDbState): ExportSpec {
  return {
    name: 'minenetr-bill-register',
    rows: scoped(db.bills, db.selectedMineId),
    cols: [
      ['Bill ID', (r) => r.id],
      ['Invoice No', (r) => r.invoiceNumber],
      ['Contract', (r) => r.contractId],
      ['Mine', (r) => mineLabel(r.mineId)],
      ['Work Period', (r) => r.workPeriod],
      ['Bill Date', (r) => r.billDate],
      ['Amount (INR)', (r) => r.amount],
      ['Status', (r) => r.status],
      ['Submitted By', (r) => r.submittedBy],
      ['Description', (r) => r.description],
    ],
  };
}

function paymentsSpec(db: WorkforceDbState): ExportSpec {
  return {
    name: 'minenetr-payment-register',
    rows: db.payments,
    cols: [
      ['Payment ID', (r) => r.id],
      ['Bill ID', (r) => r.billId],
      ['Amount (INR)', (r) => r.amount],
      ['Date', (r) => r.date],
      ['Mode', (r) => r.mode],
      ['Reference', (r) => r.reference],
    ],
  };
}

function documentsSpec(db: WorkforceDbState): ExportSpec {
  return {
    name: 'minenetr-document-register',
    rows: scoped(db.documents, db.selectedMineId),
    cols: [
      ['Document ID', (r) => r.id],
      ['Name', (r) => r.name],
      ['Category', (r) => r.category],
      ['Related To', (r) => `${r.relatedType}: ${r.relatedId}`],
      ['Mine', (r) => mineLabel(r.mineId)],
      ['Issued', (r) => r.issueDate],
      ['Expires', (r) => r.expiryDate],
      ['Status (derived)', (_r) => {
        const d = _r as { expiryDate: string };
        return d.expiryDate < DEMO_TODAY ? 'Expired' : d.expiryDate <= addDays(DEMO_TODAY, 60) ? 'Expiring Soon' : 'Valid';
      }],
      ['Size (KB)', (r) => r.sizeKb],
      ['Uploaded By', (r) => r.uploadedBy],
    ],
  };
}

function incidentsSpec(db: WorkforceDbState): ExportSpec {
  return {
    name: 'minenetr-compliance-incidents',
    rows: scoped(db.incidents, db.selectedMineId),
    cols: [
      ['Incident ID', (r) => r.id],
      ['Category', (r) => r.category],
      ['Severity', (r) => r.severity],
      ['Mine', (r) => mineLabel(r.mineId)],
      ['Detected On', (r) => r.dateDetected],
      ['Status', (r) => r.status],
      ['Inspector', (r) => r.inspector],
      ['Worker ID', (r) => r.workerId ?? '—'],
      ['Description', (r) => r.description],
    ],
  };
}

function trainingSpec(db: WorkforceDbState): ExportSpec {
  const nameByWorker = new Map(db.workers.map((w) => [w.id, w.name]));
  return {
    name: 'minenetr-training-register',
    rows: db.training,
    cols: [
      ['Certificate ID', (r) => r.id],
      ['Worker ID', (r) => r.workerId],
      ['Worker', (r) => nameByWorker.get(r.workerId) ?? r.workerId],
      ['Training Type', (r) => r.type],
      ['Certification No', (r) => r.certificationNumber],
      ['Completed', (r) => r.completionDate],
      ['Expires', (r) => r.expiryDate],
      ['Provider', (r) => r.provider],
      ['Mandatory', (r) => (r.mandatory ? 'Yes' : 'No')],
      ['Verified', (r) => (r.verified ? 'Yes' : 'No')],
      ['Status (derived)', (r) => trainingStatusOf(r)],
    ],
  };
}

function accessSpec(db: WorkforceDbState): ExportSpec {
  return {
    name: 'minenetr-gate-access-log',
    rows: scoped(db.access, db.selectedMineId),
    cols: [
      ['Access ID', (r) => r.id],
      ['Worker ID', (r) => r.workerId],
      ['Mine', (r) => mineLabel(r.mineId)],
      ['Gate', (r) => r.gate],
      ['Direction', (r) => r.direction],
      ['Status', (r) => r.status],
      ['Timestamp', (r) => r.timestamp],
      ['Reason', (r) => r.reason],
    ],
  };
}

function leavesSpec(db: WorkforceDbState): ExportSpec {
  const nameByWorker = new Map(db.workers.map((w) => [w.id, w.name]));
  return {
    name: 'minenetr-leave-register',
    rows: db.leaves,
    cols: [
      ['Leave ID', (r) => r.id],
      ['Worker ID', (r) => r.workerId],
      ['Worker', (r) => nameByWorker.get(r.workerId) ?? r.workerId],
      ['Type', (r) => r.type],
      ['From', (r) => r.from],
      ['To', (r) => r.to],
      ['Applied On', (r) => r.appliedOn],
      ['Status', (r) => r.status],
      ['Reason', (r) => r.reason],
    ],
  };
}

function transfersSpec(db: WorkforceDbState): ExportSpec {
  return {
    name: 'minenetr-transfer-register',
    rows: db.transfers,
    cols: [
      ['Request ID', (r) => r.id],
      ['Worker ID', (r) => r.workerId],
      ['From Mine', (r) => mineLabel(r.fromMineId)],
      ['To Mine', (r) => mineLabel(r.toMineId)],
      ['To Department', (r) => r.toDepartment],
      ['Requested On', (r) => r.requestDate],
      ['Status', (r) => r.status],
      ['Reason', (r) => r.reason],
    ],
  };
}

function contractsSpec(): ExportSpec {
  let rows: any[] = [];
  try {
    const cs = getContractsDb();
    rows = (cs?.contracts ?? []).filter((c) => c.contractorId === cs.contractor.id);
  } catch { rows = []; }
  return {
    name: 'minenetr-contract-register',
    rows,
    cols: [
      ['Contract ID', (r) => r.id],
      ['Contract Name', (r) => r.name],
      ['Work Type', (r) => r.workType],
      ['Work Order No', (r) => r.workOrderNumber],
      ['Mine', (r) => mineLabel(r.mineId)],
      ['Start', (r) => r.startDate],
      ['End', (r) => r.endDate],
      ['Value (INR)', (r) => r.contractValue],
      ['Progress %', (r) => r.progress],
      ['Status', (r) => r.status],
    ],
  };
}

/**
 * Pick the dataset that actually backs a report: the title keywords win over
 * the category so "Training & Certification Register" (a Compliance report)
 * exports the training register, not the incident log.
 */
function specFor(db: WorkforceDbState, r: { title: string; category: string }, days: number): ExportSpec {
  const t = r.title.toLowerCase();
  if (t.includes('transfer')) return transfersSpec(db);
  if (t.includes('leave') || t.includes('gate pass')) return leavesSpec(db);
  if (t.includes('gate') || t.includes('access')) return accessSpec(db);
  if (t.includes('training') || t.includes('certification')) return trainingSpec(db);
  if (t.includes('payment')) return paymentsSpec(db);
  if (t.includes('document') || t.includes('statutory')) return documentsSpec(db);
  if (t.includes('contract')) return contractsSpec();

  switch (r.category) {
    case 'Worker Reports': return workerSpec(db);
    case 'Attendance Reports': return attendanceTrendSpec(db, days);
    case 'Contract Reports': return contractsSpec();
    case 'Financial Reports': return billsSpec(db);
    case 'Compliance Reports': return incidentsSpec(db);
    default: return workerSpec(db);
  }
}

// ---------- Page ----------
export function ContractorReports() {
  const db = useMockWorkforce();
  const router = useRouter();

  const [tab, setTab] = useState('Overview');
  const [period, setPeriod] = useState('Last 30 Days');
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [genOpen, setGenOpen] = useState(false);
  const [genCategory, setGenCategory] = useState(CATEGORY_OPTIONS[0]);
  const [err, setErr] = useState('');

  const days = periodDays(period);
  const kpis = useMemo(() => computeKpis(db), [db]);

  // Active Contracts KPI comes from the contracts repository (separate store).
  const contractStats = useMemo(() => {
    try {
      const cs = getContractsDb();
      const list = cs?.contracts ?? [];
      return {
        active: list.filter((c) => c.status === ContractStatus.Active || c.status === ContractStatus.ExpiringSoon).length,
        expiring: list.filter((c) => c.status === ContractStatus.ExpiringSoon).length,
      };
    } catch { return { active: 0, expiring: 0 }; }
  }, [db.rev]);

  // Real derived delta: average attendance of the last 7 days vs the 7 before.
  const attendanceDelta = useMemo(() => {
    const trend = attendanceTrend(db, 30, db.selectedMineId);
    const avg = (slice: typeof trend) =>
      slice.length ? Math.round(slice.reduce((s, d) => s + (d.total ? (d.present / d.total) * 100 : 0), 0) / slice.length) : 0;
    return avg(trend.slice(-7)) - avg(trend.slice(-14, -7));
  }, [db]);

  const notMarked = Math.max(0, kpis.totalWorkers - kpis.presentToday - kpis.absentToday - kpis.onLeave);
  const minesInScope = new Set(scoped(db.workers, db.selectedMineId).map((w) => w.mineId)).size;

  const deployment = useMemo(() => mines.map((m) => ({
    name: m.code, id: m.id,
    value: db.workers.filter((w) => w.mineId === m.id).length,
  })), [db.workers]);

  const attendanceSlices = [
    { name: 'Present', value: kpis.presentToday, color: CHART.green },
    { name: 'Absent', value: kpis.absentToday, color: CHART.amber },
    { name: 'On Leave', value: kpis.onLeave, color: CHART.red },
    { name: 'Not Marked', value: notMarked, color: CHART.purple },
  ];
  const documentSlices = [
    { name: 'Valid', value: kpis.docsValid, color: CHART.green },
    { name: 'Expiring Soon', value: kpis.docsExpiring, color: CHART.amber },
    { name: 'Expired', value: kpis.docsExpired, color: CHART.red },
  ];

  const needle = appliedQuery.trim().toLowerCase();
  const reportsForTab = useMemo(() => {
    const base = tab === 'Overview' ? db.reports : db.reports.filter((r) => r.category === tab);
    const filtered = needle
      ? base.filter((r) => `${r.id} ${r.title} ${r.category} ${r.period}`.toLowerCase().includes(needle))
      : base;
    return [...filtered].sort((a, b) => (a.generatedOn < b.generatedOn ? 1 : a.generatedOn > b.generatedOn ? -1 : 0));
  }, [db.reports, tab, needle]);

  // ----- real actions -----
  function download(r: ReportRow) {
    try {
      const spec = specFor(db, r, days);
      const n = exportCsv(`${slug(r.title)}-${r.id.toLowerCase()}`, spec.rows, spec.cols);
      toast(`Downloaded ${n} row${n === 1 ? '' : 's'} from "${r.title}".`);
    } catch (e) { setErr(msg(e)); }
  }

  function quickExport(label: string, build: () => ExportSpec) {
    try {
      const spec = build();
      const n = exportCsv(spec.name, spec.rows, spec.cols);
      toast(`Exported ${n} row${n === 1 ? '' : 's'} — ${label}.`);
    } catch (e) { setErr(msg(e)); }
  }

  function regenerate(r: ReportRow) {
    try {
      actions.generateReport({ title: r.title, category: r.category, period: r.period });
    } catch (e) { setErr(msg(e)); }
  }

  function openReport(r: ReportRow) { router.push(hrefFor(r)); }

  function exportRegister() {
    try {
      const n = exportCsv('minenetr-report-register', reportsForTab, [
        ['Report ID', (r: ReportRow) => r.id],
        ['Title', (r: ReportRow) => r.title],
        ['Category', (r: ReportRow) => r.category],
        ['Period', (r: ReportRow) => r.period],
        ['Generated On', (r: ReportRow) => r.generatedOn],
        ['Format', (r: ReportRow) => r.format],
        ['Size (KB)', (r: ReportRow) => r.sizeKb],
        ['Status', (r: ReportRow) => r.status],
      ]);
      toast(`Exported ${n} report record${n === 1 ? '' : 's'}.`);
    } catch (e) { setErr(msg(e)); }
  }

  function pickMine(code: string) {
    try {
      const m = mines.find((x) => x.code === code);
      if (!m) return;
      actions.setSelectedMine(m.id === db.selectedMineId ? 'ALL' : m.id);
    } catch (e) { setErr(msg(e)); }
  }

  function openGenerate(category?: string) {
    setGenCategory(category && CATEGORY_OPTIONS.includes(category) ? category : CATEGORY_OPTIONS[0]);
    setGenOpen(true);
  }

  const reportColumns: Column<ReportRow>[] = [
    { key: 'id', header: 'Report ID', render: (r) => <span className="font-semibold text-navy">{r.id}</span>, sortValue: (r) => r.id },
    { key: 'title', header: 'Title', render: (r) => <span className="font-semibold text-navy">{r.title}</span>, sortValue: (r) => r.title },
    { key: 'category', header: 'Category', render: (r) => <SoftPill v={r.category} cls="bg-indigo-50 text-indigo-700" />, sortValue: (r) => r.category },
    { key: 'period', header: 'Period', render: (r) => r.period, sortValue: (r) => r.period },
    { key: 'generatedOn', header: 'Generated On', render: (r) => fmtDate(r.generatedOn), sortValue: (r) => r.generatedOn },
    { key: 'format', header: 'Format', render: (r) => <SoftPill v={r.format} /> },
    { key: 'size', header: 'Size', render: (r) => fmtSize(r.sizeKb), sortValue: (r) => r.sizeKb },
    { key: 'status', header: 'Status', render: (r) => <Pill v={r.status} />, sortValue: (r) => r.status },
  ];

  const reportActions = (r: ReportRow) => (
    <div className="flex items-center justify-end gap-1.5">
      <PermIconBtn perm="export" label={`Download "${r.title}" as CSV`} onClick={() => download(r)}><Download size={14} /></PermIconBtn>
      <button onClick={() => openReport(r)} title="Open the related page for this report" aria-label={`Open ${r.title}`}
        className="w-7 h-7 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-[13px] text-navy hover:bg-blue-50 hover:border-blue-300">
        <ExternalLink size={14} />
      </button>
      <PermIconBtn perm="report.generate" label={`Re-generate "${r.title}"`} onClick={() => regenerate(r)}><RotateCcw size={14} /></PermIconBtn>
    </div>
  );

  const quickDownloads = [
    { label: 'Worker Roster (CSV)', icon: <Users size={15} />, tileClass: 'bg-blue-100 text-blue-600', onClick: () => quickExport('Worker roster', () => workerSpec(db)) },
    { label: `Attendance Trend (CSV)`, icon: <BarChart3 size={15} />, tileClass: 'bg-emerald-100 text-emerald-600', onClick: () => quickExport('Attendance trend', () => attendanceTrendSpec(db, days)) },
    { label: 'Bill Register (CSV)', icon: <Receipt size={15} />, tileClass: 'bg-amber-100 text-amber-600', onClick: () => quickExport('Bill register', () => billsSpec(db)) },
    { label: 'Document Register (CSV)', icon: <FileCheck size={15} />, tileClass: 'bg-violet-100 text-violet-600', onClick: () => quickExport('Document register', () => documentsSpec(db)) },
    { label: 'Compliance Incidents (CSV)', icon: <ShieldCheck size={15} />, tileClass: 'bg-rose-100 text-rose-600', onClick: () => quickExport('Compliance incidents', () => incidentsSpec(db)) },
    { label: 'Training Register (CSV)', icon: <GraduationCap size={15} />, tileClass: 'bg-cyan-100 text-cyan-600', onClick: () => quickExport('Training register', () => trainingSpec(db)) },
  ];

  return (
    <ContractorShell
      title="Reports"
      sub="View and generate reports related to workers, attendance, contracts, bills and compliance for your assigned mines."
    >
      <PageToolbar
        period={periodLabel(addDays(DEMO_TODAY, -(days - 1)), DEMO_TODAY)}
        onExport={exportRegister}
        exportLabel="Export Reports CSV"
        extra={<PeriodSelect value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />}
      />

      {err && (
        <div role="alert" className="mb-3 flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-[13px] font-semibold rounded-xl px-3 py-2">
          <AlertTriangle size={15} className="shrink-0" />
          <span className="min-w-0 flex-1">{err}</span>
          <button onClick={() => setErr('')} aria-label="Dismiss error" className="text-red-400 hover:text-red-700 font-bold px-1">✕</button>
        </div>
      )}

      {/* KPI cards */}
      <KpiGrid cols="sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={<Users size={22} />} label="Total Workers" value={kpis.totalWorkers}
          context={minesInScope ? `Across ${minesInScope} Mine${minesInScope === 1 ? '' : 's'}` : 'No workers in scope'}
          dotColor="#1463D9" tileClass="bg-blue-50 text-blue-600" />
        <KpiCard icon={<UserCheck size={22} />} label="Avg Attendance" value={`${kpis.avgAttendance}%`}
          trend={attendanceDelta === 0 ? undefined : `${Math.abs(attendanceDelta)} pts`}
          trendTone={attendanceDelta < 0 ? 'down' : 'up'}
          context="Last 7 days vs previous 7" dotColor="#159B72" tileClass="bg-emerald-50 text-emerald-600" />
        <KpiCard icon={<FileText size={22} />} label="Active Contracts" value={contractStats.active}
          context={contractStats.expiring ? `${contractStats.expiring} Expiring Soon` : 'None expiring soon'}
          dotColor="#E8A02B" tileClass="bg-amber-50 text-amber-600" />
        <KpiCard icon={<AlertTriangle size={22} />} label="Compliance Issues" value={kpis.complianceIssues}
          context={kpis.complianceIssues ? 'Require Action' : 'All clear'}
          dotColor={kpis.complianceIssues ? '#DC4C58' : '#159B72'} tileClass="bg-rose-50 text-rose-600" />
      </KpiGrid>

      {/* Tab bar */}
      <div className="card !p-0 mb-4 overflow-hidden">
        <div className="px-2"><Tabs tabs={TABS} active={tab} onChange={setTab} /></div>
      </div>

      {tab === 'Overview' ? (
        <>
          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <SectionCard title="Worker Deployment by Mine"
              action={db.selectedMineId !== 'ALL' ? (
                <button onClick={() => { try { actions.setSelectedMine('ALL'); } catch (e) { setErr(msg(e)); } }}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline">Clear mine scope ✕</button>
              ) : undefined}>
              <VBars data={deployment} height={210} onPick={(d) => pickMine(d.name)} />
              <p className="text-[11px] text-slate-400 mt-2">Click a mine bar to scope every KPI, chart and export on this page — click the same bar again to clear.</p>
            </SectionCard>

            <SectionCard title="Attendance Status">
              <Donut data={attendanceSlices} centerValue={String(kpis.totalWorkers)} centerLabel="Total Workers"
                onPick={() => router.push('/contractor/attendance')} height={210} />
              <p className="text-[11px] text-slate-400 mt-1 text-center">Today ({fmtDate(DEMO_TODAY)}) · click to open Attendance &amp; Access</p>
            </SectionCard>

            <SectionCard title="Document Compliance">
              <Donut data={documentSlices} centerValue={String(kpis.totalDocs)} centerLabel="Total Documents"
                onPick={() => router.push('/contractor/documents?tab=All%20Documents')} height={210} />
              <p className="text-[11px] text-slate-400 mt-1 text-center">Expiry window 60 days · click to open Documents &amp; Compliance</p>
            </SectionCard>
          </div>

          {/* Recent reports + right rail */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-4">
            <div className="xl:col-span-2">
              <SectionCard title="Recent Reports"
                subtitle={`${reportsForTab.length} report${reportsForTab.length === 1 ? '' : 's'} in scope`}
                action={<PermBtn perm="report.generate" onClick={() => openGenerate()} className="btn-primary !py-2 !px-3 !text-[12px]">
                  <span className="flex items-center gap-1.5"><FileText size={14} /> Generate New Report</span>
                </PermBtn>}>
                <DataTable
                  columns={reportColumns}
                  rows={reportsForTab}
                  initialSize={8}
                  actions={reportActions}
                  emptyTitle="No reports found"
                  emptyText={needle ? 'No reports match your search. Clear the search or generate a new report.'
                    : 'Reports generated for your assigned mines will appear here.'}
                />
              </SectionCard>
            </div>

            <div className="space-y-4">
              <SectionCard title="Generate New Report"
                subtitle="Queues a CSV report against the live demo store — it flips to Ready in ~1.2s.">
                <div className="rounded-xl border border-slate-200 p-3 flex items-start gap-2.5">
                  <span className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><FileText size={17} /></span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-bold text-navy">Build a custom report</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Choose a title, category and time period. Requires the report.generate permission.</div>
                  </div>
                </div>
                <PermBtn perm="report.generate" onClick={() => openGenerate()} className="btn-primary w-full mt-3">
                  <span className="flex items-center justify-center gap-1.5"><FileText size={15} /> Generate Report</span>
                </PermBtn>
              </SectionCard>

              <SectionCard title="Quick Downloads"
                subtitle="One-click CSV exports built from the current store records.">
                <QuickActions items={quickDownloads} />
              </SectionCard>
            </div>
          </div>
        </>
      ) : (
        <SectionCard title={tab}
          subtitle={`${reportsForTab.length} report${reportsForTab.length === 1 ? '' : 's'} · ${db.selectedMineId === 'ALL' ? 'all assigned mines' : mineLabel(db.selectedMineId)}`}
          action={<PermBtn perm="report.generate" onClick={() => openGenerate(tab)} className="btn-primary !py-2 !px-3 !text-[12px]">
            <span className="flex items-center gap-1.5"><FileText size={14} /> Generate Report</span>
          </PermBtn>}>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <SearchInput value={query} onChange={setQuery} onSearch={() => setAppliedQuery(query)} ph="Search reports..." width="!w-56" />
            {appliedQuery && (
              <button onClick={() => { setQuery(''); setAppliedQuery(''); }}
                className="text-[12px] font-semibold text-slate-500 hover:text-navy">✕ Clear search</button>
            )}
          </div>
          <DataTable
            columns={reportColumns}
            rows={reportsForTab}
            actions={reportActions}
            emptyTitle={`No ${tab.toLowerCase()}`}
            emptyText={needle ? 'No reports match your search. Clear the search or generate a new report.'
              : 'Generate a report to see it listed here. Every generated row can be downloaded as a real CSV.'}
          />
        </SectionCard>
      )}

      {genOpen && (
        <GenerateReportModal
          defaultCategory={genCategory}
          defaultPeriod={period}
          onClose={() => setGenOpen(false)}
        />
      )}
    </ContractorShell>
  );
}

// ---------- Generate New Report modal ----------
function GenerateReportModal({ defaultCategory, defaultPeriod, onClose }: {
  defaultCategory: string; defaultPeriod: string; onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(defaultCategory);
  const [period, setPeriod] = useState(
    PERIOD_OPTIONS.includes(defaultPeriod) ? defaultPeriod : 'Last 30 Days',
  );
  const [titleErr, setTitleErr] = useState('');
  const [err, setErr] = useState('');

  function submit() {
    if (!title.trim()) { setTitleErr('Report title is required.'); return; }
    setTitleErr('');
    try {
      actions.generateReport({ title: title.trim(), category, period });
      onClose();
    } catch (e) { setErr(msg(e)); }
  }

  return (
    <Modal title="Generate New Report" onClose={onClose}>
      {err && (
        <div role="alert" className="mb-3 flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-[13px] font-semibold rounded-xl px-3 py-2">
          <AlertTriangle size={15} className="shrink-0" /> <span className="min-w-0 flex-1">{err}</span>
        </div>
      )}
      <Field label="Report Title" error={titleErr} hint="e.g. Worker Deployment Summary — Oct 2026">
        <input className="input" value={title} placeholder="Enter a descriptive title"
          onChange={(e) => { setTitle(e.target.value); if (titleErr) setTitleErr(''); }} />
      </Field>
      <Field label="Category">
        <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="Time Period" hint="The period is recorded on the report and shown in the register.">
        <select className="input" value={period} onChange={(e) => setPeriod(e.target.value)}>
          {PERIOD_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          <option value={`As on ${fmtDate(DEMO_TODAY)}`}>As on today (03 Oct 2026)</option>
        </select>
      </Field>
      <p className="text-[11px] text-slate-400 mb-3">
        Demo note: generation is simulated locally — the row shows “Generating” and flips to “Ready” after ~1.2 seconds. Download always exports the live store records.
      </p>
      <div className="flex gap-2 justify-end">
        <button className="btn-primary !bg-white !text-navy border border-slate-300" onClick={onClose}>Cancel</button>
        <PermBtn perm="report.generate" onClick={submit} className="btn-primary">
          <span className="flex items-center gap-1.5"><TrendingUp size={15} /> Generate Report</span>
        </PermBtn>
      </div>
    </Modal>
  );
}
