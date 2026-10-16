/**
 * Service interfaces + mock implementations + HTTP placeholders.
 * Pages depend ONLY on these interfaces (via getServices()).
 * - Mock mode: full implementations over the central mockDb store.
 * - HTTP mode: typed stubs that throw a TODO error naming the unconfirmed
 *   endpoint — never silently substituted with mock data.
 */
import { actions, getDb } from './mockDb';
import {
  FindingStatus, type Contractor, type CorrectiveAction, type DgmsUser,
  type DispatchRecord, type Finding, type Inspection, type Mine, type RolePermissions,
  type SystemSettings, type UserRole, type Worker,
} from './types';
import { ApiError, ENDPOINTS, http } from './api';

// ---------- Interfaces ----------

export interface MineService {
  list(q?: string, state?: string, status?: string, type?: string, operator?: string): Mine[];
  get(id: string): Mine | undefined;
  create(input: Omit<Mine, 'id' | 'location'> & { location?: Mine['location'] }): string;
  update(id: string, patch: Partial<Mine>): void;
}

export interface InspectionService {
  list(f: { q?: string; state?: string; mineId?: string; inspectorId?: string; status?: string }): Inspection[];
  get(id: string): Inspection | undefined;
  create(input: Omit<Inspection, 'id' | 'reportStatus'>): string;
  update(id: string, patch: Partial<Inspection>): void;
}

export interface FindingService {
  list(f: { q?: string; state?: string; mineId?: string; category?: string; severity?: string; status?: string }): Finding[];
  get(id: string): Finding | undefined;
  update(id: string, patch: Partial<Finding> & { forceNote?: string }): void;
  assignAction(findingId: string, input: { officer: string; dueDate: string; note: string }): string;
  updateAction(id: string, patch: Partial<CorrectiveAction> & { resolution?: string }): void;
  actionsFor(findingId: string): CorrectiveAction[];
}

export interface NotificationService {
  list(f: { q?: string; category?: string; priority?: string; status?: string; mineId?: string; state?: string }): ReturnType<typeof getDb>['notifications'];
  markRead(id: string): void;
  markSelectedRead(ids: string[]): void;
  markAllRead(): void;
  acknowledge(id: string): void;
  resolve(id: string): void;
}

export interface ReportService {
  generate(type: string, name: string, filters: Record<string, string>, csv: string): string;
}

export interface SettingsService {
  getUsers(): DgmsUser[];
  createUser(input: Omit<DgmsUser, 'id' | 'lastLogin'>): string;
  updateUser(id: string, patch: Partial<DgmsUser>): void;
  getPermissions(): RolePermissions[];
  updatePermissions(role: UserRole, perms: RolePermissions['perms']): void;
  getSettings(): SystemSettings;
  updateSettings(patch: Partial<SystemSettings>, label?: string): void;
}

export interface WorkerService {
  list(f: { q?: string; mineId?: string; contractorId?: string; status?: string }): Worker[];
  create(input: Omit<Worker, 'id' | 'idMasked'>): string;
  update(id: string, patch: Partial<Worker>): void;
}

export interface ContractorService {
  list(): Contractor[];
  create(input: Omit<Contractor, 'id'>): string;
}

export interface DispatchService {
  list(f: { q?: string; state?: string; mineId?: string; status?: string }): DispatchRecord[];
  record(input: Omit<DispatchRecord, 'id' | 'status'> & { status?: DispatchRecord['status'] }): string;
  update(id: string, patch: Partial<DispatchRecord>): void;
}

export interface Services {
  mode: 'mock' | 'http';
  mines: MineService;
  inspections: InspectionService;
  findings: FindingService;
  notifications: NotificationService;
  reports: ReportService;
  settings: SettingsService;
  workers: WorkerService;
  contractors: ContractorService;
  dispatch: DispatchService;
}

// ---------- Mock implementations (single source: mockDb) ----------

function mineById(id: string) { return getDb().mines.find((m) => m.id === id); }

export const mockServices: Services = {
  mode: 'mock',
  mines: {
    list: (q, state, status, type, operator) => {
      const activeIds = new Set(getDb().mines.filter((m) => m.status !== 'Inactive' && m.status !== 'Closed').map((m) => m.id));
      void activeIds;
      return getDb().mines.filter((m) => {
        if (q && !(m.name.toLowerCase().includes(q.toLowerCase()) || m.code.toLowerCase().includes(q.toLowerCase()) || m.operator.toLowerCase().includes(q.toLowerCase()))) return false;
        if (state && m.state !== state) return false;
        if (status && m.status !== status) return false;
        if (type && m.type !== type) return false;
        if (operator && m.operator !== operator) return false;
        return true;
      });
    },
    get: (id) => mineById(id),
    create: (input) => actions.createMine(input),
    update: (id, patch) => actions.updateMine(id, patch),
  },
  inspections: {
    list: (f) => getDb().inspections.filter((i) => {
      const m = mineById(i.mineId);
      if (f.q && !(i.id.toLowerCase().includes(f.q.toLowerCase()) || (m?.name.toLowerCase().includes(f.q.toLowerCase())))) return false;
      if (f.state && m?.state !== f.state) return false;
      if (f.mineId && i.mineId !== f.mineId) return false;
      if (f.inspectorId && i.inspectorId !== f.inspectorId) return false;
      if (f.status && i.status !== f.status) return false;
      return true;
    }),
    get: (id) => getDb().inspections.find((i) => i.id === id),
    create: (input) => actions.createInspection(input),
    update: (id, patch) => actions.updateInspection(id, patch),
  },
  findings: {
    list: (f) => getDb().findings.filter((x) => {
      const m = mineById(x.mineId);
      if (f.q && !(x.id.toLowerCase().includes(f.q.toLowerCase()) || x.description.toLowerCase().includes(f.q.toLowerCase()))) return false;
      if (f.state && m?.state !== f.state) return false;
      if (f.mineId && x.mineId !== f.mineId) return false;
      if (f.category && x.category !== f.category) return false;
      if (f.severity && x.severity !== f.severity) return false;
      if (f.status && x.status !== f.status) return false;
      return true;
    }),
    get: (id) => getDb().findings.find((x) => x.id === id),
    update: (id, patch) => actions.updateFinding(id, patch),
    assignAction: (fid, input) => actions.assignCorrectiveAction(fid, input),
    updateAction: (id, patch) => actions.updateCorrectiveAction(id, patch),
    actionsFor: (fid) => getDb().correctiveActions.filter((c) => c.findingId === fid),
  },
  notifications: {
    list: (f) => getDb().notifications.filter((n) => {
      if (f.q && !(n.title.toLowerCase().includes(f.q.toLowerCase()) || n.description.toLowerCase().includes(f.q.toLowerCase()))) return false;
      if (f.category && n.category !== f.category) return false;
      if (f.priority && n.priority !== f.priority) return false;
      if (f.status && n.status !== f.status) return false;
      if (f.mineId && n.mineId !== f.mineId) return false;
      if (f.state && n.state !== f.state) return false;
      return true;
    }),
    markRead: (id) => actions.markRead(id),
    markSelectedRead: (ids) => actions.markSelectedRead(ids),
    markAllRead: () => actions.markAllRead(),
    acknowledge: (id) => actions.acknowledgeNotification(id),
    resolve: (id) => actions.resolveNotification(id),
  },
  reports: {
    generate: (type, name, filters, csv) => actions.generateReport(type, name, filters, csv),
  },
  settings: {
    getUsers: () => getDb().users,
    createUser: (input) => actions.createUser(input),
    updateUser: (id, patch) => actions.updateUser(id, patch),
    getPermissions: () => getDb().perms,
    updatePermissions: (role, perms) => actions.updatePermissions(role, perms),
    getSettings: () => getDb().settings,
    updateSettings: (patch, label) => actions.updateSettings(patch, label),
  },
  workers: {
    list: (f) => getDb().workers.filter((w) => {
      if (f.q && !(w.name.toLowerCase().includes(f.q.toLowerCase()) || w.id.toLowerCase().includes(f.q.toLowerCase()))) return false;
      if (f.mineId && w.mineId !== f.mineId) return false;
      if (f.contractorId && w.contractorId !== f.contractorId) return false;
      if (f.status && (w.status !== f.status)) return false;
      return true;
    }),
    create: (input) => actions.createWorker(input),
    update: (id, patch) => actions.updateWorker(id, patch),
  },
  contractors: {
    list: () => getDb().contractors,
    create: (input) => actions.createContractor(input),
  },
  dispatch: {
    list: (f) => getDb().dispatches.filter((d) => {
      const m = mineById(d.mineId);
      if (f.q && !(d.id.toLowerCase().includes(f.q.toLowerCase()) || d.vehicle.toLowerCase().includes(f.q.toLowerCase()) || d.destination.toLowerCase().includes(f.q.toLowerCase()))) return false;
      if (f.state && m?.state !== f.state) return false;
      if (f.mineId && d.mineId !== f.mineId) return false;
      if (f.status && d.status !== f.status) return false;
      return true;
    }),
    record: (input) => actions.recordDispatch(input),
    update: (id, patch) => actions.updateDispatch(id, patch),
  },
};

// ---------- HTTP placeholders (TODO: confirm each endpoint with backend) ----------

function todo(what: string, endpoint: string): never {
  throw new ApiError(`HTTP adapter not implemented: ${what} (proposed ${endpoint} — unconfirmed, see lib/dgms/api.ts). No mock fallback is applied.`);
}

export const httpServices: Services = {
  mode: 'http',
  mines: {
    list: () => todo('listMines', ENDPOINTS.mines),
    get: () => todo('getMineById', ENDPOINTS.mineById),
    create: () => todo('createMine', ENDPOINTS.mines),
    update: () => todo('updateMine', ENDPOINTS.mineById),
  },
  inspections: {
    list: () => todo('listInspections', ENDPOINTS.inspections),
    get: () => todo('getInspectionById', ENDPOINTS.inspectionById),
    create: () => todo('createInspection', ENDPOINTS.inspections),
    update: () => todo('updateInspection', ENDPOINTS.inspectionById),
  },
  findings: {
    list: () => todo('listFindings', ENDPOINTS.findings),
    get: () => todo('getFindingById', ENDPOINTS.findingById),
    update: () => todo('updateFinding', ENDPOINTS.findingById),
    assignAction: () => todo('assignCorrectiveAction', ENDPOINTS.correctiveActions),
    updateAction: () => todo('updateCorrectiveAction', ENDPOINTS.correctiveActions),
    actionsFor: () => todo('correctiveActionsFor', ENDPOINTS.correctiveActions),
  },
  notifications: {
    list: () => todo('listNotifications', ENDPOINTS.notifications),
    markRead: () => todo('markRead', ENDPOINTS.notifications),
    markSelectedRead: () => todo('markSelectedRead', ENDPOINTS.notifications),
    markAllRead: () => todo('markAllRead', ENDPOINTS.notifications),
    acknowledge: () => todo('acknowledge', ENDPOINTS.notifications),
    resolve: () => todo('resolve', ENDPOINTS.notifications),
  },
  reports: {
    generate: () => todo('generateReport', ENDPOINTS.reports),
  },
  settings: {
    getUsers: () => todo('getUsers', ENDPOINTS.users),
    createUser: () => todo('createUser', ENDPOINTS.users),
    updateUser: () => todo('updateUser', ENDPOINTS.users),
    getPermissions: () => todo('getRolePermissions', ENDPOINTS.permissions),
    updatePermissions: () => todo('updateRolePermissions', ENDPOINTS.permissions),
    getSettings: () => todo('getSettings', ENDPOINTS.settings),
    updateSettings: () => todo('updateSettings', ENDPOINTS.settings),
  },
  workers: {
    list: () => todo('listWorkers', ENDPOINTS.workers),
    create: () => todo('createWorker', ENDPOINTS.workers),
    update: () => todo('updateWorker', ENDPOINTS.workers),
  },
  contractors: {
    list: () => todo('listContractors', ENDPOINTS.contractors),
    create: () => todo('createContractor', ENDPOINTS.contractors),
  },
  dispatch: {
    list: () => todo('listDispatch', ENDPOINTS.dispatch),
    record: () => todo('recordDispatch', ENDPOINTS.dispatch),
    update: () => todo('updateDispatch', ENDPOINTS.dispatch),
  },
};

export function getServices(): Services {
  // Demo mode is explicit and visible (DEMO badge in Shell). HTTP mode is
  // selected via NEXT_PUBLIC_DGMS_DATA_MODE=http once endpoints are confirmed.
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_DGMS_DATA_MODE === 'http') {
    return httpServices;
  }
  return mockServices;
}

export { FindingStatus };
export async function pingHttp(): Promise<{ ok: boolean; latencyMs: number }> {
  const t0 = Date.now();
  await http('/health', { method: 'GET' });
  return { ok: true, latencyMs: Date.now() - t0 };
}
