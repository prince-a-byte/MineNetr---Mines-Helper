/**
 * MineNetr contractor portal — workforce, attendance, access, billing,
 * documents, compliance and notifications domain model.
 *
 * All demonstration data is fictional and generated deterministically from a
 * fixed demo clock (03 Oct 2026). Nothing here implies live personnel data.
 *
 * Coherence rules enforced by lib/workforce/seed.ts + store.ts:
 *  - every worker belongs to an existing contractor and an assigned mine,
 *  - training/attendance/access/leave records always reference a worker,
 *  - certification status is DERIVED from completion/expiry dates (an expired
 *    certificate can never present as Valid),
 *  - KPIs, tables and charts all read the same collections — no local counters.
 */
import type { Mine, ContractorIdentity } from '../contracts/types';

export type { Mine, ContractorIdentity };

// Demo clock + expiry window are owned by the contracts module so both
// contractor features agree on "today".
export { DEMO_TODAY, DEMO_NOW_ISO, EXPIRY_WINDOW_DAYS } from '../contracts/types';

// ---------- Enums ----------
export enum WorkerStatus {
  Active = 'Active',
  Inactive = 'Inactive',
  Blocked = 'Blocked',
}

export enum AttendanceStatus {
  Present = 'Present',
  Absent = 'Absent',
  OnLeave = 'On Leave',
  NotMarked = 'Not Marked',
}

export enum TrainingStatus {
  Valid = 'Valid',
  ExpiringSoon = 'Expiring Soon',
  Expired = 'Expired',
  PendingVerification = 'Pending Verification',
}

export enum AccessStatus {
  Allowed = 'Allowed',
  Denied = 'Denied',
  Blocked = 'Blocked',
  Revoked = 'Revoked',
}

export enum BillStatus {
  Pending = 'Pending',
  Approved = 'Approved',
  Rejected = 'Rejected',
}

export enum DocumentStatus {
  Valid = 'Valid',
  ExpiringSoon = 'Expiring Soon',
  Expired = 'Expired',
}

export enum TransferStatus {
  Pending = 'Pending',
  Approved = 'Approved',
  Rejected = 'Rejected',
  Cancelled = 'Cancelled',
}

export enum IncidentStatus {
  Open = 'Open',
  UnderReview = 'Under Review',
  ActionRequired = 'Action Required',
  Resolved = 'Resolved',
  Dismissed = 'Dismissed',
}

export enum Severity {
  Low = 'Low',
  Medium = 'Medium',
  High = 'High',
  Critical = 'Critical',
}

export enum ContractorStatus {
  Active = 'Active',
  Suspended = 'Suspended',
  Completed = 'Completed',
  Pending = 'Pending',
}

export enum CorrectiveStatus {
  NotStarted = 'Not Started',
  InProgress = 'In Progress',
  Submitted = 'Submitted',
  Approved = 'Approved',
  Rejected = 'Rejected',
}

// ---------- Controlled vocabularies (used by forms + filters) ----------
export const TRAINING_TYPES = [
  'Mine Safety Induction',
  'First Aid',
  'Emergency Response',
  'Equipment Operation',
  'Electrical Safety',
  'Working at Heights',
  'Explosive Handling',
] as const;
export type TrainingType = (typeof TRAINING_TYPES)[number];

export const DEPARTMENTS = [
  'Mining',
  'Haulage & Transport',
  'Maintenance',
  'Workshop',
  'Electrical',
  'Blasting & Drilling',
  'Safety',
  'Security',
  'Housekeeping & Utility',
  'Survey & Planning',
  'Stores & Logistics',
  'Environmental & Reclamation',
] as const;

export const DESIGNATIONS = [
  'Excavator Operator',
  'Dump Truck Operator',
  'Shovel Operator',
  'Dozer Operator',
  'Loader Operator',
  'HEMM Operator',
  'Maintenance Fitter',
  'Welder',
  'Electrician',
  'Blasting Assistant',
  'Surveyor',
  'Safety Officer',
  'Security Guard',
  'Housekeeping Staff',
  'Store Keeper',
  'Lab Technician',
  'Drainage Pump Operator',
  'Belt Conveyor Operator',
  'Grill Cutter',
  'Site Supervisor',
] as const;

export const SHIFTS = ['A', 'B', 'C'] as const;
export type Shift = (typeof SHIFTS)[number];

export const DOCUMENT_CATEGORIES = [
  'Contract Documents',
  'Worker Documents',
  'Equipment Documents',
  'Statutory Compliance',
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const INCIDENT_CATEGORIES = [
  'Expired Training',
  'Missing Documents',
  'Unauthorized Access',
  'Attendance Violation',
  'Contractor Compliance',
  'Deployment Violation',
] as const;

export const NOTIFICATION_CATEGORIES = [
  'Approvals',
  'Worker Related',
  'Bills & Payments',
  'Compliance',
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export type NotificationType = 'Action Required' | 'Information' | 'Completed';

export type DemoRole =
  | 'Project Manager'
  | 'Site Supervisor'
  | 'Mine Admin'
  | 'Inspector'
  | 'Read-Only Viewer';

export const DEMO_ROLES: DemoRole[] = [
  'Project Manager',
  'Site Supervisor',
  'Mine Admin',
  'Inspector',
  'Read-Only Viewer',
];

// ---------- Entities ----------
export interface Contractor {
  id: string; // DEMO-CONT-001 (self) | CONT-0002…
  name: string;
  contractNumber: string;
  registrationNumber: string;
  contactPerson: string;
  phone: string;
  email: string;
  mineId: string;
  contractStart: string; // yyyy-mm-dd
  contractEnd: string;
  contractValue: number; // INR
  status: ContractorStatus;
  requiredDocuments: string[];
  isSelf: boolean;
  scope: string;
}

export interface Worker {
  id: string; // WORK-0001
  name: string;
  contractorId: string;
  designation: string;
  department: string;
  mineId: string;
  contact: string;
  joiningDate: string;
  emergencyContact: string;
  gender: 'Male' | 'Female';
  status: WorkerStatus;
  shift: Shift;
  workZone: string;
  supervisor: string;
}

export interface TrainingRecord {
  id: string; // CERT-0001
  workerId: string;
  type: TrainingType | string;
  certificationNumber: string;
  completionDate: string;
  expiryDate: string;
  provider: string;
  mandatory: boolean;
  verified: boolean;
}

export interface AttendanceRecord {
  id: string; // ATT-0001
  workerId: string;
  date: string; // yyyy-mm-dd (demo today)
  status: AttendanceStatus;
  inTime: string; // 'HH:MM' | '—'
  outTime: string;
  gate: string;
  method: 'Biometric' | 'Manual';
}

export interface LeaveRecord {
  id: string; // LV-0001
  workerId: string;
  from: string;
  to: string;
  type: 'Casual Leave' | 'Sick Leave' | 'Earned Leave' | 'Compensatory Off';
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Completed' | 'Cancelled';
  appliedOn: string;
}

export interface GatePass {
  id: string; // GP-0001
  workerId: string;
  vehicle: string;
  purpose: string;
  issuedOn: string;
  validTill: string;
  status: 'Issued' | 'Used' | 'Expired' | 'Revoked';
}

export interface AccessRecord {
  id: string; // ACCESS-0001
  workerId: string;
  contractorId: string;
  mineId: string;
  gate: string;
  status: AccessStatus;
  timestamp: string; // ISO
  reason: string;
  direction: 'Entry' | 'Exit';
}

export interface Bill {
  id: string; // BILL-2026-001
  contractId: string;
  mineId: string;
  invoiceNumber: string;
  workPeriod: string;
  billDate: string;
  amount: number; // INR
  status: BillStatus;
  submittedBy: string;
  description: string;
  decidedOn?: string;
  decisionNote?: string;
  acknowledged?: boolean;
}

export interface Payment {
  id: string; // PAY-2026-001
  billId: string;
  amount: number;
  date: string;
  mode: 'NEFT' | 'RTGS' | 'Cheque';
  reference: string;
}

export interface PortalDocument {
  id: string; // DOCX-0001
  name: string;
  category: DocumentCategory;
  relatedType: 'contractor' | 'worker' | 'equipment' | 'statutory';
  relatedId: string; // contractor id / worker id / equipment code
  mineId: string;
  issueDate: string;
  expiryDate: string;
  sizeKb: number;
  uploadedBy: string;
  mockRef: string;
}

export interface TransferRequest {
  id: string; // REQ-0001
  workerId: string;
  fromContractorId: string;
  fromMineId: string;
  toMineId: string;
  toDepartment: string;
  requestDate: string;
  supervisor: string;
  reason: string;
  status: TransferStatus;
  decidedOn?: string;
  decidedBy?: string;
}

export interface CorrectiveAction {
  id: string; // CA-0001
  incidentId: string;
  description: string;
  assignedTo: string;
  dueDate: string;
  status: CorrectiveStatus;
  updates: { at: string; by: string; note: string }[];
  evidenceRef?: string;
  reviewerNote?: string;
}

export interface Incident {
  id: string; // INC-0001
  workerId: string | null;
  contractorId: string;
  mineId: string;
  category: string;
  severity: Severity;
  dateDetected: string;
  description: string;
  inspector: string;
  status: IncidentStatus;
  evidence: string[];
  timeline: { at: string; by: string; note: string }[];
  resolution?: string;
}

export interface PortalNotification {
  id: string; // WN-001
  title: string;
  description: string;
  type: NotificationType;
  category: NotificationCategory;
  timestamp: string;
  read: boolean;
  relatedId: string | null;
  href: string; // deep link (path + ?tab=)
}

export interface ReportRow {
  id: string; // RPT-001
  title: string;
  category: string;
  period: string;
  generatedOn: string;
  format: 'CSV' | 'PDF';
  sizeKb: number;
  status: 'Ready' | 'Generating' | 'Archived';
  href?: string;
}

export interface ActivityEntry {
  id: string; // WACT-001
  kind: string;
  description: string;
  timestamp: string;
  user: string;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  user: string;
  role: string;
  module: string;
  action: string;
  resource: string;
  details: string;
}

// ---------- Inputs (forms) ----------
export interface CreateWorkerInput {
  name: string;
  workerId: string;
  contractorId: string;
  designation: string;
  department: string;
  mineId: string;
  contact: string;
  joiningDate: string;
  emergencyContact: string;
  gender: 'Male' | 'Female';
  shift: Shift;
  workZone: string;
  initialTraining: 'Mine Safety Induction' | 'First Aid' | 'Emergency Response' | 'None';
}

export interface UpdateWorkerInput {
  name?: string;
  designation?: string;
  department?: string;
  mineId?: string;
  contact?: string;
  emergencyContact?: string;
  shift?: Shift;
  workZone?: string;
  status?: WorkerStatus;
}

export interface CreateContractorInput {
  name: string;
  contractorId: string;
  registrationNumber: string;
  contactPerson: string;
  phone: string;
  email: string;
  mineId: string;
  contractNumber: string;
  contractStart: string;
  contractEnd: string;
  contractValue: number;
  requiredDocuments: string[];
  scope: string;
}

export interface CreateTrainingInput {
  workerId: string;
  type: string;
  certificationNumber: string;
  completionDate: string;
  expiryDate: string;
  provider: string;
  mandatory: boolean;
  verified: boolean;
}

export interface CreateIncidentInput {
  workerId: string | null;
  contractorId: string;
  mineId: string;
  category: string;
  severity: Severity;
  description: string;
  inspector: string;
}

// ---------- Permissions ----------
export type Permission =
  | 'export'
  | 'worker.create'
  | 'worker.update'
  | 'worker.deactivate'
  | 'worker.deploy'
  | 'worker.transfer.request'
  | 'worker.transfer.decide'
  | 'contractor.update'
  | 'contractor.suspend'
  | 'training.create'
  | 'training.update'
  | 'training.verify'
  | 'attendance.mark'
  | 'access.decide'
  | 'bill.submit'
  | 'bill.withdraw'
  | 'bill.acknowledge'
  | 'document.upload'
  | 'incident.create'
  | 'incident.comment'
  | 'incident.action'
  | 'incident.decide'
  | 'report.generate'
  | 'notifications.manage';

// ---------- Filter shapes ----------
export interface WorkerFilters {
  mineId: string; // 'ALL' | mine id
  tab: string; // All Workers | Deployed by Mine | Training Status | Expiring Documents | Transfer History
  contractorId: string; // 'ALL' | contractor id
  department: string; // 'ALL' | department
  status: string; // 'ALL' | WorkerStatus
  trainingStatus: string; // 'ALL' | TrainingStatus
  attendance: string; // 'ALL' | AttendanceStatus
  accessStatus: string; // 'ALL' | AccessStatus
}

export interface AttendanceFilters {
  mineId: string;
  tab: string;
  status: string; // 'ALL' | AttendanceStatus
  gate: string; // 'ALL' | gate
}

export interface BillFilters {
  mineId: string;
  tab: string; // All Bills | Pending | Approved | Rejected | Payments
  contractId: string; // 'ALL' | contract id
}

export interface DocumentFilters {
  mineId: string;
  tab: string; // category tabs
  status: string; // 'ALL' | DocumentStatus
}

export interface IncidentFilters {
  mineId: string;
  tab: string;
  category: string;
  severity: string;
  status: string;
  contractorId: string;
  from: string;
  to: string;
}

/** A gate's display label per mine (used by the access + attendance tabs). */
export const GATES = ['Gate 1 (Main)', 'Gate 2 (OB Bench)', 'Gate 3 (Workshop)', 'Gate 4 (Siding)'];
