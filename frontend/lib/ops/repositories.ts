/**
 * Typed repository contracts for the Operations portal.
 *
 * Pages/hooks consume these interfaces — never raw fetch or store internals —
 * so switching mock ↔ HTTP requires no dashboard rewrites.
 *   - mockRepo: delegates to the centralized store (demo mode).
 *   - httpRepo: typed adapters in api.ts; unconfirmed endpoints throw named
 *     TODO errors; failures propagate (never silently fall back to mock).
 *
 * Today the interactive pages read reactively via useMockOps() (single
 * store subscription) and mutate via `actions`, which implement exactly the
 * semantics below. The async surface exists so HTTP mode drops in cleanly.
 */
import { OPS_DATA_MODE, OpsHttpError, opsFetch, opsUpload, type OpsEndpointKey } from './api';
import { getOpsDb, actions, stockCurrent } from './store';
import type {
  Bill, Contractor, DispatchRecord, Inspection, OpsDocument, ProductionRecord,
  Stockpile, Worker, AttendanceRecord,
} from './types';

export interface Page<T> { items: T[]; total: number; page: number; size: number }

export interface WorkerRepository {
  listWorkers(filter?: { mineId?: string; contractorId?: string; q?: string }): Promise<Worker[]>;
  getWorkerById(id: string): Promise<Worker | null>;
  createWorker(input: Parameters<typeof actions.createWorker>[0]): Promise<string>;
  updateWorker(id: string, patch: Partial<Worker>): Promise<void>;
  updateWorkerStatus(id: string, status: Worker['status']): Promise<void>;
}
export interface ContractorRepository {
  listContractors(filter?: { mineId?: string; status?: string }): Promise<Contractor[]>;
  createContractor(input: Parameters<typeof actions.createContractor>[0]): Promise<string>;
}
export interface AttendanceRepository {
  listAttendance(filter?: { mineId?: string; workerId?: string; date?: string }): Promise<AttendanceRecord[]>;
  checkIn(workerId: string): Promise<string>;
  checkOut(workerId: string): Promise<void>;
  getWorkerAttendance(workerId: string): Promise<AttendanceRecord[]>;
}
export interface ProductionRepository {
  listProduction(filter?: { mineId?: string; from?: string; to?: string }): Promise<ProductionRecord[]>;
  createProduction(input: Parameters<typeof actions.createProduction>[0]): Promise<string>;
}
export interface DispatchRepository {
  listDispatches(filter?: { mineId?: string; destination?: string; status?: string }): Promise<DispatchRecord[]>;
  createDispatch(input: Parameters<typeof actions.createDispatch>[0]): Promise<string>;
  updateDispatchStatus(id: string, status: DispatchRecord['status']): Promise<void>;
}
export interface StockpileRepository {
  listStockpiles(filter?: { mineId?: string }): Promise<Stockpile[]>;
  createStockpile(input: Parameters<typeof actions.createStockpile>[0]): Promise<string>;
  transferStock(input: Parameters<typeof actions.transferStock>[0]): Promise<void>;
  reconcileStock(stockpileId: string, physicalMt: number, note: string): Promise<void>;
  getCurrentStock(stockpileId: string): Promise<number>;
}
export interface BillRepository {
  listBills(filter?: { mineId?: string; contractorId?: string; status?: string }): Promise<Bill[]>;
  createBill(input: Parameters<typeof actions.createBill>[0]): Promise<string>;
  approveBill(id: string): Promise<void>;
  rejectBill(id: string, reason: string): Promise<void>;
  recordPayment(billId: string, amount: number, mode: string): Promise<string>;
}
export interface DocumentRepository {
  listDocuments(filter?: { mineId?: string; category?: string; status?: string }): Promise<OpsDocument[]>;
  uploadDocument(file: File, meta: Parameters<typeof actions.createDocument>[0]): Promise<string>;
  approveDocument(id: string): Promise<void>;
  rejectDocument(id: string, reason: string): Promise<void>;
}
export interface InspectionRepository {
  listInspections(filter?: { mineId?: string }): Promise<Inspection[]>;
  createInspection(input: Parameters<typeof actions.createInspection>[0]): Promise<string>;
  completeInspection(id: string, reportFile: string): Promise<void>;
}

export interface OperationsRepositories {
  mode: 'mock' | 'http';
  workers: WorkerRepository;
  contractors: ContractorRepository;
  attendance: AttendanceRepository;
  production: ProductionRepository;
  dispatches: DispatchRepository;
  stockpiles: StockpileRepository;
  bills: BillRepository;
  documents: DocumentRepository;
  inspections: InspectionRepository;
}

// ---------- Mock adapter (delegates to the single store) ----------
const mockRepo: OperationsRepositories = {
  mode: 'mock',
  workers: {
    async listWorkers(f = {}) {
      return getOpsDb().workers.filter((w) =>
        (!f.mineId || f.mineId === 'ALL' || w.mineId === f.mineId) &&
        (!f.contractorId || w.contractorId === f.contractorId) &&
        (!f.q || `${w.code} ${w.name} ${w.role} ${w.skill}`.toLowerCase().includes(f.q.toLowerCase())));
    },
    async getWorkerById(id) { return getOpsDb().workers.find((w) => w.id === id) ?? null; },
    async createWorker(input) { return actions.createWorker(input); },
    async updateWorker(id, patch) { actions.updateWorker(id, patch); },
    async updateWorkerStatus(id, status) { actions.updateWorker(id, { status }); },
  },
  contractors: {
    async listContractors(f = {}) {
      return getOpsDb().contractors.filter((c) =>
        (!f.mineId || f.mineId === 'ALL' || c.mineIds.includes(f.mineId)) &&
        (!f.status || c.status === f.status));
    },
    async createContractor(input) { return actions.createContractor(input); },
  },
  attendance: {
    async listAttendance(f = {}) {
      const db = getOpsDb();
      const mineWorkers = new Set(db.workers.filter((w) => !f.mineId || f.mineId === 'ALL' || w.mineId === f.mineId).map((w) => w.id));
      return db.attendance.filter((a) => mineWorkers.has(a.workerId) && (!f.workerId || a.workerId === f.workerId) && (!f.date || a.date === f.date));
    },
    async checkIn(workerId) { return actions.checkIn(workerId); },
    async checkOut(workerId) { actions.checkOut(workerId); },
    async getWorkerAttendance(workerId) { return getOpsDb().attendance.filter((a) => a.workerId === workerId); },
  },
  production: {
    async listProduction(f = {}) {
      return getOpsDb().production.filter((p) =>
        (!f.mineId || f.mineId === 'ALL' || p.mineId === f.mineId) &&
        (!f.from || p.date >= f.from) && (!f.to || p.date <= f.to));
    },
    async createProduction(input) { return actions.createProduction(input); },
  },
  dispatches: {
    async listDispatches(f = {}) {
      return getOpsDb().dispatches.filter((d) =>
        (!f.mineId || f.mineId === 'ALL' || d.mineId === f.mineId) &&
        (!f.destination || d.destination === f.destination) &&
        (!f.status || d.status === f.status));
    },
    async createDispatch(input) { return actions.createDispatch(input); },
    async updateDispatchStatus(id, status) { actions.updateDispatchStatus(id, status); },
  },
  stockpiles: {
    async listStockpiles(f = {}) { return getOpsDb().stockpiles.filter((s) => !f.mineId || f.mineId === 'ALL' || s.mineId === f.mineId); },
    async createStockpile(input) { return actions.createStockpile(input); },
    async transferStock(input) { actions.transferStock(input); },
    async reconcileStock(id, mt, note) { actions.reconcileStock(id, mt, note); },
    async getCurrentStock(id) { return stockCurrent(id); },
  },
  bills: {
    async listBills(f = {}) {
      return getOpsDb().bills.filter((b) =>
        (!f.mineId || f.mineId === 'ALL' || b.mineId === f.mineId) &&
        (!f.contractorId || b.contractorId === f.contractorId) &&
        (!f.status || b.approvalStatus === f.status));
    },
    async createBill(input) { return actions.createBill(input); },
    async approveBill(id) { actions.approveBill(id); },
    async rejectBill(id, reason) { actions.rejectBill(id, reason); },
    async recordPayment(billId, amount, mode) { return actions.recordPayment(billId, amount, mode); },
  },
  documents: {
    async listDocuments(f = {}) {
      return getOpsDb().documents.filter((d) =>
        (!f.mineId || f.mineId === 'ALL' || d.mineId === f.mineId) &&
        (!f.category || d.category === f.category) && (!f.status || d.status === f.status));
    },
    async uploadDocument(file, meta) {
      return actions.createDocument({ ...meta, file: { name: file.name, sizeKb: Math.max(1, Math.round(file.size / 1024)), uploadedAt: new Date().toISOString() } });
    },
    async approveDocument(id) { actions.approveDocument(id); },
    async rejectDocument(id, reason) { actions.rejectDocument(id, reason); },
  },
  inspections: {
    async listInspections(f = {}) { return getOpsDb().inspections.filter((i) => !f.mineId || f.mineId === 'ALL' || i.mineId === f.mineId); },
    async createInspection(input) { return actions.createInspection(input); },
    async completeInspection(id, reportFile) { actions.completeInspection(id, reportFile); },
  },
};

// ---------- HTTP adapter (explicit; throws for unconfirmed contracts) ----------
function todoRepo(name: string, key: OpsEndpointKey): never {
  throw new OpsHttpError(`TODO: ${name} requires confirmed endpoint ${key}.`, 0, key);
}
const httpRepo: OperationsRepositories = {
  mode: 'http',
  workers: {
    listWorkers: (f) => opsFetch('workers', { query: f as never }),
    getWorkerById: async (id) => opsFetch('workers', { params: { id } }),
    createWorker: (input) => opsFetch('createWorker', { body: input }),
    updateWorker: (id, patch) => opsFetch('updateWorker', { params: { id }, body: patch }),
    updateWorkerStatus: (id, status) => opsFetch('updateWorker', { params: { id }, body: { status } }),
  },
  contractors: {
    listContractors: (f) => opsFetch('contractors', { query: f as never }),
    createContractor: (input) => opsFetch('createContractor', { body: input }),
  },
  attendance: {
    listAttendance: (f) => opsFetch('attendance', { query: f as never }),
    checkIn: (workerId) => opsFetch('checkIn', { body: { workerId } }),
    checkOut: (workerId) => opsFetch('checkOut', { body: { workerId } }),
    getWorkerAttendance: (workerId) => opsFetch('attendance', { query: { workerId } }),
  },
  production: {
    listProduction: (f) => opsFetch('production', { query: f as never }),
    createProduction: (input) => opsFetch('createProduction', { body: input }),
  },
  dispatches: {
    listDispatches: (f) => opsFetch('dispatches', { query: f as never }),
    createDispatch: (input) => opsFetch('createDispatch', { body: input }),
    updateDispatchStatus: (id, status) => opsFetch('createDispatch', { body: { id, status } }) as never,
  },
  stockpiles: {
    listStockpiles: (f) => opsFetch('stockpiles', { query: f as never }),
    createStockpile: (input) => opsFetch('createStockpile', { body: input }),
    transferStock: (input) => opsFetch('transferStock', { body: input }),
    reconcileStock: (stockpileId, physicalMt, note) => opsFetch('reconcileStock', { body: { stockpileId, physicalMt, note } }),
    getCurrentStock: (id) => opsFetch('stockpiles', { params: { id } }).then((s: any) => s.currentMt ?? 0),
  },
  bills: {
    listBills: (f) => opsFetch('bills', { query: f as never }),
    createBill: (input) => opsFetch('createBill', { body: input }),
    approveBill: (id) => opsFetch('approveBill', { params: { id } }),
    rejectBill: (id, reason) => opsFetch('rejectBill', { params: { id }, body: { reason } }),
    recordPayment: (billId, amount, mode) => opsFetch('recordPayment', { body: { billId, amount, mode } }),
  },
  documents: {
    listDocuments: (f) => opsFetch('documents', { query: f as never }),
    uploadDocument: (file, meta) => {
      const form = new FormData();
      form.append('file', file);
      form.append('meta', JSON.stringify(meta));
      return opsUpload('uploadDocument', form);
    },
    approveDocument: (id) => opsFetch('documentAction', { params: { id, action: 'approve' } }),
    rejectDocument: (id, reason) => opsFetch('documentAction', { params: { id, action: 'reject' }, body: { reason } }),
  },
  inspections: {
    listInspections: (f) => opsFetch('inspections', { query: f as never }),
    createInspection: (input) => opsFetch('createInspection', { body: input }),
    completeInspection: (id, reportFile) => opsFetch('completeInspection', { params: { id }, body: { reportFile } }),
  },
};

export const repositories: OperationsRepositories = OPS_DATA_MODE === 'http' ? httpRepo : mockRepo;
export { todoRepo };
