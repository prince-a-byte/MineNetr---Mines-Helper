import type {
  ActivityItem, Assignment, AuthSession, Bill, Company, DashboardSummary, DocRecord,
  Mine, NotificationItem, Payment, Role, Worker, WorkerStatus,
} from '../types/models';
import type { BillInput, DocumentInput, WorkerInput } from '../schemas/forms';

/** Every service exposes the same async contract in mock and HTTP modes. */
export interface AuthService {
  login(identifier: string, password: string, role: Role): Promise<AuthSession>;
  loginWithOtp(identifier: string): Promise<{ maskedTo: string }>;
  verifyOtp(identifier: string, code: string, role: Role): Promise<AuthSession>;
  resendOtp(identifier: string): Promise<void>;
  requestPasswordReset(identifier: string): Promise<{ demoNote: string }>;
  logout(): Promise<void>;
  getSession(): Promise<AuthSession | null>;
}

export interface WorkerFilters { q?: string; status?: WorkerStatus | 'All'; mineId?: string; role?: string; }
export interface WorkerService {
  listWorkers(f: WorkerFilters, page?: number, pageSize?: number): Promise<{ items: Worker[]; total: number; hasMore: boolean }>;
  getWorkerById(id: string): Promise<Worker>;
  createWorker(input: WorkerInput): Promise<Worker>;
  updateWorker(id: string, input: Partial<Worker>): Promise<Worker>;
  updateWorkerStatus(id: string, status: WorkerStatus): Promise<Worker>;
  transferWorker(id: string, mineId: string): Promise<Worker>;
}

export interface MineService {
  listAssignedMines(q?: string, status?: 'All' | 'Active' | 'Inactive'): Promise<Mine[]>;
  getMineById(id: string): Promise<Mine>;
  getMineSummary(id: string): Promise<{ total: number; active: number; onLeave: number; inactive: number }>;
  listAssignments(mineId: string): Promise<Assignment[]>;
}

export interface DocFilters { q?: string; scope?: 'worker' | 'company' | 'all'; mineId?: string; type?: string; status?: string; }
export interface DocumentService {
  listDocuments(f: DocFilters, page?: number, pageSize?: number): Promise<{ items: DocRecord[]; total: number; hasMore: boolean }>;
  getDocumentById(id: string): Promise<DocRecord>;
  /** Mock: stores metadata + local file ref with status Pending. Real upload happens only in HTTP mode. */
  createDocumentMetadata(input: DocumentInput & { fileName?: string; fileSize?: number }): Promise<DocRecord>;
  uploadDocument(fileUri: string, metadata: DocumentInput): Promise<DocRecord>;
  requestVerification(id: string): Promise<DocRecord>;
}

export interface BillFilters { q?: string; status?: 'All' | Bill['status']; mineId?: string }
export interface BillService {
  listBills(f: BillFilters, page?: number, pageSize?: number): Promise<{ items: Bill[]; total: number; hasMore: boolean }>;
  getBillById(id: string): Promise<Bill>;
  createBill(input: BillInput): Promise<Bill>;
  listTransactions(): Promise<Payment[]>;
}

export interface DashboardService {
  summary(): Promise<DashboardSummary>;
  recentUpdates(limit?: number): Promise<ActivityItem[]>;
}

export interface ProfileService {
  getCompany(): Promise<Company & { mineIds: string[] }>;
  updateCompany(patch: Partial<Company>): Promise<Company>;
  changePassword(current: string, next: string): Promise<void>;
}

export interface NotificationService {
  list(): Promise<NotificationItem[]>;
  markAllRead(): Promise<void>;
}

export interface Services {
  auth: AuthService;
  workers: WorkerService;
  mines: MineService;
  documents: DocumentService;
  bills: BillService;
  dashboard: DashboardService;
  profile: ProfileService;
  notifications: NotificationService;
}
