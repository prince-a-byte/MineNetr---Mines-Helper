/**
 * MineNetr DGMS portal — typed domain models.
 * Statuses are enums, not arbitrary strings. IDs are stable and relational
 * (finding -> mine + inspection, corrective action -> finding, etc.).
 * All records are synthetic demonstration data (see mocks/seed.ts).
 */

export enum MineStatus {
  Active = 'Active',
  UnderInspection = 'Under Inspection',
  Inactive = 'Inactive',
  Closed = 'Closed',
}

export enum RiskLevel {
  Low = 'Low',
  Medium = 'Medium',
  High = 'High',
  Critical = 'Critical',
}

export enum MineType {
  OpenCast = 'Open Cast',
  Underground = 'Underground',
}

export enum InspectionStatus {
  Scheduled = 'Scheduled',
  InProgress = 'In Progress',
  Completed = 'Completed',
  Overdue = 'Overdue',
}

export enum InspectionType {
  Routine = 'Routine',
  Safety = 'Safety',
  Environmental = 'Environmental',
  Special = 'Special',
}

export enum ReportStatus {
  NotSubmitted = 'Not Submitted',
  Submitted = 'Submitted',
  PendingReview = 'Pending Review',
  Approved = 'Approved',
  Rejected = 'Rejected',
}

export enum Priority {
  Critical = 'Critical',
  High = 'High',
  Medium = 'Medium',
  Low = 'Low',
}

export enum FindingCategory {
  Safety = 'Safety',
  Environment = 'Environment',
  Equipment = 'Equipment',
  Documentation = 'Documentation',
  WorkerWelfare = 'Worker Welfare',
  Other = 'Other',
}

export enum Severity {
  Critical = 'Critical',
  High = 'High',
  Medium = 'Medium',
  Low = 'Low',
  Informational = 'Informational',
}

export enum FindingStatus {
  Open = 'Open',
  Assigned = 'Assigned',
  InProgress = 'In Progress',
  AwaitingVerification = 'Awaiting Verification',
  Resolved = 'Resolved',
  Reopened = 'Reopened',
}

export enum FindingSource {
  Inspector = 'Inspector',
  AIDetection = 'AI Detection',
  SensorAlert = 'Sensor Alert',
}

export enum CorrectiveActionStatus {
  Open = 'Open',
  Assigned = 'Assigned',
  InProgress = 'In Progress',
  AwaitingVerification = 'Awaiting Verification',
  Resolved = 'Resolved',
  Reopened = 'Reopened',
}

export enum AlertStatus {
  Open = 'Open',
  Acknowledged = 'Acknowledged',
  Resolved = 'Resolved',
}

export enum ComplianceStatus {
  Compliant = 'Compliant',
  PartiallyCompliant = 'Partially Compliant',
  NonCompliant = 'Non-Compliant',
}

export enum EnvParam {
  AirQuality = 'Air Quality',
  Gases = 'Gases',
  Dust = 'Dust',
  Temperature = 'Temperature',
  Water = 'Water',
  Noise = 'Noise',
}

export enum EnvStatus {
  Normal = 'Normal',
  Warning = 'Warning',
  Critical = 'Critical',
  NoData = 'No Data',
}

export enum DispatchStatus {
  Scheduled = 'Scheduled',
  InTransit = 'In Transit',
  Delivered = 'Delivered',
  Delayed = 'Delayed',
  Cancelled = 'Cancelled',
}

export enum StockpileStatus {
  WithinLimit = 'Within Limit',
  NearLimit = 'Near Limit',
  OverLimit = 'Over Limit',
  NoRecentData = 'No Recent Data',
}

export enum WorkerStatus {
  Active = 'Active',
  OnLeave = 'On Leave',
  Inactive = 'Inactive',
}

export enum WorkerCompliance {
  Complete = 'Complete',
  Partial = 'Partial Compliance',
  NonCompliant = 'Non-Compliant',
}

export enum DocumentStatus {
  Valid = 'Valid',
  ExpiringSoon = 'Expiring Soon',
  Expired = 'Expired',
  Pending = 'Pending',
}

export enum ContractorStatus {
  Active = 'Active',
  Pending = 'Pending',
  Suspended = 'Suspended',
}

export enum NotificationStatus {
  Unread = 'Unread',
  Read = 'Read',
  Acknowledged = 'Acknowledged',
  Resolved = 'Resolved',
}

export enum NotificationCategory {
  Safety = 'Safety',
  Environmental = 'Environmental',
  Inspection = 'Inspection',
  Compliance = 'Compliance',
  System = 'System',
}

export enum AuditSeverity {
  Low = 'Low',
  Medium = 'Medium',
  High = 'High',
  Critical = 'Critical',
}

export enum UserRole {
  MainAdministrator = 'Main Administrator',
  Inspector = 'Inspector',
  MineOperator = 'Mine Operator',
  Contractor = 'Contractor',
}

// ---------- Entities ----------

export interface MineLocation {
  /** Fictional demonstration coordinates — never real mine coordinates. */
  lat: number;
  lng: number;
  demo: true;
}

export interface Mine {
  id: string;
  code: string;
  name: string;
  state: string;
  district: string;
  operator: string;
  type: MineType;
  status: MineStatus;
  risk: RiskLevel;
  address: string;
  contactName: string;
  contactPhone: string;
  productionMt: number;
  lastInspection: string; // ISO date
  location: MineLocation;
}

export interface Inspection {
  id: string;
  mineId: string;
  inspectorId: string;
  type: InspectionType;
  status: InspectionStatus;
  priority: Priority;
  scheduledDate: string; // ISO
  actualDate?: string; // ISO
  reportStatus: ReportStatus;
  remarks: string;
  rejectionReason?: string;
}

export interface Inspector {
  id: string;
  name: string;
  designation: string;
  state: string;
}

export interface Finding {
  id: string;
  mineId: string;
  inspectionId: string;
  inspectorId: string;
  category: FindingCategory;
  severity: Severity;
  status: FindingStatus;
  source: FindingSource;
  location: string;
  description: string;
  recommendation: string;
  assignee: string;
  detectedAt: string; // ISO datetime
  dueDate: string; // ISO date
  evidence: string[];
  verifiedHuman: boolean;
}

export interface CorrectiveAction {
  id: string;
  findingId: string;
  officer: string;
  dueDate: string; // ISO date
  note: string;
  status: CorrectiveActionStatus;
  resolution?: string;
  updatedAt: string; // ISO datetime
}

export interface SafetyIncident {
  id: string;
  mineId: string;
  type: string;
  severity: Severity;
  date: string; // ISO date
  injuries: number;
  description: string;
  status: AlertStatus;
}

export interface EnvironmentalRecord {
  id: string;
  mineId: string;
  parameter: EnvParam;
  metric: string;
  unit: string;
  value: number;
  threshold: number;
  status: EnvStatus;
  updatedAt: string; // ISO datetime
  demo: true;
}

export interface SensorAlert {
  id: string;
  mineId: string;
  parameter: string;
  reading: string;
  threshold: string;
  severity: Severity;
  timestamp: string; // ISO datetime
  status: AlertStatus;
  demo: true;
}

export interface ProductionRecord {
  id: string;
  mineId: string;
  month: string; // YYYY-MM
  productionMt: number;
  dispatchMt: number;
}

export interface DispatchRecord {
  id: string;
  mineId: string;
  datetime: string; // ISO datetime
  vehicle: string;
  destination: string;
  quantityMt: number;
  status: DispatchStatus;
  anomaly?: string;
  weighbridgeId: string;
}

export interface Stockpile {
  id: string;
  mineId: string;
  type: string;
  quantityMt: number;
  limitMt: number;
  status: StockpileStatus;
  updatedAt: string; // ISO date
}

export interface Contractor {
  id: string;
  company: string;
  regNo: string;
  status: ContractorStatus;
  mines: string[]; // mineIds
  contactName: string;
  contactPhone: string;
}

export interface Worker {
  id: string;
  name: string;
  contractorId: string;
  mineId: string;
  state: string;
  designation: string;
  status: WorkerStatus;
  /** Masked synthetic identifier, e.g. XXXX-XXXX-1042. Never a real Aadhaar. */
  idMasked: string;
  medicalValid: boolean;
  trainingValid: boolean;
  authValid: boolean;
  idValid: boolean;
  joinedOn: string; // ISO date
}

export interface WorkerDocument {
  id: string;
  workerId: string;
  type: string;
  status: DocumentStatus;
  validTill: string; // ISO date
}

export interface ComplianceReport {
  id: string;
  type: string;
  name: string;
  filters: Record<string, string>;
  generatedAt: string; // ISO datetime
  generatedBy: string;
  status: 'Ready' | 'Failed';
  /** CSV payload for download (mock-generated). */
  csv: string;
}

export interface ScheduledReport {
  id: string;
  name: string;
  frequency: 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly';
  nextRun: string; // ISO date
  enabled: boolean;
}

export interface Notification {
  id: string;
  datetime: string; // ISO datetime
  category: NotificationCategory;
  priority: Priority;
  title: string;
  description: string;
  mineId?: string;
  state?: string;
  status: NotificationStatus;
  relatedKind?: 'finding' | 'inspection' | 'alert' | 'report' | 'mine' | 'worker';
  relatedId?: string;
  evidence?: string;
  recommendation?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string; // ISO datetime
  user: string;
  role: string;
  module: string;
  action: string;
  resource: string;
  details: string;
  ip: string; // synthetic demo IP
  severity: AuditSeverity;
  before?: string;
  after?: string;
  relatedId?: string;
}

export interface DgmsUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'Active' | 'Inactive';
  lastLogin: string; // ISO datetime
}

export type PermissionKey =
  | 'view' | 'create' | 'edit' | 'delete' | 'approve' | 'export';

export interface RolePermissions {
  role: UserRole;
  perms: Record<PermissionKey, boolean>;
}

export interface SystemSettings {
  orgName: string;
  ministry: string;
  address: string;
  email: string;
  phone: string;
  website: string;
  landingPage: string;
  dateFormat: string;
  timeZone: string;
  language: string;
  showMapByDefault: boolean;
  autoLogoutMinutes: number;
  sessionTimeoutWarning: boolean;
  twoFactor: boolean;
  loginAttemptLimit: number;
  lockout: boolean;
  ipRestriction: boolean;
  loginNotifications: boolean;
  notifPrefs: Record<string, { channel: string; email: boolean; inApp: boolean; sms: boolean }>;
  appVersion: string;
  environment: string;
  lastBackup?: string;
}
