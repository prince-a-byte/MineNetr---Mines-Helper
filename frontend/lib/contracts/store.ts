/**
 * MineNetr contractor "My Contracts" mock repository — the ONLY source of
 * truth for the page. All reads derive from this state; every mutation goes
 * through an action that:
 *   1. validates and enforces contractor permission boundaries,
 *   2. updates every affected record (KPIs, donut, milestones, activity),
 *   3. appends an append-only audit entry,
 *   4. emits a toast and notifies subscribers (useMockContracts()).
 *
 * Requests (new-contract / renewal) are stored in SEPARATE collections from
 * approved contracts. A submitted request never becomes an Active contract —
 * that mirrors the future backend where approval is a separate privileged step
 * the contractor cannot perform.
 *
 * Demo persistence: the seed loads deterministically; runtime mutations are
 * mirrored into localStorage so the demo survives reloads; a schema version
 * guards against stale data; resetDemo() restores the original dataset.
 */
'use client';
import { useSyncExternalStore } from 'react';
import { getUser } from '../api';
import {
  ContractStatus, MilestoneStatus, RequestStatus, Currency, DEMO_TODAY, DEMO_NOW_ISO,
  EXPIRY_WINDOW_DAYS,
  type ActivityEntry, type Contract, type ContractDocument, type ContractMilestone,
  type ContractNotification, type ContractRequest, type ContractFilters, type ContractorIdentity,
  type Mine, type NewContractRequestInput, type RenewalRequest, type RenewalRequestInput,
  type RequestAttachment,
} from './types';
import { seedSnapshot, mines as seedMines, contractor as seedContractor } from './seed';
import { daysUntil } from './format';

// ---------- State shape ----------
export interface ContractsDbState {
  mines: Mine[];
  contractor: ContractorIdentity;
  contracts: Contract[];
  milestones: ContractMilestone[];
  documents: ContractDocument[];
  activity: ActivityEntry[];
  requests: ContractRequest[];
  renewals: RenewalRequest[];
  notifications: ContractNotification[];
  audit: { id: string; timestamp: string; user: string; role: string; module: string; action: string; resource: string; details: string }[];
  selectedMineId: string; // 'ALL' | mine id — permission scoped
  toasts: { id: number; text: string }[];
  seq: Record<string, number>;
}

const STORAGE_KEY = 'minenetr_contractor_contracts_v1';
const SCHEMA_VERSION = 1;

function initial(): ContractsDbState {
  const snap = seedSnapshot();
  return {
    mines: structuredClone(seedMines),
    contractor: structuredClone(seedContractor),
    contracts: snap.contracts,
    milestones: snap.milestones,
    documents: snap.documents,
    activity: snap.activity,
    requests: snap.requests,
    renewals: snap.renewals,
    notifications: snap.notifications,
    audit: [
      { id: 'AUD-0003', timestamp: '2026-09-30T10:41:00+05:30', user: 'Rakesh Kumar', role: 'Contractor', module: 'Renewal', action: 'Requested', resource: 'RR-2026-0001', details: 'Renewal requested for Equipment Maintenance contract.' },
      { id: 'AUD-0002', timestamp: '2026-09-27T14:16:00+05:30', user: 'Rakesh Kumar', role: 'Contractor', module: 'Contract Request', action: 'Submitted', resource: 'CR-2026-0001', details: 'New contract request submitted for North Block Mine.' },
      { id: 'AUD-0001', timestamp: '2026-10-03T09:00:00+05:30', user: 'Rakesh Kumar', role: 'Contractor', module: 'Portal', action: 'Session Start', resource: 'session', details: 'Contractor session started for Eastern Mining Services Pvt. Ltd.' },
    ],
    selectedMineId: 'ALL',
    toasts: [],
    seq: { cr: 2, rr: 2, act: 7, doc: 9, ms: 12, not: 5, aud: 4, ct: 7 },
  };
}

let state: ContractsDbState = load() ?? initial();
let toastSeq = 1;
const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }
function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
function snapshot() { return state; }

export function useMockContracts(): ContractsDbState {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
export function getContractsDb(): ContractsDbState { return state; }

// ---------- Persistence ----------
function persist() {
  if (typeof window === 'undefined') return;
  try {
    const { toasts, ...rest } = state;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: SCHEMA_VERSION, ...rest }));
  } catch { /* storage full/blocked — demo still works in-memory */ }
}

function load(): ContractsDbState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.v !== SCHEMA_VERSION) return null; // schema changed → reseed
    return { ...initial(), ...parsed, toasts: [] };
  } catch { return null; }
}

// ---------- Actor / audit / toast ----------
function actor(): { name: string; role: string } {
  try {
    const u = getUser();
    if (u?.name) return { name: u.name, role: u.title || u.role || 'Contractor' };
  } catch { /* demo fallback */ }
  return { name: state.contractor.user, role: state.contractor.role };
}

function audit(module: string, action: string, resource: string, details: string) {
  const a = actor();
  state.audit.unshift({
    id: `AUD-${String(state.seq.aud++).padStart(4, '0')}`, timestamp: new Date().toISOString(),
    user: a.name, role: a.role, module, action, resource, details,
  });
}

function logActivity(contractId: string | null, kind: string, description: string) {
  const a = actor();
  state.activity.unshift({
    id: `ACT-${String(state.seq.act++).padStart(3, '0')}`, contractId, kind, description,
    timestamp: new Date().toISOString(), user: a.name,
  });
}

function notify(title: string, description: string, priority: ContractNotification['priority'], relatedId: string | null) {
  state.notifications.unshift({
    id: `NT-${String(state.seq.not++).padStart(3, '0')}`, title, description,
    timestamp: new Date().toISOString(), read: false, priority, relatedId,
  });
}

export function toast(text: string) {
  state.toasts = [...state.toasts.slice(-2), { id: toastSeq++, text }];
  emit();
  const t = typeof window !== 'undefined' ? window.setTimeout.bind(window) : setTimeout;
  t(() => { state.toasts = state.toasts.slice(1); emit(); }, 4200);
}

// ---------- Derived helpers (pages must use these, never local counters) ----------

/** True when a contract is expiring: explicit status OR Active + within window. */
export function isExpiringSoon(c: Contract): boolean {
  if (c.status === ContractStatus.ExpiringSoon) return true;
  if (c.status === ContractStatus.Active) {
    const d = daysUntil(c.endDate);
    return d !== null && d >= 0 && d <= EXPIRY_WINDOW_DAYS;
  }
  return false;
}

/** The tab a contract belongs to for the "Expiring Soon" filter. */
export function inStatusTab(c: Contract, tab: string): boolean {
  switch (tab) {
    case 'All Contracts': return true;
    case ContractStatus.Active: return c.status === ContractStatus.Active;
    case ContractStatus.Upcoming: return c.status === ContractStatus.Upcoming;
    case 'Expiring Soon': return isExpiringSoon(c);
    case ContractStatus.Completed: return c.status === ContractStatus.Completed;
    case ContractStatus.Terminated: return c.status === ContractStatus.Terminated;
    default: return true;
  }
}

export function mineOf(id: string): Mine | undefined { return state.mines.find((m) => m.id === id); }
export function mineLabel(id: string): string {
  const m = mineOf(id);
  return m ? `${m.name} (${m.code})` : id;
}

/** The mines the authenticated contractor may see (permission-scoped). */
export function allowedMines(): Mine[] {
  return state.mines.filter((m) => state.contractor.assignedMineIds.includes(m.id));
}

/** Apply search + status tab + mine + structured filters in one place. */
export function filterContracts(rows: Contract[], f: ContractFilters, q: string): Contract[] {
  const needle = q.trim().toLowerCase();
  return rows.filter((c) => {
    if (!inStatusTab(c, f.status)) return false;
    if (f.mineId !== 'ALL' && c.mineId !== f.mineId) return false;
    if (f.workType !== 'All Work Types' && c.category !== f.workType) return false;
    if (f.startFrom && c.startDate < f.startFrom) return false;
    if (f.startTo && c.startDate > f.startTo) return false;
    if (f.endFrom && c.endDate < f.endFrom) return false;
    if (f.endTo && c.endDate > f.endTo) return false;
    const min = Number(f.minValue); const max = Number(f.maxValue);
    if (f.minValue && Number.isFinite(min) && c.contractValue < min) return false;
    if (f.maxValue && Number.isFinite(max) && c.contractValue > max) return false;
    if (needle) {
      const hay = `${c.name} ${c.id} ${c.workType} ${c.category} ${mineLabel(c.mineId)} ${c.workOrderNumber}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
}

/** Milestones that are upcoming (pending/in-progress, not yet completed). */
export function upcomingMilestones(mineId: string): ContractMilestone[] {
  const scope = new Set(
    state.contracts.filter((c) => mineId === 'ALL' || c.mineId === mineId).map((c) => c.id),
  );
  return state.milestones
    .filter((m) => scope.has(m.contractId) && (m.status === MilestoneStatus.Pending || m.status === MilestoneStatus.InProgress))
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));
}

// ---------- Actions ----------

export const actions = {
  /** Permission-scoped mine selection — persists across navigation + reload. */
  setSelectedMine(id: string) {
    const valid = id === 'ALL' || state.contractor.assignedMineIds.includes(id);
    if (!valid) { toast('You are not authorised for that mine.'); return; }
    state.selectedMineId = id;
    persist(); emit();
  },

  /**
   * Submit a new contract request. Stored in `requests` (NOT contracts) with
   * Pending Review status — the contractor cannot approve their own request.
   */
  createContractRequest(input: NewContractRequestInput): string {
    // Permission: the requested mine must be one the contractor is assigned to.
    if (!state.contractor.assignedMineIds.includes(input.mineId)) {
      throw new Error('You are not authorised to request a contract for that mine.');
    }
    const id = `CR-2026-${String(state.seq.cr++).padStart(4, '0')}`;
    const a = actor();
    const req: ContractRequest = {
      id, contractorId: state.contractor.id, mineId: input.mineId,
      workType: input.workType, proposedTitle: input.proposedTitle,
      scopeOfWork: input.scopeOfWork, proposedStartDate: input.proposedStartDate,
      proposedEndDate: input.proposedEndDate, estimatedValue: input.estimatedValue,
      currency: Currency.INR, notes: input.notes, attachments: input.attachments,
      status: RequestStatus.PendingReview, createdAt: new Date().toISOString(), createdBy: a.name,
    };
    state.requests.unshift(req);
    logActivity(null, 'Request Submitted', `New contract request ${id} submitted for ${mineLabel(input.mineId)}.`);
    notify('Contract request submitted', `${id} (${input.proposedTitle}) is pending review.`, 'Medium', id);
    audit('Contract Request', 'Submitted', id, `New contract request submitted for ${mineLabel(input.mineId)} — estimated ${input.estimatedValue}.`);
    persist(); toast(`Request ${id} submitted for review.`);
    return id;
  },

  /**
   * Request a renewal. Stored in `renewals` linked to the contract; the
   * original contract's end date and value are NOT modified (approval-only).
   */
  requestRenewal(contractId: string, input: RenewalRequestInput): string {
    const c = state.contracts.find((x) => x.id === contractId);
    if (!c) throw new Error('Contract not found.');
    if (!c.renewalEligible) throw new Error('This contract is not eligible for renewal.');
    // Contract-level permission check.
    if (c.contractorId !== state.contractor.id) throw new Error('You can only renew your own contracts.');
    const id = `RR-2026-${String(state.seq.rr++).padStart(4, '0')}`;
    const a = actor();
    const rr: RenewalRequest = {
      id, contractId, contractorId: state.contractor.id, mineId: c.mineId,
      currentEndDate: c.endDate, proposedEndDate: input.proposedEndDate,
      proposedValue: input.proposedValue, currency: Currency.INR, reason: input.reason,
      attachments: input.attachments, status: RequestStatus.PendingReview,
      createdAt: new Date().toISOString(), createdBy: a.name,
    };
    state.renewals.unshift(rr);
    logActivity(contractId, 'Renewal Requested', `Renewal ${id} requested for ${c.name}; original end date ${c.endDate} unchanged.`);
    notify('Renewal request submitted', `${id} for ${c.name} is pending review.`, 'Medium', id);
    audit('Renewal', 'Requested', id, `Renewal requested for ${contractId}; contract end date unchanged pending approval.`);
    persist(); toast(`Renewal ${id} submitted. Original dates unchanged.`);
    return id;
  },

  /**
   * Contractor milestone action. Supports: submit (mark submitted), upload a
   * supporting document, and request clarification. The contractor can NOT mark
   * a milestone Approved — that stays a mine-operator action.
   */
  updateMilestone(id: string, patch: { submit?: boolean; documentRef?: string; clarify?: boolean }): void {
    const m = state.milestones.find((x) => x.id === id);
    if (!m) throw new Error('Milestone not found.');
    const c = state.contracts.find((x) => x.id === m.contractId);
    if (c && c.contractorId !== state.contractor.id) throw new Error('You can only update your own milestones.');

    if (patch.submit) {
      m.status = MilestoneStatus.Completed;
      m.submittedAt = new Date().toISOString();
      if (patch.documentRef) m.documentRef = patch.documentRef;
      logActivity(m.contractId, 'Milestone Updated', `Milestone "${m.title}" marked as submitted.`);
      audit('Milestone', 'Submitted', id, `Milestone "${m.title}" marked submitted by contractor (awaiting operator approval).`);
      toast(`"${m.title}" marked as submitted.`);
    } else if (patch.documentRef) {
      m.documentRef = patch.documentRef;
      if (m.status === MilestoneStatus.Pending) m.status = MilestoneStatus.InProgress;
      logActivity(m.contractId, 'Document Uploaded', `Supporting document "${patch.documentRef}" uploaded for "${m.title}".`);
      audit('Milestone', 'Document Uploaded', id, `Supporting document uploaded for milestone "${m.title}".`);
      toast(`Document attached to "${m.title}".`);
    } else if (patch.clarify) {
      m.clarificationRequested = true;
      logActivity(m.contractId, 'Clarification Requested', `Clarification requested for milestone "${m.title}".`);
      notify('Clarification requested', `Your clarification request for "${m.title}" was sent to the mine office.`, 'Low', id);
      audit('Milestone', 'Clarification Requested', id, `Contractor requested clarification for milestone "${m.title}".`);
      toast(`Clarification requested for "${m.title}".`);
    }
    if (c) c.updatedAt = new Date().toISOString();
    persist(); emit();
  },

  /** Upload a supporting document against a contract (mock local reference). */
  uploadDocument(contractId: string, file: { name: string; sizeKb: number }, category: string): string {
    const c = state.contracts.find((x) => x.id === contractId);
    if (!c) throw new Error('Contract not found.');
    if (c.contractorId !== state.contractor.id) throw new Error('You can only upload to your own contracts.');
    const id = `DOC-${String(state.seq.doc++).padStart(3, '0')}`;
    const a = actor();
    const doc: ContractDocument = {
      id, contractId, name: file.name, category, sizeKb: Math.max(1, Math.round(file.sizeKb)),
      uploadedAt: new Date().toISOString(), uploadedBy: a.name, mockRef: `mock://docs/${id}`,
    };
    state.documents.unshift(doc);
    logActivity(contractId, 'Document Uploaded', `Document "${file.name}" uploaded to ${c.name}.`);
    audit('Document', 'Uploaded', id, `Document "${file.name}" uploaded against ${contractId} (simulated local reference).`);
    persist(); toast(`"${file.name}" uploaded (simulated).`);
    return id;
  },

  markNotificationsRead() {
    let changed = false;
    for (const n of state.notifications) if (!n.read) { n.read = true; changed = true; }
    if (changed) { persist(); emit(); }
  },

  /** Restore the original deterministic dataset and clear demo persistence. */
  resetDemo() {
    if (typeof window !== 'undefined') { try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ } }
    state = initial();
    persist(); toast('Demo data reset to the original dataset.');
  },
};
