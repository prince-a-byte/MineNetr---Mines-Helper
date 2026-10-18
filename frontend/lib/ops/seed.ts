/**
 * Centralized synthetic Coal Mine Operations seed data (DEMO ONLY).
 * - Every record is fictional. Names, mines, contractors, vehicles and
 *   amounts resemble the reference mockups; nothing here is official data.
 * - Deterministic: a fixed-seed generator produces the same dataset every
 *   load, so IDs and relationships stay stable across pages and reloads.
 * - Consistency: workers → valid contractor + mine; attendance → worker;
 *   dispatch → mine + vehicle + stockpile; stock tx → stockpile; bill →
 *   contractor; document → entity; corrective action → finding.
 */
import {
  AccessStatus, AttendanceSource, AttendanceStatus, BillApprovalStatus, BillType,
  CoalGrade, ContractorStatus, CorrectiveActionStatus, Destination, DispatchStatus,
  DocumentCategory, DocumentStatus, FindingSeverity, FindingStatusNew, GasParam,
  InspectionStatusNew, InspectionType, MineStatus, NotificationCategory,
  NotificationPriority, NotificationStatusNew, PaymentMode, PaymentStatus,
  ReportStatus, ReportType, SensorStatus, Shift, StockStatus, StockTxStatus,
  StockTxType, ThemeSetting, DateFormatSetting, TimeFormatSetting, NumberFormatSetting,
  TrainingStatus, WorkLocation, WorkforceType, WorkerStatus, WorkOrderStatus,
  DEMO_NOW_ISO, DEMO_TODAY,
  type AccessRecord, type AttendanceRecord, type Bill, type CameraFeed,
  type Contractor, type CorrectiveAction, type DispatchRecord, type EnvConditions,
  type GasSensor, type GasTrendPoint, type Inspection, type InspectionFinding,
  type Mine, type OperationsSettings, type OperationsUser, type OpsAuditEntry,
  type OpsDocument, type OpsNotification, type OpsReport, type Payment,
  type ProductionRecord, type Session, type Stockpile, type StockpileReconciliation,
  type StockpileTransaction, type Vehicle, type WeighbridgeTransaction, type Worker,
  type WorkOrder,
} from './types';

// Deterministic PRNG (mulberry32) — same data on every load.
let _s = 0x5eed1234;
function rnd() { _s |= 0; _s = (_s + 0x6d2b79f5) | 0; let t = Math.imul(_s ^ (_s >>> 15), 1 | _s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
function ri(a: number, b: number) { return a + Math.floor(rnd() * (b - a + 1)); }
function pick<T>(xs: readonly T[]): T { return xs[Math.floor(rnd() * xs.length)]; }
function rf(a: number, b: number, dp = 1) { return Number((a + rnd() * (b - a)).toFixed(dp)); }

const LOC = (area: string, lat: number, lng: number) => ({ area, lat, lng, demo: true as const });

// ---------- Mines ----------
export const mines: Mine[] = [
  { id: 'M-01', code: 'BCM-01', name: 'Bharatpur Coal Mine', state: 'Jharkhand', district: 'Dhanbad', operator: 'Bharat Coking Coal Ltd.', status: MineStatus.Active, capacityMtYr: 7.5, location: LOC('Central Yard', 23.78, 86.42), contactName: 'S. P. Singh', contactPhone: '+91-90000-20001' },
  { id: 'M-02', code: 'BCM-02', name: 'Kusunda Coal Mine', state: 'Jharkhand', district: 'Dhanbad', operator: 'Bharat Coking Coal Ltd.', status: MineStatus.Active, capacityMtYr: 5.2, location: LOC('Kusunda Area', 23.74, 86.38), contactName: 'R. K. Verma', contactPhone: '+91-90000-20002' },
  { id: 'M-03', code: 'BCM-03', name: 'Mugma Coal Mine', state: 'Jharkhand', district: 'Dhanbad', operator: 'Bharat Coking Coal Ltd.', status: MineStatus.UnderInspection, capacityMtYr: 4.1, location: LOC('Mugma Sector', 23.82, 86.74), contactName: 'P. K. Das', contactPhone: '+91-90000-20003' },
  { id: 'M-04', code: 'BCM-04', name: 'Rajhara Coal Mine', state: 'Chhattisgarh', district: 'Balrampur', operator: 'South Eastern Coalfields', status: MineStatus.Maintenance, capacityMtYr: 3.4, location: LOC('Rajhara Pit', 23.12, 83.29), contactName: 'A. K. Sen', contactPhone: '+91-90000-20004' },
  { id: 'M-05', code: 'BCM-05', name: 'Karanpura Coal Mine', state: 'Jharkhand', district: 'Chatra', operator: 'Central Coalfields', status: MineStatus.Active, capacityMtYr: 4.8, location: LOC('Karanpura Block', 23.98, 85.02), contactName: 'M. Sahoo', contactPhone: '+91-90000-20005' },
];

// ---------- Contractors ----------
const CT = (n: number, code: string, name: string, workType: string, person: string, contractNo: string, start: string, end: string, status: ContractorStatus, mineIds: string[], value: number, compliance: Contractor['complianceStatus'], rating: number): Contractor =>
  ({ id: `CTR-${String(n).padStart(2, '0')}`, code, name, workType, contactPerson: person, phone: `+91-9${ri(100000000, 999999999)}`, email: `${code.toLowerCase()}@contractor.example`, contractNo, start, end, status, mineIds, contractValueLakh: value, complianceStatus: compliance, rating });

export const contractors: Contractor[] = [
  CT(1, 'SIPL', 'Shakti Infra Pvt. Ltd.', 'Overburden Removal', 'Ramesh Gupta', 'CT-BCM-001', '2025-01-01', '2027-12-31', ContractorStatus.Active, ['M-01', 'M-02'], 520, 'Compliant', 4.5),
  CT(2, 'KMS', 'Kailash Mining Services', 'Coal Transportation', 'Sanjay Mehta', 'CT-BCM-002', '2025-02-15', '2028-02-14', ContractorStatus.Active, ['M-01', 'M-03'], 342, 'Compliant', 4.2),
  CT(3, 'ECS', 'Eastern Constructions', 'Drilling & Blasting', 'A. Chatterjee', 'CT-BCM-003', '2024-03-01', '2026-10-20', ContractorStatus.ExpiringSoon, ['M-01'], 285, 'Partial Compliance', 3.8),
  CT(4, 'SA', 'Sai Associates', 'Maintenance Services', 'D. Patil', 'CT-BCM-004', '2025-04-10', '2028-04-09', ContractorStatus.Active, ['M-02', 'M-05'], 168, 'Compliant', 4.1),
  CT(5, 'OL', 'Om Logistics', 'Coal Transportation', 'V. Agarwal', 'CT-BCM-005', '2025-01-05', '2027-11-05', ContractorStatus.ExpiringSoon, ['M-01', 'M-04'], 112, 'Compliant', 4.0),
  CT(6, 'BEM', 'Bharat Earthmovers', 'Excavation & Loading', 'K. Iyer', 'CT-BCM-006', '2025-03-20', '2028-03-19', ContractorStatus.Active, ['M-03', 'M-05'], 96, 'Compliant', 4.4),
  CT(7, 'NE', 'Nirmal Enterprises', 'Water Supply & Dust Control', 'N. Nirmal', 'CT-BCM-007', '2024-06-01', '2027-05-31', ContractorStatus.Active, ['M-02'], 58, 'Partial Compliance', 3.6),
  CT(8, 'GMT', 'Global Mining Tech', 'Equipment Maintenance', 'H. Shah', 'CT-BCM-008', '2025-02-12', '2028-02-11', ContractorStatus.Active, ['M-01', 'M-05'], 74, 'Compliant', 4.3),
  CT(9, 'VTC', 'Veer Transport Co.', 'Coal Transportation', 'P. Singh', 'CT-BCM-009', '2024-10-01', '2026-11-12', ContractorStatus.ExpiringSoon, ['M-05'], 48, 'Compliant', 3.9),
  CT(10, 'PC', 'Prakash Contractors', 'Civil & Infrastructure', 'G. Prakash', 'CT-BCM-010', '2024-07-15', '2027-07-14', ContractorStatus.Inactive, ['M-04'], 0, 'Non-Compliant', 2.9),
  CT(11, 'MSS', 'Mines Support Services', 'Services', 'T. Rao', 'CT-BCM-011', '2025-05-01', '2028-04-30', ContractorStatus.PendingApproval, ['M-02', 'M-03'], 35, 'Partial Compliance', 3.4),
  CT(12, 'ACE', 'Apex Conveyor Engg.', 'Maintenance Services', 'S. Jain', 'CT-BCM-012', '2025-06-10', '2028-06-09', ContractorStatus.PendingApproval, ['M-01'], 42, 'Compliant', 4.0),
];

export const workOrders: WorkOrder[] = [
  { id: 'WO-BCM-001', contractorId: 'CTR-01', mineId: 'M-01', title: 'Overburden removal — Pit I', valueLakh: 180, start: '2026-04-01', end: '2027-03-31', status: WorkOrderStatus.Active },
  { id: 'WO-BCM-002', contractorId: 'CTR-02', mineId: 'M-01', title: 'Coal transportation to NTPC', valueLakh: 150, start: '2026-03-01', end: '2027-02-28', status: WorkOrderStatus.Active },
  { id: 'WO-BCM-003', contractorId: 'CTR-03', mineId: 'M-01', title: 'Drilling & blasting — Panel 4', valueLakh: 95, start: '2025-10-01', end: '2026-10-20', status: WorkOrderStatus.Active },
  { id: 'WO-BCM-004', contractorId: 'CTR-04', mineId: 'M-02', title: 'Dumper maintenance contract', valueLakh: 60, start: '2026-01-01', end: '2026-12-31', status: WorkOrderStatus.Active },
  { id: 'WO-BCM-005', contractorId: 'CTR-05', mineId: 'M-01', title: 'Railway siding dispatch support', valueLakh: 48, start: '2026-02-01', end: '2027-01-31', status: WorkOrderStatus.Active },
  { id: 'WO-BCM-006', contractorId: 'CTR-06', mineId: 'M-03', title: 'Excavation support — Kusunda dip', valueLakh: 72, start: '2026-05-01', end: '2027-04-30', status: WorkOrderStatus.Active },
  { id: 'WO-BCM-007', contractorId: 'CTR-08', mineId: 'M-05', title: 'Conveyor maintenance AMC', valueLakh: 30, start: '2026-06-01', end: '2027-05-31', status: WorkOrderStatus.Active },
  { id: 'WO-BCM-008', contractorId: 'CTR-09', mineId: 'M-05', title: 'Transport — washed coal dispatch', valueLakh: 22, start: '2025-10-01', end: '2026-10-31', status: WorkOrderStatus.Active },
  { id: 'WO-BCM-009', contractorId: 'CTR-11', mineId: 'M-02', title: 'Site services extension — Phase II', valueLakh: 18, start: '2026-10-15', end: '2027-10-14', status: WorkOrderStatus.PendingApproval },
  { id: 'WO-BCM-010', contractorId: 'CTR-12', mineId: 'M-01', title: 'Conveyor maintenance AMC — renewal', valueLakh: 25, start: '2026-11-01', end: '2027-10-31', status: WorkOrderStatus.PendingApproval },
];

// ---------- Workers ----------
const FIRST = ['Rahul', 'Suresh', 'Manoj', 'Ajay', 'Vikash', 'Sunil', 'Deepak', 'Pawan', 'Ramesh', 'Karan', 'Amit', 'Santosh', 'Mukesh', 'Naresh', 'Dinesh', 'Ravi', 'Sanjay', 'Praveen', 'Ranjan', 'Ashok', 'Mahesh', 'Bipin', 'Rakesh', 'Ranveer', 'Shiv', 'Umesh', 'Yogesh', 'Nitin', 'Ganesh', 'Hemant'];
const LAST = ['Yadav', 'Kumar', 'Singh', 'Prasad', 'Tiwari', 'Mehto', 'Das', 'Mahto', 'Sharma', 'Gupta', 'Rana', 'Soren', 'Kerketta', 'Sahu', 'Choudhary', 'Mandal', 'Rout', 'Behera'];
const SKILLS: { skill: string; role: string }[] = [
  { skill: 'Dumper Driver', role: 'Dumper Driver' }, { skill: 'Excavator Operator', role: 'Excavator Operator' },
  { skill: 'Loader Operator', role: 'Loader Operator' }, { skill: 'Driller', role: 'Driller' },
  { skill: 'Helper', role: 'Helper' }, { skill: 'Electrician', role: 'Electrician' },
  { skill: 'Fitter', role: 'Fitter' }, { skill: 'Welder', role: 'Welder' },
  { skill: 'Blaster', role: 'Blaster' }, { skill: 'Mechanic', role: 'Mechanic' },
  { skill: 'Supervisor', role: 'Supervisor' }, { skill: 'Surveyor', role: 'Surveyor' },
];

// The first 10 workers match the reference mockup exactly.
const HEAD_WORKERS: Partial<Worker>[] = [
  { name: 'Rahul Yadav', skill: 'Driller', role: 'Driller', trainingStatus: TrainingStatus.Valid, accessStatus: AccessStatus.Allowed, status: WorkerStatus.Active },
  { name: 'Suresh Kumar', skill: 'Loader Operator', role: 'Loader Operator', trainingStatus: TrainingStatus.ExpiringSoon, accessStatus: AccessStatus.Allowed, status: WorkerStatus.Active },
  { name: 'Manoj Singh', skill: 'Electrician', role: 'Electrician', trainingStatus: TrainingStatus.Valid, accessStatus: AccessStatus.Blocked, status: WorkerStatus.Blocked },
  { name: 'Ajay Prasad', skill: 'Fitter', role: 'Fitter', trainingStatus: TrainingStatus.Expired, accessStatus: AccessStatus.Allowed, status: WorkerStatus.Active },
  { name: 'Vikash Tiwari', skill: 'Helper', role: 'Helper', trainingStatus: TrainingStatus.Valid, accessStatus: AccessStatus.Allowed, status: WorkerStatus.Active },
  { name: 'Sunil Mehto', skill: 'Dumper Driver', role: 'Dumper Driver', trainingStatus: TrainingStatus.Valid, accessStatus: AccessStatus.Allowed, status: WorkerStatus.Active },
  { name: 'Deepak Kumar', skill: 'Supervisor', role: 'Supervisor', trainingStatus: TrainingStatus.ExpiringSoon, accessStatus: AccessStatus.Allowed, status: WorkerStatus.Active },
  { name: 'Pawan Singh', skill: 'Welder', role: 'Welder', trainingStatus: TrainingStatus.Valid, accessStatus: AccessStatus.Allowed, status: WorkerStatus.Active },
  { name: 'Ramesh Das', skill: 'Mechanic', role: 'Mechanic', trainingStatus: TrainingStatus.Valid, accessStatus: AccessStatus.Allowed, status: WorkerStatus.Active },
  { name: 'Karan Yadav', skill: 'Blaster', role: 'Blaster', trainingStatus: TrainingStatus.NotTrained, accessStatus: AccessStatus.Blocked, status: WorkerStatus.Blocked },
];

function trainingExpiry(status: TrainingStatus): string | null {
  if (status === TrainingStatus.NotTrained) return null;
  if (status === TrainingStatus.Valid) return pick(['2027-03-14', '2027-06-22', '2027-01-08', '2026-12-30']);
  if (status === TrainingStatus.ExpiringSoon) return pick(['2026-10-18', '2026-11-02', '2026-10-29']);
  return pick(['2026-08-12', '2026-09-05', '2026-07-21']);
}

export const workers: Worker[] = (() => {
  const out: Worker[] = [];
  const N = 132;
  // Contractor pool weighted like the reference (Shakti largest).
  const ctrPool: string[] = [];
  const ctrWeights: [string, number][] = [['CTR-01', 26], ['CTR-02', 18], ['CTR-03', 12], ['CTR-04', 11], ['CTR-05', 10], ['CTR-06', 9], ['CTR-07', 5], ['CTR-08', 6], ['CTR-09', 3], ['CTR-11', 1], ['CTR-12', 1]];
  ctrWeights.forEach(([id, w]) => { for (let i = 0; i < w; i++) ctrPool.push(id); });
  const minePool: string[] = [];
  const mineWeights: [string, number][] = [['M-01', 40], ['M-02', 22], ['M-03', 18], ['M-05', 14], ['M-04', 6]];
  mineWeights.forEach(([id, w]) => { for (let i = 0; i < w; i++) minePool.push(id); });

  for (let i = 1; i <= N; i++) {
    const code = `WK-${String(i).padStart(3, '0')}`;
    const head = HEAD_WORKERS[i - 1];
    const isMine = i % 5 === 0; // ~20% direct mine workforce
    const ctrId = isMine ? null : pick(ctrPool);
    const mineId = ctrId ? (contractors.find((c) => c.id === ctrId)!.mineIds[0]) : pick(minePool);
    const sk = SKILLS.find((s) => s.skill === (head?.skill ?? '')) ?? pick(SKILLS);
    const ts = head?.trainingStatus ?? (i % 11 === 0 ? TrainingStatus.NotTrained : i % 9 === 0 ? TrainingStatus.Expired : i % 7 === 0 ? TrainingStatus.ExpiringSoon : TrainingStatus.Valid);
    const joined = head ? pick(['2024-06-12', '2024-09-01', '2025-01-15', '2025-03-22'])
      : `${2023 + (i % 3)}-${String(ri(1, 12)).padStart(2, '0')}-${String(ri(1, 28)).padStart(2, '0')}`;
    out.push({
      id: `W-${String(i).padStart(4, '0')}`, code, name: head?.name ?? `${pick(FIRST)} ${pick(LAST)}`,
      workforceType: isMine ? WorkforceType.Mine : WorkforceType.Contractor, contractorId: ctrId, mineId,
      role: head?.role ?? sk.role, skill: sk.skill, joinedOn: joined, phone: `+91-9${ri(100000000, 999999999)}`,
      trainingStatus: ts, trainingExpiry: trainingExpiry(ts),
      accessStatus: head?.accessStatus ?? (ts === TrainingStatus.Expired || ts === TrainingStatus.NotTrained ? AccessStatus.Blocked : AccessStatus.Allowed),
      accessCardId: `AC-${String(1000 + i)}`, status: head?.status ?? (ts === TrainingStatus.Expired || ts === TrainingStatus.NotTrained ? WorkerStatus.Blocked : WorkerStatus.Active),
      biomeitricId: `BIO-${String(5000 + i)}`,
      assignments: ctrId ? [{ id: `ASG-${String(i).padStart(4, '0')}`, contractorId: ctrId, mineId, from: joined, to: null, role: head?.role ?? sk.role }] : [],
    });
  }
  return out;
})();

// ---------- Attendance (today + 6-day history) ----------
const LOC_BY_SKILL = (skill: string): WorkLocation =>
  skill.includes('Driver') || skill.includes('Operator') ? WorkLocation.Surface
    : skill === 'Electrician' || skill === 'Fitter' || skill === 'Welder' || skill === 'Mechanic' ? WorkLocation.Workshop
      : skill === 'Helper' || skill === 'Driller' || skill === 'Blaster' ? WorkLocation.Underground
        : WorkLocation.Surface;

function hhmm(h: number, m: number) { const ap = h >= 12 ? 'PM' : 'AM'; const hh = h % 12 === 0 ? 12 : h % 12; return `${String(hh).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ap}`; }

export const attendance: AttendanceRecord[] = (() => {
  const out: AttendanceRecord[] = [];
  let n = 0;
  const days = ['2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', DEMO_TODAY];
  for (const date of days) {
    const isToday = date === DEMO_TODAY;
    for (const w of workers) {
      // Deterministic per-day roll.
      _s = (w.id.charCodeAt(3) * 7919 + date.charCodeAt(9) * 104729 + n) | 0;
      const roll = rnd();
      let status = AttendanceStatus.Present;
      if (w.status === WorkerStatus.Blocked) status = AttendanceStatus.Absent;
      else if (roll > 0.94) status = AttendanceStatus.OnLeave;
      else if (roll > 0.88) status = AttendanceStatus.Absent;
      else if (roll > 0.865) status = AttendanceStatus.HalfDay;
      const present = status === AttendanceStatus.Present || status === AttendanceStatus.HalfDay;
      const inT = present ? hhmm(ri(6, 8), ri(0, 59)) : null;
      let outT: string | null = null;
      if (present) {
        if (isToday) outT = null; // still on site unless checked out (seeded below)
        else outT = status === AttendanceStatus.HalfDay ? hhmm(13, ri(0, 59)) : hhmm(ri(16, 19), ri(0, 59));
      }
      out.push({
        id: `ATT-${String(++n).padStart(5, '0')}`, workerId: w.id, date, inTime: inT, outTime: outT,
        status, shift: Shift.Morning, location: present ? LOC_BY_SKILL(w.skill) : null,
        source: n % 13 === 0 ? AttendanceSource.Manual : n % 17 === 0 ? AttendanceSource.Supervisor : AttendanceSource.Gate,
      });
    }
  }
  // Seed a handful of today's check-outs so "Workers In/Out" is mixed.
  const todays = out.filter((a) => a.date === DEMO_TODAY && a.inTime && a.status === AttendanceStatus.Present);
  for (let i = 0; i < Math.floor(todays.length * 0.13); i++) {
    const a = todays[(i * 7 + 3) % todays.length];
    a.outTime = hhmm(ri(12, 10 + (i % 2)), ri(0, 59));
  }
  return out;
})();

// ---------- Vehicles ----------
const VEHICLE_NOS = ['JH01AB1234', 'CG12XY5678', 'JH05CD9101', 'OD22EF3456', 'JH03GH7890', 'BR01U2468', 'JH02KL1357', 'CG10MN6789', 'JH07OP4321', 'OD13QR9876', 'JH09ST2210', 'MP11UV5543', 'WB04WX7788', 'JH06YZ9911', 'CG08AB3344', 'JH12CD6655'];
export const vehicles: Vehicle[] = VEHICLE_NOS.map((no, i) => ({ id: `VEH-${String(i + 1).padStart(2, '0')}`, no, driver: `${pick(FIRST)} ${pick(LAST)}`, kind: i % 3 === 0 ? 'Trailer' : i % 3 === 1 ? 'Dumper' : 'Tipper' }));

// ---------- Stockpiles ----------
const SP_SEED: [string, string, string, string, CoalGrade, string, number, number][] = [
  ['M-01', 'SP-01', 'Main Yard', 'Central Yard', CoalGrade.G8, 'Central Yard', 55000, 42850],
  ['M-01', 'SP-02', 'East Yard', 'East Sector', CoalGrade.G10, 'East Sector', 39000, 25340],
  ['M-01', 'SP-03', 'West Yard', 'West Sector', CoalGrade.G12, 'West Sector', 35000, 18220],
  ['M-01', 'SP-04', 'Washed Coal', 'Processing Area', CoalGrade.Washed, 'Processing Area', 36000, 12480],
  ['M-01', 'SP-05', 'ROM Stock', 'Mine Pit Area', CoalGrade.Mixed, 'Mine Pit Area', 29000, 25690],
  ['M-01', 'SP-06', 'Reject Stock', 'Reject Yard', CoalGrade.Other, 'Reject Yard', 20000, 6120],
  ['M-02', 'SP-07', 'Kusunda Main Yard', 'Central Yard', CoalGrade.G8, 'Central Yard', 40000, 21400],
  ['M-02', 'SP-08', 'Kusunda ROM', 'Mine Pit Area', CoalGrade.Mixed, 'Mine Pit Area', 26000, 14980],
  ['M-03', 'SP-09', 'Mugma Yard A', 'East Sector', CoalGrade.G10, 'East Sector', 32000, 12650],
  ['M-03', 'SP-10', 'Mugma Washed Coal', 'Processing Area', CoalGrade.Washed, 'Processing Area', 24000, 8930],
  ['M-04', 'SP-11', 'Rajhara Yard', 'Central Yard', CoalGrade.G12, 'Central Yard', 28000, 5410],
  ['M-05', 'SP-12', 'Karanpura Main', 'Central Yard', CoalGrade.G8, 'Central Yard', 30000, 16870],
  ['M-05', 'SP-13', 'Karanpura ROM', 'Mine Pit Area', CoalGrade.Mixed, 'Mine Pit Area', 22000, 10240],
];

export const stockpiles: Stockpile[] = SP_SEED.map(([mineId, code, name, area, grade, mapArea, cap, target], i) => ({
  id: `STK-${String(i + 1).padStart(2, '0')}`, code, name, mineId, grade, area: mapArea, capacityMt: cap,
  // opening = target adjusted so opening + seeded in-flows − out-flows ≈ target.
  openingMt: Math.max(0, target - ri(1200, 3200)),
  mapX: 8 + (i % 4) * 22 + (i > 5 ? 6 : 0), mapY: 14 + Math.floor((i % 8) / 4) * 40,
}));

export function stockpileStatus(sp: Stockpile, currentMt: number): StockStatus {
  const u = currentMt / sp.capacityMt;
  return u > 0.85 ? StockStatus.High : u < 0.25 ? StockStatus.Low : StockStatus.Normal;
}

// ---------- Production (30 days) ----------
const PROD_SOURCES = ['Pit I — Dumper Fleet', 'Pit II — Dragline', 'Pit III — Loader Fleet', 'UG Section A'];
export const production: ProductionRecord[] = (() => {
  const out: ProductionRecord[] = [];
  let n = 0;
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date('2026-10-03T00:00:00+05:30');
    d.setDate(d.getDate() - i);
    return d.toISOString().slice(0, 10);
  });
  for (const date of days) {
    for (const sp of stockpiles) {
      if (sp.grade === CoalGrade.Washed || sp.grade === CoalGrade.Other) continue; // fed by transfer
      _s = (sp.id.charCodeAt(5) * 131 + date.charCodeAt(9) * 977 + n) | 0;
      if (rnd() > 0.55) continue; // not every stockpile every day
      const mine = sp.mineId;
      const qty = ri(180, 1450);
      out.push({
        id: `PR-2026-${String(++n).padStart(3, '0')}`, date, mineId: mine, stockpileId: sp.id,
        quantityMt: qty, grade: sp.grade, shift: pick([Shift.Morning, Shift.Afternoon, Shift.Night]),
        source: pick(PROD_SOURCES), remarks: rnd() > 0.8 ? 'Normal operations.' : '',
        recordedBy: pick(['Amit Verma', 'Site Supervisor', 'Shift Incharge']),
      });
    }
  }
  return out;
})();

// ---------- Stockpile transactions (production in / dispatch out / transfers) ----------
export const stockTx: StockpileTransaction[] = (() => {
  const out: StockpileTransaction[] = [];
  let n = 0;
  for (const p of production) {
    out.push({
      id: `STX-${String(++n).padStart(4, '0')}`, timestamp: `${p.date}T${hhmm(ri(6, 18), ri(0, 59))}`, date: p.date,
      type: StockTxType.Production, stockpileId: p.stockpileId, toStockpileId: null,
      quantityMt: p.quantityMt, reference: p.id, counterparty: p.source, status: StockTxStatus.Added,
    });
  }
  // Washing-plant transfers into washed-coal piles.
  for (let i = 0; i < 14; i++) {
    const dst = stockpiles.filter((s) => s.grade === CoalGrade.Washed)[i % 2];
    const src = stockpiles.filter((s) => s.mineId === dst.mineId && s.grade !== CoalGrade.Washed)[0];
    const qty = ri(400, 1200);
    const date = ['2026-09-28', '2026-09-30', '2026-10-01', '2026-10-02'][i % 4];
    out.push({
      id: `STX-${String(++n).padStart(4, '0')}`, timestamp: `${date}T${hhmm(12 + (i % 8), ri(0, 59))}`, date,
      type: StockTxType.Transfer, stockpileId: src.id, toStockpileId: dst.id, quantityMt: qty,
      reference: `TR-2026-${String(21 + i).padStart(3, '0')}`, counterparty: 'Washing Plant',
      status: StockTxStatus.Transferred,
    });
  }
  // Reconciliations.
  for (let i = 0; i < 3; i++) {
    const sp = stockpiles[i * 2];
    const phys = 0;
    out.push({
      id: `STX-${String(++n).padStart(4, '0')}`, timestamp: `2026-10-0${i + 1}T16:30:00`, date: `2026-10-0${i + 1}`,
      type: StockTxType.Reconciliation, stockpileId: sp.id, toStockpileId: null, quantityMt: phys,
      reference: `RC-2026-${String(i + 1).padStart(3, '0')}`, counterparty: 'Survey Team',
      status: StockTxStatus.Reconciled,
    });
  }
  return out;
})();

export const reconciliations: StockpileReconciliation[] = [
  { id: 'RC-2026-001', stockpileId: 'STK-01', date: '2026-10-01', systemMt: 41200, physicalMt: 41200, varianceMt: 0, by: 'Survey Team', note: 'Matched.' },
  { id: 'RC-2026-002', stockpileId: 'STK-03', date: '2026-10-02', systemMt: 17980, physicalMt: 17640, varianceMt: -340, by: 'Survey Team', note: 'Moisture loss accounted.' },
  { id: 'RC-2026-003', stockpileId: 'STK-05', date: '2026-10-03', systemMt: 25690, physicalMt: 25990, varianceMt: 300, by: 'Survey Team', note: 'Re-handle from Pit II pending entry.' },
];

// ---------- Dispatches + weighbridge ----------
export const dispatches: DispatchRecord[] = (() => {
  const out: DispatchRecord[] = [];
  const days = ['2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', DEMO_TODAY];
  let n = 0;
  for (const date of days) {
    const perDay = date === DEMO_TODAY ? 10 : ri(8, 12);
    for (let i = 0; i < perDay; i++) {
      _s = (i * 3571 + date.charCodeAt(9) * 6151 + n) | 0;
      const sp = pick(stockpiles.filter((s) => s.grade !== CoalGrade.Other));
      const v = vehicles[(i + n) % vehicles.length];
      const gross = rf(48, 54, 3); const tare = rf(24, 27, 3);
      const dest = pick([Destination.NTPC, Destination.NTPC, Destination.RailwaySiding, Destination.OtherConsumer, Destination.WashedCoal]);
      const destLabel = dest === Destination.NTPC ? 'NTPC' : dest === Destination.RailwaySiding ? 'Railway Siding' : dest === Destination.OtherConsumer ? 'Other Consumer' : 'Washed Coal';
      const status = date === DEMO_TODAY ? (i < 6 ? DispatchStatus.Dispatched : i < 8 ? DispatchStatus.InTransit : DispatchStatus.Pending)
        : rnd() > 0.97 ? DispatchStatus.Cancelled : DispatchStatus.Dispatched;
      out.push({
        id: `DSP-2026-${String(++n).padStart(3, '0')}`, date, timestamp: `${date}T${hhmm(ri(7, 11), ri(0, 59))}`,
        mineId: sp.mineId, stockpileId: sp.id, destination: dest, vehicleNo: v.no, driver: v.driver,
        grade: sp.grade, quantityMt: Number((gross - tare).toFixed(3)), grossMt: gross, tareMt: tare,
        challanNo: `CH-2026-${String(n).padStart(3, '0')}`, status,
      });
    }
  }
  return out;
})();

export const weighbridge: WeighbridgeTransaction[] = dispatches.map((d) => ({
  id: `WB-2026-${d.id.slice(-3)}`, dispatchId: d.id, vehicleNo: d.vehicleNo, mineId: d.mineId,
  grossMt: d.grossMt, tareMt: d.tareMt, netMt: d.quantityMt, timestamp: d.timestamp,
  status: d.status === DispatchStatus.Pending ? 'Pending' : 'Recorded',
}));

// Stock out-flows (dispatch) recorded as transactions.
(() => {
  let n = 900;
  for (const d of dispatches) {
    stockTx.push({
      id: `STX-${String(++n).padStart(4, '0')}`, timestamp: d.timestamp, date: d.date,
      type: StockTxType.Dispatch, stockpileId: d.stockpileId, toStockpileId: null,
      quantityMt: d.quantityMt, reference: d.challanNo, counterparty: d.destination,
      status: StockTxStatus.Deducted,
    });
  }
})();

// ---------- Bills + payments ----------
const BILL_SEED: [string, string | null, BillType, string, string, string, number, BillApprovalStatus][] = [
  ['CTR-01', 'WO-BCM-001', BillType.WorkOrder, 'Overburden removal — September 2026', '2026-09-01', '2026-09-30', 4280000, BillApprovalStatus.Approved],
  ['CTR-02', 'WO-BCM-002', BillType.Transportation, 'Coal transportation — Aug–Sep 2026', '2026-08-15', '2026-09-14', 3650000, BillApprovalStatus.Pending],
  ['CTR-03', 'WO-BCM-003', BillType.WorkOrder, 'Drilling & blasting — September 2026', '2026-09-01', '2026-09-30', 2840000, BillApprovalStatus.Approved],
  ['CTR-04', 'WO-BCM-004', BillType.Maintenance, 'Dumper maintenance — August 2026', '2026-08-01', '2026-08-31', 1875000, BillApprovalStatus.UnderReview],
  ['CTR-05', 'WO-BCM-005', BillType.Services, 'Siding dispatch support — September 2026', '2026-09-01', '2026-09-30', 2460000, BillApprovalStatus.Rejected],
  ['CTR-06', 'WO-BCM-006', BillType.Transportation, 'Excavation support — September 2026', '2026-09-01', '2026-09-30', 3120000, BillApprovalStatus.Approved],
  ['CTR-08', 'WO-BCM-007', BillType.Maintenance, 'Conveyor AMC — Aug–Sep 2026', '2026-08-15', '2026-09-14', 1280000, BillApprovalStatus.Pending],
  ['CTR-07', null, BillType.Supplies, 'Water tanker services — September 2026', '2026-09-01', '2026-09-30', 1640000, BillApprovalStatus.Approved],
  ['CTR-09', 'WO-BCM-008', BillType.Transportation, 'Washed coal dispatch — August 2026', '2026-08-01', '2026-08-31', 950000, BillApprovalStatus.Approved],
  ['CTR-11', null, BillType.Services, 'Site services — Aug–Sep 2026', '2026-08-15', '2026-09-14', 1130000, BillApprovalStatus.UnderReview],
  ['CTR-01', 'WO-BCM-001', BillType.WorkOrder, 'Overburden removal — August 2026', '2026-08-01', '2026-08-31', 4020000, BillApprovalStatus.Approved],
  ['CTR-02', 'WO-BCM-002', BillType.Transportation, 'Coal transportation — July 2026', '2026-07-01', '2026-07-31', 3380000, BillApprovalStatus.Approved],
];

export const bills: Bill[] = BILL_SEED.map(([ctrId, woId, type, desc, from, to, amount, status], i) => {
  const ctr = contractors.find((c) => c.id === ctrId)!;
  const mineId = woId ? workOrders.find((w) => w.id === woId)!.mineId : ctr.mineIds[0];
  const tax = Math.round(amount * 0.18);
  const payStatus = status !== BillApprovalStatus.Approved ? PaymentStatus.Unpaid
    : i % 4 === 0 ? PaymentStatus.PartiallyPaid : i % 7 === 3 ? PaymentStatus.Unpaid : PaymentStatus.Paid;
  return {
    id: `BILL-2026-${String(i + 1).padStart(3, '0')}`, contractorId: ctrId, workOrderId: woId, mineId, type,
    invoiceDate: to, periodFrom: from, periodTo: to, description: desc, amount, tax, notes: '',
    approvalStatus: status, paymentStatus: payStatus,
    supportingDocs: [`invoice-${i + 1}.pdf`, `wo-snapshot.pdf`],
  };
});

export const payments: Payment[] = (() => {
  const out: Payment[] = [];
  let n = 0;
  for (const b of bills) {
    const total = b.amount + b.tax;
    if (b.paymentStatus === PaymentStatus.Paid) {
      out.push({ id: `PAY-2026-${String(++n).padStart(3, '0')}`, billId: b.id, amount: total, date: '2026-09-28', mode: PaymentMode.BankTransfer, reference: `NEFT-${ri(100000, 999999)}` });
    } else if (b.paymentStatus === PaymentStatus.PartiallyPaid) {
      out.push({ id: `PAY-2026-${String(++n).padStart(3, '0')}`, billId: b.id, amount: Math.round(total * 0.6), date: '2026-09-30', mode: PaymentMode.BankTransfer, reference: `NEFT-${ri(100000, 999999)}` });
    }
  }
  return out;
})();

// ---------- Documents ----------
const DOC_SEED: [string, DocumentCategory, string, DocumentStatus, string, string | null, string][] = [
  ['Mining Lease Agreement', DocumentCategory.StatutoryLicence, 'ML/BCM/2021', DocumentStatus.Valid, '2021-01-01', '2031-12-31', 'Amit Verma'],
  ['Environmental Clearance', DocumentCategory.Environment, 'EC/2020/BCM', DocumentStatus.Valid, '2021-03-15', '2031-03-14', 'Rakesh Singh'],
  ['Approved Mining Plan', DocumentCategory.StatutoryLicence, 'MP/BCM/2022', DocumentStatus.Valid, '2022-01-10', '2027-01-09', 'Amit Verma'],
  ['Consent to Operate (CTO)', DocumentCategory.Environment, 'CTO/2023/453', DocumentStatus.Valid, '2023-09-01', '2026-12-31', 'Sunil Kumar'],
  ['Explosive Licence', DocumentCategory.Safety, 'EL/2024/112', DocumentStatus.ExpiringSoon, '2024-10-16', '2026-10-15', 'Deepak Sharma'],
  ['Weighbridge Calibration Certificate', DocumentCategory.Equipment, 'WB/2025/067', DocumentStatus.ExpiringSoon, '2025-10-19', '2026-10-18', 'Pawan Gupta'],
  ['Fire Safety NOC', DocumentCategory.Safety, 'FSN/2024/089', DocumentStatus.ExpiringSoon, '2024-11-25', '2026-11-24', 'Rakesh Singh'],
  ['DGMS Form M-4 Submission', DocumentCategory.Compliance, 'M4/BCM/2026', DocumentStatus.Pending, '2026-09-30', null, 'Amit Verma'],
  ['Contractor Agreement — Shakti Infra', DocumentCategory.Contractor, 'CA/SI/2026', DocumentStatus.Valid, '2026-01-01', '2027-12-31', 'Admin'],
  ['Workers Medical Fitness Report', DocumentCategory.Worker, 'WMF/2026/051', DocumentStatus.Valid, '2026-08-01', '2027-07-31', 'Sunil Kumar'],
  ['Air Quality Consent (Second Schedule)', DocumentCategory.Environment, 'AQC/2024/118', DocumentStatus.ExpiringSoon, '2024-12-10', '2026-12-09', 'Rakesh Singh'],
  ['Electrical Safety Audit Report', DocumentCategory.Safety, 'ESA/2025/033', DocumentStatus.Pending, '2026-09-20', null, 'Deepak Sharma'],
  ['Crane Annual Safety Certificate', DocumentCategory.Equipment, 'CAS/2025/201', DocumentStatus.Valid, '2025-11-02', '2026-11-01', 'Pawan Gupta'],
  ['Contractor Agreement — Kailash Mining', DocumentCategory.Contractor, 'CA/KM/2026', DocumentStatus.Valid, '2026-02-15', '2028-02-14', 'Admin'],
  ['Contractor Agreement — Eastern Constructions', DocumentCategory.Contractor, 'CA/EC/2025', DocumentStatus.ExpiringSoon, '2024-10-20', '2026-10-20', 'Admin'],
  ['Statutory Warning Notice Display', DocumentCategory.Compliance, 'SWN/2026/014', DocumentStatus.Valid, '2026-01-14', '2027-01-13', 'Amit Verma'],
  ['Worker Safety Induction Register', DocumentCategory.Worker, 'WSI/2026/009', DocumentStatus.Valid, '2026-01-09', '2027-01-08', 'Sunil Kumar'],
  ['Blasting Magazine Licence', DocumentCategory.Safety, 'BML/2024/057', DocumentStatus.Expired, '2024-08-30', '2026-08-29', 'Deepak Sharma'],
  ['Effluent Monitoring Report Q2', DocumentCategory.Environment, 'EMR/2026/Q2', DocumentStatus.Valid, '2026-07-15', '2026-10-15', 'Rakesh Singh'],
  ['Dumper Fitness Certificates (Fleet)', DocumentCategory.Equipment, 'DFC/2026/115', DocumentStatus.Valid, '2026-03-01', '2027-02-28', 'Pawan Gupta'],
  ['Worker Medical Records — Batch 12', DocumentCategory.Worker, 'WMR/2026/B12', DocumentStatus.Pending, '2026-09-28', null, 'Sunil Kumar'],
  ['DGMS Statutory Report — Q2', DocumentCategory.Compliance, 'DSR/2026/Q2', DocumentStatus.Valid, '2026-07-10', '2026-10-10', 'Amit Verma'],
];

export const documents: OpsDocument[] = DOC_SEED.map(([name, category, refNo, status, issue, expiry, by], i) => ({
  id: `DOC-2026-${String(i + 1).padStart(3, '0')}`, name, category,
  mineId: category === DocumentCategory.Contractor ? (contractors[i % 12].mineIds[0]) : ['M-01', 'M-01', 'M-02', 'M-01', 'M-03', 'M-05'][i % 6],
  relatedKind: category === DocumentCategory.Contractor ? 'Contractor' : 'Mine',
  relatedId: category === DocumentCategory.Contractor ? contractors[i % 12].id : 'M-01',
  refNo, issueDate: issue, expiryDate: expiry, status, submittedBy: by,
  description: `${name} for demo mine operations records.`,
  file: { name: `${refNo.replace(/\//g, '-').toLowerCase()}.pdf`, sizeKb: ri(120, 2400), uploadedAt: `${issue}T10:00:00` },
  history: [
    { at: `${issue}T10:00:00`, by, action: 'Uploaded' as never, note: 'Document uploaded.' },
    ...(status === DocumentStatus.Valid ? [{ at: `${issue}T11:00:00`, by: 'Compliance Desk', action: 'Approved' as never, note: 'Verified and approved.' }] : []),
  ],
}));

// ---------- Inspections + findings + corrective actions ----------
export const inspections: Inspection[] = [
  { id: 'INSP-2026-056', mineId: 'M-01', type: InspectionType.Safety, date: '2026-10-06', inspector: 'R. K. Sharma', inspectorOrg: 'DGMS', status: InspectionStatusNew.Scheduled, priority: NotificationPriority.High, remarks: 'Statutory safety inspection — pit & haul road.', reportFile: null },
  { id: 'INSP-2026-055', mineId: 'M-03', type: InspectionType.Environment, date: '2026-10-08', inspector: 'A. Singh', inspectorOrg: 'State Pollution Board', status: InspectionStatusNew.Scheduled, priority: NotificationPriority.Medium, remarks: 'Environmental compliance check.', reportFile: null },
  { id: 'INSP-2026-054', mineId: 'M-02', type: InspectionType.Statutory, date: '2026-10-12', inspector: 'P. N. Verma', inspectorOrg: 'DGMS', status: InspectionStatusNew.Scheduled, priority: NotificationPriority.Medium, remarks: 'Statutory plan compliance.', reportFile: null },
  { id: 'INSP-2026-053', mineId: 'M-05', type: InspectionType.Mechanical, date: '2026-09-20', inspector: 'S. Tiwari', inspectorOrg: 'Internal Audit', status: InspectionStatusNew.Completed, priority: NotificationPriority.High, remarks: 'Conveyor & dumper condition review.', reportFile: 'insp-053-report.pdf' },
  { id: 'INSP-2026-052', mineId: 'M-04', type: InspectionType.Safety, date: '2026-09-18', inspector: 'K. Das', inspectorOrg: 'DGMS', status: InspectionStatusNew.Completed, priority: NotificationPriority.Low, remarks: 'Routine safety inspection.', reportFile: 'insp-052-report.pdf' },
  { id: 'INSP-2026-051', mineId: 'M-01', type: InspectionType.Electrical, date: '2026-09-28', inspector: 'V. Mehra', inspectorOrg: 'Internal Audit', status: InspectionStatusNew.InProgress, priority: NotificationPriority.Medium, remarks: 'Electrical installations audit.', reportFile: null },
  { id: 'INSP-2026-050', mineId: 'M-02', type: InspectionType.Safety, date: '2026-09-15', inspector: 'R. K. Sharma', inspectorOrg: 'DGMS', status: InspectionStatusNew.Completed, priority: NotificationPriority.Critical, remarks: 'Gas monitoring & ventilation review.', reportFile: 'insp-050-report.pdf' },
  { id: 'INSP-2026-049', mineId: 'M-05', type: InspectionType.Statutory, date: '2026-09-10', inspector: 'P. N. Verma', inspectorOrg: 'DGMS', status: InspectionStatusNew.Completed, priority: NotificationPriority.Low, remarks: 'Document & licence verification.', reportFile: 'insp-049-report.pdf' },
  { id: 'INSP-2026-048', mineId: 'M-01', type: InspectionType.Environment, date: '2026-09-05', inspector: 'A. Singh', inspectorOrg: 'State Pollution Board', status: InspectionStatusNew.Completed, priority: NotificationPriority.Medium, remarks: 'Dust & effluent monitoring.', reportFile: 'insp-048-report.pdf' },
  { id: 'INSP-2026-047', mineId: 'M-03', type: InspectionType.Other, date: '2026-09-02', inspector: 'S. Tiwari', inspectorOrg: 'Internal Audit', status: InspectionStatusNew.Cancelled, priority: NotificationPriority.Low, remarks: 'Postponed — heavy rain.', reportFile: null },
];

export const findings: InspectionFinding[] = [
  { id: 'FND-2026-018', inspectionId: 'INSP-2026-053', mineId: 'M-05', category: 'Mechanical', severity: FindingSeverity.Medium, status: FindingStatusNew.ActionAssigned, description: 'Conveyor belt alignment drift on CV-03.', location: 'CV-03', detectedAt: '2026-09-20' },
  { id: 'FND-2026-017', inspectionId: 'INSP-2026-053', mineId: 'M-05', category: 'Mechanical', severity: FindingSeverity.Low, status: FindingStatusNew.Resolved, description: 'Missing guard on dumper DB-14 ladder.', location: 'Workshop', detectedAt: '2026-09-20' },
  { id: 'FND-2026-016', inspectionId: 'INSP-2026-052', mineId: 'M-04', category: 'Safety', severity: FindingSeverity.Low, status: FindingStatusNew.Closed, description: 'PPE signage faded near Panel 2 entry.', location: 'Panel 2', detectedAt: '2026-09-18' },
  { id: 'FND-2026-015', inspectionId: 'INSP-2026-051', mineId: 'M-01', category: 'Electrical', severity: FindingSeverity.High, status: FindingStatusNew.ActionAssigned, description: 'Junction box JB-17 without earthing continuity tag.', location: 'Pit I', detectedAt: '2026-09-28' },
  { id: 'FND-2026-014', inspectionId: 'INSP-2026-050', mineId: 'M-02', category: 'Safety', severity: FindingSeverity.Critical, status: FindingStatusNew.Resolved, description: 'CH₄ exceeded 1% briefly at Panel 2 face.', location: 'Panel 2', detectedAt: '2026-09-15' },
  { id: 'FND-2026-013', inspectionId: 'INSP-2026-050', mineId: 'M-02', category: 'Safety', severity: FindingSeverity.Medium, status: FindingStatusNew.Closed, description: 'Ventilation plan not displayed at section entry.', location: 'UG Section A', detectedAt: '2026-09-15' },
  { id: 'FND-2026-012', inspectionId: 'INSP-2026-049', mineId: 'M-05', category: 'Documentation', severity: FindingSeverity.Low, status: FindingStatusNew.Closed, description: 'Explosive licence copy outdated on display board.', location: 'Office', detectedAt: '2026-09-10' },
  { id: 'FND-2026-011', inspectionId: 'INSP-2026-048', mineId: 'M-01', category: 'Environment', severity: FindingSeverity.Medium, status: FindingStatusNew.Open, description: 'Dust suppression sprinklers underperforming on haul road H-2.', location: 'Haul Road H-2', detectedAt: '2026-09-05' },
];

export const correctiveActions: CorrectiveAction[] = [
  { id: 'CA-2026-021', findingId: 'FND-2026-018', action: 'Re-align belt CV-03 and re-tension idlers.', owner: 'Global Mining Tech', dueDate: '2026-10-10', status: CorrectiveActionStatus.InProgress, resolutionNote: '' },
  { id: 'CA-2026-020', findingId: 'FND-2026-017', action: 'Weld and repaint ladder guard.', owner: 'Workshop Team', dueDate: '2026-09-24', status: CorrectiveActionStatus.Resolved, resolutionNote: 'Guard replaced.' },
  { id: 'CA-2026-019', findingId: 'FND-2026-016', action: 'Replace faded PPE signage.', owner: 'Safety Dept.', dueDate: '2026-09-22', status: CorrectiveActionStatus.Resolved, resolutionNote: 'Signage replaced.' },
  { id: 'CA-2026-018', findingId: 'FND-2026-015', action: 'Earth continuity testing and tagging of JB-17.', owner: 'Electrical Team', dueDate: '2026-10-08', status: CorrectiveActionStatus.InProgress, resolutionNote: '' },
  { id: 'CA-2026-017', findingId: 'FND-2026-014', action: 'Increase ventilation capacity at Panel 2; deploy additional fan.', owner: 'Ventilation Dept.', dueDate: '2026-09-19', status: CorrectiveActionStatus.Resolved, resolutionNote: 'Fan installed; readings normal.' },
  { id: 'CA-2026-016', findingId: 'FND-2026-013', action: 'Display ventilation plan at section entry.', owner: 'UG Section Incharge', dueDate: '2026-09-18', status: CorrectiveActionStatus.Resolved, resolutionNote: 'Plan displayed.' },
  { id: 'CA-2026-015', findingId: 'FND-2026-012', action: 'Update display board with current explosive licence.', owner: 'Office Admin', dueDate: '2026-09-14', status: CorrectiveActionStatus.Resolved, resolutionNote: 'Updated.' },
  { id: 'CA-2026-014', findingId: 'FND-2026-011', action: 'Service sprinkler line and add two nozzles on H-2.', owner: 'Nirmal Enterprises', dueDate: '2026-10-05', status: CorrectiveActionStatus.Open, resolutionNote: '' },
];

// ---------- Notifications ----------
export const notifications: OpsNotification[] = [
  { id: 'NOT-01', title: 'DGMS inspection scheduled — 06 Oct', body: 'Safety inspection at Bharatpur Coal Mine by R. K. Sharma.', category: NotificationCategory.Inspection, priority: NotificationPriority.High, timestamp: '2026-10-03T09:10:00', mineId: 'M-01', status: NotificationStatusNew.Unread, relatedKind: 'Inspection', relatedId: 'INSP-2026-056' },
  { id: 'NOT-02', title: 'Explosive licence expires in 12 days', body: 'EL/2024/112 expires on 15 Oct 2026. Renew immediately.', category: NotificationCategory.Compliance, priority: NotificationPriority.Critical, timestamp: '2026-10-03T08:40:00', mineId: 'M-01', status: NotificationStatusNew.Unread, relatedKind: 'Document', relatedId: 'DOC-2026-005' },
  { id: 'NOT-03', title: 'Bill BILL-2026-002 awaiting approval', body: 'Kailash Mining Services bill of ₹ 36,50,000 pending approval.', category: NotificationCategory.Bills, priority: NotificationPriority.Medium, timestamp: '2026-10-03T08:05:00', mineId: 'M-01', status: NotificationStatusNew.Unread, relatedKind: 'Bill', relatedId: 'BILL-2026-002' },
  { id: 'NOT-04', title: 'Attendance anomaly — 3 blocked workers', body: 'Blocked workers attempted entry at Gate 1 today.', category: NotificationCategory.Attendance, priority: NotificationPriority.High, timestamp: '2026-10-03T07:50:00', mineId: 'M-01', status: NotificationStatusNew.Unread, relatedKind: 'Access', relatedId: null },
  { id: 'NOT-05', title: 'Stock reconciliation variance — SP-03', body: 'Physical survey 340 MT below system stock at West Yard.', category: NotificationCategory.Production, priority: NotificationPriority.Medium, timestamp: '2026-10-02T17:20:00', mineId: 'M-01', status: NotificationStatusNew.Read, relatedKind: 'Stockpile', relatedId: 'STK-03' },
  { id: 'NOT-06', title: 'Corrective action overdue — CA-2026-014', body: 'Sprinkler servicing on Haul Road H-2 due 05 Oct.', category: NotificationCategory.Compliance, priority: NotificationPriority.High, timestamp: '2026-10-02T10:00:00', mineId: 'M-01', status: NotificationStatusNew.Unread, relatedKind: 'CorrectiveAction', relatedId: 'CA-2026-014' },
  { id: 'NOT-07', title: 'Dispatch pending — 12 trucks', body: '12 dispatches awaiting weighbridge confirmation today.', category: NotificationCategory.Production, priority: NotificationPriority.Low, timestamp: '2026-10-03T06:30:00', mineId: null, status: NotificationStatusNew.Read, relatedKind: null, relatedId: null },
  { id: 'NOT-08', title: 'Training expiring for 7 workers', body: 'Safety training certificates expire within 30 days.', category: NotificationCategory.Attendance, priority: NotificationPriority.Medium, timestamp: '2026-10-01T11:15:00', mineId: null, status: NotificationStatusNew.Acknowledged, relatedKind: null, relatedId: null },
  { id: 'NOT-09', title: 'Contractor approval pending — MSS', body: 'Mines Support Services application awaits operator approval.', category: NotificationCategory.System, priority: NotificationPriority.Medium, timestamp: '2026-09-30T15:40:00', mineId: null, status: NotificationStatusNew.Read, relatedKind: 'Contractor', relatedId: 'CTR-11' },
  { id: 'NOT-10', title: 'Weighbridge calibration due — WB-01', body: 'Calibration certificate expires 18 Oct 2026.', category: NotificationCategory.Production, priority: NotificationPriority.Medium, timestamp: '2026-09-29T09:00:00', mineId: 'M-01', status: NotificationStatusNew.Read, relatedKind: 'Document', relatedId: 'DOC-2026-006' },
];

// ---------- Audit (seeded history; runtime appends real actions) ----------
export const audit: OpsAuditEntry[] = [
  { id: 'AUD-0001', timestamp: '2026-10-03T09:00:00', user: 'Amit Verma', role: 'Mine Operator', module: 'Attendance', action: 'Bulk Import', resource: 'attendance', details: 'Daily attendance sheet imported for 03 Oct 2026.', before: null, after: '132 records', relatedId: null },
  { id: 'AUD-0002', timestamp: '2026-10-02T18:30:00', user: 'Amit Verma', role: 'Mine Operator', module: 'Bills', action: 'Approved', resource: 'BILL-2026-003', details: 'Bill BILL-2026-003 (Eastern Constructions) approved.', before: 'Pending', after: 'Approved', relatedId: 'BILL-2026-003' },
  { id: 'AUD-0003', timestamp: '2026-10-02T16:45:00', user: 'Survey Team', role: 'Contractor', module: 'Stockpile', action: 'Reconciled', resource: 'STK-03', details: 'Stock reconciliation recorded: variance −340 MT.', before: '17,980 MT', after: '17,640 MT', relatedId: 'STK-03' },
  { id: 'AUD-0004', timestamp: '2026-10-02T11:20:00', user: 'Amit Verma', role: 'Mine Operator', module: 'Documents', action: 'Approved', resource: 'DOC-2026-022', details: 'DGMS Statutory Report Q2 verified and approved.', before: 'Pending', after: 'Valid', relatedId: 'DOC-2026-022' },
  { id: 'AUD-0005', timestamp: '2026-10-01T14:05:00', user: 'Amit Verma', role: 'Mine Operator', module: 'Workers', action: 'Created', resource: 'WK-132', details: 'Worker WK-132 registered under Shakti Infra Pvt. Ltd.', before: null, after: 'Active', relatedId: 'W-0132' },
];

// ---------- Reports ----------
export const reports: OpsReport[] = [
  { id: 'RPT-2026-010', name: 'Production Report — Bharatpur (01–03 Oct 2026)', type: ReportType.Production, mineId: 'M-01', from: '2026-10-01', to: '2026-10-03', generatedAt: '2026-10-03T09:30:00', generatedBy: 'Amit Verma', status: ReportStatus.Ready, rowCount: 9, csv: '', scheduled: false },
  { id: 'RPT-2026-009', name: 'Dispatch Report — All Mines (Sep 2026)', type: ReportType.Dispatch, mineId: 'ALL', from: '2026-09-01', to: '2026-09-30', generatedAt: '2026-10-01T10:00:00', generatedBy: 'Amit Verma', status: ReportStatus.Ready, rowCount: 62, csv: '', scheduled: false },
  { id: 'RPT-2026-008', name: 'Manpower Report — Contractor-wise (Sep 2026)', type: ReportType.Manpower, mineId: 'ALL', from: '2026-09-01', to: '2026-09-30', generatedAt: '2026-09-30T16:20:00', generatedBy: 'Amit Verma', status: ReportStatus.Ready, rowCount: 132, csv: '', scheduled: false },
  { id: 'RPT-2026-007', name: 'Financial Report — Bills Q2 FY26-27', type: ReportType.Financial, mineId: 'ALL', from: '2026-07-01', to: '2026-09-30', generatedAt: '2026-09-29T12:10:00', generatedBy: 'Finance Desk', status: ReportStatus.Ready, rowCount: 12, csv: '', scheduled: true },
  { id: 'RPT-2026-006', name: 'Compliance Report — Documents expiry watch', type: ReportType.Compliance, mineId: 'M-01', from: '2026-09-01', to: '2026-10-31', generatedAt: '2026-09-28T09:00:00', generatedBy: 'Compliance Desk', status: ReportStatus.Ready, rowCount: 22, csv: '', scheduled: true },
  { id: 'RPT-2026-005', name: 'Stockpile Report — Grades summary (Sep 2026)', type: ReportType.Stockpile, mineId: 'M-01', from: '2026-09-01', to: '2026-09-30', generatedAt: '2026-09-27T08:40:00', generatedBy: 'Amit Verma', status: ReportStatus.Draft, rowCount: 6, csv: '', scheduled: false },
];

// ---------- User + settings + sessions ----------
export const opsUser: OperationsUser = {
  id: 'OPS-U1', name: 'Amit Verma', email: 'amit.verma@bccl.example', phone: '+91-98765-43210',
  role: 'Mine Operator', employeeId: 'EMP-001', department: 'Operations', language: 'English',
  minePermissions: ['M-01', 'M-02', 'M-03', 'M-04', 'M-05'], homeMineId: 'M-01',
  sessions: [
    { id: 'SES-01', device: 'Windows • Chrome', browser: 'Chrome 129', location: 'Dhanbad, India', lastActive: '2026-10-03T10:15:00', current: true },
    { id: 'SES-02', device: 'Android • Chrome', browser: 'Chrome Mobile', location: 'Dhanbad, India', lastActive: '2026-10-02T18:42:00', current: false },
    { id: 'SES-03', device: 'Windows • Edge', browser: 'Edge 128', location: 'Ranchi, India', lastActive: '2026-09-28T16:10:00', current: false },
  ],
};

export const defaultSettings = (): OperationsSettings => ({
  notifications: { attendance: true, inspection: true, compliance: true, bills: false, system: true, production: true, email: true, sms: false },
  display: { theme: ThemeSetting.Light, dateFormat: DateFormatSetting.DMY, timeFormat: TimeFormatSetting.H12, numberFormat: NumberFormatSetting.Indian, itemsPerPage: 10, defaultMineId: 'M-01' },
});

// ---------- Simulated sensors / environment / cameras ----------
export const gasSensors: GasSensor[] = mines.flatMap((m) => {
  const base = { mineId: m.id, at: DEMO_NOW_ISO };
  const bump = m.id === 'M-01' ? 0 : m.id === 'M-02' ? 0.3 : -0.1;
  return [
    { ...base, param: GasParam.CH4, value: Number((0.8 + bump).toFixed(1)), unit: '%', threshold: '< 1%', status: SensorStatus.Normal },
    { ...base, param: GasParam.CO, value: Math.round(12 + bump * 20), unit: 'ppm', threshold: '< 25 ppm', status: SensorStatus.Normal },
    { ...base, param: GasParam.O2, value: Number((20.6 - bump).toFixed(1)), unit: '%', threshold: '19.5 – 23.5%', status: SensorStatus.Normal },
    { ...base, param: GasParam.H2S, value: Math.max(0, Math.round(2 + bump * 4)), unit: 'ppm', threshold: '< 10 ppm', status: SensorStatus.Normal },
  ];
});

export const gasTrend: GasTrendPoint[] = Array.from({ length: 25 }, (_, i) => ({
  hour: ['12 AM', '1 AM', '2 AM', '3 AM', '4 AM', '5 AM', '6 AM', '7 AM', '8 AM', '9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM', '6 PM', '7 PM', '8 PM', '9 PM', '10 PM', '11 PM', '12 AM'][i],
  ch4: rf(0.4, 1.1, 2), co: rf(6, 14, 1), o2: rf(20.2, 21.0, 1), h2s: rf(0, 3, 1),
}));

export const envConditions: EnvConditions[] = mines.map((m) => ({
  mineId: m.id, tempC: m.id === 'M-01' ? 28 : ri(24, 32), humidityPct: m.id === 'M-01' ? 72 : ri(55, 85),
  airVelocityMs: m.id === 'M-01' ? 0.5 : rf(0.3, 1.2, 1), dustPm25: m.id === 'M-01' ? 68 : ri(35, 120),
}));

export const cameras: CameraFeed[] = mines.flatMap((m) => [
  { id: `CAM-${m.code}-1`, mineId: m.id, label: `${m.code} | Main Tunnel`, lastSeen: DEMO_NOW_ISO, note: 'Still frame (demo)' },
  { id: `CAM-${m.code}-2`, mineId: m.id, label: `${m.code} | Pit I Dumping Point`, lastSeen: DEMO_NOW_ISO, note: 'Still frame (demo)' },
  { id: `CAM-${m.code}-3`, mineId: m.id, label: `${m.code} | Stockyard Gate`, lastSeen: DEMO_NOW_ISO, note: 'Still frame (demo)' },
]);

// ---------- Gate access log (today, workers + vehicles) ----------
export const accessRecords: AccessRecord[] = (() => {
  const out: AccessRecord[] = [];
  let n = 0;
  const todays = attendance.filter((a) => a.date === DEMO_TODAY && a.inTime);
  for (const a of todays.slice(0, 40)) {
    const w = workers.find((x) => x.id === a.workerId)!;
    out.push({ id: `ACS-${String(++n).padStart(4, '0')}`, subject: w.name, subjectKind: 'Worker', workerId: w.id, mineId: w.mineId, type: 'Entry', time: a.inTime!, date: DEMO_TODAY, gate: `Gate ${ri(1, 3)}`, result: w.accessStatus, reason: w.accessStatus === AccessStatus.Blocked ? 'Training / compliance hold' : null });
    if (a.outTime) out.push({ id: `ACS-${String(++n).padStart(4, '0')}`, subject: w.name, subjectKind: 'Worker', workerId: w.id, mineId: w.mineId, type: 'Exit', time: a.outTime, date: DEMO_TODAY, gate: `Gate ${ri(1, 3)}`, result: AccessStatus.Allowed, reason: null });
  }
  const gateT = ['10:45 AM', '10:42 AM', '10:38 AM', '10:31 AM', '10:28 AM', '10:12 AM', '09:58 AM', '09:41 AM'];
  for (let i = 0; i < 8; i++) {
    out.push({ id: `ACS-${String(++n).padStart(4, '0')}`, subject: VEHICLE_NOS[i], subjectKind: 'Vehicle', workerId: null, mineId: 'M-01', type: i % 4 === 3 ? 'Exit' : 'Entry', time: gateT[i], date: DEMO_TODAY, gate: `Gate ${(i % 3) + 1}`, result: AccessStatus.Allowed, reason: null });
  }
  // A few blocked attempts.
  for (const w of workers.filter((x) => x.accessStatus === AccessStatus.Blocked).slice(0, 3)) {
    out.push({ id: `ACS-${String(++n).padStart(4, '0')}`, subject: w.name, subjectKind: 'Worker', workerId: w.id, mineId: w.mineId, type: 'Entry', time: hhmm(ri(6, 9), ri(0, 59)), date: DEMO_TODAY, gate: 'Gate 1', result: AccessStatus.Blocked, reason: w.trainingStatus === TrainingStatus.NotTrained ? 'Safety training not completed' : 'Training certificate expired' });
  }
  return out;
})();
