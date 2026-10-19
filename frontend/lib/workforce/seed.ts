/**
 * Deterministic synthetic dataset for the MineNetr contractor portal.
 *
 * Covers every contractor page (Dashboard, Workers & Manpower, Attendance &
 * Access, Bills & Transactions, Documents & Compliance, Reports, Notifications)
 * from ONE coherent dataset:
 *   482 workers  ·  8 contractors  ·  776 training records  ·  482 attendance
 *   919 access events  ·  24 leave records  ·  18 gate passes  ·  12 bills
 *   8 payments  ·  128 documents  ·  10 transfer requests  ·  24 incidents
 *   24 notifications  ·  14 report definitions
 *
 * Nothing is random at runtime — every id and date is a pure function of the
 * record index, so the dataset (and every KPI derived from it) is identical on
 * every load until a demo action mutates it. All figures are fictional.
 *
 * Mines + the signed-in contractor identity are re-used from lib/contracts/seed
 * so the workforce portal and "My Contracts" can never drift apart.
 */
import {
  AttendanceStatus, AccessStatus, BillStatus, CorrectiveStatus, ContractorStatus,
  DocumentStatus, IncidentStatus, Severity, TransferStatus,
  WorkerStatus, GATES,
  type AccessRecord, type ActivityEntry, type AttendanceRecord, type Bill,
  type Contractor, type CorrectiveAction, type GatePass, type Incident,
  type LeaveRecord, type Payment, type PortalDocument, type PortalNotification,
  type ReportRow, type TrainingRecord, type TransferRequest, type Worker,
} from './types';
import { DEMO_TODAY } from '../contracts/types';
import { mines as contractMines, contractor as identity } from '../contracts/seed';
import { addDays } from './format';

export const mines = contractMines;
export const identityContractor = identity;

/** Total deployed workforce — reproduces the reference "482". */
export const TOTAL_WORKERS = 482;

// ---------- helpers ----------
/** Exact-count, smoothly interleaved allocation (no RNG). */
export function allocateIdx(n: number, portions: number[]): number[] {
  const total = portions.reduce((s, p) => s + p, 0);
  if (total !== n) throw new Error(`allocateIdx: portions sum ${total} !== n ${n}`);
  const acc = portions.map(() => 0);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    let best = 0; let bestGap = -Infinity;
    for (let k = 0; k < portions.length; k++) {
      const gap = ((i + 1) * portions[k]) / total - acc[k];
      if (gap > bestGap) { bestGap = gap; best = k; }
    }
    out.push(best); acc[best]++;
  }
  return out;
}

const pad = (n: number, w = 4) => String(n).padStart(w, '0');

// ---------- Contractors (8) ----------
const CONTRACTOR_DEFS: { id: string; name: string; mineId: string; person: string; scope: string; value: number }[] = [
  { id: identity.id, name: identity.name, mineId: 'M-01', person: 'Rakesh Kumar', scope: 'Integrated site workforce deployment — overburden removal, haulage and site services.', value: 24.8e7 },
  { id: 'CONT-0002', name: 'Bharat Earthworks & Logistics Pvt. Ltd.', mineId: 'M-01', person: 'Vikram Sahu', scope: 'Overburden excavation and internal haulage support.', value: 9.4e7 },
  { id: 'CONT-0003', name: 'Shakti Heavy Haulage Pvt. Ltd.', mineId: 'M-02', person: 'Naresh Mahto', scope: 'Coal and material haulage with tipper fleet.', value: 7.6e7 },
  { id: 'CONT-0004', name: 'Navbharat Site Services', mineId: 'M-01', person: 'Purnima Oraon', scope: 'Housekeeping, security and facility management.', value: 5.1e7 },
  { id: 'CONT-0005', name: 'Delta Drilltech Pvt. Ltd.', mineId: 'M-02', person: 'Anil Tigga', scope: 'Blast-hole drilling and exploration support.', value: 6.2e7 },
  { id: 'CONT-0006', name: 'Suryanam Equipment Care LLP', mineId: 'M-02', person: 'Dinesh Patel', scope: 'HEMM preventive and corrective maintenance.', value: 4.3e7 },
  { id: 'CONT-0007', name: 'Greenfield Reclamation Trust', mineId: 'M-03', person: 'Meera Oraon', scope: 'Dump reclamation, topsoil replacement and plantation.', value: 2.4e7 },
  { id: 'CONT-0008', name: 'Ujjwal Security & Facility Services', mineId: 'M-03', person: 'S. Chaudhary', scope: 'Perimeter security and CCTV surveillance.', value: 3.1e7 },
];

const REQUIRED_DOCS = ['GST Registration', 'EPFO Registration', 'ESIC Registration', 'Signed Contract Agreement'];

export const contractors: Contractor[] = CONTRACTOR_DEFS.map((c, i) => ({
  id: c.id,
  name: c.name,
  contractNumber: `EMS/CN/${2024 + (i % 2)}-${pad(11 + i, 3)}`,
  registrationNumber: `U4520${pad(90 + i, 2)}CH${pad(1337 + i * 7, 4)}`,
  contactPerson: c.person,
  phone: `+91${(9822010000 + i * 4321).toString()}`,
  email: `${c.person.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '')}@${c.name.toLowerCase().replace(/[^a-z]+/g, '').slice(0, 12)}.in`,
  mineId: c.mineId,
  contractStart: addDays(DEMO_TODAY, -(420 + i * 37)),
  contractEnd: addDays(DEMO_TODAY, 210 + i * 45),
  contractValue: c.value,
  status: i === 0 ? ContractorStatus.Active : i === 6 ? ContractorStatus.Suspended : ContractorStatus.Active,
  requiredDocuments: REQUIRED_DOCS,
  isSelf: i === 0,
  scope: c.scope,
}));

// ---------- Name pools (deterministic, no per-render randomness) ----------
const FIRST: [string, 'Male' | 'Female'][] = [
  ['Ramesh', 'Male'], ['Suresh', 'Male'], ['Mahesh', 'Male'], ['Dinesh', 'Male'], ['Rakesh', 'Male'],
  ['Santosh', 'Male'], ['Prakash', 'Male'], ['Rajesh', 'Male'], ['Naresh', 'Male'], ['Mukesh', 'Male'],
  ['Sunil', 'Male'], ['Anil', 'Male'], ['Vijay', 'Male'], ['Ajay', 'Male'], ['Sanjay', 'Male'],
  ['Manoj', 'Male'], ['Pintu', 'Male'], ['Sushil', 'Male'], ['Kartik', 'Male'], ['Ganesh', 'Male'],
  ['Bhola', 'Male'], ['Shivendra', 'Male'], ['Laxman', 'Male'], ['Devendra', 'Male'], ['Umesh', 'Male'],
  ['Sunita', 'Female'], ['Geeta', 'Female'], ['Sita', 'Female'], ['Kamla', 'Female'], ['Muna', 'Female'],
  ['Asha', 'Female'], ['Rekha', 'Female'], ['Purnima', 'Female'], ['Sabita', 'Female'], ['Anjali', 'Female'],
  ['Kiran', 'Male'], ['Nirmala', 'Female'], ['Savitri', 'Female'], ['Rahul', 'Male'], ['Amit', 'Male'],
  ['Prafull', 'Male'], ['Birendra', 'Male'], ['Hemant', 'Male'], ['Jitendra', 'Male'], ['Kalu', 'Male'],
  ['Nandu', 'Male'], ['Rita', 'Female'], ['Mangla', 'Female'], ['Balu', 'Male'], ['Tara', 'Female'], ['Pawan', 'Male'],
];

const LAST = ['Mahto', 'Oraon', 'Tigga', 'Soren', 'Kharwar', 'Patel', 'Yadav', 'Sahu', 'Hembram', 'Minj'];

const ZONES: Record<string, string[]> = {
  'M-01': ['North Pit OB Bench', 'Coal Face 3', 'Main Haul Road', 'Washery Circuit', 'Siding & Stockyard', 'Workshop Bay 2'],
  'M-02': ['West Push OB Bench', 'Exploration Grid 7', 'Sump & Drainage', 'HEMM Workshop', 'Tippler Area', 'Reclamation Dump'],
  'M-03': ['East Coal Face', 'CCTV Control Room', 'Perimeter Gate Line', 'Reclaimed Dump', 'Charging Station', 'Disposal Area'],
};

const SUPERVISORS = ['Sunil Mahto', 'R. Vishwakarma', 'Anil Tigga', 'Meera Oraon', 'S. Chaudhary', 'Dinesh Patel', 'K. R. Sahu'];

// Designation mix (counts sum to TOTAL_WORKERS).
const DESIG_MIX: [string, number][] = [
  ['Dump Truck Operator', 118], ['Excavator Operator', 39], ['Maintenance Fitter', 39], ['Security Guard', 34],
  ['Shovel Operator', 29], ['HEMM Operator', 29], ['Dozer Operator', 24], ['Loader Operator', 24],
  ['Electrician', 24], ['Housekeeping Staff', 24], ['Blasting Assistant', 19], ['Welder', 14],
  ['Surveyor', 10], ['Safety Officer', 10], ['Store Keeper', 10], ['Drainage Pump Operator', 10],
  ['Belt Conveyor Operator', 10], ['Lab Technician', 5], ['Grill Cutter', 5], ['Site Supervisor', 5],
];

const DESIG_DEPT: Record<string, string> = {
  'Dump Truck Operator': 'Haulage & Transport',
  'Excavator Operator': 'Mining',
  'Shovel Operator': 'Mining',
  'Dozer Operator': 'Mining',
  'Loader Operator': 'Mining',
  'HEMM Operator': 'Mining',
  'Belt Conveyor Operator': 'Mining',
  'Drainage Pump Operator': 'Mining',
  'Maintenance Fitter': 'Maintenance',
  Welder: 'Workshop',
  Electrician: 'Electrical',
  'Blasting Assistant': 'Blasting & Drilling',
  Surveyor: 'Survey & Planning',
  'Safety Officer': 'Safety',
  'Security Guard': 'Security',
  'Housekeeping Staff': 'Housekeeping & Utility',
  'Grill Cutter': 'Housekeeping & Utility',
  'Store Keeper': 'Stores & Logistics',
  'Lab Technician': 'Environmental & Reclamation',
  'Site Supervisor': 'Mining',
};

const DESIG_CERT: Record<string, string> = {
  'Dump Truck Operator': 'Equipment Operation',
  'Excavator Operator': 'Equipment Operation',
  'Shovel Operator': 'Equipment Operation',
  'Dozer Operator': 'Equipment Operation',
  'Loader Operator': 'Equipment Operation',
  'HEMM Operator': 'Equipment Operation',
  'Belt Conveyor Operator': 'Equipment Operation',
  Electrician: 'Electrical Safety',
  Welder: 'Electrical Safety',
  'Maintenance Fitter': 'Working at Heights',
  'Blasting Assistant': 'Explosive Handling',
  'Safety Officer': 'First Aid',
  Surveyor: 'Working at Heights',
  'Site Supervisor': 'Emergency Response',
};

const ABBR: Record<string, string> = {
  'Mine Safety Induction': 'MSI', 'First Aid': 'FA', 'Emergency Response': 'ER',
  'Equipment Operation': 'EO', 'Electrical Safety': 'ES', 'Working at Heights': 'WA',
  'Explosive Handling': 'EH',
};

const PROVIDERS = [
  'DGMS Approved Training Institute, Korba',
  'Mine Safety Training Institute, Angul',
  'SAIL Safety Training Centre, Dhanbad',
  'Indian Red Cross First Aid Wing, Korba',
  'Northern Coalfields Equipment Operator School',
];

const phone = (i: number) => {
  const d = (9400000000 + ((i * 7919) % 90000000)).toString();
  return d;
};

// ---------- Workers (482) ----------
export const workerMines = allocateIdx(TOTAL_WORKERS, [245, 156, 81]); // M-01 / M-02 / M-03
export const workerContractors = allocateIdx(TOTAL_WORKERS, [172, 74, 63, 58, 41, 36, 22, 16]);
export const workerStatuses = allocateIdx(TOTAL_WORKERS, [447, 20, 15]); // Active / Inactive / Blocked
const designationsSeq = allocateIdx(TOTAL_WORKERS, DESIG_MIX.map(([, n]) => n));

// Attendance for the demo day, constrained by worker status so the two never
// contradict each other (a blocked worker can never be shown as Present).
const activeIdx: number[] = []; const nonActiveIdx: number[] = [];
workerStatuses.forEach((s, i) => (s === 0 ? activeIdx : nonActiveIdx).push(i));
const activeAttendance = allocateIdx(activeIdx.length, [415, 24, 8]); // Present / Absent / On Leave
const nonActiveAttendance = allocateIdx(nonActiveIdx.length, [28, 7]); // Absent / Not Marked

export const attendanceToday: Record<number, number> = {}; // worker index → AttendanceStatus enum value
activeIdx.forEach((w, k) => { attendanceToday[w] = activeAttendance[k]; });
nonActiveIdx.forEach((w, k) => { attendanceToday[w] = nonActiveAttendance[k] === 0 ? 1 : 3; });

export const workers: Worker[] = Array.from({ length: TOTAL_WORKERS }, (_, i) => {
  const [fname, gender] = FIRST[i % FIRST.length];
  const mineId = mines[workerMines[i]].id;
  const designation = DESIG_MIX[designationsSeq[i]][0];
  return {
    id: `WORK-${pad(i + 1)}`,
    name: `${fname} ${LAST[Math.floor(i / FIRST.length) % LAST.length]}`,
    contractorId: contractors[workerContractors[i]].id,
    designation,
    department: DESIG_DEPT[designation],
    mineId,
    contact: phone(i + 11),
    joiningDate: addDays(DEMO_TODAY, -(60 + ((i * 13) % 1500))),
    emergencyContact: phone(i + 5100),
    gender,
    status: workerStatuses[i] === 0 ? WorkerStatus.Active : workerStatuses[i] === 1 ? WorkerStatus.Inactive : WorkerStatus.Blocked,
    shift: (['A', 'B', 'C'] as const)[i % 3],
    workZone: ZONES[mineId][i % ZONES[mineId].length],
    supervisor: SUPERVISORS[i % SUPERVISORS.length],
  };
});

// ---------- Training records (776) ----------
function trainingDates(bucket: number, i: number): { completion: string; expiry: string; verified: boolean } {
  if (bucket === 0) return { completion: addDays(DEMO_TODAY, -520), expiry: addDays(DEMO_TODAY, -35), verified: true };
  if (bucket === 1) return { completion: addDays(DEMO_TODAY, -700), expiry: addDays(DEMO_TODAY, 5 + (i % 50)), verified: true };
  if (bucket === 2) return { completion: addDays(DEMO_TODAY, -15), expiry: addDays(DEMO_TODAY, 715), verified: false };
  const completion = addDays(DEMO_TODAY, -(150 + (i % 480)));
  return { completion, expiry: addDays(completion, 730), verified: true };
}

/** Worker's mandatory-certification bucket: 0 expired · 1 expiring · 2 pending · 3 valid. */
export function trainingBucket(i: number): number {
  const b = i % 100;
  if (b < 5) return 0;
  if (b < 10) return 1;
  if (b < 12) return 2;
  return 3;
}

export const trainingRecords: TrainingRecord[] = (() => {
  const out: TrainingRecord[] = [];
  let n = 1;
  const push = (workerIndex: number, type: string, bucket: number, mandatory: boolean) => {
    const { completion, expiry, verified } = trainingDates(bucket, workerIndex);
    out.push({
      id: `CERT-${pad(n++)}`,
      workerId: workers[workerIndex].id,
      type,
      certificationNumber: `${ABBR[type] ?? 'MSC'}-${completion.slice(0, 4)}-${pad(((workerIndex * 37) % 90000) + 1, 5)}`,
      completionDate: completion,
      expiryDate: expiry,
      provider: PROVIDERS[(workerIndex + type.length) % PROVIDERS.length],
      mandatory,
      verified,
    });
  };
  for (let i = 0; i < TOTAL_WORKERS; i++) {
    push(i, 'Mine Safety Induction', trainingBucket(i), true); // mandatory for everyone
    if (i % 2 === 0) {
      const b2 = (i * 7 + 3) % 100;
      push(i, DESIG_CERT[workers[i].designation] ?? 'Emergency Response', b2 < 4 ? 0 : b2 < 12 ? 1 : 3, true);
    }
    if (i % 9 === 0) {
      const b3 = (i * 11 + 5) % 100;
      push(i, 'First Aid', b3 < 3 ? 0 : b3 < 10 ? 1 : 3, false);
    }
  }
  return out;
})();

// ---------- Attendance (today, one record per worker) ----------
const DENY_REASONS = [
  'Biometric mismatch at gate terminal',
  'PPE (helmet + lamp) not produced at gate check',
  'Safety induction certificate expired — re-verification required',
  'Deployment slip not signed by mine planning office',
  'Gate closed after shift-change cut-off time',
];

export const attendance: AttendanceRecord[] = workers.map((w, i) => {
  const st = attendanceToday[i];
  const status = st === 0 ? AttendanceStatus.Present : st === 1 ? AttendanceStatus.Absent : st === 2 ? AttendanceStatus.OnLeave : AttendanceStatus.NotMarked;
  const inTime = status === AttendanceStatus.Present ? `${6 + (i % 3)}:${String((i * 7) % 60).padStart(2, '0')}` : '—';
  const outTime = status === AttendanceStatus.Present && i % 4 === 0
    ? `${16 + (i % 2)}:${String((i * 13) % 60).padStart(2, '0')}` : '—';
  return {
    id: `ATT-${pad(i + 1)}`,
    workerId: w.id,
    date: DEMO_TODAY,
    status,
    inTime,
    outTime,
    gate: GATES[i % GATES.length],
    method: i % 13 === 0 ? 'Manual' : 'Biometric',
  };
});

export const onLeaveWorkerIdx = workers.map((_, i) => i).filter((i) => attendanceToday[i] === 2);
export const absentWorkerIdx = workers.map((_, i) => i).filter((i) => attendanceToday[i] === 1);
export const notMarkedWorkerIdx = workers.map((_, i) => i).filter((i) => attendanceToday[i] === 3);

// ---------- Access records (today's gate log + one prior event per worker) ----------
export const accessRecords: AccessRecord[] = (() => {
  const out: AccessRecord[] = [];
  let n = 1;
  const add = (i: number, status: AccessStatus, timestamp: string, reason: string, direction: 'Entry' | 'Exit') => {
    const w = workers[i];
    out.push({
      id: `ACCESS-${pad(n++)}`, workerId: w.id, contractorId: w.contractorId, mineId: w.mineId,
      gate: GATES[i % GATES.length], status, timestamp, reason, direction,
    });
  };
  // Today — one entry event per present worker.
  workers.forEach((_, i) => {
    if (attendanceToday[i] === 0) {
      add(i, AccessStatus.Allowed, `${DEMO_TODAY}T${attendance[i].inTime}:00+05:30`, 'Cleared biometric verification', 'Entry');
    }
  });
  // Today — denied attempts (first 15 absent workers) with plausible reasons.
  absentWorkerIdx.slice(0, 15).forEach((i, k) => {
    add(i, AccessStatus.Denied, `${DEMO_TODAY}T0${6 + (k % 3)}:${String((k * 11) % 60).padStart(2, '0')}:00+05:30`, DENY_REASONS[k % DENY_REASONS.length], 'Entry');
  });
  // Today — blocked workers (the 7 "Not Marked" today).
  notMarkedWorkerIdx.forEach((i, k) => {
    add(i, AccessStatus.Blocked, `${DEMO_TODAY}T07:${String((k * 9) % 60).padStart(2, '0')}:00+05:30`,
      k % 2 === 0 ? 'Access blocked — contractor deployment suspended by mine office' : 'Access blocked — mandatory safety induction expired', 'Entry');
  });
  // Prior events so every worker has a browsable access history.
  workers.forEach((_, i) => {
    const d = addDays(DEMO_TODAY, i % 2 === 0 ? -1 : -2);
    const denied = i % 11 === 0;
    add(i, denied ? AccessStatus.Denied : AccessStatus.Allowed, `${d}T0${6 + (i % 3)}:${String((i * 7) % 60).padStart(2, '0')}:00+05:30`,
      denied ? DENY_REASONS[i % DENY_REASONS.length] : 'Cleared biometric verification', 'Entry');
  });
  return out;
})();

// ---------- Leave + gate passes ----------
export const leaves: LeaveRecord[] = (() => {
  const out: LeaveRecord[] = [];
  const types: LeaveRecord['type'][] = ['Casual Leave', 'Sick Leave', 'Earned Leave', 'Compensatory Off'];
  const reasons = ['Family function at native place', 'Medical treatment — reported fever', 'Personal work', 'Observance of festival', 'Attending court hearing', 'Seasonal agriculture work'];
  // 8 approved leaves covering the workers shown as "On Leave" today.
  onLeaveWorkerIdx.forEach((w, k) => {
    out.push({
      id: `LV-${pad(out.length + 1)}`, workerId: workers[w].id, from: addDays(DEMO_TODAY, -(k % 3)), to: DEMO_TODAY,
      type: types[k % types.length], reason: reasons[k % reasons.length], status: 'Approved', appliedOn: addDays(DEMO_TODAY, -(5 + k)),
    });
  });
  // Remaining pipeline: pending / rejected / completed.
  const extra = [6, 14, 22, 31, 44, 57, 66, 78, 91, 104, 119, 133, 147, 158, 172];
  extra.forEach((w, k) => {
    const st: LeaveRecord['status'] = k < 6 ? 'Pending' : k < 9 ? 'Rejected' : 'Completed';
    out.push({
      id: `LV-${pad(out.length + 1)}`, workerId: workers[w].id,
      from: addDays(DEMO_TODAY, st === 'Pending' ? 3 + k : -(30 + k)), to: addDays(DEMO_TODAY, st === 'Pending' ? 5 + k : -(28 + k)),
      type: types[k % types.length], reason: reasons[k % reasons.length], status: st, appliedOn: addDays(DEMO_TODAY, -(9 + k)),
    });
  });
  return out;
})();

export const gatePasses: GatePass[] = (() => {
  const out: GatePass[] = [];
  const vehicles = ['HR-38-C-4471', 'CG-10-Z-8802', 'CG-12-A-1194', 'OD-05-M-6620', 'JH-10-B-3381', 'CG-04-L-7715'];
  const purposes = ['Material gate pass — spares movement', 'Vehicle exit for workshop repair', 'Contractor staff transport', 'Tool and tackle movement', 'Visitor accompanied entry', 'Explosives van escorted movement'];
  const statuses: GatePass['status'][] = ['Issued', 'Used', 'Expired', 'Revoked'];
  for (let k = 0; k < 18; k++) {
    const w = (k * 26) % TOTAL_WORKERS;
    out.push({
      id: `GP-${pad(k + 1)}`, workerId: workers[w].id, vehicle: vehicles[k % vehicles.length],
      purpose: purposes[k % purposes.length], issuedOn: addDays(DEMO_TODAY, -(k % 12)),
      validTill: addDays(DEMO_TODAY, k % 7 === 0 ? -(2 + (k % 5)) : 2 + (k % 9)),
      status: statuses[k % 4],
    });
  }
  return out;
})();

// ---------- Bills + payments ----------
const BILL_DEFS: [string, number, BillStatus, string, number][] = [
  // contractId, amount, status, workPeriod, billDate offset (days from today)
  ['CT-BCM-001', 520000, BillStatus.Approved, '01 Sep 2026 – 30 Sep 2026', 2],
  ['CT-BCM-002', 410000, BillStatus.Approved, '01 Sep 2026 – 30 Sep 2026', 2],
  ['CT-NBM-001', 360000, BillStatus.Approved, '01 Sep 2026 – 30 Sep 2026', 3],
  ['CT-EFM-003', 300000, BillStatus.Approved, '01 Sep 2026 – 30 Sep 2026', 3],
  ['CT-BCM-001', 260000, BillStatus.Approved, '16 Sep 2026 – 30 Sep 2026', 4],
  ['CT-BCM-002', 210000, BillStatus.Approved, '01 Sep 2026 – 15 Sep 2026', 4],
  ['CT-NBM-001', 240000, BillStatus.Pending, '01 Oct 2026 – 03 Oct 2026', 1],
  ['CT-BCM-001', 175000, BillStatus.Pending, '01 Oct 2026 – 03 Oct 2026', 1],
  ['CT-EFM-003', 135000, BillStatus.Pending, '01 Oct 2026 – 03 Oct 2026', 0],
  ['CT-BCM-002', 130000, BillStatus.Pending, '16 Sep 2026 – 30 Sep 2026', 2],
  ['CT-NBM-001', 60000, BillStatus.Rejected, '16 Aug 2026 – 31 Aug 2026', 12],
  ['CT-EFM-003', 40000, BillStatus.Rejected, '01 Aug 2026 – 15 Aug 2026', 20],
];

export const bills: Bill[] = BILL_DEFS.map(([contractId, amount, status, period, off], i) => {
  const mineId = ({ 'CT-BCM-001': 'M-01', 'CT-BCM-002': 'M-01', 'CT-NBM-001': 'M-02', 'CT-EFM-003': 'M-03' } as Record<string, string>)[contractId] ?? 'M-01';
  return {
    id: `BILL-2026-${pad(i + 1, 3)}`,
    contractId, mineId,
    invoiceNumber: `EMS/2026-27/${pad(14 + i, 3)}`,
    workPeriod: period,
    billDate: addDays(DEMO_TODAY, -off),
    amount,
    status,
    submittedBy: 'Rakesh Kumar',
    description: `Manpower deployment and equipment charges for ${period}.`,
    decidedOn: status === BillStatus.Approved ? addDays(DEMO_TODAY, -(off - 1)) : status === BillStatus.Rejected ? addDays(DEMO_TODAY, -(off - 4)) : undefined,
    decisionNote: status === BillStatus.Approved ? 'Verified against attendance and gate logs — approved for payment.'
      : status === BillStatus.Rejected ? 'Rejected: shift hours claimed exceed gate-entry records. Submit a revised claim.'
        : undefined,
    acknowledged: status !== BillStatus.Pending && i % 2 === 0,
  };
});

export const payments: Payment[] = (() => {
  const rows: [number, number, number, Payment['mode']][] = [
    [0, 520000, 1, 'NEFT'], [1, 410000, 1, 'NEFT'], [2, 260000, 2, 'RTGS'], [2, 100000, 5, 'NEFT'],
    [3, 200000, 2, 'RTGS'], [3, 100000, 6, 'NEFT'], [4, 260000, 3, 'NEFT'], [5, 210000, 3, 'Cheque'],
  ];
  return rows.map(([b, amount, off, mode], i) => ({
    id: `PAY-2026-${pad(i + 1, 3)}`,
    billId: `BILL-2026-${pad(b + 1, 3)}`,
    amount, date: addDays(DEMO_TODAY, -off), mode,
    reference: `${mode === 'Cheque' ? 'CHQ' : 'UTR'}26${pad(9000 + i * 37, 6)}`,
  }));
})();

// ---------- Documents (128) ----------
// Contract docs occupy indices 0–31 (4 per contractor × 8), then worker (32–81),
// equipment (82–105) and statutory (106–127). Status placement is explicit so the
// 102 Valid / 18 Expiring Soon / 8 Expired split reproduces the reference exactly.
const EXPIRED_DOC_IDX = new Set([4, 37, 49, 63, 78, 93, 110, 117]);
const EXPIRING_DOC_IDX = new Set([9, 21, 34, 41, 45, 56, 60, 67, 72, 76, 88, 97, 103, 112, 115, 120, 123, 126]);

const WORKER_DOC_NAMES = ['Aadhaar / ID Proof (masked)', 'Medical Fitness Certificate', 'PF Nomination Form', 'Bank Account Proof'];
const EQUIP_DOC_NAMES = ['HEMM Fitness Certificate', 'Lifting Gear Test Certificate', 'Electrical Installation Test Report', 'Tool & Tackles Certificate'];
const STATUTORY_NAMES = ['Static & Mobile Plant Clearance', 'GST Returns (GSTR-3B)', 'Contract Labour Licence', 'Public Liability Insurance', 'Environmental Clearance', 'DGMS Annual Safety Report'];

export const documents: PortalDocument[] = (() => {
  const out: PortalDocument[] = [];
  let k = 0;
  const statusFor = (idx: number) => EXPIRED_DOC_IDX.has(idx) ? DocumentStatus.Expired : EXPIRING_DOC_IDX.has(idx) ? DocumentStatus.ExpiringSoon : DocumentStatus.Valid;
  const expiryFor = (idx: number, st: DocumentStatus) =>
    st === DocumentStatus.Expired ? addDays(DEMO_TODAY, -(20 + (idx % 180)))
      : st === DocumentStatus.ExpiringSoon ? addDays(DEMO_TODAY, 3 + (idx % 55))
        : addDays(DEMO_TODAY, 120 + (idx % 500));

  // 32 contract documents (4 per contractor, matching requiredDocuments).
  contractors.forEach((c) => {
    REQUIRED_DOCS.forEach((name) => {
      const st = statusFor(k);
      const exp = expiryFor(k, st);
      out.push({
        id: `DOCX-${pad(k + 1)}`, name: `${name}.pdf`, category: 'Contract Documents',
        relatedType: 'contractor', relatedId: c.id, mineId: c.mineId,
        issueDate: addDays(exp, -730), expiryDate: exp, sizeKb: 260 + ((k * 53) % 1400),
        uploadedBy: c.contactPerson, mockRef: `mock://docs/DOCX-${pad(k + 1)}`,
      });
      k++;
    });
  });
  // 50 worker documents.
  for (let j = 0; j < 50; j++) {
    const w = workers[(j * 10 + 3) % TOTAL_WORKERS];
    const st = statusFor(k); const exp = expiryFor(k, st);
    out.push({
      id: `DOCX-${pad(k + 1)}`, name: `${WORKER_DOC_NAMES[j % 4]} — ${w.name}.pdf`, category: 'Worker Documents',
      relatedType: 'worker', relatedId: w.id, mineId: w.mineId,
      issueDate: addDays(exp, -365), expiryDate: exp, sizeKb: 120 + ((k * 37) % 480),
      uploadedBy: 'Rakesh Kumar', mockRef: `mock://docs/DOCX-${pad(k + 1)}`,
    });
    k++;
  }
  // 24 equipment documents.
  for (let j = 0; j < 24; j++) {
    const mineId = mines[j % 3].id;
    const st = statusFor(k); const exp = expiryFor(k, st);
    out.push({
      id: `DOCX-${pad(k + 1)}`, name: `${EQUIP_DOC_NAMES[j % 4]} — DT-${pad(14 + j, 2)}.pdf`, category: 'Equipment Documents',
      relatedType: 'equipment', relatedId: `HEMM-DT-${pad(14 + j, 2)}`, mineId,
      issueDate: addDays(exp, -365), expiryDate: exp, sizeKb: 180 + ((k * 29) % 520),
      uploadedBy: 'Site Engineer', mockRef: `mock://docs/DOCX-${pad(k + 1)}`,
    });
    k++;
  }
  // 22 statutory documents.
  for (let j = 0; j < 22; j++) {
    const st = statusFor(k); const exp = expiryFor(k, st);
    out.push({
      id: `DOCX-${pad(k + 1)}`, name: `${STATUTORY_NAMES[j % 6]}.pdf`, category: 'Statutory Compliance',
      relatedType: 'statutory', relatedId: contractors[j % 3].id, mineId: mines[j % mines.length].id,
      issueDate: addDays(exp, -730), expiryDate: exp, sizeKb: 200 + ((k * 41) % 700),
      uploadedBy: 'Compliance Cell', mockRef: `mock://docs/DOCX-${pad(k + 1)}`,
    });
    k++;
  }
  return out;
})();

// ---------- Transfer requests (10) ----------
const TRANSFER_DEFS: [number, string, TransferStatus, number][] = [
  [7, 'M-02', TransferStatus.Pending, 2], [23, 'M-03', TransferStatus.Pending, 3],
  [58, 'M-01', TransferStatus.Pending, 1], [101, 'M-03', TransferStatus.Approved, -12],
  [142, 'M-02', TransferStatus.Approved, -21], [188, 'M-01', TransferStatus.Rejected, -8],
  [233, 'M-03', TransferStatus.Approved, -30], [291, 'M-02', TransferStatus.Cancelled, -5],
  [344, 'M-01', TransferStatus.Rejected, -16], [402, 'M-03', TransferStatus.Approved, -44],
];

export const transfers: TransferRequest[] = TRANSFER_DEFS.map(([w, toMine, status, off], i) => {
  const worker = workers[w];
  return {
    id: `REQ-${pad(i + 1)}`,
    workerId: worker.id,
    fromContractorId: worker.contractorId,
    fromMineId: worker.mineId,
    toMineId: toMine === worker.mineId ? mines[(mines.findIndex((m) => m.id === worker.mineId) + 1) % 3].id : toMine,
    toDepartment: worker.department,
    requestDate: addDays(DEMO_TODAY, off),
    supervisor: worker.supervisor,
    reason: [
      'Skill matched to a vacant operator position on the new bench.',
      'Mine balance adjustment following the western push re-sequencing.',
      'Requested by mine planning office for exploration support duty.',
      'Worker requested redeployment closer to native place.',
    ][i % 4],
    status,
    decidedOn: status === TransferStatus.Pending ? undefined : addDays(DEMO_TODAY, off + 1),
    decidedBy: status === TransferStatus.Pending ? undefined : 'Rakesh Kumar',
  };
});

// ---------- Incidents (24) + corrective actions ----------
const INSPECTORS = ['K. Ravi (DGMS)', 'S. Chandra', 'Meena Bhagat', 'A. K. Singh'];
const SEVERITIES: Severity[] = [Severity.Medium, Severity.High, Severity.Low, Severity.Critical, Severity.Medium, Severity.High];
const INCIDENT_STATUS_PLAN: IncidentStatus[] = [
  ...Array(6).fill(IncidentStatus.Open),
  ...Array(5).fill(IncidentStatus.UnderReview),
  ...Array(5).fill(IncidentStatus.ActionRequired),
  ...Array(6).fill(IncidentStatus.Resolved),
  ...Array(2).fill(IncidentStatus.Dismissed),
];

const INCIDENT_DESC: Record<string, string> = {
  'Expired Training': 'Mandatory Mine Safety Induction found expired during the monthly compliance sweep.',
  'Missing Documents': 'Required compliance document missing / lapsed for the deployed resource.',
  'Unauthorized Access': 'Gate log shows an entry attempt outside the authorised deployment window.',
  'Attendance Violation': 'Claimed attendance hours do not reconcile with gate-entry timestamps.',
  'Contractor Compliance': 'Contractor statutory filing outstanding beyond the stipulated due date.',
  'Deployment Violation': 'Worker deployed on a task not covered by the approved deployment plan.',
};

export const incidents: Incident[] = Array.from({ length: 24 }, (_, j) => {
  const w = (j * 17 + 5) % TOTAL_WORKERS;
  const worker = workers[w];
  const category = [
    'Expired Training', 'Missing Documents', 'Unauthorized Access', 'Attendance Violation',
    'Contractor Compliance', 'Deployment Violation',
  ][j % 6];
  const status = INCIDENT_STATUS_PLAN[j];
  const detected = addDays(DEMO_TODAY, -(1 + ((j * 3) % 46)));
  return {
    id: `INC-${pad(j + 1)}`,
    workerId: category === 'Contractor Compliance' ? null : worker.id,
    contractorId: worker.contractorId,
    mineId: worker.mineId,
    category,
    severity: SEVERITIES[j % SEVERITIES.length],
    dateDetected: detected,
    description: INCIDENT_DESC[category],
    inspector: INSPECTORS[j % INSPECTORS.length],
    status,
    evidence: [
      `gate-log-${detected}.csv`, `site-photo-${pad(j + 1)}.jpg`,
      ...(j % 3 === 0 ? [`toolbox-talk-record-${detected}.pdf`] : []),
    ],
    timeline: [
      { at: `${detected}T09:15:00+05:30`, by: INSPECTORS[j % INSPECTORS.length], note: 'Incident raised during the scheduled compliance sweep.' },
      ...(status !== IncidentStatus.Open ? [{ at: `${addDays(detected, 1)}T14:40:00+05:30`, by: 'Rakesh Kumar', note: 'Contractor acknowledged and submitted an initial response.' }] : []),
      ...(status === IncidentStatus.Resolved || status === IncidentStatus.Dismissed
        ? [{ at: `${addDays(detected, 4)}T11:05:00+05:30`, by: INSPECTORS[j % INSPECTORS.length], note: status === IncidentStatus.Resolved ? 'Corrective action verified — incident resolved.' : 'No substantive non-compliance found — incident dismissed after review.' }] : []),
    ],
    resolution: status === IncidentStatus.Resolved ? 'Corrective action verified against site records; worker re-inducted and deployment regularised.'
      : status === IncidentStatus.Dismissed ? 'Records reviewed; the flagged entry was a legitimate shift-change overlap. No non-compliance.' : undefined,
  };
});

export const correctiveActions: CorrectiveAction[] = incidents
  .filter((_, j) => [2, 3, 4, 6, 7, 9, 10, 12, 13, 15, 16, 18, 20].includes(j))
  .map((inc, m) => ({
    id: `CA-${pad(m + 1)}`,
    incidentId: inc.id,
    description: [
      'Re-induct the worker and upload the fresh induction certificate.',
      'Upload the lapsed statutory document and confirm submission to the mine office.',
      'Reconcile gate logs with the claimed hours and submit a corrected attendance sheet.',
      'Withdraw the worker from the restricted task and redeploy as per the approved plan.',
    ][m % 4],
    assignedTo: contractors.find((c) => c.id === inc.contractorId)?.name ?? 'Contractor',
    dueDate: addDays(DEMO_TODAY, 3 + (m % 12)),
    status: inc.status === IncidentStatus.Resolved ? CorrectiveStatus.Approved
      : inc.status === IncidentStatus.ActionRequired ? (m % 2 === 0 ? CorrectiveStatus.InProgress : CorrectiveStatus.Submitted)
        : CorrectiveStatus.InProgress,
    updates: [
      { at: `${addDays(inc.dateDetected, 1)}T15:00:00+05:30`, by: 'Rakesh Kumar', note: 'Corrective action accepted; responsible supervisor assigned.' },
      ...(m % 2 === 0 ? [{ at: `${addDays(inc.dateDetected, 2)}T10:30:00+05:30`, by: inc.inspector, note: 'Evidence reviewed — additional proof requested.' }] : []),
    ],
    evidenceRef: m % 2 === 0 ? `corrective-evidence-${pad(m + 1)}.pdf` : undefined,
    reviewerNote: inc.status === IncidentStatus.Resolved ? 'Evidence satisfactory — action closed.' : undefined,
  }));

// ---------- Notifications (24) ----------
export const notifications: PortalNotification[] = Array.from({ length: 24 }, (_, j) => {
  const type: PortalNotification['type'] = j < 6 ? 'Action Required' : j < 18 ? 'Information' : 'Completed';
  const category = (['Approvals', 'Worker Related', 'Bills & Payments', 'Compliance'] as const)[j % 4];
  const templates: Record<string, [string, string, string]> = {
    Approvals: ['Bill awaiting mine approval', `Bill ${bills[j % bills.length].id} is pending approval by the mine commercial office.`, '/contractor/bills?tab=Pending%20Bills'],
    'Worker Related': ['Training certification expiring', `A mandatory certification for ${workers[(j * 13) % TOTAL_WORKERS].name} expires within the next 60 days.`, '/contractor/workers?tab=Training%20Status'],
    'Bills & Payments': ['Payment received', `Payment for ${payments[j % payments.length].id} has been credited to the registered bank account.`, '/contractor/bills?tab=Payments'],
    Compliance: ['Non-compliance incident raised', `${incidents[j % incidents.length].id} has been raised and requires a corrective action response.`, '/contractor/documents?tab=Statutory%20Compliance'],
  };
  const [title, description, href] = templates[category];
  return {
    id: `WN-${pad(j + 1, 3)}`,
    title, description, type, category,
    timestamp: `${addDays(DEMO_TODAY, -Math.floor(j / 3))}T${String(8 + (j % 10)).padStart(2, '0')}:${String((j * 7) % 60).padStart(2, '0')}:00+05:30`,
    read: j % 3 === 0,
    relatedId: category === 'Bills & Payments' ? payments[j % payments.length].id
      : category === 'Approvals' ? bills[j % bills.length].id
        : category === 'Compliance' ? incidents[j % incidents.length].id
          : workers[(j * 13) % TOTAL_WORKERS].id,
    href,
  };
});

// ---------- Reports ----------
export const reports: ReportRow[] = [
  ['Worker Deployment Summary', 'Worker Reports', 'Sep 2026', 2, 184],
  ['Attendance Reconciliation — Bharat Coal Mine', 'Attendance Reports', 'Sep 2026', 3, 320],
  ['Contract Utilisation Statement', 'Contract Reports', 'Aug – Sep 2026', 5, 210],
  ['Bill & Payment Register', 'Financial Reports', 'Sep 2026', 4, 156],
  ['Non-Compliance & Corrective Actions', 'Compliance Reports', 'Jul – Sep 2026', 6, 268],
  ['Training & Certification Register', 'Compliance Reports', 'Sep 2026', 7, 292],
  ['Gate Access Log — All Mines', 'Attendance Reports', '01 – 30 Sep 2026', 8, 512],
  ['Worker Transfer Register', 'Worker Reports', 'Q3 2026', 9, 128],
  ['Statutory Document Register', 'Compliance Reports', 'As on 03 Oct 2026', 1, 176],
  ['Manpower Deployment vs Plan', 'Worker Reports', 'Sep 2026', 10, 204],
  ['Attendance Trend Analysis', 'Attendance Reports', 'Last 30 days', 1, 244],
  ['Bill Approval TAT Report', 'Financial Reports', 'Q2 – Q3 2026', 11, 142],
  ['Contract Milestone Status', 'Contract Reports', 'As on 03 Oct 2026', 2, 118],
  ['Leave & Gate Pass Register', 'Attendance Reports', 'Sep 2026', 12, 132],
].map(([title, category, period, off, sizeKb], i) => ({
  id: `RPT-${pad(i + 1, 3)}`,
  title: title as string,
  category: category as string,
  period: period as string,
  generatedOn: addDays(DEMO_TODAY, -(off as number)),
  format: 'CSV' as const,
  sizeKb: sizeKb as number,
  status: (i === 2 ? 'Archived' : i === 11 ? 'Generating' : 'Ready') as ReportRow['status'],
}));

// ---------- Activity + audit ----------
export const activity: ActivityEntry[] = [
  { id: 'WACT-008', kind: 'Bill Submitted', description: 'Bill BILL-2026-007 submitted for the October 1–3 work period.', timestamp: `${DEMO_TODAY}T09:40:00+05:30`, user: 'Rakesh Kumar' },
  { id: 'WACT-007', kind: 'Access Decision', description: 'Gate access revoked for a blocked deployment at Bharat Coal Mine.', timestamp: `${DEMO_TODAY}T08:12:00+05:30`, user: 'Gate Office' },
  { id: 'WACT-006', kind: 'Attendance Marked', description: 'Manual attendance recorded for 3 workers (labelled manual — never biometric).', timestamp: `${DEMO_TODAY}T07:55:00+05:30`, user: 'Sunil Mahto' },
  { id: 'WACT-005', kind: 'Corrective Action', description: 'Corrective action update submitted for INC-0004.', timestamp: `${addDays(DEMO_TODAY, -1)}T16:20:00+05:30`, user: 'Rakesh Kumar' },
  { id: 'WACT-004', kind: 'Transfer Requested', description: 'Transfer request REQ-0001 raised for a dump-truck operator.', timestamp: `${addDays(DEMO_TODAY, -2)}T11:05:00+05:30`, user: 'Rakesh Kumar' },
  { id: 'WACT-003', kind: 'Document Uploaded', description: 'Medical fitness certificates uploaded for 12 workers.', timestamp: `${addDays(DEMO_TODAY, -3)}T14:30:00+05:30`, user: 'Rakesh Kumar' },
  { id: 'WACT-002', kind: 'Contractor Updated', description: 'Site-services partner contact details updated.', timestamp: `${addDays(DEMO_TODAY, -4)}T10:15:00+05:30`, user: 'Rakesh Kumar' },
  { id: 'WACT-001', kind: 'Portal Access', description: 'Contractor workspace session started for Eastern Mining Services Pvt. Ltd.', timestamp: `${DEMO_TODAY}T09:00:00+05:30`, user: 'Rakesh Kumar' },
];

/** Reset helper — returns a deep clone of the whole synthetic dataset. */
export function workforceSnapshot() {
  return {
    contractors: structuredClone(contractors),
    workers: structuredClone(workers),
    training: structuredClone(trainingRecords),
    attendance: structuredClone(attendance),
    access: structuredClone(accessRecords),
    leaves: structuredClone(leaves),
    gatePasses: structuredClone(gatePasses),
    bills: structuredClone(bills),
    payments: structuredClone(payments),
    documents: structuredClone(documents),
    transfers: structuredClone(transfers),
    incidents: structuredClone(incidents),
    correctiveActions: structuredClone(correctiveActions),
    notifications: structuredClone(notifications),
    reports: structuredClone(reports),
    activity: structuredClone(activity),
  };
}
