/**
 * Mock repository — the single source of truth in DATA_MODE=mock.
 * Holds seeded demo records, persists user-created/changed records to
 * AsyncStorage, and exposes one coherent API so every screen stays in sync
 * (create a bill -> bill list + dashboard totals update together).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Images } from '../constants/images';
import type {
  ActivityItem, Assignment, AuthSession, Bill, Company, DocRecord, Mine,
  NotificationItem, Payment, Role, Worker, WorkerStatus,
} from '../types/models';
import { nextWorkerId, uid } from '../utils/id';

const STORE_KEY = '@minenetr/mock-store/v1';
const PREFS_KEY = '@minenetr/prefs/v1';

export interface Prefs {
  onboardingDone: boolean;
  notifPrefs: { safety: boolean; bills: boolean; documents: boolean };
}

interface Store {
  workers: Worker[];
  assignments: Assignment[];
  documents: DocRecord[];
  bills: Bill[];
  payments: Payment[];
  activities: ActivityItem[];
  notifications: NotificationItem[];
  company: Company;
  profileEdits: Partial<Company>;
}

const MINES: Mine[] = [
  { id: 'm1', name: 'Bharatpur Coal Mine', location: 'Dhanbad, Jharkhand', state: 'Jharkhand', status: 'Active', contractStart: '2026-01-01', contractEnd: '2026-12-31', workType: 'Overburden Removal', image: Images.mines.m1, managerName: 'R. Kumar', managerPhone: '919876543210', nodalName: 'A. Singh', nodalPhone: '919876543211' },
  { id: 'm2', name: 'Kusunda Coal Mine', location: 'Dhanbad, Jharkhand', state: 'Jharkhand', status: 'Active', contractStart: '2025-03-01', contractEnd: '2027-02-28', workType: 'Coal Extraction', image: Images.mines.m2, managerName: 'S. Verma', managerPhone: '919876543212', nodalName: 'P. Das', nodalPhone: '919876543213' },
  { id: 'm3', name: 'Mugma Coal Mine', location: 'Dhanbad, Jharkhand', state: 'Jharkhand', status: 'Active', contractStart: '2025-04-01', contractEnd: '2026-03-31', workType: 'Transportation', image: Images.mines.m3, managerName: 'K. Rao', managerPhone: '919876543214', nodalName: 'M. Ali', nodalPhone: '919876543215' },
];

const WORKERS_SEED: Array<[string, string, string, WorkerStatus, string, string]> = [
  ['WK001', 'Ramesh Yadav', 'Excavator Operator', 'Active', 'm1', '9876543210'],
  ['WK002', 'Suresh Kumar', 'Safety Supervisor', 'Active', 'm2', '9876543211'],
  ['WK003', 'Amit Singh', 'Electrician', 'On Leave', 'm1', '9876543212'],
  ['WK004', 'Salim Ansari', 'Drilling Operator', 'Inactive', 'm3', '9876543213'],
  ['WK005', 'Vikash Tiwari', 'Heavy Vehicle Driver', 'Active', 'm1', '9876543214'],
  ['WK006', 'Pawan Kumar', 'Helper', 'Active', 'm2', '9876543215'],
  ['WK007', 'Neeraj Shaw', 'Welder', 'Active', 'm1', '9876543216'],
  ['WK008', 'Imran Ali', 'Fitter', 'On Leave', 'm3', '9876543217'],
];

function seedStore(): Store {
  const workers: Worker[] = WORKERS_SEED.map(([id, name, role, status, mineId, phone], i) => ({
    id, name, role, mineId, status, phone,
    dob: `199${i}-0${(i % 9) + 1}-1${i}`,
    gender: 'Male',
    aadhaarLast4: String(1000 + i * 137).slice(-4),
    joiningDate: '2026-01-12',
    employmentType: 'Contract',
    address: 'Vill. Kandra, Dhanbad, Jharkhand - 828109',
    emergencyName: 'Sita Devi (Wife)',
    emergencyPhone: '919123456789',
    avatar: Images.avatars[id] ?? Images.avatarFallback,
  }));
  const now = Date.now();
  const stamp = (daysAgo: number) => new Date(now - daysAgo * 86400000).toISOString();
  return {
    workers,
    assignments: workers.map((w) => ({
      id: `ASG-${w.id}`, workerId: w.id, mineId: w.mineId,
      from: '2026-01-12', status: w.status,
    })),
    documents: [
      { id: 'DOC-001', scope: 'worker', type: 'Aadhaar Card', workerId: 'WK001', mineId: 'm1', issueDate: '2020-03-14', expiryDate: '2030-03-14', status: 'Verified', fileName: 'aadhaar-wk001.pdf', updatedAt: stamp(2) },
      { id: 'DOC-002', scope: 'worker', type: 'Medical Certificate', workerId: 'WK001', mineId: 'm1', issueDate: '2025-01-12', expiryDate: '2026-01-12', status: 'Pending', fileName: 'medical-wk001.pdf', updatedAt: stamp(1) },
      { id: 'DOC-003', scope: 'worker', type: 'Safety Training Certificate', workerId: 'WK002', mineId: 'm2', issueDate: '2025-02-10', expiryDate: '2026-02-10', status: 'Verified', updatedAt: stamp(3) },
      { id: 'DOC-004', scope: 'worker', type: 'Contract Agreement', workerId: 'WK003', mineId: 'm1', issueDate: '2026-01-12', expiryDate: '2026-12-31', status: 'Verified', updatedAt: stamp(4) },
      { id: 'DOC-005', scope: 'worker', type: 'Experience Certificate', workerId: 'WK004', mineId: 'm3', issueDate: '2023-08-15', expiryDate: '2025-08-15', status: 'Expired', updatedAt: stamp(9) },
      { id: 'DOC-006', scope: 'worker', type: 'Aadhaar Card', workerId: 'WK005', mineId: 'm1', issueDate: '2021-06-05', expiryDate: '2030-06-05', status: 'Verified', updatedAt: stamp(5) },
      { id: 'DOC-007', scope: 'worker', type: 'Medical Certificate', workerId: 'WK006', mineId: 'm2', issueDate: '2025-03-20', expiryDate: '2026-03-20', status: 'Verified', updatedAt: stamp(6) },
      { id: 'DOC-008', scope: 'worker', type: 'Safety Training Certificate', workerId: 'WK007', mineId: 'm1', issueDate: '2025-01-11', expiryDate: '2026-01-11', status: 'Pending', updatedAt: stamp(1) },
      { id: 'DOC-009', scope: 'company', type: 'Contract Agreement', mineId: 'm1', issueDate: '2026-01-01', expiryDate: '2026-12-31', status: 'Verified', fileName: 'contract-m1.pdf', updatedAt: stamp(7) },
      { id: 'DOC-010', scope: 'company', type: 'Other Documents', mineId: 'm2', issueDate: '2025-06-01', expiryDate: '2026-06-01', status: 'Expired', updatedAt: stamp(8) },
    ],
    bills: [
      { id: 'BILL-2026-001', workType: 'Labor Charges', mineId: 'm1', amountInr: 450000, period: 'Jan 2026', submittedOn: '2026-01-12', status: 'Approved' },
      { id: 'BILL-2026-002', workType: 'Equipment Charges', mineId: 'm2', amountInr: 320000, period: 'Jan 2026', submittedOn: '2026-01-18', status: 'Pending' },
      { id: 'BILL-2026-003', workType: 'Labor Charges', mineId: 'm3', amountInr: 500000, period: 'Dec 2025', submittedOn: '2026-01-02', status: 'Approved' },
      { id: 'BILL-2025-012', workType: 'Material Supply', mineId: 'm1', amountInr: 180000, period: 'Nov 2025', submittedOn: '2025-12-10', status: 'Rejected' },
      { id: 'BILL-2025-011', workType: 'Labor Charges', mineId: 'm1', amountInr: 275000, period: 'Nov 2025', submittedOn: '2025-11-28', status: 'Approved' },
      { id: 'BILL-2025-010', workType: 'Transport Charges', mineId: 'm2', amountInr: 145000, period: 'Oct 2025', submittedOn: '2025-11-05', status: 'Pending' },
      { id: 'BILL-2025-009', workType: 'Labor Charges', mineId: 'm3', amountInr: 360000, period: 'Oct 2025', submittedOn: '2025-10-22', status: 'Paid' },
      { id: 'BILL-2025-008', workType: 'Equipment Charges', mineId: 'm1', amountInr: 210000, period: 'Sep 2025', submittedOn: '2025-09-15', status: 'Approved' },
    ],
    payments: [
      { id: 'PAY-001', billId: 'BILL-2026-001', mineId: 'm1', date: '2026-01-15', amountInr: 450000 },
      { id: 'PAY-002', billId: 'BILL-2025-009', mineId: 'm3', date: '2025-11-02', amountInr: 360000 },
    ],
    activities: [
      { id: 'ACT-1', kind: 'document', text: 'Work permit document verified', at: stamp(0), refId: 'DOC-003' },
      { id: 'ACT-2', kind: 'worker', text: '10 new workers assigned to Bharatpur Mine', at: stamp(1), refId: 'm1' },
      { id: 'ACT-3', kind: 'bill', text: 'Bill #INV-2026-001 submitted', at: stamp(3), refId: 'BILL-2026-002' },
      { id: 'ACT-4', kind: 'mine', text: 'New mine assignment: Mugma Coal Mine', at: stamp(5), refId: 'm3' },
    ],
    notifications: [
      { id: 'N-1', title: 'Document verified', body: 'Safety Training Certificate for Suresh Kumar was verified.', at: stamp(0), read: false },
      { id: 'N-2', title: 'Bill under review', body: 'BILL-2026-002 is pending with the mine operator.', at: stamp(1), read: false },
      { id: 'N-3', title: 'Medical certificate expiring', body: 'Medical Certificate for Ramesh Yadav expires 12 Jan 2026.', at: stamp(2), read: true },
    ],
    company: {
      id: 'CT-2026-089', name: 'Shakti Infrastructure Services Pvt. Ltd.', contractorId: 'CT-2026-089',
      registration: 'CIN: U45201JH2020PTC012345', gstin: 'GSTIN: 20ABCDE1234F1Z5',
      address: '123, Industrial Area, Harmu Road, Ranchi, Jharkhand - 834001',
      contactName: 'Amit Kumar Singh', contactDesignation: 'Managing Director',
      contactPhone: '919876543210', contactEmail: 'amit@shaktiinfra.com',
      status: 'Active', dgmsValidTill: '2027-12-31',
    },
    profileEdits: {},
  };
}

type Listener = () => void;

class MockRepository {
  private store: Store | null = null;
  private prefs: Prefs | null = null;
  private listeners = new Set<Listener>();

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    return () => { this.listeners.delete(l); };
  }
  private emit() { this.listeners.forEach((l) => l()); }

  async ready(): Promise<void> {
    if (this.store && this.prefs) return;
    const [raw, praw] = await Promise.all([
      AsyncStorage.getItem(STORE_KEY), AsyncStorage.getItem(PREFS_KEY),
    ]);
    this.store = raw ? (JSON.parse(raw) as Store) : seedStore();
    this.prefs = praw
      ? (JSON.parse(praw) as Prefs)
      : { onboardingDone: false, notifPrefs: { safety: true, bills: true, documents: true } };
    if (!raw) await this.persist();
    if (!praw) await this.persistPrefs();
  }

  private async persist() {
    await AsyncStorage.setItem(STORE_KEY, JSON.stringify(this.store));
    this.emit();
  }
  private async persistPrefs() {
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(this.prefs));
  }

  get data(): Store {
    if (!this.store) throw new Error('MockRepository not ready — call ready() first.');
    return this.store;
  }
  get preferences(): Prefs {
    if (!this.prefs) throw new Error('MockRepository not ready.');
    return this.prefs;
  }

  mines(): Mine[] { return MINES; }
  mineById(id: string): Mine | undefined { return MINES.find((m) => m.id === id); }

  async mutate(fn: (s: Store) => void): Promise<void> {
    fn(this.data);
    await this.persist();
  }
  async setPrefs(p: Partial<Prefs>): Promise<void> {
    this.prefs = { ...this.preferences, ...p };
    await this.persistPrefs();
    this.emit();
  }

  pushActivity(a: Omit<ActivityItem, 'id' | 'at'>): ActivityItem {
    const item: ActivityItem = { ...a, id: uid('ACT'), at: new Date().toISOString() };
    this.data.activities.unshift(item);
    return item;
  }
  pushNotification(n: Omit<NotificationItem, 'id' | 'at' | 'read'>): void {
    this.data.notifications.unshift({ ...n, id: uid('N'), at: new Date().toISOString(), read: false });
  }

  nextWorkerId(): string { return nextWorkerId(this.data.workers.map((w) => w.id)); }
  nextBillId(): string {
    const n = this.data.bills.length + 1;
    return `BILL-2026-${String(n).padStart(3, '0')}`;
  }

  async resetDemo(): Promise<void> {
    this.store = seedStore();
    await this.persist();
  }
}

export const mockRepo = new MockRepository();
export type { Role, AuthSession };
