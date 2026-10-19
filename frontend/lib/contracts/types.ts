/**
 * MineNetr Contractor "My Contracts" — domain model.
 * All demonstration data is fictional. Statuses are stored explicitly on each
 * record (matching the design reference seed data); derived helpers in store.ts
 * layer date-window logic (e.g. Expiring Soon) on top of the explicit status so
 * the two never contradict each other.
 */

// ---------- Enums ----------
export enum ContractStatus {
  Active = 'Active',
  Upcoming = 'Upcoming',
  ExpiringSoon = 'Expiring Soon',
  Completed = 'Completed',
  Terminated = 'Terminated',
}

export enum MilestoneStatus {
  Pending = 'Pending',
  InProgress = 'In Progress',
  Completed = 'Completed',
  Overdue = 'Overdue',
}

export enum RequestStatus {
  PendingReview = 'Pending Review',
  UnderReview = 'Under Review',
  Approved = 'Approved',
  Rejected = 'Rejected',
}

export enum Currency { INR = 'INR' }

// ---------- Mines / contractor identity ----------
export interface Mine {
  id: string;
  code: string;
  name: string;
  state: string;
  district: string;
}

export interface ContractorIdentity {
  id: string; // DEMO-CONT-001
  name: string; // Eastern Mining Services Pvt. Ltd.
  user: string; // Rakesh Kumar
  role: string; // Contractor
  assignedMineIds: string[];
}

// ---------- Core contract ----------
export interface Contract {
  id: string; // CT-BCM-001 (stable)
  contractorId: string;
  mineId: string;
  name: string; // Overburden Removal
  workType: string; // specific work type shown on the card
  category: string; // grouping used by the Contract Value Overview donut
  description: string;
  scope: string;

  startDate: string; // yyyy-mm-dd
  endDate: string; // yyyy-mm-dd

  contractValue: number; // INR (rupees)
  currency: Currency.INR;

  progress: number; // 0-100 (stored, never derived at render time)
  status: ContractStatus;

  workOrderNumber: string;
  renewalEligible: boolean;
  complianceStatus: 'Compliant' | 'Partially Compliant' | 'Non-Compliant';

  createdAt: string;
  updatedAt: string;
}

export interface ContractMilestone {
  id: string;
  contractId: string;
  title: string;
  description: string;
  dueDate: string; // yyyy-mm-dd
  status: MilestoneStatus;
  submittedAt?: string; // set when contractor marks submitted
  documentRef?: string; // supporting doc name (mock)
  clarificationRequested?: boolean;
}

export interface ContractDocument {
  id: string;
  contractId: string;
  name: string;
  category: string;
  sizeKb: number;
  uploadedAt: string;
  uploadedBy: string;
  mockRef: string; // local mock reference — never a real server upload
}

export interface ActivityEntry {
  id: string;
  contractId: string | null; // null = portal-level activity
  kind: string; // 'Request Submitted' | 'Contract Created' | ...
  description: string;
  timestamp: string;
  user: string;
}

// ---------- Requests (kept SEPARATE from approved contracts) ----------
export interface NewContractRequestInput {
  mineId: string;
  workType: string;
  proposedTitle: string;
  scopeOfWork: string;
  proposedStartDate: string;
  proposedEndDate: string;
  estimatedValue: number; // INR
  currency: Currency.INR;
  notes: string;
  attachments: RequestAttachment[];
}

export interface RequestAttachment {
  name: string;
  sizeKb: number;
  category: string;
  mockRef: string;
}

export interface ContractRequest {
  id: string; // CR-2026-0001 (stable)
  contractorId: string;
  mineId: string;
  workType: string;
  proposedTitle: string;
  scopeOfWork: string;
  proposedStartDate: string;
  proposedEndDate: string;
  estimatedValue: number;
  currency: Currency.INR;
  notes: string;
  attachments: RequestAttachment[];
  status: RequestStatus;
  createdAt: string;
  createdBy: string;
}

export interface RenewalRequestInput {
  proposedEndDate: string;
  proposedValue: number;
  reason: string;
  attachments: RequestAttachment[];
}

export interface RenewalRequest {
  id: string; // RR-2026-0001 (stable)
  contractId: string;
  contractorId: string;
  mineId: string;
  currentEndDate: string;
  proposedEndDate: string;
  proposedValue: number;
  currency: Currency.INR;
  reason: string;
  attachments: RequestAttachment[];
  status: RequestStatus;
  createdAt: string;
  createdBy: string;
}

// ---------- Notifications / audit ----------
export interface ContractNotification {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  priority: 'Low' | 'Medium' | 'High';
  relatedId: string | null;
}

export interface ContractAuditEntry {
  id: string;
  timestamp: string;
  user: string;
  role: string;
  module: string;
  action: string;
  resource: string;
  details: string;
}

// ---------- Filters ----------
export interface ContractFilters {
  mineId: string; // 'ALL' | mine id
  status: string; // tab / 'All Contracts'
  workType: string; // 'All Work Types' | category
  startFrom: string; // '' | yyyy-mm-dd
  startTo: string;
  endFrom: string;
  endTo: string;
  minValue: string; // '' | rupees
  maxValue: string;
}

// ---------- Demo clock (fixed — never implies live data) ----------
export const DEMO_TODAY = '2026-10-03';
export const DEMO_NOW_ISO = '2026-10-03T11:20:00+05:30';

/** Contracts whose end date falls within this window are flagged Expiring Soon. */
export const EXPIRY_WINDOW_DAYS = 60;
