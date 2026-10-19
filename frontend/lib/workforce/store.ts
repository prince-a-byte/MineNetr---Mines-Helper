/**
 * MineNetr contractor portal — centralized synthetic repository.
 *
 * The ONLY source of truth for the Dashboard, Workers & Manpower, Attendance &
 * Access, Bills & Transactions, Documents & Compliance, Reports and
 * Notifications pages. Every page subscribes via useMockWorkforce() and every
 * mutation goes through `actions`, which:
 *   1. validates input and enforces demo-role permission boundaries,
 *   2. updates every affected record (so KPIs, tables and charts never drift),
 *   3. appends an append-only audit entry,
 *   4. emits a toast and notifies subscribers.
 *
 * Demo persistence: the seed loads deterministically; runtime mutations are
 * mirrored into localStorage so the demo survives reloads; a schema version
 * guards against stale data; resetDemo() restores the original dataset.
 *
 * HTTP mode: lib/workforce/api.ts + repositories.ts define the adapter
 * boundary (all contractor endpoints are PROPOSED and marked unconfirmed).
 * Nothing in this file silently falls back to mock data over HTTP.
 */
'use client';
import { useSyncExternalStore } from 'react';
import { getUser } from '../api';
import {
  AccessStatus, AttendanceStatus, BillStatus, CorrectiveStatus, ContractorStatus,
  DEMO_ROLES, DocumentStatus, IncidentStatus, TransferStatus, WorkerStatus,
  type AccessRecord, type ActivityEntry, type AttendanceRecord, type AuditEntry, type Bill,
  type CreateContractorInput, type CreateIncidentInput, type CreateTrainingInput,
  type CreateWorkerInput, type DemoRole, type DocumentFilters, type GatePass, type Incident,
  type IncidentFilters, type LeaveRecord, type Permission, type PortalDocument,
  type PortalNotification, type ReportRow, type TrainingRecord, type TransferRequest,
  type UpdateWorkerInput, type Worker, type WorkerFilters,
} from './types';
import { DEMO_TODAY } from '../contracts/types';
import { mines, contractors as seedContractors, workforceSnapshot } from './seed';
import { addDays, lastNDates, trainingStatusOf } from './format';

// ---------- State ----------
export interface WorkforceDbState {
  rev: number; // bumped on every mutation (cache key for derived series)
  role: DemoRole;
  selectedMineId: string; // 'ALL' | mine id — permission scoped
  contractors: typeof seedContractors;
  workers: Worker[];
  training: TrainingRecord[];
  attendance: AttendanceRecord[];
  access: AccessRecord[];
  leaves: LeaveRecord[];
  gatePasses: GatePass[];
  bills: Bill[];
  payments: ReturnType<typeof workforceSnapshot>['payments'];
  documents: PortalDocument[];
  transfers: TransferRequest[];
  incidents: Incident[];
  correctiveActions: ReturnType<typeof workforceSnapshot>['correctiveActions'];
  notifications: PortalNotification[];
  reports: ReportRow[];
  activity: ActivityEntry[];
  audit: AuditEntry[];
  toasts: { id: number; text: string }[];
  seq: Record<string, number>;
}

const STORAGE_KEY = 'minenetr_contractor_workforce_v1';
const SCHEMA_VERSION = 1;

function initial(): WorkforceDbState {
  const snap = workforceSnapshot();
  return {
    rev: 0,
    role: 'Project Manager',
    selectedMineId: 'ALL',
    contractors: snap.contractors,
    workers: snap.workers,
    training: snap.training,
    attendance: snap.attendance,
    access: snap.access,
    leaves: snap.leaves,
    gatePasses: snap.gatePasses,
    bills: snap.bills,
    payments: snap.payments,
    documents: snap.documents,
    transfers: snap.transfers,
    incidents: snap.incidents,
    correctiveActions: snap.correctiveActions,
    notifications: snap.notifications,
    reports: snap.reports,
    activity: snap.activity,
    audit: [
      {
        id: 'AUD-0002', timestamp: `${DEMO_TODAY}T09:12:00+05:30`, user: 'Rakesh Kumar', role: 'Contractor',
        module: 'Portal', action: 'Session Start', resource: 'session',
        details: 'Contractor workspace session started for Eastern Mining Services Pvt. Ltd.',
      },
      {
        id: 'AUD-0001', timestamp: `${DEMO_TODAY}T09:00:00+05:30`, user: 'System', role: 'System',
        module: 'Dataset', action: 'Seeded', resource: 'workforce',
        details: 'Deterministic synthetic workforce dataset generated (482 workers, 8 contractors). All figures fictional.',
      },
    ],
    toasts: [],
    seq: { work: 483, cert: 780, cont: 9, req: 11, inc: 25, ca: 14, doc: 129, bill: 13, notif: 25, act: 9, aud: 3, rpt: 15, leave: 25, gp: 19 },
  };
}

let state: WorkforceDbState = load() ?? initial();
let toastSeq = 1;
const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }
function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
function snapshot() { return state; }

export function useMockWorkforce(): WorkforceDbState {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
export function getWorkforceDb(): WorkforceDbState { return state; }

// ---------- Persistence ----------
function persist() {
  if (typeof window === 'undefined') return;
  try {
    const { toasts, ...rest } = state;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: SCHEMA_VERSION, ...rest }));
  } catch { /* storage full/blocked — demo still works in-memory */ }
}

function load(): WorkforceDbState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.v !== SCHEMA_VERSION) return null; // schema changed → reseed
    return { ...initial(), ...parsed, toasts: [] } as WorkforceDbState;
  } catch { return null; }
}

// ---------- Actor / audit / toast ----------
function actor(): { name: string; role: string } {
  try {
    const u = getUser();
    if (u?.name) return { name: u.name, role: state.role };
  } catch { /* demo fallback */ }
  return { name: 'Rakesh Kumar', role: state.role };
}

function bump() { state.rev += 1; }

function audit(module: string, action: string, resource: string, details: string) {
  const a = actor();
  state.audit.unshift({
    id: `AUD-${String(state.seq.aud++).padStart(4, '0')}`, timestamp: new Date().toISOString(),
    user: a.name, role: a.role, module, action, resource, details,
  });
}

function logActivity(kind: string, description: string) {
  const a = actor();
  state.activity.unshift({
    id: `WACT-${String(state.seq.act++).padStart(3, '0')}`, kind, description,
    timestamp: new Date().toISOString(), user: a.name,
  });
}

function notify(title: string, description: string, type: PortalNotification['type'],
  category: PortalNotification['category'], relatedId: string | null, href: string) {
  state.notifications.unshift({
    id: `WN-${String(state.seq.notif++).padStart(3, '0')}`, title, description, type, category,
    timestamp: new Date().toISOString(), read: false, relatedId, href,
  });
}

export function toast(text: string) {
  state.toasts = [...state.toasts.slice(-2), { id: toastSeq++, text }];
  emit();
  const t = typeof window !== 'undefined' ? window.setTimeout.bind(window) : setTimeout;
  t(() => { state.toasts = state.toasts.slice(1); emit(); }, 4200);
}

// ---------- Demo roles / permissions ----------
const ROLE_PERMS: Record<DemoRole, Permission[]> = {
  'Project Manager': [
    'export', 'worker.create', 'worker.update', 'worker.deactivate', 'worker.deploy',
    'worker.transfer.request', 'worker.transfer.decide', 'contractor.update', 'contractor.suspend',
    'training.create', 'training.update', 'training.verify', 'attendance.mark', 'access.decide',
    'bill.submit', 'bill.withdraw', 'bill.acknowledge', 'document.upload', 'incident.create',
    'incident.comment', 'incident.action', 'report.generate', 'notifications.manage',
  ],
  'Site Supervisor': [
    'export', 'worker.create', 'worker.update', 'worker.deploy', 'worker.transfer.request',
    'training.create', 'training.update', 'attendance.mark', 'access.decide', 'document.upload',
    'incident.comment', 'incident.action', 'report.generate', 'notifications.manage',
  ],
  'Mine Admin': [
    'export', 'worker.transfer.decide', 'contractor.update', 'contractor.suspend', 'training.verify',
    'incident.create', 'incident.comment', 'incident.decide', 'report.generate', 'notifications.manage',
  ],
  Inspector: [
    'export', 'training.verify', 'incident.create', 'incident.comment', 'incident.decide',
    'report.generate', 'notifications.manage',
  ],
  'Read-Only Viewer': ['export', 'notifications.manage'],
};

export function can(perm: Permission): boolean {
  return ROLE_PERMS[state.role].includes(perm);
}

/** Human explanation shown as a tooltip on disabled controls. */
export function canReason(perm: Permission): string {
  if (can(perm)) return '';
  const allowed = DEMO_ROLES.filter((r) => ROLE_PERMS[r].includes(perm));
  return `Requires the ${allowed.join(' or ')} demo role — you are currently acting as ${state.role}. This is a frontend demo restriction, not production security.`;
}

function requirePerm(perm: Permission) {
  if (!can(perm)) throw new Error(canReason(perm));
}

// ---------- Reference lookups ----------
export function mineLabel(id: string): string {
  const m = mines.find((x) => x.id === id);
  return m ? `${m.name} (${m.code})` : id;
}
export function mineCode(id: string): string { return mines.find((m) => m.id === id)?.code ?? id; }
export function contractorName(id: string): string { return state.contractors.find((c) => c.id === id)?.name ?? id; }
export function workerById(id: string): Worker | undefined { return state.workers.find((w) => w.id === id); }
export function allowedMines(): typeof mines { return mines; }

// ---------- Derived selectors ----------
export type TrainingWorst = 'Valid' | 'Expiring Soon' | 'Expired' | 'Pending Verification' | 'No Training';

const RANK: Record<string, number> = {
  Expired: 4, 'Pending Verification': 3, 'Expiring Soon': 2, Valid: 1, 'No Training': 0,
};

export function indexTraining(db: WorkforceDbState): Map<string, TrainingRecord[]> {
  const m = new Map<string, TrainingRecord[]>();
  for (const r of db.training) {
    const arr = m.get(r.workerId);
    if (arr) arr.push(r); else m.set(r.workerId, [r]);
  }
  return m;
}

/** Worst-case training status for a worker (expired mandatory training always wins). */
export function worstTraining(records: TrainingRecord[] | undefined): TrainingWorst {
  if (!records || records.length === 0) return 'No Training';
  let worst: TrainingWorst = 'Valid';
  for (const r of records) {
    const s = trainingStatusOf(r) as TrainingWorst;
    if (RANK[s] > RANK[worst]) worst = s;
  }
  return worst;
}

/** True when the worker holds at least one currently-Valid certification. */
export function hasValidCert(records: TrainingRecord[] | undefined): boolean {
  return !!records?.some((r) => trainingStatusOf(r) === 'Valid');
}

/** Today's attendance record for a worker (or a synthetic Not Marked). */
export function attendanceOf(db: WorkforceDbState, workerId: string): AttendanceRecord | undefined {
  return db.attendance.find((a) => a.workerId === workerId);
}

/** Latest gate event for a worker on the demo day. */
export function accessOf(db: WorkforceDbState, workerId: string): AccessRecord | undefined {
  return db.access.find((a) => a.workerId === workerId && a.timestamp.startsWith(DEMO_TODAY));
}

/** Deterministic historical attendance so trends/history need no storage. */
function fnv(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967295;
}

export function derivedAttendance(worker: Worker, date: string): { status: AttendanceStatus; inTime: string; outTime: string; gate: string; method: 'Biometric' | 'Manual' } {
  const r = fnv(`${worker.id}|${date}`);
  const gate = ['Gate 1 (Main)', 'Gate 2 (OB Bench)', 'Gate 3 (Workshop)', 'Gate 4 (Siding)'][Math.floor(r * 4)];
  if (worker.status !== WorkerStatus.Active) {
    const notMarked = r > 0.7;
    return { status: notMarked ? AttendanceStatus.NotMarked : AttendanceStatus.Absent, inTime: '—', outTime: '—', gate, method: 'Biometric' };
  }
  const sunday = new Date(`${date}T00:00:00+05:30`).getDay() === 0;
  const presentCut = sunday ? 0.45 : 0.87;
  if (r > presentCut) {
    const r2 = fnv(`${date}|${worker.id}|out`);
    if (r2 > 0.72) return { status: AttendanceStatus.OnLeave, inTime: '—', outTime: '—', gate, method: 'Biometric' };
    if (r2 > 0.6) return { status: AttendanceStatus.NotMarked, inTime: '—', outTime: '—', gate, method: 'Biometric' };
    return { status: AttendanceStatus.Absent, inTime: '—', outTime: '—', gate, method: 'Biometric' };
  }
  const inH = 5 + Math.floor(r * 4);
  const inM = Math.floor(fnv(`in|${date}|${worker.id}`) * 60);
  const outM = Math.floor(fnv(`out|${date}|${worker.id}`) * 60);
  return {
    status: AttendanceStatus.Present,
    inTime: `${String(inH).padStart(2, '0')}:${String(inM).padStart(2, '0')}`,
    outTime: `${String(16 + (inH % 2)).padStart(2, '0')}:${String(outM).padStart(2, '0')}`,
    gate, method: 'Biometric',
  };
}

const trendCache = new Map<string, { label: string; present: number; absent: number; leave: number; notMarked: number; total: number }[]>();

/** Daily attendance series for the reporting period (today reads live records). */
export function attendanceTrend(db: WorkforceDbState, days: number, mineId: string): { label: string; present: number; absent: number; leave: number; notMarked: number; total: number }[] {
  const key = `${db.rev}|${days}|${mineId}`;
  const hit = trendCache.get(key);
  if (hit) return hit;
  const scope = db.workers.filter((w) => mineId === 'ALL' || w.mineId === mineId);
  const out = lastNDates(days).map((date) => {
    let present = 0, absent = 0, leave = 0, notMarked = 0;
    for (const w of scope) {
      if (date === DEMO_TODAY) {
        const rec = attendanceOf(db, w.id);
        const s = rec?.status ?? AttendanceStatus.NotMarked;
        if (s === AttendanceStatus.Present) present++;
        else if (s === AttendanceStatus.Absent) absent++;
        else if (s === AttendanceStatus.OnLeave) leave++;
        else notMarked++;
      } else {
        const s = derivedAttendance(w, date).status;
        if (s === AttendanceStatus.Present) present++;
        else if (s === AttendanceStatus.Absent) absent++;
        else if (s === AttendanceStatus.OnLeave) leave++;
        else notMarked++;
      }
    }
    return { label: date, present, absent, leave, notMarked, total: scope.length };
  });
  trendCache.set(key, out);
  return out;
}

// ---------- KPIs ----------
export interface Kpis {
  totalWorkers: number;
  activeWorkers: number;
  onLeave: number;
  trainingExpiring: number;
  trainingExpired: number;
  blockedOrInactive: number;
  trainedWorkers: number;
  deployedContractors: number;
  presentToday: number;
  absentToday: number;
  accessBlocked: number;
  accessDenied: number;
  pendingTransfers: number;
  totalBilled: number;
  approvedAmount: number;
  pendingAmount: number;
  rejectedAmount: number;
  totalDocs: number;
  docsValid: number;
  docsExpiring: number;
  docsExpired: number;
  complianceIssues: number;
  avgAttendance: number;
  complianceScore: number;
}

export function computeKpis(db: WorkforceDbState): Kpis {
  const scope = db.workers.filter((w) => db.selectedMineId === 'ALL' || w.mineId === db.selectedMineId);
  const scopeIds = new Set(scope.map((w) => w.id));
  const byWorker = indexTraining(db);
  const attByWorker = new Map<string, AttendanceRecord>();
  for (const a of db.attendance) attByWorker.set(a.workerId, a);

  let activeWorkers = 0, onLeave = 0, presentToday = 0, absentToday = 0;
  let trainingExpiring = 0, trainingExpired = 0, trainedWorkers = 0;
  for (const w of scope) {
    if (w.status === WorkerStatus.Active) activeWorkers++;
    const recs = byWorker.get(w.id);
    // "Training Expiring Soon" tracks the MANDATORY induction certificate —
    // the certification that actually gates site deployment.
    const mandatory = recs?.find((r) => r.mandatory);
    const mStatus = mandatory ? trainingStatusOf(mandatory) : 'No Training';
    if (mStatus === 'Expiring Soon') trainingExpiring++;
    const worst = worstTraining(recs);
    if (worst === 'Expired' || worst === 'No Training') trainingExpired++;
    if (worst === 'Valid' || worst === 'Expiring Soon') trainedWorkers++;
    const s = attByWorker.get(w.id)?.status ?? AttendanceStatus.NotMarked;
    if (s === AttendanceStatus.Present) presentToday++;
    else if (s === AttendanceStatus.Absent) absentToday++;
    if (s === AttendanceStatus.OnLeave) onLeave++;
  }

  let accessBlocked = 0, accessDenied = 0;
  for (const rec of db.access) {
    if (!rec.timestamp.startsWith(DEMO_TODAY) || !scopeIds.has(rec.workerId)) continue;
    if (rec.status === AccessStatus.Blocked) accessBlocked++;
    if (rec.status === AccessStatus.Denied) accessDenied++;
  }

  const inScopeContractors = db.contractors.filter((c) => db.selectedMineId === 'ALL' || c.mineId === db.selectedMineId);
  const deployedContractors = inScopeContractors.filter((c) => scope.some((w) => w.contractorId === c.id)).length;

  const bills = db.bills.filter((b) => db.selectedMineId === 'ALL' || b.mineId === db.selectedMineId);
  const sum = (rows: Bill[]) => rows.reduce((s, b) => s + b.amount, 0);
  const approved = bills.filter((b) => b.status === BillStatus.Approved);
  const pending = bills.filter((b) => b.status === BillStatus.Pending);
  const rejected = bills.filter((b) => b.status === BillStatus.Rejected);

  // Document compliance derives from the expiry dates, never a stored flag.
  const in60 = addDays(DEMO_TODAY, 60);
  const docs = db.documents.filter((d) => db.selectedMineId === 'ALL' || d.mineId === db.selectedMineId);
  let docsExpired = 0, docsExpiring = 0, docsValid = 0;
  for (const d of docs) {
    if (d.expiryDate < DEMO_TODAY) docsExpired++;
    else if (d.expiryDate <= in60) docsExpiring++;
    else docsValid++;
  }

  const incidents = db.incidents.filter((i) => db.selectedMineId === 'ALL' || i.mineId === db.selectedMineId);
  const complianceIssues = incidents.filter((i) =>
    i.status === IncidentStatus.Open || i.status === IncidentStatus.UnderReview || i.status === IncidentStatus.ActionRequired).length;

  const trend = attendanceTrend(db, 30, db.selectedMineId);
  const avgAttendance = trend.length
    ? Math.round(trend.reduce((s, d) => s + (d.total ? (d.present / d.total) * 100 : 0), 0) / trend.length)
    : 0;

  const docScore = docs.length ? ((docs.length - docsExpired) / docs.length) * 100 : 100;
  const trainScore = scope.length ? (trainedWorkers / scope.length) * 100 : 100;
  const complianceScore = Math.round(docScore * 0.5 + trainScore * 0.5);

  return {
    totalWorkers: scope.length,
    activeWorkers,
    onLeave,
    trainingExpiring,
    trainingExpired,
    blockedOrInactive: scope.length - activeWorkers,
    trainedWorkers,
    deployedContractors,
    presentToday,
    absentToday,
    accessBlocked,
    accessDenied,
    pendingTransfers: db.transfers.filter((t) => t.status === TransferStatus.Pending).length,
    totalBilled: sum(bills),
    approvedAmount: sum(approved),
    pendingAmount: sum(pending),
    rejectedAmount: sum(rejected),
    totalDocs: docs.length,
    docsValid,
    docsExpiring,
    docsExpired,
    complianceIssues,
    avgAttendance,
    complianceScore,
  };
}

// ---------- Filters ----------
export function filterWorkers(db: WorkforceDbState, rows: Worker[], f: WorkerFilters, q: string): Worker[] {
  const needle = q.trim().toLowerCase();
  const byWorker = indexTraining(db);
  const attByWorker = new Map<string, string>();
  for (const a of db.attendance) attByWorker.set(a.workerId, a.status);
  const accByWorker = new Map<string, string>();
  for (const a of db.access) if (a.timestamp.startsWith(DEMO_TODAY)) accByWorker.set(a.workerId, a.status);

  return rows.filter((w) => {
    if (f.mineId !== 'ALL' && w.mineId !== f.mineId) return false;
    if (f.contractorId !== 'ALL' && w.contractorId !== f.contractorId) return false;
    if (f.department !== 'ALL' && w.department !== f.department) return false;
    if (f.status !== 'ALL' && w.status !== f.status) return false;
    if (f.trainingStatus !== 'ALL' && worstTraining(byWorker.get(w.id)) !== f.trainingStatus) return false;
    if (f.attendance !== 'ALL' && (attByWorker.get(w.id) ?? AttendanceStatus.NotMarked) !== f.attendance) return false;
    if (f.accessStatus !== 'ALL' && (accByWorker.get(w.id) ?? 'No Record') !== f.accessStatus) return false;
    if (needle) {
      const hay = `${w.id} ${w.name} ${contractorName(w.contractorId)} ${w.department} ${w.designation} ${mineLabel(w.mineId)} ${w.workZone} ${w.supervisor}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
}

export function filterIncidents(db: WorkforceDbState, rows: Incident[], f: IncidentFilters, q: string): Incident[] {
  const needle = q.trim().toLowerCase();
  return rows.filter((i) => {
    if (f.mineId !== 'ALL' && i.mineId !== f.mineId) return false;
    if (f.category !== 'ALL' && i.category !== f.category) return false;
    if (f.severity !== 'ALL' && i.severity !== f.severity) return false;
    if (f.status !== 'ALL' && i.status !== f.status) return false;
    if (f.contractorId !== 'ALL' && i.contractorId !== f.contractorId) return false;
    if (f.from && i.dateDetected < f.from) return false;
    if (f.to && i.dateDetected > f.to) return false;
    if (needle) {
      const hay = `${i.id} ${i.category} ${i.description} ${contractorName(i.contractorId)} ${i.inspector} ${i.workerId ?? ''}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
}

export function documentsInTab(db: WorkforceDbState, f: DocumentFilters): PortalDocument[] {
  return db.documents.filter((d) => {
    if (f.mineId !== 'ALL' && d.mineId !== f.mineId) return false;
    if (f.tab !== 'All Documents' && d.category !== f.tab) return false;
    if (f.status !== 'ALL') {
      const s = d.expiryDate < DEMO_TODAY ? DocumentStatus.Expired
        : d.expiryDate <= addDays(DEMO_TODAY, 60) ? DocumentStatus.ExpiringSoon : DocumentStatus.Valid;
      if (s !== f.status) return false;
    }
    return true;
  });
}

// ---------- Actions ----------
function nextId(kind: string, prefix: string, width = 4) {
  return `${prefix}${String(state.seq[kind]++).padStart(width, '0')}`;
}

function commit(module: string, action: string, resource: string, details: string, message?: string) {
  audit(module, action, resource, details);
  bump(); persist(); emit();
  if (message) toast(message);
}

export const actions = {
  /** Demo role switch — changes which controls are enabled. */
  setRole(role: DemoRole) {
    state.role = role;
    commit('Demo Role', 'Switched', role, `Active demo role changed to ${role}.`, `Acting as ${role}.`);
  },

  /** Permission-scoped mine selection — persists across navigation + reload. */
  setSelectedMine(id: string) {
    state.selectedMineId = id;
    commit('Mine Scope', 'Changed', id, `Reporting mine scope changed to ${mineLabel(id)}.`);
  },

  // ---------- Workers ----------
  createWorker(input: CreateWorkerInput): string {
    requirePerm('worker.create');
    if (state.workers.some((w) => w.id === input.workerId)) throw new Error(`Worker ID ${input.workerId} already exists.`);
    if (!input.name.trim()) throw new Error('Full name is required.');
    if (!/^[6-9]\d{9}$/.test(input.contact.replace(/\D/g, '').slice(-10))) throw new Error('Contact number must be a valid 10-digit mobile number.');
    if (!state.contractors.some((c) => c.id === input.contractorId)) throw new Error('Selected contractor does not exist.');
    if (!mines.some((m) => m.id === input.mineId)) throw new Error('Selected mine does not exist.');

    const w: Worker = {
      id: input.workerId, name: input.name.trim(), contractorId: input.contractorId,
      designation: input.designation, department: input.department, mineId: input.mineId,
      contact: input.contact.trim(), joiningDate: input.joiningDate || DEMO_TODAY,
      emergencyContact: input.emergencyContact.trim(), gender: input.gender, status: WorkerStatus.Active,
      shift: input.shift, workZone: input.workZone, supervisor: 'Rakesh Kumar',
    };
    state.workers.unshift(w);
    state.attendance.unshift({
      id: nextId('work', 'ATT-'), workerId: w.id, date: DEMO_TODAY,
      status: AttendanceStatus.NotMarked, inTime: '—', outTime: '—',
      gate: 'Gate 1 (Main)', method: 'Manual',
    });
    if (input.initialTraining !== 'None') {
      state.training.unshift({
        id: nextId('cert', 'CERT-'), workerId: w.id, type: input.initialTraining,
        certificationNumber: `NEW-${DEMO_TODAY.slice(0, 4)}-${String(state.seq.cert).padStart(5, '0')}`,
        completionDate: DEMO_TODAY, expiryDate: addDays(DEMO_TODAY, 730),
        provider: 'Mine Safety Training Institute, Korba', mandatory: true, verified: false,
      });
    }
    notify('Worker added', `${w.name} (${w.id}) registered against ${contractorName(w.contractorId)}.`,
      'Information', 'Worker Related', w.id, '/contractor/workers?tab=All%20Workers');
    logActivity('Worker Added', `Worker ${w.id} (${w.name}) registered against ${contractorName(w.contractorId)} at ${mineLabel(w.mineId)}.`);
    commit('Worker', 'Created', w.id, `New worker ${w.id} created (${w.designation}, ${w.department}).`, `Worker ${w.id} added.`);
    return w.id;
  },

  updateWorker(id: string, patch: UpdateWorkerInput) {
    requirePerm('worker.update');
    const w = state.workers.find((x) => x.id === id);
    if (!w) throw new Error('Worker not found.');
    if (patch.contact && !/^[6-9]\d{9}$/.test(patch.contact.replace(/\D/g, '').slice(-10))) throw new Error('Contact number must be a valid 10-digit mobile number.');
    Object.assign(w, patch);
    logActivity('Worker Updated', `Worker ${id} record updated (${Object.keys(patch).join(', ')}).`);
    commit('Worker', 'Updated', id, `Worker ${id} updated: ${JSON.stringify(patch)}`, `Worker ${id} updated.`);
  },

  /** Deactivate / reactivate / block — never deletes historical records. */
  setWorkerStatus(id: string, status: WorkerStatus) {
    if (status !== WorkerStatus.Active) requirePerm('worker.deactivate');
    const w = state.workers.find((x) => x.id === id);
    if (!w) throw new Error('Worker not found.');
    w.status = status;
    logActivity('Worker Status', `Worker ${id} marked ${status}. Historical records retained.`);
    commit('Worker', status === WorkerStatus.Active ? 'Reactivated' : status, id,
      `Worker ${id} status set to ${status}. Attendance, training and access history retained.`,
      `Worker ${id} → ${status}.`);
  },

  /** Reassign a worker's mine/department/shift/zone (deployment change). */
  deployWorker(id: string, patch: { mineId?: string; department?: string; shift?: Worker['shift']; workZone?: string }) {
    requirePerm('worker.deploy');
    const w = state.workers.find((x) => x.id === id);
    if (!w) throw new Error('Worker not found.');
    if (w.status !== WorkerStatus.Active) throw new Error('Inactive or blocked workers cannot be deployed. Reactivate the worker first.');
    const c = state.contractors.find((x) => x.id === w.contractorId);
    if (c?.status === ContractorStatus.Suspended) throw new Error('This contractor is suspended and cannot receive new worker deployments.');
    if (patch.mineId && !mines.some((m) => m.id === patch.mineId)) throw new Error('Selected mine does not exist.');
    const from = mineLabel(w.mineId);
    Object.assign(w, patch);
    logActivity('Deployment Changed', `Worker ${id} redeployed from ${from} to ${mineLabel(w.mineId)}${patch.shift ? ` · shift ${patch.shift}` : ''}.`);
    commit('Deployment', 'Changed', id, `Worker ${id} deployment updated (${from} → ${mineLabel(w.mineId)}).`, `Deployment updated for ${id}.`);
  },

  // ---------- Transfer requests ----------
  createTransfer(input: { workerId: string; toMineId: string; toDepartment: string; reason: string }): string {
    requirePerm('worker.transfer.request');
    const w = state.workers.find((x) => x.id === input.workerId);
    if (!w) throw new Error('Worker not found.');
    if (state.transfers.some((t) => t.workerId === input.workerId && t.status === TransferStatus.Pending)) {
      throw new Error('A pending transfer request already exists for this worker.');
    }
    const id = nextId('req', 'REQ-');
    state.transfers.unshift({
      id, workerId: w.id, fromContractorId: w.contractorId, fromMineId: w.mineId,
      toMineId: input.toMineId, toDepartment: input.toDepartment, requestDate: DEMO_TODAY,
      supervisor: 'Rakesh Kumar', reason: input.reason, status: TransferStatus.Pending,
    });
    notify('Transfer request raised', `${id} for ${w.name} awaits approval.`, 'Action Required', 'Approvals', id, '/contractor/workers?tab=Transfer%20History');
    logActivity('Transfer Requested', `Transfer ${id} raised for ${w.name} (${w.mineId} → ${input.toMineId}).`);
    commit('Transfer', 'Requested', id, `Transfer request ${id} created for worker ${w.id}.`, `Transfer ${id} submitted.`);
    return id;
  },

  decideTransfer(id: string, decision: 'approve' | 'reject' | 'cancel') {
    if (decision === 'approve') requirePerm('worker.transfer.decide');
    const t = state.transfers.find((x) => x.id === id);
    if (!t) throw new Error('Transfer request not found.');
    if (t.status !== TransferStatus.Pending) throw new Error('Only pending transfer requests can be decided.');
    const w = state.workers.find((x) => x.id === t.workerId);
    t.status = decision === 'approve' ? TransferStatus.Approved : decision === 'reject' ? TransferStatus.Rejected : TransferStatus.Cancelled;
    t.decidedOn = DEMO_TODAY;
    t.decidedBy = actor().name;
    if (decision === 'approve' && w) {
      if (w.status !== WorkerStatus.Active) throw new Error('Inactive or blocked workers cannot be transferred.');
      w.mineId = t.toMineId;
      w.department = t.toDepartment;
      logActivity('Transfer Approved', `Transfer ${id} approved — ${w.name} now deployed at ${mineLabel(t.toMineId)}.`);
    } else {
      logActivity(`Transfer ${t.status}`, `Transfer ${id} ${t.status.toLowerCase()} for worker ${t.workerId}.`);
    }
    notify(`Transfer ${t.status.toLowerCase()}`, `${id} for ${w?.name ?? t.workerId} was ${t.status.toLowerCase()}.`,
      t.status === TransferStatus.Approved ? 'Completed' : 'Information', 'Approvals', id, '/contractor/workers?tab=Transfer%20History');
    commit('Transfer', t.status, id, `Transfer ${id} ${t.status.toLowerCase()}.`, `Transfer ${id} ${t.status.toLowerCase()}.`);
  },

  // ---------- Contractors ----------
  createContractor(input: CreateContractorInput): string {
    requirePerm('contractor.update');
    if (state.contractors.some((c) => c.id === input.contractorId)) throw new Error(`Contractor ID ${input.contractorId} already exists.`);
    if (!input.name.trim()) throw new Error('Contractor name is required.');
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(input.email)) throw new Error('Enter a valid email address.');
    if (!/^[6-9]\d{9}$/.test(input.phone.replace(/\D/g, '').slice(-10))) throw new Error('Phone must be a valid 10-digit number.');
    if (input.contractEnd <= input.contractStart) throw new Error('Contract end date must be after the start date.');
    state.contractors.push({
      id: input.contractorId, name: input.name.trim(), contractNumber: input.contractNumber,
      registrationNumber: input.registrationNumber, contactPerson: input.contactPerson,
      phone: input.phone, email: input.email, mineId: input.mineId,
      contractStart: input.contractStart, contractEnd: input.contractEnd,
      contractValue: input.contractValue, status: ContractorStatus.Pending,
      requiredDocuments: input.requiredDocuments, isSelf: false, scope: input.scope,
    });
    notify('Contractor onboarded', `${input.name} (${input.contractorId}) added in Pending status.`, 'Information', 'Approvals', input.contractorId, '/contractor/documents?tab=Contract%20Documents');
    logActivity('Contractor Added', `Contractor ${input.contractorId} (${input.name}) onboarded.`);
    commit('Contractor', 'Created', input.contractorId, `Contractor ${input.contractorId} created (Pending).`, `Contractor ${input.contractorId} added.`);
    return input.contractorId;
  },

  updateContractor(id: string, patch: Partial<CreateContractorInput>) {
    requirePerm('contractor.update');
    const c = state.contractors.find((x) => x.id === id);
    if (!c) throw new Error('Contractor not found.');
    if (patch.email && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(patch.email)) throw new Error('Enter a valid email address.');
    Object.assign(c, patch);
    logActivity('Contractor Updated', `Contractor ${id} details updated.`);
    commit('Contractor', 'Updated', id, `Contractor ${id} updated.`, `Contractor ${id} updated.`);
  },

  /** Suspend / reactivate — suspension blocks new deployments for its workers. */
  setContractorStatus(id: string, status: ContractorStatus) {
    requirePerm('contractor.suspend');
    const c = state.contractors.find((x) => x.id === id);
    if (!c) throw new Error('Contractor not found.');
    if (c.isSelf) throw new Error('The signed-in contractor record cannot be suspended from this workspace.');
    c.status = status;
    const n = state.workers.filter((w) => w.contractorId === id).length;
    logActivity('Contractor Status', `Contractor ${id} set to ${status} (${n} workers affected for new deployments).`);
    notify(`Contractor ${status.toLowerCase()}`, `${c.name} is now ${status}. Historical records remain visible.`,
      status === ContractorStatus.Suspended ? 'Action Required' : 'Completed', 'Approvals', id, '/contractor/documents?tab=Contract%20Documents');
    commit('Contractor', status, id, `Contractor ${id} set to ${status}. Existing workers/deployments remain; new deployments blocked while suspended.`,
      `${c.name} → ${status}.`);
  },

  // ---------- Training ----------
  createTraining(input: CreateTrainingInput): string {
    requirePerm('training.create');
    const w = state.workers.find((x) => x.id === input.workerId);
    if (!w) throw new Error('Worker not found.');
    if (!input.certificationNumber.trim()) throw new Error('Certification number is required.');
    if (input.completionDate > DEMO_TODAY) throw new Error('Completion date cannot be in the future.');
    if (input.expiryDate <= input.completionDate) throw new Error('Expiry date must be after the completion date.');
    const id = nextId('cert', 'CERT-');
    state.training.unshift({
      id, workerId: w.id, type: input.type, certificationNumber: input.certificationNumber.trim(),
      completionDate: input.completionDate, expiryDate: input.expiryDate, provider: input.provider,
      mandatory: input.mandatory, verified: input.verified,
    });
    logActivity('Training Added', `${input.type} record ${id} added for ${w.name}.`);
    commit('Training', 'Created', id, `Training record ${id} created for worker ${w.id}.`, `Training record ${id} added.`);
    return id;
  },

  updateTraining(id: string, patch: Partial<CreateTrainingInput>) {
    requirePerm('training.update');
    const r = state.training.find((x) => x.id === id);
    if (!r) throw new Error('Training record not found.');
    if (patch.expiryDate && patch.completionDate && patch.expiryDate <= patch.completionDate) throw new Error('Expiry date must be after the completion date.');
    Object.assign(r, patch);
    logActivity('Training Updated', `Training record ${id} updated.`);
    commit('Training', 'Updated', id, `Training record ${id} updated.`, `Training ${id} updated.`);
  },

  /** Verification is an inspector/manager action — status derives from the dates. */
  verifyTraining(id: string) {
    requirePerm('training.verify');
    const r = state.training.find((x) => x.id === id);
    if (!r) throw new Error('Training record not found.');
    if (r.expiryDate < DEMO_TODAY) throw new Error('This certification has expired and cannot be verified. Renew it first.');
    r.verified = true;
    logActivity('Training Verified', `Training record ${id} verified.`);
    commit('Training', 'Verified', id, `Training record ${id} marked verified.`, `Training ${id} verified.`);
  },

  /** Renew an expired/expiring certification — sets a fresh completion + expiry. */
  renewTraining(id: string) {
    requirePerm('training.update');
    const r = state.training.find((x) => x.id === id);
    if (!r) throw new Error('Training record not found.');
    r.completionDate = DEMO_TODAY;
    r.expiryDate = addDays(DEMO_TODAY, 730);
    r.verified = true;
    logActivity('Training Renewed', `${r.type} for ${r.workerId} renewed until ${r.expiryDate}.`);
    notify('Certification renewed', `${r.type} renewed for worker ${r.workerId}.`, 'Completed', 'Worker Related', r.workerId, '/contractor/workers?tab=Training%20Status');
    commit('Training', 'Renewed', id, `Training ${id} renewed (new expiry ${r.expiryDate}).`, `Training ${id} renewed.`);
  },

  markTrainingComplete(id: string) {
    requirePerm('training.update');
    const r = state.training.find((x) => x.id === id);
    if (!r) throw new Error('Training record not found.');
    if (r.completionDate > DEMO_TODAY) throw new Error('A future-dated record cannot be marked complete.');
    r.verified = true;
    commit('Training', 'Completed', id, `Training ${id} marked complete.`, `Training ${id} marked complete.`);
  },

  // ---------- Attendance / access ----------
  markAttendance(workerId: string, status: AttendanceStatus, manual: boolean) {
    requirePerm('attendance.mark');
    const rec = state.attendance.find((a) => a.workerId === workerId && a.date === DEMO_TODAY);
    if (!rec) throw new Error('No attendance row exists for this worker today.');
    rec.status = status;
    rec.method = manual ? 'Manual' : 'Biometric';
    if (status === AttendanceStatus.Present) {
      if (rec.inTime === '—') rec.inTime = '08:00';
      if (rec.outTime === '—') rec.outTime = '—';
    } else { rec.inTime = '—'; rec.outTime = '—'; }
    logActivity('Attendance Marked', `${status} marked for ${workerId}${manual ? ' (manual entry — never biometric)' : ''}.`);
    commit('Attendance', 'Marked', workerId, `Attendance for ${workerId} set to ${status} (${manual ? 'Manual' : 'Biometric'}).`, `${workerId} → ${status}.`);
  },

  /** Gate decision — allowed / denied / blocked / revoked, with an audited reason. */
  decideAccess(recordId: string, status: AccessStatus, reason: string) {
    requirePerm('access.decide');
    const rec = state.access.find((a) => a.id === recordId);
    if (!rec) throw new Error('Access record not found.');
    if (!reason.trim()) throw new Error('A reason is required for every access decision.');
    rec.status = status;
    rec.reason = reason.trim();
    logActivity('Access Decision', `${status} for ${rec.workerId} at ${rec.gate} — ${rec.reason}`);
    notify(`Access ${status.toLowerCase()}`, `${rec.workerId} at ${rec.gate}: ${rec.reason}`,
      status === AccessStatus.Allowed ? 'Completed' : 'Action Required', 'Compliance', rec.workerId, '/contractor/attendance?tab=Access%20Logs');
    commit('Access', status, recordId, `Gate access ${status} for ${rec.workerId} — ${rec.reason}`, `Access ${status.toLowerCase()}.`);
  },

  // ---------- Leave ----------
  /** Approve / reject a pending leave, or cancel a previously approved one. */
  decideLeave(id: string, decision: 'approve' | 'reject' | 'cancel') {
    requirePerm('attendance.mark');
    const lv = state.leaves.find((x) => x.id === id);
    if (!lv) throw new Error('Leave request not found.');
    if (decision !== 'cancel' && lv.status !== 'Pending') throw new Error('Only pending leave requests can be approved or rejected.');
    if (decision === 'cancel' && lv.status !== 'Approved') throw new Error('Only an approved leave request can be cancelled.');
    lv.status = decision === 'approve' ? 'Approved' : decision === 'reject' ? 'Rejected' : 'Cancelled';
    const w = state.workers.find((x) => x.id === lv.workerId);
    logActivity('Leave Decision', `Leave ${id} for ${lv.workerId} set to ${lv.status}.`);
    notify(`Leave ${lv.status.toLowerCase()}`, `${w?.name ?? lv.workerId}: ${lv.type} ${lv.from} → ${lv.to} is now ${lv.status}.`,
      lv.status === 'Approved' ? 'Completed' : 'Information', 'Worker Related', lv.workerId, '/contractor/attendance?tab=Leave%20Management');
    commit('Leave', lv.status, id, `Leave ${id} for worker ${lv.workerId} set to ${lv.status}.`, `Leave ${id} → ${lv.status}.`);
  },

  // ---------- Gate passes ----------
  /** Issue a new gate pass for a worker's vehicle. */
  issueGatePass(input: { workerId: string; vehicle: string; purpose: string; issuedOn?: string; validTill: string }): string {
    requirePerm('access.decide');
    const w = state.workers.find((x) => x.id === input.workerId);
    if (!w) throw new Error('Worker not found.');
    if (!input.vehicle.trim()) throw new Error('Vehicle number is required.');
    if (!input.purpose.trim()) throw new Error('A purpose is required for every gate pass.');
    const issuedOn = input.issuedOn || DEMO_TODAY;
    if (issuedOn > input.validTill) throw new Error('Valid-till date must be on or after the issue date.');
    if (issuedOn < DEMO_TODAY) throw new Error('Issue date cannot be in the past.');
    if (input.validTill < DEMO_TODAY) throw new Error('Valid-till date cannot be in the past.');
    const id = `GP-${String(state.seq.gp++).padStart(4, '0')}`;
    state.gatePasses.unshift({
      id, workerId: w.id, vehicle: input.vehicle.trim().toUpperCase(), purpose: input.purpose.trim(),
      issuedOn, validTill: input.validTill, status: 'Issued',
    });
    logActivity('Gate Pass Issued', `Gate pass ${id} issued to ${w.name} for vehicle ${input.vehicle}.`);
    commit('Gate Pass', 'Issued', id, `Gate pass ${id} issued to worker ${w.id}.`, `Gate pass ${id} issued.`);
    return id;
  },

  /** Mark a gate pass used, or revoke it (with an audited reason via activity). */
  setGatePassStatus(id: string, status: 'Used' | 'Revoked') {
    requirePerm('access.decide');
    const gp = state.gatePasses.find((x) => x.id === id);
    if (!gp) throw new Error('Gate pass not found.');
    if (gp.status === 'Expired') throw new Error('An expired gate pass cannot be changed — issue a new one.');
    gp.status = status;
    logActivity('Gate Pass', `Gate pass ${id} marked ${status}.`);
    commit('Gate Pass', status, id, `Gate pass ${id} for worker ${gp.workerId} marked ${status}.`, `Gate pass ${id} → ${status}.`);
  },

  // ---------- Bills ----------
  submitBill(input: { contractId: string; mineId: string; workPeriod: string; amount: number; description: string }): string {
    requirePerm('bill.submit');
    if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error('Bill amount must be greater than zero.');
    if (!input.workPeriod.trim()) throw new Error('Work period is required.');
    const id = nextId('bill', 'BILL-2026-', 3);
    state.bills.unshift({
      id, contractId: input.contractId, mineId: input.mineId,
      invoiceNumber: `EMS/2026-27/${String(state.seq.bill + 40).padStart(3, '0')}`,
      workPeriod: input.workPeriod, billDate: DEMO_TODAY, amount: input.amount,
      status: BillStatus.Pending, submittedBy: actor().name, description: input.description,
    });
    notify('Bill submitted', `${id} is pending approval by the mine commercial office.`, 'Action Required', 'Approvals', id, '/contractor/bills?tab=Pending%20Bills');
    logActivity('Bill Submitted', `Bill ${id} submitted for ${input.workPeriod} — ₹${input.amount.toLocaleString('en-IN')}.`);
    commit('Bill', 'Submitted', id, `Bill ${id} submitted (₹${input.amount.toLocaleString('en-IN')}).`, `Bill ${id} submitted.`);
    return id;
  },

  withdrawBill(id: string) {
    requirePerm('bill.withdraw');
    const b = state.bills.find((x) => x.id === id);
    if (!b) throw new Error('Bill not found.');
    if (b.status !== BillStatus.Pending) throw new Error('Only pending bills can be withdrawn.');
    state.bills = state.bills.filter((x) => x.id !== id);
    logActivity('Bill Withdrawn', `Bill ${id} withdrawn before approval.`);
    commit('Bill', 'Withdrawn', id, `Pending bill ${id} withdrawn by contractor.`, `Bill ${id} withdrawn.`);
  },

  acknowledgeBill(id: string) {
    requirePerm('bill.acknowledge');
    const b = state.bills.find((x) => x.id === id);
    if (!b) throw new Error('Bill not found.');
    if (b.status === BillStatus.Pending) throw new Error('Pending bills have not yet been decided by the mine office.');
    b.acknowledged = true;
    commit('Bill', 'Acknowledged', id, `Decision on bill ${id} acknowledged by contractor.`, `Bill ${id} acknowledged.`);
  },

  // ---------- Documents ----------
  uploadDocument(input: { name: string; category: PortalDocument['category']; relatedType: PortalDocument['relatedType']; relatedId: string; mineId: string; expiryDate: string; sizeKb: number }): string {
    requirePerm('document.upload');
    if (!input.name.trim()) throw new Error('Document name is required.');
    if (!input.expiryDate) throw new Error('Expiry date is required for compliance tracking.');
    const id = `DOCX-${String(state.seq.doc++).padStart(4, '0')}`;
    state.documents.unshift({
      id, name: input.name.trim(), category: input.category, relatedType: input.relatedType,
      relatedId: input.relatedId, mineId: input.mineId, issueDate: DEMO_TODAY,
      expiryDate: input.expiryDate, sizeKb: Math.max(1, Math.round(input.sizeKb)),
      uploadedBy: actor().name, mockRef: `mock://docs/${id}`,
    });
    logActivity('Document Uploaded', `Document ${id} (${input.name}) uploaded against ${input.relatedId}.`);
    commit('Document', 'Uploaded', id, `Document ${id} uploaded (simulated local reference, no server upload).`, `"${input.name}" uploaded (simulated).`);
    return id;
  },

  // ---------- Incidents / corrective actions ----------
  createIncident(input: CreateIncidentInput): string {
    requirePerm('incident.create');
    if (!input.description.trim()) throw new Error('A description is required.');
    const id = nextId('inc', 'INC-');
    state.incidents.unshift({
      id, workerId: input.workerId, contractorId: input.contractorId, mineId: input.mineId,
      category: input.category, severity: input.severity, dateDetected: DEMO_TODAY,
      description: input.description.trim(), inspector: input.inspector, status: IncidentStatus.Open,
      evidence: [], timeline: [{ at: new Date().toISOString(), by: actor().name, note: 'Incident raised from the contractor workspace (demo).' }],
    });
    notify('Non-compliance incident raised', `${id} (${input.category}) requires a response.`, 'Action Required', 'Compliance', id, '/contractor/documents?tab=Statutory%20Compliance');
    logActivity('Incident Raised', `Incident ${id} raised (${input.category}, ${input.severity}).`);
    commit('Incident', 'Created', id, `Incident ${id} created.`, `Incident ${id} raised.`);
    return id;
  },

  commentIncident(id: string, note: string) {
    requirePerm('incident.comment');
    const inc = state.incidents.find((x) => x.id === id);
    if (!inc) throw new Error('Incident not found.');
    if (!note.trim()) throw new Error('Comment cannot be empty.');
    inc.timeline.push({ at: new Date().toISOString(), by: actor().name, note: note.trim() });
    logActivity('Incident Comment', `Comment added to ${id}.`);
    commit('Incident', 'Commented', id, `Comment added to incident ${id}.`, 'Comment added.');
  },

  setIncidentStatus(id: string, status: IncidentStatus, resolution?: string) {
    requirePerm('incident.decide');
    const inc = state.incidents.find((x) => x.id === id);
    if (!inc) throw new Error('Incident not found.');
    if ((status === IncidentStatus.Resolved || status === IncidentStatus.Dismissed) && !resolution?.trim()) {
      throw new Error('A resolution note is required to resolve or dismiss an incident.');
    }
    inc.status = status;
    if (resolution?.trim()) inc.resolution = resolution.trim();
    inc.timeline.push({ at: new Date().toISOString(), by: actor().name, note: `Status set to ${status}.` });
    notify(`Incident ${status.toLowerCase()}`, `${id} is now ${status}.`, status === IncidentStatus.Resolved ? 'Completed' : 'Information', 'Compliance', id, '/contractor/documents?tab=Statutory%20Compliance');
    logActivity('Incident Status', `${id} set to ${status}.`);
    commit('Incident', status, id, `Incident ${id} set to ${status}.`, `Incident ${id} → ${status}.`);
  },

  assignInspector(id: string, inspector: string) {
    requirePerm('incident.decide');
    const inc = state.incidents.find((x) => x.id === id);
    if (!inc) throw new Error('Incident not found.');
    if (!inspector.trim()) throw new Error('Select an inspector.');
    inc.inspector = inspector.trim();
    inc.timeline.push({ at: new Date().toISOString(), by: actor().name, note: `Assigned to ${inc.inspector}.` });
    logActivity('Inspector Assigned', `${id} assigned to ${inc.inspector}.`);
    commit('Incident', 'Assigned', id, `Incident ${id} assigned to ${inc.inspector}.`, `Assigned to ${inc.inspector}.`);
  },

  createCorrectiveAction(incidentId: string, input: { description: string; assignedTo: string; dueDate: string }): string {
    requirePerm('incident.action');
    const inc = state.incidents.find((x) => x.id === incidentId);
    if (!inc) throw new Error('Incident not found.');
    if (!input.description.trim()) throw new Error('Corrective action description is required.');
    if (!input.assignedTo.trim()) throw new Error('Assign the action to a responsible party.');
    if (input.dueDate < DEMO_TODAY) throw new Error('Due date cannot be in the past.');
    const id = nextId('ca', 'CA-');
    state.correctiveActions.unshift({
      id, incidentId, description: input.description.trim(), assignedTo: input.assignedTo.trim(),
      dueDate: input.dueDate, status: CorrectiveStatus.InProgress,
      updates: [{ at: new Date().toISOString(), by: actor().name, note: 'Corrective action created and assigned.' }],
    });
    if (inc.status === IncidentStatus.Open) inc.status = IncidentStatus.ActionRequired;
    inc.timeline.push({ at: new Date().toISOString(), by: actor().name, note: `Corrective action ${id} created.` });
    logActivity('Corrective Action', `${id} created for ${incidentId}.`);
    commit('Corrective Action', 'Created', id, `Corrective action ${id} created for incident ${incidentId}.`, `Corrective action ${id} created.`);
    return id;
  },

  /** Responsible-party update + evidence submission (contractor side of the workflow). */
  updateCorrectiveAction(id: string, patch: { note?: string; evidenceRef?: string; submit?: boolean }) {
    requirePerm('incident.action');
    const ca = state.correctiveActions.find((x) => x.id === id);
    if (!ca) throw new Error('Corrective action not found.');
    if (patch.note?.trim()) ca.updates.push({ at: new Date().toISOString(), by: actor().name, note: patch.note.trim() });
    if (patch.evidenceRef) ca.evidenceRef = patch.evidenceRef.trim();
    if (patch.submit) {
      if (!ca.evidenceRef) throw new Error('Attach supporting evidence before submitting the action for review.');
      ca.status = CorrectiveStatus.Submitted;
      ca.updates.push({ at: new Date().toISOString(), by: actor().name, note: 'Submitted for inspector review.' });
    }
    logActivity('Corrective Action', `Corrective action ${id} updated.`);
    commit('Corrective Action', 'Updated', id, `Corrective action ${id} updated.`, `Corrective action ${id} updated.`);
  },

  reviewCorrectiveAction(id: string, approve: boolean, note: string) {
    requirePerm('incident.decide');
    const ca = state.correctiveActions.find((x) => x.id === id);
    if (!ca) throw new Error('Corrective action not found.');
    if (!ca.evidenceRef) throw new Error('No submitted evidence to review yet.');
    if (!note.trim()) throw new Error('A review note is required.');
    ca.status = approve ? CorrectiveStatus.Approved : CorrectiveStatus.Rejected;
    ca.reviewerNote = note.trim();
    ca.updates.push({ at: new Date().toISOString(), by: actor().name, note: `${approve ? 'Approved' : 'Sent back'}: ${note.trim()}` });
    commit('Corrective Action', approve ? 'Approved' : 'Rejected', id, `Corrective action ${id} ${approve ? 'approved' : 'sent back'}.`, `Corrective action ${approve ? 'approved' : 'sent back'}.`);
  },

  // ---------- Reports / notifications ----------
  generateReport(input: { title: string; category: string; period: string }): string {
    requirePerm('report.generate');
    if (!input.title.trim()) throw new Error('Report title is required.');
    const id = `RPT-${String(state.seq.rpt++).padStart(3, '0')}`;
    const row: ReportRow = {
      id, title: input.title.trim(), category: input.category, period: input.period,
      generatedOn: DEMO_TODAY, format: 'CSV', sizeKb: 96 + (state.seq.rpt % 220), status: 'Generating',
    };
    state.reports.unshift(row);
    logActivity('Report Generated', `Report ${id} (${input.title}) queued.`);
    commit('Report', 'Queued', id, `Report ${id} queued for generation.`, `Generating "${input.title}"…`);
    // Simulate completion — stays a demo affordance, no server involved.
    const t = typeof window !== 'undefined' ? window.setTimeout.bind(window) : setTimeout;
    t(() => {
      const r = state.reports.find((x) => x.id === id);
      if (r) { r.status = 'Ready'; bump(); persist(); emit(); toast(`Report ${id} is ready to download.`); }
    }, 1200);
    return id;
  },

  markNotificationRead(id: string) {
    const n = state.notifications.find((x) => x.id === id);
    if (n && !n.read) { n.read = true; bump(); persist(); emit(); }
  },

  markNotificationsRead() {
    let changed = false;
    for (const n of state.notifications) if (!n.read) { n.read = true; changed = true; }
    if (changed) {
      audit('Notifications', 'Marked Read', 'all', 'All notifications marked as read.');
      bump(); persist(); emit(); toast('All notifications marked as read.');
    }
  },

  /** Restore the original deterministic dataset and clear demo persistence. */
  resetDemo() {
    if (typeof window !== 'undefined') { try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ } }
    trendCache.clear();
    state = initial();
    persist(); toast('Demo data reset to the original synthetic dataset.');
  },
};
