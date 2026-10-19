'use client';
/**
 * MineNetr contractor portal — Attendance & Access (design reference page 4).
 *
 * Five views over the one centralized workforce store:
 *  - Daily Attendance — live attendance table (status / in / out / worked /
 *    method / training validity / access status) with Mark Present / Absent /
 *    On Leave row actions behind a confirmation and a manual-entry checkbox;
 *  - Access Logs — gate events with Approve / Deny / Revoke, each requiring a
 *    reason and going through actions.decideAccess (audited);
 *  - Training Status — workers grouped by their WORST certification (Donut),
 *    with Renew (store action) and Download Certificate (real .txt file);
 *  - Leave Management — leave pipeline with Approve / Reject / Cancel;
 *  - Gate Passes — gate pass register with Issue / Use / Revoke.
 *
 * Above the tabs sit five KPI cards (each one jumps to the relevant tab and/or
 * applies its filter) and a reporting-period attendance trend; clicking a bar
 * selects that date in the Daily Attendance table. PageToolbar exports whatever
 * is CURRENTLY filtered on screen as a real CSV.
 *
 * Everything reads the store — no record data is hardcoded here. Where the
 * store has no action yet (leave decisions, gate passes) the behaviour is a
 * clearly-labelled LOCAL demo state that always asks for confirmation and says
 * so inline.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Ban, CalendarDays, Download, LogIn, LogOut, Plus, RefreshCw,
  UserCheck, UserX, Users,
} from 'lucide-react';
import { ContractorShell } from './shell';
import {
  Avatar, DataTable, Donut, Field, KpiCard, Kv, Modal, PageToolbar, PermBtn,
  PeriodSelect, Pill, SearchInput, SectionCard, SoftPill, StackedBars,
  type Column,
} from './ui';
import { ConfirmDialog, Tabs } from '../operations/ui';
import { CHART } from '../operations/hooks';
import {
  actions, attendanceTrend, can, canReason, computeKpis, contractorName,
  derivedAttendance, indexTraining, mineCode, mineLabel, toast, useMockWorkforce,
  worstTraining,
} from '../../lib/workforce/store';
import { certificateText, exportCsv, exportText } from '../../lib/workforce/export';
import {
  addDays, daysUntil, fmtDate, fmtDateTime, periodLabel, trainingStatusOf,
  workedLabel,
} from '../../lib/workforce/format';
import {
  AccessStatus, AttendanceStatus, DEPARTMENTS, DEMO_TODAY, GATES,
  type AccessRecord, type AttendanceRecord, type GatePass, type LeaveRecord,
  type Permission, type TrainingRecord, type Worker,
} from '../../lib/workforce/types';
import { mines } from '../../lib/workforce/seed';

// ---------- Constants ----------
const TABS = [
  'Daily Attendance', 'Access Logs', 'Training Status', 'Leave Management', 'Gate Passes',
];

/** Reporting period → number of days fed to attendanceTrend(). */
const PERIODS: Record<string, number> = {
  'Last 7 Days': 7, 'Last 14 Days': 14, 'Last 30 Days': 30, 'Last 90 Days': 90,
};

/** Stacked attendance trend series (Present / Absent / On Leave / Not Marked). */
const SERIES = [
  { key: 'present', name: 'Present', fill: CHART.green },
  { key: 'absent', name: 'Absent', fill: CHART.red },
  { key: 'leave', name: 'On Leave', fill: CHART.cyan },
  { key: 'notMarked', name: 'Not Marked', fill: CHART.slate },
];

const RISK_STATUSES = ['Expired', 'Expiring Soon', 'Pending Verification'];

const DONUT_COLORS: Record<string, string> = {
  Valid: CHART.green,
  'Expiring Soon': CHART.amber,
  Expired: CHART.red,
  'Pending Verification': CHART.slate,
  'No Training': CHART.lightBlue,
};

/** Honest, always-visible label for the actions the store cannot persist yet. */
const DEMO_NOTE = 'Every decision below is written to the centralized store and recorded in the audit trail.';

const LEAVE_STATUSES = ['ALL', 'Pending', 'Approved', 'Rejected', 'Completed', 'Cancelled'];
const PASS_STATUSES = ['ALL', 'Issued', 'Used', 'Expired', 'Revoked'];

const PASS_PURPOSES = [
  'Material gate pass — spares movement',
  'Vehicle exit for workshop repair',
  'Contractor staff transport',
  'Tool and tackle movement',
  'Visitor accompanied entry',
  'Explosives van escorted movement',
];

// ---------- Types ----------
interface AttRow {
  id: string;
  worker: Worker;
  status: AttendanceStatus;
  inTime: string;
  outTime: string;
  gate: string;
  method: 'Biometric' | 'Manual';
  /** A real (mutable) attendance row exists for the selected date. */
  live: boolean;
  training: string;
  trainingRecord?: TrainingRecord;
  access: string;
}

type AccessRow = AccessRecord & { worker?: Worker };
type LeaveRow = Omit<LeaveRecord, 'status'> & {
  status: LeaveRecord['status'] | 'Cancelled';
  worker?: Worker;
};
type PassRow = GatePass & { worker?: Worker };
interface TrainRow {
  id: string;
  worker: Worker;
  worst: string;
  record?: TrainingRecord;
  certCount: number;
}
interface IssueDraft {
  workerId: string;
  vehicle: string;
  purpose: string;
  issuedOn: string;
  validTill: string;
}

// ---------- Helpers ----------
function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Tooltip that explains a disabled control (permission reason wins). */
function permHint(perm: Permission, hint: string): string {
  return can(perm) ? hint : canReason(perm);
}

/** The certification record that represents a worker's worst status. */
function pickWorstRecord(recs: TrainingRecord[] | undefined, worst: string): TrainingRecord | undefined {
  if (!recs || recs.length === 0) return undefined;
  const matches = recs.filter((r) => trainingStatusOf(r) === worst);
  const pool = matches.length ? matches : recs;
  return [...pool].sort((a, b) => Number(b.mandatory) - Number(a.mandatory))[0];
}

function MethodBadge({ method }: { method: 'Biometric' | 'Manual' }) {
  return method === 'Manual' ? (
    <span className="badge bg-purple-100 text-purple-700"
      title="Manually keyed entry — this row was never captured by a biometric device">
      ✎ Manual
    </span>
  ) : (
    <span className="badge bg-slate-100 text-slate-600"
      title="Captured at the gate biometric terminal (simulated in this demo)">
      ◎ Biometric
    </span>
  );
}

/** Compact labelled select used across the filter rows. */
function Select({
  label, value, onChange, options, width = '!w-44',
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: { v: string; l: string }[]; width?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold text-slate-500 mb-1">{label}</span>
      <select className={`input ${width} !py-2 !text-[13px]`} value={value}
        onChange={(e) => onChange(e.target.value)} aria-label={label}>
        {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </label>
  );
}

/** Chip + clear button helper for the active-filter row. */
function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="badge bg-blue-50 text-blue-700 border border-blue-100 pl-2.5 pr-1.5 py-1">
      {label}
      <button onClick={onClear} aria-label={`Remove ${label}`} className="ml-1 text-blue-400 hover:text-blue-700">✕</button>
    </span>
  );
}
// ---------- Access decision modal (reason is mandatory + audited) ----------
function AccessDecisionModal({
  record, target, onClose,
}: { record: AccessRecord; target: AccessStatus; onClose: () => void }) {
  const db = useMockWorkforce();
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  const worker = db.workers.find((w) => w.id === record.workerId);
  const label = target === AccessStatus.Allowed ? 'Approve Access'
    : target === AccessStatus.Denied ? 'Deny Access' : 'Revoke Access';

  function submit() {
    if (!reason.trim()) { setErr('A reason is required for every access decision.'); return; }
    setErr('');
    try {
      actions.decideAccess(record.id, target, reason);
      onClose();
    } catch (e) { setErr(msg(e)); }
  }

  return (
    <Modal title={`${label} — ${record.id}`} onClose={onClose}>
      <div className="rounded-xl border border-slate-200 p-3 mb-3">
        <Kv k="Worker" v={`${worker?.name ?? record.workerId} (${record.workerId})`} />
        <Kv k="Contractor" v={contractorName(record.contractorId)} />
        <Kv k="Gate event" v={`${fmtDateTime(record.timestamp)} · ${record.gate} · ${record.direction}`} />
        <Kv k="Current status" v={<Pill v={record.status} />} />
        <Kv k="New status" v={<Pill v={target} />} />
      </div>
      <Field label="Reason (required)" error={err}
        hint="Stored on the access record and written to the audit trail with your actor name and timestamp.">
        <textarea className="input min-h-[84px]" value={reason}
          onChange={(e) => { setReason(e.target.value); if (err) setErr(''); }}
          placeholder="e.g. PPE + induction certificate verified at the gate — override approved by shift supervisor" />
      </Field>
      <p className="text-[11px] leading-relaxed text-slate-600 bg-blue-50 border border-blue-100 rounded-xl p-2.5 mb-4">
        A decision records an <strong>audited gate decision</strong> against this event — actor, reason and
        decision time are logged. It does <strong>not</strong> silently rewrite history: the event timestamp,
        gate and direction stay exactly as recorded, and the previous status remains visible in the audit log.
      </p>
      <div className="flex gap-2 justify-end">
        <button className="btn-primary !bg-white !text-navy border border-slate-300" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={submit}>{label}</button>
      </div>
    </Modal>
  );
}

// ---------- Page ----------
export function AttendanceAccess() {
  const db = useMockWorkforce();

  // --- View state ---
  const [tab, setTab] = useState<string>('Daily Attendance');
  const [period, setPeriod] = useState('Last 7 Days');
  const [selectedDate, setSelectedDate] = useState<string>(DEMO_TODAY);
  const [query, setQuery] = useState('');
  const [applied, setApplied] = useState('');
  const [attF, setAttF] = useState({ status: 'ALL', gate: 'ALL', dept: 'ALL' });
  const [accF, setAccF] = useState({ status: 'ALL', gate: 'ALL' });
  const [leaveF, setLeaveF] = useState({ status: 'ALL' });
  const [passF, setPassF] = useState({ status: 'ALL' });
  const [trainPick, setTrainPick] = useState<string | null>(null);
  /** Manual entries are the DEFAULT — a supervisor keying a mark is never biometric. */
  const [manual, setManual] = useState(true);
  const [error, setError] = useState('');

  // --- Overlay state ---
  const [markReq, setMarkReq] = useState<{ worker: Worker; status: AttendanceStatus } | null>(null);
  const [decReq, setDecReq] = useState<{ record: AccessRecord; target: AccessStatus } | null>(null);
  const [renewReq, setRenewReq] = useState<{ record: TrainingRecord; worker: Worker } | null>(null);
  const [leaveReq, setLeaveReq] = useState<{ id: string; next: 'approve' | 'reject' | 'cancel'; label: string } | null>(null);
  const [passReq, setPassReq] = useState<{ id: string; next: 'Used' | 'Revoked' } | null>(null);
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueConfirm, setIssueConfirm] = useState<IssueDraft | null>(null);
  const [issueErr, setIssueErr] = useState<{ workerId?: string; vehicle?: string; validTill?: string }>({});
  const [issueForm, setIssueForm] = useState({
    workerId: '', vehicle: '', purpose: PASS_PURPOSES[0],
    issuedOn: DEMO_TODAY, validTill: addDays(DEMO_TODAY, 3),
  });

  /** Store actions throw human-readable Errors — surface them inline, never alert(). */
  function run(fn: () => void): boolean {
    try { fn(); setError(''); return true; }
    catch (e) { setError((e as Error).message); return false; }
  }

  // Deep links from store-generated notifications and the Dashboard:
  //   /contractor/attendance?tab=Access%20Logs  ·  ?tab=Leave%20Management
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('tab');
    if (raw && TABS.includes(raw)) setTab(raw);
  }, []);

  // --- Derived (single source of truth: the store) ---
  const days = PERIODS[period] ?? 7;
  const kpis = useMemo(() => computeKpis(db), [db]);
  const tIndex = useMemo(() => indexTraining(db), [db]);
  const trend = useMemo(
    () => attendanceTrend(db, days, db.selectedMineId),
    [db, days, db.selectedMineId],
  );
  const scope = useMemo(
    () => db.workers.filter((w) => db.selectedMineId === 'ALL' || w.mineId === db.selectedMineId),
    [db.workers, db.selectedMineId],
  );
  const workerMap = useMemo(() => new Map(db.workers.map((w) => [w.id, w] as const)), [db.workers]);
  const attByWorker = useMemo(() => {
    const m = new Map<string, AttendanceRecord>();
    for (const a of db.attendance) if (a.date === DEMO_TODAY) m.set(a.workerId, a);
    return m;
  }, [db.attendance]);
  const accessByDate = useMemo(() => {
    const m = new Map<string, AccessRecord>();
    for (const a of db.access) if (a.timestamp.startsWith(selectedDate)) m.set(a.workerId, a);
    return m;
  }, [db.access, selectedDate]);
  const nameOf = (id: string) => workerMap.get(id)?.name ?? id;

  const needle = applied.trim().toLowerCase();

  const attRows = useMemo(() => {
    const out: AttRow[] = [];
    for (const w of scope) {
      let status: AttendanceStatus;
      let inTime: string; let outTime: string; let gate: string;
      let method: 'Biometric' | 'Manual';
      let live = false;
      if (selectedDate === DEMO_TODAY) {
        const rec = attByWorker.get(w.id);
        if (rec) {
          status = rec.status; inTime = rec.inTime; outTime = rec.outTime;
          gate = rec.gate; method = rec.method; live = true;
        } else {
          status = AttendanceStatus.NotMarked; inTime = '—'; outTime = '—';
          gate = '—'; method = 'Biometric';
        }
      } else {
        const d = derivedAttendance(w, selectedDate);
        status = d.status; inTime = d.inTime; outTime = d.outTime;
        gate = d.gate; method = d.method;
      }
      if (attF.status !== 'ALL' && status !== attF.status) continue;
      if (attF.gate !== 'ALL' && gate !== attF.gate) continue;
      if (attF.dept !== 'ALL' && w.department !== attF.dept) continue;
      if (needle) {
        const hay = `${w.id} ${w.name} ${contractorName(w.contractorId)} ${w.designation}`.toLowerCase();
        if (!hay.includes(needle)) continue;
      }
      const recs = tIndex.get(w.id);
      const worst = worstTraining(recs);
      const acc = accessByDate.get(w.id);
      out.push({
        id: w.id, worker: w, status, inTime, outTime, gate, method, live,
        training: worst, trainingRecord: pickWorstRecord(recs, worst),
        access: acc ? acc.status : 'No Record',
      });
    }
    return out;
  }, [scope, selectedDate, attByWorker, accessByDate, attF, needle, tIndex]);

  const accRows = useMemo(() => {
    const rows = db.access
      .filter((a) => db.selectedMineId === 'ALL' || a.mineId === db.selectedMineId)
      .filter((a) => accF.status === 'ALL' || a.status === accF.status)
      .filter((a) => accF.gate === 'ALL' || a.gate === accF.gate)
      .filter((a) => {
        if (!needle) return true;
        const hay = `${a.id} ${a.workerId} ${workerMap.get(a.workerId)?.name ?? ''} ${contractorName(a.contractorId)} ${a.gate} ${a.reason}`.toLowerCase();
        return hay.includes(needle);
      })
      .map((a): AccessRow => ({ ...a, worker: workerMap.get(a.workerId) }));
    return rows.sort((a, b) => (a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0));
  }, [db.access, db.selectedMineId, accF, needle, workerMap]);

  const trainRows = useMemo(() => {
    const out: TrainRow[] = [];
    for (const w of scope) {
      const recs = tIndex.get(w.id);
      const worst = worstTraining(recs);
      const inGroup = trainPick
        ? worst === trainPick
        : RISK_STATUSES.includes(worst);
      if (!inGroup) continue;
      if (needle) {
        const hay = `${w.id} ${w.name} ${contractorName(w.contractorId)} ${w.designation}`.toLowerCase();
        if (!hay.includes(needle)) continue;
      }
      out.push({ id: w.id, worker: w, worst, record: pickWorstRecord(recs, worst), certCount: recs?.length ?? 0 });
    }
    return out;
  }, [scope, tIndex, trainPick, needle]);

  const donutData = useMemo(() => {
    const counts: Record<string, number> = {
      Valid: 0, 'Expiring Soon': 0, Expired: 0, 'Pending Verification': 0, 'No Training': 0,
    };
    for (const w of scope) counts[worstTraining(tIndex.get(w.id))] += 1;
    return Object.keys(counts)
      .map((name) => ({ name, value: counts[name], color: DONUT_COLORS[name] }))
      .filter((d) => d.value > 0);
  }, [scope, tIndex]);
  const needAction = donutData
    .filter((d) => RISK_STATUSES.includes(d.name))
    .reduce((s, d) => s + d.value, 0);

  const leaveRows = useMemo(() => {
    const rows = db.leaves
      .map((l): LeaveRow => ({ ...l, worker: workerMap.get(l.workerId) }))
      .filter((l) => l.worker && (db.selectedMineId === 'ALL' || l.worker.mineId === db.selectedMineId))
      .filter((l) => leaveF.status === 'ALL' || l.status === leaveF.status)
      .filter((l) => !needle
        || `${l.id} ${l.workerId} ${l.worker?.name ?? ''} ${l.type} ${l.reason}`.toLowerCase().includes(needle));
    return rows;
  }, [db.leaves, db.selectedMineId, leaveF, needle, workerMap]);

  const passRows = useMemo(() => {
    const rows = db.gatePasses
      .map((g): PassRow => ({ ...g, worker: workerMap.get(g.workerId) }))
      .filter((g) => g.worker && (db.selectedMineId === 'ALL' || g.worker.mineId === db.selectedMineId))
      .filter((g) => passF.status === 'ALL' || g.status === passF.status)
      .filter((g) => !needle
        || `${g.id} ${g.workerId} ${g.worker?.name ?? ''} ${g.vehicle} ${g.purpose}`.toLowerCase().includes(needle));
    return rows;
  }, [db.gatePasses, db.selectedMineId, passF, needle, workerMap]);

  const trendData = useMemo(
    () => trend.map((d) => ({ ...d, tick: `${d.label.slice(8)} ${fmtDate(d.label).slice(3, 6)}` })),
    [trend],
  );

  const workerOptions = useMemo(
    () => [...scope].sort((a, b) => a.name.localeCompare(b.name)),
    [scope],
  );

  const leaveRec = leaveReq ? db.leaves.find((l) => l.id === leaveReq.id) ?? null : null;
  const periodText = periodLabel(addDays(DEMO_TODAY, -(days - 1)), DEMO_TODAY);
  // ---------- Handlers ----------
  function kpiGo(kind: 'total' | 'present' | 'absent' | 'leave' | 'blocked') {
    if (kind === 'blocked') {
      setTab('Access Logs');
      setAccF({ status: AccessStatus.Blocked, gate: 'ALL' });
      return;
    }
    setTab('Daily Attendance');
    setSelectedDate(DEMO_TODAY);
    setAttF((f) => ({
      ...f,
      status: kind === 'total' ? 'ALL'
        : kind === 'present' ? AttendanceStatus.Present
          : kind === 'absent' ? AttendanceStatus.Absent
            : AttendanceStatus.OnLeave,
    }));
  }

  function resetFilters() {
    setQuery(''); setApplied('');
    if (tab === 'Daily Attendance') {
      setAttF({ status: 'ALL', gate: 'ALL', dept: 'ALL' });
      setSelectedDate(DEMO_TODAY);
    } else if (tab === 'Access Logs') setAccF({ status: 'ALL', gate: 'ALL' });
    else if (tab === 'Leave Management') setLeaveF({ status: 'ALL' });
    else if (tab === 'Gate Passes') setPassF({ status: 'ALL' });
    else setTrainPick(null);
  }

  function downloadCert(rec: TrainingRecord, w: Worker) {
    setError('');
    try {
      exportText(`${rec.id}_${w.id}_certificate.txt`, certificateText({
        workerName: w.name,
        workerId: w.id,
        contractor: contractorName(w.contractorId),
        trainingType: String(rec.type),
        completionDate: fmtDate(rec.completionDate),
        expiryDate: fmtDate(rec.expiryDate),
        certificateNumber: rec.certificationNumber,
        provider: rec.provider,
      }));
      toast(`Certificate ${rec.certificationNumber} downloaded (demo file).`);
    } catch (e) { setError(msg(e)); }
  }

  /** Real CSV of whatever is filtered on screen, scoped to the active tab. */
  function handleExport() {
    setError('');
    try {
      let n = 0;
      if (tab === 'Access Logs') {
        if (!accRows.length) { toast('No access-log rows to export — the current filters returned 0 records.'); return; }
        n = exportCsv(`minenetr-access-logs-${DEMO_TODAY}`, accRows, [
          ['Record ID', (r) => r.id],
          ['Timestamp', (r) => fmtDateTime(r.timestamp)],
          ['Worker ID', (r) => r.workerId],
          ['Worker Name', (r) => r.worker?.name ?? ''],
          ['Contractor', (r) => contractorName(r.contractorId)],
          ['Assigned Mine', (r) => mineLabel(r.mineId)],
          ['Gate', (r) => r.gate],
          ['Direction', (r) => r.direction],
          ['Status', (r) => r.status],
          ['Reason', (r) => r.reason],
        ]);
      } else if (tab === 'Training Status') {
        if (!trainRows.length) { toast('No training rows to export — the current filters returned 0 records.'); return; }
        n = exportCsv(`minenetr-training-status-${DEMO_TODAY}`, trainRows, [
          ['Worker ID', (r) => r.worker.id],
          ['Worker Name', (r) => r.worker.name],
          ['Designation', (r) => r.worker.designation],
          ['Assigned Mine', (r) => mineLabel(r.worker.mineId)],
          ['Worst Training Status', (r) => r.worst],
          ['Certifications Held', (r) => r.certCount],
          ['Representative Certification', (r) => r.record ? String(r.record.type) : ''],
          ['Completion Date', (r) => fmtDate(r.record?.completionDate)],
          ['Expiry Date', (r) => fmtDate(r.record?.expiryDate)],
          ['Provider', (r) => r.record?.provider ?? ''],
        ]);
      } else if (tab === 'Leave Management') {
        if (!leaveRows.length) { toast('No leave rows to export — the current filters returned 0 records.'); return; }
        n = exportCsv(`minenetr-leave-records-${DEMO_TODAY}`, leaveRows, [
          ['Leave ID', (r) => r.id],
          ['Worker ID', (r) => r.workerId],
          ['Worker Name', (r) => r.worker?.name ?? ''],
          ['Type', (r) => r.type],
          ['From', (r) => fmtDate(r.from)],
          ['To', (r) => fmtDate(r.to)],
          ['Reason', (r) => r.reason],
          ['Applied On', (r) => fmtDate(r.appliedOn)],
          ['Status', (r) => r.status],
        ]);
      } else if (tab === 'Gate Passes') {
        if (!passRows.length) { toast('No gate-pass rows to export — the current filters returned 0 records.'); return; }
        n = exportCsv(`minenetr-gate-passes-${DEMO_TODAY}`, passRows, [
          ['Pass ID', (r) => r.id],
          ['Worker ID', (r) => r.workerId],
          ['Worker Name', (r) => r.worker?.name ?? ''],
          ['Vehicle', (r) => r.vehicle],
          ['Purpose', (r) => r.purpose],
          ['Issued On', (r) => fmtDate(r.issuedOn)],
          ['Valid Till', (r) => fmtDate(r.validTill)],
          ['Status', (r) => r.status],
        ]);
      } else {
        if (!attRows.length) { toast('No attendance rows to export — the current filters returned 0 records.'); return; }
        n = exportCsv(`minenetr-daily-attendance-${selectedDate}`, attRows, [
          ['Date', () => selectedDate],
          ['Worker ID', (r) => r.worker.id],
          ['Worker Name', (r) => r.worker.name],
          ['Contractor', (r) => contractorName(r.worker.contractorId)],
          ['Designation', (r) => r.worker.designation],
          ['Department', (r) => r.worker.department],
          ['Assigned Mine', (r) => mineLabel(r.worker.mineId)],
          ['Status', (r) => r.status],
          ['In Time', (r) => r.inTime],
          ['Out Time', (r) => r.outTime],
          ['Worked', (r) => workedLabel(r.inTime, r.outTime)],
          ['Method', (r) => r.method],
          ['Gate', (r) => r.gate],
          ['Training Validity', (r) => r.training],
          ['Access Status', (r) => r.access],
        ]);
      }
      toast(`Exported ${n} row${n === 1 ? '' : 's'} → ${tab} CSV (search, filters and mine scope applied).`);
    } catch (e) { setError(msg(e)); }
  }

  function validateIssue() {
    const e: { workerId?: string; vehicle?: string; validTill?: string } = {};
    if (!issueForm.workerId) e.workerId = 'Select the worker this pass is issued to.';
    if (issueForm.vehicle.trim().length < 4) e.vehicle = 'Enter the vehicle registration number (e.g. CG-12-A-1194).';
    if (issueForm.validTill < issueForm.issuedOn) e.validTill = 'Valid-till must be on or after the issue date.';
    setIssueErr(e);
    if (Object.keys(e).length) return;
    setIssueConfirm({ ...issueForm });
  }
  // ---------- Columns ----------
  const attColumns: Column<AttRow>[] = [
    {
      key: 'id', header: 'Worker ID', sortValue: (r) => r.worker.id,
      render: (r) => <span className="font-mono text-[12px] font-bold text-navy">{r.worker.id}</span>,
    },
    {
      key: 'name', header: 'Worker Name', sortValue: (r) => r.worker.name,
      render: (r) => (
        <span className="flex items-center gap-2">
          <Avatar name={r.worker.name} id={r.worker.id} size={7} />
          <span className="font-semibold text-navy whitespace-nowrap">{r.worker.name}</span>
        </span>
      ),
    },
    { key: 'role', header: 'Role / Skill', sortValue: (r) => r.worker.designation, render: (r) => r.worker.designation },
    {
      key: 'mine', header: 'Assigned Mine', sortValue: (r) => mineCode(r.worker.mineId),
      render: (r) => <span title={mineLabel(r.worker.mineId)}>{mineCode(r.worker.mineId)}</span>,
    },
    {
      key: 'status', header: selectedDate === DEMO_TODAY ? "Today's Status" : 'Status',
      sortValue: (r) => r.status, render: (r) => <Pill v={r.status} />,
    },
    { key: 'in', header: 'In Time', sortValue: (r) => r.inTime, render: (r) => r.inTime },
    { key: 'out', header: 'Out Time', sortValue: (r) => r.outTime, render: (r) => r.outTime },
    {
      key: 'worked', header: 'Worked', sortValue: (r) => workedLabel(r.inTime, r.outTime),
      render: (r) => <span className="font-semibold whitespace-nowrap">{workedLabel(r.inTime, r.outTime)}</span>,
    },
    {
      key: 'method', header: 'Method', sortValue: (r) => r.method,
      render: (r) => <MethodBadge method={r.method} />,
    },
    {
      key: 'training', header: 'Training Validity', sortValue: (r) => r.training,
      render: (r) => (
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <Pill v={r.training} />
          {r.trainingRecord && <span className="text-[11px] text-slate-400">({fmtDate(r.trainingRecord.expiryDate)})</span>}
        </span>
      ),
    },
    {
      key: 'access', header: 'Access Status', sortValue: (r) => r.access,
      render: (r) => (r.access === 'No Record' ? <SoftPill v="No Record" /> : <Pill v={r.access} />),
    },
  ];

  const accColumns: Column<AccessRow>[] = [
    {
      key: 'ts', header: 'Timestamp', sortValue: (r) => r.timestamp,
      render: (r) => (
        <span className="block whitespace-nowrap">
          <span>{fmtDateTime(r.timestamp)}</span>
          <span className="block text-[11px] text-slate-400 font-mono">{r.id}</span>
        </span>
      ),
    },
    {
      key: 'worker', header: 'Worker', sortValue: (r) => r.worker?.name ?? r.workerId,
      render: (r) => (
        <span className="flex items-center gap-2">
          <Avatar name={r.worker?.name ?? r.workerId} id={r.workerId} size={7} />
          <span className="min-w-0">
            <span className="block font-semibold text-navy whitespace-nowrap">{r.worker?.name ?? r.workerId}</span>
            <span className="block text-[11px] text-slate-400 font-mono">{r.workerId}</span>
          </span>
        </span>
      ),
    },
    {
      key: 'contractor', header: 'Contractor', sortValue: (r) => contractorName(r.contractorId),
      render: (r) => <span className="block max-w-[170px] truncate" title={contractorName(r.contractorId)}>{contractorName(r.contractorId)}</span>,
    },
    {
      key: 'mine', header: 'Mine', sortValue: (r) => mineCode(r.mineId),
      render: (r) => <span title={mineLabel(r.mineId)}>{mineCode(r.mineId)}</span>,
    },
    { key: 'gate', header: 'Gate', sortValue: (r) => r.gate, render: (r) => <span className="whitespace-nowrap">{r.gate}</span> },
    {
      key: 'dir', header: 'Direction', sortValue: (r) => r.direction,
      render: (r) => (
        <span className={`badge ${r.direction === 'Entry' ? 'bg-indigo-50 text-indigo-700' : 'bg-teal-50 text-teal-700'}`}>
          {r.direction === 'Entry' ? <LogIn size={12} /> : <LogOut size={12} />} {r.direction}
        </span>
      ),
    },
    { key: 'status', header: 'Status', sortValue: (r) => r.status, render: (r) => <Pill v={r.status} /> },
    {
      key: 'reason', header: 'Reason', sortValue: (r) => r.reason,
      render: (r) => <span className="block max-w-[260px]" title={r.reason}>{r.reason}</span>,
    },
  ];

  const trainColumns: Column<TrainRow>[] = [
    {
      key: 'name', header: 'Worker', sortValue: (r) => r.worker.name,
      render: (r) => (
        <span className="flex items-center gap-2">
          <Avatar name={r.worker.name} id={r.worker.id} size={7} />
          <span className="min-w-0">
            <span className="block font-semibold text-navy whitespace-nowrap">{r.worker.name}</span>
            <span className="block text-[11px] text-slate-400 font-mono">{r.worker.id}</span>
          </span>
        </span>
      ),
    },
    { key: 'role', header: 'Role / Skill', sortValue: (r) => r.worker.designation, render: (r) => r.worker.designation },
    {
      key: 'mine', header: 'Assigned Mine', sortValue: (r) => mineCode(r.worker.mineId),
      render: (r) => <span title={mineLabel(r.worker.mineId)}>{mineCode(r.worker.mineId)}</span>,
    },
    { key: 'certs', header: 'Certs', sortValue: (r) => r.certCount, render: (r) => `${r.certCount} held` },
    { key: 'worst', header: 'Status', sortValue: (r) => r.worst, render: (r) => <Pill v={r.worst} /> },
    {
      key: 'type', header: 'Certification', sortValue: (r) => (r.record ? String(r.record.type) : ''),
      render: (r) => (r.record ? String(r.record.type) : <span className="text-slate-400">—</span>),
    },
    {
      key: 'completed', header: 'Completed', sortValue: (r) => (r.record?.completionDate ?? ''),
      render: (r) => (r.record ? fmtDate(r.record.completionDate) : '—'),
    },
    {
      key: 'expiry', header: 'Expires', sortValue: (r) => (r.record?.expiryDate ?? ''),
      render: (r) => {
        if (!r.record) return '—';
        const d = daysUntil(r.record.expiryDate);
        return (
          <span className="whitespace-nowrap">
            {fmtDate(r.record.expiryDate)}
            <span className={`block text-[11px] ${d !== null && d < 0 ? 'text-red-500 font-semibold' : 'text-slate-400'}`}>
              {d === null ? 'no expiry' : d < 0 ? `expired ${Math.abs(d)}d ago` : `in ${d}d`}
            </span>
          </span>
        );
      },
    },
  ];

  const leaveColumns: Column<LeaveRow>[] = [
    { key: 'id', header: 'Leave ID', sortValue: (r) => r.id, render: (r) => <span className="font-mono text-[12px] font-bold text-navy">{r.id}</span> },
    {
      key: 'worker', header: 'Worker', sortValue: (r) => r.worker?.name ?? r.workerId,
      render: (r) => (
        <span className="flex items-center gap-2">
          <Avatar name={r.worker?.name ?? r.workerId} id={r.workerId} size={7} />
          <span className="min-w-0">
            <span className="block font-semibold text-navy whitespace-nowrap">{r.worker?.name ?? r.workerId}</span>
            <span className="block text-[11px] text-slate-400 font-mono">{r.workerId}</span>
          </span>
        </span>
      ),
    },
    { key: 'type', header: 'Type', sortValue: (r) => r.type, render: (r) => <span className="whitespace-nowrap">{r.type}</span> },
    {
      key: 'range', header: 'From – To', sortValue: (r) => r.from,
      render: (r) => <span className="whitespace-nowrap">{fmtDate(r.from)} → {fmtDate(r.to)}</span>,
    },
    {
      key: 'reason', header: 'Reason', sortValue: (r) => r.reason,
      render: (r) => <span className="block max-w-[220px] truncate" title={r.reason}>{r.reason}</span>,
    },
    { key: 'applied', header: 'Applied On', sortValue: (r) => r.appliedOn, render: (r) => <span className="whitespace-nowrap">{fmtDate(r.appliedOn)}</span> },
    { key: 'status', header: 'Status', sortValue: (r) => r.status, render: (r) => <Pill v={r.status} /> },
  ];

  const passColumns: Column<PassRow>[] = [
    { key: 'id', header: 'Pass ID', sortValue: (r) => r.id, render: (r) => <span className="font-mono text-[12px] font-bold text-navy">{r.id}</span> },
    {
      key: 'worker', header: 'Worker', sortValue: (r) => r.worker?.name ?? r.workerId,
      render: (r) => (
        <span className="flex items-center gap-2">
          <Avatar name={r.worker?.name ?? r.workerId} id={r.workerId} size={7} />
          <span className="min-w-0">
            <span className="block font-semibold text-navy whitespace-nowrap">{r.worker?.name ?? r.workerId}</span>
            <span className="block text-[11px] text-slate-400 font-mono">{r.workerId}</span>
          </span>
        </span>
      ),
    },
    { key: 'vehicle', header: 'Vehicle', sortValue: (r) => r.vehicle, render: (r) => <span className="font-mono text-[12px] font-semibold">{r.vehicle}</span> },
    {
      key: 'purpose', header: 'Purpose', sortValue: (r) => r.purpose,
      render: (r) => <span className="block max-w-[240px] truncate" title={r.purpose}>{r.purpose}</span>,
    },
    { key: 'issued', header: 'Issued On', sortValue: (r) => r.issuedOn, render: (r) => <span className="whitespace-nowrap">{fmtDate(r.issuedOn)}</span> },
    {
      key: 'valid', header: 'Valid Till', sortValue: (r) => r.validTill,
      render: (r) => (
        <span className="whitespace-nowrap">
          {fmtDate(r.validTill)}
          <span className={`block text-[11px] ${r.validTill < DEMO_TODAY && r.status === 'Issued' ? 'text-red-500 font-semibold' : 'text-slate-400'}`}>
            {r.validTill < DEMO_TODAY ? 'lapsed' : `in ${daysUntil(r.validTill) ?? 0}d`}
          </span>
        </span>
      ),
    },
    { key: 'status', header: 'Status', sortValue: (r) => r.status, render: (r) => <Pill v={r.status} /> },
  ];
  // ---------- Pre-render bits ----------
  const mineCount = new Set(scope.map((w) => w.mineId)).size;
  const presentRate = kpis.totalWorkers ? Math.round((kpis.presentToday / kpis.totalWorkers) * 100) : 0;
  const absentRate = kpis.totalWorkers ? Math.round((kpis.absentToday / kpis.totalWorkers) * 100) : 0;
  const leaveRate = kpis.totalWorkers ? Math.round((kpis.onLeave / kpis.totalWorkers) * 100) : 0;

  const searchPh = tab === 'Access Logs' ? 'Search worker, contractor, gate or reason…'
    : tab === 'Leave Management' ? 'Search leave ID, worker, type or reason…'
      : tab === 'Gate Passes' ? 'Search pass ID, worker, vehicle or purpose…'
        : 'Search by ID, name, contractor or role…';

  function markHint(r: AttRow, s: AttendanceStatus): string {
    if (!r.live) {
      return selectedDate === DEMO_TODAY
        ? 'No attendance row exists for this worker today.'
        : `Historical view — attendance can only be marked for ${fmtDate(DEMO_TODAY)}.`;
    }
    if (r.status === s) return `Already marked ${s} for ${fmtDate(selectedDate)}.`;
    return `Mark ${r.worker.name} (${r.worker.id}) as ${s} — recorded as ${manual ? 'a MANUAL entry, never biometric' : 'a biometric capture'}.`;
  }

  const markOptions: { s: AttendanceStatus; label: string; cls: string }[] = [
    { s: AttendanceStatus.Present, label: 'Present', cls: '!bg-emerald-600 hover:!bg-emerald-700' },
    { s: AttendanceStatus.Absent, label: 'Absent', cls: '!bg-red-500 hover:!bg-red-600' },
    { s: AttendanceStatus.OnLeave, label: 'On Leave', cls: '!bg-sky-600 hover:!bg-sky-700' },
  ];

  // ---------- Render ----------
  return (
    <ContractorShell
      title="Attendance & Access"
      sub="Track worker attendance, gate access and training eligibility across all assigned mines."
    >
      <PageToolbar period={periodText} onExport={handleExport} exportLabel={`Export ${tab} CSV`} />

      {/* KPI row — every card jumps to the matching tab + filter */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 mb-4">
        <KpiButton icon={<Users size={22} />} label="Total Registered Workers" value={kpis.totalWorkers}
          context={kpis.totalWorkers ? `Across ${mineCount} Mine${mineCount === 1 ? '' : 's'}` : 'No workers in scope'}
          dotColor="#1463D9" tileClass="bg-blue-50 text-blue-600"
          onClick={() => kpiGo('total')}
          hint="Open Daily Attendance with no status filter (every worker in scope)" />
        <KpiButton icon={<UserCheck size={22} />} label="Present Today" value={kpis.presentToday}
          context={`${presentRate}% attendance today`} dotColor="#159B72"
          tileClass="bg-emerald-50 text-emerald-600"
          onClick={() => kpiGo('present')}
          hint="Open Daily Attendance filtered to Present" />
        <KpiButton icon={<UserX size={22} />} label="Absent Today" value={kpis.absentToday}
          context={`${absentRate}% of scope`} dotColor="#E8A02B"
          tileClass="bg-amber-50 text-amber-600"
          onClick={() => kpiGo('absent')}
          hint="Open Daily Attendance filtered to Absent" />
        <KpiButton icon={<CalendarDays size={22} />} label="On Leave" value={kpis.onLeave}
          context={`${leaveRate}% of scope`} dotColor="#DC4C58"
          tileClass="bg-rose-50 text-rose-600"
          onClick={() => kpiGo('leave')}
          hint="Open Daily Attendance filtered to On Leave" />
        <KpiButton icon={<Ban size={22} />} label="Access Blocked" value={kpis.accessBlocked}
          context="Due to expiry / non-compliance" dotColor="#7C5CFC"
          tileClass="bg-violet-50 text-violet-600"
          onClick={() => kpiGo('blocked')}
          hint="Open Access Logs filtered to Blocked events" />
      </div>

      {/* Reporting period → attendance trend (click a bar to inspect that date) */}
      <SectionCard
        title="Attendance Trend"
        subtitle={`${SERIES.map((s) => s.name).join(' · ')} per day · scope: ${db.selectedMineId === 'ALL' ? 'All assigned mines' : mineLabel(db.selectedMineId)}`}
        action={
          <div className="flex items-center gap-2 flex-wrap">
            {selectedDate !== DEMO_TODAY && (
              <Chip label={`Showing ${fmtDate(selectedDate)}`} onClear={() => setSelectedDate(DEMO_TODAY)} />
            )}
            <PeriodSelect value={period} onChange={setPeriod} options={Object.keys(PERIODS)} />
          </div>
        }>
        <StackedBars
          data={trendData}
          series={SERIES}
          xKey="tick"
          height={230}
          onPick={(row) => {
            if (row?.label) {
              setSelectedDate(row.label);
              setTab('Daily Attendance');
            }
          }}
        />
        <p className="text-[11px] text-slate-400 mt-1">
          Click a bar to show that date in the Daily Attendance table. Today ({fmtDate(DEMO_TODAY)}) reads live
          records; earlier dates are derived from the demo archive and are read-only.
        </p>
      </SectionCard>

      {/* Tab bar + tab content */}
      <div className="card !p-0 overflow-hidden mt-4">
        <div className="px-2 pt-1">
          <Tabs tabs={TABS} active={tab} onChange={setTab} />
        </div>

        {/* Filter row */}
        <div className="p-3 flex flex-wrap items-end gap-2">
          <div className="flex items-end gap-2">
            <SearchInput value={query} onChange={setQuery} onSearch={() => setApplied(query)}
              ph={searchPh} width="!w-64" />
            {(query || applied) && (
              <button onClick={() => { setQuery(''); setApplied(''); }}
                className="pb-2 text-[12px] font-semibold text-slate-500 hover:text-navy whitespace-nowrap">
                ✕ Clear
              </button>
            )}
          </div>

          {tab === 'Daily Attendance' && (
            <>
              <Select label="Status" value={attF.status} onChange={(v) => setAttF((f) => ({ ...f, status: v }))}
                options={[{ v: 'ALL', l: 'All Statuses' }, ...Object.values(AttendanceStatus).map((s) => ({ v: s, l: s }))]} />
              <Select label="Gate" value={attF.gate} onChange={(v) => setAttF((f) => ({ ...f, gate: v }))}
                options={[{ v: 'ALL', l: 'All Gates' }, ...GATES.map((g) => ({ v: g, l: g }))]} />
              <Select label="Mine" value={db.selectedMineId} onChange={(v) => actions.setSelectedMine(v)}
                width="!w-56"
                options={[{ v: 'ALL', l: 'All Assigned Mines' }, ...mines.map((m) => ({ v: m.id, l: `${m.name} (${m.code})` }))]} />
              <Select label="Department" value={attF.dept} onChange={(v) => setAttF((f) => ({ ...f, dept: v }))}
                width="!w-52"
                options={[{ v: 'ALL', l: 'All Departments' }, ...DEPARTMENTS.map((d) => ({ v: d, l: d }))]} />
              <label className="flex items-center gap-2 pb-2 text-[12px] font-semibold text-slate-600 cursor-pointer"
                title="A supervisor keying a mark is a manual entry. Untick only to simulate a biometric terminal sync — manual rows are always labelled Manual, never Biometric.">
                <input type="checkbox" className="w-4 h-4 accent-blue-600" checked={manual}
                  onChange={(e) => setManual(e.target.checked)} />
                Record marks as manual entry
              </label>
            </>
          )}

          {tab === 'Access Logs' && (
            <>
              <Select label="Status" value={accF.status} onChange={(v) => setAccF((f) => ({ ...f, status: v }))}
                options={[{ v: 'ALL', l: 'All Statuses' }, ...Object.values(AccessStatus).map((s) => ({ v: s, l: s }))]} />
              <Select label="Gate" value={accF.gate} onChange={(v) => setAccF((f) => ({ ...f, gate: v }))}
                options={[{ v: 'ALL', l: 'All Gates' }, ...GATES.map((g) => ({ v: g, l: g }))]} />
              <Select label="Mine" value={db.selectedMineId} onChange={(v) => actions.setSelectedMine(v)}
                width="!w-56"
                options={[{ v: 'ALL', l: 'All Assigned Mines' }, ...mines.map((m) => ({ v: m.id, l: `${m.name} (${m.code})` }))]} />
            </>
          )}

          {tab === 'Training Status' && trainPick && <Chip label={`Group: ${trainPick}`} onClear={() => setTrainPick(null)} />}

          {tab === 'Leave Management' && (
            <Select label="Status" value={leaveF.status} onChange={(v) => setLeaveF({ status: v })}
              options={LEAVE_STATUSES.map((s) => ({ v: s, l: s === 'ALL' ? 'All Statuses' : s }))} />
          )}

          {tab === 'Gate Passes' && (
            <>
              <Select label="Status" value={passF.status} onChange={(v) => setPassF({ status: v })}
                options={PASS_STATUSES.map((s) => ({ v: s, l: s === 'ALL' ? 'All Statuses' : s }))} />
              <div className="pb-[1px]">
                <PermBtn perm="access.decide" onClick={() => setIssueOpen(true)} className="btn-primary !py-2">
                  <span className="flex items-center gap-1.5"><Plus size={15} /> Issue Gate Pass</span>
                </PermBtn>
              </div>
            </>
          )}

          <div className="ml-auto flex items-center gap-2 flex-wrap pb-[1px]">
            {tab === 'Daily Attendance' && (selectedDate !== DEMO_TODAY
              ? <Chip label={`Showing ${fmtDate(selectedDate)} · historical`} onClear={() => setSelectedDate(DEMO_TODAY)} />
              : <span className="badge bg-slate-100 text-slate-600">Today · {fmtDate(DEMO_TODAY)}</span>)}
            {tab === 'Leave Management' && (
              <span className="text-[11px] text-slate-400 whitespace-nowrap">
                {db.leaves.filter((l) => l.status === 'Pending').length} pending
              </span>
            )}
            {tab === 'Gate Passes' && (
              <span className="text-[11px] text-slate-400 whitespace-nowrap">
                {db.gatePasses.filter((g) => g.status === 'Issued').length} active passes
              </span>
            )}
            <button onClick={resetFilters}
              className="btn-primary !bg-white !text-navy border border-slate-300 !py-2 flex items-center gap-1.5">
              <RefreshCw size={14} /> Reset Filters
            </button>
          </div>
        </div>

        {/* Inline error (store actions throw human messages — never alert()) */}
        {error && (
          <div role="alert" className="mx-3 mb-2 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] font-semibold text-red-600">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError('')} aria-label="Dismiss error"
              className="text-red-400 hover:text-red-700 font-bold">✕</button>
          </div>
        )}

        {/* Per-tab notes */}
        {tab === 'Daily Attendance' && selectedDate !== DEMO_TODAY && (
          <p className="mx-3 mb-2 text-[11px] leading-relaxed text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            <strong>Historical view ({fmtDate(selectedDate)})</strong> — these rows are derived from the demo
            archive, so marking is disabled. Re-select today ({fmtDate(DEMO_TODAY)}) to mark attendance.
          </p>
        )}
        {tab === 'Access Logs' && (
          <p className="mx-3 mb-2 text-[11px] leading-relaxed text-slate-600 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
            <strong>How decisions work:</strong> Approve / Deny / Revoke record an audited gate decision (actor,
            reason and time) against this event — they do not silently rewrite history. The event timestamp, gate
            and direction stay exactly as captured, and the previous status remains in the audit log.
          </p>
        )}
        {tab === 'Leave Management' && (
          <p className="mx-3 mb-2 text-[11px] leading-relaxed text-blue-700 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
            <strong>How decisions work:</strong> Approve and Reject apply only to pending requests; an approved
            request can be cancelled. Each decision is written to the store, notifies the worker and is appended to
            the activity + audit log, and it survives reload and “Reset demo data” restores the original set.
          </p>
        )}
        {tab === 'Gate Passes' && (
          <p className="mx-3 mb-2 text-[11px] leading-relaxed text-blue-700 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
            <strong>How decisions work:</strong> Issuing creates a numbered gate pass in the register; Use marks it
            consumed at the gate and Revoke withdraws it. Passes are persisted in the store, appear in the audit
            trail, and expired passes cannot be changed — issue a new one instead.
          </p>
        )}

        {/* Tables */}
        <div className="px-3 pb-4">
          {tab === 'Daily Attendance' && (
            <DataTable
              key={`att-${selectedDate}-${db.selectedMineId}`}
              columns={attColumns}
              rows={attRows}
              initialSize={10}
              pageSizeOptions={[10, 20, 50, 100]}
              emptyTitle="No attendance rows match"
              emptyText="Try clearing the status/gate/department filters or the search, or switch the mine scope above."
              actions={(r) => (
                <div className="flex gap-1 justify-end flex-wrap">
                  {markOptions.map((m) => (
                    <PermBtn key={m.s} perm="attendance.mark"
                      onClick={() => setMarkReq({ worker: r.worker, status: m.s })}
                      disabled={!r.live || r.status === m.s}
                      title={permHint('attendance.mark', markHint(r, m.s))}
                      className={`btn-primary !py-1 !px-2 !text-[11px] !rounded-lg ${m.cls}`}>
                      {m.label}
                    </PermBtn>
                  ))}
                </div>
              )}
            />
          )}
          {tab === 'Access Logs' && (
            <DataTable
              key={`acc-${db.selectedMineId}-${accF.status}-${accF.gate}`}
              columns={accColumns}
              rows={accRows}
              initialSize={10}
              pageSizeOptions={[10, 20, 50]}
              emptyTitle="No gate events match"
              emptyText="Clear the status/gate filters or the search to see more gate events, or switch the mine scope."
              actions={(r) => (
                <div className="flex gap-1 justify-end flex-wrap">
                  <PermBtn perm="access.decide" disabled={r.status === AccessStatus.Allowed}
                    onClick={() => setDecReq({ record: r, target: AccessStatus.Allowed })}
                    title={permHint('access.decide', r.status === AccessStatus.Allowed
                      ? 'This event is already Allowed.'
                      : `Approve access for ${r.workerId} — requires an audited reason.`)}
                    className="btn-primary !py-1 !px-2 !text-[11px] !rounded-lg !bg-emerald-600 hover:!bg-emerald-700">
                    Approve
                  </PermBtn>
                  <PermBtn perm="access.decide" disabled={r.status === AccessStatus.Denied}
                    onClick={() => setDecReq({ record: r, target: AccessStatus.Denied })}
                    title={permHint('access.decide', r.status === AccessStatus.Denied
                      ? 'This event is already Denied.'
                      : `Deny access for ${r.workerId} — requires an audited reason.`)}
                    className="btn-primary !py-1 !px-2 !text-[11px] !rounded-lg !bg-amber-500 hover:!bg-amber-600">
                    Deny
                  </PermBtn>
                  <PermBtn perm="access.decide" disabled={r.status === AccessStatus.Revoked}
                    onClick={() => setDecReq({ record: r, target: AccessStatus.Revoked })}
                    title={permHint('access.decide', r.status === AccessStatus.Revoked
                      ? 'This event is already Revoked.'
                      : `Revoke access for ${r.workerId} — requires an audited reason.`)}
                    className="btn-primary !py-1 !px-2 !text-[11px] !rounded-lg !bg-red-500 hover:!bg-red-600">
                    Revoke
                  </PermBtn>
                </div>
              )}
            />
          )}

          {tab === 'Training Status' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="rounded-xl border border-slate-200 p-3">
                <div className="text-[13px] font-bold text-navy">Worst certification per worker</div>
                <div className="text-[11px] text-slate-500 mb-2">
                  {needAction} of {scope.length} workers need action
                </div>
                <Donut
                  data={donutData}
                  centerValue={String(needAction)}
                  centerLabel="Need action"
                  height={175}
                  onPick={(s) => setTrainPick((p) => (p === s.name ? null : s.name))}
                />
                <div className="text-[10px] text-slate-400 text-center mt-1">
                  Click a slice to filter the list · expired certificates can never present as valid
                </div>
              </div>
              <div className="lg:col-span-2 min-w-0">
                <DataTable
                  key={`train-${trainPick ?? 'risk'}-${db.selectedMineId}`}
                  columns={trainColumns}
                  rows={trainRows}
                  initialSize={10}
                  pageSizeOptions={[10, 20, 50]}
                  emptyTitle={trainPick ? `No workers with status “${trainPick}”` : 'No workers need training action'}
                  emptyText={trainPick
                    ? 'Click another donut slice or clear the group chip to see other workers.'
                    : 'Every worker in scope holds a valid certification. Click a donut slice to browse the full group.'}
                  actions={(r) => (
                    <div className="flex gap-1.5 justify-end flex-wrap">
                      <PermBtn perm="training.update" disabled={!r.record}
                        onClick={() => r.record && setRenewReq({ record: r.record, worker: r.worker })}
                        title={permHint('training.update', r.record
                          ? `Renew ${String(r.record.type)} for ${r.worker.name} — fresh validity from ${fmtDate(DEMO_TODAY)}`
                          : 'No certification record to renew for this worker.')}
                        className="btn-primary !py-1 !px-2.5 !text-[11px] !rounded-lg">
                        Renew
                      </PermBtn>
                      <PermBtn perm="export" disabled={!r.record}
                        onClick={() => r.record && downloadCert(r.record, r.worker)}
                        title={permHint('export', r.record
                          ? 'Download the demo certificate as a real .txt file'
                          : 'No certificate available to download.')}
                        className="btn-primary !py-1 !px-2.5 !text-[11px] !rounded-lg !bg-white !text-navy border border-slate-300">
                        <span className="flex items-center gap-1"><Download size={12} /> Certificate</span>
                      </PermBtn>
                    </div>
                  )}
                />
              </div>
            </div>
          )}

          {tab === 'Leave Management' && (
            <DataTable
              key={`leave-${leaveF.status}-${db.selectedMineId}`}
              columns={leaveColumns}
              rows={leaveRows}
              initialSize={10}
              pageSizeOptions={[10, 20, 50]}
              emptyTitle="No leave records match"
              emptyText="Clear the status filter or the search to see the full leave pipeline for this mine scope."
              actions={(r) => (
                <div className="flex gap-1 justify-end flex-wrap">
                  {r.status === 'Pending' && (
                    <>
                      <PermBtn perm="attendance.mark" onClick={() => setLeaveReq({ id: r.id, next: 'approve', label: 'Approve' })}
                        title={permHint('attendance.mark', `Approve ${r.id}`)}
                        className="btn-primary !py-1 !px-2 !text-[11px] !rounded-lg !bg-emerald-600 hover:!bg-emerald-700">
                        Approve
                      </PermBtn>
                      <PermBtn perm="attendance.mark" onClick={() => setLeaveReq({ id: r.id, next: 'reject', label: 'Reject' })}
                        title={permHint('attendance.mark', `Reject ${r.id}`)}
                        className="btn-primary !py-1 !px-2 !text-[11px] !rounded-lg !bg-red-500 hover:!bg-red-600">
                        Reject
                      </PermBtn>
                    </>
                  )}
                  {r.status === 'Approved' && (
                    <PermBtn perm="attendance.mark" onClick={() => setLeaveReq({ id: r.id, next: 'cancel', label: 'Cancel' })}
                      title={permHint('attendance.mark', `Cancel approved leave ${r.id}`)}
                      className="btn-primary !py-1 !px-2 !text-[11px] !rounded-lg">
                      Cancel
                    </PermBtn>
                  )}
                  {(r.status === 'Rejected' || r.status === 'Completed' || r.status === 'Cancelled') && (
                    <span className="text-[11px] text-slate-400">No actions</span>
                  )}
                </div>
              )}
            />
          )}

          {tab === 'Gate Passes' && (
            <DataTable
              key={`pass-${passF.status}-${db.selectedMineId}`}
              columns={passColumns}
              rows={passRows}
              initialSize={10}
              pageSizeOptions={[10, 20, 50]}
              emptyTitle="No gate passes match"
              emptyText="Clear the status filter or the search, or issue a new gate pass with the button above."
              actions={(r) => (
                <div className="flex gap-1 justify-end flex-wrap">
                  {r.status === 'Issued' && (
                    <PermBtn perm="access.decide" onClick={() => setPassReq({ id: r.id, next: 'Revoked' })}
                      title={permHint('access.decide', `Revoke gate pass ${r.id}`)}
                      className="btn-primary !py-1 !px-2 !text-[11px] !rounded-lg !bg-red-500 hover:!bg-red-600">
                      Revoke
                    </PermBtn>
                  )}
                  {r.status === 'Issued' && (
                    <PermBtn perm="access.decide" onClick={() => setPassReq({ id: r.id, next: 'Used' })}
                      title={permHint('access.decide', `Mark gate pass ${r.id} as used at the gate`)}
                      className="btn-primary !py-1 !px-2 !text-[11px] !rounded-lg !bg-emerald-600 hover:!bg-emerald-700">
                      Use
                    </PermBtn>
                  )}
                  {(r.status === 'Used' || r.status === 'Revoked' || r.status === 'Expired') && (
                    <span className="text-[11px] text-slate-400">No actions</span>
                  )}
                </div>
              )}
            />
          )}
        </div>
      </div>

      {/* ---------- Overlays ---------- */}
      {markReq && (
        <ConfirmDialog
          title={`Mark ${markReq.status} — ${markReq.worker.name}`}
          body={`Set ${markReq.worker.name} (${markReq.worker.id}) to ${markReq.status} for ${fmtDate(DEMO_TODAY)}? ${
            manual
              ? 'This will be recorded as a MANUAL entry — the Method column will show “Manual”, never Biometric.'
              : 'This will be recorded as a Biometric capture from the gate terminal feed (simulated in this demo).'
          } The change updates today’s KPIs and trend immediately and is written to the audit trail.`}
          confirmLabel={`Mark ${markReq.status}`}
          onCancel={() => setMarkReq(null)}
          onConfirm={() => {
            const req = markReq;
            setError('');
            try {
              actions.markAttendance(req.worker.id, req.status, manual);
              setMarkReq(null);
            } catch (e) { setError(msg(e)); setMarkReq(null); }
          }}
        />
      )}

      {renewReq && (
        <ConfirmDialog
          title={`Renew ${String(renewReq.record.type)}?`}
          body={`Renew the certification ${renewReq.record.certificationNumber} for ${renewReq.worker.name} (${renewReq.worker.id})? It will be re-completed today (${fmtDate(DEMO_TODAY)}), verified, and given a fresh 2-year validity — an audited store action.`}
          confirmLabel="Renew certification"
          onCancel={() => setRenewReq(null)}
          onConfirm={() => {
            const req = renewReq;
            setError('');
            try {
              actions.renewTraining(req.record.id);
              setRenewReq(null);
            } catch (e) { setError(msg(e)); setRenewReq(null); }
          }}
        />
      )}

      {leaveReq && leaveRec && (
        <ConfirmDialog
          title={`${leaveReq.label} leave ${leaveRec.id}`}
          body={`${leaveReq.label} the ${leaveRec.type} of ${nameOf(leaveRec.workerId)} from ${fmtDate(leaveRec.from)} to ${fmtDate(leaveRec.to)}? ${DEMO_NOTE} The worker is notified and the decision is appended to the activity and audit log.`}
          confirmLabel={`${leaveReq.label} leave`}
          onCancel={() => setLeaveReq(null)}
          onConfirm={() => {
            const req = leaveReq;
            run(() => actions.decideLeave(req.id, req.next));
            setLeaveReq(null);
          }}
        />
      )}

      {passReq && (
        <ConfirmDialog
          title={`${passReq.next} gate pass ${passReq.id}`}
          body={`Mark gate pass ${passReq.id} as ${passReq.next}? ${DEMO_NOTE} The change is appended to the activity and audit log and persists across reloads.`}
          confirmLabel={`${passReq.next} pass`}
          onCancel={() => setPassReq(null)}
          onConfirm={() => {
            const req = passReq;
            run(() => actions.setGatePassStatus(req.id, req.next));
            setPassReq(null);
          }}
        />
      )}

      {decReq && (
        <AccessDecisionModal record={decReq.record} target={decReq.target} onClose={() => setDecReq(null)} />
      )}

      {issueOpen && (
        <Modal title="Issue Gate Pass" onClose={() => { setIssueOpen(false); setIssueErr({}); }}>
          <p className="text-[11px] leading-relaxed text-blue-700 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 mb-3">
            The pass is added to the centralized register with the next number in the sequence and recorded in the
            audit trail — it persists across reloads and is restored to the seeded set by “Reset demo data”.
          </p>
          <Field label="Worker" error={issueErr.workerId} hint="Must be within the current mine scope shown above.">
            <select className="input" value={issueForm.workerId}
              onChange={(e) => { setIssueForm((f) => ({ ...f, workerId: e.target.value })); setIssueErr((x) => ({ ...x, workerId: undefined })); }}>
              <option value="">Select worker…</option>
              {workerOptions.map((w) => (
                <option key={w.id} value={w.id}>{`${w.name} — ${w.id} (${w.designation}, ${mineCode(w.mineId)})`}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
            <Field label="Vehicle registration" error={issueErr.vehicle}>
              <input className="input" placeholder="CG-12-A-1194" value={issueForm.vehicle}
                onChange={(e) => setIssueForm((f) => ({ ...f, vehicle: e.target.value }))} />
            </Field>
            <Field label="Purpose">
              <select className="input" value={issueForm.purpose}
                onChange={(e) => setIssueForm((f) => ({ ...f, purpose: e.target.value }))}>
                {PASS_PURPOSES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Issued on">
              <input type="date" className="input" value={issueForm.issuedOn}
                onChange={(e) => setIssueForm((f) => ({ ...f, issuedOn: e.target.value }))} />
            </Field>
            <Field label="Valid till" error={issueErr.validTill}>
              <input type="date" className="input" value={issueForm.validTill}
                onChange={(e) => setIssueForm((f) => ({ ...f, validTill: e.target.value }))} />
            </Field>
          </div>
          <div className="flex gap-2 justify-end mt-1">
            <button className="btn-primary !bg-white !text-navy border border-slate-300"
              onClick={() => { setIssueOpen(false); setIssueErr({}); }}>
              Cancel
            </button>
            <PermBtn perm="access.decide" onClick={validateIssue} className="btn-primary">
              Review &amp; issue…
            </PermBtn>
          </div>
        </Modal>
      )}

      {issueConfirm && (
        <ConfirmDialog
          title={`Issue a gate pass for ${nameOf(issueConfirm.workerId)}?`}
          body={`Vehicle ${issueConfirm.vehicle}, purpose “${issueConfirm.purpose}”, valid ${fmtDate(issueConfirm.issuedOn)} → ${fmtDate(issueConfirm.validTill)}. ${DEMO_NOTE} It receives the next number in the register and appears above immediately.`}
          confirmLabel="Issue pass"
          onCancel={() => setIssueConfirm(null)}
          onConfirm={() => {
            const draft = issueConfirm;
            run(() => actions.issueGatePass({
              workerId: draft.workerId, vehicle: draft.vehicle, purpose: draft.purpose,
              issuedOn: draft.issuedOn, validTill: draft.validTill,
            }));
            setIssueConfirm(null);
            setIssueOpen(false);
            setIssueErr({});
            setIssueForm({
              workerId: '', vehicle: '', purpose: PASS_PURPOSES[0],
              issuedOn: DEMO_TODAY, validTill: addDays(DEMO_TODAY, 3),
            });
          }}
        />
      )}
    </ContractorShell>
  );
}

// ---------- Clickable KPI card (jumps to the matching tab + filter) ----------
function KpiButton({
  icon, label, value, context, dotColor, tileClass, onClick, hint,
}: {
  icon: React.ReactNode; label: string; value: string | number; context: string;
  dotColor: string; tileClass: string; onClick: () => void; hint: string;
}) {
  return (
    <button type="button" onClick={onClick} title={hint} aria-label={`${label}: ${value}. ${hint}`}
      className="text-left w-full rounded-2xl outline-none transition hover:shadow-md focus-visible:ring-2 focus-visible:ring-blue-500">
      <KpiCard icon={icon} label={label} value={value} context={context}
        dotColor={dotColor} tileClass={tileClass} />
    </button>
  );
}
