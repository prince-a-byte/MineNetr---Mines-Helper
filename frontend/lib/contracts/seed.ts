/**
 * Deterministic synthetic seed for the contractor "My Contracts" portal.
 * Values match the design reference (MineNetr Contractor Dashboard, page 2).
 * Every record is stable and relationally consistent — no per-render randomness.
 * All figures are fictional; contract values are stored in rupees and
 * formatted to Crore only at the presentation layer.
 */
import {
  ContractStatus, Currency, MilestoneStatus, RequestStatus,
  type ActivityEntry, type Contract, type ContractorIdentity, type ContractDocument,
  type ContractMilestone, type ContractNotification, type ContractRequest,
  type Mine, type RenewalRequest,
} from './types';

const CRORE = 10_000_000; // 1 Cr = 1,00,00,000

// ---------- Mines the demo contractor is authorised for ----------
export const mines: Mine[] = [
  { id: 'M-01', code: 'BCM-01', name: 'Bharat Coal Mine', state: 'Chhattisgarh', district: 'Korba' },
  { id: 'M-02', code: 'NBM-02', name: 'North Block Mine', state: 'Odisha', district: 'Angul' },
  { id: 'M-03', code: 'EFM-03', name: 'East Field Mine', state: 'Jharkhand', district: 'Dhanbad' },
];

// ---------- Authenticated demo contractor ----------
export const contractor: ContractorIdentity = {
  id: 'DEMO-CONT-001',
  name: 'Eastern Mining Services Pvt. Ltd.',
  user: 'Rakesh Kumar',
  role: 'Contractor',
  assignedMineIds: ['M-01', 'M-02', 'M-03'],
};

// ---------- Contracts ----------
// The first five records reproduce the design reference exactly. Four extra
// records populate the Upcoming and Terminated tabs (per spec §8) so no tab is
// an empty dead-end; KPIs and the value chart derive honestly from all records.
export const contracts: Contract[] = [
  {
    id: 'CT-BCM-001', contractorId: contractor.id, mineId: 'M-01',
    name: 'Overburden Removal', workType: 'Overburden Removal', category: 'Overburden Removal',
    description: 'Mechanical removal and side-cast of overburden across the North Pit overburden benches to expose the working coal seam.',
    scope: 'Removal of 4.2 million BCM of overburden using hydraulic shovels and dump trucks across designated OB benches. Includes dry-wall stacking, bench formation to 15 m height, haul-road upkeep and monthly progress certification. Excludes blasting and coal extraction.',
    startDate: '2025-01-01', endDate: '2026-12-31',
    contractValue: 12.5 * CRORE, currency: Currency.INR,
    progress: 70, status: ContractStatus.Active,
    workOrderNumber: 'WO-BCM-2024-118', renewalEligible: true, complianceStatus: 'Compliant',
    createdAt: '2024-12-18T09:30:00+05:30', updatedAt: '2026-09-28T16:10:00+05:30',
  },
  {
    id: 'CT-BCM-002', contractorId: contractor.id, mineId: 'M-01',
    name: 'Coal Transportation', workType: 'Coal Transportation', category: 'Coal Transportation',
    description: 'End-to-end surface haulage of washed and raw coal from the pit head to the railway siding and NTPC receiving point.',
    scope: 'Transportation of up to 900 MT/day of coal over a 62 km route using 10-tonne tipper trucks. Includes GPS-tracked dispatch, weighbridge reconciliation at origin and destination, en-route dust suppression and delivery challan generation. Fuel and driver costs borne by contractor.',
    startDate: '2025-02-15', endDate: '2027-02-14',
    contractValue: 8.2 * CRORE, currency: Currency.INR,
    progress: 45, status: ContractStatus.Active,
    workOrderNumber: 'WO-BCM-2025-007', renewalEligible: true, complianceStatus: 'Compliant',
    createdAt: '2025-02-01T11:00:00+05:30', updatedAt: '2026-09-30T12:45:00+05:30',
  },
  {
    id: 'CT-NBM-001', contractorId: contractor.id, mineId: 'M-02',
    name: 'Equipment Maintenance', workType: 'Equipment Maintenance', category: 'Equipment Maintenance',
    description: 'Scheduled preventive and corrective maintenance of the deployed heavy earth-moving machinery fleet.',
    scope: 'Annual maintenance contract covering 14 units of HEMM (dump trucks, dozers, graders, draglines). Includes 250-hour and 1000-hour scheduled servicing, hydraulics and transmission overhaul, on-site breakdown response within 4 hours and genuine spares supply. Workshop facility provided by mine.',
    startDate: '2025-03-01', endDate: '2026-02-28',
    contractValue: 4.75 * CRORE, currency: Currency.INR,
    progress: 60, status: ContractStatus.Active,
    workOrderNumber: 'WO-NBM-2025-021', renewalEligible: true, complianceStatus: 'Partially Compliant',
    createdAt: '2025-02-14T10:15:00+05:30', updatedAt: '2026-08-22T09:05:00+05:30',
  },
  {
    id: 'CT-EFM-003', contractorId: contractor.id, mineId: 'M-03',
    name: 'Site Services', workType: 'Site Services', category: 'Site Services',
    description: 'Integrated site support services including security, housekeeping, plantation and administrative facility management.',
    scope: 'Provision of 42 security personnel, 30 housekeeping staff, plantation and upkeep of 3.5 hectares of reclaimed land, canteen and office facility management. Includes PPE supply, periodic third-party audits and statutory labour compliance for all deployed manpower.',
    startDate: '2025-04-10', endDate: '2027-04-09',
    contractValue: 6.3 * CRORE, currency: Currency.INR,
    progress: 85, status: ContractStatus.ExpiringSoon,
    workOrderNumber: 'WO-EFM-2025-044', renewalEligible: true, complianceStatus: 'Compliant',
    createdAt: '2025-03-28T14:20:00+05:30', updatedAt: '2026-09-15T18:30:00+05:30',
  },
  {
    id: 'CT-NBM-004', contractorId: contractor.id, mineId: 'M-02',
    name: 'Exploration Support', workType: 'Exploration Support', category: 'Exploration Support',
    description: 'Drilling, sampling and geological data acquisition support for exploration of the eastern block reserves.',
    scope: 'Core and rotary drilling of 6,800 metres across 96 exploration sites, sample collection, lab coordination and preparation of digital borehole logs as per DGMS and GSI guidelines. All cores archived and handed over on completion.',
    startDate: '2024-06-01', endDate: '2025-05-31',
    contractValue: 3.1 * CRORE, currency: Currency.INR,
    progress: 100, status: ContractStatus.Completed,
    workOrderNumber: 'WO-NBM-2024-063', renewalEligible: false, complianceStatus: 'Compliant',
    createdAt: '2024-05-20T08:45:00+05:30', updatedAt: '2025-05-31T17:00:00+05:30',
  },

  // ---- Additional records so Upcoming / Terminated tabs are populated ----
  {
    id: 'CT-BCM-005', contractorId: contractor.id, mineId: 'M-01',
    name: 'Coal Washery Maintenance', workType: 'Coal Washery Maintenance', category: 'Equipment Maintenance',
    description: 'Turnkey maintenance of the 5 MTPA dense-medium cyclone washery and its associated conveyor systems.',
    scope: 'Preventive and corrective maintenance of washery circuits, screen panels, cyclones, centrifuges and 2.4 km of belt conveyor. Includes 24×7 breakdown support, spares inventory management and water-circuit upkeep. Commissioning scheduled post-monsoon.',
    startDate: '2026-11-15', endDate: '2027-11-14',
    contractValue: 4.6 * CRORE, currency: Currency.INR,
    progress: 0, status: ContractStatus.Upcoming,
    workOrderNumber: 'WO-BCM-2026-142', renewalEligible: false, complianceStatus: 'Compliant',
    createdAt: '2026-09-12T10:00:00+05:30', updatedAt: '2026-09-20T11:30:00+05:30',
  },
  {
    id: 'CT-EFM-005', contractorId: contractor.id, mineId: 'M-03',
    name: 'Security & Surveillance', workType: 'Security & Surveillance', category: 'Site Services',
    description: 'Perimeter security, CCTV monitoring and access-control management across the East Field operational area.',
    scope: 'Deployment of 28 security personnel across 6 gates, operation of a 48-camera CCTV control room, biometric access-control maintenance and night patrolling of the reclaimed dump boundary. Monthly incident reporting to mine safety office.',
    startDate: '2026-12-01', endDate: '2027-11-30',
    contractValue: 2.2 * CRORE, currency: Currency.INR,
    progress: 0, status: ContractStatus.Upcoming,
    workOrderNumber: 'WO-EFM-2026-088', renewalEligible: false, complianceStatus: 'Compliant',
    createdAt: '2026-09-25T13:40:00+05:30', updatedAt: '2026-09-25T13:40:00+05:30',
  },
  {
    id: 'CT-NBM-005', contractorId: contractor.id, mineId: 'M-02',
    name: 'Drill & Blast Support', workType: 'Drill & Blast Support', category: 'Overburden Removal',
    description: 'Drilling and blasting support for overburden detachment in the western push. Terminated mid-term.',
    scope: 'Blast-hole drilling, explosive handling, stemming and post-blast clearance for OB detachment. Terminated by mutual consent following a revision of the western push sequence; demobilisation and site handover completed.',
    startDate: '2025-01-15', endDate: '2026-06-30',
    contractValue: 3.75 * CRORE, currency: Currency.INR,
    progress: 55, status: ContractStatus.Terminated,
    workOrderNumber: 'WO-NBM-2025-009', renewalEligible: false, complianceStatus: 'Partially Compliant',
    createdAt: '2025-01-05T09:00:00+05:30', updatedAt: '2026-07-14T15:20:00+05:30',
  },
  {
    id: 'CT-BCM-006', contractorId: contractor.id, mineId: 'M-01',
    name: 'Vegetation & Reclamation', workType: 'Vegetation & Reclamation', category: 'Site Services',
    description: 'Reclamation and plantation of the exhausted southern dump. Terminated early following scope reallocation.',
    scope: 'Topsoil replacement, contouring and plantation of native species across 2 hectares of the southern dump. Scope reallocated to the site-services contract following a change in reclamation sequencing; partial completion recorded.',
    startDate: '2025-04-01', endDate: '2026-03-31',
    contractValue: 1.4 * CRORE, currency: Currency.INR,
    progress: 30, status: ContractStatus.Terminated,
    workOrderNumber: 'WO-BCM-2025-051', renewalEligible: false, complianceStatus: 'Non-Compliant',
    createdAt: '2025-03-15T11:10:00+05:30', updatedAt: '2026-05-02T10:05:00+05:30',
  },
];

// ---------- Milestones (upcoming + completed + overdue) ----------
export const milestones: ContractMilestone[] = [
  // Upcoming panel records — dates reproduce the reference "Due in N days".
  { id: 'MS-001', contractId: 'CT-EFM-003', title: 'Quarterly Review Submission', description: 'Submit the Q3 performance review with staffing strength, audit findings and SLA adherence summary.', dueDate: '2026-10-15', status: MilestoneStatus.Pending },
  { id: 'MS-002', contractId: 'CT-NBM-001', title: 'Maintenance Report', description: 'File the monthly HEMM maintenance report with downtime hours, spares consumed and pending jobs.', dueDate: '2026-10-28', status: MilestoneStatus.InProgress },
  { id: 'MS-003', contractId: 'CT-BCM-002', title: 'Compliance Document Renewal', description: 'Renew the transport permit, insurance certificates and driver fitness records for the FY fleet.', dueDate: '2026-11-14', status: MilestoneStatus.Pending },
  { id: 'MS-004', contractId: 'CT-BCM-001', title: 'Annual Audit Submission', description: 'Submit the annual statutory compliance audit report signed by the independent auditor.', dueDate: '2026-12-31', status: MilestoneStatus.Pending },
  { id: 'MS-005', contractId: 'CT-BCM-005', title: 'Mobilisation Plan', description: 'Submit the washery maintenance mobilisation plan with manpower and spares deployment schedule.', dueDate: '2026-11-05', status: MilestoneStatus.Pending },
  { id: 'MS-006', contractId: 'CT-EFM-005', title: 'Security Staff Deployment', description: 'Complete deployment of 28 security personnel and submit biometric enrolment report.', dueDate: '2026-12-20', status: MilestoneStatus.Pending },
  { id: 'MS-007', contractId: 'CT-BCM-001', title: 'Equipment Certification', description: 'Submit third-party certification for all deployed dump trucks and hydraulic shovels.', dueDate: '2026-10-09', status: MilestoneStatus.Pending },

  // Completed / past milestones.
  { id: 'MS-008', contractId: 'CT-BCM-001', title: 'Safety Induction Report', description: 'Monthly safety induction completion report for all deployed operators.', dueDate: '2026-09-20', status: MilestoneStatus.Completed, submittedAt: '2026-09-18T15:20:00+05:30', documentRef: 'safety-induction-sep.pdf' },
  { id: 'MS-009', contractId: 'CT-NBM-004', title: 'Final Borehole Archive', description: 'Handover of archived cores and complete digital borehole log dataset.', dueDate: '2025-05-25', status: MilestoneStatus.Completed, submittedAt: '2025-05-24T11:00:00+05:30', documentRef: 'borehole-archive.zip' },
  { id: 'MS-010', contractId: 'CT-NBM-001', title: 'Spares Reconciliation', description: 'Reconcile issued vs consumed spares for H1 and submit the variance statement.', dueDate: '2026-09-30', status: MilestoneStatus.Overdue },
  { id: 'MS-011', contractId: 'CT-BCM-002', title: 'Fleet Insurance Renewal', description: 'Upload renewed insurance certificates for the full transportation fleet.', dueDate: '2026-08-31', status: MilestoneStatus.Completed, submittedAt: '2026-08-29T09:45:00+05:30', documentRef: 'fleet-insurance-2026.pdf' },
];

// ---------- Linked documents ----------
export const documents: ContractDocument[] = [
  { id: 'DOC-001', contractId: 'CT-BCM-001', name: 'Signed Contract Agreement.pdf', category: 'Contract Agreement', sizeKb: 2480, uploadedAt: '2024-12-20T10:00:00+05:30', uploadedBy: 'Rakesh Kumar', mockRef: 'mock://docs/DOC-001' },
  { id: 'DOC-002', contractId: 'CT-BCM-001', name: 'Work Order WO-BCM-2024-118.pdf', category: 'Work Order', sizeKb: 640, uploadedAt: '2024-12-22T14:30:00+05:30', uploadedBy: 'Mine Office', mockRef: 'mock://docs/DOC-002' },
  { id: 'DOC-003', contractId: 'CT-BCM-001', name: 'GST Registration.pdf', category: 'Compliance Certificate', sizeKb: 320, uploadedAt: '2024-12-20T10:05:00+05:30', uploadedBy: 'Rakesh Kumar', mockRef: 'mock://docs/DOC-003' },
  { id: 'DOC-004', contractId: 'CT-BCM-002', name: 'Signed Contract Agreement.pdf', category: 'Contract Agreement', sizeKb: 1980, uploadedAt: '2025-02-03T09:15:00+05:30', uploadedBy: 'Rakesh Kumar', mockRef: 'mock://docs/DOC-004' },
  { id: 'DOC-005', contractId: 'CT-BCM-002', name: 'Fleet Insurance 2026.pdf', category: 'Compliance Certificate', sizeKb: 880, uploadedAt: '2026-08-29T09:45:00+05:30', uploadedBy: 'Rakesh Kumar', mockRef: 'mock://docs/DOC-005' },
  { id: 'DOC-006', contractId: 'CT-NBM-001', name: 'Maintenance Schedule 2026.pdf', category: 'Other Supporting Document', sizeKb: 420, uploadedAt: '2025-03-10T11:20:00+05:30', uploadedBy: 'Site Engineer', mockRef: 'mock://docs/DOC-006' },
  { id: 'DOC-007', contractId: 'CT-EFM-003', name: 'Labour Compliance Certificate.pdf', category: 'Compliance Certificate', sizeKb: 510, uploadedAt: '2025-04-05T16:00:00+05:30', uploadedBy: 'Rakesh Kumar', mockRef: 'mock://docs/DOC-007' },
  { id: 'DOC-008', contractId: 'CT-NBM-004', name: 'Completion Certificate.pdf', category: 'Other Supporting Document', sizeKb: 290, uploadedAt: '2025-06-02T12:00:00+05:30', uploadedBy: 'Mine Office', mockRef: 'mock://docs/DOC-008' },
];

// ---------- Activity history (seed — runtime actions prepend to this) ----------
export const activity: ActivityEntry[] = [
  { id: 'ACT-006', contractId: 'CT-BCM-002', kind: 'Milestone Updated', description: 'Fleet insurance renewal milestone marked as submitted.', timestamp: '2026-08-29T09:45:00+05:30', user: 'Rakesh Kumar' },
  { id: 'ACT-005', contractId: 'CT-BCM-001', kind: 'Milestone Updated', description: 'Safety induction report for September submitted.', timestamp: '2026-09-18T15:20:00+05:30', user: 'Rakesh Kumar' },
  { id: 'ACT-004', contractId: 'CT-NBM-005', kind: 'Contract Status', description: 'Contract terminated by mutual consent; demobilisation completed.', timestamp: '2026-07-14T15:20:00+05:30', user: 'Mine Office' },
  { id: 'ACT-003', contractId: 'CT-BCM-005', kind: 'Contract Created', description: 'Coal Washery Maintenance contract registered (upcoming).', timestamp: '2026-09-12T10:00:00+05:30', user: 'Mine Office' },
  { id: 'ACT-002', contractId: 'CT-NBM-004', kind: 'Document Uploaded', description: 'Completion certificate uploaded and archived.', timestamp: '2025-06-02T12:00:00+05:30', user: 'Mine Office' },
  { id: 'ACT-001', contractId: null, kind: 'Portal Access', description: 'Contractor session started for Eastern Mining Services Pvt. Ltd.', timestamp: '2026-10-03T09:00:00+05:30', user: 'Rakesh Kumar' },
];

// ---------- Existing requests (one pending, one approved renewal) ----------
export const requests: ContractRequest[] = [
  {
    id: 'CR-2026-0001', contractorId: contractor.id, mineId: 'M-02',
    workType: 'Equipment Maintenance',
    proposedTitle: 'HEMFM Fleet Extension Contract',
    scopeOfWork: 'Extension of the existing HEMM maintenance contract to cover 6 additional dump trucks inducted in the western push, with an enhanced 4-hour breakdown response SLA.',
    proposedStartDate: '2026-11-01', proposedEndDate: '2027-10-31',
    estimatedValue: 2.4 * CRORE, currency: Currency.INR,
    notes: 'Supporting fleet induction letter from the mine planning office attached.',
    attachments: [{ name: 'fleet-induction-letter.pdf', sizeKb: 210, category: 'Other Supporting Document', mockRef: 'mock://att/CR-0001-1' }],
    status: RequestStatus.PendingReview,
    createdAt: '2026-09-27T14:15:00+05:30', createdBy: 'Rakesh Kumar',
  },
];

export const renewals: RenewalRequest[] = [
  {
    id: 'RR-2026-0001', contractId: 'CT-NBM-001', contractorId: contractor.id, mineId: 'M-02',
    currentEndDate: '2026-02-28', proposedEndDate: '2027-02-28',
    proposedValue: 5.1 * CRORE, currency: Currency.INR,
    reason: 'Fleet utilisation has increased following the western push; a 12-month extension will avoid a disruptive re-tender and maintain maintenance continuity.',
    attachments: [{ name: 'renewal-justification.pdf', sizeKb: 180, category: 'Other Supporting Document', mockRef: 'mock://att/RR-0001-1' }],
    status: RequestStatus.PendingReview,
    createdAt: '2026-09-30T10:40:00+05:30', createdBy: 'Rakesh Kumar',
  },
];

// ---------- Notifications ----------
export const notifications: ContractNotification[] = [
  { id: 'NT-001', title: 'Renewal request under review', description: 'Your renewal request RR-2026-0001 for Equipment Maintenance is with the mine commercial office.', timestamp: '2026-09-30T10:41:00+05:30', read: false, priority: 'Medium', relatedId: 'RR-2026-0001' },
  { id: 'NT-002', title: 'Milestone due soon', description: 'Quarterly Review Submission for Site Services is due on 15 Oct 2026.', timestamp: '2026-10-02T08:00:00+05:30', read: false, priority: 'High', relatedId: 'MS-001' },
  { id: 'NT-003', title: 'Contract request pending', description: 'Your new contract request CR-2026-0001 is pending review.', timestamp: '2026-09-27T14:16:00+05:30', read: false, priority: 'Medium', relatedId: 'CR-2026-0001' },
  { id: 'NT-004', title: 'Milestone overdue', description: 'Spares Reconciliation for Equipment Maintenance was due on 30 Sep 2026.', timestamp: '2026-10-01T07:30:00+05:30', read: true, priority: 'High', relatedId: 'MS-010' },
];

/** Reset helper — returns a deep clone of the seed (used by demo reset). */
export function seedSnapshot() {
  return {
    contracts: structuredClone(contracts),
    milestones: structuredClone(milestones),
    documents: structuredClone(documents),
    activity: structuredClone(activity),
    requests: structuredClone(requests),
    renewals: structuredClone(renewals),
    notifications: structuredClone(notifications),
  };
}
