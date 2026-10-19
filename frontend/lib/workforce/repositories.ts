/**
 * Typed repository contracts for the contractor workforce portal.
 *
 * Pages/hooks consume these interfaces — never raw fetch or store internals —
 * so switching mock ↔ HTTP requires no page rewrites.
 *   - mockRepo: delegates to the centralized store (demo mode).
 *   - httpRepo: typed adapters in api.ts; unconfirmed endpoints throw named
 *     TODO errors; failures propagate (never silently fall back to mock).
 *
 * Today the interactive pages read reactively via useMockWorkforce() (a single
 * store subscription) and mutate via `actions`, which implement exactly the
 * semantics below. The async surface exists so HTTP mode drops in cleanly.
 */
import { WORKFORCE_DATA_MODE, WorkforceHttpError, workforceFetch, workforceUpload, type WorkforceEndpointKey } from './api';
import { actions, computeKpis, getWorkforceDb, type Kpis } from './store';
import {
  AccessStatus, AttendanceStatus, IncidentStatus,
} from './types';
import type {
  AccessRecord, AttendanceRecord, Bill, Contractor, CreateContractorInput,
  CreateIncidentInput, CreateTrainingInput, CreateWorkerInput, DemoRole, GatePass,
  Incident, LeaveRecord, Payment, PortalDocument, PortalNotification, ReportRow,
  TrainingRecord, TransferRequest, UpdateWorkerInput, Worker,
} from './types';

export interface WorkforceRepository {
  listContractors(): Promise<Contractor[]>;
  listWorkers(): Promise<Worker[]>;
  listTraining(): Promise<TrainingRecord[]>;
  listAttendance(): Promise<AttendanceRecord[]>;
  listAccess(): Promise<AccessRecord[]>;
  listLeaves(): Promise<LeaveRecord[]>;
  listGatePasses(): Promise<GatePass[]>;
  listBills(): Promise<Bill[]>;
  listPayments(): Promise<Payment[]>;
  listDocuments(): Promise<PortalDocument[]>;
  listTransfers(): Promise<TransferRequest[]>;
  listIncidents(): Promise<Incident[]>;
  listReports(): Promise<ReportRow[]>;
  listNotifications(): Promise<PortalNotification[]>;
  getKpis(): Promise<Kpis>;

  createWorker(input: CreateWorkerInput): Promise<string>;
  updateWorker(id: string, patch: UpdateWorkerInput): Promise<void>;
  createContractor(input: CreateContractorInput): Promise<string>;
  updateContractor(id: string, patch: Partial<CreateContractorInput>): Promise<void>;
  createTraining(input: CreateTrainingInput): Promise<string>;
  updateTraining(id: string, patch: Partial<CreateTrainingInput>): Promise<void>;
  verifyTraining(id: string): Promise<void>;
  renewTraining(id: string): Promise<void>;
  markAttendance(workerId: string, status: string, manual: boolean): Promise<void>;
  decideAccess(recordId: string, status: string, reason: string): Promise<void>;
  submitBill(input: { contractId: string; mineId: string; workPeriod: string; amount: number; description: string }): Promise<string>;
  createTransfer(input: { workerId: string; toMineId: string; toDepartment: string; reason: string }): Promise<string>;
  decideTransfer(id: string, decision: 'approve' | 'reject' | 'cancel'): Promise<void>;
  createIncident(input: CreateIncidentInput): Promise<string>;
  setIncidentStatus(id: string, status: string, resolution?: string): Promise<void>;
  uploadDocument(input: { name: string; category: PortalDocument['category']; relatedType: PortalDocument['relatedType']; relatedId: string; mineId: string; expiryDate: string; sizeKb: number }): Promise<string>;
  generateReport(input: { title: string; category: string; period: string }): Promise<string>;
  setRole(role: DemoRole): Promise<void>;
  setSelectedMine(mineId: string): Promise<void>;
  resetDemo(): Promise<void>;
}

// ---------- Mock adapter (delegates to the single store) ----------
const mockRepo: WorkforceRepository = {
  async listContractors() { return getWorkforceDb().contractors; },
  async listWorkers() { return getWorkforceDb().workers; },
  async listTraining() { return getWorkforceDb().training; },
  async listAttendance() { return getWorkforceDb().attendance; },
  async listAccess() { return getWorkforceDb().access; },
  async listLeaves() { return getWorkforceDb().leaves; },
  async listGatePasses() { return getWorkforceDb().gatePasses; },
  async listBills() { return getWorkforceDb().bills; },
  async listPayments() { return getWorkforceDb().payments; },
  async listDocuments() { return getWorkforceDb().documents; },
  async listTransfers() { return getWorkforceDb().transfers; },
  async listIncidents() { return getWorkforceDb().incidents; },
  async listReports() { return getWorkforceDb().reports; },
  async listNotifications() { return getWorkforceDb().notifications; },
  async getKpis() { return computeKpis(getWorkforceDb()); },

  async createWorker(input) { return actions.createWorker(input); },
  async updateWorker(id, patch) { actions.updateWorker(id, patch); },
  async createContractor(input) { return actions.createContractor(input); },
  async updateContractor(id, patch) { actions.updateContractor(id, patch); },
  async createTraining(input) { return actions.createTraining(input); },
  async updateTraining(id, patch) { actions.updateTraining(id, patch); },
  async verifyTraining(id) { actions.verifyTraining(id); },
  async renewTraining(id) { actions.renewTraining(id); },
  async markAttendance(workerId, status, manual) {
    actions.markAttendance(workerId, status as AttendanceStatus, manual);
  },
  async decideAccess(recordId, status, reason) {
    actions.decideAccess(recordId, status as AccessStatus, reason);
  },
  async submitBill(input) { return actions.submitBill(input); },
  async createTransfer(input) { return actions.createTransfer(input); },
  async decideTransfer(id, decision) { actions.decideTransfer(id, decision); },
  async createIncident(input) { return actions.createIncident(input); },
  async setIncidentStatus(id, status, resolution) {
    actions.setIncidentStatus(id, status as IncidentStatus, resolution);
  },
  async uploadDocument(input) { return actions.uploadDocument(input); },
  async generateReport(input) { return actions.generateReport(input); },
  async setRole(role) { actions.setRole(role); },
  async setSelectedMine(mineId) { actions.setSelectedMine(mineId); },
  async resetDemo() { actions.resetDemo(); },
};

// ---------- HTTP adapter (explicit; throws for unconfirmed contracts) ----------
const httpRepo: WorkforceRepository = {
  listContractors: () => workforceFetch('contractors'),
  listWorkers: () => workforceFetch('workers'),
  listTraining: () => workforceFetch('training'),
  listAttendance: () => workforceFetch('attendance'),
  listAccess: () => workforceFetch('accessLogs'),
  listLeaves: () => workforceFetch('leaves'),
  listGatePasses: () => workforceFetch('gatePasses'),
  listBills: () => workforceFetch('bills'),
  listPayments: () => workforceFetch('payments'),
  listDocuments: () => workforceFetch('documents'),
  listTransfers: () => workforceFetch('transfers'),
  listIncidents: () => workforceFetch('incidents'),
  listReports: () => workforceFetch('reports'),
  listNotifications: () => workforceFetch('portalNotifications'),
  getKpis: () => workforceFetch('kpis'),

  createWorker: (input) => workforceFetch('createWorker', { body: input }),
  updateWorker: async (id, patch) => { await workforceFetch('updateWorker', { params: { id }, body: patch }); },
  createContractor: (input) => workforceFetch('createContractor', { body: input }),
  updateContractor: async (id, patch) => { await workforceFetch('updateContractor', { params: { id }, body: patch }); },
  createTraining: (input) => workforceFetch('createTraining', { body: input }),
  updateTraining: async (id, patch) => { await workforceFetch('updateTraining', { params: { id }, body: patch }); },
  verifyTraining: async (id) => { await workforceFetch('verifyTraining', { params: { id } }); },
  renewTraining: async (id) => { await workforceFetch('renewTraining', { params: { id } }); },
  markAttendance: async (workerId, status, manual) => { await workforceFetch('markAttendance', { params: { workerId }, body: { status, manual } }); },
  decideAccess: async (recordId, status, reason) => { await workforceFetch('decideAccess', { params: { id: recordId }, body: { status, reason } }); },
  submitBill: (input) => workforceFetch('submitBill', { body: input }),
  createTransfer: (input) => workforceFetch('createTransfer', { body: input }),
  decideTransfer: async (id, decision) => { await workforceFetch('decideTransfer', { params: { id }, body: { decision } }); },
  createIncident: (input) => workforceFetch('createIncident', { body: input }),
  setIncidentStatus: async (id, status, resolution) => { await workforceFetch('setIncidentStatus', { params: { id }, body: { status, resolution } }); },
  uploadDocument: (input) => {
    const form = new FormData();
    form.append('file', new Blob([JSON.stringify(input)], { type: 'application/json' }), input.name);
    form.append('payload', JSON.stringify(input));
    return workforceUpload('uploadDocument', form);
  },
  generateReport: (input) => workforceFetch('generateReport', { body: input }),
  setRole: async () => { /* client-side demo affordance; persisted locally */ },
  setSelectedMine: async () => { /* client-side preference; persisted locally */ },
  resetDemo: async () => { /* demo-only affordance; not exposed over HTTP */ },
};

/** Active repository — selected by NEXT_PUBLIC_WORKFORCE_DATA_MODE. */
export const repository: WorkforceRepository =
  WORKFORCE_DATA_MODE === 'http' ? httpRepo : mockRepo;

export const REPOSITORY_MODE = WORKFORCE_DATA_MODE;
export { WorkforceHttpError };
export type { Kpis };
