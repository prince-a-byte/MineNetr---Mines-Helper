/**
 * MineNetr Coal Mine Operations — domain model.
 * All demonstration data is fictional; enums keep statuses coherent across
 * the 11 portal pages (workers, attendance, dispatch, bills, documents...).
 */

// ---------- Enums ----------
export enum MineStatus { Active = 'Active', Maintenance = 'Maintenance', UnderInspection = 'Under Inspection', Inactive = 'Inactive' }
export enum WorkforceType { Mine = 'Mine', Contractor = 'Contractor' }
export enum WorkerStatus { Active = 'Active', Blocked = 'Blocked', Inactive = 'Inactive' }
export enum TrainingStatus { Valid = 'Valid', ExpiringSoon = 'Expiring Soon', Expired = 'Expired', NotTrained = 'Not Trained' }
export enum AccessStatus { Allowed = 'Allowed', Blocked = 'Blocked' }
export enum AttendanceStatus { Present = 'Present', Absent = 'Absent', OnLeave = 'On Leave', HalfDay = 'Half Day', NotScheduled = 'Not Scheduled' }
export enum WorkLocation { Underground = 'Underground', Surface = 'Surface', Stockyard = 'Stockyard', Workshop = 'Workshop', Office = 'Office' }
export enum AttendanceSource { Gate = 'Gate Terminal', Manual = 'Manual Entry', Supervisor = 'Supervisor Entry' }
export enum ContractorStatus { Active = 'Active', ExpiringSoon = 'Expiring Soon', Expired = 'Expired', Inactive = 'Inactive', PendingApproval = 'Pending Approval', Rejected = 'Rejected' }
export enum WorkOrderStatus { Active = 'Active', PendingApproval = 'Pending Approval', Completed = 'Completed', Cancelled = 'Cancelled' }
export enum Shift { Morning = 'Morning', Afternoon = 'Afternoon', Night = 'Night' }
export enum CoalGrade { G8 = 'G8', G10 = 'G10', G12 = 'G12', Washed = 'Washed', Mixed = 'Mixed', Other = 'Other' }
export enum DispatchStatus { Pending = 'Pending', InTransit = 'In Transit', Dispatched = 'Dispatched', Cancelled = 'Cancelled' }
export enum Destination { NTPC = 'NTPC', RailwaySiding = 'Railway Siding', OtherConsumer = 'Other Consumer', WashedCoal = 'Washed Coal' }
export enum StockTxType { Production = 'Production', Dispatch = 'Dispatch', Transfer = 'Transfer', Reconciliation = 'Reconciliation' }
export enum StockTxStatus { Added = 'Added', Deducted = 'Deducted', Transferred = 'Transferred', Reconciled = 'Reconciled' }
export enum StockStatus { Normal = 'Normal', Low = 'Low', High = 'High' }
export enum BillType { WorkOrder = 'Work Order', Transportation = 'Transportation', Maintenance = 'Maintenance', Services = 'Services', Supplies = 'Supplies' }
export enum BillApprovalStatus { Pending = 'Pending', Approved = 'Approved', Rejected = 'Rejected', UnderReview = 'Under Review' }
export enum PaymentStatus { Unpaid = 'Unpaid', PartiallyPaid = 'Partially Paid', Paid = 'Paid' }
export enum PaymentMode { BankTransfer = 'Bank Transfer (demo)', Cheque = 'Cheque (demo)', UPI = 'UPI (demo)' }
export enum DocumentCategory { StatutoryLicence = 'Statutory Licence', Safety = 'Safety', Environment = 'Environment', Equipment = 'Equipment', Contractor = 'Contractor', Worker = 'Worker', Compliance = 'Compliance', Other = 'Other' }
export enum DocumentStatus { Draft = 'Draft', Pending = 'Pending', Valid = 'Valid', ExpiringSoon = 'Expiring Soon', Expired = 'Expired', Rejected = 'Rejected' }
export enum DocumentAction { Uploaded = 'Uploaded', Submitted = 'Submitted for Review', Approved = 'Approved', Rejected = 'Rejected', Replaced = 'Replaced', Downloaded = 'Downloaded', MetadataUpdated = 'Metadata updated' }
export enum InspectionType { Safety = 'Safety', Environment = 'Environment', Statutory = 'Statutory', Mechanical = 'Mechanical', Electrical = 'Electrical', Other = 'Other' }
export enum InspectionStatusNew { Scheduled = 'Scheduled', InProgress = 'In Progress', Completed = 'Completed', Cancelled = 'Cancelled' }
export enum FindingSeverity { Low = 'Low', Medium = 'Medium', High = 'High', Critical = 'Critical' }
export enum FindingStatusNew { Open = 'Open', ActionAssigned = 'Action Assigned', Resolved = 'Resolved', Closed = 'Closed' }
export enum CorrectiveActionStatus { Open = 'Open', InProgress = 'In Progress', Resolved = 'Resolved', Overdue = 'Overdue' }
export enum NotificationCategory { Attendance = 'Attendance Alerts', Inspection = 'Inspection Notifications', Compliance = 'Compliance Alerts', Bills = 'Bill & Payment Updates', System = 'System Announcements', Production = 'Production & Dispatch' }
export enum NotificationPriority { Low = 'Low', Medium = 'Medium', High = 'High', Critical = 'Critical' }
export enum NotificationStatusNew { Unread = 'Unread', Read = 'Read', Acknowledged = 'Acknowledged' }
export enum ReportType { Production = 'Production Report', Dispatch = 'Dispatch Report', Stockpile = 'Stockpile Report', Contractor = 'Contractor Report', Manpower = 'Manpower Report', Financial = 'Financial Report', Compliance = 'Compliance Report', Safety = 'Safety Report', Custom = 'Custom Report' }
export enum ReportStatus { Ready = 'Ready', Draft = 'Draft', Scheduled = 'Scheduled' }
export enum GasParam { CH4 = 'CH₄', CO = 'CO', O2 = 'O₂', H2S = 'H₂S' }
export enum SensorStatus { Normal = 'Normal', Warning = 'Warning', Critical = 'Critical' }
export enum ThemeSetting { Light = 'Light (Default)', Dark = 'Dark' }
export enum DateFormatSetting { DMY = 'DD MMM YYYY (03 Oct 2026)', YMD = 'YYYY-MM-DD (2026-10-03)', MDY = 'MM/DD/YYYY (10/03/2026)' }
export enum TimeFormatSetting { H12 = '12 Hour (AM/PM)', H24 = '24 Hour (14:30)' }
export enum NumberFormatSetting { Indian = 'Indian (₹ 1,00,000)', International = 'International (₹ 100,000)' }

// ---------- Core entities ----------
export interface MineLocation { area: string; lat: number; lng: number; demo: true }

export interface Mine {
  id: string; code: string; name: string; state: string; district: string;
  operator: string; status: MineStatus; capacityMtYr: number; location: MineLocation;
  contactName: string; contactPhone: string;
}

export interface Contractor {
  id: string; code: string; name: string; workType: string; contactPerson: string;
  phone: string; email: string; contractNo: string; start: string; end: string;
  status: ContractorStatus; mineIds: string[]; contractValueLakh: number;
  complianceStatus: 'Compliant' | 'Partial Compliance' | 'Non-Compliant';
  rating: number; // 0-5 performance rating
}

export interface WorkOrder {
  id: string; contractorId: string; mineId: string; title: string;
  valueLakh: number; start: string; end: string; status: WorkOrderStatus;
}

export interface WorkerAssignment {
  id: string; contractorId: string; mineId: string; from: string; to: string | null; role: string;
}

export interface Worker {
  id: string; code: string; name: string; workforceType: WorkforceType;
  contractorId: string | null; mineId: string; role: string; skill: string;
  joinedOn: string; phone: string; trainingStatus: TrainingStatus;
  trainingExpiry: string | null; accessStatus: AccessStatus; accessCardId: string;
  status: WorkerStatus; biomeitricId: string; assignments: WorkerAssignment[];
}

export interface AttendanceRecord {
  id: string; workerId: string; date: string; inTime: string | null;
  outTime: string | null; status: AttendanceStatus; shift: Shift;
  location: WorkLocation | null; source: AttendanceSource;
}

export interface AccessRecord {
  id: string; subject: string; subjectKind: 'Worker' | 'Vehicle'; workerId: string | null;
  mineId: string; type: 'Entry' | 'Exit'; time: string; date: string; gate: string;
  result: AccessStatus; reason: string | null;
}

export interface Vehicle { id: string; no: string; driver: string; kind: 'Dumper' | 'Trailer' | 'Tipper' }

export interface ProductionRecord {
  id: string; date: string; mineId: string; stockpileId: string; quantityMt: number;
  grade: CoalGrade; shift: Shift; source: string; remarks: string; recordedBy: string;
}

export interface WeighbridgeTransaction {
  id: string; dispatchId: string | null; vehicleNo: string; mineId: string;
  grossMt: number; tareMt: number; netMt: number; timestamp: string;
  status: 'Recorded' | 'Pending';
}

export interface DispatchRecord {
  id: string; date: string; timestamp: string; mineId: string; stockpileId: string;
  destination: Destination; vehicleNo: string; driver: string; grade: CoalGrade;
  quantityMt: number; grossMt: number; tareMt: number; challanNo: string;
  status: DispatchStatus;
}

export interface Stockpile {
  id: string; code: string; name: string; mineId: string; grade: CoalGrade;
  area: string; capacityMt: number; openingMt: number; mapX: number; mapY: number;
}

export interface StockpileTransaction {
  id: string; timestamp: string; date: string; type: StockTxType; stockpileId: string;
  toStockpileId: string | null; quantityMt: number; reference: string;
  counterparty: string; status: StockTxStatus;
}

export interface StockpileReconciliation {
  id: string; stockpileId: string; date: string; systemMt: number; physicalMt: number;
  varianceMt: number; by: string; note: string;
}

export interface Bill {
  id: string; contractorId: string; workOrderId: string | null; mineId: string;
  type: BillType; invoiceDate: string; periodFrom: string; periodTo: string;
  description: string; amount: number; tax: number; notes: string;
  approvalStatus: BillApprovalStatus; paymentStatus: PaymentStatus;
  supportingDocs: string[];
}

export interface Payment {
  id: string; billId: string; amount: number; date: string; mode: PaymentMode; reference: string;
}

export interface DocumentHistoryEntry { at: string; by: string; action: DocumentAction; note: string }

export interface OpsDocument {
  id: string; name: string; category: DocumentCategory; mineId: string;
  relatedKind: 'Mine' | 'Contractor' | 'Worker' | 'Inspection'; relatedId: string;
  refNo: string; issueDate: string; expiryDate: string | null; status: DocumentStatus;
  submittedBy: string; description: string;
  file: { name: string; sizeKb: number; uploadedAt: string } | null;
  history: DocumentHistoryEntry[];
}

export interface Inspection {
  id: string; mineId: string; type: InspectionType; date: string; inspector: string;
  inspectorOrg: string; status: InspectionStatusNew; priority: NotificationPriority;
  remarks: string; reportFile: string | null;
}

export interface InspectionFinding {
  id: string; inspectionId: string; mineId: string; category: string;
  severity: FindingSeverity; status: FindingStatusNew; description: string;
  location: string; detectedAt: string;
}

export interface CorrectiveAction {
  id: string; findingId: string; action: string; owner: string; dueDate: string;
  status: CorrectiveActionStatus; resolutionNote: string;
}

export interface OpsNotification {
  id: string; title: string; body: string; category: NotificationCategory;
  priority: NotificationPriority; timestamp: string; mineId: string | null;
  status: NotificationStatusNew; relatedKind: string | null; relatedId: string | null;
}

export interface OpsAuditEntry {
  id: string; timestamp: string; user: string; role: string; module: string;
  action: string; resource: string; details: string;
  before: string | null; after: string | null; relatedId: string | null;
}

export interface OpsReport {
  id: string; name: string; type: ReportType; mineId: string; from: string; to: string;
  generatedAt: string; generatedBy: string; status: ReportStatus; rowCount: number;
  csv: string; scheduled: boolean;
}

export interface Session {
  id: string; device: string; browser: string; location: string; lastActive: string; current: boolean;
}

export interface OperationsUser {
  id: string; name: string; email: string; phone: string; role: string;
  employeeId: string; department: string; language: string; minePermissions: string[];
  homeMineId: string; sessions: Session[];
}

export interface NotificationPrefs { attendance: boolean; inspection: boolean; compliance: boolean; bills: boolean; system: boolean; production: boolean; email: boolean; sms: boolean }

export interface DisplayPrefs {
  theme: ThemeSetting; dateFormat: DateFormatSetting; timeFormat: TimeFormatSetting;
  numberFormat: NumberFormatSetting; itemsPerPage: number; defaultMineId: string;
}

export interface OperationsSettings { notifications: NotificationPrefs; display: DisplayPrefs }

export interface GasSensor { mineId: string; param: GasParam; value: number; unit: string; threshold: string; status: SensorStatus; at: string }
export interface GasTrendPoint { hour: string; ch4: number; co: number; o2: number; h2s: number }
export interface EnvConditions { mineId: string; tempC: number; humidityPct: number; airVelocityMs: number; dustPm25: number }
export interface CameraFeed { id: string; mineId: string; label: string; lastSeen: string; note: string }

/** Demo clock — fixed so the synthetic dataset stays deterministic. */
export const DEMO_NOW_ISO = '2026-10-03T10:45:32+05:30';
export const DEMO_TODAY = '2026-10-03';
