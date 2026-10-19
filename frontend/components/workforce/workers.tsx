'use client';
/**
 * MineNetr contractor portal — Workers & Manpower (page 3 of the design reference).
 *
 * Every figure derives from the centralized synthetic repository in
 * lib/workforce/store: the KPI tiles, the five tabs, the worker table, the
 * detail drawer and every modal read the same collections, so a deployment
 * change, transfer decision, training renewal, document upload or attendance
 * mark updates every view at once. All records are fictional; the fixed demo
 * clock is 03 Oct 2026 (DEMO_TODAY).
 *
 * Every mutation goes through `actions.*` (validated + audited + toasted by the
 * store) and is wrapped in a runner that surfaces the store's human error
 * message inline — never alert(). Every download generates a real local file.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowRightLeft, CalendarDays, CheckCircle2, ChevronDown, ChevronUp, Download,
  Eye, FileText, GraduationCap, Pencil, Plus, RefreshCw, RotateCcw, Send, ShieldOff, Upload,
  UserCheck, UserX, Users, X, XCircle,
} from 'lucide-react';
import { Tabs } from '../operations/ui';
import { CHART } from '../operations/hooks';
import { ContractorShell } from './shell';
import {
  Avatar, ConfirmDialog, DataTable, DetailDrawer, Donut, EmptyState, Field, HBarRows, Kv, KpiCard,
  Modal, PageToolbar, PermBtn, PermIconBtn, Pill, SectionCard, SearchInput, SoftPill, type Column,
} from './ui';
import { mines } from '../../lib/workforce/seed';
import {
  actions, accessOf, attendanceOf, computeKpis, contractorName, derivedAttendance, filterWorkers,
  indexTraining, mineCode, mineLabel, useMockWorkforce, worstTraining,
  type TrainingWorst, type WorkforceDbState,
} from '../../lib/workforce/store';
import {
  addDays, daysUntil, fmtDate, fmtDateTime, fmtPhone, fmtSize, lastNDates, relTime,
  trainingStatusOf, weekdayShort, workedLabel,
} from '../../lib/workforce/format';
import { certificateText, exportCsv, exportText } from '../../lib/workforce/export';
import {
  AttendanceStatus, DEPARTMENTS, DEMO_TODAY, DESIGNATIONS, DOCUMENT_CATEGORIES,
  EXPIRY_WINDOW_DAYS, SHIFTS, TRAINING_TYPES, TransferStatus, WorkerStatus,
  type CreateWorkerInput, type PortalDocument, type Shift, type TrainingRecord,
  type TransferRequest, type Worker, type WorkerFilters,
} from '../../lib/workforce/types';

// ---------- Constants ----------
const TABS = ['All Workers', 'Deployed by Mine', 'Training Status', 'Expiring Documents', 'Transfer History'];
const DRAWER_TABS = [
  'Overview', 'Deployment', 'Attendance', 'Training & Certifications',
  'Access History', 'Transfers', 'Documents', 'Activity',
];

const TRAINING_WORSTS: TrainingWorst[] = ['Valid', 'Expiring Soon', 'Expired', 'Pending Verification', 'No Training'];
const PROBLEM_WORSTS: TrainingWorst[] = ['Expired', 'Pending Verification', 'Expiring Soon', 'No Training'];
const TRAINING_COLOR: Record<TrainingWorst, string> = {
  Valid: CHART.green, 'Expiring Soon': CHART.amber, Expired: CHART.red,
  'Pending Verification': CHART.slate, 'No Training': CHART.purple,
};

const EMPTY_FILTERS: WorkerFilters = {
  mineId: 'ALL', tab: 'All Workers', contractorId: 'ALL', department: 'ALL',
  status: 'ALL', trainingStatus: 'ALL', attendance: 'ALL', accessStatus: 'ALL',
};

const DOC_STATUSES = ['ALL', 'Expired', 'Expiring Soon'] as const;

/** Derived document status — never stored. */
function docStatus(d: PortalDocument): 'Expired' | 'Expiring Soon' {
  return d.expiryDate < DEMO_TODAY ? 'Expired' : 'Expiring Soon';
}

/** Human label for whatever a document is attached to. */
function relatedLabel(db: WorkforceDbState, d: PortalDocument): string {
  if (d.relatedType === 'worker') {
    const w = db.workers.find((x) => x.id === d.relatedId);
    return w ? `${w.name} (${w.id})` : d.relatedId;
  }
  if (d.relatedType === 'equipment') return d.relatedId;
  return `${contractorName(d.relatedId)} (${d.relatedId})`;
}

// ---------- Action runner (store errors surface inline, never alert()) ----------
type Run = <T>(fn: () => T, ok?: (v: T) => string) => T | undefined;

function useActionRunner(): { err: string; notice: string; run: Run; clear: () => void } {
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');
  const run: Run = (fn, ok) => {
    try {
      const v = fn();
      setErr('');
      const m = ok ? ok(v) : '';
      if (m) setNotice(m);
      return v;
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      return undefined;
    }
  };
  return { err, notice, run, clear: () => { setErr(''); setNotice(''); } };
}

function ErrBar({ msg, onClose }: { msg: string; onClose: () => void }) {
  if (!msg) return null;
  return (
    <div role="alert" className="mb-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] font-semibold text-red-600">
      <AlertTriangle size={15} className="mt-px shrink-0" />
      <span className="flex-1">{msg}</span>
      <button onClick={onClose} aria-label="Dismiss error" className="text-red-400 hover:text-red-700 font-bold">X</button>
    </div>
  );
}

function OkBar({ msg, onClose }: { msg: string; onClose: () => void }) {
  if (!msg) return null;
  return (
    <div role="status" className="mb-3 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[12px] font-semibold text-emerald-700">
      <CheckCircle2 size={15} className="mt-px shrink-0" />
      <span className="flex-1">{msg}</span>
      <button onClick={onClose} aria-label="Dismiss confirmation" className="text-emerald-400 hover:text-emerald-700 font-bold">X</button>
    </div>
  );
}

// ---------- Small building blocks ----------
function KpiLink({ onClick, active, children }: { onClick: () => void; active: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={active} title="Click to open the related view"
      className={`w-full text-left rounded-2xl transition ${active ? 'ring-2 ring-blue-400' : 'hover:ring-1 hover:ring-blue-200'}`}>
      {children}
    </button>
  );
}

function Sel({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { id: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">{label}</span>
      <select className="input !w-auto !py-2 !text-[12px] font-semibold" value={value} aria-label={label}
        onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </label>
  );
}

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="badge bg-blue-50 text-blue-700 border border-blue-100 pl-2.5 pr-1.5 py-1">
      {label}
      <button onClick={onClear} aria-label={`Remove ${label}`} className="ml-1 text-blue-400 hover:text-blue-700 font-bold">X</button>
    </span>
  );
}

/** A "records" chip button used to expand/collapse per-worker panels. */
function ExpandBtn({ open, onClick, label }: { open: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} aria-expanded={open}
      className="btn-primary !bg-white !text-navy border border-slate-300 !py-1.5 !px-2.5 !text-[12px] flex items-center gap-1 ml-auto">
      {label} {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
    </button>
  );
}

function downloadCert(db: WorkforceDbState, w: Worker, r: TrainingRecord) {
  exportText(`${r.certificationNumber}-${w.id}.txt`, certificateText({
    workerName: w.name, workerId: w.id, contractor: contractorName(w.contractorId),
    trainingType: r.type, completionDate: r.completionDate, expiryDate: r.expiryDate,
    certificateNumber: r.certificationNumber, provider: r.provider,
  }));
}

// ---------- Page ----------
export function WorkersManpowerPage() {
  const db = useMockWorkforce();
  const rev = db.rev;
  const kpis = useMemo(() => computeKpis(db), [db, rev]);
  const trainIdx = useMemo(() => indexTraining(db), [db, rev]);
  const scope = useMemo(
    () => db.workers.filter((w) => db.selectedMineId === 'ALL' || w.mineId === db.selectedMineId),
    [db, rev, db.selectedMineId],
  );

  const [tab, setTab] = useState('All Workers');
  const [q, setQ] = useState('');
  const [appliedQ, setAppliedQ] = useState('');
  const [filters, setFilters] = useState<WorkerFilters>(EMPTY_FILTERS);
  const [quick, setQuick] = useState<'blocked' | null>(null);
  const [kpiActive, setKpiActive] = useState<string | null>(null);
  const [tableRev, setTableRev] = useState(0);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [transferWorkerId, setTransferWorkerId] = useState<string | null>(null);
  const [pageOk, setPageOk] = useState('');

  // Deep links from the Dashboard / Notifications / store-generated notifications:
  //   /contractor/workers?tab=Transfer%20History  ·  ?tab=Training%20Status
  //   /contractor/workers?tab=All%20Workers       ·  ?new=1 (open Add Worker)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('tab');
    if (raw && TABS.includes(raw)) gotoTab(raw);
    if (params.get('new') === '1') setAddOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => {
    const base = filterWorkers(db, db.workers, { ...filters, tab }, appliedQ);
    return quick === 'blocked' ? base.filter((w) => w.status !== WorkerStatus.Active) : base;
  }, [db, rev, filters, tab, appliedQ, quick]);

  const editWorker = editId ? db.workers.find((w) => w.id === editId) ?? null : null;

  function gotoTab(t: string) { setTab(t); setTableRev((r) => r + 1); }

  function updateFilters(patch: Partial<WorkerFilters>) {
    setFilters((f) => ({ ...f, ...patch }));
    setKpiActive(null);
    setTableRev((r) => r + 1);
  }

  function resetAll() {
    setFilters({ ...EMPTY_FILTERS });
    setQ(''); setAppliedQ(''); setQuick(null); setKpiActive(null);
    setTableRev((r) => r + 1);
  }

  function applySearch() { setAppliedQ(q.trim()); setTableRev((r) => r + 1); }
  function clearSearch() { setQ(''); setAppliedQ(''); setTableRev((r) => r + 1); }

  function pickMine(id: string) {
    setFilters((f) => ({ ...f, mineId: id }));
    setQuick(null); setKpiActive(null);
    setTab('All Workers'); setTableRev((r) => r + 1);
  }

  function pickContractor(id: string) {
    setFilters((f) => ({ ...f, contractorId: id }));
    setQuick(null); setKpiActive(null);
    setTab('All Workers'); setTableRev((r) => r + 1);
  }

  function pickWorst(s: string) {
    setFilters((f) => ({ ...f, trainingStatus: s }));
    setQuick(null); setKpiActive(null);
    setTab('All Workers'); setTableRev((r) => r + 1);
  }

  function kpiClick(kind: 'total' | 'active' | 'leave' | 'training' | 'blocked') {
    setQ(''); setAppliedQ(''); setQuick(null); setKpiActive(kind);
    if (kind === 'total') { setFilters({ ...EMPTY_FILTERS, mineId: filters.mineId }); gotoTab('All Workers'); }
    else if (kind === 'active') { setFilters({ ...EMPTY_FILTERS, status: WorkerStatus.Active }); gotoTab('All Workers'); }
    else if (kind === 'leave') { setFilters({ ...EMPTY_FILTERS, attendance: AttendanceStatus.OnLeave }); gotoTab('All Workers'); }
    else if (kind === 'training') { setFilters({ ...EMPTY_FILTERS, mineId: filters.mineId }); gotoTab('Training Status'); }
    else { setFilters({ ...EMPTY_FILTERS }); setQuick('blocked'); gotoTab('All Workers'); }
  }

  // Real CSV export of the rows currently visible (filters + search applied).
  function exportWorkers() {
    const n = exportCsv(`minenetr-workers-${DEMO_TODAY}`, rows, [
      ['Worker ID', (w: Worker) => w.id],
      ['Worker Name', (w: Worker) => w.name],
      ['Contractor', (w: Worker) => contractorName(w.contractorId)],
      ['Department', (w: Worker) => w.department],
      ['Designation', (w: Worker) => w.designation],
      ['Assigned Mine', (w: Worker) => mineLabel(w.mineId)],
      ['Shift', (w: Worker) => w.shift],
      ['Work Zone', (w: Worker) => w.workZone],
      ['Worker Status', (w: Worker) => w.status],
      ['Training Status', (w: Worker) => worstTraining(trainIdx.get(w.id))],
      ['Attendance Today', (w: Worker) => attendanceOf(db, w.id)?.status ?? AttendanceStatus.NotMarked],
      ['Access Status', (w: Worker) => accessOf(db, w.id)?.status ?? 'No Record'],
      ['Contact', (w: Worker) => fmtPhone(w.contact)],
      ['Emergency Contact', (w: Worker) => fmtPhone(w.emergencyContact)],
      ['Joining Date', (w: Worker) => w.joiningDate],
    ]);
    setPageOk(`Exported ${n} worker row${n === 1 ? '' : 's'} to CSV (currently filtered view).`);
  }

  const activeChips: { label: string; clear: () => void }[] = [];
  if (appliedQ) activeChips.push({ label: `Search: ${appliedQ}`, clear: clearSearch });
  if (quick === 'blocked') activeChips.push({ label: 'Blocked / Inactive only', clear: () => { setQuick(null); setKpiActive(null); setTableRev((r) => r + 1); } });
  if (filters.mineId !== 'ALL') activeChips.push({ label: `Mine: ${mineCode(filters.mineId)}`, clear: () => updateFilters({ mineId: 'ALL' }) });
  if (filters.contractorId !== 'ALL') activeChips.push({ label: `Contractor: ${contractorName(filters.contractorId)}`, clear: () => updateFilters({ contractorId: 'ALL' }) });
  if (filters.department !== 'ALL') activeChips.push({ label: `Dept: ${filters.department}`, clear: () => updateFilters({ department: 'ALL' }) });
  if (filters.status !== 'ALL') activeChips.push({ label: `Status: ${filters.status}`, clear: () => updateFilters({ status: 'ALL' }) });
  if (filters.trainingStatus !== 'ALL') activeChips.push({ label: `Training: ${filters.trainingStatus}`, clear: () => updateFilters({ trainingStatus: 'ALL' }) });
  if (filters.attendance !== 'ALL') activeChips.push({ label: `Attendance: ${filters.attendance}`, clear: () => updateFilters({ attendance: 'ALL' }) });
  if (filters.accessStatus !== 'ALL') activeChips.push({ label: `Access: ${filters.accessStatus}`, clear: () => updateFilters({ accessStatus: 'ALL' }) });

  return (
    <ContractorShell title="Workers & Manpower"
      sub="Manage your workforce, view deployment across mines, transfer workers and track training & compliance status.">

      <PageToolbar
        period={fmtDate(DEMO_TODAY)}
        exportLabel="Export Workers (CSV)"
        onExport={exportWorkers}
        extra={
          <PermBtn perm="worker.create" onClick={() => setAddOpen(true)} className="btn-primary !py-1.5 !px-3 !text-[12px]">
            <span className="flex items-center gap-1.5"><Plus size={14} /> Add New Worker</span>
          </PermBtn>
        }
      />

      {pageOk && <OkBar msg={pageOk} onClose={() => setPageOk('')} />}

      {/* KPI row — each card jumps to the matching tab / filter */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 mb-4">
        <KpiLink active={kpiActive === 'total'} onClick={() => kpiClick('total')}>
          <KpiCard icon={<Users size={22} />} label="Total Workers" value={kpis.totalWorkers}
            context={db.selectedMineId === 'ALL' ? `Across ${mines.length} Mines` : `Mine ${mineCode(db.selectedMineId)}`}
            dotColor={CHART.blue} tileClass="bg-blue-50 text-blue-600" />
        </KpiLink>
        <KpiLink active={kpiActive === 'active'} onClick={() => kpiClick('active')}>
          <KpiCard icon={<UserCheck size={22} />} label="Active Workers" value={kpis.activeWorkers}
            context="Currently Deployed" dotColor={CHART.green} tileClass="bg-emerald-50 text-emerald-600" />
        </KpiLink>
        <KpiLink active={kpiActive === 'leave'} onClick={() => kpiClick('leave')}>
          <KpiCard icon={<CalendarDays size={22} />} label="On Leave" value={kpis.onLeave}
            context="Temporary Leave" dotColor={CHART.amber} tileClass="bg-amber-50 text-amber-600" />
        </KpiLink>
        <KpiLink active={kpiActive === 'training'} onClick={() => kpiClick('training')}>
          <KpiCard icon={<GraduationCap size={22} />} label="Training Expiring Soon" value={kpis.trainingExpiring}
            context={`Within ${EXPIRY_WINDOW_DAYS} Days`} dotColor={CHART.red} tileClass="bg-rose-50 text-rose-600" />
        </KpiLink>
        <KpiLink active={kpiActive === 'blocked'} onClick={() => kpiClick('blocked')}>
          <KpiCard icon={<ShieldOff size={22} />} label="Blocked / Inactive" value={kpis.blockedOrInactive}
            context="Not Eligible" dotColor={CHART.purple} tileClass="bg-violet-50 text-violet-600" />
        </KpiLink>
      </div>

      {/* Tabs */}
      <div className="card !p-0 overflow-hidden">
        <div className="px-2"><Tabs tabs={TABS} active={tab} onChange={gotoTab} /></div>
        <div className="p-4">
          {tab === 'All Workers' && (
            <AllWorkersTab
              db={db} trainIdx={trainIdx} rows={rows} filters={filters} updateFilters={updateFilters}
              tableRev={tableRev} q={q} setQ={setQ} applySearch={applySearch} clearSearch={clearSearch}
              appliedQ={appliedQ} quick={quick} resetAll={resetAll} activeChips={activeChips}
              onOpen={setDrawerId} onEdit={setEditId} onTransfer={setTransferWorkerId}
            />
          )}
          {tab === 'Deployed by Mine' && (
            <DeployedByMineTab db={db} trainIdx={trainIdx} onPickMine={pickMine} onPickContractor={pickContractor} />
          )}
          {tab === 'Training Status' && (
            <TrainingStatusTab db={db} trainIdx={trainIdx} scope={scope} onPickWorst={pickWorst} onOpenWorker={setDrawerId} />
          )}
          {tab === 'Expiring Documents' && <ExpiringDocsTab db={db} />}
          {tab === 'Transfer History' && <TransfersTab db={db} />}
        </div>
      </div>

      {/* Overlays */}
      {addOpen && <AddWorkerModal db={db} onClose={() => setAddOpen(false)} />}
      {editWorker && <EditWorkerModal db={db} worker={editWorker} onClose={() => setEditId(null)} />}
      {transferWorkerId && (
        <TransferModal db={db} initialWorkerId={transferWorkerId} onClose={() => setTransferWorkerId(null)} />
      )}
      {drawerId && (
        <WorkerDrawer workerId={drawerId} onClose={() => setDrawerId(null)}
          onEdit={(w) => setEditId(w.id)} onTransfer={(id) => setTransferWorkerId(id)} />
      )}
    </ContractorShell>
  );
}

// ---------- Tab: All Workers ----------
function AllWorkersTab({
  db, trainIdx, rows, filters, updateFilters, tableRev, q, setQ, applySearch, clearSearch,
  appliedQ, quick, resetAll, activeChips, onOpen, onEdit, onTransfer,
}: {
  db: WorkforceDbState; trainIdx: Map<string, TrainingRecord[]>; rows: Worker[];
  filters: WorkerFilters; updateFilters: (patch: Partial<WorkerFilters>) => void; tableRev: number;
  q: string; setQ: (v: string) => void; applySearch: () => void; clearSearch: () => void;
  appliedQ: string; quick: 'blocked' | null; resetAll: () => void;
  activeChips: { label: string; clear: () => void }[];
  onOpen: (id: string) => void; onEdit: (id: string) => void; onTransfer: (id: string) => void;
}) {
  const opt = (vals: readonly string[]) => vals.map((v) => ({ id: v, label: v }));

  const columns: Column<Worker>[] = [
    {
      key: 'id', header: 'Worker ID', sortValue: (w) => w.id,
      render: (w) => (
        <div className="flex flex-col gap-1 items-start">
          <span className="font-mono text-[12px] font-bold text-navy">{w.id}</span>
          <Pill v={w.status} />
        </div>
      ),
    },
    {
      key: 'name', header: 'Worker Name', sortValue: (w) => w.name,
      render: (w) => (
        <div className="flex items-center gap-2 min-w-[180px]">
          <Avatar name={w.name} id={w.id} />
          <div className="min-w-0">
            <div className="font-bold text-navy truncate">{w.name}</div>
            <div className="text-[11px] text-slate-400">{fmtPhone(w.contact)} · Shift {w.shift}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'contractor', header: 'Contractor', sortValue: (w) => contractorName(w.contractorId),
      render: (w) => (
        <span className="text-[12px] block max-w-[180px] truncate" title={contractorName(w.contractorId)}>
          {contractorName(w.contractorId)}
        </span>
      ),
    },
    {
      key: 'dept', header: 'Department / Designation', sortValue: (w) => `${w.department} ${w.designation}`,
      render: (w) => (
        <div className="min-w-[150px]">
          <div className="font-semibold text-[12px] text-navy">{w.department}</div>
          <div className="text-[11px] text-slate-400">{w.designation}</div>
        </div>
      ),
    },
    {
      key: 'mine', header: 'Assigned Mine', sortValue: (w) => mineCode(w.mineId),
      render: (w) => <span className="badge bg-slate-100 text-slate-600" title={mineLabel(w.mineId)}>{mineCode(w.mineId)}</span>,
    },
    {
      key: 'attendance', header: 'Attendance (Today)', sortValue: (w) => attendanceOf(db, w.id)?.status ?? AttendanceStatus.NotMarked,
      render: (w) => {
        const a = attendanceOf(db, w.id);
        return (
          <div className="flex flex-col gap-1 items-start">
            <Pill v={a?.status ?? AttendanceStatus.NotMarked} />
            <span className="text-[10px] text-slate-400">
              {a && a.inTime !== '—' ? `In ${a.inTime} · ${a.method}` : 'No gate entry'}
            </span>
          </div>
        );
      },
    },
    {
      key: 'training', header: 'Training Status', sortValue: (w) => worstTraining(trainIdx.get(w.id)),
      render: (w) => <Pill v={worstTraining(trainIdx.get(w.id))} />,
    },
    {
      key: 'access', header: 'Access Status', sortValue: (w) => accessOf(db, w.id)?.status ?? 'No Record',
      render: (w) => {
        const a = accessOf(db, w.id);
        return a
          ? <span title={`${a.gate} · ${a.reason}`}><Pill v={a.status} /></span>
          : <SoftPill v="No Record" />;
      },
    },
  ];

  return (
    <div>
      {/* Search + filters */}
      <div className="flex flex-wrap items-end gap-2 mb-3">
        <div className="block">
          <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Search</span>
          <SearchInput value={q} onChange={setQ} onSearch={applySearch} ph="Search by name, ID, contractor, skill..." width="!w-72" />
        </div>
        <Sel label="Mine" value={filters.mineId} onChange={(v) => updateFilters({ mineId: v })}
          options={[{ id: 'ALL', label: 'All Mines' }, ...mines.map((m) => ({ id: m.id, label: `${m.name} (${m.code})` }))]} />
        <Sel label="Contractor" value={filters.contractorId} onChange={(v) => updateFilters({ contractorId: v })}
          options={[{ id: 'ALL', label: 'All Contractors' }, ...db.contractors.map((c) => ({ id: c.id, label: c.name }))]} />
        <Sel label="Department" value={filters.department} onChange={(v) => updateFilters({ department: v })}
          options={[{ id: 'ALL', label: 'All Departments' }, ...opt(DEPARTMENTS)]} />
        <Sel label="Worker Status" value={filters.status} onChange={(v) => updateFilters({ status: v })}
          options={[{ id: 'ALL', label: 'All Statuses' }, ...opt(Object.values(WorkerStatus))]} />
        <Sel label="Training Status" value={filters.trainingStatus} onChange={(v) => updateFilters({ trainingStatus: v })}
          options={[{ id: 'ALL', label: 'All Training' }, ...opt(TRAINING_WORSTS)]} />
        <Sel label="Attendance" value={filters.attendance} onChange={(v) => updateFilters({ attendance: v })}
          options={[{ id: 'ALL', label: 'All Attendance' }, ...opt(Object.values(AttendanceStatus))]} />
        <Sel label="Access Status" value={filters.accessStatus} onChange={(v) => updateFilters({ accessStatus: v })}
          options={[{ id: 'ALL', label: 'All Access' }, ...opt(Object.values(['Allowed', 'Denied', 'Blocked', 'Revoked'])), { id: 'No Record', label: 'No Record Today' }]} />
        <button onClick={resetAll}
          className="btn-primary !bg-white !text-navy border border-slate-300 !py-2 !px-3 !text-[12px] flex items-center gap-1.5">
          <RefreshCw size={13} /> Reset Filters
        </button>
      </div>

      {/* Active filter chips */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {activeChips.map((c) => <Chip key={c.label} label={c.label} onClear={c.clear} />)}
        </div>
      )}

      {/* Worker table */}
      <DataTable
        key={tableRev} /* remount on filter/search change → pagination + sort reset */
        columns={columns}
        rows={rows}
        onRowClick={(w) => onOpen(w.id)}
        emptyTitle={appliedQ || quick || activeChips.length ? 'No workers match the current filters' : 'No workers in scope'}
        emptyText={appliedQ || quick || activeChips.length
          ? 'Try clearing the search box, the quick view or one of the filter dropdowns above.'
          : 'Workers registered against your company for the selected mine scope will appear here.'}
        actions={(w) => (
          <div className="flex items-center gap-1.5 justify-end">
            <button onClick={() => onOpen(w.id)} title={`View ${w.name}`} aria-label={`View ${w.id}`}
              className="w-7 h-7 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-300 text-navy flex items-center justify-center">
              <Eye size={14} />
            </button>
            <PermIconBtn perm="worker.update" label={`Edit ${w.id}`} onClick={() => onEdit(w.id)}>
              <Pencil size={13} />
            </PermIconBtn>
            <PermIconBtn perm="worker.transfer.request" label={`Raise transfer for ${w.id}`} onClick={() => onTransfer(w.id)}>
              <ArrowRightLeft size={13} />
            </PermIconBtn>
          </div>
        )}
      />
      <p className="text-[11px] text-slate-400 mt-2">
        Click a row to open the worker panel (deployment, attendance, training, access history, transfers and documents).
        KPI tiles and chart segments above jump here with the matching filter applied.
      </p>
    </div>
  );
}
// ---------- Tab: Deployed by Mine ----------
interface MineRow { id: string; name: string; code: string; total: number; active: number; present: number; leave: number; issues: number; contractorsN: number }

function DeployedByMineTab({ db, trainIdx, onPickMine, onPickContractor }: {
  db: WorkforceDbState; trainIdx: Map<string, TrainingRecord[]>;
  onPickMine: (id: string) => void; onPickContractor: (id: string) => void;
}) {
  const rows: MineRow[] = useMemo(() => mines.map((m) => {
    const ws = db.workers.filter((w) => w.mineId === m.id);
    let active = 0, present = 0, leave = 0, issues = 0;
    for (const w of ws) {
      if (w.status === WorkerStatus.Active) active++;
      const a = attendanceOf(db, w.id)?.status;
      if (a === AttendanceStatus.Present) present++;
      if (a === AttendanceStatus.OnLeave) leave++;
      const t = worstTraining(trainIdx.get(w.id));
      if (t === 'Expired' || t === 'Pending Verification' || t === 'No Training') issues++;
    }
    return {
      id: m.id, name: m.name, code: m.code, total: ws.length, active, present, leave, issues,
      contractorsN: new Set(ws.map((w) => w.contractorId)).size,
    };
  }), [db, db.rev, trainIdx]);

  const byContractor = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of db.workers) m.set(w.contractorId, (m.get(w.contractorId) ?? 0) + 1);
    return [...m.entries()]
      .map(([id, value]) => ({ id, name: contractorName(id), value }))
      .sort((a, b) => b.value - a.value);
  }, [db, db.rev]);

  const total = rows.reduce((s, r) => s + r.total, 0);
  const donut = rows.map((r, i) => ({
    name: `${r.name} (${r.code})`, value: r.total,
    color: [CHART.blue, CHART.green, CHART.amber][i] ?? CHART.cyan,
  }));

  const mineColumns: Column<MineRow>[] = [
    {
      key: 'mine', header: 'Mine', sortValue: (r) => r.name,
      render: (r) => (
        <div>
          <div className="font-bold text-navy">{r.name}</div>
          <div className="text-[11px] font-mono text-slate-400">{r.code}</div>
        </div>
      ),
    },
    {
      key: 'workers', header: 'Workers', sortValue: (r) => r.total,
      render: (r) => (
        <div className="min-w-[110px]">
          <span className="font-extrabold text-navy">{r.total}</span>
          <span className="text-[11px] text-slate-400 ml-1">({total ? Math.round((r.total / total) * 100) : 0}%)</span>
        </div>
      ),
    },
    { key: 'active', header: 'Active', sortValue: (r) => r.active, render: (r) => <span className="font-bold text-emerald-600">{r.active}</span> },
    { key: 'present', header: 'Present Today', sortValue: (r) => r.present, render: (r) => <span className="font-bold text-navy">{r.present}</span> },
    { key: 'leave', header: 'On Leave', sortValue: (r) => r.leave, render: (r) => <span className="font-bold text-sky-600">{r.leave}</span> },
    { key: 'issues', header: 'Training Issues', sortValue: (r) => r.issues, render: (r) => <span className={`font-bold ${r.issues ? 'text-red-500' : 'text-slate-400'}`}>{r.issues}</span> },
    { key: 'contractors', header: 'Contractors', sortValue: (r) => r.contractorsN, render: (r) => <span className="font-bold text-navy">{r.contractorsN}</span> },
  ];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <div className="space-y-4">
        <SectionCard title="Deployment by Mine" subtitle="Click a slice to filter the worker table">
          {total === 0 ? (
            <EmptyState title="No deployment data" sub="No workers are registered in the current dataset." />
          ) : (
            <Donut data={donut} centerValue={total.toLocaleString('en-IN')} centerLabel="Workers Deployed" height={200}
              onPick={(s) => { const r = rows.find((x) => `${x.name} (${x.code})` === s.name); if (r) onPickMine(r.id); }} />
          )}
          <p className="text-[11px] text-slate-400 text-center mt-1">Counts read the same worker records as the table.</p>
        </SectionCard>
        <SectionCard title="Manpower by Contractor" subtitle="Click a bar to filter by contractor">
          <HBarRows data={byContractor.map((c) => ({ name: c.name, value: c.value }))}
            onPick={(d) => { const c = byContractor.find((x) => x.name === d.name); if (c) onPickContractor(c.id); }} />
        </SectionCard>
      </div>
      <SectionCard title="Per-mine breakdown" subtitle="Live headcount, attendance and compliance per assigned mine" className="xl:col-span-2">
        <DataTable columns={mineColumns} rows={rows} initialSize={5} pageSizeOptions={[3, 5, 10]}
          onRowClick={(r) => onPickMine(r.id)}
          emptyTitle="No mines in scope" emptyText="No mines are configured for this demo dataset." />
        <p className="text-[11px] text-slate-400 mt-2">
          Click a mine row to jump to All Workers with the mine filter applied. Training issues count workers whose
          certifications are Expired, Pending Verification or missing entirely.
        </p>
      </SectionCard>
    </div>
  );
}

// ---------- Tab: Training Status ----------
function TrainingStatusTab({ db, trainIdx, scope, onPickWorst, onOpenWorker }: {
  db: WorkforceDbState; trainIdx: Map<string, TrainingRecord[]>; scope: Worker[];
  onPickWorst: (s: string) => void; onOpenWorker: (id: string) => void;
}) {
  const { err, notice, run, clear } = useActionRunner();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addFor, setAddFor] = useState<string | null>(null);

  const buckets = TRAINING_WORSTS.map((s) => ({
    name: s, value: scope.filter((w) => worstTraining(trainIdx.get(w.id)) === s).length, color: TRAINING_COLOR[s],
  }));
  const total = scope.length;
  const problemWorkers = scope.filter((w) => PROBLEM_WORSTS.includes(worstTraining(trainIdx.get(w.id))));
  const expanded = expandedId ? db.workers.find((w) => w.id === expandedId) ?? null : null;
  const expandedRecs = expanded ? trainIdx.get(expanded.id) ?? [] : [];

  const columns: Column<Worker>[] = [
    {
      key: 'name', header: 'Worker', sortValue: (w) => w.name,
      render: (w) => (
        <div className="flex items-center gap-2 min-w-[170px]">
          <Avatar name={w.name} id={w.id} />
          <div className="min-w-0">
            <div className="font-bold text-navy truncate">{w.name}</div>
            <div className="text-[11px] font-mono text-slate-400">{w.id}</div>
          </div>
        </div>
      ),
    },
    { key: 'mine', header: 'Mine', sortValue: (w) => mineCode(w.mineId), render: (w) => <span className="badge bg-slate-100 text-slate-600">{mineCode(w.mineId)}</span> },
    { key: 'dept', header: 'Department', sortValue: (w) => w.department, render: (w) => <span className="text-[12px]">{w.department}</span> },
    {
      key: 'records', header: 'Records', sortValue: (w) => (trainIdx.get(w.id) ?? []).length,
      render: (w) => <span className="text-[12px] font-semibold text-navy">{(trainIdx.get(w.id) ?? []).length}</span>,
    },
    { key: 'worst', header: 'Worst Status', sortValue: (w) => worstTraining(trainIdx.get(w.id)), render: (w) => <Pill v={worstTraining(trainIdx.get(w.id))} /> },
  ];

  return (
    <div>
      {err && <ErrBar msg={err} onClose={clear} />}
      {notice && <OkBar msg={notice} onClose={clear} />}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        <SectionCard title="Training health" subtitle="Workers grouped by worst certification status"
          className="xl:col-span-1">
          {total === 0 ? (
            <EmptyState title="No workers in scope" sub="No workers match the selected mine scope." />
          ) : (
            <>
              <Donut data={buckets} centerValue={total.toLocaleString('en-IN')} centerLabel="Workers" height={190}
                onPick={(s) => onPickWorst(s.name)} />
              <p className="text-[11px] text-slate-400 text-center mt-1">Click a segment to open All Workers filtered by that status.</p>
            </>
          )}
        </SectionCard>
        <SectionCard title="Workers needing attention"
          subtitle="Expired, expiring, pending-verification or missing mandatory training"
          className="xl:col-span-2"
          action={<span className="badge bg-rose-50 text-rose-600">{problemWorkers.length} workers</span>}>
          <DataTable columns={columns} rows={problemWorkers}
            emptyTitle="All training compliant" emptyText="Every in-scope worker holds valid, verified certifications."
            onRowClick={(w) => onOpenWorker(w.id)}
            actions={(w) => (
              <div className="flex items-center gap-1.5 justify-end">
                <button onClick={() => onOpenWorker(w.id)} title={`Open ${w.name}`} aria-label={`Open ${w.id}`}
                  className="w-7 h-7 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-300 text-navy flex items-center justify-center">
                  <Eye size={14} />
                </button>
                <ExpandBtn open={expandedId === w.id} label="Records"
                  onClick={() => setExpandedId(expandedId === w.id ? null : w.id)} />
              </div>
            )} />
        </SectionCard>
      </div>

      {/* Per-worker certification records */}
      {expanded && (
        <SectionCard title={`Certification records — ${expanded.name}`}
          subtitle={`${expanded.id} · ${contractorName(expanded.contractorId)} · ${mineLabel(expanded.mineId)}`}
          action={
            <div className="flex items-center gap-2">
              <PermBtn perm="training.create" onClick={() => setAddFor(expanded.id)} className="btn-primary !py-1.5 !px-3 !text-[12px]">
                <span className="flex items-center gap-1.5"><Plus size={13} /> Add Training</span>
              </PermBtn>
              <button onClick={() => setExpandedId(null)} className="text-[12px] font-bold text-slate-500 hover:text-navy">Close</button>
            </div>
          }>
          {expandedRecs.length === 0 ? (
            <EmptyState title="No training records"
              sub="This worker holds no certification records. Add the mandatory Mine Safety Induction to make the worker deployable." />
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="dense w-full min-w-[860px]">
                <thead>
                  <tr>
                    <th>Training Type</th><th>Certification No.</th><th>Completed</th><th>Expires</th>
                    <th>Status</th><th>Verified</th><th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expandedRecs.map((r) => {
                    const st = trainingStatusOf(r);
                    const d = daysUntil(r.expiryDate);
                    return (
                      <tr key={r.id}>
                        <td>
                          <div className="font-bold text-navy">{r.type}</div>
                          <div className="text-[11px] text-slate-400">{r.provider}{r.mandatory ? ' · Mandatory' : ' · Optional'}</div>
                        </td>
                        <td className="font-mono text-[12px]">{r.certificationNumber}</td>
                        <td>{fmtDate(r.completionDate)}</td>
                        <td>
                          <div>{fmtDate(r.expiryDate)}</div>
                          <div className={`text-[11px] font-semibold ${d !== null && d < 0 ? 'text-red-500' : d !== null && d <= EXPIRY_WINDOW_DAYS ? 'text-amber-600' : 'text-slate-400'}`}>
                            {d === null ? 'past' : d < 0 ? `${Math.abs(d)} days ago` : `${d} days left`}
                          </div>
                        </td>
                        <td><Pill v={st} /></td>
                        <td>{r.verified
                          ? <span className="badge bg-emerald-50 text-emerald-700">Verified</span>
                          : <span className="badge bg-slate-100 text-slate-500">Not verified</span>}</td>
                        <td>
                          <div className="flex items-center gap-1.5 justify-end">
                            <PermBtn perm="training.verify" disabled={st === 'Expired'}
                              title={st === 'Expired' ? 'Expired certifications cannot be verified — renew the training first.' : `Mark ${r.id} as verified`}
                              onClick={() => run(() => actions.verifyTraining(r.id), () => `Training ${r.id} (${r.type}) verified for ${expanded.name}.`)}
                              className="btn-primary !bg-white !text-emerald-700 border border-emerald-200 !py-1 !px-2.5 !text-[11px]">
                              Verify
                            </PermBtn>
                            <PermBtn perm="training.update"
                              title={`Renew ${r.type} — resets completion to ${fmtDate(DEMO_TODAY)} with a fresh 2-year validity`}
                              onClick={() => run(() => actions.renewTraining(r.id), () => `Training ${r.id} (${r.type}) renewed for ${expanded.name} — valid until ${fmtDate(addDays(DEMO_TODAY, 730))}.`)}
                              className="btn-primary !bg-white !text-amber-700 border border-amber-200 !py-1 !px-2.5 !text-[11px]">
                              Renew
                            </PermBtn>
                            <button onClick={() => downloadCert(db, expanded, r)}
                              title="Download demo certificate (text file)" aria-label={`Download certificate ${r.certificationNumber}`}
                              className="w-7 h-7 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-300 text-navy flex items-center justify-center">
                              <Download size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[11px] text-slate-400 mt-2">
            Certification status is derived from the completion/expiry dates and the verification flag — an expired
            certificate can never present as Valid. Downloads are DEMO text certificates, watermark-marked as non-statutory.
          </p>
        </SectionCard>
      )}

      {addFor && <TrainingModal workerId={addFor} onClose={() => setAddFor(null)} />}
    </div>
  );
}
// ---------- Tab: Expiring Documents ----------
function ExpiringDocsTab({ db }: { db: WorkforceDbState }) {
  const { err, notice, run, clear } = useActionRunner();
  const [q, setQ] = useState('');
  const [appliedQ, setAppliedQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [upload, setUpload] = useState<Partial<PortalDocument> | null>(null);

  const rows = useMemo(() => {
    const in60 = addDays(DEMO_TODAY, 60);
    const needle = appliedQ.trim().toLowerCase();
    return db.documents
      .filter((d) => (db.selectedMineId === 'ALL' || d.mineId === db.selectedMineId) && d.expiryDate <= in60)
      .filter((d) => (statusFilter === 'ALL' ? true : docStatus(d) === statusFilter))
      .filter((d) => !needle || `${d.id} ${d.name} ${relatedLabel(db, d)} ${d.category}`.toLowerCase().includes(needle))
      .sort((a, b) => (a.expiryDate < b.expiryDate ? -1 : a.expiryDate > b.expiryDate ? 1 : 0));
  }, [db, db.rev, db.selectedMineId, appliedQ, statusFilter]);

  function downloadDoc(d: PortalDocument) {
    const days = daysUntil(d.expiryDate);
    exportText(`${d.id}.txt`, [
      'M I N E N E T R   —   D E M O   D O C U M E N T   C O P Y',
      '='.repeat(72),
      '*** DEMO ONLY — this stub was generated in your browser; no server file exists. ***',
      '',
      `  Document ID        : ${d.id}`,
      `  Document Name      : ${d.name}`,
      `  Category           : ${d.category}`,
      `  Attached To        : ${relatedLabel(db, d)} (${d.relatedType})`,
      `  Mine               : ${mineLabel(d.mineId)}`,
      `  Issue Date         : ${d.issueDate}`,
      `  Expiry Date        : ${d.expiryDate} (${days === null ? 'past' : days < 0 ? `expired ${Math.abs(days)} days ago` : `${days} days left`})`,
      `  Size               : ${fmtSize(d.sizeKb * 1024)}`,
      `  Uploaded By        : ${d.uploadedBy}`,
      `  Simulated Reference: ${d.mockRef}`,
      '',
      '='.repeat(72),
      'Issued by the MineNetr contractor workspace (frontend demo).',
      '='.repeat(72),
    ].join('\n'));
  }

  function exportAll() {
    const n = exportCsv(`minenetr-expiring-documents-${DEMO_TODAY}`, rows, [
      ['Document ID', (d: PortalDocument) => d.id],
      ['Document Name', (d: PortalDocument) => d.name],
      ['Category', (d: PortalDocument) => d.category],
      ['Attached To', (d: PortalDocument) => relatedLabel(db, d)],
      ['Mine', (d: PortalDocument) => mineLabel(d.mineId)],
      ['Issue Date', (d: PortalDocument) => d.issueDate],
      ['Expiry Date', (d: PortalDocument) => d.expiryDate],
      ['Days To Expiry', (d: PortalDocument) => daysUntil(d.expiryDate) ?? ''],
      ['Status', (d: PortalDocument) => docStatus(d)],
      ['Size KB', (d: PortalDocument) => d.sizeKb],
      ['Uploaded By', (d: PortalDocument) => d.uploadedBy],
    ]);
    run(() => { /* CSV generation cannot throw in practice; keeps the notice path uniform */ },
      () => `Exported ${n} document row${n === 1 ? '' : 's'} to CSV.`);
  }

  const columns: Column<PortalDocument>[] = [
    { key: 'id', header: 'Doc ID', sortValue: (d) => d.id, render: (d) => <span className="font-mono text-[12px] font-bold text-navy">{d.id}</span> },
    {
      key: 'name', header: 'Document', sortValue: (d) => d.name,
      render: (d) => (
        <div className="flex items-center gap-2 min-w-[220px]">
          <span className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0"><FileText size={14} /></span>
          <div className="min-w-0">
            <div className="font-bold text-navy truncate max-w-[240px]" title={d.name}>{d.name}</div>
            <div className="text-[11px] text-slate-400">{d.category}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'related', header: 'Attached To', sortValue: (d) => relatedLabel(db, d),
      render: (d) => <span className="text-[12px] block max-w-[200px] truncate" title={relatedLabel(db, d)}>{relatedLabel(db, d)}</span>,
    },
    { key: 'mine', header: 'Mine', sortValue: (d) => mineCode(d.mineId), render: (d) => <span className="badge bg-slate-100 text-slate-600">{mineCode(d.mineId)}</span> },
    { key: 'size', header: 'Size', sortValue: (d) => d.sizeKb, render: (d) => <span className="text-[12px]">{fmtSize(d.sizeKb * 1024)}</span> },
    {
      key: 'expiry', header: 'Expires', sortValue: (d) => d.expiryDate,
      render: (d) => {
        const days = daysUntil(d.expiryDate);
        return (
          <div>
            <div className="font-semibold">{fmtDate(d.expiryDate)}</div>
            <div className={`text-[11px] font-semibold ${days !== null && days < 0 ? 'text-red-500' : 'text-amber-600'}`}>
              {days === null || days < 0 ? `expired ${Math.abs(days ?? 0)} days ago` : `in ${days} days`}
            </div>
          </div>
        );
      },
    },
    { key: 'status', header: 'Status', sortValue: (d) => docStatus(d), render: (d) => <Pill v={docStatus(d)} /> },
  ];

  return (
    <div>
      {err && <ErrBar msg={err} onClose={clear} />}
      {notice && <OkBar msg={notice} onClose={clear} />}

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 mb-3 text-[12px] text-amber-800 font-semibold flex items-start gap-2">
        <AlertTriangle size={15} className="mt-px shrink-0" />
        <span>
          Documents whose validity ends within {60} days — or has already lapsed — are listed here. Replacements are
          uploaded through a simulated local reference (no server upload happens in demo mode) and downloads generate a
          real text copy in your browser.
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-2 mb-3">
        <div className="block">
          <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Search</span>
          <SearchInput value={q} onChange={setQ} onSearch={() => { setAppliedQ(q); }} ph="Search by doc name, ID, worker..." width="!w-72" />
        </div>
        <Sel label="Status" value={statusFilter} onChange={setStatusFilter}
          options={DOC_STATUSES.map((s) => ({ id: s, label: s === 'ALL' ? 'All (expired + expiring)' : s }))} />
        <div className="flex gap-2 pb-[1px]">
          <PermBtn perm="document.upload" onClick={() => setUpload({})}
            className="btn-primary !py-2 !text-[12px]">
            <span className="flex items-center gap-1.5"><Upload size={14} /> Upload Document</span>
          </PermBtn>
          <PermBtn perm="export" onClick={exportAll} className="btn-primary !bg-white !text-navy border border-slate-300 !py-2 !text-[12px]">
            <span className="flex items-center gap-1.5"><Download size={14} /> Download List (CSV)</span>
          </PermBtn>
        </div>
        {appliedQ && (
          <button onClick={() => { setQ(''); setAppliedQ(''); }} className="text-[12px] font-semibold text-slate-500 hover:text-navy pb-2">
            X Clear search
          </button>
        )}
      </div>

      <DataTable columns={columns} rows={rows}
        emptyTitle="No expiring documents" emptyText="No compliance documents expire within the next 60 days in the current mine scope."
        onRowClick={(d) => downloadDoc(d)}
        actions={(d) => (
          <div className="flex items-center gap-1.5 justify-end">
            <button onClick={() => downloadDoc(d)} title={`Download ${d.id} (demo text copy)`} aria-label={`Download ${d.id}`}
              className="w-7 h-7 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-300 text-navy flex items-center justify-center">
              <Download size={13} />
            </button>
            <PermIconBtn perm="document.upload" label={`Upload replacement for ${d.id}`}
              onClick={() => setUpload({ name: d.name, category: d.category, relatedType: d.relatedType, relatedId: d.relatedId, mineId: d.mineId })}>
              <Upload size={13} />
            </PermIconBtn>
          </div>
        )} />
      <p className="text-[11px] text-slate-400 mt-2">
        Showing {rows.length} document{rows.length === 1 ? '' : 's'} · {db.documents.filter((d) => d.expiryDate < DEMO_TODAY).length} expired
        and {db.documents.filter((d) => d.expiryDate >= DEMO_TODAY && d.expiryDate <= addDays(DEMO_TODAY, 60)).length} expiring within 60 days in the full dataset.
      </p>

      {upload && <UploadDocModal db={db} initial={upload} onClose={() => setUpload(null)} />}
    </div>
  );
}

// ---------- Tab: Transfer History ----------
function TransfersTab({ db }: { db: WorkforceDbState }) {
  const { err, notice, run, clear } = useActionRunner();
  const [raise, setRaise] = useState(false);
  const [ask, setAsk] = useState<{ id: string; decision: 'approve' | 'reject' | 'cancel' } | null>(null);

  const rows = useMemo(
    () => [...db.transfers].sort((a, b) => (a.requestDate < b.requestDate ? 1 : a.requestDate > b.requestDate ? -1 : 0)),
    [db, db.rev],
  );
  const pending = rows.filter((t) => t.status === TransferStatus.Pending);
  const askT = ask ? db.transfers.find((t) => t.id === ask.id) ?? null : null;
  const askWorker = askT ? db.workers.find((w) => w.id === askT.workerId) ?? null : null;

  function confirmAsk() {
    if (!ask || !askT) return;
    const decision = ask.decision;
    const id = askT.id;
    run(() => actions.decideTransfer(id, decision),
      (v) => {
        void v;
        return `Transfer ${id} ${decision === 'approve' ? 'approved — the worker has been reassigned' : decision === 'reject' ? 'rejected — worker stays on the current deployment' : 'cancelled — request withdrawn'}.`;
      });
    setAsk(null);
  }

  const columns: Column<TransferRequest>[] = [
    { key: 'id', header: 'Request', sortValue: (t) => t.id, render: (t) => <span className="font-mono text-[12px] font-bold text-navy">{t.id}</span> },
    {
      key: 'worker', header: 'Worker', sortValue: (t) => t.workerId,
      render: (t) => {
        const w = db.workers.find((x) => x.id === t.workerId);
        return (
          <div className="flex items-center gap-2 min-w-[160px]">
            <Avatar name={w?.name ?? t.workerId} id={t.workerId} />
            <div className="min-w-0">
              <div className="font-bold text-navy truncate">{w?.name ?? t.workerId}</div>
              <div className="text-[11px] font-mono text-slate-400">{t.workerId}</div>
            </div>
          </div>
        );
      },
    },
    {
      key: 'from', header: 'From', sortValue: (t) => mineCode(t.fromMineId),
      render: (t) => (
        <div className="text-[12px]">
          <div className="font-bold text-navy">{mineCode(t.fromMineId)}</div>
          <div className="text-[11px] text-slate-400">{contractorName(t.fromContractorId)}</div>
        </div>
      ),
    },
    {
      key: 'to', header: 'To', sortValue: (t) => mineCode(t.toMineId),
      render: (t) => (
        <div className="text-[12px]">
          <div className="font-bold text-navy">{mineCode(t.toMineId)}</div>
          <div className="text-[11px] text-slate-400">{t.toDepartment}</div>
        </div>
      ),
    },
    {
      key: 'requested', header: 'Requested', sortValue: (t) => t.requestDate,
      render: (t) => (
        <div className="text-[12px]">
          <div>{fmtDate(t.requestDate)}</div>
          <div className="text-[11px] text-slate-400">{relTime(t.requestDate)} · {t.supervisor}</div>
        </div>
      ),
    },
    {
      key: 'reason', header: 'Reason', sortValue: (t) => t.reason,
      render: (t) => <span className="text-[12px] block max-w-[220px] truncate" title={t.reason}>{t.reason}</span>,
    },
    { key: 'status', header: 'Status', sortValue: (t) => t.status, render: (t) => <Pill v={t.status} /> },
    {
      key: 'decided', header: 'Decision', sortValue: (t) => t.decidedOn ?? '',
      render: (t) => (t.decidedOn
        ? (
          <div className="text-[12px]">
            <div>{fmtDate(t.decidedOn)}</div>
            <div className="text-[11px] text-slate-400">by {t.decidedBy}</div>
          </div>
        )
        : <span className="text-[11px] text-slate-400">Awaiting decision</span>),
    },
  ];

  return (
    <div>
      {err && <ErrBar msg={err} onClose={clear} />}
      {notice && <OkBar msg={notice} onClose={clear} />}

      <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 mb-3 text-[12px] text-blue-800 font-semibold flex items-start gap-2">
        <Send size={15} className="mt-px shrink-0" />
        <span>
          <strong>Approving a transfer actually reassigns the worker.</strong> On approval the worker&apos;s live deployment
          record moves to the destination mine and department immediately — attendance scope, KPIs and the worker table
          all update at once and the change is written to the audit trail. Rejecting or cancelling keeps the worker on
          the current deployment.
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <PermBtn perm="worker.transfer.request" onClick={() => setRaise(true)} className="btn-primary !py-2 !text-[12px]">
          <span className="flex items-center gap-1.5"><Send size={14} /> Raise Transfer Request</span>
        </PermBtn>
        <span className="badge bg-amber-50 text-amber-700">{pending.length} pending</span>
        <span className="badge bg-slate-100 text-slate-600">{rows.length} total</span>
      </div>

      <DataTable columns={columns} rows={rows}
        emptyTitle="No transfer requests" emptyText="Raise a transfer request to move a worker to another mine or department."
        actions={(t) => (
          <div className="flex items-center gap-1.5 justify-end">
            {t.status === TransferStatus.Pending ? (
              <>
                <PermIconBtn perm="worker.transfer.decide" label={`Approve ${t.id} (reassigns the worker)`}
                  onClick={() => setAsk({ id: t.id, decision: 'approve' })}>
                  <CheckCircle2 size={13} />
                </PermIconBtn>
                <PermIconBtn perm="worker.transfer.decide" label={`Reject ${t.id}`}
                  onClick={() => setAsk({ id: t.id, decision: 'reject' })}>
                  <XCircle size={13} />
                </PermIconBtn>
                <PermIconBtn perm="worker.transfer.request" label={`Cancel ${t.id} (withdraw your request)`}
                  onClick={() => setAsk({ id: t.id, decision: 'cancel' })}>
                  <RotateCcw size={13} />
                </PermIconBtn>
              </>
            ) : (
              <span className="text-[11px] text-slate-400">Closed</span>
            )}
          </div>
        )} />

      {raise && <TransferModal db={db} initialWorkerId={null} onClose={() => setRaise(false)} />}
      {ask && askT && (
        <ConfirmDialog
          title={ask.decision === 'approve' ? 'Approve transfer and reassign worker?'
            : ask.decision === 'reject' ? 'Reject transfer request?' : 'Cancel transfer request?'}
          body={ask.decision === 'approve'
            ? `Approving ${askT.id} immediately reassigns ${askWorker?.name ?? askT.workerId} (${askT.workerId}) to ${mineLabel(askT.toMineId)} — ${askT.toDepartment}. The worker's live deployment record, the KPI tiles and the worker table all update at once, and the change is written to the append-only audit trail.`
            : ask.decision === 'reject'
              ? `Rejecting ${askT.id} keeps ${askWorker?.name ?? askT.workerId} on the current deployment (${mineLabel(askT.fromMineId)}). The request is closed with your decision recorded in the audit trail.`
              : `Cancelling withdraws your request ${askT.id}. ${askWorker?.name ?? askT.workerId} stays on ${mineLabel(askT.fromMineId)} and no deployment changes.`}
          confirmLabel={ask.decision === 'approve' ? 'Approve & reassign' : ask.decision === 'reject' ? 'Reject request' : 'Cancel request'}
          onCancel={() => setAsk(null)}
          onConfirm={confirmAsk}
        />
      )}
    </div>
  );
}
// ---------- Modal: Add Worker ----------
type AddForm = {
  name: string; workerId: string; contractorId: string; designation: string; department: string;
  mineId: string; contact: string; joiningDate: string; emergencyContact: string;
  gender: 'Male' | 'Female'; shift: Shift; workZone: string;
  initialTraining: CreateWorkerInput['initialTraining'];
};

const MOBILE_RE = /^[6-9]\d{9}$/;

function AddWorkerModal({ db, onClose }: { db: WorkforceDbState; onClose: () => void }) {
  const { err, run } = useActionRunner();
  const [done, setDone] = useState<string | null>(null);
  const [fe, setFe] = useState<Record<string, string>>({});
  const [f, setF] = useState<AddForm>({
    name: '', workerId: '', contractorId: db.contractors[0]?.id ?? '',
    designation: DESIGNATIONS[0], department: DEPARTMENTS[0],
    mineId: db.selectedMineId !== 'ALL' ? db.selectedMineId : mines[0].id,
    contact: '', joiningDate: DEMO_TODAY, emergencyContact: '',
    gender: 'Male', shift: 'A', workZone: '', initialTraining: 'Mine Safety Induction',
  });

  const set = <K extends keyof AddForm>(k: K, v: AddForm[K]) => setF((p) => ({ ...p, [k]: v }));

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = 'Full name is required.';
    if (!f.workerId.trim()) e.workerId = 'Worker ID is required.';
    else if (db.workers.some((w) => w.id === f.workerId.trim())) e.workerId = `Worker ID ${f.workerId.trim()} already exists — pick a unique ID.`;
    if (!f.contractorId) e.contractorId = 'Select the contractor this worker belongs to.';
    if (!f.mineId) e.mineId = 'Select a mine assignment.';
    if (!MOBILE_RE.test(f.contact.replace(/\D/g, ''))) e.contact = 'Enter a valid 10-digit Indian mobile number (starts with 6-9).';
    if (!MOBILE_RE.test(f.emergencyContact.replace(/\D/g, ''))) e.emergencyContact = 'Enter a valid 10-digit Indian mobile number (starts with 6-9).';
    if (!f.joiningDate) e.joiningDate = 'Joining date is required.';
    if (!f.workZone.trim()) e.workZone = 'Work zone is required (e.g. OB Push-3).';
    return e;
  }

  function submit() {
    const e = validate();
    setFe(e);
    if (Object.keys(e).length) return;
    const id = run(
      () => actions.createWorker({
        name: f.name.trim(), workerId: f.workerId.trim(), contractorId: f.contractorId,
        designation: f.designation, department: f.department, mineId: f.mineId,
        contact: f.contact.trim(), joiningDate: f.joiningDate, emergencyContact: f.emergencyContact.trim(),
        gender: f.gender, shift: f.shift, workZone: f.workZone.trim(), initialTraining: f.initialTraining,
      }),
      (v) => `Worker ${v} added successfully — attendance row created${f.initialTraining !== 'None' ? ' and initial training record submitted for verification' : ''}.`,
    );
    if (id) setDone(id);
  }

  if (done) {
    return (
      <Modal title="Worker added" onClose={onClose} wide>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 mb-4 flex items-start gap-3">
          <CheckCircle2 size={22} className="text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-extrabold text-emerald-800">{f.name.trim()} ({done}) is now on the workforce roster.</div>
            <div className="text-[12px] text-emerald-700 mt-1">
              {contractorName(f.contractorId)} · {mineLabel(f.mineId)} · {f.department} / {f.designation} · Shift {f.shift} · {f.workZone.trim()}
              {f.initialTraining !== 'None' && ' · An initial training record was created and is Pending Verification.'}
            </div>
            <div className="text-[11px] text-emerald-600 mt-1">The worker also appears in the KPI totals, the mine breakdown and today&apos;s attendance list.</div>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={() => { setDone(null); setFe({}); setF({ ...f, name: '', workerId: '', contact: '', emergencyContact: '', workZone: '' }); }}
            className="btn-primary !bg-white !text-navy border border-slate-300 !py-2">
            Add another worker
          </button>
          <button onClick={onClose} className="btn-primary !py-2">Done</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Add New Worker" onClose={onClose} wide>
      {err && <ErrBar msg={err} onClose={() => { /* cleared on next attempt */ }} />}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
        <Field label="Full Name *" error={fe.name}>
          <input className="input" value={f.name} placeholder="e.g. Rahul Yadav" onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Worker ID *" error={fe.workerId} hint="Unique across the portal, e.g. WORK-0500">
          <input className="input font-mono" value={f.workerId} placeholder="WORK-0500" onChange={(e) => set('workerId', e.target.value)} />
        </Field>
        <Field label="Contractor *" error={fe.contractorId}>
          <select className="input" value={f.contractorId} onChange={(e) => set('contractorId', e.target.value)}>
            {db.contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Designation *">
          <select className="input" value={f.designation} onChange={(e) => set('designation', e.target.value)}>
            {DESIGNATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </Field>
        <Field label="Department *">
          <select className="input" value={f.department} onChange={(e) => set('department', e.target.value)}>
            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </Field>
        <Field label="Mine Assignment *" error={fe.mineId}>
          <select className="input" value={f.mineId} onChange={(e) => set('mineId', e.target.value)}>
            {mines.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.code})</option>)}
          </select>
        </Field>
        <Field label="Contact Number *" error={fe.contact} hint="10-digit mobile, starts with 6-9">
          <input className="input" value={f.contact} placeholder="98765 43210" inputMode="numeric" onChange={(e) => set('contact', e.target.value)} />
        </Field>
        <Field label="Joining Date *" error={fe.joiningDate}>
          <input type="date" className="input" value={f.joiningDate} max={DEMO_TODAY} onChange={(e) => set('joiningDate', e.target.value)} />
        </Field>
        <Field label="Emergency Contact *" error={fe.emergencyContact} hint="10-digit mobile, starts with 6-9">
          <input className="input" value={f.emergencyContact} placeholder="91234 56789" inputMode="numeric" onChange={(e) => set('emergencyContact', e.target.value)} />
        </Field>
        <Field label="Gender *">
          <select className="input" value={f.gender} onChange={(e) => set('gender', e.target.value as 'Male' | 'Female')}>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </Field>
        <Field label="Shift *">
          <select className="input" value={f.shift} onChange={(e) => set('shift', e.target.value as Shift)}>
            {SHIFTS.map((s) => <option key={s} value={s}>Shift {s}</option>)}
          </select>
        </Field>
        <Field label="Work Zone *" error={fe.workZone} hint="Bench / push / area the worker is deployed in">
          <input className="input" value={f.workZone} placeholder="e.g. OB Push-3" onChange={(e) => set('workZone', e.target.value)} />
        </Field>
        <Field label="Initial Training Status" hint="Creates a certification record submitted for verification">
          <select className="input" value={f.initialTraining} onChange={(e) => set('initialTraining', e.target.value as AddForm['initialTraining'])}>
            <option value="Mine Safety Induction">Mine Safety Induction (mandatory)</option>
            <option value="First Aid">First Aid</option>
            <option value="Emergency Response">Emergency Response</option>
            <option value="None">None — will show as No Training</option>
          </select>
        </Field>
      </div>
      <div className="flex gap-2 justify-end mt-1">
        <button onClick={onClose} className="btn-primary !bg-white !text-navy border border-slate-300 !py-2">Cancel</button>
        <button onClick={submit} className="btn-primary !py-2">
          <span className="flex items-center gap-1.5"><Plus size={15} /> Add Worker</span>
        </button>
      </div>
    </Modal>
  );
}

// ---------- Modal: Edit Worker ----------
function EditWorkerModal({ db, worker, onClose }: { db: WorkforceDbState; worker: Worker; onClose: () => void }) {
  const { err, run } = useActionRunner();
  const [f, setF] = useState({
    name: worker.name, designation: worker.designation, department: worker.department,
    mineId: worker.mineId, contact: worker.contact, emergencyContact: worker.emergencyContact,
    shift: worker.shift as Shift, workZone: worker.workZone,
  });
  const [fe, setFe] = useState<Record<string, string>>({});
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  function submit() {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = 'Full name is required.';
    if (!MOBILE_RE.test(f.contact.replace(/\D/g, ''))) e.contact = 'Enter a valid 10-digit Indian mobile number (starts with 6-9).';
    if (!MOBILE_RE.test(f.emergencyContact.replace(/\D/g, ''))) e.emergencyContact = 'Enter a valid 10-digit Indian mobile number (starts with 6-9).';
    if (!f.workZone.trim()) e.workZone = 'Work zone is required.';
    setFe(e);
    if (Object.keys(e).length) return;
    run(() => actions.updateWorker(worker.id, {
      name: f.name.trim(), designation: f.designation, department: f.department, mineId: f.mineId,
      contact: f.contact.trim(), emergencyContact: f.emergencyContact.trim(), shift: f.shift, workZone: f.workZone.trim(),
    }), () => `Worker ${worker.id} updated.`);
    onClose();
  }

  void db;
  return (
    <Modal title={`Edit Worker — ${worker.id}`} onClose={onClose} wide>
      {err && <ErrBar msg={err} onClose={() => { /* cleared on next attempt */ }} />}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
        <Field label="Full Name *" error={fe.name}>
          <input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Designation *">
          <select className="input" value={f.designation} onChange={(e) => set('designation', e.target.value)}>
            {DESIGNATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </Field>
        <Field label="Department *">
          <select className="input" value={f.department} onChange={(e) => set('department', e.target.value)}>
            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </Field>
        <Field label="Mine Assignment *" hint="For a full redeployment (shift/zone too) use Change Deployment">
          <select className="input" value={f.mineId} onChange={(e) => set('mineId', e.target.value)}>
            {mines.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.code})</option>)}
          </select>
        </Field>
        <Field label="Contact Number *" error={fe.contact}>
          <input className="input" value={f.contact} inputMode="numeric" onChange={(e) => set('contact', e.target.value)} />
        </Field>
        <Field label="Emergency Contact *" error={fe.emergencyContact}>
          <input className="input" value={f.emergencyContact} inputMode="numeric" onChange={(e) => set('emergencyContact', e.target.value)} />
        </Field>
        <Field label="Shift *">
          <select className="input" value={f.shift} onChange={(e) => set('shift', e.target.value as Shift)}>
            {SHIFTS.map((s) => <option key={s} value={s}>Shift {s}</option>)}
          </select>
        </Field>
        <Field label="Work Zone *" error={fe.workZone}>
          <input className="input" value={f.workZone} onChange={(e) => set('workZone', e.target.value)} />
        </Field>
      </div>
      <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-[11px] text-slate-500 mb-3">
        Worker ID, contractor, gender, joining date and status are immutable here — status changes go through
        Deactivate/Reactivate so they are always confirmed and audited.
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onClose} className="btn-primary !bg-white !text-navy border border-slate-300 !py-2">Cancel</button>
        <button onClick={submit} className="btn-primary !py-2">Save Changes</button>
      </div>
    </Modal>
  );
}

// ---------- Modal: Change Deployment ----------
function DeployModal({ db, worker, onClose }: { db: WorkforceDbState; worker: Worker; onClose: () => void }) {
  const { err, run } = useActionRunner();
  const [mineId, setMineId] = useState(worker.mineId);
  const [department, setDepartment] = useState(worker.department);
  const [shift, setShift] = useState<Shift>(worker.shift);
  const [workZone, setWorkZone] = useState(worker.workZone);
  void db;

  function submit() {
    run(() => actions.deployWorker(worker.id, { mineId, department, shift, workZone: workZone.trim() }),
      () => `Deployment updated for ${worker.id} — now ${mineLabel(mineId)} · ${department} · Shift ${shift} · ${workZone.trim()}.`);
    onClose();
  }

  return (
    <Modal title={`Change Deployment — ${worker.name}`} onClose={onClose}>
      {err && <ErrBar msg={err} onClose={() => { /* cleared on next attempt */ }} />}
      <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 mb-3 text-[12px] text-slate-600">
        <div className="font-bold text-navy mb-1">Current deployment</div>
        {mineLabel(worker.mineId)} · {worker.department} · Shift {worker.shift} · {worker.workZone} · Supervisor {worker.supervisor}
        {worker.status !== WorkerStatus.Active && (
          <div className="text-red-500 font-semibold mt-1">
            This worker is {worker.status} — inactive or blocked workers cannot be deployed. Reactivate first.
          </div>
        )}
      </div>
      <Field label="Mine *">
        <select className="input" value={mineId} onChange={(e) => setMineId(e.target.value)}>
          {mines.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.code})</option>)}
        </select>
      </Field>
      <Field label="Department *">
        <select className="input" value={department} onChange={(e) => setDepartment(e.target.value)}>
          {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-x-4">
        <Field label="Shift *">
          <select className="input" value={shift} onChange={(e) => setShift(e.target.value as Shift)}>
            {SHIFTS.map((s) => <option key={s} value={s}>Shift {s}</option>)}
          </select>
        </Field>
        <Field label="Work Zone *">
          <input className="input" value={workZone} onChange={(e) => setWorkZone(e.target.value)} />
        </Field>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onClose} className="btn-primary !bg-white !text-navy border border-slate-300 !py-2">Cancel</button>
        <button onClick={submit} className="btn-primary !py-2">Save Deployment</button>
      </div>
    </Modal>
  );
}

// ---------- Modal: Raise Transfer ----------
function TransferModal({ db, initialWorkerId, onClose }: { db: WorkforceDbState; initialWorkerId: string | null; onClose: () => void }) {
  const { err, run } = useActionRunner();
  const [workerId, setWorkerId] = useState(initialWorkerId ?? db.workers[0]?.id ?? '');
  const worker = db.workers.find((w) => w.id === workerId) ?? db.workers[0];
  const [toMineId, setToMineId] = useState(mines.find((m) => m.id !== (worker?.mineId ?? ''))?.id ?? mines[0].id);
  const [toDepartment, setToDepartment] = useState(worker?.department ?? DEPARTMENTS[0]);
  const [reason, setReason] = useState('');
  const [fe, setFe] = useState<Record<string, string>>({});
  const [done, setDone] = useState<string | null>(null);

  function pickWorker(id: string) {
    setWorkerId(id);
    const w = db.workers.find((x) => x.id === id);
    if (w) {
      const dest = mines.find((m) => m.id !== w.mineId) ?? mines[0];
      setToMineId(dest.id);
      setToDepartment(w.department);
    }
    setFe({});
  }

  function submit() {
    const e: Record<string, string> = {};
    if (!worker) e.workerId = 'Select a worker.';
    if (worker && toMineId === worker.mineId) e.toMineId = 'Choose a destination other than the worker\u2019s current mine.';
    if (!reason.trim()) e.reason = 'A reason is required — the mine office reviews it before deciding.';
    setFe(e);
    if (Object.keys(e).length || !worker) return;
    const w = worker;
    const id = run(() => actions.createTransfer({ workerId: w.id, toMineId, toDepartment, reason: reason.trim() }),
      (v) => `Transfer ${v} raised for ${w.name} (${mineCode(w.mineId)} → ${mineCode(toMineId)}) — awaiting approval.`);
    if (id) setDone(id);
  }

  if (done) {
    return (
      <Modal title="Transfer request submitted" onClose={onClose}>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 mb-4 flex items-start gap-3">
          <CheckCircle2 size={22} className="text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-extrabold text-emerald-800">Request {done} is now pending approval.</div>
            <div className="text-[12px] text-emerald-700 mt-1">
              The worker stays on the current deployment until the mine office approves. Approving reassigns the worker
              immediately; you can also cancel the request from the Transfer History tab.
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <button onClick={onClose} className="btn-primary !py-2">Done</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Raise Transfer Request" onClose={onClose}>
      {err && <ErrBar msg={err} onClose={() => { /* cleared on next attempt */ }} />}
      <Field label="Worker *" error={fe.workerId} hint={initialWorkerId ? undefined : 'Changing the worker resets the destination fields'}>
        {initialWorkerId ? (
          <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50">
            <Avatar name={worker?.name ?? initialWorkerId} id={initialWorkerId} />
            <div>
              <div className="text-[13px] font-bold text-navy">{worker?.name ?? initialWorkerId}</div>
              <div className="text-[11px] text-slate-500">{initialWorkerId} · currently {worker ? mineLabel(worker.mineId) : ''}</div>
            </div>
          </div>
        ) : (
          <select className="input" value={workerId} onChange={(e) => pickWorker(e.target.value)}>
            {db.workers.map((w) => <option key={w.id} value={w.id}>{w.id} — {w.name} ({mineCode(w.mineId)})</option>)}
          </select>
        )}
      </Field>
      <Field label="Destination Mine *" error={fe.toMineId}>
        <select className="input" value={toMineId} onChange={(e) => setToMineId(e.target.value)}>
          {mines.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.code})</option>)}
        </select>
      </Field>
      <Field label="Destination Department *">
        <select className="input" value={toDepartment} onChange={(e) => setToDepartment(e.target.value)}>
          {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </Field>
      <Field label="Reason *" error={fe.reason} hint="Reviewed by the mine planning office before approval">
        <textarea className="input min-h-[80px]" value={reason}
          placeholder="e.g. Skill matched to a vacant operator position on the new bench."
          onChange={(e) => setReason(e.target.value)} />
      </Field>
      <div className="flex gap-2 justify-end">
        <button onClick={onClose} className="btn-primary !bg-white !text-navy border border-slate-300 !py-2">Cancel</button>
        <button onClick={submit} className="btn-primary !py-2">
          <span className="flex items-center gap-1.5"><Send size={15} /> Submit Request</span>
        </button>
      </div>
    </Modal>
  );
}

// ---------- Modal: Add Training ----------
function TrainingModal({ workerId, onClose }: { workerId: string; onClose: () => void }) {
  const { err, run } = useActionRunner();
  const [f, setF] = useState({
    type: TRAINING_TYPES[0] as string, certificationNumber: '',
    completionDate: DEMO_TODAY, expiryDate: addDays(DEMO_TODAY, 730),
    provider: 'Mine Safety Training Institute, Korba', mandatory: true,
  });
  const [fe, setFe] = useState<Record<string, string>>({});
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  function submit() {
    const e: Record<string, string> = {};
    if (!f.certificationNumber.trim()) e.certificationNumber = 'Certification number is required.';
    if (!f.provider.trim()) e.provider = 'Training provider is required.';
    if (f.completionDate > DEMO_TODAY) e.completionDate = 'Completion date cannot be in the future.';
    if (f.expiryDate <= f.completionDate) e.expiryDate = 'Expiry must be after the completion date.';
    setFe(e);
    if (Object.keys(e).length) return;
    run(() => actions.createTraining({
      workerId, type: f.type, certificationNumber: f.certificationNumber.trim(),
      completionDate: f.completionDate, expiryDate: f.expiryDate, provider: f.provider.trim(),
      mandatory: f.mandatory, verified: false,
    }), (v) => `Training record ${v} added for ${workerId} — pending verification.`);
    onClose();
  }

  return (
    <Modal title={`Add Training — ${workerId}`} onClose={onClose}>
      {err && <ErrBar msg={err} onClose={() => { /* cleared on next attempt */ }} />}
      <Field label="Training Type *">
        <select className="input" value={f.type} onChange={(e) => set('type', e.target.value)}>
          {TRAINING_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>
      <Field label="Certification Number *" error={fe.certificationNumber}>
        <input className="input font-mono" value={f.certificationNumber} placeholder="e.g. MSI-2026-00123"
          onChange={(e) => set('certificationNumber', e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-x-4">
        <Field label="Completion Date *" error={fe.completionDate}>
          <input type="date" className="input" value={f.completionDate} max={DEMO_TODAY}
            onChange={(e) => set('completionDate', e.target.value)} />
        </Field>
        <Field label="Expiry Date *" error={fe.expiryDate}>
          <input type="date" className="input" value={f.expiryDate}
            onChange={(e) => set('expiryDate', e.target.value)} />
        </Field>
      </div>
      <Field label="Training Provider *" error={fe.provider}>
        <input className="input" value={f.provider} onChange={(e) => set('provider', e.target.value)} />
      </Field>
      <label className="flex items-center gap-2 text-[12px] font-semibold text-slate-600 mb-3">
        <input type="checkbox" checked={f.mandatory} onChange={(e) => set('mandatory', e.target.checked)} />
        Mandatory certification (gates site deployment)
      </label>
      <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-[11px] text-slate-500 mb-3">
        New records start as <strong>Pending Verification</strong> — an inspector or manager with the training.verify
        permission must verify them before they present as Valid.
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onClose} className="btn-primary !bg-white !text-navy border border-slate-300 !py-2">Cancel</button>
        <button onClick={submit} className="btn-primary !py-2">Add Training Record</button>
      </div>
    </Modal>
  );
}

// ---------- Modal: Upload Document ----------
function UploadDocModal({ db, initial, onClose }: {
  db: WorkforceDbState; initial: Partial<PortalDocument>; onClose: () => void;
}) {
  const { err, run } = useActionRunner();
  const [done, setDone] = useState<string | null>(null);
  const [f, setF] = useState({
    name: initial.name ?? '', category: (initial.category ?? 'Worker Documents') as PortalDocument['category'],
    relatedType: (initial.relatedType ?? 'worker') as PortalDocument['relatedType'],
    relatedId: initial.relatedId ?? '', mineId: initial.mineId ?? (db.selectedMineId !== 'ALL' ? db.selectedMineId : mines[0].id),
    expiryDate: addDays(DEMO_TODAY, 365), sizeKb: 250,
  });
  const [fe, setFe] = useState<Record<string, string>>({});
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  function submit() {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = 'Document name is required.';
    if (!f.relatedId.trim()) e.relatedId = 'Enter the ID this document is attached to (worker / contractor / equipment / statutory).';
    if (!f.expiryDate) e.expiryDate = 'Expiry date is required for compliance tracking.';
    setFe(e);
    if (Object.keys(e).length) return;
    const id = run(() => actions.uploadDocument({
      name: f.name.trim(), category: f.category, relatedType: f.relatedType, relatedId: f.relatedId.trim(),
      mineId: f.mineId, expiryDate: f.expiryDate, sizeKb: f.sizeKb,
    }), (v) => `Document ${v} uploaded against ${f.relatedId.trim()} (simulated local reference).`);
    if (id) setDone(id);
  }

  if (done) {
    return (
      <Modal title="Document uploaded" onClose={onClose}>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 mb-4 flex items-start gap-3">
          <CheckCircle2 size={22} className="text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-extrabold text-emerald-800">{done} — {f.name.trim()} recorded.</div>
            <div className="text-[12px] text-emerald-700 mt-1">
              Expiry tracking starts immediately: the document will surface in this tab once it is within 60 days of expiry.
              Upload is simulated locally — no server file was created.
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <button onClick={onClose} className="btn-primary !py-2">Done</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Upload Document" onClose={onClose}>
      {err && <ErrBar msg={err} onClose={() => { /* cleared on next attempt */ }} />}
      <Field label="Document Name *" error={fe.name} hint="e.g. Medical Fitness Certificate — Rahul Yadav.pdf">
        <input className="input" value={f.name} placeholder="Document file name"
          onChange={(e) => set('name', e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-x-4">
        <Field label="Category *">
          <select className="input" value={f.category} onChange={(e) => set('category', e.target.value as PortalDocument['category'])}>
            {DOCUMENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Attached To Type *">
          <select className="input" value={f.relatedType} onChange={(e) => set('relatedType', e.target.value as PortalDocument['relatedType'])}>
            <option value="worker">Worker</option>
            <option value="contractor">Contractor</option>
            <option value="equipment">Equipment</option>
            <option value="statutory">Statutory (contractor)</option>
          </select>
        </Field>
      </div>
      <Field label="Related ID *" error={fe.relatedId}
        hint={f.relatedType === 'worker' ? 'Worker ID, e.g. WORK-0007' : f.relatedType === 'equipment' ? 'Equipment code, e.g. HEMM-DT-14' : 'Contractor ID, e.g. DEMO-CONT-001'}>
        <input className="input font-mono" value={f.relatedId} placeholder="WORK-0007"
          onChange={(e) => set('relatedId', e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-x-4">
        <Field label="Mine *">
          <select className="input" value={f.mineId} onChange={(e) => set('mineId', e.target.value)}>
            {mines.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.code})</option>)}
          </select>
        </Field>
        <Field label="Expiry Date *" error={fe.expiryDate} hint="Drives the expiring-documents tracking">
          <input type="date" className="input" value={f.expiryDate} onChange={(e) => set('expiryDate', e.target.value)} />
        </Field>
      </div>
      <Field label="Size (KB)" hint="Simulated file size for the compliance register">
        <input type="number" min={1} className="input" value={f.sizeKb} onChange={(e) => set('sizeKb', Number(e.target.value) || 1)} />
      </Field>
      <div className="flex gap-2 justify-end">
        <button onClick={onClose} className="btn-primary !bg-white !text-navy border border-slate-300 !py-2">Cancel</button>
        <button onClick={submit} className="btn-primary !py-2">
          <span className="flex items-center gap-1.5"><Upload size={15} /> Upload</span>
        </button>
      </div>
    </Modal>
  );
}
// ---------- Worker detail drawer ----------
function WorkerDrawer({ workerId, onClose, onEdit, onTransfer }: {
  workerId: string; onClose: () => void; onEdit: (w: Worker) => void; onTransfer: (workerId: string) => void;
}) {
  const db = useMockWorkforce();
  const rev = db.rev;
  const found = db.workers.find((w) => w.id === workerId) ?? null;
  const { err, notice, run, clear } = useActionRunner();
  const [dtab, setDtab] = useState('Overview');
  const [attendanceStatus, setAttendanceStatus] = useState<string>(AttendanceStatus.Present);
  const [manual, setManual] = useState(true);
  const [confirmStatus, setConfirmStatus] = useState<WorkerStatus | null>(null);
  const [trainingOpen, setTrainingOpen] = useState(false);
  const [deployOpen, setDeployOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const recs = useMemo(
    () => (found ? db.training.filter((t) => t.workerId === found.id) : []),
    [db, rev, found],
  );
  const prevDates = useMemo(() => lastNDates(15).slice(0, 14), []);

  if (!found) {
    return (
      <DetailDrawer title="Worker not found" onClose={onClose} wide>
        <EmptyState title="Worker record missing" sub={`No worker with ID ${workerId} exists in the current dataset.`} />
      </DetailDrawer>
    );
  }
  const worker: Worker = found;

  const today = attendanceOf(db, worker.id);
  const acc = accessOf(db, worker.id);
  const accessHistory = db.access
    .filter((a) => a.workerId === worker.id)
    .slice()
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  const transfers = db.transfers
    .filter((t) => t.workerId === worker.id)
    .slice()
    .sort((a, b) => (a.requestDate < b.requestDate ? 1 : -1));
  const docs = db.documents.filter((d) => d.relatedType === 'worker' && d.relatedId === worker.id);
  const activity = db.activity.filter((a) => a.description.includes(worker.id));
  const worst = worstTraining(recs);
  const isActive = worker.status === WorkerStatus.Active;

  function downloadDoc(d: PortalDocument) {
    exportText(`${d.id}.txt`, [
      'M I N E N E T R   —   D E M O   D O C U M E N T   C O P Y',
      '='.repeat(72),
      '*** DEMO ONLY — generated in your browser; no server file exists. ***',
      '',
      `  Document ID   : ${d.id}`,
      `  Document Name : ${d.name}`,
      `  Category      : ${d.category}`,
      `  Attached To   : ${worker.name} (${worker.id})`,
      `  Mine          : ${mineLabel(d.mineId)}`,
      `  Issue Date    : ${d.issueDate}`,
      `  Expiry Date   : ${d.expiryDate}`,
      `  Size          : ${fmtSize(d.sizeKb * 1024)}`,
      `  Uploaded By   : ${d.uploadedBy}`,
      '',
      '='.repeat(72),
    ].join('\n'));
  }

  function downloadAllCerts() {
    exportText(`certificates-${worker.id}.txt`, recs.map((r) => certificateText({
      workerName: worker.name, workerId: worker.id, contractor: contractorName(worker.contractorId),
      trainingType: r.type, completionDate: r.completionDate, expiryDate: r.expiryDate,
      certificateNumber: r.certificationNumber, provider: r.provider,
    })).join('\n\n'));
  }

  function section(): React.ReactNode {
    switch (dtab) {
      case 'Overview':
        return (
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 p-3">
              <Kv k="Worker ID" v={<span className="font-mono">{worker.id}</span>} />
              <Kv k="Full Name" v={worker.name} />
              <Kv k="Contractor" v={contractorName(worker.contractorId)} />
              <Kv k="Designation" v={worker.designation} />
              <Kv k="Department" v={worker.department} />
              <Kv k="Assigned Mine" v={mineLabel(worker.mineId)} />
              <Kv k="Shift / Zone" v={`Shift ${worker.shift} · ${worker.workZone}`} />
              <Kv k="Supervisor" v={worker.supervisor} />
              <Kv k="Contact" v={fmtPhone(worker.contact)} />
              <Kv k="Emergency" v={fmtPhone(worker.emergencyContact)} />
              <Kv k="Joining Date" v={`${fmtDate(worker.joiningDate)} · ${worker.gender}`} />
              <Kv k="Status" v={<Pill v={worker.status} />} />
              <Kv k="Training" v={<Pill v={worst} />} />
              <Kv k="Today" v={<Pill v={today?.status ?? AttendanceStatus.NotMarked} />} />
              <Kv k="Gate Access" v={acc ? <Pill v={acc.status} /> : <SoftPill v="No Record" />} />
            </div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Quick actions</div>
            <div className="grid grid-cols-2 gap-2">
              <PermBtn perm="worker.update" onClick={() => onEdit(worker)}
                className="btn-primary !bg-white !text-navy border border-slate-300 !py-2 !text-[12px] flex items-center justify-center gap-1.5">
                <Pencil size={13} /> Edit Worker
              </PermBtn>
              <PermBtn perm="worker.deploy" onClick={() => setDeployOpen(true)}
                className="btn-primary !bg-white !text-navy border border-slate-300 !py-2 !text-[12px] flex items-center justify-center gap-1.5">
                <ArrowRightLeft size={13} /> Change Deployment
              </PermBtn>
              <PermBtn perm="worker.transfer.request" onClick={() => onTransfer(worker.id)}
                className="btn-primary !bg-white !text-navy border border-slate-300 !py-2 !text-[12px] flex items-center justify-center gap-1.5">
                <Send size={13} /> Request Transfer
              </PermBtn>
              <button onClick={() => setDtab('Attendance')}
                className="btn-primary !bg-white !text-navy border border-slate-300 !py-2 !text-[12px] flex items-center justify-center gap-1.5">
                <CheckCircle2 size={13} /> Mark Attendance
              </button>
              {isActive ? (
                <PermBtn perm="worker.deactivate" onClick={() => setConfirmStatus(WorkerStatus.Inactive)}
                  className="btn-primary !bg-white !text-red-600 border border-red-200 !py-2 !text-[12px] flex items-center justify-center gap-1.5 col-span-2">
                  <UserX size={13} /> Deactivate Worker
                </PermBtn>
              ) : (
                <button onClick={() => setConfirmStatus(WorkerStatus.Active)}
                  className="btn-primary !bg-emerald-600 hover:!bg-emerald-700 !py-2 !text-[12px] flex items-center justify-center gap-1.5 col-span-2">
                  <UserCheck size={13} /> Reactivate Worker
                </button>
              )}
            </div>
          </div>
        );

      case 'Deployment':
        return (
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">Current deployment</div>
              <Kv k="Mine" v={mineLabel(worker.mineId)} />
              <Kv k="Department" v={worker.department} />
              <Kv k="Shift" v={`Shift ${worker.shift}`} />
              <Kv k="Work Zone" v={worker.workZone} />
              <Kv k="Supervisor" v={worker.supervisor} />
              <Kv k="Contractor" v={contractorName(worker.contractorId)} />
            </div>
            {!isActive && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] font-semibold text-red-600">
                This worker is {worker.status} — inactive or blocked workers cannot be deployed. Reactivate the worker first.
              </div>
            )}
            <PermBtn perm="worker.deploy" disabled={!isActive} onClick={() => setDeployOpen(true)} className="btn-primary !py-2 w-full">
              <span className="flex items-center justify-center gap-1.5"><ArrowRightLeft size={15} /> Assign to Mine / Change Deployment</span>
            </PermBtn>
            <p className="text-[11px] text-slate-400">
              Deployment changes are applied instantly to attendance scope, the worker table and the mine breakdown, and
              are written to the audit trail. For a cross-mine move that needs mine-office approval, raise a transfer instead.
            </p>
          </div>
        );

      case 'Attendance':
        return (
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">
                Today · {fmtDate(DEMO_TODAY)} ({weekdayShort(DEMO_TODAY)})
              </div>
              {today ? (
                <div>
                  <Kv k="Status" v={<Pill v={today.status} />} />
                  <Kv k="In / Out" v={`${today.inTime} → ${today.outTime} · ${workedLabel(today.inTime, today.outTime)}`} />
                  <Kv k="Gate" v={today.gate} />
                  <Kv k="Method" v={today.method === 'Manual'
                    ? <span className="badge bg-amber-100 text-amber-700">Manual entry (supervisor log)</span>
                    : <span className="badge bg-sky-100 text-sky-700">Biometric (gate terminal)</span>} />
                </div>
              ) : (
                <EmptyState title="No attendance row today" sub="This worker has no attendance record for the demo day." />
              )}
            </div>

            <div className="rounded-xl border border-slate-200 p-3">
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">Mark attendance for today</div>
              <div className="flex flex-wrap items-end gap-2">
                <label className="block">
                  <span className="block text-[11px] font-semibold text-slate-500 mb-1">Status</span>
                  <select className="input !w-auto !py-2 !text-[13px]" value={attendanceStatus} aria-label="Attendance status"
                    onChange={(e) => setAttendanceStatus(e.target.value)}>
                    {[AttendanceStatus.Present, AttendanceStatus.Absent, AttendanceStatus.OnLeave].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <PermBtn perm="attendance.mark"
                  onClick={() => run(() => actions.markAttendance(worker.id, attendanceStatus as AttendanceStatus, manual),
                    () => `${worker.id} marked ${attendanceStatus} for ${fmtDate(DEMO_TODAY)} (${manual ? 'manual entry' : 'biometric capture'}).`)}
                  className="!py-2">
                  <span className="flex items-center gap-1.5"><CheckCircle2 size={14} /> Mark Attendance</span>
                </PermBtn>
              </div>
              <label className="flex items-start gap-2 mt-3 text-[12px] text-slate-600">
                <input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} className="mt-0.5" />
                <span>
                  <span className="font-bold text-navy">Manual entry</span> — supervisor log, recorded as <em>Manual</em> in
                  the record and the audit trail. Manual entries are never presented as biometric captures.
                  {!manual && (
                    <span className="block text-amber-600 font-semibold mt-0.5">
                      Unchecking records this as a biometric capture — only reconcile gate-terminal data here.
                    </span>
                  )}
                </span>
              </label>
            </div>

            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">Previous 14 days</div>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="dense w-full min-w-[600px]">
                  <thead>
                    <tr><th>Date</th><th>Status</th><th>In</th><th>Out</th><th>Worked</th><th>Gate</th><th>Method</th></tr>
                  </thead>
                  <tbody>
                    {prevDates.map((d) => {
                      const h = derivedAttendance(worker, d);
                      return (
                        <tr key={d}>
                          <td className="whitespace-nowrap">{weekdayShort(d)} · {fmtDate(d)}</td>
                          <td><Pill v={h.status} /></td>
                          <td>{h.inTime}</td>
                          <td>{h.outTime}</td>
                          <td>{workedLabel(h.inTime, h.outTime)}</td>
                          <td className="text-[12px]">{h.gate}</td>
                          <td className="text-[12px]">{h.method}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Only today&apos;s record is stored. Historical rows are derived deterministically from the worker id and
                date (a pure function) so the demo needs no synthetic history table.
              </p>
            </div>
          </div>
        );

      case 'Training & Certifications':
        return (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Pill v={worst} />
              <span className="text-[12px] text-slate-500">{recs.length} record{recs.length === 1 ? '' : 's'}</span>
              <div className="ml-auto flex gap-2">
                {recs.length > 0 && (
                  <button onClick={downloadAllCerts}
                    className="btn-primary !bg-white !text-navy border border-slate-300 !py-1.5 !px-3 !text-[12px] flex items-center gap-1.5">
                    <Download size={13} /> All Certificates
                  </button>
                )}
                <PermBtn perm="training.create" onClick={() => setTrainingOpen(true)} className="btn-primary !py-1.5 !px-3 !text-[12px]">
                  <span className="flex items-center gap-1.5"><Plus size={13} /> Add Training</span>
                </PermBtn>
              </div>
            </div>
            {recs.length === 0 ? (
              <EmptyState title="No training records"
                sub="This worker holds no certifications. Add the mandatory Mine Safety Induction before deploying them on site." />
            ) : (
              <div className="space-y-2">
                {recs.map((r) => {
                  const st = trainingStatusOf(r);
                  return (
                    <div key={r.id} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-start gap-2 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-bold text-navy">{r.type}
                            {r.mandatory && <span className="badge bg-rose-50 text-rose-600 ml-2">Mandatory</span>}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">{r.certificationNumber} · {r.provider}</div>
                        </div>
                        <Pill v={st} />
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 mt-1.5">
                        <Kv k="Completed" v={fmtDate(r.completionDate)} />
                        <Kv k="Expires" v={`${fmtDate(r.expiryDate)} (${(() => { const d = daysUntil(r.expiryDate); return d === null || d < 0 ? 'lapsed' : `${d}d left`; })()})`} />
                      </div>
                      <div className="flex items-center gap-1.5 mt-2">
                        <PermBtn perm="training.verify" disabled={st === 'Expired'}
                          title={st === 'Expired' ? 'Expired certifications cannot be verified — renew the training first.' : undefined}
                          onClick={() => run(() => actions.verifyTraining(r.id), () => `Training ${r.id} (${r.type}) verified for ${worker.name}.`)}
                          className="btn-primary !bg-white !text-emerald-700 border border-emerald-200 !py-1 !px-2.5 !text-[11px]">
                          Verify
                        </PermBtn>
                        <PermBtn perm="training.update"
                          onClick={() => run(() => actions.renewTraining(r.id), () => `Training ${r.id} (${r.type}) renewed — valid until ${fmtDate(addDays(DEMO_TODAY, 730))}.`)}
                          className="btn-primary !bg-white !text-amber-700 border border-amber-200 !py-1 !px-2.5 !text-[11px]">
                          Renew
                        </PermBtn>
                        <button onClick={() => downloadCert(db, worker, r)}
                          title="Download demo certificate" aria-label={`Download certificate ${r.certificationNumber}`}
                          className="w-7 h-7 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-300 text-navy flex items-center justify-center">
                          <Download size={13} />
                        </button>
                        {!r.verified && <span className="text-[11px] text-slate-400 ml-1">Pending verification</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-[11px] text-slate-400 mt-2">
              Status is derived from the dates and the verification flag — an expired certificate can never present as Valid.
            </p>
          </div>
        );

      case 'Access History':
        return (
          <div>
            {accessHistory.length === 0 ? (
              <EmptyState title="No gate events" sub="No access records exist for this worker in the current dataset." />
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="dense w-full min-w-[600px]">
                  <thead>
                    <tr><th>Time</th><th>Gate</th><th>Direction</th><th>Status</th><th>Reason</th></tr>
                  </thead>
                  <tbody>
                    {accessHistory.map((a) => (
                      <tr key={a.id}>
                        <td className="whitespace-nowrap text-[12px]">{fmtDateTime(a.timestamp)}</td>
                        <td className="text-[12px]">{a.gate}</td>
                        <td className="text-[12px]">{a.direction}</td>
                        <td><Pill v={a.status} /></td>
                        <td className="text-[12px]">{a.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-[11px] text-slate-400 mt-2">
              Gate decisions (allow / deny / block) are made on the Attendance &amp; Access page; this history is read-only.
            </p>
          </div>
        );

      case 'Transfers':
        return (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[12px] text-slate-500">{transfers.length} request{transfers.length === 1 ? '' : 's'}</span>
              <PermBtn perm="worker.transfer.request" onClick={() => onTransfer(worker.id)} className="btn-primary !py-1.5 !px-3 !text-[12px] ml-auto">
                <span className="flex items-center gap-1.5"><Send size={13} /> Request Transfer</span>
              </PermBtn>
            </div>
            {transfers.length === 0 ? (
              <EmptyState title="No transfer requests" sub="This worker has not been part of a transfer request." />
            ) : (
              <div className="space-y-2">
                {transfers.map((t) => (
                  <div key={t.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[12px] font-bold text-navy">{t.id}</span>
                      <Pill v={t.status} />
                      <span className="ml-auto text-[11px] text-slate-400">{fmtDate(t.requestDate)}</span>
                    </div>
                    <div className="text-[12px] text-slate-600 mt-1">
                      {mineCode(t.fromMineId)} → <strong>{mineCode(t.toMineId)}</strong> · {t.toDepartment}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{t.reason}</div>
                    {t.decidedOn && (
                      <div className="text-[11px] text-slate-400 mt-0.5">{t.status} on {fmtDate(t.decidedOn)} by {t.decidedBy}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'Documents':
        return (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[12px] text-slate-500">{docs.length} document{docs.length === 1 ? '' : 's'} attached</span>
              <PermBtn perm="document.upload" onClick={() => setUploadOpen(true)} className="btn-primary !py-1.5 !px-3 !text-[12px] ml-auto">
                <span className="flex items-center gap-1.5"><Upload size={13} /> Upload Document</span>
              </PermBtn>
            </div>
            {docs.length === 0 ? (
              <EmptyState title="No documents" sub="No compliance documents are attached to this worker yet." />
            ) : (
              <div className="space-y-2">
                {docs.map((d) => {
                  const days = daysUntil(d.expiryDate);
                  return (
                    <div key={d.id} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-start gap-2">
                        <span className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0"><FileText size={14} /></span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-bold text-navy truncate">{d.name}</div>
                          <div className="text-[11px] text-slate-500">{d.id} · {d.category} · {fmtSize(d.sizeKb * 1024)}</div>
                          <div className={`text-[11px] font-semibold ${days !== null && days < 0 ? 'text-red-500' : days !== null && days <= 60 ? 'text-amber-600' : 'text-slate-400'}`}>
                            Expires {fmtDate(d.expiryDate)} · {days === null || days < 0 ? 'lapsed' : `${days} days left`}
                          </div>
                        </div>
                        <button onClick={() => downloadDoc(d)} title={`Download ${d.id}`} aria-label={`Download ${d.id}`}
                          className="w-7 h-7 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-300 text-navy flex items-center justify-center shrink-0">
                          <Download size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );

      case 'Activity':
      default:
        return (
          <div>
            {activity.length === 0 ? (
              <EmptyState title="No logged actions yet"
                sub="Deployment changes, training renewals, transfers and status changes for this worker will appear here." />
            ) : (
              <div className="space-y-2">
                {activity.map((a) => (
                  <div key={a.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center gap-2">
                      <span className="badge bg-slate-100 text-slate-600">{a.kind}</span>
                      <span className="ml-auto text-[11px] text-slate-400">{relTime(a.timestamp)}</span>
                    </div>
                    <div className="text-[12px] text-slate-700 mt-1">{a.description}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">by {a.user} · {fmtDateTime(a.timestamp)}</div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11px] text-slate-400 mt-2">
              Activity is derived from the append-only store log — entries are never edited or deleted.
            </p>
          </div>
        );
    }
  }

  return (
    <DetailDrawer title={`${worker.name} (${worker.id})`} onClose={onClose} wide>
      {/* Identity strip */}
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 mb-3">
        <Avatar name={worker.name} id={worker.id} size={10} />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-bold text-navy truncate">{contractorName(worker.contractorId)}</div>
          <div className="text-[11px] text-slate-500">{worker.designation} · {worker.department} · {mineLabel(worker.mineId)}</div>
        </div>
        <div className="flex flex-col gap-1 items-end">
          <Pill v={worker.status} />
          <Pill v={worst} />
        </div>
      </div>

      {/* Drawer tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200 mb-3">
        {DRAWER_TABS.map((t) => (
          <button key={t} role="tab" aria-selected={t === dtab} onClick={() => setDtab(t)}
            className={`px-3 py-2 text-[12px] font-bold whitespace-nowrap border-b-2 -mb-px transition
              ${t === dtab ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-navy'}`}>
            {t}
          </button>
        ))}
      </div>

      {err && <ErrBar msg={err} onClose={clear} />}
      {notice && <OkBar msg={notice} onClose={clear} />}

      {section()}

      {/* Drawer-level dialogs */}
      {confirmStatus && (
        <ConfirmDialog
          title={confirmStatus === WorkerStatus.Active ? 'Reactivate worker?' : 'Deactivate worker?'}
          body={confirmStatus === WorkerStatus.Active
            ? `Reactivate ${worker.name} (${worker.id})? The worker becomes deployable again and appears in Active counts. No historical records are changed.`
            : `Deactivate ${worker.name} (${worker.id})? The worker will be marked Inactive and excluded from deployment and Active counts. Attendance, training, access and transfer history are NOT deleted — they stay visible in this panel and in the audit trail. You can reactivate the worker at any time.`}
          confirmLabel={confirmStatus === WorkerStatus.Active ? 'Reactivate worker' : 'Deactivate worker'}
          onCancel={() => setConfirmStatus(null)}
          onConfirm={() => {
            run(() => actions.setWorkerStatus(worker.id, confirmStatus),
              () => `Worker ${worker.id} set to ${confirmStatus}. History retained.`);
            setConfirmStatus(null);
          }}
        />
      )}
      {deployOpen && <DeployModal db={db} worker={worker} onClose={() => setDeployOpen(false)} />}
      {trainingOpen && <TrainingModal workerId={worker.id} onClose={() => setTrainingOpen(false)} />}
      {uploadOpen && (
        <UploadDocModal db={db} initial={{ category: 'Worker Documents', relatedType: 'worker', relatedId: worker.id, mineId: worker.mineId }}
          onClose={() => setUploadOpen(false)} />
      )}
    </DetailDrawer>
  );
}
