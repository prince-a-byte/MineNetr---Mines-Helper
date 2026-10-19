/**
 * Typed repository contracts for the contractor "My Contracts" portal.
 *
 * Pages/hooks consume these interfaces — never raw fetch or store internals —
 * so switching mock ↔ HTTP requires no page rewrites.
 *   - mockRepo: delegates to the centralized store (demo mode).
 *   - httpRepo: typed adapters in api.ts; unconfirmed endpoints throw named
 *     TODO errors; failures propagate (never silently fall back to mock).
 *
 * Today the interactive page reads reactively via useMockContracts() (single
 * store subscription) and mutates via `actions`, which implement exactly the
 * semantics below. The async surface exists so HTTP mode drops in cleanly.
 */
import { CONTRACTS_DATA_MODE, ContractsHttpError, contractsFetch, contractsUpload, type ContractsEndpointKey } from './api';
import { actions, filterContracts, getContractsDb, upcomingMilestones } from './store';
import type {
  ActivityEntry, Contract, ContractDocument, ContractFilters, ContractMilestone,
  ContractRequest, Mine, NewContractRequestInput, RenewalRequest, RenewalRequestInput,
} from './types';

export interface ContractsRepository {
  listMines(): Promise<Mine[]>;
  listContracts(filter?: Partial<ContractFilters> & { q?: string }): Promise<Contract[]>;
  getContractById(id: string): Promise<Contract | null>;
  listMilestones(contractId?: string): Promise<ContractMilestone[]>;
  listUpcomingMilestones(mineId?: string): Promise<ContractMilestone[]>;
  listDocuments(contractId: string): Promise<ContractDocument[]>;
  listActivity(contractId?: string): Promise<ActivityEntry[]>;
  listContractRequests(): Promise<ContractRequest[]>;
  listRenewalRequests(): Promise<RenewalRequest[]>;
  createContractRequest(input: NewContractRequestInput): Promise<string>;
  requestRenewal(contractId: string, input: RenewalRequestInput): Promise<string>;
  updateMilestone(id: string, patch: { submit?: boolean; documentRef?: string; clarify?: boolean }): Promise<void>;
  uploadDocument(contractId: string, file: { name: string; sizeKb: number }, category: string): Promise<string>;
  setSelectedMine(mineId: string): Promise<void>;
  resetDemo(): Promise<void>;
}

const DEFAULT_FILTER: ContractFilters = {
  mineId: 'ALL', status: 'All Contracts', workType: 'All Work Types',
  startFrom: '', startTo: '', endFrom: '', endTo: '', minValue: '', maxValue: '',
};

// ---------- Mock adapter (delegates to the single store) ----------
const mockRepo: ContractsRepository = {
  async listMines() { return getContractsDb().mines; },
  async listContracts(f = {}) {
    const db = getContractsDb();
    const merged = { ...DEFAULT_FILTER, ...f } as ContractFilters;
    return filterContracts(db.contracts, merged, f.q ?? '');
  },
  async getContractById(id) { return getContractsDb().contracts.find((c) => c.id === id) ?? null; },
  async listMilestones(contractId) {
    const db = getContractsDb();
    return contractId ? db.milestones.filter((m) => m.contractId === contractId) : db.milestones;
  },
  async listUpcomingMilestones(mineId = 'ALL') { return upcomingMilestones(mineId); },
  async listDocuments(contractId) { return getContractsDb().documents.filter((d) => d.contractId === contractId); },
  async listActivity(contractId) {
    const db = getContractsDb();
    return contractId ? db.activity.filter((a) => a.contractId === contractId) : db.activity;
  },
  async listContractRequests() { return getContractsDb().requests; },
  async listRenewalRequests() { return getContractsDb().renewals; },
  async createContractRequest(input) { return actions.createContractRequest(input); },
  async requestRenewal(contractId, input) { return actions.requestRenewal(contractId, input); },
  async updateMilestone(id, patch) { actions.updateMilestone(id, patch); },
  async uploadDocument(contractId, file, category) { return actions.uploadDocument(contractId, file, category); },
  async setSelectedMine(mineId) { actions.setSelectedMine(mineId); },
  async resetDemo() { actions.resetDemo(); },
};

// ---------- HTTP adapter (explicit; throws for unconfirmed contracts) ----------
const httpRepo: ContractsRepository = {
  listMines: () => contractsFetch('mines'),
  listContracts: (f) => contractsFetch('contracts', { query: f as never }),
  getContractById: (id) => contractsFetch('contractById', { params: { id } }),
  listMilestones: (contractId) => contractsFetch('milestones', { params: { id: contractId ?? '' } }),
  listUpcomingMilestones: (mineId) => contractsFetch('milestones', { query: { upcoming: 'true', mineId } }),
  listDocuments: (contractId) => contractsFetch('documents', { params: { id: contractId } }),
  listActivity: (contractId) => contractsFetch('activity', { params: { id: contractId ?? '' } }),
  listContractRequests: () => contractsFetch('listContractRequests'),
  listRenewalRequests: () => contractsFetch('listRenewalRequests'),
  createContractRequest: (input) => contractsFetch('createContractRequest', { body: input }),
  requestRenewal: (contractId, input) => contractsFetch('createRenewalRequest', { body: { contractId, ...input } }),
  updateMilestone: (id, patch) => contractsFetch('updateMilestone', { params: { id }, body: patch }),
  uploadDocument: (contractId, file, category) => {
    const form = new FormData();
    form.append('file', new Blob([JSON.stringify(file)], { type: 'application/json' }), file.name);
    form.append('category', category);
    return contractsUpload('uploadDocument', form, { id: contractId });
  },
  setSelectedMine: async () => { /* client-side preference; persisted locally */ },
  resetDemo: async () => { /* demo-only affordance; not exposed over HTTP */ },
};

/** Active repository — selected by NEXT_PUBLIC_CONTRACTS_DATA_MODE. */
export const repository: ContractsRepository =
  CONTRACTS_DATA_MODE === 'http' ? httpRepo : mockRepo;

export const REPOSITORY_MODE = CONTRACTS_DATA_MODE;
export { ContractsHttpError };
