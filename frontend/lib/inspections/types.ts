/**
 * MineNetr Mine Inspector — "My Inspections" module domain model.
 *
 * All demonstration data is fictional, generated deterministically from the
 * shared demo clock (03 Oct 2026) and clearly labelled DEMO. Nothing here
 * implies a live DGMS submission or a real regulatory filing.
 *
 * Coherence rules enforced by lib/inspections/seed.ts + store.ts:
 *  - ONE inspection record drives its table row, its Inspection Details panel,
 *    its checklist progress, its evidence, its findings, its report, its
 *    schedule entry and every KPI count — no component holds its own copy,
 *  - "Overdue" is DERIVED from scheduledDate vs the injectable demo clock and
 *    the base status — it is never stored as a hand-typed label,
 *  - every child record (response / evidence / finding / report / note /
 *    document) references a real inspection (+ mine + item where relevant),
 *  - checklist progress is computed from responses only: an unanswered item is
 *    always "Not Checked" and a section can never read as complete while one
 *    of its mandatory items is still unanswered.
 *
 * Findings deliberately mirror lib/dgms/types.ts `Finding` field-for-field
 * (same id scheme FND-2026-001, same category/severity/source enums) so the
 * inspector portal and the DGMS Findings & Observations module stay compatible.
 */
import { FindingCategory, FindingSource, Severity } from '../dgms/types';

export { FindingCategory, FindingSource, Severity };

// Demo clock is owned by the contracts module so every portal agrees on "today".
export { DEMO_TODAY, DEMO_NOW_ISO } from '../contracts/types';

// ---------------------------------------------------------------------------
// Statuses / vocabularies
// ---------------------------------------------------------------------------

/** Stored base status. Overdue is NOT stored — it is derived (see effectiveStatus). */
export const INSPECTION_STATUSES = [
  'Upcoming', 'In Progress', 'Pending Submission', 'Completed', 'Cancelled',
] as const;
export type InspectionStatus = (typeof INSPECTION_STATUSES)[number];

/** Base status + the derived `Overdue` presentation value. */
export const EFFECTIVE_STATUSES = [
  'Upcoming', 'In Progress', 'Pending Submission', 'Completed', 'Overdue', 'Cancelled',
] as const;
export type EffectiveInspectionStatus = (typeof EFFECTIVE_STATUSES)[number];

export const INSPECTION_TYPES = [
  'Routine Safety Inspection',
  'Environmental Inspection',
  'Machinery Inspection',
  'Electrical Inspection',
  'Explosive & Dispatch Inspection',
  'Contractor Compliance Inspection',
  'Structural Safety Inspection',
] as const;
export type InspectionType = (typeof INSPECTION_TYPES)[number];

export const PRIORITIES = ['High', 'Normal', 'Low'] as const;
export type Priority = (typeof PRIORITIES)[number];

/** My Inspections tabs (page 2). */
export const INSPECTION_TABS = [
  'All Inspections', 'Upcoming', 'In Progress', 'Completed', 'Overdue',
] as const;
export type InspectionTab = (typeof INSPECTION_TABS)[number];

/** Four-step lifecycle on the individual inspection page (page 3). */
export const WORKFLOW_STEPS = [
  'Pre-Inspection', 'On-Site Verification', 'Evidence & Observations', 'Review & Submit',
] as const;
export type WorkflowStep = (typeof WORKFLOW_STEPS)[number];

/** Tabs inside the individual inspection page (page 3). */
export const DETAIL_TABS = [
  'Inspection Checklist', 'Site Details', 'Evidence & Observations',
  'Documents', 'Previous Reports', 'Notes',
] as const;
export type DetailTab = (typeof DETAIL_TABS)[number];

export const CHECKLIST_RESPONSES = [
  'Compliant', 'Non-Compliant', 'Not Applicable', 'Not Checked',
] as const;
export type ChecklistResponseValue = (typeof CHECKLIST_RESPONSES)[number];

export const EVIDENCE_TYPES = ['Photo', 'Document', 'Video Reference', 'Inspector Note'] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export const DOCUMENT_CATEGORIES = [
  'Safety SOP', 'Mine Layout', 'Previous Inspection Report', 'Equipment Checklist', 'Permit / Certificate',
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

/** Inspector-workflow lifecycle (maps to the backend finding state machine). */
export const FINDING_STATUSES = [
  'Open', 'Under Review', 'Corrective Action Required', 'Resolved',
] as const;
export type FindingStatusValue = (typeof FINDING_STATUSES)[number];

export const REPORT_STATUSES = ['Draft', 'Submitted', 'Under Review', 'Approved', 'Changes Requested'] as const;
export type ReportStatusValue = (typeof REPORT_STATUSES)[number];

export const WEATHER_OPTIONS = [
  'Clear', 'Partly Cloudy', 'Overcast', 'Light Rain', 'Heavy Rain', 'Dusty', 'Hazy',
] as const;
export type Weather = (typeof WEATHER_OPTIONS)[number];

export const SAFETY_CONDITIONS = ['Normal', 'Caution', 'Hazardous'] as const;
export type SafetyCondition = (typeof SAFETY_CONDITIONS)[number];

export const SITE_TYPES = ['Opencast Coal Mine', 'Workshop', 'Conveyor Corridor', 'Crushing & Dispatch'] as const;
export type SiteType = (typeof SITE_TYPES)[number];

export const REQUEST_KINDS = ['Reschedule', 'Reassign', 'Cancel'] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];

export const REQUEST_STATUSES = ['Pending Approval', 'Approved', 'Rejected'] as const;
export type RequestStatusValue = (typeof REQUEST_STATUSES)[number];

// ---------------------------------------------------------------------------
// Demo roles & permissions
// ---------------------------------------------------------------------------

export const INSPECTOR_ROLES = [
  'Mine Inspector', 'Senior Labour Officer', 'Mine Admin', 'Read-Only Viewer',
] as const;
export type InspectorDemoRole = (typeof INSPECTOR_ROLES)[number];

export interface InspectorPermissions {
  readOnly: boolean;
  canStart: boolean;
  canWorkChecklist: boolean;
  canSubmit: boolean;
  canEditDetails: boolean;
  canManageEvidence: boolean;
  canManageNotes: boolean;
  canCreateFinding: boolean;
  canAttachDocument: boolean;
  /** Restricted actions — allowed directly only for supervisory demo roles. */
  canCancel: boolean;
  canReschedule: boolean;
  canReassign: boolean;
  canApproveRequests: boolean;
  canBulkCancel: boolean;
}

/**
 * Client-side demo gating ONLY — this is not a security boundary. The future
 * FastAPI service must re-validate every one of these rules server-side.
 */
export function permissionsFor(role: InspectorDemoRole): InspectorPermissions {
  const supervisor = role === 'Senior Labour Officer' || role === 'Mine Admin';
  return {
    readOnly: role === 'Read-Only Viewer',
    canStart: role !== 'Read-Only Viewer',
    canWorkChecklist: role !== 'Read-Only Viewer',
    canSubmit: role !== 'Read-Only Viewer',
    canEditDetails: role !== 'Read-Only Viewer',
    canManageEvidence: role !== 'Read-Only Viewer',
    canManageNotes: role !== 'Read-Only Viewer',
    canCreateFinding: role !== 'Read-Only Viewer',
    canAttachDocument: role !== 'Read-Only Viewer',
    canCancel: supervisor,
    canReschedule: supervisor,
    canReassign: supervisor,
    canApproveRequests: supervisor,
    canBulkCancel: supervisor,
  };
}

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

/** 8 mine sites / operational locations shown in the mine selector. */
export interface MineSite {
  id: string;        // SITE-01
  code: string;      // BCM-01 — display primary
  name: string;      // Bharat Coal Mine
  area: string;      // Main Mining Area
  state: string;
  district: string;
  siteType: SiteType;
  lat: number;       // fictional demonstration coordinate — never a real mine
  lng: number;
  /** Sub-zones offered when scheduling an inspection at this site. */
  zones: string[];
}

export interface Inspector {
  id: string;        // INSP-01
  name: string;
  designation: string;
  state: string;
  email: string;
}

// ---------------------------------------------------------------------------
// Checklists
// ---------------------------------------------------------------------------

export interface ChecklistItemDef {
  id: string;            // CHK-001 … CHK-150 (stable, module-wide)
  templateId: string;    // TMPL-01
  section: string;
  requirement: string;
  description: string;
  /** Must be answered before the inspection can be submitted. */
  mandatory: boolean;
  /** Answering this item with Non-Compliant/Compliant needs an evidence link. */
  evidenceRequired: boolean;
}

export interface ChecklistTemplate {
  id: string;            // TMPL-01
  name: string;
  category: string;      // Checklists & Forms page grouping
  description: string;
  version: string;
  sectionNames: string[];
  itemCount: number;
  /** How many inspections currently instantiate this template. */
  usageCount?: number;
}

/** One checklist line: the definition merged with the stored response. */
export interface ChecklistRow {
  item: ChecklistItemDef;
  response: ChecklistResponseValue;
  remarks: string;
  evidenceIds: string[];
  updatedAt: string | null;
}

export interface ChecklistSectionView {
  name: string;
  index: number;
  rows: ChecklistRow[];
  total: number;
  completed: number;      // answered (anything except Not Checked)
  compliant: number;
  nonCompliant: number;
  notApplicable: number;
  notChecked: number;
  flagged: number;        // nonCompliant
  mandatoryRemaining: number;
  complete: boolean;
}

export interface ChecklistProgressLite {
  totalItems: number;
  completed: number;
  pending: number;
  flagged: number;
  percent: number;
}

export interface ChecklistProgress extends ChecklistProgressLite {
  compliant: number;
  nonCompliant: number;
  notApplicable: number;
  mandatoryRemaining: number;
  sections: ChecklistSectionView[];
}

// ---------------------------------------------------------------------------
// Inspections
// ---------------------------------------------------------------------------

export interface SiteDetails {
  weather: Weather | '';
  safetyConditions: SafetyCondition | '';
  locationDescription: string;
  inspectionDate: string;   // yyyy-mm-dd (defaults to scheduledDate)
  startTime: string;        // HH:MM
  endTime: string;          // HH:MM
  inspectorId: string;
  crewStrength: number | null;
  generalRemarks: string;
  /** Site Details tab is only considered complete once every required field is filled. */
  completedAt?: string | null;
}

export interface Inspection {
  id: string;                     // INS-2026-001
  title: string;
  mineId: string;                 // SITE-03
  location: string;               // East Pit – Level 2
  type: InspectionType;
  priority: Priority;
  status: InspectionStatus;       // base — Overdue is derived
  scheduledDate: string;          // yyyy-mm-dd
  startTime: string;              // HH:MM
  endTime: string;                // HH:MM
  durationMins: number;
  assignedTo: string;             // inspector id (performer)
  assignedBy: string;             // inspector id (supervisor who assigned)
  objective: string;
  templateId: string;
  workflowStep: number;           // 0..3 — index into WORKFLOW_STEPS
  requiredEvidenceCount: number;
  createdAt: string;              // ISO
  startedAt?: string | null;
  lastSavedAt?: string | null;
  submittedAt?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  reportId?: string | null;
  siteDetails: SiteDetails;
}

export interface ChecklistResponse {
  id: string;                 // RESP-0001
  inspectionId: string;
  itemId: string;             // CHK-001
  section: string;
  response: ChecklistResponseValue;
  remarks: string;
  evidenceIds: string[];
  updatedAt: string;
  updatedBy: string;          // inspector id
}

export interface Evidence {
  id: string;                 // EVD-001
  inspectionId: string;
  itemId?: string | null;     // linked checklist item, if any
  type: EvidenceType;
  title: string;
  description: string;
  capturedAt: string;          // ISO
  location: string;
  fileRef: string;            // demo asset path or DEMO-FILE:// reference
  fileName: string;
  sizeKb: number;
  uploadedBy: string;          // inspector id
}

/** Mirrors lib/dgms `Finding` field-for-field; `status` uses this workflow's lifecycle. */
export interface InspectionFinding {
  id: string;                 // FND-2026-001
  mineId: string;
  inspectionId: string;
  inspectorId: string;
  category: FindingCategory;
  severity: Severity;
  status: FindingStatusValue;
  source: FindingSource;
  location: string;
  description: string;
  recommendation: string;
  assignee: string;
  detectedAt: string;         // ISO
  dueDate: string;            // yyyy-mm-dd
  evidence: string[];         // evidence ids
  itemId?: string | null;     // originating checklist item
  verifiedHuman: boolean;
}

export interface InspectionReport {
  id: string;                 // RPT-001
  inspectionId: string;
  mineId: string;
  type: InspectionType;
  title: string;
  status: ReportStatusValue;
  version: number;
  inspectorId: string;
  submittedAt: string;
  reviewedAt?: string | null;
  summary: string;
  counts: {
    compliant: number; nonCompliant: number; notApplicable: number;
    notChecked: number; evidence: number; findings: number;
  };
}

export interface InspectionNote {
  id: string;                 // NOTE-001
  inspectionId: string;
  body: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  draft: boolean;
}

export interface InspectionDocument {
  id: string;                 // DOC-001
  inspectionId: string;
  title: string;
  category: DocumentCategory;
  fileRef: string;
  fileName: string;
  sizeKb: number;
  updatedAt: string;
  owner: string;              // inspector id
  sample: true;               // synthetic sample file — never a real record
}

export interface RescheduleRequest {
  id: string;                 // REQ-001
  inspectionId: string;
  kind: RequestKind;
  requestedBy: string;        // inspector id
  fromDate: string;
  toDate?: string;
  toInspector?: string;
  reason: string;
  status: RequestStatusValue;
  decidedBy?: string | null;
  decidedAt?: string | null;
  decisionNote?: string | null;
  createdAt: string;
}

export interface InspectionActivity {
  id: string;                 // IACT-001
  inspectionId: string;
  at: string;                 // ISO
  by: string;                 // display name
  action: string;
  detail: string;
}

// ---------------------------------------------------------------------------
// Derived views
// ---------------------------------------------------------------------------

export interface InspectionRow {
  inspection: Inspection;
  effectiveStatus: EffectiveInspectionStatus;
  overdue: boolean;
  site: MineSite;
  assignedToName: string;
  assignedByName: string;
  progress: ChecklistProgressLite;
  evidenceCount: number;
  findingCount: number;
  openFindingCount: number;
}

export interface ScheduleEntry {
  date: string;               // yyyy-mm-dd
  inspection: Inspection;
  effectiveStatus: EffectiveInspectionStatus;
  site: MineSite;
  inspectorName: string;
}

export interface InspectionKpis {
  totalAssigned: number;
  completed: number;
  pending: number;
  overdue: number;
  inProgress: number;
  cancelled: number;
  scheduledThisMonth: number;
  completedThisMonth: number;
  completedLastMonth: number;
  dueThisWeek: number;
  completionRate: number;
  openFindings: number;
}

/** Previous-report comparison row (Compare with Previous Inspection). */
export interface ReportComparisonRow {
  requirement: string;
  previous: string;           // response on the last completed report for mine+type
  current: ChecklistResponseValue;
  change: 'Improved' | 'Declined' | 'Unchanged' | 'New Check' | 'Not Compared';
}

// ---------------------------------------------------------------------------
// Filters / inputs
// ---------------------------------------------------------------------------

export type InspectionSortKey = 'date' | 'mine' | 'type' | 'priority' | 'status' | 'inspector' | 'id';
export type SortDir = 'asc' | 'desc';

export interface InspectionFilters {
  q: string;
  tab: InspectionTab;
  mineId: string;        // 'ALL' | SITE-xx
  type: string;          // 'ALL' | InspectionType
  priority: string;      // 'ALL' | Priority
  status: string;        // 'ALL' | EffectiveInspectionStatus
  dateFrom: string;      // '' | yyyy-mm-dd
  dateTo: string;        // '' | yyyy-mm-dd
  sort: InspectionSortKey;
  dir: SortDir;
  page: number;
  pageSize: number;
}

export const DEFAULT_FILTERS: InspectionFilters = {
  q: '', tab: 'All Inspections', mineId: 'ALL', type: 'ALL', priority: 'ALL',
  status: 'ALL', dateFrom: '', dateTo: '', sort: 'date', dir: 'asc', page: 1, pageSize: 8,
};

export interface CreateInspectionInput {
  id: string;
  mineId: string;
  location: string;
  type: InspectionType;
  priority: Priority;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  assignedTo: string;
  assignedBy: string;
  title: string;
  objective: string;
  templateId: string;
}

export interface UpdateInspectionInput {
  title?: string;
  objective?: string;
  priority?: Priority;
  location?: string;
}

export interface SaveChecklistInput {
  inspectionId: string;
  itemId: string;
  response: ChecklistResponseValue;
  remarks?: string;
  evidenceIds?: string[];
}

export interface CreateEvidenceInput {
  inspectionId: string;
  itemId?: string | null;
  type: EvidenceType;
  title: string;
  description: string;
  location?: string;
  fileRef?: string;
  fileName?: string;
  sizeKb?: number;
}

export interface CreateFindingInput {
  inspectionId: string;
  itemId?: string | null;
  category: FindingCategory;
  severity: Severity;
  description: string;
  recommendation: string;
  assignee: string;
  evidence?: string[];
}

export interface InspectionDraft {
  workflowStep?: number;
  siteDetails?: Partial<SiteDetails>;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Seed snapshot (built by seed.ts, consumed by store.ts)
// ---------------------------------------------------------------------------

export interface InspectionSeedSnapshot {
  sites: MineSite[];
  inspectors: Inspector[];
  templates: ChecklistTemplate[];
  items: ChecklistItemDef[];
  inspections: Inspection[];
  responses: ChecklistResponse[];
  evidence: Evidence[];
  findings: InspectionFinding[];
  reports: InspectionReport[];
  notes: InspectionNote[];
  documents: InspectionDocument[];
  requests: RescheduleRequest[];
  activity: InspectionActivity[];
}

export interface InspectionDbState {
  rev: number;                       // bumped on every mutation (cache key)
  role: InspectorDemoRole;
  selectedMineId: string;            // 'ALL' | SITE-xx
  sites: MineSite[];
  inspectors: Inspector[];
  templates: ChecklistTemplate[];
  items: ChecklistItemDef[];
  inspections: Inspection[];
  responses: ChecklistResponse[];
  evidence: Evidence[];
  findings: InspectionFinding[];
  reports: InspectionReport[];
  notes: InspectionNote[];
  documents: InspectionDocument[];
  requests: RescheduleRequest[];
  activity: InspectionActivity[];
  toasts: { id: number; text: string }[];
  seq: Record<string, number>;
}
