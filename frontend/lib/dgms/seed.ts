/**
 * Centralized synthetic DGMS seed data.
 * - Every record is fictional demonstration data (names/places resemble the
 *   reference mockups; nothing here is a real government record).
 * - Mine coordinates are explicitly fictional demo values.
 * - IDs are stable; findings reference valid mine+inspection IDs, corrective
 *   actions reference valid findings, workers reference valid contractors and
 *   mines, dispatch references valid mines, notifications reference records.
 */
import {
  AlertStatus, ComplianceStatus, ContractorStatus, CorrectiveActionStatus,
  DispatchStatus, DocumentStatus, EnvParam, EnvStatus, FindingCategory,
  FindingSource, FindingStatus, InspectionStatus, InspectionType, MineStatus,
  MineType, NotificationCategory, NotificationStatus, Priority, ReportStatus,
  RiskLevel, Severity, StockpileStatus, UserRole, WorkerCompliance, WorkerStatus,
  type Contractor, type CorrectiveAction, type DgmsUser, type DispatchRecord,
  type EnvironmentalRecord, type Finding, type Inspection, type Inspector,
  type Mine, type Notification, type ProductionRecord, type SafetyIncident,
  type ScheduledReport, type SensorAlert, type Stockpile, type SystemSettings,
  type Worker, type WorkerDocument, type RolePermissions,
} from './types';

export const DEMO_NOW_ISO = '2026-10-03T18:00:00+05:30';

/** Fictional demo coordinates — do NOT treat as real mine locations. */
const LOC = (lat: number, lng: number) => ({ lat, lng, demo: true as const });

export const mines: Mine[] = [
  { id: 'M-01', code: 'BCM-03', name: 'Bharat Coal Mine', state: 'Jharkhand', district: 'Dhanbad', operator: 'Bharat Coking Coal Ltd.', type: MineType.OpenCast, status: MineStatus.Active, risk: RiskLevel.Medium, address: 'Saraidhela, Dhanbad, Jharkhand 828127', contactName: 'S. P. Singh', contactPhone: '+91-90000-10001', productionMt: 4.2, lastInspection: '2026-10-03', location: LOC(23.78, 86.42) },
  { id: 'M-02', code: 'GVM-01', name: 'GeVra Mine', state: 'Chhattisgarh', district: 'Korba', operator: 'SECL', type: MineType.OpenCast, status: MineStatus.UnderInspection, risk: RiskLevel.High, address: 'Kusmunda Area, Korba, Chhattisgarh 495454', contactName: 'R. K. Verma', contactPhone: '+91-90000-10002', productionMt: 6.8, lastInspection: '2026-10-02', location: LOC(22.35, 82.68) },
  { id: 'M-03', code: 'TLM-02', name: 'Talcher Mine', state: 'Odisha', district: 'Angul', operator: 'MCL', type: MineType.OpenCast, status: MineStatus.Active, risk: RiskLevel.Medium, address: 'Talcher Coalfields, Angul, Odisha 759100', contactName: 'P. K. Das', contactPhone: '+91-90000-10003', productionMt: 5.1, lastInspection: '2026-10-01', location: LOC(20.95, 85.22) },
  { id: 'M-04', code: 'KSM-01', name: 'Kusmunda Mine', state: 'Chhattisgarh', district: 'Korba', operator: 'SECL', type: MineType.OpenCast, status: MineStatus.Active, risk: RiskLevel.Low, address: 'Kusmunda, Korba, Chhattisgarh 495454', contactName: 'A. K. Singh', contactPhone: '+91-90000-10004', productionMt: 4.9, lastInspection: '2026-09-30', location: LOC(22.28, 82.71) },
  { id: 'M-05', code: 'IBV-01', name: 'IB Valley Mine', state: 'Odisha', district: 'Jharsuguda', operator: 'MCL', type: MineType.OpenCast, status: MineStatus.Active, risk: RiskLevel.Medium, address: 'Brajrajnagar, Jharsuguda, Odisha 768216', contactName: 'M. Sahoo', contactPhone: '+91-90000-10005', productionMt: 3.6, lastInspection: '2026-09-29', location: LOC(21.85, 83.93) },
  { id: 'M-06', code: 'MDR-01', name: 'Mand-Raigarh', state: 'Chhattisgarh', district: 'Raigarh', operator: 'SECL', type: MineType.OpenCast, status: MineStatus.Active, risk: RiskLevel.High, address: 'Mand Area, Raigarh, Chhattisgarh 496001', contactName: 'D. R. Yadav', contactPhone: '+91-90000-10006', productionMt: 2.8, lastInspection: '2026-09-28', location: LOC(21.89, 83.39) },
  { id: 'M-07', code: 'NKM-01', name: 'North Karanpura', state: 'Jharkhand', district: 'Chatra', operator: 'CCL', type: MineType.OpenCast, status: MineStatus.UnderInspection, risk: RiskLevel.Critical, address: 'Tandwa, Chatra, Jharkhand 825321', contactName: 'K. P. Mahto', contactPhone: '+91-90000-10007', productionMt: 2.2, lastInspection: '2026-09-26', location: LOC(23.98, 84.92) },
  { id: 'M-08', code: 'SHP-01', name: 'Sohagpur Mine', state: 'Madhya Pradesh', district: 'Shahdol', operator: 'WCL', type: MineType.Underground, status: MineStatus.Active, risk: RiskLevel.Medium, address: 'Sohagpur Area, Shahdol, MP 484001', contactName: 'V. K. Sharma', contactPhone: '+91-90000-10008', productionMt: 1.9, lastInspection: '2026-09-25', location: LOC(23.28, 81.38) },
  { id: 'M-09', code: 'LKM-01', name: 'Lakhanpur Mine', state: 'Madhya Pradesh', district: 'Singrauli', operator: 'WCL', type: MineType.OpenCast, status: MineStatus.Active, risk: RiskLevel.Low, address: 'Jayant, Singrauli, MP 486890', contactName: 'N. K. Gupta', contactPhone: '+91-90000-10009', productionMt: 2.5, lastInspection: '2026-09-24', location: LOC(24.12, 82.66) },
  { id: 'M-10', code: 'SGM-01', name: 'Singrauli Mine', state: 'Madhya Pradesh', district: 'Singrauli', operator: 'NCL', type: MineType.OpenCast, status: MineStatus.Active, risk: RiskLevel.Medium, address: 'Singrauli Coalfields, MP 486889', contactName: 'R. S. Patel', contactPhone: '+91-90000-10010', productionMt: 3.1, lastInspection: '2026-09-22', location: LOC(24.19, 82.67) },
  { id: 'M-11', code: 'RJH-01', name: 'Rajhara Coal Mine', state: 'Jharkhand', district: 'Palamu', operator: 'CCL', type: MineType.Underground, status: MineStatus.Inactive, risk: RiskLevel.Low, address: 'Rajhara Area, Palamu, Jharkhand 822124', contactName: 'S. K. Mishra', contactPhone: '+91-90000-10011', productionMt: 0.0, lastInspection: '2026-08-14', location: LOC(24.02, 83.91) },
  { id: 'M-12', code: 'KRP-01', name: 'Karanpura Coal Mine', state: 'Jharkhand', district: 'Bokaro', operator: 'CCL', type: MineType.OpenCast, status: MineStatus.Active, risk: RiskLevel.High, address: 'Kargali Area, Bokaro, Jharkhand 829144', contactName: 'B. K. Rai', contactPhone: '+91-90000-10012', productionMt: 2.7, lastInspection: '2026-09-20', location: LOC(23.72, 85.98) },
];

export const inspectors: Inspector[] = [
  { id: 'I-01', name: 'R. Singh', designation: 'Deputy Director', state: 'Jharkhand' },
  { id: 'I-02', name: 'P. Kumar', designation: 'Assistant Director', state: 'Odisha' },
  { id: 'I-03', name: 'S. Sharma', designation: 'Senior Inspector', state: 'Chhattisgarh' },
  { id: 'I-04', name: 'M. Das', designation: 'Inspector', state: 'Madhya Pradesh' },
  { id: 'I-05', name: 'K. Yadav', designation: 'Inspector', state: 'Jharkhand' },
];

const INSP = (
  id: string, mineId: string, inspectorId: string, type: InspectionType,
  status: InspectionStatus, priority: Priority, scheduledDate: string,
  actualDate: string | undefined, reportStatus: ReportStatus, remarks: string,
): Inspection => ({ id, mineId, inspectorId, type, status, priority, scheduledDate, actualDate, reportStatus, remarks });

export const inspections: Inspection[] = [
  INSP('INS-2026-214', 'M-01', 'I-01', InspectionType.Routine, InspectionStatus.Completed, Priority.High, '2026-10-03', '2026-10-03', ReportStatus.Submitted, 'Routine statutory inspection of pit and haul roads.'),
  INSP('INS-2026-213', 'M-02', 'I-03', InspectionType.Safety, InspectionStatus.InProgress, Priority.Critical, '2026-10-02', undefined, ReportStatus.NotSubmitted, 'Follow-up on methane exceedance at Panel 2.'),
  INSP('INS-2026-212', 'M-03', 'I-02', InspectionType.Routine, InspectionStatus.Completed, Priority.Medium, '2026-10-02', '2026-10-02', ReportStatus.PendingReview, 'Awaiting DGMS review of dust control measures.'),
  INSP('INS-2026-211', 'M-04', 'I-03', InspectionType.Environmental, InspectionStatus.Overdue, Priority.Medium, '2026-09-27', undefined, ReportStatus.NotSubmitted, 'Overdue: monsoon runoff inspection.'),
  INSP('INS-2026-210', 'M-05', 'I-02', InspectionType.Routine, InspectionStatus.Completed, Priority.Low, '2026-09-29', '2026-09-29', ReportStatus.Approved, 'No major observations.'),
  INSP('INS-2026-209', 'M-06', 'I-03', InspectionType.Safety, InspectionStatus.Scheduled, Priority.High, '2026-10-05', undefined, ReportStatus.NotSubmitted, 'Planned slope-stability review.'),
  INSP('INS-2026-208', 'M-07', 'I-01', InspectionType.Special, InspectionStatus.InProgress, Priority.Critical, '2026-09-30', undefined, ReportStatus.NotSubmitted, 'Special inspection after slope slip warning.'),
  INSP('INS-2026-207', 'M-08', 'I-04', InspectionType.Routine, InspectionStatus.Completed, Priority.Medium, '2026-09-25', '2026-09-25', ReportStatus.Submitted, 'Underground ventilation check.'),
  INSP('INS-2026-206', 'M-09', 'I-04', InspectionType.Environmental, InspectionStatus.Completed, Priority.Low, '2026-09-24', '2026-09-24', ReportStatus.Approved, 'Water discharge within limits.'),
  INSP('INS-2026-205', 'M-10', 'I-04', InspectionType.Safety, InspectionStatus.Scheduled, Priority.Medium, '2026-10-06', undefined, ReportStatus.NotSubmitted, 'Scheduled conveyor safety review.'),
  INSP('INS-2026-204', 'M-12', 'I-05', InspectionType.Safety, InspectionStatus.Overdue, Priority.High, '2026-09-26', undefined, ReportStatus.NotSubmitted, 'Overdue: fire-safety drill verification.'),
  INSP('INS-2026-203', 'M-01', 'I-05', InspectionType.Environmental, InspectionStatus.Completed, Priority.Medium, '2026-09-20', '2026-09-20', ReportStatus.Approved, 'PM10 action plan reviewed.'),
  INSP('INS-2026-202', 'M-03', 'I-02', InspectionType.Special, InspectionStatus.Completed, Priority.High, '2026-09-18', '2026-09-18', ReportStatus.Rejected, 'Report returned: missing strata logs.'),
  INSP('INS-2026-201', 'M-06', 'I-03', InspectionType.Routine, InspectionStatus.Completed, Priority.Medium, '2026-09-15', '2026-09-15', ReportStatus.Submitted, 'Routine quarterly inspection.'),
  INSP('INS-2026-200', 'M-07', 'I-01', InspectionType.Safety, InspectionStatus.Completed, Priority.Critical, '2026-09-10', '2026-09-10', ReportStatus.Approved, 'PPE campaign verified.'),
];

const FND = (
  id: string, mineId: string, inspectionId: string, inspectorId: string, category: FindingCategory,
  severity: Severity, status: FindingStatus, source: FindingSource, location: string, description: string,
  recommendation: string, assignee: string, detectedAt: string, dueDate: string, verifiedHuman: boolean,
): Finding => ({ id, mineId, inspectionId, inspectorId, category, severity, status, source, location, description, recommendation, assignee, detectedAt, dueDate, evidence: ['photo-1.jpg', 'note-1.pdf'], verifiedHuman });

export const findings: Finding[] = [
  FND('FND-2026-482', 'M-01', 'INS-2026-214', 'I-01', FindingCategory.Safety, Severity.Critical, FindingStatus.Open, FindingSource.AIDetection, 'Pit Area – Loading Point L3', 'Workers without helmets detected in active loading zone (CCTV analytics, confidence 0.91).', 'Enforce PPE zone barricading and supervisor sign-off before loading resumes.', 'Mine Manager, BCM-03', '2026-10-03T10:24:00+05:30', '2026-10-10', false),
  FND('FND-2026-478', 'M-07', 'INS-2026-208', 'I-01', FindingCategory.Safety, Severity.Critical, FindingStatus.InProgress, FindingSource.Inspector, 'OB Dump – Tier 3', 'Slope slip indicators on overburden dump tier 3 after rainfall.', 'Restrict dump access, install piezometers, submit stability certificate in 7 days.', 'Agent, NKM-01', '2026-09-30T14:05:00+05:30', '2026-10-07', true),
  FND('FND-2026-481', 'M-02', 'INS-2026-213', 'I-03', FindingCategory.Environment, Severity.Critical, FindingStatus.Open, FindingSource.SensorAlert, 'Panel 2 – Return airway', 'Methane 2.4% against 1.0% limit at Panel 2 return.', 'Withdraw men, increase ventilation, re-test before re-entry.', 'Ventilation Officer, GVM-01', '2026-10-03T09:18:00+05:30', '2026-10-04', true),
  FND('FND-2026-474', 'M-12', 'INS-2026-204', 'I-05', FindingCategory.Safety, Severity.High, FindingStatus.Open, FindingSource.Inspector, 'Fire station – Pit top', 'Fire drill log incomplete; two extinguishers past service date.', 'Service extinguishers and conduct documented drill within 72 hours.', 'Safety Officer, KRP-01', '2026-09-26T11:00:00+05:30', '2026-09-29', true),
  FND('FND-2026-480', 'M-02', 'INS-2026-213', 'I-03', FindingCategory.Equipment, Severity.High, FindingStatus.Assigned, FindingSource.Inspector, 'Conveyor C-2 gallery', 'Belt sway switch bypassed on conveyor C-2.', 'Restore interlock and log trial run with safety officer present.', 'Electrical Engineer, GVM-01', '2026-10-02T16:40:00+05:30', '2026-10-09', true),
  FND('FND-2026-477', 'M-06', 'INS-2026-201', 'I-03', FindingCategory.WorkerWelfare, Severity.Medium, FindingStatus.InProgress, FindingSource.Inspector, 'Pit rest shelter 2', 'Drinking water and first-aid kit inadequate at shelter 2.', 'Restock shelter and submit weekly checklist for one month.', 'Welfare Officer, MDR-01', '2026-09-15T12:20:00+05:30', '2026-10-15', true),
  FND('FND-2026-476', 'M-03', 'INS-2026-212', 'I-02', FindingCategory.Environment, Severity.High, FindingStatus.AwaitingVerification, FindingSource.SensorAlert, 'Haul Road H2', 'PM10 182 µg/m³ against 100 µg/m³ limit near haul road H2.', 'Increase water sprinkling frequency; verify with 24-hr average.', 'Environment Officer, TLM-02', '2026-10-02T08:15:00+05:30', '2026-10-06', true),
  FND('FND-2026-475', 'M-09', 'INS-2026-206', 'I-04', FindingCategory.Documentation, Severity.Medium, FindingStatus.Resolved, FindingSource.Inspector, 'Time office', 'Muster entries for contractor crew incomplete for 2 shifts.', 'Reconcile muster with gate logs; resolved and verified.', 'Time Keeper, LKM-01', '2026-09-24T10:00:00+05:30', '2026-09-27', true),
  FND('FND-2026-473', 'M-08', 'INS-2026-207', 'I-04', FindingCategory.Safety, Severity.Medium, FindingStatus.Resolved, FindingSource.Inspector, 'Incline mouth', 'Missing handrail section at incline mouth walkway.', 'Handrail restored and photographed; verified on revisit.', 'Civil Foreman, SHP-01', '2026-09-25T09:30:00+05:30', '2026-09-28', true),
  FND('FND-2026-472', 'M-05', 'INS-2026-210', 'I-02', FindingCategory.Equipment, Severity.Low, FindingStatus.Resolved, FindingSource.Inspector, 'Workshop bay 1', 'Improper stacking of drill rods in workshop bay.', 'Housekeeping corrected during inspection.', 'Workshop Incharge, IBV-01', '2026-09-29T11:10:00+05:30', '2026-09-30', true),
  FND('FND-2026-471', 'M-04', 'INS-2026-211', 'I-03', FindingCategory.Environment, Severity.Medium, FindingStatus.Open, FindingSource.Inspector, 'Settling pond outlet', 'Silt carryover observed at settling pond outlet after rain.', 'Desilt pond and re-sample discharge within 5 days.', 'Environment Officer, KSM-01', '2026-09-27T15:00:00+05:30', '2026-10-02', true),
  FND('FND-2026-470', 'M-10', 'INS-2026-205', 'I-04', FindingCategory.Documentation, Severity.Low, FindingStatus.Open, FindingSource.Inspector, 'Despatch office', 'Weighbridge calibration certificate expires in 20 days.', 'Schedule recalibration before expiry.', 'Weighbridge Incharge, SGM-01', '2026-09-22T10:00:00+05:30', '2026-10-12', true),
  FND('FND-2026-469', 'M-01', 'INS-2026-203', 'I-05', FindingCategory.Environment, Severity.Medium, FindingStatus.Resolved, FindingSource.Inspector, 'Coal stockyard', 'Fugitive dust at stockyard transfer point.', 'Wind screens installed; verified.', 'Environment Officer, BCM-03', '2026-09-20T09:00:00+05:30', '2026-09-25', true),
  FND('FND-2026-468', 'M-06', 'INS-2026-201', 'I-03', FindingCategory.Safety, Severity.High, FindingStatus.Reopened, FindingSource.Inspector, 'Blast zone B-4', 'Blast guard deployment short by 2 posts during review.', 'Re-audit blast guard roster; reopened after repeat lapse.', 'Blasting Officer, MDR-01', '2026-09-15T13:00:00+05:30', '2026-09-22', true),
];

export const correctiveActions: CorrectiveAction[] = [
  { id: 'CA-2026-101', findingId: 'FND-2026-478', officer: 'Agent, NKM-01', dueDate: '2026-10-07', note: 'Dump access restricted; piezometer installation in progress.', status: CorrectiveActionStatus.InProgress, updatedAt: '2026-10-02T17:00:00+05:30' },
  { id: 'CA-2026-102', findingId: 'FND-2026-476', officer: 'Environment Officer, TLM-02', dueDate: '2026-10-06', note: 'Sprinkling frequency doubled; awaiting 24-hr average.', status: CorrectiveActionStatus.AwaitingVerification, updatedAt: '2026-10-03T08:40:00+05:30' },
  { id: 'CA-2026-103', findingId: 'FND-2026-480', officer: 'Electrical Engineer, GVM-01', dueDate: '2026-10-09', note: 'Interlock parts ordered.', status: CorrectiveActionStatus.Assigned, updatedAt: '2026-10-02T18:10:00+05:30' },
  { id: 'CA-2026-104', findingId: 'FND-2026-475', officer: 'Time Keeper, LKM-01', dueDate: '2026-09-27', note: 'Muster reconciled with gate logs.', status: CorrectiveActionStatus.Resolved, resolution: 'Verified by inspector on revisit.', updatedAt: '2026-09-27T12:00:00+05:30' },
  { id: 'CA-2026-105', findingId: 'FND-2026-473', officer: 'Civil Foreman, SHP-01', dueDate: '2026-09-28', note: 'Handrail restored with photographs.', status: CorrectiveActionStatus.Resolved, resolution: 'Verified on revisit.', updatedAt: '2026-09-28T10:00:00+05:30' },
  { id: 'CA-2026-106', findingId: 'FND-2026-468', officer: 'Blasting Officer, MDR-01', dueDate: '2026-09-22', note: 'Roster re-audit scheduled after repeat lapse.', status: CorrectiveActionStatus.Reopened, updatedAt: '2026-09-23T09:00:00+05:30' },
];

export const incidents: SafetyIncident[] = [
  { id: 'INC-2026-031', mineId: 'M-07', type: 'Slope Slip Warning', severity: Severity.High, date: '2026-09-30', injuries: 0, description: 'Minor slip on OB dump tier 3; area cordoned.', status: AlertStatus.Acknowledged },
  { id: 'INC-2026-030', mineId: 'M-02', type: 'Gas Exceedance', severity: Severity.Critical, date: '2026-10-03', injuries: 0, description: 'Methane above limit at Panel 2 return.', status: AlertStatus.Open },
  { id: 'INC-2026-029', mineId: 'M-01', type: 'Vehicle Incident', severity: Severity.Medium, date: '2026-09-28', injuries: 1, description: 'Dumper fender-bender at loading point; one minor injury.', status: AlertStatus.Resolved },
  { id: 'INC-2026-028', mineId: 'M-06', type: 'Blast Misfire Scare', severity: Severity.High, date: '2026-09-15', injuries: 0, description: 'Suspected misfire; cleared after inspection.', status: AlertStatus.Resolved },
  { id: 'INC-2026-027', mineId: 'M-03', type: 'Dust Complaint', severity: Severity.Medium, date: '2026-09-18', injuries: 0, description: 'Village complaint on haul-road dust.', status: AlertStatus.Acknowledged },
  { id: 'INC-2026-026', mineId: 'M-08', type: 'Roof Fall (minor)', severity: Severity.Medium, date: '2026-09-12', injuries: 0, description: 'Small roof fall in old gallery; supported.', status: AlertStatus.Resolved },
  { id: 'INC-2026-025', mineId: 'M-12', type: 'Fire Alarm (false)', severity: Severity.Low, date: '2026-09-08', injuries: 0, description: 'False alarm traced to faulty sensor.', status: AlertStatus.Resolved },
];

export const envRecords: EnvironmentalRecord[] = [
  { id: 'ENV-01', mineId: 'M-01', parameter: EnvParam.Dust, metric: 'PM10', unit: 'µg/m³', value: 182, threshold: 100, status: EnvStatus.Critical, updatedAt: '2026-10-03T10:24:00+05:30', demo: true },
  { id: 'ENV-02', mineId: 'M-02', parameter: EnvParam.Gases, metric: 'CH4', unit: '%', value: 2.4, threshold: 1.0, status: EnvStatus.Critical, updatedAt: '2026-10-03T09:18:00+05:30', demo: true },
  { id: 'ENV-03', mineId: 'M-04', parameter: EnvParam.Dust, metric: 'PM10', unit: 'µg/m³', value: 132, threshold: 100, status: EnvStatus.Warning, updatedAt: '2026-10-03T08:46:00+05:30', demo: true },
  { id: 'ENV-04', mineId: 'M-03', parameter: EnvParam.AirQuality, metric: 'AQI', unit: 'index', value: 168, threshold: 150, status: EnvStatus.Warning, updatedAt: '2026-10-03T08:02:00+05:30', demo: true },
  { id: 'ENV-05', mineId: 'M-06', parameter: EnvParam.Gases, metric: 'CO', unit: 'ppm', value: 35, threshold: 25, status: EnvStatus.Warning, updatedAt: '2026-10-03T08:46:00+05:30', demo: true },
  { id: 'ENV-06', mineId: 'M-05', parameter: EnvParam.Temperature, metric: 'Pit temp', unit: '°C', value: 41, threshold: 40, status: EnvStatus.Warning, updatedAt: '2026-10-02T14:00:00+05:30', demo: true },
  { id: 'ENV-07', mineId: 'M-08', parameter: EnvParam.Noise, metric: 'Leq', unit: 'dB(A)', value: 82, threshold: 85, status: EnvStatus.Normal, updatedAt: '2026-10-02T12:00:00+05:30', demo: true },
  { id: 'ENV-08', mineId: 'M-09', parameter: EnvParam.Water, metric: 'TSS discharge', unit: 'mg/L', value: 88, threshold: 100, status: EnvStatus.Normal, updatedAt: '2026-10-01T10:00:00+05:30', demo: true },
  { id: 'ENV-09', mineId: 'M-10', parameter: EnvParam.Dust, metric: 'PM2.5', unit: 'µg/m³', value: 55, threshold: 60, status: EnvStatus.Normal, updatedAt: '2026-10-01T09:00:00+05:30', demo: true },
  { id: 'ENV-10', mineId: 'M-12', parameter: EnvParam.Gases, metric: 'CO', unit: 'ppm', value: 18, threshold: 25, status: EnvStatus.Normal, updatedAt: '2026-09-30T16:00:00+05:30', demo: true },
  { id: 'ENV-11', mineId: 'M-07', parameter: EnvParam.Water, metric: 'pH runoff', unit: 'pH', value: 6.1, threshold: 6.5, status: EnvStatus.Warning, updatedAt: '2026-09-30T11:00:00+05:30', demo: true },
  { id: 'ENV-12', mineId: 'M-04', parameter: EnvParam.Water, metric: 'TSS discharge', unit: 'mg/L', value: 96, threshold: 100, status: EnvStatus.Normal, updatedAt: '2026-09-29T10:00:00+05:30', demo: true },
];

export const sensorAlerts: SensorAlert[] = [
  { id: 'ALT-2026-011', mineId: 'M-01', parameter: 'PM2.5 dust', reading: '182 µg/m³', threshold: '100 µg/m³', severity: Severity.Critical, timestamp: '2026-10-03T10:24:00+05:30', status: AlertStatus.Open, demo: true },
  { id: 'ALT-2026-010', mineId: 'M-02', parameter: 'Methane CH4', reading: '2.4%', threshold: '1.0%', severity: Severity.Critical, timestamp: '2026-10-03T09:18:00+05:30', status: AlertStatus.Open, demo: true },
  { id: 'ALT-2026-009', mineId: 'M-04', parameter: 'Carbon monoxide', reading: '35 ppm', threshold: '25 ppm', severity: Severity.High, timestamp: '2026-10-03T08:46:00+05:30', status: AlertStatus.Acknowledged, demo: true },
  { id: 'ALT-2026-008', mineId: 'M-03', parameter: 'PM10 dust', reading: '168 µg/m³', threshold: '100 µg/m³', severity: Severity.High, timestamp: '2026-10-02T08:15:00+05:30', status: AlertStatus.Acknowledged, demo: true },
  { id: 'ALT-2026-007', mineId: 'M-05', parameter: 'Pit temperature', reading: '41°C', threshold: '40°C', severity: Severity.Medium, timestamp: '2026-10-02T14:00:00+05:30', status: AlertStatus.Open, demo: true },
  { id: 'ALT-2026-006', mineId: 'M-07', parameter: 'Runoff pH', reading: '6.1', threshold: '6.5 – 8.5', severity: Severity.Medium, timestamp: '2026-09-30T11:00:00+05:30', status: AlertStatus.Acknowledged, demo: true },
  { id: 'ALT-2026-005', mineId: 'M-06', parameter: 'Vibration (blast)', reading: '8.2 mm/s', threshold: '5.0 mm/s', severity: Severity.High, timestamp: '2026-09-28T13:20:00+05:30', status: AlertStatus.Resolved, demo: true },
];

export const production: ProductionRecord[] = (() => {
  const rows: ProductionRecord[] = [];
  const months = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
  const base: Record<string, number> = { 'M-01': 0.42, 'M-02': 0.68, 'M-03': 0.51, 'M-04': 0.49, 'M-05': 0.36, 'M-06': 0.28, 'M-07': 0.22, 'M-08': 0.19, 'M-09': 0.25, 'M-10': 0.31, 'M-11': 0.0, 'M-12': 0.27 };
  months.forEach((m, i) => {
    mines.forEach((mine) => {
      const b = base[mine.id] ?? 0.2;
      const prod = +(b * (0.9 + ((i * 7 + mine.id.length) % 5) * 0.05)).toFixed(2);
      rows.push({ id: `PRD-${m}-${mine.id}`, mineId: mine.id, month: m, productionMt: mine.status === MineStatus.Inactive ? 0 : prod, dispatchMt: mine.status === MineStatus.Inactive ? 0 : +(prod * 0.92).toFixed(2) });
    });
  });
  return rows;
})();

export const dispatches: DispatchRecord[] = [
  { id: 'DSP-2026-301', mineId: 'M-01', datetime: '2026-10-03T14:20:00+05:30', vehicle: 'JH-10-AB-4521', destination: 'NTPC Dadri', quantityMt: 0.042, status: DispatchStatus.Delivered, weighbridgeId: 'WB-BCM-01' },
  { id: 'DSP-2026-300', mineId: 'M-02', datetime: '2026-10-03T11:05:00+05:30', vehicle: 'CG-12-CD-8890', destination: 'Korba Thermal', quantityMt: 0.038, status: DispatchStatus.InTransit, weighbridgeId: 'WB-GVM-02' },
  { id: 'DSP-2026-299', mineId: 'M-03', datetime: '2026-10-02T16:44:00+05:30', vehicle: 'OD-19-EF-1123', destination: 'Nalco Angul', quantityMt: 0.035, status: DispatchStatus.Delivered, weighbridgeId: 'WB-TLM-01' },
  { id: 'DSP-2026-298', mineId: 'M-04', datetime: '2026-10-02T09:30:00+05:30', vehicle: 'CG-12-GH-3345', destination: 'Korba Thermal', quantityMt: 0.041, status: DispatchStatus.Delivered, weighbridgeId: 'WB-KSM-01' },
  { id: 'DSP-2026-297', mineId: 'M-06', datetime: '2026-10-01T18:12:00+05:30', vehicle: 'CG-13-JK-7788', destination: 'Raigarh Sponge', quantityMt: 0.029, status: DispatchStatus.Delayed, anomaly: 'Quantity 18% below challan; weighbridge re-check requested.', weighbridgeId: 'WB-MDR-01' },
  { id: 'DSP-2026-296', mineId: 'M-05', datetime: '2026-10-01T10:02:00+05:30', vehicle: 'OD-23-LM-9901', destination: 'Ib Thermal', quantityMt: 0.033, status: DispatchStatus.Delivered, weighbridgeId: 'WB-IBV-01' },
  { id: 'DSP-2026-295', mineId: 'M-07', datetime: '2026-09-30T15:40:00+05:30', vehicle: 'JH-02-NP-5567', destination: 'Tenughat TPS', quantityMt: 0.022, status: DispatchStatus.Delivered, weighbridgeId: 'WB-NKM-01' },
  { id: 'DSP-2026-294', mineId: 'M-12', datetime: '2026-09-29T12:25:00+05:30', vehicle: 'JH-09-QR-1234', destination: 'Bokaro Steel', quantityMt: 0.027, status: DispatchStatus.InTransit, weighbridgeId: 'WB-KRP-01' },
  { id: 'DSP-2026-293', mineId: 'M-09', datetime: '2026-09-28T08:15:00+05:30', vehicle: 'MP-17-ST-8832', destination: 'Vindhyachal STPS', quantityMt: 0.025, status: DispatchStatus.Delivered, weighbridgeId: 'WB-LKM-01' },
  { id: 'DSP-2026-292', mineId: 'M-10', datetime: '2026-09-27T17:50:00+05:30', vehicle: 'MP-66-UV-4410', destination: 'Rihand STPS', quantityMt: 0.031, status: DispatchStatus.Delivered, weighbridgeId: 'WB-SGM-01' },
  { id: 'DSP-2026-291', mineId: 'M-08', datetime: '2026-09-26T09:05:00+05:30', vehicle: 'MP-18-WX-2098', destination: 'Sanjay Gandhi TPS', quantityMt: 0.019, status: DispatchStatus.Cancelled, anomaly: 'Cancelled: rake placement changed by railway.', weighbridgeId: 'WB-SHP-01' },
  { id: 'DSP-2026-290', mineId: 'M-01', datetime: '2026-09-25T13:33:00+05:30', vehicle: 'JH-10-YZ-6734', destination: 'NTPC Dadri', quantityMt: 0.044, status: DispatchStatus.Delivered, anomaly: 'Overload flag cleared after re-weigh.', weighbridgeId: 'WB-BCM-01' },
];

export const stockpiles: Stockpile[] = [
  { id: 'STK-01', mineId: 'M-01', type: 'Run-of-mine coal', quantityMt: 0.82, limitMt: 1.0, status: StockpileStatus.NearLimit, updatedAt: '2026-10-03' },
  { id: 'STK-02', mineId: 'M-02', type: 'Run-of-mine coal', quantityMt: 1.24, limitMt: 1.0, status: StockpileStatus.OverLimit, updatedAt: '2026-10-02' },
  { id: 'STK-03', mineId: 'M-03', type: 'Washed coal', quantityMt: 0.44, limitMt: 0.8, status: StockpileStatus.WithinLimit, updatedAt: '2026-10-01' },
  { id: 'STK-04', mineId: 'M-04', type: 'Run-of-mine coal', quantityMt: 0.61, limitMt: 0.9, status: StockpileStatus.WithinLimit, updatedAt: '2026-09-30' },
  { id: 'STK-05', mineId: 'M-05', type: 'Run-of-mine coal', quantityMt: 0.0, limitMt: 0.6, status: StockpileStatus.NoRecentData, updatedAt: '2026-09-10' },
  { id: 'STK-06', mineId: 'M-06', type: 'Run-of-mine coal', quantityMt: 0.55, limitMt: 0.6, status: StockpileStatus.NearLimit, updatedAt: '2026-09-28' },
  { id: 'STK-07', mineId: 'M-07', type: 'Run-of-mine coal', quantityMt: 0.31, limitMt: 0.5, status: StockpileStatus.WithinLimit, updatedAt: '2026-09-26' },
  { id: 'STK-08', mineId: 'M-10', type: 'Run-of-mine coal', quantityMt: 0.48, limitMt: 0.7, status: StockpileStatus.WithinLimit, updatedAt: '2026-09-27' },
];

export const contractors: Contractor[] = [
  { id: 'CTR-01', company: 'Shakti Infra', regNo: 'CTR/JH/2021/014', status: ContractorStatus.Active, mines: ['M-01', 'M-07'], contactName: 'A. Verma', contactPhone: '+91-90000-20001' },
  { id: 'CTR-02', company: 'ABC Mining', regNo: 'CTR/CG/2020/088', status: ContractorStatus.Active, mines: ['M-02', 'M-04'], contactName: 'B. Rao', contactPhone: '+91-90000-20002' },
  { id: 'CTR-03', company: 'MCL Services', regNo: 'CTR/OD/2022/031', status: ContractorStatus.Active, mines: ['M-03', 'M-05'], contactName: 'C. Sahoo', contactPhone: '+91-90000-20003' },
  { id: 'CTR-04', company: 'Vindhya Earthmovers', regNo: 'CTR/MP/2019/112', status: ContractorStatus.Pending, mines: ['M-09'], contactName: 'D. Patel', contactPhone: '+91-90000-20004' },
  { id: 'CTR-05', company: 'Raigarh Transport Co.', regNo: 'CTR/CG/2023/007', status: ContractorStatus.Active, mines: ['M-06'], contactName: 'E. Agrawal', contactPhone: '+91-90000-20005' },
  { id: 'CTR-06', company: 'Karanpura Drilling', regNo: 'CTR/JH/2018/054', status: ContractorStatus.Suspended, mines: ['M-12'], contactName: 'F. Khan', contactPhone: '+91-90000-20006' },
];

const WKR = (
  id: string, name: string, contractorId: string, mineId: string, state: string, designation: string,
  status: WorkerStatus, n: number, medicalValid: boolean, trainingValid: boolean, authValid: boolean, idValid: boolean,
): Worker => ({
  id, name, contractorId, mineId, state, designation, status,
  idMasked: `XXXX-XXXX-${1000 + n}`, medicalValid, trainingValid, authValid, idValid,
  joinedOn: `2024-${String((n % 12) + 1).padStart(2, '0')}-15`,
});

export const workers: Worker[] = [
  WKR('W-1001', 'Ramesh Yadav', 'CTR-01', 'M-01', 'Jharkhand', 'Dumper Operator', WorkerStatus.Active, 1, true, true, true, true),
  WKR('W-1002', 'Suresh Kumar', 'CTR-01', 'M-01', 'Jharkhand', 'Safety Supervisor', WorkerStatus.Active, 2, true, true, true, true),
  WKR('W-1003', 'Amit Singh', 'CTR-02', 'M-02', 'Chhattisgarh', 'Electrician', WorkerStatus.Active, 3, true, false, true, true),
  WKR('W-1004', 'Salim Ansari', 'CTR-02', 'M-04', 'Chhattisgarh', 'Drilling Operator', WorkerStatus.OnLeave, 4, true, true, true, true),
  WKR('W-1005', 'Vikash Tiwari', 'CTR-03', 'M-03', 'Odisha', 'Heavy Vehicle Driver', WorkerStatus.Active, 5, false, true, true, true),
  WKR('W-1006', 'Pawan Kumar', 'CTR-03', 'M-05', 'Odisha', 'Helper', WorkerStatus.Active, 6, true, true, false, true),
  WKR('W-1007', 'Neeraj Shaw', 'CTR-01', 'M-07', 'Jharkhand', 'Welder', WorkerStatus.Active, 7, true, true, true, false),
  WKR('W-1008', 'Imran Ali', 'CTR-05', 'M-06', 'Chhattisgarh', 'Fitter', WorkerStatus.Active, 8, true, true, true, true),
  WKR('W-1009', 'Dinesh Mahto', 'CTR-04', 'M-09', 'Madhya Pradesh', 'Dozer Operator', WorkerStatus.Active, 9, true, false, true, true),
  WKR('W-1010', 'Sunil Dhanwar', 'CTR-04', 'M-10', 'Madhya Pradesh', 'Helper', WorkerStatus.OnLeave, 10, true, true, true, true),
  WKR('W-1011', 'Manoj Tirkey', 'CTR-06', 'M-12', 'Jharkhand', 'Blaster', WorkerStatus.Inactive, 11, false, false, true, true),
  WKR('W-1012', 'Geeta Devi', 'CTR-01', 'M-01', 'Jharkhand', 'First-Aid Attendant', WorkerStatus.Active, 12, true, true, true, true),
  WKR('W-1013', 'Ravi Shankar', 'CTR-02', 'M-02', 'Chhattisgarh', 'Conveyor Operator', WorkerStatus.Active, 13, true, true, true, true),
  WKR('W-1014', 'Santosh Sahu', 'CTR-03', 'M-03', 'Odisha', 'Survey Helper', WorkerStatus.Active, 14, true, true, true, false),
  WKR('W-1015', 'Prakash Rout', 'CTR-05', 'M-06', 'Chhattisgarh', 'Driver', WorkerStatus.Active, 15, true, false, true, true),
  WKR('W-1016', 'Anil Kol', 'CTR-04', 'M-08', 'Madhya Pradesh', 'Timberman', WorkerStatus.Active, 16, true, true, true, true),
];

export const workerDocs: WorkerDocument[] = [
  { id: 'DOC-01', workerId: 'W-1003', type: 'Safety Training Certificate', status: DocumentStatus.Expired, validTill: '2026-09-15' },
  { id: 'DOC-02', workerId: 'W-1005', type: 'Medical Fitness Certificate', status: DocumentStatus.Expired, validTill: '2026-09-20' },
  { id: 'DOC-03', workerId: 'W-1006', type: 'Work Authorization', status: DocumentStatus.Pending, validTill: '2026-10-20' },
  { id: 'DOC-04', workerId: 'W-1007', type: 'Identity Verification', status: DocumentStatus.ExpiringSoon, validTill: '2026-10-25' },
  { id: 'DOC-05', workerId: 'W-1009', type: 'Safety Training Certificate', status: DocumentStatus.ExpiringSoon, validTill: '2026-10-18' },
  { id: 'DOC-06', workerId: 'W-1011', type: 'Medical Fitness Certificate', status: DocumentStatus.Expired, validTill: '2026-07-30' },
  { id: 'DOC-07', workerId: 'W-1014', type: 'Identity Verification', status: DocumentStatus.Pending, validTill: '2026-11-02' },
  { id: 'DOC-08', workerId: 'W-1015', type: 'Safety Training Certificate', status: DocumentStatus.ExpiringSoon, validTill: '2026-10-22' },
];

export const notifications: Notification[] = [
  { id: 'NOT-001', datetime: '2026-10-03T10:24:00+05:30', category: NotificationCategory.Safety, priority: Priority.Critical, title: 'High dust level detected', description: 'PM2.5: 182 µg/m³ (threshold 100) at Bharat Coal Mine.', mineId: 'M-01', state: 'Jharkhand', status: NotificationStatus.Unread, relatedKind: 'finding', relatedId: 'FND-2026-482', evidence: 'CCTV still: Loading Point L3, 10:24 AM.', recommendation: 'Enforce PPE zone barricading before loading resumes.' },
  { id: 'NOT-002', datetime: '2026-10-03T09:18:00+05:30', category: NotificationCategory.Environmental, priority: Priority.Critical, title: 'Methane level above threshold', description: 'CH4: 2.4% (limit 1.0%) at GeVra Mine Panel 2.', mineId: 'M-02', state: 'Chhattisgarh', status: NotificationStatus.Unread, relatedKind: 'finding', relatedId: 'FND-2026-481', recommendation: 'Withdraw men and increase ventilation.' },
  { id: 'NOT-003', datetime: '2026-10-03T08:46:00+05:30', category: NotificationCategory.Environmental, priority: Priority.High, title: 'CO level rising', description: 'CO: 35 ppm (limit 25 ppm) at Kusmunda Mine.', mineId: 'M-04', state: 'Chhattisgarh', status: NotificationStatus.Unread, relatedKind: 'alert', relatedId: 'ALT-2026-009' },
  { id: 'NOT-004', datetime: '2026-10-02T18:31:00+05:30', category: NotificationCategory.Inspection, priority: Priority.Medium, title: 'Inspection report submitted', description: 'Talcher Mine routine report awaiting DGMS review.', mineId: 'M-03', state: 'Odisha', status: NotificationStatus.Read, relatedKind: 'inspection', relatedId: 'INS-2026-212' },
  { id: 'NOT-005', datetime: '2026-10-02T16:12:00+05:30', category: NotificationCategory.Compliance, priority: Priority.High, title: 'Contractor document expiring', description: '5 workers’ medical fitness certificates expire within 20 days (IB Valley).', mineId: 'M-05', state: 'Odisha', status: NotificationStatus.Unread, relatedKind: 'worker', relatedId: 'W-1006' },
  { id: 'NOT-006', datetime: '2026-10-02T14:14:00+05:30', category: NotificationCategory.Safety, priority: Priority.High, title: 'PPE non-compliance detected', description: '3 workers without helmets at Mand-Raigarh pit.', mineId: 'M-06', state: 'Chhattisgarh', status: NotificationStatus.Acknowledged, relatedKind: 'finding', relatedId: 'FND-2026-468' },
  { id: 'NOT-007', datetime: '2026-10-01T11:28:00+05:30', category: NotificationCategory.System, priority: Priority.Medium, title: 'Monthly production data pending', description: 'September 2026 production not yet filed by 2 mines.', status: NotificationStatus.Read },
  { id: 'NOT-008', datetime: '2026-10-01T10:52:00+05:30', category: NotificationCategory.Compliance, priority: Priority.High, title: 'Overdue corrective action', description: 'CA-2026-106 past due date (Blast guard roster, Mand-Raigarh).', mineId: 'M-06', state: 'Chhattisgarh', status: NotificationStatus.Unread, relatedKind: 'finding', relatedId: 'FND-2026-468' },
  { id: 'NOT-009', datetime: '2026-09-30T17:14:00+05:30', category: NotificationCategory.Inspection, priority: Priority.Medium, title: 'Inspection scheduled', description: 'DGMS team visit to Lakhanpur Mine on 05 Oct 2026.', mineId: 'M-09', state: 'Madhya Pradesh', status: NotificationStatus.Read, relatedKind: 'inspection', relatedId: 'INS-2026-209' },
  { id: 'NOT-010', datetime: '2026-09-30T15:09:00+05:30', category: NotificationCategory.System, priority: Priority.Low, title: 'New regulation update', description: 'DGMS Circular No. 12/2026 on strata control published.', status: NotificationStatus.Read },
  { id: 'NOT-011', datetime: '2026-09-29T09:40:00+05:30', category: NotificationCategory.Compliance, priority: Priority.Medium, title: 'Weighbridge certificate expiring', description: 'SGM-01 calibration certificate expires in 20 days.', mineId: 'M-10', state: 'Madhya Pradesh', status: NotificationStatus.Resolved, relatedKind: 'finding', relatedId: 'FND-2026-470' },
  { id: 'NOT-012', datetime: '2026-09-28T12:00:00+05:30', category: NotificationCategory.Safety, priority: Priority.Medium, title: 'Vehicle incident closed', description: 'BCM-03 dumper incident inquiry completed.', mineId: 'M-01', state: 'Jharkhand', status: NotificationStatus.Resolved },
];

export const dgmsUsers: DgmsUser[] = [
  { id: 'USR-01', name: 'Amit Verma', email: 'amit.verma@demo.dgms.in', role: UserRole.MainAdministrator, status: 'Active', lastLogin: '2026-10-03T09:02:00+05:30' },
  { id: 'USR-02', name: 'R. Singh', email: 'r.singh@demo.dgms.in', role: UserRole.Inspector, status: 'Active', lastLogin: '2026-10-02T16:48:00+05:30' },
  { id: 'USR-03', name: 'P. Kumar', email: 'p.kumar@demo.dgms.in', role: UserRole.Inspector, status: 'Active', lastLogin: '2026-10-02T11:20:00+05:30' },
  { id: 'USR-04', name: 'S. Sharma', email: 's.sharma@demo.dgms.in', role: UserRole.MineOperator, status: 'Active', lastLogin: '2026-10-01T15:33:00+05:30' },
  { id: 'USR-05', name: 'M. Das', email: 'm.das@demo.dgms.in', role: UserRole.Contractor, status: 'Inactive', lastLogin: '2026-09-25T10:11:00+05:30' },
  { id: 'USR-06', name: 'K. Yadav', email: 'k.yadav@demo.dgms.in', role: UserRole.Inspector, status: 'Active', lastLogin: '2026-10-03T08:15:00+05:30' },
];

export const rolePermissions: RolePermissions[] = [
  { role: UserRole.MainAdministrator, perms: { view: true, create: true, edit: true, delete: false, approve: true, export: true } },
  { role: UserRole.Inspector, perms: { view: true, create: true, edit: true, delete: false, approve: false, export: true } },
  { role: UserRole.MineOperator, perms: { view: true, create: true, edit: true, delete: false, approve: false, export: true } },
  { role: UserRole.Contractor, perms: { view: true, create: true, edit: false, delete: false, approve: false, export: false } },
];

/** Worker compliance rollups must be derived from `workers`, never hardcoded. */
export function workerComplianceOf(w: Worker): WorkerCompliance {
  if (!w.medicalValid || !w.trainingValid || !w.authValid || !w.idValid) {
    const missing = [w.medicalValid, w.trainingValid, w.authValid, w.idValid].filter(Boolean).length;
    return missing >= 3 ? WorkerCompliance.Partial : WorkerCompliance.NonCompliant;
  }
  return WorkerCompliance.Complete;
}

export function defaultSettings(): SystemSettings {
  return {
    orgName: 'Directorate General of Mines Safety (DGMS)',
    ministry: 'Ministry of Labour & Employment',
    address: 'Shastri Bhawan, New Delhi - 110001',
    email: 'dgms@demo.gov.in',
    phone: '011-2338 5527',
    website: 'https://dgms.demo.gov.in',
    landingPage: 'Dashboard',
    dateFormat: 'DD MMM YYYY',
    timeZone: '(GMT+05:30) India Standard Time',
    language: 'English',
    showMapByDefault: true,
    autoLogoutMinutes: 30,
    sessionTimeoutWarning: true,
    twoFactor: true,
    loginAttemptLimit: 5,
    lockout: true,
    ipRestriction: false,
    loginNotifications: true,
    notifPrefs: {
      'Critical Safety Alert (Gas, Fire, Collapse)': { channel: 'Immediate', email: true, inApp: true, sms: true },
      'Inspection Report Submitted': { channel: 'Daily Summary', email: true, inApp: true, sms: false },
      'Compliance Deadline Reminder': { channel: '3 Days Before', email: true, inApp: true, sms: false },
      'Contractor Document Expiry': { channel: '7 Days Before', email: true, inApp: true, sms: true },
      'System Updates': { channel: 'As Needed', email: true, inApp: true, sms: false },
      'User Login Alert (New Device)': { channel: 'Immediate', email: true, inApp: true, sms: true },
    },
    appVersion: 'v1.2.0-demo',
    environment: 'Demonstration',
    lastBackup: '2026-10-03T02:30:00+05:30',
  };
}

// Compliance derivation shared by dashboard + reports (single rule, one place).
export { ComplianceStatus };
export function complianceOfMine(mineId: string, fnds: Finding[]): ComplianceStatus {
  const open = fnds.filter((f) => f.mineId === mineId && f.status !== FindingStatus.Resolved);
  if (open.some((f) => f.severity === Severity.Critical)) return ComplianceStatus.NonCompliant;
  if (open.length > 0) return ComplianceStatus.PartiallyCompliant;
  return ComplianceStatus.Compliant;
}
