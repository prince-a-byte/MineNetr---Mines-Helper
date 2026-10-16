/**
 * MineNetr DGMS mock repository — the ONLY source of truth for the portal.
 * - All reads derive from this state (no independent counters anywhere).
 * - Every mutation goes through an action that updates related records and
 *   appends an audit entry, so dashboard / alerts / reports stay consistent.
 * - useMockDb() subscribes components; bump() notifies all subscribers.
 * - Demo actor identity is read from the real login session when present.
 */
'use client';
import { useSyncExternalStore } from 'react';
import { getUser } from '../api';
import {
  AlertStatus, AuditSeverity, CorrectiveActionStatus, DispatchStatus,
  DocumentStatus, FindingStatus, InspectionStatus, MineStatus, NotificationStatus,
  Priority, ReportStatus, Severity, UserRole, WorkerStatus, type AuditLog,
  type ComplianceReport, type Contractor, type DgmsUser,
  type DispatchRecord, type Finding, type Inspection, type Mine, type Notification,
  type ProductionRecord, type RolePermissions, type ScheduledReport,
  type SensorAlert, type SystemSettings, type Worker,
} from './types';
import {
  contractors as seedContractors, correctiveActions as seedCA, dgmsUsers as seedUsers,
  dispatches as seedDispatches, envRecords as seedEnv, findings as seedFindings,
  incidents as seedIncidents, inspections as seedInspections, inspectors as seedInspectors,
  mines as seedMines, notifications as seedNotifications, production as seedProduction,
  rolePermissions as seedPerms, sensorAlerts as seedAlerts, stockpiles as seedStock,
  workers as seedWorkers, workerDocs as seedDocs, defaultSettings,
} from './seed';
import type {
  CorrectiveAction, EnvironmentalRecord, Inspector, SafetyIncident, Stockpile,
  WorkerDocument,
} from './types';

export interface DbState {
  mines: Mine[];
  inspections: Inspection[];
  inspectors: Inspector[];
  findings: Finding[];
  correctiveActions: CorrectiveAction[];
  incidents: SafetyIncident[];
  env: EnvironmentalRecord[];
  alerts: SensorAlert[];
  production: ProductionRecord[];
  dispatches: DispatchRecord[];
  stockpiles: Stockpile[];
  contractors: Contractor[];
  workers: Worker[];
  workerDocs: WorkerDocument[];
  reports: ComplianceReport[];
  scheduled: ScheduledReport[];
  notifications: Notification[];
  audit: AuditLog[];
  users: DgmsUser[];
  perms: RolePermissions[];
  settings: SystemSettings;
  toasts: { id: number; text: string }[];
  seq: Record<string, number>;
}

function initial(): DbState {
  return {
    mines: structuredClone(seedMines),
    inspections: structuredClone(seedInspections),
    inspectors: structuredClone(seedInspectors),
    findings: structuredClone(seedFindings),
    correctiveActions: structuredClone(seedCA),
    incidents: structuredClone(seedIncidents),
    env: structuredClone(seedEnv),
    alerts: structuredClone(seedAlerts),
    production: structuredClone(seedProduction),
    dispatches: structuredClone(seedDispatches),
    stockpiles: structuredClone(seedStock),
    contractors: structuredClone(seedContractors),
    workers: structuredClone(seedWorkers),
    workerDocs: structuredClone(seedDocs),
    reports: [
      { id: 'RPT-01', type: 'Compliance Report', name: 'Compliance Report (All Mines)', filters: { state: 'All States', mine: 'All Mines' }, generatedAt: '2026-10-03T10:24:00+05:30', generatedBy: 'Amit Verma', status: 'Ready', csv: '' },
      { id: 'RPT-02', type: 'Inspection Report', name: 'Inspection Summary Report', filters: {}, generatedAt: '2026-10-02T09:18:00+05:30', generatedBy: 'R. Singh', status: 'Ready', csv: '' },
      { id: 'RPT-03', type: 'Safety Report', name: 'Safety & Incident Report', filters: {}, generatedAt: '2026-10-01T06:42:00+05:30', generatedBy: 'Amit Verma', status: 'Ready', csv: '' },
      { id: 'RPT-04', type: 'Environmental Report', name: 'Environmental Monitoring Report', filters: {}, generatedAt: '2026-09-30T04:12:00+05:30', generatedBy: 'S. Sharma', status: 'Ready', csv: '' },
      { id: 'RPT-05', type: 'Production Report', name: 'Production & Dispatch Report', filters: {}, generatedAt: '2026-09-28T02:36:00+05:30', generatedBy: 'P. Kumar', status: 'Ready', csv: '' },
      { id: 'RPT-06', type: 'Contractor Report', name: 'Contractor Compliance Report', filters: {}, generatedAt: '2026-09-25T11:09:00+05:30', generatedBy: 'Amit Verma', status: 'Ready', csv: '' },
    ],
    scheduled: [
      { id: 'SCH-01', name: 'Monthly Compliance Report', frequency: 'Monthly', nextRun: '2026-10-05', enabled: true },
      { id: 'SCH-02', name: 'Quarterly Safety Report', frequency: 'Quarterly', nextRun: '2026-11-01', enabled: true },
      { id: 'SCH-03', name: 'Environmental Monitoring Report', frequency: 'Monthly', nextRun: '2026-11-01', enabled: true },
    ],
    notifications: structuredClone(seedNotifications),
    audit: [
      { id: 'AUD-0001', timestamp: '2026-10-03T10:24:00+05:30', user: 'Amit Verma', role: 'Main Administrator', module: 'Inspection', action: 'Approved', resource: 'INS-2026-210', details: 'Inspection report approved for Bharat Coal Mine.', ip: '192.168.1.20', severity: AuditSeverity.Critical, before: 'Pending Approval', after: 'Approved', relatedId: 'INS-2026-210' },
      { id: 'AUD-0002', timestamp: '2026-10-03T09:18:00+05:30', user: 'R. Singh', role: 'Inspector', module: 'Report', action: 'Updated', resource: 'INS-2026-212', details: 'Updated inspection findings for GeVra Mine.', ip: '192.168.1.45', severity: AuditSeverity.High, relatedId: 'INS-2026-212' },
      { id: 'AUD-0003', timestamp: '2026-10-02T18:31:00+05:30', user: 'System', role: 'System', module: 'Login', action: 'Login', resource: 'session', details: 'Scheduled report job executed.', ip: '127.0.0.1', severity: AuditSeverity.Low },
    ],
    users: structuredClone(seedUsers),
    perms: structuredClone(seedPerms),
    settings: defaultSettings(),
    toasts: [],
    seq: { mine: 13, insp: 215, fnd: 483, ca: 107, not: 13, aud: 4, rpt: 7, w: 1017, ctr: 7, dsp: 302 },
  };
}

let state: DbState = initial();
let toastSeq = 1;
const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }
function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
function snapshot() { return state; }

/** Re-render every subscriber on any mutation. */
export function useMockDb(): DbState {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
export function getDb(): DbState { return state; }

function actor(): { name: string; role: string } {
  try {
    const u = getUser();
    if (u?.name) return { name: u.name, role: u.title || u.role || 'Main Administrator' };
  } catch { /* demo fallback */ }
  return { name: 'Amit Verma', role: 'Main Administrator' };
}

function audit(module: string, action: string, resource: string, details: string, severity: AuditSeverity, extra?: Partial<AuditLog>) {
  const a = actor();
  const id = `AUD-${String(state.seq.aud++).padStart(4, '0')}`;
  state.audit.unshift({
    id, timestamp: new Date().toISOString(), user: a.name, role: a.role,
    module, action, resource, details, ip: '192.168.1.20', severity, ...extra,
  });
}

export function toast(text: string) {
  state.toasts = [...state.toasts.slice(-2), { id: toastSeq++, text }];
  emit();
  window.setTimeout(() => {
    state.toasts = state.toasts.slice(1);
    emit();
  }, 4200);
}

// ---------- Actions (all consistency + audit enforced here) ----------

export const actions = {
  // -- Mines --
  createMine(input: Omit<Mine, 'id' | 'location'> & { location?: Mine['location'] }) {
    if (state.mines.some((m) => m.code.toLowerCase() === input.code.toLowerCase())) {
      throw new Error(`Mine code ${input.code} already exists.`);
    }
    const id = `M-${state.seq.mine++}`;
    state.mines.push({ ...input, id, location: input.location ?? { lat: 23.0, lng: 85.0, demo: true } });
    audit('Mine Registry', 'Created', input.code, `Mine ${input.name} (${input.code}) registered.`, AuditSeverity.Medium, { relatedId: id });
    toast(`Mine ${input.code} registered.`);
    emit();
    return id;
  },
  updateMine(id: string, patch: Partial<Mine>) {
    const m = state.mines.find((x) => x.id === id);
    if (!m) return;
    if (patch.code && state.mines.some((x) => x.id !== id && x.code.toLowerCase() === patch.code!.toLowerCase())) {
      throw new Error(`Mine code ${patch.code} already exists.`);
    }
    const before = m.status;
    Object.assign(m, patch);
    audit('Mine Registry', 'Updated', m.code, `Mine ${m.code} updated${patch.status && patch.status !== before ? ` (status ${before} → ${patch.status})` : ''}.`, AuditSeverity.Medium, { before, after: m.status, relatedId: id });
    toast(`Mine ${m.code} updated.`);
    emit();
  },

  // -- Inspections --
  createInspection(input: Omit<Inspection, 'id' | 'reportStatus'>) {
    const id = `INS-2026-${state.seq.insp++}`;
    state.inspections.unshift({ ...input, id, reportStatus: ReportStatus.NotSubmitted });
    const mine = state.mines.find((m) => m.id === input.mineId);
    audit('Inspection', 'Scheduled', id, `Inspection ${id} scheduled at ${mine?.name ?? input.mineId}.`, AuditSeverity.Medium, { relatedId: id });
    toast(`Inspection ${id} scheduled.`);
    emit();
    return id;
  },
  updateInspection(id: string, patch: Partial<Inspection>) {
    const i = state.inspections.find((x) => x.id === id);
    if (!i) return;
    const before = i.status;
    Object.assign(i, patch);
    // Completing an inspection refreshes the mine's last-inspection stamp.
    if (patch.status === InspectionStatus.Completed && before !== InspectionStatus.Completed) {
      const mine = state.mines.find((m) => m.id === i.mineId);
      if (mine && i.actualDate) mine.lastInspection = i.actualDate.slice(0, 10);
      if (i.reportStatus === ReportStatus.NotSubmitted) i.reportStatus = ReportStatus.Submitted;
    }
    audit('Inspection', patch.status && patch.status !== before ? patch.status : 'Updated', id, `Inspection ${id}: ${before} → ${i.status}.`, AuditSeverity.Medium, { before, after: i.status, relatedId: id });
    toast(`Inspection ${id} updated.`);
    emit();
  },

  // -- Findings + corrective actions --
  updateFinding(id: string, patch: Partial<Finding>) {
    const f = state.findings.find((x) => x.id === id);
    if (!f) return;
    const before = f.status;
    // Resolution requires a resolved corrective action (or explicit override note).
    if (patch.status === FindingStatus.Resolved && before !== FindingStatus.Resolved) {
      const ca = state.correctiveActions.find((c) => c.findingId === id);
      const ok = ca && (ca.status === CorrectiveActionStatus.Resolved || ca.status === CorrectiveActionStatus.AwaitingVerification);
      if (!ok && !(patch as { forceNote?: string }).forceNote) {
        throw new Error('Resolve the linked corrective action (or record verification) before closing this finding.');
      }
    }
    Object.assign(f, patch);
    audit('Findings', 'Updated', id, `Finding ${id}: ${before} → ${f.status}.`, f.severity === Severity.Critical ? AuditSeverity.High : AuditSeverity.Medium, { before, after: f.status, relatedId: id });
    toast(`Finding ${id} updated.`);
    emit();
  },
  assignCorrectiveAction(findingId: string, input: { officer: string; dueDate: string; note: string }) {
    const f = state.findings.find((x) => x.id === findingId);
    if (!f) throw new Error('Finding not found.');
    const id = `CA-2026-${state.seq.ca++}`;
    state.correctiveActions.unshift({ id, findingId, officer: input.officer, dueDate: input.dueDate, note: input.note, status: CorrectiveActionStatus.Assigned, updatedAt: new Date().toISOString() });
    if (f.status === FindingStatus.Open) f.status = FindingStatus.Assigned;
    audit('Findings', 'Assigned', id, `Corrective action ${id} assigned to ${input.officer} for ${findingId}.`, AuditSeverity.Medium, { relatedId: findingId });
    toast(`Corrective action ${id} assigned.`);
    emit();
    return id;
  },
  updateCorrectiveAction(id: string, patch: Partial<CorrectiveAction> & { resolution?: string }) {
    const ca = state.correctiveActions.find((x) => x.id === id);
    if (!ca) return;
    Object.assign(ca, patch, { updatedAt: new Date().toISOString() });
    const f = state.findings.find((x) => x.id === ca.findingId);
    if (f) {
      if (ca.status === CorrectiveActionStatus.Resolved) f.status = FindingStatus.AwaitingVerification;
      else if (ca.status === CorrectiveActionStatus.Reopened) f.status = FindingStatus.Reopened;
      else if (f.status === FindingStatus.Assigned && ca.status === CorrectiveActionStatus.InProgress) f.status = FindingStatus.InProgress;
    }
    audit('Findings', 'Updated', id, `Corrective action ${id} → ${ca.status}.`, AuditSeverity.Medium, { relatedId: ca.findingId });
    toast(`Corrective action ${id} updated.`);
    emit();
  },

  // -- Environment --
  acknowledgeAlert(id: string) {
    const a = state.alerts.find((x) => x.id === id);
    if (!a || a.status !== AlertStatus.Open) return;
    a.status = AlertStatus.Acknowledged;
    audit('Environment', 'Acknowledged', id, `Sensor alert ${id} acknowledged (${a.parameter} at ${a.mineId}). Acknowledgement does not clear the underlying condition.`, AuditSeverity.Medium, { before: 'Open', after: 'Acknowledged', relatedId: id });
    toast(`Alert ${id} acknowledged.`);
    emit();
  },

  // -- Production / dispatch --
  recordDispatch(input: Omit<DispatchRecord, 'id' | 'status'> & { status?: DispatchStatus }) {
    const id = `DSP-2026-${state.seq.dsp++}`;
    state.dispatches.unshift({ ...input, id, status: input.status ?? DispatchStatus.Scheduled });
    audit('Production', 'Recorded', id, `Dispatch ${id} recorded for ${input.mineId} (${input.quantityMt} Mt).`, AuditSeverity.Low, { relatedId: id });
    toast(`Dispatch ${id} recorded.`);
    emit();
    return id;
  },
  updateDispatch(id: string, patch: Partial<DispatchRecord>) {
    const d = state.dispatches.find((x) => x.id === id);
    if (!d) return;
    Object.assign(d, patch);
    audit('Production', 'Updated', id, `Dispatch ${id} updated (${patch.status ?? 'details changed'}).`, AuditSeverity.Low, { relatedId: id });
    toast(`Dispatch ${id} updated.`);
    emit();
  },

  // -- Workers / contractors --
  createWorker(input: Omit<Worker, 'id' | 'idMasked'>) {
    const n = state.seq.w++;
    const id = `W-${n}`;
    state.workers.unshift({ ...input, id, idMasked: `XXXX-XXXX-${n}` });
    audit('Workers', 'Created', id, `Worker ${input.name} registered under ${input.contractorId}.`, AuditSeverity.Low, { relatedId: id });
    toast(`Worker ${id} registered.`);
    emit();
    return id;
  },
  updateWorker(id: string, patch: Partial<Worker>) {
    const w = state.workers.find((x) => x.id === id);
    if (!w) return;
    Object.assign(w, patch);
    audit('Workers', 'Updated', id, `Worker ${id} record updated.`, AuditSeverity.Low, { relatedId: id });
    toast(`Worker ${id} updated.`);
    emit();
  },
  createContractor(input: Omit<Contractor, 'id'>) {
    const id = `CTR-${String(state.seq.ctr++).padStart(2, '0')}`;
    state.contractors.unshift({ ...input, id });
    audit('Workers', 'Created', id, `Contractor ${input.company} registered.`, AuditSeverity.Medium, { relatedId: id });
    toast(`Contractor ${input.company} registered.`);
    emit();
    return id;
  },

  // -- Reports --
  generateReport(type: string, name: string, filters: Record<string, string>, csv: string) {
    const id = `RPT-${String(state.seq.rpt++).padStart(2, '0')}`;
    const a = actor();
    state.reports.unshift({ id, type, name, filters, generatedAt: new Date().toISOString(), generatedBy: a.name, status: 'Ready', csv });
    audit('Reports', 'Generated', id, `Report "${name}" generated with current filters.`, AuditSeverity.Low, { relatedId: id });
    toast(`Report "${name}" generated.`);
    emit();
    return id;
  },
  createSchedule(input: Omit<ScheduledReport, 'id'>) {
    const id = `SCH-${String(state.seq.rpt++).padStart(2, '0')}`;
    state.scheduled.push({ ...input, id });
    audit('Reports', 'Created', id, `Scheduled report "${input.name}" created (demo configuration only).`, AuditSeverity.Low, { relatedId: id });
    toast(`Schedule "${input.name}" created.`);
    emit();
    return id;
  },
  toggleSchedule(id: string) {
    const s = state.scheduled.find((x) => x.id === id);
    if (!s) return;
    s.enabled = !s.enabled;
    audit('Reports', s.enabled ? 'Enabled' : 'Disabled', id, `Scheduled report "${s.name}" ${s.enabled ? 'enabled' : 'disabled'} (demo configuration only; no background scheduler exists).`, AuditSeverity.Low, { relatedId: id });
    toast(`Schedule "${s.name}" ${s.enabled ? 'enabled' : 'disabled'}.`);
    emit();
  },
  updateSchedule(id: string, patch: Partial<ScheduledReport>) {
    const s = state.scheduled.find((x) => x.id === id);
    if (!s) return;
    Object.assign(s, patch);
    audit('Reports', 'Updated', id, `Scheduled report "${s.name}" reconfigured.`, AuditSeverity.Low, { relatedId: id });
    toast(`Schedule "${s.name}" updated.`);
    emit();
  },
  deleteSchedule(id: string) {
    const i = state.scheduled.findIndex((x) => x.id === id);
    if (i < 0) return;
    const [s] = state.scheduled.splice(i, 1);
    audit('Reports', 'Deleted', id, `Scheduled report "${s.name}" deleted.`, AuditSeverity.Medium, { relatedId: id });
    toast(`Schedule "${s.name}" deleted.`);
    emit();
  },

  // -- Notifications --
  markRead(id: string) {
    const n = state.notifications.find((x) => x.id === id);
    if (!n) return;
    if (n.status === NotificationStatus.Unread) n.status = NotificationStatus.Read;
    audit('Notifications', 'Read', id, `Notification "${n.title}" marked read.`, AuditSeverity.Low, { relatedId: id });
    emit();
  },
  markSelectedRead(ids: string[]) {
    let c = 0;
    state.notifications.forEach((n) => {
      if (ids.includes(n.id) && n.status === NotificationStatus.Unread) { n.status = NotificationStatus.Read; c++; }
    });
    audit('Notifications', 'Read', `${c} selected`, `${c} notifications marked read in bulk.`, AuditSeverity.Low);
    toast(`${c} notification(s) marked read.`);
    emit();
  },
  markAllRead() {
    let c = 0;
    state.notifications.forEach((n) => {
      if (n.status === NotificationStatus.Unread) { n.status = NotificationStatus.Read; c++; }
    });
    if (c) audit('Notifications', 'Read', 'all', `${c} notifications marked read.`, AuditSeverity.Low);
    toast(c ? `${c} notification(s) marked read.` : 'No unread notifications.');
    emit();
  },
  acknowledgeNotification(id: string) {
    const n = state.notifications.find((x) => x.id === id);
    if (!n) return;
    n.status = NotificationStatus.Acknowledged;
    audit('Notifications', 'Acknowledged', id, `Notification "${n.title}" acknowledged. Underlying record unchanged.`, AuditSeverity.Medium, { relatedId: id });
    toast(`Notification ${id} acknowledged.`);
    emit();
  },
  resolveNotification(id: string) {
    const n = state.notifications.find((x) => x.id === id);
    if (!n) return;
    n.status = NotificationStatus.Resolved;
    audit('Notifications', 'Resolved', id, `Notification "${n.title}" marked resolved.`, AuditSeverity.Medium, { relatedId: id });
    toast(`Notification ${id} resolved.`);
    emit();
  },

  // -- Users / permissions / settings --
  createUser(input: Omit<DgmsUser, 'id' | 'lastLogin'>) {
    if (state.users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) {
      throw new Error(`User ${input.email} already exists.`);
    }
    const id = `USR-${String(state.users.length + 1).padStart(2, '0')}`;
    state.users.unshift({ ...input, id, lastLogin: new Date().toISOString() });
    audit('User Management', 'Created', id, `Demo user ${input.name} (${input.role}) created. Passwords are never stored or shown.`, AuditSeverity.High, { relatedId: id });
    toast(`User ${input.name} created.`);
    emit();
    return id;
  },
  updateUser(id: string, patch: Partial<DgmsUser>) {
    const u = state.users.find((x) => x.id === id);
    if (!u) return;
    Object.assign(u, patch);
    audit('User Management', 'Updated', id, `Demo user ${u.name} updated.`, AuditSeverity.High, { relatedId: id });
    toast(`User ${u.name} updated.`);
    emit();
  },
  updatePermissions(role: UserRole, perms: RolePermissions['perms']) {
    const r = state.perms.find((x) => x.role === role);
    if (!r) return;
    r.perms = { ...perms };
    audit('User Management', 'Updated', role, `Demo permission matrix updated for ${role}. Frontend-only: does not enforce backend authorization.`, AuditSeverity.High, { relatedId: role });
    toast(`Permissions for ${role} updated (demo).`);
    emit();
  },
  updateSettings(patch: Partial<SystemSettings>, label = 'System settings') {
    Object.assign(state.settings, patch);
    audit('Settings', 'Updated', 'system', `${label} updated (demo configuration).`, AuditSeverity.Medium);
    toast('Settings saved (demo).');
    emit();
  },
  restoreBackup(data: DbState) {
    // Validated by the caller before invoking.
    state = { ...data, toasts: [], seq: { ...data.seq } };
    audit('Settings', 'Restored', 'backup', 'Demo data restored from validated backup file.', AuditSeverity.High);
    toast('Backup restored.');
    emit();
  },
  resetDemo() {
    state = initial();
    emit();
  },
};

export function getInspector(id: string) {
  return state.inspectors.find((i) => i.id === id);
}
export function getMine(id: string) {
  return state.mines.find((m) => m.id === id);
}
export function currentUserRole(): UserRole {
  return UserRole.MainAdministrator; // demo session acts as Main Administrator
}
