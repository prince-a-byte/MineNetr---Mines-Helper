/**
 * MineNetr Operations mock repository — the ONLY source of truth for the
 * 11-page portal. All reads derive from this state; every mutation goes
 * through an action that:
 *   1. enforces referential/quantity consistency,
 *   2. updates every affected record (cross-page updates),
 *   3. appends an append-only audit entry (drives Recent Activities),
 *   4. emits a toast and notifies subscribers (useMockOps()).
 *
 * No page may hold its own counters or hardcoded totals.
 */
'use client';
import { useSyncExternalStore } from 'react';
import { getUser } from '../api';
import {
  AccessStatus, AttendanceSource, AttendanceStatus, BillApprovalStatus,
  CorrectiveActionStatus, DocumentAction, DocumentStatus, FindingStatusNew,
  InspectionStatusNew, NotificationStatusNew, PaymentStatus, ReportStatus,
  StockStatus, StockTxStatus, StockTxType, TrainingStatus, WorkerStatus,
  DEMO_TODAY,
  type AccessRecord, type AttendanceRecord, type Bill, type Contractor,
  type CorrectiveAction, type DispatchRecord, type Inspection, type Mine,
  WorkOrderStatus,
  type OpsAuditEntry, type OpsDocument, type OpsNotification, type OpsReport,
  type OperationsSettings, type OperationsUser, type Payment, type ProductionRecord,
  type Stockpile, type StockpileTransaction, type Worker, type WorkOrder,
} from './types';
import {
  accessRecords as seedAccess, audit as seedAudit, attendance as seedAttendance,
  bills as seedBills, cameras as seedCameras, contractors as seedContractors,
  correctiveActions as seedCA, defaultSettings, dispatches as seedDispatches,
  documents as seedDocs, envConditions as seedEnv, gasSensors as seedSensors,
  gasTrend as seedTrend, inspections as seedInspections, mines as seedMines,
  notifications as seedNotifications, opsUser as seedUser, payments as seedPayments,
  production as seedProduction, reconciliations as seedRecon, reports as seedReports,
  stockTx as seedStockTx, stockpiles as seedStock, vehicles as seedVehicles,
  weighbridge as seedWb, workOrders as seedWo, findings as seedFindings,
  workers as seedWorkers,
} from './seed';

export interface OpsDbState {
  mines: Mine[]; contractors: Contractor[]; workOrders: WorkOrder[]; workers: Worker[];
  attendance: AttendanceRecord[]; access: AccessRecord[];
  production: ProductionRecord[]; dispatches: DispatchRecord[];
  stockpiles: Stockpile[]; stockTx: StockpileTransaction[];
  bills: Bill[]; payments: Payment[]; documents: OpsDocument[];
  inspections: Inspection[]; findings: typeof seedFindings; correctiveActions: CorrectiveAction[];
  notifications: OpsNotification[]; audit: OpsAuditEntry[]; reports: OpsReport[];
  user: OperationsUser; settings: OperationsSettings;
  selectedMineId: string; // 'ALL' | mine id — permission scoped
  toasts: { id: number; text: string }[];
  seq: Record<string, number>;
}

function initial(): OpsDbState {
  return {
    mines: structuredClone(seedMines), contractors: structuredClone(seedContractors),
    workOrders: structuredClone(seedWo), workers: structuredClone(seedWorkers), attendance: structuredClone(seedAttendance),
    access: structuredClone(seedAccess), production: structuredClone(seedProduction),
    dispatches: structuredClone(seedDispatches), stockpiles: structuredClone(seedStock),
    stockTx: structuredClone(seedStockTx), bills: structuredClone(seedBills),
    payments: structuredClone(seedPayments), documents: structuredClone(seedDocs),
    inspections: structuredClone(seedInspections), findings: structuredClone(seedFindings),
    correctiveActions: structuredClone(seedCA), notifications: structuredClone(seedNotifications),
    audit: structuredClone(seedAudit), reports: structuredClone(seedReports),
    user: structuredClone(seedUser), settings: defaultSettings(),
    selectedMineId: 'M-01',
    toasts: [],
    seq: { worker: 133, att: 700, acc: 500, prod: 200, dsp: 120, stx: 950, bill: 13, pay: 5, doc: 23, insp: 57, fnd: 19, ca: 22, not: 11, aud: 6, rpt: 11, asg: 200, wo: 11, ctr: 13 },
  };
}

let state: OpsDbState = initial();
let toastSeq = 1;
const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }
function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
function snapshot() { return state; }

export function useMockOps(): OpsDbState { return useSyncExternalStore(subscribe, snapshot, snapshot); }
export function getOpsDb(): OpsDbState { return state; }

function actor(): { name: string; role: string } {
  try {
    const u = getUser();
    if (u?.name) return { name: u.name, role: u.title || u.role || 'Mine Operator' };
  } catch { /* demo fallback */ }
  return { name: state.user.name, role: state.user.role };
}

function audit(module: string, action: string, resource: string, details: string, extra?: Partial<OpsAuditEntry>) {
  const a = actor();
  state.audit.unshift({
    id: `AUD-${String(state.seq.aud++).padStart(4, '0')}`, timestamp: new Date().toISOString(),
    user: a.name, role: a.role, module, action, resource, details,
    before: null, after: null, relatedId: null, ...extra,
  });
}

export function toast(text: string) {
  state.toasts = [...state.toasts.slice(-2), { id: toastSeq++, text }];
  emit();
  const t = typeof window !== 'undefined' ? window.setTimeout.bind(window) : setTimeout;
  t(() => { state.toasts = state.toasts.slice(1); emit(); }, 4200);
}

// ---------- Derived helpers (pages must use these, never local counters) ----------
export function stockCurrent(spId: string, db: OpsDbState = state): number {
  const sp = db.stockpiles.find((s) => s.id === spId);
  if (!sp) return 0;
  let q = sp.openingMt;
  for (const tx of db.stockTx) {
    if (tx.stockpileId === spId) {
      if (tx.type === StockTxType.Production || tx.status === StockTxStatus.Added) q += tx.quantityMt;
      else if (tx.type === StockTxType.Dispatch || tx.status === StockTxStatus.Deducted) q -= tx.quantityMt;
      else if (tx.type === StockTxType.Transfer && tx.status === StockTxStatus.Transferred) q -= tx.quantityMt;
    }
    if (tx.toStockpileId === spId && tx.type === StockTxType.Transfer) q += tx.quantityMt;
    if (tx.type === StockTxType.Reconciliation && tx.stockpileId === spId) {
      // variance is informational; physical adjustment applied via reference rows
    }
  }
  return Number(q.toFixed(3));
}
export function stockStatusOf(sp: Stockpile, db: OpsDbState = state): StockStatus {
  const u = stockCurrent(sp.id, db) / sp.capacityMt;
  return u > 0.85 ? StockStatus.High : u < 0.25 ? StockStatus.Low : StockStatus.Normal;
}
/** Workers currently inside the mine: checked in today and not yet checked out. */
export function onSiteWorkerIds(db: OpsDbState = state): Set<string> {
  const on = new Set<string>();
  const todays = db.attendance.filter((a) => a.date === DEMO_TODAY && a.inTime !== null && a.outTime === null);
  for (const a of todays) {
    if (a.status === AttendanceStatus.Present || a.status === AttendanceStatus.HalfDay) on.add(a.workerId);
  }
  return on;
}
export function billPaid(b: Bill, db: OpsDbState = state): number {
  return db.payments.filter((p) => p.billId === b.id).reduce((s, p) => s + p.amount, 0);
}

// ---------- Actions ----------
export const actions = {
  // -- Mine context --
  selectMine(mineId: string) {
    if (mineId !== 'ALL' && !state.user.minePermissions.includes(mineId)) {
      throw new Error('You do not have access to this mine.');
    }
    if (state.selectedMineId === mineId) return;
    state.selectedMineId = mineId;
    emit();
  },

  // -- Workers (workflow 1: worker table + contractor manpower + KPI) --
  createWorker(input: { name: string; code: string; contractorId: string | null; mineId: string; role: string; skill: string; joinedOn: string; trainingStatus: TrainingStatus; accessStatus: AccessStatus; phone: string }) {
    if (state.workers.some((w) => w.code.toLowerCase() === input.code.toLowerCase())) {
      throw new Error(`Worker ID ${input.code} already exists.`);
    }
    if (input.contractorId && !state.contractors.some((c) => c.id === input.contractorId)) {
      throw new Error('Selected contractor does not exist.');
    }
    if (!state.mines.some((m) => m.id === input.mineId)) throw new Error('Selected mine does not exist.');
    const n = state.seq.worker++;
    const id = `W-${String(n).padStart(4, '0')}`;
    const w: Worker = {
      id, code: input.code, name: input.name,
      workforceType: input.contractorId ? 'Contractor' as never : 'Mine' as never,
      contractorId: input.contractorId, mineId: input.mineId, role: input.role, skill: input.skill,
      joinedOn: input.joinedOn, phone: input.phone, trainingStatus: input.trainingStatus,
      trainingExpiry: input.trainingStatus === TrainingStatus.NotTrained ? null : '2027-10-03',
      accessStatus: input.accessStatus, accessCardId: `AC-${1000 + n}`, status:
        input.accessStatus === AccessStatus.Blocked ? WorkerStatus.Blocked : WorkerStatus.Active,
      biomeitricId: `BIO-${5000 + n}`,
      assignments: input.contractorId ? [{ id: `ASG-${state.seq.asg++}`, contractorId: input.contractorId, mineId: input.mineId, from: input.joinedOn, to: null, role: input.role }] : [],
    };
    state.workers.push(w);
    // Today's attendance row so the worker immediately appears in attendance options.
    state.attendance.push({
      id: `ATT-${String(state.seq.att++).padStart(5, '0')}`, workerId: id,
      date: state.attendance.find((a) => a.date)?.date ?? '2026-10-03', inTime: null, outTime: null,
      status: AttendanceStatus.NotScheduled, shift: 'Morning' as never, location: null, source: AttendanceSource.Manual,
    });
    const ctr = state.contractors.find((c) => c.id === input.contractorId);
    audit('Workers', 'Created', input.code, `Worker ${input.name} (${input.code}) registered${ctr ? ` under ${ctr.name}` : ' as direct mine workforce'}.`, { relatedId: id, after: 'Active' });
    toast(`Worker ${input.code} registered.`);
    emit();
    return id;
  },
  updateWorker(id: string, patch: Partial<Worker>) {
    const w = state.workers.find((x) => x.id === id);
    if (!w) return;
    const before = `${w.status}/${w.accessStatus}`;
    Object.assign(w, patch);
    if (patch.accessStatus === AccessStatus.Blocked) w.status = WorkerStatus.Blocked;
    else if (patch.accessStatus === AccessStatus.Allowed && w.status === WorkerStatus.Blocked) w.status = WorkerStatus.Active;
    audit('Workers', 'Updated', w.code, `Worker ${w.code} updated${patch.accessStatus ? ` (access ${before.split('/')[1]} → ${w.accessStatus})` : ''}.`, { relatedId: id, before, after: `${w.status}/${w.accessStatus}` });
    toast(`Worker ${w.code} updated.`);
    emit();
  },
  assignContractor(workerId: string, contractorId: string, mineId: string) {
    const w = state.workers.find((x) => x.id === workerId);
    const c = state.contractors.find((x) => x.id === contractorId);
    if (!w || !c) throw new Error('Worker or contractor not found.');
    if (!c.mineIds.includes(mineId)) throw new Error(`${c.name} is not empanelled at the selected mine.`);
    w.contractorId = contractorId; w.mineId = mineId; w.workforceType = 'Contractor' as never;
    w.assignments.forEach((a) => { if (!a.to) a.to = new Date().toISOString().slice(0, 10); });
    w.assignments.push({ id: `ASG-${state.seq.asg++}`, contractorId, mineId, from: new Date().toISOString().slice(0, 10), to: null, role: w.role });
    audit('Workers', 'Assigned', w.code, `${w.code} assigned to ${c.name}.`, { relatedId: workerId, after: c.name });
    toast(`${w.code} assigned to ${c.name}.`);
    emit();
  },
  updateTraining(workerId: string, status: TrainingStatus, expiry: string | null) {
    const w = state.workers.find((x) => x.id === workerId);
    if (!w) return;
    const before = w.trainingStatus;
    w.trainingStatus = status; w.trainingExpiry = expiry;
    // Training drives access eligibility (safety rule).
    if (status === TrainingStatus.Expired || status === TrainingStatus.NotTrained) {
      w.accessStatus = AccessStatus.Blocked; w.status = WorkerStatus.Blocked;
    } else if (before === TrainingStatus.Expired || before === TrainingStatus.NotTrained) {
      w.accessStatus = AccessStatus.Allowed; w.status = WorkerStatus.Active;
    }
    audit('Workers', 'Training Updated', w.code, `Training for ${w.code}: ${before} → ${status}${w.accessStatus === AccessStatus.Blocked ? ' (access auto-blocked)' : ''}.`, { relatedId: workerId, before, after: status });
    toast(`Training record updated for ${w.code}.`);
    emit();
  },

  // -- Attendance (workflow 2: attendance table + on-site + recent activities) --
  checkIn(workerId: string, location?: string) {
    const w = state.workers.find((x) => x.id === workerId);
    if (!w) throw new Error('Worker not found.');
    const today = state.attendance.find((a) => a.workerId === workerId && a.inTime !== null && a.outTime === null);
    if (today) throw new Error(`${w.code} is already checked in at ${today.inTime}.`);
    if (w.accessStatus === AccessStatus.Blocked) throw new Error(`Access for ${w.code} is blocked — unblock first.`);
    const rec: AttendanceRecord = {
      id: `ATT-${String(state.seq.att++).padStart(5, '0')}`, workerId,
      date: '2026-10-03', inTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
      outTime: null, status: AttendanceStatus.Present, shift: 'Morning' as never,
      location: (location as never) ?? 'Surface', source: AttendanceSource.Gate,
    };
    state.attendance.push(rec);
    state.access.unshift({
      id: `ACS-${String(state.seq.acc++).padStart(4, '0')}`, subject: w.name, subjectKind: 'Worker',
      workerId: w.id, mineId: w.mineId, type: 'Entry', time: rec.inTime!, date: rec.date,
      gate: 'Gate 1', result: AccessStatus.Allowed, reason: null,
    });
    audit('Attendance', 'Check-In', w.code, `${w.name} (${w.code}) checked in at ${rec.inTime}.`, { relatedId: workerId, after: 'Present' });
    toast(`${w.code} checked in.`);
    emit();
    return rec.id;
  },
  checkOut(workerId: string) {
    const w = state.workers.find((x) => x.id === workerId);
    const rec = [...state.attendance].reverse().find((a) => a.workerId === workerId && a.inTime !== null && a.outTime === null);
    if (!rec) throw new Error('No active check-in found for this worker.');
    rec.outTime = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    state.access.unshift({
      id: `ACS-${String(state.seq.acc++).padStart(4, '0')}`, subject: w?.name ?? workerId, subjectKind: 'Worker',
      workerId, mineId: w?.mineId ?? 'M-01', type: 'Exit', time: rec.outTime, date: rec.date,
      gate: 'Gate 1', result: AccessStatus.Allowed, reason: null,
    });
    audit('Attendance', 'Check-Out', w?.code ?? workerId, `${w?.name ?? workerId} checked out at ${rec.outTime}.`, { relatedId: workerId, after: 'Checked out' });
    toast(`${w?.code ?? 'Worker'} checked out.`);
    emit();
  },
  setAttendanceStatus(recordId: string, status: AttendanceStatus) {
    const r = state.attendance.find((x) => x.id === recordId);
    if (!r) return;
    const before = r.status;
    r.status = status;
    audit('Attendance', 'Updated', recordId, `Attendance ${recordId}: ${before} → ${status} (manual entry).`, { relatedId: recordId, before, after: status });
    toast(`Attendance updated to ${status}.`);
    emit();
  },
  grantAccess(workerId: string) {
    const w = state.workers.find((x) => x.id === workerId);
    if (!w) return;
    if (w.trainingStatus === TrainingStatus.Expired || w.trainingStatus === TrainingStatus.NotTrained) {
      throw new Error('Cannot grant access while training is expired/not completed.');
    }
    w.accessStatus = AccessStatus.Allowed; w.status = WorkerStatus.Active;
    audit('Access', 'Granted', w.code, `Mine access granted to ${w.name} (${w.code}).`, { relatedId: workerId, before: 'Blocked', after: 'Allowed' });
    toast(`Access granted to ${w.code}.`);
    emit();
  },
  revokeAccess(workerId: string, reason: string) {
    const w = state.workers.find((x) => x.id === workerId);
    if (!w) return;
    w.accessStatus = AccessStatus.Blocked; w.status = WorkerStatus.Blocked;
    audit('Access', 'Revoked', w.code, `Mine access revoked for ${w.name} (${w.code}) — ${reason}`, { relatedId: workerId, before: 'Allowed', after: 'Blocked' });
    toast(`Access revoked for ${w.code}.`);
    emit();
  },

  // -- Contractors --
  createContractor(input: { name: string; code: string; workType: string; contactPerson: string; phone: string; email: string; start: string; end: string; mineIds: string[]; contractValueLakh: number }) {
    if (state.contractors.some((c) => c.code.toLowerCase() === input.code.toLowerCase())) throw new Error(`Contractor code ${input.code} already exists.`);
    if (state.contractors.some((c) => c.name.toLowerCase() === input.name.toLowerCase())) throw new Error(`Contractor "${input.name}" already exists.`);
    if (new Date(input.end) <= new Date(input.start)) throw new Error('Contract end must be after start date.');
    const n = state.seq.bill; // separate counter reused safely below
    const id = `CTR-${String(state.contractors.length + 1).padStart(2, '0')}`;
    const c: Contractor = {
      id, code: input.code, name: input.name, workType: input.workType, contactPerson: input.contactPerson,
      phone: input.phone, email: input.email, contractNo: `CT-BCM-${String(state.contractors.length + 1).padStart(3, '0')}`,
      start: input.start, end: input.end, status: 'Pending Approval' as never, mineIds: input.mineIds,
      contractValueLakh: input.contractValueLakh, complianceStatus: 'Partial Compliance', rating: 0,
    };
    state.contractors.push(c);
    audit('Contractors', 'Created', c.contractNo, `Contractor ${c.name} (${c.code}) submitted for approval.`, { relatedId: id, after: 'Pending Approval' });
    toast(`Contractor ${c.code} submitted for approval.`);
    emit();
    return id;
    void n;
  },
  setContractorStatus(id: string, status: Contractor['status'], note?: string) {
    const c = state.contractors.find((x) => x.id === id);
    if (!c) return;
    const before = c.status;
    c.status = status;
    audit('Contractors', status === 'Active' ? 'Approved' : status === 'Rejected' ? 'Rejected' : 'Updated', c.contractNo, `${c.name}: contract status ${before} → ${status}${note ? ` — ${note}` : ''}.`, { relatedId: id, before, after: status });
    toast(`${c.name}: ${status}.`);
    emit();
  },
  extendContractor(id: string, months: number, note?: string) {
    const c = state.contractors.find((x) => x.id === id);
    if (!c) throw new Error('Contractor not found.');
    const d = new Date(`${c.end}T00:00:00+05:30`);
    d.setMonth(d.getMonth() + months);
    const before = c.end;
    c.end = d.toISOString().slice(0, 10);
    if (c.status === 'Expiring Soon' || c.status === 'Expired') c.status = 'Active' as never;
    audit('Contractors', 'Extended', c.contractNo, `${c.name}: contract extended by ${months} months (${before} → ${c.end})${note ? ` — ${note}` : ''}.`, { relatedId: id, before, after: c.end });
    toast(`${c.name} contract extended to ${c.end}.`);
    emit();
  },
  updateContractorMeta(id: string, patch: Partial<Pick<Contractor, 'name' | 'workType' | 'contactPerson' | 'phone' | 'email' | 'end' | 'contractValueLakh' | 'complianceStatus' | 'rating'>>) {
    const c = state.contractors.find((x) => x.id === id);
    if (!c) throw new Error('Contractor not found.');
    if (patch.name && state.contractors.some((x) => x.id !== id && x.name.toLowerCase() === patch.name!.toLowerCase())) throw new Error(`Contractor "${patch.name}" already exists.`);
    const before = `${c.name} / ${c.end}`;
    Object.assign(c, patch);
    audit('Contractors', 'Updated', c.contractNo, `${c.contractNo} updated: ${before} → ${c.name} / ${c.end}.`, { relatedId: id, before, after: `${c.name} / ${c.end}` });
    toast(`${c.name} updated.`);
    emit();
  },
  createWorkOrder(input: { contractorId: string; mineId: string; title: string; valueLakh: number; start: string; end: string }) {
    const ctr = state.contractors.find((c) => c.id === input.contractorId);
    if (!ctr) throw new Error('Contractor not found.');
    if (!ctr.mineIds.includes(input.mineId)) throw new Error(`${ctr.name} is not empanelled at that mine.`);
    if (!(input.valueLakh > 0)) throw new Error('Work order value must be greater than 0.');
    if (new Date(input.end) <= new Date(input.start)) throw new Error('End date must be after start date.');
    const id = `WO-BCM-${String(state.seq.wo++).padStart(3, '0')}`;
    const wo: WorkOrder = { id, contractorId: input.contractorId, mineId: input.mineId, title: input.title, valueLakh: input.valueLakh, start: input.start, end: input.end, status: WorkOrderStatus.PendingApproval };
    state.workOrders.push(wo);
    audit('Contractors', 'Work Order Created', id, `Work order ${id} (${input.title}, ₹ ${input.valueLakh} L) raised for ${ctr.name} — pending approval.`, { relatedId: id, after: 'Pending Approval' });
    toast(`Work order ${id} created (pending approval).`);
    emit();
    return id;
  },
  setWorkOrderStatus(id: string, status: WorkOrderStatus, note?: string) {
    const wo = state.workOrders.find((x) => x.id === id);
    if (!wo) return;
    if (wo.status === status) throw new Error(`${id} is already ${status}.`);
    const before = wo.status;
    wo.status = status;
    audit('Contractors', `Work Order ${status}`, id, `Work order ${id} (${wo.title}): ${before} → ${status}${note ? ` — ${note}` : ''}.`, { relatedId: id, before, after: status });
    toast(`Work order ${id}: ${status}.`);
    emit();
  },

  // -- Production (record → KPIs, charts, stock in-flow) --
  createProduction(input: { date: string; mineId: string; stockpileId: string; quantityMt: number; grade: string; shift: string; source: string; remarks: string }) {
    if (!(input.quantityMt > 0)) throw new Error('Quantity must be greater than 0.');
    if (input.quantityMt > 20000) throw new Error('Quantity exceeds the 20,000 MT per-entry limit.');
    const sp = state.stockpiles.find((s) => s.id === input.stockpileId);
    if (!sp) throw new Error('Stockpile not found.');
    if (sp.mineId !== input.mineId) throw new Error('Stockpile does not belong to the selected mine.');
    if (stockCurrent(sp.id) + input.quantityMt > sp.capacityMt) throw new Error(`Capacity exceeded: ${sp.name} would go above ${sp.capacityMt} MT.`);
    const id = `PR-2026-${String(state.seq.prod++).padStart(3, '0')}`;
    state.production.unshift({ id, date: input.date, mineId: input.mineId, stockpileId: sp.id, quantityMt: input.quantityMt, grade: sp.grade, shift: input.shift as never, source: input.source, remarks: input.remarks, recordedBy: actor().name });
    state.stockTx.push({
      id: `STX-${String(state.seq.stx++).padStart(4, '0')}`, timestamp: `${input.date}T12:00:00`, date: input.date,
      type: StockTxType.Production, stockpileId: sp.id, toStockpileId: null, quantityMt: input.quantityMt,
      reference: id, counterparty: input.source, status: StockTxStatus.Added,
    });
    audit('Production', 'Recorded', id, `Production of ${input.quantityMt} MT recorded at ${sp.name} (${input.date}).`, { relatedId: id, after: `${input.quantityMt} MT` });
    toast(`Production ${input.quantityMt} MT recorded.`);
    emit();
    return id;
  },

  // -- Dispatch (workflow 3: dispatch table + chart + stock balance) --
  createDispatch(input: { date: string; mineId: string; stockpileId: string; destination: string; vehicleNo: string; driver: string; quantityMt: number; grossMt: number; tareMt: number; challanNo: string }) {
    const sp = state.stockpiles.find((s) => s.id === input.stockpileId);
    if (!sp) throw new Error('Stockpile not found.');
    if (sp.mineId !== input.mineId) throw new Error('Stockpile does not belong to the selected mine.');
    if (!(input.quantityMt > 0)) throw new Error('Quantity must be greater than 0.');
    if (Math.abs((input.grossMt - input.tareMt) - input.quantityMt) > 0.01) {
      throw new Error(`Weight mismatch: gross − tare = ${(input.grossMt - input.tareMt).toFixed(3)} MT ≠ net ${input.quantityMt} MT.`);
    }
    if (state.dispatches.some((d) => d.challanNo.toLowerCase() === input.challanNo.toLowerCase())) {
      throw new Error(`Challan ${input.challanNo} already exists.`);
    }
    const avail = stockCurrent(sp.id);
    if (input.quantityMt > avail) throw new Error(`Insufficient stock at ${sp.name}: available ${avail} MT.`);
    const n = state.seq.dsp++;
    const id = `DSP-2026-${String(n).padStart(3, '0')}`;
    state.dispatches.unshift({
      id, date: input.date, timestamp: `${input.date}T${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}:00`,
      mineId: input.mineId, stockpileId: sp.id, destination: input.destination as never, vehicleNo: input.vehicleNo,
      driver: input.driver, grade: sp.grade, quantityMt: input.quantityMt, grossMt: input.grossMt,
      tareMt: input.tareMt, challanNo: input.challanNo, status: 'Dispatched' as never,
    });
    state.stockTx.push({
      id: `STX-${String(state.seq.stx++).padStart(4, '0')}`, timestamp: `${input.date}T12:00:00`, date: input.date,
      type: StockTxType.Dispatch, stockpileId: sp.id, toStockpileId: null, quantityMt: input.quantityMt,
      reference: input.challanNo, counterparty: input.destination, status: StockTxStatus.Deducted,
    });
    audit('Dispatch', 'Recorded', id, `Dispatch ${id} (${input.quantityMt} MT → ${input.destination}, truck ${input.vehicleNo}) recorded; ${sp.name} reduced to ${stockCurrent(sp.id)} MT.`, { relatedId: id, after: `${input.quantityMt} MT` });
    toast(`Dispatch ${id} recorded.`);
    emit();
    return id;
  },
  updateDispatchStatus(id: string, status: DispatchRecord['status']) {
    const d = state.dispatches.find((x) => x.id === id);
    if (!d) return;
    const before = d.status;
    d.status = status;
    audit('Dispatch', 'Status Updated', id, `Dispatch ${id}: ${before} → ${status}.`, { relatedId: id, before, after: status });
    toast(`Dispatch ${id}: ${status}.`);
    emit();
  },

  // -- Stockpile operations --
  createStockpile(input: { mineId: string; code: string; name: string; area: string; capacityMt: number; openingMt: number; grade: string }) {
    if (state.stockpiles.some((s) => s.code.toLowerCase() === input.code.toLowerCase())) throw new Error(`Stockpile code ${input.code} already exists.`);
    if (!(input.capacityMt > 0)) throw new Error('Capacity must be greater than 0.');
    if (input.openingMt < 0 || input.openingMt > input.capacityMt) throw new Error('Opening stock must be between 0 and capacity.');
    const id = `STK-${String(state.stockpiles.length + 1).padStart(2, '0')}`;
    state.stockpiles.push({ id, code: input.code, name: input.name, mineId: input.mineId, grade: input.grade as never, area: input.area, capacityMt: input.capacityMt, openingMt: input.openingMt, mapX: 10, mapY: 10 });
    audit('Stockpile', 'Created', input.code, `Stockpile ${input.name} (${input.code}) created with ${input.openingMt} MT opening stock.`, { relatedId: id, after: `${input.openingMt} MT` });
    toast(`Stockpile ${input.code} created.`);
    emit();
    return id;
  },
  transferStock(input: { stockpileId: string; toStockpileId: string; quantityMt: number; reference: string }) {
    if (input.stockpileId === input.toStockpileId) throw new Error('Source and destination stockpiles must differ.');
    const src = state.stockpiles.find((s) => s.id === input.stockpileId);
    const dst = state.stockpiles.find((s) => s.id === input.toStockpileId);
    if (!src || !dst) throw new Error('Stockpile not found.');
    if (src.mineId !== dst.mineId) throw new Error('Transfers must stay within the same mine.');
    if (!(input.quantityMt > 0)) throw new Error('Quantity must be greater than 0.');
    const avail = stockCurrent(src.id);
    if (input.quantityMt > avail) throw new Error(`Insufficient stock at ${src.name}: available ${avail} MT.`);
    if (stockCurrent(dst.id) + input.quantityMt > dst.capacityMt) throw new Error(`Capacity exceeded at ${dst.name}.`);
    state.stockTx.push({
      id: `STX-${String(state.seq.stx++).padStart(4, '0')}`, timestamp: new Date().toISOString(), date: '2026-10-03',
      type: StockTxType.Transfer, stockpileId: src.id, toStockpileId: dst.id, quantityMt: input.quantityMt,
      reference: input.reference, counterparty: dst.name, status: StockTxStatus.Transferred,
    });
    audit('Stockpile', 'Transferred', src.code, `${input.quantityMt} MT transferred ${src.code} → ${dst.code} (ref ${input.reference}).`, { relatedId: src.id, after: `${dst.code}: ${stockCurrent(dst.id)} MT` });
    toast(`Stock transferred ${src.code} → ${dst.code}.`);
    emit();
  },
  reconcileStock(stockpileId: string, physicalMt: number, note: string) {
    const sp = state.stockpiles.find((s) => s.id === stockpileId);
    if (!sp) throw new Error('Stockpile not found.');
    const sys = stockCurrent(sp.id);
    const variance = Number((physicalMt - sys).toFixed(3));
    if (Math.abs(variance) > sys * 0.1 + 500) throw new Error(`Variance ${variance} MT exceeds the ±10% tolerance — raise a survey query instead.`);
    // Apply variance as an adjustment transaction so balances stay auditable.
    if (variance !== 0) {
      state.stockTx.push({
        id: `STX-${String(state.seq.stx++).padStart(4, '0')}`, timestamp: new Date().toISOString(), date: '2026-10-03',
        type: StockTxType.Reconciliation, stockpileId: sp.id, toStockpileId: null, quantityMt: Math.abs(variance),
        reference: `RC-NEW-${state.seq.stx}`, counterparty: note || 'Survey Team',
        status: variance > 0 ? StockTxStatus.Added : StockTxStatus.Deducted,
      });
    }
    audit('Stockpile', 'Reconciled', sp.code, `Reconciliation at ${sp.name}: system ${sys} MT vs physical ${physicalMt} MT (variance ${variance >= 0 ? '+' : ''}${variance} MT).`, { relatedId: sp.id, before: `${sys} MT`, after: `${physicalMt} MT` });
    toast(`Reconciliation saved (variance ${variance >= 0 ? '+' : ''}${variance} MT).`);
    emit();
  },

  // -- Bills (workflow 4: status + KPIs + payment/report summaries) --
  createBill(input: { contractorId: string; workOrderId: string | null; mineId: string; type: string; invoiceDate: string; periodFrom: string; periodTo: string; description: string; amount: number; tax: number; notes: string; supportingDocs: string[] }) {
    if (!(input.amount > 0)) throw new Error('Amount must be greater than 0.');
    if (input.tax < 0) throw new Error('Tax cannot be negative.');
    if (new Date(input.periodTo) < new Date(input.periodFrom)) throw new Error('Billing period end must be on/after start.');
    const ctr = state.contractors.find((c) => c.id === input.contractorId);
    if (!ctr) throw new Error('Contractor not found.');
    const dup = state.bills.find((b) => b.contractorId === input.contractorId && b.periodFrom === input.periodFrom && b.periodTo === input.periodTo && b.type === input.type);
    if (dup) throw new Error(`Duplicate bill: ${dup.id} already covers ${input.periodFrom} → ${input.periodTo} for this contractor/type.`);
    const id = `BILL-2026-${String(state.seq.bill++).padStart(3, '0')}`;
    state.bills.unshift({
      id, contractorId: input.contractorId, workOrderId: input.workOrderId, mineId: input.mineId,
      type: input.type as never, invoiceDate: input.invoiceDate, periodFrom: input.periodFrom,
      periodTo: input.periodTo, description: input.description, amount: input.amount, tax: input.tax,
      notes: input.notes, approvalStatus: BillApprovalStatus.Pending, paymentStatus: PaymentStatus.Unpaid,
      supportingDocs: input.supportingDocs,
    });
    audit('Bills', 'Created', id, `Bill ${id} created for ${ctr.name} (₹ ${input.amount.toLocaleString('en-IN')}).`, { relatedId: id, after: 'Pending' });
    toast(`Bill ${id} created.`);
    emit();
    return id;
  },
  approveBill(id: string, note?: string) {
    const b = state.bills.find((x) => x.id === id);
    if (!b) return;
    if (b.approvalStatus === BillApprovalStatus.Approved) throw new Error(`${id} is already approved.`);
    const before = b.approvalStatus;
    b.approvalStatus = BillApprovalStatus.Approved;
    const ctr = state.contractors.find((c) => c.id === b.contractorId);
    audit('Bills', 'Approved', id, `Bill ${id} (${ctr?.name ?? b.contractorId}, ₹ ${(b.amount + b.tax).toLocaleString('en-IN')}) approved${note ? ` — ${note}` : ''}.`, { relatedId: id, before, after: 'Approved' });
    toast(`Bill ${id} approved.`);
    emit();
  },
  rejectBill(id: string, reason: string) {
    const b = state.bills.find((x) => x.id === id);
    if (!b) return;
    if (!reason.trim()) throw new Error('A rejection reason is required.');
    const before = b.approvalStatus;
    b.approvalStatus = BillApprovalStatus.Rejected;
    b.notes = reason;
    audit('Bills', 'Rejected', id, `Bill ${id} rejected — ${reason}`, { relatedId: id, before, after: 'Rejected' });
    toast(`Bill ${id} rejected.`);
    emit();
  },
  requestBillCorrection(id: string, note: string) {
    const b = state.bills.find((x) => x.id === id);
    if (!b) return;
    if (!note.trim()) throw new Error('Describe the correction required.');
    const before = b.approvalStatus;
    b.approvalStatus = BillApprovalStatus.UnderReview;
    b.notes = note;
    audit('Bills', 'Correction Requested', id, `Correction requested on ${id}: ${note}`, { relatedId: id, before, after: 'Under Review' });
    toast(`Correction requested on ${id}.`);
    emit();
  },
  recordPayment(billId: string, amount: number, mode: string) {
    const b = state.bills.find((x) => x.id === billId);
    if (!b) throw new Error('Bill not found.');
    if (b.approvalStatus !== BillApprovalStatus.Approved) throw new Error('Record payment only after bill approval.');
    const total = b.amount + b.tax;
    const paid = billPaid(b);
    if (!(amount > 0)) throw new Error('Payment amount must be greater than 0.');
    if (paid + amount > total + 0.5) throw new Error(`Payment exceeds outstanding (₹ ${(total - paid).toLocaleString('en-IN')}).`);
    const id = `PAY-2026-${String(state.seq.pay++).padStart(3, '0')}`;
    state.payments.unshift({ id, billId, amount, date: '2026-10-03', mode: mode as never, reference: `NEFT-DEMO-${id.slice(-3)}` });
    const nowPaid = paid + amount;
    b.paymentStatus = nowPaid >= total - 0.5 ? PaymentStatus.Paid : PaymentStatus.PartiallyPaid;
    audit('Bills', 'Payment Recorded', billId, `Payment of ₹ ${amount.toLocaleString('en-IN')} recorded against ${billId} (${mode}; demo record only — no bank transfer occurred).`, { relatedId: billId, before: `${paid} paid`, after: `${nowPaid} paid` });
    toast(`Payment recorded (demo). ${billId}: ${b.paymentStatus}.`);
    emit();
    return id;
  },

  // -- Documents --
  createDocument(input: { name: string; category: string; mineId: string; relatedKind: OpsDocument['relatedKind']; relatedId: string; refNo: string; issueDate: string; expiryDate: string | null; description: string; file: OpsDocument['file'] }) {
    if (!input.name.trim()) throw new Error('Document title is required.');
    if (state.documents.some((d) => d.refNo.toLowerCase() === input.refNo.toLowerCase())) throw new Error(`Reference ${input.refNo} already exists.`);
    if (input.expiryDate && new Date(input.expiryDate) < new Date(input.issueDate)) throw new Error('Expiry date cannot be before issue date.');
    const id = `DOC-2026-${String(state.seq.doc++).padStart(3, '0')}`;
    state.documents.unshift({
      id, name: input.name, category: input.category as never, mineId: input.mineId,
      relatedKind: input.relatedKind, relatedId: input.relatedId, refNo: input.refNo,
      issueDate: input.issueDate, expiryDate: input.expiryDate, status: DocumentStatus.Draft,
      submittedBy: actor().name, description: input.description, file: input.file,
      history: [{ at: new Date().toISOString(), by: actor().name, action: DocumentAction.Uploaded, note: 'Draft uploaded (stored in browser demo state only).' }],
    });
    audit('Documents', 'Uploaded', id, `Document "${input.name}" (${input.refNo}) uploaded as draft.`, { relatedId: id, after: 'Draft' });
    toast(`Document "${input.name}" uploaded (demo).`);
    emit();
    return id;
  },
  submitDocument(id: string) {
    const d = state.documents.find((x) => x.id === id);
    if (!d) return;
    const before = d.status;
    d.status = DocumentStatus.Pending;
    d.history.unshift({ at: new Date().toISOString(), by: actor().name, action: DocumentAction.Submitted, note: 'Submitted for compliance review.' });
    audit('Documents', 'Submitted', id, `Document ${d.refNo} submitted for review.`, { relatedId: id, before, after: 'Pending' });
    toast(`${d.refNo} submitted for review.`);
    emit();
  },
  approveDocument(id: string) {
    const d = state.documents.find((x) => x.id === id);
    if (!d) return;
    const before = d.status;
    d.status = d.expiryDate && new Date(d.expiryDate) < new Date('2026-11-03') ? DocumentStatus.ExpiringSoon : DocumentStatus.Valid;
    d.history.unshift({ at: new Date().toISOString(), by: actor().name, action: DocumentAction.Approved, note: 'Verified and approved.' });
    audit('Documents', 'Approved', id, `Document ${d.refNo} approved (${before} → ${d.status}).`, { relatedId: id, before, after: d.status });
    toast(`${d.refNo} approved.`);
    emit();
  },
  rejectDocument(id: string, reason: string) {
    const d = state.documents.find((x) => x.id === id);
    if (!d) return;
    if (!reason.trim()) throw new Error('A rejection reason is required.');
    const before = d.status;
    d.status = DocumentStatus.Rejected;
    d.history.unshift({ at: new Date().toISOString(), by: actor().name, action: DocumentAction.Rejected, note: reason });
    audit('Documents', 'Rejected', id, `Document ${d.refNo} rejected — ${reason}`, { relatedId: id, before, after: 'Rejected' });
    toast(`${d.refNo} rejected.`);
    emit();
  },
  replaceDocumentFile(id: string, file: OpsDocument['file']) {
    const d = state.documents.find((x) => x.id === id);
    if (!d) return;
    d.file = file;
    d.history.unshift({ at: new Date().toISOString(), by: actor().name, action: DocumentAction.Replaced, note: `File replaced with ${file?.name ?? 'nothing'} (demo storage).` });
    audit('Documents', 'Replaced', id, `File replaced on ${d.refNo}.`, { relatedId: id });
    toast(`${d.refNo} file replaced (demo).`);
    emit();
  },
  updateDocument(id: string, patch: Partial<Pick<OpsDocument, 'name' | 'refNo' | 'issueDate' | 'expiryDate' | 'description' | 'category'>>) {
    const d = state.documents.find((x) => x.id === id);
    if (!d) return;
    if (patch.refNo && state.documents.some((x) => x.id !== id && x.refNo.toLowerCase() === patch.refNo!.toLowerCase())) throw new Error(`Reference ${patch.refNo} already exists.`);
    Object.assign(d, patch);
    d.history.unshift({ at: new Date().toISOString(), by: actor().name, action: DocumentAction.MetadataUpdated, note: 'Metadata updated.' });
    audit('Documents', 'Metadata Updated', id, `Metadata updated on ${d.refNo}.`, { relatedId: id });
    toast(`${d.refNo} updated.`);
    emit();
  },

  // -- Inspections --
  createInspection(input: { mineId: string; type: string; date: string; inspector: string; inspectorOrg: string; priority: string; remarks: string }) {
    if (!state.mines.some((m) => m.id === input.mineId)) throw new Error('Mine not found.');
    if (!input.inspector.trim()) throw new Error('Inspecting officer is required.');
    if (!input.date) throw new Error('Scheduled date is required.');
    const id = `INSP-2026-${state.seq.insp++}`;
    state.inspections.unshift({ id, mineId: input.mineId, type: input.type as never, date: input.date, inspector: input.inspector, inspectorOrg: input.inspectorOrg, status: InspectionStatusNew.Scheduled, priority: input.priority as never, remarks: input.remarks, reportFile: null });
    state.notifications.unshift({
      id: `NOT-${state.seq.not++}`, title: `Inspection scheduled — ${id}`,
      body: `${input.type} inspection at ${state.mines.find((m) => m.id === input.mineId)?.name} on ${input.date}.`,
      category: 'Inspection Notifications' as never, priority: 'Medium' as never, timestamp: new Date().toISOString(),
      mineId: input.mineId, status: NotificationStatusNew.Unread, relatedKind: 'Inspection', relatedId: id,
    });
    audit('Inspection', 'Scheduled', id, `Inspection ${id} (${input.type}) scheduled at ${input.mineId} for ${input.date} with ${input.inspector}.`, { relatedId: id, after: 'Scheduled' });
    toast(`Inspection ${id} scheduled.`);
    emit();
    return id;
  },
  updateInspection(id: string, patch: Partial<Inspection>) {
    const i = state.inspections.find((x) => x.id === id);
    if (!i) return;
    const before = i.date;
    Object.assign(i, patch);
    audit('Inspection', 'Updated', id, `Inspection ${id} updated${patch.date ? ` (date ${before} → ${patch.date})` : ''}.`, { relatedId: id, before, after: patch.date ?? i.date });
    toast(`Inspection ${id} updated.`);
    emit();
  },
  startInspection(id: string) {
    const i = state.inspections.find((x) => x.id === id);
    if (!i) return;
    if (i.status !== InspectionStatusNew.Scheduled) throw new Error(`Only scheduled inspections can be started (current: ${i.status}).`);
    i.status = InspectionStatusNew.InProgress;
    audit('Inspection', 'Started', id, `Inspection ${id} started at ${i.mineId}.`, { relatedId: id, before: 'Scheduled', after: 'In Progress' });
    toast(`Inspection ${id} started.`);
    emit();
  },
  completeInspection(id: string, reportFile: string) {
    const i = state.inspections.find((x) => x.id === id);
    if (!i) return;
    if (i.status === InspectionStatusNew.Completed) throw new Error('Inspection already completed.');
    if (!reportFile.trim()) throw new Error('An inspection report file reference is required to complete.');
    i.status = InspectionStatusNew.Completed;
    i.reportFile = reportFile;
    audit('Inspection', 'Completed', id, `Inspection ${id} completed; report "${reportFile}" uploaded.`, { relatedId: id, before: 'In Progress', after: 'Completed' });
    toast(`Inspection ${id} completed.`);
    emit();
  },
  addFinding(input: { inspectionId: string; mineId: string; category: string; severity: string; description: string; location: string }) {
    const insp = state.inspections.find((x) => x.id === input.inspectionId);
    if (!insp) throw new Error('Inspection not found.');
    if (!input.description.trim()) throw new Error('Finding description is required.');
    const id = `FND-2026-${String(state.seq.fnd++).padStart(3, '0')}`;
    state.findings.unshift({ id, inspectionId: input.inspectionId, mineId: input.mineId, category: input.category, severity: input.severity as never, status: FindingStatusNew.Open, description: input.description, location: input.location, detectedAt: '2026-10-03' });
    audit('Findings', 'Created', id, `Finding raised on ${input.inspectionId}: ${input.description.slice(0, 80)}`, { relatedId: id, after: input.severity });
    toast(`Finding ${id} raised.`);
    emit();
    return id;
  },
  assignCorrectiveAction(findingId: string, input: { action: string; owner: string; dueDate: string }) {
    const f = state.findings.find((x) => x.id === findingId);
    if (!f) throw new Error('Finding not found.');
    if (!input.action.trim() || !input.owner.trim()) throw new Error('Action and owner are required.');
    const id = `CA-2026-${String(state.seq.ca++).padStart(3, '0')}`;
    state.correctiveActions.unshift({ id, findingId, action: input.action, owner: input.owner, dueDate: input.dueDate, status: CorrectiveActionStatus.Open, resolutionNote: '' });
    if (f.status === FindingStatusNew.Open) f.status = FindingStatusNew.ActionAssigned;
    audit('Findings', 'Action Assigned', id, `Corrective action ${id} assigned to ${input.owner} for ${findingId}.`, { relatedId: findingId, after: 'Action Assigned' });
    toast(`Corrective action ${id} assigned.`);
    emit();
    return id;
  },
  updateCorrectiveAction(id: string, status: CorrectiveActionStatus, note: string) {
    const ca = state.correctiveActions.find((x) => x.id === id);
    if (!ca) return;
    if (status === CorrectiveActionStatus.Resolved && !note.trim()) throw new Error('A resolution note is required.');
    const before = ca.status;
    ca.status = status; ca.resolutionNote = note;
    const f = state.findings.find((x) => x.id === ca.findingId);
    if (f) {
      if (status === CorrectiveActionStatus.Resolved) f.status = FindingStatusNew.Resolved;
      else if (status === CorrectiveActionStatus.InProgress && f.status === FindingStatusNew.ActionAssigned) f.status = FindingStatusNew.ActionAssigned;
    }
    audit('Findings', 'Action Updated', id, `Corrective action ${id}: ${before} → ${status}.`, { relatedId: ca.findingId, before, after: status });
    toast(`Corrective action ${id}: ${status}.`);
    emit();
  },

  // -- Reports --
  generateReport(input: { name: string; type: string; mineId: string; from: string; to: string; rowCount: number; csv: string }) {
    if (!input.name.trim()) throw new Error('Report name is required.');
    if (new Date(input.to) < new Date(input.from)) throw new Error('End date must be on/after start date.');
    const id = `RPT-2026-${String(state.seq.rpt++).padStart(3, '0')}`;
    const a = actor();
    state.reports.unshift({ id, name: input.name, type: input.type as never, mineId: input.mineId, from: input.from, to: input.to, generatedAt: new Date().toISOString(), generatedBy: a.name, status: ReportStatus.Ready, rowCount: input.rowCount, csv: input.csv, scheduled: false });
    audit('Reports', 'Generated', id, `Report "${input.name}" generated (${input.rowCount} rows).`, { relatedId: id, after: 'Ready' });
    toast(`Report "${input.name}" generated.`);
    emit();
    return id;
  },
  deleteReport(id: string) {
    const i = state.reports.findIndex((r) => r.id === id);
    if (i < 0) return;
    const [r] = state.reports.splice(i, 1);
    audit('Reports', 'Deleted', id, `Report "${r.name}" deleted from demo records.`, { relatedId: id, before: r.status, after: 'Deleted' });
    toast(`Report "${r.name}" deleted.`);
    emit();
  },
  toggleReportSchedule(id: string) {
    const r = state.reports.find((x) => x.id === id);
    if (!r) return;
    r.scheduled = !r.scheduled;
    if (r.scheduled) r.status = ReportStatus.Scheduled;
    audit('Reports', r.scheduled ? 'Scheduled' : 'Unscheduled', id, `Report "${r.name}" ${r.scheduled ? 'marked for weekly auto-generation (demo — no background scheduler exists)' : 'removed from schedule'}.`, { relatedId: id });
    toast(r.scheduled ? 'Report scheduled (demo).' : 'Schedule removed.');
    emit();
  },

  // -- Notifications --
  markNotificationRead(id: string) {
    const n = state.notifications.find((x) => x.id === id);
    if (!n) return;
    n.status = NotificationStatusNew.Read;
    emit();
  },
  markAllNotificationsRead() {
    let c = 0;
    state.notifications.forEach((n) => { if (n.status === NotificationStatusNew.Unread) { n.status = NotificationStatusNew.Read; c++; } });
    if (c) audit('Notifications', 'Read', 'all', `${c} notifications marked read.`, {});
    toast(c ? `${c} notification(s) marked read.` : 'No unread notifications.');
    emit();
  },
  addNotification(input: { title: string; body: string; category: string; priority: string; mineId: string | null }) {
    const id = `NOT-${state.seq.not++}`;
    state.notifications.unshift({ id, ...input, category: input.category as never, priority: input.priority as never, timestamp: new Date().toISOString(), status: NotificationStatusNew.Unread, relatedKind: null, relatedId: null });
    emit();
    return id;
  },

  // -- Settings / profile / danger zone --
  updateProfile(patch: Partial<Pick<OperationsUser, 'name' | 'email' | 'phone' | 'department' | 'language'>>) {
    const before = `${state.user.name} / ${state.user.email}`;
    Object.assign(state.user, patch);
    audit('Settings', 'Profile Updated', state.user.id, `Profile updated: ${before} → ${state.user.name} / ${state.user.email}.`, { relatedId: state.user.id, before, after: `${state.user.name} / ${state.user.email}` });
    toast('Profile saved.');
    emit();
  },
  changeDemoPassword(current: string, next: string, confirm: string) {
    // Demo-only simulation: validates format, never stores or displays plaintext.
    if (current !== 'operate123') throw new Error('Current password does not match the demo account (operator@minenetr.in / operate123).');
    if (next.length < 8 || !/[A-Z]/.test(next) || !/[a-z]/.test(next) || !/[0-9]/.test(next) || !/[^A-Za-z0-9]/.test(next)) {
      throw new Error('New password does not meet the requirements.');
    }
    if (next !== confirm) throw new Error('New password and confirmation do not match.');
    audit('Settings', 'Password Changed (demo)', state.user.id, 'Demo password simulation completed — no credential was stored or transmitted.', { relatedId: state.user.id });
    toast('Demo password updated (simulation only).');
    emit();
  },
  updateNotificationPrefs(patch: Partial<OperationsSettings['notifications']>) {
    Object.assign(state.settings.notifications, patch);
    audit('Settings', 'Notifications Updated', state.user.id, `Notification preferences updated: ${Object.keys(patch).join(', ')}.`, { relatedId: state.user.id });
    toast('Notification preferences saved.');
    emit();
  },
  updateDisplayPrefs(patch: Partial<OperationsSettings['display']>) {
    Object.assign(state.settings.display, patch);
    if (patch.defaultMineId && patch.defaultMineId !== 'ALL' && !state.user.minePermissions.includes(patch.defaultMineId)) {
      throw new Error('Default mine must be within your access list.');
    }
    audit('Settings', 'Display Updated', state.user.id, `Display preferences updated: ${Object.keys(patch).join(', ')}.`, { relatedId: state.user.id });
    toast('Display preferences saved.');
    emit();
  },
  setItemsPerPage(n: number) {
    state.settings.display.itemsPerPage = n;
    emit();
  },
  revokeSession(id: string) {
    const s = state.user.sessions.find((x) => x.id === id);
    if (!s) return;
    if (s.current) throw new Error('The current session cannot be revoked — use Logout instead.');
    state.user.sessions = state.user.sessions.filter((x) => x.id !== id);
    audit('Settings', 'Session Revoked', id, `Session ${id} (${s.device}) revoked.`, { relatedId: id, before: s.device, after: 'Revoked' });
    toast('Session revoked.');
    emit();
  },
  resetDemo() {
    state = initial();
    emit();
  },
} as const;

// ---------- Lookups ----------
export function getMine(id: string) { return state.mines.find((m) => m.id === id); }
export function getContractor(id: string | null) { return id ? state.contractors.find((c) => c.id === id) : undefined; }
export function getWorker(id: string) { return state.workers.find((w) => w.id === id); }
/** Mines the signed-in demo user may select (permission scoped). */
export function allowedMines(): Mine[] { return state.mines.filter((m) => state.user.minePermissions.includes(m.id)); }
